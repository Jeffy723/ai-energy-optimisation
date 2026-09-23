# Harishankar — csp

## Ownership

- Owner: Harishankar
- Branch: <code>feature/csp</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: solver-ready CSP representation, search, heuristics, and CSP events
- Owned directory: <code>src/csp/</code>

## Required Reading

Read AGENTS.md; all source-of-truth documents; <code>src/csp/model/contracts.ts</code>; <code>src/csp/solver/contracts.ts</code>; and <code>src/visualisation/events/contracts.ts</code>.

## Responsibilities

Own CSP variables, domains, assignments, documented constraints, CSP solving, Backtracking, MRV, Degree Heuristic, LCV, Forward Checking, Constraint Propagation, and genuine CSP execution events.

## Non-responsibilities

Do not implement scenario modelling, energy calculation, Hill Climbing, UI, or visualisation rendering.

## Allowed Modifications

Normally modify only <code>src/csp/</code> and <code>tests/csp/</code>. Do not modify contracts or another module without explicit coordination.

## Cross-module Rules

Consume problem data through contracts and emit the existing event contract for visualisation. Do not invent new shared models when a boundary is missing.

## Contracts

Provide CspProblem, feasible solutions, search results/statistics, and generated CspExecutionEvent values. Consume scenario contracts and retain contract-defined constraint semantics.

## Testing Requirements

Test feasibility, constraints, Backtracking, all applicable heuristics, pruning, and generated event accuracy.

## Integration Requirements

Produce a feasible configuration for optimisation and actual events for visualisation; do not evaluate energy or render UI.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/csp</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit, for example <code>feat(csp): implement CSP solver</code>.
6. Push and create <code>feature/csp → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation/contracts. Preserve contracts and ownership; avoid duplicates, folder changes, dependencies, and alternative architecture. Keep inputs generic and request clarification rather than inventing a design.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/HARISHANKAR.md. You are Harishankar on feature/csp and own src/csp/. Implement only documented CSP representation, search, heuristics, and genuine CSP events using existing contracts. Do not touch problem modelling, energy, optimisation, visualisation rendering, interface, ownership, folder structure, dependencies, or architecture. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
