import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A driver with its own copy of @wdio/logger opens WDIO_LOG_PATH a second time
 * and truncates it, so WebdriverIO's lines before driver start are lost or
 * become NUL bytes. Each run is a fresh process: the logger keeps its log file
 * in module state.
 */
const script = (driver: string, binaryOption: string) => `
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const loggerCjs = createRequire(fileURLToPath(import.meta.resolve('webdriverio'))).resolve('@wdio/logger')
const { default: logger } = await import(pathToFileURL(path.join(path.dirname(loggerCjs), 'index.js')).href)
const log = logger('webdriverio')

log.info('before driver start')
const { start } = await import('${driver}')
const driver = await start({ ${binaryOption}: process.execPath })
driver.kill()
log.info('after driver start')

await logger.waitForBuffer()
await new Promise((resolve) => setTimeout(resolve, 200))
`

describe('WebdriverIO log file', () => {
    it.each([
        ['edgedriver', 'customEdgeDriverPath', 'Starting EdgeDriver'],
        ['geckodriver', 'customGeckoDriverPath', 'Starting Geckodriver'],
    ])('keeps WebdriverIO lines when %s logs', async (driver, binaryOption, driverLine) => {
        const logPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'wdio-log-')), 'wdio.log')

        execFileSync(process.execPath, ['--input-type=module', '-e', script(driver, binaryOption)], {
            cwd: path.resolve(import.meta.dirname, '..'),
            env: { ...process.env, WDIO_LOG_PATH: logPath, WDIO_LOG_LEVEL: 'info' },
        })

        const content = await fs.readFile(logPath, 'utf8')
        expect(content).not.toContain('\0')
        expect(content).toContain('before driver start')
        expect(content).toContain(driverLine)
        expect(content).toContain('after driver start')
    })
})
