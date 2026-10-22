# Input: Linear's answer to the issue query in protected-paths.sh.
# Prints "ok", or why the issue doesn't unlock protected paths.
# Linear folds changes made in the first minutes after creation into the
# creation entry, so a label or a move to Ready with no entry counts as at creation.
.data.issue as $i
| if $i == null then "the issue was not found"
  elif $i.history.pageInfo.hasNextPage then "its history is longer than one page"
  elif ([$i.labels.nodes[].name] | index("ci-change")) == null then "it has no ci-change label"
  else
    ($i.history.nodes | sort_by(.createdAt)) as $h
    | ([$h[] | select(.toState != null)] | first) as $move
    | (if $move then $move.fromState.name else $i.state.name end) as $created_in
    | ([$h[] | select(any(.addedLabels[]?; .name == "ci-change")) | .createdAt] | last) as $labelled
    | ((if $created_in == "Ready" then [$i.createdAt] else [] end)
       + [$h[] | select(.toState.name? == "Ready") | .createdAt] | first) as $ready
    | if $labelled != null and $ready != null and $labelled > $ready
      then "ci-change was added after it reached Ready"
      else "ok" end
  end
