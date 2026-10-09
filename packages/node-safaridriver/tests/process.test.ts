import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { start, stop } from '../src/index.js'

/**
 * Real processes: fake safaridriver scripts stand in for /usr/bin/safaridriver.
 */
describe.skipIf(process.platform === 'win32')('safaridriver process', () => {
    let root = ''
    const script = (name: string, body: string) => {
        const file = path.join(root, name)
        fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
        return file
    }
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'safaridriver-process-'))
    })

    afterEach(() => {
        stop()
        fs.rmSync(root, { recursive: true, force: true })
    })

    test('start works again after the driver exits on its own', async () => {
        // like `safaridriver --enable`, which exits right away
        const driver = script('exits', 'exit 0')
        const first = start({ path: driver })
        await new Promise((resolve) => first.once('exit', resolve))
        expect(() => start({ path: driver })).not.toThrow()
    })

    test('the already-running error names the port in use', () => {
        const driver = script('runs', 'sleep 5')
        start({ path: driver })
        expect(() => start({ path: driver })).toThrow(/on port 4444!/)
    })

    test('a driver that writes more than 1 MB is not killed', async () => {
        const driver = script('talkative', 'head -c 2097152 /dev/zero; sleep 5')
        const child = start({ path: driver })
        await wait(1500)
        expect(child.signalCode).toBeNull()
        expect(child.exitCode).toBeNull()
    })

    test('spawnOpts can ignore the output, so a talkative driver does not block', async () => {
        const marker = path.join(root, 'wrote-everything')
        const driver = script('talkative', `head -c 2097152 /dev/zero; touch '${marker}'; sleep 5`)
        start({ path: driver, spawnOpts: { stdio: 'ignore' } })
        await wait(1500)
        expect(fs.existsSync(marker)).toBe(true)
    })
})
