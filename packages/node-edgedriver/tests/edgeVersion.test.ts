import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getEdgeVersionUnix, getEdgeVersionWin } from '../src/install.js'

let root = ''
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-version-'))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('getEdgeVersionWin', () => {
    test('returns the oldest version folder, compared as numbers', async () => {
        for (const dir of ['154.0.4258.62', '154.0.4258.9', '100.0.1.1', '99.0.1.1', 'SetupMetrics']) {
            fs.mkdirSync(path.join(root, dir))
        }
        fs.writeFileSync(path.join(root, 'msedge.exe'), '')
        expect(await getEdgeVersionWin(path.join(root, 'msedge.exe'))).toBe('99.0.1.1')
    })

    test('orders versions of the same major by build and patch', async () => {
        for (const dir of ['154.0.4258.62', '154.0.4258.9']) {
            fs.mkdirSync(path.join(root, dir))
        }
        expect(await getEdgeVersionWin(path.join(root, 'msedge.exe'))).toBe('154.0.4258.9')
    })
})

describe.skipIf(process.platform === 'win32')('getEdgeVersionUnix', () => {
    test('runs the binary without a shell, so quotes and $ in its path stay literal', async () => {
        // a file name can't hold `/`, so a shell would find the marker path in the environment
        const marker = path.join(root, 'pwned')
        process.env.EDGEDRIVER_TEST_MARKER = marker
        const dir = path.join(root, 'Edge "beta" $(touch "$EDGEDRIVER_TEST_MARKER")')
        fs.mkdirSync(dir)
        const edge = path.join(dir, 'microsoft-edge')
        fs.writeFileSync(edge, '#!/bin/sh\necho "Microsoft Edge 154.0.4258.62 unknown"\n', { mode: 0o755 })

        try {
            expect(await getEdgeVersionUnix(edge)).toBe('154.0.4258.62')
            expect(fs.existsSync(marker)).toBe(false)
        } finally {
            delete process.env.EDGEDRIVER_TEST_MARKER
        }
    })
})
