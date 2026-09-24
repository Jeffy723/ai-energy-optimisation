import type { FinalResult } from "../../optimisation/hillClimbing/contracts.js";
import type { Scenario } from "../../problem/scenario/contracts.js";
import type { BacktrackingView } from "../../visualisation/backtracking/contracts.js";
import type { HillClimbingView } from "../../visualisation/hillClimbing/contracts.js";
import type { SearchTree } from "../../visualisation/searchTree/contracts.js";
import type { InterfaceOutput, ScenarioSummary } from "./contracts.js";

export interface VisualisationModels {
  readonly searchTree?: SearchTree;
  readonly backtracking?: BacktrackingView;
  readonly hillClimbing?: HillClimbingView;
}

function copyRecord<T extends Record<string, unknown>>(record: T): T {
  return { ...record };
}

function summarizeScenario(scenario: Scenario): ScenarioSummary {
  const deviceCount = scenario.building.rooms.reduce(
    (count, room) => count + room.devices.length,
    0,
  );
  return {
    id: scenario.id,
    name: scenario.name,
    buildingType: scenario.building.type,
    roomCount: scenario.building.rooms.length,
    deviceCount,
    ...(scenario.context === undefined
      ? {}
      : { context: copyRecord(scenario.context as Record<string, unknown>) }),
  };
}

/**
 * Maps existing algorithm results and visualisation models without recalculating
 * energy, objective values, feasibility, or execution history.
 */
export function presentFinalResult(
  result: FinalResult,
  visualisation: VisualisationModels = {},
): InterfaceOutput {
  return {
    scenario: summarizeScenario(result.scenario),
    csp: {
      feasible: true,
      configuration: { ...result.feasibleConfiguration.configuration },
      assignments: result.feasibleConfiguration.assignments.map((assignment) => ({
        ...assignment,
      })),
      statistics: { ...result.cspStatistics },
    },
    energy: {
      initial: {
        ...result.initialEnergy,
        configuration: { ...result.initialEnergy.configuration },
      },
      optimised: {
        ...result.optimisedEnergy,
        configuration: { ...result.optimisedEnergy.configuration },
      },
      comparison: { ...result.energyComparison },
    },
    hillClimbing: {
      initialState: {
        ...result.initialEnergy,
        configuration: { ...result.initialEnergy.configuration },
      },
      finalState: { ...result.optimisedConfiguration },
      statistics: { ...result.hillClimbingStatistics },
    },
    visualisation: {
      ...(visualisation.searchTree === undefined
        ? {}
        : { searchTree: visualisation.searchTree }),
      ...(visualisation.backtracking === undefined
        ? {}
        : { backtracking: visualisation.backtracking }),
      ...(visualisation.hillClimbing === undefined
        ? {}
        : { hillClimbing: visualisation.hillClimbing }),
    },
  };
}
