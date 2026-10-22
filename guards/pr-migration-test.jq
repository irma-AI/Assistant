# A PR that adds or changes a migration also changes a test, which proves what the migration enforces.
(.files // []) as $f
| ([$f[] | select(test("^migrations/.*\\.sql$"))]) as $m
| { scanned: ($f | length),
    violations: (if ($m | length) > 0 and ([$f[] | select(test("\\.test\\.tsx?$"))] | length) == 0
                 then ["pr-migration-test: \($m | join(", ")) changed with no test. Fix: add or change a test that tries the write the migration forbids or allows, against the real database."] else [] end) }
