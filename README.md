# ai-energy-optimisation

AI-based building energy optimisation using Constraint Satisfaction Problem (CSP) techniques and Simple Hill Climbing.

## Overview

This project demonstrates an AI-based approach to building energy optimisation.

The system models rooms and devices as a Constraint Satisfaction Problem (CSP). The CSP solver searches for a feasible device configuration while applying constraints and CSP variable-ordering heuristics.

Once a feasible configuration is obtained, Simple Hill Climbing searches neighbouring feasible configurations for a configuration with lower energy consumption.

The system also provides an execution visualisation of the CSP search process, including explored branches, constraint failures, backtracking, heuristic decisions, and the final feasible solution.

Simple Hill Climbing reports a local optimum; it does not claim global optimality.

## AI Techniques

The project focuses on the following AI techniques:

- Constraint Satisfaction Problems (CSP)
- Backtracking search
- Constraint checking
- MRV (Minimum Remaining Values)
- Degree heuristic
- LCV (Least Constraining Value)
- Forward checking / constraint propagation where supported by the implementation
- Simple Hill Climbing
- Neighbour evaluation
- Local optimum detection

## Optimisation Pipeline

The system follows this general pipeline:

```text
User Scenario
      ↓
Scenario Validation
      ↓
CSP Model Construction
      ↓
Variable Ordering
      ↓
MRV
      ↓
Degree Heuristic
      ↓
LCV
      ↓
Backtracking Search
      ↓
Constraint Checking
      ↓
Feasible Configuration
      ↓
Energy Evaluation
      ↓
Simple Hill Climbing
      ↓
Neighbour Evaluation
      ↓
Local Optimum
      ↓
Energy Comparison