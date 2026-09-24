import { describe, expect, it } from "vitest";
import type {
  CspConfiguration,
  CspFeasibleSolution,
} from "../../src/csp/model/contracts.js";
import type { SolvableCspProblem } from "../../src/csp/model/evaluation.js";
import {
  InvalidHillClimbingInputError,
  optimiseHillClimbing,
} from "../../src/optimisation/hillClimbing/index.js";
import type { DeviceOperatingState, Room, Scenario } from "../../src/problem/scenario/contracts.js";

function state(id: string, effectivePower: number): DeviceOperatingState {
  return { id, effectivePower };
}

function scenario(mediumPower = 2): Scenario {
  const device = {
    id: "device-1",
    type: "generic",
    ratedPower: 3,
    operatingTime: 2,
    availableStates: [
      state("high", 3),
    state("medium", mediumPower),
      state("low", 1),
    ],
  };
  const room: Room = {
    id: "room-1",
    name: "Generic room",
    occupancy: 0,
    devices: [device],
  };
  return {
    id: "scenario-1",
    name: "Generic scenario",
    building: {
      id: "building-1",
      name: "Generic building",
      type: "generic",
      rooms: [room],
    },
    constraints: [{ id: "constraint-1", description: "state constraint" }],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

function problem(
  values: readonly string[],
  constraint: SolvableCspProblem["constraints"][number]["evaluate"] = (assignment) => ({
    constraintId: "constraint-1",
    status: "satisfied",
    assignment,
  }),
): SolvableCspProblem {
  return {
    variableIds: ["device-1"],
    domains: new Map([["device-1", values]]),
    constraints: [
      {
        constraint: {
          id: "constraint-1",
          involvedVariables: ["device-1"],
          description: "state constraint",
          evaluationSemantics: "test",
          evaluationInputs: [],
          evaluationResult: { status: "satisfied" },
        },
        evaluate: constraint,
      },
    ],
  };
}

function solution(value: string): CspFeasibleSolution {
  const configuration: CspConfiguration = { "device-1": value };
  return {
    configuration,
    assignments: [{ variable: "device-1", value }],
  };
}

const objective = {
  id: "minimise-energy",
  name: "Minimise energy",
  direction: "minimise" as const,
  evaluationBasis: "total energy",
};

describe("Simple Hill Climbing", () => {
  it("moves to the first lower-energy neighbour and then restarts evaluation", () => {
    const output = optimiseHillClimbing(
      scenario(),
      objective,
      solution("high"),
      problem(["high", "medium", "low"]),
    );
    expect(output.result.finalState.configuration).toEqual({ "device-1": "low" });
    expect(output.result.optimisedEnergy.energy).toBe(2);
    expect(output.result.energyComparison.energySaved).toBe(4);
    expect(output.result.statistics.movesAccepted).toBe(2);
    expect(output.result.statistics.iterations).toBe(2);
  });

  it("stops at a local optimum and emits events in execution order", () => {
    const output = optimiseHillClimbing(
      scenario(),
      objective,
      solution("low"),
      problem(["high", "medium", "low"]),
    );
    expect(output.result.finalState.configuration).toEqual({ "device-1": "low" });
    expect(output.result.statistics.movesAccepted).toBe(0);
    expect(output.events.map((event) => event.type)).toEqual([
      "INITIAL_STATE",
      "NEIGHBOUR_EVALUATED",
      "NEIGHBOUR_EVALUATED",
      "NO_BETTER_NEIGHBOUR",
      "OPTIMUM_FOUND",
    ]);
    expect(output.events.at(-1)?.type).toBe("OPTIMUM_FOUND");
  });

  it("does not move to equal-energy or higher-energy neighbours", () => {
    const output = optimiseHillClimbing(
      scenario(3),
      objective,
      solution("high"),
      problem(["high", "medium"]),
    );
    expect(output.result.finalState.configuration).toEqual({ "device-1": "high" });
    expect(output.result.statistics.movesAccepted).toBe(0);
    expect(
      output.events
        .filter((event) => event.type === "NEIGHBOUR_EVALUATED")
        .every((event) => event.decision === "rejected"),
    ).toBe(true);
  });

  it("rejects infeasible neighbours before objective evaluation", () => {
    let objectiveConstraintCalls = 0;
    const output = optimiseHillClimbing(
      scenario(),
      objective,
      solution("high"),
      problem(["high", "medium"], (assignment) => {
        objectiveConstraintCalls++;
        return {
          constraintId: "constraint-1",
          status: assignment["device-1"] === "high" ? "satisfied" : "violated",
          assignment,
        };
      }),
    );
    expect(output.result.finalState.configuration).toEqual({ "device-1": "high" });
    expect(output.result.statistics.neighboursEvaluated).toBe(1);
    expect(output.events.some((event) => event.type === "NEIGHBOUR_EVALUATED")).toBe(false);
    expect(objectiveConstraintCalls).toBeGreaterThan(0);
  });

  it("is deterministic and does not mutate its inputs", () => {
    const testScenario = scenario();
    const starting = solution("high");
    const scenarioBefore = JSON.stringify(testScenario);
    const startingBefore = JSON.stringify(starting);
    const first = optimiseHillClimbing(testScenario, objective, starting, problem(["high", "low"]));
    const second = optimiseHillClimbing(testScenario, objective, starting, problem(["high", "low"]));
    expect(first).toEqual(second);
    expect(JSON.stringify(testScenario)).toBe(scenarioBefore);
    expect(JSON.stringify(starting)).toBe(startingBefore);
  });

  it("rejects incomplete or infeasible starting solutions", () => {
    expect(() =>
      optimiseHillClimbing(scenario(), objective, solution("unknown"), problem(["high", "low"])),
    ).toThrow(InvalidHillClimbingInputError);
  });
});
