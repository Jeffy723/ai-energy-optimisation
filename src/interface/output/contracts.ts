import type { FinalResult } from "../../optimisation/hillClimbing/contracts.js";
import type { BacktrackingView } from "../../visualisation/backtracking/contracts.js";
import type { HillClimbingView } from "../../visualisation/hillClimbing/contracts.js";
import type { SearchTree } from "../../visualisation/searchTree/contracts.js";

export interface ScenarioSummary {
  readonly id: string;
  readonly name: string;
  readonly buildingType: string;
  readonly roomCount: number;
  readonly deviceCount: number;
  readonly context?: Record<string, unknown>;
}

export interface InterfaceOutput {
  readonly scenario: ScenarioSummary;
  readonly csp: {
    readonly feasible: true;
    readonly configuration: FinalResult["feasibleConfiguration"]["configuration"];
    readonly assignments: FinalResult["feasibleConfiguration"]["assignments"];
    readonly statistics: FinalResult["cspStatistics"];
  };
  readonly energy: {
    readonly initial: FinalResult["initialEnergy"];
    readonly optimised: FinalResult["optimisedEnergy"];
    readonly comparison: FinalResult["energyComparison"];
  };
  readonly hillClimbing: {
    readonly initialState: FinalResult["initialEnergy"];
    readonly finalState: FinalResult["optimisedConfiguration"];
    readonly statistics: FinalResult["hillClimbingStatistics"];
  };
  readonly visualisation: {
    readonly searchTree?: SearchTree;
    readonly backtracking?: BacktrackingView;
    readonly hillClimbing?: HillClimbingView;
  };
}
