#!/usr/bin/env bash
# deploy-bm.sh — build and load a Fleet Manager "BM" (business-manager
# template) runtime image, standing in for the private repo's
# `deploy/deploy.sh up --mode bm --manifest <request.json> --template-source <repo>`,
# which isn't present in this OSS checkout (only deploy-public.sh, FM-only,
# is). This script reproduces its effect directly against
# Dockerfile.public's frontend-bm/runtime-bm stages via docker buildx,
# using the same TEMPLATE / OVERRIDES_JSON_B64 build args the private
# Dockerfile's frontend-bm stage consumes.
#
# Usage:
#   ./deploy-bm.sh <deploy-request.json> <path-to-fleet-management-repo> [image-tag]
#
# Example:
#   ./deploy-bm.sh deploy-request.office-bms.json ../fleet-management shellygroup/fleet-management:latest
#
# Tagging the output as shellygroup/fleet-management:latest makes Docker
# Compose (deploy-public.sh's stack) use this local image in place of the
# pulled one without any compose/env changes, since Compose only pulls a
# tag it doesn't already have locally.

set -euo pipefail

REQUEST_FILE="${1:?deploy-request.json path required}"
FM_REPO="${2:?path to fleet-management repo required}"
IMAGE_TAG="${3:-shellygroup/fleet-management:latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

command -v jq >/dev/null || {
    echo "jq is required" >&2
    exit 1
}
command -v docker >/dev/null || {
    echo "docker is required" >&2
    exit 1
}
[ -f "$REQUEST_FILE" ] || {
    echo "deploy-request file not found: $REQUEST_FILE" >&2
    exit 1
}
[ -f "$FM_REPO/deploy/docker/Dockerfile.public" ] || {
    echo "Dockerfile.public not found under $FM_REPO/deploy/docker/" >&2
    exit 1
}

TEMPLATE=$(jq -r '.template' "$REQUEST_FILE")
[ "$TEMPLATE" != "null" ] || {
    echo "deploy-request.json missing .template" >&2
    exit 1
}

OVERRIDES_JSON_B64=$(jq -c '.overrides' "$REQUEST_FILE" | base64 | tr -d '\n')

echo "Building $IMAGE_TAG — template=$TEMPLATE, source=$TEMPLATE_SOURCE_DIR"

docker buildx build \
    -f "$FM_REPO/deploy/docker/Dockerfile.public" \
    --target runtime-bm \
    --build-context "template-source=$TEMPLATE_SOURCE_DIR" \
    --build-arg "TEMPLATE=$TEMPLATE" \
    --build-arg "OVERRIDES_JSON_B64=$OVERRIDES_JSON_B64" \
    -t "$IMAGE_TAG" \
    --load \
    "$FM_REPO"

echo "Built $IMAGE_TAG. Restart the fleet-manager service to pick it up:"
echo "  cd $FM_REPO && ./deploy/deploy-public.sh status   # find the compose project"
echo "  docker compose -p <project> restart fleet-manager"
