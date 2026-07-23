import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  AUTHORIZED_PARENT_ROLE_TARGETS,
  buildDeterministicParentRoleMigrationPlan,
  validateApplyArguments,
  validateBackupExport,
  validateLocalEmulatorHost,
} from "./deterministic-parent-role-migration.mjs";

const TREE_ID = "gib7tREAAsXDQX4Qh3Oh";
const [ELVIS_TARGET, MARI_TARGET] = AUTHORIZED_PARENT_ROLE_TARGETS;

const relationship = (id, fromPersonId, toPersonId, parentRoleMarker) => {
  const value = {
    id,
    type: "PARENT_OF",
    fromPersonId,
    toPersonId,
  };
  if (parentRoleMarker !== undefined) {
    value.parentRole = parentRoleMarker;
  }
  return value;
};

const validTree = () => ({
  treeId: TREE_ID,
  exists: true,
  persons: [
    {id: "leonilda"},
    {id: "victor"},
    {id: "gregorio"},
    {id: "elvis"},
    {id: "mari"},
  ],
  relationships: [
    relationship(ELVIS_TARGET.relationshipId, "leonilda", "elvis"),
    relationship("elvis-father", "victor", "elvis", "father"),
    relationship(MARI_TARGET.relationshipId, "leonilda", "mari"),
    relationship("mari-father", "gregorio", "mari", "father"),
  ],
});

const planWith = (mutate = () => {}) => {
  const tree = validTree();
  mutate(tree);
  return buildDeterministicParentRoleMigrationPlan({trees: [tree]});
};

