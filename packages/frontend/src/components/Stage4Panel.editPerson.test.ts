import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Person, Relationship } from "../types/family";

const selectedState = vi.hoisted(() => ({
  selectedPersonId: "root",
  persons: [] as Person[],
  relationships: [] as Relationship[],
  setSelectedPersonId: vi.fn(),
  callableInvocations: [] as Array<{name: string; payload: unknown}>,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name: string) =>
    vi.fn(async (payload: unknown) => {
      selectedState.callableInvocations.push({name, payload});
      return {data: {ok: true}};
    })
  ),
}));
vi.mock("../lib/firebase", () => ({functions: {}}));
vi.mock("../store/useTreeStore", () => ({
  useTreeStore: () => ({
    persons: selectedState.persons,
    relationships: selectedState.relationships,
    treeId: "tree",
    rootPersonId: "root",
    selectedPersonId: selectedState.selectedPersonId,
    setSelectedPersonId: selectedState.setSelectedPersonId,
  }),
}));

import Stage4Panel from "./Stage4Panel";

describe("acción Editar persona", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedState.callableInvocations = [];
    selectedState.relationships = [];
    selectedState.persons = [
      {id: "root", firstName: "Ana", lastName: "Pérez", isRoot: true},
      {id: "relative", firstName: "Luis", lastName: "Ruiz", isRoot: false},
    ];
  });

  it.each([
    ["root", "Ana Pérez"],
    ["relative", "Luis Ruiz"],
  ])("muestra Editar persona para la selección %s", (personId, name) => {
    selectedState.selectedPersonId = personId;
    const markup = renderToStaticMarkup(createElement(Stage4Panel));

    expect(markup).toContain("Editar persona");
    expect(markup).toContain(name);
  });

  it("muestra la acción destructiva habilitada para una persona no raíz", () => {
    selectedState.selectedPersonId = "relative";
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup).toMatch(/<button[^>]*>Eliminar persona<\/button>/);
    expect(markup).not.toContain("root-delete-protection");
  });

  it("protege la raíz mediante rootPersonId y explica el motivo", () => {
    selectedState.selectedPersonId = "root";
    selectedState.persons[0].isRoot = false;
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Eliminar persona<\/button>/);
    expect(markup).toContain("La persona principal del árbol no puede eliminarse.");
    expect(selectedState.callableInvocations).toEqual([]);
  });

  it("protege defensivamente una persona no canónica con isRoot=true", () => {
    selectedState.selectedPersonId = "relative";
    selectedState.persons[1].isRoot = true;
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Eliminar persona<\/button>/);
    expect(markup).toContain("La persona principal del árbol no puede eliminarse.");
  });

  it("actualiza la acción cuando cambia la selección sin invocar callables", () => {
    selectedState.selectedPersonId = "root";
    const rootMarkup = renderToStaticMarkup(createElement(Stage4Panel));
    selectedState.selectedPersonId = "relative";
    const relativeMarkup = renderToStaticMarkup(createElement(Stage4Panel));

    expect(rootMarkup).toContain("root-delete-protection");
    expect(relativeMarkup).not.toContain("root-delete-protection");
    expect(relativeMarkup).toContain("Editar persona");
    expect(relativeMarkup).toContain("Agregar padre");
    expect(relativeMarkup).toContain("Agregar madre");
    expect(relativeMarkup).toContain("Agregar pareja");
    expect(relativeMarkup).toContain("Agregar hijo/a");
    expect(selectedState.callableInvocations).toEqual([]);
  });

  it("renderizar o mostrar la acción no elimina inmediatamente", () => {
    selectedState.selectedPersonId = "relative";
    renderToStaticMarkup(createElement(Stage4Panel));
    expect(selectedState.callableInvocations).toEqual([]);
    expect(selectedState.setSelectedPersonId).not.toHaveBeenCalled();
  });
});
