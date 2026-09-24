/**
 * Constraint evaluation for the CSP solver.
 *
 * The existing CspConstraint contract in contracts.ts describes constraints
 * declaratively (id, involvedVariables, description, evaluationSemantics, etc.)
 * but does not prescribe a concrete evaluator function.
 *
 * DATA_MODEL.md states:
 *   "The data model defines the information required for evaluation;
 *    the concrete programming representation of the evaluator is decided
 *    during implementation."
 *
 * This module provides that concrete representation: a ConstraintEvaluator
 * function type and a SolvableConstraint that pairs the declarative
 * CspConstraint with its evaluator.
 *
 * Ownership: csp/model/ owns solver-ready CSP structures.
 */

import type {
  ConstraintEvaluationResult,
  CspConfiguration,
  CspConstraint,
  CspVariableId,
} from "./contracts.js";

/**
 * A concrete evaluator function for a constraint.
 *
 * Given the current (possibly partial) assignment, it returns a
 * ConstraintEvaluationResult with status:
 * - "satisfied"  — all involved variables assigned and constraint holds
 * - "violated"   — constraint is definitely broken
 * - "undecided"  — not all involved variables assigned yet; cannot determine
 */
export type ConstraintEvaluator = (
  assignment: CspConfiguration,
) => ConstraintEvaluationResult;

/**
 * A solver-ready constraint: the declarative CspConstraint paired with
 * its concrete evaluator.
 */
export interface SolvableConstraint {
  readonly constraint: CspConstraint;
  readonly evaluate: ConstraintEvaluator;
}

/**
 * A CspProblem augmented with concrete evaluators — the form the solver
 * actually operates on.
 */
export interface SolvableCspProblem {
  readonly variableIds: readonly CspVariableId[];
  readonly domains: ReadonlyMap<CspVariableId, readonly import("./contracts.js").CspValue[]>;
  readonly constraints: readonly SolvableConstraint[];
}
