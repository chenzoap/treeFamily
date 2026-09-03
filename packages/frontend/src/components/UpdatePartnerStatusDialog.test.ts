import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import type {Person, Relationship} from "../types/family";
import UpdatePartnerStatusDialog from "./UpdatePartnerStatusDialog";
import dialogSource from "./UpdatePartnerStatusDialog.tsx?raw";
import {
  buildUpdatePartnerStatusPayload,
  buildUpdatePartnerStatusTarget,
  canSubmitPartnerStatus,
  normalizePartnerStatus,
  partnerStatusLabel,
  partnerStatusOptions,
  submitUpdatePartnerStatus,
  updatePartnerStatusErrorMessage,
  type UpdatePartnerStatusTarget,
} from "./UpdatePartnerStatusDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

const persons: Person[] = [
  {id: "root", firstName: "Ana", lastName: "Pérez", isRoot: true},
  {id: "partner", firstName: "Luis", middleName: "José", lastName: "Ruiz"},
];

function relationship(
  status?: Relationship["relationshipStatus"]
): Relationship {
  return {
    id: "partner-link",
    type: "PARTNER_OF",
    fromPersonId: "root",
    toPersonId: "partner",
    ...(status ? {relationshipStatus: status} : {}),
  };
}

function target(
  status?: Relationship["relationshipStatus"],
  activePerson = persons[0]
): UpdatePartnerStatusTarget {
  return buildUpdatePartnerStatusTarget({
    relationship: relationship(status),
    activePerson,
    persons,
  })!;
}

function renderDialog(dialogTarget: UpdatePartnerStatusTarget) {
  return renderToStaticMarkup(createElement(UpdatePartnerStatusDialog, {
    treeId: "tree",
    target: dialogTarget,
    call: vi.fn(),
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  }));
}

describe("target y estados de pareja", () => {
  it.each([
    ["current", "current", "Actual"],
    ["former", "former", "Anterior"],
    ["unknown", "unknown", "Estado desconocido"],
    [undefined, "unknown", "Estado desconocido"],
  ] as const)("normaliza %s como %s", (stored, normalized, label) => {
    expect(normalizePartnerStatus(stored)).toBe(normalized);
    expect(partnerStatusLabel(normalized)).toBe(label);
    expect(target(stored).expectedRelationshipStatus).toBe(normalized);
  });

  it("no normaliza un valor runtime corrupto", () => {
    expect(normalizePartnerStatus("married")).toBeNull();
    expect(buildUpdatePartnerStatusTarget({
      relationship: {
        ...relationship(),
        relationshipStatus: "married",
      } as unknown as Relationship,
      activePerson: persons[0],
      persons,
    })).toBeNull();
  });

  it("captura identidad, nombres y expected desde endpoint from", () => {
    expect(target("current")).toEqual({
      relationshipId: "partner-link",
      activePersonId: "root",
      activePersonName: "Ana Pérez",
      otherPersonId: "partner",
      otherPersonName: "Luis José Ruiz",
      expectedRelationshipStatus: "current",
    });
  });

  it("resuelve simétricamente el endpoint to", () => {
    const result = target("former", persons[1]);
    expect(result.activePersonId).toBe("partner");
    expect(result.otherPersonId).toBe("root");
    expect(result.otherPersonName).toBe("Ana Pérez");
  });

  it("rechaza target PARENT_OF", () => {
    expect(buildUpdatePartnerStatusTarget({
      relationship: {...relationship(), type: "PARENT_OF"},
      activePerson: persons[0],
      persons,
    })).toBeNull();
  });

  it("mantiene exactamente las opciones y values contractuales", () => {
    expect(partnerStatusOptions).toEqual([
      {value: "current", label: "Actual"},
      {value: "former", label: "Anterior"},
      {value: "unknown", label: "Estado desconocido"},
    ]);
  });
});

