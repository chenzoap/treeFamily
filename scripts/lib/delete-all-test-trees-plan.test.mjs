import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

import {
  AUTHORIZED_TREE_IDS,
  buildDeleteAllTestTreesPlan,
  classifyDocuments,
  validateAuthorizedTrees,
  validateLocalEmulatorHost,
} from "./delete-all-test-trees-plan.mjs";

const treeDoc = (treeId) => ({
  documentPath: `trees/${treeId}`,
  collectionPath: "trees",
  documentId: treeId,
  parentDocumentPath: null,
  depth: 2,
  data: {name: "Test", rootPersonId: `root-${treeId}`},
});
const childDoc = (treeId, collection, id, data = {}) => ({
  documentPath: `trees/${treeId}/${collection}/${id}`,
  collectionPath: `trees/${treeId}/${collection}`,
  documentId: id,
  parentDocumentPath: `trees/${treeId}`,
  depth: 4,
  data,
});
const completeFixture = () => AUTHORIZED_TREE_IDS.flatMap((treeId, index) => [
  treeDoc(treeId),
  childDoc(treeId, "persons", `person-${index}`),
  childDoc(treeId, "relationships", `relationship-${index}`, {
    fromPersonId: `person-${index}`,
    toPersonId: `person-${index}`,
    type: "PARENT_OF",
  }),
]);

describe("contrato y conexión", () => {
  it("mantiene la lista contractual exacta de ocho árboles", () => {
    assert.deepEqual(AUTHORIZED_TREE_IDS, [
      "33YN4tiAbilBAuDR3NVh",
      "3PdSi2awLCAwZTeCoFvA",
      "H9Yg5ZlF8Tq3HHz1sfsW",
      "gib7tREAAsXDQX4Qh3Oh",
      "gshWd4MXivIlOBKLQbvn",
      "kXF9ZeSASxkDtDQQ2ALj",
      "pivZ2GYKKyaqM1tAbzOX",
      "tmXjFYRA9jIfW1cFAoXR",
    ]);
  });
  it("un árbol adicional provoca stale", () => {
    assert.equal(
      validateAuthorizedTrees([...AUTHORIZED_TREE_IDS, "extra"]).status,
      "stale",
    );
  });
  it("un árbol faltante provoca stale", () => {
    assert.equal(
      validateAuthorizedTrees(AUTHORIZED_TREE_IDS.slice(1)).status,
      "stale",
    );
  });
  it("rechaza host ausente", () => {
    assert.equal(validateLocalEmulatorHost("").ok, false);
  });
  it("rechaza host remoto", () => {
    assert.equal(validateLocalEmulatorHost("firestore.googleapis.com").ok, false);
  });
});

