import { constants } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const seedDirectory = join(projectRoot, ".firebase-seed");
const requiredSeedFiles = [
  "firebase-export-metadata.json",
  "firestore_export/firestore_export.overall_export_metadata",
  "firestore_export/all_namespaces/all_kinds/output-0",
];

const formatTimestamp = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

const requireFile = async (path, description) => {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`${description} no existe o no se puede leer: ${path}`);
  }
};

const requirePathNotToExist = async (path, description) => {
  try {
    await access(path);
  } catch {
    return;
  }

  throw new Error(`${description} ya existe; no se sobrescribirá: ${path}`);
};

const start = async () => {
  for (const relativePath of requiredSeedFiles) {
    await requireFile(
      join(seedDirectory, relativePath),
      "Archivo obligatorio de la semilla",
    );
  }

  const timestamp = formatTimestamp(new Date());
  const backupsDirectory = join(projectRoot, ".firebase-backups");
  const sessionsDirectory = join(projectRoot, ".firebase-sessions");
  const snapshotDirectory = join(
    backupsDirectory,
    `seed-before-start-${timestamp}`,
  );
  const sessionDirectory = join(sessionsDirectory, `session-${timestamp}`);

  await mkdir(backupsDirectory, { recursive: true });
  await mkdir(sessionsDirectory, { recursive: true });
  await requirePathNotToExist(snapshotDirectory, "El snapshot previo");
  await requirePathNotToExist(sessionDirectory, "El destino de la sesión");

  await cp(seedDirectory, snapshotDirectory, {
    recursive: true,
    preserveTimestamps: true,
    errorOnExist: true,
  });

  for (const relativePath of requiredSeedFiles) {
    await requireFile(
      join(snapshotDirectory, relativePath),
      "Archivo obligatorio del snapshot",
    );
  }

  const relativeSessionDirectory = `.firebase-sessions/session-${timestamp}`;

  console.log(`Semilla importada: ${seedDirectory}`);
  console.log(`Snapshot previo creado: ${snapshotDirectory}`);
  console.log(`Exportación de esta sesión: ${sessionDirectory}`);
  console.log("Confirmado: .firebase-seed no será sobrescrita al cerrar.");

  const firebaseProcess = spawn(
    "/usr/bin/firebase",
    [
      "emulators:start",
      "--project",
      "tree-gen-chenzoap-2026",
      "--config",
      "packages/firebase/firebase.dev.json",
      "--only",
      "auth,firestore,functions",
      "--import=.firebase-seed",
      `--export-on-exit=${relativeSessionDirectory}`,
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    },
  );

  firebaseProcess.once("error", (error) => {
    console.error(`No se pudo iniciar Firebase Emulator Suite: ${error.message}`);
    process.exitCode = 1;
  });

  firebaseProcess.once("exit", (code, signal) => {
    if (signal) {
      console.error(`Firebase Emulator Suite terminó por la señal ${signal}.`);
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? 1;
  });
};

start().catch((error) => {
  console.error(`No se inició Firebase Emulator Suite: ${error.message}`);
  process.exitCode = 1;
});