describe("same status y payload", () => {
  it.each(["current", "former", "unknown"] as const)(
    "deshabilita same-status inicial %s",
    (status) => {
      expect(canSubmitPartnerStatus(target(status), status)).toBe(false);
      expect(canSubmitPartnerStatus(
        target(status), status === "current" ? "former" : "current"
      )).toBe(true);
    }
  );

  it("histórico inicia unknown y no puede guardar sin cambio", () => {
    const historical = target();
    expect(historical.expectedRelationshipStatus).toBe("unknown");
    expect(canSubmitPartnerStatus(historical, "unknown")).toBe(false);
  });

  it("volver al estado inicial vuelve a deshabilitar", () => {
    const current = target("current");
    expect(canSubmitPartnerStatus(current, "former")).toBe(true);
    expect(canSubmitPartnerStatus(current, "current")).toBe(false);
  });

  it("construye payload exacto de cuatro campos", () => {
    const payload = buildUpdatePartnerStatusPayload({
      treeId: "tree",
      target: target("current"),
      relationshipStatus: "former",
    });
    expect(payload).toEqual({
      treeId: "tree",
      relationshipId: "partner-link",
      relationshipStatus: "former",
      expectedRelationshipStatus: "current",
    });
    expect(Object.keys(payload)).toHaveLength(4);
    [
      "fromPersonId", "toPersonId", "otherPersonId", "ownerId", "createdAt",
      "updatedAt", "relationship", "expectedUpdatedAt", "type",
    ].forEach((field) => expect(payload).not.toHaveProperty(field));
  });

  it.each(["current", "former"] as const)(
    "histórico → %s envía expected unknown",
    (relationshipStatus) => {
      expect(buildUpdatePartnerStatusPayload({
        treeId: "tree",
        target: target(),
        relationshipStatus,
      })).toEqual({
        treeId: "tree",
        relationshipId: "partner-link",
        relationshipStatus,
        expectedRelationshipStatus: "unknown",
      });
    }
  );

  it("target capturado no cambia al mutar el snapshot original", () => {
    const source = relationship("current");
    const captured = buildUpdatePartnerStatusTarget({
      relationship: source,
      activePerson: persons[0],
      persons,
    })!;
    source.id = "new-link";
    source.relationshipStatus = "former";
    expect(captured.relationshipId).toBe("partner-link");
    expect(captured.expectedRelationshipStatus).toBe("current");
    expect(captured.otherPersonName).toBe("Luis José Ruiz");
  });
});

describe("UpdatePartnerStatusDialog", () => {
  it.each([
    ["current", "Actual"],
    ["former", "Anterior"],
    ["unknown", "Estado desconocido"],
    [undefined, "Estado desconocido"],
  ] as const)("preselecciona %s y muestra %s", (status, label) => {
    const markup = renderDialog(target(status));
    expect(markup).toContain(`Estado actual: ${label}`);
    expect(markup).toContain(`value="${status ?? "unknown"}" selected=""`);
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>Cambiar estado<\/button>/
    );
  });

  it("es accesible, nombra a la otra persona y enfoca Cancelar", () => {
    const markup = renderDialog(target("current"));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="update-partner-status-title"');
    expect(markup).toContain('aria-describedby="update-partner-status-description"');
    expect(markup).toContain("Cambiar estado de relación con Luis José Ruiz");
    expect(dialogSource).toContain("cancelButtonRef.current?.focus()");
  });

  it("explica preservación sin afirmar eliminación ni cambio parental", () => {
    const markup = renderDialog(target("current"));
    expect(markup).toContain("Ninguna persona será eliminada");
    expect(markup).toContain("relación de pareja continuará existiendo");
    expect(markup).toContain("relaciones parentales y los hijos no cambiarán");
    expect(markup).toContain("seguirá apareciendo como relación de pareja");
    expect(markup).toContain("no modifica la cuenta ni la autenticación");
    expect(markup).not.toContain("se eliminará esta relación de pareja");
  });

  it("usa guardia sincrónica, loading y Escape seguro", () => {
    const gate = {current: false};
    expect(startDeleteSubmission(gate)).toBe(true);
    expect(startDeleteSubmission(gate)).toBe(false);
    finishDeleteSubmission(gate);
    expect(dialogSource).toContain('{submitting ? "Cambiando..."');
    expect(dialogSource.match(/disabled=\{submitting\}/g)).toHaveLength(2);
    expect(dialogSource).toContain("disabled={submitting || !canSubmit}");
    expect(dialogSource).toContain(
      'event.key === "Escape" && !submitting'
    );
  });
});

