# IRM-38: Skeptic pass, claim sweep, agentic-actions auditor, and the routine prompts

The remaining skills and the routine prompts (plan §3, 2.27, 2.28): skeptic-pass and claim-sweep written here, agentic-actions-auditor copied from trailofbits/skills at a pinned commit, and docs/agents/routines.md with each routine's schedule and the short prompt that points into the repository.

Acceptance criteria:
- .claude/skills holds skeptic-pass and claim-sweep (source local) and agentic-actions-auditor (pinned with its hash and licence).
- docs/agents/routines.md gives the intake and claim-sweep routines' schedule and prompt, each naming a file in the repository.
- CLAUDE.md points at the routines doc, and make check passes.

## Progress

- `skeptic-pass` and `claim-sweep` written here from the plan's descriptions (source local); `agentic-actions-auditor` vendored from trailofbits/skills@1e0cb77 with its CC BY-SA 4.0 licence; `skills.sh check` scans 28 skills.
- `docs/agents/routines.md` lists the hourly intake and weekly claim-sweep routines with their prompts; `CLAUDE.md` points at it. `make check` passes.

## Decisions

- The skeptic pass and claim sweep are new short versions, not copies of the old repository's, which held that project's own rules.
- `impeccable` waits for the first UI work.

## Next step

Open the PR with auto-merge on.
