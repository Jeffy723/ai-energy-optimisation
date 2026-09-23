import type { CspConfiguration } from "../../csp/model/contracts.js";
import type { Identifier, ScenarioProperties } from "../../problem/scenario/contracts.js";

export type ObjectiveDirection = "minimise" | "maximise";

export interface Objective {
  readonly id: Identifier;
  readonly name: string;
  readonly direction: ObjectiveDirection;
  readonly evaluationBasis: string;
  readonly energyInformation?: ScenarioProperties;
}

export interface EnergyMeasurement {
  readonly configuration: CspConfiguration;
  readonly energy: number;
  readonly unit: "kWh";
}

export interface EnergyComparison {
  readonly initialEnergy: number;
  readonly optimisedEnergy: number;
  readonly energySaved: number;
  readonly percentageSaved: number;
}

export interface ObjectiveEvaluation {
  readonly objectiveId: Identifier;
  readonly configuration: CspConfiguration;
  readonly value: number;
  readonly energyMeasurement: EnergyMeasurement;
}
