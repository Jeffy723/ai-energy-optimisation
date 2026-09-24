import type { CspExecutionEvent, HillClimbingExecutionEvent } from "../../visualisation/events/contracts.js";
import type { InterfaceOutput, InfeasibleInterfaceOutput } from "../output/contracts.js";

export type PipelineOutput = InterfaceOutput | InfeasibleInterfaceOutput;

export interface PipelineSuccess {
  readonly status: "completed";
  readonly output: InterfaceOutput;
  readonly cspEvents: readonly CspExecutionEvent[];
  readonly hillClimbingEvents: readonly HillClimbingExecutionEvent[];
}

export interface PipelineFailure {
  readonly status: "infeasible";
  readonly output: InfeasibleInterfaceOutput;
  readonly cspEvents: readonly CspExecutionEvent[];
  readonly hillClimbingEvents: readonly [];
}

export type PipelineResult = PipelineSuccess | PipelineFailure;
