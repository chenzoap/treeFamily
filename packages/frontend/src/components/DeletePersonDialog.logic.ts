import type { Relationship } from "../types/family";

export type DeletePersonPayload = {
  treeId: string;
  personId: string;
};

export type DeletePersonCall = (
  payload: DeletePersonPayload
) => Promise<unknown>;

export type DeleteSubmissionGate = {current: boolean};

export function startDeleteSubmission(gate: DeleteSubmissionGate): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function finishDeleteSubmission(gate: DeleteSubmissionGate): void {
  gate.current = false;
}

export function buildDeletePersonPayload(
  treeId: string,
  personId: string
): DeletePersonPayload {
  return {treeId, personId};
}

export function countIncidentRelationships(
  relationships: readonly Relationship[],
  personId: string
): number {
  return relationships.filter(
    (relationship) =>
      relationship.fromPersonId === personId ||
      relationship.toPersonId === personId
  ).length;
}

function callableErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ?
    String(error.code).replace(/^functions\//, "") :
    "";
}

function callableErrorReason(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("details" in error) ||
    typeof error.details !== "object" ||
    error.details === null ||
    !("reason" in error.details)
  ) {
    return "";
  }

  return String(error.details.reason);
}

export function deletePersonErrorMessage(error: unknown): string {
  const code = callableErrorCode(error);
  const reason = callableErrorReason(error);

  if (code === "unauthenticated") {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (code === "invalid-argument") {
    return "No pudimos identificar correctamente la persona.";
  }
  if (code === "permission-denied") {
    return "No tienes permiso para eliminar esta persona.";
  }
  if (code === "not-found" && reason === "person-not-found") {
    return "La persona ya no existe.";
  }
  if (code === "not-found" && reason === "tree-not-found") {
    return "El árbol ya no existe.";
  }
  if (code === "failed-precondition" && reason === "root-person-protected") {
    return "La persona principal del árbol no puede eliminarse.";
  }
  if (code === "failed-precondition" && reason === "last-person-protected") {
    return "No puedes eliminar la última persona del árbol.";
  }
  if (code === "failed-precondition" && reason === "inconsistent-tree-data") {
    return "No podemos eliminar esta persona porque el árbol contiene datos inconsistentes.";
  }
  if (
    code === "resource-exhausted" &&
    reason === "too-many-incident-relationships"
  ) {
    return "Esta persona tiene demasiadas conexiones para eliminarla desde esta operación.";
  }
  return "No pudimos eliminar la persona. Inténtalo nuevamente.";
}

export async function submitDeletePerson({
  call,
  treeId,
  personId,
  onSuccess,
}: {
  call: DeletePersonCall;
  treeId: string;
  personId: string;
  onSuccess: () => void;
}): Promise<void> {
  await call(buildDeletePersonPayload(treeId, personId));
  onSuccess();
}
