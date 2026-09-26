/**
 * CSP backtracking solver engine.
 *
 * Architecture: csp/solver/ — implements CSP solving with backtracking
 * and emits CSP execution events.
 *
 * Algorithm:
 *   1. Select unassigned variable (MRV + Degree).
 *   2. Order domain values (LCV).
 *   3. For each value:
 *      a. Assign value.
 *      b. Check constraints.
 *      c. Run inference (forward checking + constraint propagation).
 *      d. Recurse.
 *      e. On failure: undo assignment, restore domains, backtrack.
 *   4. All values exhausted → backtrack.
 *   5. All variables assigned + consistent → SOLUTION_FOUND.
 *
 * The solver:
 * - Never mutates caller-owned input.
 * - Correctly restores domains/assignments after backtracking.
 * - Emits events for every significant search step.
 * - Returns CspSearchResult conforming to csp/solver/contracts.ts.
 * - Is deterministic for a given CspProblem (same input → same output).
 */

import type {
  CspAssignment,
  CspConfiguration,
  CspFeasibleSolution,
  CspValue,
  CspVariableId,
} from "../model/contracts.js";
import type { SolvableCspProblem } from "../model/evaluation.js";
import type { CspSearchResult, CspSearchStatistics } from "./contracts.js";
import type { CspExecutionEvent } from "../../visualisation/events/contracts.js";
import { EventCollector } from "./events.js";
import { selectVariableWithDetails } from "../heuristics/variableOrdering.js";
import { orderValuesWithDetails } from "../heuristics/valueOrdering.js";
import { infer } from "../heuristics/inference.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full result including both the CspSearchResult and the execution events.
 */
export interface CspSolverOutput {
  readonly result: CspSearchResult;
  readonly events: readonly CspExecutionEvent[];
}

/**
 * Solve a CSP using backtracking with MRV, Degree, LCV, forward checking,
 * and constraint propagation.
 *
 * @param problem A SolvableCspProblem containing variable IDs, domains,
 *                and constraints with concrete evaluators.
 * @returns CspSolverOutput with the search result and all execution events.
 */
