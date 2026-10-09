import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../vitest.config.base.mjs'

export default mergeConfig(baseConfig, defineConfig({
    test: {
        // a little below the lowest OS (Windows skips the Linux finder and Unix version tests),
        // so it can only go up
        coverage: { thresholds: { statements: 42, branches: 52, functions: 28, lines: 44 } },
    }
}))
