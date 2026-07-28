#!/usr/bin/env node

import {writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import admin from "firebase-admin";

import {
  AUTHORIZED_TREE_IDS,
  buildDeleteAllTestTreesPlan,
  validateLocalEmulatorHost,
} from "./lib/delete-all-test-trees-plan.mjs";

const PROJECT_ID = "tree-gen-chenzoap-2026";

const parseArguments = (argv) => {
  const options = {
    jsonOutput: "/tmp/treefamily-delete-all-test-trees-dry-run.json",
    markdownOutput: "/tmp/treefamily-delete-all-test-trees-dry-run.md",
  };
  const mappings = new Map([
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = mappings.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value) {
      throw new Error(`Argumento desconocido o sin valor: ${argv[index]}`);
    }
    if (!path.isAbsolute(value)) {
      throw new Error(`La salida debe ser absoluta: ${value}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
};

const sanitizeFieldNames = (data) =>
  Object.keys(data ?? {})
    .filter((field) => ![
      "ownerId",
      "email",
      "password",
      "passwordHash",
      "passwordSalt",
      "token",
      "tokens",
      "auth",
    ].includes(field))
    .sort();

const crawlCollection = async (collectionReference, documents) => {
  const snapshot = await collectionReference.get();
  for (const documentSnapshot of snapshot.docs) {
    const documentReference = documentSnapshot.ref;
    const subcollections = await documentReference.listCollections();
    const documentPath = documentReference.path;
    documents.push({
      documentPath,
      collectionPath: collectionReference.path,
      documentId: documentSnapshot.id,
      parentDocumentPath:
        documentPath.split("/").length > 2
          ? documentPath.split("/").slice(0, -2).join("/")
          : null,
      depth: documentPath.split("/").length,
      data: documentSnapshot.data(),
      fieldNames: sanitizeFieldNames(documentSnapshot.data()),
      subcollectionIds: subcollections.map(({id}) => id).sort(),
    });
    for (const subcollection of subcollections.sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      await crawlCollection(subcollection, documents);
    }
  }
};

const crawlDatabase = async (database) => {
  const rootCollections = await database.listCollections();
  const sortedCollections = rootCollections.sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const documents = [];
  for (const collection of sortedCollections) {
    await crawlCollection(collection, documents);
  }
  return {
    rootCollectionIds: sortedCollections.map(({id}) => id),
    documents,
  };
};

const schemaFindings = (documents) => {
  const collectionPaths = [...new Set(
    documents.map(({collectionPath}) =>
      collectionPath.replace(/\/[^/]+\//g, "/{documentId}/"),
    ),
  )].sort();
  const fieldsByCollection = {};
  for (const document of documents) {
    const normalized = document.collectionPath.replace(
      /\/[^/]+\//g,
      "/{documentId}/",
    );
    fieldsByCollection[normalized] = [
      ...new Set([
        ...(fieldsByCollection[normalized] ?? []),
        ...document.fieldNames,
      ]),
    ].sort();
  }
  return {
    collectionPaths,
    fieldsByCollection,
    unionsAreDerivedInCurrentCode: true,
    frontendTreeSelectionStorage: "localStorage:family-tree-storage",
    authInspected: false,
  };
};

const safeDocumentsForPlanning = (documents) =>
  documents.map((document) => {
    const data = Object.fromEntries(
      Object.entries(document.data).filter(([key]) =>
        !new Set([
          "ownerId",
          "email",
          "password",
          "passwordHash",
          "passwordSalt",
          "token",
          "tokens",
          "auth",
        ]).has(key),
      ),
    );
    return {...document, data};
  });

const markdownTable = (entries) =>
  entries.length
    ? entries.map((entry) =>
      `| \`${entry.documentPath}\` | ${entry.operation} | ` +
      `${entry.treeId ?? "—"} | ${entry.estimatedWriteCount} | ${entry.reason} |`,
    ).join("\n")
    : "| — | — | — | 0 | Ninguno |";

const buildMarkdown = (report) => {
  const treeRows = report.authorizedTreeIds.map((treeId) => {
    const prefix = `trees/${treeId}/`;
    const persons = report.deletionPlan.filter(({documentPath}) =>
      documentPath.startsWith(`${prefix}persons/`),
    ).length;
    const relationships = report.deletionPlan.filter(({documentPath}) =>
      documentPath.startsWith(`${prefix}relationships/`),
    ).length;
    return `| \`${treeId}\` | ${persons} | ${relationships} |`;
  }).join("\n");
  return `# Dry-run para eliminar todos los árboles de prueba

## Resumen ejecutivo

- Estado del plan: ${report.summary.ready ? "listo" : "no listo"}
- Árboles encontrados: ${report.summary.treesFound}
- Documentos que se eliminarían: ${report.summary.deleteDocuments}
- Referencias externas que se limpiarían: ${report.summary.clearReferenceDocuments}
- Escrituras futuras estimadas: ${report.summary.estimatedFutureWrites}
- Escrituras ejecutadas: 0

**Este dry-run no eliminó ni modificó datos.**

## Inventario de colecciones

${report.discoveredCollections.map((item) => `- \`${item}\``).join("\n")}

## Árboles autorizados

| treeId | Personas | Relaciones |
|---|---:|---:|
${treeRows}

## Documentos que se eliminarían

| Ruta | Operación | treeId | Escrituras | Razón |
|---|---|---|---:|---|
${markdownTable(report.deletionPlan)}

## Referencias que se limpiarían

| Ruta | Operación | treeId | Escrituras | Razón |
|---|---|---|---:|---|
${markdownTable(report.referenceCleanupPlan)}

## Documentos preservados

| Ruta | Operación | treeId | Escrituras | Razón |
|---|---|---|---:|---|
${markdownTable(report.preservedDocuments)}

## Elementos no resueltos

| Ruta | Operación | treeId | Escrituras | Razón |
|---|---|---|---:|---|
${markdownTable(report.unresolvedDocuments)}

## Estado final proyectado

- Árboles: ${report.projectedFinalState.trees}
- Personas: ${report.projectedFinalState.persons}
- Relaciones: ${report.projectedFinalState.relationships}
- Uniones almacenadas: ${report.projectedFinalState.storedUnions}
- Membresías: ${report.projectedFinalState.memberships}
- Invitaciones: ${report.projectedFinalState.invitations}
- Referencias colgantes: ${report.projectedFinalState.danglingAuthorizedTreeReferences}
- Documentos huérfanos: ${report.projectedFinalState.orphanDocuments}
- Auth preservado: ${report.projectedFinalState.authPreserved ? "sí" : "no"}

## Riesgos

${report.warnings.map((warning) => `- ${warning}`).join("\n")}

**Este dry-run ejecutó cero escrituras y no modificó Firestore.**
`;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const host = validateLocalEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  if (!host.ok) throw new Error(host.message);

  const app = admin.initializeApp({projectId: PROJECT_ID});
  try {
    const database = app.firestore();
    const crawl = await crawlDatabase(database);
    const ownerIds = new Set(
      crawl.documents
        .filter(({documentPath}) => /^trees\/[^/]+$/.test(documentPath))
        .map(({data}) => data.ownerId)
        .filter((value) => typeof value === "string" && value),
    );
    const planningDocuments = safeDocumentsForPlanning(crawl.documents);
    const plan = buildDeleteAllTestTreesPlan({
      documents: planningDocuments,
      discoveredCollections: crawl.rootCollectionIds,
      distinctOwnerCount: ownerIds.size,
    });
    const report = {
      metadata: {
        schemaVersion: 1,
        projectId: PROJECT_ID,
        mode: "dry-run-read-only",
      },
      generatedAt: new Date().toISOString(),
      emulatorHost: host.host,
      authorizedTreeIds: AUTHORIZED_TREE_IDS,
      discoveredCollections: crawl.rootCollectionIds,
      schemaFindings: schemaFindings(planningDocuments),
      ...plan,
      warnings: [
        "El plan no constituye autorización para ejecutar escrituras.",
        "Auth no fue leído ni incluido en el inventario.",
        "El estado persistido del frontend en localStorage queda fuera de Firestore.",
      ],
      declarationOfNoWrites: "Este dry-run no eliminó ni modificó datos.",
    };
    const serialized = JSON.stringify(report, null, 2);
    if (
      /"(?:ownerId|auth|authExport|auth_export|email|password|passwordHash|passwordSalt|token|tokens)"\s*:/i
        .test(serialized)
    ) {
      throw new Error("El informe contiene una clave sensible prohibida.");
    }
    await Promise.all([
      writeFile(options.jsonOutput, `${serialized}\n`),
      writeFile(options.markdownOutput, buildMarkdown(report)),
    ]);
    console.log(`Plan listo: ${report.summary.ready}`);
    console.log(`Árboles: ${report.summary.treesFound}`);
    console.log(`Personas: ${report.summary.persons}`);
    console.log(`Relaciones: ${report.summary.relationships}`);
    console.log(`Unresolved: ${report.summary.unresolvedDocuments}`);
    console.log(`Escrituras futuras: ${report.summary.estimatedFutureWrites}`);
    console.log("Escrituras ejecutadas: 0");
    if (!report.summary.ready) process.exitCode = 2;
  } finally {
    await app["delete"]();
  }
};

main().catch((error) => {
  console.error(`Error preparando dry-run: ${error.message}`);
  process.exitCode = 1;
});

