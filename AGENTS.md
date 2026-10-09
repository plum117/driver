# AGENTS.md

Entry point for coding agents in this repo. See [.agents/README.md](.agents/README.md)
for available skills — read a skill's `SKILL.md` when its description matches
the task, don't duplicate its rules here.

No tool-specific agent config is committed beside `.agents/` — permissions,
hooks, and other per-tool settings (e.g. `.claude/`) stay personal and local,
never added to this repo. A thin adapter file like `CLAUDE.md` is the one
exception: it only points here, it doesn't hold its own copy of these rules.

## Repo map

pnpm workspace, no lerna/nx. The three driver packages are independent —
no shared dependencies between them, no monorepo-wide version to keep in sync:

```
packages/node-edgedriver     Edge driver binary manager    → npm: edgedriver
packages/node-geckodriver    Firefox driver binary manager → npm: geckodriver
packages/node-safaridriver   Safari driver manager         → npm: safaridriver
packages/e2e                 real-browser e2e tests for all three
scripts/                     shared build helpers (e.g. copy-cjs-pkg.mjs)
```

Each driver package has its own `.release-it.json`, `package.json` version,
and `.npmignore`.

## Setup

Node from [`.nvmrc`](.nvmrc) (24), pnpm pinned in `package.json#packageManager`.

```sh
.agents/setup    # install + build, then stamp HEAD; re-run after HEAD moves
.agents/resume   # read-only: Node, pnpm, packages/node-*/dist and the stamp are current
```

`.agents/setup` runs `pnpm install --frozen-lockfile` and `pnpm run build`
(`tsc -b` per package + the CJS step in `scripts/copy-cjs-pkg.mjs`).

`src/` edits aren't visible to tests or `postinstall` until rebuilt — use
`pnpm run watch` (all packages) or `pnpm --filter <pkg> run watch` (one).

## Test selection

Don't default to `pnpm run checks:all` — it's lint + unit + e2e for every
package. Prefer the smallest proof:

| Change | Run |
|---|---|
| One driver package | `pnpm --filter <pkg> test` (that package's lint + unit) — `<pkg>` is the npm name (`edgedriver`, `geckodriver`, `safaridriver`, `e2e`), not the `packages/node-*` directory name |
| Root config, `scripts/`, or more than one package | `pnpm run test:lint`, then `pnpm test` |
| Driver launch / real browser behavior | `pnpm run test:e2e` — needs real Edge/Firefox/Safari installed; headless, on macOS/Linux/Windows in CI |

These runs keep the code healthy. To prove that a feature or fix works, follow
the [verify-driver](.agents/skills/verify-driver/SKILL.md) skill before you
call the work done.

Lint is oxlint ([`.oxlintrc.json`](.oxlintrc.json)), not eslint —
`@stylistic/eslint-plugin` is only pulled in as an oxlint plugin. Husky lints the
staged JS/TS files pre-commit and runs `pnpm test` pre-push; don't bypass
either with `--no-verify`.

## Do not hand-edit

| Path | Changed by |
|---|---|
| `packages/node-*/dist/` | `pnpm run build` |
| `pnpm-lock.yaml` | `pnpm install` / `pnpm update` |
| `version` in `packages/node-*/package.json` | the release workflow (release-it); a recovery PR may only set it back to the version npm already has, after a run published without pushing its bump |
| `packages/node-geckodriver/CHANGELOG.md` | nothing: frozen history; release notes live in GitHub releases |

## CI

[ci.yml](.github/workflows/ci.yml) runs lint, unit and e2e on macOS, Linux and
Windows. Pull requests run Node 24 only; the required checks are
`build (<os>, 24)` and EasyCLA. A push to `main` also runs Node 22.19.0 (the
`engines` floor), 22 and 26, so a floor break shows up only after the merge:
check that run.

## Releases

Manual, via the "Manual NPM Publish" workflow
([release.yml](.github/workflows/release.yml)), never on merge. Follow the
[driver-release](.agents/skills/driver-release/SKILL.md) skill.

## Working agreement

Commit messages, PR descriptions, code comments, and how to stage changes:
see the [concise-writing](.agents/skills/concise-writing/SKILL.md) skill —
same "why, not what" rule across all of it.
