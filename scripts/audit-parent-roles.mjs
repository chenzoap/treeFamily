#!/usr/bin/env node

import {writeFile} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

import admin from "firebase-admin";

import {
  auditTreeParentRoles,
  summarizeParentRoleAudit,
} from "./lib/parent-role-audit.mjs";

const DEFAULT_JSON_OUTPUT = "/tmp/treefamily-parent-role-audit.json";
const DEFAULT_MARKDOWN_OUTPUT = "/tmp/treefamily-parent-role-audit.md";
const PROJECT_ID = "tree-gen-chenzoap-2026";
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PROTECTED_FIREBASE_DIRECTORIES = [
  ".firebase-seed",
  ".firebase-sessions",
  ".firebase-backups",
].map((directory) => path.join(PROJECT_ROOT, directory));

const parseArguments = (argv) => {
  const options = {
    treeId: null,
    jsonOutput: DEFAULT_JSON_OUTPUT,
    markdownOutput: DEFAULT_MARKDOWN_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (
      ["--tree-id", "--json-output", "--markdown-output"].includes(argument) &&
      !value
    ) {
      throw new Error(`Falta el valor de ${argument}.`);
    }

    if (argument === "--tree-id") {
      options.treeId = value;
      index += 1;
    } else if (argument === "--json-output") {
      options.jsonOutput = value;
      index += 1;
    } else if (argument === "--markdown-output") {
      options.markdownOutput = value;
      index += 1;
    } else {
      throw new Error(`Argumento desconocido: ${argument}`);
    }
  }

  for (const outputPath of [options.jsonOutput, options.markdownOutput]) {
    if (!path.isAbsolute(outputPath)) {
      throw new Error(`La ruta de salida debe ser absoluta: ${outputPath}`);
    }
    const resolvedOutputPath = path.resolve(outputPath);
    if (
      PROTECTED_FIREBASE_DIRECTORIES.some(
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

const requireLocalEmulator = () => {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST es obligatorio; se rechazó una posible conexión a producción.",
    );
  }

  const hostname = emulatorHost.replace(/^https?:\/\//, "").split(":")[0];
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST debe apuntar a localhost; recibido: ${emulatorHost}`,
    );
  }

  return emulatorHost;
};

const readTrees = async (database, treeId) => {
  if (treeId) {
    const snapshot = await database.collection("trees").doc(treeId).get();
    if (!snapshot.exists) {
      throw new Error(`No existe el árbol ${treeId} en el emulador.`);
    }
    return [snapshot];
  }

  const snapshot = await database.collection("trees").get();
  return snapshot.docs;
};

const readTreeData = async (treeSnapshot) => {
  const [personsSnapshot, relationshipsSnapshot] = await Promise.all([
    treeSnapshot.ref.collection("persons").get(),
    treeSnapshot.ref.collection("relationships").get(),
  ]);

  return {
    treeId: treeSnapshot.id,
    persons: personsSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })),
    relationships: relationshipsSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })),
  };
};

const displayValue = (value) => {
  if (value === null) {
    return "—";
  }
  if (typeof value === "string") {
    return value || '""';
  }
  return JSON.stringify(value);
};

const escapeCell = (value) =>
  displayValue(value).replaceAll("|", "\\|").replaceAll("\n", " ");

const relationshipTable = (records) => {
  if (records.length === 0) {
    return "_Ningún caso._";
  }

  const lines = [
    "| Árbol | Relación | Progenitor | Hijo | Rol original | Clasificación | Candidato | Motivo |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const record of records) {
    lines.push(
      `| ${escapeCell(record.treeId)} ` +
        `| ${escapeCell(record.relationshipId)} ` +
        `| ${escapeCell(record.parentName ?? record.fromPersonId)} ` +
        `| ${escapeCell(record.childName ?? record.toPersonId)} ` +
        `| ${escapeCell(record.parentRoleOriginal)} ` +
        `| ${escapeCell(record.classification)} ` +
        `| ${escapeCell(record.candidateParentRole)} ` +
        `| ${escapeCell(record.reason)} |`,
    );
  }
  return lines.join("\n");
};

const buildMarkdown = ({generatedAt, emulatorHost, trees, records, summary}) => {
  const missing = records.filter((record) => !record.parentRolePresent);
  const invalid = records.filter(
    (record) => record.classification === "invalid-role",
  );
  const deterministic = records.filter(
    (record) =>
      record.classification === "missing-role-deterministic-complement",
  );
  const manual = records.filter(
    (record) =>
      record.classification === "missing-role-consistent-parent-history",
  );
  const ambiguous = records.filter((record) =>
    [
      "missing-role-ambiguous-single-parent",
      "missing-role-ambiguous-multiple-unknown",
    ].includes(record.classification),
  );
  const conflicts = records.filter(
    (record) =>
      record.flags.length > 0 ||
      [
        "duplicate-parent-edge",
        "duplicate-parent-role",
        "too-many-parents",
        "orphan-reference",
        "self-parent-link",
        "cycle-detected",
      ].includes(record.classification),
  );

  return `# Auditoría histórica de parentRole

Generada: ${generatedAt}

Emulador local: ${emulatorHost}

## 1. Resumen ejecutivo

- Árboles auditados: ${summary.treesAudited}
- Personas leídas: ${summary.personsRead}
- Relaciones totales: ${summary.relationshipsRead}
- Relaciones PARENT_OF: ${summary.parentRelationships}
- Roles father: ${summary.fatherRoles}
- Roles mother: ${summary.motherRoles}
- Sin parentRole: ${summary.missingRoles}
- Roles inválidos: ${summary.invalidRoles}
- Complementos deterministas: ${summary.deterministicComplements}
- Revisión manual: ${summary.manualConfirmation}
- Ambiguos: ${summary.ambiguous}
- Duplicados de arista: ${summary.duplicateEdges}
- Hijos con roles duplicados: ${summary.duplicateRoles}
- Hijos con más de dos progenitores: ${summary.tooManyParents}
- Referencias huérfanas: ${summary.orphanReferences}
- Autorrelaciones: ${summary.selfParentLinks}
- Relaciones en ciclos: ${summary.cycles}
- Errores críticos: ${summary.criticalErrors}

## 2. Resultados por árbol

${trees
  .map(
    (tree) =>
      `- ${tree.treeId}: ${tree.personCount} personas, ` +
      `${tree.relationshipCount} relaciones, ${tree.parentRelationshipCount} PARENT_OF.`,
  )
  .join("\n")}

## 3. Relaciones sin rol

${relationshipTable(missing)}

## 4. Roles inválidos

${relationshipTable(invalid)}

## 5. Casos deterministas

${relationshipTable(deterministic)}

## 6. Casos que requieren confirmación manual

${relationshipTable(manual)}

## 7. Casos ambiguos

${relationshipTable(ambiguous)}

## 8. Conflictos estructurales

${relationshipTable(conflicts)}

## 9. Recomendación para la siguiente etapa

Una migración futura solo debería considerar automáticamente los casos
\`missing-role-deterministic-complement\`. Las sugerencias por historial requieren
confirmación humana, y los casos ambiguos o con conflictos estructurales deben
resolverse antes de cualquier escritura.

## 10. Declaración de solo lectura

**Esta auditoría no modificó ningún dato.**
`;
};

const printSummary = ({summary, treeIds, jsonOutput, markdownOutput}) => {
  console.log("Auditoría histórica PARENT_OF (solo lectura)");
  console.log(`Árboles auditados: ${summary.treesAudited}`);
  console.log(`Tree IDs: ${treeIds.join(", ") || "(ninguno)"}`);
  console.log(`Personas leídas: ${summary.personsRead}`);
  console.log(`Relaciones totales: ${summary.relationshipsRead}`);
  console.log(`PARENT_OF totales: ${summary.parentRelationships}`);
  console.log(`father: ${summary.fatherRoles}`);
  console.log(`mother: ${summary.motherRoles}`);
  console.log(`Sin rol: ${summary.missingRoles}`);
  console.log(`Rol inválido: ${summary.invalidRoles}`);
  console.log(`Complementos deterministas: ${summary.deterministicComplements}`);
  console.log(`Revisión manual: ${summary.manualConfirmation}`);
  console.log(`Ambiguos: ${summary.ambiguous}`);
  console.log(`Aristas duplicadas: ${summary.duplicateEdges}`);
  console.log(`Roles duplicados: ${summary.duplicateRoles}`);
  console.log(`Más de dos progenitores: ${summary.tooManyParents}`);
  console.log(`Referencias huérfanas: ${summary.orphanReferences}`);
  console.log(`Autorrelaciones: ${summary.selfParentLinks}`);
  console.log(`Ciclos: ${summary.cycles}`);
  console.log(`Errores críticos: ${summary.criticalErrors}`);
  console.log(`Informe JSON: ${jsonOutput}`);
  console.log(`Informe Markdown: ${markdownOutput}`);
  console.log("Esta auditoría no modificó ningún dato.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const emulatorHost = requireLocalEmulator();
  const app = admin.initializeApp({projectId: PROJECT_ID});
  const database = app.firestore();
  const treeSnapshots = await readTrees(database, options.treeId);
  const treeData = await Promise.all(treeSnapshots.map(readTreeData));
  const records = treeData.flatMap((tree) =>
    auditTreeParentRoles({
      treeId: tree.treeId,
      persons: tree.persons,
      relationships: tree.relationships,
    }),
  );
  records.sort(
    (left, right) =>
      left.treeId.localeCompare(right.treeId) ||
      left.toPersonId.localeCompare(right.toPersonId) ||
      left.relationshipId.localeCompare(right.relationshipId),
  );

  const trees = treeData.map((tree) => ({
    treeId: tree.treeId,
    personCount: tree.persons.length,
    relationshipCount: tree.relationships.length,
    parentRelationshipCount: tree.relationships.filter(
      (relationship) => relationship.type === "PARENT_OF",
    ).length,
  }));
  const summary = summarizeParentRoleAudit({
    treeCount: trees.length,
    personCount: trees.reduce((total, tree) => total + tree.personCount, 0),
    relationshipCount: trees.reduce(
      (total, tree) => total + tree.relationshipCount,
      0,
    ),
    records,
  });
  const generatedAt = new Date().toISOString();
  const report = {
    schemaVersion: 1,
    generatedAt,
    source: {
      kind: "firestore-emulator",
      projectId: PROJECT_ID,
      emulatorHost,
      readOnly: true,
    },
    summary,
    trees,
    relationships: records,
  };

  await writeFile(
    options.jsonOutput,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    options.markdownOutput,
    buildMarkdown({generatedAt, emulatorHost, trees, records, summary}),
    "utf8",
  );
  printSummary({
    summary,
    treeIds: trees.map((tree) => tree.treeId),
    jsonOutput: options.jsonOutput,
    markdownOutput: options.markdownOutput,
  });
};

main().catch((error) => {
  console.error(`Error de auditoría: ${error.message}`);
  process.exitCode = 1;
});
