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
  return selectVariableWithDetails(unassigned, domains, constraints)?.variable;
}

export interface VariableSelection {
  readonly variable: CspVariableId;
  readonly remainingValues: number;
  readonly degreeTieBreakUsed: boolean;
}

export function selectVariableWithDetails(
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
): VariableSelection | undefined {
  if (unassigned.length === 0) return undefined;

  const unassignedSet = new Set(unassigned);
  const ranked = unassigned.map((variable) => ({
    variable,
    remainingValues: domainSize(variable, domains),
    degree: degree(variable, unassignedSet, constraints),
  }));
  const minimumRemaining = Math.min(...ranked.map((item) => item.remainingValues));
  const mrvCandidates = ranked.filter((item) => item.remainingValues === minimumRemaining);
  const highestDegree = Math.max(...mrvCandidates.map((item) => item.degree));
  const selected = mrvCandidates.find((item) => item.degree === highestDegree)!;
  return {
    variable: selected.variable,
    remainingValues: selected.remainingValues,
    degreeTieBreakUsed:
      mrvCandidates.length > 1 && selected.variable !== mrvCandidates[0].variable,
  };
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
