#!/usr/bin/env bash
# Skills copied from other repositories, pinned in .claude/skills.lock.json.
# Usage: skills.sh check    every vendored skill matches its hash, and every skill folder is in the lock
#        skills.sh vendor   download each pinned skill again and rewrite the hashes (needs network)
set -euo pipefail
cd "$(dirname "$0")/../.."
lock=.claude/skills.lock.json

digest() { (cd "$1" && find . -type f | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' "$(shasum -a 256 < "$f" | cut -d' ' -f1)" "$f"; done) | shasum -a 256 | cut -d' ' -f1; }

case ${1:-} in
  check)
    fail=0 scanned=0
    for dir in .claude/skills/*/; do
      name=$(basename "$dir") scanned=$((scanned + 1))
      entry=$(jq -c --arg n "$name" '.[$n] // empty' "$lock")
      if [ -z "$entry" ]; then echo "::error::skills: $name is not in $lock. Fix: add it, as {\"source\": \"local\"} for a skill written here or with make skills for a copied one."; fail=1; continue; fi
      [ "$(jq -r .source <<<"$entry")" = local ] && continue
      [ "$(digest "$dir")" = "$(jq -r .sha256 <<<"$entry")" ] \
        || { echo "::error::skills: $name differs from its pinned copy. Fix: change it upstream and bump the commit, then make skills."; fail=1; }
    done
    for name in $(jq -r 'keys[]' "$lock"); do
      [ -d ".claude/skills/$name" ] || { echo "::error::skills: $name is in $lock but has no folder. Fix: make skills, or drop it from the lock."; fail=1; }
    done
    echo "skills: scanned $scanned"
    [ "$scanned" -gt 0 ] && exit $fail || exit 1
    ;;
  vendor)
    tmp=$(mktemp -d "${TMPDIR:-/tmp}/skills.XXXXXX")
    for name in $(jq -r 'to_entries[] | select(.value.source != "local") | .key' "$lock"); do
      read -r source commit path < <(jq -r --arg n "$name" '.[$n] | "\(.source) \(.commit) \(.path)"' "$lock")
      src="$tmp/$(tr / _ <<<"$source")-$commit"
      [ -d "$src" ] || { mkdir -p "$src"; curl -sSfL "https://codeload.github.com/$source/tar.gz/$commit" | tar xz -C "$src" --strip-components 1; }
      rm -rf ".claude/skills/$name"; cp -R "$src/$path" ".claude/skills/$name"
      cp "$src/LICENSE" ".claude/vendor-licenses/$(tr / _ <<<"$source").LICENSE"
      jq --arg n "$name" --arg h "$(digest ".claude/skills/$name")" '.[$n].sha256 = $h' "$lock" > "$tmp/lock" && mv "$tmp/lock" "$lock"
      echo "vendored $name from $source@${commit:0:7}"
    done
    ;;
  *) echo "usage: skills.sh check|vendor" >&2; exit 2 ;;
esac
