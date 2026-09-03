import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const addRelationshipFirestore = vi.hoisted(() => {
  const ownershipGet = vi.fn();
  const personGet = vi.fn();
  const personUpdate = vi.fn();
  const duplicateGet = vi.fn();
  const relationshipSet = vi.fn();
  const batch = vi.fn();
  const runTransaction = vi.fn();
  const transactionGet = vi.fn();
  const transactionSet = vi.fn();
  const transactionUpdate = vi.fn();
  const transactionDelete = vi.fn();
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
  const deleteFromQuery = {kind: "delete-from"};
  const deleteToQuery = {kind: "delete-to"};
  const personsLimitQuery = {kind: "persons-limit"};

  const personsCollection = {
    doc: vi.fn((id?: string) => ({
      id: id ?? "new-partner",
      kind: "person",
      get: personGet,
      update: personUpdate,
    })),
    limit: vi.fn(() => personsLimitQuery),
  };
  const relationshipsCollection = {
    doc: vi.fn((id?: string) => id ? ({
      id,
      kind: "relationship",
      path: `trees/tree/relationships/${id}`,
    }) : relationshipDoc),
    where: vi.fn((field: string) => {
      if (field === "fromPersonId") return deleteFromQuery;
      if (field === "toPersonId") return deleteToQuery;
      return duplicateQuery;
    }),
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
    personUpdate,
    duplicateGet,
    relationshipSet,
    batch,
    runTransaction,
    transactionGet,
    transactionSet,
    transactionUpdate,
    transactionDelete,
    serverTimestamp,
    duplicateQuery,
    deleteFromQuery,
    deleteToQuery,
    personsLimitQuery,
    treeRef,
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

import {
  addPartnerToPerson,
  addRelationship,
  createUnion,
  deletePerson,
  deleteRelationship,
  reassignParentRelationship,
  updatePerson,
} from "./index.js";
import {
  hasDirectedParentPath,
  normalizeParentRole,
  resolveExistingPairKind,
  validateNewChildForExistingUnion,
  validateNewChildParentRoles,
  validateNewParentLink,
  type ExistingParentLink,
} from "./parentRelationshipPolicy.js";

const validUpdatePersonRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {uid: "owner"},
  data: {
    treeId: "tree",
    personId: "person",
    personData: {
      firstName: "Ana",
      lastName: "Pérez",
    },
    ...overrides,
  },
});

type DeleteRelationshipData = {
  type?: unknown;
  fromPersonId?: unknown;
  toPersonId?: unknown;
  parentRole?: unknown;
  relationshipStatus?: unknown;
};

const deleteRelationshipDoc = (
  id: string,
  data: DeleteRelationshipData
) => ({
  id,
  ref: {path: `trees/tree/relationships/${id}`},
  data: () => data,
});

const validDeletePersonRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {uid: "owner"},
  data: {
    treeId: "tree",
    personId: "person",
    ...overrides,
  },
});

