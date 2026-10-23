#!/bin/bash
# Runs impeccable's engine only at the checksum pinned in .claude/skills.lock.json. Left alone, the launcher
# downloads it from an upstream release that can be replaced, checked only against that release's own sidecar.
# Usage: impeccable-engine.sh [ARGS...]   runs the launcher with ARGS on the pinned engine; at session start it
#        also exports IMPECCABLE_BIN to CLAUDE_ENV_FILE, so the agent's own launcher calls use the same engine.
# A missing pin, platform or download skips the engine (exit 0), so a hook never blocks the session; the agent's
# calls then get a binary that always fails, never one of the launcher's unchecked fallbacks.
set -uo pipefail
root=${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}
launcher="$root/.claude/skills/impeccable/scripts/impeccable"
version=$(cat "$root/.claude/skills/impeccable/scripts/VERSION")
nobin=$([ -x /usr/bin/false ] && echo /usr/bin/false || echo /bin/false)
use() { [ -n "${CLAUDE_ENV_FILE:-}" ] && printf 'export IMPECCABLE_BIN=%q\n' "$1" >> "$CLAUDE_ENV_FILE"; return 0; }
skip() { echo "impeccable-engine: $1" >&2; use "$nobin"; exit 0; }
# The launcher must never fetch an engine itself.
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export IMPECCABLE_DOWNLOAD_BASE=https://engine-download.invalid" >> "$CLAUDE_ENV_FILE"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) p=darwin-arm64 ;;
  Darwin-x86_64) p=darwin-x64 ;;
  Linux-x86_64) p=linux-x64 ;;
  Linux-aarch64 | Linux-arm64) p=linux-arm64 ;;
  *) skip "no pinned engine for $(uname -sm)" ;;
esac
want=$(jq -er --arg v "$version" --arg p "$p" '.impeccable.engine | select(.version == $v) | .sha256[$p]' "$root/.claude/skills.lock.json") \
  || skip "the skills lock pins no engine $version for $p"
sum() { if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi 2> /dev/null | cut -d' ' -f1; }
bin="${XDG_CACHE_HOME:-$HOME/.cache}/impeccable-pinned/$version/impeccable"
if [ "$(sum "$bin")" != "$want" ]; then
  mkdir -p "$(dirname "$bin")" && tmp="$bin.part.$$"
  url=${IMPECCABLE_ENGINE_URL:-https://github.com/pbakaus/impeccable/releases/download/engine-v$version/impeccable-$p}
  curl -fsSL --retry 2 -o "$tmp" "$url" || { rm -f "$tmp"; skip "could not download $url"; }
  [ "$(sum "$tmp")" = "$want" ] || { rm -f "$tmp"; skip "$url does not match its pin; refused"; }
  chmod +x "$tmp" && mv "$tmp" "$bin"
fi
use "$bin"
[ $# -eq 0 ] && exit 0
IMPECCABLE_BIN=$bin exec "$launcher" "$@"
