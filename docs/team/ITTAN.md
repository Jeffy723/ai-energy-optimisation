# Ittan — optimisation

## Ownership

- Owner: Ittan
- Branch: <code>feature/optimisation</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: Simple Hill Climbing optimisation
- Owned directory: <code>src/optimisation/</code>

## Required Reading

Read AGENTS.md; all source-of-truth documents; CSP feasible-solution contracts; energy/objective contracts; Hill Climbing contracts; and event contracts.

## Responsibilities

Own Simple Hill Climbing, CSP-feasible starting-state handling, neighbour generation, candidate evaluation through energy/objective contracts, accepted/rejected moves, local-optimum detection, and Hill Climbing events.

## Non-responsibilities

Do not reimplement energy formulas, CSP solving, scenario modelling, visualisation rendering, or UI.

## Allowed Modifications

Normally modify only <code>src/optimisation/</code> and <code>tests/optimisation/</code>. Do not modify other modules or contracts without explicit coordination.

## Cross-module Rules

Start only from a CSP-feasible configuration. Consume energy/objective results; do not bypass feasibility or duplicate energy calculations.

## Contracts

Consume CspFeasibleSolution, ObjectiveEvaluation, EnergyComparison, and shared events. Provide HillClimbingState, HillClimbingResult, FinalResult, and Hill Climbing events.

## Testing Requirements

Test feasibility preservation, neighbour generation, accepted/rejected moves, local termination, and generated event correctness.

## Integration Requirements

Preserve CSP → feasible configuration → Hill Climbing → improved configuration. A local optimum is not a guaranteed global optimum.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/optimisation</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit, for example <code>feat(optimisation): implement hill climbing</code>.
6. Push and create <code>feature/optimisation → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation/contracts. Preserve contracts, remain in optimisation, avoid duplicates, dependencies, folder changes, and hard-coded building categories. Request clarification rather than inventing a design.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/ITTAN.md. You are Ittan on feature/optimisation and own src/optimisation/. Implement only documented Simple Hill Climbing, beginning with CSP-feasible configurations and consuming energy/objective contracts. Do not touch CSP, problem modelling, energy formulas, visualisation, interface, ownership, folder structure, dependencies, or architecture. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
