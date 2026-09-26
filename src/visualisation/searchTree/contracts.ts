import type {
  ConstraintEvaluationResult,
  CspConfiguration,
  CspValue,
} from "../../csp/model/contracts.js";
import type { CspExecutionEvent } from "../events/contracts.js";

export interface SearchTreeNode {
  readonly id: string;
  readonly eventId?: string;
  readonly type: "ROOT" | CspExecutionEvent["type"];
  readonly depth: number;
  readonly order: number;
  readonly assignment: CspConfiguration;
  readonly variable?: string;
  readonly value?: CspValue;
  readonly remainingValues?: number;
  readonly degreeTieBreakUsed?: boolean;
  readonly lcvOrder?: readonly CspValue[];
  readonly constraint?: ConstraintEvaluationResult;
  readonly pruningKind?: "forward-checking" | "constraint-propagation";
  readonly prunedValues?: readonly { readonly variable: string; readonly value: CspValue }[];
  readonly reason?: string;
  readonly children: readonly SearchTreeNode[];
}

export interface SearchTree {
  readonly root: SearchTreeNode;
  readonly eventOrder: readonly string[];
}
