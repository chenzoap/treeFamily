import * as d3 from "d3";
import { type TreeNode, type Person, type Union } from "../types/family";

type HierarchyNode = d3.HierarchyPointNode<TreeNode>;
type HierarchyLink = d3.HierarchyPointLink<TreeNode>;

const PERSON_BOX_WIDTH = 140;
const PERSON_BOX_HEIGHT = 40;
const SIBLING_GAP_X = 620;
const SIBLING_Y = 180;

const DESC_UNION_Y = 110;
const DESC_CHILD_Y = 220;
const DESC_UNION_GAP_X = 280;
const DESC_CHILD_GAP_X = 180;

const fullName = (person: Person) => `${person.firstName} ${person.lastName}`;

export const renderFullTree = (
  container: SVGSVGElement,
  ancestorsData: TreeNode | null,
  descendantsData: TreeNode | null,
  width: number,
  height: number,
  allPersons: Person[],
  allUnions: Union[]
) => {
  const svg = d3.select(container);
  svg.selectAll("*").remove();

  const g = svg.append("g");

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on("zoom", event => g.attr("transform", event.transform));

  svg.call(zoom);

  const treeLayout = d3.tree<TreeNode>().nodeSize([350, 180]);

  if (descendantsData) {
    const rootD = d3.hierarchy(descendantsData);
    drawBranch(g, treeLayout(rootD), false);
  }

  if (ancestorsData) {
    const rootA = d3.hierarchy(ancestorsData);
    drawBranch(g, treeLayout(rootA), true);
  }

  function drawPersonCard(
    selection: d3.Selection<SVGGElement, unknown, null, undefined>,
    person: Person
  ) {
    selection.append("rect")
      .attr("width", PERSON_BOX_WIDTH)
      .attr("height", PERSON_BOX_HEIGHT)
      .attr("x", -PERSON_BOX_WIDTH / 2)
      .attr("y", -PERSON_BOX_HEIGHT / 2)
      .attr("rx", 6)
      .attr("fill", person.isRoot ? "#1e293b" : "#ffffff")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2);

    selection.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .attr("fill", person.isRoot ? "#ffffff" : "#1e293b")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(fullName(person));
  }

  function drawSatellitePersonCard(
    selection: d3.Selection<SVGGElement, unknown, null, undefined>,
    person: Person
  ) {
    selection.append("rect")
      .attr("width", PERSON_BOX_WIDTH)
      .attr("height", PERSON_BOX_HEIGHT)
      .attr("x", -PERSON_BOX_WIDTH / 2)
      .attr("y", -PERSON_BOX_HEIGHT / 2)
      .attr("rx", 6)
      .attr("fill", "#ffffff")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2);

    selection.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .attr("fill", "#1e293b")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(fullName(person));
  }

  function drawBranch(
    parentContainer: d3.Selection<SVGGElement, unknown, null, undefined>,
    treeData: HierarchyNode,
    isInverted: boolean
  ) {
    const yMult = isInverted ? -1 : 1;

    // Conexiones principales del árbol.
    parentContainer.append("g")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2)
      .selectAll("path")
      .data(treeData.links())
      .enter()
      .append("path")
      .attr(
        "d",
        d3.linkVertical<HierarchyLink, HierarchyNode>()
          .x(d => d.x)
          .y(d => d.y * yMult)
      );

    const nodes = parentContainer.append("g")
      .selectAll("g")
      .data(treeData.descendants())
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x},${d.y * yMult})`);

    // Render de personas normales del árbol.
    const personNodes = nodes.filter(d => d.data.type === "person");

    personNodes.each(function (d) {
      drawPersonCard(d3.select(this), d.data.data as Person);
    });

    // Render de nodos unión.
    const unionNodes = nodes.filter(d => d.data.type === "union");

    unionNodes.each(function (d) {
      const gUnion = d3.select(this);
      const union = d.data.data as Union;

      // Punto azul que representa la unión.
      gUnion.append("circle")
        .attr("r", 4)
        .attr("fill", "#3b82f6");

      // En ancestros, la unión representa los padres de la persona actual.
      // Además, aquí agregamos hermanos/as y sus descendientes.
      if (isInverted) {
        drawAncestorSiblings(gUnion, d, union);
        return;
      }

      // En descendientes, la unión representa persona activa + pareja.
      const parentPersonId =
        d.parent?.data.type === "person"
          ? (d.parent.data.data as Person).id
          : null;

      const otherPartnerId =
        parentPersonId && parentPersonId === union.partnerA
          ? union.partnerB
          : parentPersonId && parentPersonId === union.partnerB
            ? union.partnerA
            : union.partnerB || union.partnerA;

      if (!otherPartnerId) return;

      const partner = allPersons.find(p => p.id === otherPartnerId);
      if (!partner) return;

      // Línea hacia la pareja satélite.
      gUnion.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 120)
        .attr("y2", 0)
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2");

      const partnerG = gUnion
        .append("g")
        .attr("transform", "translate(120, 0)");

      drawSatellitePersonCard(partnerG, partner);
    });
  }

  function drawAncestorSiblings(
  gUnion: d3.Selection<SVGGElement, unknown, null, undefined>,
  unionNode: HierarchyNode,
  union: Union
) {
  // Persona foco desde la que se está subiendo.
  // Ejemplo: Fernando Root dentro de la unión Jose + Rosa.
  const focusPersonId =
    unionNode.parent?.data.type === "person"
      ? (unionNode.parent.data.data as Person).id
      : null;

  if (!focusPersonId) return;

  // Otros hijos de la misma unión = hermanos/as de la persona foco.
  const siblingIds = union.children.filter(childId => childId !== focusPersonId);
  if (siblingIds.length === 0) return;

  const siblings = siblingIds
    .map(childId => allPersons.find(p => p.id === childId))
    .filter((person): person is Person => Boolean(person));

  if (siblings.length === 0) return;

  // Posición local del focus respecto al nodo unión.
  const focusX = unionNode.parent ? unionNode.parent.x - unionNode.x : 0;

  siblings.forEach((sibling, index) => {
    // Distribuimos hermanos alternando izquierda/derecha del focus.
    // Esto evita que un hermano con hijos quede encima de la rama principal.
    const side = index % 2 === 0 ? -1 : 1;
    const level = Math.floor(index / 2) + 1;

    const siblingX = focusX + side * SIBLING_GAP_X * level;

    // Línea desde la unión de padres hacia el hermano/a.
    gUnion.append("path")
      .attr(
        "d",
        `M0,0 C0,80 ${siblingX},100 ${siblingX},${SIBLING_Y}`
      )
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2);

    const siblingG = gUnion
      .append("g")
      .attr("transform", `translate(${siblingX}, ${SIBLING_Y})`);

    drawSatellitePersonCard(siblingG, sibling);

    // Si el hermano/a tiene hijos, los dibujamos debajo de él/ella.
    drawLocalDescendants(siblingG, sibling, new Set([focusPersonId]));
  });
}

  function drawLocalDescendants(
    personGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    person: Person,
    visited: Set<string>
  ) {
    if (visited.has(person.id)) return;

    const nextVisited = new Set(visited);
    nextVisited.add(person.id);

    // Buscamos uniones donde esta persona sea padre/madre.
    // Esto incluye:
    // - union:persona:pareja
    // - single:persona
    const personUnions = allUnions.filter(
      union => union.partnerA === person.id || union.partnerB === person.id
    );

    if (personUnions.length === 0) return;

    personUnions.forEach((union, unionIndex) => {
      const unionX =
        (unionIndex - (personUnions.length - 1) / 2) * DESC_UNION_GAP_X;

      // Línea desde la persona hacia su unión descendiente.
      personGroup.append("path")
        .attr(
          "d",
          `M0,${PERSON_BOX_HEIGHT / 2} C0,70 ${unionX},70 ${unionX},${DESC_UNION_Y}`
        )
        .attr("fill", "none")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 2);

      const unionG = personGroup
        .append("g")
        .attr("transform", `translate(${unionX}, ${DESC_UNION_Y})`);

      // Punto azul de la unión descendiente.
      unionG.append("circle")
        .attr("r", 4)
        .attr("fill", "#3b82f6");

      // Si la unión tiene pareja, la dibujamos como tarjeta satélite.
      const partnerId =
        union.partnerA === person.id ? union.partnerB : union.partnerA;

      if (partnerId) {
        const partner = allPersons.find(p => p.id === partnerId);

        if (partner) {
          unionG.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 120)
            .attr("y2", 0)
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,2");

          const partnerG = unionG
            .append("g")
            .attr("transform", "translate(120, 0)");

          drawSatellitePersonCard(partnerG, partner);
        }
      }

      // Dibujamos los hijos de esa unión.
      const children = union.children
        .map(childId => allPersons.find(p => p.id === childId))
        .filter((child): child is Person => Boolean(child))
        .filter(child => !nextVisited.has(child.id));

      const startChildX =
        -((children.length - 1) * DESC_CHILD_GAP_X) / 2;

      children.forEach((child, childIndex) => {
        const childX = startChildX + childIndex * DESC_CHILD_GAP_X;

        unionG.append("path")
          .attr(
            "d",
            `M0,0 C0,80 ${childX},100 ${childX},${DESC_CHILD_Y}`
          )
          .attr("fill", "none")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 2);

        const childG = unionG
          .append("g")
          .attr("transform", `translate(${childX}, ${DESC_CHILD_Y})`);

        drawSatellitePersonCard(childG, child);

        // Soporte recursivo: si ese hijo también tiene hijos, se renderizan debajo.
        drawLocalDescendants(childG, child, nextVisited);
      });
    });
  }

  const initialX = width / 2;
  const initialY = height / 2;

  svg.call(
    zoom.transform,
    d3.zoomIdentity.translate(initialX, initialY).scale(0.8)
  );
};