describe("plan determinista de parentRole", () => {
  it("produce exactamente dos actualizaciones mother autorizadas", () => {
    const plan = planWith();

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.summary, {
      examined: 2,
      eligible: 2,
      alreadyMigrated: 0,
      conflicts: 0,
      proposedUpdates: 2,
    });
    assert.deepEqual(
      plan.updates.map(({relationshipId, parentRole}) => ({
        relationshipId,
        parentRole,
      })),
      [
        {relationshipId: ELVIS_TARGET.relationshipId, parentRole: "mother"},
        {relationshipId: MARI_TARGET.relationshipId, parentRole: "mother"},
      ],
    );
  });

  it("el dry-run puede consumir el plan sin ejecutar escrituras", () => {
    let writesExecuted = 0;
    const plan = planWith();

    assert.equal(plan.updates.length, 2);
    assert.equal(writesExecuted, 0);
  });

  it("aborta todo si falta una relación autorizada", () => {
    const plan = planWith((tree) => {
      tree.relationships = tree.relationships.filter(
        ({id}) => id !== ELVIS_TARGET.relationshipId,
      );
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.targets[0].status, "stale");
  });

  it("aborta todo si falta el árbol autorizado", () => {
    const plan = buildDeterministicParentRoleMigrationPlan({
      trees: [{treeId: TREE_ID, exists: false, persons: [], relationships: []}],
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.updates.length, 0);
    assert.ok(plan.targets.every(({status}) => status === "stale"));
  });

  it("aborta ante parentRole inválido", () => {
    const plan = planWith((tree) => {
      tree.relationships[0].parentRole = "unknown";
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "invalid-current-role",
      ),
    );
  });

  it("marca mother ya aplicada como already-migrated", () => {
    const plan = planWith((tree) => {
      tree.relationships[0].parentRole = "mother";
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.summary.alreadyMigrated, 1);
    assert.equal(plan.summary.proposedUpdates, 1);
    assert.equal(plan.targets[0].status, "already-migrated");
  });

  it("aborta si el objetivo ya tiene father", () => {
    const plan = planWith((tree) => {
      tree.relationships[0].parentRole = "father";
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.updates.length, 0);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "unexpected-current-role",
      ),
    );
  });

  it("aborta si el otro progenitor no tiene rol", () => {
    const plan = planWith((tree) => {
      delete tree.relationships[1].parentRole;
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.targets[0].currentClassification,
      "missing-role-ambiguous-multiple-unknown");
  });

  it("aborta si el otro progenitor es mother", () => {
    const plan = planWith((tree) => {
      tree.relationships[1].parentRole = "mother";
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.targets[0].evidence.calculatedComplement, "father");
  });

  it("aborta si el hijo tiene tres progenitores", () => {
    const plan = planWith((tree) => {
      tree.persons.push({id: "third"});
      tree.relationships.push(
        relationship("third-parent", "third", "elvis", "mother"),
      );
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "unexpected-parent-edge-count",
      ),
    );
  });

  it("aborta ante un vínculo parental duplicado", () => {
    const plan = planWith((tree) => {
      tree.relationships.push(
        relationship("duplicate", "leonilda", "elvis"),
      );
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "duplicate-parent-edge",
      ),
    );
  });

  it("aborta ante dos fathers explícitos", () => {
    const plan = planWith((tree) => {
      tree.persons.push({id: "third"});
      tree.relationships.push(
        relationship("second-father", "third", "elvis", "father"),
      );
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "invalid-father-count",
      ),
    );
  });

  it("aborta ante una referencia huérfana", () => {
    const plan = planWith((tree) => {
      tree.persons = tree.persons.filter(({id}) => id !== "leonilda");
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "orphan-reference",
      ),
    );
  });

  it("aborta ante una autorrelación", () => {
    const plan = planWith((tree) => {
      tree.relationships[0].toPersonId = "leonilda";
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "self-parent-link",
      ),
    );
  });

  it("aborta si el vínculo participa en un ciclo", () => {
    const plan = planWith((tree) => {
      tree.relationships.push(
        relationship("reverse", "elvis", "leonilda", "father"),
      );
    });

    assert.equal(plan.ok, false);
    assert.ok(
      plan.targets[0].failedPreconditions.some(
        ({code}) => code === "cycle-detected",
      ),
    );
  });

  it("rechaza la ausencia de FIRESTORE_EMULATOR_HOST", () => {
    const result = validateLocalEmulatorHost(undefined);

    assert.equal(result.ok, false);
    assert.equal(result.code, "emulator-host-required");
  });

  it("rechaza un host que no sea loopback", () => {
    const result = validateLocalEmulatorHost("firestore.googleapis.com:443");

    assert.equal(result.ok, false);
    assert.equal(result.code, "non-local-emulator-host");
  });

  it("acepta las representaciones loopback autorizadas", () => {
    for (const host of [
      "127.0.0.1:8080",
      "localhost:8080",
      "[::1]:8080",
    ]) {
      assert.equal(validateLocalEmulatorHost(host).ok, true);
    }
  });

  it("rechaza apply sin confirm-tree-id", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmTreeId: null,
      backupPath: "/tmp/backup",
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "tree-confirmation-required");
  });

  it("rechaza apply sin backup-path", () => {
    const result = validateApplyArguments({
      apply: true,
      confirmTreeId: TREE_ID,
      backupPath: null,
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "backup-path-required");
  });

  it("rechaza un respaldo inexistente", async () => {
    const result = await validateBackupExport(
      "/tmp/treefamily-backup-that-does-not-exist",
      "/home/chenzo/Projects/treeFamily",
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid-backup");
  });

  it("nunca prepara objetivos fuera de la allowlist", () => {
    const plan = buildDeterministicParentRoleMigrationPlan({
      trees: [validTree()],
      targets: [
        ...AUTHORIZED_PARENT_ROLE_TARGETS,
        {
          treeId: TREE_ID,
          relationshipId: "not-authorized",
          expectedCandidateRole: "mother",
        },
      ],
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.updates.length, 0);
    assert.ok(
      plan.targets.every(
        ({status, relationshipId}) =>
          relationshipId !== "not-authorized" || status === "ineligible",
      ),
    );
  });

  it("es idempotente cuando ambos objetivos ya están migrados", () => {
    const plan = planWith((tree) => {
      tree.relationships[0].parentRole = "mother";
      tree.relationships[2].parentRole = "mother";
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.summary.alreadyMigrated, 2);
    assert.equal(plan.summary.proposedUpdates, 0);
    assert.deepEqual(plan.updates, []);
  });
});
