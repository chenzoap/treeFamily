import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {describe, it} from "node:test";

import {parseArguments} from "../delete-all-test-trees.mjs";
import {
  CONFIRM_PHRASE,
  EXPECTED_COUNTS,
  EXPECTED_PROJECT_ID,
  buildExecutionPlan,
  canonicalizePlan,
  executeAtomicDeletion,
  fingerprintPlan,
  validateBackup,
  validateConfirmations,
  validateConnection,
  validateExecutionPlan,
  validateOutputPath,
} from "./delete-all-test-trees-execution.mjs";
import {
  AUTHORIZED_TREE_IDS,
  buildDeleteAllTestTreesPlan,
} from "./delete-all-test-trees-plan.mjs";

const document = (documentPath, data = {}) => {
  const segments = documentPath.split("/");
  return {
    documentPath,
    collectionPath: segments.slice(0, -1).join("/"),
    documentId: segments.at(-1),
    parentDocumentPath:
      segments.length === 4 ? segments.slice(0, 2).join("/") : null,
    depth: segments.length,
    data,
  };
};

const exactDocuments = () => {
  const result = AUTHORIZED_TREE_IDS.map((id) => document(`trees/${id}`));
  for (let index = 0; index < EXPECTED_COUNTS.persons; index += 1) {
    const treeId = AUTHORIZED_TREE_IDS[index % AUTHORIZED_TREE_IDS.length];
    result.push(document(`trees/${treeId}/persons/p${index}`));
  }
  for (let index = 0; index < EXPECTED_COUNTS.relationships; index += 1) {
    const treeId = AUTHORIZED_TREE_IDS[index % AUTHORIZED_TREE_IDS.length];
    result.push(document(`trees/${treeId}/relationships/r${index}`, {
      type: "PARENT_OF",
    }));
  }
  return result;
};

const exact = () => buildExecutionPlan({
  documents: exactDocuments(),
  discoveredCollections: ["trees"],
});

describe("contrato, canonicalización y estado", () => {
  it("acepta exactamente 8/76/105/189, ordena hijos y calcula SHA-256", () => {
    const result = exact();
    assert.equal(result.status, "eligible");
    assert.equal(result.plan.summary.deleteDocuments, 189);
    assert.match(result.planSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      result.plan.deletionPlan.slice(0, 181).every(
        ({documentPath}) => documentPath.split("/").length === 4,
      ),
      true,
    );
  });

  it("el fingerprint es determinista, ignora orden y cambia con una ruta", () => {
    const original = exact();
    const reorderedPlan = buildDeleteAllTestTreesPlan({
      documents: exactDocuments().reverse(),
      discoveredCollections: ["trees"],
    });
    assert.equal(
      fingerprintPlan({projectId: EXPECTED_PROJECT_ID, plan: reorderedPlan}),
      original.planSha256,
    );
    const changed = structuredClone(original.plan);
    changed.deletionPlan[0].documentPath += "-changed";
    assert.notEqual(
      fingerprintPlan({projectId: EXPECTED_PROJECT_ID, plan: changed}),
      original.planSha256,
    );
    assert.equal(
      canonicalizePlan({projectId: EXPECTED_PROJECT_ID, plan: original.plan}),
      canonicalizePlan({projectId: EXPECTED_PROJECT_ID, plan: original.plan}),
    );
  });

  it("acepta vacío idempotente y rechaza estados parciales", () => {
    assert.equal(buildExecutionPlan({
      documents: [],
      discoveredCollections: [],
    }).status, "already-empty");
    assert.throws(() => buildExecutionPlan({
      documents: exactDocuments().slice(1),
      discoveredCollections: ["trees"],
    }), /Cantidades|árboles|Plan/);
  });

  it("rechaza árboles, personas, relaciones, rutas y colecciones inesperadas", () => {
    const variants = [
      [...exactDocuments(), document("trees/extra")],
      exactDocuments().filter(({documentPath}) => !documentPath.endsWith("/p0")),
      [...exactDocuments(), document(`trees/${AUTHORIZED_TREE_IDS[0]}/persons/extra`)],
      exactDocuments().filter(({documentPath}) => !documentPath.endsWith("/r0")),
      [...exactDocuments(), document(`trees/${AUTHORIZED_TREE_IDS[0]}/relationships/extra`)],
      [...exactDocuments(), document(`trees/${AUTHORIZED_TREE_IDS[0]}/legacy/x`)],
      [...exactDocuments(), exactDocuments()[0]],
    ];
    for (const documents of variants) {
      assert.throws(() => buildExecutionPlan({
        documents,
        discoveredCollections: ["trees"],
      }));
    }
    assert.throws(() => buildExecutionPlan({
      documents: exactDocuments(),
      discoveredCollections: ["profiles", "trees"],
    }), /Colección raíz/);
  });

  it("rechaza clear-reference, unresolved y referencias externas", () => {
    const base = exactDocuments();
    for (const extra of [
      document("profiles/u1", {activeTreeId: AUTHORIZED_TREE_IDS[0]}),
      document("legacy/x", {mystery: AUTHORIZED_TREE_IDS[0]}),
    ]) {
      const plan = buildDeleteAllTestTreesPlan({
        documents: [...base, extra],
        discoveredCollections: [extra.collectionPath, "trees"].sort(),
      });
      assert.throws(() => validateExecutionPlan({
        plan,
        documents: [...base, extra],
        discoveredCollections: [extra.collectionPath, "trees"].sort(),
      }));
    }
  });
});

