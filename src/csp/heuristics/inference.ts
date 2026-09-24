/**
 * Inference procedures for CSP backtracking search.
 *
 * Architecture: csp/heuristics/ — implements Forward Checking and
 * Constraint Propagation.
 *
 * Forward Checking:
 *   After assigning variable = value, check every constraint involving
 *   that variable and an unassigned neighbour.  Remove any neighbour-domain
 *   value that would be inconsistent with the current assignment.
 *   If any neighbour's domain becomes empty → failure (domain wipeout).
 *
 * Constraint Propagation (AC-3-style arc consistency):
 *   After forward checking prunes values, propagate further: for every
 *   affected variable, check whether the reduced domain causes additional
 *   inconsistencies in *its* neighbours, and so on until a fixpoint is
 *   reached or a wipeout is detected.
 *
 * Both procedures emit FORWARD_CHECK events through the EventCollector
 * so that visualisation can reconstruct pruning decisions.
 */

import type {
  CspAssignment,
  CspConfiguration,
  CspValue,
  CspVariableId,
} from "../model/contracts.js";
import type { SolvableConstraint } from "../model/evaluation.js";
import type { EventCollector } from "../solver/events.js";

/**
 * Result of an inference step.
 *
 * `consistent`:  false means a domain wipeout was detected — the caller
 *                must backtrack.
 * `prunedDomains`: a new domain map reflecting all pruned values.
 *                  Only keys whose domains shrank are present; callers
 *                  should overlay this on the existing map.
 * `forwardChecks`: number of forward-check operations performed (for stats).
 */
export interface InferenceResult {
  readonly consistent: boolean;
  readonly prunedDomains: Map<CspVariableId, readonly CspValue[]>;
  readonly forwardChecks: number;
}

/**
 * Run forward checking after assigning `variable = value`.
 *
 * For every constraint involving `variable` and at least one unassigned
 * neighbour, test each value in the neighbour's domain.  If a value is
 * inconsistent with the current assignment, prune it.  If any domain
 * becomes empty, return `consistent: false`.
 */
export function forwardCheck(
  variable: CspVariableId,
  assignment: CspConfiguration,
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
  events: EventCollector,
  depth: number,
): InferenceResult {
  const prunedDomains = new Map<CspVariableId, readonly CspValue[]>();
  let forwardChecks = 0;
  const unassignedSet = new Set(unassigned);

  // Work with a mutable copy of the affected domains.
  const workingDomains = new Map(domains);

  for (const sc of constraints) {
    const vars = sc.constraint.involvedVariables;
    if (!vars.includes(variable)) continue;

    for (const neighbour of vars) {
      if (neighbour === variable) continue;
      if (!unassignedSet.has(neighbour)) continue;

      const neighbourDomain = workingDomains.get(neighbour);
      if (!neighbourDomain || neighbourDomain.length === 0) continue;

      const survivingValues: CspValue[] = [];
      const pruned: CspAssignment[] = [];

      for (const nv of neighbourDomain) {
        forwardChecks++;
        const testAssignment: CspConfiguration = {
          ...assignment,
          [neighbour]: nv,
        };
        const result = sc.evaluate(testAssignment);

        if (result.status === "violated") {
          pruned.push({ variable: neighbour, value: nv });
        } else {
          survivingValues.push(nv);
        }
      }

      if (pruned.length > 0) {
        workingDomains.set(neighbour, survivingValues);
        prunedDomains.set(neighbour, survivingValues);

        events.emitForwardCheck(
          neighbour,
          "forward-checking",
          pruned,
          depth,
          assignment,
          `Forward checking after ${variable} assignment pruned ${pruned.length} value(s) from ${neighbour}`,
        );

        // Domain wipeout — inconsistency detected.
        if (survivingValues.length === 0) {
          return { consistent: false, prunedDomains, forwardChecks };
        }
      }
    }
  }

  return { consistent: true, prunedDomains, forwardChecks };
}

/**
 * Run constraint propagation (AC-3-style) starting from the variables
 * whose domains were pruned during forward checking.
 *
 * For each affected variable, check all constraints involving it and
 * another unassigned variable.  If the other variable's domain shrinks,
 * add it to the queue.  Continue until the queue is empty (fixpoint)
 * or a wipeout is detected.
 */
