import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  AUTHORIZED_MANUAL_REVIEW_TARGETS,
  buildManualReviewCsv,
  buildManualReviewMatrix,
  validateLocalEmulatorHost,
} from "./parent-role-manual-review.mjs";

const person = (id, firstName = id) => ({id, firstName});

const parent = (id, fromPersonId, toPersonId, parentRole) => {
  const value = {id, type: "PARENT_OF", fromPersonId, toPersonId};
  if (parentRole !== undefined) {
    value.parentRole = parentRole;
  }
  return value;
};

const buildValidTrees = () => {
  const trees = new Map();
  for (const item of AUTHORIZED_MANUAL_REVIEW_TARGETS) {
    if (!trees.has(item.treeId)) {
      trees.set(item.treeId, {
        treeId: item.treeId,
        exists: true,
        persons: [],
        relationships: [],
      });
    }
    const tree = trees.get(item.treeId);
    const parentId = `parent-${item.relationshipId}`;
    const childId = `child-${item.relationshipId}`;
    const supportChildId = `support-child-${item.relationshipId}`;
    tree.persons.push(
      person(parentId, item.expectedParentName),
      person(childId, item.expectedChildName),
      person(supportChildId, `Support ${item.relationshipId}`),
    );
    tree.relationships.push(
      parent(item.relationshipId, parentId, childId),
      parent(
        `support-${item.relationshipId}`,
        parentId,
        supportChildId,
        item.expectedCandidateRole,
      ),
    );
  }
  return structuredClone([...trees.values()]);
};

const targetCase = (matrix, relationshipId) =>
  matrix.cases.find((item) => item.relationshipId === relationshipId);

const firstTarget = AUTHORIZED_MANUAL_REVIEW_TARGETS[0];

const mutateFirstTree = (mutator) => {
  const trees = buildValidTrees();
  const tree = trees.find(({treeId}) => treeId === firstTarget.treeId);
  mutator(tree);
  return buildManualReviewMatrix({trees});
};

