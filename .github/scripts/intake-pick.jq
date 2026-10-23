# Input: {linear: Linear's answer to the query in intake-dispatch.yml, prs: the open PRs' bodies, max: MAX_PARALLEL}.
# Prints "fire IRM-12", or "wait: <why>". Fails on an answer it can't read, so nothing fires on a guess.
(.linear.data // error("Linear answered without data: \(.linear.errors // "" | tostring)")) as $d
| [.prs[] | (.body // "") | scan("(?i)\\b(?:closes|fixes|resolves)\\s+([a-z]+-[0-9]+)") | .[0] | ascii_upcase] as $closed
| if $d.ready.pageInfo.hasNextPage or any($d.ready.nodes[]; .inverseRelations.pageInfo.hasNextPage)
  then error("more Ready issues or relations than one page")
  elif ($d.inProgress.nodes | length) >= .max
  then "wait: \($d.inProgress.nodes | map(.identifier) | join(", ")) in progress"
  else
    [$d.ready.nodes | sort_by(.createdAt)[]
     | select(.identifier as $id | $closed | any(. == $id) | not)
     # A blocker short of Done still blocks, canceled ones included.
     | select(any(.inverseRelations.nodes[]; .type == "blocks" and .issue.state.type != "completed") | not)]
    | if length == 0 then "wait: nothing in Ready qualifies" else "fire \(.[0].identifier)" end
  end
