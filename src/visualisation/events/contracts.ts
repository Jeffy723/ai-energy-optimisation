import type {
  ConstraintEvaluationResult,
  CspAssignment,
  CspConfiguration,
  CspVariableId,
  CspValue,
} from "../../csp/model/contracts.js";
import type { ObjectiveEvaluation } from "../../energy/objective/contracts.js";
import type {
  HillClimbingNeighbour,
  HillClimbingState,
} from "../../optimisation/hillClimbing/contracts.js";
import type { Identifier } from "../../problem/scenario/contracts.js";

export interface CspEventBase {
  readonly id: Identifier;
  readonly step: number;
  readonly depth: number;
  readonly assignment: CspConfiguration;
  readonly reason?: string;
}

export interface VariableSelectedEvent extends CspEventBase {
  readonly type: "VARIABLE_SELECTED";
  readonly variable: CspVariableId;
  readonly remainingValues: number;
  readonly degreeTieBreakUsed: boolean;
  readonly mrvTie?: {
    readonly candidates: readonly {
      readonly variable: CspVariableId;
      readonly remainingValues: number;
      readonly degree: number;
    }[];
    readonly selectedVariable?: CspVariableId;
    readonly reason: string;
  };
  readonly lcvOrder?: readonly CspValue[];
}

export interface ValueTriedEvent extends CspEventBase {
  readonly type: "VALUE_TRIED";
  readonly variable: CspVariableId;
  readonly value: CspValue;
}

export interface ConstraintCheckedEvent extends CspEventBase {
  readonly type: "CONSTRAINT_CHECKED";
  readonly constraint: ConstraintEvaluationResult;
}

export interface ConstraintFailedEvent extends CspEventBase {
  readonly type: "CONSTRAINT_FAILED";
  readonly constraint: ConstraintEvaluationResult & { readonly status: "violated" };
}

export interface ForwardCheckEvent extends CspEventBase {
  readonly type: "FORWARD_CHECK";
  readonly variable: CspVariableId;
  /**
   * Covers both forward checking and constraint-propagation pruning without
   * adding an event type beyond the documented contract.
   */
  readonly pruningKind: "forward-checking" | "constraint-propagation";
  readonly prunedValues: readonly CspAssignment[];
}

export interface BacktrackEvent extends CspEventBase {
  readonly type: "BACKTRACK";
  readonly variable?: CspVariableId;
  readonly value?: CspValue;
  readonly constraint?: ConstraintEvaluationResult;
}

export interface SolutionFoundEvent extends CspEventBase {
  readonly type: "SOLUTION_FOUND";
}

export type CspExecutionEvent =
  | VariableSelectedEvent
  | ValueTriedEvent
  | ConstraintCheckedEvent
  | ConstraintFailedEvent
  | ForwardCheckEvent
  | BacktrackEvent
  | SolutionFoundEvent;

export interface HillClimbingEventBase {
  readonly id: Identifier;
  readonly iteration: number;
  readonly currentState: HillClimbingState;
  readonly currentObjective: ObjectiveEvaluation;
  readonly reason?: string;
}

export interface InitialStateEvent extends HillClimbingEventBase {
  readonly type: "INITIAL_STATE";
}

export interface NeighbourEvaluatedEvent extends HillClimbingEventBase {
  readonly type: "NEIGHBOUR_EVALUATED";
  readonly candidateState: HillClimbingNeighbour;
  readonly candidateObjective: ObjectiveEvaluation;
  /** Rejections use this event rather than an undocumented event type. */
  readonly decision: "accepted" | "rejected";
}

export interface MoveAcceptedEvent extends HillClimbingEventBase {
  readonly type: "MOVE_ACCEPTED";
  readonly candidateState: HillClimbingNeighbour;
  readonly candidateObjective: ObjectiveEvaluation;
}

export interface NoBetterNeighbourEvent extends HillClimbingEventBase {
  readonly type: "NO_BETTER_NEIGHBOUR";
}

export interface OptimumFoundEvent extends HillClimbingEventBase {
  readonly type: "OPTIMUM_FOUND";
}

export type HillClimbingExecutionEvent =
  | InitialStateEvent
  | NeighbourEvaluatedEvent
  | MoveAcceptedEvent
  | NoBetterNeighbourEvent
  | OptimumFoundEvent;

/**
 * The only event stream contract required by visualisation and interface code.
 * It carries generated events; it does not provide algorithm implementations.
 */
export type AlgorithmExecutionEvent =
  | CspExecutionEvent
  | HillClimbingExecutionEvent;
