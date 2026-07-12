import { useEffect, useMemo, useRef } from "react";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnionsWithDiagnostics } from "../graph/union";
import { buildFamilyLayout } from "../graph/familyLayout";
import { renderFullTree } from "../visualization/renderTree";

const RENDER_DEBOUNCE_MS = 120;
const DETACHED_WARNING_DELAY_MS = 900;

const TreeView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const detachedWarningTimerRef = useRef<number | null>(null);
  const latestDetachedSignatureRef = useRef("");
  const lastLoggedDetachedSignatureRef = useRef("");

  const {
    persons,
    relationships,
    rootPersonId,
    selectedPersonId,
  } = useTreeStore();

  const { unions, issues } = useMemo(
    () => buildUnionsWithDiagnostics(persons, relationships),
    [persons, relationships]
  );

  const stableRootPersonId = useMemo(() => {
    const ids = new Set(persons.map((person) => person.id));

    if (rootPersonId && ids.has(rootPersonId)) {
      return rootPersonId;
    }

    const storedRoot = persons.find((person) => person.isRoot);
    if (storedRoot) return storedRoot.id;

    return persons[0]?.id ?? null;
  }, [persons, rootPersonId]);

  const validSelectedPersonId = useMemo(() => {
    if (
      selectedPersonId &&
      selectedPersonId !== stableRootPersonId &&
      persons.some((person) => person.id === selectedPersonId)
    ) {
      return selectedPersonId;
    }

    return null;
  }, [persons, selectedPersonId, stableRootPersonId]);

  useEffect(() => {
    if (!import.meta.env.DEV || issues.length === 0) return;

    console.groupCollapsed(
      `[Tree Family] Se ignoraron ${issues.length} relación(es) inválida(s) o duplicada(s).`
    );

    issues.forEach((issue) => {
      if (issue.severity === "error") {
        console.error(`[${issue.code}] ${issue.message}`, issue);
      } else {
        console.warn(`[${issue.code}] ${issue.message}`, issue);
      }
    });

    console.groupEnd();
  }, [issues]);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;

    if (!container || !svg) return;

    if (persons.length === 0 || !stableRootPersonId) {
      svg.replaceChildren();
      return;
    }

    let renderTimer: number | null = null;

    const render = () => {
      if (renderTimer !== null) {
        window.clearTimeout(renderTimer);
      }

      renderTimer = window.setTimeout(() => {
        const containerRect = container.getBoundingClientRect();

        if (containerRect.width <= 0 || containerRect.height <= 0) {
          return;
        }

        const layout = buildFamilyLayout(
          stableRootPersonId,
          validSelectedPersonId,
          persons,
          unions
        );

        if (import.meta.env.DEV) {
          layout.warnings.forEach((warning) => {
            console.warn(`[family-layout] ${warning}`);
          });

          layout.collisions.forEach((collision) => {
            console.warn(`[family-layout-collision] ${collision}`);
          });

          const detachedSignature = [...layout.detachedPersonIds]
            .sort()
            .join("|");

          latestDetachedSignatureRef.current = detachedSignature;

          if (detachedWarningTimerRef.current !== null) {
            window.clearTimeout(detachedWarningTimerRef.current);
          }

          if (detachedSignature) {
            detachedWarningTimerRef.current = window.setTimeout(() => {
              if (
                latestDetachedSignatureRef.current === detachedSignature &&
                lastLoggedDetachedSignatureRef.current !== detachedSignature
              ) {
                console.warn(
                  `[family-layout] ${layout.detachedPersonIds.length} persona(s) permanecen fuera del componente de la persona principal.`,
                  layout.detachedPersonIds
                );

                lastLoggedDetachedSignatureRef.current =
                  detachedSignature;
              }
            }, DETACHED_WARNING_DELAY_MS);
          } else {
            lastLoggedDetachedSignatureRef.current = "";
          }
        }

        renderFullTree(
          svg,
          layout,
          containerRect.width,
          containerRect.height
        );
      }, RENDER_DEBOUNCE_MS);
    };

    render();

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();

      if (renderTimer !== null) {
        window.clearTimeout(renderTimer);
      }

      if (detachedWarningTimerRef.current !== null) {
        window.clearTimeout(detachedWarningTimerRef.current);
      }
    };
  }, [
    persons,
    stableRootPersonId,
    unions,
    validSelectedPersonId,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[#E6DCCF] bg-[#FFFBF5]"
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
        Usa el mouse para mover o acercar el árbol
      </div>

      <svg
        ref={svgRef}
        className="h-full w-full cursor-move"
      />
    </div>
  );
};

export default TreeView;
