/**
 * CSP solver event emission.
 *
 * Provides a mutable event collector that the solver populates during
 * execution.  Events conform to the visualisation/events/contracts.ts
 * CspExecutionEvent union.
 *
 * The solver MUST emit these events during actual search — not after the
 * fact.  Visualisation will consume them to reconstruct the real search
 * tree.
 */

import type {
  ConstraintEvaluationResult,
  CspAssignment,
  CspConfiguration,
  CspValue,
  CspVariableId,
} from "../model/contracts.js";
import type {
  BacktrackEvent,
  ConstraintCheckedEvent,
  ConstraintFailedEvent,
  CspExecutionEvent,
  ForwardCheckEvent,
  SolutionFoundEvent,
  ValueTriedEvent,
  VariableSelectedEvent,
} from "../../visualisation/events/contracts.js";
import type { VariableSelection } from "../heuristics/variableOrdering.js";

/**
 * Mutable collector used by the solver to record events during search.
 */
export class EventCollector {
  private readonly _events: CspExecutionEvent[] = [];
  private _step = 0;

  /** Returns a snapshot of all events emitted so far. */
  get events(): readonly CspExecutionEvent[] {
    return this._events;
  }

  /** Current auto-incrementing step counter. */
  get currentStep(): number {
    return this._step;
  }

  private nextId(): string {
    return `csp-event-${this._step}`;
  }

  private snap(assignment: CspConfiguration): CspConfiguration {
    // Return a shallow frozen copy so downstream cannot mutate it.
    return { ...assignment };
  }

  emitVariableSelected(
    variable: CspVariableId,
    depth: number,
    assignment: CspConfiguration,
    selection: VariableSelection,
    lcvOrder?: readonly CspValue[],
  ): void {
    const event: VariableSelectedEvent = {
      id: this.nextId(),
      type: "VARIABLE_SELECTED",
      step: this._step++,
      depth,
      variable,
      assignment: this.snap(assignment),
      remainingValues: selection.remainingValues,
      degreeTieBreakUsed: selection.degreeTieBreakUsed,
      ...(selection.mrvTie === undefined ? {} : { mrvTie: selection.mrvTie }),
      ...(lcvOrder === undefined ? {} : { lcvOrder: [...lcvOrder] }),
      reason: selection.degreeTieBreakUsed
        ? `MRV tied; Degree selected ${variable}: ${selection.mrvTie?.reason ?? "highest degree"}`
        : `MRV selected ${variable} with ${selection.remainingValues} remaining value(s)`,
    };
    this._events.push(event);
  }

  emitValueTried(
    variable: CspVariableId,
    value: CspValue,
    depth: number,
    assignment: CspConfiguration,
    reason?: string,
  ): void {
    const event: ValueTriedEvent = {
      id: this.nextId(),
      type: "VALUE_TRIED",
      step: this._step++,
      depth,
      variable,
      value,
      assignment: this.snap(assignment),
      reason,
    };
    this._events.push(event);
  }

  emitConstraintChecked(
    result: ConstraintEvaluationResult,
    depth: number,
    assignment: CspConfiguration,
    reason?: string,
  ): void {
    const event: ConstraintCheckedEvent = {
      id: this.nextId(),
      type: "CONSTRAINT_CHECKED",
      step: this._step++,
      depth,
      constraint: result,
      assignment: this.snap(assignment),
      reason,
    };
    this._events.push(event);
  }

  emitConstraintFailed(
    result: ConstraintEvaluationResult & { readonly status: "violated" },
    depth: number,
    assignment: CspConfiguration,
    reason?: string,
  ): void {
    const event: ConstraintFailedEvent = {
      id: this.nextId(),
      type: "CONSTRAINT_FAILED",
      step: this._step++,
      depth,
      constraint: result,
      assignment: this.snap(assignment),
      reason,
    };
    this._events.push(event);
  }

  emitForwardCheck(
    variable: CspVariableId,
    pruningKind: "forward-checking" | "constraint-propagation",
    prunedValues: readonly CspAssignment[],
    depth: number,
    assignment: CspConfiguration,
    reason?: string,
  ): void {
    const event: ForwardCheckEvent = {
      id: this.nextId(),
      type: "FORWARD_CHECK",
      step: this._step++,
      depth,
      variable,
      pruningKind,
      prunedValues,
      assignment: this.snap(assignment),
      reason,
    };
    this._events.push(event);
  }

  emitBacktrack(
    depth: number,
    assignment: CspConfiguration,
    variable?: CspVariableId,
    value?: CspValue,
    constraint?: ConstraintEvaluationResult,
    reason?: string,
  ): void {
    const event: BacktrackEvent = {
      id: this.nextId(),
      type: "BACKTRACK",
      step: this._step++,
      depth,
      assignment: this.snap(assignment),
      variable,
      value,
      constraint,
      reason,
    };
    this._events.push(event);
  }

  emitSolutionFound(
    depth: number,
    assignment: CspConfiguration,
    reason?: string,
  ): void {
    const event: SolutionFoundEvent = {
      id: this.nextId(),
      type: "SOLUTION_FOUND",
      step: this._step++,
      depth,
      assignment: this.snap(assignment),
      reason,
    };
    this._events.push(event);
  }
}
