#!/usr/bin/env node

import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  buildApprovedWriteOperations,
  buildProtectedApprovedParentRolePlan,
  EXPECTED_MANIFEST_SHA256,
  validateApplyArguments,
  validateBackupExport,
  validateLocalEmulatorHost,
  validateManifestIntegrity,
} from "./lib/protected-approved-parent-role-migration.mjs";

const PROJECT_ID = "tree-gen-chenzoap-2026";
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "scripts/data/parent-role-manual-decisions-2026-07-27.json",
);
const PROTECTED_OUTPUT_DIRECTORIES = [
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
].map((directory) => path.join(PROJECT_ROOT, directory));

const parseArguments = (argv) => {
  const options = {
    apply: false,
    confirmTreeId: null,
    confirmManifestSha256: null,
    backupPath: null,
    jsonOutput:
      "/tmp/treefamily-approved-parent-role-apply-dry-run.json",
    markdownOutput:
      "/tmp/treefamily-approved-parent-role-apply-dry-run.md",
  };
  const mappings = new Map([
    ["--confirm-tree-id", "confirmTreeId"],
    ["--confirm-manifest-sha256", "confirmManifestSha256"],
    ["--backup-path", "backupPath"],
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    const option = mappings.get(argument);
    const value = argv[index + 1];
    if (!option || !value) {
      throw new Error(`Argumento desconocido o sin valor: ${argument}`);
    }
    options[option] = value;
    index += 1;
  }
  for (const outputPath of [options.jsonOutput, options.markdownOutput]) {
    if (!path.isAbsolute(outputPath)) {
      throw new Error(`La salida debe ser absoluta: ${outputPath}`);
    }
    const resolved = path.resolve(outputPath);
    if (
      PROTECTED_OUTPUT_DIRECTORIES.some(
        (directory) =>
          resolved === directory ||
          resolved.startsWith(`${directory}${path.sep}`),
      )
    ) {
      throw new Error(
        `La salida no puede escribirse dentro de datos protegidos: ${outputPath}`,
      );
    }
  }
  return options;
};

const loadProtectedManifest = async () => {
  let rawManifest;
  try {
    rawManifest = await readFile(MANIFEST_PATH, "utf8");
  } catch (error) {
    throw new Error(`No se pudo leer el manifiesto contractual: ${error.message}`);
  }
  const integrity = validateManifestIntegrity(rawManifest);
  if (!integrity.ok) {
    throw new Error(
      `Manifiesto contractual rechazado: ` +
      integrity.errors.map(({code}) => code).join(", "),
    );
  }
  return integrity;
};

const readTrees = async (reader, database, manifest) => {
  const treeIds = [
    ...new Set(manifest.decisions.map(({treeId}) => treeId)),
  ].sort();
  return Promise.all(treeIds.map(async (treeId) => {
    const reference = database.collection("trees").doc(treeId);
    const [treeSnapshot, personsSnapshot, relationshipsSnapshot] =
      await Promise.all([
        reader(reference),
        reader(reference.collection("persons")),
        reader(reference.collection("relationships")),
      ]);
    return {
      treeId,
      exists: treeSnapshot.exists,
      persons: personsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      })),
      relationships: relationshipsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      })),
    };
  }));
};

const applyAtomically = async (database, manifest) =>
  database.runTransaction(async (transaction) => {
    const trees = await readTrees(
      (reference) => transaction.get(reference),
      database,
      manifest,
    );
    const plan = buildProtectedApprovedParentRolePlan({manifest, trees});
    if (!plan.ok) {
      throw new Error(
        "Las precondiciones cambiaron dentro de la transacción; cero escrituras.",
      );
    }
    const operations = buildApprovedWriteOperations(plan);
    for (const operation of operations) {
      const relationshipReference = database
        .collection("trees")
        .doc(operation.treeId)
        .collection("relationships")
        .doc(operation.relationshipId);
      transaction.update(relationshipReference, operation.data);
    }
    return {plan, writesExecuted: operations.length};
  });

const cell = (value) =>
  String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");