describe("host, CLI, confirmaciones y salidas", () => {
  it("valida loopback con puerto y rechaza host ausente, remoto, URL o proyecto", () => {
    for (const host of ["localhost:8180", "127.0.0.1:8180", "[::1]:8180"]) {
      assert.equal(validateConnection({
        emulatorHost: host,
        projectId: EXPECTED_PROJECT_ID,
      }), host);
    }
    for (const host of ["", "remote:8180", "https://localhost:8180", "127.0.0.1"]) {
      assert.throws(() => validateConnection({
        emulatorHost: host,
        projectId: EXPECTED_PROJECT_ID,
      }));
    }
    assert.throws(() => validateConnection({
      emulatorHost: "127.0.0.1:8180",
      projectId: "wrong",
    }), /Project ID/);
  });

  it("el CLI es dry-run salvo --apply y valida rutas de salida", () => {
    assert.equal(parseArguments([]).apply, false);
    assert.equal(parseArguments(["--apply"]).apply, true);
    assert.equal(validateOutputPath("/tmp/report.json"), "/tmp/report.json");
    for (const output of [
      ".firebase-seed/x",
      "/tmp/.firebase-seed/x",
      "/tmp/firestore_export/x",
      "/tmp/auth_export/x",
    ]) assert.throws(() => validateOutputPath(output));
  });

  it("exige las cinco confirmaciones exactas", () => {
    const sha = exact().planSha256;
    const valid = {
      confirmProjectId: EXPECTED_PROJECT_ID,
      confirmTreeCount: 8,
      confirmDocumentCount: 189,
      confirmPlanSha256: sha,
      confirmPhrase: CONFIRM_PHRASE,
    };
    assert.equal(Object.values(validateConfirmations(valid, sha)).every(Boolean), true);
    for (const key of Object.keys(valid)) {
      assert.throws(() => validateConfirmations({...valid, [key]: "wrong"}, sha));
    }
  });
});

const createBackup = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "treefamily-backup-test-"));
  const backup = path.join(root, ".firebase-backups", "specific");
  await mkdir(path.join(backup, "firestore_export/all_namespaces/all_kinds"), {
    recursive: true,
  });
  const files = {
    "firebase-export-metadata.json": "{}\n",
    "firestore_export/firestore_export.overall_export_metadata": "metadata\n",
    "firestore_export/all_namespaces/all_kinds/output-0": "data\n",
  };
  for (const [relative, content] of Object.entries(files)) {
    await writeFile(path.join(backup, relative), content);
  }
  const sums = Object.entries(files).map(([relative, content]) =>
    `${createHash("sha256").update(content).digest("hex")}  ./${relative}`,
  ).join("\n");
  await writeFile(path.join(backup, "SHA256SUMS"), `${sums}\n`);
  return {root, backup};
};

