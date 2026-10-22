#!/usr/bin/env bash
# Builds the release image and checks it serves its own version on /version.
# Usage: image-check.sh VERSION
set -euo pipefail
version=$1
docker build -t "assistant:$version" --build-arg APP_VERSION="$version" .
docker run -d --rm --name assistant-check -p 3999:3000 "assistant:$version" > /dev/null
trap 'docker stop assistant-check > /dev/null' EXIT
for _ in $(seq 1 30); do
  [ "$(curl -sf localhost:3999/version | jq -r .version 2>/dev/null)" = "$version" ] && { echo "image serves $version"; exit 0; }
  sleep 1
done
docker logs assistant-check
echo "::error::The image never served version $version on /version."
exit 1
