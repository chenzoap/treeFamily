import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import type {Person, Relationship} from "../types/family";
import ReassignParentDialog from "./ReassignParentDialog";
import dialogSource from "./ReassignParentDialog.tsx?raw";
import {
  buildReassignParentPayload,
  buildReassignParentTarget,
  canSubmitReassignment,
  reassignParentErrorMessage,
  reassignParentTitle,
  submitReassignParent,
  type ReassignParentTarget,
} from "./ReassignParentDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

const persons: Person[] = [
  {id: "root", firstName: "Raíz", lastName: "Principal", isRoot: true},
  {id: "old", firstName: "Padre", lastName: "Anterior"},
  {id: "child", firstName: "Hija", lastName: "Ejemplo"},
  {id: "other-parent", firstName: "Madre", lastName: "Actual"},
  {id: "detached", firstName: "Persona", lastName: "Desconectada"},
  {id: "has-children", firstName: "Persona", lastName: "Con Hijos"},
];

const targetRelationship = (
  parentRole?: Relationship["parentRole"]
): Relationship => ({
  id: "old-link",
  type: "PARENT_OF",
  fromPersonId: "old",
  toPersonId: "child",
  ...(parentRole ? {parentRole} : {}),
});

function target(
  parentRole?: Relationship["parentRole"],
  relationships: Relationship[] = []
) {
  const relationship = targetRelationship(parentRole);
  return buildReassignParentTarget({
    relationship,
    persons,
    relationships: [relationship, ...relationships],
  });
}

describe("candidatos de reasignación", () => {
  it("excluye child, old parent y todos los progenitores actuales", () => {
    const result = target("father", [{
      id: "other-link",
      type: "PARENT_OF",
      fromPersonId: "other-parent",
      toPersonId: "child",
      parentRole: "mother",
    }]);
    const ids = result.candidates.map((person) => person.id);
    expect(ids).not.toContain("child");
    expect(ids).not.toContain("old");
    expect(ids).not.toContain("other-parent");
  });

  it("incluye root, desconectados y personas con otros hijos", () => {
    const result = target("father", [{
      id: "unrelated-child",
      type: "PARENT_OF",
      fromPersonId: "has-children",
      toPersonId: "detached",
      parentRole: "father",
    }]);
    expect(result.candidates.map((person) => person.id)).toEqual(
      expect.arrayContaining(["root", "detached", "has-children"])
    );
  });

  it("usa person.id como identidad y conserva nombres completos", () => {
    expect(target("father").candidates).toContainEqual({
      id: "detached",
      name: "Persona Desconectada",
    });
  });

  it("permite representar cero candidatos", () => {
    const relationship = targetRelationship("father");
    const minimalPersons = persons.filter((person) =>
      person.id === "old" || person.id === "child"
    );
    const result = buildReassignParentTarget({
      relationship,
      persons: minimalPersons,
      relationships: [relationship],
    });
    expect(result.candidates).toEqual([]);
    expect(canSubmitReassignment(result, "")).toBe(false);
  });
});