describe("deletePerson", () => {
  let treeData: Record<string, unknown>;
  let personExists: boolean;
  let personData: Record<string, unknown>;
  let rootExists: boolean;
  let personDocs: Array<{id: string}>;
  let fromDocs: ReturnType<typeof deleteRelationshipDoc>[];
  let toDocs: ReturnType<typeof deleteRelationshipDoc>[];

  beforeEach(() => {
    vi.clearAllMocks();
    treeData = {ownerId: "owner", rootPersonId: "root"};
    personExists = true;
    personData = {isRoot: false, ownerId: "ignored-person-owner"};
    rootExists = true;
    personDocs = [{id: "person"}, {id: "root"}];
    fromDocs = [];
    toDocs = [];

    addRelationshipFirestore.transactionGet.mockImplementation(
      async (reference) => {
        if (reference === addRelationshipFirestore.treeRef) {
          return {exists: true, data: () => treeData};
        }
        if (reference === addRelationshipFirestore.personsLimitQuery) {
          return {docs: personDocs, size: personDocs.length};
        }
        if (reference === addRelationshipFirestore.deleteFromQuery) {
          return {docs: fromDocs, size: fromDocs.length};
        }
        if (reference === addRelationshipFirestore.deleteToQuery) {
          return {docs: toDocs, size: toDocs.length};
        }
        if (reference?.id === "person") {
          return {exists: personExists, data: () => personData};
        }
        if (reference?.id === "root") {
          return {exists: rootExists, data: () => ({isRoot: true})};
        }
        throw new Error("Referencia de lectura inesperada");
      }
    );
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
        set: addRelationshipFirestore.transactionSet,
        update: addRelationshipFirestore.transactionUpdate,
      })
    );
  });

  const expectDeleteError = async (
    request: ReturnType<typeof validDeletePersonRequest>,
    code: string,
    reason?: string
  ) => {
    const error = await deletePerson.run(request as never).catch(
      (value) => value
    );
    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe(code);
    if (reason) expect(error.details).toEqual({reason});
    return error;
  };

  it("rechaza usuarios no autenticados antes de Firestore", async () => {
    await expectDeleteError(
      {...validDeletePersonRequest(), auth: undefined} as never,
      "unauthenticated"
    );
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["treeId", undefined],
    ["treeId", ""],
    ["treeId", "   "],
    ["treeId", "tree/other"],
    ["treeId", 42],
    ["personId", undefined],
    ["personId", ""],
    ["personId", "   "],
    ["personId", "person/other"],
    ["personId", 42],
  ])("rechaza payload inválido %s=%s antes de Firestore", async (field, value) => {
    await expectDeleteError(
      validDeletePersonRequest({[field]: value}),
      "invalid-argument",
      field === "treeId" ? "invalid-tree-id" : "invalid-person-id"
    );
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
  });

  it("aplica trim a ambos IDs e ignora campos adicionales", async () => {
    const result = await deletePerson.run(validDeletePersonRequest({
      treeId: "  tree  ",
      personId: "  person  ",
      ownerId: "attacker",
      isRoot: true,
      relationshipIds: ["unrelated"],
      expectedRelationshipCount: 999,
    }) as never);
    expect(result).toEqual({
      ok: true,
      personId: "person",
      deletedRelationshipCount: 0,
    });
  });

  it("rechaza un árbol inexistente", async () => {
    addRelationshipFirestore.transactionGet.mockResolvedValueOnce({
      exists: false,
    });
    await expectDeleteError(
      validDeletePersonRequest(),
      "not-found",
      "tree-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("rechaza a un usuario que no es propietario y no confía en person.ownerId", async () => {
    treeData.ownerId = "another-owner";
    personData.ownerId = "owner";
    await expectDeleteError(
      validDeletePersonRequest(),
      "permission-denied",
      "not-tree-owner"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("rechaza una persona inexistente", async () => {
    personExists = false;
    await expectDeleteError(
      validDeletePersonRequest(),
      "not-found",
      "person-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("protege la persona indicada por rootPersonId", async () => {
    treeData.rootPersonId = "person";
    await expectDeleteError(
      validDeletePersonRequest(),
      "failed-precondition",
      "root-person-protected"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("bloquea indicadores de raíz contradictorios", async () => {
    personData.isRoot = true;
    await expectDeleteError(
      validDeletePersonRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])(
    "bloquea rootPersonId inválido: %s",
    async (rootPersonId) => {
      treeData.rootPersonId = rootPersonId;
      await expectDeleteError(
        validDeletePersonRequest(),
        "failed-precondition",
        "inconsistent-tree-data"
      );
      expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
    }
  );

  it("bloquea cuando la raíz contractual no existe", async () => {
    rootExists = false;
    await expectDeleteError(
      validDeletePersonRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("protege la última persona defensivamente", async () => {
    personDocs = [{id: "person"}];
    await expectDeleteError(
      validDeletePersonRequest(),
      "failed-precondition",
      "last-person-protected"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("elimina una persona aislada no raíz", async () => {
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result).toEqual({
      ok: true,
      personId: "person",
      deletedRelationshipCount: 0,
    });
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionDelete.mock.calls[0][0].id)
      .toBe("person");
  });

  it.each([
    ["PARTNER_OF saliente", {type: "PARTNER_OF", fromPersonId: "person", toPersonId: "partner"}, "from"],
    ["PARENT_OF entrante", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "person"}, "to"],
    ["PARENT_OF saliente", {type: "PARENT_OF", fromPersonId: "person", toPersonId: "child"}, "from"],
  ])("elimina una relación incidente %s", async (_name, data, direction) => {
    const doc = deleteRelationshipDoc("incident", data);
    if (direction === "from") fromDocs = [doc];
    else toDocs = [doc];
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(1);
    expect(addRelationshipFirestore.transactionDelete)
      .toHaveBeenCalledWith(doc.ref);
  });

  it("elimina pareja e hijos incidentes pero preserva familiares y relación ajena", async () => {
    const partner = deleteRelationshipDoc("partner", {
      type: "PARTNER_OF", fromPersonId: "person", toPersonId: "partner",
    });
    const child = deleteRelationshipDoc("child", {
      type: "PARENT_OF", fromPersonId: "person", toPersonId: "child",
    });
    const parent = deleteRelationshipDoc("parent", {
      type: "PARENT_OF", fromPersonId: "parent", toPersonId: "person",
    });
    const nonIncident = deleteRelationshipDoc("sibling-link", {
      type: "PARENT_OF", fromPersonId: "parent", toPersonId: "sibling",
    });
    fromDocs = [partner, child];
    toDocs = [parent];

    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(3);
    expect(addRelationshipFirestore.transactionDelete.mock.calls.map(
      ([reference]) => reference.path ?? reference.id
    )).toEqual([
      partner.ref.path,
      child.ref.path,
      parent.ref.path,
      "person",
    ]);
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith(nonIncident.ref);
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it("preserva coprogenitor e hijos al eliminar solo vínculos incidentes", async () => {
    const targetChild = deleteRelationshipDoc("target-child", {
      type: "PARENT_OF", fromPersonId: "person", toPersonId: "child",
    });
    const coparentChild = deleteRelationshipDoc("coparent-child", {
      type: "PARENT_OF", fromPersonId: "coparent", toPersonId: "child",
    });
    fromDocs = [targetChild];

    await deletePerson.run(validDeletePersonRequest() as never);
    expect(addRelationshipFirestore.transactionDelete)
      .toHaveBeenCalledWith(targetChild.ref);
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith(coparentChild.ref);
  });

  it("limita todas las lecturas y escrituras al árbol solicitado", async () => {
    const otherTreeRelationship = {
      path: "trees/other-tree/relationships/same-person-id",
    };

    await deletePerson.run(validDeletePersonRequest() as never);

    expect(addRelationshipFirestore.db.collection)
      .toHaveBeenCalledWith("trees");
    expect(addRelationshipFirestore.treeRef.collection)
      .toHaveBeenCalledWith("persons");
    expect(addRelationshipFirestore.treeRef.collection)
      .toHaveBeenCalledWith("relationships");
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith(otherTreeRelationship);
  });

  it("deduplica por path y elimina todos los documentos duplicados incidentes", async () => {
    const first = deleteRelationshipDoc("duplicate-1", {
      type: "PARTNER_OF", fromPersonId: "person", toPersonId: "partner",
    });
    const second = deleteRelationshipDoc("duplicate-2", {
      type: "PARTNER_OF", fromPersonId: "person", toPersonId: "partner",
    });
    fromDocs = [first, second];
    toDocs = [first];

    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(2);
    expect(addRelationshipFirestore.transactionDelete)
      .toHaveBeenCalledTimes(3);
  });

  it.each([
    ["autorrelación", {type: "PARENT_OF", fromPersonId: "person", toPersonId: "person"}],
    ["tipo desconocido", {type: "RELATED_TO", fromPersonId: "person", toPersonId: "other"}],
    ["from ausente", {type: "PARENT_OF", toPersonId: "person"}],
    ["to ausente", {type: "PARENT_OF", fromPersonId: "person"}],
    ["extremo vacío", {type: "PARENT_OF", fromPersonId: "person", toPersonId: "   "}],
    ["sin referencia real", {type: "PARENT_OF", fromPersonId: "other", toPersonId: "child"}],
  ])("bloquea relación incidente corrupta: %s", async (_name, data) => {
    fromDocs = [deleteRelationshipDoc("corrupt", data)];
    await expectDeleteError(
      validDeletePersonRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("permite PARENT_OF histórico sin parentRole", async () => {
    fromDocs = [deleteRelationshipDoc("historical-parent", {
      type: "PARENT_OF", fromPersonId: "person", toPersonId: "child",
    })];
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(1);
  });

  it("permite PARTNER_OF histórico sin relationshipStatus", async () => {
    fromDocs = [deleteRelationshipDoc("historical-partner", {
      type: "PARTNER_OF", fromPersonId: "person", toPersonId: "partner",
    })];
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(1);
  });

  it("permite exactamente 400 relaciones incidentes", async () => {
    fromDocs = Array.from({length: 400}, (_, index) =>
      deleteRelationshipDoc(`incident-${index}`, {
        type: "PARENT_OF",
        fromPersonId: "person",
        toPersonId: `child-${index}`,
      })
    );
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(result.deletedRelationshipCount).toBe(400);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledTimes(401);
  });

  it("bloquea 401 relaciones antes de programar escrituras", async () => {
    fromDocs = Array.from({length: 401}, (_, index) =>
      deleteRelationshipDoc(`incident-${index}`, {
        type: "PARENT_OF",
        fromPersonId: "person",
        toPersonId: `child-${index}`,
      })
    );
    await expectDeleteError(
      validDeletePersonRequest(),
      "resource-exhausted",
      "too-many-incident-relationships"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("devuelve únicamente la respuesta contractual mínima", async () => {
    const result = await deletePerson.run(validDeletePersonRequest() as never);
    expect(Object.keys(result).sort()).toEqual([
      "deletedRelationshipCount", "ok", "personId",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/owner|name|auth|relationshipIds/);
  });

  it("una segunda eliminación devuelve person-not-found sin escrituras", async () => {
    await deletePerson.run(validDeletePersonRequest() as never);
    vi.clearAllMocks();
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
      })
    );
    personExists = false;
    await expectDeleteError(
      validDeletePersonRequest(),
      "not-found",
      "person-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("convierte fallos inesperados en internal sin exponer el error crudo", async () => {
    addRelationshipFirestore.transactionGet.mockRejectedValueOnce(
      new Error("sensitive-admin-sdk-error")
    );
    const error = await expectDeleteError(
      validDeletePersonRequest(),
      "internal"
    );
    expect(error.message).not.toContain("sensitive-admin-sdk-error");
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("mantiene todas las escrituras dentro de la transacción ante un fallo", async () => {
    const incident = deleteRelationshipDoc("incident", {
      type: "PARENT_OF", fromPersonId: "person", toPersonId: "child",
    });
    fromDocs = [incident];
    addRelationshipFirestore.transactionDelete.mockImplementationOnce(() => {
      throw new Error("induced-transaction-failure");
    });
    await expectDeleteError(validDeletePersonRequest(), "internal");
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it("realiza todos los reads antes del primer delete", async () => {
    fromDocs = [deleteRelationshipDoc("incident", {
      type: "PARENT_OF", fromPersonId: "person", toPersonId: "child",
    })];
    await deletePerson.run(validDeletePersonRequest() as never);
    const lastReadOrder = Math.max(
      ...addRelationshipFirestore.transactionGet.mock.invocationCallOrder
    );
    const firstDeleteOrder = Math.min(
      ...addRelationshipFirestore.transactionDelete.mock.invocationCallOrder
    );
    expect(lastReadOrder).toBeLessThan(firstDeleteOrder);
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
  });

  it("no contiene dependencias de Firebase Auth en la implementación", async () => {
    const source = await import("node:fs/promises").then(({readFile}) =>
      readFile(`${process.cwd()}/src/index.ts`, "utf8")
    );
    expect(source).not.toMatch(/firebase-admin\/auth|getAuth|deleteUser|auth\(\)/);
  });
});

const validDeleteRelationshipRequest = (
  overrides: Record<string, unknown> = {}
) => ({
  auth: {uid: "owner"},
  data: {
    treeId: "tree",
    relationshipId: "target-relationship",
    ...overrides,
  },
});

describe("deleteRelationship", () => {
  let treeExists: boolean;
  let treeData: Record<string, unknown>;
  let relationshipExists: boolean;
  let relationshipData: DeleteRelationshipData;
  let existingPersonIds: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    treeExists = true;
    treeData = {
      ownerId: "owner",
      rootPersonId: "root",
      updatedAt: "unchanged-tree-timestamp",
    };
    relationshipExists = true;
    relationshipData = {
      type: "PARENT_OF",
      fromPersonId: "parent",
      toPersonId: "child",
      parentRole: "father",
    };
    existingPersonIds = new Set(["root", "parent", "child", "partner"]);

    addRelationshipFirestore.transactionGet.mockImplementation(
      async (reference) => {
        if (reference === addRelationshipFirestore.treeRef) {
          return {exists: treeExists, data: () => treeData};
        }
        if (reference?.kind === "relationship") {
          return {
            exists: relationshipExists,
            data: () => relationshipData,
          };
        }
        if (reference?.kind === "person") {
          return {
            exists: existingPersonIds.has(reference.id),
            data: () => ({ownerId: "ignored-person-owner"}),
          };
        }
        throw new Error("Referencia de lectura inesperada");
      }
    );
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
        set: addRelationshipFirestore.transactionSet,
        update: addRelationshipFirestore.transactionUpdate,
      })
    );
  });

  const expectDeleteRelationshipError = async (
    request: ReturnType<typeof validDeleteRelationshipRequest>,
    code: string,
    reason?: string
  ) => {
    const error = await deleteRelationship.run(request as never).catch(
      (value) => value
    );
    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe(code);
    if (reason) expect(error.details).toEqual({reason});
    return error;
  };

  it("exige Auth antes de acceder a Firestore", async () => {
    await expectDeleteRelationshipError(
      {...validDeleteRelationshipRequest(), auth: undefined} as never,
      "unauthenticated"
    );
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["treeId", undefined, "invalid-tree-id"],
    ["treeId", 42, "invalid-tree-id"],
    ["treeId", "", "invalid-tree-id"],
    ["treeId", "   ", "invalid-tree-id"],
    ["treeId", "tree/other", "invalid-tree-id"],
    ["relationshipId", undefined, "invalid-relationship-id"],
    ["relationshipId", 42, "invalid-relationship-id"],
    ["relationshipId", "", "invalid-relationship-id"],
    ["relationshipId", "   ", "invalid-relationship-id"],
    ["relationshipId", "rel/other", "invalid-relationship-id"],
  ])("rechaza payload inválido %s=%s", async (field, value, reason) => {
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest({[field]: value}),
      "invalid-argument",
      reason
    );
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
  });

  it("normaliza IDs e ignora campos adicionales no autoritativos", async () => {
    const result = await deleteRelationship.run(validDeleteRelationshipRequest({
      treeId: "  tree  ",
      relationshipId: "  target-relationship  ",
      type: "PARTNER_OF",
      fromPersonId: "attacker",
      toPersonId: "victim",
      parentRole: "mother",
      relationshipStatus: "former",
      ownerId: "attacker",
    }) as never);
    expect(result).toEqual({ok: true, relationshipId: "target-relationship"});
    expect(addRelationshipFirestore.transactionDelete.mock.calls[0][0])
      .toMatchObject({id: "target-relationship", kind: "relationship"});
  });

  it("rechaza un árbol inexistente", async () => {
    treeExists = false;
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(), "not-found", "tree-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("autoriza exclusivamente mediante tree.ownerId", async () => {
    treeData.ownerId = "another-owner";
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "permission-denied",
      "not-tree-owner"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("no toca el mismo relationshipId textual de otro árbol", async () => {
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith({
        id: "target-relationship",
        path: "trees/other/relationships/target-relationship",
      });
    expect(addRelationshipFirestore.db.collection).toHaveBeenCalledWith("trees");
  });

  it("rechaza una relación inexistente", async () => {
    relationshipExists = false;
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "not-found",
      "relationship-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it.each([
    ["PARENT_OF father", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "child", parentRole: "father"}],
    ["PARENT_OF mother", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "child", parentRole: "mother"}],
    ["PARENT_OF histórico", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "child"}],
    ["PARTNER_OF current", {type: "PARTNER_OF", fromPersonId: "parent", toPersonId: "partner", relationshipStatus: "current"}],
    ["PARTNER_OF former", {type: "PARTNER_OF", fromPersonId: "parent", toPersonId: "partner", relationshipStatus: "former"}],
    ["PARTNER_OF unknown", {type: "PARTNER_OF", fromPersonId: "parent", toPersonId: "partner", relationshipStatus: "unknown"}],
    ["PARTNER_OF histórico", {type: "PARTNER_OF", fromPersonId: "parent", toPersonId: "partner"}],
    ["root como progenitor", {type: "PARENT_OF", fromPersonId: "root", toPersonId: "child", parentRole: "father"}],
    ["root como hijo", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "root", parentRole: "father"}],
    ["root en pareja", {type: "PARTNER_OF", fromPersonId: "root", toPersonId: "partner", relationshipStatus: "current"}],
  ])("elimina una relación válida: %s", async (_name, data) => {
    relationshipData = data;
    const result = await deleteRelationship.run(
      validDeleteRelationshipRequest() as never
    );
    expect(result).toEqual({ok: true, relationshipId: "target-relationship"});
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
  });

  it.each([
    ["última relación", []],
    ["PARENT_OF único", []],
    ["dos progenitores", ["other-parent-link"]],
    ["progenitor con varios hijos", ["other-child-1", "other-child-2"]],
    ["pareja con hijos compartidos", ["parent-a-child", "parent-b-child"]],
    ["pareja con hijo de un miembro", ["parent-a-child"]],
  ])("elimina solo el objetivo en escenario %s", async (_name, preservedIds) => {
    const preservedRefs = preservedIds.map((id) => ({id, kind: "relationship"}));
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    preservedRefs.forEach((reference) => {
      expect(addRelationshipFirestore.transactionDelete)
        .not.toHaveBeenCalledWith(reference);
    });
  });

  it.each([
    ["PARENT_OF duplicado", "duplicate-parent"],
    ["PARTNER_OF duplicado directo", "duplicate-partner"],
    ["PARTNER_OF inverso histórico", "reverse-partner"],
  ])("preserva equivalentes: %s", async (_name, duplicateId) => {
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith({id: duplicateId, kind: "relationship"});
  });

  it.each([
    ["from ausente", {type: "PARENT_OF", toPersonId: "child"}],
    ["from vacío", {type: "PARENT_OF", fromPersonId: "   ", toPersonId: "child"}],
    ["to ausente", {type: "PARENT_OF", fromPersonId: "parent"}],
    ["to vacío", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "   "}],
    ["autorrelación", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "parent"}],
    ["tipo desconocido", {type: "RELATED_TO", fromPersonId: "parent", toPersonId: "child"}],
    ["parentRole inválido", {type: "PARENT_OF", fromPersonId: "parent", toPersonId: "child", parentRole: "guardian"}],
    ["relationshipStatus inválido", {type: "PARTNER_OF", fromPersonId: "parent", toPersonId: "partner", relationshipStatus: "married"}],
  ])("bloquea relación corrupta: %s", async (_name, data) => {
    relationshipData = data;
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it.each([
    ["from inexistente", ["root", "child", "partner"]],
    ["to inexistente", ["root", "parent", "partner"]],
    ["ambos inexistentes", ["root", "partner"]],
  ])("bloquea endpoints huérfanos: %s", async (_name, ids) => {
    existingPersonIds = new Set(ids);
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("preserva personas, árbol, timestamps y toda relación no objetivo", async () => {
    const originalTreeData = {...treeData};
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    expect(treeData).toEqual(originalTreeData);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it("devuelve únicamente la respuesta contractual mínima", async () => {
    const result = await deleteRelationship.run(
      validDeleteRelationshipRequest() as never
    );
    expect(Object.keys(result).sort()).toEqual(["ok", "relationshipId"]);
    expect(JSON.stringify(result)).not.toMatch(
      /type|fromPersonId|toPersonId|owner|parentRole|relationshipStatus|auth/
    );
  });

  it("una segunda eliminación devuelve relationship-not-found", async () => {
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    vi.clearAllMocks();
    relationshipExists = false;
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
      })
    );
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "not-found",
      "relationship-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("convierte errores inesperados a internal sin filtrar detalles", async () => {
    addRelationshipFirestore.transactionGet.mockRejectedValueOnce(
      new Error("sensitive-admin-sdk-error")
    );
    const error = await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(), "internal"
    );
    expect(error.message).not.toContain("sensitive-admin-sdk-error");
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("completa todas las lecturas antes del único delete exacto", async () => {
    await deleteRelationship.run(validDeleteRelationshipRequest() as never);
    const lastReadOrder = Math.max(
      ...addRelationshipFirestore.transactionGet.mock.invocationCallOrder
    );
    const deleteOrder = addRelationshipFirestore.transactionDelete
      .mock.invocationCallOrder[0];
    expect(lastReadOrder).toBeLessThan(deleteOrder);
    expect(addRelationshipFirestore.transactionGet).toHaveBeenCalledTimes(4);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionDelete.mock.calls[0][0])
      .toMatchObject({id: "target-relationship", kind: "relationship"});
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
  });

  it("un fallo previo al delete produce cero escrituras", async () => {
    existingPersonIds.delete("child");
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it("mantiene la operación dentro de una única transacción", async () => {
    addRelationshipFirestore.transactionDelete.mockImplementationOnce(() => {
      throw new Error("induced-transaction-failure");
    });
    await expectDeleteRelationshipError(
      validDeleteRelationshipRequest(), "internal"
    );
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it("no usa APIs prohibidas ni escrituras adicionales", async () => {
    const source = await import("node:fs/promises").then(({readFile}) =>
      readFile(`${process.cwd()}/src/index.ts`, "utf8")
    );
    const implementation = source.slice(
      source.indexOf("export const deleteRelationship"),
      source.indexOf(
        "/**\n * Sustituye atómicamente una filiación",
        source.indexOf("export const deleteRelationship")
      )
    );
    expect(implementation).not.toMatch(
      /firebase-admin\/auth|getAuth|deleteUser|auth\(\)|WriteBatch|BulkWriter|collectionGroup|tx\.set|tx\.update/
    );
    expect(implementation).not.toMatch(
      /personsRef\.doc\([^)]*\)\.delete|treeRef\.update/
    );
  });
});

type ReassignRelationshipData = {
  type?: unknown;
  fromPersonId?: unknown;
  toPersonId?: unknown;
  parentRole?: unknown;
};

const parentDocument = (
  id: string,
  fromPersonId: unknown,
  toPersonId: unknown,
  parentRole?: unknown
) => ({
  id,
  ref: {id, path: `trees/tree/relationships/${id}`},
  data: () => ({
    type: "PARENT_OF",
    fromPersonId,
    toPersonId,
    ...(parentRole === undefined ? {} : {parentRole}),
  }),
});

const validReassignRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {uid: "owner"},
  data: {
    treeId: "tree",
    relationshipId: "old-link",
    newParentPersonId: "new-parent",
    ...overrides,
  },
});

describe("reassignParentRelationship", () => {
  let treeExists: boolean;
  let treeData: Record<string, unknown>;
  let targetExists: boolean;
  let targetData: ReassignRelationshipData;
  let existingPersonIds: Set<string>;
  let parentDocuments: ReturnType<typeof parentDocument>[];

  beforeEach(() => {
    vi.clearAllMocks();
    treeExists = true;
    treeData = {
      ownerId: "owner",
      rootPersonId: "root",
      updatedAt: "unchanged",
    };
    targetExists = true;
    targetData = {
      type: "PARENT_OF",
      fromPersonId: "old-parent",
      toPersonId: "child",
      parentRole: "father",
    };
    existingPersonIds = new Set([
      "root", "old-parent", "new-parent", "child", "other-parent",
      "ancestor", "descendant",
    ]);
    parentDocuments = [
      parentDocument("old-link", "old-parent", "child", "father"),
    ];

    addRelationshipFirestore.transactionGet.mockImplementation(
      async (reference) => {
        if (reference === addRelationshipFirestore.treeRef) {
          return {exists: treeExists, data: () => treeData};
        }
        if (reference?.kind === "relationship") {
          return {exists: targetExists, data: () => targetData};
        }
        if (reference?.kind === "person") {
          return {
            exists: existingPersonIds.has(reference.id),
            data: () => ({ownerId: "ignored-person-owner"}),
          };
        }
        if (reference === addRelationshipFirestore.duplicateQuery) {
          return {docs: parentDocuments, size: parentDocuments.length};
        }
        throw new Error("Referencia de lectura inesperada");
      }
    );
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
        set: addRelationshipFirestore.transactionSet,
        update: addRelationshipFirestore.transactionUpdate,
      })
    );
  });

  const expectReassignError = async (
    request: ReturnType<typeof validReassignRequest>,
    code: string,
    reason?: string
  ) => {
    const error = await reassignParentRelationship.run(request as never)
      .catch((value) => value);
    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe(code);
    if (reason) expect(error.details).toEqual({reason});
    return error;
  };

  it("exige Auth antes de Firestore", async () => {
    await expectReassignError(
      {...validReassignRequest(), auth: undefined} as never,
      "unauthenticated"
    );
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["treeId", undefined, "invalid-tree-id"],
    ["treeId", 42, "invalid-tree-id"],
    ["treeId", "", "invalid-tree-id"],
    ["treeId", "   ", "invalid-tree-id"],
    ["treeId", "tree/other", "invalid-tree-id"],
    ["relationshipId", undefined, "invalid-relationship-id"],
    ["relationshipId", 42, "invalid-relationship-id"],
    ["relationshipId", "", "invalid-relationship-id"],
    ["relationshipId", "   ", "invalid-relationship-id"],
    ["relationshipId", "rel/other", "invalid-relationship-id"],
    ["newParentPersonId", undefined, "invalid-new-parent-id"],
    ["newParentPersonId", 42, "invalid-new-parent-id"],
    ["newParentPersonId", "", "invalid-new-parent-id"],
    ["newParentPersonId", "   ", "invalid-new-parent-id"],
    ["newParentPersonId", "person/other", "invalid-new-parent-id"],
  ])("rechaza payload %s=%s", async (field, value, reason) => {
    await expectReassignError(
      validReassignRequest({[field]: value}), "invalid-argument", reason
    );
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
  });

  it("normaliza los tres IDs e ignora campos adicionales", async () => {
    const result = await reassignParentRelationship.run(validReassignRequest({
      treeId: " tree ",
      relationshipId: " old-link ",
      newParentPersonId: " new-parent ",
      ownerId: "attacker",
      childPersonId: "attacker-child",
      oldParentPersonId: "attacker-parent",
    }) as never);
    expect(result).toEqual({ok: true, relationshipId: "new-relationship"});
  });

  it("rechaza árbol inexistente", async () => {
    treeExists = false;
    await expectReassignError(
      validReassignRequest(), "not-found", "tree-not-found"
    );
  });

  it("autoriza solo mediante tree.ownerId", async () => {
    treeData.ownerId = "another-owner";
    await expectReassignError(
      validReassignRequest(), "permission-denied", "not-tree-owner"
    );
  });

  it("aísla relación y personas al árbol solicitado", async () => {
    await reassignParentRelationship.run(validReassignRequest() as never);
    expect(addRelationshipFirestore.db.collection).toHaveBeenCalledWith("trees");
    expect(addRelationshipFirestore.transactionDelete.mock.calls[0][0])
      .toMatchObject({id: "old-link", kind: "relationship"});
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith({path: "trees/other/relationships/old-link"});
  });

  it("rechaza relación inexistente", async () => {
    targetExists = false;
    await expectReassignError(
      validReassignRequest(), "not-found", "relationship-not-found"
    );
  });

  it.each([
    ["PARTNER_OF", {type: "PARTNER_OF", fromPersonId: "old-parent", toPersonId: "child"}, "relationship-not-parent"],
    ["tipo desconocido", {type: "RELATED_TO", fromPersonId: "old-parent", toPersonId: "child"}, "relationship-not-parent"],
  ])("rechaza target %s", async (_name, data, reason) => {
    targetData = data;
    await expectReassignError(
      validReassignRequest(), "failed-precondition", reason
    );
  });

  it.each([
    ["from ausente", {type: "PARENT_OF", toPersonId: "child"}],
    ["from no string", {type: "PARENT_OF", fromPersonId: 42, toPersonId: "child"}],
    ["from vacío", {type: "PARENT_OF", fromPersonId: "   ", toPersonId: "child"}],
    ["to ausente", {type: "PARENT_OF", fromPersonId: "old-parent"}],
    ["to no string", {type: "PARENT_OF", fromPersonId: "old-parent", toPersonId: 42}],
    ["to vacío", {type: "PARENT_OF", fromPersonId: "old-parent", toPersonId: "   "}],
    ["self target", {type: "PARENT_OF", fromPersonId: "child", toPersonId: "child"}],
    ["role inválido", {type: "PARENT_OF", fromPersonId: "old-parent", toPersonId: "child", parentRole: "guardian"}],
  ])("bloquea target corrupto: %s", async (_name, data) => {
    targetData = data;
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "inconsistent-tree-data"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it.each([
    ["father", "father"],
    ["mother", "mother"],
  ])("conserva stored role %s", async (storedRole, expectedRole) => {
    targetData.parentRole = storedRole;
    parentDocuments = [
      parentDocument("old-link", "old-parent", "child", storedRole),
    ];
    await reassignParentRelationship.run(validReassignRequest() as never);
    expect(addRelationshipFirestore.transactionSet.mock.calls[0][1])
      .toMatchObject({parentRole: expectedRole});
  });

  it.each(["father", "mother"])(
    "rechaza request role cuando stored role es %s",
    async (storedRole) => {
      targetData.parentRole = storedRole;
      await expectReassignError(
        validReassignRequest({parentRole: storedRole}),
        "invalid-argument",
        "unexpected-parent-role"
      );
    }
  );

  it("exige role para target histórico", async () => {
    delete targetData.parentRole;
    parentDocuments = [
      parentDocument("old-link", "old-parent", "child"),
    ];
    await expectReassignError(
      validReassignRequest(), "invalid-argument", "invalid-parent-role"
    );
  });

  it.each(["father", "mother"] as const)(
    "normaliza target histórico como %s",
    async (parentRole) => {
      delete targetData.parentRole;
      parentDocuments = [
        parentDocument("old-link", "old-parent", "child"),
      ];
      await reassignParentRelationship.run(
        validReassignRequest({parentRole}) as never
      );
      expect(addRelationshipFirestore.transactionSet.mock.calls[0][1])
        .toMatchObject({parentRole});
    }
  );

  it("rechaza role inválido para target histórico", async () => {
    delete targetData.parentRole;
    await expectReassignError(
      validReassignRequest({parentRole: "guardian"}),
      "invalid-argument",
      "invalid-parent-role"
    );
  });

  it.each([
    ["old parent", "old-parent", "failed-precondition", "inconsistent-tree-data"],
    ["child", "child", "failed-precondition", "inconsistent-tree-data"],
    ["new parent", "new-parent", "not-found", "new-parent-not-found"],
  ])("rechaza persona inexistente: %s", async (_name, id, code, reason) => {
    existingPersonIds.delete(id);
    await expectReassignError(validReassignRequest(), code, reason);
  });

  it("rechaza mismo progenitor", async () => {
    await expectReassignError(
      validReassignRequest({newParentPersonId: "old-parent"}),
      "failed-precondition",
      "same-parent"
    );
  });

  it("rechaza new parent igual al child", async () => {
    await expectReassignError(
      validReassignRequest({newParentPersonId: "child"}),
      "failed-precondition",
      "self-parent"
    );
  });

  it.each([
    ["persona desconectada", "new-parent", "old-parent", "child"],
    ["root nuevo", "root", "old-parent", "child"],
    ["root antiguo", "new-parent", "root", "child"],
    ["root hijo", "new-parent", "old-parent", "root"],
  ])("permite %s", async (_name, newId, oldId, childId) => {
    targetData.fromPersonId = oldId;
    targetData.toPersonId = childId;
    parentDocuments = [parentDocument("old-link", oldId, childId, "father")];
    const result = await reassignParentRelationship.run(
      validReassignRequest({newParentPersonId: newId}) as never
    );
    expect(result.ok).toBe(true);
  });

  it("bloquea duplicado del vínculo antiguo", async () => {
    parentDocuments.push(
      parentDocument("old-duplicate", "old-parent", "child", "father")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "duplicate-existing-parent-link"
    );
  });

  it("bloquea new parent ya conectado", async () => {
    parentDocuments.push(
      parentDocument("new-link", "new-parent", "child", "mother")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "duplicate-parent-link"
    );
  });

  it("bloquea duplicado del segundo parent", async () => {
    parentDocuments.push(
      parentDocument("other-1", "other-parent", "child", "mother"),
      parentDocument("other-2", "other-parent", "child", "mother")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "invalid-existing-parent-state"
    );
  });

  it("permite uno o dos padres válidos y conserva el segundo vínculo", async () => {
    const second = parentDocument(
      "other-link", "other-parent", "child", "mother"
    );
    parentDocuments.push(second);
    await reassignParentRelationship.run(validReassignRequest() as never);
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith(second.ref);
  });

  it("bloquea más de dos documentos parentales", async () => {
    parentDocuments.push(
      parentDocument("other-1", "other-parent", "child", "mother"),
      parentDocument("other-2", "ancestor", "child", "mother")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "invalid-existing-parent-state"
    );
  });

  it.each(["father", "mother"])(
    "bloquea otro parent con role ocupado %s",
    async (parentRole) => {
      targetData.parentRole = parentRole;
      parentDocuments = [
        parentDocument("old-link", "old-parent", "child", parentRole),
        parentDocument("other", "other-parent", "child", parentRole),
      ];
      await expectReassignError(
        validReassignRequest(),
        "failed-precondition",
        "parent-role-occupied"
      );
    }
  );

  it("bloquea otro parent histórico sin role", async () => {
    parentDocuments.push(
      parentDocument("other", "other-parent", "child")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "existing-parent-role-unknown"
    );
  });

  it("bloquea role corrupto en el otro parent", async () => {
    parentDocuments.push(
      parentDocument("other", "other-parent", "child", "guardian")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "invalid-existing-parent-state"
    );
  });

  it("bloquea link global estructuralmente corrupto", async () => {
    parentDocuments.push(parentDocument("corrupt", "", "descendant"));
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "invalid-existing-parent-state"
    );
  });

  it.each([
    ["directo", [parentDocument("path", "child", "new-parent", "mother")]],
    ["transitivo", [
      parentDocument("path-1", "child", "descendant", "mother"),
      parentDocument("path-2", "descendant", "new-parent", "father"),
    ]],
  ])("bloquea ciclo %s", async (_name, pathDocuments) => {
    parentDocuments.push(...pathDocuments);
    await expectReassignError(
      validReassignRequest(), "failed-precondition", "cycle-detected"
    );
  });

  it("excluye target del grafo hipotético y permite escenario sin ciclo", async () => {
    parentDocuments.push(
      parentDocument("other-edge", "old-parent", "descendant", "mother")
    );
    await reassignParentRelationship.run(validReassignRequest() as never);
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledOnce();
  });

  it("bloquea un ciclo preexistente sin repararlo", async () => {
    parentDocuments.push(
      parentDocument("cycle-a", "ancestor", "descendant", "father"),
      parentDocument("cycle-b", "descendant", "ancestor", "mother")
    );
    await expectReassignError(
      validReassignRequest(),
      "failed-precondition",
      "invalid-existing-parent-state"
    );
  });

  it("preserva PARTNER_OF, personas, tree y timestamps", async () => {
    const partnerRef = {id: "partner", kind: "relationship"};
    const originalTree = {...treeData};
    await reassignParentRelationship.run(validReassignRequest() as never);
    expect(treeData).toEqual(originalTree);
    expect(addRelationshipFirestore.transactionDelete)
      .not.toHaveBeenCalledWith(partnerRef);
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
  });

  it("crea un nuevo documento whitelisted con timestamps nuevos", async () => {
    const result = await reassignParentRelationship.run(
      validReassignRequest() as never
    );
    expect(result).toEqual({ok: true, relationshipId: "new-relationship"});
    expect(result.relationshipId).not.toBe("old-link");
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledWith(
      expect.objectContaining({id: "new-relationship"}),
      {
        type: "PARENT_OF",
        fromPersonId: "new-parent",
        toPersonId: "child",
        parentRole: "father",
        createdAt: "server-timestamp",
        updatedAt: "server-timestamp",
      }
    );
    expect(Object.keys(
      addRelationshipFirestore.transactionSet.mock.calls[0][1]
    ).sort()).toEqual([
      "createdAt", "fromPersonId", "parentRole", "toPersonId", "type",
      "updatedAt",
    ]);
  });

  it("realiza todas las lecturas antes de exactamente dos writes", async () => {
    await reassignParentRelationship.run(validReassignRequest() as never);
    const lastRead = Math.max(
      ...addRelationshipFirestore.transactionGet.mock.invocationCallOrder
    );
    const deleteOrder = addRelationshipFirestore.transactionDelete
      .mock.invocationCallOrder[0];
    const setOrder = addRelationshipFirestore.transactionSet
      .mock.invocationCallOrder[0];
    expect(lastRead).toBeLessThan(deleteOrder);
    expect(deleteOrder).toBeLessThan(setOrder);
    expect(addRelationshipFirestore.transactionDelete).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
  });

  it("fallo de validación produce cero escrituras", async () => {
    existingPersonIds.delete("new-parent");
    await expectReassignError(
      validReassignRequest(), "not-found", "new-parent-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it("reutiliza el mismo nuevo ref durante retries simulados", async () => {
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => {
        const tx = {
          get: addRelationshipFirestore.transactionGet,
          delete: addRelationshipFirestore.transactionDelete,
          set: addRelationshipFirestore.transactionSet,
          update: addRelationshipFirestore.transactionUpdate,
        };
        await callback(tx);
        return callback(tx);
      }
    );
    const result = await reassignParentRelationship.run(
      validReassignRequest() as never
    );
    const newRefs = addRelationshipFirestore.transactionSet.mock.calls
      .map(([reference]) => reference);
    expect(newRefs).toHaveLength(2);
    expect(newRefs[0]).toBe(newRefs[1]);
    expect(result).toEqual({ok: true, relationshipId: "new-relationship"});
  });

  it("segunda llamada al old ID devuelve relationship-not-found", async () => {
    await reassignParentRelationship.run(validReassignRequest() as never);
    vi.clearAllMocks();
    targetExists = false;
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) => callback({
        get: addRelationshipFirestore.transactionGet,
        delete: addRelationshipFirestore.transactionDelete,
        set: addRelationshipFirestore.transactionSet,
      })
    );
    await expectReassignError(
      validReassignRequest(), "not-found", "relationship-not-found"
    );
    expect(addRelationshipFirestore.transactionDelete).not.toHaveBeenCalled();
  });

  it("sanitiza errores inesperados", async () => {
    addRelationshipFirestore.transactionGet.mockRejectedValueOnce(
      new Error("sensitive-sdk-error")
    );
    const error = await expectReassignError(validReassignRequest(), "internal");
    expect(error.message).not.toContain("sensitive-sdk-error");
  });

  it("no usa Auth, batches, updates ni writes PARTNER_OF", async () => {
    const source = await import("node:fs/promises").then(({readFile}) =>
      readFile(`${process.cwd()}/src/index.ts`, "utf8")
    );
    const start = source.indexOf("export const reassignParentRelationship");
    const end = source.indexOf("/**\n * LEGACY / TEMPORAL", start);
    const implementation = source.slice(start, end);
    expect(implementation).not.toMatch(
      /getAuth|deleteUser|updateUser|auth\(\)|WriteBatch|BulkWriter|collectionGroup|tx\.update/
    );
    expect(implementation).not.toMatch(
      /type:\s*["']PARTNER_OF|personsRef\.doc\([^)]*\)\.delete|treeRef\.update/
    );
  });
});

describe("updatePerson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addRelationshipFirestore.ownershipGet.mockResolvedValue({
      exists: true,
      data: () => ({ownerId: "owner", rootPersonId: "person"}),
    });
    addRelationshipFirestore.personGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: "owner",
        isRoot: true,
        createdAt: "created-at",
      }),
    });
    addRelationshipFirestore.personUpdate.mockResolvedValue(undefined);
  });

  it("rechaza usuarios no autenticados sin leer ni escribir", async () => {
    const error = await updatePerson.run({
      ...validUpdatePersonRequest(),
      auth: undefined,
    } as never).catch((value) => value);

    expect(error.code).toBe("unauthenticated");
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["treeId", undefined],
    ["treeId", "   "],
    ["personId", undefined],
    ["personId", "   "],
  ])("rechaza %s ausente o vacío", async (field, value) => {
    const error = await updatePerson.run(validUpdatePersonRequest({
      [field]: value,
    }) as never).catch((reason) => reason);

    expect(error.code).toBe("invalid-argument");
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "invalid", []])(
    "rechaza personData inválido: %s",
    async (personData) => {
      const error = await updatePerson.run(validUpdatePersonRequest({
        personData,
      }) as never).catch((reason) => reason);

      expect(error.code).toBe("invalid-argument");
      expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["firstName", "   "],
    ["lastName", "   "],
  ])("rechaza %s vacío", async (field, value) => {
    const request = validUpdatePersonRequest();
    request.data.personData = {...request.data.personData, [field]: value};
    const error = await updatePerson.run(request as never).catch(
      (reason) => reason
    );

    expect(error.code).toBe("invalid-argument");
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
  });

  it("rechaza árbol inexistente", async () => {
    addRelationshipFirestore.ownershipGet.mockResolvedValue({exists: false});
    const error = await updatePerson.run(
      validUpdatePersonRequest() as never
    ).catch((reason) => reason);

    expect(error.code).toBe("permission-denied");
    expect(addRelationshipFirestore.personGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
  });

  it("rechaza usuarios que no son propietarios", async () => {
    addRelationshipFirestore.ownershipGet.mockResolvedValue({
      exists: true,
      data: () => ({ownerId: "another-owner"}),
    });
    const error = await updatePerson.run(
      validUpdatePersonRequest() as never
    ).catch((reason) => reason);

    expect(error.code).toBe("permission-denied");
    expect(addRelationshipFirestore.personGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
  });

  it("rechaza personas inexistentes", async () => {
    addRelationshipFirestore.personGet.mockResolvedValue({exists: false});
    const error = await updatePerson.run(
      validUpdatePersonRequest() as never
    ).catch((reason) => reason);

    expect(error.code).toBe("not-found");
    expect(addRelationshipFirestore.personUpdate).not.toHaveBeenCalled();
  });

  it("normaliza nombres y campos opcionales", async () => {
    const result = await updatePerson.run(validUpdatePersonRequest({
      personData: {
        firstName: "  Ana María  ",
        middleName: "  Isabel  ",
        lastName: "  Pérez  ",
        secondLastName: "  Gómez  ",
        birthDate: "  1990-01-02  ",
        birthPlace: "  Bogotá  ",
      },
    }) as never);

    expect(result).toEqual({ok: true, personId: "person"});
    expect(addRelationshipFirestore.personUpdate).toHaveBeenCalledWith({
      firstName: "Ana María",
      middleName: "Isabel",
      lastName: "Pérez",
      secondLastName: "Gómez",
      birthDate: "1990-01-02",
      birthPlace: "Bogotá",
      updatedAt: "server-timestamp",
    });
  });

  it("permite vaciar todos los campos opcionales", async () => {
    await updatePerson.run(validUpdatePersonRequest({
      personData: {
        firstName: "Ana",
        middleName: "   ",
        lastName: "Pérez",
        secondLastName: null,
        birthDate: undefined,
        birthPlace: "",
      },
    }) as never);

    expect(addRelationshipFirestore.personUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        middleName: "",
        secondLastName: "",
        birthDate: "",
        birthPlace: "",
      })
    );
  });

  it.each([true, false])(
    "edita personas raíz y no raíz preservando campos protegidos (isRoot=%s)",
    async (isRoot) => {
      addRelationshipFirestore.personGet.mockResolvedValue({
        exists: true,
        data: () => ({ownerId: "owner", isRoot, createdAt: "created-at"}),
      });

      await updatePerson.run(validUpdatePersonRequest({
        personData: {
          firstName: "Ana",
          lastName: "Pérez",
          ownerId: "attacker",
          isRoot: !isRoot,
          createdAt: "attacker-created-at",
          id: "attacker-person",
          treeId: "attacker-tree",
          unknownField: "attacker-value",
        },
      }) as never);

      const update = addRelationshipFirestore.personUpdate.mock.calls[0][0];
      expect(update).not.toHaveProperty("ownerId");
      expect(update).not.toHaveProperty("isRoot");
      expect(update).not.toHaveProperty("createdAt");
      expect(update).not.toHaveProperty("id");
      expect(update).not.toHaveProperty("treeId");
      expect(update).not.toHaveProperty("unknownField");
    }
  );

  it("actualiza solo la persona existente sin crear, borrar, tocar árbol o relaciones", async () => {
    const result = await updatePerson.run(
      validUpdatePersonRequest() as never
    );

    expect(result).toEqual({ok: true, personId: "person"});
    expect(addRelationshipFirestore.personUpdate).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.ownershipGet).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.personGet).toHaveBeenCalledOnce();
  });
});

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
    addRelationshipFirestore.transactionGet.mockImplementation(
      async (reference) =>
        reference === addRelationshipFirestore.duplicateQuery ?
          { empty: true, docs: [] } :
          { exists: true }
    );
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) =>
        callback({
          get: addRelationshipFirestore.transactionGet,
          set: addRelationshipFirestore.transactionSet,
          update: addRelationshipFirestore.transactionUpdate,
        })
    );
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

