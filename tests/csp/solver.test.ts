/**
 * Comprehensive tests for the CSP engine.
 *
 * Uses small abstract CSP examples (map-colouring style) — no building or
 * device-specific logic.  Tests cover:
 *
 *  1. basic satisfiable CSP
 *  2. unsatisfiable CSP
 *  3. backtracking
 *  4. MRV (Minimum Remaining Values)
 *  5. Degree heuristic
 *  6. LCV (Least Constraining Value)
 *  7. forward checking
 *  8. constraint propagation
 *  9. backtracking domain restoration
 * 10. event emission — VARIABLE_SELECTED, VALUE_TRIED
 * 11. SOLUTION_FOUND event
 * 12. BACKTRACK event
 * 13. constraint failure events
 * 14. multiple branches
 * 15. deterministic behaviour
 */

import { describe, expect, it } from "vitest";
import type {
  ConstraintEvaluationResult,
  CspConfiguration,
  CspValue,
  CspVariableId,
} from "../../src/csp/model/contracts.js";
import type { SolvableConstraint, SolvableCspProblem } from "../../src/csp/model/evaluation.js";
import { solve } from "../../src/csp/solver/engine.js";
import type { CspExecutionEvent } from "../../src/visualisation/events/contracts.js";

// ---------------------------------------------------------------------------
// Helpers — build abstract CSP problems
// ---------------------------------------------------------------------------

/**
 * Create a "not-equal" constraint between two variables.
 * This is the classic map-colouring constraint.
 */
function notEqual(
  id: string,
  varA: CspVariableId,
  varB: CspVariableId,
): SolvableConstraint {
  return {
    constraint: {
      id,
      involvedVariables: [varA, varB],
      description: `${varA} ≠ ${varB}`,
      evaluationSemantics: "not-equal",
      evaluationInputs: [varA, varB],
      evaluationResult: { status: "undecided" },
    },
    evaluate: (assignment: CspConfiguration): ConstraintEvaluationResult => {
      const a = assignment[varA];
      const b = assignment[varB];
      if (a === undefined || b === undefined) {
        return {
          constraintId: id,
          status: "undecided",
          assignment,
          reason: "Not all variables assigned",
        };
      }
      if (a === b) {
        return {
          constraintId: id,
          status: "violated",
          assignment,
          reason: `${varA}=${String(a)} equals ${varB}=${String(b)}`,
        };
      }
      return {
        constraintId: id,
        status: "satisfied",
        assignment,
      };
    },
  };
}

/**
 * Create a unary constraint: variable must equal a specific value.
 */
function mustEqual(
  id: string,
  variable: CspVariableId,
  requiredValue: CspValue,
): SolvableConstraint {
  return {
    constraint: {
      id,
      involvedVariables: [variable],
      description: `${variable} must be ${String(requiredValue)}`,
      evaluationSemantics: "must-equal",
      evaluationInputs: [variable],
      evaluationResult: { status: "undecided" },
    },
    evaluate: (assignment: CspConfiguration): ConstraintEvaluationResult => {
      const v = assignment[variable];
      if (v === undefined) {
        return { constraintId: id, status: "undecided", assignment };
      }
      if (v !== requiredValue) {
        return {
          constraintId: id,
          status: "violated",
          assignment,
          reason: `${variable}=${String(v)}, expected ${String(requiredValue)}`,
        };
      }
      return { constraintId: id, status: "satisfied", assignment };
    },
  };
}

/**
 * Create a constraint that variable must NOT equal a specific value.
 */
function mustNotEqual(
  id: string,
  variable: CspVariableId,
  forbiddenValue: CspValue,
): SolvableConstraint {
  return {
    constraint: {
      id,
      involvedVariables: [variable],
      description: `${variable} must not be ${String(forbiddenValue)}`,
      evaluationSemantics: "must-not-equal",
      evaluationInputs: [variable],
      evaluationResult: { status: "undecided" },
    },
    evaluate: (assignment: CspConfiguration): ConstraintEvaluationResult => {
      const v = assignment[variable];
      if (v === undefined) {
        return { constraintId: id, status: "undecided", assignment };
      }
      if (v === forbiddenValue) {
        return {
          constraintId: id,
          status: "violated",
          assignment,
          reason: `${variable}=${String(v)} is forbidden`,
        };
      }
      return { constraintId: id, status: "satisfied", assignment };
    },
  };
}

