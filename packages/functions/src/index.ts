import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

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
