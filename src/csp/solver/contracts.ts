import type { CspFeasibleSolution } from "../model/contracts.js";

export interface CspSearchStatistics {
  readonly variablesSelected: number;
  readonly valuesTried: number;
  readonly constraintChecks: number;
  readonly backtracks: number;
  readonly forwardChecks: number;
}

export interface CspSearchResult {
  readonly feasible: boolean;
  readonly solution?: CspFeasibleSolution;
  readonly statistics: CspSearchStatistics;
}
