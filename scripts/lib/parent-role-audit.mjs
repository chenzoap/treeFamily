export const VALID_PARENT_ROLES = new Set(["father", "mother"]);

const STRUCTURAL_CLASSIFICATION_PRIORITY = [
  "orphan-reference",
  "self-parent-link",
  "duplicate-parent-edge",
  "too-many-parents",
  "duplicate-parent-role",
  "cycle-detected",
];

const compareText = (left, right) => left.localeCompare(right);

const relationshipKey = (relationship) =>
  `${relationship.fromPersonId}\u0000${relationship.toPersonId}`;

const readablePersonName = (person) => {
  if (!person) {
    return null;
  }

  const name = [
    person.firstName,
    person.middleName,
    person.lastName,
    person.secondLastName,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ");

  return name || null;
};

const hasParentRoleField = (relationship) =>
  Object.prototype.hasOwnProperty.call(relationship, "parentRole") &&
  relationship.parentRole !== undefined;

const findDirectedPath = (relationships, fromPersonId, toPersonId) => {
  const adjacency = new Map();

  for (const relationship of relationships) {
    if (!adjacency.has(relationship.fromPersonId)) {
      adjacency.set(relationship.fromPersonId, new Set());
    }
    adjacency.get(relationship.fromPersonId).add(relationship.toPersonId);
  }

  const pending = [fromPersonId];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === toPersonId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        pending.push(next);
      }
    }
  }

  return false;
};

const relationshipParticipatesInCycle = (relationship, relationships) => {
  if (relationship.fromPersonId === relationship.toPersonId) {
    return true;
  }

  return findDirectedPath(
    relationships,
    relationship.toPersonId,
    relationship.fromPersonId,
  );
};

const addToGroupedList = (map, key, value) => {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
};

const explicitRoleHistoryForPerson = (
  parentId,
  currentRelationshipId,
  relationships,
) =>
  relationships
    .filter(
      (relationship) =>
        relationship.id !== currentRelationshipId &&
        relationship.fromPersonId === parentId &&
        VALID_PARENT_ROLES.has(relationship.parentRole),
    )
    .map((relationship) => ({
      relationshipId: relationship.id,
      childId: relationship.toPersonId,
      parentRole: relationship.parentRole,
    }))
    .sort((left, right) =>
      compareText(left.relationshipId, right.relationshipId),
    );

const structuralClassification = (flags) =>
  STRUCTURAL_CLASSIFICATION_PRIORITY.find((classification) =>
    flags.includes(classification),
  ) ?? null;

