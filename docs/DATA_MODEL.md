# Data Model

This document defines implementation-independent shared contracts. It is not a database schema, does not select a storage technology, and does not prescribe programming-language types.

## Contract ownership

| Owner | Contract responsibility |
| --- | --- |
| <code>problem/</code> | Owns real-world scenario and domain information. |
| <code>csp/model/</code> | Owns solver-ready CSP variables, domains, assignments, and constraints. |
| <code>csp/solver/</code> | Produces CSP execution events. |
| <code>optimisation/hillClimbing/</code> | Controls Hill Climbing, requests energy/objective evaluation, decides accepted moves, and produces Hill Climbing execution events. |
| <code>energy/calculator/</code> | Owns all energy-consumption formulas and calculations. |
| <code>energy/objective/</code> | Evaluates the optimisation objective using energy calculations and provides objective values to Hill Climbing. |
| <code>visualisation/</code> | Consumes events and results; it does not recreate algorithm logic. |
| <code>interface/</code> | Collects input and presents results without owning AI logic. |

No module may duplicate another module's responsibilities.

## Generic scenario contract

The AI engine operates on a generic scenario regardless of building type. A building <code>type</code> is data only; it does not create a separate application mode or hard-coded residential, office, or classroom logic.

| Structure | Required concepts |
| --- | --- |
| Scenario | <code>id</code>, <code>name</code>, <code>building</code>, environmental/context information where needed, <code>constraints</code>, <code>objectiveConfiguration</code> |
| Building | <code>id</code>, <code>name</code>, <code>type</code>, <code>rooms</code> |
| Room | <code>id</code>, <code>name</code>, numeric <code>occupancy</code> (number of occupants), <code>devices</code> |
| Device | <code>id</code>, <code>type</code>, <code>ratedPower</code>, <code>operatingTime</code>, <code>availableStates</code>, and properties relevant to constraints |

Scenario constraints may include structured machine-readable semantics in
addition to their descriptions. Descriptions remain explanatory text and are
never evaluated as code. The CSP model adapter converts supported semantics
into solver-ready evaluators. For example, a generic occupancy/state rule can
identify target device IDs, an occupancy value, and either forbidden state IDs
or a required state ID. Constraints with unsupported or missing semantics must
be rejected by the adapter rather than treated as automatically satisfied.

<code>ratedPower</code> is expressed consistently in kW when used for energy calculation, and <code>operatingTime</code> in hours. Demonstration scenarios may be classified as <code>small</code>, <code>medium</code>, or <code>large</code> by problem size without changing this contract.

<code>availableStates</code> represents the possible operating states of a device and may become the domain of its corresponding CSP variable. For example only, a device may have <code>[state A, state B, state C]</code>; these labels are illustrative and are not fixed states.

<code>ratedPower</code> is the device's reference/rated power. The selected operating state may determine its effective power, so different states of the same device may have different energy consumption. The energy flow is: device state → effective power → operating time → energy consumption. <code>energy/calculator/</code> must use the effective power associated with the selected state and owns all formulas required to calculate it.

### Illustrative generic scenario

The following is a shape example only. Placeholder values are not fixed values, device assumptions, or experimental data.

~~~json
{
  "id": "scenario-id",
  "name": "Scenario name",
  "building": {
    "id": "building-id",
    "name": "Building name",
    "type": "any-building-type",
    "rooms": [
      {
        "id": "room-id",
        "name": "Room name",
        "occupancy": "<non-negative occupant count>",
        "devices": [
          {
            "id": "device-id",
            "type": "device-type",
            "ratedPower": "<kW value>",
            "operatingTime": "<hours value>",
            "availableStates": ["state-a", "state-b"],
            "properties": {}
          }
        ]
      }
    ]
  },
  "context": {},
  "constraints": ["domain-constraint-reference"],
  "objectiveConfiguration": {
    "objectiveId": "minimise-energy"
  }
}
~~~

## CSP contract

<code>problem/</code> holds real-world scenario/domain data and rules. <code>csp/model/</code> adapts that information into the solver-ready CSP below.

| Structure | Required concepts |
| --- | --- |
| CSP | <code>variables</code>, <code>domains</code>, <code>constraints</code>, and <code>initialAssignment</code> where applicable |
| Variable | <code>id</code>, <code>domain</code>, and related solver information |
| Domain | possible values for one variable |
| Constraint | <code>id</code>, <code>involvedVariables</code>, <code>description</code>, evaluation semantics, evaluation inputs, and evaluation result |
| Assignment | <code>variable</code>, <code>value</code> |

<code>initialAssignment</code> is optional because a solver may start with no assignments. Solver-ready constraints are distinct from the source domain rules held by <code>problem/</code>.

## Objective contract

An Objective contains:

- <code>id</code>
- <code>name</code>
- <code>direction</code> (for example, <code>minimise</code>)
- <code>evaluationBasis</code>
- energy-related objective information

It supports reducing energy consumption while preserving CSP feasibility. <code>energy/objective/</code> evaluates it using <code>energy/calculator/</code> and provides objective values to <code>optimisation/hillClimbing/</code>. Hill Climbing generates and evaluates candidate neighbours through these contracts, decides whether a neighbour is accepted, and must not implement or duplicate energy-consumption formulas.

Conceptual evaluation flow: Candidate configuration → <code>energy/objective/</code> → objective value → Hill Climbing decision.

## Constraint definition and evaluation

A solver-ready Constraint identifies its <code>id</code>, <code>involvedVariables</code>, human-readable <code>description</code>, evaluation semantics, evaluation inputs, and evaluation result. The data model defines the information required for evaluation; the concrete programming representation of the evaluator is decided during implementation.

