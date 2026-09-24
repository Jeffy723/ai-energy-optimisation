import type { SolvableCspProblem } from "../../csp/model/evaluation.js";
import { solve } from "../../csp/solver/engine.js";
import { optimiseHillClimbing } from "../../optimisation/hillClimbing/engine.js";
import type { Objective } from "../../energy/objective/contracts.js";
import { validateScenario } from "../../problem/scenario/validation.js";
import type { Scenario } from "../../problem/scenario/contracts.js";
import { buildBacktrackingView } from "../../visualisation/backtracking/processor.js";
import { buildHillClimbingView } from "../../visualisation/hillClimbing/processor.js";
import { buildSearchTree } from "../../visualisation/searchTree/processor.js";
import {
  presentFinalResult,
  type ExecutionEvents,
} from "../output/mapper.js";
import type {
  InfeasibleInterfaceOutput,
  ScenarioSummary,
} from "../output/contracts.js";
import type { PipelineResult } from "./contracts.js";

function scenarioSummary(scenario: Scenario): ScenarioSummary {
  return {
    id: scenario.id,
    name: scenario.name,
    buildingType: scenario.building.type,
    roomCount: scenario.building.rooms.length,
    deviceCount: scenario.building.rooms.reduce(
      (count, room) => count + room.devices.length,
      0,
    ),
    ...(scenario.context === undefined
      ? {}
      : { context: { ...scenario.context } as Record<string, unknown> }),
  };
}

export class PipelineInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PipelineInputError";
  }
}

function validateInput(scenario: Scenario): void {
  const validation = validateScenario(scenario);
  if (!validation.valid) {
    throw new PipelineInputError(
      `Invalid scenario: ${validation.errors.join("; ")}`,
    );
  }
}

/**
 * Coordinates existing modules. Scenario constraints remain solver-ready
 * inputs because their contract intentionally does not define evaluator code.
 */
export function runPipeline(
  scenario: Scenario,
  problem: SolvableCspProblem,
  objective: Objective,
): PipelineResult {
  validateInput(scenario);
  const csp = solve(problem);
  const cspEvents = [...csp.events];

  if (!csp.result.feasible || csp.result.solution === undefined) {
    const output: InfeasibleInterfaceOutput = {
      scenario: scenarioSummary(scenario),
      csp: {
        feasible: false,
        statistics: { ...csp.result.statistics },
      },
      events: { csp: cspEvents, hillClimbing: [] },
      error: "No feasible CSP configuration was found; Hill Climbing was not run.",
    };
    return {
      status: "infeasible",
      output,
      cspEvents,
      hillClimbingEvents: [],
    };
  }

  const hillClimbing = optimiseHillClimbing(
    scenario,
    objective,
    csp.result.solution,
    problem,
  );
  const hillClimbingEvents = [...hillClimbing.events];
  const executionEvents: ExecutionEvents = {
    csp: cspEvents,
    hillClimbing: hillClimbingEvents,
  };
  const output = presentFinalResult(
    {
      scenario,
      initialConfiguration: hillClimbing.result.startingSolution.configuration,
      feasibleConfiguration: hillClimbing.result.startingSolution,
      optimisedConfiguration: hillClimbing.result.finalState.configuration,
      initialEnergy: hillClimbing.result.initialEnergy,
      optimisedEnergy: hillClimbing.result.optimisedEnergy,
      energyComparison: hillClimbing.result.energyComparison,
      cspStatistics: csp.result.statistics,
      hillClimbingStatistics: hillClimbing.result.statistics,
    },
    {
      searchTree: buildSearchTree(cspEvents),
      backtracking: buildBacktrackingView(cspEvents),
      hillClimbing: buildHillClimbingView(hillClimbingEvents),
    },
    executionEvents,
  );

  return {
    status: "completed",
    output,
    cspEvents,
    hillClimbingEvents,
  };
}