const classifyMissingRole = ({
  relationship,
  childRelationships,
  distinctParentCount,
  flags,
  allRelationships,
}) => {
  const structurallyInvalid = structuralClassification(flags);
  if (structurallyInvalid) {
    return {
      classification: structurallyInvalid,
      candidateParentRole: null,
      requiresManualConfirmation: false,
      supportingRelationships: [],
      reason: `La relación presenta el conflicto estructural ${structurallyInvalid}.`,
    };
  }

  const otherRelationships = childRelationships.filter(
    (candidate) => candidate.id !== relationship.id,
  );
  const validOthers = otherRelationships.filter((candidate) =>
    VALID_PARENT_ROLES.has(candidate.parentRole),
  );
  const missingOthers = otherRelationships.filter(
    (candidate) => !hasParentRoleField(candidate),
  );

  if (
    childRelationships.length === 2 &&
    distinctParentCount === 2 &&
    validOthers.length === 1 &&
    missingOthers.length === 0
  ) {
    const otherRole = validOthers[0].parentRole;
    const candidateParentRole = otherRole === "father" ? "mother" : "father";
    return {
      classification: "missing-role-deterministic-complement",
      candidateParentRole,
      requiresManualConfirmation: false,
      supportingRelationships: [
        {
          relationshipId: validOthers[0].id,
          childId: validOthers[0].toPersonId,
          parentRole: otherRole,
        },
      ],
      reason:
        `El hijo tiene exactamente dos progenitores y el otro posee el rol ` +
        `${otherRole}; el único complemento válido es ${candidateParentRole}.`,
    };
  }

  const history = explicitRoleHistoryForPerson(
    relationship.fromPersonId,
    relationship.id,
    allRelationships,
  );
  const historicalRoles = new Set(history.map((item) => item.parentRole));

  if (historicalRoles.size === 1) {
    const [candidateParentRole] = historicalRoles;
    return {
      classification: "missing-role-consistent-parent-history",
      candidateParentRole,
      requiresManualConfirmation: true,
      supportingRelationships: history,
      reason:
        `El progenitor aparece como ${candidateParentRole} en otras relaciones ` +
        "explícitas, pero esta evidencia requiere confirmación manual.",
    };
  }

  if (distinctParentCount <= 1) {
    return {
      classification: "missing-role-ambiguous-single-parent",
      candidateParentRole: null,
      requiresManualConfirmation: false,
      supportingRelationships: [],
      reason:
        "El hijo tiene un único progenitor sin rol y no existe un complemento estructural.",
    };
  }

  return {
    classification: "missing-role-ambiguous-multiple-unknown",
    candidateParentRole: null,
    requiresManualConfirmation: false,
    supportingRelationships: [],
    reason:
      "Hay varios progenitores sin una asignación de roles estructuralmente unívoca.",
  };
};

export const auditTreeParentRoles = ({
  treeId,
  persons,
  relationships,
}) => {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const parentRelationships = relationships
    .filter((relationship) => relationship.type === "PARENT_OF")
    .map((relationship) => ({...relationship}));

  const relationshipsByChild = new Map();
  const relationshipsByEdge = new Map();

  for (const relationship of parentRelationships) {
    addToGroupedList(
      relationshipsByChild,
      relationship.toPersonId,
      relationship,
    );
    addToGroupedList(
      relationshipsByEdge,
      relationshipKey(relationship),
      relationship,
    );
  }

  const records = parentRelationships.map((relationship) => {
    const childRelationships =
      relationshipsByChild.get(relationship.toPersonId) ?? [];
    const edgeRelationships =
      relationshipsByEdge.get(relationshipKey(relationship)) ?? [];
    const distinctParentIds = new Set(
      childRelationships.map((candidate) => candidate.fromPersonId),
    );
    const explicitFatherCount = childRelationships.filter(
      (candidate) => candidate.parentRole === "father",
    ).length;
    const explicitMotherCount = childRelationships.filter(
      (candidate) => candidate.parentRole === "mother",
    ).length;
    const flags = [];

    if (
      !personById.has(relationship.fromPersonId) ||
      !personById.has(relationship.toPersonId)
    ) {
      flags.push("orphan-reference");
    }
    if (relationship.fromPersonId === relationship.toPersonId) {
      flags.push("self-parent-link");
    }
    if (edgeRelationships.length > 1) {
      flags.push("duplicate-parent-edge");
    }
    if (distinctParentIds.size > 2) {
      flags.push("too-many-parents");
    }
    if (explicitFatherCount > 1 || explicitMotherCount > 1) {
      flags.push("duplicate-parent-role");
    }
    if (
      relationshipParticipatesInCycle(
        relationship,
        parentRelationships,
      )
    ) {
      flags.push("cycle-detected");
    }

    const rolePresent = hasParentRoleField(relationship);
    const roleValid = VALID_PARENT_ROLES.has(relationship.parentRole);
    let classificationResult;

    if (rolePresent && !roleValid) {
      classificationResult = {
        classification: "invalid-role",
        candidateParentRole: null,
        requiresManualConfirmation: false,
        supportingRelationships: [],
        reason:
          "parentRole está presente, pero no es exactamente father ni mother.",
      };
    } else if (!rolePresent) {
      classificationResult = classifyMissingRole({
        relationship,
        childRelationships,
        distinctParentCount: distinctParentIds.size,
        flags,
        allRelationships: parentRelationships,
      });
    } else {
      const structuralIssue = structuralClassification(flags);
      classificationResult = structuralIssue
        ? {
            classification: structuralIssue,
            candidateParentRole: null,
            requiresManualConfirmation: false,
            supportingRelationships: [],
            reason: `La relación presenta el conflicto estructural ${structuralIssue}.`,
          }
        : {
            classification: "valid-role",
            candidateParentRole: null,
            requiresManualConfirmation: false,
            supportingRelationships: [],
            reason: `parentRole es ${relationship.parentRole} y no se detectó un conflicto inmediato.`,
          };
    }

    return {
      treeId,
      relationshipId: relationship.id,
      fromPersonId: relationship.fromPersonId,
      parentName: readablePersonName(
        personById.get(relationship.fromPersonId),
      ),
      toPersonId: relationship.toPersonId,
      childName: readablePersonName(personById.get(relationship.toPersonId)),
      parentRolePresent: rolePresent,
      parentRoleOriginal: rolePresent ? relationship.parentRole : null,
      totalDistinctParents: distinctParentIds.size,
      otherParentRoles: childRelationships
        .filter((candidate) => candidate.id !== relationship.id)
        .map((candidate) => ({
          relationshipId: candidate.id,
          parentId: candidate.fromPersonId,
          parentRole: hasParentRoleField(candidate)
            ? candidate.parentRole
            : null,
        }))
        .sort((left, right) =>
          compareText(left.relationshipId, right.relationshipId),
        ),
      duplicateRelationshipIds: edgeRelationships
        .map((candidate) => candidate.id)
        .filter((id) => id !== relationship.id)
        .sort(compareText),
      flags: [...new Set(flags)].sort(compareText),
      ...classificationResult,
    };
  });

  records.sort(
    (left, right) =>
      compareText(left.treeId, right.treeId) ||
      compareText(left.toPersonId, right.toPersonId) ||
      compareText(left.relationshipId, right.relationshipId),
  );

  return records;
};

