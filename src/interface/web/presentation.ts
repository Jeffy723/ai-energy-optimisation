import type { CspConfiguration, CspValue } from "../../csp/model/contracts.js";
import { calculateEnergy } from "../../energy/calculator/calculator.js";
import type { EnergyComparison } from "../../energy/objective/contracts.js";
import type { Scenario } from "../../problem/scenario/contracts.js";
import type { CspExecutionEvent, HillClimbingExecutionEvent } from "../../visualisation/events/contracts.js";

export function formatEnergy(value: number): string {
  if (!Number.isFinite(value)) return "unavailable";
  return `${value.toFixed(2)} kWh`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "unavailable";
  return `${value.toFixed(2)}%`;
}

export function formatPower(value: number): string {
  if (!Number.isFinite(value)) return "unavailable";
  return `${value.toFixed(2)} kW`;
}

export interface NameMaps {
  readonly rooms: ReadonlyMap<string, string>;
  readonly devices: ReadonlyMap<string, { roomId: string; roomName: string; name: string }>;
  readonly states: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

export function nameMapsFromScenario(scenario: Scenario): NameMaps {
  const rooms = new Map<string, string>();
  const devices = new Map<string, { roomId: string; roomName: string; name: string }>();
  const states = new Map<string, Map<string, string>>();
  for (const room of scenario.building.rooms) {
    rooms.set(room.id, room.name);
    for (const device of room.devices) {
      devices.set(device.id, { roomId: room.id, roomName: room.name, name: device.type });
      const stateNames = new Map<string, string>();
      for (const state of device.availableStates) {
        stateNames.set(state.id, state.label ?? state.id);
      }
      states.set(device.id, stateNames);
    }
  }
  return { rooms, devices, states };
}

export function deviceLabel(maps: NameMaps, deviceId: string): string {
  return maps.devices.get(deviceId)?.name ?? deviceId;
}

export function stateLabel(maps: NameMaps, deviceId: string, value: CspValue | undefined): string {
  if (value === undefined) return "";
  const text = String(value);
  return maps.states.get(deviceId)?.get(text) ?? text;
}

export function formatAssignment(
  assignment: CspConfiguration,
  maps: NameMaps,
): string {
  const parts = Object.entries(assignment).map(
    ([deviceId, value]) => `${deviceLabel(maps, deviceId)}: ${stateLabel(maps, deviceId, value)}`,
  );
  return parts.length === 0 ? "{ }" : `{ ${parts.join(", ")} }`;
}

export interface DeviceEnergyRow {
  readonly roomName: string;
  readonly deviceName: string;
  readonly initialState: string;
  readonly initialEnergyKwh: number;
  readonly optimisedState: string;
  readonly optimisedEnergyKwh: number;
}

export interface RoomEnergyRow {
  readonly roomName: string;
  readonly initialEnergyKwh: number;
  readonly optimisedEnergyKwh: number;
}

export interface EnergyBreakdown {
  readonly initialTotalKwh: number;
  readonly optimisedTotalKwh: number;
  readonly devices: readonly DeviceEnergyRow[];
  readonly rooms: readonly RoomEnergyRow[];
}

export function energyBreakdown(
  scenario: Scenario,
  initialConfiguration: CspConfiguration,
  optimisedConfiguration: CspConfiguration,
): EnergyBreakdown {
  const maps = nameMapsFromScenario(scenario);
  const initial = calculateEnergy(scenario, initialConfiguration);
  const optimised = calculateEnergy(scenario, optimisedConfiguration);
  const optimisedByDevice = new Map(optimised.devices.map((item) => [item.deviceId, item]));
  const devices: DeviceEnergyRow[] = initial.devices.map((item) => {
    const later = optimisedByDevice.get(item.deviceId);
    const names = maps.devices.get(item.deviceId);
    return {
      roomName: names?.roomName ?? item.roomId,
      deviceName: names?.name ?? item.deviceId,
      initialState: stateLabel(maps, item.deviceId, item.stateId),
      initialEnergyKwh: item.energyKwh,
      optimisedState: later === undefined ? "—" : stateLabel(maps, item.deviceId, later.stateId),
      optimisedEnergyKwh: later?.energyKwh ?? 0,
    };
  });
  const optimisedByRoom = new Map(optimised.rooms.map((item) => [item.roomId, item]));
  const rooms: RoomEnergyRow[] = initial.rooms.map((item) => ({
    roomName: maps.rooms.get(item.roomId) ?? item.roomId,
    initialEnergyKwh: item.energyKwh,
    optimisedEnergyKwh: optimisedByRoom.get(item.roomId)?.energyKwh ?? 0,
  }));
  return {
    initialTotalKwh: initial.totalEnergyKwh,
    optimisedTotalKwh: optimised.totalEnergyKwh,
    devices,
    rooms,
  };
}

export function totalsMatchPipeline(
  breakdown: EnergyBreakdown,
  comparison: EnergyComparison,
): boolean {
  return (
    breakdown.initialTotalKwh === comparison.initialEnergy &&
    breakdown.optimisedTotalKwh === comparison.optimisedEnergy
  );
}

export function describeCspEvent(event: CspExecutionEvent, maps: NameMaps): string | undefined {
  switch (event.type) {
    case "VARIABLE_SELECTED":
      return `Variable selected: ${deviceLabel(maps, event.variable)}`;
    case "VALUE_TRIED":
      return `Value tried: ${deviceLabel(maps, event.variable)} = ${stateLabel(maps, event.variable, event.value)}`;
    case "CONSTRAINT_FAILED":
      return `Constraint failed${event.reason ? `: ${event.reason}` : ""}`;
    case "FORWARD_CHECK": {
      const pruned = event.prunedValues
        .map((item) => `${deviceLabel(maps, item.variable)} = ${stateLabel(maps, item.variable, item.value)}`)
        .join(", ");
      return pruned.length === 0 ? "Forward checking (no values pruned)" : `Pruned values: ${pruned}`;
    }
    case "BACKTRACK":
      return event.variable === undefined
        ? "Backtracking"
        : `Backtracking from ${deviceLabel(maps, event.variable)}${
            event.value === undefined ? "" : ` = ${stateLabel(maps, event.variable, event.value)}`
          }`;
    case "SOLUTION_FOUND":
      return "Feasible solution found";
    case "CONSTRAINT_CHECKED":
      return undefined;
  }
}

export function describeHillClimbingEvent(event: HillClimbingExecutionEvent): string {
  const current = formatEnergy(event.currentObjective.value);
  switch (event.type) {
    case "INITIAL_STATE":
      return `Initial feasible state · ${current}`;
    case "NEIGHBOUR_EVALUATED": {
      const candidate = formatEnergy(event.candidateObjective.value);
      const decision = event.decision === "accepted" ? "better neighbour" : "not an improvement";
      return `Neighbour evaluated · ${candidate} (${decision})`;
    }
    case "MOVE_ACCEPTED":
      return `Move accepted · now ${formatEnergy(event.candidateObjective.value)}`;
    case "NO_BETTER_NEIGHBOUR":
      return `No better feasible neighbour · ${current}`;
    case "OPTIMUM_FOUND":
      return `Local optimum · ${current}`;
  }
}
