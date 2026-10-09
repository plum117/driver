import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

import { download } from '../src/install.js'
import { BINARY_FILE } from '../src/constants.js'
import { getNameByArchitecture } from '../src/utils.js'

const defaultDispatcher = getGlobalDispatcher()

afterEach(() => {
    setGlobalDispatcher(defaultDispatcher)
})

/**
 * WebdriverIO's proxy docs suggest undici's setGlobalDispatcher, and 7.x used it through Node's
 * fetch. WebdriverIO sets it in its config, after this module has loaded.
 */
test('looks up the version and downloads the zip through a dispatcher set after the module loaded', async () => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
    await zipWriter.add(BINARY_FILE, new TextReader('#!/bin/sh\n'))
    const zip = Buffer.from(await (await zipWriter.close()).arrayBuffer())

    const mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    const cdn = mockAgent.get('https://msedgedriver.microsoft.com')
    cdn.intercept({ path: (p) => p.startsWith('/LATEST_RELEASE_120_') })
        // the real LATEST_* files are UTF-16LE with a byte order mark
        .reply(200, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('120.0.2210.92', 'utf16le')]))
    cdn.intercept({ path: `/120.0.2210.92/${getNameByArchitecture()}.zip` }).reply(200, zip)
    setGlobalDispatcher(mockAgent)

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-dispatcher-'))
    try {
        const binary = await download('120', cacheDir)
        expect(fs.existsSync(binary)).toBe(true)
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    mockAgent.assertNoPendingInterceptors()
})
