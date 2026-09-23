# Contributing

## Git workflow

The protected integration branch is `main`. Develop unfinished work on feature branches named `feature/<module-name>`, for example:

- `feature/problem-model`
- `feature/csp-engine`
- `feature/hill-climbing`
- `feature/visualisation`
- `feature/integration`

Before significant work, pull or rebase on the latest `main`. Make small, meaningful commits, push the feature branch to GitHub, and open a Pull Request for completed work. Review changes before merging. Do not merge code that breaks the architecture or tests, and do not develop unfinished work directly on `main`.

## Working with AI coding agents

Before starting, an AI coding agent must read, in order:

1. `PROJECT_OVERVIEW.md`
2. `ARCHITECTURE.md`
3. `AI_DESIGN.md`
4. `DATA_MODEL.md`
5. `DEVELOPMENT_RULES.md`
6. `CONTRIBUTING.md`

Then it must understand its assigned module, modify only required files, follow existing interfaces, run relevant tests, and report what changed. It must not silently redesign unrelated parts.

## Standard teammate prompt

> Read all files under `docs/` before making changes. Treat them as the source of truth. Work only on the assigned module. Do not change the architecture, data contracts, dependencies, or responsibilities of other modules unless explicitly instructed.
