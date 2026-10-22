# The PR description needs a non-empty "First principles" and "Not live yet" section.
def section($h):
  (.body // "" | gsub("<!--.*?-->"; ""; "s") | split("\n") | map(sub("\\s+$"; ""))) as $l
  | ($l | index("## " + $h)) as $i
  | if $i == null then null
    else $l[$i + 1:] | (map(startswith("## ")) | index(true)) as $j
      | (if $j == null then . else .[:$j] end) | join("\n") | gsub("^\\s+|\\s+$"; "")
    end;
["First principles", "Not live yet"] as $hs
| { scanned: ($hs | length),
    violations: [ $hs[] as $h | section($h) as $s
      | if $s == null then "pr-sections: the description has no \"## \($h)\" section. Fix: add it, written with the pr skill."
        elif $s == "" then "pr-sections: \"## \($h)\" is empty. Fix: fill it in, or write \"Nothing\" under Not live yet."
        else empty end ] }