describe("clasificación", () => {
  const validation = validateAuthorizedTrees(AUTHORIZED_TREE_IDS);
  it("clasifica árbol, persona y relación como delete", () => {
    const treeId = AUTHORIZED_TREE_IDS[0];
    const result = classifyDocuments([
      treeDoc(treeId),
      childDoc(treeId, "persons", "p1"),
      childDoc(treeId, "relationships", "r1"),
    ], validation);
    assert.deepEqual(
      result.proposedDeletes.map(({operation}) => operation),
      ["delete", "delete", "delete"],
    );
  });
  it("inventa recursivamente una subcolección desconocida", () => {
    const treeId = AUTHORIZED_TREE_IDS[0];
    const unknown = childDoc(treeId, "legacy", "x");
    const result = classifyDocuments([treeDoc(treeId), unknown], validation);
    assert.ok(result.proposedDeletes.some(
      ({documentPath}) => documentPath === unknown.documentPath,
    ));
  });
  it("clasifica activeTreeId como clear-reference", () => {
    const document = {
      documentPath: "profiles/u1",
      collectionPath: "profiles",
      documentId: "u1",
      depth: 2,
      data: {activeTreeId: AUTHORIZED_TREE_IDS[0]},
    };
    const result = classifyDocuments([document], validation);
    assert.equal(result.proposedReferenceUpdates[0].operation, "clear-reference");
    assert.equal(
      result.proposedReferenceUpdates[0].futureOperations[0].operation,
      "FieldValue.delete()",
    );
  });
  it("clasifica array treeIds como clear-reference", () => {
    const document = {
      documentPath: "profiles/u1",
      collectionPath: "profiles",
      documentId: "u1",
      depth: 2,
      data: {treeIds: [AUTHORIZED_TREE_IDS[0], "unrelated"]},
    };
    const result = classifyDocuments([document], validation);
    assert.equal(
      result.proposedReferenceUpdates[0].futureOperations[0].operation,
      "remove-authorized-treeIds-from-array",
    );
  });
  it("preserva un perfil sin referencias", () => {
    const document = {
      documentPath: "profiles/u1",
      collectionPath: "profiles",
      documentId: "u1",
      depth: 2,
      data: {displayPreferences: {theme: "dark"}},
    };
    assert.equal(
      classifyDocuments([document], validation).preservedDocuments[0].operation,
      "preserve",
    );
  });
  it("un documento ambiguo queda unresolved y vacía el plan", () => {
    const document = {
      documentPath: "legacy/x",
      collectionPath: "legacy",
      documentId: "x",
      depth: 2,
      data: {mystery: AUTHORIZED_TREE_IDS[0]},
    };
    const result = classifyDocuments([treeDoc(AUTHORIZED_TREE_IDS[0]), document], validation);
    assert.equal(result.unresolvedDocuments.length, 1);
    assert.equal(result.proposedDeletes.length, 0);
    assert.equal(result.proposedReferenceUpdates.length, 0);
  });
  it("deduplica documentos, ordena y pone hijos antes del padre", () => {
    const treeId = AUTHORIZED_TREE_IDS[0];
    const parent = treeDoc(treeId);
    const child = childDoc(treeId, "persons", "p1");
    const result = classifyDocuments([parent, child, child], validation);
    assert.equal(result.all.length, 2);
    assert.equal(result.all[0].documentPath, child.documentPath);
    assert.deepEqual(
      result.all.map(({documentPath}) => documentPath),
      [...result.all].map(({documentPath}) => documentPath),
    );
  });
});

describe("plan y proyección", () => {
  it("proyecta cero árboles y conteo exacto de escrituras", () => {
    const documents = completeFixture();
    const plan = buildDeleteAllTestTreesPlan({
      documents,
      discoveredCollections: ["trees"],
    });
    assert.equal(plan.summary.ready, true);
    assert.equal(plan.projectedFinalState.trees, 0);
    assert.equal(plan.projectedFinalState.persons, 0);
    assert.equal(plan.projectedFinalState.relationships, 0);
    assert.equal(plan.summary.estimatedFutureWrites, documents.length);
  });
  it("detecta referencias colgantes mediante unresolved", () => {
    const plan = buildDeleteAllTestTreesPlan({
      documents: [
        ...completeFixture(),
        {
          documentPath: "legacy/x",
          collectionPath: "legacy",
          documentId: "x",
          depth: 2,
          data: {unknownLink: AUTHORIZED_TREE_IDS[0]},
        },
      ],
      discoveredCollections: ["legacy", "trees"],
    });
    assert.equal(plan.summary.ready, false);
    assert.equal(plan.projectedFinalState.demonstrated, false);
  });
  it("no incluye Auth y no modifica datos de entrada", () => {
    const documents = completeFixture();
    const before = structuredClone(documents);
    const plan = buildDeleteAllTestTreesPlan({
      documents,
      discoveredCollections: ["trees"],
    });
    assert.equal(plan.summary.authDeletes, 0);
    assert.equal(plan.inputUnchanged, true);
    assert.deepEqual(documents, before);
    assert.doesNotMatch(JSON.stringify(plan), /"auth"\s*:/i);
  });
});

describe("garantías estáticas", () => {
  it("no existe modo apply ni APIs de escritura", async () => {
    const module = await import("./delete-all-test-trees-plan.mjs");
    assert.equal(Object.keys(module).some((name) => /apply/i.test(name)), false);
    const cli = await readFile(
      new URL("../prepare-delete-all-test-trees.mjs", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(cli, /--apply|runTransaction|writeBatch|bulkWriter|recursiveDelete|transaction\./);
    assert.doesNotMatch(cli, /\.update\(|\.set\(/);
  });
  it("la salida no contiene claves sensibles", () => {
    const documents = completeFixture();
    documents[0].data.ownerId = "secret";
    const plan = buildDeleteAllTestTreesPlan({
      documents,
      discoveredCollections: ["trees"],
    });
    const serialized = JSON.stringify(plan);
    assert.doesNotMatch(serialized, /"ownerId"|"email"|"auth"\s*:/i);
  });
});

