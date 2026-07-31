# Office BMS — a Fleet Manager template

A Building Management System UI that mounts on top of [Fleet Manager](https://github.com/ALLTERCO/fleet-management) as a "template" (business-manager package), replacing FM's standard frontend with a facility-manager-focused experience for one office building: live/historical energy, climate, door/window monitoring, a navigable 3D building view, uploadable per-floor schematics with drag-and-drop device placement, and a device detail popup with real on/off control.

The backend-scaling audit for Task 2 lives at [`docs/backend-audit-report.md`](docs/backend-audit-report.md).

## Setup

1. Clone [`fleet-management`](https://github.com/ALLTERCO/fleet-management) as a sibling directory to this repo, unmodified.
2. Bring up Fleet Manager locally: `cd fleet-management && ./deploy/deploy-public.sh up` (self-signed HTTPS is the default; see `fleet-management/docs/deployment.md`). Trust the generated CA cert (`deploy/state/tls/ca.crt`) so both your browser and your devices accept it.
3. Log into FM (`fm-admin`, **not** `fm-admin@<host>` — see the note on Zitadel login names below) and create the physical hierarchy under **Organize → Locations**: one `building`, and 2-3 `floor` children under it.
4. Pair the plug via the Shelly app (WiFi), then the H&T and door/window sensors as BLU devices attached to the plug (its Bluetooth gateway). In the plug's local settings, set **Outbound Websocket** to `wss://<your-fm-host>/shelly` (or `ws://` on port 80, using FM's `FM_PLAIN_WS` accommodation, to skip CA cert upload) — approve it in FM's **Waiting Room** once it shows up. The BLU sensors auto-promote into FM once the plug is admitted.
5. Set `FM_DEVICE_INGRESS_ENFORCEMENT_MODE=enforce_new` in `deploy/state/fm-runtime.env` before onboarding — see "Design decisions" below for why this matters.

**A Zitadel login gotcha**: the credentials `deploy-public.sh` prints (`fm-admin@<host>`) are wrong for actually logging in — the real Zitadel login name for the FM admin account has no domain suffix at all (verified directly against `projections.login_names3` in the Zitadel Postgres DB). Log in with just `fm-admin`.

## Build & deploy

The private repo's `deploy/deploy.sh --mode bm --manifest <request.json> --template-source <repo>` and `deploy/scripts/private/manifest.sh` aren't present in this OSS checkout — only the public, FM-only `deploy-public.sh` and `Dockerfile.public` are. [`deploy/deploy-bm.sh`](deploy/deploy-bm.sh) reproduces `--mode bm`'s effect directly against `Dockerfile.public`'s `frontend-bm`/`runtime-bm` stages via `docker buildx`, reading a deploy-request JSON (our own inferred shape, documented in [`deploy/deploy-request.office-bms.json`](deploy/deploy-request.office-bms.json), since the real example file doesn't exist here either).

```bash
./deploy/deploy-bm.sh deploy/deploy-request.office-bms.json ../fleet-management shellygroup/fleet-management:latest
```

This builds and validates through all of FM's real gates in one shot: `validate:customization`, `validate:template-package`, `check:template-boundaries`, and `FM_BUILD_MODE=client npm run build:client`. Tagging the output as `shellygroup/fleet-management:latest` lets Docker Compose pick it up as a drop-in replacement for the pulled image without touching any compose/env config — Compose only pulls a tag it doesn't already have locally.

```bash
# from fleet-management/, recreate just the fleet-manager service with the new local image
docker compose -p fleet-public \
  -f deploy/compose/docker-compose.yml -f deploy/compose/docker-compose.fleet-image.yml \
  -f deploy/compose/docker-compose.selfhosted.yml -f deploy/compose/docker-compose.zitadel.yml \
  -f deploy/compose/docker-compose.traefik-selfsigned.yml \
  --env-file deploy/env/public.env --env-file deploy/VERSIONS.env \
  --env-file deploy/state/.env --env-file deploy/state/fm-runtime.env \
  up -d --no-deps --force-recreate fleet-manager
```

Every commit in this repo's history was validated by actually running this build, not just typechecking — see the commit messages for what each gate caught.

## Project structure

```
contracts/           # host.ts, manifest.ts, overrides.ts, mutations.ts, index.ts (required by validate-template-package.mjs)
shared/               # presentational-only components — no @host import, reusable by a second template
templates/office-bms/  # this template: index.vue, manifest.ts, components/, composables/, lib/
```

`shared/` vs `templates/office-bms/`: anything that doesn't touch `@host` (KpiTile, EChart, Modal, the Box3D cuboid primitive) lives in `shared/`, genuinely reusable if a second building type template gets built later. Everything that reads/writes live FM data lives in the template itself.

## Design decisions worth explaining

- **Floors are backed by Locations, not Groups**, despite the requirements text saying "floor = a group of devices." FM already ships a purpose-built floor-plan feature on `organization.locations` (kind=`floor`) that the requirements' own "Жокери" hint points at. Each floor Location also gets a linked **shadow Group** (`metadata.floorLocationId`) purely so "floor = a group of devices" is literally true too — low cost, not load-bearing.
- **Floor-plan images are stored as compressed base64 in the shadow Group's `metadata`, not via FM's native upload endpoint.** `Location.kindFields.floorPlan.url` is schema-capped at 2048 chars — nowhere near enough for an image. FM's native multipart upload endpoint requires session auth no `@host` API exposes to templates, and using it would mean a raw `fetch` to an FM endpoint, which is explicitly forbidden. `Group.metadata` has a 64KB whole-object budget with no per-field cap, so images are resized/JPEG-compressed client-side (`lib/compressImage.ts`, pure Canvas API) to fit before being sent through the ordinary `group.update` RPC.
- **3D building view uses CSS 3D transforms, not three.js**, despite the requirements recommending it. Verified empirically: `three` is not in `check-template-boundaries.mjs`'s `ALLOWED_IMPORTS` (confirmed by adding a throwaway `import * as THREE from 'three'` and running the boundary check — it fails), and `three` isn't in FM frontend's `node_modules` regardless. `shared/components/Box3D.vue` builds a real six-face cuboid via the standard `preserve-3d` + `rotateX/Y` + `translateZ` technique; the building scene supports drag-to-rotate, scroll-to-zoom, and a day/night toggle.
- **Charts use raw `echarts`, not `chart.js`/`vue-echarts`.** Both are in the boundary check's allowlist, but neither is actually installed in FM frontend's `node_modules` — only `echarts` is.
- **`FM_DEVICE_INGRESS_ENFORCEMENT_MODE=enforce_new`** is required for reliable device onboarding. Under the public deploy's default (`record_only`), we found that new/unknown devices never reach the Waiting Room at all — the code path that writes a waiting-room entry is only reachable in `enforce_new`/`enforce_all` mode. Confirmed directly against Redis (`fm:waitingroom:<org>` stayed empty under `record_only` regardless of connected device count).
- **Device roles (plug/climate sensor/door-window sensor) are derived from live device capabilities**, not hardcoded shellyIDs — so nothing breaks if a physical device gets swapped or re-onboarded.
- **`useCustomization()` footgun**: it returns a `Ref`, and reading a field off it without `.value` outside a template interpolation silently returns `undefined` (Vue auto-unwraps top-level refs in templates, not in script code). Caught this once while wiring the 3D scene's theme color — worth knowing if extending this template.
- **No device-onboarding/Waiting-Room UI in the template — by design, not an omission.** BM/client build mode's router (`frontend/src/router/routes.client.ts`) has no route to any of FM's native admin pages; every path renders `TemplateHost`, so there's nowhere for a Waiting-Room screen to live once built this way. Onboarding happens once, via FM's standard (non-BM) frontend, before switching over to this build — which matches how the requirements frame it ("you are expected to... onboard the devices... Onboarding the devices... is part of the task"): the developer's job during setup, not a feature the shipped template needs to expose.

## Known limitations

- The H&T and door/window sensors' firmware (Shelly Plug S Gen3, as their Bluetooth gateway) predates BTHome gateway support (needs firmware 1.3+, currently 1.2.2). **Shelly confirmed (2026-07-30) that mock data for these two sensors is acceptable** given the issue is outside our control — the plug's energy data is real throughout, and the two mock sensors are clearly labeled with a "Mock data" badge everywhere they appear (`shared/components/MockBadge.vue`), never blended in silently with real data. `templates/office-bms/lib/mockClimateDoorWindow.ts` generates the fallback values/history; `useDeviceRoles` swaps in real data automatically the moment the sensors are actually onboarded, no other code changes needed.
- Optional extras (audit feed, alert rule surfaced in-template, theming beyond the customization schema) were not built given the 1-week budget — dashboard/energy/climate/door-window monitoring, 3D building, floor schemes, and device control were prioritized as the graded minimum.

## What I'd do next with more time

- Retire the mock climate/door-window data once the BLU sensors are onboarded — no code changes needed beyond confirming the two sensors' exact `device.status` field names for their history panels.
- Build the optional audit/event feed and an in-template alert rule surfaced from FM.
- Add a proper e2e smoke test that drives the built BM image end-to-end (upload a floor plan, place a device, reload, confirm persistence) rather than relying on manual verification.
- Push `pg_stat_statements` and the other backend-audit recommendations into an actual before/after benchmark against a machine matching the real reference spec.
