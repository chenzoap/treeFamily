#!/usr/bin/env node

import {writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  CONFIRM_PHRASE,
  EXPECTED_COUNTS,
  EXPECTED_PROJECT_ID,
  executeAtomicDeletion,
  preflightDatabase,
  validateBackup,
  validateConfirmations,
  validateConnection,
  validateOutputPath,
} from "./lib/delete-all-test-trees-execution.mjs";
import {AUTHORIZED_TREE_IDS} from "./lib/delete-all-test-trees-plan.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELP = `Uso: node scripts/delete-all-test-trees.mjs [opciones]

Modo predeterminado: dry-run de solo lectura.

  --apply
  --project-id <projectId>
  --confirm-project-id <projectId>
  --confirm-tree-count <cantidad>
  --confirm-document-count <cantidad>
  --confirm-plan-sha256 <sha256>
  --confirm-phrase <frase>
  --backup-path <ruta absoluta>
  --json-output <ruta absoluta>
  --markdown-output <ruta absoluta>
  --help`;

export const parseArguments = (argv) => {
  const options = {
    apply: false,
    projectId: EXPECTED_PROJECT_ID,
    jsonOutput: "/tmp/treefamily-delete-all-test-trees-executor-dry-run.json",
    markdownOutput: "/tmp/treefamily-delete-all-test-trees-executor-dry-run.md",
  };
  const numeric = new Set(["confirmTreeCount", "confirmDocumentCount"]);
  const mappings = new Map([
    ["--project-id", "projectId"],
    ["--confirm-project-id", "confirmProjectId"],
    ["--confirm-tree-count", "confirmTreeCount"],
    ["--confirm-document-count", "confirmDocumentCount"],
    ["--confirm-plan-sha256", "confirmPlanSha256"],
    ["--confirm-phrase", "confirmPhrase"],
    ["--backup-path", "backupPath"],
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return {...options, help: true};
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    const key = mappings.get(argument);
    const value = argv[++index];
    if (!key || value === undefined) throw new Error(`Argumento inválido: ${argument}`);
    options[key] = numeric.has(key) ? Number(value) : value;
  }
  validateOutputPath(options.jsonOutput);
  validateOutputPath(options.markdownOutput);
  return options;
};

const markdown = (report) => `# Ejecutor protegido de eliminación de árboles

- Modo: ${report.mode}
- Host: ${report.emulatorHost}
- Estado: ${report.status}
- Árboles: ${report.treeCount}
- Personas: ${report.personCount}
- Relaciones: ${report.relationshipCount}
- Eliminaciones: ${report.deleteCount}
- Fingerprint: \`${report.planSha256 ?? "n/a"}\`
- Escrituras planificadas: ${report.writesPlanned}
- Escrituras ejecutadas: ${report.writesExecuted}
- Operaciones Auth: ${report.authOperationsExecuted}
- Transacción intentada: ${report.transactionAttempted}
- Transacción confirmada: ${report.transactionCommitted}
`;

export const run = async (options, dependencies = {}) => {
  const emulatorHost = validateConnection({
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    projectId: options.projectId,
  });
  console.log(`Firestore Emulator: ${emulatorHost}`);
  const initialize =
    dependencies.initializeApp ?? ((appOptions) => admin.initializeApp(appOptions));
  const app = initialize({projectId: options.projectId});
  try {
    const database = dependencies.database ?? app.firestore();
    const preflight = await preflightDatabase(database);
    let backupValidation = {required: false, validated: false};
    let confirmationChecks = {};
    let result = {
      transactionAttempted: false,
      transactionCommitted: false,
      writesExecuted: 0,
    };
    if (options.apply && preflight.status === "eligible") {
      confirmationChecks = validateConfirmations(options, preflight.planSha256);
      backupValidation = {
        required: true,
        validated: true,
        ...await validateBackup(options.backupPath, PROJECT_ROOT),
      };
      const immediatePreflight = await preflightDatabase(database);
      if (
        immediatePreflight.status !== preflight.status ||
        immediatePreflight.planSha256 !== preflight.planSha256
      ) {
        throw new Error("El plan cambió antes de abrir la transacción.");
      }
      console.log(`Firestore Emulator antes de apply: ${emulatorHost}`);
      result = await executeAtomicDeletion({
        database,
        confirmedPlanSha256: options.confirmPlanSha256,
        preflight: immediatePreflight,
      });
    }
    const plan = preflight.plan;
    const report = {
      mode: options.apply ? "apply" : "dry-run",
      projectId: options.projectId,
      emulatorHost,
      status: preflight.status,
      residualRootCollectionIds: preflight.residualRootCollectionIds,
      expectedTreeIds: AUTHORIZED_TREE_IDS,
      actualTreeIds: preflight.actualTreeIds,
      missingTreeIds: plan?.treeValidation?.missingTreeIds ?? [],
      additionalTreeIds: plan?.treeValidation?.additionalTreeIds ?? [],
      treeCount: plan?.inventory?.treeCount ?? 0,
      personCount: plan?.inventory?.personCount ?? 0,
      relationshipCount: plan?.inventory?.relationshipCount ?? 0,
      deleteCount: plan?.summary?.deleteDocuments ?? 0,
      updateCount: plan?.summary?.clearReferenceDocuments ?? 0,
      unresolvedCount: plan?.summary?.unresolvedDocuments ?? 0,
      externalReferenceCount: plan?.summary?.clearReferenceDocuments ?? 0,
      planSha256: preflight.planSha256,
      confirmationChecks,
      backupValidation,
      ...result,
      writesPlanned: preflight.status === "eligible" ? EXPECTED_COUNTS.documents : 0,
      authOperationsPlanned: 0,
      authOperationsExecuted: 0,
      errors: [],
      warnings: [
        "Las comprobaciones dinámicas de colecciones ocurren inmediatamente antes de la transacción; Firestore no permite listCollections dentro de ella.",
      ],
    };
    await Promise.all([
      writeFile(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`),
      writeFile(options.markdownOutput, markdown(report)),
    ]);
    return report;
  } finally {
    await app["delete"]();
  }
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const report = await run(options);
  console.log(`Estado: ${report.status}`);
  console.log(`planSha256: ${report.planSha256 ?? "n/a"}`);
  console.log(`Escrituras ejecutadas: ${report.writesExecuted}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
