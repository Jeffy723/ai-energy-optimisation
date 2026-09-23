# Data Model

These are interface-independent conceptual contracts, not a database schema. Concrete types, storage, and serialisation remain undecided until approved.

## Core scenario structures

| Structure | Required concepts |
| --- | --- |
| Building | `id`, `name`, `rooms` |
| Room | `id`, `name`, `occupancy`, `devices` |
| Device | `id`, `type`, `power`, `state`, `operatingTime`, `relevantConstraints` |
| Scenario | building/room information, occupancy, environmental and user requirements, device requirements |

`power` must be expressed consistently in kW when used by the stated energy formula, and `operatingTime` consistently in hours.

## CSP representation

A CSP contract contains:

- `variables`
- `domains`
- `constraints`
- `assignments`

Variables and values must identify their related problem-model entities clearly. Constraints must define the rule they evaluate and provide enough context to explain a pass or failure.

## Solver event

Each solver event contains an `eventType`, relevant `variable` and `value` where applicable, a state or assignment snapshot/reference, constraint/result information where applicable, and `searchDepth` and/or `step` where useful. CSP event types follow [ARCHITECTURE.md](ARCHITECTURE.md).

## Hill Climbing state

Each state records `configuration`, `energy`, `objectiveValue`, and `iteration`; it also records the `selectedNeighbour` where applicable. Optimisation events follow [ARCHITECTURE.md](ARCHITECTURE.md).

## Final result

A final result contains:

- `initialConfiguration`
- `optimisedConfiguration`
- `initialEnergy`
- `optimisedEnergy`
- `energySaved`
- `percentageSaved`
- `algorithmStatistics`

All modules must preserve these common meanings. This document intentionally introduces no MongoDB, PostgreSQL, Supabase, or other database commitment.
