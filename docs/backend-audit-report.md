# Backend Audit — Scaling Fleet Manager from ~2,000 to 5,000+ EM Devices

## Methodology

**Environment**: local Docker deployment of stock, unmodified Fleet Manager (`shellygroup/fleet-management:latest`, commit `6ba52a8da`, v1.91.0), brought up via `deploy-public.sh`. The host has 8 vCPU, but Docker was only given 4GB of RAM — nowhere near the reference machine (4 vCPU / 16-24GB). RAM is the real constraint here, not CPU, so the absolute device counts below should be read as illustrative rather than predictive. What actually transfers to the reference machine is the mechanism behind each failure, not the exact number it happened at, and I've tried to make that reasoning explicit in every finding.

**Tooling**: the provided `fleet-manager-stress-test` tool, simulating Shelly Pro 3EM devices from `boiled.data.json` via `--ramp`/`--step-add`, pointed at the local FM instance over plain `ws://`. Evidence came from direct Postgres introspection (`pg_stat_activity`, `pg_stat_user_tables`, `timescaledb_information.hypertables`), container resource stats, and FM's own logs.

**Approach**: capture an idle baseline, ramp simulated EM devices in steps (0 to ~2,900, in batches of 200-300 every 90 seconds), approve each batch through FM's Waiting Room, and watch for the first signs of trouble — then go correlate that against live Postgres and container state. Once I had a primary bottleneck, I ran a controlled before/after test by toggling one of FM's own existing (but disabled-by-default) mitigations.

One thing worth flagging up front: because devices were approved in large discrete batches, mirroring how the Waiting Room actually works, each approval creates a genuine admission burst — a lot of devices being created and registered at once, plus each newly-admitted device kicking off EM-sync catch-up for whatever backlog it's carrying. That's a harder load pattern than steady, drip-fed ingestion from an already-onboarded fleet. Everything below was surfaced by bursts — onboarding, mass reconnects — more than by steady-state EM writes, and that distinction carries through to the extrapolation section.

## Baseline

- Postgres config (public deploy defaults): `max_connections=100`, `shared_buffers=256MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`.
- App-level DB pool: `FM_DB_POOL_MAX` isn't set, so it falls back to the code default of 60.
- `pg_stat_statements` isn't enabled. `CREATE EXTENSION pg_stat_statements` succeeds, but querying it fails with `must be loaded via "shared_preload_libraries"` — so there's no query-level performance visibility in this deployment at all right now.
- At idle, with one real device connected: 24MB database, 9 Postgres connections (1 active), 2 hypertable chunks per table.

## Findings

### 1. `max_connections=100` runs out under admission/reconnect bursts, and it costs real data

Ramping toward ~2,900 simulated EM devices, Postgres started outright refusing connections: `sorry, too many clients already`. This is a hard failure, and it hit several independent subsystems at once:

```
[ERROR] shelly-ws - Unhandled Shelly websocket message error: sorry, too many clients already
[ERROR] firmware-job-worker - firmware job tick failed: error: sorry, too many clients already
[ERROR] credential-push - tick failed: error: sorry, too many clients already
[ERROR] backup-job-worker - backup job tick failed: error: sorry, too many clients already
```

64+ occurrences inside a 2-minute window, still happening when I checked back a minute later. The `shelly-ws` failures are the part that actually matters: live device status messages get dropped there, not queued, so that's the real mechanism behind EM telemetry loss.

Why it happens: the app's pool (`FM_DB_POOL_MAX=60`) leaves only about 40 connections of headroom against Postgres's 100-connection ceiling, and that headroom has to cover Zitadel, TimescaleDB's own background workers, and the scheduled job workers (firmware, backup, and credential-push all grab a connection on every tick). A burst of new-device registrations — each one needing several sequential queries (existence check, insert or update, membership, entity creation) before it releases its connection — burns through that headroom in seconds.

### 2. `device.fn_add` takes an unconditional whole-table lock

