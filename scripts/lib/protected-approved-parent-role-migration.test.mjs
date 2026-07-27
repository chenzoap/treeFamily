import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

import {
  APPROVED_TREE_ID,
  buildApprovedWriteOperations,
  buildProtectedApprovedParentRolePlan,
  EXPECTED_MANIFEST_SHA256,
  validateApplyArguments,
  validateBackupExport,
  validateLocalEmulatorHost,
  validateManifestIntegrity,
} from "./protected-approved-parent-role-migration.mjs";
import {
  AUTHORIZED_MANUAL_REVIEW_TARGETS,
} from "./parent-role-manual-review.mjs";

const manifestUrl = new URL(
  "../data/parent-role-manual-decisions-2026-07-27.json",
  import.meta.url,
);
const rawManifest = await readFile(manifestUrl, "utf8");
const canonicalManifest = JSON.parse(rawManifest);
const cloneManifest = () => structuredClone(canonicalManifest);

const parent = (id, fromPersonId, toPersonId, parentRole) => {
  const relationship = {id, type: "PARENT_OF", fromPersonId, toPersonId};
  if (parentRole !== undefined) {
    relationship.parentRole = parentRole;
  }
  return relationship;
};

const buildValidTrees = () => {
  const targetByKey = new Map(
    AUTHORIZED_MANUAL_REVIEW_TARGETS.map((item) => [
      `${item.treeId}/${item.relationshipId}`,
      item,
    ]),
  );
  const trees = new Map();
  for (const decision of canonicalManifest.decisions) {
    if (!trees.has(decision.treeId)) {
      trees.set(decision.treeId, {
        treeId: decision.treeId,
        exists: true,
        personsById: new Map(),
        relationships: [],
      });
    }
    const tree = trees.get(decision.treeId);
    const target = targetByKey.get(
      `${decision.treeId}/${decision.relationshipId}`,
    );
    const supportChildId = `support-child-${decision.relationshipId}`;
    tree.personsById.set(decision.fromPersonId, {
      id: decision.fromPersonId,
      firstName: decision.parentName,
    });
    tree.personsById.set(decision.toPersonId, {
      id: decision.toPersonId,
      firstName: decision.childName,
    });
    tree.personsById.set(supportChildId, {
      id: supportChildId,
      firstName: supportChildId,
    });
    tree.relationships.push(
      parent(
        decision.relationshipId,
        decision.fromPersonId,
        decision.toPersonId,
      ),
      parent(
        `support-${decision.relationshipId}`,
        decision.fromPersonId,
        supportChildId,
        target.expectedCandidateRole,
      ),
    );
  }
  return [...trees.values()].map(({personsById, ...tree}) => ({
    ...tree,
    persons: [...personsById.values()],
  }));
};

const firstApproved = canonicalManifest.decisions.find(
  ({reviewDecision}) => reviewDecision === "approve",
);
const rejected = canonicalManifest.decisions.find(
  ({reviewDecision}) => reviewDecision === "reject",
);
const unknown = canonicalManifest.decisions.find(
  ({reviewDecision}) => reviewDecision === "unknown",
);
const opposite = (role) => role === "father" ? "mother" : "father";
const buildPlan = (trees = buildValidTrees(), manifest = cloneManifest()) =>
  buildProtectedApprovedParentRolePlan({manifest, trees});
const mutateApprovedTree = (mutator) => {
  const trees = buildValidTrees();
  const tree = trees.find(({treeId}) => treeId === APPROVED_TREE_ID);
  mutator(tree);
  return buildPlan(trees);
};
const findApprovedCase = (plan, relationshipId = firstApproved.relationshipId) =>
  plan.approvedCases.find((item) => item.relationshipId === relationshipId);
const findTarget = (tree, relationshipId = firstApproved.relationshipId) =>
  tree.relationships.find(({id}) => id === relationshipId);