describe("matriz cerrada de revisión manual", () => {
  it("conserva exactamente 21 objetivos en orden determinista", () => {
    const first = buildManualReviewMatrix({trees: buildValidTrees()});
    const second = buildManualReviewMatrix({
      trees: buildValidTrees().reverse(),
    });
    assert.equal(first.cases.length, 21);
    assert.deepEqual(
      first.cases.map(({treeId, relationshipId}) => [treeId, relationshipId]),
      second.cases.map(({treeId, relationshipId}) => [treeId, relationshipId]),
    );
  });

  it("clasifica los casos válidos como ready-for-review", () => {
    const matrix = buildManualReviewMatrix({trees: buildValidTrees()});
    assert.equal(matrix.ok, true);
    assert.equal(matrix.summary.readyForReview, 21);
  });

  it("exige que parentRole continúe ausente", () => {
    const item = targetCase(
      buildManualReviewMatrix({trees: buildValidTrees()}),
      firstTarget.relationshipId,
    );
    assert.equal(item.currentParentRole, null);
    assert.ok(item.passedValidations.includes("parent-role-absent"));
  });

  it("marca una relación already-migrated como stale y no autorizada", () => {
    const matrix = mutateFirstTree((tree) => {
      tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      ).parentRole = firstTarget.expectedCandidateRole;
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.equal(item.currentStatus, "stale");
    assert.equal(item.classification, "already-migrated");
    assert.equal("wouldWrite" in item, false);
  });

  it("marca como conflict un candidato diferente del esperado", () => {
    const matrix = mutateFirstTree((tree) => {
      tree.relationships.find(
        ({id}) => id === `support-${firstTarget.relationshipId}`,
      ).parentRole = "mother";
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.equal(item.currentStatus, "conflict");
    assert.ok(item.failedValidations.some(
      ({code}) => code === "candidate-mismatch",
    ));
  });

  it("deriva father de evidencia explícita father consistente", () => {
    const item = targetCase(
      buildManualReviewMatrix({trees: buildValidTrees()}),
      firstTarget.relationshipId,
    );
    assert.equal(item.candidateParentRole, "father");
    assert.deepEqual(item.evidenceRoles, ["father"]);
  });

  it("deriva mother de evidencia explícita mother consistente", () => {
    const motherTarget = AUTHORIZED_MANUAL_REVIEW_TARGETS.find(
      ({expectedCandidateRole}) => expectedCandidateRole === "mother",
    );
    const item = targetCase(
      buildManualReviewMatrix({trees: buildValidTrees()}),
      motherTarget.relationshipId,
    );
    assert.equal(item.candidateParentRole, "mother");
    assert.deepEqual(item.evidenceRoles, ["mother"]);
  });

  it("marca conflict con evidencia father y mother de la misma persona", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      const childId = `opposite-child-${firstTarget.relationshipId}`;
      tree.persons.push(person(childId));
      tree.relationships.push(
        parent("opposite-history", reviewed.fromPersonId, childId, "mother"),
      );
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.equal(item.currentStatus, "conflict");
    assert.equal(item.oppositeRoleEvidenceFound, true);
  });

  it("marca ineligible cuando no existe evidencia explícita", () => {
    const matrix = mutateFirstTree((tree) => {
      tree.relationships = tree.relationships.filter(
        ({id}) => id !== `support-${firstTarget.relationshipId}`,
      );
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.equal(item.currentStatus, "ineligible");
    assert.equal(item.evidenceCount, 0);
  });

  it("marca stale una relación inexistente", () => {
    const matrix = mutateFirstTree((tree) => {
      tree.relationships = tree.relationships.filter(
        ({id}) => id !== firstTarget.relationshipId,
      );
    });
    assert.equal(
      targetCase(matrix, firstTarget.relationshipId).currentStatus,
      "stale",
    );
  });

  it("marca stale un árbol inexistente", () => {
    const trees = buildValidTrees();
    trees.find(({treeId}) => treeId === firstTarget.treeId).exists = false;
    assert.equal(
      targetCase(
        buildManualReviewMatrix({trees}),
        firstTarget.relationshipId,
      ).currentStatus,
      "stale",
    );
  });

  it("marca conflict una persona huérfana", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      tree.persons = tree.persons.filter(
        ({id}) => id !== reviewed.fromPersonId,
      );
    });
    assert.equal(
      targetCase(matrix, firstTarget.relationshipId).currentStatus,
      "conflict",
    );
  });

  it("marca conflict una arista duplicada", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      tree.relationships.push({...reviewed, id: "duplicate-edge"});
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.equal(item.currentStatus, "conflict");
    assert.ok(item.failedValidations.some(
      ({code}) => code === "duplicate-parent-edge",
    ));
  });

  it("marca conflict más de dos progenitores", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      for (const [index, role] of ["father", "mother"].entries()) {
        const id = `extra-parent-${index}`;
        tree.persons.push(person(id));
        tree.relationships.push(
          parent(`extra-edge-${index}`, id, reviewed.toPersonId, role),
        );
      }
    });
    assert.equal(
      targetCase(matrix, firstTarget.relationshipId).currentStatus,
      "conflict",
    );
  });

  it("marca conflict un rol parental duplicado", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      for (const index of [1, 2]) {
        const id = `duplicate-role-parent-${index}`;
        tree.persons.push(person(id));
        tree.relationships.push(
          parent(`duplicate-role-${index}`, id, reviewed.toPersonId, "father"),
        );
      }
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.ok(item.failedValidations.some(
      ({code}) => code === "duplicate-parent-role",
    ));
  });

  it("marca conflict una autorrelación", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      reviewed.toPersonId = reviewed.fromPersonId;
    });
    assert.equal(
      targetCase(matrix, firstTarget.relationshipId).currentStatus,
      "conflict",
    );
  });

  it("marca conflict una relación que participa en un ciclo", () => {
    const matrix = mutateFirstTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstTarget.relationshipId,
      );
      tree.relationships.push(
        parent(
          "reverse-cycle",
          reviewed.toPersonId,
          reviewed.fromPersonId,
          "mother",
        ),
      );
    });
    const item = targetCase(matrix, firstTarget.relationshipId);
    assert.ok(item.failedValidations.some(
      ({code}) => code === "cycle-detected",
    ));
  });

  it("mantiene null los cinco campos de decisión", () => {
    const matrix = buildManualReviewMatrix({trees: buildValidTrees()});
    for (const item of matrix.cases) {
      assert.equal(item.reviewDecision, null);
      assert.equal(item.confirmedParentRole, null);
      assert.equal(item.reviewedBy, null);
      assert.equal(item.reviewedAt, null);
      assert.equal(item.reviewNotes, null);
    }
  });

  it("escapa correctamente CSV con comas, comillas y saltos", () => {
    const matrix = buildManualReviewMatrix({trees: buildValidTrees()});
    matrix.cases[0].reviewNotes = 'uno, "dos"\\ntres';
    const csv = buildManualReviewCsv([matrix.cases[0]]);
    assert.match(csv, /"uno, ""dos""\\ntres"/);
  });

  it("no expone ownerId ni información Auth en JSON", () => {
    const serialized = JSON.stringify(
      buildManualReviewMatrix({trees: buildValidTrees()}),
    );
    assert.doesNotMatch(serialized, /ownerId|auth_export|passwordHash/i);
  });

  it("rechaza ausencia de FIRESTORE_EMULATOR_HOST antes de Firebase", () => {
    const result = validateLocalEmulatorHost(undefined);
    assert.equal(result.ok, false);
    assert.equal(result.code, "emulator-host-required");
    assert.match(result.message, /FIRESTORE_EMULATOR_HOST es obligatorio/);
  });

  it("rechaza un host no local", () => {
    const result = validateLocalEmulatorHost("firestore.googleapis.com:443");
    assert.equal(result.ok, false);
    assert.equal(result.code, "non-local-emulator-host");
  });

  it("no expone ningún método apply ni capacidad de escritura", async () => {
    const module = await import("./parent-role-manual-review.mjs");
    assert.equal(Object.keys(module).some((name) => /apply/i.test(name)), false);
    assert.equal(
      Object.keys(module).some((name) => /write|update|delete/i.test(name)),
      false,
    );
  });
});
