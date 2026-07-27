import {createHash} from "node:crypto";

import {
  AUTHORIZED_MANUAL_REVIEW_TARGETS,
  buildManualReviewMatrix,
  validateLocalEmulatorHost,
} from "./parent-role-manual-review.mjs";

export {validateLocalEmulatorHost};

export const DECISION_MANIFEST_RELATIVE_PATH =
  "scripts/data/parent-role-manual-decisions-2026-07-27.json";

const MAIN_TREE_ID = "gib7tREAAsXDQX4Qh3Oh";
const SECONDARY_TREE_ID = "kXF9ZeSASxkDtDQQ2ALj";
const VALID_DECISIONS = new Set(["approve", "reject", "unknown"]);
const VALID_PARENT_ROLES = new Set(["father", "mother"]);

const decisionKey = ({treeId, relationshipId}) =>
  `${treeId}/${relationshipId}`;

const addError = (errors, condition, code, message, key = null) => {
  if (!condition) {
    errors.push({code, message, key});
  }
};

const count = (values, predicate) => values.filter(predicate).length;

export const hashDecisionManifest = (rawManifest) =>
  createHash("sha256").update(rawManifest, "utf8").digest("hex");

export const validateDecisionManifest = (manifest) => {
  const errors = [];
  const decisions = Array.isArray(manifest?.decisions)
    ? manifest.decisions
    : [];
  const authorizedKeys = new Set(
    AUTHORIZED_MANUAL_REVIEW_TARGETS.map(decisionKey),
  );
  const seen = new Set();

  addError(
    errors,
    decisions.length === 21,
    "invalid-decision-count",
    "El manifiesto debe contener exactamente 21 decisiones.",
  );

  for (const decision of decisions) {
    const key = decisionKey(decision);
    addError(
      errors,
      typeof decision.treeId === "string" && decision.treeId.length > 0,
      "tree-id-required",
      "treeId es obligatorio.",
      key,
    );
    addError(
      errors,
      typeof decision.relationshipId === "string" &&
        decision.relationshipId.length > 0,
      "relationship-id-required",
      "relationshipId es obligatorio.",
      key,
    );
    addError(
      errors,
      !seen.has(key),
      "duplicate-decision",
      "Existe más de una decisión para el mismo treeId y relationshipId.",
      key,
    );
    seen.add(key);
    addError(
      errors,
      authorizedKeys.has(key),
      "decision-not-authorized",
      "La decisión no pertenece a la lista cerrada revisada en 8.1.4J.",
      key,
    );
    addError(
      errors,
      VALID_DECISIONS.has(decision.reviewDecision),
      "invalid-review-decision",
      "reviewDecision debe ser approve, reject o unknown.",
      key,
    );
    addError(
      errors,
      typeof decision.reviewedBy === "string" &&
        decision.reviewedBy.length > 0,
      "reviewed-by-required",
      "reviewedBy es obligatorio.",
      key,
    );
    addError(
      errors,
      typeof decision.reviewedAt === "string" &&
        decision.reviewedAt.length > 0,
      "reviewed-at-required",
      "reviewedAt es obligatorio.",
      key,
    );

    if (decision.reviewDecision === "approve") {
      addError(
        errors,
        VALID_PARENT_ROLES.has(decision.confirmedParentRole),
        "confirmed-parent-role-required",
        "Una aprobación requiere confirmedParentRole father o mother.",
        key,
      );
      addError(
        errors,
        decision.treeId === MAIN_TREE_ID,
        "approved-tree-not-authorized",
        "Todas las aprobaciones deben pertenecer al árbol principal.",
        key,
      );
      addError(
        errors,
        typeof decision.fromPersonId === "string" &&
          decision.fromPersonId.length > 0 &&
          typeof decision.toPersonId === "string" &&
          decision.toPersonId.length > 0,
        "reviewed-endpoints-required",
        "Una aprobación requiere los endpoints revisados.",
        key,
      );
    } else if (["reject", "unknown"].includes(decision.reviewDecision)) {
      addError(
        errors,
        decision.confirmedParentRole === null,
        "excluded-role-must-be-null",
        "Reject y unknown deben conservar confirmedParentRole null.",
        key,
      );
      addError(
        errors,
        typeof decision.reviewNotes === "string" &&
          decision.reviewNotes.length > 0,
        "excluded-notes-required",
        "Reject y unknown requieren reviewNotes.",
        key,
      );
      addError(
        errors,
        decision.treeId === SECONDARY_TREE_ID,
        "excluded-tree-not-authorized",
        "Las decisiones excluidas deben pertenecer al árbol secundario.",
        key,
      );
    }
  }

  for (const key of authorizedKeys) {
    addError(
      errors,
      seen.has(key),
      "authorized-decision-missing",
      "Falta una decisión de la lista cerrada.",
      key,
    );
  }

  const summary = {
    totalDecisions: decisions.length,
    approved: count(
      decisions,
      ({reviewDecision}) => reviewDecision === "approve",
    ),
    rejected: count(
      decisions,
      ({reviewDecision}) => reviewDecision === "reject",
    ),
    unknown: count(
      decisions,
      ({reviewDecision}) => reviewDecision === "unknown",
    ),
    approvedFather: count(
      decisions,
      ({reviewDecision, confirmedParentRole}) =>
        reviewDecision === "approve" && confirmedParentRole === "father",
    ),
    approvedMother: count(
      decisions,
      ({reviewDecision, confirmedParentRole}) =>
        reviewDecision === "approve" && confirmedParentRole === "mother",
    ),
  };

  for (const [actual, expected, code, message] of [
    [summary.approved, 18, "invalid-approved-count", "Se requieren 18 approve."],
    [summary.rejected, 2, "invalid-rejected-count", "Se requieren 2 reject."],
    [summary.unknown, 1, "invalid-unknown-count", "Se requiere 1 unknown."],
    [summary.approvedFather, 9, "invalid-father-count", "Se requieren 9 father aprobados."],
    [summary.approvedMother, 9, "invalid-mother-count", "Se requieren 9 mother aprobadas."],
  ]) {
    addError(errors, actual === expected, code, message);
  }

  return {ok: errors.length === 0, errors, summary};
};

