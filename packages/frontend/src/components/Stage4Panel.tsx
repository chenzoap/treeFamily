import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { buildUnions } from "../graph/union";
import type { Union } from "../types/family";

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

type UnionLite = Pick<Union, "id" | "kind" | "partnerA" | "partnerB">;
type ChildParentRole = "father" | "mother";
type ExistingChildOption = {
  id: string;
  name: string;
  eligible: boolean;
  reason?: string;
};
type QuickAction = "father" | "mother" | "partner" | "child";
type PartnerMode = "new" | "existing";
type PartnerRelationshipStatus = "current" | "former" | "unknown";

// eslint-disable-next-line react-refresh/only-export-components
export function canSubmitPartnerWithExistingChildren(
  baseReady: boolean,
  selectedChildIds: readonly string[],
  parentRole: ChildParentRole | ""
): boolean {
  return baseReady &&
    (selectedChildIds.length === 0 ||
      parentRole === "father" ||
      parentRole === "mother");
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildExistingChildrenRolePayload(
  selectedChildIds: readonly string[],
  parentRole: ChildParentRole | ""
): { parentRoleForExistingChildren?: ChildParentRole } {
  return selectedChildIds.length > 0 &&
    (parentRole === "father" || parentRole === "mother") ?
    { parentRoleForExistingChildren: parentRole } :
    {};
}

// eslint-disable-next-line react-refresh/only-export-components
export function toggleExistingChildSelection(
  selectedChildIds: readonly string[],
  childId: string
): { selectedChildIds: string[]; shouldClearParentRole: boolean } {
  const nextSelectedChildIds = selectedChildIds.includes(childId) ?
    selectedChildIds.filter((id) => id !== childId) :
    [...selectedChildIds, childId];

  return {
    selectedChildIds: nextSelectedChildIds,
    shouldClearParentRole: nextSelectedChildIds.length === 0,
  };
}

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

function partnerStatusLabel(
  status: PartnerRelationshipStatus
): string {
  if (status === "current") return "Pareja actual";
  if (status === "former") return "Expareja";
  return "Relación de pareja sin especificar";
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

function buildExistingChildOptions({
  activePersonId,
  targetPartnerId,
  persons,
  relationships,
}: {
  activePersonId: string;
  targetPartnerId: string | null;
  persons: PersonLite[];
  relationships: Array<{
    fromPersonId: string;
    toPersonId: string;
    type: string;
  }>;
}): ExistingChildOption[] {
  const childIds = Array.from(
    new Set(
      relationships
        .filter(
          (relationship) =>
            relationship.type === "PARENT_OF" &&
            relationship.fromPersonId === activePersonId
        )
        .map((relationship) => relationship.toPersonId)
    )
  );

  return childIds
    .map((childId): ExistingChildOption | null => {
      const childName = findPersonName(persons, childId);
      if (!childName) return null;

      const parentIds = Array.from(
        new Set(
          relationships
            .filter(
              (relationship) =>
                relationship.type === "PARENT_OF" &&
                relationship.toPersonId === childId
            )
            .map((relationship) => relationship.fromPersonId)
        )
      );

      if (targetPartnerId && parentIds.includes(targetPartnerId)) {
        return {
          id: childId,
          name: childName,
          eligible: false,
          reason: "Ya está vinculado/a con esta persona.",
        };
      }

      const otherParentIds = parentIds.filter(
        (parentId) => parentId !== activePersonId
      );

      if (otherParentIds.length > 0) {
        return {
          id: childId,
          name: childName,
          eligible: false,
          reason:
            "Ya tiene otro progenitor registrado. Cambiar esta filiación pertenece a Etapa 8.",
        };
      }

      return {
        id: childId,
        name: childName,
        eligible: true,
      };
    })
    .filter((option): option is ExistingChildOption => Boolean(option))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
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
  if (
    typeof err === "object" &&
    err !== null &&
    "details" in err &&
    typeof err.details === "object" &&
    err.details !== null &&
    "reason" in err.details &&
    err.details.reason === "parent-role-required"
  ) {
    return "Selecciona si la pareja será padre o madre de los hijos elegidos.";
  }
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
  options.set(singleUnionId, {
    id: singleUnionId,
    kind: "singleParent",
    partnerA: activePersonId,
    partnerB: "",
  });

  return Array.from(options.values()).sort((a, b) => {
    const aIsSingle = a.id.startsWith("single:");
    const bIsSingle = b.id.startsWith("single:");
    if (aIsSingle !== bIsSingle) return aIsSingle ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}

function ExistingChildrenSelector({
  options,
  selectedIds,
  onToggle,
  activeName,
  targetName,
}: {
  options: ExistingChildOption[];
  selectedIds: string[];
  onToggle: (childId: string) => void;
  activeName: string;
  targetName: string;
}) {
  if (options.length === 0) return null;

  const eligibleOptions = options.filter((option) => option.eligible);
  const unavailableOptions = options.filter((option) => !option.eligible);

  return (
    <section className="space-y-3 rounded-2xl border border-[#D8A94F]/35 bg-[#FFF8E7] p-4">
      <div>
        <p className="text-sm font-bold text-[#2B2B2B]">
          ¿{targetName} también es progenitor/a de algún hijo existente?
        </p>
        <p className="mt-1 text-xs leading-5 text-[#5B4A20]">
          Selecciona únicamente los hijos de <strong>{activeName}</strong> que
          también correspondan a esta relación. No se asignará ninguno de forma
          automática.
        </p>
      </div>

      {eligibleOptions.length > 0 ? (
        <div className="space-y-2">
          {eligibleOptions.map((option) => {
            const checked = selectedIds.includes(option.id);

            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E5DED4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2F5D50]"
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                />
                <span className="font-semibold">{option.name}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-[#FFFCF7] px-3 py-2 text-xs leading-5 text-slate-600">
          No hay hijos disponibles para vincular en esta operación.
        </p>
      )}

      {unavailableOptions.length > 0 && (
        <div className="space-y-1 border-t border-[#E5DED4] pt-3">
          <p className="text-xs font-bold text-slate-600">
            No disponibles en este paso
          </p>
          {unavailableOptions.map((option) => (
            <p key={option.id} className="text-xs leading-5 text-slate-500">
              <strong>{option.name}:</strong> {option.reason}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function ExistingChildrenParentRoleField({
  value,
  onChange,
}: {
  value: ChildParentRole | "";
  onChange: (value: ChildParentRole | "") => void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      Rol parental de la pareja
      <select
        aria-label="Rol parental de la pareja"
        className="mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as ChildParentRole | "")
        }
      >
        <option value="">Selecciona un rol</option>
        <option value="father">Padre</option>
        <option value="mother">Madre</option>
      </select>
    </label>
  );
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
  const inputClass =
    "w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition placeholder:text-slate-400 focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15";

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          {nameLabel}
        </label>
        <input
          className={inputClass}
          placeholder="Nombre *"
          value={value.firstName}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Segundo nombre
        </label>
        <input
          className={inputClass}
          placeholder="Opcional"
          value={value.middleName ?? ""}
          onChange={(e) => onChange({ ...value, middleName: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Apellido
        </label>
        <input
          className={inputClass}
          placeholder="Apellido *"
          value={value.lastName}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Segundo apellido
        </label>
        <input
          className={inputClass}
          placeholder="Opcional"
          value={value.secondLastName ?? ""}
          onChange={(e) => onChange({ ...value, secondLastName: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Fecha de nacimiento
        </label>
        <input
          className={inputClass}
          type="date"
          title="Fecha de nacimiento opcional"
          value={value.birthDate ?? ""}
          onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Lugar de nacimiento
        </label>
        <input
          className={inputClass}
          placeholder="Opcional"
          value={value.birthPlace ?? ""}
          onChange={(e) => onChange({ ...value, birthPlace: e.target.value })}
        />
      </div>

      <p className="rounded-xl bg-[#F5EFE6] px-3 py-2 text-xs leading-5 text-slate-600">
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
  const [partnerMode, setPartnerMode] = useState<PartnerMode>("new");
  const [existingPartnerId, setExistingPartnerId] = useState("");
  const [partnerRelationshipStatus, setPartnerRelationshipStatus] =
    useState<PartnerRelationshipStatus>("unknown");
  const [childData, setChildData] = useState<PersonPayload>({ ...emptyPerson });
  const [parentData, setParentData] = useState<ParentPayload>({ ...emptyParent });
  const [selectedUnionId, setSelectedUnionId] = useState("");
  const [childParentRoles, setChildParentRoles] =
    useState<Record<string, ChildParentRole | "">>({});
  const [selectedExistingChildIds, setSelectedExistingChildIds] = useState<string[]>([]);
  const [parentRoleForExistingChildren, setParentRoleForExistingChildren] =
    useState<ChildParentRole | "">("");
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

  const selectedChildUnion = useMemo(
    () => childUnionOptions.find((union) => union.id === selectedUnionId) ?? null,
    [childUnionOptions, selectedUnionId]
  );

  const selectedChildParentIds = useMemo(() => {
    if (!selectedChildUnion) return [];
    return selectedChildUnion.partnerB
      ? [selectedChildUnion.partnerA, selectedChildUnion.partnerB]
      : [selectedChildUnion.partnerA];
  }, [selectedChildUnion]);

  const existingPartnerCandidates = useMemo(() => {
    if (!activePersonId) return [];

    return persons
      .filter((person) => {
        if (person.id === activePersonId) return false;

        return !hasPartnerRelationship(
          relationships,
          activePersonId,
          person.id
        );
      })
      .sort((left, right) =>
        personLabel(left).localeCompare(personLabel(right), "es")
      );
  }, [activePersonId, persons, relationships]);

  const existingPartnerName = useMemo(() => {
    if (!existingPartnerId) return null;
    return findPersonName(persons, existingPartnerId);
  }, [existingPartnerId, persons]);

  const existingChildOptions = useMemo(() => {
    if (!activePersonId) return [];
    if (partnerMode === "existing" && !existingPartnerId) return [];

    return buildExistingChildOptions({
      activePersonId,
      targetPartnerId:
        partnerMode === "existing" ? existingPartnerId : null,
      persons,
      relationships,
    });
  }, [
    activePersonId,
    existingPartnerId,
    partnerMode,
    persons,
    relationships,
  ]);

  const toggleExistingChild = (childId: string) => {
    setSelectedExistingChildIds((current) => {
      const next = toggleExistingChildSelection(current, childId);
      if (next.shouldClearParentRole) setParentRoleForExistingChildren("");
      return next.selectedChildIds;
    });
  };

  useEffect(() => {
    setNotice(null);
    setParentPairSuggestion(null);
    setExistingPartnerId("");
    setPartnerRelationshipStatus("unknown");
    setSelectedExistingChildIds([]);
    setParentRoleForExistingChildren("");
    setChildParentRoles({});
  }, [action, activePersonId]);

  useEffect(() => {
    setSelectedExistingChildIds([]);
    setParentRoleForExistingChildren("");
  }, [partnerMode, existingPartnerId]);

  useEffect(() => {
    if (!activePersonId) return;
    const firstOption = childUnionOptions[0]?.id ?? `single:${activePersonId}`;
    setSelectedUnionId(firstOption);
  }, [activePersonId, childUnionOptions]);

  useEffect(() => {
    setChildParentRoles({});
  }, [selectedUnionId]);

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

  const canSavePartner = canSubmitPartnerWithExistingChildren(
    !!activePersonId && isPersonPayloadReady(partnerData),
    selectedExistingChildIds,
    parentRoleForExistingChildren
  );
  const canLinkExistingPartner = canSubmitPartnerWithExistingChildren(
    !!activePersonId &&
    !!existingPartnerId &&
    existingPartnerId !== activePersonId,
    selectedExistingChildIds,
    parentRoleForExistingChildren
  );
  const childParentRolesAreValid =
    selectedChildParentIds.length > 0 &&
    selectedChildParentIds.every((parentId) => {
      const role = childParentRoles[parentId];
      return role === "father" || role === "mother";
    }) &&
    (selectedChildParentIds.length === 1 ||
      childParentRoles[selectedChildParentIds[0]] !==
        childParentRoles[selectedChildParentIds[1]]);
  const canSaveChild =
    !!activePersonId &&
    !!selectedUnionId &&
    isPersonPayloadReady(childData) &&
    childParentRolesAreValid;
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
        relationshipStatus: "unknown",
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
    if (!activePersonId || !canSavePartner) return;

    try {
      setSaving(true);
      setNotice(null);
      const result = await addPartnerToPersonFn({
        treeId,
        personId: activePersonId,
        partnerData,
        relationshipStatus: partnerRelationshipStatus,
        existingChildIds: selectedExistingChildIds,
        ...buildExistingChildrenRolePayload(
          selectedExistingChildIds,
          parentRoleForExistingChildren
        ),
      });
      const response = result.data as { linkedChildIds?: string[] };
      const linkedCount = response.linkedChildIds?.length ?? 0;

      setNotice({
        kind: "success",
        message: `${partnerStatusLabel(partnerRelationshipStatus)} agregada al árbol.${
          linkedCount > 0
            ? ` También se vinculó como progenitor/a de ${linkedCount} hijo${linkedCount === 1 ? "" : "s"} existente${linkedCount === 1 ? "" : "s"}.`
            : ""
        }`,
      });
      setPartnerData({ ...emptyPerson });
      setSelectedExistingChildIds([]);
      setParentRoleForExistingChildren("");
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const linkExistingPartner = async () => {
    if (!activePersonId || !existingPartnerId || !canLinkExistingPartner) return;

    try {
      setSaving(true);
      setNotice(null);

      const result = await createUnionFn({
        treeId,
        personAId: activePersonId,
        personBId: existingPartnerId,
        relationshipStatus: partnerRelationshipStatus,
        childrenOwnerId: activePersonId,
        existingChildIds: selectedExistingChildIds,
        ...buildExistingChildrenRolePayload(
          selectedExistingChildIds,
          parentRoleForExistingChildren
        ),
      });

      const response = result.data as {
        alreadyExisted?: boolean;
        linkedChildIds?: string[];
      };
      const linkedCount = response.linkedChildIds?.length ?? 0;

      setNotice({
        kind: response.alreadyExisted ? "info" : "success",
        message: `${
          response.alreadyExisted
            ? "Estas personas ya estaban relacionadas como pareja."
            : `${activeName} y ${
                existingPartnerName ?? "la persona seleccionada"
              } ahora tienen una relación de pareja.`
        }${
          linkedCount > 0
            ? ` También se vinculó a la nueva pareja como progenitor/a de ${linkedCount} hijo${linkedCount === 1 ? "" : "s"} existente${linkedCount === 1 ? "" : "s"}.`
            : ""
        }`,
      });

      setExistingPartnerId("");
      setSelectedExistingChildIds([]);
      setParentRoleForExistingChildren("");
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: extractFirebaseCallableErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveChild = async () => {
    if (!selectedUnionId || !childParentRolesAreValid) return;

    const parentRoles = Object.fromEntries(
      selectedChildParentIds.map((parentId) => [
        parentId,
        childParentRoles[parentId],
      ])
    ) as Record<string, ChildParentRole>;

    try {
      setSaving(true);
      setNotice(null);
      await addChildToUnionFn({
        treeId,
        unionId: selectedUnionId,
        childData,
        parentRoles,
      });
      setNotice({ kind: "success", message: "Hijo/a agregado al árbol." });
      setChildData({ ...emptyPerson });
      setChildParentRoles({});
    } catch (err: unknown) {
      setNotice({ kind: "error", message: extractFirebaseCallableErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#F5EFE6] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2F5D50]">
          Persona seleccionada
        </p>

        <label className="mt-2 block">
          <span className="sr-only">Selecciona una persona</span>
          <select
            className="w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm font-semibold text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
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

        <p className="mt-2 text-xs leading-5 text-slate-600">
          Las siguientes acciones se aplicarán sobre{" "}
          <strong className="text-[#2F5D50]">{activeName}</strong>.
        </p>
      </section>

      {notice && (
        <div
          className={`rounded-xl border px-3 py-3 text-sm leading-5 ${noticeClasses(notice.kind)}`}
          role="status"
        >
          {notice.message}
        </div>
      )}

      {parentPairSuggestion && (
        <div className="space-y-3 rounded-2xl border border-[#D8A94F]/40 bg-[#FFF8E7] p-4 text-sm text-[#5B4A20]">
          <div>
            <p className="font-bold">
              Ya agregaste padre y madre para {parentPairSuggestion.childName}.
            </p>
            <p className="mt-1 leading-5">
              ¿Quieres conectar a {parentPairSuggestion.fatherName} y{" "}
              {parentPairSuggestion.motherName} como pareja para que el árbol se
              vea más completo?
            </p>
            <p className="mt-1 text-xs">Puedes cambiar esto después.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl bg-[#2F5D50] px-3 py-2.5 font-bold text-white transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              onClick={connectSuggestedParents}
            >
              Conectarlos
            </button>

            <button
              type="button"
              className="rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 font-bold text-slate-700 transition hover:bg-white"
              onClick={() => setParentPairSuggestion(null)}
            >
              No por ahora
            </button>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3">
          <p className="text-sm font-bold text-[#2B2B2B]">
            ¿Qué familiar quieres agregar?
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Elige una relación para mostrar el formulario correspondiente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["father", "Agregar padre"],
              ["mother", "Agregar madre"],
              ["partner", "Agregar pareja"],
              ["child", "Agregar hijo/a"],
            ] as Array<[QuickAction, string]>
          ).map(([value, label]) => {
            const isActive = action === value;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#2F5D50] bg-[#2F5D50] text-white shadow-sm"
                    : "border-[#D8D0C4] bg-[#FFFCF7] text-slate-700 hover:border-[#2F5D50]/50 hover:bg-white"
                }`}
                onClick={() => setAction(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {!activePersonId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Selecciona una persona para agregar familiares.
        </div>
      )}

      {(action === "father" || action === "mother") && (
        <section className="space-y-4 border-t border-[#E5DED4] pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97C5D]">
              Nueva relación
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#2B2B2B]">
              {action === "father" ? "Agregar padre" : "Agregar madre"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Se conectará como {action === "father" ? "padre" : "madre"} de{" "}
              <strong>{activeName}</strong>.
            </p>
          </div>

          <PersonFields
            value={parentData}
            onChange={(next) =>
              setParentData({ ...next, soltero: parentData.soltero })
            }
            nameLabel={
              action === "father" ? "Nombre del padre" : "Nombre de la madre"
            }
          />

          <button
            type="button"
            className="w-full rounded-xl bg-[#2F5D50] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !canSaveParent}
            onClick={() =>
              saveParent(action === "father" ? "father" : "mother")
            }
          >
            {saving
              ? "Guardando..."
              : action === "father"
                ? "Guardar padre"
                : "Guardar madre"}
          </button>
        </section>
      )}

      {action === "partner" && (
        <section className="space-y-4 border-t border-[#E5DED4] pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97C5D]">
              Relación de pareja
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#2B2B2B]">
              Agregar o relacionar pareja
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Puedes crear una persona nueva o relacionar a{" "}
              <strong>{activeName}</strong> con alguien que ya existe en el árbol.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5EFE6] p-1">
            <button
              type="button"
              aria-pressed={partnerMode === "new"}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                partnerMode === "new"
                  ? "bg-white text-[#2F5D50] shadow-sm"
                  : "text-slate-600 hover:text-[#2B2B2B]"
              }`}
              onClick={() => setPartnerMode("new")}
            >
              Crear persona
            </button>

            <button
              type="button"
              aria-pressed={partnerMode === "existing"}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                partnerMode === "existing"
                  ? "bg-white text-[#2F5D50] shadow-sm"
                  : "text-slate-600 hover:text-[#2B2B2B]"
              }`}
              onClick={() => setPartnerMode("existing")}
            >
              Usar existente
            </button>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Estado de la relación
            <select
              className="mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
              value={partnerRelationshipStatus}
              onChange={(event) =>
                setPartnerRelationshipStatus(
                  event.target.value as PartnerRelationshipStatus
                )
              }
            >
              <option value="current">Pareja actual</option>
              <option value="former">Expareja</option>
              <option value="unknown">Sin especificar</option>
            </select>
          </label>

          {partnerMode === "new" ? (
            <>
              <PersonFields
                value={partnerData}
                onChange={setPartnerData}
                nameLabel="Nombre de la pareja"
              />

              <ExistingChildrenSelector
                options={existingChildOptions}
                selectedIds={selectedExistingChildIds}
                onToggle={toggleExistingChild}
                activeName={activeName}
                targetName="La nueva pareja"
              />

              {selectedExistingChildIds.length > 0 && (
                <ExistingChildrenParentRoleField
                  value={parentRoleForExistingChildren}
                  onChange={setParentRoleForExistingChildren}
                />
              )}

              <button
                type="button"
                className="w-full rounded-xl bg-[#2F5D50] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canSavePartner}
                onClick={savePartner}
              >
                {saving ? "Guardando..." : "Crear y relacionar pareja"}
              </button>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-slate-600">
                Persona existente
                <select
                  className="mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
                  value={existingPartnerId}
                  onChange={(event) =>
                    setExistingPartnerId(event.target.value)
                  }
                >
                  <option value="">Selecciona una persona</option>
                  {existingPartnerCandidates.map((person) => (
                    <option key={person.id} value={person.id}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
              </label>

              {existingPartnerCandidates.length === 0 && (
                <p className="rounded-xl bg-[#F5EFE6] px-3 py-2 text-xs leading-5 text-slate-600">
                  No hay otras personas disponibles para crear una nueva relación
                  de pareja con {activeName}.
                </p>
              )}

              {existingPartnerId && (
                <ExistingChildrenSelector
                  options={existingChildOptions}
                  selectedIds={selectedExistingChildIds}
                  onToggle={toggleExistingChild}
                  activeName={activeName}
                  targetName={existingPartnerName ?? "La persona seleccionada"}
                />
              )}

              {selectedExistingChildIds.length > 0 && (
                <ExistingChildrenParentRoleField
                  value={parentRoleForExistingChildren}
                  onChange={setParentRoleForExistingChildren}
                />
              )}

              <button
                type="button"
                className="w-full rounded-xl bg-[#2F5D50] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canLinkExistingPartner}
                onClick={linkExistingPartner}
              >
                {saving ? "Relacionando..." : "Relacionar personas"}
              </button>
            </>
          )}
        </section>
      )}

      {action === "child" && (
        <section className="space-y-4 border-t border-[#E5DED4] pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97C5D]">
              Nueva relación
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#2B2B2B]">
              Agregar hijo/a
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Puedes conectarlo con una pareja o solo como hijo/a de{" "}
              <strong>{activeName}</strong>.
            </p>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Conexión familiar
            <select
              className="mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
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

          <section className="space-y-3 rounded-2xl border border-[#D8A94F]/35 bg-[#FFF8E7] p-4">
            <div>
              <p className="text-sm font-bold text-[#2B2B2B]">
                Rol de cada progenitor para este hijo
              </p>
              <p className="mt-1 text-xs leading-5 text-[#5B4A20]">
                Selecciona el rol familiar de cada persona. Ningún rol se
                asigna automáticamente.
              </p>
            </div>

            {selectedChildParentIds.map((parentId) => (
              <label
                key={parentId}
                className="block text-xs font-semibold text-slate-600"
              >
                {findPersonName(persons, parentId) ?? "Progenitor/a"}
                <select
                  className="mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15"
                  value={childParentRoles[parentId] ?? ""}
                  onChange={(event) => {
                    const role = event.target.value as ChildParentRole | "";
                    setChildParentRoles((current) => ({
                      ...current,
                      [parentId]: role,
                    }));
                  }}
                >
                  <option value="">Selecciona un rol</option>
                  <option value="father">Padre</option>
                  <option value="mother">Madre</option>
                </select>
              </label>
            ))}

            {selectedChildParentIds.length === 2 &&
              selectedChildParentIds.every(
                (parentId) => childParentRoles[parentId]
              ) &&
              childParentRoles[selectedChildParentIds[0]] ===
                childParentRoles[selectedChildParentIds[1]] && (
                <p className="text-xs font-semibold text-red-700">
                  Debes seleccionar un Padre y una Madre.
                </p>
              )}
          </section>

          <PersonFields
            value={childData}
            onChange={setChildData}
            nameLabel="Nombre del hijo/a"
          />

          <button
            type="button"
            className="w-full rounded-xl bg-[#2F5D50] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
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
