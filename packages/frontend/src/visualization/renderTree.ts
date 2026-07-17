import * as d3 from "d3";
import {
  FAMILY_LAYOUT,
  type FamilyLayoutResult,
  type LayoutPersonNode,
  type LayoutUnionNode,
} from "../graph/familyLayout";
import { type FamilyUnionKind } from "../types/family";

const COLORS = {
  forest: "#2F5D50",
  terracotta: "#C97C5D",
  coParents: "#B58A4A",
  singleParent: "#C9B89E",
  coParentsSoft: "#EFE2CC",
  singleParentSoft: "#F2EADF",
  selected: "#D8A94F",
  cream: "#FFF9F0",
  warmWhite: "#FFFCF7",
  canvas: "#FFF9F0",
  canvasGlow: "#FFFFFF",
  border: "#D9CFC1",
  connector: "#CDBA9F",
  text: "#2B2B2B",
};

const CONNECTOR_WIDTH = 2;
const CONNECTOR_UNDERLAY_WIDTH = 5.5;
const COUPLE_ARC_HEIGHT = 6;
const MIN_BRANCH_DROP = 58;
const MAX_BRANCH_DROP = 108;
const CENTRAL_STEM_SNAP_THRESHOLD = 54;
const PARTNER_CARD_CLEARANCE = 14;
const MIN_DESCENDANT_CURVE_HEIGHT = 18;
const BRANCH_CORNER_RADIUS = 14;
const DESCENDANT_TRUNK_CORNER_RADIUS = 20;

interface UnionVisualStyle {
  stroke: string;
  halo: string;
  core: string;
  width: number;
  opacity: number;
  dashArray: string | null;
  markerDashArray: string | null;
  label: string;
}

interface DescendantConnectorPlan {
  children: LayoutPersonNode[];
  safeExitY: number;
  busY: number | null;
  lane: number;
}

interface DescendantLaneCandidate {
  union: LayoutUnionNode;
  children: LayoutPersonNode[];
  safeExitY: number;
  minimumX: number;
  maximumX: number;
  childTopY: number;
  preferredBusY: number;
  minimumBusY: number;
  maximumBusY: number;
  lane: number;
}

const UNION_VISUAL_STYLES: Record<
  FamilyUnionKind,
  UnionVisualStyle
> = {
  couple: {
    stroke: COLORS.terracotta,
    halo: "#F3DDD3",
    core: COLORS.terracotta,
    width: 2.2,
    opacity: 0.98,
    dashArray: null,
    markerDashArray: null,
    label: "Pareja registrada",
  },
  coParents: {
    stroke: COLORS.coParents,
    halo: COLORS.coParentsSoft,
    core: COLORS.coParents,
    width: 2,
    opacity: 0.94,
    dashArray: "8 5",
    markerDashArray: "3 2",
    label: "Coprogenitores: comparten hijos, sin relación de pareja",
  },
  singleParent: {
    stroke: COLORS.singleParent,
    halo: COLORS.singleParentSoft,
    core: COLORS.singleParent,
    width: 1.7,
    opacity: 0.82,
    dashArray: "2 6",
    markerDashArray: null,
    label: "Un solo progenitor registrado",
  },
};

