# IRM-17: Stack guards with ast-grep: TanStack Start patterns and secrets in the browser

Stack guards (plan 2.3): ast-grep rules for the mistakes agents make most with TanStack Start, each with valid and invalid cases run by ast-grep test, scanned over src/ in make check.

Acceptance criteria:
- wrong-framework fails on imports from next/*, react-router-dom or @tanstack/start, createServerFn from @tanstack/react-router, "use server" and getServerSideProps, and on src/pages or app/layout.tsx.
- env-at-module-scope fails on process.env read outside a function in src/ (tests excluded).
- secret-in-vite-env fails on a VITE_ variable named like a secret.
- ast-grep is pinned in mise.toml, and sgconfig.yml is a protected path.

## Progress

- Three rules in `guards/ast-grep/rules/` with cases in `guards/ast-grep/tests/`; `ast-grep test` passes, and a scratch file importing next/link and reading process.env at module scope failed both rules.
- `guards/stack.sh` runs the rule tests, the layout check and the scan, and prints the files scanned; it runs in `make check`. `make check` passes.

## Decisions

- .ts and .tsx both parse as TSX through `languageGlobs`, so each rule exists once instead of twice.
- The CLAUDE.md rule names environment variables in prose, so the docs guard stays as it is (the review on the first push found the narrowed path check out of scope).
- The server-function login guard waits for the login middleware.

## Next step

Open the PR with auto-merge on.
