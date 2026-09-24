import type { CspConfiguration } from "../../csp/model/contracts.js";
import type { Identifier } from "../../problem/scenario/contracts.js";

export interface DeviceEnergyMeasurement {
  readonly roomId: Identifier;
  readonly deviceId: Identifier;
  readonly stateId: Identifier;
  readonly powerKw: number;
  readonly operatingTimeHours: number;
  readonly energyKwh: number;
}

export interface RoomEnergyMeasurement {
  readonly roomId: Identifier;
  readonly energyKwh: number;
  readonly devices: readonly DeviceEnergyMeasurement[];
}

export interface EnergyCalculation {
  readonly configuration: CspConfiguration;
  readonly devices: readonly DeviceEnergyMeasurement[];
  readonly rooms: readonly RoomEnergyMeasurement[];
  readonly totalEnergyKwh: number;
  readonly unit: "kWh";
}
