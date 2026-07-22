import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildExistingChildrenRolePayload,
  canSubmitPartnerWithExistingChildren,
  ExistingChildrenParentRoleField,
  toggleExistingChildSelection,
} from "./Stage4Panel";

describe("rol parental para hijos existentes", () => {
  it("muestra el selector sin preseleccionar padre ni madre", () => {
    const markup = renderToStaticMarkup(
      createElement(ExistingChildrenParentRoleField, {
        value: "",
        onChange: vi.fn(),
      })
    );

    expect(markup).toContain("Rol parental de la pareja");
    expect(markup).toContain("Selecciona un rol");
    expect(markup).toContain("Padre");
    expect(markup).toContain("Madre");
    expect(markup).toContain('<option value="" selected="">');
  });

  it("deshabilita conceptualmente Guardar con hijos y sin rol", () => {
    expect(canSubmitPartnerWithExistingChildren(true, ["child"], "")).toBe(false);
  });

  it.each(["father", "mother"] as const)(
    "habilita Guardar con hijos y rol %s",
    (parentRole) => {
      expect(
        canSubmitPartnerWithExistingChildren(true, ["child"], parentRole)
      ).toBe(true);
    }
  );

  it("mantiene habilitado el flujo sin hijos aunque no haya rol", () => {
    expect(canSubmitPartnerWithExistingChildren(true, [], "")).toBe(true);
  });

  it.each(["father", "mother"] as const)(
    "incluye parentRoleForExistingChildren=%s en el payload",
    (parentRole) => {
      expect(buildExistingChildrenRolePayload(["child"], parentRole)).toEqual({
        parentRoleForExistingChildren: parentRole,
      });
    }
  );

  it("no envía el campo de rol cuando no hay hijos", () => {
    expect(buildExistingChildrenRolePayload([], "")).toEqual({});
  });

  it("indica limpiar el rol al desmarcar el último hijo", () => {
    expect(toggleExistingChildSelection(["child"], "child")).toEqual({
      selectedChildIds: [],
      shouldClearParentRole: true,
    });
  });
});
