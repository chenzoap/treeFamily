import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const addRelationshipFirestore = vi.hoisted(() => {
  const ownershipGet = vi.fn();
  const personGet = vi.fn();
  const duplicateGet = vi.fn();
  const relationshipSet = vi.fn();
  const batch = vi.fn();
  const runTransaction = vi.fn();
  const serverTimestamp = vi.fn(() => "server-timestamp");
  const relationshipDoc = {
    id: "new-relationship",
    set: relationshipSet,
  };
  const duplicateQuery = {
    where: vi.fn(),
    limit: vi.fn(),
    get: duplicateGet,
  };
  duplicateQuery.where.mockReturnValue(duplicateQuery);
  duplicateQuery.limit.mockReturnValue(duplicateQuery);

  const personsCollection = {
    doc: vi.fn(() => ({ get: personGet })),
  };
  const relationshipsCollection = {
    doc: vi.fn(() => relationshipDoc),
    where: vi.fn(() => duplicateQuery),
  };
  const treeRef = {
    get: ownershipGet,
    collection: vi.fn((name: string) =>
      name === "persons" ? personsCollection : relationshipsCollection
    ),
  };
  const treesCollection = {
    doc: vi.fn(() => treeRef),
  };
  const db = {
    collection: vi.fn(() => treesCollection),
    batch,
    runTransaction,
  };

  return {
    db,
    ownershipGet,
    personGet,
    duplicateGet,
    relationshipSet,
    batch,
    runTransaction,
    serverTimestamp,
  };
});

vi.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: vi.fn(),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => addRelationshipFirestore.db,
  FieldValue: {
    serverTimestamp: addRelationshipFirestore.serverTimestamp,
  },
}));

import { addRelationship } from "./index.js";
import {
  hasDirectedParentPath,
  normalizeParentRole,
  resolveExistingPairKind,
  validateNewChildForExistingUnion,
  validateNewChildParentRoles,
  validateNewParentLink,
  type ExistingParentLink,
} from "./parentRelationshipPolicy.js";

describe("addRelationship", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addRelationshipFirestore.ownershipGet.mockResolvedValue({
      exists: true,
      data: () => ({ ownerId: "owner" }),
    });
    addRelationshipFirestore.personGet.mockResolvedValue({ exists: true });
    addRelationshipFirestore.duplicateGet.mockResolvedValue({ empty: true });
    addRelationshipFirestore.relationshipSet.mockResolvedValue(undefined);
  });

  it("bloquea PARENT_OF antes de consultar o escribir en Firestore", async () => {
    const request = {
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        type: "PARENT_OF",
        fromPersonId: "parent",
        toPersonId: "child",
      },
    };

    const error = await addRelationship.run(request as never).catch((value) => value);

    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe("failed-precondition");
    expect(error.details).toEqual({
      reason: "legacy-parent-relationship-disabled",
    });
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.ownershipGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.duplicateGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it("mantiene PARTNER_OF en el flujo normal de validación y escritura", async () => {
    const result = await addRelationship.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        type: "PARTNER_OF",
        fromPersonId: "person-b",
        toPersonId: "person-a",
      },
    } as never);

    expect(result).toEqual({ relationshipId: "new-relationship" });
    expect(addRelationshipFirestore.ownershipGet).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.personGet).toHaveBeenCalledTimes(2);
    expect(addRelationshipFirestore.duplicateGet).toHaveBeenCalledTimes(2);
    expect(addRelationshipFirestore.relationshipSet).toHaveBeenCalledWith({
      type: "PARTNER_OF",
      fromPersonId: "person-a",
      toPersonId: "person-b",
      relationshipStatus: "unknown",
      createdAt: "server-timestamp",
      updatedAt: "server-timestamp",
    });
  });
});

