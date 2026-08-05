import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "../types/family";

const selectedState = vi.hoisted(() => ({
  selectedPersonId: "root",
  persons: [] as Person[],
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => vi.fn()),
}));
vi.mock("../lib/firebase", () => ({functions: {}}));
vi.mock("../store/useTreeStore", () => ({
  useTreeStore: () => ({
    persons: selectedState.persons,
    relationships: [],
    treeId: "tree",
    rootPersonId: "root",
    selectedPersonId: selectedState.selectedPersonId,
    setSelectedPersonId: vi.fn(),
  }),
}));

import Stage4Panel from "./Stage4Panel";

describe("acción Editar persona", () => {
  beforeEach(() => {
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
});
