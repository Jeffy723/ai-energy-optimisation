import "./styles.css";
import { createSolvableCspProblem } from "../../csp/model/scenarioAdapter.js";
import { loadScenario } from "../input/index.js";
import { runPipeline } from "../pipeline/index.js";
import type { PipelineResult } from "../pipeline/contracts.js";
import type { SearchTreeNode } from "../../visualisation/searchTree/contracts.js";
import type { ConstraintDraft, DeviceDraft, RoomDraft, StateDraft } from "./contracts.js";
import { buildScenario } from "./scenarioBuilder.js";

const appElement = document.querySelector<HTMLDivElement>("#app");
if (appElement === null) throw new Error("Web application root is missing");
const app: HTMLDivElement = appElement;

let nextId = 1;
const state = {
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
  return `<div class="grid state" data-state="${room},${device},${index}">${input("State ID", item.id, "id", "text", "state-")}${input("Effective power (kW)", item.effectivePower, "effectivePower", "number", "state-")}<button data-action="remove-state" data-room="${room}" data-device="${device}" data-state="${index}">Remove state</button></div>`;
}
function renderDevice(item: DeviceDraft, room: number, index: number): string {
  return `<article class="card device" data-device="${room},${index}"><div class="grid">${input("Device ID", item.id, "id", "text", "device-")}${input("Device type/name", item.type, "type", "text", "device-")}${input("Rated power (kW)", item.ratedPower, "ratedPower", "number", "device-")}${input("Operating time (hours)", item.operatingTime, "operatingTime", "number", "device-")}</div><div>${item.states.map((s, i) => renderState(s, room, index, i)).join("")}</div><button data-action="add-state" data-room="${room}" data-device="${index}">Add state</button><button data-action="remove-device" data-room="${room}" data-device="${index}">Remove device</button></article>`;
}
function renderRoom(item: RoomDraft, index: number): string {
  return `<article class="card room" data-room="${index}"><div class="grid">${input("Room ID", item.id, "id", "text", "room-")}${input("Room name", item.name, "name", "text", "room-")}${input("Occupancy", item.occupancy, "occupancy", "number", "room-")}</div><div>${item.devices.map((d, i) => renderDevice(d, index, i)).join("")}</div><button data-action="add-device" data-room="${index}">Add device</button><button data-action="remove-room" data-room="${index}">Remove room</button></article>`;
}
function renderConstraint(item: ConstraintDraft, index: number): string {
  const devices = state.rooms.flatMap((room) => room.devices);
  const deviceOptions = devices.map((device) => `<option value="${escapeHtml(device.id)}">${escapeHtml(device.id)}</option>`).join("");
  const stateIds = [...new Set(devices.flatMap((device) => device.states.map((item) => item.id)))];
  const stateOptions = stateIds.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join("");
  return `<article class="card constraint" data-constraint="${index}"><div class="grid">${input("Constraint ID", item.id, "id")}${input("Description", item.description, "description")}<label>Kind<select data-field="kind"><option value="forbid-states-when-room-occupancy" ${item.kind === "forbid-states-when-room-occupancy" ? "selected" : ""}>Forbid states at occupancy</option><option value="require-state-when-room-occupancy" ${item.kind === "require-state-when-room-occupancy" ? "selected" : ""}>Require state at occupancy</option></select></label>${input("Occupancy", item.occupancy, "occupancy", "number")}<label>Target devices<select multiple data-field="deviceIds">${deviceOptions}</select></label>${item.kind === "forbid-states-when-room-occupancy" ? `<label>Forbidden states<select multiple data-field="stateIds">${stateOptions}</select></label>` : `<label>Required state<select data-field="stateId"><option value="">Select state</option>${stateOptions}</select></label>`}</div><button data-action="remove-constraint" data-constraint="${index}">Remove constraint</button></article>`;
}
function render(): void {
  app.innerHTML = `<main><header><h1>AI Energy Optimisation</h1><p>Thin browser input and presentation layer over the existing AI pipeline.</p></header><div id="message"></div><section><h2>Scenario</h2><div class="grid">${input("Scenario name", "Browser scenario", "scenario-name")}${input("Building type", "generic", "building-type")}${input("Temperature", "", "temperature", "number")}${input("Time of day", "", "time-of-day")}</div></section><section><h2>Rooms and devices</h2><div id="rooms">${state.rooms.map(renderRoom).join("")}</div><button data-action="add-room">Add room</button></section><section><h2>Constraints</h2><p class="muted">Define structured rules; the CSP adapter evaluates them.</p><div id="constraints">${state.constraints.map(renderConstraint).join("")}</div><button data-action="add-constraint">Add constraint</button></section><section><button data-action="run">Run Optimisation</button></section><div id="results"></div></main>`;
  app.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => button.addEventListener("click", () => {
    readForm();
    const action = button.dataset.action;
    if (action === "add-room") state.rooms.push(makeRoom());
    if (action === "remove-room") state.rooms.splice(Number(button.dataset.room), 1);
    if (action === "add-device") state.rooms[Number(button.dataset.room)].devices.push(makeDevice());
    if (action === "remove-device") state.rooms[Number(button.dataset.room)].devices.splice(Number(button.dataset.device), 1);
    if (action === "add-state") state.rooms[Number(button.dataset.room)].devices[Number(button.dataset.device)].states.push(makeState());
    if (action === "remove-state") state.rooms[Number(button.dataset.room)].devices[Number(button.dataset.device)].states.splice(Number(button.dataset.state), 1);
    if (action === "add-constraint") state.constraints.push(makeConstraint());
    if (action === "remove-constraint") state.constraints.splice(Number(button.dataset.constraint), 1);
    if (action === "run") execute();
    else render();
  }));
}
function readForm(): void {
  app.querySelectorAll<HTMLElement>("[data-room]").forEach((element) => {
    const roomIndex = Number(element.dataset.room);
    const room = state.rooms[roomIndex];
    element.querySelectorAll<HTMLInputElement>("[data-room-field]").forEach((field) => {
      const key = field.dataset.roomField as "id" | "name" | "occupancy";
      room[key] = field.value;
    });
    element.querySelectorAll<HTMLElement>("[data-device]").forEach((deviceElement) => {
      const [roomIndexText, deviceIndexText] = deviceElement.dataset.device!.split(",");
      const device = state.rooms[Number(roomIndexText)].devices[Number(deviceIndexText)];
      deviceElement.querySelectorAll<HTMLInputElement>("[data-device-field]").forEach((field) => {
        const key = field.dataset.deviceField as keyof Omit<DeviceDraft, "states">;
        device[key] = field.value;
      });
      deviceElement.querySelectorAll<HTMLElement>("[data-state]").forEach((stateElement) => {
        const [, , stateIndexText] = stateElement.dataset.state!.split(",");
        const item = device.states[Number(stateIndexText)];
        stateElement.querySelectorAll<HTMLInputElement>("[data-state-field]").forEach((field) => {
          item[field.dataset.stateField as "id" | "effectivePower"] = field.value;
        });
      });
    });
  });
  app.querySelectorAll<HTMLElement>("[data-constraint]").forEach((element) => {
    const item = state.constraints[Number(element.dataset.constraint)];
    element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]").forEach((field) => {
      const key = field.dataset.field as keyof ConstraintDraft;
      if (field instanceof HTMLSelectElement && field.multiple) item[key] = [...field.selectedOptions].map((option) => option.value) as never;
      else item[key] = field.value as never;
    });
  });
}
function json(value: unknown): string { return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`; }
function tree(node: SearchTreeNode): string {
  const failed = node.type === "CONSTRAINT_FAILED" || node.type === "BACKTRACK";
  const solution = node.type === "SOLUTION_FOUND";
  return `<div class="tree-node ${failed ? "failed" : ""} ${solution ? "solution" : ""}"><strong>${escapeHtml(node.type)}</strong> <span class="muted">depth ${node.depth}, order ${node.order}</span>${node.variable ? ` | ${escapeHtml(node.variable)}` : ""}${node.value !== undefined ? ` = ${escapeHtml(node.value)}` : ""}${node.reason ? `<div>${escapeHtml(node.reason)}</div>` : ""}${Object.keys(node.assignment).length ? json(node.assignment) : ""}${node.children.map(tree).join("")}</div>`;
}
function resultView(result: PipelineResult): string {
  if (result.status === "infeasible") return `<section><h2>CSP Result</h2><div class="error">${escapeHtml(result.output.error)}</div>${json(result.output.csp.statistics)}<details><summary>Raw CSP events</summary>${json(result.cspEvents)}</details></section>`;
  const output = result.output;
  const backtracking = output.visualisation.backtracking;
  const hill = output.visualisation.hillClimbing;
  return `<section><h2>Results</h2><div class="grid"><div class="card">Scenario: ${escapeHtml(output.scenario.name)}</div><div class="card">Building type: ${escapeHtml(output.scenario.buildingType)}</div><div class="card">Rooms: ${output.scenario.roomCount}</div><div class="card">Devices: ${output.scenario.deviceCount}</div></div><h3>CSP</h3>${json(output.csp.configuration)}<div class="grid"><div class="card">Feasible: true</div><div class="card">Variables selected: ${output.csp.statistics.variablesSelected}</div><div class="card">Values tried: ${output.csp.statistics.valuesTried}</div><div class="card">Constraint failures: ${result.cspEvents.filter((event) => event.type === "CONSTRAINT_FAILED").length}</div><div class="card">Backtracks: ${output.csp.statistics.backtracks}</div></div><h3>Energy</h3><div class="grid"><div class="card">Initial: ${output.energy.initial.energy} kWh</div><div class="card">Optimised: ${output.energy.optimised.energy} kWh</div><div class="card">Saved: ${output.energy.comparison.energySaved} kWh</div><div class="card">Saved: ${output.energy.comparison.percentageSaved}%</div></div><h3>Hill Climbing - LOCAL OPTIMUM</h3>${json(output.hillClimbing.finalState.configuration)}<details open><summary>CSP Search Tree</summary>${output.visualisation.searchTree ? tree(output.visualisation.searchTree.root) : "Unavailable"}</details><details open><summary>Backtracking</summary>${backtracking?.records.length ? json(backtracking.records) : "No failures or backtracks."}</details><details open><summary>Hill Climbing timeline</summary>${hill ? json(hill.records) : "Unavailable"}</details><details><summary>Raw CSP execution events</summary>${json(result.cspEvents)}</details><details><summary>Raw Hill Climbing execution events</summary>${json(result.hillClimbingEvents)}</details></section>`;
}
function execute(): void {
  const message = document.querySelector<HTMLDivElement>("#message");
  try {
    readForm();
    const scenario = buildScenario(
      (document.querySelector('[data-field="scenario-name"]') as HTMLInputElement).value,
      (document.querySelector('[data-field="building-type"]') as HTMLInputElement).value,
      (document.querySelector('[data-field="temperature"]') as HTMLInputElement).value,
      (document.querySelector('[data-field="time-of-day"]') as HTMLInputElement).value,
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
