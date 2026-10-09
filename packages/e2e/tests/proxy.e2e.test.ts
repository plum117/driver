import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * A CONNECT proxy that records which hosts it tunnels to. Each download runs
 * in its own process because the drivers read the proxy env vars at import.
 */
describe('HTTPS_PROXY', () => {
    const tunneled: string[] = []
    let proxy: http.Server
    let proxyUrl = ''

    beforeAll(async () => {
        proxy = http.createServer((_req, res) => res.writeHead(405).end())
        proxy.on('connect', (req, clientSocket: net.Socket, head) => {
            const [host, port] = (req.url ?? '').split(':')
            tunneled.push(host)
            const upstream = net.connect(Number(port) || 443, host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
                upstream.write(head)
                upstream.pipe(clientSocket)
                clientSocket.pipe(upstream)
            })
            upstream.on('error', () => clientSocket.destroy())
            clientSocket.on('error', () => upstream.destroy())
        })
        await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
        proxyUrl = `http://127.0.0.1:${(proxy.address() as net.AddressInfo).port}`
    })

    afterAll(async () => {
        proxy.closeAllConnections()
        await new Promise((resolve) => proxy.close(resolve))
    })

    const downloadWith = async (driver: string, noProxy: string) => {
        const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), `${driver}-proxy-`))
        tunneled.length = 0
        try {
            const script = `const { download } = await import('${driver}'); console.log(await download(undefined, ${JSON.stringify(cacheDir)}))`
            const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], {
                cwd: path.resolve(import.meta.dirname, '..'),
                env: { ...process.env, HTTPS_PROXY: proxyUrl, HTTP_PROXY: proxyUrl, NO_PROXY: noProxy },
            })
            expect(stdout.trim()).toContain(cacheDir)
        } finally {
            await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        }
    }

    it.each([
        ['geckodriver', 'github.com'],
        ['edgedriver', 'msedgedriver.microsoft.com'],
    ])('downloads %s through the proxy', async (driver, host) => {
        await downloadWith(driver, '')
        expect(tunneled).toContain(host)
    })

    it('bypasses the proxy for NO_PROXY hosts', async () => {
        await downloadWith('geckodriver', '*')
        expect(tunneled).toEqual([])
    })
})