const validateChild = ({
  parentIds = ["a"],
  parentRoles = { a: "father" },
  hasPartnerRelationship,
  sharedChildCount,
  existingSharedChildParentLinks = [],
}: {
  parentIds?: readonly string[];
  parentRoles?: Readonly<Record<string, unknown>>;
  hasPartnerRelationship?: boolean;
  sharedChildCount?: number;
  existingSharedChildParentLinks?: readonly ExistingParentLink[];
} = {}) =>
  validateNewChildForExistingUnion({
    parentIds,
    parentRoles,
    hasPartnerRelationship,
    sharedChildCount,
    existingSharedChildParentLinks,
  });

const link = (
  parentId: string,
  childId: string,
  parentRole?: "father" | "mother"
): ExistingParentLink => ({
  parentId,
  childId,
  ...(parentRole ? { parentRole } : {}),
});

const validateLink = ({
  parentId = "new-parent",
  childId = "child",
  parentRole = "father",
  existingParentLinks = [],
  allParentLinks = existingParentLinks,
}: {
  parentId?: string;
  childId?: string;
  parentRole?: unknown;
  existingParentLinks?: readonly ExistingParentLink[];
  allParentLinks?: readonly ExistingParentLink[];
} = {}) =>
  validateNewParentLink({
    parentId,
    childId,
    parentRole,
    existingParentLinks,
    allParentLinks,
  });

describe("normalizeParentRole", () => {
  it("acepta father sin normalizarlo", () => {
    expect(normalizeParentRole("father")).toBe("father");
  });

  it("acepta mother sin normalizarlo", () => {
    expect(normalizeParentRole("mother")).toBe("mother");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["cadena vacía", ""],
    ["valor distinto", "parent"],
    ["mayúsculas", "FATHER"],
  ])("rechaza %s", (_label, value) => {
    expect(normalizeParentRole(value)).toBeNull();
  });
});

describe("validateNewChildParentRoles", () => {
  it("acepta un único father", () => {
    expect(validateNewChildParentRoles(["a"], { a: "father" })).toEqual({
      ok: true,
      assignments: [{ personId: "a", parentRole: "father" }],
    });
  });

  it("acepta una única mother", () => {
    expect(validateNewChildParentRoles(["a"], { a: "mother" })).toEqual({
      ok: true,
      assignments: [{ personId: "a", parentRole: "mother" }],
    });
  });

  it("acepta father y mother y ordena el resultado por personId", () => {
    expect(
      validateNewChildParentRoles(["b", "a"], {
        b: "mother",
        a: "father",
      })
    ).toEqual({
      ok: true,
      assignments: [
        { personId: "a", parentRole: "father" },
        { personId: "b", parentRole: "mother" },
      ],
    });
  });

  it("no usa el orden de envío de roles para asignarlos", () => {
    expect(
      validateNewChildParentRoles(["a", "b"], {
        b: "father",
        a: "mother",
      })
    ).toEqual({
      ok: true,
      assignments: [
        { personId: "a", parentRole: "mother" },
        { personId: "b", parentRole: "father" },
      ],
    });
  });

  it("rechaza una clave ausente", () => {
    expect(validateNewChildParentRoles(["a", "b"], { a: "father" })).toEqual({
      ok: false,
      code: "parent-role-keys-mismatch",
    });
  });

  it("rechaza una clave adicional", () => {
    expect(
      validateNewChildParentRoles(["a"], { a: "father", b: "mother" })
    ).toEqual({ ok: false, code: "parent-role-keys-mismatch" });
  });

  it("rechaza la clave de una persona incorrecta", () => {
    expect(
      validateNewChildParentRoles(["a", "b"], {
        a: "father",
        c: "mother",
      })
    ).toEqual({ ok: false, code: "parent-role-keys-mismatch" });
  });

  it("rechaza dos father", () => {
    expect(
      validateNewChildParentRoles(["a", "b"], {
        a: "father",
        b: "father",
      })
    ).toEqual({ ok: false, code: "parent-role-occupied" });
  });

  it("rechaza dos mother", () => {
    expect(
      validateNewChildParentRoles(["a", "b"], {
        a: "mother",
        b: "mother",
      })
    ).toEqual({ ok: false, code: "parent-role-occupied" });
  });

  it("rechaza un rol inválido", () => {
    expect(validateNewChildParentRoles(["a"], { a: "Father" })).toEqual({
      ok: false,
      code: "invalid-parent-role",
    });
  });

  it("rechaza IDs de progenitores duplicados", () => {
    expect(validateNewChildParentRoles(["a", "a"], { a: "father" })).toEqual({
      ok: false,
      code: "duplicate-parent-id",
    });
  });
});

