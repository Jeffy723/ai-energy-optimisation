/**
 * Tests for src/problem/scenario/validation.ts
 *
 * Covers:
 * 1.  Valid generic scenario
 * 2.  Different building type values treated as data
 * 3.  Multiple rooms/zones
 * 4.  Multiple device types
 * 5.  Arbitrary device operating states
 * 6.  Numeric occupancy validation
 * 7.  Power/time validation
 * 8.  State-dependent effective power structure
 * 9.  Invalid/malformed scenario
 * 10. Missing required fields
 * 11. Invalid constraint references (duplicate ids)
 */

import { describe, expect, it } from "vitest";
import type {
  Building,
  Device,
  DeviceOperatingState,
  Room,
  Scenario,
  ScenarioConstraint,
} from "../../src/problem/scenario/contracts.js";
import {
  collectDeviceIds,
  collectRoomIds,
  validateBuilding,
  validateDevice,
  validateDeviceOperatingState,
  validateIdentifier,
  validateObjectiveConfiguration,
  validateRoom,
  validateScenario,
  validateScenarioConstraint,
} from "../../src/problem/scenario/validation.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeState(
  id: string,
  effectivePower?: number,
): DeviceOperatingState {
  return effectivePower !== undefined ? { id, label: id, effectivePower } : { id, label: id };
}

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "d-1",
    type: "hvac",
    ratedPower: 2.0,
    operatingTime: 8,
    availableStates: [makeState("off", 0), makeState("on", 2.0)],
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "room-1",
    name: "Main Room",
    occupancy: 4,
    devices: [makeDevice()],
    ...overrides,
  };
}

function makeBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: "building-1",
    name: "Test Building",
    type: "office",
    rooms: [makeRoom()],
    ...overrides,
  };
}

