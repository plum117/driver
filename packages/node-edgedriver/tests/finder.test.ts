import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type * as OsModule from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import type * as UtilsModule from '../src/utils.js'

// linux() reads os.homedir() at call time, so beforeAll can set it
const home = vi.hoisted(() => ({ dir: '' }))

vi.mock('node:os', async (importOriginal) => {
    const original = await importOriginal<typeof OsModule>()
    return { default: { ...original, platform: () => 'linux', homedir: () => home.dir } }
})

vi.mock('../src/utils.js', async (importOriginal) => {
    const utils = await importOriginal<typeof UtilsModule>()
    return { ...utils, findByWhich: vi.fn(() => [] as string[]) }
})

import findEdgePath from '../src/finder.js'
import { findByWhich } from '../src/utils.js'

describe.skipIf(process.platform === 'win32')('finder on Linux', () => {
    let edgeBinary = ''

    beforeAll(() => {
        home.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver finder-'))
        const applications = path.join(home.dir, '.local', 'share', 'applications')
        // the home folder has a space; Exec paths have none, as in real Edge entries
        edgeBinary = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-bin-')), 'microsoft-edge-stable')
        fs.mkdirSync(applications, { recursive: true })
        fs.writeFileSync(edgeBinary, '', { mode: 0o755 })
        fs.writeFileSync(
            path.join(applications, 'microsoft-edge.desktop'),
            `[Desktop Entry]\nName=Microsoft Edge\nExec=${edgeBinary} %U\n`
        )
        // its first word is /usr/bin/env, not Edge, even though the line mentions Edge later
        fs.writeFileSync(
            path.join(applications, 'edge-wrapper.desktop'),
            `[Desktop Entry]\nName=Edge wrapper\nExec=/usr/bin/env FOO=1 ${edgeBinary} %U\n`
        )
    })

    beforeEach(() => {
        delete process.env.EDGE_BINARY_PATH
    })

    afterAll(() => {
        fs.rmSync(home.dir, { recursive: true, force: true })
        fs.rmSync(path.dirname(edgeBinary), { recursive: true, force: true })
    })

    test('falls back to the .desktop entry when Edge is not on PATH', () => {
        vi.mocked(findByWhich).mockReturnValue([])
        expect(findEdgePath()).toBe(edgeBinary)
    })

    test('skips an Exec line whose first word is not Edge', () => {
        vi.mocked(findByWhich).mockReturnValue([])
        expect(findEdgePath()).not.toBe('/usr/bin/env')
    })

    test('prefers Edge on PATH over the .desktop entry', () => {
        vi.mocked(findByWhich).mockReturnValue(['/usr/bin/microsoft-edge'])
        expect(findEdgePath()).toBe('/usr/bin/microsoft-edge')
    })
})
