import type { CspExecutionEvent } from "../events/contracts.js";
import type { BacktrackingRecord, BacktrackingView } from "./contracts.js";

export function buildBacktrackingView(
  events: readonly CspExecutionEvent[],
): BacktrackingView {
  const records: BacktrackingRecord[] = [];
  for (const [order, event] of events.entries()) {
    if (event.type !== "CONSTRAINT_FAILED" && event.type !== "BACKTRACK") continue;
    records.push({
      eventId: event.id,
      type: event.type,
      order,
      depth: event.depth,
      assignment: { ...event.assignment },
      ...(event.type === "BACKTRACK" && event.variable !== undefined ? { variable: event.variable } : {}),
      ...(event.type === "BACKTRACK" && event.value !== undefined ? { value: event.value } : {}),
      ...(event.type === "CONSTRAINT_FAILED" || event.constraint === undefined
        ? event.type === "CONSTRAINT_FAILED"
          ? { constraint: { ...event.constraint, assignment: { ...event.constraint.assignment } } }
          : {}
        : { constraint: { ...event.constraint, assignment: { ...event.constraint.assignment } } }),
      ...(event.reason === undefined ? {} : { reason: event.reason }),
    });
  }
  return {
    records,
    failureEventIds: records.filter((record) => record.type === "CONSTRAINT_FAILED").map((record) => record.eventId),
    backtrackEventIds: records.filter((record) => record.type === "BACKTRACK").map((record) => record.eventId),
  };
}

export const processBacktrackingEvents = buildBacktrackingView;
