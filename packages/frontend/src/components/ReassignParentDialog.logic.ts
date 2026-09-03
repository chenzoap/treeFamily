import type {ParentRole, Person, Relationship} from "../types/family";

export type ReassignParentPayload = {
  treeId: string;
  relationshipId: string;
  newParentPersonId: string;
  parentRole?: ParentRole;
};

export type ReassignParentCall = (
  payload: ReassignParentPayload
) => Promise<unknown>;

export type ParentCandidate = {id: string; name: string};

export type ReassignParentTarget = {
  relationshipId: string;
  childPersonId: string;
  childName: string;
  oldParentPersonId: string;
  oldParentName: string;
  parentRole?: ParentRole;
  candidates: ParentCandidate[];
};

function fullName(person: Person | undefined): string {
  if (!person) return "Persona no disponible";
  return [
    person.firstName,
    person.middleName,
    person.lastName,
    person.secondLastName,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() ||
    "Persona no disponible";
}

export function buildReassignParentTarget({
  relationship,
  persons,
  relationships,
}: {
  relationship: Relationship;
  persons: readonly Person[];
  relationships: readonly Relationship[];
}): ReassignParentTarget {
  const currentParentIds = new Set(
    relationships
      .filter((candidate) =>
        candidate.type === "PARENT_OF" &&
        candidate.toPersonId === relationship.toPersonId
      )
      .map((candidate) => candidate.fromPersonId)
  );
  const candidates = persons
    .filter((person) =>
      person.id !== relationship.toPersonId &&
      person.id !== relationship.fromPersonId &&
      !currentParentIds.has(person.id)
    )
    .map((person) => ({id: person.id, name: fullName(person)}))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  return {
    relationshipId: relationship.id,
    childPersonId: relationship.toPersonId,
    childName: fullName(
      persons.find((person) => person.id === relationship.toPersonId)
    ),
    oldParentPersonId: relationship.fromPersonId,
    oldParentName: fullName(
      persons.find((person) => person.id === relationship.fromPersonId)
    ),
    ...(relationship.parentRole ? {parentRole: relationship.parentRole} : {}),
    candidates,
  };
}

export function buildReassignParentPayload({
  treeId,
  target,
  newParentPersonId,
  selectedParentRole,
}: {
  treeId: string;
  target: ReassignParentTarget;
  newParentPersonId: string;
  selectedParentRole?: ParentRole;
}): ReassignParentPayload {
  return {
    treeId,
    relationshipId: target.relationshipId,
    newParentPersonId,
    ...(target.parentRole ? {} : {parentRole: selectedParentRole}),
  };
}

export function canSubmitReassignment(
  target: ReassignParentTarget,
  newParentPersonId: string,
  selectedParentRole?: ParentRole
): boolean {
  return Boolean(
    newParentPersonId &&
    (target.parentRole || selectedParentRole === "father" ||
      selectedParentRole === "mother")
  );
}

export function reassignParentTitle(
  target: ReassignParentTarget,
  newParentPersonId: string,
  selectedParentRole?: ParentRole
): string {
  const candidate = target.candidates.find(
    (person) => person.id === newParentPersonId
  );
  const role = target.parentRole ?? selectedParentRole;
  if (!candidate || !role) return `Cambiar progenitor de ${target.childName}`;
  return `¿Cambiar a ${target.oldParentName} por ${candidate.name} como ${
    role === "father" ? "padre" : "madre"
  } de ${target.childName}?`;
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

export function reassignParentErrorMessage(error: unknown): string {
  const {code, reason} = callableErrorData(error);
  if (code === "unauthenticated") {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (code === "invalid-argument") {
    if (reason === "invalid-parent-role") {
      return "Selecciona un rol parental válido.";
    }
    if (reason === "unexpected-parent-role") {
      return "El rol de esta relación cambió. Actualiza la vista e inténtalo nuevamente.";
    }
    return "No pudimos identificar correctamente los datos de la reasignación.";
  }
  if (code === "not-found") {
    if (reason === "tree-not-found") return "El árbol ya no existe.";
    if (reason === "relationship-not-found") {
      return "Esta relación parental ya no existe.";
    }
    if (reason === "new-parent-not-found") {
      return "La persona seleccionada como nuevo progenitor ya no existe.";
    }
  }
  if (code === "permission-denied" && reason === "not-tree-owner") {
    return "No tienes permiso para modificar este árbol.";
  }
  const preconditionMessages: Record<string, string> = {
    "relationship-not-parent":
      "La relación seleccionada ya no es una filiación parental válida.",
    "inconsistent-tree-data":
      "No podemos cambiar este progenitor porque el árbol contiene datos inconsistentes.",
    "same-parent": "Selecciona una persona diferente al progenitor actual.",
    "self-parent": "Una persona no puede ser su propio progenitor.",
    "duplicate-parent-link":
      "La persona seleccionada ya es progenitor de este hijo.",
    "duplicate-existing-parent-link":
      "La filiación actual está duplicada y debe corregirse antes de reasignarla.",
    "invalid-existing-parent-state":
      "Las relaciones parentales actuales deben corregirse antes de realizar esta reasignación.",
    "parent-role-occupied":
      "Ese rol parental ya está ocupado por otro progenitor.",
    "existing-parent-role-unknown":
      "No podemos determinar de forma segura el rol del otro progenitor.",
    "cycle-detected":
      "Este cambio crearía un ciclo familiar y no puede realizarse.",
  };
  if (code === "failed-precondition" && preconditionMessages[reason]) {
    return preconditionMessages[reason];
  }
  return "No pudimos cambiar el progenitor. Inténtalo nuevamente.";
}

export async function submitReassignParent({
  call,
  payload,
  onSuccess,
}: {
  call: ReassignParentCall;
  payload: ReassignParentPayload;
  onSuccess: () => void;
}): Promise<void> {
  await call(payload);
  onSuccess();
}
