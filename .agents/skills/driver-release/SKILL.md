---
name: driver-release
description: >-
  Release edgedriver, geckodriver or safaridriver to npm with the "Manual NPM
  Publish" workflow, and follow up in webdriverio. Use when picking a release
  type, preparing or checking a release, or when a fix must reach WebdriverIO 9.
metadata:
  internal: true
---

# Release a driver package

The workflow ([release.yml](../../../.github/workflows/release.yml)) runs
release-it per package: it bumps `package.json`, publishes with npm trusted
publishing (OIDC), commits the bump to `main` as `wdio-bot`, tags
`<driver>@<version>`, and creates the GitHub release. Publishing from a laptop
with `npm publish` bypasses provenance; release through the workflow only.

## 1. Pick the release type

WebdriverIO's `@wdio/utils` pins one driver major per WebdriverIO major (the
table under [Compatibility](../../../README.md#compatibility)). A new driver
major reaches WebdriverIO users only after webdriverio widens that range.

| The change | Type |
|---|---|
| Raises `engines`, narrows the `@wdio/logger` peer range, removes an export, option or env var | `major` |
| Adds an option, export or env var | `minor` |
| Fixes behavior | `patch` |

`@wdio/logger` stays a peer dependency: a second logger copy empties the
WebdriverIO log file.

## 2. Check before the run

- `main` is green on every CI job, including the push-only Node 22.19.0 row.
- Each `package.json` version equals `npm view <driver> version`. If not, a
  previous run published without pushing its bump; fix the versions in a PR
  first, or release-it computes a version that already exists.

## 3. Dry run, then release

1. Run the workflow with `dryRun: yes`, the chosen `releaseType`, and
   `driver: all` (only packages changed since their last tag) or one driver.
2. The `preflight` job must pass: it proves `WDIO_BOT_GITHUB_TOKEN` can push to
   `main`. In the release-it log, read the computed version of each package.
3. Run it again with `dryRun: no`.

## 4. Check after the run

For each released package:

- `npm view <driver>@<version> version engines peerDependencies`
- `git fetch --tags && git log -1 --format=%s <driver>@<version>` names the
  release commit, and that commit is on `main`.
- The GitHub release exists. A `feat!` commit puts a "BREAKING CHANGES" section
  in it: edit the text so a user can act on it.

## 5. Follow up in webdriverio (major only)

After the publish, open a webdriverio PR that moves the ranges in
`packages/wdio-utils/package.json` (all three drivers) and
`packages/wdio-browser-runner/package.json` (`geckodriver`) to the new major.
Before that PR, its CI cannot install a version that is not on npm.

## WebdriverIO 9 fixes

WebdriverIO 9 uses edgedriver and geckodriver 6.x / 7.x and safaridriver
1.x / 2.x. The workflow checks out `main` only, so a 6.x / 7.x release needs a
maintenance branch from the last `<driver>@6.*` / `@7.*` tag and a workflow
that releases that branch. Ask a maintainer before you create either.