describe("vinculación legacy de hijos existentes", () => {
  const parentRelationshipDoc = (
    parentId: string,
    childId: string,
    parentRole?: "father" | "mother"
  ) => ({
    data: () => ({
      type: "PARENT_OF",
      fromPersonId: parentId,
      toPersonId: childId,
      ...(parentRole ? { parentRole } : {}),
    }),
  });

  const prepareCreateUnionChildLink = (
    existingParentDocs: ReturnType<typeof parentRelationshipDoc>[]
  ) => {
    addRelationshipFirestore.transactionGet
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ docs: existingParentDocs })
      .mockResolvedValueOnce({ docs: existingParentDocs });
  };

  const prepareAddPartnerChildLink = (
    existingParentDocs: ReturnType<typeof parentRelationshipDoc>[]
  ) => {
    addRelationshipFirestore.transactionGet
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ docs: existingParentDocs })
      .mockResolvedValueOnce({ docs: existingParentDocs });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    addRelationshipFirestore.ownershipGet.mockResolvedValue({
      exists: true,
      data: () => ({ ownerId: "owner" }),
    });
    addRelationshipFirestore.transactionGet.mockImplementation(
      async (reference) =>
        reference === addRelationshipFirestore.duplicateQuery ?
          { empty: true, docs: [] } :
          { exists: true }
    );
    addRelationshipFirestore.runTransaction.mockImplementation(
      async (callback) =>
        callback({
          get: addRelationshipFirestore.transactionGet,
          set: addRelationshipFirestore.transactionSet,
          update: addRelationshipFirestore.transactionUpdate,
        })
    );
  });

  it("createUnion rechaza hijos existentes sin parentRole antes de Firestore", async () => {
    const error = await createUnion.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personAId: "person-a",
        personBId: "person-b",
        childrenOwnerId: "person-a",
        existingChildIds: ["child"],
      },
    } as never).catch((value) => value);

    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe("failed-precondition");
    expect(error.details).toEqual({ reason: "parent-role-required" });
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.ownershipGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it("addPartnerToPerson rechaza hijos existentes sin parentRole antes de Firestore", async () => {
    const error = await addPartnerToPerson.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personId: "person-a",
        partnerData: { firstName: "Ana", lastName: "Pérez" },
        existingChildIds: ["child"],
      },
    } as never).catch((value) => value);

    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe("failed-precondition");
    expect(error.details).toEqual({ reason: "parent-role-required" });
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.ownershipGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionGet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.relationshipSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.batch).not.toHaveBeenCalled();
  });

  it.each(["parent", "", null])(
    "createUnion rechaza el rol inválido %s sin acceder a Firestore",
    async (parentRoleForExistingChildren) => {
      const error = await createUnion.run({
        auth: { uid: "owner" },
        data: {
          treeId: "tree",
          personAId: "person-a",
          personBId: "person-b",
          childrenOwnerId: "person-a",
          existingChildIds: ["child"],
          parentRoleForExistingChildren,
        },
      } as never).catch((value) => value);

      expect(error).toBeInstanceOf(HttpsError);
      expect(error.code).toBe("failed-precondition");
      expect(error.details).toEqual({ reason: "parent-role-required" });
      expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
      expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
    }
  );

  it("addPartnerToPerson rechaza un rol inválido sin acceder a Firestore", async () => {
    const error = await addPartnerToPerson.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personId: "person-a",
        partnerData: { firstName: "Ana", lastName: "Pérez" },
        existingChildIds: ["child"],
        parentRoleForExistingChildren: "unknown",
      },
    } as never).catch((value) => value);

    expect(error.code).toBe("failed-precondition");
    expect(error.details).toEqual({ reason: "parent-role-required" });
    expect(addRelationshipFirestore.db.collection).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each(["father", "mother"] as const)(
    "createUnion escribe PARENT_OF con parentRole %s dentro de la transacción",
    async (parentRoleForExistingChildren) => {
      prepareCreateUnionChildLink([
        parentRelationshipDoc(
          "person-a",
          "child",
          parentRoleForExistingChildren === "father" ? "mother" : "father"
        ),
      ]);

      const result = await createUnion.run({
        auth: { uid: "owner" },
        data: {
          treeId: "tree",
          personAId: "person-a",
          personBId: "person-b",
          childrenOwnerId: "person-a",
          existingChildIds: ["child"],
          parentRoleForExistingChildren,
        },
      } as never);

      expect(result).toMatchObject({ linkedChildIds: ["child"] });
      expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "PARENT_OF",
          fromPersonId: "person-b",
          toPersonId: "child",
          parentRole: parentRoleForExistingChildren,
        })
      );
    }
  );

  it("addPartnerToPerson crea persona, pareja y PARENT_OF con el rol explícito", async () => {
    prepareAddPartnerChildLink([
      parentRelationshipDoc("person-a", "child", "father"),
    ]);

    const result = await addPartnerToPerson.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personId: "person-a",
        partnerData: { firstName: "Ana", lastName: "Pérez" },
        existingChildIds: ["child"],
        parentRoleForExistingChildren: "mother",
      },
    } as never);

    expect(result).toMatchObject({ linkedChildIds: ["child"] });
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledTimes(3);
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "PARENT_OF",
        fromPersonId: "new-partner",
        toPersonId: "child",
        parentRole: "mother",
      })
    );
  });

  it("rechaza un rol parental ya ocupado sin escrituras parciales", async () => {
    prepareCreateUnionChildLink([
      parentRelationshipDoc("person-a", "child", "father"),
    ]);

    const error = await createUnion.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personAId: "person-a",
        personBId: "person-b",
        childrenOwnerId: "person-a",
        existingChildIds: ["child"],
        parentRoleForExistingChildren: "father",
      },
    } as never).catch((value) => value);

    expect(error.details).toEqual({ reason: "parent-role-occupied" });
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it("rechaza un tercer progenitor sin escrituras parciales", async () => {
    const existingParentDocs = [
      parentRelationshipDoc("person-a", "child", "father"),
      parentRelationshipDoc("person-c", "child", "mother"),
    ];
    prepareCreateUnionChildLink(existingParentDocs);

    const error = await createUnion.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personAId: "person-a",
        personBId: "person-b",
        childrenOwnerId: "person-a",
        existingChildIds: ["child"],
        parentRoleForExistingChildren: "mother",
      },
    } as never).catch((value) => value);

    expect(error.details).toEqual({ reason: "maximum-parents" });
    expect(addRelationshipFirestore.transactionSet).not.toHaveBeenCalled();
    expect(addRelationshipFirestore.transactionUpdate).not.toHaveBeenCalled();
  });

  it("createUnion conserva el flujo de pareja sin hijos", async () => {
    const result = await createUnion.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personAId: "person-b",
        personBId: "person-a",
      },
    } as never);

    expect(result).toMatchObject({
      ok: true,
      relationshipId: "new-relationship",
      alreadyExisted: false,
      linkedChildIds: [],
    });
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "PARTNER_OF",
        fromPersonId: "person-a",
        toPersonId: "person-b",
      })
    );
  });

  it("addPartnerToPerson conserva el flujo de pareja nueva sin hijos", async () => {
    const result = await addPartnerToPerson.run({
      auth: { uid: "owner" },
      data: {
        treeId: "tree",
        personId: "person-a",
        partnerData: { firstName: "Ana", lastName: "Pérez" },
      },
    } as never);

    expect(result).toMatchObject({
      ok: true,
      partnerId: "new-partner",
      relationshipId: "new-relationship",
      linkedChildIds: [],
    });
    expect(addRelationshipFirestore.runTransaction).toHaveBeenCalledOnce();
    expect(addRelationshipFirestore.transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "PARTNER_OF" })
    );
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
