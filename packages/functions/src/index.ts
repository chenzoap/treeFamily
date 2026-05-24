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

async function relationshipExists(treeId: string, type: string, fromId: string, toId: string) {
  const q = await db
    .collection("trees").doc(treeId).collection("relationships")
    .where("type", "==", type)
    .where("fromPersonId", "==", fromId)
    .where("toPersonId", "==", toId)
    .limit(1)
    .get();
  return !q.empty;
}

async function partnerRelationshipExistsEitherDirection(treeId: string, a: string, b: string) {
  const [x, y] = canonPair(a, b);
  const forward = await relationshipExists(treeId, "PARTNER_OF", x, y);
  if (forward) return true;
  const reverse = await relationshipExists(treeId, "PARTNER_OF", y, x);
  return reverse;
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
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth requerida");
  
  const { treeId } = request.data;
  
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
 * 2. AÑADIR PERSONA
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
 * 3. AÑADIR RELACIÓN (Con validaciones A!=B y anti-duplicados)
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
  const { treeId, personAId, personBId } = request.data as { treeId: string; personAId: string; personBId: string };

  if (!treeId || !personAId || !personBId) throw new HttpsError("invalid-argument", "Faltan datos");
  if (personAId === personBId) throw new HttpsError("invalid-argument", "Una persona no puede ser pareja de sí misma");

  await assertIsOwner(treeId, uid);

  const [a, b] = canonPair(personAId, personBId);

  await db.runTransaction(async (tx) => {
    const treeRef = db.collection("trees").doc(treeId);
    const personARef = treeRef.collection("persons").doc(a);
    const personBRef = treeRef.collection("persons").doc(b);

    const [sa, sb] = await Promise.all([tx.get(personARef), tx.get(personBRef)]);
    if (!sa.exists || !sb.exists) throw new HttpsError("not-found", "Personas no encontradas");

    // Dedupe PARTNER_OF en cualquiera de las direcciones
    // (en tx no haremos queries; simple y seguro: hacemos fuera con exists, o repetimos con reads normales)
  });

  // Dedupe fuera de TX (suficiente para tu caso actual):
  const exists = await partnerRelationshipExistsEitherDirection(treeId, a, b);
  if (exists) return { ok: true, alreadyExisted: true };

  const relRef = db.collection("trees").doc(treeId).collection("relationships").doc();
  const timestamp = FieldValue.serverTimestamp();

  await relRef.set({
    type: "PARTNER_OF",
    fromPersonId: a,
    toPersonId: b,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { ok: true, relationshipId: relRef.id, alreadyExisted: false };
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

  if (!treeId || !unionId || !childData) throw new HttpsError("invalid-argument", "Faltan datos");
  await assertIsOwner(treeId, uid);

  const parsed = parseUnionId(unionId);
  const timestamp = FieldValue.serverTimestamp();
  const treeRef = db.collection("trees").doc(treeId);

  const childRef = treeRef.collection("persons").doc(); // nuevo hijo
  const relsCol = treeRef.collection("relationships");

  await db.runTransaction(async (tx) => {
    // validar padres existen
    if (parsed.kind === "union") {
      const [a, b] = canonPair(parsed.a, parsed.b);
      const [sa, sb] = await Promise.all([
        tx.get(treeRef.collection("persons").doc(a)),
        tx.get(treeRef.collection("persons").doc(b)),
      ]);
      if (!sa.exists || !sb.exists) throw new HttpsError("not-found", "Padres no encontrados");

      // crear hijo
      tx.set(childRef, {
        ...childData,
        middleName: childData.middleName || "",
        secondLastName: childData.secondLastName || "",
        soltero: false, // por defecto (no rompe nada)
        ownerId: uid,
        isRoot: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // asegurar PARTNER_OF canonical (si no existe, lo creamos)
      // (lo hacemos fuera de tx para evitar queries; pero podemos hacerlo simple: 
      // siempre intentar crear y depender de anti-duplicados fuera)
      // En esta transacción solo creamos PARENT_OF.
      const relA = relsCol.doc();
      const relB = relsCol.doc();

      tx.set(relA, {
        type: "PARENT_OF",
        fromPersonId: a,
        toPersonId: childRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      tx.set(relB, {
        type: "PARENT_OF",
        fromPersonId: b,
        toPersonId: childRef.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return;
    }

    // single union
    const parentId = parsed.a;
    const sp = await tx.get(treeRef.collection("persons").doc(parentId));
    if (!sp.exists) throw new HttpsError("not-found", "Padre/madre no encontrado");

    tx.set(childRef, {
      ...childData,
      middleName: childData.middleName || "",
      secondLastName: childData.secondLastName || "",
      soltero: false,
      ownerId: uid,
      isRoot: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const rel = relsCol.doc();
    tx.set(rel, {
      type: "PARENT_OF",
      fromPersonId: parentId,
      toPersonId: childRef.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  // Si era unión de pareja, aseguramos PARTNER_OF canonical (dedupe reverse)
  if (parsed.kind === "union") {
    const [a, b] = canonPair(parsed.a, parsed.b);
    const exists = await partnerRelationshipExistsEitherDirection(treeId, a, b);
    if (!exists) {
      const relRef = db.collection("trees").doc(treeId).collection("relationships").doc();
      await relRef.set({
        type: "PARTNER_OF",
        fromPersonId: a,
        toPersonId: b,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return { ok: true, childId: childRef.id };
});

export const addParentToPerson = onCall(async (request) => {
  const uid = assertAuth(request);
  const { treeId, childId, parentRole, parentData } = request.data as {
    treeId: string;
    childId: string;
    parentRole: "father" | "mother";
    parentData: PersonPayload & { soltero?: boolean };
  };

  if (!treeId || !childId || !parentRole || !parentData) throw new HttpsError("invalid-argument", "Faltan datos");
  await assertIsOwner(treeId, uid);

  const treeRef = db.collection("trees").doc(treeId);
  const timestamp = FieldValue.serverTimestamp();

  const parentRef = treeRef.collection("persons").doc();
  const relRef = treeRef.collection("relationships").doc();

  await db.runTransaction(async (tx) => {
    const childSnap = await tx.get(treeRef.collection("persons").doc(childId));
    if (!childSnap.exists) throw new HttpsError("not-found", "Hijo/a no encontrado");

    tx.set(parentRef, {
      ...parentData,
      middleName: parentData.middleName || "",
      secondLastName: parentData.secondLastName || "",
      soltero: !!parentData.soltero, // NUEVO
      ownerId: uid,
      isRoot: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    tx.set(relRef, {
      type: "PARENT_OF",
      fromPersonId: parentRef.id,
      toPersonId: childId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  return { ok: true, parentId: parentRef.id };
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
