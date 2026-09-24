import { describe, expect, it } from "vitest";
import type { CspConfiguration } from "../../src/csp/model/contracts.js";
import {
  calculateEnergy,
  InvalidEnergyConfigurationError,
} from "../../src/energy/calculator/index.js";
import {
  compareConfigurations,
  evaluateObjective,
  measureEnergy,
} from "../../src/energy/objective/index.js";
import type {
  Device,
  DeviceOperatingState,
  Room,
  Scenario,
} from "../../src/problem/scenario/contracts.js";

function state(id: string, effectivePower?: number): DeviceOperatingState {
  return effectivePower === undefined ? { id } : { id, effectivePower };
}

function device(
  id: string,
  ratedPower: number,
  operatingTime: number,
  states: readonly DeviceOperatingState[] = [state("default")],
): Device {
  return { id, type: "generic-device", ratedPower, operatingTime, availableStates: states };
}

function scenario(rooms: readonly Room[]): Scenario {
  return {
    id: "scenario-1",
    name: "Generic scenario",
    building: { id: "building-1", name: "Generic building", type: "generic", rooms },
    constraints: [{ id: "constraint-1", description: "Generic constraint" }],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

function room(id: string, devices: readonly Device[]): Room {
  return { id, name: `Room ${id}`, occupancy: 0, devices };
}

const objective = {
  id: "minimise-energy",
  name: "Minimise energy",
  direction: "minimise" as const,
  evaluationBasis: "total configuration energy",
};

describe("energy calculation", () => {
  it("calculates a single device as power multiplied by operating time", () => {
    const result = calculateEnergy(
      scenario([room("r-1", [device("d-1", 2, 3)])]),
      { "d-1": "default" },
    );
    expect(result.devices[0]?.energyKwh).toBe(6);
    expect(result.totalEnergyKwh).toBe(6);
    expect(result.unit).toBe("kWh");
  });

  it("aggregates multiple devices and rooms", () => {
    const result = calculateEnergy(
      scenario([
        room("r-1", [device("d-1", 2, 3), device("d-2", 1.5, 4)]),
        room("r-2", [device("d-3", 0.5, 8)]),
      ]),
      { "d-1": "default", "d-2": "default", "d-3": "default" },
    );
    expect(result.rooms.map((item) => item.energyKwh)).toEqual([12, 4]);
    expect(result.totalEnergyKwh).toBe(16);
  });

  it("uses selected effective power instead of rated power", () => {
    const result = calculateEnergy(
      scenario([room("r-1", [device("d-1", 5, 2, [state("reduced", 1.25)])])]),
      { "d-1": "reduced" },
    );
    expect(result.devices[0]?.powerKw).toBe(1.25);
    expect(result.totalEnergyKwh).toBe(2.5);
  });

  it("falls back to rated power when selected state has no effective power", () => {
    const result = calculateEnergy(
      scenario([room("r-1", [device("d-1", 3, 2, [state("normal")])])]),
      { "d-1": "normal" },
    );
    expect(result.devices[0]?.powerKw).toBe(3);
    expect(result.totalEnergyKwh).toBe(6);
  });

  it("returns zero energy for zero operating time", () => {
    const result = calculateEnergy(
      scenario([room("r-1", [device("d-1", 4, 0)])]),
      { "d-1": "default" },
    );
    expect(result.totalEnergyKwh).toBe(0);
  });

  it("rejects missing, unknown, and invalid state assignments", () => {
    const testScenario = scenario([room("r-1", [device("d-1", 1, 1)])]);
    expect(() => calculateEnergy(testScenario, {})).toThrow(
      InvalidEnergyConfigurationError,
    );
    expect(() => calculateEnergy(testScenario, { "d-1": "missing" })).toThrow(
      InvalidEnergyConfigurationError,
    );
    expect(() =>
      calculateEnergy(testScenario, { "d-1": 1 } as CspConfiguration),
    ).toThrow(InvalidEnergyConfigurationError);
  });

  it("does not mutate the scenario or configuration", () => {
    const testScenario = scenario([room("r-1", [device("d-1", 2, 2)])]);
    const configuration: CspConfiguration = { "d-1": "default" };
    const scenarioBefore = JSON.stringify(testScenario);
    const configurationBefore = JSON.stringify(configuration);
    calculateEnergy(testScenario, configuration);
    expect(JSON.stringify(testScenario)).toBe(scenarioBefore);
    expect(JSON.stringify(configuration)).toBe(configurationBefore);
  });

  it("is deterministic across repeated evaluations", () => {
    const testScenario = scenario([room("r-1", [device("d-1", 2, 3)])]);
    const configuration = { "d-1": "default" };
    expect(calculateEnergy(testScenario, configuration)).toEqual(
      calculateEnergy(testScenario, configuration),
    );
  });
});

describe("energy objective evaluation", () => {
  const testScenario = scenario([
    room("r-1", [
      device("d-1", 4, 2, [state("high", 4), state("low", 1)]),
      device("d-2", 2, 1, [state("high", 2), state("low", 0)]),
    ]),
  ]);

  it("evaluates an objective using total energy", () => {
    const evaluation = evaluateObjective(
      testScenario,
      { "d-1": "low", "d-2": "high" },
      objective,
    );
    expect(evaluation.objectiveId).toBe("minimise-energy");
    expect(evaluation.value).toBe(4);
    expect(evaluation.energyMeasurement.energy).toBe(4);
  });

  it("calculates baseline, optimised energy, savings, and percentage saved", () => {
    const comparison = compareConfigurations(
      testScenario,
      { "d-1": "high", "d-2": "high" },
      { "d-1": "low", "d-2": "low" },
    );
    expect(comparison).toEqual({
      initialEnergy: 10,
      optimisedEnergy: 2,
      energySaved: 8,
      percentageSaved: 80,
    });
  });

  it("defines zero-baseline percentage savings as zero", () => {
    const zeroScenario = scenario([
      room("r-1", [device("d-1", 2, 2, [state("off", 0)])]),
    ]);
    expect(
      compareConfigurations(zeroScenario, { "d-1": "off" }, { "d-1": "off" }),
    ).toEqual({
      initialEnergy: 0,
      optimisedEnergy: 0,
      energySaved: 0,
      percentageSaved: 0,
    });
  });

  it("measures energy through the shared energy measurement contract", () => {
    expect(measureEnergy(testScenario, { "d-1": "low", "d-2": "low" })).toEqual({
      configuration: { "d-1": "low", "d-2": "low" },
      energy: 2,
      unit: "kWh",
    });
  });
});
