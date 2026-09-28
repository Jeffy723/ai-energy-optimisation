import { describe, expect, it } from "vitest";
import type {
  CspConfiguration,
  CspConstraint,
} from "../../src/csp/model/contracts.js";
import type { SolvableCspProblem } from "../../src/csp/model/evaluation.js";
import { runPipeline } from "../../src/interface/pipeline/index.js";
import type { Objective } from "../../src/energy/objective/contracts.js";
import type { Scenario } from "../../src/problem/scenario/contracts.js";

function makeScenario(buildingType = "generic-type"): Scenario {
  return {
    id: "scenario-1",
    name: "Integration scenario",
    building: {
      id: "building-1",
      name: "Generic building",
      type: buildingType,
      rooms: [
        {
          id: "room-1",
          name: "Generic room",
          occupancy: 1,
          devices: [
            {
              id: "device-1",
              type: "generic-device",
              ratedPower: 4,
              operatingTime: 2,
              availableStates: [
                { id: "high", effectivePower: 4 },
                { id: "low", effectivePower: 1 },
              ],
            },
          ],
        },
      ],
    },
    constraints: [{ id: "constraint-1", description: "test constraint" }],
    objectiveConfiguration: { objectiveId: "minimise-energy" },
  };
}

const objective: Objective = {
  id: "minimise-energy",
  name: "Minimise energy",
  direction: "minimise",
  evaluationBasis: "total energy",
};

function cspConstraint(
  evaluate: (assignment: CspConfiguration) => "satisfied" | "violated",
): SolvableCspProblem["constraints"][number] {
  const constraint: CspConstraint = {
    id: "constraint-1",
    involvedVariables: ["device-1"],
    description: "test constraint",
    evaluationSemantics: "test evaluator",
    evaluationInputs: [],
    evaluationResult: { status: "satisfied" },
  };
  return {
    constraint,
    evaluate: (assignment) => ({
      constraintId: constraint.id,
      status: evaluate(assignment),
      assignment,
    }),
  };
}

function problem(
  evaluate: (assignment: CspConfiguration) => "satisfied" | "violated" = () => "satisfied",
): SolvableCspProblem {
  return {
    variableIds: ["device-1"],
    domains: new Map([["device-1", ["high", "low"]]]),
    constraints: [cspConstraint(evaluate)],
  };
}

describe("integrated AI pipeline", () => {
  it("runs CSP, energy, hill climbing, visualisation, and interface output", () => {
    const scenario = makeScenario();
    const result = runPipeline(scenario, problem(), objective);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.output.csp.feasible).toBe(true);
    expect(result.output.energy.initial.energy).toBe(8);
    expect(result.output.energy.optimised.energy).toBe(2);
    expect(result.output.energy.comparison.energySaved).toBe(6);
    expect(result.output.energy.comparison.percentageSaved).toBe(75);
    expect(result.output.hillClimbing.finalState).toEqual({ "device-1": "low" });
    expect(result.output.visualisation.searchTree?.eventOrder).toEqual(
      result.cspEvents.map((event) => event.id),
    );
    expect(result.output.visualisation.hillClimbing?.records.map((event) => event.eventId)).toEqual(
      result.hillClimbingEvents.map((event) => event.id),
    );
    expect(result.output.events?.csp).toEqual(result.cspEvents);
    expect(result.output.events?.hillClimbing).toEqual(result.hillClimbingEvents);
  });

  it("handles an unsatisfiable CSP without running Hill Climbing or fabricating savings", () => {
    const result = runPipeline(
      makeScenario(),
      problem(() => "violated"),
      objective,
    );
    expect(result.status).toBe("infeasible");
    if (result.status !== "infeasible") return;
    expect(result.output.csp.feasible).toBe(false);
    expect(result.hillClimbingEvents).toEqual([]);
    expect(result.output.events.hillClimbing).toEqual([]);
    expect(result.output.error).toContain("Hill Climbing was not run");
    expect(result.output).not.toHaveProperty("energy");
  });

  it("preserves input data, is deterministic, and supports arbitrary building types", () => {
    const scenario = makeScenario("unclassified-input");
    const before = JSON.stringify(scenario);
    const first = runPipeline(scenario, problem(), objective);
    const second = runPipeline(scenario, problem(), objective);
    expect(first).toEqual(second);
    expect(JSON.stringify(scenario)).toBe(before);
    expect(first.output.scenario.buildingType).toBe("unclassified-input");
  });

  it("recalculates energy savings when scenario values change between runs", () => {
    const firstScenario = makeScenario();
    const secondScenario: Scenario = {
      ...makeScenario(),
      building: {
        ...makeScenario().building,
        rooms: makeScenario().building.rooms.map((room) => ({
          ...room,
          devices: room.devices.map((device) => ({
            ...device,
            availableStates: device.availableStates.map((state) =>
              state.id === "low" ? { ...state, effectivePower: 2 } : state,
            ),
          })),
        })),
      },
    };
    const first = runPipeline(firstScenario, problem(), objective);
    const second = runPipeline(secondScenario, problem(), objective);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    if (first.status !== "completed" || second.status !== "completed") return;
    expect(first.output.energy.comparison.percentageSaved).toBe(75);
    expect(second.output.energy.comparison.percentageSaved).toBe(50);
  });

  it("rejects invalid scenario input before invoking the solver", () => {
    const invalid = { ...makeScenario(), building: { ...makeScenario().building, rooms: [] } };
    expect(() => runPipeline(invalid, problem(), objective)).toThrow("Invalid scenario");
  });
});
