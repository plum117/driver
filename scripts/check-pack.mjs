import { execFileSync } from 'node:child_process'

// the 7.0.0 / 2.0.0 tarballs shipped without LICENSE; publint and attw don't check the file list
const required = [
    'LICENSE', 'README.md', 'package.json',
    'dist/index.js', 'dist/index.d.ts', 'dist/cjs/index.js', 'dist/cjs/index.d.ts',
]
const [{ files }] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
}))
const missing = required.filter((file) => !files.some((entry) => entry.path === file))
// anything else (a new config file, src, tests) must be added to .npmignore or listed here
const allowed = /^(LICENSE|README\.md|AUTHORS|package\.json|bin\/[^/]+\.js|dist\/.+)$/
const unexpected = files.map((entry) => entry.path).filter((file) => !allowed.test(file))
if (missing.length || unexpected.length) {
    if (missing.length) {
        console.error(`missing from the npm tarball: ${missing.join(', ')}`)
    }
    if (unexpected.length) {
        console.error(`not expected in the npm tarball: ${unexpected.join(', ')}`)
    }
    process.exit(1)
}
