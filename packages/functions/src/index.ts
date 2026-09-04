import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  normalizeParentRole,
  hasDirectedParentPath,
  validateNewParentLink,
  validateNewChildForExistingUnion,
  type ExistingParentLink,
  type ExistingSharedChildParentLink,
  type NewChildUnionValidationResult,
  type ParentLinkRejectionCode,
  type ParentRole,
} from "./parentRelationshipPolicy.js";


if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

const MAX_DELETE_PERSON_INCIDENT_RELATIONSHIPS = 400;

/* eslint-disable require-jsdoc */
// === Helpers Etapa 4 ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertAuth(request: any) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  return request.auth.uid as string;
}

async function assertIsOwner(treeId: string, uid: string) {
  const treeDoc = await db.collection("trees").doc(treeId).get();
  if (!treeDoc.exists || treeDoc.data()?.ownerId !== uid) {
    throw new HttpsError("permission-denied", "No tienes permiso sobre este árbol.");
  }
}

function canonPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

type PartnerRelationshipStatus = "current" | "former" | "unknown";

function normalizePartnerRelationshipStatus(
  value: unknown
): PartnerRelationshipStatus {
  if (value === "current" || value === "former" || value === "unknown") {
    return value;
  }

  throw new HttpsError(
    "invalid-argument",
    "El estado de la relación de pareja no es válido."
  );
}

function parseUnionId(unionId: string): { kind: "union"; a: string; b: string } | { kind: "single"; a: string } {
  // union:${a}:${b} o single:${a}
  if (unionId.startsWith("union:")) {
    const parts = unionId.split(":");
    if (parts.length !== 3) throw new HttpsError("invalid-argument", "unionId inválido");
    return { kind: "union", a: parts[1], b: parts[2] };
  }
  if (unionId.startsWith("single:")) {
    const parts = unionId.split(":");
    if (parts.length !== 2) throw new HttpsError("invalid-argument", "unionId inválido");
    return { kind: "single", a: parts[1] };
  }
  throw new HttpsError("invalid-argument", "unionId inválido");
}

function throwNewChildUnionValidationError(
  result: Extract<NewChildUnionValidationResult, { ok: false }>
): never {
  const details = {
    policyCode: result.code,
    ...(result.roleErrorCode ? { roleErrorCode: result.roleErrorCode } : {}),
  };

  if (
    result.code === "invalid-parent-count" ||
    result.code === "duplicate-parent-id" ||
    result.code === "invalid-parent-role-assignment"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Los roles parentales no son válidos.",
      details
    );
  }

  if (result.code === "existing-pair-not-found") {
    throw new HttpsError(
      "failed-precondition",
      "La unión seleccionada ya no existe o cambió.",
      details
    );
  }

  if (result.code === "parent-role-conflict") {
    throw new HttpsError(
      "failed-precondition",
      "Los roles seleccionados contradicen la información familiar existente.",
      details
    );
  }

  throw new HttpsError(
    "failed-precondition",
    "La información parental existente debe corregirse antes de agregar otro hijo.",
    details
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdList(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} debe ser una lista de IDs.`
    );
  }

  const ids = Array.from(
    new Set(
      value
        .map((item) => cleanString(item))
        .filter((item) => item.length > 0)
    )
  );

  if (ids.length > 40) {
    throw new HttpsError(
      "invalid-argument",
      "No puedes vincular más de 40 hijos en una sola operación."
    );
  }

  return ids;
}

type ExistingChildLinkPlan = {
  childIdsToLink: string[];
  alreadyLinkedChildIds: string[];
};

function throwExistingChildLinkValidationError(
  code: ParentLinkRejectionCode
): never {
  throw new HttpsError(
    "failed-precondition",
    "No se puede vincular uno de los hijos seleccionados con ese rol parental.",
    { reason: code }
  );
}

async function planExistingChildLinks({
  tx,
  personsCol,
  relsCol,
  sourceParentId,
  targetParentId,
  childIds,
  parentRole,
}: {
  tx: FirebaseFirestore.Transaction;
  personsCol: FirebaseFirestore.CollectionReference;
  relsCol: FirebaseFirestore.CollectionReference;
  sourceParentId: string;
  targetParentId: string;
  childIds: string[];
  parentRole: ParentRole;
}): Promise<ExistingChildLinkPlan> {
  if (childIds.length === 0) {
    return { childIdsToLink: [], alreadyLinkedChildIds: [] };
  }

  const childRefs = childIds.map((childId) => personsCol.doc(childId));
  const childSnaps = await Promise.all(
    childRefs.map((childRef) => tx.get(childRef))
  );
  const relationshipSnaps = await Promise.all(
    childIds.map((childId) =>
      tx.get(relsCol.where("toPersonId", "==", childId))
    )
  );
  const allParentRelationshipsSnap = await tx.get(
    relsCol.where("type", "==", "PARENT_OF")
  );
  const allParentLinks: ExistingParentLink[] =
    allParentRelationshipsSnap.docs.flatMap((relationshipDoc) => {
      const relationship = relationshipDoc.data();
      if (
        typeof relationship.fromPersonId !== "string" ||
        typeof relationship.toPersonId !== "string"
      ) {
        return [];
      }

      const storedParentRole = normalizeParentRole(relationship.parentRole);
      return [{
        parentId: relationship.fromPersonId,
        childId: relationship.toPersonId,
        ...(storedParentRole ? { parentRole: storedParentRole } : {}),
      }];
    });

  const childIdsToLink: string[] = [];
  const alreadyLinkedChildIds: string[] = [];

  childIds.forEach((childId, index) => {
    if (!childSnaps[index].exists) {
      throw new HttpsError(
        "not-found",
        "Uno de los hijos seleccionados ya no existe."
      );
    }

    const existingParentLinks: ExistingParentLink[] = [];

    relationshipSnaps[index].docs.forEach((relationshipDoc) => {
      const relationship = relationshipDoc.data();

      if (
        relationship.type === "PARENT_OF" &&
        typeof relationship.fromPersonId === "string"
      ) {
        const storedParentRole = normalizeParentRole(relationship.parentRole);
        existingParentLinks.push({
          parentId: relationship.fromPersonId,
          childId,
          ...(storedParentRole ? { parentRole: storedParentRole } : {}),
        });
      }
    });

    const parentIds = new Set(
      existingParentLinks.map((relationship) => relationship.parentId)
    );

    if (!parentIds.has(sourceParentId)) {
      throw new HttpsError(
        "failed-precondition",
        "Uno de los hijos seleccionados no pertenece a la persona activa."
      );
    }

    if (parentIds.has(targetParentId)) {
      const existingTargetLink = existingParentLinks.find(
        (relationship) => relationship.parentId === targetParentId
      );
      if (existingTargetLink?.parentRole !== parentRole) {
        throwExistingChildLinkValidationError(
          existingTargetLink?.parentRole ?
            "parent-role-occupied" :
            "existing-parent-role-unknown"
        );
      }
      alreadyLinkedChildIds.push(childId);
      return;
    }

    const validation = validateNewParentLink({
      parentId: targetParentId,
      childId,
      parentRole,
      existingParentLinks,
      allParentLinks,
    });
    if (!validation.ok) {
      throwExistingChildLinkValidationError(validation.code);
    }

    childIdsToLink.push(childId);
  });

  return { childIdsToLink, alreadyLinkedChildIds };
}

function assertRequiredString(value: unknown, message: string): string {
  const cleaned = cleanString(value);
  if (!cleaned) throw new HttpsError("invalid-argument", message);
  return cleaned;
}

function assertDeletePersonId(
  value: unknown,
  fieldName: "treeId" | "personId"
): string {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} no es válido.`,
      {reason: `invalid-${fieldName === "treeId" ? "tree" : "person"}-id`}
    );
  }

  const normalized = value.trim();
  if (!normalized || normalized.includes("/")) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} no es válido.`,
      {reason: `invalid-${fieldName === "treeId" ? "tree" : "person"}-id`}
    );
  }

  return normalized;
}

function assertDeleteRelationshipId(
  value: unknown,
  fieldName: "treeId" | "relationshipId"
): string {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} no es válido.`,
      {reason: `invalid-${fieldName === "treeId" ? "tree" : "relationship"}-id`}
    );
  }

  const normalized = value.trim();
  if (!normalized || normalized.includes("/")) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} no es válido.`,
      {reason: `invalid-${fieldName === "treeId" ? "tree" : "relationship"}-id`}
    );
  }

  return normalized;
}

function assertReassignParentId(
  value: unknown,
  fieldName: "treeId" | "relationshipId" | "newParentPersonId"
): string {
  const reasonByField = {
    treeId: "invalid-tree-id",
    relationshipId: "invalid-relationship-id",
    newParentPersonId: "invalid-new-parent-id",
  } as const;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} no es válido.`, {
      reason: reasonByField[fieldName],
    });
  }
  const normalized = value.trim();
  if (!normalized || normalized.includes("/")) {
    throw new HttpsError("invalid-argument", `${fieldName} no es válido.`, {
      reason: reasonByField[fieldName],
    });
  }
  return normalized;
}