const fullName = (node: LayoutPersonNode): string =>
  [
    node.person.firstName,
    node.person.middleName,
    node.person.lastName,
    node.person.secondLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || "Sin nombre";

function splitName(name: string): string[] {
  if (name.length <= 22) return [name];

  const words = name.split(" ");
  const firstLine: string[] = [];
  const secondLine: string[] = [];

  words.forEach((word) => {
    const currentLength = firstLine.join(" ").length;

    if (
      currentLength + word.length + (firstLine.length > 0 ? 1 : 0) <=
      20
    ) {
      firstLine.push(word);
    } else {
      secondLine.push(word);
    }
  });

  const secondText = secondLine.join(" ");

  return [
    firstLine.join(" "),
    secondText.length > 22
      ? `${secondText.slice(0, 21)}…`
      : secondText,
  ].filter(Boolean);
}

function outerHalfWidth(node: LayoutPersonNode): number {
  if (node.role === "root") {
    return FAMILY_LAYOUT.personWidth / 2 + 8;
  }

  if (node.role === "selected") {
    return FAMILY_LAYOUT.personWidth / 2 + 6;
  }

  return FAMILY_LAYOUT.personWidth / 2;
}

function outerHalfHeight(node: LayoutPersonNode): number {
  if (node.role === "root") {
    return FAMILY_LAYOUT.personHeight / 2 + 8;
  }

  if (node.role === "selected") {
    return FAMILY_LAYOUT.personHeight / 2 + 6;
  }

  return FAMILY_LAYOUT.personHeight / 2;
}

function cardEdgeX(
  person: LayoutPersonNode,
  targetX: number
): number {
  const direction = targetX >= person.x ? 1 : -1;
  return person.x + direction * outerHalfWidth(person);
}

function coupleConnectorPath(
  person: LayoutPersonNode,
  union: LayoutUnionNode
): string {
  const startX = cardEdgeX(person, union.x);
  const direction = union.x >= person.x ? 1 : -1;
  const endX =
    union.x - direction * FAMILY_LAYOUT.unionMarkerRadius;
  const distance = endX - startX;
  const controlOffset = distance * 0.35;

  return [
    `M${startX},${person.y}`,
    `C${startX + controlOffset},${person.y - COUPLE_ARC_HEIGHT}`,
    `${endX - controlOffset},${union.y - COUPLE_ARC_HEIGHT}`,
    `${endX},${union.y}`,
  ].join(" ");
}

function singleParentConnectorPath(
  person: LayoutPersonNode,
  union: LayoutUnionNode
): string {
  const sameRow = Math.abs(person.y - union.y) < 0.5;
  const sameColumn = Math.abs(person.x - union.x) < 0.5;

  if (sameRow && !sameColumn) {
    const direction = union.x >= person.x ? 1 : -1;
    const startX = cardEdgeX(person, union.x);
    const endX =
      union.x - direction * FAMILY_LAYOUT.unionMarkerRadius;
    const distance = endX - startX;
    const controlOffset = distance * 0.32;
    const arcHeight = 9;

    return [
      `M${startX},${person.y}`,
      `C${startX + controlOffset},${person.y - arcHeight}`,
      `${endX - controlOffset},${union.y - arcHeight}`,
      `${endX},${union.y}`,
    ].join(" ");
  }

  const startY = person.y + outerHalfHeight(person);
  const endY = union.y - FAMILY_LAYOUT.unionMarkerRadius;

  if (sameColumn) {
    return `M${person.x},${startY} V${endY}`;
  }

  const verticalDistance = Math.max(1, endY - startY);
  const laneY = Math.min(
    endY - 10,
    startY + Math.max(18, verticalDistance * 0.56)
  );
  const horizontalDistance = union.x - person.x;
  const firstControlX = person.x + horizontalDistance * 0.28;
  const secondControlX = person.x + horizontalDistance * 0.72;

  return [
    `M${person.x},${startY}`,
    `C${person.x},${startY + 12}`,
    `${person.x},${laneY}`,
    `${firstControlX},${laneY}`,
    `C${secondControlX},${laneY}`,
    `${union.x},${laneY}`,
    `${union.x},${endY}`,
  ].join(" ");
}

function descendantSafeExitY(
  union: LayoutUnionNode,
  personsById: Map<string, LayoutPersonNode>
): number {
  const startY = union.y + FAMILY_LAYOUT.unionMarkerRadius;
  const partnerIds = [union.partnerAId, union.partnerBId].filter(
    (personId): personId is string => Boolean(personId)
  );
  const partnerBottomY = partnerIds.reduce((maximumY, personId) => {
    const partner = personsById.get(personId);

    if (!partner) return maximumY;

    return Math.max(
      maximumY,
      partner.y + outerHalfHeight(partner)
    );
  }, startY);

  return Math.max(
    startY,
    partnerBottomY + PARTNER_CARD_CLEARANCE
  );
}

function curveStartY(
  startY: number,
  requestedExitY: number,
  targetY: number
): number {
  const latestCurveStartY = Math.max(
    startY,
    targetY - MIN_DESCENDANT_CURVE_HEIGHT
  );

  return Math.min(
    Math.max(startY, requestedExitY),
    latestCurveStartY
  );
}

function directChildConnectorPath(
  union: LayoutUnionNode,
  child: LayoutPersonNode,
  safeExitY: number
): string {
  const startY = union.y + FAMILY_LAYOUT.unionMarkerRadius;
  const endY = child.y - outerHalfHeight(child);

  if (Math.abs(child.x - union.x) < 0.5) {
    return `M${union.x},${startY} V${endY}`;
  }

  const exitY = curveStartY(startY, safeExitY, endY);
  const middleY = exitY + (endY - exitY) * 0.52;

  return [
    `M${union.x},${startY}`,
    `V${exitY}`,
    `C${union.x},${middleY}`,
    `${child.x},${middleY}`,
    `${child.x},${endY}`,
  ].join(" ");
}

function branchBusY(
  union: LayoutUnionNode,
  children: LayoutPersonNode[]
): number {
  const baseChildTopY =
    Math.min(
      ...children.map((child) => child.y - outerHalfHeight(child))
    ) - union.descendantConnectorOffsetY;
  const availableHeight = baseChildTopY - union.y;
  const proposedDrop = availableHeight * 0.44;
  const drop = Math.max(
    MIN_BRANCH_DROP,
    Math.min(MAX_BRANCH_DROP, proposedDrop)
  );

  return union.y + drop + union.descendantConnectorOffsetY;
}

function intervalsOverlap(
  firstMinimumX: number,
  firstMaximumX: number,
  secondMinimumX: number,
  secondMaximumX: number,
  clearance = 0
): boolean {
  return (
    firstMinimumX <= secondMaximumX + clearance &&
    secondMinimumX <= firstMaximumX + clearance
  );
}

function sameConnectorGeneration(
  first: DescendantLaneCandidate,
  second: DescendantLaneCandidate
): boolean {
  const unionTolerance = FAMILY_LAYOUT.personHeight + 28;
  const childTolerance = FAMILY_LAYOUT.personHeight + 28;

  return (
    first.union.descendantConnectorOffsetY ===
      second.union.descendantConnectorOffsetY &&
    Math.abs(first.union.y - second.union.y) <= unionTolerance &&
    Math.abs(first.childTopY - second.childTopY) <= childTolerance
  );
}

/**
 * Reserva carriles verticales distintos para barras de hijos cuyos
 * intervalos horizontales se cruzan.
 *
 * Caso principal:
 * una persona participa en varias uniones y cada unión tiene hijos propios.
 * Sin carriles, las barras quedan casi en la misma altura y parecen formar
 * una sola familia. Las familias de mayor amplitud se colocan primero en el
 * carril superior; los bloques internos usan carriles inferiores. Así, los
 * tallos de la familia exterior permanecen fuera del intervalo interior y
 * se reducen cruces visuales.
 */
function buildDescendantConnectorPlans(
  layout: FamilyLayoutResult,
  personsById: Map<string, LayoutPersonNode>
): Map<string, DescendantConnectorPlan> {
  const plans = new Map<string, DescendantConnectorPlan>();
  const candidates: DescendantLaneCandidate[] = [];

  layout.unions.forEach((union) => {
    const children = union.childIds
      .map((childId) => personsById.get(childId))
      .filter((child): child is LayoutPersonNode => Boolean(child))
      .sort((first, second) => first.x - second.x);
    const safeExitY = descendantSafeExitY(union, personsById);

    if (children.length <= 1) {
      plans.set(union.id, {
        children,
        safeExitY,
        busY: null,
        lane: 0,
      });
      return;
    }

    const minimumX = children[0].x;
    const maximumX = children[children.length - 1].x;
    const childTopY =
      Math.min(
        ...children.map((child) => child.y - outerHalfHeight(child))
      ) - union.descendantConnectorOffsetY;
    const preferredBusY =
      branchBusY(union, children) - union.descendantConnectorOffsetY;
    const minimumBusY = Math.max(
      union.y + MIN_BRANCH_DROP,
      safeExitY + FAMILY_LAYOUT.familyConnectorTopClearance
    );
    const maximumBusY = Math.max(
      minimumBusY,
      childTopY - FAMILY_LAYOUT.familyConnectorBottomClearance
    );

    candidates.push({
      union,
      children,
      safeExitY,
      minimumX,
      maximumX,
      childTopY,
      preferredBusY,
      minimumBusY,
      maximumBusY,
      lane: 0,
    });
  });

  const unvisited = new Set(candidates);
  const components: DescendantLaneCandidate[][] = [];

  while (unvisited.size > 0) {
    const first = unvisited.values().next().value as
      | DescendantLaneCandidate
      | undefined;

    if (!first) break;

    const component: DescendantLaneCandidate[] = [];
    const pending = [first];
    unvisited.delete(first);

    while (pending.length > 0) {
      const current = pending.pop();

      if (!current) continue;
      component.push(current);

      Array.from(unvisited).forEach((candidate) => {
        if (
          sameConnectorGeneration(current, candidate) &&
          intervalsOverlap(
            current.minimumX,
            current.maximumX,
            candidate.minimumX,
            candidate.maximumX,
            12
          )
        ) {
          unvisited.delete(candidate);
          pending.push(candidate);
        }
      });
    }

    components.push(component);
  }

  components.forEach((component) => {
    const ordered = [...component].sort((first, second) => {
      const firstSpan = first.maximumX - first.minimumX;
      const secondSpan = second.maximumX - second.minimumX;

      if (Math.abs(firstSpan - secondSpan) > 0.5) {
        return secondSpan - firstSpan;
      }

      return first.union.id.localeCompare(second.union.id);
    });
    const lanes: DescendantLaneCandidate[][] = [];

    ordered.forEach((candidate) => {
      let lane = lanes.findIndex((laneCandidates) =>
        laneCandidates.every(
          (placed) =>
            !sameConnectorGeneration(candidate, placed) ||
            !intervalsOverlap(
              candidate.minimumX,
              candidate.maximumX,
              placed.minimumX,
              placed.maximumX,
              12
            )
        )
      );

      if (lane < 0) {
        lane = lanes.length;
        lanes.push([]);
      }

      candidate.lane = lane;
      lanes[lane].push(candidate);
    });

    const laneCount = Math.max(1, lanes.length);

    if (laneCount === 1) {
      component.forEach((candidate) => {
        plans.set(candidate.union.id, {
          children: candidate.children,
          safeExitY: candidate.safeExitY,
          busY: Math.max(
            candidate.minimumBusY,
            Math.min(candidate.maximumBusY, candidate.preferredBusY)
          ) + candidate.union.descendantConnectorOffsetY,
          lane: 0,
        });
      });
      return;
    }

    const commonTopY = Math.max(
      ...component.map((candidate) => candidate.minimumBusY)
    );
    const commonBottomY = Math.min(
      ...component.map((candidate) => candidate.maximumBusY)
    );
    const availableHeight = Math.max(0, commonBottomY - commonTopY);
    const laneGap = Math.min(
      FAMILY_LAYOUT.familyConnectorLaneGap,
      availableHeight / Math.max(1, laneCount - 1)
    );

    component.forEach((candidate) => {
      const requestedBusY = commonTopY + candidate.lane * laneGap;
      const busY = Math.max(
        candidate.minimumBusY,
        Math.min(candidate.maximumBusY, requestedBusY)
      );

      plans.set(candidate.union.id, {
        children: candidate.children,
        safeExitY: candidate.safeExitY,
        busY: busY + candidate.union.descendantConnectorOffsetY,
        lane: candidate.lane,
      });
    });
  });

  return plans;
}

function busBow(
  minimumX: number,
  maximumX: number
): number {
  const span = Math.abs(maximumX - minimumX);
  return Math.min(5, Math.max(2, span * 0.006));
}

function busYAtX(
  minimumX: number,
  maximumX: number,
  busY: number,
  x: number
): number {
  const span = maximumX - minimumX;

  if (Math.abs(span) < 0.5) return busY;

  const t = Math.max(0, Math.min(1, (x - minimumX) / span));
  return busY + 4 * busBow(minimumX, maximumX) * t * (1 - t);
}

function sharedTrunkPath(
  union: LayoutUnionNode,
  targetX: number,
  targetY: number,
  safeExitY: number
): string {
  const startY = union.y + FAMILY_LAYOUT.unionMarkerRadius;
  const horizontalDistance = targetX - union.x;

  if (Math.abs(horizontalDistance) < 0.5) {
    return `M${union.x},${startY} V${targetY}`;
  }

  const exitY = curveStartY(startY, safeExitY, targetY);
  const availableHeight = Math.max(0, targetY - exitY);

  /*
   * Cuando una unión está muy alejada del centro de sus hijos, una única
   * curva cúbica se estira y termina pareciendo una diagonal. En su lugar,
   * se construye un carril horizontal con dos giros redondeados:
   *
   * unión
   *   │
   *   ╰──────────────╮
   *                  │
   *             barra de hijos
   *
   * El radio se limita por la altura y el ancho disponibles para que la
   * ruta siga siendo válida en familias compactas.
   */
  const direction = horizontalDistance > 0 ? 1 : -1;
  const radius = Math.min(
    DESCENDANT_TRUNK_CORNER_RADIUS,
    Math.abs(horizontalDistance) / 3,
    availableHeight / 2
  );

  if (radius < 4) {
    const middleY = exitY + availableHeight * 0.55;

    return [
      `M${union.x},${startY}`,
      `V${exitY}`,
      `C${union.x},${middleY}`,
      `${targetX},${middleY}`,
      `${targetX},${targetY}`,
    ].join(" ");
  }

  const laneY = exitY + radius;
  const firstCornerEndX = union.x + direction * radius;
  const secondCornerStartX = targetX - direction * radius;
  const secondCornerEndY = laneY + radius;

  return [
    `M${union.x},${startY}`,
    `V${exitY}`,
    `Q${union.x},${laneY} ${firstCornerEndX},${laneY}`,
    `H${secondCornerStartX}`,
    `Q${targetX},${laneY} ${targetX},${secondCornerEndY}`,
    `V${targetY}`,
  ].join(" ");
}

function branchCornerRadius(
  minimumX: number,
  maximumX: number
): number {
  const span = Math.abs(maximumX - minimumX);

  return Math.min(
    BRANCH_CORNER_RADIUS,
    Math.max(6, span * 0.08),
    span / 4
  );
}

function organicBusPath(
  minimumX: number,
  maximumX: number,
  busY: number
): string {
  if (Math.abs(maximumX - minimumX) < 0.5) {
    return `M${minimumX},${busY} H${maximumX}`;
  }

  const midpoint = (minimumX + maximumX) / 2;
  const controlY = busY + busBow(minimumX, maximumX) * 2;

  // La coordenada X de esta curva cuadrática avanza linealmente. Esto
  // permite calcular con precisión el punto Y de cada unión vertical y
  // evita pequeños espacios o cortes entre tronco, barra e hijos.
  return `M${minimumX},${busY} Q${midpoint},${controlY} ${maximumX},${busY}`;
}

function organicChildStemPath(
  child: LayoutPersonNode,
  startY: number
): string {
  const childTopY = child.y - outerHalfHeight(child);
  const distance = childTopY - startY;
  const curve = Math.min(18, Math.max(8, distance * 0.12));

  return [
    `M${child.x},${startY}`,
    `C${child.x},${startY + curve}`,
    `${child.x},${childTopY - curve}`,
    `${child.x},${childTopY}`,
  ].join(" ");
}

function roundedOuterChildStemPath(
  child: LayoutPersonNode,
  busY: number,
  side: "left" | "right",
  radius: number
): string {
  const childTopY = child.y - outerHalfHeight(child);
  const horizontalDirection = side === "left" ? 1 : -1;
  const startX = child.x + horizontalDirection * radius;
  const cornerEndY = Math.min(busY + radius, childTopY);
  const remainingDistance = childTopY - cornerEndY;
  const verticalCurve = Math.min(
    18,
    Math.max(6, remainingDistance * 0.12)
  );

  return [
    `M${startX},${busY}`,
    `Q${child.x},${busY} ${child.x},${cornerEndY}`,
    `C${child.x},${cornerEndY + verticalCurve}`,
    `${child.x},${childTopY - verticalCurve}`,
    `${child.x},${childTopY}`,
  ].join(" ");
}

function appendOrganicConnector(
  underlayGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  strokeGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  pathData: string,
  color: string,
  width = CONNECTOR_WIDTH,
  dashArray: string | null = null,
  opacity = 0.96
): void {
  underlayGroup
    .append("path")
    .attr("d", pathData)
    .attr("fill", "none")
    .attr("stroke", COLORS.canvasGlow)
    .attr("stroke-width", CONNECTOR_UNDERLAY_WIDTH)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-opacity", 0.82)
    .attr("stroke-dasharray", dashArray)
    .attr("vector-effect", "non-scaling-stroke");

  strokeGroup
    .append("path")
    .attr("d", pathData)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", width)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-opacity", opacity)
    .attr("stroke-dasharray", dashArray)
    .attr("vector-effect", "non-scaling-stroke");
}

