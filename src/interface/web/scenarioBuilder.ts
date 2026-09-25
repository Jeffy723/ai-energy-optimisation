import type {
  Device,
  Scenario,
  ScenarioConstraint,
  ScenarioConstraintSemantics,
} from "../../problem/scenario/contracts.js";
import type { ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";

function numberValue(value: string, label: string): number {
  if (value.trim() === "") throw new Error(`${label.toLowerCase()} is required`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label.toLowerCase()} must be a finite number`);
  return parsed;
}

function nonNegative(value: string, label: string): number {
  const parsed = numberValue(value, label);
  if (parsed < 0) throw new Error(`${label} must be 0 or greater`);
  return parsed;
}

function positivePower(value: string, label: string): number {
  const parsed = numberValue(value, label);
  if (parsed <= 0) throw new Error(`${label} must be greater than 0 kW`);
  return parsed;
}

function occupancyValue(value: string, label: string): number {
  const parsed = numberValue(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number of 0 or greater`);
  }
  return parsed;
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${label} is required`);
  return trimmed;
}

function stateFromDraft(state: StateDraft, deviceLabel: string): Device["availableStates"][number] {
  const name = requiredText(state.name || state.id, `A state name for ${deviceLabel}`);
  return {
    id: requiredText(state.id, `A state identifier for ${deviceLabel}`),
    label: name,
    effectivePower: nonNegative(
      state.effectivePower,
      `Effective power for state "${name}" (kW)`,
    ),
  };
}

function deviceFromDraft(draft: DeviceDraft): Device {
  const type = requiredText(draft.type, "Device name");
  if (draft.states.length === 0) {
    throw new Error(`Device "${type}" must have at least one operating state`);
  }
  return {
    id: requiredText(draft.id, `Device identifier for "${type}"`),
    type,
    ratedPower: positivePower(draft.ratedPower, `Rated power for "${type}" (kW)`),
    operatingTime: nonNegative(draft.operatingTime, `Operating time for "${type}" (hours)`),
    availableStates: draft.states.map((state) => stateFromDraft(state, type)),
  };
}

function semanticsFromDraft(
  draft: ConstraintDraft,
  availableStateIds: ReadonlySet<string>,
): ScenarioConstraintSemantics {
  const deviceIds = draft.deviceIds.filter((id) => id.trim().length > 0);
  if (deviceIds.length === 0) {
    throw new Error("Each constraint must target at least one device");
  }
  const occupancy = occupancyValue(draft.occupancy, "Constraint occupancy");
  if (draft.kind === "forbid-states-when-room-occupancy") {
    const stateIds = draft.stateIds.filter((id) => id.trim().length > 0);
    if (stateIds.length === 0) {
      throw new Error("Choose at least one forbidden state");
    }
    if (stateIds.some((stateId) => !availableStateIds.has(stateId))) {
      throw new Error(`Constraint "${draft.id}" references a state that is not available on its selected devices`);
    }
    return { kind: draft.kind, deviceIds, occupancy, stateIds };
  }
  const stateId = draft.stateId.trim();
  if (stateId.length === 0) throw new Error("Choose the required state");
  if (!availableStateIds.has(stateId)) {
    throw new Error(`Constraint "${draft.id}" references a state that is not available on its selected devices`);
  }
  return { kind: draft.kind, deviceIds, occupancy, stateId };
}

function constraintDescription(draft: ConstraintDraft): string {
  const written = draft.description.trim();
  if (written.length > 0) return written;
  if (draft.kind === "forbid-states-when-room-occupancy") {
    return `When occupancy is ${draft.occupancy}, the selected devices must not use the forbidden states.`;
  }
  return `When occupancy is ${draft.occupancy}, the selected devices must use the required state.`;
}

export function buildScenario(
  scenarioName: string,
  buildingType: string,
  temperature: string,
  timeOfDay: string,
  lightIntensity: string,
  rooms: readonly RoomDraft[],
  constraints: readonly ConstraintDraft[],
): Scenario {
  if (rooms.length === 0) throw new Error("Add at least one room");
  if (constraints.length === 0) {
    throw new Error("Add at least one constraint so CSP can check feasibility");
  }
  for (const room of rooms) {
    if (room.devices.length === 0) {
      throw new Error(`Room "${room.name || room.id}" must contain at least one device`);
    }
  }
  const scenarioConstraints: ScenarioConstraint[] = constraints.map((draft) => {
    const availableStateIds = new Set(
      rooms
        .flatMap((room) => room.devices)
        .filter((device) => draft.deviceIds.includes(device.id))
        .flatMap((device) => device.states.map((operatingState) => operatingState.id)),
    );
    return {
      id: requiredText(draft.id, "Constraint identifier"),
      description: constraintDescription(draft),
      evaluationInputs: ["room occupancy", "selected device state"],
      semantics: semanticsFromDraft(draft, availableStateIds),
    };
  });
  const name = scenarioName.trim() === "" ? "Browser scenario" : scenarioName.trim();
  const type = buildingType.trim() === "" ? "generic" : buildingType.trim();
  return {
    id: "web-scenario",
    name,
    context: {
      ...(temperature.trim() === ""
        ? {}
        : { temperature: numberValue(temperature, "Temperature") }),
      ...(timeOfDay.trim() === "" ? {} : { timeOfDay: timeOfDay.trim() }),
      ...(lightIntensity.trim() === ""
        ? {}
        : { lightIntensity: nonNegative(lightIntensity, "Light intensity") }),
    },
    building: {
      id: "web-building",
      name,
      type,
      rooms: rooms.map((room) => ({
        id: requiredText(room.id, "Room identifier"),
        name: requiredText(room.name, "Room name"),
        occupancy: occupancyValue(room.occupancy, `Occupancy for ${room.name || "room"}`),
        devices: room.devices.map(deviceFromDraft),
      })),
    },
    constraints: scenarioConstraints,
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}
