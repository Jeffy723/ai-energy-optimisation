import type { CspConfiguration } from "../../csp/model/contracts.js";
import { calculateEnergy } from "../calculator/calculator.js";
import type { Scenario } from "../../problem/scenario/contracts.js";
import type {
  EnergyComparison,
  EnergyMeasurement,
  Objective,
  ObjectiveEvaluation,
} from "./contracts.js";

export function measureEnergy(
  scenario: Scenario,
  configuration: CspConfiguration,
): EnergyMeasurement {
  const calculation = calculateEnergy(scenario, configuration);
  return {
    configuration: calculation.configuration,
    energy: calculation.totalEnergyKwh,
    unit: calculation.unit,
  };
}

export function evaluateObjective(
  scenario: Scenario,
  configuration: CspConfiguration,
  objective: Objective,
): ObjectiveEvaluation {
  if (objective.direction !== "minimise") {
    throw new Error(`Energy objective "${objective.id}" must minimise energy`);
  }
  const energyMeasurement = measureEnergy(scenario, configuration);
  return {
    objectiveId: objective.id,
    configuration: energyMeasurement.configuration,
    value: energyMeasurement.energy,
    energyMeasurement,
  };
}

export function compareEnergy(
  initial: EnergyMeasurement,
  optimised: EnergyMeasurement,
): EnergyComparison {
  const energySaved = initial.energy - optimised.energy;
  return {
    initialEnergy: initial.energy,
    optimisedEnergy: optimised.energy,
    energySaved,
    percentageSaved:
      initial.energy === 0 ? 0 : (energySaved / initial.energy) * 100,
  };
}

export function compareConfigurations(
  scenario: Scenario,
  initialConfiguration: CspConfiguration,
  optimisedConfiguration: CspConfiguration,
): EnergyComparison {
  return compareEnergy(
    measureEnergy(scenario, initialConfiguration),
    measureEnergy(scenario, optimisedConfiguration),
  );
}
