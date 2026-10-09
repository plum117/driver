import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../vitest.config.base.mjs'

export default mergeConfig(baseConfig, defineConfig({
    test: {
        // a little below the measured coverage, so it can only go up
        coverage: { thresholds: { statements: 42, branches: 55, functions: 28, lines: 44 } },
    }
}))
