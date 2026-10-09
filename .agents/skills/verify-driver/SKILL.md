---
name: verify-driver
description: >-
  Prove a driver package change the way a user hits it: a real download, the
  CLI, a WebdriverIO session, the packed tarball, or the Node.js floor. Use
  after a feature or bug fix, before claiming the work works, and when
  changing exports, types, engines, or dependencies. A unit test is not this
  proof.
metadata:
  internal: true
---

# Verify a driver change

A user installs `edgedriver`, `geckodriver` or `safaridriver` from npm, and
WebdriverIO's `@wdio/utils` calls `download()` and `start()`. Prove the change
on that same path. `pnpm test` (lint + unit) is the floor, not the proof.

## Doctor

```sh
.agents/resume   # read-only; non-zero means: run .agents/setup, then resume again
```

`e2e` and the bins load `packages/node-*/dist`, so rebuild after every `src/`
edit (`pnpm run build`).

## Pick the harness

Drive every row the change can reach.

| The change affects | Drive | Not the proof |
|---|---|---|
| Download, version lookup, CDN env vars, cache dir | The e2e file of that driver: `pnpm --filter e2e exec vitest run tests/<driver>.e2e.test.ts` | A unit test with mocked `fetch` |
| `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`, `setGlobalDispatcher` | `pnpm --filter e2e exec vitest run tests/proxy.e2e.test.ts` (a local CONNECT proxy records the tunnels) and `tests/globalDispatcher.test.ts` in each package | A unit test that checks the dispatcher |
| `start()` options or the CLI | The e2e "start ... manually" test, and the bin: `node packages/node-<driver>/bin/<driver>.js --port=4444`, then `curl localhost:4444/status` | Reading `parseParams` output |
| What WebdriverIO does with the driver (`wdio:*Options`, logging) | The e2e tests that call `remote()`, and `tests/logger.e2e.test.ts` | A `remote()` against a driver you started yourself, when the change is in the path `@wdio/utils` starts |
| `exports`, `types`, the CJS entry, `files` / `.npmignore`, `LICENSE` | In the package dir: `npm pack --dry-run`, `npx publint`, `npx @arethetypeswrong/cli --pack .`, and the CJS interop test in `pnpm --filter <driver> test` | A green build |
| A type or export that `@wdio/utils` imports | A webdriverio worktree with `overrides` in its `pnpm-workspace.yaml` on the packed tarballs. There: `pnpm run compile && pnpm run compile:all:core && pnpm -r --filter=@wdio/compiler run build -p @wdio/utils`, then `npx tsc -p packages/wdio-utils/tsconfig.json --noEmit` and `npx vitest --config vitest.config.ts --run packages/wdio-utils` | Type-checking this repo only |
| `engines`, a dependency major, the TS target | `pnpm test` and the e2e file again under Node 22.19.0 (the floor): put `dirname "$(npx -y node@22.19.0 -p process.execPath)"` first on `PATH` | A run on `.nvmrc` (24) only |

`attw` reports `FalseExportDefault` for `safaridriver`: `require()` of the
ESM build returns the namespace, which has `default`. A strict `node16` `.cts`
consumer type-checks; treat any other `attw` problem as real.

Real browsers: e2e needs Edge, Firefox (downloaded) and, on macOS, Safari.
If one is missing, record the command and the missing browser instead of
marking that row verified.

## Show that the test can fail

For a bug fix, run the new or changed test once without the fix (in a scratch
worktree, or with the fix reverted for one run). It must go red. Then run it
with the fix. Report both results.

## Report

List each row you drove: the command, the result, and the Node version.