export const summarizeParentRoleAudit = ({
  treeCount,
  personCount,
  relationshipCount,
  records,
}) => {
  const countClassification = (classification) =>
    records.filter((record) => record.classification === classification).length;
  const countFlag = (flag) =>
    records.filter((record) => record.flags.includes(flag)).length;

  return {
    treesAudited: treeCount,
    personsRead: personCount,
    relationshipsRead: relationshipCount,
    parentRelationships: records.length,
    fatherRoles: records.filter(
      (record) => record.parentRoleOriginal === "father",
    ).length,
    motherRoles: records.filter(
      (record) => record.parentRoleOriginal === "mother",
    ).length,
    missingRoles: records.filter((record) => !record.parentRolePresent).length,
    invalidRoles: countClassification("invalid-role"),
    deterministicComplements: countClassification(
      "missing-role-deterministic-complement",
    ),
    manualConfirmation: countClassification(
      "missing-role-consistent-parent-history",
    ),
    ambiguous:
      countClassification("missing-role-ambiguous-single-parent") +
      countClassification("missing-role-ambiguous-multiple-unknown"),
    duplicateEdges: countFlag("duplicate-parent-edge"),
    duplicateRoles: countFlag("duplicate-parent-role"),
    tooManyParents: countFlag("too-many-parents"),
    orphanReferences: countFlag("orphan-reference"),
    selfParentLinks: countFlag("self-parent-link"),
    cycles: countFlag("cycle-detected"),
    criticalErrors: records.filter((record) =>
      record.flags.some((flag) =>
        [
          "orphan-reference",
          "self-parent-link",
          "duplicate-parent-edge",
          "duplicate-parent-role",
          "too-many-parents",
          "cycle-detected",
        ].includes(flag),
      ),
    ).length,
  };
};
