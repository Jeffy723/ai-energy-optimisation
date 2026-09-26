import type { SolvableConstraint, SolvableCspProblem } from "./evaluation.js";
import type {
  ConstraintEvaluationResult,
  CspConfiguration,
  CspConstraint,
  CspValue,
} from "./contracts.js";
import type {
  Device,
  NumericConditionOperator,
  Scenario,
  ScenarioConstraint,
  ScenarioConstraintCondition,
  ScenarioConstraintSemantics,
} from "../../problem/scenario/contracts.js";

export class ScenarioConstraintAdapterError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScenarioConstraintAdapterError";
  }
}

interface DeviceContext {
  readonly device: Device;
  readonly occupancy: number;
}

type ForbidSemantics = Extract<
  ScenarioConstraintSemantics,
  { readonly kind: "forbid-states-when-room-occupancy" | "forbid-states-when-condition" }
>;

function isForbidSemantics(
  semantics: ScenarioConstraintSemantics,
): semantics is ForbidSemantics {
  return semantics.kind === "forbid-states-when-room-occupancy" ||
    semantics.kind === "forbid-states-when-condition";
}

function indexDevices(scenario: Scenario): Map<string, DeviceContext> {
  const devices = new Map<string, DeviceContext>();
  for (const room of scenario.building.rooms) {
    for (const device of room.devices) {
      devices.set(device.id, { device, occupancy: room.occupancy });
    }
  }
  return devices;
}

function semanticsFor(
  constraint: ScenarioConstraint,
): ScenarioConstraintSemantics {
  if (constraint.semantics === undefined) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" has no structured semantics`,
    );
  }
  return constraint.semantics;
}

function validateTargets(
  constraint: ScenarioConstraint,
  semantics: ScenarioConstraintSemantics,
  devices: ReadonlyMap<string, DeviceContext>,
): void {
  if (semantics.kind === "forbid-state-when-device-state") {
    if (semantics.conditionDeviceId === semantics.targetDeviceId) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" must relate two different devices`,
      );
    }
    validateDeviceState(
      constraint,
      semantics.conditionDeviceId,
      semantics.conditionStateId,
      "condition",
      devices,
    );
    validateDeviceState(
      constraint,
      semantics.targetDeviceId,
      semantics.forbiddenStateId,
      "target",
      devices,
    );
    return;
  }
  if (semantics.deviceIds.length === 0) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" must target at least one device`,
    );
  }
  for (const deviceId of semantics.deviceIds) {
    const context = devices.get(deviceId);
    if (context === undefined) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" references unknown device "${deviceId}"`,
      );
    }
  }
  const stateIds = isForbidSemantics(semantics)
    ? semantics.stateIds
    : [semantics.stateId];
  for (const stateId of stateIds) {
    const availableOnTarget = semantics.deviceIds.some((deviceId) =>
      devices
        .get(deviceId)!
        .device.availableStates.some((state) => state.id === stateId),
    );
    if (!availableOnTarget) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" references unknown target state "${stateId}"`,
      );
    }
  }
  if (
    semantics.kind === "forbid-states-when-room-occupancy" ||
    semantics.kind === "require-state-when-room-occupancy"
  ) {
    if (!Number.isInteger(semantics.occupancy) || semantics.occupancy < 0) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" occupancy must be a non-negative integer`,
      );
    }
    return;
  }
  validateCondition(constraint, semantics.condition);
}

function validateDeviceState(
  constraint: ScenarioConstraint,
  deviceId: string,
  stateId: string,
  role: "condition" | "target",
  devices: ReadonlyMap<string, DeviceContext>,
): void {
  const context = devices.get(deviceId);
  if (context === undefined) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" references unknown ${role} device "${deviceId}"`,
    );
  }
  if (!context.device.availableStates.some((state) => state.id === stateId)) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" references unknown ${role} state "${stateId}"`,
    );
  }
}

function validateCondition(
  constraint: ScenarioConstraint,
  condition: ScenarioConstraintCondition,
): void {
  if (condition.type === "scenario-number" && !Number.isFinite(condition.value)) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" condition value must be a finite number`,
    );
  }
  if (condition.type === "room-occupancy" &&
      (!Number.isInteger(condition.value) || condition.value < 0)) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" occupancy condition must be a non-negative integer`,
    );
  }
  if (condition.type === "scenario-text" && condition.value.trim() === "") {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" time-of-day condition must not be empty`,
    );
  }
  if (condition.type === "scenario-number" && condition.value < 0 &&
      condition.property === "lightIntensity") {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" light intensity condition must be non-negative`,
    );
  }
}

function conditionMatches(
  constraint: ScenarioConstraint,
  condition: ScenarioConstraintCondition,
  scenario: Scenario,
  device: DeviceContext,
): boolean {
  if (condition.type === "room-occupancy") {
    return numberMatches(device.occupancy, condition.operator, condition.value);
  }
  const actual = scenario.context?.[condition.property];
  if (actual === undefined || actual === null) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" requires scenario context "${condition.property}"`,
    );
  }
  if (condition.type === "scenario-text") {
    if (typeof actual !== "string") {
      throw new ScenarioConstraintAdapterError(
        `Scenario context "${condition.property}" for constraint "${constraint.id}" must be text`,
      );
    }
    return actual.trim().toLocaleLowerCase() === condition.value.trim().toLocaleLowerCase();
  }
  if (typeof actual !== "number" || !Number.isFinite(actual)) {
    throw new ScenarioConstraintAdapterError(
      `Scenario context "${condition.property}" for constraint "${constraint.id}" must be a finite number`,
    );
  }
  return numberMatches(actual, condition.operator, condition.value);
}