const uniqueFailures = (failures) => [
  ...new Map(failures.map((failure) => [failure.code, failure])).values(),
];

const resolveApprovedStatus = (failures) =>
  ["stale", "conflict", "ineligible"].find((status) =>
    failures.some((failure) => failure.status === status),
  ) ?? "eligible";

const inspectApprovedDecision = ({decision, reviewCase}) => {
  const failures = [...(reviewCase?.failedValidations ?? [])];
  const addFailure = (condition, code, message, status) => {
    if (!condition) {
      failures.push({code, message, status});
    }
  };

  addFailure(
    Boolean(reviewCase),
    "review-case-not-found",
    "La relación aprobada no pertenece a la matriz autorizada.",
    "stale",
  );
  addFailure(
    reviewCase?.fromPersonId === decision.fromPersonId,
    "from-person-changed",
    "fromPersonId no coincide con el estado revisado.",
    "conflict",
  );
  addFailure(
    reviewCase?.toPersonId === decision.toPersonId,
    "to-person-changed",
    "toPersonId no coincide con el estado revisado.",
    "conflict",
  );
  addFailure(
    reviewCase?.candidateParentRole === decision.confirmedParentRole,
    "confirmed-role-mismatch",
    "El candidato estructural actual no coincide con confirmedParentRole.",
    "conflict",
  );
  addFailure(
    decision.reviewDecision === "approve",
    "decision-not-approved",
    "El objetivo no contiene una decisión approve.",
    "ineligible",
  );
  addFailure(
    VALID_PARENT_ROLES.has(decision.confirmedParentRole),
    "invalid-confirmed-role",
    "confirmedParentRole debe ser father o mother.",
    "ineligible",
  );

  const failedValidations = uniqueFailures(failures);
  const status = resolveApprovedStatus(failedValidations);
  return {
    treeId: decision.treeId,
    relationshipId: decision.relationshipId,
    fromPersonId: reviewCase?.fromPersonId ?? decision.fromPersonId,
    parentName: reviewCase?.parentName ?? decision.parentName,
    toPersonId: reviewCase?.toPersonId ?? decision.toPersonId,
    childName: reviewCase?.childName ?? decision.childName,
    currentParentRole: reviewCase?.currentParentRole ?? null,
    confirmedParentRole: decision.confirmedParentRole,
    classification: reviewCase?.classification ?? null,
    requiresManualConfirmation:
      reviewCase?.requiresManualConfirmation ?? false,
    structuralEvidence: {
      relationshipIds: reviewCase?.evidenceRelationshipIds ?? [],
      roles: reviewCase?.evidenceRoles ?? [],
      children: reviewCase?.evidenceChildren ?? [],
      count: reviewCase?.evidenceCount ?? 0,
      oppositeRoleEvidenceFound:
        reviewCase?.oppositeRoleEvidenceFound ?? false,
    },
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    status,
    failedValidations,
  };
};

