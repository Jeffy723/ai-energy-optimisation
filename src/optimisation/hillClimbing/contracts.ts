import type {
  CspConfiguration,
  CspFeasibleSolution,
} from "../../csp/model/contracts.js";
import type { CspSearchStatistics } from "../../csp/solver/contracts.js";
import type {
  EnergyComparison,
  EnergyMeasurement,
  ObjectiveEvaluation,
} from "../../energy/objective/contracts.js";
import type { Identifier } from "../../problem/scenario/contracts.js";
import type { Scenario } from "../../problem/scenario/contracts.js";

export interface HillClimbingState {
  readonly configuration: CspConfiguration;
  readonly objective: ObjectiveEvaluation;
}

export interface HillClimbingNeighbour {
  readonly configuration: CspConfiguration;
  readonly objective: ObjectiveEvaluation;
  readonly decision: "accepted" | "rejected";
}

export interface HillClimbingStatistics {
  readonly iterations: number;
  readonly neighboursEvaluated: number;
  readonly movesAccepted: number;
}

export interface HillClimbingResult {
  readonly startingSolution: CspFeasibleSolution;
  readonly finalState: HillClimbingState;
  readonly initialEnergy: EnergyMeasurement;
  readonly optimisedEnergy: EnergyMeasurement;
  readonly energyComparison: EnergyComparison;
  readonly statistics: HillClimbingStatistics;
}

export interface FinalResult {
  readonly scenario: Scenario;
  readonly initialConfiguration: CspConfiguration;
  readonly feasibleConfiguration: CspFeasibleSolution;
  readonly optimisedConfiguration: CspConfiguration;
  readonly initialEnergy: EnergyMeasurement;
  readonly optimisedEnergy: EnergyMeasurement;
  readonly energyComparison: EnergyComparison;
  readonly cspStatistics: CspSearchStatistics;
  readonly hillClimbingStatistics: HillClimbingStatistics;
}

export interface OptimisationDecision {
  readonly eventId: Identifier;
  readonly accepted: boolean;
  readonly reason: string;
}