describe("resolveExistingPairKind", () => {
  it("resuelve couple para una pareja sin hijos", () => {
    expect(resolveExistingPairKind(true, 0)).toBe("couple");
  });

  it("resuelve couple para una pareja con hijos", () => {
    expect(resolveExistingPairKind(true, 3)).toBe("couple");
  });

  it("resuelve coParents sin pareja y con un hijo compartido", () => {
    expect(resolveExistingPairKind(false, 1)).toBe("coParents");
  });

  it("resuelve coParents sin pareja y con varios hijos compartidos", () => {
    expect(resolveExistingPairKind(false, 4)).toBe("coParents");
  });

  it("rechaza una unión sin pareja ni hijos compartidos", () => {
    expect(resolveExistingPairKind(false, 0)).toBeNull();
  });

  it("rechaza sharedChildCount negativo mediante RangeError", () => {
    expect(() => resolveExistingPairKind(false, -1)).toThrow(RangeError);
  });
});

describe("validateNewChildForExistingUnion", () => {
  it("rechaza una lista vacía antes de validar asignaciones", () => {
    expect(validateChild({ parentIds: [], parentRoles: {} })).toEqual({
      ok: false,
      code: "invalid-parent-count",
    });
  });

  it("rechaza más de dos progenitores antes de validar asignaciones", () => {
    expect(
      validateChild({ parentIds: ["a", "b", "c"], parentRoles: {} })
    ).toEqual({ ok: false, code: "invalid-parent-count" });
  });

  describe("singleParent", () => {
    it("acepta un father explícito", () => {
      expect(validateChild()).toEqual({
        ok: true,
        kind: "singleParent",
        assignments: [{ personId: "a", parentRole: "father" }],
      });
    });

    it("acepta una mother explícita", () => {
      expect(validateChild({ parentRoles: { a: "mother" } })).toEqual({
        ok: true,
        kind: "singleParent",
        assignments: [{ personId: "a", parentRole: "mother" }],
      });
    });

    it("rechaza un rol ausente", () => {
      expect(validateChild({ parentRoles: {} })).toEqual({
        ok: false,
        code: "invalid-parent-role-assignment",
        roleErrorCode: "parent-role-keys-mismatch",
      });
    });

    it("rechaza una clave incorrecta", () => {
      expect(validateChild({ parentRoles: { b: "father" } })).toMatchObject({
        ok: false,
        code: "invalid-parent-role-assignment",
      });
    });

    it("rechaza más de una clave", () => {
      expect(
        validateChild({ parentRoles: { a: "father", b: "mother" } })
      ).toMatchObject({
        ok: false,
        code: "invalid-parent-role-assignment",
      });
    });

    it("rechaza dos parentIds duplicados antes de validar roles", () => {
      expect(
        validateChild({ parentIds: ["a", "a"], parentRoles: {} })
      ).toEqual({ ok: false, code: "duplicate-parent-id" });
    });
  });

  describe("couple", () => {
    it("acepta una pareja existente sin hijos previos", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          hasPartnerRelationship: true,
          sharedChildCount: 0,
        })
      ).toMatchObject({ ok: true, kind: "couple" });
    });

    it("acepta una pareja existente con hijos previos", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          hasPartnerRelationship: true,
          sharedChildCount: 3,
        })
      ).toMatchObject({ ok: true, kind: "couple" });
    });

    it("devuelve asignaciones father y mother", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          hasPartnerRelationship: true,
        })
      ).toMatchObject({
        assignments: [
          { personId: "a", parentRole: "father" },
          { personId: "b", parentRole: "mother" },
        ],
      });
    });

    it("ignora el orden inverso de parentIds", () => {
      const first = validateChild({
        parentIds: ["a", "b"],
        parentRoles: { a: "father", b: "mother" },
        hasPartnerRelationship: true,
      });
      const reversed = validateChild({
        parentIds: ["b", "a"],
        parentRoles: { a: "father", b: "mother" },
        hasPartnerRelationship: true,
      });
      expect(reversed).toEqual(first);
    });

    it("ignora el orden inverso de las claves de roles", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { b: "mother", a: "father" },
          hasPartnerRelationship: true,
        })
      ).toMatchObject({
        assignments: [
          { personId: "a", parentRole: "father" },
          { personId: "b", parentRole: "mother" },
        ],
      });
    });

    it("rechaza roles duplicados", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "father" },
          hasPartnerRelationship: true,
        })
      ).toMatchObject({
        ok: false,
        code: "invalid-parent-role-assignment",
        roleErrorCode: "parent-role-occupied",
      });
    });

    it("rechaza claves faltantes o adicionales", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", c: "mother" },
          hasPartnerRelationship: true,
        })
      ).toMatchObject({
        ok: false,
        code: "invalid-parent-role-assignment",
      });
    });
  });

  describe("coParents", () => {
    it("acepta un hijo compartido sin pareja", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          sharedChildCount: 1,
        })
      ).toMatchObject({ ok: true, kind: "coParents" });
    });

    it("acepta varios hijos compartidos sin pareja", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          sharedChildCount: 4,
        })
      ).toMatchObject({ ok: true, kind: "coParents" });
    });

    it("devuelve coParents y nunca couple sin PARTNER_OF", () => {
      const result = validateChild({
        parentIds: ["a", "b"],
        parentRoles: { a: "father", b: "mother" },
        hasPartnerRelationship: false,
        sharedChildCount: 2,
      });
      expect(result).toMatchObject({ ok: true, kind: "coParents" });
      expect(result).not.toMatchObject({ kind: "couple" });
    });

    it("rechaza un par sin pareja ni hijos compartidos", () => {
      expect(
        validateChild({
          parentIds: ["a", "b"],
          parentRoles: { a: "father", b: "mother" },
          sharedChildCount: 0,
        })
      ).toEqual({ ok: false, code: "existing-pair-not-found" });
    });
  });

  describe("evidencia histórica", () => {
    const pairInput = {
      parentIds: ["a", "b"],
      parentRoles: { a: "father", b: "mother" },
      hasPartnerRelationship: true,
    } as const;

    it("ignora relaciones anteriores sin rol", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old-1"),
            link("b", "old-1"),
          ],
        })
      ).toMatchObject({ ok: true, kind: "couple" });
    });

    it("acepta evidencia consistente A father y B mother", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old", "father"),
            link("b", "old", "mother"),
          ],
        })
      ).toMatchObject({ ok: true });
    });

    it("completa coherentemente cuando solo A tiene father explícito", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [link("a", "old", "father")],
        })
      ).toMatchObject({ ok: true });
    });

    it("completa coherentemente cuando solo B tiene mother explícito", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [link("b", "old", "mother")],
        })
      ).toMatchObject({ ok: true });
    });

    it("rechaza roles contradictorios para una misma persona", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old-1", "father"),
            link("a", "old-2", "mother"),
          ],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza dos fathers históricos", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old", "father"),
            link("b", "old", "father"),
          ],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza dos mothers históricos", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old", "mother"),
            link("b", "old", "mother"),
          ],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza un vínculo histórico duplicado", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old", "father"),
            link("a", "old", "father"),
          ],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza un parentId ajeno a la unión", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [link("outsider", "old", "father")],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza evidencia con más de dos progenitores explícitos", () => {
      expect(
        validateChild({
          ...pairInput,
          existingSharedChildParentLinks: [
            link("a", "old", "father"),
            link("b", "old", "mother"),
            link("c", "old", "father"),
          ],
        })
      ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
    });

    it("rechaza una nueva asignación invertida", () => {
      expect(
        validateChild({
          ...pairInput,
          parentRoles: { a: "mother", b: "father" },
          existingSharedChildParentLinks: [
            link("a", "old", "father"),
            link("b", "old", "mother"),
          ],
        })
      ).toEqual({ ok: false, code: "parent-role-conflict" });
    });

    it("produce el mismo resultado con relaciones en otro orden", () => {
      const evidence = [
        link("a", "old-1", "father"),
        link("b", "old-1", "mother"),
        link("a", "old-2"),
        link("b", "old-2"),
      ];
      const first = validateChild({
        ...pairInput,
        existingSharedChildParentLinks: evidence,
      });
      const reversed = validateChild({
        ...pairInput,
        existingSharedChildParentLinks: [...evidence].reverse(),
      });
      expect(reversed).toEqual(first);
    });
  });

  it("no modifica IDs, roles ni evidencia histórica recibida", () => {
    const parentIds = ["b", "a"];
    const parentRoles = { b: "mother", a: "father" };
    const evidence = [
      link("b", "old", "mother"),
      link("a", "old", "father"),
    ];
    const originalParentIds = [...parentIds];
    const originalParentRoles = { ...parentRoles };
    const originalEvidence = evidence.map((item) => ({ ...item }));

    validateChild({
      parentIds,
      parentRoles,
      hasPartnerRelationship: true,
      existingSharedChildParentLinks: evidence,
    });

    expect(parentIds).toEqual(originalParentIds);
    expect(parentRoles).toEqual(originalParentRoles);
    expect(evidence).toEqual(originalEvidence);
  });
});

