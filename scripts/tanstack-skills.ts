// Copies the TanStack skills this app uses out of the installed packages into .claude/skills,
// renamed tanstack-<skill> and with links between copied skills rewritten.
// Usage: node scripts/tanstack-skills.ts          write the copies
//        node scripts/tanstack-skills.ts --check  fail if a copy differs from the installed version
import { createRequire } from 'node:module'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Each package's skill paths, inside its skills/ folder.
const allow: Record<string, Array<string>> = {
  'react-start': ['react-start'],
  'react-router': ['react-router'],
  'router-core': [
    'router-core',
    'router-core/auth-and-guards',
    'router-core/data-loading',
    'router-core/not-found-and-errors',
    'router-core/path-params',
    'router-core/search-params',
    'router-core/type-safety',
  ],
  'start-client-core': [
    'start-core',
    'start-core/auth-server-primitives',
    'start-core/execution-model',
    'start-core/middleware',
    'start-core/server-functions',
    'start-core/server-routes',
  ],
  'start-server-core': ['start-server-core'],
}
// The package each one is resolved through, since pnpm only links direct dependencies.
const via: Record<string, string | undefined> = {
  'router-core': 'react-router',
  'start-client-core': 'react-start',
  'start-server-core': 'react-start',
}

const root = process.cwd()
const rootRequire = createRequire(join(root, 'package.json'))
const pkgDir = (pkg: string): string => {
  const parent = via[pkg]
  const from =
    parent === undefined
      ? join(root, 'package.json')
      : rootRequire.resolve(`@tanstack/${parent}/package.json`)
  return dirname(createRequire(from).resolve(`@tanstack/${pkg}/package.json`))
}
const nameOf = (path: string): string => `tanstack-${path.replaceAll('/', '-')}`
const copied = new Map(
  Object.entries(allow).flatMap(([pkg, paths]) =>
    paths.map((p): [string, string] => [`${pkg}:${p}`, nameOf(p)]),
  ),
)

function render(out: string): void {
  for (const [pkg, paths] of Object.entries(allow)) {
    const skills = join(pkgDir(pkg), 'skills')
    for (const path of paths) {
      const src = join(skills, path)
      const dest = join(out, nameOf(path))
      // The skill's own files, without the nested skills that get folders of their own.
      cpSync(src, dest, {
        recursive: true,
        filter: (f) => f === src || !existsSync(join(f, 'SKILL.md')),
      })
      const file = join(dest, 'SKILL.md')
      const linked = (rel: string): string | undefined =>
        copied.get(`${pkg}:${join(path, rel).replace(/\/SKILL\.md$/, '')}`)
      const text = readFileSync(file, 'utf8')
        .replace(/^name: .*$/m, `name: ${nameOf(path)}`)
        .replace(
          /\[([^\]]*)\]\((\.\.?\/[^)]*SKILL\.md)\)/g,
          (_, label: string, rel: string) => {
            const name = linked(rel)
            return name === undefined
              ? `${label} (not copied here)`
              : `[${label}](../${name}/SKILL.md)`
          },
        )
      writeFileSync(file, text)
    }
  }
}

const files = (dir: string): Array<string> =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort()
const same = (a: string, b: string): boolean => {
  if (!existsSync(b)) return false
  const fa = files(a)
  return (
    fa.join() === files(b).join() &&
    fa.every(
      (f) =>
        readFileSync(join(a, f), 'utf8') === readFileSync(join(b, f), 'utf8'),
    )
  )
}

const target = join(root, '.claude/skills')
if (process.argv.includes('--check')) {
  const tmp = mkdtempSync(join(tmpdir(), 'tanstack-skills-'))
  render(tmp)
  const stale = [...copied.values()].filter(
    (name) => !same(join(tmp, name), join(target, name)),
  )
  rmSync(tmp, { recursive: true })
  if (stale.length > 0) {
    console.error(
      `::error::TanStack skills differ from the installed packages: ${stale.join(', ')}. Fix: make skills, then commit them.`,
    )
    process.exit(1)
  }
  console.log(`tanstack skills: scanned ${String(copied.size)}`)
} else {
  for (const name of copied.values())
    rmSync(join(target, name), { recursive: true, force: true })
  render(target)
  console.log(`copied ${String(copied.size)} TanStack skills`)
}
