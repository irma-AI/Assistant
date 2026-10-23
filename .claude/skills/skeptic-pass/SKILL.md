---
name: skeptic-pass
description: Has two or three independent subagents try to refute a finished change before its PR, each through one lens. Use before the PR on changes that touch access control, data deletion, migrations, CI, guards, or anything hard to undo.
---

# Skeptic pass

A **skeptic** tries to prove the change wrong. Agreeing is not its job, so each one gets a different lens and never sees the others' answers.

1. **Freeze the head.** Commit, and note the SHA every skeptic reviews.
2. **Start two or three subagents in parallel.** Give each the diff against `origin/main`, the issue's plan file in `docs/plans/`, `CLAUDE.md`, and one lens:
   - **correctness**: inputs and states where the new code gives a wrong result;
   - **regression**: existing behaviour, callers or checks the change breaks;
   - **safety**: access control, data loss, personal data, secrets, or a way for a change to loosen the checks that judge it.

   Each returns counterexamples as concrete inputs or sequences of events, or "none found" with what it tried.
3. **Turn each valid counterexample into a test** at a declared seam that fails at the frozen SHA, then fix the code. A counterexample you reject goes in the PR description with the reason, where `policy`'s review reads it.
4. **Stop after two rounds.** If round two still finds valid counterexamples, the design needs another look: ask the owner (comment on the issue and move it to Needs input).
