/**
 * Value ordering heuristic for CSP backtracking search.
 *
 * Architecture: csp/heuristics/ — implements LCV.
 *
 * LCV (Least Constraining Value):
 *   Order a variable's domain values so that the value which rules out
 *   the fewest values in the domains of neighbouring (unassigned) variables
 *   is tried first.
 *
 *   "Ruling out" means: if we tentatively assign this value to the variable,
 *   how many values in neighbouring domains become inconsistent?
 *   The value that eliminates the *least* is tried first, maximising the
 *   chance of finding a solution without backtracking.
 *
 * Deterministic: values with equal LCV scores retain their original
 * domain ordering (stable sort).
 */

import type {
  CspConfiguration,
  CspValue,
  CspVariableId,
} from "../model/contracts.js";
import type { SolvableConstraint } from "../model/evaluation.js";

/**
 * Order the domain values for `variable` using LCV.
 *
 * @param variable    The variable being assigned.
 * @param values      The current domain of that variable.
 * @param assignment  The current partial assignment (without `variable`).
 * @param unassigned  IDs of other variables not yet assigned.
 * @param domains     Current (possibly pruned) domains for every variable.
 * @param constraints All solver-ready constraints.
 * @returns A new array of values ordered least-constraining first.
 */
export function orderValues(
  variable: CspVariableId,
  values: readonly CspValue[],
  assignment: CspConfiguration,
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
): readonly CspValue[] {
  if (values.length <= 1) return values;

  // Find constraints that involve `variable` and at least one unassigned neighbour.
  const relevantConstraints: SolvableConstraint[] = [];
  for (const sc of constraints) {
    const vars = sc.constraint.involvedVariables;
    if (!vars.includes(variable)) continue;
    // Is at least one other involved variable unassigned?
    for (const v of vars) {
      if (v !== variable && unassigned.includes(v)) {
        relevantConstraints.push(sc);
        break;
      }
    }
  }

  if (relevantConstraints.length === 0) {
    // No neighbouring constraints — every value is equally constraining.
    return values;
  }

  // For each candidate value, count how many neighbour-domain values it rules out.
  const scored: Array<{ value: CspValue; ruledOut: number }> = values.map(
    (value) => ({
      value,
      ruledOut: countRuledOut(
        variable,
        value,
        assignment,
        unassigned,
        domains,
        relevantConstraints,
      ),
    }),
  );

  // Stable sort ascending by ruledOut (least constraining first).
  scored.sort((a, b) => a.ruledOut - b.ruledOut);

  return scored.map((s) => s.value);
}

/**
 * Count how many neighbour-domain values become inconsistent when
 * `variable = value` is added to `assignment`.
 */
function countRuledOut(
  variable: CspVariableId,
  value: CspValue,
  assignment: CspConfiguration,
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  relevantConstraints: readonly SolvableConstraint[],
): number {
  const tentative: CspConfiguration = { ...assignment, [variable]: value };
  let ruledOut = 0;

  for (const neighbour of unassigned) {
    if (neighbour === variable) continue;

    const neighbourDomain = domains.get(neighbour);
    if (!neighbourDomain) continue;

    // Find constraints involving both `variable` and this `neighbour`.
    const shared = relevantConstraints.filter((sc) =>
      sc.constraint.involvedVariables.includes(neighbour),
    );
    if (shared.length === 0) continue;

    for (const nv of neighbourDomain) {
      const testAssignment: CspConfiguration = {
        ...tentative,
        [neighbour]: nv,
      };
      for (const sc of shared) {
        const result = sc.evaluate(testAssignment);
        if (result.status === "violated") {
          ruledOut++;
          break; // this neighbour-value is ruled out; don't double-count
        }
      }
    }
  }

  return ruledOut;
}
