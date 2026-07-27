import {auditTreeParentRoles, VALID_PARENT_ROLES} from "./parent-role-audit.mjs";

const TREE_GIB = "gib7tREAAsXDQX4Qh3Oh";
const TREE_KXF = "kXF9ZeSASxkDtDQQ2ALj";

const target = (
  treeId,
  relationshipId,
  expectedParentName,
  expectedChildName,
  expectedCandidateRole,
) => Object.freeze({
  treeId,
  relationshipId,
  expectedParentName,
  expectedChildName,
  expectedCandidateRole,
});

export const AUTHORIZED_MANUAL_REVIEW_TARGETS = Object.freeze([
  target(TREE_GIB, "H9PP0OO1OkxwNJvf1tEs", "Vitaliano Salazar", "Goyo Aragon", "father"),
  target(TREE_GIB, "pXvd39v6K0DB6koe1iUj", "Dora Salazar", "Goyo Aragon", "mother"),
  target(TREE_GIB, "XZ70WiABnLnS0ri656hn", "Vitaliano Salazar", "Belinda Aragon", "father"),
  target(TREE_GIB, "Yz0INPykGGxPqTQBt8E0", "Dora Salazar", "Belinda Aragon", "mother"),
  target(TREE_GIB, "0vVf5kDPxLtpCnR0MZKy", "Dora Salazar", "Sael Aragon", "mother"),
  target(TREE_GIB, "6Inxu9uJ8SjZ4N8QCgye", "Vitaliano Salazar", "Sael Aragon", "father"),
  target(TREE_GIB, "B1hy80BoHDaYaE8KTrDv", "Dora Salazar", "Alejandro Salazar", "mother"),
  target(TREE_GIB, "Bx4FkaBG9ZN784AEFpPT", "Vitaliano Salazar", "Alejandro Salazar", "father"),
  target(TREE_GIB, "kVNVtAPHTFhu0KpJKXxL", "Juana Palomino", "Vinchenzo Aragon", "mother"),
  target(TREE_GIB, "NLkUfXNuKQ5af6pj73Q7", "Fernando Aragon", "Vinchenzo Aragon", "father"),
  target(TREE_GIB, "TB9ybSZ84mx5unFDWIys", "Victor Varillas", "Dani Varillas", "father"),
  target(TREE_GIB, "DXefqsLnY5OM68kWbQHq", "Fernando Aragon", "Otro Aragon", "father"),
  target(TREE_GIB, "t89Awkmdmu8vMETyD2Eq", "Juana Palomino", "Otro Aragon", "mother"),
  target(TREE_GIB, "addts8MpT0SNm6SrScsp", "Vitaliano Salazar", "Marlene Salazar", "father"),
  target(TREE_GIB, "qFcURtPYpprXJ9THhpwY", "Dora Salazar", "Marlene Salazar", "mother"),
  target(TREE_GIB, "3MWxkUPxWgdI16Cw5oep", "Leonilda Palomino", "Jesus Palomion", "mother"),
  target(TREE_GIB, "JDSbt5KD56eOVhs2q6Um", "Victor Varillas", "Mariela Varillas", "father"),
  target(TREE_GIB, "TLmuIyZZKgOZZcf3kLu2", "Juana Palomino", "Anlly Lazo", "mother"),
  target(TREE_KXF, "AKpIDy96f4osS8fq6lRc", "Fernando Aragon", "Fernando V Aragon", "father"),
  target(TREE_KXF, "pMIwwEwDEmLUfHxlVX6R", "Juana Palomino", "Fernando V Aragon", "mother"),
  target(TREE_KXF, "AZuU6UkGSn0FZedzF4SN", "Juana Palomino", "Anlly Lazo", "mother"),
]);

export const MANUAL_DECISION_FIELDS = Object.freeze({
  reviewDecision: null,
  confirmedParentRole: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
});

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const addFailure = (failures, condition, code, message, status) => {
  if (!condition) {
    failures.push({code, message, status});
  }
};

