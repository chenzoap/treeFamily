import {describe, expect, it} from "vitest";
import {reconcileSelectedPersonId} from "./treeSelection";
import type {Person} from "../types/family";

const persons: Person[] = [
  {id: "root", firstName: "Ana", lastName: "Pérez", isRoot: true},
  {id: "relative", firstName: "Luis", lastName: "Ruiz"},
];

describe("reconcileSelectedPersonId", () => {
  it("conserva una selección existente", () => {
    expect(reconcileSelectedPersonId("relative", "root", persons))
      .toBe("relative");
  });

  it("vuelve a la raíz cuando la selección desaparece", () => {
    expect(reconcileSelectedPersonId("deleted", "root", persons)).toBe("root");
  });

  it("no genera cambios cuando selectedPersonId es null", () => {
    expect(reconcileSelectedPersonId(null, "root", persons)).toBeNull();
  });

  it.each([
    [null, persons],
    ["missing-root", persons],
    ["root", []],
  ] as const)("no inventa una raíz ausente: %s", (rootPersonId, values) => {
    expect(reconcileSelectedPersonId("deleted", rootPersonId, values))
      .toBe("deleted");
  });

  it("un snapshot que todavía contiene la persona no altera la selección", () => {
    const first = reconcileSelectedPersonId("relative", "root", persons);
    const second = reconcileSelectedPersonId(first, "root", [...persons]);
    expect(second).toBe("relative");
  });
});