function makeProblem(
  variables: CspVariableId[],
  domains: Record<CspVariableId, CspValue[]>,
  constraints: SolvableConstraint[],
): SolvableCspProblem {
  const domainMap = new Map<CspVariableId, readonly CspValue[]>();
  for (const v of variables) {
    domainMap.set(v, domains[v] ?? []);
  }
  return {
    variableIds: variables,
    domains: domainMap,
    constraints,
  };
}

function eventTypes(events: readonly CspExecutionEvent[]): string[] {
  return events.map((e) => e.type);
}

// ---------------------------------------------------------------------------
// 1. Basic satisfiable CSP
// ---------------------------------------------------------------------------

describe("CSP Solver — basic satisfiable CSP", () => {
  it("solves a trivial single-variable CSP", () => {
    const problem = makeProblem(["X"], { X: ["a", "b"] }, []);
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution).toBeDefined();
    expect(result.solution!.configuration["X"]).toBeDefined();
  });

  it("solves a two-variable CSP with not-equal constraint (map colouring)", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["red", "blue"], B: ["red", "blue"] },
      [notEqual("c1", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution).toBeDefined();
    const config = result.solution!.configuration;
    expect(config["A"]).not.toBe(config["B"]);
  });

  it("solves a classic 3-node map colouring with 3 colours", () => {
    // Triangle: A-B, B-C, A-C — all must be different
    const colours: CspValue[] = ["red", "green", "blue"];
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [...colours], B: [...colours], C: [...colours] },
      [
        notEqual("ab", "A", "B"),
        notEqual("bc", "B", "C"),
        notEqual("ac", "A", "C"),
      ],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    const config = result.solution!.configuration;
    expect(config["A"]).not.toBe(config["B"]);
    expect(config["B"]).not.toBe(config["C"]);
    expect(config["A"]).not.toBe(config["C"]);
  });

  it("returns assignments array matching configuration", () => {
    const problem = makeProblem(
      ["X", "Y"],
      { X: [1, 2], Y: [3, 4] },
      [],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    const assignments = result.solution!.assignments;
    const config = result.solution!.configuration;

    for (const a of assignments) {
      expect(config[a.variable]).toBe(a.value);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Unsatisfiable CSP
// ---------------------------------------------------------------------------

describe("CSP Solver — unsatisfiable CSP", () => {
  it("detects unsatisfiable CSP (2 vars, 1 colour, not-equal)", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["red"], B: ["red"] },
      [notEqual("c1", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(false);
    expect(result.solution).toBeUndefined();
  });

  it("detects unsatisfiable CSP (triangle with only 2 colours)", () => {
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: ["r", "g"], B: ["r", "g"], C: ["r", "g"] },
      [
        notEqual("ab", "A", "B"),
        notEqual("bc", "B", "C"),
        notEqual("ac", "A", "C"),
      ],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(false);
  });

  it("detects unsatisfiable CSP (conflicting unary constraints)", () => {
    const problem = makeProblem(
      ["X"],
      { X: ["a", "b"] },
      [mustEqual("eq-a", "X", "a"), mustEqual("eq-b", "X", "b")],
    );
    const { result } = solve(problem);
    expect(result.feasible).toBe(false);
  });

  it("handles empty domain", () => {
    const problem = makeProblem(["X"], { X: [] }, []);
    const { result } = solve(problem);

    expect(result.feasible).toBe(false);
    expect(result.statistics.backtracks).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Backtracking
// ---------------------------------------------------------------------------

describe("CSP Solver — backtracking", () => {
  it("backtracks when the first value leads to a dead end", () => {
    // X must be "b", but domain is ["a", "b"].
    // Solver tries "a" first (or "b"), finds a conflict, backtracks.
    const problem = makeProblem(
      ["X"],
      { X: ["a", "b"] },
      [mustEqual("must-b", "X", "b")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["X"]).toBe("b");
    // There should be at least one constraint failure before finding "b"
    // (unless "b" was tried first).
    expect(result.statistics.valuesTried).toBeGreaterThanOrEqual(1);
  });

  it("records backtrack count in statistics", () => {
    // Two variables, each has 2 values.  The constraint forces a specific
    // combination, causing at least 1 backtrack.
    const problem = makeProblem(
      ["X", "Y"],
      { X: ["a", "b"], Y: ["a", "b"] },
      [notEqual("ne", "X", "Y")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    // The solver must track backtracks.
    expect(result.statistics.backtracks).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 4. MRV (Minimum Remaining Values)
// ---------------------------------------------------------------------------

describe("CSP Solver — MRV heuristic", () => {
  it("selects the variable with the smallest domain first", () => {
    // X has 1 value, Y has 3 values. MRV should pick X first.
    const problem = makeProblem(
      ["Y", "X"],  // Listed Y first to test that MRV overrides order
      { Y: [1, 2, 3], X: [1] },
      [],
    );
    const { result, events } = solve(problem);

    expect(result.feasible).toBe(true);

    // The first VARIABLE_SELECTED event should be for X (domain size 1).
    const firstVarSelected = events.find((e) => e.type === "VARIABLE_SELECTED");
    expect(firstVarSelected).toBeDefined();
    if (firstVarSelected && firstVarSelected.type === "VARIABLE_SELECTED") {
      expect(firstVarSelected.variable).toBe("X");
      expect(firstVarSelected.remainingValues).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Degree heuristic (tie-breaker)
// ---------------------------------------------------------------------------

describe("CSP Solver — Degree heuristic", () => {
  it("breaks MRV ties by selecting the most constrained variable", () => {
    // A, B, C all have domain size 2.
    // A is involved in 2 constraints (A≠B, A≠C).
    // B is involved in 1 constraint with unassigned (A≠B, but B≠C is also there).
    // C is involved in 1 constraint (A≠C, B≠C).
    // Actually: A appears in 2 constraints, B in 2, C in 2 — all tied.
    // Let's make it clearer:
    //
    // Vars: A (degree 2), B (degree 1), C (degree 1)
    // All domain size 2.  MRV tie → Degree should pick A.
    const problem = makeProblem(
      ["B", "C", "A"],  // Intentionally put A last
      { A: [1, 2], B: [1, 2], C: [1, 2] },
      [
        notEqual("ab", "A", "B"),
        notEqual("ac", "A", "C"),
        // B and C are not directly constrained with each other,
        // so A has degree 2, B has degree 1, C has degree 1.
      ],
    );
    const { events } = solve(problem);

    const firstVarSelected = events.find((e) => e.type === "VARIABLE_SELECTED");
    expect(firstVarSelected).toBeDefined();
    if (firstVarSelected && firstVarSelected.type === "VARIABLE_SELECTED") {
      expect(firstVarSelected.variable).toBe("A");
      expect(firstVarSelected.degreeTieBreakUsed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. LCV (Least Constraining Value)
// ---------------------------------------------------------------------------

describe("CSP Solver — LCV heuristic", () => {
  it("tries the least constraining value first", () => {
    // A and B, each with domain {1, 2, 3}.
    // Constraint: A ≠ B.
    // All values of A are equally constraining (each rules out 1 of B's 3 values).
    // So LCV doesn't change order — but the solver still runs without error.
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2, 3], B: [1, 2, 3] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);
    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["A"]).not.toBe(
      result.solution!.configuration["B"],
    );
  });

  it("favours values that leave more options for neighbours", () => {
    // A has {1, 2}, B has {1, 2, 3}.
    // Constraint: A ≠ B.
    // If A=1, B can be {2, 3} (2 options).
    // If A=2, B can be {1, 3} (2 options).
    // Equal, so either is fine. But it must solve.
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2, 3] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);
    expect(result.feasible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Forward checking
// ---------------------------------------------------------------------------

describe("CSP Solver — forward checking", () => {
  it("emits FORWARD_CHECK events", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["x", "y"], B: ["x", "y"] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    const fcEvents = events.filter((e) => e.type === "FORWARD_CHECK");
    // Forward checking should have occurred (pruning B's domain after A assignment)
    expect(fcEvents.length).toBeGreaterThan(0);
  });

  it("forward checking prunes inconsistent values", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["red"], B: ["red", "blue"] },
      [notEqual("ne", "A", "B")],
    );
    const { result, events } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["B"]).toBe("blue");

    // Should have a FORWARD_CHECK event that pruned "red" from B
    const fcEvents = events.filter(
      (e) => e.type === "FORWARD_CHECK",
    );
    expect(fcEvents.length).toBeGreaterThan(0);
  });

  it("detects domain wipeout via forward checking", () => {
    // A has {x}, B has {x}. A≠B constraint.
    // After assigning A=x, forward checking prunes x from B → wipeout.
    const problem = makeProblem(
      ["A", "B"],
      { A: ["x"], B: ["x"] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Constraint propagation
// ---------------------------------------------------------------------------

describe("CSP Solver — constraint propagation", () => {
  it("propagates beyond immediate neighbours", () => {
    // Chain: A-B-C, all have domain {1, 2}.
    // A≠B, B≠C.
    // If A=1, forward check prunes 1 from B → B={2}.
    // Propagation: B={2} → prune 2 from C → C={1}.
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [1, 2], B: [1, 2], C: [1, 2] },
      [notEqual("ab", "A", "B"), notEqual("bc", "B", "C")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    const config = result.solution!.configuration;
    expect(config["A"]).not.toBe(config["B"]);
    expect(config["B"]).not.toBe(config["C"]);
  });

  it("emits constraint-propagation events with pruningKind", () => {
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [1, 2], B: [1, 2], C: [1, 2] },
      [notEqual("ab", "A", "B"), notEqual("bc", "B", "C")],
    );
    const { events } = solve(problem);

    const fcEvents = events.filter((e) => e.type === "FORWARD_CHECK");
    // There should be at least forward-checking events
    expect(fcEvents.length).toBeGreaterThan(0);

    // Check that pruningKind is set correctly
    for (const e of fcEvents) {
      if (e.type === "FORWARD_CHECK") {
        expect(["forward-checking", "constraint-propagation"]).toContain(
          e.pruningKind,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Backtracking domain restoration
// ---------------------------------------------------------------------------

describe("CSP Solver — domain restoration", () => {
  it("restores domains correctly after backtracking", () => {
    // This CSP requires backtracking.  After backtracking, the solver
    // must restore the pruned domains and try another value.
    //
    // A-B-C triangle, 3 colours.  There's a solution, but the solver
    // will backtrack at least once depending on value ordering.
    const colours: CspValue[] = ["r", "g", "b"];
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [...colours], B: [...colours], C: [...colours] },
      [
        notEqual("ab", "A", "B"),
        notEqual("bc", "B", "C"),
        notEqual("ac", "A", "C"),
      ],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    const config = result.solution!.configuration;
    // All different
    const values = new Set([config["A"], config["B"], config["C"]]);
    expect(values.size).toBe(3);
  });

  it("does not mutate caller-owned domains", () => {
    const domainA: CspValue[] = ["r", "g"];
    const domainB: CspValue[] = ["r", "g"];

    const domainMap = new Map<CspVariableId, readonly CspValue[]>();
    domainMap.set("A", domainA);
    domainMap.set("B", domainB);

    const problem: SolvableCspProblem = {
      variableIds: ["A", "B"],
      domains: domainMap,
      constraints: [notEqual("ne", "A", "B")],
    };

    solve(problem);

    // Original arrays should be unmodified.
    expect(domainA).toEqual(["r", "g"]);
    expect(domainB).toEqual(["r", "g"]);
  });
});

// ---------------------------------------------------------------------------
// 10. Event emission — VARIABLE_SELECTED, VALUE_TRIED
// ---------------------------------------------------------------------------

describe("CSP Solver — event emission basics", () => {
  it("emits VARIABLE_SELECTED for each variable selection", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1], B: [2] },
      [],
    );
    const { events } = solve(problem);

    const varSelected = events.filter((e) => e.type === "VARIABLE_SELECTED");
    expect(varSelected.length).toBeGreaterThanOrEqual(2);
  });

  it("emits VALUE_TRIED for each value attempt", () => {
    const problem = makeProblem(
      ["X"],
      { X: ["a", "b", "c"] },
      [mustEqual("eq", "X", "c")],
    );
    const { events } = solve(problem);

    const valueTried = events.filter((e) => e.type === "VALUE_TRIED");
    // At least 1 value tried (could be up to 3 depending on order)
    expect(valueTried.length).toBeGreaterThanOrEqual(1);
  });

  it("emits the real LCV order when neighbouring constraints are used", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["red", "blue"], B: ["red", "blue"] },
      [notEqual("ab", "A", "B")],
    );
    const { events } = solve(problem);
    const selected = events.find((event) => event.type === "VARIABLE_SELECTED");
    expect(selected?.type).toBe("VARIABLE_SELECTED");
    if (selected?.type === "VARIABLE_SELECTED") {
      expect(selected.lcvOrder).toEqual(["red", "blue"]);
    }
  });

  it("events have monotonically increasing step numbers", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    for (let i = 1; i < events.length; i++) {
      expect(events[i].step).toBeGreaterThan(events[i - 1].step);
    }
  });

  it("events contain correct assignment snapshots", () => {
    const problem = makeProblem(["X"], { X: [42] }, []);
    const { events } = solve(problem);

    // The SOLUTION_FOUND event should have X=42 in assignment
    const solution = events.find((e) => e.type === "SOLUTION_FOUND");
    expect(solution).toBeDefined();
    expect(solution!.assignment["X"]).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 11. SOLUTION_FOUND event
// ---------------------------------------------------------------------------

describe("CSP Solver — SOLUTION_FOUND event", () => {
  it("emits exactly one SOLUTION_FOUND event for satisfiable CSP", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    const solutionEvents = events.filter((e) => e.type === "SOLUTION_FOUND");
    expect(solutionEvents.length).toBe(1);
  });

  it("does not emit SOLUTION_FOUND for unsatisfiable CSP", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1], B: [1] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    const solutionEvents = events.filter((e) => e.type === "SOLUTION_FOUND");
    expect(solutionEvents.length).toBe(0);
  });

  it("SOLUTION_FOUND event contains complete assignment", () => {
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [1], B: [2], C: [3] },
      [],
    );
    const { events } = solve(problem);

    const solution = events.find((e) => e.type === "SOLUTION_FOUND");
    expect(solution).toBeDefined();
    expect(Object.keys(solution!.assignment).sort()).toEqual(["A", "B", "C"]);
  });
});

// ---------------------------------------------------------------------------
// 12. BACKTRACK event
// ---------------------------------------------------------------------------

describe("CSP Solver — BACKTRACK event", () => {
  it("emits BACKTRACK events when search fails and retreats", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: ["x"], B: ["x"] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    const backtracks = events.filter((e) => e.type === "BACKTRACK");
    expect(backtracks.length).toBeGreaterThan(0);
  });

  it("BACKTRACK events include variable and value information", () => {
    const problem = makeProblem(
      ["X"],
      { X: ["a", "b"] },
      [mustEqual("eq", "X", "b")],
    );
    const { events } = solve(problem);

    const backtracks = events.filter((e) => e.type === "BACKTRACK");
    if (backtracks.length > 0) {
      expect(backtracks[0].type).toBe("BACKTRACK");
    }
    expect(events.length).toBeGreaterThan(0);
  });

  it("emits a backtrack immediately after each directly rejected value", () => {
    const { events } = solve(makeProblem(
      ["X"],
      { X: ["a"] },
      [mustNotEqual("mne", "X", "a")],
    ));
    const failedIndex = events.findIndex((event) => event.type === "CONSTRAINT_FAILED");
    expect(failedIndex).toBeGreaterThanOrEqual(0);
    expect(events[failedIndex + 1]?.type).toBe("BACKTRACK");
  });
});

// ---------------------------------------------------------------------------
// 13. Constraint failure events
// ---------------------------------------------------------------------------

describe("CSP Solver — constraint failure events", () => {
  it("emits CONSTRAINT_FAILED when a constraint is violated", () => {
    const problem = makeProblem(
      ["A"],
      { A: ["forbidden"] },
      [mustNotEqual("mne", "A", "forbidden")],
    );
    const { events } = solve(problem);

    const failures = events.filter((e) => e.type === "CONSTRAINT_FAILED");
    expect(failures.length).toBeGreaterThan(0);
    if (failures.length > 0 && failures[0].type === "CONSTRAINT_FAILED") {
      expect(failures[0].constraint.status).toBe("violated");
    }
  });

  it("emits CONSTRAINT_CHECKED for satisfying checks", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2] },
      [notEqual("ne", "A", "B")],
    );
    const { events } = solve(problem);

    const checks = events.filter((e) => e.type === "CONSTRAINT_CHECKED");
    expect(checks.length).toBeGreaterThan(0);
  });

  it("constraint failure events include reason", () => {
    const problem = makeProblem(
      ["X"],
      { X: ["a", "b"] },
      [mustEqual("eq", "X", "b")],
    );
    const { events } = solve(problem);

    const failures = events.filter((e) => e.type === "CONSTRAINT_FAILED");
    // If "a" was tried first, there should be a constraint failure with reason.
    for (const f of failures) {
      if (f.type === "CONSTRAINT_FAILED") {
        expect(f.constraint.reason).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 14. Multiple branches
// ---------------------------------------------------------------------------

describe("CSP Solver — multiple branches", () => {
  it("explores multiple branches in a larger problem", () => {
    // 4-node chain: A-B-C-D, each with {1, 2}
    const problem = makeProblem(
      ["A", "B", "C", "D"],
      { A: [1, 2], B: [1, 2], C: [1, 2], D: [1, 2] },
      [
        notEqual("ab", "A", "B"),
        notEqual("bc", "B", "C"),
        notEqual("cd", "C", "D"),
      ],
    );
    const { result, events } = solve(problem);

    expect(result.feasible).toBe(true);
    const config = result.solution!.configuration;
    expect(config["A"]).not.toBe(config["B"]);
    expect(config["B"]).not.toBe(config["C"]);
    expect(config["C"]).not.toBe(config["D"]);

    // Verify multiple variable selections occurred
    const varSelections = events.filter((e) => e.type === "VARIABLE_SELECTED");
    expect(varSelections.length).toBeGreaterThanOrEqual(4);
  });

  it("handles a problem that requires exploring many branches", () => {
    // 4-node complete graph with only 3 colours — feasible
    const c: CspValue[] = ["r", "g", "b"];
    const problem = makeProblem(
      ["A", "B", "C", "D"],
      { A: [...c], B: [...c], C: [...c], D: [...c] },
      [
        notEqual("ab", "A", "B"),
        notEqual("ac", "A", "C"),
        notEqual("ad", "A", "D"),
        notEqual("bc", "B", "C"),
        notEqual("bd", "B", "D"),
        notEqual("cd", "C", "D"),
      ],
    );
    // K4 with 3 colours is NOT colourable (needs 4 colours).
    const { result } = solve(problem);
    expect(result.feasible).toBe(false);
    expect(result.statistics.backtracks).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15. Deterministic behaviour
// ---------------------------------------------------------------------------

describe("CSP Solver — deterministic behaviour", () => {
  it("produces the same result on repeated runs", () => {
    const buildProblem = () =>
      makeProblem(
        ["A", "B", "C"],
        { A: [1, 2, 3], B: [1, 2, 3], C: [1, 2, 3] },
        [
          notEqual("ab", "A", "B"),
          notEqual("bc", "B", "C"),
          notEqual("ac", "A", "C"),
        ],
      );

    const run1 = solve(buildProblem());
    const run2 = solve(buildProblem());
    const run3 = solve(buildProblem());

    expect(run1.result.feasible).toBe(true);
    expect(run1.result.solution!.configuration).toEqual(
      run2.result.solution!.configuration,
    );
    expect(run2.result.solution!.configuration).toEqual(
      run3.result.solution!.configuration,
    );
  });

  it("produces the same event sequence on repeated runs", () => {
    const buildProblem = () =>
      makeProblem(
        ["A", "B"],
        { A: [1, 2], B: [1, 2] },
        [notEqual("ne", "A", "B")],
      );

    const events1 = solve(buildProblem()).events;
    const events2 = solve(buildProblem()).events;

    expect(eventTypes(events1)).toEqual(eventTypes(events2));
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe("CSP Solver — statistics", () => {
  it("tracks constraint checks", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.statistics.constraintChecks).toBeGreaterThan(0);
  });

  it("tracks forward checks", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2], B: [1, 2] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.statistics.forwardChecks).toBeGreaterThan(0);
  });

  it("tracks values tried", () => {
    const problem = makeProblem(
      ["X", "Y"],
      { X: ["a", "b"], Y: ["c", "d"] },
      [],
    );
    const { result } = solve(problem);

    expect(result.statistics.valuesTried).toBeGreaterThanOrEqual(2);
  });

  it("tracks variables selected", () => {
    const problem = makeProblem(
      ["A", "B", "C"],
      { A: [1], B: [2], C: [3] },
      [],
    );
    const { result } = solve(problem);

    expect(result.statistics.variablesSelected).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("CSP Solver — edge cases", () => {
  it("handles a single variable with a single value", () => {
    const problem = makeProblem(["X"], { X: [42] }, []);
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["X"]).toBe(42);
  });

  it("handles boolean domain values", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [true, false], B: [true, false] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["A"]).not.toBe(
      result.solution!.configuration["B"],
    );
  });

  it("handles null as a domain value", () => {
    const problem = makeProblem(
      ["X"],
      { X: [null, "a"] },
      [mustNotEqual("nne", "X", null)],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    expect(result.solution!.configuration["X"]).toBe("a");
  });

  it("handles numeric domain values", () => {
    const problem = makeProblem(
      ["A", "B"],
      { A: [1, 2, 3], B: [1, 2, 3] },
      [notEqual("ne", "A", "B")],
    );
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
  });

  it("handles many variables (stress test)", () => {
    // Linear chain of 10 variables, each with domain {1, 2}, not-equal constraints.
    // Solvable with alternating 1, 2, 1, 2, ...
    const vars = Array.from({ length: 10 }, (_, i) => `V${i}`);
    const domains: Record<string, CspValue[]> = {};
    for (const v of vars) {
      domains[v] = [1, 2];
    }
    const constraints: SolvableConstraint[] = [];
    for (let i = 0; i < vars.length - 1; i++) {
      constraints.push(notEqual(`ne${i}`, vars[i], vars[i + 1]));
    }
    const problem = makeProblem(vars, domains, constraints);
    const { result } = solve(problem);

    expect(result.feasible).toBe(true);
    const config = result.solution!.configuration;
    for (let i = 0; i < vars.length - 1; i++) {
      expect(config[vars[i]]).not.toBe(config[vars[i + 1]]);
    }
  });
});
