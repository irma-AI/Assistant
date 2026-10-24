# Input: {linear: Linear's answer to the query in intake-dispatch.yml, prs: the open PRs' bodies, max: MAX_PARALLEL}.
# Prints "fire IRM-12 IRM-13", one ID per free slot, "fire IRM-12" for an answered issue to resume, or "wait: <why>". Fails on an answer it can't read, so nothing fires on a guess.
.prs as $prs | (.linear.data // error("Linear answered without data: \(.linear.errors // "" | tostring)")) as $d
| [.prs[] | (.body // "") | scan("(?i)\\b(?:closes|fixes|resolves)\\s+([a-z]+-[0-9]+)") | .[0] | ascii_upcase] as $closed
# The cloud's sessions: issues In Progress or In Review, a session watching its PR included, that the
# local worker doesn't hold. The state is checked again here so the tests can feed other states.
| .max as $max
| [$d.inFlight.nodes[] | select(.state.name == "In Progress" or .state.name == "In Review")
   | select(any(.labels.nodes[]; .name == "local") | not) | .identifier] as $cloud
# An answered issue: cloud, In Progress since the owner's answer (its latest move in was from Needs input), an open PR
# closes it, and the PR's head commit is older than the answer. A new commit or a later Needs input round resets it.
| [$d.inFlight.nodes[] | select(.state.name == "In Progress" and (any(.labels.nodes[]; .name == "local") | not))
   | .identifier as $id | select($closed | any(. == $id))
   | ([.history.nodes[]? | select(.toState.name == "In Progress")] | max_by(.createdAt)) as $move
   | select($move.fromState.name == "Needs input")
   # shortcut: the PR's head commit date is the max over its closing PRs, a PR with no commits counts as never.
   | select([$prs[] | select((.body // "") | test("(?i)\\b(?:closes|fixes|resolves)\\s+" + $id + "\\b")) | .commits[]?.committedDate] | all(. < $move.createdAt))
   | {id: $id, at: $move.createdAt}] as $answered
| if ($answered | length) > 0
  then "fire \($answered | sort_by(.at)[0].id)"
  elif $d.ready.pageInfo.hasNextPage or any($d.ready.nodes[]; .inverseRelations.pageInfo.hasNextPage)
  then error("more Ready issues or relations than one page")
  elif ($cloud | length) >= .max
  then "wait: \($cloud | join(", ")) in flight"
  else
    [$d.ready.nodes | sort_by(.createdAt)[]
     | select(.identifier as $id | $closed | any(. == $id) | not)
     # A blocker short of Done still blocks, canceled ones included.
     | select(any(.inverseRelations.nodes[]; .type == "blocks" and .issue.state.type != "completed") | not)]
    | if length == 0 then "wait: nothing in Ready qualifies"
      else "fire \(.[:$max - ($cloud | length)] | map(.identifier) | join(" "))" end
  end