const compareText = (left, right) => (left ?? "").localeCompare(right ?? "");

const compareCases = (left, right) =>
  compareText(left.treeId, right.treeId) ||
  compareText(left.parentName, right.parentName) ||
  compareText(left.childName, right.childName) ||
  compareText(left.relationshipId, right.relationshipId);

const statusPriority = ["stale", "conflict", "ineligible"];

const resolveStatus = (failures) =>
  statusPriority.find((status) =>
    failures.some((failure) => failure.status === status),
  ) ?? "ready-for-review";

const uniqueFailures = (failures) => [
  ...new Map(failures.map((failure) => [failure.code, failure])).values(),
];

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
    const closingBracket = normalized.indexOf("]");
    hostname = closingBracket > 0
      ? normalized.slice(1, closingBracket)
      : normalized;
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

const inspectTarget = ({target: authorizedTarget, tree}) => {
  const base = {
    treeId: authorizedTarget.treeId,
    relationshipId: authorizedTarget.relationshipId,
    fromPersonId: null,
    parentName: authorizedTarget.expectedParentName,
    toPersonId: null,
    childName: authorizedTarget.expectedChildName,
    currentParentRole: null,
    candidateParentRole: authorizedTarget.expectedCandidateRole,
    classification: null,
    requiresManualConfirmation: false,
    evidenceRelationshipIds: [],
    evidenceRoles: [],
    evidenceChildren: [],
    evidenceCount: 0,
    oppositeRoleEvidenceFound: false,
    failedValidations: [],
    passedValidations: [],
    currentStatus: "stale",
    ...MANUAL_DECISION_FIELDS,
  };

  if (!tree?.exists) {
    return {
      ...base,
      failedValidations: [{
        code: "tree-not-found",
        message: "El árbol autorizado no existe.",
        status: "stale",
      }],
    };
  }

  const relationship = tree.relationships.find(
    (candidate) => candidate.id === authorizedTarget.relationshipId,
  );
  if (!relationship) {
    return {
      ...base,
      failedValidations: [{
        code: "relationship-not-found",
        message: "La relación autorizada no existe.",
        status: "stale",
      }],
      passedValidations: ["tree-exists"],
    };
  }

  const auditRecord = auditTreeParentRoles({
    treeId: tree.treeId,
    persons: tree.persons,
    relationships: tree.relationships,
  }).find((record) => record.relationshipId === relationship.id);
  const personById = new Map(tree.persons.map((person) => [person.id, person]));
  const parentRolePresent =
    hasOwn(relationship, "parentRole") &&
    relationship.parentRole !== undefined;
  const explicitHistory = tree.relationships
    .filter(
      (candidate) =>
        candidate.type === "PARENT_OF" &&
        candidate.id !== relationship.id &&
        candidate.fromPersonId === relationship.fromPersonId &&
        VALID_PARENT_ROLES.has(candidate.parentRole),
    )
    .map((candidate) => ({
      relationshipId: candidate.id,
      childId: candidate.toPersonId,
      childName:
        auditTreeParentRoles({
          treeId: tree.treeId,
          persons: tree.persons,
          relationships: [candidate],
        })[0]?.childName ?? candidate.toPersonId,
      parentRole: candidate.parentRole,
    }))
    .sort((left, right) =>
      left.relationshipId.localeCompare(right.relationshipId),
    );
  const observedRoles = [...new Set(
    explicitHistory.map((evidence) => evidence.parentRole),
  )].sort();
  const oppositeRole =
    authorizedTarget.expectedCandidateRole === "father" ? "mother" : "father";
  const oppositeRoleEvidenceFound = explicitHistory.some(
    (evidence) => evidence.parentRole === oppositeRole,
  );
  const failures = [];

  addFailure(
    failures,
    relationship.type === "PARENT_OF",
    "not-parent-relationship",
    "La relación ya no es PARENT_OF.",
    "ineligible",
  );
  addFailure(
    failures,
    !parentRolePresent,
    "parent-role-already-present",
    "parentRole ya está presente; el caso quedó obsoleto.",
    "stale",
  );
  addFailure(
    failures,
    typeof relationship.fromPersonId === "string" &&
      typeof relationship.toPersonId === "string",
    "invalid-endpoints",
    "La relación no contiene endpoints válidos.",
    "conflict",
  );
  addFailure(
    failures,
    personById.has(relationship.fromPersonId) &&
      personById.has(relationship.toPersonId),
    "orphan-reference",
    "El progenitor o el hijo no existe en persons.",
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
    ["duplicate-parent-role", "El hijo tiene un rol father o mother duplicado."],
    ["cycle-detected", "La relación participa en un ciclo parental."],
    ["orphan-reference", "La auditoría detectó una referencia huérfana."],
    ["self-parent-link", "La auditoría detectó una autorrelación."],
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
    auditRecord?.classification ===
      "missing-role-consistent-parent-history",
    "classification-changed",
    "La clasificación actual ya no requiere confirmación por historial consistente.",
    "ineligible",
  );
  addFailure(
    failures,
    auditRecord?.requiresManualConfirmation === true,
    "manual-confirmation-not-required",
    "La auditoría ya no marca el caso para confirmación manual.",
    "ineligible",
  );
  addFailure(
    failures,
    auditRecord?.candidateParentRole === null ||
      auditRecord?.candidateParentRole === undefined ||
      auditRecord.candidateParentRole ===
        authorizedTarget.expectedCandidateRole,
    "candidate-mismatch",
    "El candidato actual no coincide con la lista contractual.",
    "conflict",
  );
  addFailure(
    failures,
    explicitHistory.length > 0,
    "supporting-evidence-not-found",
    "No existe una relación explícita de soporte del mismo progenitor.",
    "ineligible",
  );
  addFailure(
    failures,
    observedRoles.length <= 1,
    "inconsistent-supporting-roles",
    "Las relaciones explícitas del progenitor no usan un único rol.",
    "conflict",
  );
  addFailure(
    failures,
    !oppositeRoleEvidenceFound,
    "opposite-role-evidence-found",
    `Existe evidencia explícita del rol contrario ${oppositeRole}.`,
    "conflict",
  );

  const failedValidations = uniqueFailures(failures);
  const currentStatus = resolveStatus(failedValidations);
  const allValidations = [
    "tree-exists",
    "relationship-exists",
    "parent-of",
    "parent-role-absent",
    "endpoints-valid",
    "persons-exist",
    "not-self-parent",
    "no-duplicate-edge",
    "at-most-two-parents",
    "unique-parent-roles",
    "no-cycle",
    "no-orphan-reference",
    "manual-history-classification",
    "manual-confirmation-required",
    "candidate-matches-contract",
    "supporting-evidence-present",
    "supporting-role-consistent",
    "no-opposite-role-evidence",
  ];

  return {
    ...base,
    fromPersonId: relationship.fromPersonId ?? null,
    parentName: auditRecord?.parentName ?? authorizedTarget.expectedParentName,
    toPersonId: relationship.toPersonId ?? null,
    childName: auditRecord?.childName ?? authorizedTarget.expectedChildName,
    currentParentRole: parentRolePresent ? relationship.parentRole : null,
    candidateParentRole:
      auditRecord?.candidateParentRole ??
      authorizedTarget.expectedCandidateRole,
    classification: parentRolePresent
      ? "already-migrated"
      : auditRecord?.classification ?? null,
    requiresManualConfirmation:
      auditRecord?.requiresManualConfirmation === true,
    evidenceRelationshipIds: explicitHistory.map(
      (evidence) => evidence.relationshipId,
    ),
    evidenceRoles: explicitHistory.map((evidence) => evidence.parentRole),
    evidenceChildren: explicitHistory.map((evidence) => ({
      personId: evidence.childId,
      name: evidence.childName,
    })),
    evidenceCount: explicitHistory.length,
    oppositeRoleEvidenceFound,
    failedValidations,
    passedValidations:
      currentStatus === "ready-for-review" ? allValidations : [],
    currentStatus,
  };
};

