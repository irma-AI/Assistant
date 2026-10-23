# IRM-45: Vendor the impeccable design skill

The impeccable design skill (plan §3, the ui flow): vendored from pbakaus/impeccable at a pinned commit, with its licence and notice, held by the skills lock's hash like the other copied skills.

Acceptance criteria:
- .claude/skills/impeccable matches pbakaus/impeccable's Claude copy at the pinned commit, with its hash in the lock.
- Its LICENSE and NOTICE are in .claude/vendor-licenses.
- It installs no hooks into this repository's settings.

## Progress

- `.claude/skills/impeccable` vendored by `make skills` from pbakaus/impeccable@5cb95ee (its `.claude/skills/impeccable` copy, 57 files); the lock holds its hash, and `skills.sh check` scans 29 skills.
- `.claude/vendor-licenses` holds its MIT LICENSE and NOTICE.
- It installs a hook only when its `hooks on` command runs, into `.claude/settings.local.json`; nothing in this PR runs it, and `.claude/` is a protected path, so a committed hook change needs a ci-change issue and the review. `make check` passes.

- ESLint now ignores `.claude/`, because it tried to lint impeccable's vendored scripts; vendored and generated skills are checked against their sources instead.

## Decisions

- Vendored now so the ui flow has it from the first UI issue, rather than waiting for one.

## Next step

Open the PR with auto-merge on.
