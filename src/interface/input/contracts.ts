import type { Scenario } from "../../problem/scenario/contracts.js";

export interface ScenarioInput {
  readonly scenario: Scenario;
  readonly source: "object" | "json";
}

export class InvalidScenarioInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidScenarioInputError";
  }
}
