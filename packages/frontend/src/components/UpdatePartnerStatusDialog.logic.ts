import type {
  PartnerRelationshipStatus,
  Person,
  Relationship,
} from "../types/family";

export type UpdatePartnerStatusPayload = {
  treeId: string;
  relationshipId: string;
  relationshipStatus: PartnerRelationshipStatus;
  expectedRelationshipStatus: PartnerRelationshipStatus;
};

export type UpdatePartnerStatusCall = (
  payload: UpdatePartnerStatusPayload
) => Promise<unknown>;

export type UpdatePartnerStatusTarget = {
  relationshipId: string;
  activePersonId: string;
  activePersonName: string;
  otherPersonId: string;
  otherPersonName: string;
  expectedRelationshipStatus: PartnerRelationshipStatus;
};

export const partnerStatusOptions: ReadonlyArray<{
  value: PartnerRelationshipStatus;
  label: string;
}> = [
  {value: "current", label: "Actual"},
  {value: "former", label: "Anterior"},
  {value: "unknown", label: "Estado desconocido"},
];

function personName(person: Person | undefined): string {
  if (!person) return "Persona no disponible";
  return [
    person.firstName,
    person.middleName,
    person.lastName,
    person.secondLastName,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() ||
    "Persona no disponible";
}

export function normalizePartnerStatus(
  value: unknown
): PartnerRelationshipStatus | null {
  if (value === undefined || value === "unknown") return "unknown";
  if (value === "current" || value === "former") return value;
  return null;
}

export function partnerStatusLabel(
  value: PartnerRelationshipStatus
): string {
  return partnerStatusOptions.find((option) => option.value === value)?.label ??
    "Estado desconocido";
}

export function buildUpdatePartnerStatusTarget({
  relationship,
  activePerson,
  persons,
}: {
  relationship: Relationship;
  activePerson: Person;
  persons: readonly Person[];
}): UpdatePartnerStatusTarget | null {
  if (relationship.type !== "PARTNER_OF") return null;
  const expectedRelationshipStatus = normalizePartnerStatus(
    relationship.relationshipStatus
  );
  if (!expectedRelationshipStatus) return null;
  const otherPersonId = relationship.fromPersonId === activePerson.id ?
    relationship.toPersonId : relationship.fromPersonId;
  return {
    relationshipId: relationship.id,
    activePersonId: activePerson.id,
    activePersonName: personName(activePerson),
    otherPersonId,
    otherPersonName: personName(
      persons.find((person) => person.id === otherPersonId)
    ),
    expectedRelationshipStatus,
  };
}

export function canSubmitPartnerStatus(
  target: UpdatePartnerStatusTarget,
  selectedStatus: PartnerRelationshipStatus
): boolean {
  return selectedStatus !== target.expectedRelationshipStatus;
}

export function buildUpdatePartnerStatusPayload({
  treeId,
  target,
  relationshipStatus,
}: {
  treeId: string;
  target: UpdatePartnerStatusTarget;
  relationshipStatus: PartnerRelationshipStatus;
}): UpdatePartnerStatusPayload {
  return {
    treeId,
    relationshipId: target.relationshipId,
    relationshipStatus,
    expectedRelationshipStatus: target.expectedRelationshipStatus,
  };
}

function callableErrorData(error: unknown): {code: string; reason: string} {
  if (typeof error !== "object" || error === null) {
    return {code: "", reason: ""};
  }
  const code = "code" in error ?
    String(error.code).replace(/^functions\//, "") : "";
  const details = "details" in error ? error.details : null;
  const reason = typeof details === "object" && details !== null &&
    "reason" in details ? String(details.reason) : "";
  return {code, reason};
}

export function updatePartnerStatusErrorMessage(error: unknown): string {
  const {code, reason} = callableErrorData(error);
  if (code === "unauthenticated") {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (code === "invalid-argument") {
    if (reason === "invalid-relationship-status") {
      return "Selecciona un estado de relación válido.";
    }
    if (reason === "invalid-expected-relationship-status") {
      return "El estado original de la relación no es válido. Cierra y vuelve a abrir esta edición.";
    }
    return "No pudimos identificar correctamente la relación.";
  }
  if (code === "not-found") {
    if (reason === "tree-not-found") return "El árbol ya no existe.";
    if (reason === "relationship-not-found") {
      return "Esta relación de pareja ya no existe.";
    }
  }
  if (code === "permission-denied" && reason === "not-tree-owner") {
    return "No tienes permiso para modificar este árbol.";
  }
  const preconditionMessages: Record<string, string> = {
    "relationship-not-partner":
      "La relación seleccionada ya no es una relación de pareja válida.",
    "inconsistent-tree-data":
      "No podemos cambiar este estado porque el árbol contiene datos inconsistentes.",
    "duplicate-partner-link":
      "Esta relación de pareja está duplicada y debe corregirse antes de cambiar su estado.",
    "relationship-status-changed":
      "La relación cambió en otra sesión. Revisa el estado actual antes de intentarlo nuevamente.",
  };
  if (code === "failed-precondition" && preconditionMessages[reason]) {
    return preconditionMessages[reason];
  }
  return "No pudimos cambiar el estado de la relación. Inténtalo nuevamente.";
}

export async function submitUpdatePartnerStatus({
  call,
  payload,
  onSuccess,
}: {
  call: UpdatePartnerStatusCall;
  payload: UpdatePartnerStatusPayload;
  onSuccess: () => void;
}): Promise<void> {
  await call(payload);
  onSuccess();
}
