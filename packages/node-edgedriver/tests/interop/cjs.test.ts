import { test, expect } from 'vitest'

const { start, download, findEdgePath } = require('../..')

test('should work in CJS context', () => {
    expect(typeof start).toBe('function')
    expect(typeof download).toBe('function')
    expect(typeof findEdgePath).toBe('function')
})
