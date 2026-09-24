# Contributing

## Git workflow

The primary development branch is currently `main`. Work directly on `main` unless explicitly instructed otherwise; do not create a branch unless requested. Module names describe architectural responsibilities and do not imply Git ownership or a dedicated branch. A branch can be created for a specific independent task when needed.

Before significant work, check `git status` and review the current changes. Keep changes focused, run relevant tests, and review `git diff` and `git diff --check`. Make meaningful commits after completed stages when committing is requested or part of the task. Keep Git history clean and understandable, and avoid unrelated changes. Do not push unless asked. If a task specifically calls for a branch and pull request, follow those task-specific instructions.

## Working with AI coding agents

Before starting, an AI coding agent must read, in order:

1. `PROJECT_OVERVIEW.md`
2. `ARCHITECTURE.md`
3. `AI_DESIGN.md`
4. `DATA_MODEL.md`
5. `DEVELOPMENT_RULES.md`
6. `CONTRIBUTING.md`

Then it must understand its assigned module, modify only required files, follow existing interfaces, run relevant tests, and report what changed. It must not silently redesign unrelated parts. Scenario examples are generic and size-based (`small`, `medium`, `large`); a building type is input data, not a separate application mode.

## Standard agent prompt

> Read the project instructions and required documentation before making changes. Treat them as the source of truth. Work within the requested scope and preserve the architecture, data contracts, and responsibilities of other modules. Do not create branches unless explicitly instructed. Treat building types as generic scenario input, and ensure any visualisation uses actual algorithm events and data.
