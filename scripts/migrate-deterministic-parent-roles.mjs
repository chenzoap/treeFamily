#!/usr/bin/env node

import {writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  AUTHORIZED_PARENT_ROLE_TARGETS,
  buildDeterministicParentRoleMigrationPlan,
  validateApplyArguments,
  validateBackupExport,
  validateLocalEmulatorHost,
} from "./lib/deterministic-parent-role-migration.mjs";

const PROJECT_ID = "tree-gen-chenzoap-2026";
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_JSON_OUTPUT =
  "/tmp/treefamily-parent-role-migration-dry-run.json";
const DEFAULT_MARKDOWN_OUTPUT =
  "/tmp/treefamily-parent-role-migration-dry-run.md";
const PROTECTED_OUTPUT_DIRECTORIES = [
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
].map((directory) => path.join(PROJECT_ROOT, directory));

const parseArguments = (argv) => {
  const options = {
    apply: false,
    confirmTreeId: null,
    backupPath: null,
    jsonOutput: DEFAULT_JSON_OUTPUT,
    markdownOutput: DEFAULT_MARKDOWN_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) {
      throw new Error(`Falta el valor de ${argument}.`);
    }
    if (argument === "--confirm-tree-id") {
      options.confirmTreeId = value;
    } else if (argument === "--backup-path") {
      options.backupPath = value;
    } else if (argument === "--json-output") {
      options.jsonOutput = value;
    } else if (argument === "--markdown-output") {
      options.markdownOutput = value;
    } else {
      throw new Error(`Argumento desconocido: ${argument}`);
    }
    index += 1;
  }

  for (const outputPath of [options.jsonOutput, options.markdownOutput]) {
    if (!path.isAbsolute(outputPath)) {
      throw new Error(`La ruta de salida debe ser absoluta: ${outputPath}`);
    }
    const resolvedOutputPath = path.resolve(outputPath);
    if (
      PROTECTED_OUTPUT_DIRECTORIES.some(
        (directory) =>
          resolvedOutputPath === directory ||
          resolvedOutputPath.startsWith(`${directory}${path.sep}`),
      )
    ) {
      throw new Error(
        `La salida no puede escribirse dentro de datos Firebase protegidos: ${outputPath}`,
      );
    }
  }

  return options;
};

const treeIds = [
  ...new Set(AUTHORIZED_PARENT_ROLE_TARGETS.map(({treeId}) => treeId)),
].sort();

