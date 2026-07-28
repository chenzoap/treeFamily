export const AUTHORIZED_TREE_IDS = Object.freeze([
  "33YN4tiAbilBAuDR3NVh",
  "3PdSi2awLCAwZTeCoFvA",
  "H9Yg5ZlF8Tq3HHz1sfsW",
  "gib7tREAAsXDQX4Qh3Oh",
  "gshWd4MXivIlOBKLQbvn",
  "kXF9ZeSASxkDtDQQ2ALj",
  "pivZ2GYKKyaqM1tAbzOX",
  "tmXjFYRA9jIfW1cFAoXR",
]);

const KNOWN_REFERENCE_FIELDS = new Map([
  ["activeTreeId", "delete-field"],
  ["selectedTreeId", "delete-field"],
  ["currentTreeId", "delete-field"],
  ["lastTreeId", "delete-field"],
  ["treeIds", "remove-array-values"],
]);
const TREE_SCOPED_COLLECTIONS = new Set([
  "members",
  "memberships",
  "invites",
  "invitations",
  "treeAccess",
]);
const SENSITIVE_FIELDS = new Set([
  "ownerId",
  "email",
  "password",
  "passwordHash",
  "passwordSalt",
  "token",
  "tokens",
  "auth",
  "authExport",
]);
const compareText = (left, right) => left.localeCompare(right);
const clone = (value) => structuredClone(value);
const pathDepth = (path) => path.split("/").length;

export const validateLocalEmulatorHost = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return {ok: false, message: "FIRESTORE_EMULATOR_HOST es obligatorio."};
  }
  let parsed;
  try {
    parsed = new URL(`http://${value.trim()}`);
  } catch {
    return {ok: false, message: "FIRESTORE_EMULATOR_HOST no es válido."};
  }
  if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(parsed.hostname)) {
    return {ok: false, message: "Solo se permite un emulador loopback."};
  }
  return {ok: true, host: value.trim()};
};

export const validateAuthorizedTrees = (discoveredTreeIds) => {
  const discovered = [...new Set(discoveredTreeIds)].sort(compareText);
  const expected = [...AUTHORIZED_TREE_IDS].sort(compareText);
  const additionalTreeIds = discovered.filter((id) => !expected.includes(id));
  const missingTreeIds = expected.filter((id) => !discovered.includes(id));
  return {
    status:
      additionalTreeIds.length || missingTreeIds.length ? "stale" : "valid",
    discoveredTreeIds: discovered,
    additionalTreeIds,
    missingTreeIds,
  };
};

const redactValue = (value, authorizedIds) => {
  if (Array.isArray(value)) {
    const matches = value.filter((item) => authorizedIds.has(item));
    return matches.length ? {kind: "array", matchingTreeIds: matches.sort(compareText)} : null;
  }
  if (authorizedIds.has(value)) return {kind: "treeId", value};
  if (value && typeof value === "object") return {kind: "map", redacted: true};
  return null;
};

const findReferences = (value, authorizedIds, prefix = "") => {
  if (!value || typeof value !== "object") return [];
  const references = [];
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (authorizedIds.has(item)) {
      references.push({fieldPath, fieldName: key, value: item, kind: "scalar"});
      continue;
    }
    if (Array.isArray(item)) {
      const matchingTreeIds = item.filter((entry) => authorizedIds.has(entry));
      if (matchingTreeIds.length) {
        references.push({
          fieldPath,
          fieldName: key,
          value: matchingTreeIds,
          kind: "array",
        });
      }
      for (const [index, entry] of item.entries()) {
        if (entry && typeof entry === "object") {
          references.push(
            ...findReferences(entry, authorizedIds, `${fieldPath}.${index}`),
          );
        }
      }
      continue;
    }
    if (item && typeof item === "object") {
      references.push(...findReferences(item, authorizedIds, fieldPath));
    }
  }
  return references.sort((left, right) =>
    compareText(left.fieldPath, right.fieldPath),
  );
};

const basePlanEntry = (document, operation, reason) => ({
  documentPath: document.documentPath,
  collectionPath: document.collectionPath,
  documentId: document.documentId,
  treeId: document.treeId ?? null,
  operation,
  reason,
  fieldsAffected: [],
  currentReferenceValue: null,
  dependentDocuments: [],
  depth: document.depth ?? pathDepth(document.documentPath),
  estimatedWriteCount: operation === "preserve" ? 0 : 1,
});

