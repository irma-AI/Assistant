# Every PR closes exactly one Linear issue.
([(.body // "") | scan("(?i)\\b(?:closes|fixes|resolves)\\s+([a-z]+-[0-9]+)") | .[0] | ascii_upcase] | unique) as $ids
| { scanned: 1,
    violations: (if ($ids | length) == 1 then []
                 else ["pr-issue: the description closes \($ids | length) Linear issues (\($ids | join(", "))). Fix: close exactly one, as \"Closes ABC-12\"."] end) }
