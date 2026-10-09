import { afterEach, expect, test } from 'vitest'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'

import { fetchVersion } from '../src/install.js'

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
    mockAgent.get('https://msedgedriver.microsoft.com')
        .intercept({ path: (p) => p.startsWith('/LATEST_RELEASE_120_') })
        // the real LATEST_* files are UTF-16LE with a byte order mark
        .reply(200, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('120.0.2210.92', 'utf16le')]))
    setGlobalDispatcher(mockAgent)

    expect(await fetchVersion('120')).toBe('120.0.2210.92')
    mockAgent.assertNoPendingInterceptors()
})
