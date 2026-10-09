import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { start, stop } from '../src/index.js'

const TIMEOUT = 20_000

/**
 * Resolves with the exit code once the fake driver has exited and closed its pipes
 */
function closed (child: ChildProcess) {
    return new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the fake driver did not exit in time')), TIMEOUT - 5_000)
        child.once('close', (code) => {
            clearTimeout(timer)
            resolve(code)
        })
    })
}

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
        await closed(start({ path: driver }))
        expect(() => start({ path: driver })).not.toThrow()
    }, TIMEOUT)

    test('the already-running error names the port in use', () => {
        // `exec`, so stop() kills the sleep itself
        const driver = script('runs', 'exec sleep 5')
        start({ path: driver })
        expect(() => start({ path: driver })).toThrow(/on port 4444!/)
    })

    test('a missing binary does not crash a caller without an error listener', async () => {
        // no `error` listener here: an unhandled `error` event would fail this run
        await closed(start({ path: path.join(root, 'missing') }))
        expect(() => start({ path: script('exits', 'exit 0') })).not.toThrow()
    }, TIMEOUT)

    test('a missing binary still reports its error to the caller', async () => {
        const child = start({ path: path.join(root, 'missing') })
        const error = await new Promise<NodeJS.ErrnoException>((resolve) => child.once('error', resolve))
        expect(error.code).toBe('ENOENT')
    }, TIMEOUT)

    test('a driver that writes more than 1 MB keeps running and all of it arrives', async () => {
        const driver = script('talkative', 'head -c 2097152 /dev/zero')
        const child = start({ path: driver })
        let bytes = 0
        child.stdout?.on('data', (chunk: Buffer) => {
            bytes += chunk.length
        })
        expect(await closed(child)).toBe(0)
        expect(child.signalCode).toBeNull()
        expect(bytes).toBe(2097152)
    }, TIMEOUT)

    test('spawnOpts can ignore the output, so a talkative driver does not block', async () => {
        const marker = path.join(root, 'wrote-everything')
        const driver = script('talkative', `head -c 2097152 /dev/zero; touch '${marker}'`)
        expect(await closed(start({ path: driver, spawnOpts: { stdio: 'ignore' } }))).toBe(0)
        expect(fs.existsSync(marker)).toBe(true)
    }, TIMEOUT)
})
