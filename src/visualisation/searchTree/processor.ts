import type { CspExecutionEvent } from "../events/contracts.js";
import type { SearchTree, SearchTreeNode } from "./contracts.js";

interface MutableNode {
  id: string;
  eventId?: string;
  type: SearchTreeNode["type"];
  depth: number;
  order: number;
  assignment: Record<string, import("../../csp/model/contracts.js").CspValue>;
  variable?: string;
  value?: import("../../csp/model/contracts.js").CspValue;
  remainingValues?: number;
  degreeTieBreakUsed?: boolean;
  mrvTie?: SearchTreeNode["mrvTie"];
  lcvOrder?: readonly import("../../csp/model/contracts.js").CspValue[];
  constraint?: import("../../csp/model/contracts.js").ConstraintEvaluationResult;
  pruningKind?: "forward-checking" | "constraint-propagation";
  prunedValues?: readonly { readonly variable: string; readonly value: import("../../csp/model/contracts.js").CspValue }[];
  reason?: string;
  children: MutableNode[];
}

function copyNode(node: MutableNode): SearchTreeNode {
  return {
    id: node.id,
    ...(node.eventId === undefined ? {} : { eventId: node.eventId }),
    type: node.type,
    depth: node.depth,
    order: node.order,
    assignment: { ...node.assignment },
    ...(node.variable === undefined ? {} : { variable: node.variable }),
    ...(node.value === undefined ? {} : { value: node.value }),
    ...(node.remainingValues === undefined ? {} : { remainingValues: node.remainingValues }),
    ...(node.degreeTieBreakUsed === undefined ? {} : { degreeTieBreakUsed: node.degreeTieBreakUsed }),
    ...(node.mrvTie === undefined ? {} : {
      mrvTie: {
        ...node.mrvTie,
        candidates: node.mrvTie.candidates.map((candidate) => ({ ...candidate })),
      },
    }),
    ...(node.lcvOrder === undefined ? {} : { lcvOrder: [...node.lcvOrder] }),
    ...(node.constraint === undefined ? {} : { constraint: { ...node.constraint, assignment: { ...node.constraint.assignment } } }),
    ...(node.pruningKind === undefined ? {} : { pruningKind: node.pruningKind }),
    ...(node.prunedValues === undefined ? {} : { prunedValues: node.prunedValues.map((item) => ({ ...item })) }),
    ...(node.reason === undefined ? {} : { reason: node.reason }),
    children: node.children.map(copyNode),
  };
}

function parentFor(
  event: CspExecutionEvent,
  root: MutableNode,
  contexts: Map<number, MutableNode>,
  selectedContexts: Map<number, MutableNode>,
): MutableNode {
  if (event.type === "VALUE_TRIED") {
    return selectedContexts.get(event.depth) ?? contexts.get(event.depth) ?? root;
  }
  if (event.type === "VARIABLE_SELECTED") {
    return contexts.get(event.depth - 1) ?? root;
  }
  return contexts.get(event.depth) ?? contexts.get(event.depth - 1) ?? root;
}

export function buildSearchTree(events: readonly CspExecutionEvent[]): SearchTree {
  const root: MutableNode = {
    id: "csp-tree-root",
    type: "ROOT",
    depth: -1,
    order: -1,
    assignment: {},
    children: [],
  };
  const contexts = new Map<number, MutableNode>();
  const selectedContexts = new Map<number, MutableNode>();
  const eventOrder: string[] = [];

  events.forEach((event, order) => {
    const parent = parentFor(event, root, contexts, selectedContexts);
    const node: MutableNode = {
      id: `csp-tree-node-${order}`,
      eventId: event.id,
      type: event.type,
      depth: event.depth,
      order,
      assignment: { ...event.assignment },
      children: [],
      ...(event.type === "VARIABLE_SELECTED" || event.type === "VALUE_TRIED" || event.type === "FORWARD_CHECK"
        ? { variable: event.variable }
        : {}),
      ...(event.type === "VALUE_TRIED" || event.type === "BACKTRACK"
        ? { value: event.value }
        : {}),
      ...(event.type === "VARIABLE_SELECTED"
        ? {
            remainingValues: event.remainingValues,
            degreeTieBreakUsed: event.degreeTieBreakUsed,
            ...(event.mrvTie === undefined ? {} : {
              mrvTie: {
                ...event.mrvTie,
                candidates: event.mrvTie.candidates.map((candidate) => ({ ...candidate })),
              },
            }),
            ...(event.lcvOrder === undefined ? {} : { lcvOrder: [...event.lcvOrder] }),
          }
        : {}),
      ...(event.type === "CONSTRAINT_CHECKED" || event.type === "CONSTRAINT_FAILED"
        ? { constraint: { ...event.constraint, assignment: { ...event.constraint.assignment } } }
        : {}),
      ...(event.type === "FORWARD_CHECK"
        ? {
            pruningKind: event.pruningKind,
            prunedValues: event.prunedValues.map((item) => ({ ...item })),
          }
        : {}),
      ...(event.reason === undefined ? {} : { reason: event.reason }),
    };
    parent.children.push(node);
    eventOrder.push(event.id);

    if (
      event.type === "VARIABLE_SELECTED" ||
      event.type === "VALUE_TRIED" ||
      event.type === "BACKTRACK"
    ) {
      contexts.set(event.depth, node);
    }
    if (event.type === "VARIABLE_SELECTED") {
      selectedContexts.set(event.depth, node);
    }
    if (event.type === "BACKTRACK") {
      for (const depth of [...contexts.keys()]) {
        if (depth > event.depth) contexts.delete(depth);
      }
    }
  });

  return { root: copyNode(root), eventOrder };
}

export const processCspEvents = buildSearchTree;
