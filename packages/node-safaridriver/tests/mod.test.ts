import cp from 'node:child_process'
import fs from 'node:fs'
import { expect, test, vi, beforeEach } from 'vitest'
import safaridriver from '../src/index.js'

vi.mock('node:child_process', () => ({
    default: {
        // fresh mock per call, so each test's process handle has its own
        // independent kill() call count rather than sharing one across the file
        // records `once` listeners so a test can play the process ending
        spawn: vi.fn().mockImplementation(() => {
            const listeners: Record<string, () => void> = {}
            const listen = vi.fn((event: string, cb: () => void) => { listeners[event] = cb })
            return { kill: vi.fn(), once: listen, on: listen, listeners }
        })
    }
}))

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true)
    }
}))

beforeEach(() => {
    vi.mocked(cp.spawn).mockClear()
})

test('can start driver with default values', () => {
    safaridriver.start()
    expect(cp.spawn).toBeCalledWith(
        '/usr/bin/safaridriver',
        ['--port=4444'],
        {}
    )
    safaridriver.stop()
})

test('can start STP driver with default values', () => {
    safaridriver.start({ useTechnologyPreview: true })
    expect(cp.spawn).toBeCalledWith(
        '/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver',
        ['--port=4444'],
        {}
    )
    safaridriver.stop()
})

test('throws if start is called twice', () => {
    safaridriver.start()
    expect(() => safaridriver.start()).toThrow()
    safaridriver.stop()
})

test('throws if STP is not installed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(() => safaridriver.start({ useTechnologyPreview: true })).toThrow(/not installed/)
    safaridriver.stop()
})

test('can start with options', () => {
    safaridriver.start({
        port: 1234,
        path: '/foo/bar',
        enable: true,
        diagnose: true
    })
    expect(cp.spawn).toBeCalledWith('/foo/bar', [
        '--port=1234',
        '--enable',
        '--diagnose'
    ], {})
    safaridriver.stop()
})

test('can stop server', () => {
    const instance = safaridriver.start()
    safaridriver.stop()
    expect(instance.kill).toBeCalledTimes(1)
})

test('forgets the instance once the driver exits, so start works again', () => {
    const first = safaridriver.start() as unknown as { listeners: Record<string, () => void> }
    first.listeners.exit()
    expect(() => safaridriver.start()).not.toThrow()
    safaridriver.stop()
})

test('an old instance ending does not forget the running one', () => {
    const first = safaridriver.start() as unknown as { listeners: Record<string, () => void> }
    safaridriver.stop()
    safaridriver.start()
    first.listeners.close()
    expect(() => safaridriver.start()).toThrow(/on port 4444!/)
    safaridriver.stop()
})
