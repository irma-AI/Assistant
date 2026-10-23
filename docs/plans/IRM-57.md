# IRM-57: next-step: skills by path, blockers, UI steps with impeccable, agent docs and research

Fill the gaps in `next-step` found by comparing it with the old repository's router (owner decision, 2026-10-23), keeping only changes grounded in the audit and aligned with `docs/guardrails.md`.

- **Skills by path.** Routines may not load repository skills (`docs/agents/routines.md`, guardrails 2.28), so every skill `next-step` names is given by its file path.
- **Blockers.** `to-tickets` files blocked tickets straight into Ready and `docs/agents/issue-tracker.md` defines Linear's "blocked by", but neither intake nor `next-step` checks it. An issue with an open blocker is skipped by intake, and `next-step` stops on it.
- **UI work uses impeccable, within limits.** The plan's `ui` flow is `impeccable` with screenshots; the skill never names it. The audit's advice is to skip impeccable's full new-work flow and keep its audit as the review. So: a `ui` issue, or a `feature` that adds or changes a page, follows impeccable inside the world `DESIGN.md` sets, runs `impeccable audit` on the changed surface before the PR, and puts before and after screenshots at 390 and 1280 px in the PR, of made-up data only because the repository is public. With no `DESIGN.md` or `PRODUCT.md`, ask the owner first.
- **Agent documents.** A change to `CLAUDE.md`, a skill, a rule file or `docs/agents/` follows `writing-for-agents` (guardrails 2.5).
- **Outside facts.** Work that depends on an unverified outside fact runs `research`, with notes saved as `docs/plans/<ID>.research.md` citing each source with its read date (guardrails section 5; the audit's "adopt").
- **Tracker vocabulary.** `to-tickets` asks for a `ready-for-agent` label; here that means the Ready state with one type label, plus `ci-change` when the work touches a protected path.

Acceptance criteria:
- `next-step` names every skill it uses by file path, and `make check` (the docs guard) passes, so every path exists and the skill stays within its budget.
- `next-step` and the intake prompt in `docs/agents/routines.md` skip an issue with an open blocker.
- `next-step`'s UI steps name `impeccable` by path, require `DESIGN.md` and `PRODUCT.md` or a question to the owner, run `impeccable audit` before the PR, and ask for screenshots at 390 and 1280 px of made-up data only.
- `next-step` points to `writing-for-agents` for agent documents and to `research` for outside facts, with notes in `docs/plans/<ID>.research.md`.
- `docs/agents/issue-tracker.md` maps `ready-for-agent` to Ready with a type label, and guardrails section 3 and 2.20 describe the new `next-step` and intake.

## Progress

- `next-step`: a line saying each skill is read by path, and every skill named by its path; a blocked issue waits; the UI steps (DESIGN.md and PRODUCT.md or ask, impeccable inside that world, `impeccable audit`, screenshots at 390 and 1280 px of made-up data) for `ui` and for a `feature` that adds or changes a page; `writing-for-agents` for agent documents and `research` notes in `docs/plans/<ID>.research.md`.
- `docs/agents/routines.md`: intake skips an issue that an unfinished one blocks.
- `docs/agents/issue-tracker.md`: `ready-for-agent` means Ready with one type label, plus `ci-change` when needed.
- `docs/guardrails.md`: 2.20 and the `next-step` part of section 3 describe the above.
- Proof: `make check-repo` passes (docs guard: every backticked path exists, next-step at 4,765 of 6,000 characters); `grep` finds no skill named without its path in next-step, and the blocker rule in both next-step and the intake prompt.

## Decisions

- Left out, because neither the audit nor the plan supports them: copying in `tdd`, `guardrail-from-incident` and `domain-modeling` (the plan's skill list has none of them, the audit advises against stacking skill packs, and it found the ADRs and glossary drifting); a rule for merge conflicts; impeccable's full new-work flow (the audit says to keep its audit as the review only).
- The `code-review` claim in guardrails 2.11 and section 3 (the task-fit judge does not load that skill) is left for the claim sweep, since it is not about `next-step`.
- No skeptic pass: the change touches no `.github/`, `guards/` or `CLAUDE.md`, and no access control, deletion, migration or CI code.

## Next step

Run `make check`, then open the PR.
