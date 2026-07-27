import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";

import {
  buildApprovedParentRoleMigrationPlan,
  hashDecisionManifest,
  validateDecisionManifest,
  validateLocalEmulatorHost,
} from "./approved-parent-role-migration.mjs";
import {
  AUTHORIZED_MANUAL_REVIEW_TARGETS,
} from "./parent-role-manual-review.mjs";

const manifestPath = new URL(
  "../data/parent-role-manual-decisions-2026-07-27.json",
  import.meta.url,
);
const rawManifest = await readFile(manifestPath, "utf8");
const canonicalManifest = JSON.parse(rawManifest);
const cloneManifest = () => structuredClone(canonicalManifest);

const parent = (id, fromPersonId, toPersonId, parentRole) => {
  const value = {id, type: "PARENT_OF", fromPersonId, toPersonId};
  if (parentRole !== undefined) {
    value.parentRole = parentRole;
  }
  return value;
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
      firstName: `Support ${decision.relationshipId}`,
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

const mutateApprovedTree = (mutator, manifest = cloneManifest()) => {
  const trees = buildValidTrees();
  const tree = trees.find(({treeId}) => treeId === firstApproved.treeId);
  mutator(tree);
  return buildApprovedParentRoleMigrationPlan({manifest, trees});
};

const approvedCase = (plan, relationshipId = firstApproved.relationshipId) =>
  plan.approvedCases.find((item) => item.relationshipId === relationshipId);

describe("manifiesto de decisiones manuales", () => {
  it("acepta el manifiesto válido de 21 decisiones", () => {
    const result = validateDecisionManifest(canonicalManifest);
    assert.equal(result.ok, true);
    assert.equal(result.summary.totalDecisions, 21);
  });

  it("cuenta 18 approve, 2 reject y 1 unknown", () => {
    const {summary} = validateDecisionManifest(canonicalManifest);
    assert.equal(summary.approved, 18);
    assert.equal(summary.rejected, 2);
    assert.equal(summary.unknown, 1);
  });

  it("cuenta 9 father y 9 mother aprobados", () => {
    const {summary} = validateDecisionManifest(canonicalManifest);
    assert.equal(summary.approvedFather, 9);
    assert.equal(summary.approvedMother, 9);
  });

  it("rechaza approve sin confirmedParentRole", () => {
    const manifest = cloneManifest();
    manifest.decisions.find(
      ({reviewDecision}) => reviewDecision === "approve",
    ).confirmedParentRole = null;
    assert.equal(validateDecisionManifest(manifest).ok, false);
  });

  it("rechaza reject con rol", () => {
    const manifest = cloneManifest();
    manifest.decisions.find(
      ({reviewDecision}) => reviewDecision === "reject",
    ).confirmedParentRole = "father";
    assert.equal(validateDecisionManifest(manifest).ok, false);
  });

  it("rechaza unknown con rol", () => {
    const manifest = cloneManifest();
    manifest.decisions.find(
      ({reviewDecision}) => reviewDecision === "unknown",
    ).confirmedParentRole = "mother";
    assert.equal(validateDecisionManifest(manifest).ok, false);
  });

  it("rechaza una decisión duplicada", () => {
    const manifest = cloneManifest();
    manifest.decisions.push(structuredClone(manifest.decisions[0]));
    const result = validateDecisionManifest(manifest);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({code}) => code === "duplicate-decision"));
  });

  it("rechaza un rol inválido", () => {
    const manifest = cloneManifest();
    manifest.decisions.find(
      ({reviewDecision}) => reviewDecision === "approve",
    ).confirmedParentRole = "parent";
    assert.equal(validateDecisionManifest(manifest).ok, false);
  });
});