const classifyExternalDocument = (document, authorizedIds) => {
  const references = findReferences(document.data, authorizedIds);
  if (!references.length) {
    return basePlanEntry(
      document,
      "preserve",
      "Documento independiente sin referencias a árboles autorizados.",
    );
  }
  const collectionName = document.collectionPath.split("/").at(-1);
  const directTreeReference = references.find(
    ({fieldPath}) => fieldPath === "treeId",
  );
  if (TREE_SCOPED_COLLECTIONS.has(collectionName) && directTreeReference) {
    const entry = basePlanEntry(
      {...document, treeId: directTreeReference.value},
      "delete",
      "Documento raíz específicamente vinculado a un árbol autorizado.",
    );
    entry.fieldsAffected = references.map(({fieldPath}) => fieldPath);
    entry.currentReferenceValue = {treeId: directTreeReference.value};
    return entry;
  }
  const known = references.every(({fieldName}) =>
    KNOWN_REFERENCE_FIELDS.has(fieldName),
  );
  if (known) {
    const entry = basePlanEntry(
      document,
      "clear-reference",
      "Documento preservado con referencias de navegación conocidas.",
    );
    entry.treeId =
      references.length === 1 && references[0].kind === "scalar"
        ? references[0].value
        : null;
    entry.fieldsAffected = references.map(({fieldPath}) => fieldPath);
    entry.currentReferenceValue = Object.fromEntries(
      references.map(({fieldPath, value}) => [
        fieldPath,
        redactValue(value, authorizedIds),
      ]),
    );
    entry.futureOperations = references.map((reference) => ({
      fieldPath: reference.fieldPath,
      operation:
        reference.kind === "array"
          ? "remove-authorized-treeIds-from-array"
          : KNOWN_REFERENCE_FIELDS.get(reference.fieldName) === "delete-field"
            ? "FieldValue.delete()"
            : "set-null",
      treeIds: Array.isArray(reference.value)
        ? [...reference.value].sort(compareText)
        : [reference.value],
    }));
    return entry;
  }
  const entry = basePlanEntry(
    document,
    "unresolved",
    "Contiene una referencia a un árbol en un campo no reconocido.",
  );
  entry.fieldsAffected = references.map(({fieldPath}) => fieldPath);
  entry.currentReferenceValue = {redacted: true, referenceCount: references.length};
  return entry;
};

export const classifyDocuments = (documents, treeValidation) => {
  const authorizedIds = new Set(AUTHORIZED_TREE_IDS);
  const deduplicated = new Map(
    documents.map((document) => [document.documentPath, clone(document)]),
  );
  const childrenByParent = new Map();
  for (const document of deduplicated.values()) {
    if (!document.parentDocumentPath) continue;
    const paths = childrenByParent.get(document.parentDocumentPath) ?? [];
    paths.push(document.documentPath);
    childrenByParent.set(document.parentDocumentPath, paths);
  }
  const classified = [...deduplicated.values()].map((document) => {
    const segments = document.documentPath.split("/");
    if (segments[0] === "trees" && authorizedIds.has(segments[1])) {
      const entry = basePlanEntry(
        {...document, treeId: segments[1]},
        "delete",
        segments.length === 2
          ? "Documento del árbol autorizado."
          : "Documento subordinado al árbol autorizado.",
      );
      entry.dependentDocuments = (childrenByParent.get(document.documentPath) ?? [])
        .sort(compareText);
      return entry;
    }
    return classifyExternalDocument(document, authorizedIds);
  });
  const sorted = classified.sort(
    (left, right) =>
      right.depth - left.depth ||
      compareText(left.documentPath, right.documentPath),
  );
  const unresolved = sorted.filter(({operation}) => operation === "unresolved");
  const ready =
    treeValidation.status === "valid" && unresolved.length === 0;
  return {
    ready,
    all: sorted,
    proposedDeletes: ready
      ? sorted.filter(({operation}) => operation === "delete")
      : [],
    proposedReferenceUpdates: ready
      ? sorted.filter(({operation}) => operation === "clear-reference")
      : [],
    preservedDocuments: sorted.filter(({operation}) => operation === "preserve"),
    unresolvedDocuments: unresolved,
  };
};

const countByPath = (entries, matcher) =>
  entries.filter((entry) => matcher(entry.documentPath.split("/"))).length;

export const projectFinalState = ({
  inventory,
  classification,
  treeValidation,
}) => {
  const ready = classification.ready && treeValidation.status === "valid";
  const projected = {
    trees: ready ? 0 : inventory.treeCount,
    persons: ready ? 0 : inventory.personCount,
    relationships: ready ? 0 : inventory.relationshipCount,
    storedUnions: ready ? 0 : inventory.storedUnionCount,
    memberships: ready ? 0 : inventory.membershipCount,
    invitations: ready ? 0 : inventory.invitationCount,
    danglingAuthorizedTreeReferences: ready
      ? 0
      : classification.unresolvedDocuments.length,
    orphanDocuments: ready ? 0 : null,
    profilesPreserved: inventory.profileCount,
    authPreserved: true,
    globalConfigurationsPreserved: inventory.globalConfigurationCount,
  };
  return {
    ...projected,
    demonstrated:
      ready &&
      projected.trees === 0 &&
      projected.persons === 0 &&
      projected.relationships === 0 &&
      projected.danglingAuthorizedTreeReferences === 0 &&
      projected.orphanDocuments === 0,
  };
};