function assertPartnerStatusId(
  value: unknown,
  fieldName: "treeId" | "relationshipId"
): string {
  const reason = fieldName === "treeId" ?
    "invalid-tree-id" : "invalid-relationship-id";
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} no es válido.`, {
      reason,
    });
  }
  const normalized = value.trim();
  if (!normalized || normalized.includes("/")) {
    throw new HttpsError("invalid-argument", `${fieldName} no es válido.`, {
      reason,
    });
  }
  return normalized;
}

function assertPartnerStatus(
  value: unknown,
  reason: "invalid-relationship-status" |
    "invalid-expected-relationship-status"
): PartnerRelationshipStatus {
  if (value !== "current" && value !== "former" && value !== "unknown") {
    throw new HttpsError(
      "invalid-argument",
      "El estado de la relación de pareja no es válido.",
      {reason}
    );
  }
  return value;
}

function normalizePersonPayload(personData: PersonPayload, uid: string, timestamp: FirebaseFirestore.FieldValue) {
  return {
    firstName: assertRequiredString(personData.firstName, "La persona necesita nombre."),
    middleName: cleanString(personData.middleName),
    lastName: assertRequiredString(personData.lastName, "La persona necesita apellido."),
    secondLastName: cleanString(personData.secondLastName),
    birthDate: cleanString(personData.birthDate),
    birthPlace: cleanString(personData.birthPlace),
    soltero: false,
    ownerId: uid,
    isRoot: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
/* eslint-enable require-jsdoc */


/**
 * 1. CREAR ÁRBOL CON PERSONA RAÍZ (Actualizada con nuevos campos)
 */
export const createTreeWithRootPerson = onCall(async (request) => {
  const uid = assertAuth(request);

  const {
    treeName,
    firstName,
    middleName,
    lastName,
    secondLastName,
    birthDate,
    birthPlace,
  } = request.data;

  const normalizedTreeName = assertRequiredString(treeName, "El nombre del árbol es requerido.");
  const normalizedFirstName = assertRequiredString(firstName, "Tu nombre es requerido.");
  const normalizedLastName = assertRequiredString(lastName, "Tu apellido es requerido.");
  const normalizedBirthDate = assertRequiredString(
    birthDate,
    "Tu fecha de nacimiento es requerida para crear tu perfil."
  );

  const existingTreeSnap = await db
    .collection("trees")
    .where("ownerId", "==", uid)
    .limit(1)
    .get();

  if (!existingTreeSnap.empty) {
    throw new HttpsError(
      "already-exists",
      "Ya tienes un árbol creado. Inicia sesión para continuar con tu árbol existente."
    );
  }

  const batch = db.batch();
  const timestamp = FieldValue.serverTimestamp();

  const treeRef = db.collection("trees").doc();
  const personRef = treeRef.collection("persons").doc();

  batch.set(treeRef, {
    name: normalizedTreeName,
    ownerId: uid,
    rootPersonId: personRef.id,
    visibility: "private",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  batch.set(personRef, {
    firstName: normalizedFirstName,
    middleName: cleanString(middleName),
    lastName: normalizedLastName,
    secondLastName: cleanString(secondLastName),
    birthDate: normalizedBirthDate,
    birthPlace: cleanString(birthPlace),
    soltero: false,
    ownerId: uid,
    isRoot: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await batch.commit();
  return { treeId: treeRef.id, rootPersonId: personRef.id, alreadyExisted: false };
});

/**
 * 1.1 Obtener el árbol principal del usuario autenticado.
 *
 * Etapa 5:
 * - Evita crear árboles duplicados.
 * - Permite detectar si el usuario ya completó onboarding.
 */
export const getMyTreeSummary = onCall(async (request) => {
  const uid = assertAuth(request);

  const treeSnap = await db
    .collection("trees")
    .where("ownerId", "==", uid)
    .limit(1)
    .get();

  if (treeSnap.empty) {
    return { treeId: null, rootPersonId: null };
  }

  const treeDoc = treeSnap.docs[0];
  const treeData = treeDoc.data();

  return {
    treeId: treeDoc.id,
    rootPersonId: treeData.rootPersonId ?? null,
  };
});

/**
 * 1.2 Obtener datos completos de un árbol.
 */
export const getTreeData = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId } = request.data as { treeId: string };

  if (!treeId) {
    throw new HttpsError("invalid-argument", "Falta treeId");
  }

  await assertIsOwner(treeId, uid);
  
  // Obtenemos personas y relaciones en paralelo para ser más rápidos
  const [personsSnap, relsSnap] = await Promise.all([
    db.collection("trees").doc(treeId).collection("persons").get(),
    db.collection("trees").doc(treeId).collection("relationships").get(),
  ]);

  return {
    persons: personsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    relationships: relsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});

type UpdatePersonData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
};

/**
 * Actualiza exclusivamente los datos personales editables de una persona.
 */
export const updatePerson = onCall(async (request) => {
  const uid = assertAuth(request);
  const data = request.data as {
    treeId?: unknown;
    personId?: unknown;
    personData?: unknown;
  };
  const treeId = assertRequiredString(data?.treeId, "Falta treeId.");
  const personId = assertRequiredString(data?.personId, "Falta personId.");

  if (
    !data?.personData ||
    typeof data.personData !== "object" ||
    Array.isArray(data.personData)
  ) {
    throw new HttpsError("invalid-argument", "personData inválido.");
  }

  const personData = data.personData as UpdatePersonData;
  const normalizedPersonData = {
    firstName: assertRequiredString(
      personData.firstName,
      "La persona necesita nombre."
    ),
    middleName: cleanString(personData.middleName),
    lastName: assertRequiredString(
      personData.lastName,
      "La persona necesita apellido."
    ),
    secondLastName: cleanString(personData.secondLastName),
    birthDate: cleanString(personData.birthDate),
    birthPlace: cleanString(personData.birthPlace),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await assertIsOwner(treeId, uid);

  const personRef = db
    .collection("trees")
    .doc(treeId)
    .collection("persons")
    .doc(personId);
  const personSnap = await personRef.get();
  if (!personSnap.exists) {
    throw new HttpsError("not-found", "La persona no existe en este árbol.");
  }

  await personRef.update(normalizedPersonData);
  return {ok: true, personId};
});

/**
 * Elimina una persona no raíz y todas sus relaciones incidentes.
 */
export const deletePerson = onCall(async (request) => {
  const uid = assertAuth(request);
  const data = request.data as {
    treeId?: unknown;
    personId?: unknown;
  };
  const treeId = assertDeletePersonId(data?.treeId, "treeId");
  const personId = assertDeletePersonId(data?.personId, "personId");

  try {
    const deletedRelationshipCount = await db.runTransaction(async (tx) => {
      const treeRef = db.collection("trees").doc(treeId);
      const personsRef = treeRef.collection("persons");
      const relationshipsRef = treeRef.collection("relationships");
      const personRef = personsRef.doc(personId);

      const treeSnap = await tx.get(treeRef);
      if (!treeSnap.exists) {
        throw new HttpsError("not-found", "El árbol no existe.", {
          reason: "tree-not-found",
        });
      }

      const treeData = treeSnap.data();
      if (treeData?.ownerId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permiso sobre este árbol.",
          {reason: "not-tree-owner"}
        );
      }

      const rootPersonId = treeData?.rootPersonId;
      if (
        typeof rootPersonId !== "string" ||
        !rootPersonId.trim() ||
        rootPersonId.includes("/")
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const personSnap = await tx.get(personRef);
      if (!personSnap.exists) {
        throw new HttpsError("not-found", "La persona no existe.", {
          reason: "person-not-found",
        });
      }

      if (rootPersonId === personId) {
        throw new HttpsError(
          "failed-precondition",
          "La persona raíz no se puede eliminar.",
          {reason: "root-person-protected"}
        );
      }

      if (personSnap.data()?.isRoot === true) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const rootPersonRef = personsRef.doc(rootPersonId);
      const rootPersonSnap = await tx.get(rootPersonRef);
      if (!rootPersonSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const personsSnap = await tx.get(personsRef.limit(2));
      if (!personsSnap.docs.some((doc) => doc.id !== personId)) {
        throw new HttpsError(
          "failed-precondition",
          "No se puede eliminar la última persona del árbol.",
          {reason: "last-person-protected"}
        );
      }

      const fromQuery = relationshipsRef.where(
        "fromPersonId",
        "==",
        personId
      );
      const toQuery = relationshipsRef.where("toPersonId", "==", personId);
      const fromSnap = await tx.get(fromQuery);
      const toSnap = await tx.get(toQuery);
      const incidentRelationships = new Map<
        string,
        FirebaseFirestore.QueryDocumentSnapshot
      >();

      [...fromSnap.docs, ...toSnap.docs].forEach((relationshipDoc) => {
        incidentRelationships.set(relationshipDoc.ref.path, relationshipDoc);
      });

      for (const relationshipDoc of incidentRelationships.values()) {
        const relationship = relationshipDoc.data();
        const fromPersonId = relationship.fromPersonId;
        const toPersonId = relationship.toPersonId;
        const hasValidEndpoints =
          typeof fromPersonId === "string" &&
          fromPersonId.trim().length > 0 &&
          typeof toPersonId === "string" &&
          toPersonId.trim().length > 0;
        const hasValidType =
          relationship.type === "PARENT_OF" ||
          relationship.type === "PARTNER_OF";
        const referencesPerson =
          fromPersonId === personId || toPersonId === personId;

        if (
          !hasValidEndpoints ||
          !hasValidType ||
          !referencesPerson ||
          fromPersonId === toPersonId
        ) {
          throw new HttpsError(
            "failed-precondition",
            "El árbol contiene datos inconsistentes.",
            {reason: "inconsistent-tree-data"}
          );
        }
      }

      if (
        incidentRelationships.size >
        MAX_DELETE_PERSON_INCIDENT_RELATIONSHIPS
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "La persona tiene demasiadas relaciones para esta operación.",
          {reason: "too-many-incident-relationships"}
        );
      }

      incidentRelationships.forEach((relationshipDoc) => {
        tx.delete(relationshipDoc.ref);
      });
      tx.delete(personRef);

      return incidentRelationships.size;
    });

    return {ok: true, personId, deletedRelationshipCount};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo eliminar la persona.");
  }
});

/**
 * Elimina exactamente una relación válida sin modificar personas ni árbol.
 */
export const deleteRelationship = onCall(async (request) => {
  const uid = assertAuth(request);
  const data = request.data as {
    treeId?: unknown;
    relationshipId?: unknown;
  };
  const treeId = assertDeleteRelationshipId(data?.treeId, "treeId");
  const relationshipId = assertDeleteRelationshipId(
    data?.relationshipId,
    "relationshipId"
  );

  try {
    await db.runTransaction(async (tx) => {
      const treeRef = db.collection("trees").doc(treeId);
      const personsRef = treeRef.collection("persons");
      const relationshipRef = treeRef
        .collection("relationships")
        .doc(relationshipId);

      const treeSnap = await tx.get(treeRef);
      if (!treeSnap.exists) {
        throw new HttpsError("not-found", "El árbol no existe.", {
          reason: "tree-not-found",
        });
      }

      if (treeSnap.data()?.ownerId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permiso sobre este árbol.",
          {reason: "not-tree-owner"}
        );
      }

      const relationshipSnap = await tx.get(relationshipRef);
      if (!relationshipSnap.exists) {
        throw new HttpsError("not-found", "La relación no existe.", {
          reason: "relationship-not-found",
        });
      }

      const relationship = relationshipSnap.data();
      const fromPersonId = relationship?.fromPersonId;
      const toPersonId = relationship?.toPersonId;
      const type = relationship?.type;
      const parentRole = relationship?.parentRole;
      const relationshipStatus = relationship?.relationshipStatus;
      const hasValidEndpoints =
        typeof fromPersonId === "string" &&
        fromPersonId.trim().length > 0 &&
        typeof toPersonId === "string" &&
        toPersonId.trim().length > 0 &&
        fromPersonId !== toPersonId;
      const hasValidType = type === "PARENT_OF" || type === "PARTNER_OF";
      const hasValidParentRole =
        type !== "PARENT_OF" ||
        parentRole === undefined ||
        parentRole === "father" ||
        parentRole === "mother";
      const hasValidRelationshipStatus =
        type !== "PARTNER_OF" ||
        relationshipStatus === undefined ||
        relationshipStatus === "current" ||
        relationshipStatus === "former" ||
        relationshipStatus === "unknown";

      if (
        !hasValidEndpoints ||
        !hasValidType ||
        !hasValidParentRole ||
        !hasValidRelationshipStatus
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const fromPersonRef = personsRef.doc(fromPersonId);
      const toPersonRef = personsRef.doc(toPersonId);
      const fromPersonSnap = await tx.get(fromPersonRef);
      const toPersonSnap = await tx.get(toPersonRef);

      if (!fromPersonSnap.exists || !toPersonSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      tx.delete(relationshipRef);
    });

    return {ok: true, relationshipId};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo eliminar la relación.");
  }
});

/**
 * Sustituye atómicamente una filiación por otra con un nuevo documento.
 */
export const reassignParentRelationship = onCall(async (request) => {
  const uid = assertAuth(request);
  const data = request.data as {
    treeId?: unknown;
    relationshipId?: unknown;
    newParentPersonId?: unknown;
    parentRole?: unknown;
  };
  const treeId = assertReassignParentId(data?.treeId, "treeId");
  const relationshipId = assertReassignParentId(
    data?.relationshipId,
    "relationshipId"
  );
  const newParentPersonId = assertReassignParentId(
    data?.newParentPersonId,
    "newParentPersonId"
  );

  const treeRef = db.collection("trees").doc(treeId);
  const personsRef = treeRef.collection("persons");
  const relationshipsRef = treeRef.collection("relationships");
  const oldRelationshipRef = relationshipsRef.doc(relationshipId);
  const newRelationshipRef = relationshipsRef.doc();

  try {
    await db.runTransaction(async (tx) => {
      const treeSnap = await tx.get(treeRef);
      if (!treeSnap.exists) {
        throw new HttpsError("not-found", "El árbol no existe.", {
          reason: "tree-not-found",
        });
      }
      if (treeSnap.data()?.ownerId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permiso sobre este árbol.",
          {reason: "not-tree-owner"}
        );
      }

      const relationshipSnap = await tx.get(oldRelationshipRef);
      if (!relationshipSnap.exists) {
        throw new HttpsError("not-found", "La relación no existe.", {
          reason: "relationship-not-found",
        });
      }

      const relationship = relationshipSnap.data();
      if (relationship?.type !== "PARENT_OF") {
        throw new HttpsError(
          "failed-precondition",
          "La relación no es una filiación parental.",
          {reason: "relationship-not-parent"}
        );
      }
      const oldParentPersonId = relationship.fromPersonId;
      const childPersonId = relationship.toPersonId;
      if (
        typeof oldParentPersonId !== "string" ||
        !oldParentPersonId.trim() ||
        typeof childPersonId !== "string" ||
        !childPersonId.trim() ||
        oldParentPersonId === childPersonId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const storedParentRole = relationship.parentRole;
      let resolvedParentRole: ParentRole;
      if (storedParentRole === "father" || storedParentRole === "mother") {
        if (data.parentRole !== undefined) {
          throw new HttpsError(
            "invalid-argument",
            "parentRole no debe enviarse para esta relación.",
            {reason: "unexpected-parent-role"}
          );
        }
        resolvedParentRole = storedParentRole;
      } else if (storedParentRole !== undefined) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      } else {
        const requestedParentRole = normalizeParentRole(data.parentRole);
        if (!requestedParentRole) {
          throw new HttpsError(
            "invalid-argument",
            "parentRole debe ser 'father' o 'mother'.",
            {reason: "invalid-parent-role"}
          );
        }
        resolvedParentRole = requestedParentRole;
      }

      if (newParentPersonId === oldParentPersonId) {
        throw new HttpsError("failed-precondition", "El progenitor no cambió.", {
          reason: "same-parent",
        });
      }
      if (newParentPersonId === childPersonId) {
        throw new HttpsError(
          "failed-precondition",
          "Una persona no puede ser progenitora de sí misma.",
          {reason: "self-parent"}
        );
      }

      const oldParentRef = personsRef.doc(oldParentPersonId);
      const childRef = personsRef.doc(childPersonId);
      const newParentRef = personsRef.doc(newParentPersonId);
      const oldParentSnap = await tx.get(oldParentRef);
      const childSnap = await tx.get(childRef);
      const newParentSnap = await tx.get(newParentRef);
      if (!oldParentSnap.exists || !childSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }
      if (!newParentSnap.exists) {
        throw new HttpsError("not-found", "El nuevo progenitor no existe.", {
          reason: "new-parent-not-found",
        });
      }

      const allParentRelationshipsSnap = await tx.get(
        relationshipsRef.where("type", "==", "PARENT_OF")
      );
      const parentDocuments = allParentRelationshipsSnap.docs.map((doc) => {
        const parentRelationship = doc.data();
        return {
          id: doc.id,
          parentId: parentRelationship.fromPersonId,
          childId: parentRelationship.toPersonId,
          parentRole: parentRelationship.parentRole,
        };
      });
      const hasInvalidGraphLink = parentDocuments.some((link) =>
        typeof link.parentId !== "string" || !link.parentId.trim() ||
        typeof link.childId !== "string" || !link.childId.trim() ||
        link.parentId === link.childId
      );
      if (hasInvalidGraphLink) {
        throw new HttpsError(
          "failed-precondition",
          "El estado parental existente no es válido.",
          {reason: "invalid-existing-parent-state"}
        );
      }

      const childParentDocuments = parentDocuments.filter(
        (link) => link.childId === childPersonId
      );
      if (
        childParentDocuments.length < 1 ||
        childParentDocuments.length > 2 ||
        !childParentDocuments.some((link) => link.id === relationshipId)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El estado parental existente no es válido.",
          {reason: "invalid-existing-parent-state"}
        );
      }

      const countsByParent = new Map<string, number>();
      childParentDocuments.forEach((link) => {
        countsByParent.set(
          link.parentId,
          (countsByParent.get(link.parentId) ?? 0) + 1
        );
      });
      if ((countsByParent.get(oldParentPersonId) ?? 0) > 1) {
        throw new HttpsError(
          "failed-precondition",
          "La filiación anterior está duplicada.",
          {reason: "duplicate-existing-parent-link"}
        );
      }
      if (countsByParent.has(newParentPersonId)) {
        throw new HttpsError(
          "failed-precondition",
          "El nuevo progenitor ya está vinculado.",
          {reason: "duplicate-parent-link"}
        );
      }
      if ([...countsByParent.values()].some((count) => count > 1)) {
        throw new HttpsError(
          "failed-precondition",
          "El estado parental existente no es válido.",
          {reason: "invalid-existing-parent-state"}
        );
      }

      const otherParentDocuments = childParentDocuments.filter(
        (link) => link.id !== relationshipId
      );
      if (otherParentDocuments.some((link) => link.parentRole === undefined)) {
        throw new HttpsError(
          "failed-precondition",
          "El rol del otro progenitor no está definido.",
          {reason: "existing-parent-role-unknown"}
        );
      }
      if (otherParentDocuments.some((link) =>
        normalizeParentRole(link.parentRole) === null
      )) {
        throw new HttpsError(
          "failed-precondition",
          "El estado parental existente no es válido.",
          {reason: "invalid-existing-parent-state"}
        );
      }
      if (otherParentDocuments.some((link) =>
        link.parentRole === resolvedParentRole
      )) {
        throw new HttpsError(
          "failed-precondition",
          "Ese rol parental ya está ocupado.",
          {reason: "parent-role-occupied"}
        );
      }

      const graphWithoutTarget: ExistingParentLink[] = parentDocuments
        .filter((link) => link.id !== relationshipId)
        .map((link) => ({parentId: link.parentId, childId: link.childId}));
      const graphAlreadyCyclic = graphWithoutTarget.some((link, index) =>
        hasDirectedParentPath(
          graphWithoutTarget.filter((_, linkIndex) => linkIndex !== index),
          link.childId,
          link.parentId
        )
      );
      if (graphAlreadyCyclic) {
        throw new HttpsError(
          "failed-precondition",
          "El estado parental existente no es válido.",
          {reason: "invalid-existing-parent-state"}
        );
      }
      if (
        hasDirectedParentPath(
          graphWithoutTarget,
          childPersonId,
          newParentPersonId
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "La reasignación crearía un ciclo.",
          {reason: "cycle-detected"}
        );
      }

      const timestamp = FieldValue.serverTimestamp();
      tx.delete(oldRelationshipRef);
      tx.set(newRelationshipRef, {
        type: "PARENT_OF",
        fromPersonId: newParentPersonId,
        toPersonId: childPersonId,
        parentRole: resolvedParentRole,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    return {ok: true, relationshipId: newRelationshipRef.id};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo reasignar el progenitor.");
  }
});

/**
 * Actualiza únicamente el estado de una relación de pareja existente.
 */
export const updatePartnerRelationshipStatus = onCall(async (request) => {
  const uid = assertAuth(request);
  const data = request.data as {
    treeId?: unknown;
    relationshipId?: unknown;
    relationshipStatus?: unknown;
    expectedRelationshipStatus?: unknown;
  };
  const treeId = assertPartnerStatusId(data?.treeId, "treeId");
  const relationshipId = assertPartnerStatusId(
    data?.relationshipId,
    "relationshipId"
  );
  const relationshipStatus = assertPartnerStatus(
    data?.relationshipStatus,
    "invalid-relationship-status"
  );
  const expectedRelationshipStatus = assertPartnerStatus(
    data?.expectedRelationshipStatus,
    "invalid-expected-relationship-status"
  );

  try {
    await db.runTransaction(async (tx) => {
      const treeRef = db.collection("trees").doc(treeId);
      const personsRef = treeRef.collection("persons");
      const relationshipsRef = treeRef.collection("relationships");
      const relationshipRef = relationshipsRef.doc(relationshipId);

      const treeSnap = await tx.get(treeRef);
      if (!treeSnap.exists) {
        throw new HttpsError("not-found", "El árbol no existe.", {
          reason: "tree-not-found",
        });
      }
      if (treeSnap.data()?.ownerId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permiso sobre este árbol.",
          {reason: "not-tree-owner"}
        );
      }

      const relationshipSnap = await tx.get(relationshipRef);
      if (!relationshipSnap.exists) {
        throw new HttpsError("not-found", "La relación no existe.", {
          reason: "relationship-not-found",
        });
      }

      const relationship = relationshipSnap.data();
      if (relationship?.type !== "PARTNER_OF") {
        throw new HttpsError(
          "failed-precondition",
          "La relación no es una relación de pareja.",
          {reason: "relationship-not-partner"}
        );
      }
      const fromPersonId = relationship.fromPersonId;
      const toPersonId = relationship.toPersonId;
      const storedStatus = relationship.relationshipStatus;
      if (
        typeof fromPersonId !== "string" || !fromPersonId.trim() ||
        fromPersonId.includes("/") ||
        typeof toPersonId !== "string" || !toPersonId.trim() ||
        toPersonId.includes("/") ||
        fromPersonId === toPersonId ||
        (storedStatus !== undefined &&
          storedStatus !== "current" &&
          storedStatus !== "former" &&
          storedStatus !== "unknown")
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const fromPersonSnap = await tx.get(personsRef.doc(fromPersonId));
      const toPersonSnap = await tx.get(personsRef.doc(toPersonId));
      if (!fromPersonSnap.exists || !toPersonSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "El árbol contiene datos inconsistentes.",
          {reason: "inconsistent-tree-data"}
        );
      }

      const forwardQuery = relationshipsRef
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", fromPersonId)
        .where("toPersonId", "==", toPersonId);
      const reverseQuery = relationshipsRef
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", toPersonId)
        .where("toPersonId", "==", fromPersonId);
      const forwardSnap = await tx.get(forwardQuery);
      const reverseSnap = await tx.get(reverseQuery);
      const hasDuplicate = [...forwardSnap.docs, ...reverseSnap.docs]
        .some((document) => document.id !== relationshipId);
      if (hasDuplicate) {
        throw new HttpsError(
          "failed-precondition",
          "La relación de pareja está duplicada.",
          {reason: "duplicate-partner-link"}
        );
      }

      const hasExplicitRelationshipStatus = storedStatus !== undefined;
      const storedRelationshipStatusNormalized =
        storedStatus ?? "unknown";
      if (
        hasExplicitRelationshipStatus &&
        storedRelationshipStatusNormalized === relationshipStatus
      ) {
        return;
      }
      if (
        storedRelationshipStatusNormalized !== expectedRelationshipStatus
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El estado de la relación cambió.",
          {reason: "relationship-status-changed"}
        );
      }

      tx.update(relationshipRef, {
        relationshipStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return {ok: true, relationshipId};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "No se pudo actualizar el estado de la relación de pareja."
    );
  }
});

export const createUnion = onCall(async (request) => {
  const uid = assertAuth(request);

  const {
    treeId,
    personAId,
    personBId,
    relationshipStatus: rawRelationshipStatus = "unknown",
    childrenOwnerId: rawChildrenOwnerId,
    existingChildIds: rawExistingChildIds,
    parentRoleForExistingChildren: rawParentRoleForExistingChildren,
  } = request.data as {
    treeId: string;
    personAId: string;
    personBId: string;
    relationshipStatus?: PartnerRelationshipStatus;
    childrenOwnerId?: string;
    existingChildIds?: string[];
    parentRoleForExistingChildren?: unknown;
  };

  if (!treeId || !personAId || !personBId) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  if (personAId === personBId) {
    throw new HttpsError(
      "invalid-argument",
      "Una persona no puede ser pareja de sí misma."
    );
  }

  const relationshipStatus = normalizePartnerRelationshipStatus(
    rawRelationshipStatus
  );
  const existingChildIds = normalizeIdList(
    rawExistingChildIds,
    "existingChildIds"
  );
  const childrenOwnerId = cleanString(rawChildrenOwnerId);
  const parentRoleForExistingChildren = normalizeParentRole(
    rawParentRoleForExistingChildren
  );

  if (
    existingChildIds.length > 0 &&
    childrenOwnerId !== personAId &&
    childrenOwnerId !== personBId
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Debes indicar cuál de las dos personas ya es progenitor/a de los hijos seleccionados."
    );
  }

  if (existingChildIds.length > 0 && !parentRoleForExistingChildren) {
    throw new HttpsError(
      "failed-precondition",
      "Debes indicar explícitamente el rol parental de cada progenitor antes de vincular un hijo existente.",
      { reason: "parent-role-required" }
    );
  }

  await assertIsOwner(treeId, uid);

  const [a, b] = canonPair(personAId, personBId);
  const childLinkSourceId =
    existingChildIds.length > 0 ? childrenOwnerId : null;
  const childLinkTargetId = childLinkSourceId ?
    childLinkSourceId === personAId ?
      personBId :
      personAId :
    null;

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");

  const personARef = personsCol.doc(a);
  const personBRef = personsCol.doc(b);
  const timestamp = FieldValue.serverTimestamp();

  let relationshipId: string | null = null;
  let alreadyExisted = false;
  let storedRelationshipStatus: PartnerRelationshipStatus =
    relationshipStatus;
  let linkedChildIds: string[] = [];
  let alreadyLinkedChildIds: string[] = [];

  await db.runTransaction(async (tx) => {
    const personASnap = await tx.get(personARef);
    const personBSnap = await tx.get(personBRef);

    if (!personASnap.exists || !personBSnap.exists) {
      throw new HttpsError("not-found", "Una o ambas personas no existen.");
    }

    const partnerForwardQuery = relsCol
      .where("type", "==", "PARTNER_OF")
      .where("fromPersonId", "==", a)
      .where("toPersonId", "==", b)
      .limit(1);

    const partnerReverseQuery = relsCol
      .where("type", "==", "PARTNER_OF")
      .where("fromPersonId", "==", b)
      .where("toPersonId", "==", a)
      .limit(1);

    const partnerForwardSnap = await tx.get(partnerForwardQuery);
    const partnerReverseSnap = await tx.get(partnerReverseQuery);

    const childLinkPlan =
      childLinkSourceId && childLinkTargetId ?
        await planExistingChildLinks({
          tx,
          personsCol,
          relsCol,
          sourceParentId: childLinkSourceId,
          targetParentId: childLinkTargetId,
          childIds: existingChildIds,
          parentRole: parentRoleForExistingChildren as ParentRole,
        }) :
        { childIdsToLink: [], alreadyLinkedChildIds: [] };

    linkedChildIds = childLinkPlan.childIdsToLink;
    alreadyLinkedChildIds = childLinkPlan.alreadyLinkedChildIds;

    if (!partnerForwardSnap.empty || !partnerReverseSnap.empty) {
      alreadyExisted = true;

      const existingDoc =
        partnerForwardSnap.docs[0] ?? partnerReverseSnap.docs[0];

      relationshipId = existingDoc.id;

      const existingStatus = existingDoc.data()?.relationshipStatus;
      storedRelationshipStatus =
        existingStatus === "current" || existingStatus === "former" ?
          existingStatus :
          "unknown";
    } else {
      const relRef = relsCol.doc();
      relationshipId = relRef.id;

      tx.set(relRef, {
        type: "PARTNER_OF",
        fromPersonId: a,
        toPersonId: b,
        relationshipStatus,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    linkedChildIds.forEach((childId) => {
      const parentRelRef = relsCol.doc();

      tx.set(parentRelRef, {
        type: "PARENT_OF",
        fromPersonId: childLinkTargetId,
        toPersonId: childId,
        parentRole: parentRoleForExistingChildren,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    tx.update(personARef, { updatedAt: timestamp });
    tx.update(personBRef, { updatedAt: timestamp });
  });

  return {
    ok: true,
    relationshipId,
    alreadyExisted,
    relationshipStatus: storedRelationshipStatus,
    linkedChildIds,
    alreadyLinkedChildIds,
  };
});

type PersonPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
};

export const addPartnerToPerson = onCall(async (request) => {
  const uid = assertAuth(request);

  const {
    treeId,
    personId,
    partnerData,
    relationshipStatus: rawRelationshipStatus = "unknown",
    existingChildIds: rawExistingChildIds,
    parentRoleForExistingChildren: rawParentRoleForExistingChildren,
  } = request.data as {
    treeId: string;
    personId: string;
    partnerData: PersonPayload;
    relationshipStatus?: PartnerRelationshipStatus;
    existingChildIds?: string[];
    parentRoleForExistingChildren?: unknown;
  };

  if (!treeId || !personId || !partnerData) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  const relationshipStatus = normalizePartnerRelationshipStatus(
    rawRelationshipStatus
  );
  const existingChildIds = normalizeIdList(
    rawExistingChildIds,
    "existingChildIds"
  );
  const parentRoleForExistingChildren = normalizeParentRole(
    rawParentRoleForExistingChildren
  );

  if (!partnerData.firstName || !partnerData.lastName) {
    throw new HttpsError(
      "invalid-argument",
      "La pareja necesita nombre y apellido."
    );
  }

  if (existingChildIds.length > 0 && !parentRoleForExistingChildren) {
    throw new HttpsError(
      "failed-precondition",
      "Debes indicar explícitamente el rol parental de cada progenitor antes de vincular un hijo existente.",
      { reason: "parent-role-required" }
    );
  }

  await assertIsOwner(treeId, uid);

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");
  const timestamp = FieldValue.serverTimestamp();

  const personRef = personsCol.doc(personId);
  const partnerRef = personsCol.doc();
  const relRef = relsCol.doc();
  let linkedChildIds: string[] = [];
  let alreadyLinkedChildIds: string[] = [];

  await db.runTransaction(async (tx) => {
    const personSnap = await tx.get(personRef);

    if (!personSnap.exists) {
      throw new HttpsError("not-found", "La persona seleccionada no existe.");
    }

    const childLinkPlan = await planExistingChildLinks({
      tx,
      personsCol,
      relsCol,
      sourceParentId: personId,
      targetParentId: partnerRef.id,
      childIds: existingChildIds,
      parentRole: parentRoleForExistingChildren as ParentRole,
    });

    linkedChildIds = childLinkPlan.childIdsToLink;
    alreadyLinkedChildIds = childLinkPlan.alreadyLinkedChildIds;

    tx.set(partnerRef, normalizePersonPayload(partnerData, uid, timestamp));

    const [a, b] = canonPair(personId, partnerRef.id);

    tx.set(relRef, {
      type: "PARTNER_OF",
      fromPersonId: a,
      toPersonId: b,
      relationshipStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    linkedChildIds.forEach((childId) => {
      const parentRelRef = relsCol.doc();

      tx.set(parentRelRef, {
        type: "PARENT_OF",
        fromPersonId: partnerRef.id,
        toPersonId: childId,
        parentRole: parentRoleForExistingChildren,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    tx.update(personRef, { updatedAt: timestamp });
  });

  return {
    ok: true,
    partnerId: partnerRef.id,
    relationshipId: relRef.id,
    linkedChildIds,
    alreadyLinkedChildIds,
  };
});

export const addChildToUnion = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId, unionId, childData, parentRoles } = request.data as {
    treeId: string;
    unionId: string;
    childData: PersonPayload;
    parentRoles: Record<string, unknown>;
  };

  // Validación mínima de entrada.
  if (!treeId || !unionId || !childData) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  if (
    !parentRoles ||
    typeof parentRoles !== "object" ||
    Array.isArray(parentRoles)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Los roles parentales no son válidos."
    );
  }

  // Por ahora exigimos nombre y apellido para evitar personas incompletas.
  if (!childData.firstName || !childData.lastName) {
    throw new HttpsError("invalid-argument", "El hijo/a necesita nombre y apellido.");
  }

  const treeRef = db.collection("trees").doc(treeId);
  const treeSnap = await treeRef.get();
  if (!treeSnap.exists) {
    throw new HttpsError("not-found", "El árbol ya no existe.");
  }
  if (treeSnap.data()?.ownerId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso sobre este árbol."
    );
  }

  // unionId puede venir como:
  // - union:personaA:personaB  -> hijo de una pareja
  // - single:personaA          -> hijo de una sola persona
  const parsed = parseUnionId(unionId);
  const parsedParentIds = parsed.kind === "union" ?
    [parsed.a, parsed.b] :
    [parsed.a];
  if (
    parsedParentIds.some(
      (personId) => !personId || personId.includes("/")
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "La unión contiene IDs de personas no válidos."
    );
  }
  const timestamp = FieldValue.serverTimestamp();

  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");

  // Creamos la referencia del nuevo hijo antes de la transacción
  // para poder usar el ID en las relaciones PARENT_OF.
  const childRef = personsCol.doc();

  const validation = await db.runTransaction(async (tx) => {
    // Payload normalizado del nuevo hijo/a.
    // Evitamos guardar undefined en Firestore.
    const childPayload = normalizePersonPayload(childData, uid, timestamp);
    let parentIds: string[];
    let parentRefs: FirebaseFirestore.DocumentReference[];
    let hasPartnerRelationship = false;
    let sharedChildCount = 0;
    let existingSharedChildParentLinks: ExistingSharedChildParentLink[] = [];

    if (parsed.kind === "union") {
      const [parentAId, parentBId] = canonPair(parsed.a, parsed.b);

      if (parentAId === parentBId) {
        throw new HttpsError(
          "invalid-argument",
          "Una unión necesita dos personas diferentes."
        );
      }

      const parentARef = personsCol.doc(parentAId);
      const parentBRef = personsCol.doc(parentBId);
      const partnerForwardQuery = relsCol
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", parentAId)
        .where("toPersonId", "==", parentBId);

      const partnerReverseQuery = relsCol
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", parentBId)
        .where("toPersonId", "==", parentAId);
      const parentAChildrenQuery = relsCol
        .where("type", "==", "PARENT_OF")
        .where("fromPersonId", "==", parentAId);
      const parentBChildrenQuery = relsCol
        .where("type", "==", "PARENT_OF")
        .where("fromPersonId", "==", parentBId);

      const [
        parentASnap,
        parentBSnap,
        partnerForwardSnap,
        partnerReverseSnap,
        parentAChildrenSnap,
        parentBChildrenSnap,
      ] = await Promise.all([
        tx.get(parentARef),
        tx.get(parentBRef),
        tx.get(partnerForwardQuery),
        tx.get(partnerReverseQuery),
        tx.get(parentAChildrenQuery),
        tx.get(parentBChildrenQuery),
      ]);

      if (!parentASnap.exists || !parentBSnap.exists) {
        throw new HttpsError("not-found", "Uno o ambos padres no existen.");
      }

      hasPartnerRelationship =
        !partnerForwardSnap.empty || !partnerReverseSnap.empty;

      const parentAChildIds = new Set(
        parentAChildrenSnap.docs.map((doc) => doc.data().toPersonId as string)
      );
      const sharedChildIds = Array.from(
        new Set(
          parentBChildrenSnap.docs
            .map((doc) => doc.data().toPersonId as string)
            .filter((childId) => parentAChildIds.has(childId))
        )
      );
      sharedChildCount = sharedChildIds.length;

      const sharedChildParentSnaps = await Promise.all(
        sharedChildIds.map((sharedChildId) =>
          tx.get(
            relsCol
              .where("type", "==", "PARENT_OF")
              .where("toPersonId", "==", sharedChildId)
          )
        )
      );

      existingSharedChildParentLinks = sharedChildParentSnaps.flatMap(
        (snapshot) => snapshot.docs.map((doc) => {
          const relationship = doc.data();
          return {
            parentId: relationship.fromPersonId,
            childId: relationship.toPersonId,
            ...(relationship.parentRole !== undefined ? {
              parentRole: relationship.parentRole,
            } : {}),
          } as ExistingSharedChildParentLink;
        })
      );

      parentIds = [parentAId, parentBId];
      parentRefs = [parentARef, parentBRef];
    } else {
      const parentId = parsed.a;
      const parentRef = personsCol.doc(parentId);
      const parentSnap = await tx.get(parentRef);

      if (!parentSnap.exists) {
        throw new HttpsError("not-found", "El padre/madre no existe.");
      }

      parentIds = [parentId];
      parentRefs = [parentRef];
    }

    const result = validateNewChildForExistingUnion({
      parentIds,
      parentRoles,
      hasPartnerRelationship,
      sharedChildCount,
      existingSharedChildParentLinks,
    });

    if (!result.ok) {
      throwNewChildUnionValidationError(result);
    }

    tx.set(childRef, childPayload);

    result.assignments.forEach((assignment) => {
      tx.set(relsCol.doc(), {
        type: "PARENT_OF",
        fromPersonId: assignment.personId,
        toPersonId: childRef.id,
        parentRole: assignment.parentRole,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    parentRefs.forEach((parentRef) => {
      tx.update(parentRef, { updatedAt: timestamp });
    });

    return result;
  });

  return {
    ok: true,
    personId: childRef.id,
    childId: childRef.id,
    unionId,
    resultingFamilyKind: validation.kind,
  };
});

export const addParentToPerson = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId, childId, parentRole, parentData } = request.data as {
    treeId: string;
    childId: string;
    parentRole: "father" | "mother";
    parentData: PersonPayload & { soltero?: boolean };
  };

  if (!treeId || !childId || !parentRole || !parentData) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  if (parentRole !== "father" && parentRole !== "mother") {
    throw new HttpsError("invalid-argument", "parentRole debe ser 'father' o 'mother'.");
  }

  if (!parentData.firstName || !parentData.lastName) {
    throw new HttpsError("invalid-argument", "El padre/madre necesita nombre y apellido.");
  }

  await assertIsOwner(treeId, uid);

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");

  const timestamp = FieldValue.serverTimestamp();

  const childRef = personsCol.doc(childId);
  const parentRef = personsCol.doc();
  const relRef = relsCol.doc();

  await db.runTransaction(async (tx) => {
    const childSnap = await tx.get(childRef);

    if (!childSnap.exists) {
      throw new HttpsError("not-found", "La persona hija no existe.");
    }

    const existingParentsQuery = relsCol
      .where("type", "==", "PARENT_OF")
      .where("toPersonId", "==", childId);

    const existingParentsSnap = await tx.get(existingParentsQuery);

    if (existingParentsSnap.size >= 2) {
      throw new HttpsError(
        "failed-precondition",
        "Esta persona ya tiene dos padres registrados."
      );
    }

    const sameRoleAlreadyExists = existingParentsSnap.docs.some((doc) => {
      const data = doc.data();
      return data.parentRole === parentRole;
    });

    if (sameRoleAlreadyExists) {
      throw new HttpsError(
        "already-exists",
        parentRole === "father" ?
          "Esta persona ya tiene un padre registrado." :
          "Esta persona ya tiene una madre registrada."
      );
    }

    tx.set(parentRef, {
      ...normalizePersonPayload(parentData, uid, timestamp),
      soltero: parentData.soltero ?? false,
    });

    tx.set(relRef, {
      type: "PARENT_OF",
      fromPersonId: parentRef.id,
      toPersonId: childId,
      parentRole,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    tx.update(childRef, {
      updatedAt: timestamp,
    });
  });

  return {
    ok: true,
    parentId: parentRef.id,
    relationshipId: relRef.id,
    parentRole,
  };
});

/**
 * DEV ONLY (Emulador): Asigna el ownerId del árbol al usuario autenticado actual.
 * Esto te permite trabajar con trees seed como "demo-tree-001" sin pelearte con UIDs anónimos.
 */
/**
 * DEV ONLY (Emulador): Asigna el ownerId del árbol al usuario autenticado actual.
 * Esto te permite trabajar con trees seed como "demo-tree-001" sin pelearte con UIDs anónimos.
 */
export const claimTreeOwnership = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  const isEmulator = !!process.env.FIREBASE_EMULATOR_HUB || process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    throw new HttpsError("failed-precondition", "claimTreeOwnership solo está permitido en emulador.");
  }

  const { treeId, rootPersonId, treeName } = request.data as {
    treeId: string;
    rootPersonId?: string;
    treeName?: string;
  };

  if (!treeId) {
    throw new HttpsError("invalid-argument", "treeId es requerido.");
  }

  const uid = request.auth.uid;
  const treeRef = db.collection("trees").doc(treeId);
  const ts = FieldValue.serverTimestamp();

  const treeSnap = await treeRef.get();

  if (!treeSnap.exists) {
    await treeRef.set({
      name: treeName ?? "DEV TREE",
      ownerId: uid,
      rootPersonId: rootPersonId ?? null,
      createdAt: ts,
      updatedAt: ts,
    });
  } else {
    await treeRef.set(
      {
        ownerId: uid,
        ...(rootPersonId ? { rootPersonId } : {}),
        updatedAt: ts,
      },
      { merge: true }
    );
  }

  return { ok: true, treeId, ownerId: uid };
});
