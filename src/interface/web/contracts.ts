import type { ScenarioConstraintSemantics } from "../../problem/scenario/contracts.js";

export interface StateDraft {
  id: string;
  name: string;
  effectivePower: string;
}

export interface DeviceDraft {
  id: string;
  type: string;
  ratedPower: string;
  operatingTime: string;
  states: StateDraft[];
}

export interface RoomDraft {
  id: string;
  name: string;
  occupancy: string;
  devices: DeviceDraft[];
}

export interface ConstraintDraft {
  id: string;
  description: string;
  kind: ScenarioConstraintSemantics["kind"];
  deviceIds: string[];
  occupancy: string;
  stateIds: string[];
  stateId: string;
}

export interface ScenarioFormState {
  scenarioName: string;
  buildingType: string;
  temperature: string;
  timeOfDay: string;
  lightIntensity: string;
  rooms: RoomDraft[];
  constraints: ConstraintDraft[];
}
