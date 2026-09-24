import type { ConstraintEvaluationResult, CspConfiguration, CspValue } from "../../csp/model/contracts.js";

export interface BacktrackingRecord {
  readonly eventId: string;
  readonly type: "CONSTRAINT_FAILED" | "BACKTRACK";
  readonly order: number;
  readonly depth: number;
  readonly assignment: CspConfiguration;
  readonly variable?: string;
  readonly value?: CspValue;
  readonly constraint?: ConstraintEvaluationResult;
  readonly reason?: string;
}

export interface BacktrackingView {
  readonly records: readonly BacktrackingRecord[];
  readonly failureEventIds: readonly string[];
  readonly backtrackEventIds: readonly string[];
}
