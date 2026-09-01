import type {Person, Relationship} from "../types/family";

export type DeleteRelationshipPayload = {
  treeId: string;
  relationshipId: string;
};

export type DeleteRelationshipCall = (
  payload: DeleteRelationshipPayload
) => Promise<unknown>;

export type RelationshipPresentation = {
  relationshipId: string;
  type: Relationship["type"];
  label: string;
  statusLabel?: string;
  title: string;
  parentName?: string;
  childName?: string;
  partnerAName?: string;
  partnerBName?: string;
};

function personName(person: Person | undefined): string {
  if (!person) return "Persona no disponible";
  const label = [
    person.firstName,
    person.middleName,
    person.lastName,
    person.secondLastName,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return label || "Persona no disponible";
}

function partnerStatusLabel(status: Relationship["relationshipStatus"]): string {
  if (status === "current") return "Actual";
  if (status === "former") return "Anterior";
  return "Estado desconocido";
}

function relationshipGroup(
  relationship: Relationship,
  activePersonId: string
): number {
  if (
    relationship.type === "PARENT_OF" &&
    relationship.toPersonId === activePersonId
  ) return 0;
  if (relationship.type === "PARTNER_OF") return 1;
  return 2;
}

export function buildIncidentRelationshipPresentations(
  activePerson: Person,
  persons: readonly Person[],
  relationships: readonly Relationship[]
): RelationshipPresentation[] {
  const personsById = new Map(persons.map((person) => [person.id, person]));

  return relationships
    .map((relationship, snapshotIndex) => ({relationship, snapshotIndex}))
    .filter(({relationship}) =>
      relationship.fromPersonId === activePerson.id ||
      relationship.toPersonId === activePerson.id
    )
    .sort((left, right) =>
      relationshipGroup(left.relationship, activePerson.id) -
        relationshipGroup(right.relationship, activePerson.id) ||
      left.snapshotIndex - right.snapshotIndex
    )
    .map(({relationship}) => {
      const fromName = personName(personsById.get(relationship.fromPersonId));
      const toName = personName(personsById.get(relationship.toPersonId));

      if (relationship.type === "PARTNER_OF") {
        const otherPersonId = relationship.fromPersonId === activePerson.id ?
          relationship.toPersonId : relationship.fromPersonId;
        const otherName = personName(personsById.get(otherPersonId));
        return {
          relationshipId: relationship.id,
          type: relationship.type,
          label: `Pareja de ${otherName}`,
          statusLabel: partnerStatusLabel(relationship.relationshipStatus),
          title: `¿Quitar la relación de pareja entre ${fromName} y ${toName}?`,
          partnerAName: fromName,
          partnerBName: toName,
        };
      }

      const activeIsParent = relationship.fromPersonId === activePerson.id;
      const role = relationship.parentRole;
      let label: string;
      if (activeIsParent) {
        const prefix = role === "father" ? "Padre" :
          role === "mother" ? "Madre" : "Progenitor";
        label = `${prefix} de ${toName}`;
      } else {
        label = `Hijo/a de ${fromName}`;
      }

      const title = role === "father" ?
        `¿Quitar a ${fromName} como padre de ${toName}?` :
        role === "mother" ?
          `¿Quitar a ${fromName} como madre de ${toName}?` :
          `¿Quitar la relación parental entre ${fromName} y ${toName}?`;

      return {
        relationshipId: relationship.id,
        type: relationship.type,
        label,
        title,
        parentName: fromName,
        childName: toName,
      };
    });
}

export function buildDeleteRelationshipPayload(
  treeId: string,
  relationshipId: string
): DeleteRelationshipPayload {
  return {treeId, relationshipId};
}

function callableErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ?
    String(error.code).replace(/^functions\//, "") : "";
}

function callableErrorReason(error: unknown): string {
  if (
    typeof error !== "object" || error === null || !("details" in error) ||
    typeof error.details !== "object" || error.details === null ||
    !("reason" in error.details)
  ) return "";
  return String(error.details.reason);
}

export function deleteRelationshipErrorMessage(error: unknown): string {
  const code = callableErrorCode(error);
  const reason = callableErrorReason(error);
  if (code === "unauthenticated") {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (code === "invalid-argument") {
    return "No pudimos identificar correctamente la relación.";
  }
  if (code === "permission-denied") {
    return "No tienes permiso para modificar esta relación.";
  }
  if (code === "not-found" && reason === "relationship-not-found") {
    return "Esta relación ya no existe.";
  }
  if (code === "not-found" && reason === "tree-not-found") {
    return "El árbol ya no existe.";
  }
  if (code === "failed-precondition" && reason === "inconsistent-tree-data") {
    return "No podemos quitar esta relación porque contiene datos inconsistentes.";
  }
  return "No pudimos quitar la relación. Inténtalo nuevamente.";
}

export async function submitDeleteRelationship({
  call,
  treeId,
  relationshipId,
  onSuccess,
}: {
  call: DeleteRelationshipCall;
  treeId: string;
  relationshipId: string;
  onSuccess: () => void;
}): Promise<void> {
  await call(buildDeleteRelationshipPayload(treeId, relationshipId));
  onSuccess();
}
