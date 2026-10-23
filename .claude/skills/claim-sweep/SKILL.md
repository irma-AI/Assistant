---
name: claim-sweep
description: Tests what the agent documents claim about the code against the code, and fixes the stale claims in one PR. Use in the weekly routine, after a large refactor, or when an agent followed a document into a wrong turn.
---

# Claim sweep

A **claim** is a sentence in an agent document that says how the code, CI, a command, a path or a rule behaves. The documents are `CLAUDE.md`, `docs/guardrails.md`, `docs/agents/`, `docs/plans/README.md` and every skill whose lock entry is `{"source": "local"}`. Copied skills are left to their upstream.

1. **List every claim** in those documents, one line each with its file.
2. **Test each claim against the repository**: read the code, or run the command it names. Mark it **holds**, **stale** (the code does something else) or **unverifiable** (nothing could show it true or false).
3. **Fix what you found:**
   - a stale claim: change the document to match the code;
   - a claim that is right while the code is wrong: leave both, and file a Linear issue for the code;
   - an unverifiable claim: rewrite it so a check or a reader could test it, or delete it.
4. **Open one PR** through `next-step`, with an issue titled "Claim sweep" plus the date. The issue needs `ci-change` at creation, because `CLAUDE.md` and `.claude/` are protected paths. The PR description lists each claim you changed, with the evidence.

Done when every claim in the documents has a mark, and every stale or unverifiable one is fixed or has an issue.
