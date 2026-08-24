import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import DeletePersonDialog from "./DeletePersonDialog";
import {
  buildDeletePersonPayload,
  countIncidentRelationships,
  deletePersonErrorMessage,
  finishDeleteSubmission,
  startDeleteSubmission,
  submitDeletePerson,
} from "./DeletePersonDialog.logic";
import type {Relationship} from "../types/family";

const relationship = (
  id: string,
  fromPersonId: string,
  toPersonId: string,
  type: Relationship["type"] = "PARENT_OF"
): Relationship => ({id, fromPersonId, toPersonId, type});

describe("DeletePersonDialog", () => {
  it.each([0, 1, 3])(
    "renderiza confirmación accesible con %s conexiones",
    (relationshipCount) => {
      const markup = renderToStaticMarkup(createElement(DeletePersonDialog, {
        personName: "Luis Alberto Ruiz Gómez",
        relationshipCount,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }));

      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('aria-labelledby="delete-person-title"');
      expect(markup).toContain('aria-describedby="delete-person-description"');
      expect(markup).toContain("¿Eliminar a Luis Alberto Ruiz Gómez?");
      expect(markup).toContain("eliminará permanentemente");
      expect(markup).toContain("Sus familiares permanecerán en el árbol");
      expect(markup).toContain("Esta acción no se puede deshacer");
      expect(markup).toContain(`Conexiones registradas: ${relationshipCount}`);
      expect(markup).toContain("conteo es informativo");
      expect(markup).toContain("Cancelar");
      expect(markup).toContain("Eliminar persona");
    }
  );

  it("cuenta relaciones incidentes en ambos extremos y conserva duplicados documentales", () => {
    const relationships = [
      relationship("from", "person", "child"),
      relationship("to", "parent", "person"),
      relationship("partner", "person", "partner", "PARTNER_OF"),
      relationship("duplicate", "person", "child"),
      relationship("unrelated", "other", "another"),
    ];
    expect(countIncidentRelationships(relationships, "person")).toBe(4);
    expect(countIncidentRelationships(relationships, "missing")).toBe(0);
  });

  it("construye el payload exacto sin datos protegidos ni relaciones", () => {
    const payload = buildDeletePersonPayload("tree", "person");
    expect(payload).toEqual({treeId: "tree", personId: "person"});
    expect(Object.keys(payload).sort()).toEqual(["personId", "treeId"]);
    expect(payload).not.toHaveProperty("ownerId");
    expect(payload).not.toHaveProperty("isRoot");
    expect(payload).not.toHaveProperty("relationshipIds");
    expect(payload).not.toHaveProperty("relationshipCount");
    expect(payload).not.toHaveProperty("expectedRelationshipCount");
    expect(payload).not.toHaveProperty("confirm");
  });

  it("llama una vez y ejecuta éxito solamente después de resolver", async () => {
    let resolveCall: (() => void) | undefined;
    const call = vi.fn(() => new Promise<void>((resolve) => {
      resolveCall = resolve;
    }));
    const onSuccess = vi.fn();
    const pending = submitDeletePerson({
      call,
      treeId: "tree",
      personId: "person",
      onSuccess,
    });

    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith({treeId: "tree", personId: "person"});
    expect(onSuccess).not.toHaveBeenCalled();
    resolveCall?.();
    await pending;
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("no ejecuta éxito ni mutaciones locales cuando falla", async () => {
    const onSuccess = vi.fn();
    await expect(submitDeletePerson({
      call: vi.fn().mockRejectedValue(new Error("failure")),
      treeId: "tree",
      personId: "person",
      onSuccess,
    })).rejects.toThrow("failure");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("bloquea doble submit sin depender del render asíncrono", () => {
    const gate = {current: false};
    expect(startDeleteSubmission(gate)).toBe(true);
    expect(startDeleteSubmission(gate)).toBe(false);
    finishDeleteSubmission(gate);
    expect(startDeleteSubmission(gate)).toBe(true);
  });

  it.each([
    ["functions/unauthenticated", undefined, "Tu sesión ya no es válida. Inicia sesión nuevamente."],
    ["functions/invalid-argument", undefined, "No pudimos identificar correctamente la persona."],
    ["functions/permission-denied", undefined, "No tienes permiso para eliminar esta persona."],
    ["functions/not-found", "person-not-found", "La persona ya no existe."],
    ["functions/not-found", "tree-not-found", "El árbol ya no existe."],
    ["functions/failed-precondition", "root-person-protected", "La persona principal del árbol no puede eliminarse."],
    ["functions/failed-precondition", "last-person-protected", "No puedes eliminar la última persona del árbol."],
    ["functions/failed-precondition", "inconsistent-tree-data", "No podemos eliminar esta persona porque el árbol contiene datos inconsistentes."],
    ["functions/resource-exhausted", "too-many-incident-relationships", "Esta persona tiene demasiadas conexiones para eliminarla desde esta operación."],
    ["functions/internal", undefined, "No pudimos eliminar la persona. Inténtalo nuevamente."],
    ["unknown", undefined, "No pudimos eliminar la persona. Inténtalo nuevamente."],
  ])("traduce %s/%s sin exponer el error crudo", (code, reason, message) => {
    const error = reason ? {code, details: {reason}} : {code};
    expect(deletePersonErrorMessage(error)).toBe(message);
  });
});
