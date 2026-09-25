import { describe, expect, it } from "vitest";
import { energyBreakdown, formatEnergy, formatPercent } from "../../src/interface/web/presentation.js";
import type { Scenario } from "../../src/problem/scenario/contracts.js";

function scenario(): Scenario {
  return {
    id: "s",
    name: "s",
    building: {
      id: "b",
      name: "b",
      type: "generic",
      rooms: [{
        id: "room-a",
        name: "Classroom A",
        occupancy: 30,
        devices: [{
          id: "ac",
          type: "Air conditioner",
          ratedPower: 2,
          operatingTime: 4,
          availableStates: [
            { id: "high", label: "High", effectivePower: 2 },
            { id: "low", label: "Low", effectivePower: 0.8 },
          ],
        }],
      }],
    },
    constraints: [{ id: "c", description: "c" }],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

describe("energy presentation", () => {
  it("formats units and compares initial versus optimised device energy from the calculator", () => {
    expect(formatEnergy(8)).toBe("8.00 kWh");
    expect(formatPercent(31.5238)).toBe("31.52%");
    const breakdown = energyBreakdown(scenario(), { ac: "high" }, { ac: "low" });
    expect(breakdown.initialTotalKwh).toBe(8);
    expect(breakdown.optimisedTotalKwh).toBe(3.2);
    expect(breakdown.devices[0]).toMatchObject({
      roomName: "Classroom A",
      deviceName: "Air conditioner",
      initialState: "High",
      initialEnergyKwh: 8,
      optimisedState: "Low",
      optimisedEnergyKwh: 3.2,
    });
  });
});
