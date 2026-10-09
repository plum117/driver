import waitPort from 'wait-port'
import { execFileSync, execSync } from 'node:child_process'
import { remote } from 'webdriverio'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'

import { start, download, findEdgePath } from 'edgedriver'

/**
 * Force-kill any leftover msedgedriver/Edge processes. Sessions started via
 * `wdio:edgedriverOptions.binary` have their driver process managed
 * internally by WebdriverIO - deleteSession() ends the WebDriver session but
 * doesn't guarantee that process has actually exited yet. A lingering
 * instance either blocks deleting its own binary on Windows (EPERM: file
 * still in use) or, on Linux/macOS, silently keeps running and consuming
 * memory into the next test (surfaces as a bare "Killed" + exit 137).
 */
function killDriverProcesses() {
    const isWindows = process.platform === 'win32'
    const patterns = isWindows ? ['msedgedriver.exe', 'msedge.exe'] : ['msedgedriver', 'microsoft-edge']
    for (const pattern of patterns) {
        try {
            execSync(isWindows ? `taskkill /IM ${pattern} /F /T` : `pkill -9 -f ${pattern}`, { stdio: 'ignore' })
        } catch {
            // no matching process running, nothing to clean up
        }
    }
}

describe('Edgedriver E2E Tests', () => {
    /**
     * Give every test its own driver cache dir instead of the shared default
     * (EDGEDRIVER_CACHE_DIR or os.tmpdir()). Tests used to all download into
     * the same /tmp/msedgedriver and delete-then-redownload it between tests,
     * which raced against whatever process the previous test hadn't fully
     * torn down yet.
     */
    let cacheDir = ''

    beforeEach(async () => {
        cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edgedriver-e2e-'))
        killDriverProcesses()
    })

    afterEach(async () => {
        killDriverProcesses()
        /**
         * maxRetries/retryDelay: Windows can lag briefly between a process
         * exiting and the OS actually releasing its handle on the binary,
         * even after killDriverProcesses() above returns.
         */
        await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })

    it('start edgedriver manually', async () => {
        const port = 4444
        const cp = await start({ port, cacheDir })

        try {
            await waitPort({ port: 4444 })
            const browser = await remote({
                port,
                capabilities: {
                    browserName: 'MicrosoftEdge',
                    'ms:edgeOptions': {
                        binary: findEdgePath(),
                        args: [
                            'no-sandbox',
                            'headless'
                        ]
                    }
                }
            })
            await browser.url('https://guinea-pig.webdriver.io/')
            await browser.deleteSession()
        } finally {
            cp.kill()
            await new Promise((resolve) => cp.once('exit', resolve))
        }
    })

    it('start specific edgedriver', async () => {
        const binary = await download(undefined, cacheDir)

        const browser = await remote({
            automationProtocol: 'webdriver',
            capabilities: {
                browserName: 'edge',
                'ms:edgeOptions': {
                    args: ['no-sandbox', 'headless']
                },
                'wdio:edgedriverOptions': {
                    binary
                }
            }
        })
        await browser.url('https://guinea-pig.webdriver.io/')
        await browser.deleteSession()
    })

    it('download with missing architecture', async () => {
        const binary = await download('152.0.4191.77', cacheDir)

        // check the driver binary, not a session: a pinned driver can't drive the runner's newer Edge
        expect(execFileSync(binary, ['--version']).toString()).toMatch(/Microsoft Edge WebDriver 152\./)
    })
})
