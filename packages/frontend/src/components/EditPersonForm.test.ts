import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));
vi.mock("../lib/firebase", () => ({functions: {}}));

import EditPersonForm from "./EditPersonForm";
import {
  buildUpdatePersonPayload,
  editPersonSchema,
  personToEditValues,
  submitPersonUpdate,
  updatePersonErrorMessage,
} from "./EditPersonForm.logic";
import type { Person } from "../types/family";

const rootPerson: Person = {
  id: "root",
  firstName: "Ana",
  middleName: "María",
  lastName: "Pérez",
  secondLastName: "Gómez",
  birthDate: "1990-01-02",
  birthPlace: "Bogotá",
  isRoot: true,
};

describe("EditPersonForm", () => {
  it.each([true, false])("renderiza la edición para persona raíz y no raíz", (isRoot) => {
    const markup = renderToStaticMarkup(createElement(EditPersonForm, {
      treeId: "tree",
      person: {...rootPerson, isRoot},
      onCancel: vi.fn(),
      onSaved: vi.fn(),
      updatePersonCall: vi.fn(),
    }));

    expect(markup).toContain("Editar información");
    expect(markup).toContain("Guardar cambios");
    expect(markup).toContain("Cancelar");
  });

  it("precarga los seis campos de la persona seleccionada", () => {
    expect(personToEditValues(rootPerson)).toEqual({
      firstName: "Ana",
      middleName: "María",
      lastName: "Pérez",
      secondLastName: "Gómez",
      birthDate: "1990-01-02",
      birthPlace: "Bogotá",
    });
  });

  it("renderiza labels asociados, botones accesibles y Guardar inicialmente deshabilitado", () => {
    const markup = renderToStaticMarkup(createElement(EditPersonForm, {
      treeId: "tree",
      person: rootPerson,
      onCancel: vi.fn(),
      onSaved: vi.fn(),
      updatePersonCall: vi.fn(),
    }));

    for (const label of [
      "Nombre",
      "Segundo nombre",
      "Apellido",
      "Segundo apellido",
      "Fecha de nacimiento",
      "Lugar de nacimiento",
    ]) expect(markup).toContain(label);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('type="submit"');
    expect(markup).toMatch(/type="submit"[^>]*disabled/);
  });

  it("usa valores vacíos para opcionales y no reutiliza otra persona", () => {
    expect(personToEditValues({
      id: "other",
      firstName: "Luis",
      lastName: "Ruiz",
    })).toEqual({
      firstName: "Luis",
      middleName: "",
      lastName: "Ruiz",
      secondLastName: "",
      birthDate: "",
      birthPlace: "",
    });
  });

  it.each([
    [{firstName: "", lastName: "Pérez"}, "firstName"],
    [{firstName: "Ana", lastName: "   "}, "lastName"],
  ])("exige nombre y apellido", (data, field) => {
    const result = editPersonSchema.safeParse({
      middleName: "",
      secondLastName: "",
      birthDate: "",
      birthPlace: "",
      ...data,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toContain(field);
  });

  it("normaliza espacios y permite vaciar opcionales", () => {
    expect(editPersonSchema.parse({
      firstName: "  Ana  ",
      middleName: "   ",
      lastName: "  Pérez  ",
      secondLastName: "   ",
      birthDate: " ",
      birthPlace: "   ",
    })).toEqual({
      firstName: "Ana",
      middleName: "",
      lastName: "Pérez",
      secondLastName: "",
      birthDate: "",
      birthPlace: "",
    });
  });

  it("construye el contrato exacto sin campos protegidos ni relaciones", () => {
    const malicious = {
      ...personToEditValues(rootPerson),
      ownerId: "attacker",
      isRoot: false,
      createdAt: "bad",
      updatedAt: "bad",
      relationships: [{id: "bad"}],
      treeId: "bad",
    };
    expect(buildUpdatePersonPayload("tree", "root", malicious)).toEqual({
      treeId: "tree",
      personId: "root",
      personData: {
        firstName: "Ana",
        middleName: "María",
        lastName: "Pérez",
        secondLastName: "Gómez",
        birthDate: "1990-01-02",
        birthPlace: "Bogotá",
      },
    });
  });

  it("llama updatePerson una vez y cierra solo después del éxito", async () => {
    const call = vi.fn().mockResolvedValue({data: {ok: true, personId: "root"}});
    const onSaved = vi.fn();
    await submitPersonUpdate({
      call,
      treeId: "tree",
      personId: "root",
      data: personToEditValues(rootPerson),
      onSaved,
    });

    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith(buildUpdatePersonPayload(
      "tree",
      "root",
      personToEditValues(rootPerson)
    ));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("mantiene abierto el flujo si updatePerson falla", async () => {
    const onSaved = vi.fn();
    await expect(submitPersonUpdate({
      call: vi.fn().mockRejectedValue(new Error("failure")),
      treeId: "tree",
      personId: "root",
      data: personToEditValues(rootPerson),
      onSaved,
    })).rejects.toThrow("failure");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    ["functions/permission-denied", "No tienes permiso para editar esta persona."],
    ["functions/not-found", "La persona ya no existe."],
    ["functions/unauthenticated", "Tu sesión ya no es válida. Inicia sesión nuevamente."],
    ["functions/invalid-argument", "Revisa los datos obligatorios."],
    ["functions/internal", "No pudimos guardar los cambios. Inténtalo nuevamente."],
  ])("traduce el error %s al español", (code, message) => {
    expect(updatePersonErrorMessage({code})).toBe(message);
  });

  it("no invoca creación, eliminación ni funciones de relaciones", async () => {
    const callableNames: string[] = [];
    await submitPersonUpdate({
      call: vi.fn(async () => {
        callableNames.push("updatePerson");
      }),
      treeId: "tree",
      personId: "root",
      data: personToEditValues(rootPerson),
      onSaved: vi.fn(),
    });
    expect(callableNames).toEqual(["updatePerson"]);
  });
});
