# IRM-47: Record the acceptance criteria proven after merge

Record the acceptance criteria that were proven after merge: flip passes in the plan files of IRM-15, IRM-20, IRM-24, IRM-30, IRM-36, IRM-39 and IRM-44 where a run in production or on GitHub showed them, each with its evidence in the plan's Progress.

Acceptance criteria:
- Every flipped criterion has its evidence (a run, a PR or a setting) in the plan's Progress.
- Criteria that nothing has shown yet stay false.

## Progress

- Flipped: IRM-15 (image check and release push), IRM-20 (secret scanning on), IRM-24 (deploy passes only on the new /version), IRM-30 (ci in about 45 s), IRM-36 (production migrated on deploy), IRM-39 (closer tested on PR 35), IRM-44 (smoke test in production).
- Left false: IRM-24's re-pin of the previous image and IRM-44's rollback after a failed smoke test, since neither case has happened.

## Decisions

- Only what a run, a PR or a setting showed counts; the rest waits for its first real case.

## Next step

Open the PR with auto-merge on.