describe("respaldo", () => {
  it("valida un export específico completo sin modificarlo", async () => {
    const {root, backup} = await createBackup();
    const before = await readFile(path.join(backup, "SHA256SUMS"), "utf8");
    assert.equal((await validateBackup(backup, root)).ok, true);
    assert.equal(await readFile(path.join(backup, "SHA256SUMS"), "utf8"), before);
  });

  it("rechaza inexistente, symlink, metadata/SHA faltante, hash y traversal", async () => {
    const {root, backup} = await createBackup();
    await assert.rejects(validateBackup(path.join(root, ".firebase-backups/no"), root));
    const link = path.join(root, ".firebase-backups/link");
    await symlink(backup, link);
    await assert.rejects(validateBackup(link, root), /symlink/);
    const missingMetadata = await createBackup();
    await unlink(path.join(missingMetadata.backup, "firebase-export-metadata.json"));
    await assert.rejects(validateBackup(missingMetadata.backup, missingMetadata.root));
    const missingManifest = await createBackup();
    await unlink(path.join(missingManifest.backup, "SHA256SUMS"));
    await assert.rejects(validateBackup(missingManifest.backup, missingManifest.root));
    const unsafe = await createBackup();
    const validLine = (await readFile(path.join(unsafe.backup, "SHA256SUMS"), "utf8"))
      .split("\n")[0];
    for (const manifest of [
      "",
      `${"0".repeat(64)}  ./firebase-export-metadata.json\n`,
      `${"0".repeat(64)}  ../outside\n`,
      `${"0".repeat(64)}  /absolute\n`,
      `${validLine}\n${validLine}\n`,
    ]) {
      await writeFile(path.join(unsafe.backup, "SHA256SUMS"), manifest);
      await assert.rejects(validateBackup(unsafe.backup, unsafe.root));
    }
  });
});

const fakeDatabase = (documents, {failCommit = false} = {}) => {
  const byPath = new Map(documents.map((entry) => [entry.documentPath, entry]));
  const deleted = [];
  const docRef = (documentPath) => ({
    path: documentPath,
    id: documentPath.split("/").at(-1),
    parent: {path: documentPath.split("/").slice(0, -1).join("/")},
    collection: (name) => collectionRef(`${documentPath}/${name}`),
  });
  const collectionRef = (collectionPath) => ({
    path: collectionPath,
    doc: (id) => docRef(`${collectionPath}/${id}`),
  });
  const snapshotFor = (reference) => {
    if (reference.path.split("/").length % 2 === 0) {
      const entry = byPath.get(reference.path);
      return {
        exists: Boolean(entry),
        id: reference.id,
        data: () => entry?.data,
      };
    }
    return {
      docs: documents.filter(({collectionPath}) => collectionPath === reference.path)
        .map((entry) => ({
          id: entry.documentId,
          ref: docRef(entry.documentPath),
          data: () => entry.data,
        })),
    };
  };
  const database = {
    collection: collectionRef,
    doc: docRef,
    runTransaction: async (callback) => {
      const pending = [];
      const result = await callback({
        get: async (reference) => snapshotFor(reference),
        delete: (reference) => pending.push(reference.path),
      });
      if (failCommit) throw new Error("commit failed");
      deleted.push(...pending);
      return result;
    },
  };
  return {database, deleted};
};

describe("atomicidad y Auth", () => {
  it("programa exactamente 189 deletes en una transacción", async () => {
    const preflight = exact();
    const fake = fakeDatabase(exactDocuments());
    const result = await executeAtomicDeletion({
      database: fake.database,
      confirmedPlanSha256: preflight.planSha256,
      preflight,
    });
    assert.equal(result.writesExecuted, 189);
    assert.equal(fake.deleted.length, 189);
    assert.equal(fake.deleted.slice(0, 181).every((item) => item.split("/").length === 4), true);
  });

  it("cambio transaccional o error de commit deja cero commits", async () => {
    const preflight = exact();
    const changed = exactDocuments().filter(({documentPath}) => !documentPath.endsWith("/p0"));
    const mismatch = fakeDatabase(changed);
    await assert.rejects(executeAtomicDeletion({
      database: mismatch.database,
      confirmedPlanSha256: preflight.planSha256,
      preflight,
    }));
    assert.equal(mismatch.deleted.length, 0);
    const failed = fakeDatabase(exactDocuments(), {failCommit: true});
    await assert.rejects(executeAtomicDeletion({
      database: failed.database,
      confirmedPlanSha256: preflight.planSha256,
      preflight,
    }));
    assert.equal(failed.deleted.length, 0);
  });

  it("already-empty no abre transacción, no escribe y no hay dependencia Auth", async () => {
    const result = await executeAtomicDeletion({
      database: {runTransaction: () => assert.fail("no transaction")},
      confirmedPlanSha256: null,
      preflight: {status: "already-empty"},
    });
    assert.equal(result.writesExecuted, 0);
    const source = await readFile(
      new URL("./delete-all-test-trees-execution.mjs", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /firebase-admin\/auth|getAuth|deleteUser|auth\(\)/);
  });

  it("la preparación histórica sigue sin --apply ni APIs de escritura", async () => {
    const source = await readFile(
      new URL("../prepare-delete-all-test-trees.mjs", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /--apply|runTransaction|transaction\.delete/);
  });
});
