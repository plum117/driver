import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type * as OsModule from 'node:os'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('node:os', async (importOriginal) => {
    const original = await importOriginal<typeof OsModule>()
    return { default: { ...original, platform: () => 'win32' } }
})

import findEdgePath from '../src/finder.js'

describe('finder on Windows', () => {
    const env = { ...process.env }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-win32-'))

    beforeEach(() => {
        delete process.env.EDGE_BINARY_PATH
        process.env.LOCALAPPDATA = path.join(root, 'local')
        process.env.PROGRAMFILES = path.join(root, 'programs')
        process.env['PROGRAMFILES(X86)'] = path.join(root, 'programs-x86')
    })

    afterAll(() => {
        process.env = env
        fs.rmSync(root, { recursive: true, force: true })
    })

    test('returns undefined when Edge is not installed', () => {
        expect(findEdgePath()).toBeUndefined()
    })

    test('finds msedge.exe under LOCALAPPDATA', () => {
        const edge = path.join(root, 'local', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        fs.mkdirSync(path.dirname(edge), { recursive: true })
        fs.writeFileSync(edge, '')
        expect(findEdgePath()).toBe(edge)
    })
})