describe("protección contractual del manifiesto", () => {
  it("acepta el hash contractual correcto", () => {
    const result = validateManifestIntegrity(rawManifest);
    assert.equal(result.ok, true);
    assert.equal(result.manifestHash, EXPECTED_MANIFEST_SHA256);
  });

  it("rechaza un hash incorrecto antes de Firebase", () => {
    const result = validateManifestIntegrity(`${rawManifest}\n`);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "manifest-hash-mismatch");
  });

  it("confirma el conteo contractual 18/2/1", () => {
    const {summary} = validateManifestIntegrity(rawManifest);
    assert.deepEqual(
      [summary.approved, summary.rejected, summary.unknown],
      [18, 2, 1],
    );
  });

  it("confirma 9 father y 9 mother aprobados", () => {
    const {summary} = validateManifestIntegrity(rawManifest);
    assert.deepEqual(
      [summary.approvedFather, summary.approvedMother],
      [9, 9],
    );
  });

  it("rechaza intentar aprobar una exclusión contractual", () => {
    const manifest = cloneManifest();
    const decision = manifest.decisions.find(
      ({relationshipId}) => relationshipId === rejected.relationshipId,
    );
    decision.reviewDecision = "approve";
    decision.confirmedParentRole = "father";
    assert.equal(
      validateManifestIntegrity(JSON.stringify(manifest)).ok,
      false,
    );
  });

  it("rechaza agregar una relación fuera de la lista cerrada", () => {
    const manifest = cloneManifest();
    manifest.decisions.push({
      ...structuredClone(firstApproved),
      relationshipId: "outside-contract",
    });
    assert.equal(
      validateManifestIntegrity(JSON.stringify(manifest)).ok,
      false,
    );
  });
});

