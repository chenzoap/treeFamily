import {access, readFile, stat} from "node:fs/promises";
import path from "node:path";

import {auditTreeParentRoles, VALID_PARENT_ROLES} from "./parent-role-audit.mjs";
import {
  hashDecisionManifest,
  validateDecisionManifest,
  validateLocalEmulatorHost,
} from "./approved-parent-role-migration.mjs";

export {validateLocalEmulatorHost};

export const EXPECTED_MANIFEST_SHA256 =
  "6b088c9692469204611e3ad59f9ddb742f37ad17dbbfafd011533fa0fd3a375c";
export const APPROVED_TREE_ID = "gib7tREAAsXDQX4Qh3Oh";
export const EXCLUDED_TREE_ID = "kXF9ZeSASxkDtDQQ2ALj";
export const REQUIRED_BACKUP_FILES = Object.freeze([
  "firebase-export-metadata.json",
  "firestore_export/firestore_export.overall_export_metadata",
  "firestore_export/all_namespaces/all_kinds/output-0",
]);

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);
const keyFor = ({treeId, relationshipId}) =>
  `${treeId}/${relationshipId}`;
const count = (items, predicate) => items.filter(predicate).length;
const addFailure = (failures, condition, code, message, status) => {
  if (!condition) {
    failures.push({code, message, status});
  }
};
const uniqueFailures = (failures) => [
  ...new Map(failures.map((failure) => [failure.code, failure])).values(),
];
const resolveStatus = (failures) =>
  ["stale", "conflict", "ineligible"].find((status) =>
    failures.some((failure) => failure.status === status),
  ) ?? null;

