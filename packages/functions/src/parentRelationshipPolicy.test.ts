import { describe, expect, it } from "vitest";
import {
  hasDirectedParentPath,
  normalizeParentRole,
  resolveExistingPairKind,
  validateNewChildParentRoles,
  validateNewParentLink,
  type ExistingParentLink,
} from "./parentRelationshipPolicy.js";

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