describe("validateNewParentLink", () => {
  it("permite father para un hijo sin progenitores", () => {
    expect(validateLink({ parentRole: "father" })).toEqual({
      ok: true,
      link: {
        parentId: "new-parent",
        childId: "child",
        parentRole: "father",
      },
    });
  });

  it("permite mother para un hijo sin progenitores", () => {
    expect(validateLink({ parentRole: "mother" })).toMatchObject({
      ok: true,
      link: { parentRole: "mother" },
    });
  });

  it("permite mother cuando ya existe father", () => {
    expect(
      validateLink({
        parentRole: "mother",
        existingParentLinks: [link("father", "child", "father")],
      })
    ).toMatchObject({ ok: true });
  });

  it("rechaza father cuando ya existe father", () => {
    expect(
      validateLink({
        parentRole: "father",
        existingParentLinks: [link("father", "child", "father")],
      })
    ).toEqual({ ok: false, code: "parent-role-occupied" });
  });

  it("permite father cuando ya existe mother", () => {
    expect(
      validateLink({
        parentRole: "father",
        existingParentLinks: [link("mother", "child", "mother")],
      })
    ).toMatchObject({ ok: true });
  });

  it("rechaza mother cuando ya existe mother", () => {
    expect(
      validateLink({
        parentRole: "mother",
        existingParentLinks: [link("mother", "child", "mother")],
      })
    ).toEqual({ ok: false, code: "parent-role-occupied" });
  });

  it("bloquea un segundo progenitor si el existente no tiene rol", () => {
    expect(
      validateLink({ existingParentLinks: [link("historical", "child")] })
    ).toEqual({ ok: false, code: "existing-parent-role-unknown" });
  });

  it("bloquea un tercero cuando ya existen father y mother", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("father", "child", "father"),
          link("mother", "child", "mother"),
        ],
      })
    ).toEqual({ ok: false, code: "maximum-parents" });
  });

  it("bloquea un tercero cuando existen father y un histórico sin rol", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("father", "child", "father"),
          link("historical", "child"),
        ],
      })
    ).toEqual({ ok: false, code: "maximum-parents" });
  });

  it("bloquea un tercero cuando existen mother y un histórico sin rol", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("mother", "child", "mother"),
          link("historical", "child"),
        ],
      })
    ).toEqual({ ok: false, code: "maximum-parents" });
  });

  it("bloquea un tercero cuando existen dos históricos sin rol", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("historical-a", "child"),
          link("historical-b", "child"),
        ],
      })
    ).toEqual({ ok: false, code: "maximum-parents" });
  });

  it("rechaza como inválido un estado con dos fathers", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("father-a", "child", "father"),
          link("father-b", "child", "father"),
        ],
      })
    ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
  });

  it("rechaza como inválido un estado con dos mothers", () => {
    expect(
      validateLink({
        existingParentLinks: [
          link("mother-a", "child", "mother"),
          link("mother-b", "child", "mother"),
        ],
      })
    ).toEqual({ ok: false, code: "invalid-existing-parent-state" });
  });

  it("rechaza un vínculo padre-hijo ya existente", () => {
    expect(
      validateLink({
        parentId: "existing",
        existingParentLinks: [link("existing", "child", "father")],
      })
    ).toEqual({ ok: false, code: "duplicate-parent-link" });
  });

  it("expone documentos existentes duplicados antes del vínculo solicitado", () => {
    expect(
      validateLink({
        parentId: "existing",
        existingParentLinks: [
          link("existing", "child", "father"),
          link("existing", "child", "father"),
        ],
      })
    ).toEqual({ ok: false, code: "duplicate-existing-parent-link" });
  });

  it("rechaza una autorrelación", () => {
    expect(validateLink({ parentId: "child" })).toEqual({
      ok: false,
      code: "self-parent",
    });
  });

  it("rechaza un rol solicitado inválido antes de otros errores", () => {
    expect(
      validateLink({ parentId: "child", parentRole: "FATHER" })
    ).toEqual({ ok: false, code: "invalid-parent-role" });
  });

  it("rechaza un vínculo que cerraría un ciclo", () => {
    expect(
      validateLink({
        parentId: "ancestor",
        childId: "descendant",
        allParentLinks: [link("descendant", "ancestor")],
      })
    ).toEqual({ ok: false, code: "cycle-detected" });
  });
});

