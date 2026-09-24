import { describe, expect, it } from "vitest";
import { solve } from "../../src/csp/solver/engine.js";
import {
  adaptScenarioConstraint,
  createSolvableCspProblem,
} from "../../src/csp/model/scenarioAdapter.js";
import type { Scenario, ScenarioConstraint } from "../../src/problem/scenario/contracts.js";

function scenarioWith(
  constraint: ScenarioConstraint,
  occupancy = 0,
): Scenario {
  return {
    id: "scenario",
    name: "Generic scenario",
    building: {
      id: "building",
      name: "Building",
      type: "generic",
      rooms: [
        {
          id: "room",
          name: "Room",
          occupancy,
          devices: [
            {
              id: "device",
              type: "generic-device",
              ratedPower: 2,
              operatingTime: 1,
              availableStates: [
                { id: "off", effectivePower: 0 },
                { id: "active", effectivePower: 2 },
              ],
            },
          ],
        },
      ],
    },
    constraints: [constraint],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

const forbidActive: ScenarioConstraint = {
  id: "forbid-active",
  description: "The active state is forbidden when the room is empty",
  semantics: {
    kind: "forbid-states-when-room-occupancy",
    deviceIds: ["device"],
    occupancy: 0,
    stateIds: ["active"],
  },
};

const requireOff: ScenarioConstraint = {
  id: "require-off",
  description: "The device must be off when the room is empty",
  semantics: {
    kind: "require-state-when-room-occupancy",
    deviceIds: ["device"],
    occupancy: 0,
    stateId: "off",
  },
};

describe("scenario constraint adapter", () => {
  it.each([
    [forbidActive, "active", "violated"],
    [forbidActive, "off", "satisfied"],
    [requireOff, "active", "violated"],
    [requireOff, "off", "satisfied"],
  ] as const)("evaluates %s as %s", (constraint, state, status) => {
    const scenario = scenarioWith(constraint);
    const device = new Map([
      [
        "device",
        {
          device: scenario.building.rooms[0].devices[0],
          occupancy: 0,
        },
      ],
    ]);
    expect(
      adaptScenarioConstraint(constraint, device).evaluate({ device: state })
        .status,
    ).toBe(status);
  });

  it("returns undecided for a relevant partial assignment", () => {
    const scenario = scenarioWith(forbidActive);
    const device = new Map([
      [
        "device",
        {
          device: scenario.building.rooms[0].devices[0],
          occupancy: 0,
        },
      ],
    ]);
    expect(adaptScenarioConstraint(forbidActive, device).evaluate({}).status).toBe(
      "undecided",
    );
  });

  it("treats a non-matching occupancy as satisfied", () => {
    const scenario = scenarioWith(forbidActive, 2);
    const problem = createSolvableCspProblem(scenario);
    expect(problem.constraints[0].evaluate({ device: "active" }).status).toBe(
      "satisfied",
    );
  });

  it("rejects invalid states through the real CSP solver", () => {
    const problem = createSolvableCspProblem(scenarioWith(requireOff));
    const result = solve({
      ...problem,
      domains: new Map([["device", ["active"]]]),
    });
    expect(result.result.solution).toBeUndefined();
  });

  it("does not mutate the scenario while creating or evaluating constraints", () => {
    const scenario = scenarioWith(forbidActive);
    const before = JSON.stringify(scenario);
    const problem = createSolvableCspProblem(scenario);
    problem.constraints[0].evaluate({ device: "active" });
    expect(JSON.stringify(scenario)).toBe(before);
  });

  it("rejects constraints without executable semantics", () => {
    expect(() =>
      createSolvableCspProblem(scenarioWith({
        id: "missing-semantics",
        description: "Text is not executable",
      })),
    ).toThrow(/no structured semantics/);
  });
});