export const buildApprovedParentRoleMigrationPlan = ({manifest, trees}) => {
  const manifestValidation = validateDecisionManifest(manifest);
  if (!manifestValidation.ok) {
    throw new Error(
      `Manifiesto de decisiones inválido: ` +
      manifestValidation.errors.map(({code}) => code).join(", "),
    );
  }

  const reviewMatrix = buildManualReviewMatrix({trees});
  const reviewCaseByKey = new Map(
    reviewMatrix.cases.map((item) => [decisionKey(item), item]),
  );
  const approvedDecisions = manifest.decisions.filter(
    ({reviewDecision}) => reviewDecision === "approve",
  );
  const approvedCases = approvedDecisions.map((decision) =>
    inspectApprovedDecision({
      decision,
      reviewCase: reviewCaseByKey.get(decisionKey(decision)),
    }),
  );
  const excludedCases = manifest.decisions
    .filter(({reviewDecision}) => reviewDecision !== "approve")
    .map((decision) => ({
      treeId: decision.treeId,
      relationshipId: decision.relationshipId,
      fromPersonId: decision.fromPersonId,
      parentName: decision.parentName,
      toPersonId: decision.toPersonId,
      childName: decision.childName,
      reviewDecision: decision.reviewDecision,
      confirmedParentRole: null,
      reviewNotes: decision.reviewNotes,
      reviewedBy: decision.reviewedBy,
      reviewedAt: decision.reviewedAt,
      status:
        decision.reviewDecision === "reject"
          ? "excluded-rejected"
          : "excluded-unknown",
      proposedAction: "none",
      futureReview:
        decision.reviewDecision === "reject"
          ? "Requiere una futura auditoría de integridad de identidad; no autoriza eliminación."
          : "Pertenece a un árbol diferente al caso aprobado equivalente; requiere revisar el propósito del árbol secundario.",
    }));
  const allApprovedEligible = approvedCases.every(
    ({status}) => status === "eligible",
  );
  const proposedUpdates = allApprovedEligible
    ? approvedCases.map((item) => ({
        treeId: item.treeId,
        relationshipId: item.relationshipId,
        currentParentRole: item.currentParentRole,
        confirmedParentRole: item.confirmedParentRole,
        classification: item.classification,
        structuralEvidence: item.structuralEvidence,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt,
      }))
    : [];
  const summary = {
    ...manifestValidation.summary,
    approvedEligible: count(
      approvedCases,
      ({status}) => status === "eligible",
    ),
    approvedStale: count(
      approvedCases,
      ({status}) => status === "stale",
    ),
    approvedConflicts: count(
      approvedCases,
      ({status}) => status === "conflict",
    ),
    approvedIneligible: count(
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
    firestoreWrites: 0,
  };

  return {
    ok:
      allApprovedEligible &&
      summary.approvedEligible === 18 &&
      summary.proposedUpdates === 18,
    summary,
    approvedCases,
    excludedCases,
    proposedUpdates,
    validationFailures: approvedCases
      .filter(({status}) => status !== "eligible")
      .map(({treeId, relationshipId, status, failedValidations}) => ({
        treeId,
        relationshipId,
        status,
        failedValidations,
      })),
  };
};
