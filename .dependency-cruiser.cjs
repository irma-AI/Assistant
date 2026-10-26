/** Architecture layers (plan 2.10). Every UI reaches the server over /api/v1; only the API
 *  routes under src/routes/api/ import src/server/, where server-only code lives in *.server.ts. */
module.exports = {
  forbidden: [
    {
      name: 'server-only',
      comment:
        'Only src/server/, src/routes/api/ and scripts/ may import *.server.ts. Fix: add an endpoint under src/routes/api/v1/ and call it through src/api/.',
      severity: 'error',
      // src/start.ts is the server's entry point: it wraps every request in the log context.
      from: {
        pathNot: '^(src/server/|src/routes/api/|scripts/|src/start\\.ts$)',
      },
      to: { path: '\\.server\\.ts$' },
    },
    {
      name: 'ui-through-api',
      comment:
        'Only src/server/ and src/routes/api/ import src/server/. Fix: add an endpoint under src/routes/api/v1/ and call it through src/api/.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/(server/|routes/api/|start\\.ts$)',
      },
      to: { path: '^src/server/' },
    },
    {
      name: 'server-no-ui',
      comment:
        'src/server/ never imports UI code. Fix: move the shared part into src/server/ or src/api/.',
      severity: 'error',
      from: { path: '^src/server/' },
      to: { path: '^src/(routes|features|components|platform)/' },
    },
    {
      name: 'api-self-contained',
      comment:
        'src/api/ holds the contract and imports no other app code. Fix: move the shared part into src/api/.',
      severity: 'error',
      from: { path: '^src/api/' },
      to: { path: '^src/', pathNot: '^src/api/' },
    },
    {
      name: 'capacitor-in-platform',
      comment:
        'Only src/platform/ imports @capacitor/*. Fix: wrap the native call in src/platform/.',
      severity: 'error',
      from: { pathNot: '^src/platform/' },
      to: { path: '(^|/)@capacitor/' },
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
