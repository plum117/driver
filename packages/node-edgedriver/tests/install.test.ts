import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { vi, test, expect, describe, beforeEach } from 'vitest'
import { EnvHttpProxyAgent } from 'undici'
import type * as Undici from 'undici'

import { fetchVersion, download, isAutoInstallEntrypoint } from '../src/install.js'
import { EDGE_PRODUCTS_API } from '../src/constants.js'

// All vi.mock calls must be at module scope so Vitest hoists them before any
// imports — mocks inside test() bodies are not hoisted.
vi.mock('node:os', () => ({
    default: {
        arch: vi.fn(),
        platform: vi.fn(),
        tmpdir: vi.fn(() => '/tmp')
    }
}))

vi.mock('node:fs/promises', () => ({
    default: {
        access: vi.fn(),
        mkdir: vi.fn().mockResolvedValue(undefined),
        chmod: vi.fn().mockResolvedValue(undefined),
    },
    writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/utils.js', async (original) => {
    const actual: any = await original()
    return {
        ...actual,
        hasAccess: vi.fn(),
    }
})

const zipState = vi.hoisted(() => ({ entries: [] as any[] }))
vi.mock('@zip.js/zip.js', () => ({
    BlobReader: class { },
    BlobWriter: class { },
    ZipReader: class {
        getEntries() { return Promise.resolve(zipState.entries) }
    },
}))

const mockFetch = vi.hoisted(() => vi.fn())
vi.mock('undici', async (original) => ({ ...(await original<typeof Undici>()), fetch: mockFetch }))
const withProxyAgent = expect.objectContaining({ dispatcher: expect.any(EnvHttpProxyAgent) })

// Set up the mock implementation
const setupFetchMock = async () => {
    const apiResponse = await import('./__fixtures__/api.json', { with: { type: 'json' } })
    mockFetch.mockImplementation(async (url) => {
        if (url === EDGE_PRODUCTS_API) {
            return {
                json: vi.fn().mockResolvedValue(apiResponse.default)
            }
        } else if (url.includes('LATEST_RELEASE')) {
            // For LATEST_RELEASE URLs, return the version text
            return {
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('��114.0.1823.82')
            }
        }

        // For other URLs (like tagged versions), return default text response
        return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('��123.456.789.0'),
            json: vi.fn().mockResolvedValue({})
        }
    })
}

// Setup the mock before tests
await setupFetchMock()

describe('fetchVersion', () => {
    test('fetchVersion fixed & tag versions', async () => {
        expect(await fetchVersion('123.456.789.0')).toBe('123.456.789.0')
        expect(await fetchVersion('beta')).toBe('122.0.2365.30')
        expect(await fetchVersion('some114version')).toBe('114.0.1823.82')
        await expect(fetchVersion('latest-win')).rejects.toThrow()

        vi.mocked(os.arch).mockReturnValue('arm')
        vi.mocked(os.platform).mockReturnValue('linux')
        expect(await fetchVersion('stable')).toBe('121.0.2277.113')

        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('linux')
        expect(await fetchVersion('stable')).toBe('121.0.2277.113')

        vi.mocked(os.arch).mockReturnValue('arm')
        vi.mocked(os.platform).mockReturnValue('win32')
        expect(await fetchVersion('stable')).toBe('123.456.789.0')

        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('win32')
        expect(await fetchVersion('stable')).toBe('121.0.2277.112')

        vi.mocked(os.arch).mockReturnValue('x64')
        vi.mocked(os.platform).mockReturnValue('darwin')
        expect(await fetchVersion('stable')).toBe('121.0.2277.112')

        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('darwin')
        expect(await fetchVersion('stable')).toBe('121.0.2277.112')
    })

    test('fetchVersion with major version on iOS', async () => {
        mockFetch.mockClear()
        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('darwin')

        const version = await fetchVersion('121')

        expect(version).toBe('114.0.1823.82')
        expect(mockFetch).toHaveBeenCalledWith('https://msedgedriver.microsoft.com/LATEST_RELEASE_121_MACOS', withProxyAgent)
    })

    test('fetchVersion with major version on Windows', async () => {
        mockFetch.mockClear()
        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('linux')

        const version = await fetchVersion('121')

        expect(version).toBe('114.0.1823.82')
        expect(mockFetch).toHaveBeenCalledWith('https://msedgedriver.microsoft.com/LATEST_RELEASE_121_LINUX', withProxyAgent)
    })

    test('fetchVersion with major version on Linux', async () => {
        mockFetch.mockClear()
        vi.mocked(os.arch).mockReturnValue('arm64')
        vi.mocked(os.platform).mockReturnValue('win32')

        const version = await fetchVersion('121')

        expect(version).toBe('114.0.1823.82')
        expect(mockFetch).toHaveBeenCalledWith('https://msedgedriver.microsoft.com/LATEST_RELEASE_121_WINDOWS', withProxyAgent)
    })

    test('fetchVersion with proxy support', async () => {
        vi.resetModules()
        process.env.HTTPS_PROXY = 'https://proxy.com'
        const { fetchVersion } = await import('../src/install.js')

        expect(await fetchVersion('stable')).toBe('121.0.2277.112')
        expect(mockFetch).toBeCalledWith(expect.any(String), withProxyAgent)
        delete process.env.HTTPS_PROXY
    })
})

describe('isAutoInstallEntrypoint', () => {
    // uses the native `path` module (matching the implementation), so this
    // only proves correctness for the host OS running the test — real
    // cross-platform coverage (including Windows) comes from CI running this
    // same file on the macOS/Ubuntu/Windows matrix, not from simulating
    // another platform's paths in-process.
    test('matches when argv[1] points at dist/install.js', () => {
        const installJsPath = path.join('dist', 'install.js')
        expect(isAutoInstallEntrypoint(path.join('/home/user/node_modules/edgedriver', installJsPath))).toBe(true)
    })

    test('does not match when the package is only imported as a dependency', () => {
        expect(isAutoInstallEntrypoint(path.join('/home/user/my-project/index.js'))).toBe(false)
    })

    test('does not match when argv[1] is undefined', () => {
        expect(isAutoInstallEntrypoint(undefined)).toBe(false)
    })
})

describe('download', () => {
    const CACHE_DIR = path.resolve(os.tmpdir(), 'test-cache')
    let hasAccess: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        const utils = await import('../src/utils.js')
        hasAccess = vi.mocked(utils.hasAccess)
        hasAccess.mockResolvedValue(false) // cache miss
        vi.mocked(fsp.mkdir).mockClear()
        vi.mocked(fsp.chmod).mockClear()
        mockFetch.mockReset()
    })

    test('rejects zip entries that escape the cache directory (Zip Slip)', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            body: {},
            blob: vi.fn().mockResolvedValue(new Blob([])),
        })
        zipState.entries = [
            { filename: '../../evil.exe', directory: false, getData: vi.fn() },
        ]

        await expect(download('123.456.789.0', CACHE_DIR)).rejects.toThrow('resolves outside the cache directory')
    })
})