export function propagate(
  initiallyPruned: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  assignment: CspConfiguration,
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
  events: EventCollector,
  depth: number,
): InferenceResult {
  const prunedDomains = new Map<CspVariableId, readonly CspValue[]>();
  let forwardChecks = 0;
  const unassignedSet = new Set(unassigned);

  // Start with the forward-checked domain state.
  const workingDomains = new Map(domains);
  for (const [v, d] of initiallyPruned) {
    workingDomains.set(v, d);
    prunedDomains.set(v, d);
  }

  // Queue: variables whose domains were recently reduced.
  const queue: CspVariableId[] = [...initiallyPruned.keys()];
  const inQueue = new Set(queue);

  while (queue.length > 0) {
    const current = queue.shift()!;
    inQueue.delete(current);

    if (!unassignedSet.has(current)) continue;

    for (const sc of constraints) {
      const vars = sc.constraint.involvedVariables;
      if (!vars.includes(current)) continue;

      for (const neighbour of vars) {
        if (neighbour === current) continue;
        if (!unassignedSet.has(neighbour)) continue;

        const neighbourDomain = workingDomains.get(neighbour);
        if (!neighbourDomain || neighbourDomain.length === 0) continue;

        const survivingValues: CspValue[] = [];
        const pruned: CspAssignment[] = [];

        for (const nv of neighbourDomain) {
          forwardChecks++;
          // Check if nv has at least one support in current's domain.
          const currentDomain = workingDomains.get(current);
          let supported = false;

          if (currentDomain) {
            for (const cv of currentDomain) {
              const testAssignment: CspConfiguration = {
                ...assignment,
                [current]: cv,
                [neighbour]: nv,
              };
              const result = sc.evaluate(testAssignment);
              if (result.status !== "violated") {
                supported = true;
                break;
              }
            }
          }

          if (supported) {
            survivingValues.push(nv);
          } else {
            pruned.push({ variable: neighbour, value: nv });
          }
        }

        if (pruned.length > 0) {
          workingDomains.set(neighbour, survivingValues);
          prunedDomains.set(neighbour, survivingValues);

          events.emitForwardCheck(
            neighbour,
            "constraint-propagation",
            pruned,
            depth,
            assignment,
            `Constraint propagation from ${current} pruned ${pruned.length} value(s) from ${neighbour}`,
          );

          if (survivingValues.length === 0) {
            return { consistent: false, prunedDomains, forwardChecks };
          }

          if (!inQueue.has(neighbour)) {
            queue.push(neighbour);
            inQueue.add(neighbour);
          }
        }
      }
    }
  }

  return { consistent: true, prunedDomains, forwardChecks };
}

/**
 * Combined inference: forward checking followed by constraint propagation.
 */
export function infer(
  variable: CspVariableId,
  assignment: CspConfiguration,
  unassigned: readonly CspVariableId[],
  domains: ReadonlyMap<CspVariableId, readonly CspValue[]>,
  constraints: readonly SolvableConstraint[],
  events: EventCollector,
  depth: number,
): InferenceResult {
  // 1. Forward checking
  const fcResult = forwardCheck(
    variable,
    assignment,
    unassigned,
    domains,
    constraints,
    events,
    depth,
  );

  if (!fcResult.consistent) {
    return fcResult;
  }

  // 2. Constraint propagation from the forward-checked results
  if (fcResult.prunedDomains.size === 0) {
    // Nothing was pruned — no propagation needed.
    return fcResult;
  }

  // Merge forward-checked domains into the working domains.
  const mergedDomains = new Map(domains);
  for (const [v, d] of fcResult.prunedDomains) {
    mergedDomains.set(v, d);
  }

  const propResult = propagate(
    fcResult.prunedDomains,
    assignment,
    unassigned,
    mergedDomains,
    constraints,
    events,
    depth,
  );

  // Merge all pruned domains together.
  const allPruned = new Map(fcResult.prunedDomains);
  for (const [v, d] of propResult.prunedDomains) {
    allPruned.set(v, d);
  }

  return {
    consistent: propResult.consistent,
    prunedDomains: allPruned,
    forwardChecks: fcResult.forwardChecks + propResult.forwardChecks,
  };
}
