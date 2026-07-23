import assert from "node:assert/strict";
import test from "node:test";
import { createParentRelationship } from "./seed-firestore.mjs";

const validInput = {
  id: "relationship",
  fromPersonId: "parent",
  toPersonId: "child",
};

test("acepta father como parentRole explícito", () => {
  assert.deepEqual(
    createParentRelationship({ ...validInput, parentRole: "father" }),
    {
      ...validInput,
      type: "PARENT_OF",
      parentRole: "father",
    },
  );
});

test("acepta mother como parentRole explícito", () => {
  assert.deepEqual(
    createParentRelationship({ ...validInput, parentRole: "mother" }),
    {
      ...validInput,
      type: "PARENT_OF",
      parentRole: "mother",
    },
  );
});

test("rechaza roles parentales ausentes o inválidos", () => {
  for (const parentRole of [undefined, null, "", "parent", "unknown"]) {
    assert.throws(
      () => createParentRelationship({ ...validInput, parentRole }),
      {
        name: "TypeError",
        message:
          "La relación parental relationship requiere parentRole father o mother.",
      },
    );
  }
});
