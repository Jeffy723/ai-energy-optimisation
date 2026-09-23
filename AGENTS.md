# AI Agent Instructions

Before coding, read:

1. <code>docs/PROJECT_OVERVIEW.md</code>
2. <code>docs/ARCHITECTURE.md</code>
3. <code>docs/AI_DESIGN.md</code>
4. <code>docs/DATA_MODEL.md</code>
5. <code>docs/DEVELOPMENT_RULES.md</code>
6. <code>docs/CONTRIBUTING.md</code>
7. The applicable specification under <code>docs/team/</code>.

Treat the documentation, architecture, and existing TypeScript contracts as authoritative. Reuse contracts; do not create duplicate models. Do not independently redesign the architecture, create an alternative plan, or change another module's ownership unnecessarily.

Do not introduce ML, fuzzy logic, databases, backend/frontend frameworks, or unapproved technologies. Do not hard-code classroom, office, residential, or another building type. The system must remain generic.

If a contract or architecture decision is insufficient, stop and report the exact file and contract involved. Do not silently redesign it. Run relevant tests and type checks before reporting completion. Do not claim completion when required checks fail, and do not commit or push unless explicitly asked.

## AI pipeline

Scenario → Problem Modelling → CSP Representation → CSP Solver → Feasible Configuration → Energy Evaluation → Simple Hill Climbing → Optimised Configuration → Visualisation/Results

CSP and Hill Climbing are separate phases: CSP establishes feasibility; Hill Climbing searches among feasible configurations. Energy formulas belong to <code>energy/</code>. Visualisation consumes generated events and never recreates an algorithm.
