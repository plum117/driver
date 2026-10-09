import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../src/install.js', () => ({ download: vi.fn() }))

import { download } from '../src/install.js'
import run from '../src/cli.js'

/**
 * Runs the CLI with a fake driver and returns the code it passes to process.exit
 */
async function exitCodeFor (driverScript: string) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'driver-cli-'))
    const driver = path.join(root, 'driver')
    fs.writeFileSync(driver, `#!/bin/sh\n${driverScript}\n`, { mode: 0o755 })
    vi.mocked(download).mockResolvedValue(driver)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const sigtermListeners = process.listeners('SIGTERM')
    try {
        await run()
        await vi.waitFor(() => expect(exit).toHaveBeenCalled(), { timeout: 15_000 })
        return exit.mock.calls[0][0]
    } finally {
        exit.mockRestore()
        for (const listener of process.listeners('SIGTERM')) {
            if (!sigtermListeners.includes(listener)) {
                process.off('SIGTERM', listener)
            }
        }
        fs.rmSync(root, { recursive: true, force: true })
    }
}

describe.skipIf(process.platform === 'win32')('cli', () => {
    test('passes the driver exit code through', async () => {
        expect(await exitCodeFor('exit 3')).toBe(3)
    }, 20_000)

    test('exits non-zero when a signal kills the driver', async () => {
        expect(await exitCodeFor('kill -KILL $$')).toBe(1)
    }, 20_000)
})
