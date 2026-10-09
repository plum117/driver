import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import logger from '@wdio/logger'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

/**
 * A local CDN behind `GECKODRIVER_CDNURL=http://user:p%40ss@…` serving a real .tar.gz
 */
describe.skipIf(process.platform === 'win32')('CDN credentials', () => {
    const requests: { url: string, auth?: string }[] = []
    let server: http.Server
    let root = ''

    beforeAll(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'geckodriver-cdn-'))
        fs.mkdirSync(path.join(root, 'archive'))
        fs.writeFileSync(path.join(root, 'archive', 'geckodriver'), '#!/bin/sh\n', { mode: 0o755 })
        execFileSync('tar', ['-czf', path.join(root, 'geckodriver.tar.gz'), '-C', path.join(root, 'archive'), 'geckodriver'])
        const archive = fs.readFileSync(path.join(root, 'geckodriver.tar.gz'))

        server = http.createServer((req, res) => {
            requests.push({ url: req.url ?? '', auth: req.headers.authorization })
            if (req.url?.startsWith('/v0.36.0/geckodriver-v0.36.0-')) {
                return res.end(archive)
            }
            res.writeHead(404).end()
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        process.env.GECKODRIVER_CDNURL = `http://user:p%40ss@127.0.0.1:${(server.address() as AddressInfo).port}`
        // the CDN URL is read when the module loads
        vi.resetModules()
    })

    afterAll(() => {
        delete process.env.GECKODRIVER_CDNURL
        server.close()
        fs.rmSync(root, { recursive: true, force: true })
    })

    test('sends CDN credentials as a header and keeps them out of the log', async () => {
        const info = vi.spyOn(logger('geckodriver'), 'info')
        const { download } = await import('../src/install.js')

        const binary = await download('0.36.0', path.join(root, 'cache'))

        expect(fs.existsSync(binary)).toBe(true)
        expect(requests).toHaveLength(1)
        // the password is `p@ss`: percent-encoding is undone before it goes into the header
        expect(requests[0].auth).toBe(`Basic ${Buffer.from('user:p@ss').toString('base64')}`)
        expect(JSON.stringify(info.mock.calls)).not.toMatch(/user|p%40ss|p@ss/)
    })
})
