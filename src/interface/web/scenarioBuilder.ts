import type {
  Device,
  Scenario,
  ScenarioConstraint,
  ScenarioConstraintCondition,
  ScenarioConstraintSemantics,
} from "../../problem/scenario/contracts.js";
import type { ConstraintConditionField, ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";

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
  stateIdsByDevice: ReadonlyMap<string, ReadonlySet<string>>,
): ScenarioConstraintSemantics {
  if (draft.kind === "forbid-state-when-device-state") {
    const targetDeviceIds = draft.deviceIds.filter((id) => id.trim().length > 0);
    if (targetDeviceIds.length !== 1) {
      throw new Error("A device-to-device constraint must target exactly one device");
    }
    const conditionDeviceId = draft.conditionDeviceId?.trim() ?? "";
    if (conditionDeviceId.length === 0 || !stateIdsByDevice.has(conditionDeviceId)) {
      throw new Error("Choose a valid condition device");
    }
    if (conditionDeviceId === targetDeviceIds[0]) {
      throw new Error("A device-to-device constraint must relate two different devices");
    }
    const conditionStateId = draft.conditionStateId?.trim() ?? "";
    if (!stateIdsByDevice.get(conditionDeviceId)?.has(conditionStateId)) {
      throw new Error("Choose a condition state available on its device");
    }
    const forbiddenStates = validateForbiddenStates(draft, availableStateIds);
    if (forbiddenStates.length !== 1) {
      throw new Error("A device-to-device constraint must forbid exactly one target state");
    }
    return {
      kind: "forbid-state-when-device-state",
      conditionDeviceId,
      conditionStateId,
      targetDeviceId: targetDeviceIds[0],
      forbiddenStateId: forbiddenStates[0],
    };
  }
  const deviceIds = draft.deviceIds.filter((id) => id.trim().length > 0);
  if (deviceIds.length === 0) {
    throw new Error("Each constraint must target at least one device");
  }
  const forbid = draft.kind.startsWith("forbid-");
  const conditionField: ConstraintConditionField = draft.conditionField ?? "room-occupancy";
  const conditionValue = draft.conditionValue ?? draft.occupancy;
  const operator = draft.conditionOperator ?? "equals";
  const condition: ScenarioConstraintCondition = conditionField === "room-occupancy"
    ? {
        type: "room-occupancy",
        operator,
        value: occupancyValue(conditionValue, "Constraint occupancy"),
      }
    : conditionField === "temperature" || conditionField === "lightIntensity"
      ? {
          type: "scenario-number",
          property: conditionField,
          operator,
          value: conditionField === "lightIntensity"
            ? nonNegative(conditionValue, "Constraint light intensity")
            : numberValue(conditionValue, "Constraint temperature"),
        }
      : {
          type: "scenario-text",
          property: "timeOfDay",
          operator: "equals",
          value: requiredText(conditionValue, "Constraint time of day"),
        };
  if (condition.type === "room-occupancy" && operator === "equals") {
    const occupancy = condition.value;
    if (forbid) {
      const stateIds = validateForbiddenStates(draft, availableStateIds);
      return { kind: "forbid-states-when-room-occupancy", deviceIds, occupancy, stateIds };
    }
    const stateId = validateRequiredState(draft, availableStateIds);
    return { kind: "require-state-when-room-occupancy", deviceIds, occupancy, stateId };
  }
  if (forbid) {
    const stateIds = validateForbiddenStates(draft, availableStateIds);
    return { kind: "forbid-states-when-condition", deviceIds, condition, stateIds };
  }
  return {
    kind: "require-state-when-condition",
    deviceIds,
    condition,
    stateId: validateRequiredState(draft, availableStateIds),
  };
}

function validateForbiddenStates(
  draft: ConstraintDraft,
  availableStateIds: ReadonlySet<string>,
): string[] {
  const stateIds = draft.stateIds.filter((id) => id.trim().length > 0);
  if (stateIds.length === 0) throw new Error("Choose at least one forbidden state");
  if (stateIds.some((stateId) => !availableStateIds.has(stateId))) {
    throw new Error(`Constraint "${draft.id}" references a state that is not available on its selected devices`);
  }
  return stateIds;
}

function validateRequiredState(
  draft: ConstraintDraft,
  availableStateIds: ReadonlySet<string>,
): string {
  const stateId = draft.stateId.trim();
  if (stateId.length === 0) throw new Error("Choose the required state");
  if (!availableStateIds.has(stateId)) {
    throw new Error(`Constraint "${draft.id}" references a state that is not available on its selected devices`);
  }
  return stateId;
}

function constraintDescription(draft: ConstraintDraft): string {
  const written = draft.description.trim();
  if (written.length > 0) return written;
  if (draft.kind === "forbid-state-when-device-state") {
    return `When the condition device is in the selected state, the target device cannot use the forbidden state.`;
  }
  const action = draft.kind.startsWith("forbid-")
    ? "must not use the forbidden states"
    : "must use the required state";
  const fieldName = {
    "room-occupancy": "occupancy",
    temperature: "temperature",
    lightIntensity: "light intensity",
    timeOfDay: "time of day",
  }[draft.conditionField ?? "room-occupancy"];
  return `When ${fieldName} ${draft.conditionOperator ?? "equals"} ${draft.conditionValue ?? draft.occupancy}, the selected devices ${action}.`;
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
  const stateIdsByDevice = new Map(
    rooms.flatMap((room) => room.devices.map((device) => [
      device.id,
      new Set(device.states.map((operatingState) => operatingState.id)),
    ] as const)),
  );
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
      evaluationInputs: draft.kind === "forbid-state-when-device-state"
        ? ["condition device state", "target device state"]
        : [
        draft.conditionField === "temperature"
          ? "scenario temperature"
          : draft.conditionField === "lightIntensity"
            ? "scenario light intensity"
            : draft.conditionField === "timeOfDay"
              ? "scenario time of day"
              : "room occupancy",
        "selected device state",
          ],
      semantics: semanticsFromDraft(draft, availableStateIds, stateIdsByDevice),
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
