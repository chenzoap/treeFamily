import * as d3 from "d3";
import { type TreeNode, type Person, type Union } from "../types/family";

type HierarchyNode = d3.HierarchyPointNode<TreeNode>;
type HierarchyLink = d3.HierarchyPointLink<TreeNode>;

export const renderFullTree = (
  container: SVGSVGElement,
  ancestorsData: TreeNode | null,
  descendantsData: TreeNode | null,
  width: number,
  allPersons: Person[] // Recibimos todas las personas
) => {
  const svg = d3.select(container);
  svg.selectAll("*").remove();
  const g = svg.append("g");

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => g.attr("transform", event.transform));
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

  function drawBranch(
    parentContainer: d3.Selection<SVGGElement, unknown, null, undefined>, 
    treeData: HierarchyNode, 
    isInverted: boolean
  ) { 
    const yMult = isInverted ? -1 : 1;

    // 1. Conexiones verticales (Hijos)
    parentContainer.append("g")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2)
      .selectAll("path")
      .data(treeData.links())
      .enter()
      .append("path")
      .attr("d", d3.linkVertical<HierarchyLink, HierarchyNode>()
        .x(d => d.x)
        .y(d => d.y * yMult)
      );

    const nodes = parentContainer.append("g")
      .selectAll("g")
      .data(treeData.descendants())
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x},${d.y * yMult})`);

    // --- 2. RENDER PERSONA PRINCIPAL ---
    const personNodes = nodes.filter(d => d.data.type === 'person');
    
    personNodes.append("rect")
      .attr("width", 140)
      .attr("height", 40)
      .attr("x", -70)
      .attr("y", -20)
      .attr("rx", 6)
      .attr("fill", d => (d.data.data as Person).isRoot ? "#1e293b" : "#ffffff")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2);

    personNodes.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .attr("fill", d => (d.data.data as Person).isRoot ? "#ffffff" : "#1e293b")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(d => {
        const p = d.data.data as Person;
        return `${p.firstName} ${p.lastName}`;
      });

    // --- 3. RENDER UNIÓN Y PAREJA AL COSTADO ---
    const unionNodes = nodes.filter(d => d.data.type === 'union');

    unionNodes.each(function(d) {
      const gUnion = d3.select(this);
      const u = d.data.data as Union;

      // Punto unión (hazlo visible)
      gUnion.append("circle")
        .attr("r", 4)
        .attr("fill", "#3b82f6");

      // Identificar quién es el padre (spouse) en el árbol: el parent del nodo union
      const parentPersonId =
        d.parent?.data.type === "person"
          ? (d.parent.data.data as Person).id
          : null;

      // Determinar "la otra pareja" a mostrar a la derecha
      const otherPartnerId =
        parentPersonId && parentPersonId === u.partnerA ? u.partnerB :
        parentPersonId && parentPersonId === u.partnerB ? u.partnerA :
        // fallback si por alguna razón no hay parent claro
        u.partnerB || u.partnerA;

      if (!otherPartnerId) return;

      const partner = allPersons.find(p => p.id === otherPartnerId);
      if (!partner) return;

      // Línea horizontal hacia la derecha (solo para el spouse satélite)
      gUnion.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 120)
        .attr("y2", 0)
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2");

      const partnerG = gUnion.append("g").attr("transform", "translate(120, 0)");

      partnerG.append("rect")
        .attr("width", 140)
        .attr("height", 40)
        .attr("x", -70)
        .attr("y", -20)
        .attr("rx", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 2);

      partnerG.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", 5)
        .attr("fill", "#1e293b")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text(`${partner.firstName} ${partner.lastName}`);
    });

  }

  svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, 100).scale(0.8));
};