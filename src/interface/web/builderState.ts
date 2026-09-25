import type { ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";

export interface BuilderCollections {
  rooms: RoomDraft[];
  constraints: ConstraintDraft[];
}

export function addRoom(state: BuilderCollections, room: RoomDraft): void {
  state.rooms.push(room);
}

export function removeRoom(state: BuilderCollections, roomIndex: number): void {
  state.rooms.splice(roomIndex, 1);
}

export function addDevice(state: BuilderCollections, roomIndex: number, device: DeviceDraft): void {
  state.rooms[roomIndex].devices.push(device);
}

export function removeDevice(state: BuilderCollections, roomIndex: number, deviceIndex: number): void {
  state.rooms[roomIndex].devices.splice(deviceIndex, 1);
}

export function addState(
  state: BuilderCollections,
  roomIndex: number,
  deviceIndex: number,
  operatingState: StateDraft,
): void {
  state.rooms[roomIndex].devices[deviceIndex].states.push(operatingState);
}

export function removeState(
  state: BuilderCollections,
  roomIndex: number,
  deviceIndex: number,
  stateIndex: number,
): void {
  state.rooms[roomIndex].devices[deviceIndex].states.splice(stateIndex, 1);
}

export function addConstraint(state: BuilderCollections, constraint: ConstraintDraft): void {
  state.constraints.push(constraint);
}

export function removeConstraint(state: BuilderCollections, constraintIndex: number): void {
  state.constraints.splice(constraintIndex, 1);
}
