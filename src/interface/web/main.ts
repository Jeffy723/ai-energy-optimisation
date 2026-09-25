import "./styles.css";
import { createSolvableCspProblem } from "../../csp/model/scenarioAdapter.js";
import { loadScenario } from "../input/index.js";
import { runPipeline } from "../pipeline/index.js";
import type { PipelineResult } from "../pipeline/contracts.js";
import type {
  ConstraintDraft,
  DeviceDraft,
  RoomDraft,
  ScenarioFormState,
  StateDraft,
} from "./contracts.js";
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
import { buildScenario } from "./scenarioBuilder.js";
import {
  describeCspEvent,
  describeHillClimbingEvent,
  energyBreakdown,
  formatEnergy,
  formatPercent,
  nameMapsFromScenario,
  totalsMatchPipeline,
  type NameMaps,
} from "./presentation.js";
import { renderTreeSVG } from "./svgTree.js";
import type { Scenario } from "../../problem/scenario/contracts.js";

const appElement = document.querySelector<HTMLDivElement>("#app");
if (appElement === null) throw new Error("Web application root is missing");
const app: HTMLDivElement = appElement;

let nextId = 100;
let treeZoom = 1;
let treeFit = false;
let lastHtml = "";

const state: ScenarioFormState = {
  scenarioName: "",
  buildingType: "",
  temperature: "",
  timeOfDay: "",
  lightIntensity: "",
  rooms: [],
  constraints: [],
};

const makeState = (): StateDraft => ({
  id: `state-${nextId++}`,
  name: "",
  effectivePower: "",
});
const makeDevice = (): DeviceDraft => ({
  id: `device-${nextId++}`,
  type: "",
  ratedPower: "",
  operatingTime: "",
  states: [makeState()],
});
const makeRoom = (): RoomDraft => ({
  id: `room-${nextId++}`,
  name: "",
  occupancy: "",
  devices: [makeDevice()],
});
const makeConstraint = (): ConstraintDraft => ({
  id: `constraint-${nextId++}`,
  description: "",
  kind: "forbid-states-when-room-occupancy",
  deviceIds: [],
  occupancy: "0",
  stateIds: [],
  stateId: "",
});

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );
}

