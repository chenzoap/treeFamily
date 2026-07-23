import admin from "firebase-admin";
import { pathToFileURL } from "node:url";

const TREE_ID = "demo-tree-001";
const PROJECT_ID = "tree-gen-chenzoap-2026";

// Apunta al emulador Firestore
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const persons = [
  { id: "p_root", firstName: "Fernando", lastName: "Root" },
  { id: "p_sp1", firstName: "Ana", lastName: "Pareja1" },
  { id: "p_c1", firstName: "Luis", lastName: "Hijo1" },
  { id: "p_sp2", firstName: "Carla", lastName: "Pareja2" },
  { id: "p_c2", firstName: "Mia", lastName: "Hijo2" },
  { id: "p_gp1", firstName: "Jose", lastName: "PadreRoot" },
  { id: "p_gp2", firstName: "Rosa", lastName: "MadreRoot" }
];

const VALID_PARENT_ROLES = new Set(["father", "mother"]);

export function createParentRelationship({
  id,
  fromPersonId,
  toPersonId,
  parentRole,
}) {
  if (!VALID_PARENT_ROLES.has(parentRole)) {
    throw new TypeError(
      `La relación parental ${id ?? "(sin id)"} requiere parentRole father o mother.`,
    );
  }

  return {
    id,
    type: "PARENT_OF",
    fromPersonId,
    toPersonId,
    parentRole,
  };
}

const relationships = [
  // Padres de Root
  createParentRelationship({
    id: "r_gp1_root",
    fromPersonId: "p_gp1",
    toPersonId: "p_root",
    parentRole: "father",
  }),
  createParentRelationship({
    id: "r_gp2_root",
    fromPersonId: "p_gp2",
    toPersonId: "p_root",
    parentRole: "mother",
  }),

  // Pareja 1 + hijo
  { id: "r_partner_root_sp1", type: "PARTNER_OF", fromPersonId: "p_root", toPersonId: "p_sp1" },
  createParentRelationship({
    id: "r_root_c1",
    fromPersonId: "p_root",
    toPersonId: "p_c1",
    parentRole: "father",
  }),
  createParentRelationship({
    id: "r_sp1_c1",
    fromPersonId: "p_sp1",
    toPersonId: "p_c1",
    parentRole: "mother",
  }),

  // Re-matrimonio: Pareja 2 + hijo
  { id: "r_partner_root_sp2", type: "PARTNER_OF", fromPersonId: "p_root", toPersonId: "p_sp2" },
  createParentRelationship({
    id: "r_root_c2",
    fromPersonId: "p_root",
    toPersonId: "p_c2",
    parentRole: "father",
  }),
  createParentRelationship({
    id: "r_sp2_c2",
    fromPersonId: "p_sp2",
    toPersonId: "p_c2",
    parentRole: "mother",
  }),
];

async function setDocIfMissing(docRef, data) {
  const snap = await docRef.get();
  if (!snap.exists) await docRef.set({ ...data, createdAt: Date.now() });
}

async function main() {
  const treeRef = db.collection("trees").doc(TREE_ID);

  // persons
  for (const p of persons) {
    const ref = treeRef.collection("persons").doc(p.id);
    await setDocIfMissing(ref, p);
  }

  // relationships
  for (const r of relationships) {
    if (r.type === "PARENT_OF" && !VALID_PARENT_ROLES.has(r.parentRole)) {
      throw new TypeError(
        `La relación parental ${r.id} requiere parentRole father o mother.`,
      );
    }
    const ref = treeRef.collection("relationships").doc(r.id);
    await setDocIfMissing(ref, r);
  }

  console.log(`✅ Seed OK: treeId=${TREE_ID} persons=${persons.length} relationships=${relationships.length}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((e) => {
    console.error("❌ Seed error", e);
    process.exit(1);
  });
}
