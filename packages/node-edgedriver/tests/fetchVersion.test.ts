import type * as Undici from 'undici'
import { beforeEach, expect, test, vi } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())
vi.mock('undici', async (original) => ({ ...(await original<typeof Undici>()), fetch: mockFetch }))

import { fetchVersion } from '../src/install.js'

const isProductsApi = (url: string) => url.startsWith('https://edgeupdates.microsoft.com/')

beforeEach(() => {
    mockFetch.mockReset()
})

test('a tagged version fails with the status when the CDN answers an error', async () => {
    mockFetch.mockImplementation(async (url: string) => isProductsApi(url)
        ? { ok: true, status: 200, json: async () => [] }
        : { ok: false, status: 404, statusText: 'Not Found', text: async () => '<!DOCTYPE html>' })
    await expect(fetchVersion('beta')).rejects.toThrow("Couldn't fetch the latest beta version (statusCode 404): Not Found")
})

test('a failing products API falls back to the CDN', async () => {
    mockFetch.mockImplementation(async (url: string) => isProductsApi(url)
        ? { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => { throw new SyntaxError('Unexpected token <') } }
        : { ok: true, status: 200, text: async () => '��121.0.2277.112' })
    expect(await fetchVersion('beta')).toBe('121.0.2277.112')
})