describe("hasDirectedParentPath", () => {
  it("devuelve false cuando no existe camino", () => {
    expect(hasDirectedParentPath([link("a", "b")], "b", "a")).toBe(false);
  });

  it("detecta un camino directo", () => {
    expect(hasDirectedParentPath([link("a", "b")], "a", "b")).toBe(true);
  });

  it("detecta un camino indirecto de varias generaciones", () => {
    expect(
      hasDirectedParentPath(
        [link("a", "b"), link("b", "c"), link("c", "d")],
        "a",
        "d"
      )
    ).toBe(true);
  });

  it("termina de forma segura si el grafo existente ya contiene un ciclo", () => {
    expect(
      hasDirectedParentPath(
        [link("a", "b"), link("b", "c"), link("c", "a")],
        "a",
        "missing"
      )
    ).toBe(false);
  });

  it("ignora aristas duplicadas sin afectar el resultado", () => {
    expect(
      hasDirectedParentPath(
        [link("a", "b"), link("a", "b"), link("b", "c")],
        "a",
        "c"
      )
    ).toBe(true);
  });

  it("no depende del orden de entrada", () => {
    const relationships = [
      link("a", "b"),
      link("b", "c"),
      link("c", "d"),
    ];
    expect(hasDirectedParentPath(relationships, "a", "d")).toBe(true);
    expect(
      hasDirectedParentPath([...relationships].reverse(), "a", "d")
    ).toBe(true);
  });
});
