import type { HillClimbingExecutionEvent } from "../events/contracts.js";
import type { HillClimbingState, HillClimbingNeighbour } from "../../optimisation/hillClimbing/contracts.js";

export interface HillClimbingViewRecord {
  readonly eventId: string;
  readonly order: number;
  readonly type: HillClimbingExecutionEvent["type"];
  readonly iteration: number;
  readonly currentState: HillClimbingState;
  readonly currentObjective: HillClimbingState["objective"];
  readonly candidateState?: HillClimbingNeighbour;
  readonly candidateObjective?: HillClimbingState["objective"];
  readonly decision?: "accepted" | "rejected";
  readonly reason?: string;
}

export interface HillClimbingView {
  readonly records: readonly HillClimbingViewRecord[];
  readonly finalState?: HillClimbingState;
}
