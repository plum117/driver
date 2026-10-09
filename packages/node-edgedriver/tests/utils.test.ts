import os from 'node:os'
import { vi, test, expect, describe } from 'vitest'

import { getNameByArchitecture, parseParams, extractBasicAuthFromUrl } from '../src/utils.js'

vi.mock('node:os', () => ({
    default: {
        arch: vi.fn(),
        platform: vi.fn()
    }
}))

test('getNameByArchitecture', () => {
    vi.mocked(os.arch).mockReturnValue('arm')
    vi.mocked(os.platform).mockReturnValue('linux')
    expect(getNameByArchitecture()).toBe('edgedriver_linux32')
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('linux')
    expect(getNameByArchitecture()).toBe('edgedriver_linux64')
    vi.mocked(os.arch).mockReturnValue('arm')
    vi.mocked(os.platform).mockReturnValue('win32')
    expect(getNameByArchitecture()).toBe('edgedriver_win32')
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('win32')
    expect(getNameByArchitecture()).toBe('edgedriver_win64')
    vi.mocked(os.arch).mockReturnValue('x64')
    vi.mocked(os.platform).mockReturnValue('darwin')
    expect(getNameByArchitecture()).toBe('edgedriver_mac64')
    vi.mocked(os.arch).mockReturnValue('arm64')
    vi.mocked(os.platform).mockReturnValue('darwin')
    expect(getNameByArchitecture()).toBe('edgedriver_mac64_m1')
})

test('parseParams', () => {
    expect(parseParams({ baseUrl: 'foobar', silent: true, verbose: false, allowedIps: ['123', '321'] }))
        .toMatchSnapshot()
})

describe('extractBasicAuthFromUrl', () => {
    test('with credentials', () => {
        const result = extractBasicAuthFromUrl('https://myuser:mypassword@cdn.example.com/path/file.zip')
        expect(result.url).toBe('https://cdn.example.com/path/file.zip')
        expect(result.authHeader).toBe('Basic ' + Buffer.from('myuser:mypassword').toString('base64'))
    })

    test('without credentials', () => {
        const result = extractBasicAuthFromUrl('https://cdn.example.com/path/file.zip')
        expect(result.url).toBe('https://cdn.example.com/path/file.zip')
        expect(result.authHeader).toBeUndefined()
    })

    test('with only username', () => {
        const result = extractBasicAuthFromUrl('https://myuser@cdn.example.com/path/file.zip')
        expect(result.url).toBe('https://cdn.example.com/path/file.zip')
        expect(result.authHeader).toBe('Basic ' + Buffer.from('myuser:').toString('base64'))
    })

    test('a bare % in a credential is kept as text, not left in the URL', () => {
        const result = extractBasicAuthFromUrl('https://us%er:p%ss@cdn.example.com/path/file.zip')
        expect(result.url).toBe('https://cdn.example.com/path/file.zip')
        expect(result.authHeader).toBe('Basic ' + Buffer.from('us%er:p%ss').toString('base64'))
    })

    test('with invalid URL returns original', () => {
        const result = extractBasicAuthFromUrl('not-a-valid-url')
        expect(result.url).toBe('not-a-valid-url')
        expect(result.authHeader).toBeUndefined()
    })
})
