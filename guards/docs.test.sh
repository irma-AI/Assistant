#!/usr/bin/env bash
# Runs docs.sh on tiny fake repositories: one that must pass, and one per way to fail.
set -euo pipefail
guard=$(cd "$(dirname "$0")" && pwd)/docs.sh
fail=0

# repo CLAUDE_MD: a fake repository with one guard, one script and a make target.
repo() {
  d=$(mktemp -d "${TMPDIR:-/tmp}/docs.XXXXXX") || return 1; mkdir -p "$d/guards" "$d/scripts"
  touch "$d/guards/g.jq" "$d/scripts/s.sh"; printf 'check:\n\ttrue\n' > "$d/Makefile"
  printf '%s\n' "$1" > "$d/CLAUDE.md"; echo "$d"
}
expect() {
  d=$(repo "$2") || exit 1
  if "$guard" "$d" > /dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: got $got, want $3"; fail=1; fi
}

good=$'# X\n\nRun `make check` and see `scripts/s.sh`.\n\n## Rules\n\n- One. [enforced: guard:g]\n- Two. [enforced: path:scripts/s.sh]\n- Three. [enforced: make:check]\n\n## Later\n\n- Free text here.'
expect "every rule checked" "$good" pass
expect "rule without a check" $'## Rules\n\n- Be careful.' fail
expect "missing guard" $'## Rules\n\n- One. [enforced: guard:nope]' fail
expect "missing path" $'## Rules\n\n- One. [enforced: path:scripts/nope.sh]' fail
expect "missing make target" $'## Rules\n\n- One. [enforced: make:nope]' fail
expect "unknown kind" $'## Rules\n\n- One. [enforced: hope:g]' fail
expect "backticked make target missing" $'Run `make nope`.\n\n## Rules\n\n- One. [enforced: guard:g]' fail
expect "backticked path missing" $'See `scripts/gone.sh`.\n\n## Rules\n\n- One. [enforced: guard:g]' fail
expect "over budget" "$good"$'\n'"$(printf 'x%.0s' $(seq 1 4001))" fail
expect "nothing to scan" '# Empty' fail

d=$(repo "$good") || exit 1
mkdir -p "$d/.claude/skills/next-step"; printf 'x%.0s' $(seq 1 6001) > "$d/.claude/skills/next-step/SKILL.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  next-step over budget: passed"; fail=1; else echo "ok    next-step over budget"; fi
printf 'See `gone/x.md`.\n' > "$d/.claude/skills/next-step/SKILL.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  next-step names a missing path: passed"; fail=1; else echo "ok    next-step names a missing path"; fi

d=$(repo "$good") || exit 1
mkdir -p "$d/.claude/rules"; printf 'x%.0s' $(seq 1 3001) > "$d/.claude/rules/routes.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  rule file over budget: passed"; fail=1; else echo "ok    rule file over budget"; fi
printf 'Edit `src/gone.ts`.\n' > "$d/.claude/rules/routes.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  rule file names a missing path: passed"; fail=1; else echo "ok    rule file names a missing path"; fi

d=$(repo "$good") || exit 1
mkdir -p "$d/docs/agents"; printf 'x%.0s' $(seq 1 4001) > "$d/docs/agents/routines.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  agent doc over budget: passed"; fail=1; else echo "ok    agent doc over budget"; fi
printf 'Follow `.claude/skills/gone/SKILL.md`.\n' > "$d/docs/agents/routines.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "FAIL  agent doc names a missing path: passed"; fail=1; else echo "ok    agent doc names a missing path"; fi
printf 'Follow `scripts/s.sh`.\n' > "$d/docs/agents/routines.md"
if "$guard" "$d" > /dev/null 2>&1; then echo "ok    agent doc naming a real path passes"; else echo "FAIL  agent doc naming a real path passes: failed"; fail=1; fi

exit $fail