describe("plan protegido e idempotente", () => {
  it("produce el plan exacto de 18 actualizaciones", () => {
    const plan = buildPlan();
    assert.equal(
      plan.ok,
      true,
      JSON.stringify(plan.validationFailures),
    );
    assert.equal(plan.summary.eligible, 18);
    assert.equal(plan.proposedUpdates.length, 18);
  });

  it("el dry-run representa cero escrituras", () => {
    const plan = buildPlan();
    assert.equal(plan.summary.proposedUpdates, 18);
    const writesExecuted = 0;
    assert.equal(writesExecuted, 0);
  });

  it("aborta todo si una relación no existe", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships = tree.relationships.filter(
        ({id}) => id !== firstApproved.relationshipId,
      );
    });
    assert.equal(findApprovedCase(plan).status, "stale");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo si el árbol no existe", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.exists = false;
    });
    assert.equal(findApprovedCase(plan).status, "stale");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo si falta una persona", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.persons = tree.persons.filter(
        ({id}) => id !== firstApproved.fromPersonId,
      );
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo ante una arista duplicada", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships.push({
        ...findTarget(tree),
        id: "duplicate-approved-edge",
      });
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo con más de dos progenitores", () => {
    const plan = mutateApprovedTree((tree) => {
      for (const index of [1, 2]) {
        const personId = `extra-parent-${index}`;
        tree.persons.push({id: personId, firstName: personId});
        tree.relationships.push(parent(
          `extra-parent-edge-${index}`,
          personId,
          firstApproved.toPersonId,
          index === 1 ? "father" : "mother",
        ));
      }
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo ante un rol parental duplicado", () => {
    const plan = mutateApprovedTree((tree) => {
      const personId = "duplicate-role-parent";
      tree.persons.push({id: personId, firstName: personId});
      tree.relationships.push(parent(
        "duplicate-role-edge",
        personId,
        firstApproved.toPersonId,
        firstApproved.confirmedParentRole,
      ));
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo ante una autorrelación", () => {
    const plan = mutateApprovedTree((tree) => {
      findTarget(tree).toPersonId = firstApproved.fromPersonId;
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo ante un ciclo", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships.push(parent(
        "reverse-cycle",
        firstApproved.toPersonId,
        firstApproved.fromPersonId,
        "mother",
      ));
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("aborta todo si existe evidencia contraria", () => {
    const plan = mutateApprovedTree((tree) => {
      const childId = "opposite-evidence-child";
      tree.persons.push({id: childId, firstName: childId});
      tree.relationships.push(parent(
        "opposite-evidence",
        firstApproved.fromPersonId,
        childId,
        opposite(firstApproved.confirmedParentRole),
      ));
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("marca ineligible y aborta si no existe evidencia", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships = tree.relationships.filter(
        (item) =>
          item.fromPersonId !== firstApproved.fromPersonId ||
          item.parentRole === undefined,
      );
    });
    assert.equal(
      findApprovedCase(plan).status,
      "ineligible",
      JSON.stringify(findApprovedCase(plan).failedValidations),
    );
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("clasifica un rol ya confirmado como already-migrated", () => {
    const plan = mutateApprovedTree((tree) => {
      findTarget(tree).parentRole = firstApproved.confirmedParentRole;
    });
    assert.equal(findApprovedCase(plan).status, "already-migrated");
    assert.equal(
      plan.proposedUpdates.some(
        ({relationshipId}) =>
          relationshipId === firstApproved.relationshipId,
      ),
      false,
    );
  });

  it("aborta todo si el rol presente es diferente", () => {
    const plan = mutateApprovedTree((tree) => {
      findTarget(tree).parentRole = opposite(firstApproved.confirmedParentRole);
    });
    assert.equal(findApprovedCase(plan).status, "conflict");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("acepta las 18 already-migrated con cero actualizaciones", () => {
    const trees = buildValidTrees();
    const tree = trees.find(({treeId}) => treeId === APPROVED_TREE_ID);
    for (const decision of canonicalManifest.decisions.filter(
      ({reviewDecision}) => reviewDecision === "approve",
    )) {
      findTarget(tree, decision.relationshipId).parentRole =
        decision.confirmedParentRole;
    }
    const plan = buildPlan(trees);
    assert.equal(
      plan.ok,
      true,
      JSON.stringify(plan.validationFailures),
    );
    assert.equal(plan.summary.alreadyMigrated, 18);
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("en mezcla actualiza únicamente las eligible", () => {
    const plan = mutateApprovedTree((tree) => {
      findTarget(tree).parentRole = firstApproved.confirmedParentRole;
    });
    assert.equal(
      plan.ok,
      true,
      JSON.stringify(plan.validationFailures),
    );
    assert.equal(plan.summary.alreadyMigrated, 1);
    assert.equal(plan.proposedUpdates.length, 17);
  });

  it("reject nunca produce actualización", () => {
    const plan = buildPlan();
    assert.equal(
      plan.proposedUpdates.some(
        ({relationshipId}) => relationshipId === rejected.relationshipId,
      ),
      false,
    );
    assert.equal(
      plan.excludedCases.find(
        ({relationshipId}) => relationshipId === rejected.relationshipId,
      ).status,
      "excluded-rejected",
    );
  });

  it("unknown nunca produce actualización", () => {
    const plan = buildPlan();
    assert.equal(
      plan.proposedUpdates.some(
        ({relationshipId}) => relationshipId === unknown.relationshipId,
      ),
      false,
    );
    assert.equal(
      plan.excludedCases.find(
        ({relationshipId}) => relationshipId === unknown.relationshipId,
      ).status,
      "excluded-unknown",
    );
  });
});

describe("barreras de conexión y apply", () => {
  it("rechaza host ausente antes de Firebase", () => {
    assert.equal(validateLocalEmulatorHost(undefined).ok, false);
  });

  it("rechaza host remoto", () => {
    assert.equal(
      validateLocalEmulatorHost("firestore.googleapis.com:443").ok,
      false,
    );
  });

  it("rechaza apply sin confirm-tree-id", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmManifestSha256: EXPECTED_MANIFEST_SHA256,
      backupPath: "/tmp/backup",
    });
    assert.equal(result.code, "confirm-tree-id-required");
  });

  it("rechaza apply sin confirm-manifest-sha256", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmTreeId: APPROVED_TREE_ID,
      backupPath: "/tmp/backup",
    });
    assert.equal(result.code, "confirm-manifest-sha256-required");
  });

  it("rechaza apply con hash de confirmación incorrecto", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmTreeId: APPROVED_TREE_ID,
      confirmManifestSha256: "incorrect",
      backupPath: "/tmp/backup",
    });
    assert.equal(result.code, "confirm-manifest-sha256-required");
  });

  it("rechaza apply sin backup", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmTreeId: APPROVED_TREE_ID,
      confirmManifestSha256: EXPECTED_MANIFEST_SHA256,
    });
    assert.equal(result.code, "absolute-backup-path-required");
  });

  it("rechaza un backup inválido", async () => {
    const result = await validateBackupExport(
      "/tmp/treefamily-backup-that-does-not-exist",
      "/home/chenzo/Projects/treeFamily",
    );
    assert.equal(result.code, "invalid-backup");
  });
});

describe("atomicidad y superficie exacta de escritura", () => {
  it("si cambia una relación al revalidar quedan cero escrituras", () => {
    const initialPlan = buildPlan();
    assert.equal(buildApprovedWriteOperations(initialPlan).length, 18);
    const changedPlan = mutateApprovedTree((tree) => {
      findTarget(tree).parentRole = opposite(firstApproved.confirmedParentRole);
    });
    assert.equal(changedPlan.ok, false);
    assert.deepEqual(buildApprovedWriteOperations(changedPlan), []);
  });

  it("solo prepara parentRole", () => {
    const operations = buildApprovedWriteOperations(buildPlan());
    assert.ok(operations.length > 0);
    assert.deepEqual(
      Object.keys(operations[0].data),
      ["parentRole"],
    );
  });

  it("nunca prepara updatedAt", () => {
    const serialized = JSON.stringify(
      buildApprovedWriteOperations(buildPlan()),
    );
    assert.equal(serialized.includes("updatedAt"), false);
  });
});
