#!/usr/bin/env bash
# Builds the web app, copies it to .output/native with the prerendered /app shell as the root
# index.html (Capacitor's local server answers /app with it), then syncs ios/ and android/.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
rm -rf .output/native
cp -r .output/public .output/native
# Precompressed copies are for the web server; Android rejects x.js and x.js.gz as duplicate resources.
find .output/native \( -name "*.gz" -o -name "*.br" \) -delete
cp .output/public/app/index.html .output/native/index.html
pnpm exec cap sync