function makeConstraint(id = "c-1"): ScenarioConstraint {
  return { id, description: "A test constraint" };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scenario-1",
    name: "Test Scenario",
    building: makeBuilding(),
    constraints: [makeConstraint()],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Valid generic scenario
// ---------------------------------------------------------------------------

describe("validateScenario — valid generic scenario", () => {
  it("accepts a fully valid scenario", () => {
    const result = validateScenario(makeScenario());
    expect(result.valid).toBe(true);
  });

  it("accepts a scenario with optional context", () => {
    const result = validateScenario(
      makeScenario({ context: { temperature: 24, occupied: true } }),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts a scenario without context (context is optional)", () => {
    const scenario = makeScenario();
    const result = validateScenario(scenario);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Building type values treated as generic data
// ---------------------------------------------------------------------------

describe("validateBuilding — type is generic data", () => {
  const types = [
    "residential",
    "office",
    "school",
    "hospital",
    "commercial",
    "industrial",
    "data-centre",
    "any-future-type",
  ];

  for (const type of types) {
    it(`accepts building.type="${type}"`, () => {
      const result = validateBuilding(makeBuilding({ type }), "Building");
      expect(result.valid).toBe(true);
    });
  }

  it("rejects an empty building type", () => {
    const result = validateBuilding(makeBuilding({ type: "" }), "Building");
    expect(result.valid).toBe(false);
  });

  it("rejects a whitespace-only building type", () => {
    const result = validateBuilding(makeBuilding({ type: "   " }), "Building");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple rooms / zones
// ---------------------------------------------------------------------------

describe("validateBuilding — multiple rooms", () => {
  it("accepts a building with multiple rooms", () => {
    const building = makeBuilding({
      rooms: [
        makeRoom({ id: "room-a", name: "Room A" }),
        makeRoom({ id: "room-b", name: "Room B" }),
        makeRoom({ id: "room-c", name: "Room C" }),
      ],
    });
    expect(validateBuilding(building, "B").valid).toBe(true);
  });

  it("rejects an empty rooms array", () => {
    const result = validateBuilding(makeBuilding({ rooms: [] }), "B");
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate room ids", () => {
    const building = makeBuilding({
      rooms: [
        makeRoom({ id: "same-id", name: "Room A" }),
        makeRoom({ id: "same-id", name: "Room B" }),
      ],
    });
    const result = validateBuilding(building, "B");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("duplicate room ids"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Multiple device types
// ---------------------------------------------------------------------------

describe("validateRoom — multiple device types", () => {
  it("accepts a room with different device types", () => {
    const room = makeRoom({
      devices: [
        makeDevice({ id: "d-hvac", type: "hvac" }),
        makeDevice({ id: "d-light", type: "lighting" }),
        makeDevice({ id: "d-proj", type: "projector" }),
        makeDevice({ id: "d-pump", type: "water-pump" }),
      ],
    });
    expect(validateRoom(room, "Room").valid).toBe(true);
  });

  it("accepts any non-empty device type string (generic)", () => {
    const result = validateDevice(
      makeDevice({ type: "custom-industrial-device" }),
      "Device",
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Arbitrary device operating states
// ---------------------------------------------------------------------------

describe("validateDevice — arbitrary operating states", () => {
  it("accepts any valid set of states", () => {
    const device = makeDevice({
      availableStates: [
        makeState("off", 0),
        makeState("low", 0.5),
        makeState("medium", 1.0),
        makeState("high", 2.0),
        makeState("boost", 2.5),
      ],
    });
    expect(validateDevice(device, "Device").valid).toBe(true);
  });

  it("accepts states without effectivePower (effectivePower is optional)", () => {
    const device = makeDevice({
      availableStates: [
        { id: "state-a", label: "A" },
        { id: "state-b", label: "B" },
      ],
    });
    expect(validateDevice(device, "Device").valid).toBe(true);
  });

  it("accepts a mix of states with and without effectivePower", () => {
    const device = makeDevice({
      availableStates: [
        { id: "off", label: "Off" },
        { id: "on", label: "On", effectivePower: 1.5 },
      ],
    });
    expect(validateDevice(device, "Device").valid).toBe(true);
  });

  it("rejects an empty availableStates array", () => {
    const result = validateDevice(makeDevice({ availableStates: [] }), "D");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("non-empty array"))).toBe(true);
    }
  });

  it("rejects duplicate state ids within a device", () => {
    const result = validateDevice(
      makeDevice({
        availableStates: [makeState("off", 0), makeState("off", 1.0)],
      }),
      "D",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("duplicate state ids"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Occupancy validation
// ---------------------------------------------------------------------------

describe("validateRoom — occupancy", () => {
  it("accepts occupancy = 0 (unoccupied room)", () => {
    expect(validateRoom(makeRoom({ occupancy: 0 }), "R").valid).toBe(true);
  });

  it("accepts occupancy = 1", () => {
    expect(validateRoom(makeRoom({ occupancy: 1 }), "R").valid).toBe(true);
  });

  it("accepts large occupancy values", () => {
    expect(validateRoom(makeRoom({ occupancy: 500 }), "R").valid).toBe(true);
  });

  it("rejects negative occupancy", () => {
    const result = validateRoom(makeRoom({ occupancy: -1 }), "R");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("occupancy"))).toBe(true);
    }
  });

  it("rejects fractional occupancy (must be integer)", () => {
    const result = validateRoom(makeRoom({ occupancy: 3.5 }), "R");
    expect(result.valid).toBe(false);
  });

  it("rejects NaN occupancy", () => {
    const result = validateRoom(makeRoom({ occupancy: NaN }), "R");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Power and time validation
// ---------------------------------------------------------------------------

describe("validateDevice — ratedPower and operatingTime", () => {
  it("accepts typical ratedPower values", () => {
    for (const ratedPower of [0.01, 0.5, 1.0, 3.5, 10, 100]) {
      expect(validateDevice(makeDevice({ ratedPower }), "D").valid).toBe(true);
    }
  });

  it("rejects ratedPower = 0", () => {
    const result = validateDevice(makeDevice({ ratedPower: 0 }), "D");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("ratedPower"))).toBe(true);
    }
  });

  it("rejects negative ratedPower", () => {
    const result = validateDevice(makeDevice({ ratedPower: -1 }), "D");
    expect(result.valid).toBe(false);
  });

  it("rejects Infinity ratedPower", () => {
    const result = validateDevice(makeDevice({ ratedPower: Infinity }), "D");
    expect(result.valid).toBe(false);
  });

  it("rejects NaN ratedPower", () => {
    const result = validateDevice(makeDevice({ ratedPower: NaN }), "D");
    expect(result.valid).toBe(false);
  });

  it("accepts operatingTime = 0 (device not yet scheduled)", () => {
    expect(validateDevice(makeDevice({ operatingTime: 0 }), "D").valid).toBe(true);
  });

  it("accepts typical operatingTime values", () => {
    for (const operatingTime of [0, 0.5, 1, 8, 24]) {
      expect(validateDevice(makeDevice({ operatingTime }), "D").valid).toBe(true);
    }
  });

  it("rejects negative operatingTime", () => {
    const result = validateDevice(makeDevice({ operatingTime: -0.5 }), "D");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("operatingTime"))).toBe(true);
    }
  });

  it("rejects Infinity operatingTime", () => {
    const result = validateDevice(makeDevice({ operatingTime: Infinity }), "D");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. State-dependent effective power structure
// ---------------------------------------------------------------------------

describe("validateDeviceOperatingState — effectivePower", () => {
  it("accepts effectivePower = 0 (off state)", () => {
    expect(validateDeviceOperatingState(makeState("off", 0), "s").valid).toBe(true);
  });

  it("accepts positive effectivePower", () => {
    expect(validateDeviceOperatingState(makeState("on", 1.5), "s").valid).toBe(true);
  });

  it("accepts state without effectivePower", () => {
    expect(validateDeviceOperatingState({ id: "s1" }, "s").valid).toBe(true);
  });

  it("rejects negative effectivePower", () => {
    const result = validateDeviceOperatingState(
      { id: "s1", effectivePower: -0.5 },
      "s",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("effectivePower"))).toBe(true);
    }
  });

  it("rejects NaN effectivePower", () => {
    const result = validateDeviceOperatingState(
      { id: "s1", effectivePower: NaN },
      "s",
    );
    expect(result.valid).toBe(false);
  });

  it("rejects Infinity effectivePower", () => {
    const result = validateDeviceOperatingState(
      { id: "s1", effectivePower: Infinity },
      "s",
    );
    expect(result.valid).toBe(false);
  });

  it("models the effective power chain: state → effectivePower for energy evaluation", () => {
    // The device has states with distinct effectivePower values.
    // The test verifies the structure is preserved exactly as authored —
    // no energy calculation is performed here (that belongs to energy/).
    const device = makeDevice({
      ratedPower: 3.5,
      availableStates: [
        { id: "off", effectivePower: 0 },
        { id: "eco", effectivePower: 1.2 },
        { id: "full", effectivePower: 3.5 },
      ],
    });

    const result = validateDevice(device, "Device");
    expect(result.valid).toBe(true);

    // Verify the structure is intact for downstream use
    const offState = device.availableStates.find((s) => s.id === "off");
    const fullState = device.availableStates.find((s) => s.id === "full");
    expect(offState?.effectivePower).toBe(0);
    expect(fullState?.effectivePower).toBe(3.5);
  });
});

// ---------------------------------------------------------------------------
// 9. Invalid / malformed scenario
// ---------------------------------------------------------------------------

describe("validateScenario — invalid inputs", () => {
  it("rejects empty scenario id", () => {
    const result = validateScenario(makeScenario({ id: "" }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("identifier"))).toBe(true);
    }
  });

  it("rejects whitespace-only scenario name", () => {
    const result = validateScenario(makeScenario({ name: "   " }));
    expect(result.valid).toBe(false);
  });

  it("collects multiple errors simultaneously", () => {
    const result = validateScenario(
      makeScenario({ id: "", name: "" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Should report both id and name errors
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Missing required fields
// ---------------------------------------------------------------------------

describe("validateIdentifier — missing fields", () => {
  it("rejects undefined id", () => {
    const result = validateIdentifier(undefined, "field");
    expect(result.valid).toBe(false);
  });

  it("rejects null id", () => {
    const result = validateIdentifier(null, "field");
    expect(result.valid).toBe(false);
  });

  it("rejects numeric id", () => {
    const result = validateIdentifier(42, "field");
    expect(result.valid).toBe(false);
  });
});

describe("validateDevice — missing type", () => {
  it("rejects empty device type", () => {
    const result = validateDevice(makeDevice({ type: "" }), "D");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("type"))).toBe(true);
    }
  });
});

describe("validateRoom — missing name", () => {
  it("rejects empty room name", () => {
    const result = validateRoom(makeRoom({ name: "" }), "R");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    }
  });
});

describe("validateObjectiveConfiguration — missing objectiveId", () => {
  it("rejects empty objectiveId", () => {
    const result = validateObjectiveConfiguration(
      { objectiveId: "" },
      "ObjCfg",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("objectiveId"))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Invalid constraint references (duplicate ids)
// ---------------------------------------------------------------------------

describe("validateScenario — constraint ids", () => {
  it("accepts multiple constraints with distinct ids", () => {
    const result = validateScenario(
      makeScenario({
        constraints: [
          makeConstraint("c-1"),
          makeConstraint("c-2"),
          makeConstraint("c-3"),
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects duplicate constraint ids", () => {
    const result = validateScenario(
      makeScenario({
        constraints: [makeConstraint("c-dup"), makeConstraint("c-dup")],
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.includes("duplicate constraint ids")),
      ).toBe(true);
    }
  });

  it("rejects an empty constraints array", () => {
    const result = validateScenario(makeScenario({ constraints: [] }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("constraints"))).toBe(true);
    }
  });

  it("rejects a constraint with empty id", () => {
    const result = validateScenarioConstraint({ id: "", description: "test" }, "c");
    expect(result.valid).toBe(false);
  });

  it("rejects a constraint with empty description", () => {
    const result = validateScenarioConstraint({ id: "c-1", description: "" }, "c");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

describe("collectDeviceIds / collectRoomIds", () => {
  it("collects all device ids across all rooms", () => {
    const scenario = makeScenario({
      building: makeBuilding({
        rooms: [
          makeRoom({
            id: "r1",
            name: "R1",
            devices: [
              makeDevice({ id: "d-a", type: "hvac" }),
              makeDevice({ id: "d-b", type: "lighting" }),
            ],
          }),
          makeRoom({
            id: "r2",
            name: "R2",
            devices: [makeDevice({ id: "d-c", type: "projector" })],
          }),
        ],
      }),
    });

    const ids = collectDeviceIds(scenario);
    expect(ids.has("d-a")).toBe(true);
    expect(ids.has("d-b")).toBe(true);
    expect(ids.has("d-c")).toBe(true);
    expect(ids.size).toBe(3);
  });

  it("collects all room ids", () => {
    const scenario = makeScenario({
      building: makeBuilding({
        rooms: [
          makeRoom({ id: "r1", name: "R1" }),
          makeRoom({ id: "r2", name: "R2" }),
        ],
      }),
    });

    const ids = collectRoomIds(scenario);
    expect(ids.has("r1")).toBe(true);
    expect(ids.has("r2")).toBe(true);
    expect(ids.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: validate the small.json example scenario
// ---------------------------------------------------------------------------

describe("small.json example scenario", () => {
  it("passes validation", async () => {
    const scenarioModule = await import("../../examples/scenarios/small.json");
    const scenario = scenarioModule.default as unknown as Scenario;
    const result = validateScenario(scenario);
    if (!result.valid) {
      console.error("small.json validation errors:", result.errors);
    }
    expect(result.valid).toBe(true);
  });
});
