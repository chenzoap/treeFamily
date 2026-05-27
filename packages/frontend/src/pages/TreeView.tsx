import { useEffect, useRef } from "react";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";
import { buildAncestry, buildDescendants } from "../graph/layout";
import { renderFullTree } from "../visualization/renderTree";

const TreeView = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { persons, relationships, rootPersonId, selectedPersonId } = useTreeStore();

  useEffect(() => {
    const focusPersonId = selectedPersonId ?? rootPersonId;

    if (!svgRef.current || persons.length === 0 || !focusPersonId) return;

    const unions = buildUnions(persons, relationships);

    const ancestors = buildAncestry(focusPersonId, persons, unions);
    const descendants = buildDescendants(focusPersonId, persons, unions);

    // PASAMOS 'persons' como cuarto argumento para buscar datos de la pareja
    renderFullTree(
    svgRef.current,
    ancestors,
    descendants,
    window.innerWidth,
    persons,
    unions
  );
}, [persons, relationships, rootPersonId, selectedPersonId]);

  return (
    <div className="w-full h-full bg-slate-50 relative">
      <svg ref={svgRef} className="w-full h-full cursor-move" />
    </div>
  );
};

export default TreeView;