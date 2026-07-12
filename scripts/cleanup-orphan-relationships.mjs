import admin from "firebase-admin";

const args = new Set(process.argv.slice(2));
const applyChanges = args.has("--apply");
const treeId = process.env.TREE_ID ?? "demo-tree-001";

process.env.FIRESTORE_EMULATOR_HOST =
process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

if (admin.apps.length === 0) {
admin.initializeApp({
projectId: "tree-gen-chenzoap-2026",
});
}

const db = admin.firestore();

function chunk(items, size) {
const result = [];

for (let index = 0; index < items.length; index += size) {
result.push(items.slice(index, index + size));
}

return result;
}

async function findOrphanRelationships(treeRef) {
const [personsSnap, relationshipsSnap] = await Promise.all([
treeRef.collection("persons").get(),
treeRef.collection("relationships").get(),
]);

const personIds = new Set(personsSnap.docs.map((doc) => doc.id));
const orphanRelationships = [];

relationshipsSnap.forEach((doc) => {
const relationship = doc.data();
const fromPersonId = relationship.fromPersonId;
const toPersonId = relationship.toPersonId;

```
const missingFrom =
  typeof fromPersonId !== "string" ||
  fromPersonId.trim() === "" ||
  !personIds.has(fromPersonId);

const missingTo =
  typeof toPersonId !== "string" ||
  toPersonId.trim() === "" ||
  !personIds.has(toPersonId);

if (!missingFrom && !missingTo) return;

orphanRelationships.push({
  id: doc.id,
  ref: doc.ref,
  type: relationship.type ?? null,
  fromPersonId: fromPersonId ?? null,
  toPersonId: toPersonId ?? null,
  missingFrom,
  missingTo,
});
```

});

return {
personCount: personsSnap.size,
relationshipCount: relationshipsSnap.size,
orphanRelationships,
};
}

async function deleteOrphanRelationships(orphanRelationships) {
// Firestore permite hasta 500 operaciones por batch.
// Usamos 450 para mantener un margen de seguridad.
const batches = chunk(orphanRelationships, 450);
let deletedCount = 0;

for (const group of batches) {
const batch = db.batch();

```
group.forEach(({ ref }) => {
  batch.delete(ref);
});

await batch.commit();
deletedCount += group.length;
```

}

return deletedCount;
}

async function main() {
const treeRef = db.collection("trees").doc(treeId);
const treeSnap = await treeRef.get();

if (!treeSnap.exists) {
throw new Error(`No existe el árbol: ${treeId}`);
}

const {
personCount,
relationshipCount,
orphanRelationships,
} = await findOrphanRelationships(treeRef);

console.log("\nLIMPIEZA DE RELACIONES HUÉRFANAS");
console.log("================================");
console.log(`treeId: ${treeId}`);
console.log(`personas: ${personCount}`);
console.log(`relaciones: ${relationshipCount}`);
console.log(`relaciones huérfanas: ${orphanRelationships.length}`);
console.log(`modo: ${applyChanges ? "APLICAR CAMBIOS" : "SOLO REVISIÓN"}`);

if (orphanRelationships.length === 0) {
console.log("\n✅ No se encontraron relaciones huérfanas.");
return;
}

console.log("\nRELACIONES DETECTADAS");
console.log("=====================");

orphanRelationships.forEach((relationship) => {
const problems = [];


if (relationship.missingFrom) {
  problems.push(`fromPersonId inválido: ${relationship.fromPersonId}`);
}

if (relationship.missingTo) {
  problems.push(`toPersonId inválido: ${relationship.toPersonId}`);
}

console.log(`- ${relationship.id}`);
console.log(`  tipo: ${relationship.type ?? "sin tipo"}`);
console.log(`  ${problems.join(" | ")}`);

});

if (!applyChanges) {
console.log("\nℹ️ No se modificó Firestore.");
console.log("Para eliminar únicamente estas relaciones, ejecuta:");
console.log(
`TREE_ID="${treeId}" node scripts/cleanup-orphan-relationships.mjs --apply`
);
return;
}

const deletedCount = await deleteOrphanRelationships(
orphanRelationships
);

console.log(`\n✅ Relaciones eliminadas: ${deletedCount}`);
console.log(
"Ejecuta nuevamente npm run validate:tree para confirmar el estado del árbol."
);
}

main().catch((error) => {
console.error("\n❌ Error durante la limpieza:", error);
process.exitCode = 1;
});
