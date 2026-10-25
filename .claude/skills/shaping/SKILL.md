---
name: shaping
description: Shapes a Linear issue with the owner, researching facts before asking and recording each decision; also audits past decisions. Use before asking the owner anything, when an issue needs shaping, or for a decision-audit.
---

# Shaping

Shaping turns an issue into decisions the owner makes with the facts already in hand. The owner's time goes to the five kinds below; the rest is research.

## Before each round

1. **Classify** each candidate question. Only these five kinds go to the owner:
   - taste and wording users read;
   - money and new vendors;
   - risk appetite;
   - scope and priority;
   - business context only the owner has, such as hosting plans or account details.
2. **Research** everything else first with `.claude/skills/research/SKILL.md`: what is correct, legal, documented or standard, or how established products do it. Sources are primary: official docs, statutes, authorities, vendors' own docs. Record each with the date you read it, in `docs/plans/<ID>.research.md` or an issue comment.
3. **Ask** only the decision the research leaves open, with its sources. A recommendation names its source, or says "judgement, no source found". Legal calls go to the CEO marked as legal; never decide them.
4. **Open each question with the problem** in one plain sentence, using no internal terms.

Then run the rounds in the format of `.claude/skills/grilling/SKILL.md`.

### Worked example

First asked: "Add a `demo` flag to the `members`, `invoices` and `payments` tables so demo data can be told apart and wiped? Recommended: yes."

That is a fact question: the store reviewers and vendors document how to give a reviewer a working login. Research (Apple App Review Guidelines 2.1, read on the day) says to supply an ordinary reviewer account. Asked instead: "App Store reviewers need to log in without a real BankID. Apple's guidelines ask for an ordinary reviewer account with sample data; a flag on three tables would add code no store asks for. Use a normal account seeded with made-up data? Recommended: yes (Apple App Review Guidelines 2.1, read 2026-10-24)."

## Record every decision

Each decision in the issue's Decisions section states:

- the drivers;
- the options considered;
- the choice, with its source or "judgement, no source found";
- the accepted risks;
- a revisit trigger, such as the hosting move, the first customer, the first store build or go-live.

A reversal marks the old decision superseded and links to the new one; the old one stays.

## decision-audit

Run it when the owner asks, and at the revisit triggers: before the first store build, before go-live (IRM-94) and at the hosting move.

1. **Find decisions** in Linear Decisions and Rejected sections, PR "First principles", `docs/plans/`, `docs/guardrails.md` §7 accepted risks and owner Q&A. The cues, derived from MADR and Y-statements: an options list, a question with its answer, "instead of", "rejected", "accepted risk", "defer".
2. **Map before researching.** Merge duplicates into one tree ledger per area, taking the latest state from Linear and `origin/main` over older chat. Each node has: id, parent, question, drivers, options, chosen, rationale, basis (`sourced`, `judgement`, `owner` or `unknown`), status, reversibility, built, evidence (url, quote, date read), verdict, recommended change, revisit trigger, children.
3. **Research depth-first per branch until exhausted**, one subagent per branch. A node's sub-questions become children, finished before backtracking. One-way, built or judgement nodes get a primary-source check; two-way owner-context nodes get a short check that their context still holds. Verdicts: `holds`, `questionable`, `wrong`, `owner-call` (the five kinds only), `stale`. Legal calls are marked for the CEO.
4. **Verify before reporting.** Re-check every `wrong` and every high-stakes `questionable` against the code or the source yourself.
5. **Return findings as text.** The harness refuses report files from subagents, so you save the reports; the ledger JSON can be written.
6. **Report** counts by verdict; `wrong` first, then `questionable`, each with a source and a concrete change; the owner-call questions; the legal list. File fixes as issues only after the owner agrees.

### Worked example

A subagent flags "CSRF check missing on the new endpoint" as `wrong`. The verify step reads the code: a guard on every `/api/v1/**` route already rejects cross-origin writes, so the gap does not exist. The verdict becomes `holds`. Another flag, from a stale local checkout, fell the same way after `git fetch`.
