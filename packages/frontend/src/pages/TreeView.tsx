import { useEffect, useRef } from "react";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";
import { buildAncestry, buildDescendants } from "../graph/layout";
import { renderFullTree } from "../visualization/renderTree";

const TreeView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { persons, relationships, rootPersonId, selectedPersonId } = useTreeStore();

  useEffect(() => {
    const focusPersonId = selectedPersonId ?? rootPersonId;

    if (!containerRef.current || !svgRef.current || persons.length === 0 || !focusPersonId) {
      return;
    }

    const render = () => {
      if (!containerRef.current || !svgRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      const unions = buildUnions(persons, relationships);
      const ancestors = buildAncestry(focusPersonId, persons, unions);
      const descendants = buildDescendants(focusPersonId, persons, unions);

      renderFullTree(
        svgRef.current,
        ancestors,
        descendants,
        containerWidth,
        containerHeight,
        persons,
        unions
      );
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      render();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [persons, relationships, rootPersonId, selectedPersonId]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
        Usa el mouse para mover o acercar el árbol
      </div>

      <svg ref={svgRef} className="h-full w-full cursor-move" />
    </div>
  );
};

export default TreeView;