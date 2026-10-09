import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../vitest.config.base.mjs'

export default mergeConfig(baseConfig, defineConfig({
    test: {
        // a little below the measured coverage, so it can only go up
        coverage: { thresholds: { statements: 69, branches: 74, functions: 55, lines: 70 } },
    }
}))
