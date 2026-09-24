import { describe, expect, it } from "vitest";
import { buildScenario } from "../../src/interface/web/scenarioBuilder.js";

describe("browser scenario builder", () => {
  it("builds dynamic rooms, devices, states, context, and structured constraints", () => {
    const scenario = buildScenario(
      "User scenario",
      "any building",
      "21",
      "morning",
      [{
        id: "room-a",
        name: "Room A",
        occupancy: "3",
        devices: [{
          id: "device-a",
          type: "user device",
          ratedPower: "2",
          operatingTime: "4",
          states: [{ id: "off", effectivePower: "0" }, { id: "active", effectivePower: "2" }],
        }],
      }],
      [{
        id: "constraint-a",
        description: "Keep active state unavailable when empty",
        kind: "forbid-states-when-room-occupancy",
        deviceIds: ["device-a"],
        occupancy: "0",
        stateIds: ["active"],
        stateId: "",
      }],
    );

    expect(scenario.building.rooms[0].devices[0].availableStates).toHaveLength(2);
    expect(scenario.context).toEqual({ temperature: 21, timeOfDay: "morning" });
    expect(scenario.constraints[0].semantics).toEqual({
      kind: "forbid-states-when-room-occupancy",
      deviceIds: ["device-a"],
      occupancy: 0,
      stateIds: ["active"],
    });
  });

  it("rejects a builder with no rooms or non-numeric values", () => {
    expect(() => buildScenario("x", "generic", "", "", [], [])).toThrow(/room/);
    expect(() => buildScenario("x", "generic", "", "", [{
      id: "room",
      name: "Room",
      occupancy: "not-a-number",
      devices: [],
    }], [])).toThrow(/occupancy/);
  });
});
