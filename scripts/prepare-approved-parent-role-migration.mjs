#!/usr/bin/env node

import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  buildApprovedParentRoleMigrationPlan,
  DECISION_MANIFEST_RELATIVE_PATH,
  hashDecisionManifest,
  validateDecisionManifest,
  validateLocalEmulatorHost,
} from "./lib/approved-parent-role-migration.mjs";

const PROJECT_ID = "tree-gen-chenzoap-2026";
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DECISION_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  DECISION_MANIFEST_RELATIVE_PATH,
);
const PROTECTED_DIRECTORIES = [
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
].map((directory) => path.join(PROJECT_ROOT, directory));

const parseArguments = (argv) => {
  const options = {
    jsonOutput:
      "/tmp/treefamily-approved-parent-role-migration-dry-run.json",
    markdownOutput:
      "/tmp/treefamily-approved-parent-role-migration-dry-run.md",
  };
  const mappings = new Map([
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    const option = mappings.get(argument);
    const value = argv[index + 1];
    if (!option || !value) {
      throw new Error(`Argumento desconocido o sin valor: ${argument}`);
    }
    options[option] = value;
  }
  for (const outputPath of Object.values(options)) {
    if (!path.isAbsolute(outputPath)) {
      throw new Error(`La ruta de salida debe ser absoluta: ${outputPath}`);
    }
    const resolved = path.resolve(outputPath);
    if (
      PROTECTED_DIRECTORIES.some(
        (directory) =>
          resolved === directory ||
          resolved.startsWith(`${directory}${path.sep}`),
      )
    ) {
      throw new Error(
        `La salida no puede escribirse dentro de datos Firebase protegidos: ${outputPath}`,
      );
    }
  }
  return options;
};

const readManifest = async () => {
  const rawManifest = await readFile(DECISION_MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(rawManifest);
  const validation = validateDecisionManifest(manifest);
  if (!validation.ok) {
    throw new Error(
      `Manifiesto inválido: ` +
      validation.errors.map(({code}) => code).join(", "),
    );
  }
  return {rawManifest, manifest};
};

const readManifestTrees = async (database, manifest) => {
  const treeIds = [
    ...new Set(manifest.decisions.map(({treeId}) => treeId)),
  ].sort();
  return Promise.all(treeIds.map(async (treeId) => {
    const reference = database.collection("trees").doc(treeId);
    const [treeSnapshot, personsSnapshot, relationshipsSnapshot] =
      await Promise.all([
        reference.get(),
        reference.collection("persons").get(),
        reference.collection("relationships").get(),
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

const cell = (value) =>
  String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");

const buildTable = (cases, approved) => cases.map((item) =>
  approved
    ? `| ${cell(item.treeId)} | ${cell(item.relationshipId)} | ` +
      `${cell(item.parentName)} | ${cell(item.childName)} | ` +
      `${cell(item.confirmedParentRole)} | ` +
      `${cell(item.structuralEvidence.relationshipIds.join(", "))} | ` +
      `${cell(item.status)} |`
    : `| ${cell(item.treeId)} | ${cell(item.relationshipId)} | ` +
      `${cell(item.parentName)} | ${cell(item.childName)} | ` +
      `${cell(item.reviewDecision)} | ${cell(item.status)} | ` +
      `${cell(item.reviewNotes)} |`,
).join("\n");

const buildMarkdown = ({generatedAt, emulatorHost, manifestHash, plan}) =>
  `# Dry-run de roles parentales aprobados

- Generado: ${generatedAt}
- Emulador local: ${emulatorHost}
- SHA-256 del manifiesto: \`${manifestHash}\`

**Este dry-run no modificó Firestore.**

## Resumen ejecutivo

- Decisiones totales: ${plan.summary.totalDecisions}
- Aprobadas: ${plan.summary.approved}
- Rechazadas: ${plan.summary.rejected}
- Desconocidas: ${plan.summary.unknown}
- Aprobadas elegibles: ${plan.summary.approvedEligible}
- Aprobadas stale: ${plan.summary.approvedStale}
- Aprobadas conflictivas: ${plan.summary.approvedConflicts}
- Aprobadas ineligible: ${plan.summary.approvedIneligible}
- Actualizaciones futuras exactas: ${plan.summary.proposedUpdates}
- Father propuestos: ${plan.summary.proposedFather}
- Mother propuestas: ${plan.summary.proposedMother}
- Escrituras ejecutadas en esta etapa: 0

## 18 relaciones aprobadas

| Árbol | Relación | Progenitor | Hijo | Rol confirmado | Evidencia | Estado |
|---|---|---|---|---|---|---|
${buildTable(plan.approvedCases, true)}

## Dos relaciones rechazadas

| Árbol | Relación | Progenitor | Hijo | Decisión | Estado | Nota |
|---|---|---|---|---|---|---|
${buildTable(
  plan.excludedCases.filter(({status}) => status === "excluded-rejected"),
  false,
)}

## Caso desconocido

| Árbol | Relación | Progenitor | Hijo | Decisión | Estado | Nota |
|---|---|---|---|---|---|---|
${buildTable(
  plan.excludedCases.filter(({status}) => status === "excluded-unknown"),
  false,
)}

## Advertencias

- Las decisiones reject no autorizan eliminar relaciones ni personas.
- La decisión unknown no autoriza ninguna migración.
- Los nombres no fueron utilizados para inferir roles.
- La cantidad exacta de escrituras de una etapa futura sería ${plan.summary.proposedUpdates}; esta etapa ejecutó 0.

## Declaración final

**Este dry-run no modificó Firestore.**
`;

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const hostValidation = validateLocalEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  if (!hostValidation.ok) {
    throw new Error(hostValidation.message);
  }
  const {rawManifest, manifest} = await readManifest();
  const manifestHash = hashDecisionManifest(rawManifest);
  const app = admin.initializeApp({projectId: PROJECT_ID});
  const trees = await readManifestTrees(app.firestore(), manifest);
  const plan = buildApprovedParentRoleMigrationPlan({manifest, trees});
  const generatedAt = new Date().toISOString();
  const report = {
    metadata: {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      mode: "dry-run",
      readOnly: true,
    },
    generatedAt,
    emulatorHost: hostValidation.host,
    decisionManifestPath: DECISION_MANIFEST_PATH,
    manifestHash,
    summary: plan.summary,
    approvedCases: plan.approvedCases,
    excludedCases: plan.excludedCases,
    proposedUpdates: plan.proposedUpdates,
    validationFailures: plan.validationFailures,
    declarationOfNoWrites: "Este dry-run no modificó Firestore.",
  };
  await Promise.all([
    writeFile(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(
      options.markdownOutput,
      buildMarkdown({
        generatedAt,
        emulatorHost: hostValidation.host,
        manifestHash,
        plan,
      }),
    ),
  ]);
  console.log("Dry-run de parentRole aprobado (solo lectura)");
  for (const [label, value] of [
    ["Decisiones totales", plan.summary.totalDecisions],
    ["Aprobadas", plan.summary.approved],
    ["Rechazadas", plan.summary.rejected],
    ["Desconocidas", plan.summary.unknown],
    ["Aprobadas elegibles", plan.summary.approvedEligible],
    ["Aprobadas stale", plan.summary.approvedStale],
    ["Aprobadas conflictivas", plan.summary.approvedConflicts],
    ["Aprobadas ineligible", plan.summary.approvedIneligible],
    ["Actualizaciones propuestas", plan.summary.proposedUpdates],
    ["Father propuestos", plan.summary.proposedFather],
    ["Mother propuestas", plan.summary.proposedMother],
    ["Excluded-rejected", plan.summary.excludedRejected],
    ["Excluded-unknown", plan.summary.excludedUnknown],
    ["Escrituras Firestore", 0],
  ]) {
    console.log(`${label}: ${value}`);
  }
  console.log(`JSON: ${options.jsonOutput}`);
  console.log(`Markdown: ${options.markdownOutput}`);
  console.log("Este dry-run no modificó Firestore.");
  await app.delete();
  if (!plan.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`Error preparando dry-run aprobado: ${error.message}`);
  process.exitCode = 1;
});
