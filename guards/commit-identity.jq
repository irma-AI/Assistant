# Every commit in a PR comes from Claude. GitHub commits on its behalf only as committer.
(.commits // []) as $c
| { scanned: ($c | length),
    violations: [ $c[]
      | if .author != "noreply@anthropic.com" then "commit-identity: \(.sha[:7]) is authored by \(.author). Fix: recommit as Claude <noreply@anthropic.com>."
        elif ([.committer] | inside(["noreply@anthropic.com", "noreply@github.com"]) | not) then "commit-identity: \(.sha[:7]) is committed by \(.committer). Fix: recommit as Claude <noreply@anthropic.com>."
        else empty end ] }