const readTrees = async (database, transaction = null) =>
  Promise.all(
    treeIds.map(async (treeId) => {
      const treeRef = database.collection("trees").doc(treeId);
      const personsQuery = treeRef.collection("persons");
      const relationshipsQuery = treeRef.collection("relationships");
      const read = (reference) =>
        transaction ? transaction.get(reference) : reference.get();
      const [treeSnapshot, personsSnapshot, relationshipsSnapshot] =
        await Promise.all([
          read(treeRef),
          read(personsQuery),
          read(relationshipsQuery),
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
    }),
  );

const buildMarkdown = ({mode, host, plan, writesExecuted}) => {
  const rows = plan.targets
    .map(
      (target) =>
        `| ${target.treeId} | ${target.relationshipId} | ${target.status} ` +
        `| ${target.currentClassification ?? "—"} ` +
        `| ${target.currentParentRole ?? "ausente"} ` +
        `| ${target.proposedParentRole} ` +
        `| ${target.evidence?.otherParentRole ?? "—"} ` +
        `| ${target.failedPreconditions
          .map(({code}) => code)
          .join(", ") || "ninguna"} |`,
    )
    .join("\n");

  return `# Plan determinista de parentRole

- Modo: ${mode}
- Firestore Emulator: ${host}
- Objetivos examinados: ${plan.summary.examined}
- Elegibles: ${plan.summary.eligible}
- Already migrated: ${plan.summary.alreadyMigrated}
- Conflictivos: ${plan.summary.conflicts}
- Actualizaciones propuestas: ${plan.summary.proposedUpdates}
- Escrituras ejecutadas: ${writesExecuted}

| Tree ID | Relationship ID | Estado | Clasificación actual | Rol actual | Rol propuesto | Rol del otro progenitor | Precondiciones fallidas |
|---|---|---|---|---|---|---|---|
${rows}

## Evidencia y precondiciones

${plan.targets
  .map(
    (target) =>
      `### ${target.relationshipId}\n\n` +
      `- Evidencia: ${JSON.stringify(target.evidence)}\n` +
      `- Precondiciones aprobadas: ` +
      `${target.passedPreconditions.join(", ") || "ninguna"}\n` +
      `- Precondiciones fallidas: ` +
      `${target.failedPreconditions
        .map(({code, message}) => `${code}: ${message}`)
        .join("; ") || "ninguna"}\n`,
  )
  .join("\n")}

**${writesExecuted === 0
    ? "Esta ejecución no modificó Firestore."
    : `Se ejecutaron ${writesExecuted} escrituras atómicas.`}**
`;
};

const writeReports = async ({
  options,
  host,
  plan,
  writesExecuted,
  mode,
}) => {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    source: {
      kind: "firestore-emulator",
      projectId: PROJECT_ID,
      host,
    },
    allowlist: AUTHORIZED_PARENT_ROLE_TARGETS,
    summary: {
      ...plan.summary,
      writesExecuted,
    },
    targets: plan.targets,
    updates: plan.updates,
    declaration:
      writesExecuted === 0
        ? "Esta ejecución no modificó Firestore."
        : `Se ejecutaron ${writesExecuted} escrituras atómicas.`,
  };
  await writeFile(
    options.jsonOutput,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    options.markdownOutput,
    buildMarkdown({mode, host, plan, writesExecuted}),
    "utf8",
  );
};

const printPlan = ({
  mode,
  host,
  plan,
  writesExecuted,
  options,
}) => {
  console.log(`Modo: ${mode}`);
  console.log(`Firestore Emulator: ${host}`);
  for (const target of plan.targets) {
    console.log(
      `${target.treeId}/${target.relationshipId}: ` +
        `${target.status}; clasificación=${target.currentClassification}; ` +
        `actual=${target.currentParentRole ?? "ausente"}; ` +
        `propuesto=${target.proposedParentRole}`,
    );
    console.log(`  Evidencia: ${JSON.stringify(target.evidence)}`);
    console.log(
      `  Precondiciones aprobadas: ` +
        `${target.passedPreconditions.join(", ") || "ninguna"}`,
    );
    console.log(
      `  Precondiciones fallidas: ` +
        `${target.failedPreconditions
          .map(({code}) => code)
          .join(", ") || "ninguna"}`,
    );
  }
  console.log(`Objetivos examinados: ${plan.summary.examined}`);
  console.log(`Elegibles: ${plan.summary.eligible}`);
  console.log(`Already migrated: ${plan.summary.alreadyMigrated}`);
  console.log(`Conflictivos: ${plan.summary.conflicts}`);
  console.log(`Actualizaciones propuestas: ${plan.summary.proposedUpdates}`);
  console.log(`Escrituras ejecutadas: ${writesExecuted}`);
  console.log(`Informe JSON: ${options.jsonOutput}`);
  console.log(`Informe Markdown: ${options.markdownOutput}`);
  if (writesExecuted === 0) {
    console.log("Esta ejecución no modificó Firestore.");
  }
};

const applyPlanAtomically = async (database) =>
  database.runTransaction(async (transaction) => {
    const freshTrees = await readTrees(database, transaction);
    const freshPlan = buildDeterministicParentRoleMigrationPlan({
      trees: freshTrees,
    });
    if (!freshPlan.ok) {
      throw new Error(
        "Las precondiciones cambiaron dentro de la transacción; se abortó todo.",
      );
    }

    for (const update of freshPlan.updates) {
      const relationshipRef = database
        .collection("trees")
        .doc(update.treeId)
        .collection("relationships")
        .doc(update.relationshipId);
      transaction.update(relationshipRef, {parentRole: "mother"});
    }
    return freshPlan;
  });

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const hostValidation = validateLocalEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  if (!hostValidation.ok) {
    throw new Error(hostValidation.message);
  }
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
  const trees = await readTrees(database);
  let plan = buildDeterministicParentRoleMigrationPlan({trees});
  if (!plan.ok) {
    await writeReports({
      options,
      host: hostValidation.host,
      plan,
      writesExecuted: 0,
      mode: options.apply ? "apply" : "dry-run",
    });
    printPlan({
      mode: options.apply ? "apply" : "dry-run",
      host: hostValidation.host,
      plan,
      writesExecuted: 0,
      options,
    });
    throw new Error("Una o más precondiciones fallaron; no se escribió nada.");
  }

  let writesExecuted = 0;
  if (options.apply) {
    plan = await applyPlanAtomically(database);
    writesExecuted = plan.updates.length;
  }
  const mode = options.apply ? "apply" : "dry-run";
  await writeReports({
    options,
    host: hostValidation.host,
    plan,
    writesExecuted,
    mode,
  });
  printPlan({
    mode,
    host: hostValidation.host,
    plan,
    writesExecuted,
    options,
  });
};

main().catch((error) => {
  console.error(`Error de migración: ${error.message}`);
  process.exitCode = 1;
});
