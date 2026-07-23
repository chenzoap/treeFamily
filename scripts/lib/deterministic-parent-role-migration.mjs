import {access, readFile, stat} from "node:fs/promises";
import path from "node:path";

import {
  auditTreeParentRoles,
  VALID_PARENT_ROLES,
} from "./parent-role-audit.mjs";

export const AUTHORIZED_PARENT_ROLE_TARGETS = Object.freeze([
  Object.freeze({
    treeId: "gib7tREAAsXDQX4Qh3Oh",
    relationshipId: "CQ1YkxoTXtBevnfUQmJB",
    expectedCandidateRole: "mother",
  }),
  Object.freeze({
    treeId: "gib7tREAAsXDQX4Qh3Oh",
    relationshipId: "eW1O09pUDZzOCFte48qy",
    expectedCandidateRole: "mother",
  }),
]);

export const REQUIRED_BACKUP_FILES = Object.freeze([
  "firebase-export-metadata.json",
  "firestore_export/firestore_export.overall_export_metadata",
  "firestore_export/all_namespaces/all_kinds/output-0",
]);

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const compareTarget = (left, right) =>
  left.treeId.localeCompare(right.treeId) ||
  left.relationshipId.localeCompare(right.relationshipId);

const unique = (values) => [...new Set(values)];

const addFailure = (failures, condition, code, message) => {
  if (!condition) {
    failures.push({code, message});
  }
};

export const validateLocalEmulatorHost = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return {
      ok: false,
      code: "emulator-host-required",
      message:
        "FIRESTORE_EMULATOR_HOST es obligatorio; se rechazó una posible conexión a producción.",
    };
  }

  const normalized = value.trim().replace(/^https?:\/\//, "");
  let hostname;
  if (normalized.startsWith("[")) {
    hostname = normalized.slice(1, normalized.indexOf("]"));
  } else {
    hostname = normalized.split(":")[0];
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return {
      ok: false,
      code: "non-local-emulator-host",
      message: `FIRESTORE_EMULATOR_HOST debe apuntar a loopback; recibido: ${value}`,
    };
  }

  return {ok: true, host: value.trim()};
};

export const validateApplyArguments = ({
  apply,
  confirmTreeId,
  backupPath,
}) => {
  if (!apply) {
    return {ok: true};
  }
  if (confirmTreeId !== AUTHORIZED_PARENT_ROLE_TARGETS[0].treeId) {
    return {
      ok: false,
      code: "tree-confirmation-required",
      message:
        "El modo apply requiere --confirm-tree-id gib7tREAAsXDQX4Qh3Oh.",
    };
  }
  if (typeof backupPath !== "string" || !backupPath.trim()) {
    return {
      ok: false,
      code: "backup-path-required",
      message: "El modo apply requiere --backup-path.",
    };
  }
  return {ok: true};
};

