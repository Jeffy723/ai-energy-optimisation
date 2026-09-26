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
  readonly mrvTie?: {
    readonly candidates: readonly {
      readonly variable: CspVariableId;
      readonly remainingValues: number;
      readonly degree: number;
    }[];
    readonly selectedVariable?: CspVariableId;
    readonly reason: string;
  };
}

export function selectVariableWithDetails(
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
): VariableSelection | undefined {
  if (unassigned.length === 0) return undefined;

  const ranked = unassigned.map((variable) => ({
    variable,
    remainingValues: domainSize(variable, domains),
  }));
  const minimumRemaining = Math.min(...ranked.map((item) => item.remainingValues));
  const mrvCandidates = ranked.filter((item) => item.remainingValues === minimumRemaining);
  if (mrvCandidates.length === 1) {
    return {
      variable: mrvCandidates[0].variable,
      remainingValues: mrvCandidates[0].remainingValues,
      degreeTieBreakUsed: false,
    };
  }

  const unassignedSet = new Set(unassigned);
  const tiedWithDegrees = mrvCandidates.map((candidate) => ({
    ...candidate,
    degree: degree(candidate.variable, unassignedSet, constraints),
  }));
  const highestDegree = Math.max(...tiedWithDegrees.map((item) => item.degree));
  const selected = tiedWithDegrees.find((item) => item.degree === highestDegree)!;
  const lowestDegree = Math.min(...tiedWithDegrees.map((item) => item.degree));
  const degreeTieBreakUsed = highestDegree !== lowestDegree;
  return {
    variable: selected.variable,
    remainingValues: selected.remainingValues,
    degreeTieBreakUsed,
    mrvTie: {
      candidates: tiedWithDegrees,
      ...(degreeTieBreakUsed ? { selectedVariable: selected.variable } : {}),
      reason: degreeTieBreakUsed
        ? `Selected the highest-degree MRV candidate (${highestDegree})`
        : `All MRV candidates have degree ${highestDegree}; retained input order`,
    },
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
 * Degree of a variable: number of distinct directly connected unassigned
 * variables, not the number of constraints containing this variable.
 */
function degree(
  variable: CspVariableId,
  unassignedSet: ReadonlySet<CspVariableId>,
  constraints: readonly SolvableConstraint[],
): number {
  const neighbours = new Set<CspVariableId>();
  for (const sc of constraints) {
    if (sc.constraint.degreeRelevant === false) continue;
    const vars = sc.constraint.involvedVariables;
    if (!vars.includes(variable)) continue;
    for (const v of vars) {
      if (v !== variable && unassignedSet.has(v)) neighbours.add(v);
    }
  }
  return neighbours.size;
}
