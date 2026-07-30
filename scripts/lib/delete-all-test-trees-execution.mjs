import {createHash} from "node:crypto";
import {lstat, readFile} from "node:fs/promises";
import path from "node:path";

import {
  AUTHORIZED_TREE_IDS,
  buildDeleteAllTestTreesPlan,
  crawlFirestoreDatabase,
  validateLocalEmulatorHost,
} from "./delete-all-test-trees-plan.mjs";

export const EXPECTED_PROJECT_ID = "tree-gen-chenzoap-2026";
export const EXPECTED_COUNTS = Object.freeze({
  trees: 8,
  persons: 76,
  relationships: 105,
  documents: 189,
});
export const CONFIRM_PHRASE = "DELETE_ALL_8_TEST_TREES";

const compareText = (left, right) => left.localeCompare(right);
const allowedPath = new RegExp(
  `^trees/(${AUTHORIZED_TREE_IDS.join("|")})(?:/(persons|relationships)/[^/]+)?$`,
);
const protectedOutputParts = new Set([
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
  "firestore_export",
  "auth_export",
]);

export const validateOutputPath = (value) => {
  if (!path.isAbsolute(value)) throw new Error(`La salida debe ser absoluta: ${value}`);
  if (value.split(path.sep).some((part) => protectedOutputParts.has(part))) {
    throw new Error(`Salida dentro de datos protegidos: ${value}`);
  }
  return value;
};

export const validateConnection = ({emulatorHost, projectId}) => {
  const host = validateLocalEmulatorHost(emulatorHost);
  if (!host.ok || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host.host)) {
    throw new Error(host.ok ? "El host debe incluir un puerto válido." : host.message);
  }
  if (projectId !== EXPECTED_PROJECT_ID) throw new Error("Project ID no autorizado.");
  return host.host;
};

const canonicalString = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalString).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) =>
      `${JSON.stringify(key)}:${canonicalString(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const canonicalizePlan = ({projectId, plan}) => canonicalString({
  projectId,
  treeIds: [...AUTHORIZED_TREE_IDS].sort(compareText),
  operations: plan.deletionPlan.map(({documentPath, operation}) => ({
    path: documentPath,
    operation,
  })).sort((left, right) => compareText(left.path, right.path)),
  counts: {
    trees: plan.inventory.treeCount,
    persons: plan.inventory.personCount,
    relationships: plan.inventory.relationshipCount,
    documents: plan.summary.deleteDocuments,
    updates: plan.summary.clearReferenceDocuments,
    externalReferences: plan.summary.clearReferenceDocuments,
    unresolved: plan.summary.unresolvedDocuments,
    authOperations: 0,
  },
});

export const fingerprintPlan = (input) =>
  createHash("sha256").update(canonicalizePlan(input)).digest("hex");

export const validateExecutionPlan = ({
  plan,
  discoveredCollections,
  documents,
  allowEmpty = true,
}) => {
  const actualTreeIds = documents
    .filter(({documentPath}) => /^trees\/[^/]+$/.test(documentPath))
    .map(({documentId}) => documentId)
    .sort(compareText);
  const onlyExpectedEmptyRoot =
    discoveredCollections.length === 0 ||
    (discoveredCollections.length === 1 && discoveredCollections[0] === "trees");
  if (
    allowEmpty &&
    documents.length === 0 &&
    onlyExpectedEmptyRoot
  ) {
    return {
      status: "already-empty",
      actualTreeIds,
      residualRootCollectionIds: [...discoveredCollections],
    };
  }
  const errors = [];
  if (discoveredCollections.length !== 1 || discoveredCollections[0] !== "trees") {
    errors.push("Colección raíz inesperada.");
  }
  const paths = documents.map(({documentPath}) => documentPath);
  if (new Set(paths).size !== paths.length) errors.push("Ruta duplicada.");
  if (paths.some((item) => !allowedPath.test(item))) {
    errors.push("Ruta fuera del contrato o de la allowlist.");
  }
  if (!plan.summary.ready) errors.push("Plan no listo.");
  if (plan.referenceCleanupPlan.length) errors.push("Existen clear-reference.");
  if (plan.unresolvedDocuments.length) errors.push("Existen unresolved.");
  const expected = EXPECTED_COUNTS;
  if (
    plan.inventory.treeCount !== expected.trees ||
    plan.inventory.personCount !== expected.persons ||
    plan.inventory.relationshipCount !== expected.relationships ||
    plan.summary.deleteDocuments !== expected.documents
  ) {
    errors.push("Cantidades contractuales diferentes.");
  }
  if (
    actualTreeIds.join("\0") !== [...AUTHORIZED_TREE_IDS].sort(compareText).join("\0")
  ) errors.push("Conjunto de árboles diferente.");
  if (errors.length) throw new Error(errors.join(" "));
  const roots = plan.deletionPlan.filter(({documentPath}) =>
    documentPath.split("/").length === 2,
  );
  const descendants = plan.deletionPlan.filter(({documentPath}) =>
    documentPath.split("/").length === 4,
  );
  if (roots.length !== 8 || descendants.length !== 181) {
    throw new Error("Orden o profundidad documental inválida.");
  }
  const firstRoot = plan.deletionPlan.findIndex(({documentPath}) =>
    documentPath.split("/").length === 2,
  );
  if (plan.deletionPlan.slice(firstRoot).some(({documentPath}) =>
    documentPath.split("/").length !== 2,
  )) throw new Error("Los descendientes deben preceder a los árboles.");
  return {status: "eligible", actualTreeIds, residualRootCollectionIds: []};
};

export const buildExecutionPlan = ({documents, discoveredCollections}) => {
  const plan = buildDeleteAllTestTreesPlan({documents, discoveredCollections});
  const validation = validateExecutionPlan({
    plan,
    discoveredCollections,
    documents,
  });
  return {
    plan,
    ...validation,
    planSha256:
      validation.status === "eligible"
        ? fingerprintPlan({projectId: EXPECTED_PROJECT_ID, plan})
        : null,
  };
};

export const validateConfirmations = (options, planSha256) => {
  const checks = {
    projectId: options.confirmProjectId === EXPECTED_PROJECT_ID,
    treeCount: options.confirmTreeCount === EXPECTED_COUNTS.trees,
    documentCount: options.confirmDocumentCount === EXPECTED_COUNTS.documents,
    planSha256: options.confirmPlanSha256 === planSha256,
    phrase: options.confirmPhrase === CONFIRM_PHRASE,
  };
  if (Object.values(checks).includes(false)) throw new Error("Confirmaciones incompletas o incorrectas.");
  return checks;
};

export const validateBackup = async (backupPath, projectRoot) => {
  if (!path.isAbsolute(backupPath)) throw new Error("Backup debe ser absoluto.");
  const resolved = path.resolve(backupPath);
  const backupRoot = path.join(projectRoot, ".firebase-backups");
  if (
    resolved === backupRoot ||
    !resolved.startsWith(`${backupRoot}${path.sep}`) ||
    [".firebase-seed", ".firebase-sessions"].some((name) =>
      resolved.includes(`${path.sep}${name}${path.sep}`),
    )
  ) throw new Error("Ruta de backup no autorizada.");
  const stat = await lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Backup inválido o symlink.");
  const required = [
    "firebase-export-metadata.json",
    "firestore_export/firestore_export.overall_export_metadata",
    "firestore_export/all_namespaces/all_kinds/output-0",
    "SHA256SUMS",
  ];
  for (const relative of required) {
    const info = await lstat(path.join(resolved, relative));
    if (!info.isFile() || info.size === 0 || info.isSymbolicLink()) {
      throw new Error(`Archivo de backup inválido: ${relative}`);
    }
  }
  JSON.parse(await readFile(path.join(resolved, "firebase-export-metadata.json"), "utf8"));
  const manifest = await readFile(path.join(resolved, "SHA256SUMS"), "utf8");
  const seen = new Set();
  for (const line of manifest.trim().split("\n")) {
    const match = /^([a-f0-9]{64})  \.?\/?(.+)$/.exec(line);
    if (!match) throw new Error("Línea SHA256SUMS inválida.");
    const relative = match[2];
    if (path.isAbsolute(relative) || relative.split("/").includes("..") || seen.has(relative)) {
      throw new Error("Ruta insegura o duplicada en SHA256SUMS.");
    }
    seen.add(relative);
    const content = await readFile(path.join(resolved, relative));
    if (createHash("sha256").update(content).digest("hex") !== match[1]) {
      throw new Error(`Hash incorrecto: ${relative}`);
    }
  }
  for (const relative of required.slice(0, 3)) {
    if (!seen.has(relative)) throw new Error(`Archivo no declarado: ${relative}`);
  }
  for (const relative of ["auth_export/accounts.json", "auth_export/config.json"]) {
    try {
      const content = await readFile(path.join(resolved, relative), "utf8");
      JSON.parse(content);
      if (!seen.has(relative)) throw new Error(`Auth no declarado: ${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return {ok: true, path: resolved, declaredFiles: seen.size};
};

