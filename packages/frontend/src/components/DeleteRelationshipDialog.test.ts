import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import type {Person, Relationship} from "../types/family";
import DeleteRelationshipDialog from "./DeleteRelationshipDialog";
import deleteRelationshipDialogSource from "./DeleteRelationshipDialog.tsx?raw";
import {
  buildDeleteRelationshipPayload,
  buildIncidentRelationshipPresentations,
  deleteRelationshipErrorMessage,
  submitDeleteRelationship,
  type RelationshipPresentation,
} from "./DeleteRelationshipDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

const persons: Person[] = [
  {id: "father", firstName: "Luis", lastName: "Ruiz"},
  {id: "mother", firstName: "Ana", lastName: "Pérez"},
  {id: "child", firstName: "Sofía", lastName: "Ruiz"},
  {id: "partner", firstName: "Marta", lastName: "López"},
  {id: "other", firstName: "Otro", lastName: "Miembro"},
];

const relationship = (
  id: string,
  type: Relationship["type"],
  fromPersonId: string,
  toPersonId: string,
  extra: Partial<Relationship> = {}
): Relationship => ({id, type, fromPersonId, toPersonId, ...extra});

function presentations(activePersonId: string, relationships: Relationship[]) {
  const activePerson = persons.find((person) => person.id === activePersonId)!;
  return buildIncidentRelationshipPresentations(
    activePerson,
    persons,
    relationships
  );
}

