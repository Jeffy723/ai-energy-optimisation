import type { CspConfiguration } from "../../csp/model/contracts.js";
import type { Device, Scenario } from "../../problem/scenario/contracts.js";
import { validateScenario } from "../../problem/scenario/validation.js";
import type {
  DeviceEnergyMeasurement,
  EnergyCalculation,
  RoomEnergyMeasurement,
} from "./contracts.js";

export class InvalidEnergyConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidEnergyConfigurationError";
  }
}

function invalid(message: string): never {
  throw new InvalidEnergyConfigurationError(message);
}

function validateInputs(scenario: Scenario, configuration: CspConfiguration): void {
  const scenarioValidation = validateScenario(scenario);
  if (!scenarioValidation.valid) {
    invalid(`Invalid scenario: ${scenarioValidation.errors.join("; ")}`);
  }

  if (configuration === null || typeof configuration !== "object") {
    invalid("Configuration must be an object");
  }
}

function indexDevices(scenario: Scenario): Map<string, { roomId: string; device: Device }> {
  const devices = new Map<string, { roomId: string; device: Device }>();
  for (const room of scenario.building.rooms) {
    for (const device of room.devices) {
      devices.set(device.id, { roomId: room.id, device });
    }
  }
  return devices;
}

function stateForDevice(
  deviceId: string,
  device: Device,
  value: unknown,
): { id: string; effectivePower?: number } {
  if (typeof value !== "string") {
    invalid(`Configuration value for device "${deviceId}" must be a state identifier`);
  }

  const state = device.availableStates.find((candidate) => candidate.id === value);
  if (state === undefined) {
    invalid(`Configuration selects unknown state "${value}" for device "${deviceId}"`);
  }
  return state;
}

/**
 * Calculates energy for a complete CSP configuration.
 *
 * Configuration keys are device IDs and values are the selected operating-state
 * IDs. A state's effectivePower takes precedence over ratedPower; otherwise
 * ratedPower is used. Power is in kW, time is in hours, and energy is in kWh.
 */
export function calculateEnergy(
  scenario: Scenario,
  configuration: CspConfiguration,
): EnergyCalculation {
  validateInputs(scenario, configuration);
  const devicesById = indexDevices(scenario);
  const configurationIds = Object.keys(configuration);

  for (const deviceId of configurationIds) {
    if (!devicesById.has(deviceId)) {
      invalid(`Configuration contains unknown device "${deviceId}"`);
    }
  }
  for (const deviceId of devicesById.keys()) {
    if (!Object.prototype.hasOwnProperty.call(configuration, deviceId)) {
      invalid(`Configuration is missing an assignment for device "${deviceId}"`);
    }
  }

  const roomResults: RoomEnergyMeasurement[] = [];
  const deviceResults: DeviceEnergyMeasurement[] = [];

  for (const room of scenario.building.rooms) {
    const roomDevices: DeviceEnergyMeasurement[] = [];
    for (const device of room.devices) {
      const state = stateForDevice(device.id, device, configuration[device.id]);
      const powerKw = state.effectivePower ?? device.ratedPower;
      const energyKwh = powerKw * device.operatingTime;
      const measurement: DeviceEnergyMeasurement = {
        roomId: room.id,
        deviceId: device.id,
        stateId: state.id,
        powerKw,
        operatingTimeHours: device.operatingTime,
        energyKwh,
      };
      roomDevices.push(measurement);
      deviceResults.push(measurement);
    }
    roomResults.push({
      roomId: room.id,
      energyKwh: roomDevices.reduce((total, device) => total + device.energyKwh, 0),
      devices: roomDevices,
    });
  }

  return {
    configuration: { ...configuration },
    devices: deviceResults,
    rooms: roomResults,
    totalEnergyKwh: roomResults.reduce((total, room) => total + room.energyKwh, 0),
    unit: "kWh",
  };
}

export const calculateConfigurationEnergy = calculateEnergy;
