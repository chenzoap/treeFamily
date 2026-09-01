import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach, describe, expect, it, vi} from "vitest";
import type {Person, Relationship} from "../types/family";
import stage4PanelSource from "./Stage4Panel.tsx?raw";

const state = vi.hoisted(() => ({
  selectedPersonId: "root",
  persons: [] as Person[],
  relationships: [] as Relationship[],
  setSelectedPersonId: vi.fn(),
  callableInvocations: [] as Array<{name: string; payload: unknown}>,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name: string) =>
    vi.fn(async (payload: unknown) => {
      state.callableInvocations.push({name, payload});
      return {data: {ok: true}};
    })
  ),
}));
vi.mock("../lib/firebase", () => ({functions: {}}));
vi.mock("../store/useTreeStore", () => ({
  useTreeStore: () => ({
    persons: state.persons,
    relationships: state.relationships,
    treeId: "tree",
    rootPersonId: "root",
    selectedPersonId: state.selectedPersonId,
    setSelectedPersonId: state.setSelectedPersonId,
  }),
}));

import Stage4Panel from "./Stage4Panel";

describe("sección Relaciones de esta persona", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.callableInvocations = [];
    state.selectedPersonId = "root";
    state.persons = [
      {id: "root", firstName: "Ana", lastName: "Pérez", isRoot: true},
      {id: "child", firstName: "Sofía", lastName: "Ruiz"},
      {id: "partner", firstName: "Luis", lastName: "Ruiz"},
      {id: "other", firstName: "Otro", lastName: "Miembro"},
    ];
    state.relationships = [];
  });

  it("siempre muestra sección y estado vacío", () => {
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup).toContain("Relaciones de esta persona");
    expect(markup).toContain("Esta persona no tiene relaciones registradas.");
  });

  it("muestra filas incidentes independientes, incluidos duplicados", () => {
    state.relationships = [
      {
        id: "rel-a", type: "PARENT_OF", fromPersonId: "root",
        toPersonId: "child", parentRole: "mother",
      },
      {
        id: "rel-b", type: "PARENT_OF", fromPersonId: "root",
        toPersonId: "child", parentRole: "mother",
      },
      {
        id: "partner", type: "PARTNER_OF", fromPersonId: "root",
        toPersonId: "partner", relationshipStatus: "current",
      },
      {
        id: "unrelated", type: "PARENT_OF", fromPersonId: "other",
        toPersonId: "child",
      },
    ];
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup.match(/Madre de Sofía Ruiz/g)).toHaveLength(2);
    expect(markup).toContain("Pareja de Luis Ruiz");
    expect(markup).toContain("Actual");
    expect(markup.match(/Quitar relación/g)).toHaveLength(3);
    expect(markup).not.toContain("Progenitor de Sofía Ruiz");
    expect(state.callableInvocations).toEqual([]);
  });

  it("actualiza la lista al cambiar de persona y no altera selección", () => {
    state.relationships = [{
      id: "root-child", type: "PARENT_OF", fromPersonId: "root",
      toPersonId: "child", parentRole: "mother",
    }];
    const rootMarkup = renderToStaticMarkup(createElement(Stage4Panel));
    state.selectedPersonId = "child";
    const childMarkup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(rootMarkup).toContain("Madre de Sofía Ruiz");
    expect(childMarkup).toContain("Hijo/a de Ana Pérez");
    expect(state.setSelectedPersonId).not.toHaveBeenCalled();
  });

  it("permite quitar una relación de root aunque eliminar root siga protegido", () => {
    state.relationships = [{
      id: "root-partner", type: "PARTNER_OF", fromPersonId: "root",
      toPersonId: "partner",
    }];
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Eliminar persona<\/button>/
    );
    expect(markup).toMatch(/<button[^>]*>Quitar relación<\/button>/);
  });

  it("mantiene editar, eliminar persona y agregar familiares", () => {
    state.selectedPersonId = "child";
    const markup = renderToStaticMarkup(createElement(Stage4Panel));
    [
      "Editar persona", "Eliminar persona", "Agregar padre", "Agregar madre",
      "Agregar pareja", "Agregar hijo/a",
    ].forEach((label) => expect(markup).toContain(label));
  });

  it("éxito solo cierra diálogo y muestra notice sin mutar store", () => {
    const start = stage4PanelSource.indexOf("const confirmDeleteRelationship");
    const end = stage4PanelSource.indexOf("\n\n  return (", start);
    const implementation = stage4PanelSource.slice(start, end);
    expect(implementation).toContain("Relación eliminada correctamente.");
    expect(implementation).toContain("setRelationshipPendingDeletion(null)");
    expect(implementation).not.toMatch(
      /setSelectedPersonId|setPersons|setRelationships|getTreeData|location\.reload/
    );
    expect(implementation).not.toMatch(
      /deleteDoc|updateDoc|setDoc|writeBatch|runTransaction/
    );
  });
});
