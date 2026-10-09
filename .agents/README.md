# Agent toolchain

Canonical policy lives in [`/AGENTS.md`](../AGENTS.md). This directory only
holds:

- [`setup`](setup) — install and build so this checkout matches CI. Re-runs
  after `HEAD` changes so a reused checkout does not keep stale `node_modules`
  or `packages/node-*/dist`.
- [`resume`](resume) — fail fast if Node, pnpm, `packages/node-*/dist`, or the
  setup stamp are missing or stale.
- [`skills/`](skills) — playbooks for coding agents. Read a skill's
  `SKILL.md` only when its description matches the task at hand. After a
  feature or bug fix, follow
  [`skills/verify-driver/SKILL.md`](skills/verify-driver/SKILL.md) before
  claiming the work is done.
