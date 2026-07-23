import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {auditTreeParentRoles} from "./parent-role-audit.mjs";

const person = (id) => ({id, firstName: id});
const parent = (id, fromPersonId, toPersonId, parentRoleMarker) => {
  const relationship = {
    id,
    type: "PARENT_OF",
    fromPersonId,
    toPersonId,
  };
  if (parentRoleMarker !== undefined) {
    relationship.parentRole = parentRoleMarker;
  }
  return relationship;
};

const audit = (relationships, personIds = ["a", "b", "c", "d"]) =>
  auditTreeParentRoles({
    treeId: "tree",
    persons: personIds.map(person),
    relationships,
  });

describe("auditTreeParentRoles", () => {
  it("clasifica father y mother válidos", () => {
    const records = audit([
      parent("r1", "a", "c", "father"),
      parent("r2", "b", "c", "mother"),
    ]);

    assert.deepEqual(
      records.map(({classification}) => classification),
      ["valid-role", "valid-role"],
    );
  });

  it("deduce father únicamente como complemento de mother", () => {
    const records = audit([
      parent("missing", "a", "c"),
      parent("explicit", "b", "c", "mother"),
    ]);
    const missing = records.find(({relationshipId}) => relationshipId === "missing");

    assert.equal(missing.classification, "missing-role-deterministic-complement");
    assert.equal(missing.candidateParentRole, "father");
    assert.equal(missing.requiresManualConfirmation, false);
  });

  it("deduce mother únicamente como complemento de father", () => {
    const records = audit([
      parent("missing", "a", "c"),
      parent("explicit", "b", "c", "father"),
    ]);
    const missing = records.find(({relationshipId}) => relationshipId === "missing");

    assert.equal(missing.classification, "missing-role-deterministic-complement");
    assert.equal(missing.candidateParentRole, "mother");
  });

  it("mantiene ambiguos dos progenitores sin rol", () => {
    const records = audit([
      parent("r1", "a", "c"),
      parent("r2", "b", "c"),
    ]);

    assert.ok(
      records.every(
        ({classification}) =>
          classification === "missing-role-ambiguous-multiple-unknown",
      ),
    );
    assert.ok(records.every(({candidateParentRole}) => candidateParentRole === null));
  });

  it("mantiene ambiguo un progenitor único sin rol", () => {
    const [record] = audit([parent("r1", "a", "c")]);

    assert.equal(record.classification, "missing-role-ambiguous-single-parent");
    assert.equal(record.candidateParentRole, null);
  });

  it("clasifica como inválidos null, vacío, parent y unknown", () => {
    for (const invalidRole of [null, "", "parent", "unknown"]) {
      const [record] = audit([parent("r1", "a", "c", invalidRole)]);
      assert.equal(record.classification, "invalid-role");
      assert.equal(record.parentRoleOriginal, invalidRole);
    }
  });

  it("detecta dos fathers como rol parental duplicado", () => {
    const records = audit([
      parent("r1", "a", "c", "father"),
      parent("r2", "b", "c", "father"),
    ]);

    assert.ok(records.every(({flags}) => flags.includes("duplicate-parent-role")));
    assert.ok(
      records.every(({classification}) => classification === "duplicate-parent-role"),
    );
  });

  it("detecta dos mothers como rol parental duplicado", () => {
    const records = audit([
      parent("r1", "a", "c", "mother"),
      parent("r2", "b", "c", "mother"),
    ]);

    assert.ok(records.every(({flags}) => flags.includes("duplicate-parent-role")));
  });

  it("detecta tres progenitores distintos", () => {
    const records = audit(
      [
        parent("r1", "a", "d", "father"),
        parent("r2", "b", "d", "mother"),
        parent("r3", "c", "d"),
      ],
      ["a", "b", "c", "d"],
    );

    assert.ok(records.every(({flags}) => flags.includes("too-many-parents")));
    assert.ok(records.every(({classification}) => classification === "too-many-parents"));
  });

  it("detecta documentos duplicados para el mismo vínculo", () => {
    const records = audit([
      parent("r1", "a", "c", "father"),
      parent("r2", "a", "c", "father"),
    ]);

    assert.ok(records.every(({flags}) => flags.includes("duplicate-parent-edge")));
  });

  it("detecta referencias a personas inexistentes", () => {
    const [record] = audit(
      [parent("r1", "missing", "c", "father")],
      ["c"],
    );

    assert.equal(record.classification, "orphan-reference");
    assert.ok(record.flags.includes("orphan-reference"));
    assert.equal(record.parentName, null);
  });

  it("detecta autorrelaciones parentales", () => {
    const [record] = audit([parent("r1", "a", "a", "father")], ["a"]);

    assert.equal(record.classification, "self-parent-link");
    assert.ok(record.flags.includes("cycle-detected"));
  });

  it("detecta todas las aristas que participan en un ciclo", () => {
    const records = audit([
      parent("r1", "a", "b", "father"),
      parent("r2", "b", "c", "father"),
      parent("r3", "c", "a", "father"),
    ]);

    assert.ok(records.every(({flags}) => flags.includes("cycle-detected")));
    assert.ok(records.every(({classification}) => classification === "cycle-detected"));
  });

  it("sugiere historial consistente solo para revisión manual", () => {
    const records = audit([
      parent("history", "a", "c", "father"),
      parent("missing", "a", "d"),
    ]);
    const missing = records.find(({relationshipId}) => relationshipId === "missing");

    assert.equal(
      missing.classification,
      "missing-role-consistent-parent-history",
    );
    assert.equal(missing.candidateParentRole, "father");
    assert.equal(missing.requiresManualConfirmation, true);
    assert.deepEqual(missing.supportingRelationships, [
      {relationshipId: "history", childId: "c", parentRole: "father"},
    ]);
  });
});
