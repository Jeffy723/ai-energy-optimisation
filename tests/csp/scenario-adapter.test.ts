import { describe, expect, it } from "vitest";
import { solve } from "../../src/csp/solver/engine.js";
import { selectVariableWithDetails } from "../../src/csp/heuristics/variableOrdering.js";
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

  it.each([
    [
      { type: "scenario-number", property: "temperature", operator: "greater-than-or-equal", value: 25 },
      { temperature: 26 },
      "violated",
    ],
    [
      { type: "scenario-number", property: "temperature", operator: "greater-than-or-equal", value: 25 },
      { temperature: 24 },
      "satisfied",
    ],
    [
      { type: "scenario-number", property: "lightIntensity", operator: "less-than", value: 200 },
      { lightIntensity: 120 },
      "violated",
    ],
    [
      { type: "scenario-number", property: "lightIntensity", operator: "less-than", value: 200 },
      { lightIntensity: 240 },
      "satisfied",
    ],
    [
      { type: "scenario-text", property: "timeOfDay", operator: "equals", value: "evening" },
      { timeOfDay: "evening" },
      "violated",
    ],
  ] as const)("evaluates environment condition %s with context %s", (condition, context, status) => {
    const scenario: Scenario = {
      ...scenarioWith({
        id: "environment-rule",
        description: "Environment-dependent state rule",
        semantics: {
          kind: "forbid-states-when-condition",
          deviceIds: ["device"],
          condition,
          stateIds: ["active"],
        },
      }),
      context,
    };
    const problem = createSolvableCspProblem(scenario);
    expect(problem.constraints[0].evaluate({ device: "active" }).status).toBe(status);
  });

  it("makes environmental rules constrain actual solver feasibility", () => {
    const scenario: Scenario = {
      ...scenarioWith({
        id: "hot-room-rule",
        description: "Reduce cooling load above the threshold",
        semantics: {
          kind: "forbid-states-when-condition",
          deviceIds: ["device"],
          condition: {
            type: "scenario-number",
            property: "temperature",
            operator: "greater-than",
            value: 24,
          },
          stateIds: ["active"],
        },
      }),
      context: { temperature: 27 },
    };
    const problem = createSolvableCspProblem(scenario);
    const result = solve({
      ...problem,
      domains: new Map([["device", ["active"]]]),
    });
    expect(result.result.solution).toBeUndefined();
  });

  it("combines temperature, light, time-of-day, and occupancy rules in one CSP", () => {
    const scenario: Scenario = {
      ...scenarioWith({
        id: "hot-rule",
        description: "Forbid active state above the temperature threshold",
        semantics: {
          kind: "forbid-states-when-condition",
          deviceIds: ["device"],
          condition: {
            type: "scenario-number",
            property: "temperature",
            operator: "greater-than-or-equal",
            value: 25,
          },
          stateIds: ["active"],
        },
      }, 3),
      context: { temperature: 28, lightIntensity: 100, timeOfDay: "evening" },
      constraints: [
        {
          id: "hot-rule",
          description: "Temperature rule",
          semantics: {
            kind: "forbid-states-when-condition",
            deviceIds: ["device"],
            condition: {
              type: "scenario-number",
              property: "temperature",
              operator: "greater-than-or-equal",
              value: 25,
            },
            stateIds: ["active"],
          },
        },
        {
          id: "light-rule",
          description: "Light intensity rule",
          semantics: {
            kind: "forbid-states-when-condition",
            deviceIds: ["device"],
            condition: {
              type: "scenario-number",
              property: "lightIntensity",
              operator: "less-than-or-equal",
              value: 100,
            },
            stateIds: ["active"],
          },
        },
        {
          id: "time-rule",
          description: "Time of day rule",
          semantics: {
            kind: "forbid-states-when-condition",
            deviceIds: ["device"],
            condition: {
              type: "scenario-text",
              property: "timeOfDay",
              operator: "equals",
              value: "evening",
            },
            stateIds: ["active"],
          },
        },
        {
          id: "occupancy-rule",
          description: "Occupancy rule",
          semantics: {
            kind: "require-state-when-condition",
            deviceIds: ["device"],
            condition: {
              type: "room-occupancy",
              operator: "greater-than-or-equal",
              value: 3,
            },
            stateId: "off",
          },
        },
      ],
    };
    const result = solve(createSolvableCspProblem(scenario));

    expect(result.result.solution?.configuration).toEqual({ device: "off" });
  });

  it("uses updated environmental input when a scenario is adapted again", () => {
    const rule: ScenarioConstraint = {
      id: "temperature-rule",
      description: "Forbid active state when temperature is high",
      semantics: {
        kind: "forbid-states-when-condition",
        deviceIds: ["device"],
        condition: {
          type: "scenario-number",
          property: "temperature",
          operator: "greater-than-or-equal",
          value: 25,
        },
        stateIds: ["active"],
      },
    };
    const cool = { ...scenarioWith(rule), context: { temperature: 20 } };
    const hot = { ...scenarioWith(rule), context: { temperature: 30 } };
    const onlyActive = (scenario: Scenario) => solve({
      ...createSolvableCspProblem(scenario),
      domains: new Map([["device", ["active"]]]),
    }).result.feasible;

    expect(onlyActive(cool)).toBe(true);
    expect(onlyActive(hot)).toBe(false);
  });

  it("rejects missing and invalid environmental context instead of silently satisfying a rule", () => {
    const rule: ScenarioConstraint = {
      id: "missing-temperature",
      description: "Temperature-dependent rule",
      semantics: {
        kind: "require-state-when-condition",
        deviceIds: ["device"],
        condition: {
          type: "scenario-number",
          property: "temperature",
          operator: "greater-than",
          value: 24,
        },
        stateId: "active",
      },
    };
    expect(() => createSolvableCspProblem(scenarioWith(rule))).toThrow(
      /requires scenario context "temperature"/,
    );
    expect(() => createSolvableCspProblem({
      ...scenarioWith(rule),
      context: { temperature: "warm" },
    })).toThrow(/must be a finite number/);
  });

  it("applies range comparisons to each selected device's room occupancy", () => {
    const scenario = scenarioWith({
      id: "occupied-rule",
      description: "Require active operation for occupied rooms",
      semantics: {
        kind: "require-state-when-condition",
        deviceIds: ["device"],
        condition: {
          type: "room-occupancy",
          operator: "greater-than-or-equal",
          value: 1,
        },
        stateId: "active",
      },
    }, 2);
    const problem = createSolvableCspProblem(scenario);
    expect(problem.constraints[0].evaluate({ device: "off" }).status).toBe("violated");
    expect(problem.constraints[0].evaluate({ device: "active" }).status).toBe("satisfied");
  });

  it("does not count environment-only multi-device rules as variable relationships", () => {
    const devices = ["ac", "light", "fan"].map((id) => ({
      id,
      type: id,
      ratedPower: 2,
      operatingTime: 1,
      availableStates: [
        { id: "off", effectivePower: 0 },
        { id: "active", effectivePower: 2 },
      ],
    }));
    const scenario: Scenario = {
      id: "environment-only",
      name: "Environment-only rules",
      context: { temperature: 31 },
      building: {
        id: "building",
        name: "Building",
        type: "generic",
        rooms: [{ id: "room", name: "Room", occupancy: 4, devices }],
      },
      constraints: [
        {
          id: "occupancy-rule",
          description: "Occupancy condition on independently targeted devices",
          semantics: {
            kind: "forbid-states-when-condition",
            deviceIds: ["ac", "light"],
            condition: {
              type: "room-occupancy",
              operator: "greater-than-or-equal",
              value: 4,
            },
            stateIds: ["off"],
          },
        },
        {
          id: "temperature-rule",
          description: "Temperature condition",
          semantics: {
            kind: "require-state-when-condition",
            deviceIds: ["ac"],
            condition: {
              type: "scenario-number",
              property: "temperature",
              operator: "greater-than-or-equal",
              value: 30,
            },
            stateId: "active",
          },
        },
      ],
      objectiveConfiguration: { objectiveId: "minimise-energy" },
    };
    const problem = createSolvableCspProblem(scenario);
    const selected = selectVariableWithDetails(
      ["light", "fan", "ac"],
      problem.domains,
      problem.constraints,
    );

    expect(problem.constraints.map((item) => item.constraint.degreeRelevant)).toEqual([
      false,
      false,
    ]);
    expect(selected?.degreeTieBreakUsed).toBe(false);
    expect(selected?.mrvTie?.candidates.map(({ variable, degree }) => [variable, degree])).toEqual([
      ["light", 0],
      ["fan", 0],
      ["ac", 0],
    ]);
  });

  it("adapts a device-state rule into an actual binary variable relationship", () => {
    const base = scenarioWith(forbidActive);
    const ac = base.building.rooms[0].devices[0];
    const light = {
      ...ac,
      id: "light",
      type: "lighting",
      availableStates: [
        { id: "off", effectivePower: 0 },
        { id: "on", effectivePower: 2 },
      ],
    };
    const scenario: Scenario = {
      ...base,
      building: {
        ...base.building,
        rooms: [{ ...base.building.rooms[0], devices: [ac, light] }],
      },
      constraints: [{
        id: "ac-light-link",
        description: "High cooling prevents lighting being On",
        semantics: {
          kind: "forbid-state-when-device-state",
          conditionDeviceId: "device",
          conditionStateId: "active",
          targetDeviceId: "light",
          forbiddenStateId: "on",
        },
      }],
    };
    const problem = createSolvableCspProblem(scenario);
    const constraint = problem.constraints[0];

    expect(constraint.constraint.involvedVariables).toEqual(["device", "light"]);
    expect(constraint.constraint.degreeRelevant).toBeUndefined();
    expect(constraint.evaluate({ device: "active", light: "on" }).status).toBe("violated");
    expect(constraint.evaluate({ device: "active", light: "off" }).status).toBe("satisfied");
    expect(constraint.evaluate({ device: "active" }).status).toBe("undecided");
    expect(constraint.evaluate({ device: "off" }).status).toBe("satisfied");
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
