export type ParentRole = "father" | "mother";

export type ExistingParentLink = {
  parentId: string;
  childId: string;
  parentRole?: ParentRole;
};

export type ParentRoleAssignment = {
  personId: string;
  parentRole: ParentRole;
};

export type NewChildRoleErrorCode =
  | "invalid-parent-count"
  | "duplicate-parent-id"
  | "parent-role-keys-mismatch"
  | "invalid-parent-role"
  | "parent-role-occupied";

export type NewChildRoleValidationResult =
  | { ok: true; assignments: ParentRoleAssignment[] }
  | { ok: false; code: NewChildRoleErrorCode };

export type ExistingPairKind = "couple" | "coParents";

export type ExistingSharedChildParentLink = {
  parentId: string;
  childId: string;
  parentRole?: ParentRole;
};

export type ValidateNewChildForExistingUnionInput = {
  parentIds: readonly string[];
  parentRoles: Readonly<Record<string, unknown>>;
  hasPartnerRelationship?: boolean;
  sharedChildCount?: number;
  existingSharedChildParentLinks?: readonly ExistingSharedChildParentLink[];
};

export type NewChildUnionValidationErrorCode =
  | "invalid-parent-count"
  | "duplicate-parent-id"
  | "invalid-parent-role-assignment"
  | "existing-pair-not-found"
  | "invalid-existing-parent-state"
  | "parent-role-conflict";

export type NewChildUnionValidationResult =
  | {
      ok: true;
      kind: "singleParent" | ExistingPairKind;
      assignments: ParentRoleAssignment[];
    }
  | {
      ok: false;
      code: NewChildUnionValidationErrorCode;
      roleErrorCode?: NewChildRoleErrorCode;
    };

export type ParentLinkRejectionCode =
  | "invalid-parent-role"
  | "self-parent"
  | "duplicate-existing-parent-link"
  | "invalid-existing-parent-state"
  | "duplicate-parent-link"
  | "maximum-parents"
  | "existing-parent-role-unknown"
  | "parent-role-occupied"
  | "cycle-detected";

export type ParentLinkValidationResult =
  | {
      ok: true;
      link: Required<ExistingParentLink>;
    }
  | {
      ok: false;
      code: ParentLinkRejectionCode;
    };

export type ValidateNewParentLinkInput = {
  parentId: string;
  childId: string;
  parentRole: unknown;
  existingParentLinks: readonly ExistingParentLink[];
  allParentLinks: readonly ExistingParentLink[];
};

/**
 * Accepts only the two explicit roles supported by the MVP.
 *
 * @param {unknown} value Candidate role.
 * @return {ParentRole | null} The exact role, or null when invalid.
 */
export function normalizeParentRole(value: unknown): ParentRole | null {
  return value === "father" || value === "mother" ? value : null;
}

/**
 * Validates the complete role assignment for a newly created child.
 *
 * @param {Array<string>} parentIds Exact parent IDs for the child.
 * @param {Readonly<Record<string, unknown>>} roleValues Client assignment.
 * @return {NewChildRoleValidationResult} Sorted assignments or stable error.
 */
export function validateNewChildParentRoles(
  parentIds: readonly string[],
  roleValues: Readonly<Record<string, unknown>>
): NewChildRoleValidationResult {
  if (parentIds.length < 1 || parentIds.length > 2) {
    return { ok: false, code: "invalid-parent-count" };
  }

  const uniqueParentIds = new Set(parentIds);
  if (uniqueParentIds.size !== parentIds.length) {
    return { ok: false, code: "duplicate-parent-id" };
  }

  const sortedParentIds = [...parentIds].sort();
  const rolePersonIds = Object.keys(roleValues).sort();
  const keysMatch =
    sortedParentIds.length === rolePersonIds.length &&
    sortedParentIds.every((personId, index) =>
      personId === rolePersonIds[index]
    );

  if (!keysMatch) {
    return { ok: false, code: "parent-role-keys-mismatch" };
  }

  const assignments: ParentRoleAssignment[] = [];
  for (const personId of sortedParentIds) {
    const parentRole = normalizeParentRole(roleValues[personId]);
    if (!parentRole) {
      return { ok: false, code: "invalid-parent-role" };
    }
    assignments.push({ personId, parentRole });
  }

  if (
    assignments.length === 2 &&
    assignments[0].parentRole === assignments[1].parentRole
  ) {
    return { ok: false, code: "parent-role-occupied" };
  }

  return { ok: true, assignments };
}

