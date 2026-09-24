/**
 * Variable ordering heuristics for CSP backtracking search.
 *
 * Architecture: csp/heuristics/ — implements MRV and Degree Heuristic.
 *
 * MRV (Minimum Remaining Values):
 *   Choose the unassigned variable with the smallest remaining domain.
 *   This focuses the search on the most constrained variable first,
 *   failing early when possible.
 *
 * Degree Heuristic (tie-breaker):
 *   Among variables tied on MRV, prefer the one involved in the most
 *   constraints with other *unassigned* variables.  This maximises
 *   constraint propagation opportunities.
 *
 * Both heuristics are deterministic: when ties remain after MRV + Degree,
 * the variable that appears first in the input ordering is chosen.
 */

import type { CspValue, CspVariableId } from "../model/contracts.js";
import type { SolvableConstraint } from "../model/evaluation.js";

/**
 * Select the next unassigned variable using MRV with Degree as tie-breaker.
 *
 * @param unassigned  IDs of variables that have not yet been assigned.
 * @param domains     Current (possibly pruned) domains for each variable.
 * @param constraints All solver-ready constraints.
 * @returns The selected variable ID, or undefined if `unassigned` is empty.
 */
export function selectVariable(
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
): CspVariableId | undefined {
  if (unassigned.length === 0) return undefined;

  // Build an unassigned set for fast lookup.
  const unassignedSet = new Set(unassigned);

  let bestVariable: CspVariableId = unassigned[0];
  let bestDomainSize = domainSize(bestVariable, domains);
  let bestDegree = degree(bestVariable, unassignedSet, constraints);

  for (let i = 1; i < unassigned.length; i++) {
    const v = unassigned[i];
    const ds = domainSize(v, domains);

    if (ds < bestDomainSize) {
      // Strictly smaller domain — wins MRV.
      bestVariable = v;
      bestDomainSize = ds;
      bestDegree = degree(v, unassignedSet, constraints);
    } else if (ds === bestDomainSize) {
      // Tie on MRV — break with Degree.
      const deg = degree(v, unassignedSet, constraints);
      if (deg > bestDegree) {
        bestVariable = v;
        bestDegree = deg;
      }
      // If Degree also ties, we keep the earlier variable (stable ordering).
    }
  }

  return bestVariable;
}

function domainSize(
  variable: CspVariableId,
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
): number {
  const d = domains.get(variable);
  return d ? d.length : 0;
}

/**
 * Degree of a variable: number of constraints that involve this variable
 * AND at least one other variable that is still unassigned.
 */
function degree(
  variable: CspVariableId,
  unassignedSet: ReadonlySet<CspVariableId>,
  constraints: readonly SolvableConstraint[],
): number {
  let count = 0;
  for (const sc of constraints) {
    const vars = sc.constraint.involvedVariables;
    if (!vars.includes(variable)) continue;
    // Does this constraint involve at least one *other* unassigned variable?
    for (const v of vars) {
      if (v !== variable && unassignedSet.has(v)) {
        count++;
        break; // count this constraint once
      }
    }
  }
  return count;
}