describe("plan aprobado all-or-nothing", () => {
  it("clasifica una relación aprobada válida como eligible", () => {
    const plan = buildApprovedParentRoleMigrationPlan({
      manifest: cloneManifest(),
      trees: buildValidTrees(),
    });
    assert.equal(approvedCase(plan).status, "eligible");
  });

  it("produce exactamente 18 actualizaciones para las 18 válidas", () => {
    const plan = buildApprovedParentRoleMigrationPlan({
      manifest: cloneManifest(),
      trees: buildValidTrees(),
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.proposedUpdates.length, 18);
  });

  it("marca already-migrated como stale y aborta todo el plan", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships.find(
        ({id}) => id === firstApproved.relationshipId,
      ).parentRole = firstApproved.confirmedParentRole;
    });
    assert.equal(approvedCase(plan).status, "stale");
    assert.equal(plan.proposedUpdates.length, 0);
  });

  it("marca una relación inexistente como stale", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships = tree.relationships.filter(
        ({id}) => id !== firstApproved.relationshipId,
      );
    });
    assert.equal(approvedCase(plan).status, "stale");
  });

  it("marca un árbol inexistente como stale", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.exists = false;
    });
    assert.equal(approvedCase(plan).status, "stale");
  });

  it("marca conflict cuando candidato y rol confirmado difieren", () => {
    const manifest = cloneManifest();
    const father = manifest.decisions.find(
      ({reviewDecision, confirmedParentRole}) =>
        reviewDecision === "approve" && confirmedParentRole === "father",
    );
    const mother = manifest.decisions.find(
      ({reviewDecision, confirmedParentRole}) =>
        reviewDecision === "approve" && confirmedParentRole === "mother",
    );
    [father.confirmedParentRole, mother.confirmedParentRole] =
      [mother.confirmedParentRole, father.confirmedParentRole];
    const plan = buildApprovedParentRoleMigrationPlan({
      manifest,
      trees: buildValidTrees(),
    });
    assert.equal(approvedCase(plan, father.relationshipId).status, "conflict");
  });

  it("marca conflict cuando existe evidencia del rol contrario", () => {
    const plan = mutateApprovedTree((tree) => {
      const target = tree.relationships.find(
        ({id}) => id === firstApproved.relationshipId,
      );
      const childId = "opposite-evidence-child";
      tree.persons.push({id: childId, firstName: childId});
      tree.relationships.push(
        parent(
          "opposite-evidence",
          target.fromPersonId,
          childId,
          firstApproved.confirmedParentRole === "father" ? "mother" : "father",
        ),
      );
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("marca ineligible cuando no existe evidencia", () => {
    const plan = mutateApprovedTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstApproved.relationshipId,
      );
      tree.relationships = tree.relationships.filter(
        (item) =>
          item.fromPersonId !== reviewed.fromPersonId ||
          item.parentRole === undefined,
      );
    });
    assert.equal(approvedCase(plan).status, "ineligible");
  });

  it("marca conflict una referencia huérfana", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.persons = tree.persons.filter(
        ({id}) => id !== firstApproved.fromPersonId,
      );
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("marca conflict una arista duplicada", () => {
    const plan = mutateApprovedTree((tree) => {
      const reviewed = tree.relationships.find(
        ({id}) => id === firstApproved.relationshipId,
      );
      tree.relationships.push({...reviewed, id: "duplicate-edge"});
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("marca conflict más de dos progenitores", () => {
    const plan = mutateApprovedTree((tree) => {
      for (const [index, role] of ["father", "mother"].entries()) {
        const personId = `extra-parent-${index}`;
        tree.persons.push({id: personId, firstName: personId});
        tree.relationships.push(
          parent(
            `extra-parent-edge-${index}`,
            personId,
            firstApproved.toPersonId,
            role,
          ),
        );
      }
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("marca conflict una autorrelación", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships.find(
        ({id}) => id === firstApproved.relationshipId,
      ).toPersonId = firstApproved.fromPersonId;
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("marca conflict un ciclo", () => {
    const plan = mutateApprovedTree((tree) => {
      tree.relationships.push(
        parent(
          "reverse-cycle",
          firstApproved.toPersonId,
          firstApproved.fromPersonId,
          "mother",
        ),
      );
    });
    assert.equal(approvedCase(plan).status, "conflict");
  });

  it("reject nunca produce actualización", () => {
    const plan = buildApprovedParentRoleMigrationPlan({
      manifest: cloneManifest(),
      trees: buildValidTrees(),
    });
    const rejected = new Set(
      plan.excludedCases
        .filter(({status}) => status === "excluded-rejected")
        .map(({relationshipId}) => relationshipId),
    );
    assert.equal(
      plan.proposedUpdates.some(({relationshipId}) =>
        rejected.has(relationshipId),
      ),
      false,
    );
  });

  it("unknown nunca produce actualización", () => {
    const plan = buildApprovedParentRoleMigrationPlan({
      manifest: cloneManifest(),
      trees: buildValidTrees(),
    });
    const unknown = plan.excludedCases.find(
      ({status}) => status === "excluded-unknown",
    );
    assert.equal(
      plan.proposedUpdates.some(
        ({relationshipId}) => relationshipId === unknown.relationshipId,
      ),
      false,
    );
  });

  it("rechaza agregar silenciosamente una decisión no autorizada", () => {
    const manifest = cloneManifest();
    manifest.decisions.push({
      ...structuredClone(manifest.decisions[0]),
      relationshipId: "not-authorized",
    });
    const validation = validateDecisionManifest(manifest);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some(
      ({code}) => code === "decision-not-authorized",
    ));
  });
});

describe("barreras y reproducibilidad", () => {
  it("rechaza host ausente antes de Firebase", () => {
    assert.equal(validateLocalEmulatorHost(undefined).ok, false);
  });

  it("rechaza host remoto", () => {
    assert.equal(
      validateLocalEmulatorHost("firestore.googleapis.com:443").ok,
      false,
    );
  });

  it("no expone apply ni métodos de escritura", async () => {
    const module = await import("./approved-parent-role-migration.mjs");
    assert.equal(Object.keys(module).some((name) => /apply/i.test(name)), false);
    assert.equal(
      Object.keys(module).some((name) => /write|update|delete/i.test(name)),
      false,
    );
  });

  it("produce un hash estable y reproducible del manifiesto", () => {
    const first = hashDecisionManifest(rawManifest);
    const second = hashDecisionManifest(rawManifest);
    assert.equal(first, second);
    assert.equal(first.length, 64);
    assert.notEqual(first, hashDecisionManifest(`${rawManifest}\n`));
  });
});
