import { describe, expect, it } from "vitest";
import type { CspConfiguration, CspValue } from "../../src/csp/model/contracts.js";
import type { SolvableConstraint } from "../../src/csp/model/evaluation.js";
import { selectVariableWithDetails } from "../../src/csp/heuristics/variableOrdering.js";
import { orderValues } from "../../src/csp/heuristics/valueOrdering.js";
import { solve } from "../../src/csp/solver/engine.js";

function linkedConstraint(id: string, ...variables: string[]): SolvableConstraint {
  return {
    constraint: {
      id,
      involvedVariables: variables,
      description: `${variables.join(" relates to ")}`,
      evaluationSemantics: "test-link",
      evaluationInputs: variables,
      evaluationResult: { status: "undecided" },
    },
    evaluate: (assignment: CspConfiguration) => ({
      constraintId: id,
      status: "satisfied",
      assignment,
    }),
  };
}

function select(
  variables: string[],
  constraints: SolvableConstraint[],
  domains: Record<string, CspValue[]> = {
    A: ["one", "two"],
    B: ["one", "two"],
    C: ["one", "two"],
  },
) {
  return selectVariableWithDetails(
    variables,
    new Map(Object.entries(domains)),
    constraints,
  );
}

describe("MRV and Degree variable ordering", () => {
  it("does not evaluate or report Degree when MRV has one candidate", () => {
    const selected = select(
      ["A", "B"],
      [linkedConstraint("ab", "A", "B")],
      { A: ["one"], B: ["one", "two"] },
    );

    expect(selected?.variable).toBe("A");
    expect(selected?.degreeTieBreakUsed).toBe(false);
    expect(selected?.mrvTie).toBeUndefined();
  });

  it("uses distinct unassigned neighbours to resolve an MRV tie", () => {
    const selected = select(
      ["B", "C", "A"],
      [linkedConstraint("ab", "A", "B"), linkedConstraint("ac", "A", "C")],
    );

    expect(selected?.variable).toBe("A");
    expect(selected?.degreeTieBreakUsed).toBe(true);
    expect(selected?.mrvTie).toEqual({
      candidates: [
        { variable: "B", remainingValues: 2, degree: 1 },
        { variable: "C", remainingValues: 2, degree: 1 },
        { variable: "A", remainingValues: 2, degree: 2 },
      ],
      selectedVariable: "A",
      reason: "Selected the highest-degree MRV candidate (2)",
    });
  });

  it("does not fabricate a Degree winner when tied candidates have equal degrees", () => {
    const selected = select(
      ["C", "B", "A"],
      [
        linkedConstraint("ab", "A", "B"),
        linkedConstraint("bc", "B", "C"),
        linkedConstraint("ca", "C", "A"),
      ],
    );

    expect(selected?.variable).toBe("C");
    expect(selected?.degreeTieBreakUsed).toBe(false);
    expect(selected?.mrvTie?.selectedVariable).toBeUndefined();
    expect(selected?.mrvTie?.reason).toBe(
      "All MRV candidates have degree 2; retained input order",
    );
  });

  it("counts each neighbouring variable once across repeated constraints", () => {
    const selected = select(
      ["B", "C", "A"],
      [
        linkedConstraint("ab-1", "A", "B"),
        linkedConstraint("ab-2", "A", "B"),
        linkedConstraint("ac", "A", "C"),
      ],
    );

    expect(selected?.variable).toBe("A");
    expect(selected?.mrvTie?.candidates).toEqual([
      { variable: "B", remainingValues: 2, degree: 1 },
      { variable: "C", remainingValues: 2, degree: 1 },
      { variable: "A", remainingValues: 2, degree: 2 },
    ]);
  });

  it("counts distinct neighbours in n-ary constraints", () => {
    const selected = select(
      ["B", "C", "D", "E", "A"],
      [
        linkedConstraint("abc", "A", "B", "C"),
        linkedConstraint("ade", "A", "D", "E"),
      ],
      Object.fromEntries(["A", "B", "C", "D", "E"].map((id) => [id, ["one", "two"]])),
    );

    expect(selected?.variable).toBe("A");
    expect(selected?.mrvTie?.candidates.find((candidate) => candidate.variable === "A")?.degree).toBe(4);
  });

  it("uses n-ary support when ordering values with LCV", () => {
    const variables = ["A", "B", "C"];
    const domains = new Map<string, CspValue[]>([
      ["A", ["red", "blue"]],
      ["B", ["red"]],
      ["C", ["red"]],
    ]);
    const constraint: SolvableConstraint = {
      constraint: {
        id: "not-all-red",
        involvedVariables: variables,
        description: "At least one variable must not be red",
        evaluationSemantics: "n-ary",
        evaluationInputs: variables,
        evaluationResult: { status: "undecided" },
      },
      evaluate: (assignment) => {
        if (variables.some((id) => assignment[id] === undefined)) {
          return { constraintId: "not-all-red", status: "undecided", assignment };
        }
        const violated = variables.every((id) => assignment[id] === "red");
        return {
          constraintId: "not-all-red",
          status: violated ? "violated" : "satisfied",
          assignment,
        };
      },
    };

    expect(orderValues("A", ["red", "blue"], {}, ["B", "C"], domains, [constraint]))
      .toEqual(["blue", "red"]);
  });

  it("records tie scores in the solver event and selects the actual highest-degree variable", () => {
    const variables = ["light", "fan", "ac"];
    const domains = new Map(variables.map((variable) => [variable, ["off", "on"]]));
    const constraints = [
      linkedConstraint("ac-light", "ac", "light"),
      linkedConstraint("ac-fan", "ac", "fan"),
    ];
    const { events } = solve({ variableIds: variables, domains, constraints });
    const selected = events.find((event) => event.type === "VARIABLE_SELECTED");

    expect(selected?.type).toBe("VARIABLE_SELECTED");
    if (selected?.type === "VARIABLE_SELECTED") {
      expect(selected.variable).toBe("ac");
      expect(selected.degreeTieBreakUsed).toBe(true);
      expect(selected.mrvTie?.candidates).toEqual([
        { variable: "light", remainingValues: 2, degree: 1 },
        { variable: "fan", remainingValues: 2, degree: 1 },
        { variable: "ac", remainingValues: 2, degree: 2 },
      ]);
      expect(selected.reason).toContain("Degree selected ac");
    }
  });

  it("keeps the deterministic input-order choice for equal-degree MRV ties in solver events", () => {
    const { events } = solve({
      variableIds: ["C", "B", "A"],
      domains: new Map(["C", "B", "A"].map((variable) => [variable, ["one", "two"]])),
      constraints: [
        linkedConstraint("ab", "A", "B"),
        linkedConstraint("bc", "B", "C"),
        linkedConstraint("ca", "C", "A"),
      ],
    });
    const selected = events.find((event) => event.type === "VARIABLE_SELECTED");

    expect(selected?.type).toBe("VARIABLE_SELECTED");
    if (selected?.type === "VARIABLE_SELECTED") {
      expect(selected.variable).toBe("C");
      expect(selected.degreeTieBreakUsed).toBe(false);
      expect(selected.mrvTie?.selectedVariable).toBeUndefined();
      expect(selected.reason).toContain("MRV selected C");
    }
  });
});
