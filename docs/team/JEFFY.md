# Jeffy — interface

## Ownership

- Owner: Jeffy
- Branch: <code>feature/interface</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: lightweight user-facing input/output integration
- Owned directory: <code>src/interface/</code>

## Required Reading

Read AGENTS.md; all source-of-truth documents; scenario input contracts; AlgorithmExecutionEvent contracts; and final-result contracts.

## Responsibilities

Own generic user-facing scenario input/output, connection of UI to documented contracts, display of algorithm results and visualisation output, and integration of already-defined modules without transferring their responsibilities into the interface.

## Non-responsibilities

Do not implement CSP, Hill Climbing, energy calculations, duplicate problem modelling, duplicate visualisation logic, or create a separate AI architecture.

## Allowed Modifications

Normally modify only <code>src/interface/</code> and interface tests. Do not modify visualisation or algorithm modules/contracts without explicit coordination.

## Cross-module Rules

The project is AI/algorithm-first. The interface is only for demonstrating algorithm execution and visualisation output; it must consume contracts rather than own logic.

## Contracts

Consume Scenario input, AlgorithmExecutionEvent, visualisation output, and FinalResult contracts. Provide no duplicate AI model or algorithm contract.

## Testing Requirements

Test generic input mapping and result/event presentation boundaries without embedding AI logic or building-category assumptions.

## Integration Requirements

Connect documented module outputs without moving scenario, CSP, energy, optimisation, or visualisation responsibilities into the interface.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/interface</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit, for example <code>feat(interface): implement algorithm input output</code>.
6. Push and create <code>feature/interface → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation/contracts. Preserve contracts, remain in interface, avoid algorithm duplication, dependencies, folder changes, and hard-coded building categories. Request clarification rather than inventing a design.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/JEFFY.md. You are Jeffy on feature/interface and own src/interface/. Implement only lightweight generic scenario input/output and contract-based presentation of results and visualisation output. Do not touch problem modelling, CSP, energy, optimisation, visualisation ownership, folder structure, dependencies, or architecture. Do not put AI logic in the interface. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