- <code>constraintId</code>
- <code>status</code>: <code>satisfied</code>, <code>violated</code>, or <code>undecided</code>
- evaluated assignment or state
- <code>reason</code>, where applicable

<code>undecided</code> means the constraint cannot yet be fully evaluated because the relevant assignment is incomplete. A <code>violated</code> result must carry enough context for the solver to reject a branch and for visualisation to explain why.

## CSP execution-event contract

Every CSP event contains enough information for visualisation to reconstruct the solver's actual search process:

- <code>id</code>
- <code>type</code>
- <code>step</code>
- <code>depth</code>
- <code>variable</code>, where relevant
- <code>value</code>, where relevant
- assignment/state information
- constraint information, where relevant
- <code>reason</code>, where relevant

| Event type | Purpose |
| --- | --- |
| <code>VARIABLE_SELECTED</code> | Records the variable selected for assignment. |
| <code>VALUE_TRIED</code> | Records an attempted value for the selected variable. |
| <code>CONSTRAINT_CHECKED</code> | Records a constraint evaluation. |
| <code>CONSTRAINT_FAILED</code> | Records a violated constraint and why the current branch cannot continue. |
| <code>FORWARD_CHECK</code> | Records domain filtering after an assignment. |
| <code>BACKTRACK</code> | Records reversal from an invalid or exhausted branch. |
| <code>SOLUTION_FOUND</code> | Records a complete feasible assignment. |

### Illustrative CSP event

~~~json
{
  "id": "event-id",
  "type": "VALUE_TRIED",
  "step": 0,
  "depth": 0,
  "variable": "variable-id",
  "value": "candidate-value",
  "assignment": {},
  "constraint": null,
  "reason": "Illustrative event only"
}
~~~

### Illustrative backtrack event

~~~json
{
  "id": "event-id",
  "type": "BACKTRACK",
  "step": 0,
  "depth": 0,
  "variable": "variable-id",
  "value": "previous-value",
  "assignment": {},
  "constraint": {
    "id": "constraint-id",
    "status": "violated"
  },
  "reason": "No valid continuation for the current branch"
}
~~~

These events must be generated by <code>csp/solver/</code>. Visualisation consumes them and must not independently recreate CSP execution, branches, or backtracking.

## Hill Climbing event contract

Hill Climbing starts from a CSP-feasible configuration. CSP handles feasibility and constraints; Hill Climbing searches only among feasible configurations for improved objective values. It must not bypass CSP feasibility requirements.

Conceptual flow: Scenario → CSP formulation → CSP search → feasible configuration → Hill Climbing → neighbour generation → objective/energy evaluation → better neighbour? → accept move or stop.

Every optimisation event contains enough information to visualise actual search:

- <code>id</code>
- <code>type</code>
- <code>iteration</code>
- <code>currentState</code>
- <code>candidateState</code>, where relevant
- <code>currentObjective</code>
- <code>candidateObjective</code>, where relevant
- <code>decision</code> or <code>reason</code>, where relevant

| Event type | Purpose |
| --- | --- |
| <code>INITIAL_STATE</code> | Records the feasible configuration from which optimisation begins. |
| <code>NEIGHBOUR_EVALUATED</code> | Records evaluation of a candidate neighbour that satisfies the required feasibility conditions for optimisation. |
| <code>MOVE_ACCEPTED</code> | Records movement to a better neighbour. |
| <code>NO_BETTER_NEIGHBOUR</code> | Records that no evaluated neighbour improves the current state. |
| <code>OPTIMUM_FOUND</code> | Records that the search reached a local optimum under the defined neighbourhood and objective. It does not indicate a guaranteed global optimum. |

### Illustrative Hill Climbing event

~~~json
{
  "id": "event-id",
  "type": "NEIGHBOUR_EVALUATED",
  "iteration": 0,
  "currentState": {},
  "candidateState": {},
  "currentObjective": "<objective value>",
  "candidateObjective": "<objective value>",
  "decision": "Illustrative evaluation only"
}
~~~

These events must be generated by <code>optimisation/hillClimbing/</code>. Visualisation consumes them and must not recreate Hill Climbing.

Simple Hill Climbing does not guarantee that the final state is the global optimum of the entire search space.

## Energy-result contract

Energy is calculated generically:

<code>Energy (kWh) = Power (kW) × Operating Time (hours)</code>

<code>Energy Saved = Initial Energy - Optimised Energy</code>

<code>Percentage Saved = (Energy Saved / Initial Energy) × 100</code>

| Structure | Required concepts |
| --- | --- |
| EnergyMeasurement | <code>configuration</code>, <code>energy</code>, <code>unit</code> |
| EnergyComparison | <code>initialEnergy</code>, <code>optimisedEnergy</code>, <code>energySaved</code>, <code>percentageSaved</code> |

<code>Total Energy</code> is the sum of device energy consumption. The contract defines no specific device power values or claimed savings.

## Final-result contract

A final result contains:

- <code>scenario</code>
- <code>initialConfiguration</code>
- <code>feasibleConfiguration</code>
- <code>optimisedConfiguration</code>
- <code>initialEnergy</code>
- <code>optimisedEnergy</code>
- <code>energySaved</code>
- <code>percentageSaved</code>
- CSP statistics, where applicable
- Hill Climbing statistics, where applicable

### Illustrative final result

~~~json
{
  "scenario": "scenario-reference",
  "initialConfiguration": {},
  "feasibleConfiguration": {},
  "optimisedConfiguration": {},
  "initialEnergy": null,
  "optimisedEnergy": null,
  "energySaved": null,
  "percentageSaved": null,
  "cspStatistics": {},
  "hillClimbingStatistics": {}
}
~~~

This is a structural example only. <code>null</code> numeric fields intentionally make no claim about energy values or savings.
