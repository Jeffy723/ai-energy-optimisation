import type {
  Device,
  Scenario,
  ScenarioConstraint,
  ScenarioConstraintSemantics,
} from "../../problem/scenario/contracts.js";
import type { ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";

function numberValue(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
  return parsed;
}

function stateFromDraft(state: StateDraft): Device["availableStates"][number] {
  return {
    id: state.id.trim(),
    ...(state.effectivePower.trim() === ""
      ? {}
      : { effectivePower: numberValue(state.effectivePower, `State ${state.id} power`) }),
  };
}

function deviceFromDraft(draft: DeviceDraft): Device {
  if (draft.states.length === 0) {
    throw new Error(`Device "${draft.id}" must have at least one operating state`);
  }
  return {
    id: draft.id.trim(),
    type: draft.type.trim(),
    ratedPower: numberValue(draft.ratedPower, `Device ${draft.id} rated power`),
    operatingTime: numberValue(draft.operatingTime, `Device ${draft.id} operating time`),
    availableStates: draft.states.map(stateFromDraft),
  };
}

function semanticsFromDraft(draft: ConstraintDraft): ScenarioConstraintSemantics {
  const deviceIds = draft.deviceIds.filter((id) => id.trim().length > 0);
  const occupancy = numberValue(draft.occupancy, `Constraint ${draft.id} occupancy`);
  if (draft.kind === "forbid-states-when-room-occupancy") {
    return { kind: draft.kind, deviceIds, occupancy, stateIds: draft.stateIds.filter((id) => id.trim().length > 0) };
  }
  return { kind: draft.kind, deviceIds, occupancy, stateId: draft.stateId.trim() };
}

export function buildScenario(
  scenarioName: string,
  buildingType: string,
  temperature: string,
  timeOfDay: string,
  rooms: readonly RoomDraft[],
  constraints: readonly ConstraintDraft[],
): Scenario {
  if (rooms.length === 0) throw new Error("Add at least one room");
  const scenarioConstraints: ScenarioConstraint[] = constraints.map((draft) => ({
    id: draft.id.trim(),
    description: draft.description.trim(),
    evaluationInputs: ["room occupancy", "selected device state"],
    semantics: semanticsFromDraft(draft),
  }));
  return {
    id: "web-scenario",
    name: scenarioName.trim(),
    context: {
      ...(temperature.trim() === "" ? {} : { temperature: numberValue(temperature, "Temperature") }),
      ...(timeOfDay.trim() === "" ? {} : { timeOfDay: timeOfDay.trim() }),
    },
    building: {
      id: "web-building",
      name: scenarioName.trim(),
      type: buildingType.trim(),
      rooms: rooms.map((room) => ({
        id: room.id.trim(),
        name: room.name.trim(),
        occupancy: numberValue(room.occupancy, `Room ${room.name} occupancy`),
        devices: room.devices.map(deviceFromDraft),
      })),
    },
    constraints: scenarioConstraints,
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}
