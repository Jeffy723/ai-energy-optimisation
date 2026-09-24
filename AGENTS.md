# AI Agent Instructions

Before coding, read:

1. <code>docs/PROJECT_OVERVIEW.md</code>
2. <code>docs/ARCHITECTURE.md</code>
3. <code>docs/AI_DESIGN.md</code>
4. <code>docs/DATA_MODEL.md</code>
5. <code>docs/DEVELOPMENT_RULES.md</code>
6. <code>docs/CONTRIBUTING.md</code>

## Development workflow

- <code>main</code> is currently the primary development branch. Work directly on <code>main</code> unless explicitly instructed otherwise.
- Do not create branches unless explicitly requested. A branch may be created for a specific independent task when instructed.
- Module ownership means architectural responsibility, not Git branch ownership. Do not modify unrelated modules without explicit instruction.
- Preserve the documented architecture and existing TypeScript contracts. Reuse contracts; do not create duplicate models or invent an alternative architecture.
- Make focused commits after meaningful completed stages when committing is within the task instructions. Keep Git history clean and understandable.

Treat the documentation, architecture, and existing TypeScript contracts as authoritative. Do not independently redesign the architecture or create an alternative plan.

Do not introduce ML, fuzzy logic, databases, backend/frontend frameworks, or unapproved technologies. Do not hard-code classroom, office, residential, or another building type. The system must remain generic.

If a contract or architecture decision is insufficient, stop and report the exact file and contract involved. Do not silently redesign it. Run relevant tests and type checks before reporting completion. Do not claim completion when required checks fail, and do not commit or push unless explicitly asked.

## AI pipeline

Scenario → Problem Modelling → CSP Representation → CSP Solver → Feasible Configuration → Energy Evaluation → Simple Hill Climbing → Optimised Configuration → Visualisation/Results

CSP and Hill Climbing are separate phases: CSP establishes feasibility; Hill Climbing searches among feasible configurations. Energy formulas belong to <code>energy/</code>. Visualisation consumes generated events and never recreates an algorithm.