function numberMatches(
  actual: number,
  operator: NumericConditionOperator,
  expected: number,
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;
    case "greater-than":
      return actual > expected;
    case "greater-than-or-equal":
      return actual >= expected;
    case "less-than":
      return actual < expected;
    case "less-than-or-equal":
      return actual <= expected;
  }
}

function evaluateSemantics(
  constraint: ScenarioConstraint,
  semantics: ScenarioConstraintSemantics,
  assignment: CspConfiguration,
  devices: ReadonlyMap<string, DeviceContext>,
  scenario: Scenario | undefined,
): ConstraintEvaluationResult {
  validateTargets(constraint, semantics, devices);
  if (semantics.kind === "forbid-state-when-device-state") {
    const conditionValue = assignment[semantics.conditionDeviceId];
    if (conditionValue === undefined) {
      return {
        constraintId: constraint.id,
        status: "undecided",
        assignment: { ...assignment },
        reason: `Awaiting assignment for ${semantics.conditionDeviceId}`,
      };
    }
    if (conditionValue !== semantics.conditionStateId) {
      return {
        constraintId: constraint.id,
        status: "satisfied",
        assignment: { ...assignment },
      };
    }
    const targetValue = assignment[semantics.targetDeviceId];
    if (targetValue === undefined) {
      return {
        constraintId: constraint.id,
        status: "undecided",
        assignment: { ...assignment },
        reason: `Awaiting assignment for ${semantics.targetDeviceId}`,
      };
    }
    return targetValue === semantics.forbiddenStateId
      ? {
          constraintId: constraint.id,
          status: "violated",
          assignment: { ...assignment },
          reason: `${semantics.conditionDeviceId}=${semantics.conditionStateId} forbids ${semantics.targetDeviceId}=${semantics.forbiddenStateId}`,
        }
      : {
          constraintId: constraint.id,
          status: "satisfied",
          assignment: { ...assignment },
        };
  }
  const matches = (deviceId: string): boolean => {
    const target = devices.get(deviceId)!;
    if (semantics.kind === "forbid-states-when-room-occupancy" ||
        semantics.kind === "require-state-when-room-occupancy") {
      return target.occupancy === semantics.occupancy;
    }
    if (scenario === undefined) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" requires scenario context`,
      );
    }
    return conditionMatches(constraint, semantics.condition, scenario, target);
  };
  const matchingTargets = semantics.deviceIds.filter(matches);
  if (matchingTargets.length === 0) {
    return {
      constraintId: constraint.id,
      status: "satisfied",
      assignment: { ...assignment },
    };
  }
  const missingTarget = matchingTargets.find(
    (deviceId) => !Object.prototype.hasOwnProperty.call(assignment, deviceId),
  );
  if (missingTarget !== undefined) {
    return {
      constraintId: constraint.id,
      status: "undecided",
      assignment: { ...assignment },
      reason: `Awaiting assignment for ${missingTarget}`,
    };
  }

  if (isForbidSemantics(semantics)) {
    const violation = matchingTargets.find((deviceId) =>
      semantics.stateIds.includes(assignment[deviceId] as string),
    );
    return violation === undefined
      ? { constraintId: constraint.id, status: "satisfied", assignment: { ...assignment } }
      : {
          constraintId: constraint.id,
          status: "violated",
          assignment: { ...assignment },
          reason: `Device "${violation}" selected a forbidden state`,
        };
  }

  const violation = matchingTargets.find(
    (deviceId) => assignment[deviceId] !== semantics.stateId,
  );
  return violation === undefined
    ? { constraintId: constraint.id, status: "satisfied", assignment: { ...assignment } }
    : {
        constraintId: constraint.id,
        status: "violated",
        assignment: { ...assignment },
        reason: `Device "${violation}" must select state "${semantics.stateId}"`,
      };
}

export function adaptScenarioConstraint(
  constraint: ScenarioConstraint,
  devices: ReadonlyMap<string, DeviceContext>,
  scenario?: Scenario,
): SolvableConstraint {
  const semantics = semanticsFor(constraint);
  validateTargets(constraint, semantics, devices);
  if (
    semantics.kind === "forbid-states-when-condition" ||
    semantics.kind === "require-state-when-condition"
  ) {
    if (scenario === undefined) {
      throw new ScenarioConstraintAdapterError(
        `Constraint "${constraint.id}" requires scenario context`,
      );
    }
    conditionMatches(constraint, semantics.condition, scenario, devices.get(semantics.deviceIds[0])!);
  }
  const involvedVariables = semantics.kind === "forbid-state-when-device-state"
    ? [semantics.conditionDeviceId, semantics.targetDeviceId]
    : [...semantics.deviceIds];
  const solverConstraint: CspConstraint = {
    id: constraint.id,
    involvedVariables,
    ...(semantics.kind === "forbid-state-when-device-state"
      ? {}
      : { degreeRelevant: false }),
    description: constraint.description,
    evaluationSemantics: semantics.kind,
    evaluationInputs: constraint.evaluationInputs ?? [],
    evaluationResult: { status: "undecided" },
  };
  return {
    constraint: solverConstraint,
    evaluate: (assignment) =>
      evaluateSemantics(constraint, semantics, assignment, devices, scenario),
  };
}

export function createSolvableCspProblem(
  scenario: Scenario,
): SolvableCspProblem {
  const devices = indexDevices(scenario);
  const variableIds = [...devices.keys()];
  const domains = new Map<string, readonly CspValue[]>();
  for (const [deviceId, context] of devices) {
    domains.set(
      deviceId,
      context.device.availableStates.map((state) => state.id),
    );
  }
  return {
    variableIds,
    domains,
    constraints: scenario.constraints.map((constraint) =>
      adaptScenarioConstraint(constraint, devices, scenario),
    ),
  };
}
