import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";

type PersonPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
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
type QuickAction = "father" | "mother" | "partner" | "child";

type ParentPairSuggestion = {
  childId: string;
  childName: string;
  fatherId: string;
  fatherName: string;
  motherId: string;
  motherName: string;
};

const emptyPerson: PersonPayload = {
  firstName: "",
  middleName: "",
  lastName: "",
  secondLastName: "",
  birthDate: "",
  birthPlace: "",
};

const emptyParent: ParentPayload = { ...emptyPerson, soltero: false };

function isValidOptionalISODate(dateStr?: string): boolean {
  if (!dateStr) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const [y, m, day] = dateStr.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

function isPersonPayloadReady(payload: PersonPayload): boolean {
  return (
    payload.firstName.trim().length > 0 &&
    payload.lastName.trim().length > 0 &&
    isValidOptionalISODate(payload.birthDate)
  );
}

function personLabel(p: PersonLite): string {
  return `${p.firstName ?? ""} ${p.lastName ?? ""} ${p.secondLastName ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function findPersonById(persons: PersonLite[], id: string): PersonLite | null {
  return persons.find((x) => x.id === id) ?? null;
}

function findPersonName(persons: PersonLite[], id: string): string | null {
  const p = findPersonById(persons, id);
  if (!p) return null;
  const label = personLabel(p);
  return label.length > 0 ? label : null;
}

function hasPartnerRelationship(relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>, a: string, b: string): boolean {
  return relationships.some((relationship) => {
    if (relationship.type !== "PARTNER_OF") return false;
    const forward = relationship.fromPersonId === a && relationship.toPersonId === b;
    const reverse = relationship.fromPersonId === b && relationship.toPersonId === a;
    return forward || reverse;
  });
}

function findParentPairSuggestionForChild({
  childId,
  persons,
  relationships,
}: {
  childId: string;
  persons: PersonLite[];
  relationships: Array<{ fromPersonId: string; toPersonId: string; type: string; parentRole?: "father" | "mother" }>;
}): ParentPairSuggestion | null {
  const parentRelationships = relationships.filter(
    (relationship) => relationship.type === "PARENT_OF" && relationship.toPersonId === childId
  );

  const fatherRel = parentRelationships.find((relationship) => relationship.parentRole === "father");
  const motherRel = parentRelationships.find((relationship) => relationship.parentRole === "mother");

  if (!fatherRel || !motherRel) return null;

  const fatherId = fatherRel.fromPersonId;
  const motherId = motherRel.fromPersonId;

  if (fatherId === motherId) return null;
  if (hasPartnerRelationship(relationships, fatherId, motherId)) return null;

  const childName = findPersonName(persons, childId);
  const fatherName = findPersonName(persons, fatherId);
  const motherName = findPersonName(persons, motherId);

  // Regla PM/PO: nunca mostrar una sugerencia si no se pueden resolver
  // los nombres de padre, madre e hijo/a.
  if (!childName || !fatherName || !motherName) return null;

  return {
    childId,
    childName,
    fatherId,
    fatherName,
    motherId,
    motherName,
  };
}

function formatUnionLabel(unionId: string, persons: PersonLite[]): string {
  if (unionId.startsWith("union:")) {
    const [, a, b] = unionId.split(":");
    const personAName = findPersonName(persons, a);
    const personBName = findPersonName(persons, b);
    if (!personAName || !personBName) return "Pareja registrada";
    return `${personAName} + ${personBName}`;
  }

  if (unionId.startsWith("single:")) {
    const [, a] = unionId.split(":");
    const personName = findPersonName(persons, a);
    return personName ? `Solo como hijo/a de ${personName}` : "Solo como hijo/a de la persona seleccionada";
  }

  return unionId;
}

function noticeClasses(kind: Notice["kind"]) {
  if (kind === "success") return "border-green-200 bg-green-50 text-green-800";
  if (kind === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function extractFirebaseCallableErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado.";
}

function buildChildUnionOptionsForPerson(activePersonId: string, unions: UnionLite[]): UnionLite[] {
  const options = new Map<string, UnionLite>();

  unions.forEach((union) => {
    if (
      union.id.startsWith("union:") &&
      union.id.split(":").includes(activePersonId)
    ) {
      options.set(union.id, union);
    }
  });

  const singleUnionId = `single:${activePersonId}`;
  options.set(singleUnionId, { id: singleUnionId });

  return Array.from(options.values()).sort((a, b) => {
    const aIsSingle = a.id.startsWith("single:");
    const bIsSingle = b.id.startsWith("single:");
    if (aIsSingle !== bIsSingle) return aIsSingle ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}

function PersonFields({
  value,
  onChange,
  nameLabel,
}: {
  value: PersonPayload;
  onChange: (next: PersonPayload) => void;
  nameLabel: string;
}) {
  return (
    <div className="grid gap-2">
      <input
        className="p-2 border rounded-lg"
        placeholder={`${nameLabel} *`}
        value={value.firstName}
        onChange={(e) => onChange({ ...value, firstName: e.target.value })}
      />
      <input
        className="p-2 border rounded-lg"
        placeholder="Segundo nombre"
        value={value.middleName ?? ""}
        onChange={(e) => onChange({ ...value, middleName: e.target.value })}
      />
      <input
        className="p-2 border rounded-lg"
        placeholder="Apellido *"
        value={value.lastName}
        onChange={(e) => onChange({ ...value, lastName: e.target.value })}
      />
      <input
        className="p-2 border rounded-lg"
        placeholder="Segundo apellido"
        value={value.secondLastName ?? ""}
        onChange={(e) => onChange({ ...value, secondLastName: e.target.value })}
      />
      <input
        className="p-2 border rounded-lg"
        type="date"
        title="Fecha de nacimiento opcional"
        value={value.birthDate ?? ""}
        onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
      />
      <input
        className="p-2 border rounded-lg"
        placeholder="Lugar de nacimiento (opcional)"
        value={value.birthPlace ?? ""}
        onChange={(e) => onChange({ ...value, birthPlace: e.target.value })}
      />
      <p className="text-xs text-slate-500">
        Para familiares, la fecha y el lugar de nacimiento son opcionales. Puedes completarlos después.
      </p>
    </div>
  );
}

export default function Stage4Panel() {
  const { persons, relationships, treeId, rootPersonId, selectedPersonId, setSelectedPersonId } = useTreeStore();

  const unions = useMemo(() => buildUnions(persons, relationships) as UnionLite[], [persons, relationships]);
  const activePersonId = selectedPersonId ?? rootPersonId ?? null;
  const activePerson = activePersonId ? persons.find((p) => p.id === activePersonId) : null;
  const activeName = activePerson ? personLabel(activePerson) : "Selecciona una persona";

  const [action, setAction] = useState<QuickAction>("father");
  const [notice, setNotice] = useState<UiNotice>(null);

  const [partnerData, setPartnerData] = useState<PersonPayload>({ ...emptyPerson });
  const [childData, setChildData] = useState<PersonPayload>({ ...emptyPerson });
  const [parentData, setParentData] = useState<ParentPayload>({ ...emptyParent });
  const [selectedUnionId, setSelectedUnionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [parentPairSuggestion, setParentPairSuggestion] = useState<ParentPairSuggestion | null>(null);

  const addPartnerToPersonFn = useMemo(() => httpsCallable(functions, "addPartnerToPerson"), []);
  const addChildToUnionFn = useMemo(() => httpsCallable(functions, "addChildToUnion"), []);
  const addParentToPersonFn = useMemo(() => httpsCallable(functions, "addParentToPerson"), []);
  const createUnionFn = useMemo(() => httpsCallable(functions, "createUnion"), []);

  const childUnionOptions = useMemo(() => {
    if (!activePersonId) return [];
    return buildChildUnionOptionsForPerson(activePersonId, unions);
  }, [activePersonId, unions]);

  useEffect(() => {
    setNotice(null);
    setParentPairSuggestion(null);
  }, [action, activePersonId]);

  useEffect(() => {
    if (!activePersonId) return;
    const firstOption = childUnionOptions[0]?.id ?? `single:${activePersonId}`;
    setSelectedUnionId(firstOption);
  }, [activePersonId, childUnionOptions]);

  useEffect(() => {
    if (!activePersonId) return;

    const suggestion = findParentPairSuggestionForChild({
      childId: activePersonId,
      persons,
      relationships,
    });

    setParentPairSuggestion(suggestion);
  }, [activePersonId, persons, relationships]);

  if (!treeId) return null;

  const canSavePartner = !!activePersonId && isPersonPayloadReady(partnerData);
  const canSaveChild = !!activePersonId && !!selectedUnionId && isPersonPayloadReady(childData);
  const canSaveParent = !!activePersonId && isPersonPayloadReady(parentData);

  const saveParent = async (parentRole: "father" | "mother") => {
    if (!activePersonId) return;

    try {
      setSaving(true);
      setNotice(null);
      setParentPairSuggestion(null);

      const result = await addParentToPersonFn({ treeId, childId: activePersonId, parentRole, parentData });
      const newParentId = (result.data as { parentId?: string }).parentId;

      setNotice({
        kind: "success",
        message: parentRole === "father" ? "Padre agregado al árbol." : "Madre agregada al árbol.",
      });
      setParentData({ ...emptyParent });

      // No mostramos la sugerencia inmediatamente usando datos locales antiguos.
      // Firestore actualizará persons/relationships por snapshot y el useEffect
      // mostrará la sugerencia solo cuando padre y madre existan y sus nombres
      // estén completamente resueltos.
      void newParentId;
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const connectSuggestedParents = async () => {
    if (!parentPairSuggestion) return;

    try {
      setSaving(true);
      setNotice(null);

      await createUnionFn({
        treeId,
        personAId: parentPairSuggestion.fatherId,
        personBId: parentPairSuggestion.motherId,
      });

      setNotice({
        kind: "success",
        message: "Padre y madre conectados como pareja.",
      });
      setParentPairSuggestion(null);
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const savePartner = async () => {
    if (!activePersonId) return;

    try {
      setSaving(true);
      setNotice(null);
      await addPartnerToPersonFn({ treeId, personId: activePersonId, partnerData });
      setNotice({ kind: "success", message: "Pareja agregada al árbol." });
      setPartnerData({ ...emptyPerson });
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const saveChild = async () => {
    if (!selectedUnionId) return;

    try {
      setSaving(true);
      setNotice(null);
      await addChildToUnionFn({ treeId, unionId: selectedUnionId, childData });
      setNotice({ kind: "success", message: "Hijo/a agregado al árbol." });
      setChildData({ ...emptyPerson });
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded-2xl bg-white shadow-sm space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Construye tu árbol</p>
        <h2 className="text-xl font-bold text-slate-900">Acciones rápidas</h2>
        <p className="text-sm text-slate-600 mt-1">Agrega familiares cercanos sin manejar datos técnicos.</p>
      </div>

      <div className="p-3 border rounded-xl bg-slate-50 space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Persona seleccionada
          <select
            className="mt-1 w-full p-2 border rounded-lg bg-white"
            value={activePersonId ?? ""}
            onChange={(e) => setSelectedPersonId(e.target.value || null)}
          >
            <option value="">Selecciona una persona</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">Las acciones se aplicarán sobre: <b>{activeName}</b></p>
      </div>

      {notice && (
        <div className={`p-3 border rounded-lg text-sm ${noticeClasses(notice.kind)}`}>
          {notice.message}
        </div>
      )}

      {parentPairSuggestion && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 space-y-3">
          <div>
            <p className="font-bold">Ya agregaste padre y madre para {parentPairSuggestion.childName}.</p>
            <p className="mt-1">
              ¿Quieres conectar a {parentPairSuggestion.fatherName} y {parentPairSuggestion.motherName} como pareja para que el árbol se vea más completo?
            </p>
            <p className="mt-1 text-xs text-blue-800">Puedes cambiar esto después.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white disabled:opacity-50"
              disabled={saving}
              onClick={connectSuggestedParents}
            >
              Conectarlos
            </button>
            <button
              type="button"
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-bold text-blue-900"
              onClick={() => setParentPairSuggestion(null)}
            >
              No por ahora
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className={`p-2 rounded-lg border font-semibold ${action === "father" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setAction("father")}>
          Agregar padre
        </button>
        <button className={`p-2 rounded-lg border font-semibold ${action === "mother" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setAction("mother")}>
          Agregar madre
        </button>
        <button className={`p-2 rounded-lg border font-semibold ${action === "partner" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setAction("partner")}>
          Agregar pareja
        </button>
        <button className={`p-2 rounded-lg border font-semibold ${action === "child" ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => setAction("child")}>
          Agregar hijo/a
        </button>
      </div>

      {!activePersonId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Selecciona una persona para agregar familiares.
        </div>
      )}

      {(action === "father" || action === "mother") && (
        <section className="space-y-3">
          <div>
            <h3 className="font-bold text-slate-900">{action === "father" ? "Agregar padre" : "Agregar madre"}</h3>
            <p className="text-sm text-slate-600">Se conectará como {action === "father" ? "padre" : "madre"} de {activeName}.</p>
          </div>

          <PersonFields
            value={parentData}
            onChange={(next) => setParentData({ ...next, soltero: parentData.soltero })}
            nameLabel={action === "father" ? "Nombre del padre" : "Nombre de la madre"}
          />

          <button
            className="w-full p-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
            disabled={saving || !canSaveParent}
            onClick={() => saveParent(action === "father" ? "father" : "mother")}
          >
            {saving ? "Guardando..." : action === "father" ? "Guardar padre" : "Guardar madre"}
          </button>
        </section>
      )}

      {action === "partner" && (
        <section className="space-y-3">
          <div>
            <h3 className="font-bold text-slate-900">Agregar pareja</h3>
            <p className="text-sm text-slate-600">Crearemos la persona y la conectaremos como pareja de {activeName}.</p>
          </div>

          <PersonFields value={partnerData} onChange={setPartnerData} nameLabel="Nombre de la pareja" />

          <button
            className="w-full p-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
            disabled={saving || !canSavePartner}
            onClick={savePartner}
          >
            {saving ? "Guardando..." : "Guardar pareja"}
          </button>
        </section>
      )}

      {action === "child" && (
        <section className="space-y-3">
          <div>
            <h3 className="font-bold text-slate-900">Agregar hijo/a</h3>
            <p className="text-sm text-slate-600">Puedes conectarlo con una pareja o solo como hijo/a de {activeName}.</p>
          </div>

          <label className="text-sm font-medium text-slate-700 block">
            Conexión familiar
            <select
              className="mt-1 w-full p-2 border rounded-lg bg-white"
              value={selectedUnionId}
              onChange={(e) => setSelectedUnionId(e.target.value)}
            >
              {childUnionOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUnionLabel(u.id, persons)}
                </option>
              ))}
            </select>
          </label>

          <PersonFields value={childData} onChange={setChildData} nameLabel="Nombre del hijo/a" />

          <button
            className="w-full p-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
            disabled={saving || !canSaveChild}
            onClick={saveChild}
          >
            {saving ? "Guardando..." : "Guardar hijo/a"}
          </button>
        </section>
      )}
    </div>
  );
}
