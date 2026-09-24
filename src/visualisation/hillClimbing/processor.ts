import type { HillClimbingExecutionEvent } from "../events/contracts.js";
import type { HillClimbingNeighbour, HillClimbingState } from "../../optimisation/hillClimbing/contracts.js";
import type { HillClimbingView, HillClimbingViewRecord } from "./contracts.js";

function copyObjective(objective: HillClimbingState["objective"]): HillClimbingState["objective"] {
  return {
    ...objective,
    configuration: { ...objective.configuration },
    energyMeasurement: {
      ...objective.energyMeasurement,
      configuration: { ...objective.energyMeasurement.configuration },
    },
  };
}

function copyState(state: HillClimbingState): HillClimbingState {
  return {
    configuration: { ...state.configuration },
    objective: copyObjective(state.objective),
  };
}

function copyNeighbour(neighbour: HillClimbingNeighbour): HillClimbingNeighbour {
  return {
    ...copyState(neighbour),
    decision: neighbour.decision,
  };
}

export function buildHillClimbingView(
  events: readonly HillClimbingExecutionEvent[],
): HillClimbingView {
  const records: HillClimbingViewRecord[] = events.map((event, order) => {
    const base = {
      eventId: event.id,
      order,
      type: event.type,
      iteration: event.iteration,
      currentState: copyState(event.currentState),
      currentObjective: copyObjective(event.currentObjective),
      ...(event.reason === undefined ? {} : { reason: event.reason }),
    };
    if (event.type === "NEIGHBOUR_EVALUATED") {
      return {
        ...base,
        candidateState: copyNeighbour(event.candidateState),
        candidateObjective: copyObjective(event.candidateObjective),
        decision: event.decision,
      };
    }
    if (event.type === "MOVE_ACCEPTED") {
      return {
        ...base,
        candidateState: copyNeighbour(event.candidateState),
        candidateObjective: copyObjective(event.candidateObjective),
      };
    }
    return base;
  });
  const accepted = [...events].reverse().find((event) => event.type === "MOVE_ACCEPTED");
  const finalEvent = events.find((event) => event.type === "OPTIMUM_FOUND");
  return {
    records,
    finalState: finalEvent === undefined
      ? accepted === undefined
        ? undefined
        : copyState(accepted.candidateState)
      : copyState(finalEvent.currentState),
  };
}

export const processHillClimbingEvents = buildHillClimbingView;
