#!/bin/sh
# Run from the core repository. Builds new local tags; does not start a deployment.
set -eu
CORE=$(git rev-parse --show-toplevel)
OFFER=${SEC001_OFFER:?Set SEC001_OFFER to the archived source-offer directory}
RUN=${SEC001_RUN:?Set SEC001_RUN to a new local candidate identifier}
NEXT="zr-sec001-next:$RUN"
PB="zr-sec001-pb:$RUN"
TEST="zr-sec001-test:$RUN"
for image in "$NEXT" "$PB" "$TEST"; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "Refusing to overwrite existing image $image" >&2
    exit 1
  fi
done
SOURCE_HASH=$(cat "$OFFER/source-hash.txt")
docker build --platform linux/amd64 -f "$OFFER/Next.Dockerfile" \
  --build-arg APP_URL=https://a.tp002.test \
  --label org.opencontainers.image.licenses=AGPL-3.0-only \
  --label org.opencontainers.image.source=https://github.com/krisauseu/zettelruhe-os \
  --label "org.zettelruhe.source-sha256=$SOURCE_HASH" \
  -t "$NEXT" "$OFFER/source/app"
docker build --platform linux/amd64 --target builder -f "$OFFER/Next.Dockerfile" \
  --build-arg APP_URL=https://a.tp002.test -t "$TEST" "$OFFER/source/app"
docker build --platform linux/amd64 -f "$OFFER/PocketBase.Dockerfile" \
  -t "$PB" "$OFFER/source/pocketbase"
docker run --rm --platform linux/amd64 --network none -e JOBS_DISABLED=true \
  -v "$OFFER/source/scripts:/scripts:ro" \
  -v "$OFFER/source/pocketbase:/pocketbase:ro" \
  -v "$CORE/scripts/security/sec001-network.test.ts:/app/src/lib/sec001-network.test.ts:ro" \
  --entrypoint sh "$TEST" -c 'npm test && npm run typecheck && npm run lint -- --max-warnings=0'
TP022_PB_IMAGE="$PB" node "$CORE/scripts/test-festschreibung-isolated.mjs"
SEC001_NEXT_IMAGE="$NEXT" node "$CORE/scripts/security/sec001-image.mjs"
# SEC001_CADDY_REFERENCE points to the unchanged, read-only pilot Caddyfile.
# The external starter below only reads the Cloud repository and creates UUID resources.
TP002_NEXT_IMAGE="$NEXT" TP002_PB_IMAGE="$PB" TP002_TEST_IMAGE="$TEST" \
  node "${SEC001_CLOUD_REFERENCE:?Set the read-only Cloud repository}/scripts/test-tp002-isolated.mjs"
RELEASE_BASE_REF=595fff545d4f377806d273b2b8bfa8d5ac32a7dc \
  RELEASE_NEXT_IMAGE="$NEXT" RELEASE_PB_IMAGE="$PB" \
  RELEASE_ROLLBACK_NEXT_IMAGE="${SEC001_ROLLBACK_IMAGE:?Set the verified old local Next image}" \
  node "$CORE/scripts/test-release-smoke-isolated.mjs"