export const preflightDatabase = async (database) => {
  const crawl = await crawlFirestoreDatabase(database);
  return {
    ...crawl,
    ...buildExecutionPlan({
      documents: crawl.documents,
      discoveredCollections: crawl.rootCollectionIds,
    }),
  };
};

const transactionDocuments = async (database, transaction) => {
  const documents = [];
  for (const treeId of AUTHORIZED_TREE_IDS) {
    const root = database.collection("trees").doc(treeId);
    const [tree, persons, relationships] = await Promise.all([
      transaction.get(root),
      transaction.get(root.collection("persons")),
      transaction.get(root.collection("relationships")),
    ]);
    if (tree.exists) {
      documents.push({
        documentPath: root.path, collectionPath: "trees", documentId: tree.id,
        parentDocumentPath: null, depth: 2, data: tree.data(),
      });
    }
    for (const snapshot of [...persons.docs, ...relationships.docs]) {
      documents.push({
        documentPath: snapshot.ref.path,
        collectionPath: snapshot.ref.parent.path,
        documentId: snapshot.id,
        parentDocumentPath: root.path,
        depth: 4,
        data: snapshot.data(),
      });
    }
  }
  return documents;
};

export const executeAtomicDeletion = async ({
  database,
  confirmedPlanSha256,
  preflight,
}) => {
  if (preflight.status === "already-empty") {
    return {transactionAttempted: false, transactionCommitted: false, writesExecuted: 0};
  }
  return database.runTransaction(async (transaction) => {
    const documents = await transactionDocuments(database, transaction);
    const current = buildExecutionPlan({
      documents,
      discoveredCollections: ["trees"],
    });
    if (current.planSha256 !== confirmedPlanSha256 ||
        current.planSha256 !== preflight.planSha256) {
      throw new Error("El plan cambió dentro de la transacción.");
    }
    for (const entry of current.plan.deletionPlan) {
      transaction.delete(database.doc(entry.documentPath));
    }
    return {transactionAttempted: true, transactionCommitted: true, writesExecuted: 189};
  });
};
