#!/bin/bash
# Runs impeccable's engine only at the checksum pinned in .claude/skills.lock.json. Left alone, the launcher
# downloads it from an upstream release that can be replaced, checked only against that release's own sidecar.
# Usage: impeccable-engine.sh [ARGS...]   runs the launcher with ARGS on the pinned engine; at session start it
#        also exports IMPECCABLE_BIN to CLAUDE_ENV_FILE, so the agent's own launcher calls use the same engine.
# A missing pin, platform or download skips the engine (exit 0), so a hook never blocks the session.
set -uo pipefail
root=${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}
launcher="$root/.claude/skills/impeccable/scripts/impeccable"
version=$(cat "$root/.claude/skills/impeccable/scripts/VERSION")
# The launcher must never fetch an engine itself.
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export IMPECCABLE_DOWNLOAD_BASE=https://engine-download.invalid" >> "$CLAUDE_ENV_FILE"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) p=darwin-arm64 ;;
  Darwin-x86_64) p=darwin-x64 ;;
  Linux-x86_64) p=linux-x64 ;;
  Linux-aarch64 | Linux-arm64) p=linux-arm64 ;;
  *) echo "impeccable-engine: no pinned engine for $(uname -sm)" >&2; exit 0 ;;
esac
want=$(jq -er --arg v "$version" --arg p "$p" '.impeccable.engine | select(.version == $v) | .sha256[$p]' "$root/.claude/skills.lock.json") \
  || { echo "impeccable-engine: the skills lock pins no engine $version for $p" >&2; exit 0; }
sum() { if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi 2> /dev/null | cut -d' ' -f1; }
bin="${XDG_CACHE_HOME:-$HOME/.cache}/impeccable-pinned/$version/impeccable"
if [ "$(sum "$bin")" != "$want" ]; then
  mkdir -p "$(dirname "$bin")" && tmp="$bin.part.$$"
  url=${IMPECCABLE_ENGINE_URL:-https://github.com/pbakaus/impeccable/releases/download/engine-v$version/impeccable-$p}
  if ! curl -fsSL --retry 2 -o "$tmp" "$url"; then rm -f "$tmp"; echo "impeccable-engine: could not download $url" >&2; exit 0; fi
  if [ "$(sum "$tmp")" != "$want" ]; then rm -f "$tmp"; echo "impeccable-engine: $url does not match its pin; refused" >&2; exit 0; fi
  chmod +x "$tmp" && mv "$tmp" "$bin"
fi
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export IMPECCABLE_BIN=$bin" >> "$CLAUDE_ENV_FILE"
[ $# -eq 0 ] && exit 0
IMPECCABLE_BIN=$bin exec "$launcher" "$@"
