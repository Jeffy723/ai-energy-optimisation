import type { Scenario } from "../../problem/scenario/contracts.js";
import { validateScenario } from "../../problem/scenario/validation.js";
import {
  InvalidScenarioInputError,
  type ScenarioInput,
} from "./contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadScenario(value: unknown): ScenarioInput {
  if (!isRecord(value)) {
    throw new InvalidScenarioInputError("Scenario input must be an object");
  }

  let validation;
  try {
    validation = validateScenario(value as unknown as Scenario);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed structure";
    throw new InvalidScenarioInputError(`Invalid scenario structure: ${detail}`);
  }
  if (!validation.valid) {
    throw new InvalidScenarioInputError(
      `Invalid scenario: ${validation.errors.join("; ")}`,
    );
  }

  return {
    scenario: value as unknown as Scenario,
    source: "object",
  };
}

export function parseScenarioJson(json: string): ScenarioInput {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new InvalidScenarioInputError(`Unable to parse scenario JSON: ${detail}`);
  }

  const loaded = loadScenario(value);
  return { scenario: loaded.scenario, source: "json" };
}

export function validateScenarioInput(scenario: Scenario): void {
  loadScenario(scenario);
}