```sql
-- backend/db/migration/postgresql/device/6000_fn_add.sql
CREATE FUNCTION device.fn_add(p_external_id VARCHAR(50), p_jdoc JSONB)
RETURNS void AS $$
BEGIN
    LOCK TABLE device.list IN SHARE ROW EXCLUSIVE MODE;
    IF p_external_id IS NOT NULL AND NOT EXISTS (...) THEN
        INSERT INTO device.list (...) VALUES (...);
    ELSIF p_external_id IS NOT NULL THEN
        UPDATE device.list SET jdoc = ..., updated = NOW() WHERE ...;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

`SHARE ROW EXCLUSIVE` blocks every other writer to `device.list`, including other concurrent calls to this same function — so every device create or update serializes against every other one, fleet-wide. During the admission burst above, `pg_stat_activity` showed 58 concurrent calls to `fn_add` queued behind this lock, in a single snapshot. `device.list` already has a unique constraint on `external_id` (`device_list_external_id_unique`), which is exactly what you'd want backing an `INSERT ... ON CONFLICT ... DO UPDATE` instead — that takes a row-level lock through the index, not a table-level one.

Quick caveat: I went looking for where the non-batch `store()`/`fn_add` path actually gets called from and couldn't find one anywhere in the checked-out backend source — only the batch variant (`fn_add_batch`, called once from `app.ts`) has a caller I could track down. But `fn_add` was clearly running during the test, so either the runtime image I pulled predates a refactor that isn't reflected in the source I had, or I just missed the call path somewhere. Worth the team checking before anyone scopes the actual fix.

### 3. No query-level observability

Already mentioned in Baseline, but it's worth calling out as its own finding, because it genuinely limited how precise this audit could be — every measurement above came from live snapshots and manual `EXPLAIN`, not from aggregated stats. Whoever picks this up next shouldn't have to redo this exercise from scratch just to find the next bottleneck.

### One more thing, found along the way

FM's device-ingress gate has three enforcement modes — `record_only`, `enforce_new`, `enforce_all` — and the public deploy defaults to `record_only`. Under that default, new devices connecting for the first time never show up in the Waiting Room at all. The `record_only` code path in `ShellyWebsocketHandler.ts` explicitly skips the waiting-room-entry step (its own comment calls it a "legacy pre-gate admit"), and the only code path that actually writes a Waiting Room entry (`recordPending`) is gated behind `enforce_new`/`enforce_all`. Switching to `enforce_new` fixed it immediately — confirmed via direct Redis inspection that `fm:waitingroom:default` went from empty to populated. This is outside Task 2's scope, but it seems worth a bug report: it doesn't match what a first-time operator would expect from the default config, and the only reason I caught it was that I could read the source.

## Before/after: `FM_STATUS_REDIS_FIRST`

FM already ships a Redis Stream write-behind path for `device.status` writes, off by default (`FM_STATUS_REDIS_FIRST=false`). I reproduced a comparable ~2,900-device admission burst with it flipped on.

| | **Off** | **On** |
|---|---|---|
| Devices admitted before first connection error | ~1,596 (errors ongoing, still climbing) | ~1,884 |
| Total `too many clients already` errors | 64+ in ~2 min, still climbing | 18 total, then stopped |
| Peak `fleet-db` CPU | ~308% (3+ cores) | ~182%, settling to 26% |
| Peak `fleet-manager` CPU | ~170% | ~107%, settling to 23% |
| Postgres connections at full scale (2,900) | Hit 100 (rejecting) | Settled at 50 |
| `fleet-manager` RSS at full scale | ~835MB–958MB | 1.27GB |
| End state at full scale | Sustained failures | Fully stabilized |

One config flip meaningfully delayed the failure and, more importantly, let the system settle into a stable state at full test scale instead of continuing to degrade. The cost is higher application memory — Redis buffering trades DB connection pressure for in-process queue memory — which matters here specifically because memory is what's actually constrained on the reference machine class.

## Prioritized recommendations

1. **Enable `pg_stat_statements`** — add it to `shared_preload_libraries`. This costs basically nothing and has near-zero overhead, and it's the foundation for verifying every other change below with real numbers instead of manual sampling. No direct performance impact on its own, but a big jump in diagnostic capability, and very low risk since it's a standard extension. This could be done first, on the next planned maintenance window, since it's a startup-time config that can't be hot-applied.

2. **Enable `FM_STATUS_REDIS_FIRST`**, rolled out through `FM_STATUS_REDIS_SHADOW` first. This is the one I actually measured delaying and mostly preventing the connection-exhaustion failure, letting the system stabilize at scale instead of degrading (see the table above). Risk is low-to-medium: the code path already exists and is presumably tested, but I didn't test the drainer's behavior through a Redis outage and recovery, and application memory rises noticeably. It could be rolled out in shadow mode first — it writes both paths and compares without changing anything user-visible — for a validation period, then switched over with `REDIS_FIRST=true`.

3. **Raise `max_connections`, sized to the reference machine's actual RAM, as an immediate stopgap — then look seriously at a connection pooler (PgBouncer, transaction mode) for the medium term.** This is the direct cause of the data loss observed above, so fixing it should remove that primary failure mode outright, and a pooler on top would push the connection ceiling out much further still. Each Postgres connection costs real backend-process memory, roughly 5-10MB, so any bump needs to be sized against what the reference machine can actually spare — 16-24GB gives plenty of room to go well past 100, which this 4GB test rig simply didn't have, and that's a big part of why it hit the ceiling at a fairly modest device count. Raising the limit itself is low risk, just a config change and a restart; a pooler is a bigger architectural shift, and transaction-mode pooling has real compatibility caveats — session-level features, prepared statements — that need checking against FM's actual query patterns before it's trusted anywhere near production. `max_connections` could be bumped now as the stopgap, with PgBouncer piloted in staging first.

4. **Replace `device.fn_add`'s table lock with `INSERT ... ON CONFLICT ... DO UPDATE`.** This lock contention was directly observed — 58 blocked concurrent calls during the admission burst — and the existing unique constraint on `external_id` already supports a proper upsert with row-level, rather than table-level, locking. This removes a full-fleet serialization point specifically during onboarding and mass-reconnect events. It's medium risk: it needs to preserve the exact "only overwrite `jdoc` when a new value is provided" semantics, and it needs the call-site question from Finding 2 resolved first so the fix actually covers every real caller. It's a burst-resilience fix rather than a steady-state throughput fix, so it's less urgent than the first three items — but it's directly relevant to "5,000 devices all reconnecting after an outage."

## Extrapolating to 5,000+ EM devices

The mechanism found here — `max_connections=100` running out under connection bursts — is a fixed connection-count ceiling, not something driven by available RAM or CPU. The reference machine, despite having 4-6x more RAM than this test rig, is presumably still running the same public-default `max_connections=100` unless someone's already tuned it. The reference machine's own stated ceiling (~2,000-3,000 EM devices) lines up closely with where this exact failure hit on far less RAM, which makes it fairly likely this is the same mechanism at play there too, not a raw compute limit. That's good news, actually — it means the fix is a config and architecture change, not new hardware.

Two things point toward getting meaningfully past 5,000 with the recommendations above. First, the reference machine's much bigger RAM budget (16-24GB vs. this rig's 4GB) gives real room to raise `max_connections` safely, room this test rig never had. Second, FM's own code already expects much higher EM-sync scale than this — `ShellyEmHandler.ts` documents its own throughput math (roughly 3-4 DB queries plus 1 device RPC per sync, ~200-400 syncs/sec at `MAX_CONCURRENT_EM_SYNCS=40`), and its own table says 5,000 devices is "easy" and 20,000 is "handled" for that specific subsystem. So steady-state EM-sync throughput isn't actually the binding constraint at 5,000 devices — connection-pool exhaustion during bursts and `fn_add`'s lock contention during onboarding are. That's a useful reframe: the fixes needed are about burst resilience (onboarding a batch, recovering from an outage, a network blip causing a pile of correlated reconnects), not raw sustained ingestion capacity, which the codebase's own analysis says already has plenty of headroom.

With `pg_stat_statements` on, `FM_STATUS_REDIS_FIRST` on, `max_connections` sized to the reference machine's real RAM, and `fn_add`'s lock resolved, the connection-related failure demonstrated here should stop being the limiting factor at 5,000 devices — at which point EM-sync's own documented headroom, comfortably past 20,000, becomes the more relevant thing to watch.

## What to look at next

- Confirm `device.fn_add`'s actual current caller(s) in the deployed image before scoping the upsert rewrite (see Finding 2).
- Run this same methodology on hardware that actually matches the reference spec (4 vCPU / 16-24GB) to get real absolute numbers, not just mechanism-level findings.
- Specifically isolate the mass-reconnect/outage-recovery scenario — restart FM with an already-onboarded 5,000-device fleet all reconnecting at once — since that's the worst-case burst pattern this audit turned up.
- Pilot PgBouncer against FM's real query patterns in staging (prepared statements, session-level assumptions) before recommending it for production.
- Consider the same Redis-first treatment for `FM_DEVICE_SNAPSHOT_REDIS_FIRST` and the audit-log path — they follow the identical buffer/drain pattern and might see similar wins.
- Report the `record_only` waiting-room gap upstream — new devices silently never reaching the Waiting Room under the public deploy's own default doesn't seem intended.