describe("role, título y payload", () => {
  it.each([
    ["father", "Padre"],
    ["mother", "Madre"],
  ] as const)("presenta role almacenado %s como fijo", (role, label) => {
    const markup = renderToStaticMarkup(createElement(ReassignParentDialog, {
      treeId: "tree",
      target: target(role),
      call: vi.fn(),
      onCancel: vi.fn(),
      onSuccess: vi.fn(),
    }));
    expect(markup).toContain(`Rol que se conservará: ${label}`);
    expect(markup).not.toContain("Rol de la nueva filiación");
  });

  it.each(["father", "mother"] as const)(
    "omite parentRole del payload cuando stored role=%s",
    (parentRole) => {
      const payload = buildReassignParentPayload({
        treeId: "tree",
        target: target(parentRole),
        newParentPersonId: "detached",
      });
      expect(payload).toEqual({
        treeId: "tree",
        relationshipId: "old-link",
        newParentPersonId: "detached",
      });
      expect(Object.keys(payload)).toHaveLength(3);
    }
  );

  it("histórico muestra selector sin preselección y exige role", () => {
    const historical = target();
    const markup = renderToStaticMarkup(createElement(ReassignParentDialog, {
      treeId: "tree",
      target: historical,
      call: vi.fn(),
      onCancel: vi.fn(),
      onSuccess: vi.fn(),
    }));
    expect(markup).toContain("Rol de la nueva filiación");
    expect(markup).toContain('<option value="" selected="">Selecciona un rol');
    expect(canSubmitReassignment(historical, "detached")).toBe(false);
  });

  it.each(["father", "mother"] as const)(
    "histórico envía exclusivamente cuatro campos con role=%s",
    (parentRole) => {
      const payload = buildReassignParentPayload({
        treeId: "tree",
        target: target(),
        newParentPersonId: "detached",
        selectedParentRole: parentRole,
      });
      expect(payload).toEqual({
        treeId: "tree",
        relationshipId: "old-link",
        newParentPersonId: "detached",
        parentRole,
      });
      expect(Object.keys(payload)).toHaveLength(4);
    }
  );

  it("no incluye datos no contractuales", () => {
    const payload = buildReassignParentPayload({
      treeId: "tree",
      target: target("father"),
      newParentPersonId: "detached",
    });
    [
      "oldParentPersonId", "childPersonId", "type", "ownerId", "persons",
      "relationship", "expectedOldParentId",
    ].forEach((field) => expect(payload).not.toHaveProperty(field));
  });

  it("construye título neutro y títulos father/mother correctos", () => {
    expect(reassignParentTitle(target("father"), "")).toBe(
      "Cambiar progenitor de Hija Ejemplo"
    );
    expect(reassignParentTitle(target("father"), "detached")).toBe(
      "¿Cambiar a Padre Anterior por Persona Desconectada como padre de Hija Ejemplo?"
    );
    expect(reassignParentTitle(target("mother"), "detached")).toBe(
      "¿Cambiar a Padre Anterior por Persona Desconectada como madre de Hija Ejemplo?"
    );
  });
});

describe("diálogo de reasignación", () => {
  const renderDialog = (dialogTarget: ReassignParentTarget) =>
    renderToStaticMarkup(createElement(ReassignParentDialog, {
      treeId: "tree",
      target: dialogTarget,
      call: vi.fn(),
      onCancel: vi.fn(),
      onSuccess: vi.fn(),
    }));

  it("es accesible y comienza con foco seguro", () => {
    const markup = renderDialog(target("father"));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="reassign-parent-title"');
    expect(markup).toContain('aria-describedby="reassign-parent-description"');
    expect(dialogSource).toContain("cancelButtonRef.current?.focus()");
  });

  it("explica preservación, parejas, reorganización y desconexión", () => {
    const markup = renderDialog(target("father"));
    expect(markup).toContain("Ninguna persona será eliminada");
    expect(markup).toContain("relaciones de pareja no cambiarán");
    expect(markup).toContain("puede reorganizarse");
    expect(markup).toContain("puede quedar desconectado visualmente");
    expect(markup).toContain("no modifica la cuenta ni la autenticación");
  });

  it("muestra mensaje y confirmación disabled sin candidatos", () => {
    const noCandidates = {...target("father"), candidates: []};
    const markup = renderDialog(noCandidates);
    expect(markup).toContain(
      "No hay otras personas disponibles para usar como progenitor."
    );
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Cambiar progenitor<\/button>/
    );
  });

  it("bloquea doble submit y controles durante loading", () => {
    const gate = {current: false};
    expect(startDeleteSubmission(gate)).toBe(true);
    expect(startDeleteSubmission(gate)).toBe(false);
    finishDeleteSubmission(gate);
    expect(dialogSource).toContain('{submitting ? "Cambiando..."');
    expect(dialogSource.match(/disabled=\{submitting\}/g)).toHaveLength(3);
    expect(dialogSource).toContain("disabled={submitting || !canSubmit}");
  });

  it("Escape solo cierra idle", () => {
    expect(dialogSource).toContain('event.key === "Escape" && !submitting');
  });
});

