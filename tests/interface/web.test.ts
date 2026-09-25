import { describe, expect, it } from "vitest";
import { buildScenario } from "../../src/interface/web/scenarioBuilder.js";
import {
  addConstraint,
  addDevice,
  addRoom,
  addState,
  removeConstraint,
  removeDevice,
  removeRoom,
  removeState,
  type BuilderCollections,
} from "../../src/interface/web/builderState.js";
import type { ConstraintDraft, DeviceDraft, RoomDraft } from "../../src/interface/web/contracts.js";

function device(id: string): DeviceDraft {
  return { id, type: "generic", ratedPower: "2", operatingTime: "6", states: [{ id: `${id}-state-1`, name: "Off", effectivePower: "0" }, { id: `${id}-state-2`, name: "On", effectivePower: "1" }] };
}
function room(id: string): RoomDraft {
  return { id, name: id, occupancy: "25", devices: [device(`${id}-device-1`)] };
}
function constraint(id: string): ConstraintDraft {
  return { id, description: id, kind: "forbid-states-when-room-occupancy", deviceIds: [], occupancy: "0", stateIds: [], stateId: "" };
}

describe("browser scenario builder", () => {
  it("builds dynamic rooms, devices, states, context, and structured constraints", () => {
    const scenario = buildScenario(
      "User scenario",
      "any building",
      "21",
      "morning",
      "350",
      [{
        id: "room-a",
        name: "Room A",
        occupancy: "3",
        devices: [{
          id: "device-a",
          type: "user device",
          ratedPower: "2",
          operatingTime: "4",
          states: [{ id: "off", name: "Off", effectivePower: "0" }, { id: "active", name: "Active", effectivePower: "2" }],
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
    expect(scenario.context).toEqual({ temperature: 21, timeOfDay: "morning", lightIntensity: 350 });
    expect(scenario.constraints[0].semantics).toEqual({
      kind: "forbid-states-when-room-occupancy",
      deviceIds: ["device-a"],
      occupancy: 0,
      stateIds: ["active"],
    });
  });

  it("rejects a builder with no rooms or non-numeric values", () => {
    expect(() => buildScenario("x", "generic", "", "", "", [], [])).toThrow(/room/);
    expect(() => buildScenario("x", "generic", "", "", "", [{
      id: "room",
      name: "Room",
      occupancy: "not-a-number",
      devices: [device("d-1")],
    }], [{
      id: "c-1",
      description: "rule",
      kind: "forbid-states-when-room-occupancy",
      deviceIds: ["d-1"],
      occupancy: "0",
      stateIds: ["d-1-state-1"],
      stateId: "",
    }])).toThrow(/occupancy/);
  });

  it("rejects blank numeric values instead of silently converting them to zero", () => {
    expect(() => buildScenario("x", "generic", "", "", "", [{
      id: "room",
      name: "Room",
      occupancy: "",
      devices: [device("d-1")],
    }], [{
      id: "c-1",
      description: "rule",
      kind: "forbid-states-when-room-occupancy",
      deviceIds: ["d-1"],
      occupancy: "0",
      stateIds: ["d-1-state-1"],
      stateId: "",
    }])).toThrow(/occupancy.*required/);
  });

  it("rejects constraint states that are not available on selected devices", () => {
    expect(() => buildScenario("x", "generic", "", "", "", [{
      id: "room",
      name: "Room",
      occupancy: "1",
      devices: [device("d-1")],
    }], [{
      id: "c-1",
      description: "rule",
      kind: "forbid-states-when-room-occupancy",
      deviceIds: ["d-1"],
      occupancy: "1",
      stateIds: ["missing-state"],
      stateId: "",
    }])).toThrow(/not available/);
  });

  it("supports repeated nested add operations without changing existing values", () => {
    const state: BuilderCollections = { rooms: [room("room-1")], constraints: [] };
    addState(state, 0, 0, { id: "state-3", name: "State 3", effectivePower: "2" });
    addState(state, 0, 0, { id: "state-4", name: "State 4", effectivePower: "3" });
    addDevice(state, 0, device("device-2"));
    addDevice(state, 0, device("device-3"));
    addRoom(state, room("room-2"));
    addRoom(state, room("room-3"));

    expect(state.rooms).toHaveLength(3);
    expect(state.rooms[0].occupancy).toBe("25");
    expect(state.rooms[0].devices).toHaveLength(3);
    expect(state.rooms[0].devices[0].ratedPower).toBe("2");
    expect(state.rooms[0].devices[0].operatingTime).toBe("6");
    expect(state.rooms[0].devices[0].states).toHaveLength(4);
  });

  it("supports repeated constraints and precise remove operations", () => {
    const state: BuilderCollections = { rooms: [room("room-1"), room("room-2")], constraints: [] };
    addConstraint(state, constraint("constraint-1"));
    addConstraint(state, constraint("constraint-2"));
    addConstraint(state, constraint("constraint-3"));
    removeConstraint(state, 1);
    expect(state.constraints.map((item) => item.id)).toEqual(["constraint-1", "constraint-3"]);

    removeState(state, 0, 0, 0);
    removeDevice(state, 0, 0);
    removeRoom(state, 1);
    expect(state.rooms).toHaveLength(1);
    expect(state.rooms[0].devices).toHaveLength(0);
  });
});
