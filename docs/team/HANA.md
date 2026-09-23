# Hana — energy

## Ownership

- Owner: Hana
- Branch: <code>feature/energy</code>
- Base branch: <code>main</code>
- PR target: <code>main</code>
- Primary responsibility: energy calculation and objective evaluation
- Owned directory: <code>src/energy/</code>

## Required Reading

Read AGENTS.md; all source-of-truth documents; scenario device-state contracts; CSP configuration contracts; and <code>src/energy/objective/contracts.ts</code>.

## Responsibilities

Own energy-consumption calculation, effective device-power/state evaluation, objective/energy evaluation, and energy comparisons under the documented contracts.

## Non-responsibilities

Do not implement CSP solving, scenario modelling, Hill Climbing, visualisation, or UI.

## Allowed Modifications

Normally modify only <code>src/energy/</code> and <code>tests/energy/</code>. Do not modify other modules or contracts without explicit coordination.

## Cross-module Rules

Optimisation must consume this module's evaluation contract. Do not move energy formulas into optimisation or invent cross-module models.

## Contracts

Provide EnergyMeasurement, EnergyComparison, and ObjectiveEvaluation. Consume scenario device-state and CSP configuration contracts.

## Testing Requirements

Test effective-power/state handling, energy/objective evaluation, and comparisons without concrete building-category assumptions.

## Integration Requirements

Return objective/energy values for feasible configurations; do not decide optimisation moves or implement search.

## Git Workflow

1. <code>git checkout main</code>
2. <code>git pull origin main</code>
3. <code>git checkout -b feature/energy</code>
4. Implement only assigned work; test; run <code>git status</code> and <code>git diff --check</code>.
5. Add relevant files only; commit, for example <code>feat(energy): implement energy objective evaluation</code>.
6. Push and create <code>feature/energy → main</code>. Never commit directly to <code>main</code>.

## Agent Rules

Read AGENTS.md first, then required documentation/contracts. Preserve contracts, stay in energy, avoid duplication, dependencies, folder changes, and hard-coded building categories. Request clarification rather than inventing a design.

## Copy-Paste Agent Prompt

Read AGENTS.md, all required documentation under docs/, and docs/team/HANA.md. You are Hana on feature/energy and own src/energy/. Implement only documented energy calculation and objective evaluation contracts, including selected-state effective power. Do not touch CSP, problem modelling, optimisation, visualisation, interface, ownership, folder structure, dependencies, or architecture. Stop and report any required contract change. Run relevant tests and type checks, summarise files changed, and do not commit or push unless explicitly requested.
