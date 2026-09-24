import { describe, expect, it } from "vitest";
import type { FinalResult } from "../../src/optimisation/hillClimbing/contracts.js";
import {
  InvalidScenarioInputError,
  loadScenario,
  parseScenarioJson,
  validateScenarioInput,
} from "../../src/interface/input/index.js";
import {
  formatConsoleOutput,
  presentFinalResult,
} from "../../src/interface/output/index.js";
import type { Scenario } from "../../src/problem/scenario/contracts.js";
import type { SearchTree } from "../../src/visualisation/searchTree/contracts.js";

function makeScenario(): Scenario {
  return {
    id: "scenario-1",
    name: "Generic scenario",
    building: {
      id: "building-1",
      name: "Generic building",
      type: "any-type",
      rooms: [
        {
          id: "room-1",
          name: "Generic room",
          occupancy: 2,
          devices: [
            {
              id: "device-1",
              type: "generic-device",
              ratedPower: 2,
              operatingTime: 2,
              availableStates: [{ id: "state-1", effectivePower: 1 }],
            },
          ],
        },
      ],
    },
    context: { mode: "test", count: 1 },
    constraints: [{ id: "constraint-1", description: "valid constraint" }],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

function makeResult(scenario: Scenario): FinalResult {
  const configuration = { "device-1": "state-1" };
  const measurement = {
    configuration,
    energy: 2,
    unit: "kWh" as const,
  };
  return {
    scenario,
    initialConfiguration: configuration,
    feasibleConfiguration: {
      configuration,
      assignments: [{ variable: "device-1", value: "state-1" }],
    },
    optimisedConfiguration: configuration,
    initialEnergy: measurement,
    optimisedEnergy: measurement,
    energyComparison: {
      initialEnergy: 2,
      optimisedEnergy: 2,
      energySaved: 0,
      percentageSaved: 0,
    },
    cspStatistics: {
      variablesSelected: 1,
      valuesTried: 1,
      constraintChecks: 1,
      backtracks: 0,
      forwardChecks: 0,
    },
    hillClimbingStatistics: {
      iterations: 0,
      neighboursEvaluated: 1,
      movesAccepted: 0,
    },
  };
}

describe("scenario input adapters", () => {
  it("loads and validates a generic scenario without changing its data", () => {
    const scenario = makeScenario();
    expect(loadScenario(scenario)).toEqual({ scenario, source: "object" });
    expect(parseScenarioJson(JSON.stringify(scenario))).toEqual({
      scenario,
      source: "json",
    });
    expect(() => validateScenarioInput(scenario)).not.toThrow();
  });

  it("rejects malformed JSON, invalid scenarios, and missing structures", () => {
    expect(() => parseScenarioJson("{")).toThrow(InvalidScenarioInputError);
    expect(() => loadScenario({})).toThrow(InvalidScenarioInputError);
    expect(() =>
      loadScenario({ id: "scenario", building: {}, constraints: [] }),
    ).toThrow(InvalidScenarioInputError);
  });
});

describe("interface result presentation", () => {
  it("maps existing result and visualisation data without recalculation", () => {
    const scenario = makeScenario();
    const result = makeResult(scenario);
    const tree: SearchTree = {
      root: {
        id: "root",
        type: "ROOT",
        depth: -1,
        order: -1,
        assignment: {},
        children: [],
      },
      eventOrder: [],
    };
    const output = presentFinalResult(result, { searchTree: tree });
    expect(output.scenario).toEqual({
      id: "scenario-1",
      name: "Generic scenario",
      buildingType: "any-type",
      roomCount: 1,
      deviceCount: 1,
      context: { mode: "test", count: 1 },
    });
    expect(output.energy.initial.energy).toBe(2);
    expect(output.energy.initial.unit).toBe("kWh");
    expect(output.energy.comparison).toEqual(result.energyComparison);
    expect(output.csp.statistics).toEqual(result.cspStatistics);
    expect(output.visualisation.searchTree).toEqual(tree);
  });

  it("formats actual values for console demonstrations", () => {
    const output = presentFinalResult(makeResult(makeScenario()));
    const text = formatConsoleOutput(output);
    expect(text).toContain("Name: Generic scenario");
    expect(text).toContain("Building Type: any-type");
    expect(text).toContain("Initial Energy: 2 kWh");
    expect(text).toContain("Energy Saved: 0 kWh");
    expect(text).toContain("Percentage Saved: 0 %");
    expect(text).toContain("Termination: Local optimum");
  });

  it("keeps source results and scenarios immutable and is deterministic", () => {
    const scenario = makeScenario();
    const result = makeResult(scenario);
    const before = JSON.stringify({ scenario, result });
    const first = presentFinalResult(result);
    const second = presentFinalResult(result);
    expect(first).toEqual(second);
    (first.csp.configuration as Record<string, string>)["device-1"] = "changed";
    expect(JSON.stringify({ scenario, result })).toBe(before);
  });
});
