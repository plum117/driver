import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { afterEach, expect, test } from 'vitest'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'
import { packTar } from 'modern-tar'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

import { download } from '../src/install.js'
import { BINARY_FILE } from '../src/constants.js'

const defaultDispatcher = getGlobalDispatcher()

afterEach(() => {
    setGlobalDispatcher(defaultDispatcher)
})

/**
 * the archive getDownloadUrl() asks for on this OS: a .zip on Windows, else a .tar.gz
 */
async function driverArchive () {
    const body = '#!/bin/sh\n'
    if (os.platform() === 'win32') {
        const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
        await zipWriter.add(BINARY_FILE, new TextReader(body))
        return Buffer.from(await (await zipWriter.close()).arrayBuffer())
    }
    const tar = await packTar([{ header: { name: BINARY_FILE, size: body.length, mode: 0o755 }, body }])
    return zlib.gzipSync(tar)
}

/**
 * WebdriverIO's proxy docs suggest undici's setGlobalDispatcher, and 7.x used it through Node's
 * fetch. WebdriverIO sets it in its config, after this module has loaded.
 */
test('looks up the version and downloads the archive through a dispatcher set after the module loaded', async () => {
    const mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    mockAgent.get('https://raw.githubusercontent.com')
        .intercept({ path: '/mozilla/geckodriver/release/Cargo.toml' })
        .reply(200, '[package]\nname = "geckodriver"\nversion = "0.36.0"\n')
    mockAgent.get('https://github.com')
        .intercept({ path: (p) => p.startsWith('/mozilla/geckodriver/releases/download/v0.36.0/geckodriver-v0.36.0-') })
        .reply(200, await driverArchive())
    setGlobalDispatcher(mockAgent)

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geckodriver-dispatcher-'))
    try {
        const binary = await download(undefined, cacheDir)
        expect(fs.existsSync(binary)).toBe(true)
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    mockAgent.assertNoPendingInterceptors()
})
