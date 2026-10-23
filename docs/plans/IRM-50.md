# IRM-50: Keep the PR's instruction files away from the reviewer

From the guardrails audit at fcad227 (2026-10-23). policy checks the PR head out under pr/ for the reviewer to read as data, and Claude Code loads instruction files from the folders it reads, so a PR could add a nested CLAUDE.md telling the reviewer to return no findings.

Acceptance criteria:
- The step is in policy.yml and this PR's own policy run shows it ran.
- Guardrails 2.11 describes the step.

## Progress

- `policy.yml` deletes every `CLAUDE*.md`, `.claude` and `.mcp.json` under `pr/` right after the checkout and fails if any remain; the review prompt says those were removed and that the diff still shows them; guardrails 2.11 describes it.
- Skeptic pass on f62cfd9, two lenses: no counterexamples. Simulated: nested copies, names with spaces or newlines, `.claude` as a file, symlinks and directories named `CLAUDE.md` are all removed, and non-matching names kept; nothing later in the job reads `pr/`; `review/pr.diff` comes from the API, so the PR's changes to those files stay visible.

- After merge: PR 39's policy run (39957645408) logged "removed the PR's instruction files from pr/", so the first criterion passes.

## Decisions

- `AGENTS.md`, `.gitignore`-style files and case variants stay: Claude Code doesn't load the first or the last, and removing ignore files would hide files the reviewer may need; the prompt already treats every input as data.
- This PR's own policy runs from main, so the new step first runs on the PR after this one; the first criterion is checked there.

## Next step

Open the PR with auto-merge on.
