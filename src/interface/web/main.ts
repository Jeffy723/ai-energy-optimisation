import "./styles.css";
import { createSolvableCspProblem } from "../../csp/model/scenarioAdapter.js";
import { loadScenario } from "../input/index.js";
import { runPipeline } from "../pipeline/index.js";
import type { PipelineResult } from "../pipeline/contracts.js";
import type { SearchTreeNode } from "../../visualisation/searchTree/contracts.js";
import type { ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";
import { buildScenario } from "./scenarioBuilder.js";
import {
  addConstraint,
  addDevice,
  addRoom,
  addState,
  removeConstraint,
  removeDevice,
  removeRoom,
  removeState,
} from "./builderState.js";

const appElement = document.querySelector<HTMLDivElement>("#app");
if (appElement === null) throw new Error("Web application root is missing");
const app: HTMLDivElement = appElement;

let nextId = 1;
const state = {
  scenarioName: "Browser scenario",
  buildingType: "generic",
  temperature: "",
  timeOfDay: "",
  rooms: [{ id: "room-1", name: "Room", occupancy: "0", devices: [{ id: "device-1", type: "device", ratedPower: "1", operatingTime: "1", states: [{ id: "off", effectivePower: "0" }, { id: "on", effectivePower: "1" }] }] }] as RoomDraft[],
  constraints: [] as ConstraintDraft[],
};
const makeState = (): StateDraft => ({ id: `state-${nextId++}`, effectivePower: "0" });
const makeDevice = (): DeviceDraft => ({ id: `device-${nextId++}`, type: "device", ratedPower: "1", operatingTime: "1", states: [makeState()] });
const makeRoom = (): RoomDraft => ({ id: `room-${nextId++}`, name: "Room", occupancy: "0", devices: [makeDevice()] });
const makeConstraint = (): ConstraintDraft => ({ id: `constraint-${nextId++}`, description: "Constraint", kind: "forbid-states-when-room-occupancy", deviceIds: [], occupancy: "0", stateIds: [], stateId: "" });

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
function input(label: string, value: string, data: string, type = "text", prefix = ""): string {
  return `<label>${escapeHtml(label)}<input data-${prefix}field="${data}" type="${type}" value="${escapeHtml(value)}"></label>`;
}
function renderState(item: StateDraft, room: number, device: number, index: number): string {
  return `<div class="grid state" data-role="state" data-room-index="${room}" data-device-index="${device}" data-state-index="${index}">${input("State ID", item.id, "id", "text", "state-")}${input("Effective power (kW)", item.effectivePower, "effectivePower", "number", "state-")}<button class="danger" data-action="remove-state" data-room-index="${room}" data-device-index="${device}" data-state-index="${index}">Remove state</button></div>`;
}
function renderDevice(item: DeviceDraft, room: number, index: number): string {
  return `<article class="card device" data-role="device" data-room-index="${room}" data-device-index="${index}"><div class="grid">${input("Device ID", item.id, "id", "text", "device-")}${input("Device type/name", item.type, "type", "text", "device-")}${input("Rated power (kW)", item.ratedPower, "ratedPower", "number", "device-")}${input("Operating time (hours)", item.operatingTime, "operatingTime", "number", "device-")}</div><div>${item.states.map((s, i) => renderState(s, room, index, i)).join("")}</div><button class="secondary" data-action="add-state" data-room-index="${room}" data-device-index="${index}">+ Add state</button><button class="danger" data-action="remove-device" data-room-index="${room}" data-device-index="${index}">Remove device</button></article>`;
}
function renderRoom(item: RoomDraft, index: number): string {
  return `<article class="card room" data-role="room" data-room-index="${index}"><div class="grid">${input("Room ID", item.id, "id", "text", "room-")}${input("Room name", item.name, "name", "text", "room-")}${input("Occupancy", item.occupancy, "occupancy", "number", "room-")}</div><div>${item.devices.map((d, i) => renderDevice(d, index, i)).join("")}</div><button class="secondary" data-action="add-device" data-room-index="${index}">+ Add device</button><button class="danger" data-action="remove-room" data-room-index="${index}">Remove room</button></article>`;
}
function renderConstraint(item: ConstraintDraft, index: number): string {
  const devices = state.rooms.flatMap((room) => room.devices);
  const stateIds = [...new Set(devices.flatMap((device) => device.states.map((item) => item.id)))];
  const selectedDevices = new Set(item.deviceIds);
  const selectedStates = new Set(item.stateIds);
  const selectedDeviceOptions = devices.map((device) => `<option value="${escapeHtml(device.id)}" ${selectedDevices.has(device.id) ? "selected" : ""}>${escapeHtml(device.id)}</option>`).join("");
  const selectedStateOptions = stateIds.map((id) => `<option value="${escapeHtml(id)}" ${selectedStates.has(id) ? "selected" : ""}>${escapeHtml(id)}</option>`).join("");
  return `<article class="card constraint" data-role="constraint" data-constraint-index="${index}"><div class="grid">${input("Constraint ID", item.id, "id")}${input("Description", item.description, "description")}<label>Kind<select data-field="kind"><option value="forbid-states-when-room-occupancy" ${item.kind === "forbid-states-when-room-occupancy" ? "selected" : ""}>Forbid states at occupancy</option><option value="require-state-when-room-occupancy" ${item.kind === "require-state-when-room-occupancy" ? "selected" : ""}>Require state at occupancy</option></select></label>${input("Occupancy", item.occupancy, "occupancy", "number")}<label>Target devices<select multiple data-field="deviceIds">${selectedDeviceOptions}</select></label>${item.kind === "forbid-states-when-room-occupancy" ? `<label>Forbidden states<select multiple data-field="stateIds">${selectedStateOptions}</select></label>` : `<label>Required state<select data-field="stateId"><option value="">Select state</option>${stateIds.map((id) => `<option value="${escapeHtml(id)}" ${id === item.stateId ? "selected" : ""}>${escapeHtml(id)}</option>`).join("")}</select></label>`}</div><button class="danger" data-action="remove-constraint" data-constraint-index="${index}">Remove constraint</button></article>`;
}
function render(): void {
  app.innerHTML = `<main><header><p class="eyebrow">ACADEMIC AI PROJECT</p><h1>AI Energy Optimisation</h1><p>Model a generic scenario, solve feasibility with CSP, then inspect Simple Hill Climbing and its real execution events.</p></header><div id="message" aria-live="polite"></div><section><div class="section-heading"><div><p class="eyebrow">01 / INPUT</p><h2>Scenario</h2></div><p class="muted">All values remain scenario data; building type does not select an algorithm.</p></div><div class="grid">${input("Scenario name", state.scenarioName, "scenario-name")}${input("Building type", state.buildingType, "building-type")}${input("Temperature", state.temperature, "temperature", "number")}${input("Time of day", state.timeOfDay, "time-of-day")}</div></section><section><div class="section-heading"><div><p class="eyebrow">02 / MODEL</p><h2>Rooms and devices</h2></div><span class="count">${state.rooms.length} room${state.rooms.length === 1 ? "" : "s"}</span></div><div id="rooms">${state.rooms.map(renderRoom).join("")}</div><button class="secondary" data-action="add-room">+ Add room</button></section><section><div class="section-heading"><div><p class="eyebrow">03 / RULES</p><h2>Constraints</h2></div></div><p class="muted">Define structured rules; the existing CSP adapter performs evaluation.</p><div id="constraints">${state.constraints.map(renderConstraint).join("")}</div><button class="secondary" data-action="add-constraint">+ Add constraint</button></section><section class="run-panel"><button class="primary run-button" data-action="run">Run Optimisation <span aria-hidden="true">→</span></button><p class="muted">Runs validation, CSP, energy evaluation, Simple Hill Climbing, and visualisation.</p></section><div id="results"></div></main>`;
  app.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => button.addEventListener("click", () => {
    readForm();
    const action = button.dataset.action;
    const roomIndex = Number(button.dataset.roomIndex);
    const deviceIndex = Number(button.dataset.deviceIndex);
    const stateIndex = Number(button.dataset.stateIndex);
    if (action === "add-room") addRoom(state, makeRoom());
    if (action === "remove-room") removeRoom(state, roomIndex);
    if (action === "add-device") addDevice(state, roomIndex, makeDevice());
    if (action === "remove-device") removeDevice(state, roomIndex, deviceIndex);
    if (action === "add-state") addState(state, roomIndex, deviceIndex, makeState());
    if (action === "remove-state") removeState(state, roomIndex, deviceIndex, stateIndex);
    if (action === "add-constraint") addConstraint(state, makeConstraint());
    if (action === "remove-constraint") removeConstraint(state, Number(button.dataset.constraintIndex));
    if (action === "run") execute();
    else render();
  }));
}
function readForm(): void {
  state.scenarioName = (app.querySelector('[data-field="scenario-name"]') as HTMLInputElement)?.value ?? state.scenarioName;
  state.buildingType = (app.querySelector('[data-field="building-type"]') as HTMLInputElement)?.value ?? state.buildingType;
  state.temperature = (app.querySelector('[data-field="temperature"]') as HTMLInputElement)?.value ?? state.temperature;
  state.timeOfDay = (app.querySelector('[data-field="time-of-day"]') as HTMLInputElement)?.value ?? state.timeOfDay;
  app.querySelectorAll<HTMLElement>('[data-role="room"]').forEach((element) => {
    const roomIndex = Number(element.dataset.roomIndex);
    const room = state.rooms[roomIndex];
    element.querySelectorAll<HTMLInputElement>("[data-room-field]").forEach((field) => {
      const key = field.dataset.roomField as "id" | "name" | "occupancy";
      room[key] = field.value;
    });
    element.querySelectorAll<HTMLElement>('[data-role="device"]').forEach((deviceElement) => {
      const roomIndexText = deviceElement.dataset.roomIndex!;
      const deviceIndexText = deviceElement.dataset.deviceIndex!;
      const device = state.rooms[Number(roomIndexText)].devices[Number(deviceIndexText)];
      deviceElement.querySelectorAll<HTMLInputElement>("[data-device-field]").forEach((field) => {
        const key = field.dataset.deviceField as keyof Omit<DeviceDraft, "states">;
        device[key] = field.value;
      });
      deviceElement.querySelectorAll<HTMLElement>('[data-role="state"]').forEach((stateElement) => {
        const stateIndexText = stateElement.dataset.stateIndex!;
        const item = device.states[Number(stateIndexText)];
        stateElement.querySelectorAll<HTMLInputElement>("[data-state-field]").forEach((field) => {
          item[field.dataset.stateField as "id" | "effectivePower"] = field.value;
        });
      });
    });
  });
  app.querySelectorAll<HTMLElement>('[data-role="constraint"]').forEach((element) => {
    const item = state.constraints[Number(element.dataset.constraintIndex)];
    element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((field) => {
      const key = field.dataset.field as keyof ConstraintDraft;
      if (field instanceof HTMLSelectElement && field.multiple) item[key] = [...field.selectedOptions].map((option) => option.value) as never;
      else item[key] = field.value as never;
    });
  });
}
function json(value: unknown): string { return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`; }
function tree(node: SearchTreeNode): string {
  const failed = node.type === "CONSTRAINT_FAILED";
  const backtracking = node.type === "BACKTRACK";
  const solution = node.type === "SOLUTION_FOUND";
  return `<div class="tree-node ${failed ? "failed" : ""} ${backtracking ? "backtracking" : ""} ${solution ? "solution" : ""}"><strong>${escapeHtml(node.type)}</strong> <span class="muted">depth ${node.depth}, order ${node.order}</span>${node.variable ? ` | ${escapeHtml(node.variable)}` : ""}${node.value !== undefined ? ` = ${escapeHtml(node.value)}` : ""}${node.reason ? `<div>${escapeHtml(node.reason)}</div>` : ""}${Object.keys(node.assignment).length ? json(node.assignment) : ""}${node.children.map(tree).join("")}</div>`;
}
function resultView(result: PipelineResult): string {
  if (result.status === "infeasible") return `<section><h2>CSP Result</h2><div class="error">${escapeHtml(result.output.error)}</div>${json(result.output.csp.statistics)}<details><summary>Raw CSP events</summary>${json(result.cspEvents)}</details></section>`;
  const output = result.output;
  const backtracking = output.visualisation.backtracking;
  const hill = output.visualisation.hillClimbing;
  const hillRows = hill?.records.map((record) => `<tr><td>${record.iteration}</td><td>${escapeHtml(record.type)}</td><td>${record.currentObjective.value}</td><td>${record.candidateObjective?.value ?? ""}</td><td class="${record.decision === "accepted" ? "accepted" : record.decision === "rejected" ? "rejected" : ""}">${record.decision ?? ""}</td><td>${escapeHtml(record.reason ?? "")}</td></tr>`).join("") ?? "";
  const backtrackRows = backtracking?.records.map((record) => `<tr><td>${record.order}</td><td class="${record.type === "CONSTRAINT_FAILED" ? "rejected" : "accepted"}">${record.type}</td><td>${record.depth}</td><td>${escapeHtml(record.reason ?? "")}</td><td>${json(record.assignment)}</td></tr>`).join("") ?? "";
  return `<section><p class="eyebrow">04 / EXECUTION RESULT</p><h2>Results</h2><div class="result-grid"><div class="metric"><strong>Scenario</strong><span>${escapeHtml(output.scenario.name)}</span></div><div class="metric"><strong>Building type</strong><span>${escapeHtml(output.scenario.buildingType)}</span></div><div class="metric"><strong>Rooms</strong><span>${output.scenario.roomCount}</span></div><div class="metric"><strong>Devices</strong><span>${output.scenario.deviceCount}</span></div></div><h3>CSP feasibility</h3>${json(output.csp.configuration)}<div class="result-grid"><div class="metric"><strong>Feasible</strong><span>Yes</span></div><div class="metric"><strong>Variables selected</strong><span>${output.csp.statistics.variablesSelected}</span></div><div class="metric"><strong>Values tried</strong><span>${output.csp.statistics.valuesTried}</span></div><div class="metric"><strong>Constraint failures</strong><span>${result.cspEvents.filter((event) => event.type === "CONSTRAINT_FAILED").length}</span></div><div class="metric"><strong>Backtracks</strong><span>${output.csp.statistics.backtracks}</span></div></div><h3>Energy comparison</h3><div class="result-grid"><div class="metric"><strong>Initial energy</strong><span>${output.energy.initial.energy} kWh</span></div><div class="metric"><strong>Optimised energy</strong><span>${output.energy.optimised.energy} kWh</span></div><div class="metric"><strong>Energy saved</strong><span>${output.energy.comparison.energySaved} kWh</span></div><div class="metric"><strong>Percentage saved</strong><span>${output.energy.comparison.percentageSaved}%</span></div></div><h3>Simple Hill Climbing</h3><div class="optimum">LOCAL OPTIMUM FOUND</div>${json(output.hillClimbing.finalState.configuration)}<details open><summary>CSP Search Tree</summary><div class="tree-scroll">${output.visualisation.searchTree ? tree(output.visualisation.searchTree.root) : "Unavailable"}</div></details><details open><summary>Backtracking events</summary>${backtracking?.records.length ? `<table><tr><th>Order</th><th>Type</th><th>Depth</th><th>Reason</th><th>Assignment</th></tr>${backtrackRows}</table>` : "No failures or backtracks."}</details><details open><summary>Hill Climbing timeline</summary>${hill ? `<table><tr><th>Iteration</th><th>Type</th><th>Current</th><th>Candidate</th><th>Decision</th><th>Reason</th></tr>${hillRows}</table>` : "Unavailable"}</details><details><summary>Raw CSP execution events</summary>${json(result.cspEvents)}</details><details><summary>Raw Hill Climbing execution events</summary>${json(result.hillClimbingEvents)}</details></section>`;
}
function execute(): void {
  const message = document.querySelector<HTMLDivElement>("#message");
  try {
    readForm();
    const scenario = buildScenario(
      state.scenarioName,
      state.buildingType,
      state.temperature,
      state.timeOfDay,
      state.rooms,
      state.constraints,
    );
    const loaded = loadScenario(scenario).scenario;
    const result = runPipeline(loaded, createSolvableCspProblem(loaded), {
      id: loaded.objectiveConfiguration.objectiveId,
      name: "Minimise energy",
      direction: "minimise",
      evaluationBasis: "total configuration energy",
    });
    document.querySelector<HTMLDivElement>("#results")!.innerHTML = resultView(result);
    if (message) message.innerHTML = `<div class="success">Completed using the existing pipeline and actual execution events.</div>`;
  } catch (error) {
    if (message) message.innerHTML = `<div class="error">${escapeHtml(error instanceof Error ? error.message : "Unable to run scenario")}</div>`;
  }
}
render();
