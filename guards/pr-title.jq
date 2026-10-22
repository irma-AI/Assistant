# The PR title becomes the squash commit's subject, so it must be a conventional commit.
(.title // "") as $t
| { scanned: (if $t == "" then 0 else 1 end),
    violations: (if $t | test("^(feat|fix|perf|refactor|test|docs|build|ci|chore|revert)(\\([a-z0-9-]+\\))?!?: \\S")
                 then [] else ["pr-title: \"\($t)\" is not a conventional commit. Fix: retitle as type(scope): summary, with type one of feat, fix, perf, refactor, test, docs, build, ci, chore, revert."] end) }
