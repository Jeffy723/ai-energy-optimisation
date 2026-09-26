import { describe, expect, it } from "vitest";
import type {
  ConstraintEvaluationResult,
  CspConfiguration,
} from "../../src/csp/model/contracts.js";
import type {
  CspExecutionEvent,
  HillClimbingExecutionEvent,
} from "../../src/visualisation/events/contracts.js";
import { buildBacktrackingView } from "../../src/visualisation/backtracking/index.js";
import { buildHillClimbingView } from "../../src/visualisation/hillClimbing/index.js";
import { buildSearchTree } from "../../src/visualisation/searchTree/index.js";

function constraint(
  status: ConstraintEvaluationResult["status"],
  assignment: CspConfiguration,
): ConstraintEvaluationResult {
  return { constraintId: "constraint-1", status, assignment };
}

function cspEvents(): readonly CspExecutionEvent[] {
  return [
    {
      id: "e-0", type: "VARIABLE_SELECTED", step: 0, depth: 0,
      variable: "variable-a", assignment: {}, remainingValues: 2, degreeTieBreakUsed: false,
    },
    {
      id: "e-1", type: "VALUE_TRIED", step: 1, depth: 0,
      variable: "variable-a", value: "first", assignment: { "variable-a": "first" },
    },
    {
      id: "e-2", type: "CONSTRAINT_FAILED", step: 2, depth: 0,
      constraint: { ...constraint("violated", { "variable-a": "first" }), status: "violated" },
      assignment: { "variable-a": "first" }, reason: "first branch fails",
    },
    {
      id: "e-3", type: "BACKTRACK", step: 3, depth: 0,
      variable: "variable-a", value: "first",
      constraint: { ...constraint("violated", { "variable-a": "first" }), status: "violated" },
      assignment: {}, reason: "try another value",
    },
    {
      id: "e-4", type: "VALUE_TRIED", step: 4, depth: 0,
      variable: "variable-a", value: "second", assignment: { "variable-a": "second" },
    },
    {
      id: "e-5", type: "FORWARD_CHECK", step: 5, depth: 0,
      variable: "variable-a", pruningKind: "forward-checking",
      prunedValues: [{ variable: "variable-b", value: "blocked" }],
      assignment: { "variable-a": "second" },
    },
    {
      id: "e-6", type: "VARIABLE_SELECTED", step: 6, depth: 1,
      variable: "variable-b", assignment: { "variable-a": "second" }, remainingValues: 1, degreeTieBreakUsed: true,
    },
    {
      id: "e-7", type: "VALUE_TRIED", step: 7, depth: 1,
      variable: "variable-b", value: "allowed",
      assignment: { "variable-a": "second", "variable-b": "allowed" },
    },
    {
      id: "e-8", type: "SOLUTION_FOUND", step: 8, depth: 1,
      assignment: { "variable-a": "second", "variable-b": "allowed" },
      reason: "complete assignment",
    },
  ];
}

function objective(value: number) {
  return {
    objectiveId: "minimise-energy",
    configuration: { "variable-a": "value" },
    value,
    energyMeasurement: {
      configuration: { "variable-a": "value" },
      energy: value,
      unit: "kWh" as const,
    },
  };
}

function hillEvents(): readonly HillClimbingExecutionEvent[] {
  const initial = {
    configuration: { "variable-a": "high" },
    objective: objective(10),
  };
  const candidate = {
    configuration: { "variable-a": "low" },
    objective: objective(4),
    decision: "accepted" as const,
  };
  return [
    {
      id: "h-0", type: "INITIAL_STATE", iteration: 0,
      currentState: initial, currentObjective: initial.objective,
    },
    {
      id: "h-1", type: "NEIGHBOUR_EVALUATED", iteration: 0,
      currentState: initial, currentObjective: initial.objective,
      candidateState: candidate, candidateObjective: candidate.objective,
      decision: "accepted", reason: "lower energy",
    },
    {
      id: "h-2", type: "MOVE_ACCEPTED", iteration: 0,
      currentState: initial, currentObjective: initial.objective,
      candidateState: candidate, candidateObjective: candidate.objective,
    },
    {
      id: "h-3", type: "NO_BETTER_NEIGHBOUR", iteration: 1,
      currentState: { configuration: candidate.configuration, objective: candidate.objective },
      currentObjective: candidate.objective,
    },
    {
      id: "h-4", type: "OPTIMUM_FOUND", iteration: 1,
      currentState: { configuration: candidate.configuration, objective: candidate.objective },
      currentObjective: candidate.objective,
    },
  ];
}

