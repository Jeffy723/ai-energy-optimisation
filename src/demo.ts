import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CspConstraint, CspConfiguration } from "./csp/model/contracts.js";
import type { SolvableCspProblem } from "./csp/model/evaluation.js";
import { runPipeline } from "./interface/pipeline/index.js";
import { formatConsoleOutput } from "./interface/output/index.js";
import { loadScenario } from "./interface/input/index.js";
import type { Objective } from "./energy/objective/contracts.js";
import type { Scenario } from "./problem/scenario/contracts.js";

function buildDemoProblem(scenario: Scenario): SolvableCspProblem {
  const variableIds: string[] = [];
  const domains = new Map<string, readonly string[]>();

  for (const room of scenario.building.rooms) {
    for (const device of room.devices) {
      variableIds.push(device.id);
      // Put the highest declared state first so the real hill climber has a
      // visible improvement path without fabricating a configuration.
      domains.set(
        device.id,
        [...device.availableStates].reverse().map((state) => state.id),
      );
    }
  }

  const constraints: SolvableCspProblem["constraints"] =
    scenario.constraints.map((scenarioConstraint) => {
      const constraint: CspConstraint = {
        id: scenarioConstraint.id,
        involvedVariables: [...variableIds],
        description: scenarioConstraint.description,
        evaluationSemantics: "Demo fixture accepts all domain assignments",
        evaluationInputs: scenarioConstraint.evaluationInputs ?? [],
        evaluationResult: { status: "satisfied" },
      };
      return {
        constraint,
        evaluate: (assignment: CspConfiguration) => ({
          constraintId: constraint.id,
          status: "satisfied" as const,
          assignment,
        }),
      };
    });

  return { variableIds, domains, constraints };
}

const objective: Objective = {
  id: "minimise-energy",
  name: "Minimise energy",
  direction: "minimise",
  evaluationBasis: "total configuration energy",
};

interface DemoTreeNode {
  readonly children: readonly DemoTreeNode[];
}

function countSearchTreeNodes(node: DemoTreeNode): number {
  return 1 + node.children.reduce((total, child) => total + countSearchTreeNodes(child), 0);
}

export async function runDemo(): Promise<void> {
  const scenarioPath = fileURLToPath(
    new URL("../examples/scenarios/small.json", import.meta.url),
  );
  const scenarioJson = await readFile(scenarioPath, "utf8");
  const { scenario } = loadScenario(JSON.parse(scenarioJson) as unknown);
  const result = runPipeline(scenario, buildDemoProblem(scenario), objective);

  console.log("========================================");
  console.log("AI ENERGY OPTIMISATION DEMONSTRATION");
  console.log("========================================");

  if (result.status === "infeasible") {
    console.log("CSP");
    console.log("---");
    console.log("Feasible configuration found: false");
    console.log(`Error: ${result.output.error}`);
    console.log("========================================");
    return;
  }

  const output = result.output;
  console.log(formatConsoleOutput(output));
  console.log("");
  console.log("CSP Search");
  console.log("----------");
  console.log(`Variables selected: ${output.csp.statistics.variablesSelected}`);
  console.log(`Values tried: ${output.csp.statistics.valuesTried}`);
  console.log(
    `Constraint failures: ${result.cspEvents.filter((event) => event.type === "CONSTRAINT_FAILED").length}`,
  );
  console.log(`Backtracks: ${output.csp.statistics.backtracks}`);
  console.log(
    `Solution found: ${result.cspEvents.some((event) => event.type === "SOLUTION_FOUND")}`,
  );
  console.log("");
  console.log("Visualisation");
  console.log("-------------");
  const searchTree = output.visualisation.searchTree;
  console.log(
    `CSP Search Tree Nodes: ${searchTree === undefined ? 0 : countSearchTreeNodes(searchTree.root)}`,
  );
  console.log(
    `Backtracking Events: ${output.visualisation.backtracking?.records.length ?? 0}`,
  );
  console.log(
    `Hill Climbing Events: ${output.visualisation.hillClimbing?.records.length ?? 0}`,
  );
  console.log("========================================");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runDemo();
}
