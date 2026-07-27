#!/usr/bin/env node

import {writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  AUTHORIZED_MANUAL_REVIEW_TARGETS,
  buildManualReviewCsv,
  buildManualReviewMatrix,
  validateLocalEmulatorHost,
} from "./lib/parent-role-manual-review.mjs";

const PROJECT_ID = "tree-gen-chenzoap-2026";
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PROTECTED_DIRECTORIES = [
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
].map((directory) => path.join(PROJECT_ROOT, directory));

const parseArguments = (argv) => {
  const options = {
    jsonOutput: "/tmp/treefamily-parent-role-manual-review.json",
    markdownOutput: "/tmp/treefamily-parent-role-manual-review.md",
    csvOutput: "/tmp/treefamily-parent-role-manual-review.csv",
  };
  const mappings = new Map([
    ["--json-output", "jsonOutput"],
    ["--markdown-output", "markdownOutput"],
    ["--csv-output", "csvOutput"],
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

const authorizedTreeIds = [
  ...new Set(AUTHORIZED_MANUAL_REVIEW_TARGETS.map(({treeId}) => treeId)),
].sort();

const readAuthorizedTrees = async (database) =>
  Promise.all(
    authorizedTreeIds.map(async (treeId) => {
      const treeReference = database.collection("trees").doc(treeId);
      const [treeSnapshot, personsSnapshot, relationshipsSnapshot] =
        await Promise.all([
          treeReference.get(),
          treeReference.collection("persons").get(),
          treeReference.collection("relationships").get(),
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

const markdownCell = (value) =>
  String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");

const buildMarkdown = ({generatedAt, emulatorHost, matrix}) => {
  const rows = matrix.cases.map((item) =>
    `| ${item.reviewNumber} | ${markdownCell(item.treeId)} | ` +
    `${markdownCell(item.parentName)} | ${markdownCell(item.childName)} | ` +
    `${markdownCell(item.relationshipId)} | ` +
    `${markdownCell(item.candidateParentRole)} | ` +
    `${markdownCell(item.evidenceCount)} | ` +
    `${markdownCell(item.currentStatus)} |`,
  ).join("\n");
  const details = matrix.cases.map((item) => {
    const evidence = item.evidenceRelationshipIds.map(
      (relationshipId, index) =>
        `- ${relationshipId}: ` +
        `${item.evidenceRoles[index]} → ` +
        `${item.evidenceChildren[index]?.name ?? item.evidenceChildren[index]?.personId}`,
    ).join("\n");
    return `### ${item.parentName} → ${item.childName}

- Árbol: \`${item.treeId}\`
- Relación revisada: \`${item.relationshipId}\`
- Endpoints: \`${item.fromPersonId}\` → \`${item.toPersonId}\`
- Clasificación actual: \`${item.classification}\`
- Candidato sugerido: \`${item.candidateParentRole}\`
- Estado actual: \`${item.currentStatus}\`
- Evidencias explícitas: ${item.evidenceCount}
- Evidencia del rol contrario: ${item.oppositeRoleEvidenceFound ? "sí" : "no"}

${evidence || "_Sin evidencia explícita._"}

Decisión: [ ] Aprobar  [ ] Rechazar  [ ] Desconocido

Rol confirmado: [ ] Padre  [ ] Madre

Notas:

`;
  }).join("\n");

  return `# Matriz de confirmación manual de roles parentales

Generada: ${generatedAt}

Emulador local: ${emulatorHost}

**Este informe no autoriza ni aplica ninguna migración.**

## Resumen ejecutivo

- Casos autorizados: ${matrix.summary.authorizedCases}
- Listos para revisión: ${matrix.summary.readyForReview}
- Stale: ${matrix.summary.stale}
- Conflictivos: ${matrix.summary.conflicts}
- Ineligible: ${matrix.summary.ineligible}
- Sugerencias father: ${matrix.summary.suggestedFather}
- Sugerencias mother: ${matrix.summary.suggestedMother}
- Evidencias de soporte: ${matrix.summary.supportingRelationships}
- Decisiones completadas: ${matrix.summary.completedReviewDecisions}
- Escrituras Firestore: 0

## Significado de las decisiones

- **approve:** Fernando confirma explícitamente el rol; una etapa posterior deberá exigir también \`confirmedParentRole\`.
- **reject:** la sugerencia es incorrecta.
- **unknown:** no existe información suficiente para decidir.

## Tabla resumen

| # | Árbol | Progenitor | Hijo | Relación | Candidato | Evidencias | Estado |
|---:|---|---|---|---|---|---:|---|
${rows}

## Revisión detallada por progenitor

${details}

> Los nombres solo se muestran para facilitar la revisión y no fueron utilizados para inferir roles.

## Declaración final

**Esta herramienta no modificó Firestore.**
`;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const hostValidation = validateLocalEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  if (!hostValidation.ok) {
    throw new Error(hostValidation.message);
  }

  const app = admin.initializeApp({projectId: PROJECT_ID});
  const database = app.firestore();
  const trees = await readAuthorizedTrees(database);
  const matrix = buildManualReviewMatrix({trees});
  const generatedAt = new Date().toISOString();
  const report = {
    metadata: {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      purpose: "manual-parent-role-review",
      readOnly: true,
      allowedReviewDecisions: ["approve", "reject", "unknown"],
    },
    emulatorHost: hostValidation.host,
    generatedAt,
    scope: {
      treeIds: authorizedTreeIds,
      authorizedTargets: AUTHORIZED_MANUAL_REVIEW_TARGETS.map(
        ({treeId, relationshipId, expectedCandidateRole}) => ({
          treeId,
          relationshipId,
          expectedCandidateRole,
        }),
      ),
    },
    summary: matrix.summary,
    cases: matrix.cases,
    warnings: matrix.warnings,
    declarationOfNoWrites: "Esta herramienta no modificó Firestore.",
  };

  await Promise.all([
    writeFile(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(
      options.markdownOutput,
      buildMarkdown({generatedAt, emulatorHost: hostValidation.host, matrix}),
    ),
    writeFile(options.csvOutput, buildManualReviewCsv(matrix.cases)),
  ]);

  console.log("Matriz manual de parentRole (solo lectura)");
  console.log(`Casos autorizados: ${matrix.summary.authorizedCases}`);
  console.log(`Ready-for-review: ${matrix.summary.readyForReview}`);
  console.log(`Stale: ${matrix.summary.stale}`);
  console.log(`Conflictivos: ${matrix.summary.conflicts}`);
  console.log(`Ineligible: ${matrix.summary.ineligible}`);
  console.log(`Sugerencias father: ${matrix.summary.suggestedFather}`);
  console.log(`Sugerencias mother: ${matrix.summary.suggestedMother}`);
  console.log(
    `Relaciones de soporte: ${matrix.summary.supportingRelationships}`,
  );
  console.log(
    `ReviewDecision completadas: ${matrix.summary.completedReviewDecisions}`,
  );
  console.log("Escrituras Firestore: 0");
  console.log(`JSON: ${options.jsonOutput}`);
  console.log(`Markdown: ${options.markdownOutput}`);
  console.log(`CSV: ${options.csvOutput}`);
  console.log("Esta herramienta no modificó Firestore.");

  await app.delete();
  if (!matrix.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`Error preparando revisión manual: ${error.message}`);
  process.exitCode = 1;
});
