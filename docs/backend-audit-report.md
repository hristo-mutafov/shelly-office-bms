# Backend Audit — Scaling Fleet Manager from ~2,000 to 5,000+ EM Devices

## Methodology

**Environment**: local Docker deployment of stock, unmodified Fleet Manager (`shellygroup/fleet-management:latest`, commit `6ba52a8da`, v1.91.0), via `deploy-public.sh`. Host: 8 vCPU, Docker allocated **4GB RAM** / 8 CPUs. This is *not* the reference machine (4 vCPU / 16-24GB) — RAM in particular is far more constrained here (4GB total for the whole stack vs. 16-24GB dedicated). Absolute device counts below should not be read as direct predictions for the reference machine; the *mechanisms* are what transfer, and that reasoning is made explicit in each finding and in the extrapolation section.

**Tooling**: the provided `fleet-manager-stress-test` tool, simulating Shelly Pro 3EM (EM) devices from `boiled.data.json` via `--ramp`/`--step-add`, pointed at the local FM instance over plain `ws://` (FM's own `FM_PLAIN_WS` accommodation). Evidence gathered via direct Postgres introspection (`pg_stat_activity`, `pg_stat_user_tables`, `timescaledb_information.hypertables`), Docker container resource stats, and FM's own application logs.

**Approach**: capture an idle baseline, ramp simulated EM devices in steps (0 → ~2,900, in batches of ~200-300 every 90s), approve each batch through FM's Waiting Room, and watch for the first signs of degradation — then correlate against live Postgres/container state. Once a primary bottleneck was identified, ran a controlled before/after comparison toggling one of FM's existing (but disabled-by-default) mitigations.

**A methodology note on the ramp shape**: because our test methodology approves devices in large discrete batches (mirroring how the Waiting Room naturally works), each approval produces a genuine *admission burst* — many devices being created/registered in a short window, plus each newly-admitted device kicking off EM-sync catch-up for its device-side backlog. This is a legitimately harder load pattern than steady-state ingestion from an already-onboarded fleet, and it's worth being explicit that the bottlenecks below were surfaced by *bursts* (onboarding, mass reconnects) more than by steady drip-fed EM writes. This distinction matters directly for the extrapolation.

## Baseline

- Postgres config (public deploy defaults): `max_connections=100`, `shared_buffers=256MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`.
- App-level DB pool: `FM_DB_POOL_MAX` unset → code default of **60**.
- `pg_stat_statements` is **not** enabled — attempting `CREATE EXTENSION pg_stat_statements` succeeds (extension installs) but querying it fails with `must be loaded via "shared_preload_libraries"`. There is currently no query-level performance observability in this deployment at all.
- At idle (1 real device): 24MB database, 9 Postgres connections (1 active), 2 hypertable chunks per table.

## Findings

### 1. `max_connections=100` gets exhausted under admission/reconnect bursts — with real data loss (highest priority)

Ramping toward ~2,900 simulated EM devices, Postgres began outright refusing connections: `sorry, too many clients already`. This wasn't a slowdown — it was hard failure, and it hit **multiple independent subsystems simultaneously**:

```
[ERROR] shelly-ws - Unhandled Shelly websocket message error: sorry, too many clients already
[ERROR] firmware-job-worker - firmware job tick failed: error: sorry, too many clients already
[ERROR] credential-push - tick failed: error: sorry, too many clients already
[ERROR] backup-job-worker - backup job tick failed: error: sorry, too many clients already
```
64+ occurrences in a 2-minute window, still actively occurring when re-checked a minute later. Critically, `shelly-ws` failures mean **live device status messages were dropped**, not queued — this is the actual EM-telemetry-loss mechanism.

Why it happens: the app pool (`FM_DB_POOL_MAX=60`) leaves only ~40 connections of headroom on top of Postgres's 100-connection ceiling for Zitadel, TimescaleDB's own background workers, scheduled job workers (firmware/backup/credential-push all run on ticks that each grab a connection), and any admin/diagnostic session. That headroom evaporates within seconds under a burst of new-device registrations, each of which needs several sequential queries (existence check, insert/update, membership, entity creation) before releasing its connection.

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

`SHARE ROW EXCLUSIVE` blocks all other writers to `device.list`, including other concurrent calls to the same function — every device create/update **serializes against every other one**, fleet-wide. During the admission burst above, `pg_stat_activity` showed **58 concurrent calls to `fn_add`** queued behind this lock at a single snapshot. `device.list` already has a unique constraint on `external_id` (`device_list_external_id_unique`) that could back a normal `INSERT ... ON CONFLICT ... DO UPDATE` — which would take a row-level lock via the index, not a table-level one.

*(One caveat worth the team's own verification: the current backend source has no call site for the non-batch `store()`/`fn_add` path that we could find via static search — only the batch variant (`fn_add_batch`, called once from `app.ts`) has an active caller. We observed `fn_add` executing live regardless, so either the pulled runtime image predates a refactor visible in the checked-out source, or there's a call path we didn't locate. Worth confirming before scoping the fix.)*

### 3. No query-level observability (`pg_stat_statements` not preloaded)

Already noted in Baseline — flagging here as a finding because it materially limited this audit's precision: every measurement above came from live snapshots and manual `EXPLAIN`, not from aggregated statistics. The team should not have to reproduce this exercise from scratch to find the next bottleneck.

### Other observation (not core to DB scaling, but found along the way)

FM's device-ingress gate has three enforcement modes (`record_only` / `enforce_new` / `enforce_all`); the public deploy default is `record_only`. Under that default, we found that **new, previously-unknown devices connecting never appear in the Waiting Room at all** — the `record_only` code path (`ShellyWebsocketHandler.ts`) explicitly skips the waiting-room-entry step ("Legacy pre-gate admit — no handshake/waiting-room"), and the only code path that writes a Waiting Room entry (`recordPending`) is gated behind the `enforce_new`/`enforce_all` modes. Switching to `enforce_new` immediately fixed it (confirmed via direct Redis inspection: `fm:waitingroom:default` went from empty to populated). This is outside Task 2's scope but seems worth a bug report — it doesn't match what a first-time operator would expect from the default configuration, and we only worked around it because we could read the source.

## Before/After: `FM_STATUS_REDIS_FIRST`

FM already ships a Redis Stream write-behind path for `device.status` writes, disabled by default (`FM_STATUS_REDIS_FIRST=false`). We reproduced a comparable ~2,900-device admission burst with it flipped on.

| | **Off** | **On** |
|---|---|---|
| Devices admitted before first connection error | ~1,596 (errors ongoing, still climbing) | ~1,884 |
| Total `too many clients already` errors | 64+ in ~2 min, still climbing | 18 total, then **stopped** |
| Peak `fleet-db` CPU | ~308% (3+ cores) | ~182%, settling to 26% |
| Peak `fleet-manager` CPU | ~170% | ~107%, settling to 23% |
| Postgres connections at full scale (2,900) | Hit 100 (rejecting) | Settled at 50 |
| `fleet-manager` RSS at full scale | ~835MB–958MB | 1.27GB |
| End state at full scale | Sustained failures | Fully stabilized |

One config flip meaningfully delayed the failure onset and — critically — let the system reach a **stable** state at full test scale instead of continuing to degrade. The cost is higher application memory (Redis buffering trades DB connection pressure for in-process queue memory), which matters because memory is exactly what's constrained on the reference machine class.

## Prioritized recommendations

1. **Enable `pg_stat_statements`** (add to `shared_preload_libraries`, requires a Postgres restart).
   *Why*: Zero-risk, near-zero overhead, and it's the foundation for verifying every other change below with real data instead of manual sampling. *Impact*: no direct performance change; large diagnostic-capability improvement. *Risk*: very low — standard extension, bounded overhead. *Rollout*: first, during any planned maintenance window (it's a startup-time config, can't be hot-applied).

2. **Enable `FM_STATUS_REDIS_FIRST`** (roll out via `FM_STATUS_REDIS_SHADOW` first).
   *Why*: Directly measured to delay/prevent the connection-exhaustion failure mode and let the system stabilize at scale. *Impact*: meaningful, measured (see table above). *Risk*: low-medium — the code path already exists and is presumably tested, but we did not test Redis-outage/recovery behavior of the drainer, and application memory rises materially. *Rollout*: enable shadow mode first (writes both paths, compares, changes nothing user-visible) for a validation period, then flip `REDIS_FIRST=true`.

3. **Raise `max_connections`, sized to the reference machine's actual RAM** (immediate stopgap), **then evaluate a connection pooler (PgBouncer, transaction mode) for the medium term**.
   *Why*: This is the proximate cause of the observed data loss. Each Postgres connection has real backend-process memory cost (~5-10MB), so a bump needs to be sized against the reference machine's real headroom (16-24GB gives plenty of room to go well past 100 — this constrained test rig, with only 4GB total, does not, which is part of why we hit the ceiling at a modest device count). A pooler decouples app-level connection count from real Postgres backend count, which scales further and more cheaply than raw `max_connections` increases, but transaction-mode pooling has real compatibility caveats (session-level features, prepared statements) that need verifying against FM's actual query patterns before committing. *Impact*: removes the primary observed failure mode; a pooler should push the connection-related ceiling out by a large multiple. *Risk*: low for the `max_connections` bump (config + restart); medium for PgBouncer (architecture change, needs a staging pilot). *Rollout*: bump `max_connections` now as a stopgap; pilot PgBouncer in staging before committing to production.

4. **Replace `device.fn_add`'s table lock with `INSERT ... ON CONFLICT ... DO UPDATE`.**
   *Why*: Directly observed lock contention (58 concurrent blocked calls) during admission bursts; the existing unique constraint on `external_id` already supports a proper upsert with row-level, not table-level, locking. *Impact*: removes a full-fleet serialization point specifically during onboarding and mass-reconnect events. *Risk*: medium — needs care to preserve the exact "only overwrite `jdoc` when a new value is provided" semantics, and needs the actual call-site question (see Finding 2's caveat) resolved first so the fix covers every real caller. *Rollout*: after confirming call sites; this is a burst-resilience fix, not a steady-state throughput fix, so it's lower urgency than items 1-3 but directly relevant to "5,000 devices reconnecting after an outage."

## Extrapolating to 5,000+ EM devices

The mechanism we found — `max_connections=100` exhaustion under connection bursts — is a **fixed connection-count ceiling**, not a function of available RAM or CPU. The reference machine, despite having 4-6x more RAM than our test rig, is deployed with the same public-default `max_connections=100` unless already tuned. Given the reference machine's own stated ceiling (~2,000-3,000 EM devices) lines up with where we hit this exact failure mode on far less RAM, our strong hypothesis is that **the reference machine's current ceiling is this same mechanism**, not a raw compute limit — which is good news, because it means the fix is a config/architecture change, not new hardware.

Two things support pushing meaningfully past 5,000 with the recommendations above:
- The reference machine's much larger RAM budget (16-24GB vs. our 4GB) gives real headroom to raise `max_connections` safely, which our rig did not have.
- FM's own code already anticipates much higher EM-sync scale: `ShellyEmHandler.ts` documents its own throughput math (~3-4 DB queries + 1 device RPC per sync, ~200-400 syncs/sec at `MAX_CONCURRENT_EM_SYNCS=40`) with an explicit table stating 5,000 devices is "easy" and 20,000 is "handled" for that specific subsystem. In other words: **steady-state EM-sync throughput is not the binding constraint at 5,000 devices** — connection-pool exhaustion during bursts and `fn_add` lock contention during onboarding are. That reframes the problem usefully: the fixes needed are about *burst resilience* (onboarding a new batch, recovering from an outage, a network blip causing correlated reconnects) rather than raw sustained ingestion capacity, which already has real headroom per the codebase's own analysis.

With `pg_stat_statements` enabled, `FM_STATUS_REDIS_FIRST` on, `max_connections` sized to the reference machine's real RAM, and `fn_add`'s lock resolved, we'd expect the connection-related failure mode demonstrated here to no longer be the limiting factor at 5,000 devices — at which point EM-sync's own documented headroom (handled well past 20,000) becomes the more relevant ceiling to watch.

## What to look at next

- Confirm `device.fn_add`'s actual current caller(s) in the deployed image before scoping the upsert rewrite (see Finding 2's caveat).
- Run this same methodology on hardware actually matching the reference spec (4 vCPU / 16-24GB) to get absolute numbers, not just mechanism-level findings.
- Specifically isolate the mass-reconnect/outage-recovery scenario (restart FM with an already-onboarded 5,000-device fleet all reconnecting at once) — the worst-case burst pattern this audit found most damaging.
- Pilot PgBouncer against FM's real query patterns in staging (prepared statements, session-level assumptions) before committing to it as a production recommendation.
- Consider the same Redis-first treatment for `FM_DEVICE_SNAPSHOT_REDIS_FIRST` and the audit-log path, which follow the identical buffer/drain pattern and might yield similar wins.
- Report the `enforcementMode: record_only` waiting-room gap (see "Other observation") upstream — new devices silently never reaching the Waiting Room under the public deploy's own default seems unintended.
