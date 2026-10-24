# IRM-79: Route all UI through /api/v1 and ban server functions, under guard:layers

Copied from the issue: https://linear.app/petters/issue/IRM-79

## Progress
- Layer rules in `.dependency-cruiser.cjs`, one fixture per rule in `guards/layers.sh`, `no-server-functions` ast-grep rule, docs updated.

## Decisions
- Built on the branch the session designated, not `irm-79-...`.

## Next step
Watch the PR until it merges.
