#!/usr/bin/env bash
# Builds the release image, starts it against DATABASE_URL (it migrates first, as in production)
# and checks it serves its own version on /version.
# Usage: DATABASE_URL=... image-check.sh VERSION
set -euo pipefail
version=$1
: "${DATABASE_URL:?image-check needs DATABASE_URL, because the image migrates before it serves}"
docker build -t "assistant:$version" --build-arg APP_VERSION="$version" .
# Host networking, so the container reaches the same database as the host.
docker run -d --name assistant-check --network host -e PORT=3999 -e DATABASE_URL "assistant:$version" > /dev/null
trap 'docker rm -f assistant-check > /dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do
  [ "$(curl -sf localhost:3999/version | jq -r .version 2>/dev/null)" = "$version" ] && { docker logs assistant-check 2>&1 | grep applied || true; echo "image serves $version"; exit 0; }
  sleep 1
done
docker logs assistant-check
echo "::error::The image never served version $version on /version."
exit 1
