import admin from "firebase-admin";

const treeId = process.env.TREE_ID ?? "demo-tree-001";

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

admin.initializeApp({
  projectId: "tree-gen-chenzoap-2026",
});

const db = admin.firestore();

function relKey(type, fromPersonId, toPersonId) {
  return `${type}:${fromPersonId}->${toPersonId}`;
}

function partnerCanonicalKey(a, b) {
  return [a, b].sort().join("::");
}

async function main() {
  const errors = [];
  const warnings = [];

  const treeRef = db.collection("trees").doc(treeId);
  const treeSnap = await treeRef.get();

  if (!treeSnap.exists) {
    throw new Error(`No existe el árbol: ${treeId}`);
  }

  const personsSnap = await treeRef.collection("persons").get();
  const relationshipsSnap = await treeRef.collection("relationships").get();

  const personIds = new Set();
  const personsById = new Map();

  personsSnap.forEach((doc) => {
    personIds.add(doc.id);
    personsById.set(doc.id, doc.data());
  });

  const relationshipKeys = new Map();
  const partnerPairs = new Map();
  const parentsByChild = new Map();

  relationshipsSnap.forEach((doc) => {
    const rel = doc.data();

    const type = rel.type;
    const fromPersonId = rel.fromPersonId;
    const toPersonId = rel.toPersonId;

    if (type !== "PARENT_OF" && type !== "PARTNER_OF") {
      errors.push({
        relationshipId: doc.id,
        error: `Tipo de relación inválido: ${type}`,
      });
      return;
    }

    if (!fromPersonId || !toPersonId) {
      errors.push({
        relationshipId: doc.id,
        error: "Relación sin fromPersonId o toPersonId",
      });
      return;
    }

    if (!personIds.has(fromPersonId)) {
      errors.push({
        relationshipId: doc.id,
        error: `fromPersonId no existe: ${fromPersonId}`,
      });
    }

    if (!personIds.has(toPersonId)) {
      errors.push({
        relationshipId: doc.id,
        error: `toPersonId no existe: ${toPersonId}`,
      });
    }

    const key = relKey(type, fromPersonId, toPersonId);

    if (relationshipKeys.has(key)) {
      errors.push({
        relationshipId: doc.id,
        duplicateOf: relationshipKeys.get(key),
        error: `Relación duplicada exacta: ${key}`,
      });
    } else {
      relationshipKeys.set(key, doc.id);
    }

    if (type === "PARTNER_OF") {
      if (fromPersonId === toPersonId) {
        errors.push({
          relationshipId: doc.id,
          error: "PARTNER_OF inválido: una persona no puede ser pareja de sí misma",
        });
      }

      const pairKey = partnerCanonicalKey(fromPersonId, toPersonId);

      if (partnerPairs.has(pairKey)) {
        errors.push({
          relationshipId: doc.id,
          duplicateOf: partnerPairs.get(pairKey),
          error: `PARTNER_OF duplicado o inverso duplicado: ${pairKey}`,
        });
      } else {
        partnerPairs.set(pairKey, doc.id);
      }
    }

    if (type === "PARENT_OF") {
      if (!parentsByChild.has(toPersonId)) {
        parentsByChild.set(toPersonId, []);
      }

      parentsByChild.get(toPersonId).push({
        relationshipId: doc.id,
        parentId: fromPersonId,
        parentRole: rel.parentRole ?? null,
      });
    }
  });

  for (const [childId, parents] of parentsByChild.entries()) {
    const uniqueParentIds = new Set(parents.map((p) => p.parentId));

    if (uniqueParentIds.size !== parents.length) {
      errors.push({
        childId,
        error: "El hijo/a tiene el mismo padre/madre repetido en PARENT_OF",
        parents,
      });
    }

    if (uniqueParentIds.size > 2) {
      errors.push({
        childId,
        error: "La persona tiene más de 2 padres registrados",
        parents,
      });
    }

    const roles = parents
      .map((p) => p.parentRole)
      .filter((role) => role === "father" || role === "mother");

    const roleSet = new Set(roles);

    if (roles.length !== roleSet.size) {
      errors.push({
        childId,
        error: "La persona tiene parentRole duplicado: father/mother",
        parents,
      });
    }

    if (uniqueParentIds.size === 2) {
      const [a, b] = Array.from(uniqueParentIds);
      const pairKey = partnerCanonicalKey(a, b);

      if (!partnerPairs.has(pairKey)) {
        warnings.push({
          childId,
          warning:
            "Tiene 2 padres, pero no existe PARTNER_OF entre ellos. Puede ser válido, pero revisar si debe mostrarse como unión.",
          parents: [a, b],
        });
      }
    }
  }

  console.log("\nVALIDACIÓN DE ÁRBOL");
  console.log("==================");
  console.log(`treeId: ${treeId}`);
  console.log(`personas: ${personsSnap.size}`);
  console.log(`relaciones: ${relationshipsSnap.size}`);

  if (errors.length === 0) {
    console.log("\n✅ No se encontraron estados inválidos críticos.");
  } else {
    console.log(`\n❌ Errores encontrados: ${errors.length}`);
    console.dir(errors, { depth: null });
  }

  if (warnings.length === 0) {
    console.log("\n✅ No se encontraron advertencias.");
  } else {
    console.log(`\n⚠️ Advertencias encontradas: ${warnings.length}`);
    console.dir(warnings, { depth: null });
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error ejecutando validación:", err);
  process.exit(1);
});