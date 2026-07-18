import { describe, expect, it } from "vitest";
import type {
  ParentRole,
  PartnerRelationshipStatus,
  Person,
  Relationship,
} from "../types/family";
import { buildUnionsWithDiagnostics } from "./union";

function person(id: string): Person {
  return {
    id,
    firstName: `Nombre ${id}`,
    lastName: `Apellido ${id}`,
  };
}

function parentRelationship(
  id: string,
  parentId: string,
  childId: string,
  parentRole?: ParentRole
): Relationship {
  return {
    id,
    type: "PARENT_OF",
    fromPersonId: parentId,
    toPersonId: childId,
    ...(parentRole ? { parentRole } : {}),
  };
}

function partnerRelationship(
  id: string,
  firstId: string,
  secondId: string,
  relationshipStatus?: PartnerRelationshipStatus
): Relationship {
  return {
    id,
    type: "PARTNER_OF",
    fromPersonId: firstId,
    toPersonId: secondId,
    ...(relationshipStatus ? { relationshipStatus } : {}),
  };
}

describe("buildUnionsWithDiagnostics", () => {
  it("construye un couple canónico sin hijos a partir de PARTNER_OF", () => {
    const result = buildUnionsWithDiagnostics(
      [person("persona-b"), person("persona-a")],
      [partnerRelationship("pareja-1", "persona-b", "persona-a")]
    );

    expect(result.issues).toEqual([]);
    expect(result.unions).toHaveLength(1);
    expect(result.unions[0]).toEqual({
      id: "union:persona-a:persona-b",
      kind: "couple",
      partnerA: "persona-a",
      partnerB: "persona-b",
      relationshipStatus: "unknown",
      children: [],
    });
  });

  it("mantiene una sola unión couple cuando la pareja tiene un hijo compartido", () => {
    const result = buildUnionsWithDiagnostics(
      [person("a"), person("b"), person("hijo")],
      [
        partnerRelationship("pareja", "a", "b", "current"),
        parentRelationship("a-hijo", "a", "hijo"),
        parentRelationship("b-hijo", "b", "hijo"),
      ]
    );

    expect(result.unions).toHaveLength(1);
    expect(result.unions[0]).toMatchObject({
      id: "union:a:b",
      kind: "couple",
      children: ["hijo"],
    });
    expect(result.unions.some((union) => union.kind === "coParents")).toBe(
      false
    );
  });

  it("construye coParents para dos progenitores con un hijo y sin PARTNER_OF", () => {
    const result = buildUnionsWithDiagnostics(
      [person("a"), person("b"), person("hijo")],
      [
        parentRelationship("a-hijo", "a", "hijo"),
        parentRelationship("b-hijo", "b", "hijo"),
      ]
    );

    expect(result.unions).toEqual([
      {
        id: "union:a:b",
        kind: "coParents",
        partnerA: "a",
        partnerB: "b",
        children: ["hijo"],
      },
    ]);
    expect(result.unions.some((union) => union.kind === "couple")).toBe(false);
  });

  it("agrupa varios hijos compartidos en una única unión coParents", () => {
    const result = buildUnionsWithDiagnostics(
      [person("a"), person("b"), person("hijo-1"), person("hijo-2")],
      [
        parentRelationship("a-hijo-1", "a", "hijo-1"),
        parentRelationship("b-hijo-1", "b", "hijo-1"),
        parentRelationship("a-hijo-2", "a", "hijo-2"),
        parentRelationship("b-hijo-2", "b", "hijo-2"),
      ]
    );

    expect(result.unions).toHaveLength(1);
    expect(result.unions[0]).toMatchObject({
      kind: "coParents",
      children: ["hijo-1", "hijo-2"],
    });
  });

  it("construye singleParent con todos los hijos de un único progenitor", () => {
    const result = buildUnionsWithDiagnostics(
      [person("madre"), person("hijo-1"), person("hijo-2")],
      [
        parentRelationship("madre-hijo-1", "madre", "hijo-1", "mother"),
        parentRelationship("madre-hijo-2", "madre", "hijo-2", "mother"),
      ]
    );

    expect(result.unions).toEqual([
      {
        id: "single:madre",
        kind: "singleParent",
        partnerA: "madre",
        partnerB: "",
        children: ["hijo-1", "hijo-2"],
      },
    ]);
  });

  it("compartir otro hijo conserva coParents y nunca implica una pareja", () => {
    const persons = [
      person("a"),
      person("b"),
      person("hijo-1"),
      person("hijo-2"),
    ];
    const firstChildRelationships = [
      parentRelationship("a-hijo-1", "a", "hijo-1"),
      parentRelationship("b-hijo-1", "b", "hijo-1"),
    ];
    const before = buildUnionsWithDiagnostics(
      persons,
      firstChildRelationships
    );
    const after = buildUnionsWithDiagnostics(persons, [
      ...firstChildRelationships,
      parentRelationship("a-hijo-2", "a", "hijo-2"),
      parentRelationship("b-hijo-2", "b", "hijo-2"),
    ]);

    expect(before.unions[0]).toMatchObject({
      kind: "coParents",
      children: ["hijo-1"],
    });
    expect(after.unions).toHaveLength(1);
    expect(after.unions[0]).toMatchObject({
      kind: "coParents",
      children: ["hijo-1", "hijo-2"],
    });
    expect(after.unions.some((union) => union.kind === "couple")).toBe(false);
  });

  it("ignora una relación cuyo fromPersonId no existe y reporta el diagnóstico", () => {
    const result = buildUnionsWithDiagnostics(
      [person("hijo")],
      [parentRelationship("huérfana-origen", "ausente", "hijo")]
    );

    expect(result.unions).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_FROM_PERSON",
        severity: "error",
        relationshipId: "huérfana-origen",
      })
    );
  });

  it("ignora una relación cuyo toPersonId no existe y reporta el diagnóstico", () => {
    const result = buildUnionsWithDiagnostics(
      [person("padre")],
      [parentRelationship("huérfana-destino", "padre", "ausente")]
    );

    expect(result.unions).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_TO_PERSON",
        severity: "error",
        relationshipId: "huérfana-destino",
      })
    );
  });

  it("ignora una autorrelación PARENT_OF y reporta el diagnóstico", () => {
    const result = buildUnionsWithDiagnostics(
      [person("persona")],
      [parentRelationship("autorrelación", "persona", "persona")]
    );

    expect(result.unions).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "SELF_RELATIONSHIP",
        severity: "error",
        relationshipId: "autorrelación",
      })
    );
  });

  it("deduplica PARENT_OF equivalentes y no repite al hijo", () => {
    const result = buildUnionsWithDiagnostics(
      [person("padre"), person("hijo")],
      [
        parentRelationship("parental-1", "padre", "hijo"),
        parentRelationship("parental-2", "padre", "hijo"),
      ]
    );

    expect(result.unions).toHaveLength(1);
    expect(result.unions[0].children).toEqual(["hijo"]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATE_PARENT_RELATIONSHIP",
        severity: "warning",
        relationshipId: "parental-2",
      })
    );
  });

  it("canonicaliza PARTNER_OF directa e inversa en una sola unión couple", () => {
    const relationships = [
      partnerRelationship("pareja-directa", "a", "b"),
      partnerRelationship("pareja-inversa", "b", "a"),
    ];
    const forward = buildUnionsWithDiagnostics(
      [person("a"), person("b")],
      relationships
    );
    const reversed = buildUnionsWithDiagnostics(
      [person("b"), person("a")],
      [...relationships].reverse()
    );

    expect(forward.unions).toEqual(reversed.unions);
    expect(forward.unions).toHaveLength(1);
    expect(forward.unions[0]).toMatchObject({
      id: "union:a:b",
      kind: "couple",
      partnerA: "a",
      partnerB: "b",
    });
    expect(forward.issues).toHaveLength(1);
    expect(forward.issues[0].code).toBe("DUPLICATE_PARTNER_RELATIONSHIP");
    expect(reversed.issues).toHaveLength(1);
    expect(reversed.issues[0].code).toBe("DUPLICATE_PARTNER_RELATIONSHIP");
  });

  it("mantiene legible una PARENT_OF histórica sin parentRole", () => {
    const historicalRelationship: Relationship = {
      id: "histórica",
      type: "PARENT_OF",
      fromPersonId: "progenitor",
      toPersonId: "hijo",
    };
    const result = buildUnionsWithDiagnostics(
      [person("progenitor"), person("hijo")],
      [historicalRelationship]
    );

    expect(result.issues).toEqual([]);
    expect(result.unions).toEqual([
      {
        id: "single:progenitor",
        kind: "singleParent",
        partnerA: "progenitor",
        partnerB: "",
        children: ["hijo"],
      },
    ]);
  });

  it("con tres progenitores conserva ramas individuales y no inventa coprogenitores", () => {
    const result = buildUnionsWithDiagnostics(
      [person("a"), person("b"), person("c"), person("hijo")],
      [
        parentRelationship("a-hijo", "a", "hijo"),
        parentRelationship("b-hijo", "b", "hijo"),
        parentRelationship("c-hijo", "c", "hijo"),
      ]
    );

    expect(result.unions).toHaveLength(3);
    expect(result.unions.every((union) => union.kind === "singleParent")).toBe(
      true
    );
    expect(result.unions.map((union) => union.id)).toEqual([
      "single:a",
      "single:b",
      "single:c",
    ]);
    expect(result.unions.every((union) => union.children[0] === "hijo")).toBe(
      true
    );
    expect(result.unions.some((union) => union.kind === "couple")).toBe(false);
    expect(result.unions.some((union) => union.kind === "coParents")).toBe(
      false
    );
  });

  it("mantiene el ID canónico sin semántica de rol, posición u orden", () => {
    const first = buildUnionsWithDiagnostics(
      [person("zeta"), person("alpha")],
      [partnerRelationship("pareja-1", "zeta", "alpha")]
    );
    const second = buildUnionsWithDiagnostics(
      [person("alpha"), person("zeta")],
      [partnerRelationship("pareja-2", "alpha", "zeta")]
    );

    expect(first.unions).toEqual(second.unions);
    expect(first.unions[0]).toMatchObject({
      id: "union:alpha:zeta",
      partnerA: "alpha",
      partnerB: "zeta",
    });
  });
});
