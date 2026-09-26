import { describe, expect, it } from "vitest";
import { buildSearchTree } from "../../src/visualisation/searchTree/index.js";
import type { CspExecutionEvent } from "../../src/visualisation/events/contracts.js";
import { layoutSearchTree, renderTreeSVG, visualChildren } from "../../src/interface/web/svgTree.js";
import type { SearchTreeNode } from "../../src/visualisation/searchTree/contracts.js";

function events(): readonly CspExecutionEvent[] {
  return [
    { id: "e-0", type: "VARIABLE_SELECTED", step: 0, depth: 0, variable: "ac", assignment: {}, remainingValues: 2, degreeTieBreakUsed: false },
    { id: "e-1", type: "VALUE_TRIED", step: 1, depth: 0, variable: "ac", value: "off", assignment: { ac: "off" } },
    {
      id: "e-2", type: "CONSTRAINT_FAILED", step: 2, depth: 0,
      constraint: { constraintId: "c1", status: "violated", assignment: { ac: "off" } },
      assignment: { ac: "off" }, reason: "occupied rooms cannot switch AC off",
    },
    { id: "e-3", type: "BACKTRACK", step: 3, depth: 0, variable: "ac", value: "off", assignment: {}, reason: "try another value" },
    { id: "e-4", type: "VALUE_TRIED", step: 4, depth: 0, variable: "ac", value: "high", assignment: { ac: "high" } },
    { id: "e-5", type: "CONSTRAINT_CHECKED", step: 5, depth: 0, constraint: { constraintId: "c1", status: "satisfied", assignment: { ac: "high" } }, assignment: { ac: "high" } },
    {
      id: "e-6", type: "VARIABLE_SELECTED", step: 6, depth: 1,
      variable: "light", assignment: { ac: "high" }, remainingValues: 2,
      degreeTieBreakUsed: true,
      mrvTie: {
        candidates: [
          { variable: "light", remainingValues: 2, degree: 2 },
          { variable: "fan", remainingValues: 2, degree: 1 },
        ],
        selectedVariable: "light",
        reason: "Selected the highest-degree MRV candidate (2)",
      },
      lcvOrder: ["Device B-free", "Device B-limited"],
    },
    { id: "e-7", type: "VALUE_TRIED", step: 7, depth: 1, variable: "light", value: "on", assignment: { ac: "high", light: "on" } },
    { id: "e-8", type: "SOLUTION_FOUND", step: 8, depth: 1, assignment: { ac: "high", light: "on" } },
  ];
}

describe("SVG search-tree layout", () => {
  it("places siblings apart, depths lower, and keeps descendants with their parent", () => {
    const tree = buildSearchTree(events());
    const layout = layoutSearchTree(tree.root);
    expect(layout.children.length).toBeGreaterThan(0);
    const first = layout.children[0];
    expect(first.children.length).toBeGreaterThan(1);
    expect(first.children.map((child) => child.source.type)).toEqual([
      "VALUE_TRIED",
      "VALUE_TRIED",
    ]);
    const xs = first.children.map((child) => child.x);
    expect(new Set(xs).size).toBe(xs.length);
    expect(Math.min(...first.children.map((child) => child.y))).toBeGreaterThan(first.y);
    const nodes: typeof layout[] = [];
    const visit = (node: typeof layout): void => {
      nodes.push(node);
      node.children.forEach(visit);
    };
    visit(layout);
    expect(nodes.some((node) => node.kind === "failure")).toBe(true);
    expect(nodes.some((node) => node.kind === "backtrack")).toBe(true);
    expect(nodes.some((node) => node.kind === "solution" && node.onSolutionPath)).toBe(true);
    const assignmentNodes = first.children.filter((child) => child.source.type === "VALUE_TRIED");
    expect(assignmentNodes.length).toBeGreaterThan(1);
    expect(assignmentNodes[0].x).not.toBe(assignmentNodes[1].x);
    const rendered = renderTreeSVG(tree);
    expect(rendered).toContain("MRV · 2 remaining value(s)");
    expect(rendered).toContain("Degree selected light");
    expect(rendered).toContain("LCV order · Device B-free");
    expect(rendered).toContain("→ Device B-limited");
    expect(rendered).toContain("Degree tie-break");
    expect(rendered).toContain("LCV value order");
  });

  it("labels actual forward-checking and propagation pruning in nodes and legend", () => {
    const tree = buildSearchTree([
      {
        id: "fc",
        type: "FORWARD_CHECK",
        step: 0,
        depth: 0,
        variable: "device-a",
        pruningKind: "forward-checking",
        prunedValues: [{ variable: "device-b", value: "restricted" }],
        assignment: { "device-a": "selected" },
      },
      {
        id: "propagation",
        type: "FORWARD_CHECK",
        step: 1,
        depth: 0,
        variable: "device-c",
        pruningKind: "constraint-propagation",
        prunedValues: [{ variable: "device-c", value: "impossible" }],
        assignment: { "device-a": "selected" },
      },
    ]);
    const rendered = renderTreeSVG(tree);
    expect(rendered).toContain("Forward check pruned");
    expect(rendered).toContain("Propagation pruned");
    expect(rendered).toContain("Forward checking</li>");
    expect(rendered).toContain("Constraint propagation</li>");
  });

  it("renders actual MRV tie candidates, degrees, and selected variable", () => {
    const tree = buildSearchTree([{
      id: "degree-selection",
      type: "VARIABLE_SELECTED",
      step: 0,
      depth: 0,
      variable: "ac",
      assignment: {},
      remainingValues: 2,
      degreeTieBreakUsed: true,
      mrvTie: {
        candidates: [
          { variable: "ac", remainingValues: 2, degree: 2 },
          { variable: "light", remainingValues: 2, degree: 1 },
          { variable: "fan", remainingValues: 2, degree: 1 },
        ],
        selectedVariable: "ac",
        reason: "Selected the highest-degree MRV candidate (2)",
      },
    }]);
    const rendered = renderTreeSVG(tree);

    expect(rendered).toContain("MRV tie · ac (2), light (2), fan (2)");
    expect(rendered).toContain("Degree · ac=2, light=1, fan=1");
    expect(rendered).toContain("Degree selected ac");
    expect(rendered).toContain("Degree tie-break");
  });

  it("omits constraint-check nodes from the visual children", () => {
    const node: SearchTreeNode = {
      id: "n",
      type: "VALUE_TRIED",
      depth: 0,
      order: 0,
      assignment: { ac: "high" },
      children: [{
        id: "checked",
        type: "CONSTRAINT_CHECKED",
        depth: 0,
        order: 1,
        assignment: { ac: "high" },
        children: [{
          id: "next",
          type: "VALUE_TRIED",
          depth: 1,
          order: 2,
          assignment: { ac: "high", light: "on" },
          children: [],
        }],
      }],
    };
    expect(visualChildren(node).map((item) => item.type)).toEqual(["VALUE_TRIED"]);
  });
});
