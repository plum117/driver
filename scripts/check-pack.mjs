import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// the 7.0.0 / 2.0.0 tarballs shipped without LICENSE; publint and attw don't check the file list
const required = [
    'LICENSE', 'README.md', 'package.json',
    'dist/index.js', 'dist/index.d.ts', 'dist/cjs/index.js', 'dist/cjs/index.d.ts',
]
const [{ files }] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
}))
const packed = new Set(files.map((entry) => entry.path))
const missing = required.filter((file) => !packed.has(file))
// anything else (a new config file, tests) must be added to .npmignore or listed here;
// src is shipped because the source maps point at it
const allowed = /^(LICENSE|README\.md|AUTHORS|package\.json|bin\/[^/]+\.js|dist\/.+|src\/.+)$/
const unexpected = [...packed].filter((file) => !allowed.test(file))

/**
 * every `sourceMappingURL` must name a packed map, and every source of a packed map must be packed:
 * else debuggers and "go to definition" end on a missing file
 */
const unresolved = []
for (const file of packed) {
    const resolve = (ref) => path.posix.normalize(path.posix.join(path.posix.dirname(file), ref))
    if (/\.(js|d\.ts)$/.test(file)) {
        const ref = readFileSync(file, 'utf8').match(/\/\/# sourceMappingURL=(\S+)\s*$/)?.[1]
        if (ref && !packed.has(resolve(ref))) {
            unresolved.push(`${file} -> ${resolve(ref)}`)
        }
    }
    if (file.endsWith('.map')) {
        const { sources, sourceRoot = '' } = JSON.parse(readFileSync(file, 'utf8'))
        for (const source of sources) {
            if (!packed.has(resolve(path.posix.join(sourceRoot, source)))) {
                unresolved.push(`${file} -> ${resolve(path.posix.join(sourceRoot, source))}`)
            }
        }
    }
}

const problems = [
    [missing, 'missing from the npm tarball'],
    [unexpected, 'not expected in the npm tarball'],
    [unresolved, 'source map references outside the npm tarball'],
].filter(([list]) => list.length)
for (const [list, title] of problems) {
    console.error(`${title}:\n  ${list.join('\n  ')}`)
}
if (problems.length) {
    process.exit(1)
}
