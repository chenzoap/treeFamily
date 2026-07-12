import admin from "firebase-admin";

const treeId = process.env.TREE_ID ?? "gib7tREAAsXDQX4Qh3Oh";

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "tree-gen-chenzoap-2026",
  });
}

const db = admin.firestore();

const VALID_RELATIONSHIP_TYPES = new Set(["PARENT_OF", "PARTNER_OF"]);
const VALID_PARENT_ROLES = new Set(["father", "mother"]);
const VALID_RELATIONSHIP_STATUSES = new Set([
  "current",
  "former",
  "unknown",
]);

function relKey(type, fromPersonId, toPersonId) {
  return `${type}:${fromPersonId}->${toPersonId}`;
}

function partnerCanonicalKey(a, b) {
  return [a, b].sort().join("::");
}

function addChildToGroup(groups, key, parentIds, childId) {
  const current = groups.get(key) ?? {
    parentIds,
    childIds: [],
  };

  if (!current.childIds.includes(childId)) {
    current.childIds.push(childId);
  }

  groups.set(key, current);
}

async function main() {
  const errors = [];
  const warnings = [];
  const orphanRelationshipIds = new Set();

  const treeRef = db.collection("trees").doc(treeId);
  const treeSnap = await treeRef.get();

  if (!treeSnap.exists) {
    throw new Error(`No existe el árbol: ${treeId}`);
  }

  const treeData = treeSnap.data() ?? {};

  const [personsSnap, relationshipsSnap] = await Promise.all([
    treeRef.collection("persons").get(),
    treeRef.collection("relationships").get(),
  ]);

  const personIds = new Set(personsSnap.docs.map((doc) => doc.id));
  const rootPersonId = treeData.rootPersonId ?? null;

  if (!rootPersonId) {
    errors.push({
      treeId,
      error: "El árbol no tiene rootPersonId.",
    });
  } else if (!personIds.has(rootPersonId)) {
    errors.push({
      treeId,
      rootPersonId,
      error: `rootPersonId referencia una persona inexistente: ${rootPersonId}`,
    });
  }

  const rootPersons = personsSnap.docs.filter(
    (doc) => doc.data().isRoot === true
  );

  if (rootPersons.length === 0) {
    warnings.push({
      treeId,
      warning: "No existe ninguna persona marcada con isRoot=true.",
    });
  }

  if (rootPersons.length > 1) {
    errors.push({
      treeId,
      rootPersonIds: rootPersons.map((doc) => doc.id),
      error: "Existe más de una persona marcada con isRoot=true.",
    });
  }

  if (
    rootPersonId &&
    rootPersons.length === 1 &&
    rootPersons[0].id !== rootPersonId
  ) {
    warnings.push({
      treeId,
      rootPersonId,
      isRootPersonId: rootPersons[0].id,
      warning:
        "rootPersonId y la persona marcada con isRoot=true no coinciden.",
    });
  }

  const relationshipKeys = new Map();
  const partnerPairs = new Map();
  const parentsByChild = new Map();

  relationshipsSnap.forEach((doc) => {
    const rel = doc.data();

    const type = rel.type;
    const fromPersonId = rel.fromPersonId;
    const toPersonId = rel.toPersonId;

    if (!VALID_RELATIONSHIP_TYPES.has(type)) {
      errors.push({
        relationshipId: doc.id,
        error: `Tipo de relación inválido: ${type}`,
      });
      return;
    }

    if (!fromPersonId || !toPersonId) {
      errors.push({
        relationshipId: doc.id,
        error: "Relación sin fromPersonId o toPersonId.",
      });
      orphanRelationshipIds.add(doc.id);
      return;
    }

    let hasMissingPerson = false;

    if (!personIds.has(fromPersonId)) {
      errors.push({
        relationshipId: doc.id,
        error: `fromPersonId no existe: ${fromPersonId}`,
      });
      hasMissingPerson = true;
    }

    if (!personIds.has(toPersonId)) {
      errors.push({
        relationshipId: doc.id,
        error: `toPersonId no existe: ${toPersonId}`,
      });
      hasMissingPerson = true;
    }

    if (hasMissingPerson) {
      orphanRelationshipIds.add(doc.id);
      return;
    }

    if (fromPersonId === toPersonId) {
      errors.push({
        relationshipId: doc.id,
        error: "Una persona no puede relacionarse consigo misma.",
      });
      return;
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
      const pairKey = partnerCanonicalKey(fromPersonId, toPersonId);
      const relationshipStatus = rel.relationshipStatus ?? "unknown";

      if (!VALID_RELATIONSHIP_STATUSES.has(relationshipStatus)) {
        errors.push({
          relationshipId: doc.id,
          relationshipStatus,
          error:
            "relationshipStatus inválido. Valores permitidos: current, former, unknown.",
        });
      }

      if (partnerPairs.has(pairKey)) {
        errors.push({
          relationshipId: doc.id,
          duplicateOf: partnerPairs.get(pairKey).relationshipId,
          error: `PARTNER_OF duplicado o inverso duplicado: ${pairKey}`,
        });
      } else {
        partnerPairs.set(pairKey, {
          relationshipId: doc.id,
          personIds: [fromPersonId, toPersonId].sort(),
          relationshipStatus,
        });
      }
    }

    if (type === "PARENT_OF") {
      const parentRole = rel.parentRole ?? null;

      if (parentRole !== null && !VALID_PARENT_ROLES.has(parentRole)) {
        errors.push({
          relationshipId: doc.id,
          parentRole,
          error:
            "parentRole inválido. Valores permitidos: father, mother o campo ausente.",
        });
      }

      if (!parentsByChild.has(toPersonId)) {
        parentsByChild.set(toPersonId, []);
      }

      parentsByChild.get(toPersonId).push({
        relationshipId: doc.id,
        parentId: fromPersonId,
        parentRole,
      });
    }
  });

  const coupleGroups = new Map();
  const coParentGroups = new Map();
  const singleParentGroups = new Map();

  for (const [childId, parents] of parentsByChild.entries()) {
    const uniqueParentIds = Array.from(
      new Set(parents.map((parent) => parent.parentId))
    );

    if (uniqueParentIds.length !== parents.length) {
      errors.push({
        childId,
        error: "El hijo/a tiene el mismo progenitor repetido en PARENT_OF.",
        parents,
      });
    }

    if (uniqueParentIds.length > 2) {
      errors.push({
        childId,
        error: "La persona tiene más de 2 progenitores registrados.",
        parents,
      });
    }

    const roles = parents
      .map((parent) => parent.parentRole)
      .filter((role) => VALID_PARENT_ROLES.has(role));

    const roleSet = new Set(roles);

    if (roles.length !== roleSet.size) {
      errors.push({
        childId,
        error: "La persona tiene parentRole duplicado: father/mother.",
        parents,
      });
    }

    if (uniqueParentIds.length === 1) {
      const parentId = uniqueParentIds[0];

      addChildToGroup(
        singleParentGroups,
        `singleParent:${parentId}`,
        [parentId],
        childId
      );

      continue;
    }

    if (uniqueParentIds.length === 2) {
      const pairKey = partnerCanonicalKey(
        uniqueParentIds[0],
        uniqueParentIds[1]
      );

      if (partnerPairs.has(pairKey)) {
        addChildToGroup(
          coupleGroups,
          pairKey,
          [...uniqueParentIds].sort(),
          childId
        );
      } else {
        // Configuración válida: dos personas comparten uno o más hijos,
        // pero no existe una relación sentimental PARTNER_OF entre ellas.
        addChildToGroup(
          coParentGroups,
          pairKey,
          [...uniqueParentIds].sort(),
          childId
        );
      }
    }
  }

  // Toda relación PARTNER_OF representa una unión couple, incluso si todavía
  // no tiene hijos compartidos registrados.
  for (const [pairKey, partnerInfo] of partnerPairs.entries()) {
    if (!coupleGroups.has(pairKey)) {
      coupleGroups.set(pairKey, {
        parentIds: partnerInfo.personIds,
        childIds: [],
      });
    }
  }

  console.log("\nVALIDACIÓN DE ÁRBOL");
  console.log("==================");
  console.log(`treeId: ${treeId}`);
  console.log(`personas: ${personsSnap.size}`);
  console.log(`relaciones: ${relationshipsSnap.size}`);
  console.log(`relaciones huérfanas: ${orphanRelationshipIds.size}`);

  console.log("\nRESUMEN DE UNIONES INFERIDAS");
  console.log("============================");
  console.log(`couple: ${coupleGroups.size}`);
  console.log(`coParents: ${coParentGroups.size}`);
  console.log(`singleParent: ${singleParentGroups.size}`);

  if (coParentGroups.size > 0) {
    const sharedChildrenCount = Array.from(coParentGroups.values()).reduce(
      (total, group) => total + group.childIds.length,
      0
    );

    console.log(
      `ℹ️ ${coParentGroups.size} unión(es) coparental(es) válida(s) con ${sharedChildrenCount} hijo(s) compartido(s), sin PARTNER_OF.`
    );
  }

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

  if (orphanRelationshipIds.size > 0) {
    console.log("\nACCIÓN RECOMENDADA");
    console.log("==================");
    console.log(
      "Revisa y elimina o corrige estas relaciones huérfanas en el emulador:"
    );
    console.log(Array.from(orphanRelationshipIds).join("\n"));
    console.log(
      "El frontend las ignorará para evitar romper la visualización, pero los documentos seguirán existiendo hasta que se limpien."
    );
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Error ejecutando validación:", error);
  process.exit(1);
});