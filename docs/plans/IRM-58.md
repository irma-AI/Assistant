# IRM-58: Ponytail hooks at full strength and impeccable in full in the repository

Ponytail at full strength, and impeccable in full, in the repository (owner decision, 2026-10-23: non-negotiable). Cloud sessions and routines get only what the repository ships, so the plugin copies on the owner's machine don't reach them. The owner removes the duplicate plugins from Claude, so the repository does not turn them off.

- Vendor from DietrichGebert/ponytail at the commit already pinned for `ponytail-review` (5.3.2): the skills `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-help` and `ponytail-gain`, and the hook scripts `ponytail-*.js` into `.claude/hooks/`, where they find `.claude/skills/ponytail/SKILL.md`.
- Vendor from pbakaus/impeccable at its pinned commit: the four agents in `.claude/agents/` (asset producer, documenter, finish reviewer, manual edit applier).
- `.claude/settings.json` runs ponytail's hooks (SessionStart, UserPromptSubmit, SubagentStart) and impeccable's detector hook (SessionStart, PostToolUse on Edit|Write, Stop). Ponytail's SubagentStart skips impeccable's agents (`PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)'`), as in the old repository.
- An impeccable-scope hook tells an impeccable task that DESIGN.md and impeccable's craft floor set design completeness, and ponytail governs code structure only.
- `skills.sh` pins and checks the vendored hook scripts and agents as it does skills.
- Impeccable's engine binary is not in the repository: its launcher downloads it from an upstream release that is not immutable, checked only against that release's own checksum. The detector hook runs the engine only at checksums pinned in the skills lock, downloaded by a repository script, and the launcher is told never to download one itself.
- guardrails records the decision, reversing "no skill installs hooks", with the old repository's audit costs (double injection, arbitration).

Acceptance criteria:
- The five ponytail skills, the ponytail hook scripts and the four impeccable agents are vendored at their pinned commits, and `skills.sh check` fails when any of them differs from its pin.
- `.claude/settings.json` runs ponytail's three hooks and impeccable's detector hook, and ponytail's subagent hook skips agents whose type starts with `impeccable-`.
- A session started in the repository gets the ponytail rules at start, and an impeccable task gets the scope message.
- guardrails section 3 and 2.5 record the decision and its costs.

## Progress

- `.github/scripts/skills.sh`: a lock entry with `dest` and `files` pins the files matching that pattern in `dest` (checked by digest over just those files, re-copied by `vendor`). A changed `.claude/hooks/ponytail-map.js` made `skills.sh check` fail on `ponytail-hooks`.
- `.claude/skills.lock.json`: `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` and `ponytail-hooks` (every `ponytail-*` file of upstream's `hooks/`) at DietrichGebert/ponytail@09c434a (5.3.2), and `impeccable-agents` at pbakaus/impeccable@5cb95ee, the upstream's own `.claude/agents`, which already point at `.claude/skills/impeccable`. `skills.sh vendor` left every existing skill unchanged.
- `.claude/hooks/package.json` marks the folder CommonJS, because the root `package.json` is `"type": "module"` and ponytail's scripts use `require`.
- `.claude/settings.json`: ponytail's SessionStart, UserPromptSubmit and SubagentStart hooks (the last with `PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)'`), impeccable's detector at SessionStart, PostToolUse on Edit|Write and Stop, and `.claude/hooks/impeccable-scope.sh` on PostToolUse of the Skill tool and on UserPromptSubmit.
- `.claude/hooks/test.sh` checks: a session starts with ponytail's rules, a subagent gets them, an impeccable agent doesn't, an impeccable task and a typed `/impeccable` get the scope, another skill doesn't.
- Skeptic pass on 7e9dfa6, security lens: P0, impeccable's engine downloaded unpinned (release engine-v0.1.16 is not immutable; the launcher trusts the release's own sidecar). Fixed: `.claude/hooks/impeccable-engine.sh` downloads the engine itself, accepts it only at the sha256 pinned per platform in `.claude/skills.lock.json` (`impeccable.engine`, the four checksums matched upstream's sidecars on 2026-10-23), caches it under `~/.cache/impeccable-pinned/`, runs the launcher with `IMPECCABLE_BIN` set, and at session start exports `IMPECCABLE_BIN` and a dead `IMPECCABLE_DOWNLOAD_BASE` to `CLAUDE_ENV_FILE`. `skills.sh check` fails when the vendored `VERSION` and the pinned engine version differ. `test.sh` checks that an engine off its pin is refused and not installed; a real run installed darwin-arm64 and `engine-probe` answered `impeccable-engine 0.1.16`. P2 left: on the owner's machine the launcher still prefers `~/.impeccable/bin/impeccable` or one on PATH when `IMPECCABLE_BIN` isn't set, as outside these sessions. P3 left: the agents' tool lists are upstream's.
- Skeptic round two on 7f0f7aa: fixed P2, a failed or timed-out download at session start left the agent's direct launcher calls free to fall back to the launcher's unchecked caches or PATH; every failure path now exports `IMPECCABLE_BIN` as a binary that always fails. Fixed P3: the export is quoted (`printf %q`), checked with a cache path containing a space. Not fixed here, the owner's to clear: the claude.ai-synced impeccable plugin on the owner's machine runs its own launcher in hooks, outside this script; the owner is removing the plugin copies.
- Skeptic pass, correctness lens: no P0 or P1. Fixed P2: the `ponytail-*.js` pin left out `ponytail-statusline.sh` and `.ps1`, so the activate hook's statusline setup message threw and never showed; the pin is now `ponytail-*` and the message appears. Fixed P3: the detector hook also runs after MultiEdit. Checked by the lens: `skills.sh check` fails on an added, deleted, edited or symlinked pinned file, and `vendor` leaves the repository's own hook files alone.
- `eslint.config.js` skips the vendored ponytail scripts, as it does impeccable's.
- guardrails 2.5 and section 3 record the decision, the hooks, the costs from the old repository's audit and what is not checked.

## Decisions

- The statusline nudge stays as ponytail ships it; the hook does not touch the owner's `~/.claude` to silence it.
- No `enabledPlugins` in `.claude/settings.json`: the owner removes the duplicate plugins from Claude.
- The scope hook is bash with jq, like the repository's other hooks, so it needs no CommonJS marker or lint exception.

## Next step

Open the PR. After merge, confirm in a cloud session that ponytail's rules load and the engine installs.
