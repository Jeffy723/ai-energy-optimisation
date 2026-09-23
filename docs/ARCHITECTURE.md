# Architecture

## Modules

```text
src/
├── problem/
├── csp/
├── optimisation/
├── energy/
├── visualisation/
└── interface/
```

| Module | Responsibility |
| --- | --- |
| `problem/` | Represents buildings, rooms, devices, scenarios, domains, and constraints. It must not contain CSP-solving logic. |
| `csp/` | Holds the CSP representation and solving process, including backtracking and CSP heuristics. Generates execution events for visualisation. |
| `optimisation/` | Implements Simple Hill Climbing, generates neighbouring configurations, and evaluates candidates with the project objective function. |
| `energy/` | Calculates device and total energy use; compares initial and optimised configurations. |
| `visualisation/` | Displays actual algorithm execution from AI-module events/data. It must not independently implement CSP or Hill Climbing. |
| `interface/` | Provides lightweight input/output only. It must not contain AI algorithm logic. |

## Data flow

`Input → Problem Model → CSP → CSP Solver → Feasible Configuration → Hill Climbing → Energy Evaluation → Result → Visualisation`

## Execution events

The CSP solver should emit events such as:

- `VARIABLE_SELECTED`
- `VALUE_TRIED`
- `CONSTRAINT_CHECKED`
- `CONSTRAINT_FAILED`
- `FORWARD_CHECK`
- `BACKTRACK`
- `SOLUTION_FOUND`

Hill Climbing should emit events such as:

- `INITIAL_STATE`
- `NEIGHBOUR_EVALUATED`
- `MOVE_ACCEPTED`
- `NO_BETTER_NEIGHBOUR`
- `OPTIMUM_FOUND`

The visualisation consumes these events and associated state. It must never recreate the algorithms internally or invent their execution.

No additional architectural layers or frameworks are defined unless the team approves a future change.
