# AI Design

## CSP model

A CSP contains:

- **Variables:** decisions about device states, operating times, or other configurable scenario attributes.
- **Domains:** permitted values for each variable.
- **Constraints:** rules that combinations of assignments must satisfy.
- **Assignment:** the current mapping of variables to chosen values.
- **Feasible solution:** a complete assignment satisfying all constraints.

## CSP search

Backtracking assigns a value, checks applicable constraints, continues when valid, and backtracks when a branch becomes invalid.

- **MRV:** choose the unassigned variable with the smallest remaining valid domain.
- **Degree Heuristic:** when appropriate, prefer the variable constrained by the most other unassigned variables.
- **LCV:** try values in the order that restricts neighbouring variables the least.
- **Forward Checking:** after assignment, remove inconsistent values from neighbouring domains.
- **Constraint Propagation:** propagate constraints through related variables to identify impossible states early.

## Optimisation

Simple Hill Climbing begins with a feasible configuration, generates feasible neighbouring configurations, evaluates their energy/objective values, moves to a better neighbour, and stops when no better neighbour is available. The `optimisation/` module must use `energy/` for energy-consumption and energy-objective evaluation; it must not duplicate energy-consumption calculations or formulas.

## Energy objective

`Energy (kWh) = Power (kW) × Operating Time (hours)`

`Total Energy = sum of device energy consumption`

`Energy Saved = Initial Energy - Optimised Energy`

`Percentage Saved = (Energy Saved / Initial Energy) × 100`

CSP is responsible for feasibility and constraint satisfaction. Hill Climbing is responsible for optimisation among feasible configurations. The exact objective function, variables, domains, and constraints must be defined consistently in [DATA_MODEL.md](DATA_MODEL.md) before implementation. No device power values or experimental results are assumed or fabricated here.