describe("CSP visualisation transformations", () => {
  it("builds a root, preserves event order, branches, and solution data", () => {
    const view = buildSearchTree(cspEvents());
    expect(view.root.type).toBe("ROOT");
    expect(view.eventOrder).toEqual(cspEvents().map((event) => event.id));
    expect(view.root.children[0]?.type).toBe("VARIABLE_SELECTED");
    expect(view.root.children[0]?.children.map((node) => node.type)).toContain("VALUE_TRIED");
    expect(JSON.stringify(view)).toContain("SOLUTION_FOUND");
    const nodes: typeof view.root[] = [];
    const visit = (node: typeof view.root): void => {
      nodes.push(node);
      node.children.forEach(visit);
    };
    visit(view.root);
    expect(nodes.some((node) => node.type === "BACKTRACK")).toBe(true);
  });

  it("retains constraint failure and pruning metadata", () => {
    const view = buildSearchTree(cspEvents());
    const allNodes: typeof view.root[] = [];
    const visit = (node: typeof view.root): void => {
      allNodes.push(node);
      node.children.forEach(visit);
    };
    visit(view.root);
    expect(allNodes.find((node) => node.type === "CONSTRAINT_FAILED")?.reason).toBe("first branch fails");
    expect(allNodes.find((node) => node.type === "FORWARD_CHECK")?.prunedValues).toEqual([
      { variable: "variable-b", value: "blocked" },
    ]);
  });

  it("handles empty input and repeated processing deterministically without mutation", () => {
    expect(buildSearchTree([]).eventOrder).toEqual([]);
    const events = cspEvents();
    const before = JSON.stringify(events);
    expect(buildSearchTree(events)).toEqual(buildSearchTree(events));
    expect(JSON.stringify(events)).toBe(before);
  });
});

describe("backtracking visualisation transformation", () => {
  it("records failures, backtracks, locations, and reasons in event order", () => {
    const view = buildBacktrackingView(cspEvents());
    expect(view.records.map((record) => record.type)).toEqual([
      "CONSTRAINT_FAILED",
      "BACKTRACK",
    ]);
    expect(view.failureEventIds).toEqual(["e-2"]);
    expect(view.backtrackEventIds).toEqual(["e-3"]);
    expect(view.records[1]?.variable).toBe("variable-a");
    expect(view.records[1]?.value).toBe("first");
  });
});

describe("Hill Climbing visualisation transformation", () => {
  it("preserves event order, objective values, decisions, and final state", () => {
    const events = hillEvents();
    const view = buildHillClimbingView(events);
    expect(view.records.map((record) => record.eventId)).toEqual(events.map((event) => event.id));
    expect(view.records.map((record) => record.type)).toEqual([
      "INITIAL_STATE",
      "NEIGHBOUR_EVALUATED",
      "MOVE_ACCEPTED",
      "NO_BETTER_NEIGHBOUR",
      "OPTIMUM_FOUND",
    ]);
    expect(view.records[1]?.candidateObjective?.value).toBe(4);
    expect(view.records[1]?.decision).toBe("accepted");
    expect(view.finalState?.objective.value).toBe(4);
  });

  it("supports empty input and does not mutate events or nested states", () => {
    expect(buildHillClimbingView([])).toEqual({ records: [] });
    const events = hillEvents();
    const before = JSON.stringify(events);
    const view = buildHillClimbingView(events);
    (view.records[0]!.currentState.configuration as Record<string, string>)["variable-a"] = "changed";
    expect(JSON.stringify(events)).toBe(before);
  });
});
