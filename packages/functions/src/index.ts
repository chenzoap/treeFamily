import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  validateNewChildForExistingUnion,
  type ExistingSharedChildParentLink,
  type NewChildUnionValidationResult,
} from "./parentRelationshipPolicy.js";


if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

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

async function planExistingChildLinks({
  tx,
  personsCol,
  relsCol,
  sourceParentId,
  targetParentId,
  childIds,
}: {
  tx: FirebaseFirestore.Transaction;
  personsCol: FirebaseFirestore.CollectionReference;
  relsCol: FirebaseFirestore.CollectionReference;
  sourceParentId: string;
  targetParentId: string;
  childIds: string[];
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

  const childIdsToLink: string[] = [];
  const alreadyLinkedChildIds: string[] = [];

  childIds.forEach((childId, index) => {
    if (!childSnaps[index].exists) {
      throw new HttpsError(
        "not-found",
        "Uno de los hijos seleccionados ya no existe."
      );
    }

    const parentIds = new Set<string>();

    relationshipSnaps[index].docs.forEach((relationshipDoc) => {
      const relationship = relationshipDoc.data();

      if (
        relationship.type === "PARENT_OF" &&
        typeof relationship.fromPersonId === "string"
      ) {
        parentIds.add(relationship.fromPersonId);
      }
    });

    if (!parentIds.has(sourceParentId)) {
      throw new HttpsError(
        "failed-precondition",
        "Uno de los hijos seleccionados no pertenece a la persona activa."
      );
    }

    if (parentIds.has(targetParentId)) {
      alreadyLinkedChildIds.push(childId);
      return;
    }

    const otherParentIds = Array.from(parentIds).filter(
      (parentId) => parentId !== sourceParentId
    );

    if (otherParentIds.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "Uno de los hijos seleccionados ya tiene otro progenitor registrado. Cambiar esa filiación pertenece a Etapa 8."
      );
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

/**
 * LEGACY / TEMPORAL
 *
 * Esta función permite crear personas de forma genérica.
 * No debe usarse en los flujos principales de Etapa 4.
 *
 * Motivo:
 * - Puede crear personas sin una relación familiar clara.
 * - No valida parentesco ni contexto genealógico específico.
 * - Los nuevos flujos deben usar funciones más específicas:
 *   - addParentToPerson
 *   - addChildToUnion
 *   - createUnion
 *
 * Mantener temporalmente hasta confirmar que ninguna pantalla activa la usa.
 */
export const addPerson = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  const { treeId, personData } = request.data;
  const timestamp = FieldValue.serverTimestamp();

  // Validar propiedad del árbol
  const treeDoc = await db.collection("trees").doc(treeId).get();
  if (!treeDoc.exists || treeDoc.data()?.ownerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "No tienes permiso sobre este árbol.");
  }

  const personRef = db.collection("trees").doc(treeId).collection("persons").doc();
  
  await personRef.set({
    ...personData,
    ownerId: request.auth.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { personId: personRef.id };
});

/**
 * LEGACY / TEMPORAL
 *
 * Esta función permite crear relaciones de forma genérica.
 * No debe usarse en los flujos principales de Etapa 4.
 *
 * Motivo:
 * - Permite crear relaciones sin reglas específicas.
 * - Puede generar estados inválidos o duplicados.
 * - Las relaciones importantes ahora deben pasar por funciones controladas:
 *   - createUnion para PARTNER_OF
 *   - addChildToUnion para hijos
 *   - addParentToPerson para padres/madres
 *
 * Mantener temporalmente hasta confirmar que ninguna pantalla activa la usa.
 */
export const addRelationship = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId, type, fromPersonId, toPersonId } = request.data as {
    treeId: string;
    type: "PARENT_OF" | "PARTNER_OF";
    fromPersonId: string;
    toPersonId: string;
  };

  if (!treeId || !type || !fromPersonId || !toPersonId) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  if (type !== "PARENT_OF" && type !== "PARTNER_OF") {
    throw new HttpsError("invalid-argument", "Tipo de relación inválido.");
  }

  if (fromPersonId === toPersonId) {
    throw new HttpsError(
      "invalid-argument",
      "Una persona no puede relacionarse consigo misma."
    );
  }

  await assertIsOwner(treeId, uid);

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relationshipsCol = treeRef.collection("relationships");

  const normalizedIds =
    type === "PARTNER_OF" ?
      canonPair(fromPersonId, toPersonId) :
      ([fromPersonId, toPersonId] as [string, string]);

  const [normalizedFromPersonId, normalizedToPersonId] = normalizedIds;

  const fromPersonRef = personsCol.doc(normalizedFromPersonId);
  const toPersonRef = personsCol.doc(normalizedToPersonId);

  const [fromPersonSnap, toPersonSnap] = await Promise.all([
    fromPersonRef.get(),
    toPersonRef.get(),
  ]);

  if (!fromPersonSnap.exists || !toPersonSnap.exists) {
    throw new HttpsError(
      "not-found",
      "Una o ambas personas de la relación no existen."
    );
  }

  const forwardQuery = relationshipsCol
    .where("type", "==", type)
    .where("fromPersonId", "==", normalizedFromPersonId)
    .where("toPersonId", "==", normalizedToPersonId)
    .limit(1);

  const queries = [forwardQuery.get()];

  if (type === "PARTNER_OF") {
    const reverseQuery = relationshipsCol
      .where("type", "==", type)
      .where("fromPersonId", "==", normalizedToPersonId)
      .where("toPersonId", "==", normalizedFromPersonId)
      .limit(1);

    queries.push(reverseQuery.get());
  }

  const duplicateSnapshots = await Promise.all(queries);

  if (duplicateSnapshots.some((snapshot) => !snapshot.empty)) {
    throw new HttpsError(
      "already-exists",
      "Esta relación ya existe en el árbol."
    );
  }

  const relationshipRef = relationshipsCol.doc();
  const timestamp = FieldValue.serverTimestamp();

  await relationshipRef.set({
    type,
    fromPersonId: normalizedFromPersonId,
    toPersonId: normalizedToPersonId,
    ...(type === "PARTNER_OF" ?
      { relationshipStatus: "unknown" as PartnerRelationshipStatus } :
      {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { relationshipId: relationshipRef.id };
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
  } = request.data as {
    treeId: string;
    personAId: string;
    personBId: string;
    relationshipStatus?: PartnerRelationshipStatus;
    childrenOwnerId?: string;
    existingChildIds?: string[];
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
  } = request.data as {
    treeId: string;
    personId: string;
    partnerData: PersonPayload;
    relationshipStatus?: PartnerRelationshipStatus;
    existingChildIds?: string[];
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

  if (!partnerData.firstName || !partnerData.lastName) {
    throw new HttpsError(
      "invalid-argument",
      "La pareja necesita nombre y apellido."
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
