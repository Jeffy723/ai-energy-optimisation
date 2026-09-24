import type { SolvableConstraint, SolvableCspProblem } from "./evaluation.js";
import type {
  ConstraintEvaluationResult,
  CspConfiguration,
  CspConstraint,
  CspValue,
} from "./contracts.js";
import type {
  Device,
  Scenario,
  ScenarioConstraint,
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
  const stateIds =
    semantics.kind === "forbid-states-when-room-occupancy"
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
  if (!Number.isInteger(semantics.occupancy) || semantics.occupancy < 0) {
    throw new ScenarioConstraintAdapterError(
      `Constraint "${constraint.id}" occupancy must be a non-negative integer`,
    );
  }
}

function evaluateSemantics(
  constraint: ScenarioConstraint,
  semantics: ScenarioConstraintSemantics,
  assignment: CspConfiguration,
  devices: ReadonlyMap<string, DeviceContext>,
): ConstraintEvaluationResult {
  validateTargets(constraint, semantics, devices);
  const matchingTargets = semantics.deviceIds.filter(
    (deviceId) => devices.get(deviceId)!.occupancy === semantics.occupancy,
  );
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

  if (semantics.kind === "forbid-states-when-room-occupancy") {
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
): SolvableConstraint {
  const semantics = semanticsFor(constraint);
  validateTargets(constraint, semantics, devices);
  const solverConstraint: CspConstraint = {
    id: constraint.id,
    involvedVariables: [...semantics.deviceIds],
    description: constraint.description,
    evaluationSemantics: semantics.kind,
    evaluationInputs: constraint.evaluationInputs ?? [],
    evaluationResult: { status: "undecided" },
  };
  return {
    constraint: solverConstraint,
    evaluate: (assignment) =>
      evaluateSemantics(constraint, semantics, assignment, devices),
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
      adaptScenarioConstraint(constraint, devices),
    ),
  };
}
