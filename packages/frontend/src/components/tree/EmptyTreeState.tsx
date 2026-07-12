type EmptyTreeStateProps = {
  connectedFamilyCount: number;
  rootName?: string;
};

function progressMessage(connectedFamilyCount: number): string {
  if (connectedFamilyCount <= 0) {
    return "Agrega dos familiares cercanos para empezar a darle forma a tu árbol.";
  }

  if (connectedFamilyCount === 1) {
    return "Tu árbol ya tiene su primera conexión. Agrega un familiar más para completar este primer paso.";
  }

  return "Tu árbol inicial ya tomó forma. Puedes seguir agregando familiares cuando quieras.";
}

function statusTitle(connectedFamilyCount: number): string {
  if (connectedFamilyCount <= 0) {
    return "Tu historia familiar empieza aquí";
  }

  if (connectedFamilyCount === 1) {
    return "Tu árbol ya está creciendo";
  }

  return "Tu árbol inicial está listo";
}

export default function EmptyTreeState({
  connectedFamilyCount,
  rootName,
}: EmptyTreeStateProps) {
  const cappedCount = Math.min(Math.max(connectedFamilyCount, 0), 2);
  const progressPercentage = (cappedCount / 2) * 100;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#E6DCCF] bg-[#FFF9F0] p-4 shadow-sm"
      aria-labelledby="tree-start-title"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D8A94F]/10"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6F0EA] text-lg"
            aria-hidden="true"
          >
            🌱
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2F5D50]">
              Primeros pasos
            </p>

            <h2
              id="tree-start-title"
              className="mt-1 text-base font-bold leading-6 text-[#2B2B2B]"
            >
              {statusTitle(connectedFamilyCount)}
            </h2>

            {rootName && (
              <p className="mt-1 text-sm font-semibold text-[#2F5D50]">
                Comenzando contigo, {rootName}.
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm leading-5 text-slate-600">
          {progressMessage(connectedFamilyCount)}
        </p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-slate-600">
            <span>Árbol inicial sugerido</span>
            <span className="font-semibold text-[#2F5D50]">
              {cappedCount}/2 familiares
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-[#EDE5DA]"
            role="progressbar"
            aria-label="Progreso del árbol inicial"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={cappedCount}
          >
            <div
              className="h-full rounded-full bg-[#2F5D50] transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <p className="mt-3 border-t border-[#E6DCCF] pt-3 text-xs leading-5 text-slate-500">
          Usa las acciones rápidas para agregar padre, madre, pareja o hijo/a.
          Los datos opcionales pueden completarse después.
        </p>
      </div>
    </section>
  );
}