export const buildDeleteAllTestTreesPlan = ({
  documents,
  discoveredCollections = [],
  distinctOwnerCount = 0,
}) => {
  const original = clone(documents);
  const treeDocuments = documents.filter(
    ({documentPath}) => documentPath.split("/").length === 2 &&
      documentPath.startsWith("trees/"),
  );
  const treeValidation = validateAuthorizedTrees(
    treeDocuments.map(({documentId}) => documentId),
  );
  const classification = classifyDocuments(documents, treeValidation);
  const entries = classification.all;
  const byTree = AUTHORIZED_TREE_IDS.map((treeId) => {
    const treeDocument = treeDocuments.find(
      ({documentId}) => documentId === treeId,
    );
    const treePrefix = `trees/${treeId}/`;
    const treeChildren = documents.filter(({documentPath}) =>
      documentPath.startsWith(treePrefix),
    );
    const relationships = treeChildren.filter(({collectionPath}) =>
      collectionPath === `trees/${treeId}/relationships`,
    );
    return {
      treeId,
      rootPersonId: treeDocument?.data?.rootPersonId ?? null,
      persons: treeChildren.filter(({collectionPath}) =>
        collectionPath === `trees/${treeId}/persons`,
      ).length,
      relationships: relationships.length,
      parentRelationships: relationships.filter(
        ({data}) => data?.type === "PARENT_OF",
      ).length,
      partnerRelationships: relationships.filter(
        ({data}) => data?.type === "PARTNER_OF",
      ).length,
      subcollectionIds: [...new Set(
        treeChildren
          .map(({documentPath}) => documentPath.split("/")[2])
          .filter(Boolean),
      )].sort(compareText),
    };
  });
  const inventory = {
    treeCount: treeDocuments.length,
    personCount: countByPath(
      entries,
      (segments) => segments[0] === "trees" && segments[2] === "persons",
    ),
    relationshipCount: countByPath(
      entries,
      (segments) => segments[0] === "trees" && segments[2] === "relationships",
    ),
    storedUnionCount: countByPath(entries, (segments) =>
      segments.includes("unions"),
    ),
    membershipCount: countByPath(entries, (segments) =>
      segments.some((segment) => ["members", "memberships"].includes(segment)),
    ),
    invitationCount: countByPath(entries, (segments) =>
      segments.some((segment) => ["invites", "invitations"].includes(segment)),
    ),
    auxiliaryDocumentCount: entries.filter(({operation, documentPath}) =>
      operation === "delete" &&
      !/^(trees\/[^/]+|trees\/[^/]+\/(persons|relationships)\/[^/]+)$/
        .test(documentPath),
    ).length,
    profileCount: entries.filter(({collectionPath}) =>
      ["users", "profiles"].includes(collectionPath.split("/").at(-1)),
    ).length,
    globalConfigurationCount: entries.filter(({collectionPath}) =>
      ["config", "configs", "settings"].includes(
        collectionPath.split("/").at(-1),
      ),
    ).length,
    distinctOwnerCount,
    byTree,
  };
  const projectedFinalState = projectFinalState({
    inventory,
    classification,
    treeValidation,
  });
  const deleteEntries = entries.filter(({operation}) => operation === "delete");
  const clearEntries = entries.filter(
    ({operation}) => operation === "clear-reference",
  );
  const preserveEntries = entries.filter(
    ({operation}) => operation === "preserve",
  );
  return {
    treeValidation,
    inventory,
    deletionPlan: classification.proposedDeletes,
    referenceCleanupPlan: classification.proposedReferenceUpdates,
    preservedDocuments: classification.preservedDocuments,
    unresolvedDocuments: classification.unresolvedDocuments,
    projectedFinalState,
    summary: {
      ready: classification.ready && projectedFinalState.demonstrated,
      rootCollectionsExamined: discoveredCollections.length,
      treesFound: inventory.treeCount,
      documentsExamined: entries.length,
      deleteDocuments: deleteEntries.length,
      clearReferenceDocuments: clearEntries.length,
      preserveDocuments: preserveEntries.length,
      unresolvedDocuments: classification.unresolvedDocuments.length,
      persons: inventory.personCount,
      relationships: inventory.relationshipCount,
      memberships: inventory.membershipCount,
      invitations: inventory.invitationCount,
      auxiliaryDocuments: inventory.auxiliaryDocumentCount,
      estimatedFutureWrites: classification.ready
        ? deleteEntries.length + clearEntries.length
        : 0,
      authDeletes: 0,
      writesExecuted: 0,
    },
    inputUnchanged: JSON.stringify(original) === JSON.stringify(documents),
  };
};
