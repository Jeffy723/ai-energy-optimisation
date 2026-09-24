import type {
  CspConfiguration,
  CspFeasibleSolution,
  CspValue,
} from "../../csp/model/contracts.js";
import type { SolvableCspProblem } from "../../csp/model/evaluation.js";
import type { EnergyComparison, Objective, ObjectiveEvaluation } from "../../energy/objective/contracts.js";
import {
  compareEnergy,
  evaluateObjective,
  measureEnergy,
} from "../../energy/objective/evaluation.js";
import type { Scenario } from "../../problem/scenario/contracts.js";
import type {
  HillClimbingEventBase,
  HillClimbingExecutionEvent,
} from "../../visualisation/events/contracts.js";
import type {
  HillClimbingNeighbour,
  HillClimbingResult,
  HillClimbingState,
  HillClimbingStatistics,
} from "./contracts.js";

export interface HillClimbingOutput {
  readonly result: HillClimbingResult;
  readonly events: readonly HillClimbingExecutionEvent[];
}

export class InvalidHillClimbingInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidHillClimbingInputError";
  }
}

function invalid(message: string): never {
  throw new InvalidHillClimbingInputError(message);
}

function copyConfiguration(configuration: CspConfiguration): CspConfiguration {
  return { ...configuration };
}

function validateProblem(problem: SolvableCspProblem): void {
  const ids = new Set(problem.variableIds);
  if (ids.size !== problem.variableIds.length) {
    invalid("CSP problem contains duplicate variable identifiers");
  }
  for (const variableId of problem.variableIds) {
    const domain = problem.domains.get(variableId);
    if (domain === undefined || domain.length === 0) {
      invalid(`CSP variable "${variableId}" has no domain`);
    }
  }
}

function isFeasible(
  configuration: CspConfiguration,
  problem: SolvableCspProblem,
): boolean {
  if (Object.keys(configuration).length !== problem.variableIds.length) {
    return false;
  }
  for (const variableId of problem.variableIds) {
    if (!Object.prototype.hasOwnProperty.call(configuration, variableId)) {
      return false;
    }
    const domain = problem.domains.get(variableId);
    if (domain === undefined || !domain.includes(configuration[variableId])) {
      return false;
    }
  }
  return problem.constraints.every(
    ({ evaluate }) => evaluate(configuration).status === "satisfied",
  );
}

function makeState(
  configuration: CspConfiguration,
  objective: ObjectiveEvaluation,
): HillClimbingState {
  return { configuration: copyConfiguration(configuration), objective };
}

function makeBase(
  id: string,
  iteration: number,
  state: HillClimbingState,
): HillClimbingEventBase {
  return {
    id,
    iteration,
    currentState: state,
    currentObjective: state.objective,
  };
}

function selectedValueIsDifferent(
  candidate: CspValue,
  current: CspValue,
): boolean {
  return candidate !== current;
}

/**
 * Performs deterministic Simple Hill Climbing.
 *
 * Variables are visited in `problem.variableIds` order and values in each
 * domain's declared order. The first feasible strictly lower-energy neighbour
 * is accepted, then neighbour generation restarts from the new state.
 */
export function optimiseHillClimbing(
  scenario: Scenario,
  objective: Objective,
  startingSolution: CspFeasibleSolution,
  problem: SolvableCspProblem,
): HillClimbingOutput {
  validateProblem(problem);
  if (!isFeasible(startingSolution.configuration, problem)) {
    invalid("Starting solution must be a complete feasible CSP configuration");
  }

  const initialConfiguration = copyConfiguration(startingSolution.configuration);
  const initialObjective = evaluateObjective(
    scenario,
    initialConfiguration,
    objective,
  );
  let current = makeState(initialConfiguration, initialObjective);
  let iteration = 0;
  let neighboursEvaluated = 0;
  let movesAccepted = 0;
  let eventNumber = 0;
  const events: HillClimbingExecutionEvent[] = [];

  events.push({
    ...makeBase(`hill-climbing-${eventNumber++}`, iteration, current),
    type: "INITIAL_STATE",
    reason: "Starting from a complete feasible CSP configuration",
  });

  while (true) {
    let accepted = false;

    for (const variableId of problem.variableIds) {
      const domain = problem.domains.get(variableId);
      if (domain === undefined) {
        invalid(`CSP variable "${variableId}" has no domain`);
      }

      for (const value of domain) {
        const currentValue = current.configuration[variableId];
        if (!selectedValueIsDifferent(value, currentValue)) continue;

        neighboursEvaluated++;
        const candidateConfiguration: CspConfiguration = {
          ...current.configuration,
          [variableId]: value,
        };
        if (!isFeasible(candidateConfiguration, problem)) continue;

        const candidateObjective = evaluateObjective(
          scenario,
          candidateConfiguration,
          objective,
        );
        const isBetter = candidateObjective.value < current.objective.value;
        const candidateState: HillClimbingNeighbour = {
          configuration: copyConfiguration(candidateConfiguration),
          objective: candidateObjective,
          decision: isBetter ? "accepted" : "rejected",
        };

        events.push({
          ...makeBase(`hill-climbing-${eventNumber++}`, iteration, current),
          type: "NEIGHBOUR_EVALUATED",
          candidateState,
          candidateObjective,
          decision: isBetter ? "accepted" : "rejected",
          reason: isBetter
            ? `Neighbour changes ${variableId} and has lower energy`
            : "Neighbour is not strictly lower energy",
        });

        if (isBetter) {
          events.push({
            ...makeBase(`hill-climbing-${eventNumber++}`, iteration, current),
            type: "MOVE_ACCEPTED",
            candidateState,
            candidateObjective,
            reason: `Accepted first better neighbour by changing ${variableId}`,
          });
          current = makeState(candidateConfiguration, candidateObjective);
          iteration++;
          movesAccepted++;
          accepted = true;
          break;
        }
      }
      if (accepted) break;
    }

    if (accepted) continue;

    events.push({
      ...makeBase(`hill-climbing-${eventNumber++}`, iteration, current),
      type: "NO_BETTER_NEIGHBOUR",
      reason: "No feasible strictly lower-energy neighbour exists",
    });
    events.push({
      ...makeBase(`hill-climbing-${eventNumber++}`, iteration, current),
      type: "OPTIMUM_FOUND",
      reason: "Reached a local optimum for the configured neighbourhood",
    });
    break;
  }

  const initialEnergy = measureEnergy(scenario, initialConfiguration);
  const optimisedEnergy = measureEnergy(scenario, current.configuration);
  const energyComparison: EnergyComparison = compareEnergy(
    initialEnergy,
    optimisedEnergy,
  );
  const statistics: HillClimbingStatistics = {
    iterations: iteration,
    neighboursEvaluated,
    movesAccepted,
  };

  return {
    result: {
      startingSolution: {
        configuration: initialConfiguration,
        assignments: startingSolution.assignments.map((assignment) => ({
          ...assignment,
        })),
      },
      finalState: current,
      initialEnergy,
      optimisedEnergy,
      energyComparison,
      statistics,
    },
    events,
  };
}

export const hillClimb = optimiseHillClimbing;
