# IRM-48: Guardrails record: why each guard exists, and the known risks

The guardrails record in the repository: sections 1 to 7 of the build plan as docs/guardrails.md, updated to what is built (live-test results, the parallel ci, the deploy with smoke test and rollback, the single review pass with lens files, the Dokploy permission, commit identity), with the writer-only GitHub account recorded as a known risk. The build order and the live-test log stay out.

Acceptance criteria:
- docs/guardrails.md holds the principles, the pieces, the skills, where each check runs, the maybe and excluded lists and the open risks, with no "not checked" note that a live test has settled.
- Pieces that wait for the first feature are marked "not built yet", and the writer-only account is a known risk in section 7.
- CLAUDE.md points at it, and claim-sweep includes it.

## Progress

- `docs/guardrails.md` is sections 1 to 7 of the plan (745 lines), with every "not checked" note a live test settled rewritten to the result, the built shape of 2.3, 2.9, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.19 and 2.29, five "not built yet" markers, and the owner's 2026-10-23 decision on the writer-only account in 2.14 and section 7.
- `CLAUDE.md` points at it (3745 characters), and `claim-sweep` lists it among the documents it checks. `make check-repo` passes.

## Decisions

- Named guardrails, not design, because impeccable writes a DESIGN.md for visual design.
- Sections 8 (build order, finished) and 9 (live-test log, with hosts and IDs) stay out of this public repository.

## Next step

Open the PR with auto-merge on.