export const buildManualReviewMatrix = ({
  trees,
  targets = AUTHORIZED_MANUAL_REVIEW_TARGETS,
}) => {
  const authorizedKeys = new Set(
    AUTHORIZED_MANUAL_REVIEW_TARGETS.map(
      (item) => `${item.treeId}/${item.relationshipId}`,
    ),
  );
  const unauthorized = targets.filter(
    (item) => !authorizedKeys.has(`${item.treeId}/${item.relationshipId}`),
  );
  if (unauthorized.length > 0 || targets.length !== AUTHORIZED_MANUAL_REVIEW_TARGETS.length) {
    throw new Error("El alcance debe contener exactamente los 21 objetivos autorizados.");
  }

  const treeById = new Map(trees.map((tree) => [tree.treeId, tree]));
  const cases = targets
    .map((item) => inspectTarget({
      target: item,
      tree: treeById.get(item.treeId),
    }))
    .sort(compareCases)
    .map((item, index) => ({reviewNumber: index + 1, ...item}));
  const summary = {
    authorizedCases: cases.length,
    readyForReview: cases.filter(
      (item) => item.currentStatus === "ready-for-review",
    ).length,
    stale: cases.filter((item) => item.currentStatus === "stale").length,
    conflicts: cases.filter(
      (item) => item.currentStatus === "conflict",
    ).length,
    ineligible: cases.filter(
      (item) => item.currentStatus === "ineligible",
    ).length,
    suggestedFather: cases.filter(
      (item) => item.candidateParentRole === "father",
    ).length,
    suggestedMother: cases.filter(
      (item) => item.candidateParentRole === "mother",
    ).length,
    oppositeRoleEvidenceCases: cases.filter(
      (item) => item.oppositeRoleEvidenceFound,
    ).length,
    supportingRelationships: cases.reduce(
      (total, item) => total + item.evidenceCount,
      0,
    ),
    completedReviewDecisions: cases.filter(
      (item) => item.reviewDecision !== null,
    ).length,
    firestoreWrites: 0,
  };

  return {
    ok:
      summary.authorizedCases === 21 &&
      summary.readyForReview === 21 &&
      summary.stale === 0 &&
      summary.conflicts === 0 &&
      summary.ineligible === 0,
    summary,
    cases,
    warnings: cases
      .filter((item) => item.currentStatus !== "ready-for-review")
      .map((item) => ({
        treeId: item.treeId,
        relationshipId: item.relationshipId,
        currentStatus: item.currentStatus,
        failures: item.failedValidations,
      })),
  };
};

