# Contributing

Thanks for helping with `edgedriver`, `geckodriver` and `safaridriver`. These
packages download and start the browser drivers. A bug in the driver binary
itself belongs upstream: [EdgeWebDriver](https://github.com/MicrosoftEdge/EdgeWebDriver),
[geckodriver](https://github.com/mozilla/geckodriver), or Apple's
[Feedback Assistant](https://feedbackassistant.apple.com/) for `safaridriver`.

## Set up

1. Use the Node.js version in [`.nvmrc`](.nvmrc) (at least the root
   `package.json#engines`), and run `corepack enable` for the pinned pnpm.
2. Run `pnpm install`, then `pnpm run build`. Rebuild after each `src/` change:
   the tests and the bins load `packages/node-*/dist`.

## Test

[AGENTS.md](AGENTS.md#test-selection) lists which command fits which change.
The e2e tests (`pnpm run test:e2e`) start real browsers: Edge, Firefox and, on
macOS, Safari.

## Pull requests

- One topic per pull request. The title uses
  [Conventional Commits](https://www.conventionalcommits.org/) and becomes the
  squash commit and the release note.
- Pull request CI runs Node 24 on macOS, Linux and Windows. Sign the
  [EasyCLA](https://easycla.lfx.linuxfoundation.org/) when the bot asks.

## Branches and releases

`main` holds the driver majors that WebdriverIO 10 uses (see
[Compatibility](README.md#compatibility)). Members of the
`webdriverio/project-publishers` team release with the "Manual NPM Publish"
workflow; the [driver-release skill](.agents/skills/driver-release/SKILL.md)
has the steps.