describe("listado de relaciones incidentes", () => {
  it("devuelve estado vacío y excluye relaciones ajenas", () => {
    const unrelated = relationship(
      "unrelated", "PARENT_OF", "other", "partner"
    );
    expect(presentations("child", [unrelated])).toEqual([]);
  });

  it("muestra ambos extremos, pareja y múltiples documentos", () => {
    const result = presentations("child", [
      relationship("father-link", "PARENT_OF", "father", "child", {
        parentRole: "father",
      }),
      relationship("child-link", "PARENT_OF", "child", "other", {
        parentRole: "mother",
      }),
      relationship("partner-link", "PARTNER_OF", "child", "partner"),
      relationship("unrelated", "PARENT_OF", "other", "partner"),
    ]);
    expect(result.map((item) => item.relationshipId)).toEqual([
      "father-link", "partner-link", "child-link",
    ]);
  });

  it("conserva duplicados como filas identificadas por documento", () => {
    const duplicate = relationship(
      "rel-a", "PARENT_OF", "father", "child", {parentRole: "father"}
    );
    const result = presentations("father", [
      duplicate,
      {...duplicate, id: "rel-b"},
    ]);
    expect(result.map((item) => item.relationshipId)).toEqual([
      "rel-a", "rel-b",
    ]);
  });

  it("representa defensivamente una persona ausente sin ocultar la fila", () => {
    const result = presentations("child", [
      relationship("orphan", "PARENT_OF", "missing", "child"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Hijo/a de Persona no disponible");
  });

  it.each([
    ["father", "child", "father", "Padre de Sofía Ruiz"],
    ["mother", "child", "mother", "Madre de Sofía Ruiz"],
    ["father", "child", undefined, "Progenitor de Sofía Ruiz"],
  ] as const)("etiqueta progenitor role=%s", (
    fromPersonId, toPersonId, parentRole, expected
  ) => {
    const result = presentations(fromPersonId, [relationship(
      "link", "PARENT_OF", fromPersonId, toPersonId, {parentRole}
    )]);
    expect(result[0].label).toBe(expected);
  });

  it.each([
    ["father", "father", "Hijo/a de Luis Ruiz"],
    ["mother", "mother", "Hijo/a de Ana Pérez"],
    [undefined, "father", "Hijo/a de Luis Ruiz"],
  ] as const)("etiqueta hijo role=%s", (parentRole, parentId, expected) => {
    const result = presentations("child", [relationship(
      "link", "PARENT_OF", parentId, "child", {parentRole}
    )]);
    expect(result[0].label).toBe(expected);
  });

  it.each([
    ["current", "Actual"],
    ["former", "Anterior"],
    ["unknown", "Estado desconocido"],
    [undefined, "Estado desconocido"],
  ] as const)("etiqueta pareja status=%s", (status, expected) => {
    const result = presentations("father", [relationship(
      "partner-link", "PARTNER_OF", "father", "partner", {
        relationshipStatus: status,
      }
    )]);
    expect(result[0].label).toBe("Pareja de Marta López");
    expect(result[0].statusLabel).toBe(expected);
  });

  it("actualiza el listado según la persona activa", () => {
    const relationships = [
      relationship("father-child", "PARENT_OF", "father", "child"),
      relationship("mother-child", "PARENT_OF", "mother", "child"),
    ];
    expect(presentations("father", relationships).map((item) => item.relationshipId))
      .toEqual(["father-child"]);
    expect(presentations("mother", relationships).map((item) => item.relationshipId))
      .toEqual(["mother-child"]);
  });
});

describe("DeleteRelationshipDialog", () => {
  const parentPresentation: RelationshipPresentation = {
    relationshipId: "parent-link",
    type: "PARENT_OF",
    label: "Padre de Sofía Ruiz",
    title: "¿Quitar a Luis Ruiz como padre de Sofía Ruiz?",
    parentName: "Luis Ruiz",
    childName: "Sofía Ruiz",
  };
  const partnerPresentation: RelationshipPresentation = {
    relationshipId: "partner-link",
    type: "PARTNER_OF",
    label: "Pareja de Marta López",
    title: "¿Quitar la relación de pareja entre Luis Ruiz y Marta López?",
    partnerAName: "Luis Ruiz",
    partnerBName: "Marta López",
  };

  it("renderiza confirmación parental accesible y completa", () => {
    const markup = renderToStaticMarkup(createElement(
      DeleteRelationshipDialog,
      {relationship: parentPresentation, onCancel: vi.fn(), onConfirm: vi.fn()}
    ));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="delete-relationship-title"');
    expect(markup).toContain("¿Quitar a Luis Ruiz como padre de Sofía Ruiz?");
    expect(markup).toContain("Ninguna persona será eliminada");
    expect(markup).toContain("seguirán perteneciendo al árbol");
    expect(markup).toContain("No se reasignará automáticamente");
    expect(markup).toContain("Quitar relación");
    expect(markup).toContain("Cancelar");
  });

  it("renderiza confirmación de pareja sin ofrecer editar status", () => {
    const markup = renderToStaticMarkup(createElement(
      DeleteRelationshipDialog,
      {relationship: partnerPresentation, onCancel: vi.fn(), onConfirm: vi.fn()}
    ));
    expect(markup).toContain(partnerPresentation.title);
    expect(markup).toContain("relaciones parentales con sus hijos permanecerán");
    expect(markup).toContain("seguir apareciendo como coprogenitores");
    expect(markup).toContain("No se cambia el estado de la relación");
    expect(markup).not.toContain("Cambiar estado");
  });

  it("mantiene nombres parentales aunque la persona activa fuera el hijo", () => {
    const result = presentations("child", [relationship(
      "link", "PARENT_OF", "father", "child", {parentRole: "father"}
    )]);
    expect(result[0].title).toBe(
      "¿Quitar a Luis Ruiz como padre de Sofía Ruiz?"
    );
  });

  it("construye títulos mother e histórico", () => {
    const mother = presentations("child", [relationship(
      "mother", "PARENT_OF", "mother", "child", {parentRole: "mother"}
    )])[0];
    const historical = presentations("child", [relationship(
      "historical", "PARENT_OF", "father", "child"
    )])[0];
    expect(mother.title).toBe("¿Quitar a Ana Pérez como madre de Sofía Ruiz?");
    expect(historical.title).toBe(
      "¿Quitar la relación parental entre Luis Ruiz y Sofía Ruiz?"
    );
  });

  it("declara loading, botones bloqueados y cierre seguro por Escape", () => {
    expect(deleteRelationshipDialogSource).toContain(
      '{submitting ? "Quitando..." : "Quitar relación"}'
    );
    expect(
      deleteRelationshipDialogSource.match(/disabled=\{submitting\}/g)
    ).toHaveLength(2);
    expect(deleteRelationshipDialogSource).toContain(
      'event.key === "Escape" && !submitting'
    );
    expect(deleteRelationshipDialogSource).toContain(
      "startDeleteSubmission(submissionGateRef)"
    );
  });
});

describe("submit y errores", () => {
  it("envía exclusivamente treeId y relationshipId", async () => {
    const call = vi.fn().mockResolvedValue({data: {ok: true}});
    const onSuccess = vi.fn();
    await submitDeleteRelationship({
      call,
      treeId: "tree",
      relationshipId: "relationship",
      onSuccess,
    });
    const payload = buildDeleteRelationshipPayload("tree", "relationship");
    expect(call).toHaveBeenCalledWith(payload);
    expect(payload).toEqual({treeId: "tree", relationshipId: "relationship"});
    expect(Object.keys(payload).sort()).toEqual(["relationshipId", "treeId"]);
    [
      "fromPersonId", "toPersonId", "type", "parentRole",
      "relationshipStatus", "ownerId",
    ].forEach((field) => expect(payload).not.toHaveProperty(field));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("no ejecuta éxito ni muta colecciones cuando falla", async () => {
    const onSuccess = vi.fn();
    await expect(submitDeleteRelationship({
      call: vi.fn().mockRejectedValue(new Error("failure")),
      treeId: "tree",
      relationshipId: "relationship",
      onSuccess,
    })).rejects.toThrow("failure");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reutiliza la guardia sincrónica contra doble submit", () => {
    const gate = {current: false};
    expect(startDeleteSubmission(gate)).toBe(true);
    expect(startDeleteSubmission(gate)).toBe(false);
    finishDeleteSubmission(gate);
    expect(startDeleteSubmission(gate)).toBe(true);
  });

  it.each([
    ["functions/unauthenticated", undefined, "Tu sesión ya no es válida. Inicia sesión nuevamente."],
    ["functions/invalid-argument", undefined, "No pudimos identificar correctamente la relación."],
    ["functions/permission-denied", undefined, "No tienes permiso para modificar esta relación."],
    ["functions/not-found", "relationship-not-found", "Esta relación ya no existe."],
    ["functions/not-found", "tree-not-found", "El árbol ya no existe."],
    ["functions/failed-precondition", "inconsistent-tree-data", "No podemos quitar esta relación porque contiene datos inconsistentes."],
    ["functions/internal", undefined, "No pudimos quitar la relación. Inténtalo nuevamente."],
    ["unknown", undefined, "No pudimos quitar la relación. Inténtalo nuevamente."],
  ])("traduce %s/%s", (code, reason, expected) => {
    const error = reason ? {code, details: {reason}} : {code};
    expect(deleteRelationshipErrorMessage(error)).toBe(expected);
  });
});
