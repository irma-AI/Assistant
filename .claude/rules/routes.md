---
paths:
  - "src/routes/**"
---

# Routes

Each file in `src/routes/` is one route, and the production build writes `src/routeTree.gen.ts` from them; run `make generate` after adding, renaming or deleting a route file.

| File name | Route |
|---|---|
| index.tsx | The folder's own path |
| $id.tsx | A path parameter, read with `Route.useParams()` |
| {-$lang}.tsx | An optional parameter |
| $.tsx | A splat: the rest of the path, as `_splat` |
| _layout.tsx with a _layout/ folder | A pathless layout that wraps its children without adding a segment |
| __root.tsx | The root route and the document shell |
| -components/ or -name.tsx | Ignored: helpers next to routes |

- In the shell, put any path with `$` in single quotes, such as `'src/routes/posts/$id.tsx'`. Unquoted, the shell expands `$id` to nothing and the command acts on a file named .tsx.
- A route's `loader` calls a server function from a `*.functions.ts` file; route files never import `*.server.ts`.
- Keep route options in TanStack's order (`params`, `validateSearch`, `loaderDeps`, `beforeLoad`, `loader`, then the rest), which its type inference depends on; the router lint rule checks it.

For more, follow the `tanstack-router-core-path-params` and `tanstack-router-core-data-loading` skills.