function field(
  label: string,
  value: string,
  name: string,
  type = "text",
  extra = "",
): string {
  return `<label>${escapeHtml(label)}<input data-field="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

function renderState(item: StateDraft, roomId: string, deviceId: string): string {
  return `<div class="state-row" data-role="state" data-room-id="${escapeHtml(roomId)}" data-device-id="${escapeHtml(deviceId)}" data-state-id="${escapeHtml(item.id)}">
    ${field("State name", item.name, "name")}
    ${field("Effective power (kW)", item.effectivePower, "effectivePower", "number", 'min="0" step="0.01"')}
    <button type="button" class="danger" data-action="remove-state" data-room-id="${escapeHtml(roomId)}" data-device-id="${escapeHtml(deviceId)}" data-state-id="${escapeHtml(item.id)}">Remove</button>
  </div>`;
}

function renderDevice(item: DeviceDraft, roomId: string): string {
  return `<article class="device" data-role="device" data-room-id="${escapeHtml(roomId)}" data-device-id="${escapeHtml(item.id)}">
    <div class="grid">
      ${field("Device name", item.type, "type")}
      ${field("Rated power (kW)", item.ratedPower, "ratedPower", "number", 'min="0" step="0.01"')}
      ${field("Operating time (hours)", item.operatingTime, "operatingTime", "number", 'min="0" step="0.01"')}
    </div>
    ${item.states.map((operatingState) => renderState(operatingState, roomId, item.id)).join("")}
    <div class="row-actions">
      <button type="button" class="secondary" data-action="add-state" data-room-id="${escapeHtml(roomId)}" data-device-id="${escapeHtml(item.id)}">Add state</button>
      <button type="button" class="danger" data-action="remove-device" data-room-id="${escapeHtml(roomId)}" data-device-id="${escapeHtml(item.id)}">Remove device</button>
    </div>
  </article>`;
}

function renderRoom(item: RoomDraft): string {
  return `<article class="room" data-role="room" data-room-id="${escapeHtml(item.id)}">
    <div class="grid">
      ${field("Room name", item.name, "name")}
      ${field("Occupancy (people)", item.occupancy, "occupancy", "number", 'min="0" step="1"')}
    </div>
    ${item.devices.map((device) => renderDevice(device, item.id)).join("")}
    <div class="row-actions">
      <button type="button" class="secondary" data-action="add-device" data-room-id="${escapeHtml(item.id)}">Add device</button>
      <button type="button" class="danger" data-action="remove-room" data-room-id="${escapeHtml(item.id)}">Remove room</button>
    </div>
  </article>`;
}

function deviceOptions(selected: readonly string[]): string {
  return state.rooms.flatMap((room) =>
    room.devices.map((device) => {
      const chosen = selected.includes(device.id) ? "selected" : "";
      return `<option value="${escapeHtml(device.id)}" ${chosen}>${escapeHtml(room.name)} — ${escapeHtml(device.type)}</option>`;
    }),
  ).join("");
}

function stateOptions(
  selected: readonly string[],
  current: string | undefined,
  deviceIds: readonly string[],
): string {
  const seen = new Map<string, string>();
  for (const room of state.rooms) {
    for (const device of room.devices) {
      if (!deviceIds.includes(device.id)) continue;
      for (const operatingState of device.states) {
        seen.set(operatingState.id, operatingState.name || operatingState.id);
      }
    }
  }
  return [...seen.entries()].map(([id, name]) => {
    const chosen = selected.includes(id) || current === id ? "selected" : "";
    return `<option value="${escapeHtml(id)}" ${chosen}>${escapeHtml(name)}</option>`;
  }).join("");
}

function renderConstraint(item: ConstraintDraft): string {
  const forbid = item.kind === "forbid-states-when-room-occupancy";
  return `<article class="constraint" data-role="constraint" data-constraint-id="${escapeHtml(item.id)}">
    <div class="grid">
      <label>Rule
        <select data-field="kind">
          <option value="forbid-states-when-room-occupancy" ${forbid ? "selected" : ""}>Forbid selected states when occupancy equals</option>
          <option value="require-state-when-room-occupancy" ${forbid ? "" : "selected"}>Require a state when occupancy equals</option>
        </select>
      </label>
      ${field("Occupancy value", item.occupancy, "occupancy", "number", 'min="0" step="1"')}
      <label>Devices
        <select multiple data-field="deviceIds">${deviceOptions(item.deviceIds)}</select>
      </label>
      ${forbid
        ? `<label>Forbidden states<select multiple data-field="stateIds">${stateOptions(item.stateIds, undefined, item.deviceIds)}</select></label>`
        : `<label>Required state<select data-field="stateId"><option value="">Select a state</option>${stateOptions([], item.stateId, item.deviceIds)}</select></label>`}
    </div>
    <label>Explanation (optional)
      <input data-field="description" type="text" value="${escapeHtml(item.description)}" placeholder="Shown in the search explanation">
    </label>
    <div class="row-actions">
      <button type="button" class="danger" data-action="remove-constraint" data-constraint-id="${escapeHtml(item.id)}">Remove constraint</button>
    </div>
  </article>`;
}

function restoreFocus(focusPath: string, start: number | null, end: number | null): void {
  if (!focusPath) return;
  const elToFocus = app.querySelector(focusPath) as HTMLInputElement | null;
  if (elToFocus === null) return;
  elToFocus.focus();
  if (start !== null && typeof elToFocus.setSelectionRange === "function") {
    try {
      elToFocus.setSelectionRange(start, end);
    } catch {
      /* ignore non-text inputs */
    }
  }
}

function currentFocus(): { path: string; start: number | null; end: number | null } {
  const activeEl = document.activeElement as HTMLInputElement | null;
  if (activeEl === null || !app.contains(activeEl) || activeEl.dataset.field === undefined) {
    return { path: "", start: null, end: null };
  }
  const fieldName = activeEl.dataset.field;
  const stateEl = activeEl.closest('[data-role="state"]') as HTMLElement | null;
  const deviceEl = activeEl.closest('[data-role="device"]') as HTMLElement | null;
  const roomEl = activeEl.closest('[data-role="room"]') as HTMLElement | null;
  const constraintEl = activeEl.closest('[data-role="constraint"]') as HTMLElement | null;
  let path = `[data-field="${fieldName}"]`;
  if (stateEl) {
    path = `[data-role="state"][data-state-id="${stateEl.dataset.stateId}"] [data-field="${fieldName}"]`;
  } else if (deviceEl) {
    path = `[data-role="device"][data-device-id="${deviceEl.dataset.deviceId}"] [data-field="${fieldName}"]`;
  } else if (roomEl) {
    path = `[data-role="room"][data-room-id="${roomEl.dataset.roomId}"] [data-field="${fieldName}"]`;
  } else if (constraintEl) {
    path = `[data-role="constraint"][data-constraint-id="${constraintEl.dataset.constraintId}"] [data-field="${fieldName}"]`;
  }
  let start: number | null = null;
  let end: number | null = null;
  try {
    start = activeEl.selectionStart;
    end = activeEl.selectionEnd;
  } catch {
    start = null;
    end = null;
  }
  return { path, start, end };
}

function render(): void {
  const focus = currentFocus();
  app.innerHTML = `<div class="ui-shell">
    <header class="hero">
      <p class="kicker">Academic AI demonstration</p>
      <h1>AI-Based Smart Energy Optimisation</h1>
      <p>Enter a generic building scenario. Constraint satisfaction finds a feasible device configuration. Simple Hill Climbing then searches neighbouring feasible configurations for lower energy.</p>
      <div class="pipeline">
        <span>Scenario</span>
        <span>CSP search</span>
        <span>Feasible plan</span>
        <span>Hill climbing</span>
        <span>Energy result</span>
      </div>
    </header>
    <div id="message" aria-live="polite"></div>
    <section class="block">
      <h2>Environment</h2>
      <p class="lede">These values are stored as scenario context. Occupancy constraints use room occupancy. Energy itself is calculated only from selected state power and operating hours.</p>
      <div class="grid">
        ${field("Temperature (°C)", state.temperature, "temperature", "number", 'step="0.1"')}
        ${field("Time of day", state.timeOfDay, "time-of-day")}
        ${field("Light intensity", state.lightIntensity, "light-intensity", "number", 'min="0" step="1"')}
      </div>
    </section>
    <section class="block">
      <h2>Rooms and devices</h2>
      <p class="lede">Power is entered in kilowatts (kW). Operating time is entered in hours. Energy for a device is effective power × hours.</p>
      <div id="rooms">${state.rooms.length === 0
        ? '<p class="empty-builder">No rooms yet. Add a room and enter its details.</p>'
        : state.rooms.map(renderRoom).join("")}</div>
      <div class="row-actions"><button type="button" class="secondary" data-action="add-room">Add room</button></div>
    </section>
    <section class="block">
      <h2>Constraints</h2>
      <p class="lede">Each rule is evaluated by the CSP solver. Occupancy is an exact match: the rule applies when a device’s room occupancy equals the value below.</p>
      <div id="constraints">${state.constraints.length === 0
        ? '<p class="empty-builder">No constraints yet. Add at least one structured rule before running.</p>'
        : state.constraints.map(renderConstraint).join("")}</div>
      <div class="row-actions"><button type="button" class="secondary" data-action="add-constraint">Add constraint</button></div>
    </section>
    <section class="block run-bar">
      <p>Runs the existing CSP solver, energy calculator, and Simple Hill Climbing on this scenario.</p>
      <button type="button" class="primary" data-action="run">Run AI Optimisation</button>
    </section>
    <div id="results">${lastHtml}</div>
  </div>`;
  applyTreeZoom();
  restoreFocus(focus.path, focus.start, focus.end);
}

function readScopedFields(
  root: ParentNode,
  selector: string,
): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector).forEach((fieldEl) => {
    const key = fieldEl.dataset.field;
    if (key === undefined) return;
    if (fieldEl instanceof HTMLSelectElement && fieldEl.multiple) {
      values[key] = [...fieldEl.selectedOptions].map((option) => option.value);
    } else {
      values[key] = fieldEl.value;
    }
  });
  return values;
}

function readForm(): void {
  const top = readScopedFields(app, ".ui-shell > .block:first-of-type [data-field], .hero + #message + .block [data-field]");
  const temperature = app.querySelector<HTMLInputElement>('[data-field="temperature"]');
  const timeOfDay = app.querySelector<HTMLInputElement>('[data-field="time-of-day"]');
  const lightIntensity = app.querySelector<HTMLInputElement>('[data-field="light-intensity"]');
  if (temperature) state.temperature = temperature.value;
  if (timeOfDay) state.timeOfDay = timeOfDay.value;
  if (lightIntensity) state.lightIntensity = lightIntensity.value;
  void top;

  app.querySelectorAll<HTMLElement>('[data-role="room"]').forEach((roomEl) => {
    const room = state.rooms.find((item) => item.id === roomEl.dataset.roomId);
    if (room === undefined) return;
    const values = readScopedFields(roomEl, ':scope > .grid [data-field]');
    if (typeof values.name === "string") room.name = values.name;
    if (typeof values.occupancy === "string") room.occupancy = values.occupancy;
  });

  app.querySelectorAll<HTMLElement>('[data-role="device"]').forEach((deviceEl) => {
    const room = state.rooms.find((item) => item.id === deviceEl.dataset.roomId);
    const device = room?.devices.find((item) => item.id === deviceEl.dataset.deviceId);
    if (device === undefined) return;
    const values = readScopedFields(deviceEl, ':scope > .grid [data-field]');
    if (typeof values.type === "string") device.type = values.type;
    if (typeof values.ratedPower === "string") device.ratedPower = values.ratedPower;
    if (typeof values.operatingTime === "string") device.operatingTime = values.operatingTime;
  });

  app.querySelectorAll<HTMLElement>('[data-role="state"]').forEach((stateEl) => {
    const room = state.rooms.find((item) => item.id === stateEl.dataset.roomId);
    const device = room?.devices.find((item) => item.id === stateEl.dataset.deviceId);
    const operatingState = device?.states.find((item) => item.id === stateEl.dataset.stateId);
    if (operatingState === undefined) return;
    const values = readScopedFields(stateEl, "[data-field]");
    if (typeof values.name === "string") operatingState.name = values.name;
    if (typeof values.effectivePower === "string") operatingState.effectivePower = values.effectivePower;
  });

  app.querySelectorAll<HTMLElement>('[data-role="constraint"]').forEach((constraintEl) => {
    const constraint = state.constraints.find((item) => item.id === constraintEl.dataset.constraintId);
    if (constraint === undefined) return;
    const values = readScopedFields(constraintEl, "[data-field]");
    if (typeof values.kind === "string") constraint.kind = values.kind as ConstraintDraft["kind"];
    if (typeof values.occupancy === "string") constraint.occupancy = values.occupancy;
    if (Array.isArray(values.deviceIds)) constraint.deviceIds = values.deviceIds;
    if (Array.isArray(values.stateIds)) constraint.stateIds = values.stateIds;
    if (typeof values.stateId === "string") constraint.stateId = values.stateId;
    if (typeof values.description === "string") constraint.description = values.description;

    const validStateIds = new Set(
      state.rooms
        .flatMap((room) => room.devices)
        .filter((device) => constraint.deviceIds.includes(device.id))
        .flatMap((device) => device.states.map((operatingState) => operatingState.id)),
    );
    constraint.stateIds = constraint.stateIds.filter((stateId) => validStateIds.has(stateId));
    if (constraint.stateId !== "" && !validStateIds.has(constraint.stateId)) {
      constraint.stateId = "";
    }
  });
}

function findRoom(id: string | undefined): number {
  return state.rooms.findIndex((item) => item.id === id);
}

function findDevice(roomIndex: number, id: string | undefined): number {
  return state.rooms[roomIndex]?.devices.findIndex((item) => item.id === id) ?? -1;
}

function handleConstraintRuleChange(select: HTMLSelectElement): void {
  const constraintElement = select.closest<HTMLElement>('[data-role="constraint"]');
  const constraintId = constraintElement?.dataset.constraintId;
  if (constraintId === undefined) return;
  const constraint = state.constraints.find((item) => item.id === constraintId);
  if (constraint === undefined) return;

  constraint.kind = select.value as ConstraintDraft["kind"];
  readForm();
  render();
}

function handleConstraintDeviceChange(select: HTMLSelectElement): void {
  const constraintElement = select.closest<HTMLElement>('[data-role="constraint"]');
  const constraintId = constraintElement?.dataset.constraintId;
  if (constraintId === undefined) return;
  const constraint = state.constraints.find((item) => item.id === constraintId);
  if (constraint === undefined) return;

  readForm();
  render();
}

function applyTreeZoom(): void {
  const canvas = document.querySelector<HTMLDivElement>("#tree-canvas");
  const scroll = document.querySelector<HTMLDivElement>("#tree-scroll");
  const svg = canvas?.querySelector<SVGSVGElement>("svg");
  if (canvas) canvas.style.transformOrigin = "top left";
  if (canvas && svg) {
    const svgWidth = Number(svg.getAttribute("width") ?? "0");
    const availableWidth = scroll?.clientWidth ?? 0;
    const fitScale = svgWidth > 0 && availableWidth > 0
      ? Math.min(1, availableWidth / svgWidth)
      : 1;
    const scale = treeFit ? Math.max(0.45, fitScale) : treeZoom;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.width = `${svgWidth * scale}px`;
    canvas.style.height = `${Number(svg.getAttribute("height") ?? "0") * scale}px`;
  }
}

function resultView(result: PipelineResult, scenario: Scenario): string {
  if (result.status === "infeasible") {
    return `<section class="block">
      <h2>No feasible configuration</h2>
      <p class="lede">${escapeHtml(result.output.error)}</p>
      <p>The CSP solver could not satisfy the current constraints. Adjust a rule or a device state, then run again.</p>
    </section>`;
  }

  const output = result.output;
  const maps: NameMaps = nameMapsFromScenario(scenario);
  const breakdown = energyBreakdown(
    scenario,
    output.energy.initial.configuration,
    output.energy.optimised.configuration,
  );
  const comparison = output.energy.comparison;
  const consistent = totalsMatchPipeline(breakdown, comparison);
  const deviceRows = breakdown.devices.map((row) =>
    `<tr><td>${escapeHtml(row.roomName)}</td><td>${escapeHtml(row.deviceName)}</td><td>${escapeHtml(row.initialState)}</td><td>${escapeHtml(formatEnergy(row.initialEnergyKwh))}</td><td>${escapeHtml(row.optimisedState)}</td><td>${escapeHtml(formatEnergy(row.optimisedEnergyKwh))}</td></tr>`,
  ).join("");
  const roomRows = breakdown.rooms.map((row) =>
    `<tr><td>${escapeHtml(row.roomName)}</td><td>${escapeHtml(formatEnergy(row.initialEnergyKwh))}</td><td>${escapeHtml(formatEnergy(row.optimisedEnergyKwh))}</td></tr>`,
  ).join("");
  const configRows = breakdown.devices.map((row) =>
    `<tr><td>${escapeHtml(row.roomName)}</td><td>${escapeHtml(row.deviceName)}</td><td>${escapeHtml(row.initialState)}</td><td>${escapeHtml(row.optimisedState)}</td><td>${escapeHtml(formatEnergy(row.initialEnergyKwh))}</td><td>${escapeHtml(formatEnergy(row.optimisedEnergyKwh))}</td></tr>`,
  ).join("");
  const timeline = result.cspEvents
    .map((event) => describeCspEvent(event, maps))
    .filter((item): item is string => item !== undefined)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const hill = output.visualisation.hillClimbing?.records.map((record) => {
    const source = result.hillClimbingEvents.find((event) => event.id === record.eventId);
    const text = source === undefined ? record.reason ?? record.type : describeHillClimbingEvent(source);
    return `<li>${escapeHtml(text)}</li>`;
  }).join("") ?? "";

  return `<section class="block">
      <h2>Energy result</h2>
      <p class="lede">Initial energy is the CSP feasible configuration that Hill Climbing starts from. Optimised energy is the configuration returned by Simple Hill Climbing. Both use Energy (kWh) = effective power (kW) × operating time (hours).</p>
      <div class="metrics">
        <div class="metric"><strong>Initial energy</strong><b>${escapeHtml(formatEnergy(comparison.initialEnergy))}</b></div>
        <div class="metric"><strong>Optimised energy</strong><b>${escapeHtml(formatEnergy(comparison.optimisedEnergy))}</b></div>
        <div class="metric"><strong>Energy saved</strong><b>${escapeHtml(formatEnergy(comparison.energySaved))}</b></div>
        <div class="metric"><strong>Savings</strong><b>${escapeHtml(formatPercent(comparison.percentageSaved))}</b></div>
      </div>
      ${consistent ? "" : `<p class="status error">Device totals did not match the pipeline energy result. The four figures above remain the algorithm values.</p>`}
      <h3>Energy by device</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Room</th><th>Device</th><th>Initial state</th><th>Initial energy</th><th>Optimised state</th><th>Optimised energy</th></tr></thead>
        <tbody>${deviceRows}</tbody>
      </table></div>
      <h3>Energy by room</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Room</th><th>Initial</th><th>Optimised</th></tr></thead>
        <tbody>${roomRows}</tbody>
      </table></div>
    </section>
    <section class="block">
      <h2>CSP search tree</h2>
      <p class="lede">Each node is a real solver step. Branches are parent–child connections from the SearchTree built from CSP execution events. Constraint-check noise is omitted so assignment, failure, backtracking and the solution remain visible.</p>
      ${output.visualisation.searchTree ? renderTreeSVG(output.visualisation.searchTree, maps) : "<p>Search tree unavailable.</p>"}
      <h3>Search progress</h3>
      <ol class="timeline">${timeline}</ol>
    </section>
    <section class="block">
      <h2>Simple Hill Climbing</h2>
      <p class="lede">Hill Climbing starts from the feasible CSP configuration and accepts the first feasible neighbour with strictly lower energy.</p>
      <ol class="timeline">${hill}</ol>
    </section>
    <section class="block">
      <h2>Final configuration</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Room</th><th>Device</th><th>Initial state</th><th>Optimised state</th><th>Initial energy</th><th>Optimised energy</th></tr></thead>
        <tbody>${configRows}</tbody>
      </table></div>
    </section>`;
}

function execute(): void {
  const message = document.querySelector<HTMLDivElement>("#message");
  lastHtml = "";
  const results = document.querySelector<HTMLDivElement>("#results");
  if (results) results.innerHTML = "";
  if (message) {
    message.innerHTML = `<div class="status">Running CSP and Simple Hill Climbing with the values currently entered above…</div>`;
  }
  try {
    readForm();
    const scenario = buildScenario(
      state.scenarioName,
      state.buildingType,
      state.temperature,
      state.timeOfDay,
      state.lightIntensity,
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
    lastHtml = resultView(result, loaded);
    if (results) results.innerHTML = lastHtml;
    applyTreeZoom();
    if (message) {
      message.innerHTML = result.status === "completed"
        ? `<div class="status ok">Optimisation finished using the existing CSP, energy, and Hill Climbing pipeline.</div>`
        : `<div class="status error">CSP found no feasible configuration.</div>`;
    }
  } catch (error) {
    if (message) {
      message.innerHTML = `<div class="status error">${escapeHtml(error instanceof Error ? error.message : "Unable to run scenario")}</div>`;
    }
  }
}

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest("button[data-action]") as HTMLElement | null;
  if (button === null) return;
  const action = button.dataset.action;
  if (action === "tree-zoom-in") {
    treeFit = false;
    treeZoom = Math.min(2.4, treeZoom * 1.15);
    applyTreeZoom();
    return;
  }
  if (action === "tree-zoom-out") {
    treeFit = false;
    treeZoom = Math.max(0.45, treeZoom / 1.15);
    applyTreeZoom();
    return;
  }
  if (action === "tree-zoom-reset") {
    treeFit = false;
    treeZoom = 1;
    applyTreeZoom();
    return;
  }
  if (action === "tree-fit") {
    treeFit = true;
    applyTreeZoom();
    return;
  }
  if (action === "tree-start" || action === "tree-end") {
    const scroll = document.querySelector<HTMLDivElement>("#tree-scroll");
    const target = document.querySelector<SVGGElement>(
      action === "tree-start" ? ".tree-node-root" : ".tree-node-solution",
    );
    if (scroll && target) {
      target.scrollIntoView({ behavior: "smooth", block: "start", inline: "center" });
    }
    return;
  }

  readForm();
  const roomIndex = findRoom(button.dataset.roomId);
  const deviceIndex = findDevice(roomIndex, button.dataset.deviceId);
  if (action === "add-room") addRoom(state, makeRoom());
  if (action === "remove-room" && roomIndex >= 0) removeRoom(state, roomIndex);
  if (action === "add-device" && roomIndex >= 0) addDevice(state, roomIndex, makeDevice());
  if (action === "remove-device" && roomIndex >= 0 && deviceIndex >= 0) {
    removeDevice(state, roomIndex, deviceIndex);
  }
  if (action === "add-state" && roomIndex >= 0 && deviceIndex >= 0) {
    addState(state, roomIndex, deviceIndex, makeState());
  }
  if (action === "remove-state" && roomIndex >= 0 && deviceIndex >= 0) {
    const stateIndex = state.rooms[roomIndex].devices[deviceIndex].states.findIndex(
      (item) => item.id === button.dataset.stateId,
    );
    if (stateIndex >= 0) removeState(state, roomIndex, deviceIndex, stateIndex);
  }
  if (action === "add-constraint") addConstraint(state, makeConstraint());
  if (action === "remove-constraint") {
    const constraintIndex = state.constraints.findIndex((item) => item.id === button.dataset.constraintId);
    if (constraintIndex >= 0) removeConstraint(state, constraintIndex);
  }
  if (action === "run") execute();
  else render();
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.field === "kind") {
    handleConstraintRuleChange(target);
    return;
  }
  if (target.dataset.field === "deviceIds") {
    handleConstraintDeviceChange(target);
  }
});

render();
