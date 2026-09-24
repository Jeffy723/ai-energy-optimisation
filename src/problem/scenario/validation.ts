/**
 * Validation for the generic scenario model.
 *
 * All functions are pure: they accept a value and return a ValidationResult.
 * No mutation, no side effects, no energy calculations, no CSP logic.
 *
 * Validation rules are derived solely from DATA_MODEL.md:
 * - Identifiers must be non-empty strings.
 * - Names must be non-empty strings where required.
 * - occupancy must be a non-negative integer.
 * - ratedPower must be a finite positive number (kW).
 * - operatingTime must be a finite non-negative number (hours).
 * - effectivePower, when present, must be a finite non-negative number (kW).
 * - availableStates must be a non-empty array with unique IDs.
 * - A Scenario must reference at least one constraint and one objectiveId.
 * - A Building must contain at least one room.
 * - A Room must contain at least one device.
 */

import type {
  Building,
  Device,
  DeviceOperatingState,
  Identifier,
  ObjectiveConfiguration,
  Room,
  Scenario,
  ScenarioConstraint,
} from "./contracts.js";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ValidationSuccess {
  readonly valid: true;
}

export interface ValidationFailure {
  readonly valid: false;
  /** One or more human-readable messages describing what failed. */
  readonly errors: readonly string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function success(): ValidationSuccess {
  return { valid: true };
}

function failure(errors: readonly string[]): ValidationFailure {
  return { valid: false, errors };
}

function merge(...results: ValidationResult[]): ValidationResult {
  const errors: string[] = [];
  for (const r of results) {
    if (!r.valid) {
      errors.push(...r.errors);
    }
  }
  return errors.length > 0 ? failure(errors) : success();
}

// ---------------------------------------------------------------------------
// Primitive guards
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

// ---------------------------------------------------------------------------
// Identifier
// ---------------------------------------------------------------------------

/**
 * Validates that `id` is a non-empty string.
 */
export function validateIdentifier(
  id: unknown,
  context: string,
): ValidationResult {
  if (!isNonEmptyString(id)) {
    return failure([`${context}: identifier must be a non-empty string`]);
  }
  return success();
}

// ---------------------------------------------------------------------------
// DeviceOperatingState
// ---------------------------------------------------------------------------

/**
 * Validates a single DeviceOperatingState.
 *
 * Rules:
 * - id must be a non-empty string.
 * - effectivePower, when present, must be a finite non-negative number (kW).
 *   Zero is allowed (e.g. device is in an "off" state).
 */
export function validateDeviceOperatingState(
  state: DeviceOperatingState,
  context: string,
): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(state.id, `${context}.id`));

  if (state.effectivePower !== undefined) {
    if (!isFiniteNonNegative(state.effectivePower)) {
      results.push(
        failure([
          `${context}.effectivePower must be a finite non-negative number (kW) when present`,
        ]),
      );
    }
  }

  return merge(...results);
}

// ---------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------

/**
 * Validates a Device.
 *
 * Rules:
 * - id must be a non-empty string.
 * - type must be a non-empty string.
 * - ratedPower must be a finite positive number (kW).
 * - operatingTime must be a finite non-negative number (hours).
 * - availableStates must be a non-empty array with unique ids.
 * - Each state is individually validated.
 */
export function validateDevice(
  device: Device,
  context: string,
): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(device.id, `${context}.id`));

  if (!isNonEmptyString(device.type)) {
    results.push(failure([`${context}.type must be a non-empty string`]));
  }

  if (!isFinitePositive(device.ratedPower)) {
    results.push(
      failure([`${context}.ratedPower must be a finite positive number (kW)`]),
    );
  }

  if (!isFiniteNonNegative(device.operatingTime)) {
    results.push(
      failure([
        `${context}.operatingTime must be a finite non-negative number (hours)`,
      ]),
    );
  }

  if (!Array.isArray(device.availableStates) || device.availableStates.length === 0) {
    results.push(
      failure([`${context}.availableStates must be a non-empty array`]),
    );
  } else {
    // Validate each state
    for (const state of device.availableStates) {
      results.push(
        validateDeviceOperatingState(
          state,
          `${context}.availableStates[${state.id}]`,
        ),
      );
    }

    // Check for duplicate state IDs
    const stateIds = device.availableStates.map((s) => s.id);
    const uniqueIds = new Set(stateIds);
    if (uniqueIds.size !== stateIds.length) {
      results.push(
        failure([
          `${context}.availableStates contains duplicate state ids`,
        ]),
      );
    }
  }

  return merge(...results);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * Validates a Room.
 *
 * Rules:
 * - id must be a non-empty string.
 * - name must be a non-empty string.
 * - occupancy must be a non-negative integer (number of occupants).
 * - devices must be a non-empty array with unique ids.
 * - Each device is individually validated.
 */
