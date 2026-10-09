import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'

import { download } from '../src/install.js'

const defaultDispatcher = getGlobalDispatcher()

afterEach(() => {
    setGlobalDispatcher(defaultDispatcher)
})

/**
 * WebdriverIO's proxy docs suggest undici's setGlobalDispatcher, and 7.x used it through Node's
 * fetch. WebdriverIO sets it in its config, after this module has loaded.
 */
test('uses a dispatcher set with setGlobalDispatcher after the module loaded', async () => {
    const mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    // a Cargo.toml without a version: download() stops after this one request
    mockAgent.get('https://raw.githubusercontent.com')
        .intercept({ path: '/mozilla/geckodriver/release/Cargo.toml' })
        .reply(200, '[package]\nname = "geckodriver"\n')
    setGlobalDispatcher(mockAgent)

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geckodriver-dispatcher-'))
    try {
        await expect(download(undefined, cacheDir)).rejects.toThrow(/Couldn't find version property/)
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    mockAgent.assertNoPendingInterceptors()
})