/**
 * Resolves whether a two-person union already exists in stored evidence.
 *
 * @param {boolean} hasPartnerRelationship Whether PARTNER_OF exists.
 * @param {number} sharedChildCount Number of children shared by the pair.
 * @return {ExistingPairKind | null} The server-derived pair kind.
 */
export function resolveExistingPairKind(
  hasPartnerRelationship: boolean,
  sharedChildCount: number
): ExistingPairKind | null {
  if (!Number.isInteger(sharedChildCount) || sharedChildCount < 0) {
    throw new RangeError("sharedChildCount must be a non-negative integer");
  }
  if (hasPartnerRelationship) return "couple";
  return sharedChildCount > 0 ? "coParents" : null;
}

/**
 * Validates and plans parent links for a new child in an existing union.
 *
 * Error precedence is stable: invalid parent count, duplicated parent ID,
 * invalid role assignment, missing pair evidence, invalid historical state,
 * historical role conflict, then success.
 *
 * @param {ValidateNewChildForExistingUnionInput} input Server evidence and
 * client role assignment.
 * @return {NewChildUnionValidationResult} A deterministic plan or error.
 */
export function validateNewChildForExistingUnion(
  input: ValidateNewChildForExistingUnionInput
): NewChildUnionValidationResult {
  if (input.parentIds.length < 1 || input.parentIds.length > 2) {
    return { ok: false, code: "invalid-parent-count" };
  }

  const uniqueParentIds = new Set(input.parentIds);
  if (uniqueParentIds.size !== input.parentIds.length) {
    return { ok: false, code: "duplicate-parent-id" };
  }

  const roleResult = validateNewChildParentRoles(
    input.parentIds,
    input.parentRoles
  );
  if (!roleResult.ok) {
    return {
      ok: false,
      code: "invalid-parent-role-assignment",
      roleErrorCode: roleResult.code,
    };
  }

  let kind: "singleParent" | ExistingPairKind = "singleParent";
  if (input.parentIds.length === 2) {
    try {
      const pairKind = resolveExistingPairKind(
        input.hasPartnerRelationship === true,
        input.sharedChildCount ?? 0
      );
      if (!pairKind) {
        return { ok: false, code: "existing-pair-not-found" };
      }
      kind = pairKind;
    } catch (error) {
      if (error instanceof RangeError) {
        return { ok: false, code: "invalid-existing-parent-state" };
      }
      throw error;
    }
  }

  const historicalLinks = input.existingSharedChildParentLinks ?? [];
  const seenLinks = new Set<string>();
  const explicitRolesByParent = new Map<string, ParentRole>();
  const parentsByExplicitRole = new Map<ParentRole, string>();

  for (const link of historicalLinks) {
    const linkKey = `${link.parentId}\u0000${link.childId}`;
    if (seenLinks.has(linkKey) || !uniqueParentIds.has(link.parentId)) {
      return { ok: false, code: "invalid-existing-parent-state" };
    }
    seenLinks.add(linkKey);

    if (link.parentRole === undefined) continue;
    const historicalRole = normalizeParentRole(link.parentRole);
    if (!historicalRole) {
      return { ok: false, code: "invalid-existing-parent-state" };
    }

    const roleForParent = explicitRolesByParent.get(link.parentId);
    if (roleForParent && roleForParent !== historicalRole) {
      return { ok: false, code: "invalid-existing-parent-state" };
    }

    const parentForRole = parentsByExplicitRole.get(historicalRole);
    if (parentForRole && parentForRole !== link.parentId) {
      return { ok: false, code: "invalid-existing-parent-state" };
    }

    explicitRolesByParent.set(link.parentId, historicalRole);
    parentsByExplicitRole.set(historicalRole, link.parentId);
  }

  if (explicitRolesByParent.size > 2) {
    return { ok: false, code: "invalid-existing-parent-state" };
  }

  const contradictsHistory = roleResult.assignments.some((assignment) => {
    const historicalRole = explicitRolesByParent.get(assignment.personId);
    return historicalRole !== undefined &&
      historicalRole !== assignment.parentRole;
  });
  if (contradictsHistory) {
    return { ok: false, code: "parent-role-conflict" };
  }

  return {
    ok: true,
    kind,
    assignments: roleResult.assignments,
  };
}