export function solve(problem: SolvableCspProblem): CspSolverOutput {
  const events = new EventCollector();
  const stats: MutableStatistics = {
    variablesSelected: 0,
    valuesTried: 0,
    constraintChecks: 0,
    backtracks: 0,
    forwardChecks: 0,
  };

  // Deep-copy the initial domains so we never mutate the caller's data.
  const initialDomains = new Map<CspVariableId, readonly CspValue[]>();
  for (const [vid, values] of problem.domains) {
    initialDomains.set(vid, [...values]);
  }

  const unassigned = [...problem.variableIds];
  const assignment: Record<CspVariableId, CspValue> = {};

  const solution = backtrack(
    assignment,
    unassigned,
    initialDomains,
    problem,
    events,
    stats,
    0, // depth
  );

  const frozenStats: CspSearchStatistics = { ...stats };

  if (solution !== null) {
    return {
      result: {
        feasible: true,
        solution: solution,
        statistics: frozenStats,
      },
      events: events.events,
    };
  }

  return {
    result: {
      feasible: false,
      statistics: frozenStats,
    },
    events: events.events,
  };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface MutableStatistics {
  variablesSelected: number;
  valuesTried: number;
  constraintChecks: number;
  backtracks: number;
  forwardChecks: number;
}

// ---------------------------------------------------------------------------
// Backtracking core
// ---------------------------------------------------------------------------

function backtrack(
  assignment: Record<CspVariableId, CspValue>,
  unassigned: CspVariableId[],
  domains: Map<CspVariableId, readonly CspValue[]>,
  problem: SolvableCspProblem,
  events: EventCollector,
  stats: MutableStatistics,
  depth: number,
): CspFeasibleSolution | null {
  // Base case: all variables assigned → solution found.
  if (unassigned.length === 0) {
    const config = snapshotConfig(assignment);
    events.emitSolutionFound(depth, config, "All variables assigned and consistent");
    return {
      configuration: config,
      assignments: configToAssignments(config),
    };
  }

  // 1. Select variable (MRV + Degree).
  const selection = selectVariableWithDetails(unassigned, domains, problem.constraints);
  if (selection === undefined) {
    // Should not happen if unassigned is non-empty, but handle defensively.
    return null;
  }
  const { variable } = selection;

  stats.variablesSelected++;
  const config = snapshotConfig(assignment);

  // 2. Order domain values (LCV).
  const rawDomain = domains.get(variable);
  const ordering = orderValuesWithDetails(
    variable,
    rawDomain ?? [],
    config,
    unassigned.filter((v) => v !== variable),
    domains,
    problem.constraints,
  );
  events.emitVariableSelected(
    variable,
    depth,
    config,
    selection,
    ordering.lcvApplied ? ordering.values : undefined,
  );
  if (!rawDomain || rawDomain.length === 0) {
    // Domain empty — backtrack.
    stats.backtracks++;
    events.emitBacktrack(
      depth,
      config,
      variable,
      undefined,
      undefined,
      `Empty domain for ${variable}`,
    );
    return null;
  }

  const orderedValues = ordering.values;

  // 3. Try each value.
  for (const value of orderedValues) {
    stats.valuesTried++;

    // Assign
    assignment[variable] = value;
    const assignmentSnapshot = snapshotConfig(assignment);

    events.emitValueTried(variable, value, depth, assignmentSnapshot);

    // 4. Check constraints relevant to this variable.
    const constraintOk = checkConstraints(
      variable,
      assignmentSnapshot,
      problem,
      events,
      stats,
      depth,
    );

    if (!constraintOk) {
      delete assignment[variable];
      stats.backtracks++;
      events.emitBacktrack(
        depth,
        snapshotConfig(assignment),
        variable,
        value,
        undefined,
        `Constraint failure for ${variable}=${String(value)}; trying the next value`,
      );
      continue;
    }

    // 5. Inference (forward checking + constraint propagation).
    const remainingUnassigned = unassigned.filter((v) => v !== variable);
    const inferenceResult = infer(
      variable,
      assignmentSnapshot,
      remainingUnassigned,
      domains,
      problem.constraints,
      events,
      depth,
    );
    stats.forwardChecks += inferenceResult.forwardChecks;

    if (!inferenceResult.consistent) {
      // Domain wipeout — undo and try next value.
      delete assignment[variable];
      stats.backtracks++;
      events.emitBacktrack(
        depth,
        snapshotConfig(assignment),
        variable,
        value,
        undefined,
        `Forward checking/propagation caused domain wipeout`,
      );
      continue;
    }

    // Apply pruned domains.
    const savedDomains = new Map<CspVariableId, readonly CspValue[]>();
    for (const [v, d] of inferenceResult.prunedDomains) {
      savedDomains.set(v, domains.get(v)!);
      domains.set(v, d);
    }

    // 6. Recurse.
    const result = backtrack(
      assignment,
      remainingUnassigned,
      domains,
      problem,
      events,
      stats,
      depth + 1,
    );

    if (result !== null) {
      return result;
    }

    // 7. Backtrack: undo assignment, restore domains.
    delete assignment[variable];
    for (const [v, d] of savedDomains) {
      domains.set(v, d);
    }

    stats.backtracks++;
    events.emitBacktrack(
      depth,
      snapshotConfig(assignment),
      variable,
      value,
      undefined,
      `No solution found with ${variable}=${String(value)}; backtracking`,
    );
  }

  // All values exhausted — failure at this level.
  return null;
}

// ---------------------------------------------------------------------------
// Constraint checking
// ---------------------------------------------------------------------------

/**
 * Check all constraints that involve `variable` against the current
 * assignment.  Returns true if no constraint is violated.
 */
function checkConstraints(
  variable: CspVariableId,
  assignment: CspConfiguration,
  problem: SolvableCspProblem,
  events: EventCollector,
  stats: MutableStatistics,
  depth: number,
): boolean {
  for (const sc of problem.constraints) {
    if (!sc.constraint.involvedVariables.includes(variable)) continue;

    stats.constraintChecks++;
    const result = sc.evaluate(assignment);

    if (result.status === "violated") {
      events.emitConstraintFailed(
        { ...result, status: "violated" },
        depth,
        assignment,
        result.reason,
      );
      return false;
    }

    events.emitConstraintChecked(result, depth, assignment);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshotConfig(
  assignment: Record<CspVariableId, CspValue>,
): CspConfiguration {
  return { ...assignment };
}

function configToAssignments(config: CspConfiguration): readonly CspAssignment[] {
  return Object.entries(config).map(([variable, value]) => ({
    variable,
    value,
  }));
}
