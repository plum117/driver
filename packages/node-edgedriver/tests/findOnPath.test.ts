import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { findOnPath } from '../src/utils.js'

describe('findOnPath', () => {
    let root = ''
    let first = ''
    let second = ''

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-path-'))
        first = path.join(root, 'first')
        second = path.join(root, 'second')
        fs.mkdirSync(first)
        fs.mkdirSync(second)
        fs.writeFileSync(path.join(second, 'microsoft-edge'), '', { mode: 0o755 })
        fs.writeFileSync(path.join(first, 'not-executable'), '', { mode: 0o644 })
        fs.writeFileSync(path.join(second, 'not-executable'), '', { mode: 0o755 })
        fs.mkdirSync(path.join(first, 'a-directory'))
    })

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

    test('returns the first match and skips empty PATH entries', () => {
        const envPath = ['', first, '', second].join(path.delimiter)
        expect(findOnPath('microsoft-edge', envPath)).toBe(path.join(second, 'microsoft-edge'))
    })

    test.skipIf(process.platform === 'win32')('skips a file without the executable bit', () => {
        const envPath = [first, second].join(path.delimiter)
        expect(findOnPath('not-executable', envPath)).toBe(path.join(second, 'not-executable'))
    })

    test('skips a directory with the same name', () => {
        expect(findOnPath('a-directory', first)).toBeUndefined()
    })

    test('returns undefined when nothing matches or PATH is empty', () => {
        expect(findOnPath('microsoft-edge', first)).toBeUndefined()
        expect(findOnPath('microsoft-edge', '')).toBeUndefined()
    })
})