describe("submit y errores", () => {
  it("llama una vez con payload congelado y ejecuta éxito al resolver", async () => {
    const call = vi.fn().mockResolvedValue({data: {
      ok: true, relationshipId: "partner-link",
    }});
    const onSuccess = vi.fn();
    const payload = buildUpdatePartnerStatusPayload({
      treeId: "tree",
      target: target("current"),
      relationshipStatus: "former",
    });
    await submitUpdatePartnerStatus({call, payload, onSuccess});
    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith(payload);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("éxito convergente backend usa el mismo flujo normal", async () => {
    const onSuccess = vi.fn();
    await submitUpdatePartnerStatus({
      call: vi.fn().mockResolvedValue({data: {
        ok: true, relationshipId: "partner-link",
      }}),
      payload: buildUpdatePartnerStatusPayload({
        treeId: "tree",
        target: target("current"),
        relationshipStatus: "former",
      }),
      onSuccess,
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("error preserva flujo abierto al no ejecutar onSuccess", async () => {
    const onSuccess = vi.fn();
    await expect(submitUpdatePartnerStatus({
      call: vi.fn().mockRejectedValue(new Error("failure")),
      payload: buildUpdatePartnerStatusPayload({
        treeId: "tree",
        target: target("current"),
        relationshipStatus: "former",
      }),
      onSuccess,
    })).rejects.toThrow("failure");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ["functions/unauthenticated", "", "Tu sesión ya no es válida. Inicia sesión nuevamente."],
    ["functions/invalid-argument", "invalid-tree-id", "No pudimos identificar correctamente la relación."],
    ["functions/invalid-argument", "invalid-relationship-id", "No pudimos identificar correctamente la relación."],
    ["functions/invalid-argument", "invalid-relationship-status", "Selecciona un estado de relación válido."],
    ["functions/invalid-argument", "invalid-expected-relationship-status", "El estado original de la relación no es válido. Cierra y vuelve a abrir esta edición."],
    ["functions/not-found", "tree-not-found", "El árbol ya no existe."],
    ["functions/permission-denied", "not-tree-owner", "No tienes permiso para modificar este árbol."],
    ["functions/not-found", "relationship-not-found", "Esta relación de pareja ya no existe."],
    ["functions/failed-precondition", "relationship-not-partner", "La relación seleccionada ya no es una relación de pareja válida."],
    ["functions/failed-precondition", "inconsistent-tree-data", "No podemos cambiar este estado porque el árbol contiene datos inconsistentes."],
    ["functions/failed-precondition", "duplicate-partner-link", "Esta relación de pareja está duplicada y debe corregirse antes de cambiar su estado."],
    ["functions/failed-precondition", "relationship-status-changed", "La relación cambió en otra sesión. Revisa el estado actual antes de intentarlo nuevamente."],
    ["functions/internal", "", "No pudimos cambiar el estado de la relación. Inténtalo nuevamente."],
    ["unknown", "", "No pudimos cambiar el estado de la relación. Inténtalo nuevamente."],
  ])("traduce %s/%s", (code, reason, expected) => {
    const error = reason ? {code, details: {reason}} : {code};
    expect(updatePartnerStatusErrorMessage(error)).toBe(expected);
  });

  it("stale no cambia target ni reintenta automáticamente", async () => {
    const captured = target("current");
    const call = vi.fn().mockRejectedValue({
      code: "functions/failed-precondition",
      details: {reason: "relationship-status-changed"},
    });
    await expect(submitUpdatePartnerStatus({
      call,
      payload: buildUpdatePartnerStatusPayload({
        treeId: "tree",
        target: captured,
        relationshipStatus: "unknown",
      }),
      onSuccess: vi.fn(),
    })).rejects.toBeTruthy();
    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0][0]).toMatchObject({
      relationshipStatus: "unknown",
      expectedRelationshipStatus: "current",
    });
    expect(captured.expectedRelationshipStatus).toBe("current");
  });
});
