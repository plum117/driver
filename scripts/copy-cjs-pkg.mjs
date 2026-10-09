import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

copyFileSync('src/cjs/package.json', 'dist/cjs/package.json')

/**
 * dist/cjs/index.js re-exports the ESM build, so it gets the ESM declarations;
 * copied under dist/cjs, TypeScript reads them as CommonJS for `require`
 */
for (const file of readdirSync('dist').filter((f) => f.endsWith('.d.ts'))) {
    const dts = readFileSync(`dist/${file}`, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/, '\n')
    writeFileSync(`dist/cjs/${file}`, dts)
}
rmSync('dist/cjs/index.d.ts.map', { force: true })