export const validateBackupExport = async (backupPath, projectRoot) => {
  const resolvedBackupPath = path.resolve(backupPath);
  const forbiddenPaths = [
    path.join(projectRoot, ".firebase-seed"),
    path.join(projectRoot, ".firebase-sessions"),
  ];

  if (
    forbiddenPaths.some(
      (forbiddenPath) =>
        resolvedBackupPath === forbiddenPath ||
        resolvedBackupPath.startsWith(`${forbiddenPath}${path.sep}`),
    )
  ) {
    return {
      ok: false,
      code: "forbidden-backup-path",
      message: "El respaldo no puede ser .firebase-seed ni .firebase-sessions.",
    };
  }

  try {
    const backupStats = await stat(resolvedBackupPath);
    if (!backupStats.isDirectory()) {
      return {
        ok: false,
        code: "invalid-backup",
        message: "La ruta de respaldo no es un directorio.",
      };
    }

    for (const relativePath of REQUIRED_BACKUP_FILES) {
      const filePath = path.join(resolvedBackupPath, relativePath);
      await access(filePath);
      const fileStats = await stat(filePath);
      if (!fileStats.isFile() || fileStats.size === 0) {
        return {
          ok: false,
          code: "invalid-backup",
          message: `El respaldo contiene un archivo vacío o inválido: ${relativePath}`,
        };
      }
    }

    const metadata = JSON.parse(
      await readFile(
        path.join(resolvedBackupPath, "firebase-export-metadata.json"),
        "utf8",
      ),
    );
    if (!metadata.firestore) {
      return {
        ok: false,
        code: "invalid-backup",
        message: "El metadata del respaldo no declara una exportación Firestore.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      code: "invalid-backup",
      message: `El respaldo no es una exportación válida: ${error.message}`,
    };
  }

  return {ok: true, backupPath: resolvedBackupPath};
};

const inspectTarget = (target, tree) => {
  const failures = [];
  if (!tree?.exists) {
    return {
      ...target,
      status: "stale",
      currentClassification: null,
      currentParentRole: null,
      proposedParentRole: target.expectedCandidateRole,
      evidence: null,
      passedPreconditions: [],
      failedPreconditions: [
        {code: "tree-not-found", message: "El árbol autorizado no existe."},
      ],
      wouldWrite: false,
    };
  }

  const relationship = tree.relationships.find(
    (candidate) => candidate.id === target.relationshipId,
  );
  if (!relationship) {
    return {
      ...target,
      status: "stale",
      currentClassification: null,
      currentParentRole: null,
      proposedParentRole: target.expectedCandidateRole,
      evidence: null,
      passedPreconditions: ["tree-exists"],
      failedPreconditions: [
        {
          code: "relationship-not-found",
          message: "La relación autorizada no existe.",
        },
      ],
      wouldWrite: false,
    };
  }

  const rolePresent =
    hasOwn(relationship, "parentRole") &&
    relationship.parentRole !== undefined;
  const currentRole = rolePresent ? relationship.parentRole : null;
  const childRelationships = tree.relationships.filter(
    (candidate) =>
      candidate.type === "PARENT_OF" &&
      candidate.toPersonId === relationship.toPersonId,
  );
  const distinctParents = unique(
    childRelationships.map((candidate) => candidate.fromPersonId),
  );
  const sameEdge = childRelationships.filter(
    (candidate) =>
      candidate.fromPersonId === relationship.fromPersonId &&
      candidate.toPersonId === relationship.toPersonId,
  );
  const otherRelationships = childRelationships.filter(
    (candidate) => candidate.id !== relationship.id,
  );
  const fatherCount = childRelationships.filter(
    (candidate) => candidate.parentRole === "father",
  ).length;
  const motherCount = childRelationships.filter(
    (candidate) => candidate.parentRole === "mother",
  ).length;
  const auditRecord = auditTreeParentRoles({
    treeId: target.treeId,
    persons: tree.persons,
    relationships: tree.relationships,
  }).find((record) => record.relationshipId === target.relationshipId);
  const alreadyMigrated = currentRole === target.expectedCandidateRole;

  addFailure(
    failures,
    relationship.type === "PARENT_OF",
    "not-parent-relationship",
    "La relación ya no es PARENT_OF.",
  );
  addFailure(
    failures,
    typeof relationship.fromPersonId === "string" &&
      typeof relationship.toPersonId === "string",
    "invalid-endpoints",
    "La relación no contiene endpoints parentales válidos.",
  );
  addFailure(
    failures,
    tree.persons.some(({id}) => id === relationship.fromPersonId) &&
      tree.persons.some(({id}) => id === relationship.toPersonId),
    "orphan-reference",
    "El progenitor o el hijo no existe en persons.",
  );
  addFailure(
    failures,
    relationship.fromPersonId !== relationship.toPersonId,
    "self-parent-link",
    "La relación es una autorrelación parental.",
  );
  addFailure(
    failures,
    childRelationships.length === 2,
    "unexpected-parent-edge-count",
    "El hijo no tiene exactamente dos relaciones PARENT_OF.",
  );
  addFailure(
    failures,
    distinctParents.length === 2,
    "unexpected-distinct-parent-count",
    "El hijo no tiene exactamente dos progenitores distintos.",
  );
  addFailure(
    failures,
    sameEdge.length === 1,
    "duplicate-parent-edge",
    "Existe más de un documento para el mismo vínculo parental.",
  );
  addFailure(
    failures,
    otherRelationships.length === 1 &&
      otherRelationships[0].parentRole === "father",
    "expected-other-father",
    "La otra relación parental no tiene exactamente el rol father.",
  );
  addFailure(
    failures,
    fatherCount === 1,
    "invalid-father-count",
    "El hijo no tiene exactamente un father explícito.",
  );
  addFailure(
    failures,
    motherCount === (alreadyMigrated ? 1 : 0),
    "invalid-mother-count",
    alreadyMigrated
      ? "El estado migrado no tiene exactamente una mother."
      : "Ya existe un rol mother explícito antes de la migración.",
  );
  addFailure(
    failures,
    !auditRecord?.flags.includes("cycle-detected"),
    "cycle-detected",
    "La relación participa en un ciclo parental.",
  );
  addFailure(
    failures,
    !auditRecord?.flags.includes("orphan-reference"),
    "orphan-reference",
    "La auditoría detectó una referencia huérfana.",
  );

  if (rolePresent && !VALID_PARENT_ROLES.has(currentRole)) {
    failures.push({
      code: "invalid-current-role",
      message: "parentRole está presente, pero no es father ni mother.",
    });
  } else if (rolePresent && !alreadyMigrated) {
    failures.push({
      code: "unexpected-current-role",
      message:
        `parentRole es ${currentRole}; se esperaba ausencia o ` +
        `${target.expectedCandidateRole}.`,
    });
  } else if (!alreadyMigrated) {
    addFailure(
      failures,
      auditRecord?.classification ===
        "missing-role-deterministic-complement",
      "classification-changed",
      "La relación ya no es un complemento determinista.",
    );
    addFailure(
      failures,
      auditRecord?.candidateParentRole === "mother",
      "unexpected-complement",
      "El complemento estructural actual no es mother.",
    );
    addFailure(
      failures,
      auditRecord?.candidateParentRole === target.expectedCandidateRole,
      "candidate-mismatch",
      "El complemento actual no coincide con la allowlist.",
    );
  }

  const deduplicatedFailures = [
    ...new Map(failures.map((failure) => [failure.code, failure])).values(),
  ];
  const status =
    deduplicatedFailures.length > 0
      ? "conflict"
      : alreadyMigrated
        ? "already-migrated"
        : "eligible";
  const allPreconditions = [
    "tree-exists",
    "relationship-exists",
    "parent-of",
    "endpoints-valid",
    "persons-exist",
    "not-self-parent",
    "exactly-two-parent-edges",
    "exactly-two-distinct-parents",
    "no-duplicate-edge",
    "other-parent-is-father",
    "unique-parent-roles",
    "no-cycle",
    "no-orphan-reference",
    alreadyMigrated
      ? "expected-role-already-present"
      : "deterministic-complement",
    "candidate-matches-allowlist",
  ];

  return {
    ...target,
    status,
    currentClassification: alreadyMigrated
      ? "already-migrated"
      : auditRecord?.classification ?? null,
    currentParentRole: currentRole,
    proposedParentRole: target.expectedCandidateRole,
    evidence: {
      fromPersonId: relationship.fromPersonId,
      toPersonId: relationship.toPersonId,
      totalParentEdges: childRelationships.length,
      distinctParentIds: [...distinctParents].sort(),
      otherRelationshipId: otherRelationships[0]?.id ?? null,
      otherParentRole: otherRelationships[0]?.parentRole ?? null,
      calculatedComplement:
        otherRelationships[0]?.parentRole === "father"
          ? "mother"
          : otherRelationships[0]?.parentRole === "mother"
            ? "father"
            : null,
    },
    passedPreconditions:
      deduplicatedFailures.length === 0 ? allPreconditions : [],
    failedPreconditions: deduplicatedFailures,
    wouldWrite: status === "eligible",
  };
};

export const buildDeterministicParentRoleMigrationPlan = ({
  trees,
  targets = AUTHORIZED_PARENT_ROLE_TARGETS,
}) => {
  const authorizedKeys = new Set(
    AUTHORIZED_PARENT_ROLE_TARGETS.map(
      (target) => `${target.treeId}/${target.relationshipId}`,
    ),
  );
  const unauthorizedTargets = targets.filter(
    (target) =>
      !authorizedKeys.has(`${target.treeId}/${target.relationshipId}`),
  );
  const orderedTargets = [...targets].sort(compareTarget);

  if (unauthorizedTargets.length > 0) {
    return {
      ok: false,
      targets: orderedTargets.map((target) => ({
        ...target,
        status: "ineligible",
        currentClassification: null,
        currentParentRole: null,
        proposedParentRole: target.expectedCandidateRole,
        evidence: null,
        passedPreconditions: [],
        failedPreconditions: [
          {
            code: "target-not-authorized",
            message: "La relación no pertenece a la allowlist cerrada.",
          },
        ],
        wouldWrite: false,
      })),
      updates: [],
      summary: {
        examined: orderedTargets.length,
        eligible: 0,
        alreadyMigrated: 0,
        conflicts: orderedTargets.length,
        proposedUpdates: 0,
      },
    };
  }

  const treeById = new Map(trees.map((tree) => [tree.treeId, tree]));
  const inspectedTargets = orderedTargets.map((target) =>
    inspectTarget(target, treeById.get(target.treeId)),
  );
  const hasFailure = inspectedTargets.some(
    ({status}) => status === "stale" || status === "conflict",
  );
  const updates = hasFailure
    ? []
    : inspectedTargets
        .filter(({status}) => status === "eligible")
        .map(({treeId, relationshipId, proposedParentRole}) => ({
          treeId,
          relationshipId,
          parentRole: proposedParentRole,
        }));

  return {
    ok: !hasFailure,
    targets: inspectedTargets.map((target) => ({
      ...target,
      wouldWrite: !hasFailure && target.status === "eligible",
    })),
    updates,
    summary: {
      examined: inspectedTargets.length,
      eligible: inspectedTargets.filter(({status}) => status === "eligible")
        .length,
      alreadyMigrated: inspectedTargets.filter(
        ({status}) => status === "already-migrated",
      ).length,
      conflicts: inspectedTargets.filter(
        ({status}) => status === "stale" || status === "conflict",
      ).length,
      proposedUpdates: updates.length,
    },
  };
};