/**
 * Detects a directed path in the parent-to-child graph without recursion.
 *
 * @param {Array<ExistingParentLink>} relationships Parent links.
 * @param {string} fromPersonId Path origin.
 * @param {string} toPersonId Path target.
 * @return {boolean} Whether the target is reachable.
 */
export function hasDirectedParentPath(
  relationships: readonly ExistingParentLink[],
  fromPersonId: string,
  toPersonId: string
): boolean {
  const childrenByParent = new Map<string, Set<string>>();
  for (const relationship of relationships) {
    const children = childrenByParent.get(relationship.parentId) ??
      new Set<string>();
    children.add(relationship.childId);
    childrenByParent.set(relationship.parentId, children);
  }

  const pending = [fromPersonId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === toPersonId) return true;

    visited.add(currentId);
    const children = childrenByParent.get(currentId);
    if (!children) continue;
    for (const childId of children) {
      if (!visited.has(childId)) pending.push(childId);
    }
  }

  return false;
}

/**
 * Validates a new parent-to-child link.
 *
 * Error precedence is deliberately stable:
 * invalid role, self link, duplicated stored documents, invalid stored state,
 * requested duplicate, maximum parents, unknown historical role, occupied
 * explicit role, cycle, then success.
 *
 * @param {ValidateNewParentLinkInput} input Candidate and existing graph.
 * @return {ParentLinkValidationResult} A normalized link or rejection code.
 */
export function validateNewParentLink(
  input: ValidateNewParentLinkInput
): ParentLinkValidationResult {
  const parentRole = normalizeParentRole(input.parentRole);
  if (!parentRole) {
    return { ok: false, code: "invalid-parent-role" };
  }

  if (input.parentId === input.childId) {
    return { ok: false, code: "self-parent" };
  }

  const countsByParent = new Map<string, number>();
  for (const link of input.existingParentLinks) {
    countsByParent.set(link.parentId, (countsByParent.get(link.parentId) ?? 0) + 1);
  }
  if ([...countsByParent.values()].some((count) => count > 1)) {
    return { ok: false, code: "duplicate-existing-parent-link" };
  }

  const hasInvalidChild = input.existingParentLinks.some(
    (link) => link.childId !== input.childId || link.parentId === link.childId
  );
  const explicitRoles = input.existingParentLinks
    .map((link) => link.parentRole)
    .filter((role): role is ParentRole => role !== undefined);
  const hasInvalidRole = input.existingParentLinks.some(
    (link) =>
      link.parentRole !== undefined &&
      normalizeParentRole(link.parentRole) === null
  );
  const hasDuplicateExplicitRole =
    new Set(explicitRoles).size !== explicitRoles.length;
  if (
    hasInvalidChild ||
    hasInvalidRole ||
    hasDuplicateExplicitRole ||
    countsByParent.size > 2
  ) {
    return { ok: false, code: "invalid-existing-parent-state" };
  }

  if (countsByParent.has(input.parentId)) {
    return { ok: false, code: "duplicate-parent-link" };
  }

  if (countsByParent.size >= 2) {
    return { ok: false, code: "maximum-parents" };
  }

  if (input.existingParentLinks.some((link) => link.parentRole === undefined)) {
    return { ok: false, code: "existing-parent-role-unknown" };
  }

  if (explicitRoles.includes(parentRole)) {
    return { ok: false, code: "parent-role-occupied" };
  }

  if (
    hasDirectedParentPath(
      input.allParentLinks,
      input.childId,
      input.parentId
    )
  ) {
    return { ok: false, code: "cycle-detected" };
  }

  return {
    ok: true,
    link: {
      parentId: input.parentId,
      childId: input.childId,
      parentRole,
    },
  };
}
