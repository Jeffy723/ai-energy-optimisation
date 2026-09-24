import type { InterfaceOutput } from "./contracts.js";

function formatPercentage(value: number): string {
  return `${value} %`;
}

export function formatConsoleOutput(output: InterfaceOutput): string {
  const backtrackingCount = output.visualisation.backtracking?.records.length ?? 0;
  const hillClimbingEventCount =
    output.visualisation.hillClimbing?.records.length ?? 0;
  const searchTreeStatus =
    output.visualisation.searchTree === undefined
      ? "not available"
      : "available";

  return [
    "Scenario",
    "--------",
    `Name: ${output.scenario.name}`,
    `Building Type: ${output.scenario.buildingType}`,
    `Rooms: ${output.scenario.roomCount}`,
    `Devices: ${output.scenario.deviceCount}`,
    "",
    "CSP",
    "---",
    `Feasible configuration found: ${output.csp.feasible}`,
    `Assignments: ${JSON.stringify(output.csp.assignments)}`,
    "",
    "Energy",
    "------",
    `Initial Energy: ${output.energy.initial.energy} ${output.energy.initial.unit}`,
    `Optimised Energy: ${output.energy.optimised.energy} ${output.energy.optimised.unit}`,
    `Energy Saved: ${output.energy.comparison.energySaved} kWh`,
    `Percentage Saved: ${formatPercentage(output.energy.comparison.percentageSaved)}`,
    "",
    "Hill Climbing",
    "-------------",
    `Moves: ${output.hillClimbing.statistics.movesAccepted}`,
    "Termination: Local optimum",
    "",
    "AI Execution",
    "------------",
    `CSP search tree: ${searchTreeStatus}`,
    `Backtracking events: ${backtrackingCount}`,
    `Hill Climbing events: ${hillClimbingEventCount}`,
  ].join("\n");
}
