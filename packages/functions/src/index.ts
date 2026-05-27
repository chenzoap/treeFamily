import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";


if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

/* eslint-disable require-jsdoc */
// === Helpers Etapa 4 ===
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
/* eslint-enable require-jsdoc */


/**
 * 1. CREAR ÁRBOL CON PERSONA RAÍZ (Actualizada con nuevos campos)
 */
export const createTreeWithRootPerson = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  // Extraemos todos los nuevos campos del request
  const { 
    treeName, 
    firstName, 
    middleName, 
    lastName, 
    secondLastName, 
    birthDate, 
    birthPlace,
  } = request.data;

  const batch = db.batch();
  const timestamp = FieldValue.serverTimestamp();

  const treeRef = db.collection("trees").doc();
  const personRef = treeRef.collection("persons").doc();

  batch.set(treeRef, {
    name: treeName,
    ownerId: request.auth.uid,
    rootPersonId: personRef.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Guardamos la persona raíz con la nueva estructura
  batch.set(personRef, {
    firstName,
    middleName: middleName || "",
    lastName,
    secondLastName: secondLastName || "",
    birthDate,
    birthPlace,    
    soltero: false,
    ownerId: request.auth.uid,
    isRoot: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await batch.commit();
  return { treeId: treeRef.id, rootPersonId: personRef.id };
});

/**
 * 1.1 
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
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  const { treeId, type, fromPersonId, toPersonId } = request.data;

  // Validación A != B
  if (fromPersonId === toPersonId) {
    throw new HttpsError("invalid-argument", "Una persona no puede relacionarse consigo misma.");
  }

  // Validar propiedad del árbol
  const treeDoc = await db.collection("trees").doc(treeId).get();
  if (!treeDoc.exists || treeDoc.data()?.ownerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "No tienes permiso sobre este árbol.");
  }

  // Validación Anti-Duplicados
  const duplicateCheck = await db.collection("trees").doc(treeId).collection("relationships")
    .where("fromPersonId", "==", fromPersonId)
    .where("toPersonId", "==", toPersonId)
    .where("type", "==", type)
    .limit(1)
    .get();

  if (!duplicateCheck.empty) {
    throw new HttpsError("already-exists", "Esta relación ya existe en el árbol.");
  }

  const relRef = db.collection("trees").doc(treeId).collection("relationships").doc();
  const timestamp = FieldValue.serverTimestamp();

  await relRef.set({
    type,
    fromPersonId,
    toPersonId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { relationshipId: relRef.id };
});

export const createUnion = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId, personAId, personBId } = request.data as {
    treeId: string;
    personAId: string;
    personBId: string;
  };

  // Validación mínima de entrada.
  if (!treeId || !personAId || !personBId) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  // Una persona no puede formar pareja consigo misma.
  if (personAId === personBId) {
    throw new HttpsError(
      "invalid-argument",
      "Una persona no puede ser pareja de sí misma."
    );
  }

  // Solo el dueño del árbol puede crear uniones.
  await assertIsOwner(treeId, uid);

  // Canonicalizamos el par para guardar siempre la relación en el mismo orden.
  // Esto evita duplicados tipo A -> B y B -> A.
  const [a, b] = canonPair(personAId, personBId);

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");

  const personARef = personsCol.doc(a);
  const personBRef = personsCol.doc(b);
  const timestamp = FieldValue.serverTimestamp();

  let relationshipId: string | null = null;
  let alreadyExisted = false;

  await db.runTransaction(async (tx) => {
    // Validamos que ambas personas existan antes de crear la unión.
    const personASnap = await tx.get(personARef);
    const personBSnap = await tx.get(personBRef);

    if (!personASnap.exists || !personBSnap.exists) {
      throw new HttpsError("not-found", "Una o ambas personas no existen.");
    }

    // Buscamos si ya existe PARTNER_OF en dirección normal.
    const partnerForwardQuery = relsCol
      .where("type", "==", "PARTNER_OF")
      .where("fromPersonId", "==", a)
      .where("toPersonId", "==", b);

    // Buscamos si ya existe PARTNER_OF en dirección inversa.
    // Esto protege contra datos viejos o relaciones creadas antes de canonicalizar.
    const partnerReverseQuery = relsCol
      .where("type", "==", "PARTNER_OF")
      .where("fromPersonId", "==", b)
      .where("toPersonId", "==", a);

    const partnerForwardSnap = await tx.get(partnerForwardQuery);
    const partnerReverseSnap = await tx.get(partnerReverseQuery);

    // Si ya existe la relación en cualquier dirección, no creamos duplicado.
    if (!partnerForwardSnap.empty || !partnerReverseSnap.empty) {
      alreadyExisted = true;

      const existingDoc =
        partnerForwardSnap.docs[0] ?? partnerReverseSnap.docs[0];

      relationshipId = existingDoc.id;
      return;
    }

    // Creamos la relación PARTNER_OF canonicalizada.
    const relRef = relsCol.doc();
    relationshipId = relRef.id;

    tx.set(relRef, {
      type: "PARTNER_OF",
      fromPersonId: a,
      toPersonId: b,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Marcamos ambas personas como actualizadas.
    tx.update(personARef, {
      updatedAt: timestamp,
    });

    tx.update(personBRef, {
      updatedAt: timestamp,
    });
  });

  return {
    ok: true,
    relationshipId,
    alreadyExisted,
  };
});

type PersonPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  birthPlace: string;
};

export const addChildToUnion = onCall(async (request) => {
  const uid = assertAuth(request);

  const { treeId, unionId, childData } = request.data as {
    treeId: string;
    unionId: string;
    childData: PersonPayload;
  };

  // Validación mínima de entrada.
  if (!treeId || !unionId || !childData) {
    throw new HttpsError("invalid-argument", "Faltan datos obligatorios.");
  }

  // Por ahora exigimos nombre y apellido para evitar personas incompletas.
  if (!childData.firstName || !childData.lastName) {
    throw new HttpsError("invalid-argument", "El hijo/a necesita nombre y apellido.");
  }

  // Solo el dueño del árbol puede modificarlo.
  await assertIsOwner(treeId, uid);

  // unionId puede venir como:
  // - union:personaA:personaB  -> hijo de una pareja
  // - single:personaA          -> hijo de una sola persona
  const parsed = parseUnionId(unionId);
  const timestamp = FieldValue.serverTimestamp();

  const treeRef = db.collection("trees").doc(treeId);
  const personsCol = treeRef.collection("persons");
  const relsCol = treeRef.collection("relationships");

  // Creamos la referencia del nuevo hijo antes de la transacción
  // para poder usar el ID en las relaciones PARENT_OF.
  const childRef = personsCol.doc();

  await db.runTransaction(async (tx) => {
    // Payload normalizado del nuevo hijo/a.
    // Evitamos guardar undefined en Firestore.
    const childPayload = {
      firstName: childData.firstName,
      middleName: childData.middleName ?? "",
      lastName: childData.lastName,
      secondLastName: childData.secondLastName ?? "",
      birthDate: childData.birthDate ?? "",
      birthPlace: childData.birthPlace ?? "",
      soltero: false,
      ownerId: uid,
      isRoot: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Caso 1: hijo/a agregado a una unión de pareja.
    if (parsed.kind === "union") {
      // Canonicalizamos el par para evitar duplicados tipo A-B y B-A.
      const [parentAId, parentBId] = canonPair(parsed.a, parsed.b);

      if (parentAId === parentBId) {
        throw new HttpsError(
          "invalid-argument",
          "Una unión necesita dos personas diferentes."
        );
      }

      const parentARef = personsCol.doc(parentAId);
      const parentBRef = personsCol.doc(parentBId);

      // Validamos que ambos padres existan antes de crear el hijo.
      const parentASnap = await tx.get(parentARef);
      const parentBSnap = await tx.get(parentBRef);

      if (!parentASnap.exists || !parentBSnap.exists) {
        throw new HttpsError("not-found", "Uno o ambos padres no existen.");
      }

      // Buscamos si ya existe la relación PARTNER_OF en cualquier dirección.
      // Esto evita crear duplicados si la pareja ya existía.
      const partnerForwardQuery = relsCol
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", parentAId)
        .where("toPersonId", "==", parentBId);

      const partnerReverseQuery = relsCol
        .where("type", "==", "PARTNER_OF")
        .where("fromPersonId", "==", parentBId)
        .where("toPersonId", "==", parentAId);

      const partnerForwardSnap = await tx.get(partnerForwardQuery);
      const partnerReverseSnap = await tx.get(partnerReverseQuery);

      // Creamos el hijo/a.
      tx.set(childRef, childPayload);

      // Creamos las dos relaciones PARENT_OF:
      // padre/madre A -> hijo
      // padre/madre B -> hijo
      const parentARelRef = relsCol.doc();
      const parentBRelRef = relsCol.doc();

      tx.set(parentARelRef, {
        type: "PARENT_OF",
        fromPersonId: parentAId,
        toPersonId: childRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      tx.set(parentBRelRef, {
        type: "PARENT_OF",
        fromPersonId: parentBId,
        toPersonId: childRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Si la relación PARTNER_OF no existe, la creamos dentro de la misma transacción.
      // Así evitamos un estado donde el hijo queda con dos padres pero la pareja no existe.
      if (partnerForwardSnap.empty && partnerReverseSnap.empty) {
        const partnerRelRef = relsCol.doc();

        tx.set(partnerRelRef, {
          type: "PARTNER_OF",
          fromPersonId: parentAId,
          toPersonId: parentBId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Marcamos ambos padres como actualizados.
      tx.update(parentARef, {
        updatedAt: timestamp,
      });

      tx.update(parentBRef, {
        updatedAt: timestamp,
      });

      return;
    }

    // Caso 2: hijo/a agregado a una sola persona.
    if (parsed.kind === "single") {
      const parentId = parsed.a;
      const parentRef = personsCol.doc(parentId);

      // Validamos que la persona padre/madre exista.
      const parentSnap = await tx.get(parentRef);

      if (!parentSnap.exists) {
        throw new HttpsError("not-found", "El padre/madre no existe.");
      }

      // Creamos el hijo/a.
      tx.set(childRef, childPayload);

      // Creamos una sola relación PARENT_OF:
      // padre/madre -> hijo
      const parentRelRef = relsCol.doc();

      tx.set(parentRelRef, {
        type: "PARENT_OF",
        fromPersonId: parentId,
        toPersonId: childRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Marcamos el padre/madre como actualizado.
      tx.update(parentRef, {
        updatedAt: timestamp,
      });

      return;
    }

    throw new HttpsError("invalid-argument", "unionId inválido.");
  });

  return {
    ok: true,
    childId: childRef.id,
    unionId,
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
        parentRole === "father"
          ? "Esta persona ya tiene un padre registrado."
          : "Esta persona ya tiene una madre registrada."
      );
    }

    tx.set(parentRef, {
      firstName: parentData.firstName,
      middleName: parentData.middleName ?? "",
      lastName: parentData.lastName,
      secondLastName: parentData.secondLastName ?? "",
      birthDate: parentData.birthDate ?? "",
      birthPlace: parentData.birthPlace ?? "",
      soltero: parentData.soltero ?? false,
      ownerId: uid,
      isRoot: false,
      createdAt: timestamp,
      updatedAt: timestamp,
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
