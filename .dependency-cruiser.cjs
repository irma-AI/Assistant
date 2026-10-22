/** Architecture layers (plan 2.10). Server-only code lives in *.server.ts; the UI reaches it
 *  only through *.functions.ts, whose createServerFn wrappers TanStack Start strips from the
 *  browser bundle. */
module.exports = {
  forbidden: [
    {
      name: 'server-only',
      comment:
        'Only src/server/ (and tests and scripts) may import *.server.ts. Fix: call it from a *.functions.ts server function.',
      severity: 'error',
      from: { pathNot: '^(src/server/|scripts/)' },
      to: { path: '\\.server\\.ts$' },
    },
    {
      name: 'ui-through-server-functions',
      comment:
        'Routes and components reach src/server/ only through *.functions.ts. Fix: wrap the call in a createServerFn there.',
      severity: 'error',
      from: { path: '^src/(routes|components)/' },
      to: { path: '^src/server/', pathNot: '\\.functions\\.ts$' },
    },
    {
      name: 'no-circular',
      comment:
        'Circular imports hide which layer depends on which. Fix: move the shared part into its own module.',
      severity: 'error',
      from: {},
      // The generated route tree imports the router's type back, which is erased at build time.
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