export const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const buildManualReviewCsv = (cases) => {
  const columns = [
    "reviewNumber",
    "treeId",
    "relationshipId",
    "fromPersonId",
    "parentName",
    "toPersonId",
    "childName",
    "currentParentRole",
    "candidateParentRole",
    "classification",
    "evidenceRelationshipIds",
    "evidenceRoles",
    "evidenceChildren",
    "evidenceCount",
    "oppositeRoleEvidenceFound",
    "currentStatus",
    "reviewDecision",
    "confirmedParentRole",
    "reviewedBy",
    "reviewedAt",
    "reviewNotes",
  ];
  const rows = cases.map((item) => [
    item.reviewNumber,
    item.treeId,
    item.relationshipId,
    item.fromPersonId,
    item.parentName,
    item.toPersonId,
    item.childName,
    item.currentParentRole,
    item.candidateParentRole,
    item.classification,
    item.evidenceRelationshipIds.join(";"),
    item.evidenceRoles.join(";"),
    item.evidenceChildren
      .map((child) => `${child.personId}:${child.name}`)
      .join(";"),
    item.evidenceCount,
    item.oppositeRoleEvidenceFound,
    item.currentStatus,
    item.reviewDecision,
    item.confirmedParentRole,
    item.reviewedBy,
    item.reviewedAt,
    item.reviewNotes,
  ]);
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n") + "\n";
};
