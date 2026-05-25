import { useEffect, useRef } from "react";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";
import { buildAncestry, buildDescendants } from "../graph/layout";
import { renderFullTree } from "../visualization/renderTree";

const TreeView = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { persons, relationships, rootPersonId } = useTreeStore();

  useEffect(() => {
    if (!svgRef.current || persons.length === 0 || !rootPersonId) return;

    const unions = buildUnions(persons, relationships);
    console.log("UNIONS_DERIVED", unions.length, unions.slice(0, 5));
    
    const ancestors = buildAncestry(rootPersonId, persons, unions);
    const descendants = buildDescendants(rootPersonId, persons, unions);

    // PASAMOS 'persons' como cuarto argumento para buscar datos de la pareja
    renderFullTree(svgRef.current, ancestors, descendants, window.innerWidth, persons, unions);
  }, [persons, relationships, rootPersonId]);

  return (
    <div className="w-full h-full bg-slate-50 relative">
      <svg ref={svgRef} className="w-full h-full cursor-move" />
    </div>
  );
};

export default TreeView;