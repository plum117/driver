import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'

/**
 * A local CDN behind `EDGEDRIVER_CDNURL=http://user:p%40ss@…`: version .91 is missing,
 * so download() falls back to LATEST_RELEASE_120_*, which points at .92.
 */
const requests: { url: string, auth?: string }[] = []
let server: http.Server
let cacheDir = ''

beforeAll(async () => {
    const { getNameByArchitecture } = await import('../src/utils.js')
    const { BINARY_FILE } = await import('../src/constants.js')
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
    await zipWriter.add(BINARY_FILE, new TextReader('#!/bin/sh\n'))
    const zip = Buffer.from(await (await zipWriter.close()).arrayBuffer())
    // the real LATEST_* files are UTF-16LE with a byte order mark
    const latest = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('120.0.2210.92', 'utf16le')])

    server = http.createServer((req, res) => {
        requests.push({ url: req.url ?? '', auth: req.headers.authorization })
        if (req.url?.startsWith('/LATEST_RELEASE_120_')) {
            return res.end(latest)
        }
        if (req.url === `/120.0.2210.92/${getNameByArchitecture()}.zip`) {
            return res.end(zip)
        }
        res.writeHead(404).end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    process.env.EDGEDRIVER_CDNURL = `http://user:p%40ss@127.0.0.1:${(server.address() as AddressInfo).port}`
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgedriver-cdn-'))
    // the CDN URL is read when the module loads
    vi.resetModules()
})

afterAll(() => {
    delete process.env.EDGEDRIVER_CDNURL
    server.close()
    fs.rmSync(cacheDir, { recursive: true, force: true })
})

test('sends CDN credentials as a header on every request, also for the version fallback', async () => {
    const { log } = await import('../src/constants.js')
    const info = vi.spyOn(log, 'info')
    const { download } = await import('../src/install.js')

    const binary = await download('120.0.2210.91', cacheDir)

    expect(fs.existsSync(binary)).toBe(true)
    expect(requests.map((r) => r.url)).toEqual([
        expect.stringMatching(/^\/120\.0\.2210\.91\//),
        expect.stringMatching(/^\/LATEST_RELEASE_120_/),
        expect.stringMatching(/^\/120\.0\.2210\.92\//),
    ])
    // the password is `p@ss`: percent-encoding is undone before it goes into the header
    const expected = `Basic ${Buffer.from('user:p@ss').toString('base64')}`
    expect(requests.every((r) => r.auth === expected)).toBe(true)
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/user|p%40ss|p@ss/)
})
