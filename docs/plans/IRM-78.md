# IRM-78: A cloud run doesn't resume the local worker's issue

The review on PR 64 found that a cloud run fired for an issue the local worker claimed during the routine's startup delay (about a minute) resumes it, because intake.md says "In Progress: resume it". Owner decision 2026-10-24: one clause, nothing more.

Change: `docs/agents/intake.md` step 2: an issue In Progress with the `local` label stops a run that isn't the local worker, instead of resuming it.

Acceptance criteria:

* intake.md stops a cloud run on an In Progress issue labelled `local`.
* make check passes.

## Progress

- `docs/agents/intake.md` step 2: In Progress with `local` stops any run but the local worker. `guards/docs.sh` and `make check` pass.

## Decisions

## Next step

Open the PR.
