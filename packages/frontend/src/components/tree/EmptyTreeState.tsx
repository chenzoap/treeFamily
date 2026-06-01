type EmptyTreeStateProps = {
  connectedFamilyCount: number;
  rootName?: string;
};

function progressMessage(connectedFamilyCount: number): string {
  if (connectedFamilyCount <= 0) {
    return "Agrega dos familiares cercanos para empezar a darle forma a tu árbol.";
  }

  if (connectedFamilyCount === 1) {
    return "Tu árbol ya tiene su primera conexión. Agrega un familiar más para completar tu inicio.";
  }

  return "Tu árbol inicial ya tomó forma. Puedes seguir agregando familiares cuando quieras.";
}

export default function EmptyTreeState({ connectedFamilyCount, rootName }: EmptyTreeStateProps) {
  const cappedCount = Math.min(Math.max(connectedFamilyCount, 0), 2);

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Primeros pasos</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          {rootName ? `Tu árbol empezó contigo, ${rootName}.` : "Tu árbol familiar ya empezó contigo."}
        </h2>
        <p className="mt-1 text-sm text-slate-700">{progressMessage(connectedFamilyCount)}</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>Árbol mínimo sugerido</span>
          <span>{cappedCount}/2 familiares</span>
        </div>
        <div className="h-2 rounded-full bg-white border border-blue-100 overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${(cappedCount / 2) * 100}%` }} />
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Usa las acciones rápidas para agregar padre, madre, pareja o hijo/a. No necesitas completar toda la información ahora.
      </p>
    </section>
  );
}
