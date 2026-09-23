# AI-Based Smart Energy Optimisation

## Objective

This project develops an AI-based system for building energy management. It models a scenario as a Constraint Satisfaction Problem (CSP), finds feasible device configurations using CSP techniques, and applies Simple Hill Climbing to search for a lower-energy feasible configuration.

This is primarily an AI and algorithm implementation project. A lightweight interface may provide inputs and demonstrate algorithm behaviour, but it is not the main product.

## Techniques

- Constraint Satisfaction Problem (CSP)
- Backtracking Search
- Minimum Remaining Values (MRV)
- Degree Heuristic
- Least Constraining Value (LCV)
- Forward Checking
- Constraint Propagation
- Simple Hill Climbing
- Energy Consumption Calculation
- Search and algorithm-execution visualisation

## End-to-end flow

`User/Scenario Input → Problem Model → CSP Formulation → CSP Solver → Feasible Configuration → Hill Climbing → Energy Evaluation → Optimised Configuration → Visualisation/Results`

The CSP phase establishes feasibility. The hill-climbing phase improves energy use only among configurations that remain feasible.

## Sustainability alignment

The project is aligned with energy-efficiency and responsible energy-use objectives reflected in:

- SDG 7 — Affordable and Clean Energy
- SDG 11 — Sustainable Cities and Communities
- SDG 12 — Responsible Consumption and Production

It does not claim to directly achieve these Sustainable Development Goals.

## Scope

In scope are the problem model, CSP formulation and solver, search heuristics, feasible-configuration generation, Simple Hill Climbing, energy calculations, algorithm events, and lightweight presentation of genuine results.

Out of scope are a generic website or dashboard, CRUD-first application features, IoT hardware/control, database implementation, fabricated demonstrations, and production building automation. Interface work must support the AI implementation rather than replace it.
