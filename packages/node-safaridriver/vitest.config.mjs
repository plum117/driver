import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../vitest.config.base.mjs'

export default mergeConfig(baseConfig, defineConfig({
    test: {
        exclude: [
            /**
             * this is a plain Node script (run via the `test:interop` script),
             * not a vitest test
             */
            'tests/interop/**',
        ],
        // a little below the measured coverage, so it can only go up
        coverage: { thresholds: { statements: 72, branches: 95, functions: 48, lines: 72 } },
    }
}))
