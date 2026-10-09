# WebdriverIO Browser Drivers Monorepo

This monorepo contains Node.js wrappers for managing browser driver binaries ([Geckodriver](https://github.com/webdriverio/driver/blob/main/packages/node-geckodriver/README.md), [Edgedriver](https://github.com/webdriverio/driver/blob/main/packages/node-edgedriver/README.md), and [Safaridriver](https://github.com/webdriverio/driver/blob/main/packages/node-safaridriver/README.md)). These packages facilitate downloading, starting, and managing driver server processes for [WebdriverIO](https://webdriver.io) and other test automation frameworks.

---

## Packages

| Package | Browser | Description | NPM Link |
| --- | --- | --- | --- |
| `geckodriver` | Firefox | Wrapper for Mozilla's Geckodriver | [![npm](https://img.shields.io/npm/v/geckodriver.svg)](https://www.npmjs.com/package/geckodriver) |
| `edgedriver` | Microsoft Edge | Wrapper for Microsoft Edge Driver | [![npm](https://img.shields.io/npm/v/edgedriver.svg)](https://www.npmjs.com/package/edgedriver) |
| `safaridriver` | Safari | Wrapper for macOS `safaridriver` binary | [![npm](https://img.shields.io/npm/v/safaridriver.svg)](https://www.npmjs.com/package/safaridriver) |

---

## Compatibility

WebdriverIO installs the driver packages it needs through `@wdio/utils`. If you only use WebdriverIO, you do not install them yourself.

| WebdriverIO | `geckodriver` | `edgedriver` | `safaridriver` | Node.js | `@wdio/logger` |
| --- | --- | --- | --- | --- | --- |
| 10 | 8.x | 8.x | 3.x | 22.19.0 or newer | 10, peer dependency |
| 9 | 6.x or 7.x | 6.x or 7.x | 1.x or 2.x | 20 or newer (`safaridriver`: 18) | 9, dependency |

From geckodriver 8 and edgedriver 8, `@wdio/logger` is a peer dependency, so the drivers use the logger of your WebdriverIO install. A second copy of the logger empties the WebdriverIO log file (`outputDir`).

### Upgrading to geckodriver 8, edgedriver 8 and safaridriver 3

- Use Node.js 22.19.0 or newer.
- If you use `geckodriver` or `edgedriver` without WebdriverIO and install with Yarn, add `@wdio/logger` to your dependencies. npm and pnpm install it for you.
- `geckodriver` no longer reads `GECKODRIVER_FILEPATH`. Use `GECKODRIVER_PATH`.
- `require()` now returns every export of the package, for example `findEdgePath` from `edgedriver`, with CommonJS types.
- With `require('safaridriver')`, `start()` returns the `ChildProcess` and `stop()` returns nothing, as in ESM: before, both returned a Promise. `await start()` still works; `start().then(...)` does not.
- `HTTPS_PROXY` and `HTTP_PROXY` now apply to downloads; 6.x and 7.x ignored them. If a proxy is set in your environment but the CDN must be reached directly, add its host to `NO_PROXY`.
- `edgedriver`'s `start()` resolves to a `ChildProcess` (it was typed `ChildProcessWithoutNullStreams`): its `stdout` and `stderr` are `null` when you pass `spawnOpts: { stdio: 'ignore' }`.
- `safaridriver` now pipes the driver output like the other drivers: read `stdout` and `stderr`, or pass `spawnOpts: { stdio: 'ignore' }`. Before, the output was buffered and the driver was killed after 1 MB of it.
- The `edgedriver` and `geckodriver` CLIs exit with code 1 when a signal kills the driver; they exited with 0.
- `findEdgePath()` on Windows returns `undefined` when Edge is not installed, as on macOS and Linux; it threw.
- `spawnOpts` is a new option of `edgedriver` and `safaridriver`. The rest of the API, the CLI and the options did not change.

---

## Installation

Install the driver package needed for your target browser:

```bash
# Firefox
npm install geckodriver --save-dev

# Microsoft Edge
npm install edgedriver --save-dev

# Safari (macOS only)
npm install safaridriver --save-dev

```

---

## CLI Usage

Drivers can be executed directly using `npx`:

```bash
# Start Geckodriver
npx geckodriver --port=4444

# Start Edgedriver
npx edgedriver --port=4444

# Start Safaridriver (macOS)
npx safaridriver --port=4444

```

### Environment Variables & Global Installation Setup

#### Auto-Installation Flags

By default, binaries download when initialized via CLI or API. To download them during `npm install`, pass the respective flag:

* **Geckodriver:** `GECKODRIVER_AUTO_INSTALL=1 npm i`
* **Edgedriver:** `EDGEDRIVER_AUTO_INSTALL=1 npm i`

#### Version Pinning & Custom Sources

* **Custom Driver Version:**
* `GECKODRIVER_VERSION="0.31.0"`
* `EDGEDRIVER_VERSION="114.0.1823.18"`


* **Custom CDN URL:**
* `GECKODRIVER_CDNURL=https://INTERNAL_CDN/geckodriver/download`
* `EDGEDRIVER_CDNURL=https://INTERNAL_CDN/edgedriver/download`


* **CDN credentials:** a CDN URL can carry them, for example `https://user:password@INTERNAL_CDN`. They are sent as a Basic `Authorization` header and kept out of the logs; percent-encode special characters (`@` is `%40`). Use `https://`: over `http://`, Basic credentials travel in clear text. A redirect to another host does not receive them.

* **HTTP/HTTPS Proxy:** `HTTPS_PROXY` and `HTTP_PROXY` apply to downloads, and `NO_PROXY` lists the hosts that skip the proxy. The lower-case forms work too and win over the upper-case ones.

#### Windows Setup (`selenium-webdriver` note)

When installing `geckodriver` or `edgedriver` globally on Windows, `selenium-webdriver` expects the `.exe` extension in PATH. You can create a symlink in your global npm binary directory:

```cmd
mklink %USERPROFILE%\AppData\Roaming\npm\geckodriver.exe %USERPROFILE%\AppData\Roaming\npm\node_modules\geckodriver\geckodriver.exe

```

---

## Programmatic Usage

All driver packages export methods to programmatically control browser driver instances within Node.js scripts.

### ESM Example (`geckodriver` / `edgedriver`)

```typescript
import { start } from 'geckodriver'; // or 'edgedriver'
import { remote } from 'webdriverio';
import waitPort from 'wait-port';

// 1. Start driver process
const cp = await start({ port: 4444 });

// 2. Wait for driver port to open
await waitPort({ port: 4444 });

// 3. Connect WebdriverIO session
const browser = await remote({
  capabilities: {
    browserName: 'firefox' // or 'MicrosoftEdge'
  }
});

await browser.url('https://webdriver.io');
console.log(await browser.getTitle());

// 4. Terminate process when finished
cp.kill();

```

### ESM Example (`safaridriver`)

```typescript
import safaridriver from 'safaridriver';
import { remote } from 'webdriverio';

// 1. Start Safaridriver server
safaridriver.start({ port: 4444 });

// 2. Connect WebdriverIO session
const browser = await remote({
  capabilities: {
    browserName: 'safari'
  }
});

await browser.url('https://webdriver.io');
console.log(await browser.getTitle());

// 3. Stop Safaridriver process
safaridriver.stop();

```

---

## Configuration & Options

### Options for `geckodriver`

Passed into the `start(options)` method:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | — | Port to listen on. |
| `host` | `string` | `0.0.0.0` | Host IP address to bind server. |
| `customGeckoDriverPath` | `string` | `process.env.GECKODRIVER_PATH` | Path to custom/cached driver binary. |
| `cacheDir` | `string` | `process.env.GECKODRIVER_CACHE_DIR \|\| os.tmpdir()` | Root directory for caching downloaded binaries. |
| `spawnOpts` | `object` | `undefined` | Spawn options passed directly to Node.js `child_process.spawn`. |
| `allowHosts` | `string[]` | `[]` | List of explicit host names allowed to connect. |
| `allowOrigins` | `string[]` | `[]` | List of allowed request origins (`scheme://host:port`). |

See the [geckodriver README](packages/node-geckodriver/README.md) for the full list of options.

### Options for `edgedriver`

Passed into the `start(options)` method:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | — | Port to listen on. |
| `customEdgeDriverPath` | `string` | `process.env.EDGEDRIVER_PATH` | Path to custom/cached driver binary. |
| `cacheDir` | `string` | `process.env.EDGEDRIVER_CACHE_DIR \|\| os.tmpdir()` | Root directory for caching downloaded binaries. |
| `allowedIps` | `string[]` | `['']` | List of remote IP addresses allowed to connect. |
| `allowedOrigins` | `string[]` | `['*']` | List of allowed request origins. Using `*` to allow any origin is dangerous! |
| `spawnOpts` | `object` | `undefined` | Spawn options passed directly to Node.js `child_process.spawn`, e.g. `{ stdio: 'ignore' }` if you don't read the driver output. |

See the [edgedriver README](packages/node-edgedriver/README.md) for the full list of options.

### Options for `safaridriver`

Passed into `safaridriver.start(options)`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | `4444` | Port for HTTP server listening. |
| `path` | `string` | `/usr/bin/safaridriver` | Path to system `safaridriver` binary. |
| `useTechnologyPreview` | `boolean` | `false` | Enables Safari Technology Preview driver binary. |
| `enable` | `boolean` | `false` | Configures macOS permissions ("Enable Remote Automation") and exits immediately. |
| `diagnose` | `boolean` | `false` | Enables diagnostic log output for driver sessions. |
| `spawnOpts` | `object` | `undefined` | Spawn options passed directly to Node.js `child_process.spawn`, e.g. `{ stdio: 'ignore' }` if you don't read the driver output. |

See the [safaridriver README](packages/node-safaridriver/README.md) for more details.

---

## License

[MIT](LICENSE)