export const validateManifestIntegrity = (rawManifest) => {
  const manifestHash =
    typeof rawManifest === "string" ? hashDecisionManifest(rawManifest) : null;
  if (manifestHash !== EXPECTED_MANIFEST_SHA256) {
    return {
      ok: false,
      manifest: null,
      manifestHash,
      errors: [{
        code: "manifest-hash-mismatch",
        message:
          `El SHA-256 del manifiesto no coincide con el contractual ` +
          `${EXPECTED_MANIFEST_SHA256}.`,
      }],
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(rawManifest);
  } catch (error) {
    return {
      ok: false,
      manifest: null,
      manifestHash,
      errors: [{
        code: "manifest-json-invalid",
        message: `El manifiesto no es JSON válido: ${error.message}`,
      }],
    };
  }
  const validation = validateDecisionManifest(manifest);
  const excludedContract = new Map([
    [`${EXCLUDED_TREE_ID}/AKpIDy96f4osS8fq6lRc`, "reject"],
    [`${EXCLUDED_TREE_ID}/pMIwwEwDEmLUfHxlVX6R`, "reject"],
    [`${EXCLUDED_TREE_ID}/AZuU6UkGSn0FZedzF4SN`, "unknown"],
  ]);
  const excludedErrors = [];
  for (const [key, expectedDecision] of excludedContract) {
    const decision = manifest.decisions?.find(
      (item) => keyFor(item) === key,
    );
    if (decision?.reviewDecision !== expectedDecision) {
      excludedErrors.push({
        code: "excluded-decision-changed",
        message:
          `${key} debe conservar reviewDecision ${expectedDecision}.`,
      });
    }
  }
  return {
    ok: validation.ok && excludedErrors.length === 0,
    manifest,
    manifestHash,
    errors: [...validation.errors, ...excludedErrors],
    summary: validation.summary,
  };
};

export const validateApplyArguments = ({
  apply,
  confirmTreeId,
  confirmManifestSha256,
  backupPath,
}) => {
  if (!apply) {
    return {ok: true};
  }
  if (confirmTreeId !== APPROVED_TREE_ID) {
    return {
      ok: false,
      code: "confirm-tree-id-required",
      message: `--apply requiere --confirm-tree-id ${APPROVED_TREE_ID}.`,
    };
  }
  if (confirmManifestSha256 !== EXPECTED_MANIFEST_SHA256) {
    return {
      ok: false,
      code: "confirm-manifest-sha256-required",
      message:
        `--apply requiere --confirm-manifest-sha256 ` +
        `${EXPECTED_MANIFEST_SHA256}.`,
    };
  }
  if (typeof backupPath !== "string" || !path.isAbsolute(backupPath)) {
    return {
      ok: false,
      code: "absolute-backup-path-required",
      message: "--apply requiere --backup-path con una ruta absoluta.",
    };
  }
  return {ok: true};
};

export const validateBackupExport = async (backupPath, projectRoot) => {
  const resolved = path.resolve(backupPath);
  const forbidden = [
    path.join(projectRoot, ".firebase-seed"),
    path.join(projectRoot, ".firebase-sessions"),
  ];
  if (
    forbidden.some(
      (item) =>
        resolved === item || resolved.startsWith(`${item}${path.sep}`),
    )
  ) {
    return {
      ok: false,
      code: "forbidden-backup-path",
      message: "El respaldo no puede ser .firebase-seed ni .firebase-sessions.",
    };
  }
  try {
    const directoryStats = await stat(resolved);
    if (!directoryStats.isDirectory()) {
      throw new Error("la ruta no es un directorio");
    }
    for (const relativePath of REQUIRED_BACKUP_FILES) {
      const filePath = path.join(resolved, relativePath);
      await access(filePath);
      const fileStats = await stat(filePath);
      if (!fileStats.isFile() || fileStats.size === 0) {
        throw new Error(`archivo requerido vacío: ${relativePath}`);
      }
    }
    const metadata = JSON.parse(
      await readFile(
        path.join(resolved, "firebase-export-metadata.json"),
        "utf8",
      ),
    );
    if (!metadata.firestore) {
      throw new Error("metadata sin exportación Firestore");
    }
  } catch (error) {
    return {
      ok: false,
      code: "invalid-backup",
      message: `El respaldo no es válido: ${error.message}`,
    };
  }
  return {ok: true, backupPath: resolved};
};

const inspectApprovedDecision = ({decision, tree}) => {
  const base = {
    treeId: decision.treeId,
    relationshipId: decision.relationshipId,
    fromPersonId: decision.fromPersonId,
    parentName: decision.parentName,
    toPersonId: decision.toPersonId,
    childName: decision.childName,
    currentParentRole: null,
    confirmedParentRole: decision.confirmedParentRole,
    classification: null,
    structuralEvidence: {
      relationshipIds: [],
      roles: [],
      children: [],
      count: 0,
      oppositeRoleEvidenceFound: false,
    },
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    status: "stale",
    failedValidations: [],
  };
  if (!tree?.exists) {
    return {
      ...base,
      failedValidations: [{
        code: "tree-not-found",
        message: "El árbol aprobado no existe.",
        status: "stale",
      }],
    };
  }
  const relationship = tree.relationships.find(
    (item) => item.id === decision.relationshipId,
  );
  if (!relationship) {
    return {
      ...base,
      failedValidations: [{
        code: "relationship-not-found",
        message: "La relación aprobada no existe.",
        status: "stale",
      }],
    };
  }

  const auditRecord = auditTreeParentRoles({
    treeId: tree.treeId,
    persons: tree.persons,
    relationships: tree.relationships,
  }).find((item) => item.relationshipId === relationship.id);
  const personIds = new Set(tree.persons.map(({id}) => id));
  const parentRolePresent =
    hasOwn(relationship, "parentRole") &&
    relationship.parentRole !== undefined;
  const currentParentRole = parentRolePresent
    ? relationship.parentRole
    : null;
  const explicitHistory = tree.relationships
    .filter(
      (item) =>
        item.type === "PARENT_OF" &&
        item.id !== relationship.id &&
        item.fromPersonId === relationship.fromPersonId &&
        VALID_PARENT_ROLES.has(item.parentRole),
    )
    .map((item) => ({
      relationshipId: item.id,
      childId: item.toPersonId,
      parentRole: item.parentRole,
    }))
    .sort((left, right) =>
      left.relationshipId.localeCompare(right.relationshipId),
    );
  const oppositeRole =
    decision.confirmedParentRole === "father" ? "mother" : "father";
  const oppositeRoleEvidenceFound = explicitHistory.some(
    ({parentRole}) => parentRole === oppositeRole,
  );
  const failures = [];

  addFailure(
    failures,
    relationship.type === "PARENT_OF",
    "not-parent-relationship",
    "La relación no es PARENT_OF.",
    "ineligible",
  );
  addFailure(
    failures,
    typeof relationship.fromPersonId === "string" &&
      typeof relationship.toPersonId === "string",
    "endpoints-required",
    "La relación no contiene endpoints válidos.",
    "conflict",
  );
  addFailure(
    failures,
    relationship.fromPersonId === decision.fromPersonId &&
      relationship.toPersonId === decision.toPersonId,
    "reviewed-endpoints-changed",
    "Los endpoints no coinciden con el manifiesto revisado.",
    "conflict",
  );
  addFailure(
    failures,
    personIds.has(relationship.fromPersonId) &&
      personIds.has(relationship.toPersonId),
    "orphan-reference",
    "El progenitor o el hijo no existe.",
    "conflict",
  );
  addFailure(
    failures,
    relationship.fromPersonId !== relationship.toPersonId,
    "self-parent-link",
    "La relación es una autorrelación.",
    "conflict",
  );
  for (const [flag, message] of [
    ["duplicate-parent-edge", "Existe una arista parental duplicada."],
    ["too-many-parents", "El hijo tiene más de dos progenitores."],
    ["duplicate-parent-role", "Existe un rol parental duplicado."],
    ["orphan-reference", "Existe una referencia huérfana."],
    ["cycle-detected", "La relación participa en un ciclo."],
    ["self-parent-link", "La relación es una autorrelación."],
  ]) {
    addFailure(
      failures,
      !auditRecord?.flags.includes(flag),
      flag,
      message,
      "conflict",
    );
  }
  addFailure(
    failures,
    decision.reviewDecision === "approve" &&
      decision.treeId === APPROVED_TREE_ID,
    "approval-not-authorized",
    "La decisión no es una aprobación contractual del árbol permitido.",
    "ineligible",
  );
  addFailure(
    failures,
    VALID_PARENT_ROLES.has(decision.confirmedParentRole),
    "invalid-confirmed-role",
    "confirmedParentRole no es father ni mother.",
    "ineligible",
  );
  addFailure(
    failures,
    explicitHistory.some(
      ({parentRole}) => parentRole === decision.confirmedParentRole,
    ),
    "supporting-evidence-not-found",
    "No existe evidencia explícita del rol confirmado.",
    "ineligible",
  );
  addFailure(
    failures,
    !oppositeRoleEvidenceFound,
    "opposite-role-evidence-found",
    "Existe evidencia explícita del rol contrario.",
    "conflict",
  );

  let successfulStatus = "eligible";
  let classification = auditRecord?.classification ?? null;
  if (parentRolePresent) {
    if (
      VALID_PARENT_ROLES.has(currentParentRole) &&
      currentParentRole === decision.confirmedParentRole
    ) {
      successfulStatus = "already-migrated";
      classification = "already-migrated";
    } else {
      failures.push({
        code: VALID_PARENT_ROLES.has(currentParentRole)
          ? "confirmed-role-conflict"
          : "invalid-current-role",
        message:
          "parentRole está presente y no coincide con el rol confirmado.",
        status: "conflict",
      });
    }
  } else {
    addFailure(
      failures,
      auditRecord?.candidateParentRole == null ||
        auditRecord.candidateParentRole === decision.confirmedParentRole,
      "candidate-role-conflict",
      "El candidato estructural no coincide con el rol confirmado.",
      "conflict",
    );
  }

  const failedValidations = uniqueFailures(failures);
  return {
    ...base,
    fromPersonId: relationship.fromPersonId ?? decision.fromPersonId,
    toPersonId: relationship.toPersonId ?? decision.toPersonId,
    parentName: auditRecord?.parentName ?? decision.parentName,
    childName: auditRecord?.childName ?? decision.childName,
    currentParentRole,
    classification,
    structuralEvidence: {
      relationshipIds: explicitHistory.map(
        ({relationshipId}) => relationshipId,
      ),
      roles: explicitHistory.map(({parentRole}) => parentRole),
      children: explicitHistory.map(({childId}) => childId),
      count: explicitHistory.length,
      oppositeRoleEvidenceFound,
    },
    status: resolveStatus(failedValidations) ?? successfulStatus,
    failedValidations,
  };
};

export const buildProtectedApprovedParentRolePlan = ({manifest, trees}) => {
  const manifestValidation = validateDecisionManifest(manifest);
  if (!manifestValidation.ok) {
    throw new Error(
      `Manifiesto inválido: ` +
      manifestValidation.errors.map(({code}) => code).join(", "),
    );
  }
  const treeById = new Map(trees.map((tree) => [tree.treeId, tree]));
  const approved = manifest.decisions.filter(
    ({reviewDecision}) => reviewDecision === "approve",
  );
  const approvedCases = approved.map((decision) =>
    inspectApprovedDecision({
      decision,
      tree: treeById.get(decision.treeId),
    }),
  );
  const excludedCases = manifest.decisions
    .filter(({reviewDecision}) => reviewDecision !== "approve")
    .map((decision) => ({
      treeId: decision.treeId,
      relationshipId: decision.relationshipId,
      reviewDecision: decision.reviewDecision,
      confirmedParentRole: null,
      reviewNotes: decision.reviewNotes,
      status:
        decision.reviewDecision === "reject"
          ? "excluded-rejected"
          : "excluded-unknown",
      proposedAction: "none",
    }));
  const invalidCases = approvedCases.filter(
    ({status}) =>
      !["eligible", "already-migrated"].includes(status),
  );
  const proposedUpdates = invalidCases.length === 0
    ? approvedCases
        .filter(({status}) => status === "eligible")
        .map((item) => ({
          treeId: item.treeId,
          relationshipId: item.relationshipId,
          currentParentRole: null,
          confirmedParentRole: item.confirmedParentRole,
          classification: item.classification,
          structuralEvidence: item.structuralEvidence,
          reviewedBy: item.reviewedBy,
          reviewedAt: item.reviewedAt,
        }))
    : [];
  const summary = {
    decisions: manifestValidation.summary.totalDecisions,
    approved: manifestValidation.summary.approved,
    rejected: manifestValidation.summary.rejected,
    unknown: manifestValidation.summary.unknown,
    eligible: count(approvedCases, ({status}) => status === "eligible"),
    alreadyMigrated: count(
      approvedCases,
      ({status}) => status === "already-migrated",
    ),
    conflicts: count(approvedCases, ({status}) => status === "conflict"),
    stale: count(approvedCases, ({status}) => status === "stale"),
    ineligible: count(
      approvedCases,
      ({status}) => status === "ineligible",
    ),
    proposedUpdates: proposedUpdates.length,
    proposedFather: count(
      proposedUpdates,
      ({confirmedParentRole}) => confirmedParentRole === "father",
    ),
    proposedMother: count(
      proposedUpdates,
      ({confirmedParentRole}) => confirmedParentRole === "mother",
    ),
    excludedRejected: count(
      excludedCases,
      ({status}) => status === "excluded-rejected",
    ),
    excludedUnknown: count(
      excludedCases,
      ({status}) => status === "excluded-unknown",
    ),
  };
  return {
    ok: invalidCases.length === 0,
    summary,
    approvedCases,
    excludedCases,
    proposedUpdates,
    validationFailures: invalidCases.map(
      ({treeId, relationshipId, status, failedValidations}) => ({
        treeId,
        relationshipId,
        status,
        failedValidations,
      }),
    ),
  };
};

export const buildApprovedWriteOperations = (plan) => {
  if (!plan.ok) {
    return [];
  }
  return plan.proposedUpdates.map(
    ({treeId, relationshipId, confirmedParentRole}) => ({
      treeId,
      relationshipId,
      data: {parentRole: confirmedParentRole},
    }),
  );
};
