# Gouri — problem

## Ownership

- Owner: Gouri
- Branch: <code>feature/problem</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: generic scenario and domain modelling
- Owned directory: <code>src/problem/</code>

## Required Reading

Read <code>AGENTS.md</code>; all six source-of-truth documents; <code>src/problem/scenario/contracts.ts</code>; and dependent CSP model contracts before adapting scenario data.

## Responsibilities

Own generic scenario input, building/zone/device modelling, scenario facts, domain-specific rules, scenario-originating constraints, and adaptation of generic scenario information toward the documented CSP-ready representation.

## Non-responsibilities

Do not implement CSP search, Backtracking, heuristics, pruning, energy calculations, Hill Climbing, visualisation, or UI.

## Allowed Modifications

Normally modify only <code>src/problem/</code> and <code>tests/problem/</code>. Do not modify other modules or contracts without explicit coordination.

## Cross-module Rules

Respect existing contracts. If adaptation needs a cross-module contract change, identify it and coordinate; do not invent a duplicate representation.

## Contracts

Provide Scenario, Building, Room, Device, DeviceOperatingState, ScenarioConstraint, and ObjectiveConfiguration data. Consume CSP-model contracts only at the documented adaptation boundary.

## Testing Requirements

Test generic scenario handling, validation, constraints, and contract compatibility without hard-coded building categories.

## Integration Requirements

Supply generic domain data to CSP; do not implement solver-ready search or another module's responsibility.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/problem</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit with an appropriate conventional commit, such as <code>feat(problem): implement scenario modelling</code>.
6. Push the branch and create <code>feature/problem → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation and contracts. Stay in this module, preserve contracts, avoid duplicate implementations, folder changes, dependencies, and hard-coded building categories. Keep input generic. Ask for clarification when requirements conflict.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/GOURI.md. You are Gouri on feature/problem and own src/problem/. Implement only generic scenario/domain modelling and reuse existing scenario and CSP-boundary contracts. Do not touch CSP search, energy, optimisation, visualisation, interface, other ownership, folder structure, dependencies, or architecture. Keep arbitrary building/scenario input generic. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
