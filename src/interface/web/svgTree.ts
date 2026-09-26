import type { SearchTree, SearchTreeNode } from "../../visualisation/searchTree/contracts.js";
import type { NameMaps } from "./presentation.js";
import { deviceLabel, formatAssignment, stateLabel } from "./presentation.js";

const NODE_WIDTH = 214;
const NODE_HEIGHT = 168;
const SIBLING_GAP = 36;
const LEVEL_GAP = 72;

export type VisualKind = "root" | "explore" | "failure" | "backtrack" | "solution" | "pruned";

export interface LayoutNode {
  readonly id: string;
  readonly source: SearchTreeNode;
  readonly kind: VisualKind;
  x: number;
  y: number;
  subtreeWidth: number;
  readonly children: LayoutNode[];
  onSolutionPath: boolean;
}

function escapeHtml(value: unknown): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(value).replace(/[&<>"']/g, (character) => map[character] ?? character);
}

export function visualChildren(node: SearchTreeNode): SearchTreeNode[] {
  const children: SearchTreeNode[] = [];
  for (const child of node.children) {
    if (child.type === "CONSTRAINT_CHECKED") {
      children.push(...visualChildren(child));
    } else {
      children.push(child);
    }
  }
  return children;
}

function kindOf(node: SearchTreeNode): VisualKind {
  if (node.type === "ROOT") return "root";
  if (node.type === "CONSTRAINT_FAILED") return "failure";
  if (node.type === "BACKTRACK") return "backtrack";
  if (node.type === "SOLUTION_FOUND") return "solution";
  if (node.type === "FORWARD_CHECK") return "pruned";
  return "explore";
}

function translate(node: LayoutNode, dx: number): void {
  node.x += dx;
  for (const child of node.children) translate(child, dx);
}

export function computeLayout(node: SearchTreeNode, depth = 0): LayoutNode {
  const children = visualChildren(node).map((child) => computeLayout(child, depth + 1));
  const layout: LayoutNode = {
    id: node.id,
    source: node,
    kind: kindOf(node),
    x: 0,
    y: depth * (NODE_HEIGHT + LEVEL_GAP),
    subtreeWidth: NODE_WIDTH,
    children,
    onSolutionPath: false,
  };

  if (children.length === 0) {
    layout.x = 0;
    layout.subtreeWidth = NODE_WIDTH;
    return layout;
  }

  let cursor = 0;
  for (const child of children) {
    const childLeft = child.x - child.subtreeWidth / 2;
    translate(child, cursor - childLeft);
    cursor += child.subtreeWidth + SIBLING_GAP;
  }
  const totalWidth = cursor - SIBLING_GAP;
  layout.subtreeWidth = Math.max(NODE_WIDTH, totalWidth);
  layout.x = (children[0].x + children[children.length - 1].x) / 2;
  return layout;
}

function markSolutionPath(node: LayoutNode, ancestors: LayoutNode[]): boolean {
  const nextAncestors = [...ancestors, node];
  let found = node.kind === "solution";
  for (const child of node.children) {
    if (markSolutionPath(child, nextAncestors)) found = true;
  }
  if (found) {
    for (const ancestor of nextAncestors) ancestor.onSolutionPath = true;
  }
  return found;
}

function boundsOf(node: LayoutNode): { minX: number; maxX: number; maxY: number } {
  let minX = node.x - NODE_WIDTH / 2;
  let maxX = node.x + NODE_WIDTH / 2;
  let maxY = node.y + NODE_HEIGHT;
  for (const child of node.children) {
    const childBounds = boundsOf(child);
    minX = Math.min(minX, childBounds.minX);
    maxX = Math.max(maxX, childBounds.maxX);
    maxY = Math.max(maxY, childBounds.maxY);
  }
  return { minX, maxX, maxY };
}

function styleFor(node: LayoutNode): { fill: string; stroke: string; label: string; badge: string } {
  if (node.kind === "failure") {
    return { fill: "#fdecea", stroke: "#b42318", label: "Failed", badge: "✗" };
  }
  if (node.kind === "backtrack") {
    return { fill: "#fff4e5", stroke: "#b54708", label: "Backtrack", badge: "↩" };
  }
  if (node.kind === "solution") {
    return { fill: "#e7f8ef", stroke: "#17663a", label: "Solution found", badge: "✓" };
  }
  if (node.kind === "pruned") {
    return { fill: "#f4eefe", stroke: "#6941c6", label: "Pruned", badge: "✂" };
  }
  if (node.kind === "root") {
    return { fill: "#eef4fb", stroke: "#175cd3", label: "Search start", badge: "●" };
  }
  return { fill: "#eef4fb", stroke: "#175cd3", label: "Exploring", badge: "→" };
}

function titleFor(node: SearchTreeNode, maps?: NameMaps): string {
  if (node.type === "ROOT") return "START · Empty assignment";
  if (node.variable !== undefined && node.value !== undefined) {
    const variable = maps ? deviceLabel(maps, node.variable) : node.variable;
    const value = maps ? stateLabel(maps, node.variable, node.value) : String(node.value);
    return `${variable} = ${value}`;
  }
  if (node.variable !== undefined) {
    const variable = maps ? deviceLabel(maps, node.variable) : node.variable;
    return node.type === "VARIABLE_SELECTED" ? `Select ${variable}` : variable;
  }
  if (node.type === "SOLUTION_FOUND") return "FINAL SOLUTION";
  if (node.type === "CONSTRAINT_FAILED") return "Constraint violated";
  if (node.type === "BACKTRACK") return "No valid continuation";
  if (node.type === "FORWARD_CHECK") return "Domain pruning";
  return node.type;
}

function assignmentText(node: SearchTreeNode, maps?: NameMaps): string {
  if (maps === undefined) {
    const parts = Object.entries(node.assignment).map(([key, value]) => `${key}: ${String(value)}`);
    return parts.length === 0 ? "{ }" : `{ ${parts.join(", ")} }`;
  }
  return formatAssignment(node.assignment, maps);
}

function detailText(node: SearchTreeNode, maps?: NameMaps): string {
  if (node.type === "CONSTRAINT_FAILED") {
    return node.reason ?? node.constraint?.reason ?? "This branch is infeasible";
  }
  if (node.type === "FORWARD_CHECK" && node.prunedValues !== undefined && node.prunedValues.length > 0) {
    const values = node.prunedValues
      .map((item) =>
        maps === undefined
          ? String(item.value)
          : `${deviceLabel(maps, item.variable)}=${stateLabel(maps, item.variable, item.value)}`,
      )
      .join(", ");
    const method = node.pruningKind === "constraint-propagation"
      ? "Propagation pruned"
      : "Forward check pruned";
    return `${method}: ${values}`;
  }
  if (node.type === "BACKTRACK") {
    return node.reason ?? "Search returns to the parent choice";
  }
  return "";
}

function detailLines(node: SearchTreeNode, maps?: NameMaps): string[] {
  if (node.type !== "VARIABLE_SELECTED") {
    const detail = detailText(node, maps);
    return detail.length === 0 ? [] : [detail];
  }
  const lines = [`MRV · ${node.remainingValues ?? 0} remaining value(s)`];
  if (node.degreeTieBreakUsed) lines.push("Degree heuristic · tie-break");
  if (node.lcvOrder !== undefined) {
    const ordered = node.lcvOrder.map((value) =>
      maps ? stateLabel(maps, node.variable ?? "", value) : String(value),
    );
    let line = `LCV order · ${ordered[0] ?? ""}`;
    for (const value of ordered.slice(1)) {
      const next = `${line} → ${value}`;
      if (next.length <= 34) {
        line = next;
      } else {
        lines.push(line);
        line = `→ ${value}`;
      }
    }
    if (line.length > 0) lines.push(line);
  }
  return lines;
}

function wrapLabel(text: string, max = 28): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function drawEdges(node: LayoutNode): string {
  let svg = "";
  const parentX = node.x;
  const parentY = node.y + NODE_HEIGHT;
  for (const child of node.children) {
    const childX = child.x;
    const childY = child.y;
    const midY = (parentY + childY) / 2;
    const onPath = node.onSolutionPath && child.onSolutionPath;
    const stroke = child.kind === "failure"
      ? "#b42318"
      : child.kind === "backtrack"
        ? "#b54708"
        : onPath
          ? "#17663a"
          : "#98a2b3";
    const width = onPath ? 3.2 : 2;
    const dash = child.kind === "backtrack" ? 'stroke-dasharray="6 5"' : "";
    svg += `<path d="M ${parentX} ${parentY} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY}" fill="none" stroke="${stroke}" stroke-width="${width}" ${dash} />`;
    svg += drawEdges(child);
  }
  return svg;
}

function drawNodes(node: LayoutNode, maps?: NameMaps): string {
  const style = styleFor(node);
  const left = node.x - NODE_WIDTH / 2;
  const title = wrapLabel(titleFor(node.source, maps));
  const assignment = wrapLabel(assignmentText(node.source, maps), 32);
  const details = detailLines(node.source, maps);
  const pathStroke = node.onSolutionPath && node.kind !== "failure" ? "#17663a" : style.stroke;
  const pathWidth = node.onSolutionPath ? 2.8 : 1.8;
  let svg = `<g transform="translate(${left}, ${node.y})" class="tree-node-graphic tree-node-${node.kind}" data-tree-node="${escapeHtml(node.id)}">
    <rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="14" fill="${style.fill}" stroke="${pathStroke}" stroke-width="${pathWidth}" />
    <text x="${NODE_WIDTH / 2}" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="#101828">${escapeHtml(title)}</text>
    <text x="${NODE_WIDTH / 2}" y="50" text-anchor="middle" font-size="11" fill="#344054">${escapeHtml(assignment)}</text>
    <text x="${NODE_WIDTH / 2}" y="76" text-anchor="middle" font-size="12" font-weight="700" fill="${style.stroke}">${escapeHtml(style.badge)} ${escapeHtml(style.label)}</text>
  `;
  details.slice(0, 5).forEach((detail, index) => {
    svg += `<text x="${NODE_WIDTH / 2}" y="${98 + index * 13}" text-anchor="middle" font-size="9" fill="#475467">${escapeHtml(wrapLabel(detail, 34))}</text>`;
  });
  svg += "</g>";
  for (const child of node.children) svg += drawNodes(child, maps);
  return svg;
}

export function layoutSearchTree(root: SearchTreeNode): LayoutNode {
  const layout = computeLayout(root);
  markSolutionPath(layout, []);
  const bounds = boundsOf(layout);
  translate(layout, -bounds.minX + NODE_WIDTH / 2);
  return layout;
}

export function renderTreeSVG(tree: SearchTree, maps?: NameMaps): string {
  const layout = layoutSearchTree(tree.root);
  const bounds = boundsOf(layout);
  const padding = 28;
  const width = Math.max(bounds.maxX - bounds.minX + padding * 2, 320);
  const height = Math.max(bounds.maxY + padding * 2, 220);
  const nodes: SearchTreeNode[] = [];
  const visit = (node: SearchTreeNode): void => {
    nodes.push(node);
    node.children.forEach(visit);
  };
  visit(tree.root);
  const hasDegreeTieBreak = nodes.some((node) => node.degreeTieBreakUsed);
  const hasLcv = nodes.some((node) => node.lcvOrder !== undefined);
  const hasForwardChecking = nodes.some(
    (node) => node.type === "FORWARD_CHECK" && node.pruningKind === "forward-checking",
  );
  const hasPropagation = nodes.some(
    (node) => node.type === "FORWARD_CHECK" && node.pruningKind === "constraint-propagation",
  );
  return `<div class="tree-frame">
    <div class="tree-toolbar">
      <span><strong>START</strong> → decisions → backtracking → <strong>FINAL SOLUTION</strong></span>
      <div class="tree-zoom">
        <button type="button" class="secondary" data-action="tree-start">Start</button>
        <button type="button" class="secondary" data-action="tree-end">Final solution</button>
        <button type="button" class="secondary" data-action="tree-fit">Fit</button>
        <button type="button" class="secondary" data-action="tree-zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="secondary" data-action="tree-zoom-reset">Reset</button>
        <button type="button" class="secondary" data-action="tree-zoom-in" aria-label="Zoom in">+</button>
      </div>
    </div>
    <p class="tree-help">Use Fit for a complete overview, or use Start and Final solution to jump through a large tree. Scroll horizontally and vertically to inspect every branch.</p>
    <div class="tree-scroll" id="tree-scroll">
      <div id="tree-canvas">
        <svg width="${width}" height="${height}" viewBox="${bounds.minX - padding} ${-padding} ${width} ${height}" role="img" aria-label="CSP search tree">
          ${drawEdges(layout)}
          ${drawNodes(layout, maps)}
        </svg>
      </div>
    </div>
    <ul class="tree-legend">
      <li><span class="swatch explore"></span>Normal exploration</li>
      <li><span class="swatch explore"></span>MRV variable selection</li>
      ${hasDegreeTieBreak ? '<li><span class="swatch explore"></span>Degree tie-break</li>' : ""}
      ${hasLcv ? '<li><span class="swatch explore"></span>LCV value order</li>' : ""}
      ${hasForwardChecking ? '<li><span class="swatch pruned"></span>Forward checking</li>' : ""}
      ${hasPropagation ? '<li><span class="swatch pruned"></span>Constraint propagation</li>' : ""}
      <li><span class="swatch failure"></span>Constraint failure</li>
      <li><span class="swatch backtrack"></span>Backtracking</li>
      <li><span class="swatch solution"></span>Solution path</li>
      ${hasForwardChecking || hasPropagation ? '<li><span class="swatch pruned"></span>Pruned branch</li>' : ""}
    </ul>
  </div>`;
}

export function nodeCenter(node: LayoutNode): { x: number; y: number } {
  return { x: node.x, y: node.y };
}
