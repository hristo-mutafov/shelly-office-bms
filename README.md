# Office BMS — a Fleet Manager template

A Building Management System UI that mounts on top of [Fleet Manager](https://github.com/ALLTERCO/fleet-management), replacing its standard frontend for one office building: energy/climate/door-window monitoring, a 3D building view with per-floor status at a glance, per-floor schematics with drag-and-drop device placement, and a device popup with real on/off control.

The backend-scaling audit is at [`docs/backend-audit-report.md`](docs/backend-audit-report.md).

## Setup

```bash
git clone https://github.com/ALLTERCO/fleet-management
cd fleet-management && ./deploy/deploy-public.sh up
```

Self-signed HTTPS by default — trust the generated CA cert (`deploy/state/tls/ca.crt`) in your browser and on your devices.

Log in as `fm-admin`, not `fm-admin@<host>` as printed — the real login name has no domain suffix. Under Organize → Locations, create one building and 2-3 floors.

Pair the plug via the Shelly app, then the H&T and door/window sensors as BLU devices on the plug. Point the plug's outbound websocket at `wss://<your-fm-host>/shelly` and approve it in FM's Waiting Room — the BLU sensors show up on their own once the plug is admitted.

```
FM_DEVICE_INGRESS_ENFORCEMENT_MODE=enforce_new
```

Add this to `deploy/state/fm-runtime.env` before onboarding — under the default mode, devices never reach the Waiting Room at all.

## Build & deploy

```bash
./deploy/deploy-bm.sh deploy/deploy-request.office-bms.json ../fleet-management shellygroup/fleet-management:latest
```

Builds the template through FM's real gates — package validation, boundary check, client build — then produces the runtime image. Tagged as `shellygroup/fleet-management:latest` so Compose picks it up as a drop-in replacement, no config changes needed.

```bash
docker compose -p fleet-public \
  -f deploy/compose/docker-compose.yml -f deploy/compose/docker-compose.fleet-image.yml \
  -f deploy/compose/docker-compose.selfhosted.yml -f deploy/compose/docker-compose.zitadel.yml \
  -f deploy/compose/docker-compose.traefik-selfsigned.yml \
  --env-file deploy/env/public.env --env-file deploy/VERSIONS.env \
  --env-file deploy/state/.env --env-file deploy/state/fm-runtime.env \
  up -d --no-deps --force-recreate fleet-manager
```

Recreates the fleet-manager service with the new image.

## Project structure

```
contracts/              # host.ts, manifest.ts, overrides.ts, mutations.ts, index.ts
shared/                  # presentational components, no @host import — reusable by another template
templates/office-bms/    # this template
```

## Design decisions worth explaining

- **Floors are built on Locations, not Groups**, even though the task brief describes a floor as "a group of devices." FM already has a real floor-plan feature on Locations, so that's the source of truth — each floor also gets a linked shadow group so the group framing holds too, just not load-bearing.
- **Floor-plan images are stored as compressed base64 inside that shadow group**, not through FM's native upload — that endpoint needs a raw `fetch`, which templates aren't allowed to do.
- **The 3D view is CSS, not three.js** — three.js isn't in the template's allowed imports, and isn't installed in FM's frontend either. Each floor is a real six-face cube with a gabled roof on top; drag to rotate, scroll to zoom, day/night toggle, and each floor shows its own device count and alert state.
- **Charts use echarts directly** — chart.js/vue-echarts are allowed too, but only echarts is actually installed.
- **Device roles (plug, climate sensor, door sensor) come from live capabilities**, not hardcoded IDs, so swapping a physical device doesn't break anything.
- **There's no onboarding UI in the template.** Once built in BM mode, there's no route back to any of FM's own admin pages, so onboarding has to happen once, beforehand, through FM's standard frontend. That matches how the brief frames it — onboarding is setup, not a feature the template needs to expose.
- **The event/audit feed reads from the event journal, not `device.status`.** `device.status` only stores numeric telemetry (power, voltage, temperature) — relay on/off and door open/closed are discrete state changes that live in a separate event journal instead, reached through a raw RPC with no curated host wrapper.
- **Theming goes through FM's real customization/overrides mechanism**, not something bolted on — `customization.sample.json` declares `clientName`, `title`, `logoUrl`, and theme colors per the manifest's allowed override keys, with a sensible fallback (a plain icon) if no logo is set.

## Known limitations

- The H&T and door/window sensors can't connect yet — the plug's Bluetooth gateway firmware predates BTHome support. Shelly confirmed mock data is fine here; the plug's energy data is real throughout, and both mocked sensors are labeled everywhere they appear. Nothing needs to change once the sensors connect — it switches to real data on its own.
- Didn't build an in-template alert rule (surfacing an FM alert condition, like a temperature threshold, inside the UI) — prioritized the graded minimum given the timeline.

## What I'd do next

- Retire the mock data once the BLU sensors connect.
- Build an in-template alert rule surfaced from FM.
- Add an end-to-end smoke test against the built image instead of manual verification.
- Turn the backend-audit recommendations into before/after benchmark.
