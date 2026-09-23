# Grace — visualisation

## Ownership

- Owner: Grace
- Branch: <code>feature/visualisation</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: event-consuming algorithm visualisation
- Owned directory: <code>src/visualisation/</code>

## Required Reading

Read AGENTS.md; all source-of-truth documents; <code>src/visualisation/events/contracts.ts</code>; and CSP, Hill Climbing, energy, and final-result contracts.

## Responsibilities

Consume execution events; reconstruct/display CSP assignments, depths, steps, failures, pruning, backtracking, and solution paths; display Hill Climbing states, objective values, and decisions; and provide visualisation data structures for the interface.

## Non-responsibilities

Do not implement search algorithms, energy calculations, UI/application flow, or redesign algorithm contracts.

## Allowed Modifications

Normally modify only <code>src/visualisation/</code> and visualisation tests. Do not modify interface, algorithm modules, or contracts without explicit coordination.

## Cross-module Rules

Visualisation consumes actual contracts/events and never recreates CSP or Hill Climbing. Missing event data requires coordination, not fabricated branches or results.

## Contracts

Consume AlgorithmExecutionEvent, CspExecutionEvent, HillClimbingExecutionEvent, and FinalResult. Provide visualisation-specific derived data only.

## Testing Requirements

Test event-to-view data, search-tree reconstruction, pruning/backtracking display, and absence of fabricated execution.

## Integration Requirements

Remain decoupled from algorithm implementations by consuming events only. The interface may present visualisation output but does not transfer visualisation ownership.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/visualisation</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit, for example <code>feat(visualisation): implement algorithm visualisation</code>.
6. Push and create <code>feature/visualisation → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation/contracts. Preserve event contracts, stay in visualisation, avoid algorithm duplicates, dependencies, folder changes, and hard-coded building categories. Request clarification rather than inventing a design.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/GRACE.md. You are Grace on feature/visualisation and own src/visualisation/. Implement only event-consuming visualisation and derived visualisation data using existing contracts. Do not touch CSP, energy, optimisation, problem modelling, interface, ownership, folder structure, dependencies, or architecture. Never fabricate execution. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