export function validateRoom(room: Room, context: string): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(room.id, `${context}.id`));

  if (!isNonEmptyString(room.name)) {
    results.push(failure([`${context}.name must be a non-empty string`]));
  }

  if (!isNonNegativeInteger(room.occupancy)) {
    results.push(
      failure([
        `${context}.occupancy must be a non-negative integer (number of occupants)`,
      ]),
    );
  }

  if (!Array.isArray(room.devices) || room.devices.length === 0) {
    results.push(
      failure([`${context}.devices must be a non-empty array`]),
    );
  } else {
    for (const device of room.devices) {
      results.push(validateDevice(device, `${context}.devices[${device.id}]`));
    }

    const deviceIds = room.devices.map((d) => d.id);
    const uniqueIds = new Set(deviceIds);
    if (uniqueIds.size !== deviceIds.length) {
      results.push(
        failure([`${context}.devices contains duplicate device ids`]),
      );
    }
  }

  return merge(...results);
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * Validates a Building.
 *
 * Rules:
 * - id must be a non-empty string.
 * - name must be a non-empty string.
 * - type must be a non-empty string (generic data; no enumeration imposed).
 * - rooms must be a non-empty array with unique ids.
 * - Each room is individually validated.
 */
export function validateBuilding(
  building: Building,
  context: string,
): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(building.id, `${context}.id`));

  if (!isNonEmptyString(building.name)) {
    results.push(failure([`${context}.name must be a non-empty string`]));
  }

  if (!isNonEmptyString(building.type)) {
    results.push(failure([`${context}.type must be a non-empty string`]));
  }

  if (!Array.isArray(building.rooms) || building.rooms.length === 0) {
    results.push(
      failure([`${context}.rooms must be a non-empty array`]),
    );
  } else {
    for (const room of building.rooms) {
      results.push(validateRoom(room, `${context}.rooms[${room.id}]`));
    }

    const roomIds = building.rooms.map((r) => r.id);
    const uniqueIds = new Set(roomIds);
    if (uniqueIds.size !== roomIds.length) {
      results.push(
        failure([`${context}.rooms contains duplicate room ids`]),
      );
    }
  }

  return merge(...results);
}

// ---------------------------------------------------------------------------
// ScenarioConstraint
// ---------------------------------------------------------------------------

/**
 * Validates a ScenarioConstraint.
 *
 * Rules:
 * - id must be a non-empty string.
 * - description must be a non-empty string.
 */
export function validateScenarioConstraint(
  constraint: ScenarioConstraint,
  context: string,
): ValidationResult {
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(constraint.id, `${context}.id`));

  if (!isNonEmptyString(constraint.description)) {
    results.push(
      failure([`${context}.description must be a non-empty string`]),
    );
  }

  return merge(...results);
}

// ---------------------------------------------------------------------------
// ObjectiveConfiguration
// ---------------------------------------------------------------------------

/**
 * Validates an ObjectiveConfiguration.
 *
 * Rules:
 * - objectiveId must be a non-empty string.
 */
export function validateObjectiveConfiguration(
  config: ObjectiveConfiguration,
  context: string,
): ValidationResult {
  return validateIdentifier(config.objectiveId, `${context}.objectiveId`);
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/**
 * Validates a complete Scenario.
 *
 * Rules:
 * - id must be a non-empty string.
 * - name must be a non-empty string.
 * - building is validated recursively.
 * - constraints must be a non-empty array of valid ScenarioConstraints
 *   with unique ids.
 * - objectiveConfiguration must carry a non-empty objectiveId.
 *
 * Cross-cutting:
 * - All identifiers within a scenario are validated for non-emptiness.
 * - Uniqueness of ids is checked within each collection scope
 *   (rooms, devices, states, constraints).
 * - No energy values, CSP structures, or algorithm output are validated here.
 */
export function validateScenario(scenario: Scenario): ValidationResult {
  const ctx = `Scenario[${scenario.id}]`;
  const results: ValidationResult[] = [];

  results.push(validateIdentifier(scenario.id, `${ctx}.id`));

  if (!isNonEmptyString(scenario.name)) {
    results.push(failure([`${ctx}.name must be a non-empty string`]));
  }

  results.push(validateBuilding(scenario.building, `${ctx}.building`));

  if (
    !Array.isArray(scenario.constraints) ||
    scenario.constraints.length === 0
  ) {
    results.push(
      failure([`${ctx}.constraints must be a non-empty array`]),
    );
  } else {
    for (const c of scenario.constraints) {
      results.push(
        validateScenarioConstraint(c, `${ctx}.constraints[${c.id}]`),
      );
    }

    const constraintIds = scenario.constraints.map((c) => c.id);
    const uniqueConstraintIds = new Set(constraintIds);
    if (uniqueConstraintIds.size !== constraintIds.length) {
      results.push(
        failure([`${ctx}.constraints contains duplicate constraint ids`]),
      );
    }
  }

  results.push(
    validateObjectiveConfiguration(
      scenario.objectiveConfiguration,
      `${ctx}.objectiveConfiguration`,
    ),
  );

  return merge(...results);
}

// ---------------------------------------------------------------------------
// Helper: collect all device ids across the entire scenario
// ---------------------------------------------------------------------------

/**
 * Returns every device Identifier present in the scenario.
 * Useful for downstream validation (e.g. domain rules referencing device ids).
 */
export function collectDeviceIds(scenario: Scenario): ReadonlySet<Identifier> {
  const ids = new Set<Identifier>();
  for (const room of scenario.building.rooms) {
    for (const device of room.devices) {
      ids.add(device.id);
    }
  }
  return ids;
}

/**
 * Returns every room Identifier present in the scenario.
 */
export function collectRoomIds(scenario: Scenario): ReadonlySet<Identifier> {
  const ids = new Set<Identifier>();
  for (const room of scenario.building.rooms) {
    ids.add(room.id);
  }
  return ids;
}
