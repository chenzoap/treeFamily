import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";

type PersonPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  birthPlace: string;
};

type ParentPayload = PersonPayload & { soltero: boolean };

type Notice = { kind: "success" | "error" | "info"; message: string };
type UiNotice = Notice | null;

type PersonLite = {
  id: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
};

type UnionLite = { id: string };


const emptyPerson: PersonPayload = {
  firstName: "",
  middleName: "",
  lastName: "",
  secondLastName: "",
  birthDate: "",
  birthPlace: "",
};

const emptyParent: ParentPayload = { ...emptyPerson, soltero: false };

function isValidISODate(dateStr: string): boolean {
  // Validación básica YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  // Evita fechas tipo 2026-99-99 que JS normaliza
  const [y, m, day] = dateStr.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

function personLabel(p: PersonLite): string {
  const first = p.firstName ?? "";
  const last = p.lastName ?? "";
  const second = p.secondLastName ?? "";
  return `${first} ${last} ${second}`.replace(/\s+/g, " ").trim();
}

function findPersonName(persons: PersonLite[], id: string): string {
  const p = persons.find((x) => x.id === id);
  return p ? personLabel(p) : id;
}

function formatUnionLabel(unionId: string, persons: PersonLite[]): string {
  if (unionId.startsWith("union:")) {
    const [, a, b] = unionId.split(":");
    return `${findPersonName(persons, a)} + ${findPersonName(persons, b)}`;
  }
  if (unionId.startsWith("single:")) {
    const [, a] = unionId.split(":");
    return `Solo: ${findPersonName(persons, a)}`;
  }
  return unionId;
}

function buildChildUnionOptions(
  persons: PersonLite[],
  unions: UnionLite[]
): UnionLite[] {
  const options = new Map<string, UnionLite>();

  // Primero agregamos las uniones reales existentes:
  // - union:personaA:personaB
  // - single:personaA si ya existía por hijos previos
  unions.forEach((union) => {
    if (typeof union.id === "string" && union.id.length > 0) {
      options.set(union.id, union);
    }
  });

  // Luego agregamos una opción single para TODAS las personas.
  // Esto permite que cualquier persona pueda tener hijos aunque no tenga pareja.
  persons.forEach((person) => {
    const singleUnionId = `single:${person.id}`;

    if (!options.has(singleUnionId)) {
      options.set(singleUnionId, { id: singleUnionId });
    }
  });

  return Array.from(options.values()).sort((a, b) => {
    const aIsSingle = a.id.startsWith("single:");
    const bIsSingle = b.id.startsWith("single:");

    // Mostramos primero las parejas reales y luego las opciones de persona soltera.
    if (aIsSingle !== bIsSingle) return aIsSingle ? 1 : -1;

    return formatUnionLabel(a.id, persons).localeCompare(
      formatUnionLabel(b.id, persons)
    );
  });
}

function noticeClasses(kind: Notice["kind"]) {
  if (kind === "success") return "border-green-200 bg-green-50 text-green-800";
  if (kind === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function extractFirebaseCallableErrorMessage(err: unknown): string {
  // FirebaseFunctionsError tiene .message y a veces detalles; aquí nos quedamos con lo útil.
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado.";
}

export default function Stage4Panel() {
  const { persons, relationships, treeId, rootPersonId, selectedPersonId, setSelectedPersonId } = useTreeStore();

  const unions = useMemo(() => buildUnions(persons, relationships), [persons, relationships]);

  const childUnionOptions = useMemo(
  () => buildChildUnionOptions(persons, unions as UnionLite[]),
  [persons, unions]
);

  // Persona activa: si no hay selected, usa root
  const activePersonId = selectedPersonId ?? rootPersonId ?? null;

  // Tabs
  const [tab, setTab] = useState<"partner" | "child" | "parent">("partner");

  // Notices
  const [notice, setNotice] = useState<UiNotice>(null);

  // DEV: claim ownership
  const [claiming, setClaiming] = useState(false);

  // 1) Create union
  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const [loadingUnion, setLoadingUnion] = useState(false);

  // 2) Add child to union
  const [selectedUnionId, setSelectedUnionId] = useState("");
  const [childData, setChildData] = useState<PersonPayload>({ ...emptyPerson });
  const [loadingChild, setLoadingChild] = useState(false);

  // 3) Add parent to person
  const [childId, setChildId] = useState("");
  const [parentRole, setParentRole] = useState<"father" | "mother">("father");
  const [parentData, setParentData] = useState<ParentPayload>({ ...emptyParent });
  const [loadingParent, setLoadingParent] = useState(false);

  // Callable functions
  const claimTreeOwnershipFn = useMemo(() => httpsCallable(functions, "claimTreeOwnership"), []);
  const createUnionFn = useMemo(() => httpsCallable(functions, "createUnion"), []);
  const addChildToUnionFn = useMemo(() => httpsCallable(functions, "addChildToUnion"), []);
  const addParentToPersonFn = useMemo(() => httpsCallable(functions, "addParentToPerson"), []);

  // Auto-preselecciones basadas en persona activa.
  // Cuando cambia la persona activa, actualizamos los formularios para operar
  // sobre esa persona y evitar que queden selecciones antiguas.
  useEffect(() => {
    if (!activePersonId) return;

    // Para “Crear pareja”: Persona A pasa a ser la persona activa.
    setPA(activePersonId);

    // Para “Agregar padre/madre”: el hijo/a objetivo pasa a ser la persona activa.
    setChildId(activePersonId);

    // Para “Agregar hijo/a”: preseleccionamos una unión donde participe la persona activa.
    // Si no tiene pareja, usamos su opción single:<personId>.
    const candidateUnion = childUnionOptions.find(
      (u) =>
        u.id.startsWith("union:") &&
        u.id.split(":").includes(activePersonId)
    );

    setSelectedUnionId(candidateUnion?.id ?? `single:${activePersonId}`);
  }, [activePersonId, childUnionOptions]);

  // Reset notice when switching tab
  useEffect(() => {
    setNotice(null);
  }, [tab]);

  if (!treeId) return null;

  const canCreateUnion = !!pA && !!pB && pA !== pB;
  const canAddChild =
    !!selectedUnionId &&
    !!childData.firstName &&
    !!childData.lastName &&
    !!childData.birthPlace &&
    isValidISODate(childData.birthDate);

  const canAddParent =
    !!childId &&
    !!parentData.firstName &&
    !!parentData.lastName &&
    !!parentData.birthPlace &&
    isValidISODate(parentData.birthDate);

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm mb-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Etapa 4 — Agregar familiar</h2>
          <p className="text-sm text-slate-600">Operaciones completas desde UI con reglas en backend.</p>
        </div>
      </div>

      {/* Contexto: Persona activa */}
      <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
        <div className="text-sm font-semibold">Contexto</div>
        <div className="grid gap-2 md:grid-cols-2 items-center">
          <label className="text-sm">
            Persona activa (preselecciones)
            <select
              className="mt-1 w-full p-2 border rounded bg-white"
              value={activePersonId ?? ""}
              onChange={(e) => setSelectedPersonId(e.target.value || null)}
            >
              <option value="">(Sin selección)</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-slate-600">
            <div>Root: <b>{rootPersonId ? findPersonName(persons, rootPersonId) : "—"}</b></div>
            <div>Activa: <b>{activePersonId ? findPersonName(persons, activePersonId) : "—"}</b></div>
          </div>
        </div>
      </div>

      {/* DEV tools */}
      {import.meta.env.DEV && (
        <div className="p-3 border rounded-lg bg-yellow-50 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div><b>DEV</b> uid: {auth.currentUser?.uid ?? "NO AUTH"}</div>
            <div>treeId: {treeId}</div>
          </div>
          <button
            className="px-3 py-2 rounded bg-yellow-600 text-white font-semibold disabled:opacity-50"
            disabled={claiming}
            onClick={async () => {
              try {
                setClaiming(true);
                const root = useTreeStore.getState().rootPersonId ?? undefined;
                await claimTreeOwnershipFn({ treeId, rootPersonId: root, treeName: "Demo Tree" });
                setNotice({ kind: "success", message: "✅ Árbol reclamado (DEV). Ya puedes operar sin 403." });
              } catch (err: unknown) {
                setNotice({ kind: "error", message: `Error: ${extractFirebaseCallableErrorMessage(err)}` });
              } finally {
                setClaiming(false);
              }
            }}
          >
            {claiming ? "Reclamando..." : "Reclamar árbol (DEV)"}
          </button>
        </div>
      )}

      {/* Notice */}
      {notice && (
        <div className={`p-3 border rounded-lg text-sm ${noticeClasses(notice.kind)}`}>
          {notice.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          className={`px-3 py-2 rounded font-semibold border ${tab === "partner" ? "bg-slate-900 text-white" : "bg-white"}`}
          onClick={() => setTab("partner")}
        >
          Pareja
        </button>
        <button
          className={`px-3 py-2 rounded font-semibold border ${tab === "child" ? "bg-slate-900 text-white" : "bg-white"}`}
          onClick={() => setTab("child")}
        >
          Hijo/a
        </button>
        <button
          className={`px-3 py-2 rounded font-semibold border ${tab === "parent" ? "bg-slate-900 text-white" : "bg-white"}`}
          onClick={() => setTab("parent")}
        >
          Padre/Madre
        </button>
      </div>

      {/* Tab content */}
      {tab === "partner" && (
        <section className="space-y-3">
          <div className="font-bold">Crear pareja (unión)</div>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-sm">
              Persona A
              <select className="mt-1 w-full p-2 border rounded" value={pA} onChange={(e) => setPA(e.target.value)}>
                <option value="">Selecciona...</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Persona B
              <select className="mt-1 w-full p-2 border rounded" value={pB} onChange={(e) => setPB(e.target.value)}>
                <option value="">Selecciona...</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="w-full p-2 rounded bg-blue-600 text-white font-bold disabled:opacity-50"
                disabled={loadingUnion || !canCreateUnion}
                onClick={async () => {
                  try {
                    setNotice(null);
                    setLoadingUnion(true);
                    await createUnionFn({ treeId, personAId: pA, personBId: pB });
                    setNotice({ kind: "success", message: `✅ Pareja creada (o ya existía): ${findPersonName(persons, pA)} + ${findPersonName(persons, pB)}` });
                    setPB("");
                  } catch (err: unknown) {
                    setNotice({ kind: "error", message: `Error: ${extractFirebaseCallableErrorMessage(err)}` });
                  } finally {
                    setLoadingUnion(false);
                  }
                }}
              >
                {loadingUnion ? "Guardando..." : "Crear pareja"}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === "child" && (
        <section className="space-y-3">
          <div className="font-bold">Agregar hijo/a a una unión</div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">
              Unión
              <select
                className="mt-1 w-full p-2 border rounded"
                value={selectedUnionId}
                onChange={(e) => setSelectedUnionId(e.target.value)}
              >
                <option value="">Selecciona unión...</option>
                {childUnionOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatUnionLabel(u.id, persons)}
                  </option>
                ))}
              </select>
              {import.meta.env.DEV && selectedUnionId && (
                <div className="text-xs text-slate-500 mt-1">id: {selectedUnionId}</div>
              )}
            </label>

            <div className="flex items-end">
              <button
                className="w-full p-2 rounded bg-green-600 text-white font-bold disabled:opacity-50"
                disabled={loadingChild || !canAddChild}
                onClick={async () => {
                  try {
                    setNotice(null);
                    setLoadingChild(true);
                    await addChildToUnionFn({ treeId, unionId: selectedUnionId, childData });
                    setNotice({ kind: "success", message: `✅ Hijo/a agregado a: ${formatUnionLabel(selectedUnionId, persons)}` });
                    setChildData({ ...emptyPerson });
                  } catch (err: unknown) {
                    setNotice({ kind: "error", message: `Error: ${extractFirebaseCallableErrorMessage(err)}` });
                  } finally {
                    setLoadingChild(false);
                  }
                }}
              >
                {loadingChild ? "Guardando..." : "Agregar hijo/a"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <input className="p-2 border rounded" placeholder="Nombres *" value={childData.firstName} onChange={(e) => setChildData((v) => ({ ...v, firstName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Segundo nombre" value={childData.middleName ?? ""} onChange={(e) => setChildData((v) => ({ ...v, middleName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Apellido paterno *" value={childData.lastName} onChange={(e) => setChildData((v) => ({ ...v, lastName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Apellido materno" value={childData.secondLastName ?? ""} onChange={(e) => setChildData((v) => ({ ...v, secondLastName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Fecha nacimiento (YYYY-MM-DD) *" value={childData.birthDate} onChange={(e) => setChildData((v) => ({ ...v, birthDate: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Lugar nacimiento *" value={childData.birthPlace} onChange={(e) => setChildData((v) => ({ ...v, birthPlace: e.target.value }))} />
          </div>

          <div className="text-xs text-slate-600">
            Campos obligatorios: nombres, apellido paterno, fecha (YYYY-MM-DD válida), lugar.
          </div>
        </section>
      )}

      {tab === "parent" && (
        <section className="space-y-3">
          <div className="font-bold">Agregar padre/madre</div>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="text-sm">
              Hijo/a
              <select className="mt-1 w-full p-2 border rounded" value={childId} onChange={(e) => setChildId(e.target.value)}>
                <option value="">Selecciona...</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Rol
              <select
                className="mt-1 w-full p-2 border rounded"
                value={parentRole}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "father" || v === "mother") setParentRole(v);
                }}
              >
                <option value="father">Padre</option>
                <option value="mother">Madre</option>
              </select>
            </label>

            <label className="text-sm flex items-center gap-2 mt-6 p-2 border rounded bg-white">
              <input
                type="checkbox"
                checked={parentData.soltero}
                onChange={(e) => setParentData((v) => ({ ...v, soltero: e.target.checked }))}
              />
              Soltero
            </label>

            <div className="flex items-end">
              <button
                className="w-full p-2 rounded bg-purple-600 text-white font-bold disabled:opacity-50"
                disabled={loadingParent || !canAddParent}
                onClick={async () => {
                  try {
                    setNotice(null);
                    setLoadingParent(true);
                    await addParentToPersonFn({ treeId, childId, parentRole, parentData });
                    setNotice({ kind: "success", message: `✅ ${parentRole === "father" ? "Padre" : "Madre"} agregado: ${parentData.firstName} ${parentData.lastName}` });
                    setParentData({ ...emptyParent });
                  } catch (err: unknown) {
                    setNotice({ kind: "error", message: `Error: ${extractFirebaseCallableErrorMessage(err)}` });
                  } finally {
                    setLoadingParent(false);
                  }
                }}
              >
                {loadingParent ? "Guardando..." : "Agregar padre/madre"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <input className="p-2 border rounded" placeholder="Nombres *" value={parentData.firstName} onChange={(e) => setParentData((v) => ({ ...v, firstName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Segundo nombre" value={parentData.middleName ?? ""} onChange={(e) => setParentData((v) => ({ ...v, middleName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Apellido paterno *" value={parentData.lastName} onChange={(e) => setParentData((v) => ({ ...v, lastName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Apellido materno" value={parentData.secondLastName ?? ""} onChange={(e) => setParentData((v) => ({ ...v, secondLastName: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Fecha nacimiento (YYYY-MM-DD) *" value={parentData.birthDate} onChange={(e) => setParentData((v) => ({ ...v, birthDate: e.target.value }))} />
            <input className="p-2 border rounded" placeholder="Lugar nacimiento *" value={parentData.birthPlace} onChange={(e) => setParentData((v) => ({ ...v, birthPlace: e.target.value }))} />
          </div>

          <div className="text-xs text-slate-600">
            Si marca <b>Soltero</b>, no se intentará crear pareja automáticamente (según requerimiento).
          </div>
        </section>
      )}
    </div>
  );
}
