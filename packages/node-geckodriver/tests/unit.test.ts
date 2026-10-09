import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { vi, test, expect, describe, beforeEach, afterEach } from 'vitest'
import { EnvHttpProxyAgent } from 'undici'
import type * as Undici from 'undici'

import { getDownloadUrl, parseParams, retryFetch, extractBasicAuthFromUrl } from '../src/utils.js'
import { getBinaryFilename, download } from '../src/install.js'

// All vi.mock calls must be at module scope so Vitest hoists them before
// any imports — mocks inside test() bodies are not hoisted and the already-
// bound module closures (e.g. pipeline, unpackTar in install.js) would not
// see the mock.
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
        mkdtemp: vi.fn(),
        rename: vi.fn().mockResolvedValue(undefined),
        chmod: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined),
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

vi.mock('node:stream/promises', () => ({
    pipeline: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('modern-tar/fs', () => ({
    unpackTar: vi.fn().mockReturnValue(vi.fn()),
}))

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

afterEach(() => {
    mockFetch.mockReset()
})

test('getBinaryFilename includes version in the filename', () => {
    vi.mocked(os.platform).mockReturnValue('linux')
    expect(getBinaryFilename('0.36.0')).toBe('geckodriver-0.36.0')

    vi.mocked(os.platform).mockReturnValue('darwin')
    expect(getBinaryFilename('0.36.0')).toBe('geckodriver-0.36.0')

    vi.mocked(os.platform).mockReturnValue('win32')
    expect(getBinaryFilename('0.36.0')).toBe('geckodriver-0.36.0.exe')
})

test('getBinaryFilename rejects version strings with path separators or traversal sequences', () => {
    expect(() => getBinaryFilename('../../../evil')).toThrow('Invalid geckodriver version string')
    expect(() => getBinaryFilename('0.36.0/etc/passwd')).toThrow('Invalid geckodriver version string')
    expect(() => getBinaryFilename('0.36.0\\evil')).toThrow('Invalid geckodriver version string')
})

test('getDownloadUrl', () => {
    vi.mocked(os.arch).mockReturnValue('arm')
    vi.mocked(os.platform).mockReturnValue('linux')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('linux')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
    vi.mocked(os.arch).mockReturnValue('arm')
    vi.mocked(os.platform).mockReturnValue('win32')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('win32')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
    vi.mocked(os.arch).mockReturnValue('x64')
    vi.mocked(os.platform).mockReturnValue('darwin')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('darwin')
    expect(getDownloadUrl('0.33.0')).toMatchSnapshot()
})

describe('download caching behaviour', () => {
    const CACHE_DIR = path.resolve(os.tmpdir(), 'test-cache')
    let hasAccess: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        const utils = await import('../src/utils.js')
        hasAccess = vi.mocked(utils.hasAccess)

        delete process.env.GECKODRIVER_VERSION
        vi.mocked(os.platform).mockReturnValue('linux')
        // default: cache miss
        hasAccess.mockResolvedValue(false)
        vi.mocked(fsp.rename).mockClear()
        vi.mocked(fsp.chmod).mockClear()
        vi.mocked(fsp.rm).mockClear()
        vi.mocked(fsp.mkdtemp).mockClear()
    })

    test('returns cached versioned binary without any network request', async () => {
        vi.mocked(hasAccess).mockResolvedValue(true)  // cache hit

        const result = await download('0.36.0', CACHE_DIR)

        expect(result).toBe(path.resolve(CACHE_DIR, 'geckodriver-0.36.0'))
        // zero network requests — the hot path must be purely local
        expect(mockFetch).not.toHaveBeenCalled()
    })

    test('does not fetch Cargo.toml when explicit version is cached', async () => {
        vi.mocked(hasAccess).mockResolvedValue(true)

        await download('0.36.0', CACHE_DIR)

        const cargoFetched = mockFetch.mock.calls
            .some(([url]) => String(url).includes('Cargo.toml'))
        expect(cargoFetched).toBe(false)
    })

    test('resolves latest version from Cargo.toml then hits versioned cache (no binary download)', async () => {
        mockFetch.mockResolvedValue({
            status: 200,
            text: () => Promise.resolve('version = "0.36.0"\nother = "x"'),
        } as any)
        // after Cargo.toml resolves, the versioned binary is already cached
        vi.mocked(hasAccess).mockResolvedValue(true)

        const result = await download(undefined, CACHE_DIR)

        expect(result).toBe(path.resolve(CACHE_DIR, 'geckodriver-0.36.0'))
        // only Cargo.toml fetched — no binary download
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(mockFetch.mock.calls[0][0]).toContain('Cargo.toml')
    })

    test('extracts into a unique mkdtemp staging dir, then renames to the final versioned path', async () => {
        const stagingDir = path.resolve(CACHE_DIR, 'geckodriver-AbC123')
        vi.mocked(fsp.mkdtemp).mockResolvedValue(stagingDir)
        mockFetch.mockResolvedValue({
            status: 200,
            body: {},
            blob: vi.fn().mockResolvedValue(new Blob([])),
        } as any)

        await download('0.36.0', CACHE_DIR).catch(() => {})

        const finalPath = path.resolve(CACHE_DIR, 'geckodriver-0.36.0')

        // staging dir must be created via mkdtemp (unique per operation), not a
        // deterministic path that parallel downloads of the same version share
        expect(fsp.mkdtemp).toHaveBeenCalledWith(path.join(CACHE_DIR, 'geckodriver-'))
        // rename must move the extracted binary out of that unique staging dir
        expect(fsp.rename).toHaveBeenCalledWith(
            path.resolve(stagingDir, 'geckodriver'),  // extracted name inside staging dir
            finalPath                                  // versioned final destination
        )
        // staging dir must be cleaned up
        expect(fsp.rm).toHaveBeenCalledWith(stagingDir, { recursive: true, force: true })
    })

    test('concurrent downloads of the same version use isolated staging dirs', async () => {
        // each mkdtemp call returns a distinct directory, mirroring the real OS
        let counter = 0
        vi.mocked(fsp.mkdtemp).mockImplementation(async (prefix) =>
            `${prefix}${++counter}`
        )
        mockFetch.mockResolvedValue({
            status: 200,
            body: {},
            blob: vi.fn().mockResolvedValue(new Blob([])),
        } as any)

        await Promise.all([
            download('0.36.0', CACHE_DIR).catch(() => {}),
            download('0.36.0', CACHE_DIR).catch(() => {}),
        ])

        const stagingDirs = vi.mocked(fsp.rename).mock.calls.map(([src]) => path.dirname(String(src)))
        expect(stagingDirs).toHaveLength(2)
        // the two concurrent operations must not share a staging directory
        expect(stagingDirs[0]).not.toBe(stagingDirs[1])
    })

    test('treats EEXIST on the final rename as success when the binary is already present', async () => {
        vi.mocked(fsp.mkdtemp).mockResolvedValue(path.resolve(CACHE_DIR, 'geckodriver-xyz'))
        mockFetch.mockResolvedValue({
            status: 200, body: {}, blob: vi.fn().mockResolvedValue(new Blob([])),
        } as any)
        // cache miss on entry, but after the rename collision the binary exists
        hasAccess.mockResolvedValueOnce(false).mockResolvedValue(true)
        const renameErr: any = new Error('exists')
        renameErr.code = 'EEXIST'
        vi.mocked(fsp.rename).mockRejectedValueOnce(renameErr)

        const result = await download('0.36.0', CACHE_DIR)

        // a concurrent winner produced the binary — must resolve, not throw
        expect(result).toBe(path.resolve(CACHE_DIR, 'geckodriver-0.36.0'))
    })

    test('rejects zip entries that escape the staging directory (Zip Slip)', async () => {
        const stagingDir = path.resolve(CACHE_DIR, 'geckodriver-zip')
        vi.mocked(os.platform).mockReturnValue('win32')  // .zip download path
        vi.mocked(os.arch).mockReturnValue('x64')
        vi.mocked(fsp.mkdtemp).mockResolvedValue(stagingDir)
        mockFetch.mockResolvedValue({
            status: 200, body: {}, blob: vi.fn().mockResolvedValue(new Blob([])),
        } as any)

        zipState.entries = [
            { filename: '../../evil.exe', directory: false, getData: vi.fn() },
        ]

        await expect(download('0.36.0', CACHE_DIR)).rejects.toThrow('resolves outside the staging directory')
    })
})

test('download with proxy support', async () => {
    // Ensure hasAccess always returns false so download always calls fetch.
    // vi.doMock (not vi.mock) since this must apply only to the dynamic
    // import below, not be hoisted over the file-level '../src/utils.js' mock.
    vi.doMock('../src/utils.js', async () => {
        const actual = await vi.importActual('../src/utils.js')
        return {
            ...actual,
            hasAccess: vi.fn().mockResolvedValue(false)
        }
    })
    try {
        process.env.HTTPS_PROXY = 'https://proxy.com'
        vi.resetModules()
        mockFetch.mockResolvedValue({
            status: 400,
            text: () => Promise.resolve('foobar'),
            json: () => Promise.resolve({ foo: 'bar' })
        })
        const { download } = await import('../src/install.js')
        await download('stable').catch(() => {})
        expect(mockFetch).toBeCalledWith(
            expect.any(String),
            expect.objectContaining({ dispatcher: expect.any(EnvHttpProxyAgent) })
        )
    } finally {
        // undo the runtime mock so later tests that reset modules and
        // dynamically import utils.js/install.js see the file-level mock,
        // not this test's proxy-specific one
        vi.doUnmock('../src/utils.js')
        delete process.env.HTTPS_PROXY
    }
})

test('download reports a failed latest-version lookup with its status', async () => {
    mockFetch.mockResolvedValue({
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('<html>rate limited</html>'),
    })
    await expect(download(undefined, '/tmp/geckodriver-status-test'))
        .rejects.toThrow('Failed to fetch the latest Geckodriver version (statusCode 429): Too Many Requests')
})

test('parseParams', () => {
    expect(parseParams({ marionetteHost: 'foobar', allowOrigins: ['123', '321'] }))
        .toMatchSnapshot()
})

test('retryFetch', async () => {
    mockFetch
        .mockRejectedValueOnce(new Error('request failed'))
        .mockRejectedValueOnce(new Error('request failed'))
        .mockResolvedValue('foobar' as any)
    expect(await retryFetch('foo', { bar: 'baz' } as any)).toBe('foobar')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockFetch).toHaveBeenCalledWith('foo', { bar: 'baz' })
})

describe('extractBasicAuthFromUrl', () => {
    test('moves decoded credentials into a Basic header', () => {
        expect(extractBasicAuthFromUrl('https://user:p%40ss@cdn.example.com/v0.36.0/geckodriver.tar.gz')).toEqual({
            url: 'https://cdn.example.com/v0.36.0/geckodriver.tar.gz',
            authHeader: `Basic ${Buffer.from('user:p@ss').toString('base64')}`
        })
    })

    test('keeps a URL without credentials as it is', () => {
        expect(extractBasicAuthFromUrl('https://cdn.example.com/x.zip')).toEqual({ url: 'https://cdn.example.com/x.zip' })
    })

    test('keeps a value that is not a URL as it is', () => {
        expect(extractBasicAuthFromUrl('not-a-url')).toEqual({ url: 'not-a-url' })
    })
})
