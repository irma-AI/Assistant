# IRM-75: Remove the starter hint from the home page

Remove the starter paragraph ("Edit src/routes/index.tsx to get started.") from the home page in src/routes/index.tsx, leaving the main element with its h1 heading "Assistant".

Acceptance criteria:
- The home page renders only the h1 "Assistant" inside main, with no starter paragraph.
- The e2e smoke test still passes.
- make check passes.

## Progress

- Paragraph removed from `src/routes/index.tsx`.
- `make check` passes, including `e2e/smoke.spec.ts` (4 passed).

## Decisions

- None.

## Next step

Open the PR with auto-merge on.