describe("submit y errores", () => {
  it("llama una vez y ejecuta éxito solo después de resolver", async () => {
    let resolveCall: (() => void) | undefined;
    const call = vi.fn(() => new Promise<void>((resolve) => {
      resolveCall = resolve;
    }));
    const onSuccess = vi.fn();
    const pending = submitReassignParent({
      call,
      payload: {
        treeId: "tree",
        relationshipId: "old-link",
        newParentPersonId: "detached",
      },
      onSuccess,
    });
    expect(call).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    resolveCall?.();
    await pending;
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("no ejecuta éxito cuando falla", async () => {
    const onSuccess = vi.fn();
    await expect(submitReassignParent({
      call: vi.fn().mockRejectedValue(new Error("failure")),
      payload: {
        treeId: "tree",
        relationshipId: "old-link",
        newParentPersonId: "detached",
      },
      onSuccess,
    })).rejects.toThrow("failure");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ["functions/unauthenticated", "", "Tu sesión ya no es válida. Inicia sesión nuevamente."],
    ["functions/invalid-argument", "invalid-tree-id", "No pudimos identificar correctamente los datos de la reasignación."],
    ["functions/invalid-argument", "invalid-relationship-id", "No pudimos identificar correctamente los datos de la reasignación."],
    ["functions/invalid-argument", "invalid-new-parent-id", "No pudimos identificar correctamente los datos de la reasignación."],
    ["functions/invalid-argument", "invalid-parent-role", "Selecciona un rol parental válido."],
    ["functions/invalid-argument", "unexpected-parent-role", "El rol de esta relación cambió. Actualiza la vista e inténtalo nuevamente."],
    ["functions/not-found", "tree-not-found", "El árbol ya no existe."],
    ["functions/permission-denied", "not-tree-owner", "No tienes permiso para modificar este árbol."],
    ["functions/not-found", "relationship-not-found", "Esta relación parental ya no existe."],
    ["functions/failed-precondition", "relationship-not-parent", "La relación seleccionada ya no es una filiación parental válida."],
    ["functions/not-found", "new-parent-not-found", "La persona seleccionada como nuevo progenitor ya no existe."],
    ["functions/failed-precondition", "inconsistent-tree-data", "No podemos cambiar este progenitor porque el árbol contiene datos inconsistentes."],
    ["functions/failed-precondition", "same-parent", "Selecciona una persona diferente al progenitor actual."],
    ["functions/failed-precondition", "self-parent", "Una persona no puede ser su propio progenitor."],
    ["functions/failed-precondition", "duplicate-parent-link", "La persona seleccionada ya es progenitor de este hijo."],
    ["functions/failed-precondition", "duplicate-existing-parent-link", "La filiación actual está duplicada y debe corregirse antes de reasignarla."],
    ["functions/failed-precondition", "invalid-existing-parent-state", "Las relaciones parentales actuales deben corregirse antes de realizar esta reasignación."],
    ["functions/failed-precondition", "parent-role-occupied", "Ese rol parental ya está ocupado por otro progenitor."],
    ["functions/failed-precondition", "existing-parent-role-unknown", "No podemos determinar de forma segura el rol del otro progenitor."],
    ["functions/failed-precondition", "cycle-detected", "Este cambio crearía un ciclo familiar y no puede realizarse."],
    ["functions/internal", "", "No pudimos cambiar el progenitor. Inténtalo nuevamente."],
    ["unknown", "", "No pudimos cambiar el progenitor. Inténtalo nuevamente."],
  ])("traduce %s/%s", (code, reason, expected) => {
    const error = reason ? {code, details: {reason}} : {code};
    expect(reassignParentErrorMessage(error)).toBe(expected);
  });
});