const buildMarkdown = ({mode, host, manifestHash, plan, writesExecuted}) => {
  const approvedRows = plan.approvedCases.map((item) =>
    `| ${cell(item.treeId)} | ${cell(item.relationshipId)} | ` +
    `${cell(item.parentName)} | ${cell(item.childName)} | ` +
    `${cell(item.currentParentRole ?? "ausente")} | ` +
    `${cell(item.confirmedParentRole)} | ${cell(item.status)} |`,
  ).join("\n");
  const excludedRows = plan.excludedCases.map((item) =>
    `| ${cell(item.treeId)} | ${cell(item.relationshipId)} | ` +
    `${cell(item.reviewDecision)} | ${cell(item.status)} | none |`,
  ).join("\n");
  return `# Migración protegida de parentRole aprobado

- Modo: ${mode}
- Firestore Emulator: ${host}
- SHA-256 contractual: \`${manifestHash}\`
- Decisiones: ${plan.summary.decisions}
- Aprobadas: ${plan.summary.approved}
- Reject: ${plan.summary.rejected}
- Unknown: ${plan.summary.unknown}
- Eligible: ${plan.summary.eligible}
- Already migrated: ${plan.summary.alreadyMigrated}
- Conflict: ${plan.summary.conflicts}
- Stale: ${plan.summary.stale}
- Ineligible: ${plan.summary.ineligible}
- Actualizaciones propuestas: ${plan.summary.proposedUpdates}
- Father: ${plan.summary.proposedFather}
- Mother: ${plan.summary.proposedMother}
- Escrituras ejecutadas: ${writesExecuted}

| Árbol | Relación | Progenitor | Hijo | Rol actual | Rol confirmado | Estado |
|---|---|---|---|---|---|---|
${approvedRows}

## Exclusiones contractuales

| Árbol | Relación | Decisión | Estado | Acción |
|---|---|---|---|---|
${excludedRows}

**${mode === "dry-run"
    ? "Este dry-run no modificó Firestore."
    : writesExecuted === 0
      ? "El modo apply no requirió escrituras."
      : `Se ejecutaron ${writesExecuted} escrituras atómicas.`}**
`;
};

const writeReports = async ({
  options,
  mode,
  host,
  manifestHash,
  plan,
  writesExecuted,
}) => {
  const report = {
    metadata: {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      mode,
      atomic: true,
      idempotent: true,
    },
    generatedAt: new Date().toISOString(),
    emulatorHost: host,
    decisionManifestPath: MANIFEST_PATH,
    manifestHash,
    summary: {...plan.summary, writesExecuted},
    approvedCases: plan.approvedCases,
    excludedCases: plan.excludedCases,
    proposedUpdates: plan.proposedUpdates,
    validationFailures: plan.validationFailures,
    declaration:
      mode === "dry-run"
        ? "Este dry-run no modificó Firestore."
        : writesExecuted === 0
          ? "El modo apply no requirió escrituras."
          : `Se ejecutaron ${writesExecuted} escrituras atómicas.`,
  };
  await Promise.all([
    writeFile(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(
      options.markdownOutput,
      buildMarkdown({
        mode,
        host,
        manifestHash,
        plan,
        writesExecuted,
      }),
    ),
  ]);
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const hostValidation = validateLocalEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  if (!hostValidation.ok) {
    throw new Error(hostValidation.message);
  }
  const integrity = await loadProtectedManifest();
  const applyValidation = validateApplyArguments(options);
  if (!applyValidation.ok) {
    throw new Error(applyValidation.message);
  }
  if (options.apply) {
    const backupValidation = await validateBackupExport(
      options.backupPath,
      PROJECT_ROOT,
    );
    if (!backupValidation.ok) {
      throw new Error(backupValidation.message);
    }
  }

  const app = admin.initializeApp({projectId: PROJECT_ID});
  const database = app.firestore();
  const trees = await readTrees(
    (reference) => reference.get(),
    database,
    integrity.manifest,
  );
  let plan = buildProtectedApprovedParentRolePlan({
    manifest: integrity.manifest,
    trees,
  });
  let writesExecuted = 0;
  if (options.apply) {
    const result = await applyAtomically(database, integrity.manifest);
    plan = result.plan;
    writesExecuted = result.writesExecuted;
  }
  const mode = options.apply ? "apply" : "dry-run";
  await writeReports({
    options,
    mode,
    host: hostValidation.host,
    manifestHash: integrity.manifestHash,
    plan,
    writesExecuted,
  });
  console.log(`Modo: ${mode}`);
  for (const [label, value] of [
    ["Decisiones", plan.summary.decisions],
    ["Aprobadas", plan.summary.approved],
    ["Reject", plan.summary.rejected],
    ["Unknown", plan.summary.unknown],
    ["Eligible", plan.summary.eligible],
    ["Already migrated", plan.summary.alreadyMigrated],
    ["Conflict", plan.summary.conflicts],
    ["Stale", plan.summary.stale],
    ["Ineligible", plan.summary.ineligible],
    ["Actualizaciones propuestas", plan.summary.proposedUpdates],
    ["Father", plan.summary.proposedFather],
    ["Mother", plan.summary.proposedMother],
    ["Escrituras ejecutadas", writesExecuted],
  ]) {
    console.log(`${label}: ${value}`);
  }
  console.log(`Manifest SHA-256: ${integrity.manifestHash}`);
  console.log(`JSON: ${options.jsonOutput}`);
  console.log(`Markdown: ${options.markdownOutput}`);
  if (mode === "dry-run") {
    console.log("Este dry-run no modificó Firestore.");
  } else if (writesExecuted === 0) {
    console.log("El modo apply no requirió escrituras.");
  }
  await app.delete();
  if (!plan.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`Error de migración protegida: ${error.message}`);
  process.exitCode = 1;
});
