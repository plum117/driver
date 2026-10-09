import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { start } from '../src/index.js'

describe.skipIf(process.platform === 'win32')('start', () => {
    let root = ''
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-start-'))
    })
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

    test('passes spawnOpts to spawn, not to the driver as an argument', async () => {
        const marker = path.join(root, 'wrote-everything')
        const argsFile = path.join(root, 'args')
        // a fake msedgedriver that records its arguments, then writes more than a pipe buffer
        const driver = path.join(root, 'msedgedriver')
        fs.writeFileSync(driver, `#!/bin/sh\necho "$@" > '${argsFile}'\nhead -c 2097152 /dev/zero\ntouch '${marker}'\n`, { mode: 0o755 })

        const child = await start({ customEdgeDriverPath: driver, port: 1234, spawnOpts: { stdio: 'ignore' } })
        // the fake driver exits once it is done; with a piped stdout it would block and never exit
        const code = await new Promise<number | null>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('the fake driver did not exit in time')), 15_000)
            child.once('close', (exitCode) => {
                clearTimeout(timer)
                resolve(exitCode)
            })
        })

        expect(code).toBe(0)
        expect(fs.existsSync(marker)).toBe(true)
        const args = fs.readFileSync(argsFile, 'utf8')
        expect(args).toContain('--port=1234')
        expect(args).not.toContain('spawn')
    }, 20_000)
})
