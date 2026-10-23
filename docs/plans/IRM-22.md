# IRM-22: Versions and release notes from commits with git-cliff

Versions and release notes from commits (plan 2.18): after the image job on every push to main, git-cliff works out the next semantic version from the conventional commits since the last tag, and a GitHub Release with the notes is created with the built-in token. Nothing is committed.

Acceptance criteria:
- feat raises the minor version, fix or perf the patch version, and a breaking change the major version; a push with none of them publishes no release.
- The notes group changes by type, link each one's Linear issue and PR, and end with a "What to check" list from the PRs' Not live yet sections.
- git-cliff is pinned in mise.toml.

## Progress

- `cliff.toml` groups commits by type, links `Closes IRM-n` to Linear and `(#n)` to the PR, and gathers the Not live yet sections under "What to check". A local preview over main gave v0.1.0 with 3 features and 12 maintenance commits.
- `release.yml` gets a `release` job after `image`: it skips when no feat, fix, perf or breaking change is unreleased, otherwise creates the tag and GitHub Release with `gh release create`. zizmor passes.

## Decisions

- The release runs after the image job for now; once the Dokploy deploy and its verification land, it moves after them.
- A preview of the notes is the only check before merge; the first real release happens on this PR's own merge.

## Next step

Open the PR with auto-merge on; check the first release after merge.
