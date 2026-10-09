import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { afterEach, beforeEach, expect, test } from 'vitest'

import pkg from '../package.json' with { type: 'json' }

/**
 * Runs the real `postinstall` script with npm's default shell: `sh`, or `cmd.exe` on Windows.
 * PATH has only Node.js and the system tools: a Windows CI runner also has Git's Unix tools
 * (`test.exe`), which a user's Windows usually has not.
 */
const PATH = [path.dirname(process.execPath), ...(process.platform === 'win32'
    ? [path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')]
    : ['/usr/bin', '/bin'])].join(path.delimiter)
let root = ''
const postinstall = () => execSync(pkg.scripts.postinstall, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    // Windows reads `Path`; one key only, so the restricted value wins
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH')), PATH },
})
const writeInstallJs = (body: string) => {
    fs.mkdirSync(path.join(root, 'dist'))
    fs.writeFileSync(path.join(root, 'dist', 'install.js'), body)
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-'))
    // the stubs below are CommonJS
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"commonjs"}')
})

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
})

test('runs dist/install.js when it is built, on every OS', () => {
    writeInstallJs('require("fs").writeFileSync("ran", process.argv[1])')
    postinstall()
    // install.js only downloads when it is the entry point
    expect(fs.readFileSync(path.join(root, 'ran'), 'utf8')).toMatch(/dist[\\/]install\.js$/)
})

test('skips without failing when the package is not built', () => {
    expect(postinstall()).toContain('Skipping install, project not built!')
})

test('a failing download does not fail the install', () => {
    writeInstallJs('throw new Error("no network")')
    expect(() => postinstall()).not.toThrow()
})
