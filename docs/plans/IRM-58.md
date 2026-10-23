# IRM-58: Ponytail hooks at full strength and impeccable in full in the repository

Ponytail at full strength, and impeccable in full, in the repository (owner decision, 2026-10-23: non-negotiable). Cloud sessions and routines get only what the repository ships, so the plugin copies on the owner's machine don't reach them. The owner removes the duplicate plugins from Claude, so the repository does not turn them off.

- Vendor from DietrichGebert/ponytail at the commit already pinned for `ponytail-review` (5.3.2): the skills `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-help` and `ponytail-gain`, and the hook scripts `ponytail-*.js` into `.claude/hooks/`, where they find `.claude/skills/ponytail/SKILL.md`.
- Vendor from pbakaus/impeccable at its pinned commit: the four agents in `.claude/agents/` (asset producer, documenter, finish reviewer, manual edit applier).
- `.claude/settings.json` runs ponytail's hooks (SessionStart, UserPromptSubmit, SubagentStart) and impeccable's detector hook (SessionStart, PostToolUse on Edit|Write, Stop). Ponytail's SubagentStart skips impeccable's agents (`PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)'`), as in the old repository.
- An impeccable-scope hook tells an impeccable task that DESIGN.md and impeccable's craft floor set design completeness, and ponytail governs code structure only.
- `skills.sh` pins and checks the vendored hook scripts and agents as it does skills.
- guardrails records the decision, reversing "no skill installs hooks", with the old repository's audit costs (double injection, arbitration).

Acceptance criteria:
- The five ponytail skills, the ponytail hook scripts and the four impeccable agents are vendored at their pinned commits, and `skills.sh check` fails when any of them differs from its pin.
- `.claude/settings.json` runs ponytail's three hooks and impeccable's detector hook, and ponytail's subagent hook skips agents whose type starts with `impeccable-`.
- A session started in the repository gets the ponytail rules at start, and an impeccable task gets the scope message.
- guardrails section 3 and 2.5 record the decision and its costs.

## Progress

- `.github/scripts/skills.sh`: a lock entry with `dest` and `files` pins the files matching that pattern in `dest` (checked by digest over just those files, re-copied by `vendor`). A changed `.claude/hooks/ponytail-map.js` made `skills.sh check` fail on `ponytail-hooks`.
- `.claude/skills.lock.json`: `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` and `ponytail-hooks` at DietrichGebert/ponytail@09c434a (5.3.2), and `impeccable-agents` at pbakaus/impeccable@5cb95ee, the upstream's own `.claude/agents`, which already point at `.claude/skills/impeccable`. `skills.sh vendor` left every existing skill unchanged.
- `.claude/hooks/package.json` marks the folder CommonJS, because the root `package.json` is `"type": "module"` and ponytail's scripts use `require`.
- `.claude/settings.json`: ponytail's SessionStart, UserPromptSubmit and SubagentStart hooks (the last with `PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)'`), impeccable's detector at SessionStart, PostToolUse on Edit|Write and Stop, and `.claude/hooks/impeccable-scope.sh` on PostToolUse of the Skill tool and on UserPromptSubmit.
- `.claude/hooks/test.sh` checks: a session starts with ponytail's rules, a subagent gets them, an impeccable agent doesn't, an impeccable task and a typed `/impeccable` get the scope, another skill doesn't.
- `eslint.config.js` skips the vendored ponytail scripts, as it does impeccable's.
- guardrails 2.5 and section 3 record the decision, the hooks, the costs from the old repository's audit and what is not checked.

## Decisions

- The statusline nudge stays as ponytail ships it; the hook does not touch the owner's `~/.claude` to silence it.
- No `enabledPlugins` in `.claude/settings.json`: the owner removes the duplicate plugins from Claude.
- The scope hook is bash with jq, like the repository's other hooks, so it needs no CommonJS marker or lint exception.

## Next step

Run `make check`, the skeptic pass, then open the PR.