function warnAboutConnectorGeometry(
  layout: FamilyLayoutResult,
  personsById: Map<string, LayoutPersonNode>
): void {
  if (!import.meta.env.DEV) return;

  const warnings: string[] = [];

  layout.unions.forEach((union) => {
    if (!union.partnerBId) return;

    const partnerA = personsById.get(union.partnerAId);
    const partnerB = personsById.get(union.partnerBId);

    if (!partnerA || !partnerB) return;

    const expectedMidpoint = (partnerA.x + partnerB.x) / 2;

    if (Math.abs(expectedMidpoint - union.x) > 0.75) {
      warnings.push(
        `La unión ${union.id} no está centrada entre sus dos miembros.`
      );
    }
  });

  if (warnings.length > 0) {
    console.groupCollapsed(
      `[family-connector] ${warnings.length} advertencia(s) geométrica(s).`
    );
    warnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }
}

export const renderFullTree = (
  container: SVGSVGElement,
  layout: FamilyLayoutResult,
  width: number,
  height: number
): void => {
  const svg = d3.select(container);
  svg.selectAll("*").remove();

  svg
    .attr("aria-label", "Visualización del árbol familiar")
    .attr("role", "img")
    .style("background-color", COLORS.canvas);

  const defs = svg.append("defs");

  const canvasGradient = defs
    .append("radialGradient")
    .attr("id", "tree-canvas-gradient")
    .attr("cx", "50%")
    .attr("cy", "38%")
    .attr("r", "78%");

  canvasGradient
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", COLORS.canvasGlow);

  canvasGradient
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", COLORS.canvas);

  svg
    .append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "url(#tree-canvas-gradient)");

  const shadow = defs
    .append("filter")
    .attr("id", "tree-card-shadow")
    .attr("x", "-30%")
    .attr("y", "-30%")
    .attr("width", "160%")
    .attr("height", "160%");

  shadow
    .append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", 4)
    .attr("stdDeviation", 4.5)
    .attr("flood-color", COLORS.text)
    .attr("flood-opacity", 0.1);

  const selectedShadow = defs
    .append("filter")
    .attr("id", "tree-selected-shadow")
    .attr("x", "-35%")
    .attr("y", "-35%")
    .attr("width", "170%")
    .attr("height", "170%");

  selectedShadow
    .append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", 5)
    .attr("stdDeviation", 7)
    .attr("flood-color", COLORS.forest)
    .attr("flood-opacity", 0.22);

  const rootGroup = svg
    .append("g")
    .attr("opacity", 0);

  rootGroup
    .transition()
    .duration(180)
    .ease(d3.easeCubicOut)
    .attr("opacity", 1);

  // Todos los halos se dibujan primero. Después se trazan las líneas
  // principales, evitando que el halo de una ruta posterior borre una
  // intersección ya dibujada.
  const connectorUnderlayGroup = rootGroup.append("g");
  const descendantConnectorGroup = rootGroup.append("g");
  const coupleConnectorGroup = rootGroup.append("g");
  const unionGroup = rootGroup.append("g");
  const personGroup = rootGroup.append("g");

  const personsById = new Map(
    layout.persons.map((node) => [node.id, node])
  );
  const descendantConnectorPlans =
    buildDescendantConnectorPlans(layout, personsById);

  warnAboutConnectorGeometry(layout, personsById);

  layout.unions.forEach((unionNode) => {
    const unionStyle = UNION_VISUAL_STYLES[unionNode.kind];
    const hasTwoPartners = Boolean(unionNode.partnerBId);
    const partnerA = personsById.get(unionNode.partnerAId);

    if (partnerA) {
      appendOrganicConnector(
        connectorUnderlayGroup,
        coupleConnectorGroup,
        hasTwoPartners
          ? coupleConnectorPath(partnerA, unionNode)
          : singleParentConnectorPath(partnerA, unionNode),
        unionStyle.stroke,
        unionStyle.width,
        unionStyle.dashArray,
        unionStyle.opacity
      );
    }

    if (unionNode.partnerBId) {
      const partnerB = personsById.get(unionNode.partnerBId);

      if (partnerB) {
        appendOrganicConnector(
          connectorUnderlayGroup,
          coupleConnectorGroup,
          coupleConnectorPath(partnerB, unionNode),
          unionStyle.stroke,
          unionStyle.width,
          unionStyle.dashArray,
          unionStyle.opacity
        );
      }
    }

    const descendantPlan =
      descendantConnectorPlans.get(unionNode.id);
    const children = descendantPlan?.children ?? [];
    const safeExitY =
      descendantPlan?.safeExitY ??
      descendantSafeExitY(unionNode, personsById);

    if (children.length === 1) {
      appendOrganicConnector(
        connectorUnderlayGroup,
        descendantConnectorGroup,
        directChildConnectorPath(
          unionNode,
          children[0],
          safeExitY
        ),
        COLORS.connector
      );
    }

    if (children.length > 1) {
      const busY =
        descendantPlan?.busY ??
        branchBusY(unionNode, children);
      const minimumChildX = children[0].x;
      const maximumChildX = children[children.length - 1].x;
      const cornerRadius = branchCornerRadius(
        minimumChildX,
        maximumChildX
      );
      const busStartX = minimumChildX + cornerRadius;
      const busEndX = maximumChildX - cornerRadius;
      const nearestChild = children.reduce((nearest, child) =>
        Math.abs(child.x - unionNode.childrenCenterX) <
        Math.abs(nearest.x - unionNode.childrenCenterX)
          ? child
          : nearest
      );
      const shouldSnapToChild =
        Math.abs(nearestChild.x - unionNode.childrenCenterX) <=
        CENTRAL_STEM_SNAP_THRESHOLD;
      const requestedTrunkTargetX = shouldSnapToChild
        ? nearestChild.x
        : unionNode.childrenCenterX;
      const trunkTargetX = Math.max(
        busStartX,
        Math.min(busEndX, requestedTrunkTargetX)
      );
      const trunkTargetY = busYAtX(
        busStartX,
        busEndX,
        busY,
        trunkTargetX
      );

      appendOrganicConnector(
        connectorUnderlayGroup,
        descendantConnectorGroup,
        sharedTrunkPath(
          unionNode,
          trunkTargetX,
          trunkTargetY,
          safeExitY
        ),
        COLORS.connector
      );

      appendOrganicConnector(
        connectorUnderlayGroup,
        descendantConnectorGroup,
        organicBusPath(busStartX, busEndX, busY),
        COLORS.connector
      );

      children.forEach((child, childIndex) => {
        const isFirstChild = childIndex === 0;
        const isLastChild = childIndex === children.length - 1;
        let childStemPath: string;

        if (isFirstChild) {
          childStemPath = roundedOuterChildStemPath(
            child,
            busY,
            "left",
            cornerRadius
          );
        } else if (isLastChild) {
          childStemPath = roundedOuterChildStemPath(
            child,
            busY,
            "right",
            cornerRadius
          );
        } else {
          const stemStartY = busYAtX(
            busStartX,
            busEndX,
            busY,
            child.x
          );

          childStemPath = organicChildStemPath(child, stemStartY);
        }

        appendOrganicConnector(
          connectorUnderlayGroup,
          descendantConnectorGroup,
          childStemPath,
          COLORS.connector
        );
      });
    }

    const marker = unionGroup
      .append("g")
      .attr(
        "transform",
        `translate(${unionNode.x},${unionNode.y})`
      );

    marker.append("title").text(unionStyle.label);

    marker
      .append("circle")
      .attr("r", FAMILY_LAYOUT.unionMarkerRadius + 5)
      .attr("fill", unionStyle.halo)
      .attr("fill-opacity", 0.56);

    marker
      .append("circle")
      .attr("r", FAMILY_LAYOUT.unionMarkerRadius)
      .attr("fill", COLORS.warmWhite)
      .attr("stroke", unionStyle.stroke)
      .attr("stroke-width", unionStyle.width)
      .attr("stroke-opacity", unionStyle.opacity)
      .attr("stroke-dasharray", unionStyle.markerDashArray)
      .attr("vector-effect", "non-scaling-stroke");

    if (unionNode.kind === "coParents") {
      [-2.5, 2.5].forEach((offsetX) => {
        marker
          .append("circle")
          .attr("cx", offsetX)
          .attr("r", 1.7)
          .attr("fill", unionStyle.core);
      });
    } else {
      marker
        .append("circle")
        .attr("r", unionNode.kind === "couple" ? 2.5 : 1.9)
        .attr("fill", unionStyle.core)
        .attr("fill-opacity", unionStyle.opacity);
    }
  });

  layout.persons.forEach((node) => {
    const isRoot = node.role === "root";
    const isSelected = node.role === "selected";
    const name = fullName(node);
    const lines = splitName(name);
    const subtitle = isRoot
      ? "Persona principal"
      : isSelected
        ? "Persona activa"
        : null;

    const group = personGroup
      .append("g")
      .attr("transform", `translate(${node.x},${node.y})`);

    if (isRoot || isSelected) {
      group
        .append("rect")
        .attr("x", -(FAMILY_LAYOUT.personWidth + 12) / 2)
        .attr("y", -(FAMILY_LAYOUT.personHeight + 12) / 2)
        .attr("width", FAMILY_LAYOUT.personWidth + 12)
        .attr("height", FAMILY_LAYOUT.personHeight + 12)
        .attr("rx", 18)
        .attr("fill", "none")
        .attr("stroke", isRoot ? COLORS.forest : COLORS.selected)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", isRoot ? 0.2 : 0.32)
        .attr(
          "stroke-dasharray",
          isSelected && !isRoot ? "6 4" : null
        );
    }

    group
      .append("rect")
      .attr("x", -FAMILY_LAYOUT.personWidth / 2)
      .attr("y", -FAMILY_LAYOUT.personHeight / 2)
      .attr("width", FAMILY_LAYOUT.personWidth)
      .attr("height", FAMILY_LAYOUT.personHeight)
      .attr("rx", 18)
      .attr(
        "fill",
        isRoot
          ? COLORS.cream
          : isSelected
            ? "#FFFBEB"
            : COLORS.warmWhite
      )
      .attr(
        "stroke",
        isRoot
          ? COLORS.forest
          : isSelected
            ? COLORS.selected
            : COLORS.border
      )
      .attr("stroke-width", isRoot ? 3 : isSelected ? 2.5 : 1.5)
      .attr(
        "filter",
        isRoot || isSelected
          ? "url(#tree-selected-shadow)"
          : "url(#tree-card-shadow)"
      );

    if (isRoot) {
      group
        .append("circle")
        .attr("cx", FAMILY_LAYOUT.personWidth / 2 - 13)
        .attr("cy", -FAMILY_LAYOUT.personHeight / 2 + 13)
        .attr("r", 8)
        .attr("fill", COLORS.forest);

      group
        .append("text")
        .attr("x", FAMILY_LAYOUT.personWidth / 2 - 13)
        .attr("y", -FAMILY_LAYOUT.personHeight / 2 + 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#FFFFFF")
        .style("font-size", "9px")
        .style("font-weight", "700")
        .text("★");
    }

    const firstLineY = subtitle || lines.length > 1 ? -8 : 4;

    const text = group
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.text)
      .style("font-size", "12px")
      .style("font-weight", "700");

    lines.forEach((line, index) => {
      text
        .append("tspan")
        .attr("x", 0)
        .attr("y", firstLineY + index * 14)
        .text(line);
    });

    if (subtitle) {
      group
        .append("text")
        .attr("x", 0)
        .attr("y", firstLineY + lines.length * 14 + 4)
        .attr("text-anchor", "middle")
        .attr("fill", isRoot ? COLORS.forest : COLORS.terracotta)
        .style("font-size", "9px")
        .style("font-weight", "600")
        .text(subtitle);
    }

    group.append("title").text(name);
  });

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 3])
    .on("zoom", (event) => {
      rootGroup.attr("transform", event.transform);
    });

  svg.call(zoom);

  const padding = 56;
  const contentWidth = Math.max(layout.bounds.width, 1);
  const contentHeight = Math.max(layout.bounds.height, 1);
  const naturalFitScale = Math.min(
    0.95,
    (width - padding * 2) / contentWidth,
    (height - padding * 2) / contentHeight
  );
  const minimumReadableScale = width < 900 ? 0.3 : 0.4;
  const initialScale = Math.max(
    minimumReadableScale,
    naturalFitScale
  );

  const rootNode = personsById.get(layout.rootPersonId);
  const rootX = rootNode?.x ?? 0;
  const rootY = rootNode?.y ?? 0;

  let translateX = width / 2 - rootX * initialScale;
  let translateY = height / 2 - rootY * initialScale;

  const scaledContentWidth = contentWidth * initialScale;
  const scaledContentHeight = contentHeight * initialScale;

  if (scaledContentWidth <= width - padding * 2) {
    const left = translateX + layout.bounds.minX * initialScale;
    const right = translateX + layout.bounds.maxX * initialScale;

    if (left < padding) {
      translateX += padding - left;
    }

    if (right > width - padding) {
      translateX -= right - (width - padding);
    }
  }

  if (scaledContentHeight <= height - padding * 2) {
    const top = translateY + layout.bounds.minY * initialScale;
    const bottom = translateY + layout.bounds.maxY * initialScale;

    if (top < padding) {
      translateY += padding - top;
    }

    if (bottom > height - padding) {
      translateY -= bottom - (height - padding);
    }
  }

  svg.call(
    zoom.transform,
    d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(initialScale)
  );
};
