#!/usr/bin/env bash
# Skills, and the hook scripts and agents that come with them, copied from other repositories
# and pinned in .claude/skills.lock.json. A skill fills .claude/skills/<name>; an entry with "dest"
# and "files" copies the files matching that pattern from "path" into "dest" instead.
# Usage: skills.sh check    every vendored copy matches its hash, and every skill folder is in the lock
#        skills.sh vendor   download each pinned copy again and rewrite the hashes (needs network)
set -euo pipefail
cd "$(dirname "$0")/../.."
lock=.claude/skills.lock.json

digest() { (cd "$1" && find . -type f | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' "$(shasum -a 256 < "$f" | cut -d' ' -f1)" "$f"; done) | shasum -a 256 | cut -d' ' -f1; }
# The digest of the files matching PATTERN directly in DIR, so the repository's own files there don't count.
digest_files() { (cd "$1" && find . -maxdepth 1 -type f -name "$2" | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' "$(shasum -a 256 < "$f" | cut -d' ' -f1)" "$f"; done) | shasum -a 256 | cut -d' ' -f1; }

case ${1:-} in
  check)
    fail=0 scanned=0
    for dir in .claude/skills/*/; do
      name=$(basename "$dir") scanned=$((scanned + 1))
      entry=$(jq -c --arg n "$name" '.[$n] // empty' "$lock")
      if [ -z "$entry" ]; then echo "::error::skills: $name is not in $lock. Fix: add it, as {\"source\": \"local\"} for a skill written here or with make skills for a copied one."; fail=1; continue; fi
      # Written here, or copied from installed packages by scripts/tanstack-skills.ts (checked there).
      case $(jq -r .source <<<"$entry") in local | tanstack) continue ;; esac
      [ "$(digest "$dir")" = "$(jq -r .sha256 <<<"$entry")" ] \
        || { echo "::error::skills: $name differs from its pinned copy. Fix: change it upstream and bump the commit, then make skills."; fail=1; }
    done
    for name in $(jq -r 'to_entries[] | select(.value.dest == null) | .key' "$lock"); do
      [ -d ".claude/skills/$name" ] || { echo "::error::skills: $name is in $lock but has no folder. Fix: make skills, or drop it from the lock."; fail=1; }
    done
    for name in $(jq -r 'to_entries[] | select(.value.dest != null) | .key' "$lock"); do
      read -r dest files sha < <(jq -r --arg n "$name" '.[$n] | "\(.dest) \(.files) \(.sha256)"' "$lock")
      scanned=$((scanned + 1))
      [ -n "$(find "$dest" -maxdepth 1 -type f -name "$files" 2>/dev/null)" ] && [ "$(digest_files "$dest" "$files")" = "$sha" ] \
        || { echo "::error::skills: $dest/$files ($name) differs from its pinned copy. Fix: change it upstream and bump the commit, then make skills."; fail=1; }
    done
    echo "skills: scanned $scanned"
    [ "$scanned" -gt 0 ] && exit $fail || exit 1
    ;;
  vendor)
    tmp=$(mktemp -d "${TMPDIR:-/tmp}/skills.XXXXXX")
    for name in $(jq -r 'to_entries[] | select(.value.source != "local" and .value.source != "tanstack") | .key' "$lock"); do
      read -r source commit path dest files < <(jq -r --arg n "$name" '.[$n] | "\(.source) \(.commit) \(.path) \(.dest // "-") \(.files // "-")"' "$lock")
      src="$tmp/$(tr / _ <<<"$source")-$commit"
      [ -d "$src" ] || { mkdir -p "$src"; curl -sSfL "https://codeload.github.com/$source/tar.gz/$commit" | tar xz -C "$src" --strip-components 1; }
      if [ "$dest" = - ]; then
        rm -rf ".claude/skills/$name"; cp -R "$src/$path" ".claude/skills/$name"
        hash=$(digest ".claude/skills/$name")
      else
        mkdir -p "$dest"; find "$dest" -maxdepth 1 -type f -name "$files" -delete
        find "$src/$path" -maxdepth 1 -type f -name "$files" -exec cp {} "$dest/" \;
        hash=$(digest_files "$dest" "$files")
      fi
      cp "$src/LICENSE" ".claude/vendor-licenses/$(tr / _ <<<"$source").LICENSE"
      jq --arg n "$name" --arg h "$hash" '.[$n].sha256 = $h' "$lock" > "$tmp/lock" && mv "$tmp/lock" "$lock"
      echo "vendored $name from $source@${commit:0:7}"
    done
    ;;
  *) echo "usage: skills.sh check|vendor" >&2; exit 2 ;;
esac
