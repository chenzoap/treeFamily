import {readFile} from "node:fs/promises";
import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "tree-gen-chenzoap-2026";
const OWNER_UID = "security-owner";
const OTHER_UID = "security-other";
const TREE_ID = "security-tree";

describe("production Firestore rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8085,
        rules: await readFile(
          new URL("./firestore.rules", import.meta.url),
          "utf8",
        ),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "trees", TREE_ID), {
        ownerId: OWNER_UID,
        rootPersonId: "root-person",
      });
      await setDoc(doc(db, "trees", TREE_ID, "persons", "root-person"), {
        firstName: "Security",
        lastName: "Owner",
        isRoot: true,
      });
      await setDoc(
        doc(db, "trees", TREE_ID, "relationships", "security-relationship"),
        {
          type: "PARENT_OF",
          fromPersonId: "root-person",
          toPersonId: "child-person",
          parentRole: "father",
        },
      );
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows only the owner to read the tree", async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, "trees", TREE_ID)));
    await assertFails(getDoc(doc(otherDb, "trees", TREE_ID)));
    await assertFails(getDoc(doc(unauthDb, "trees", TREE_ID)));
  });

  it("allows only the owner to get and list persons", async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const personPath = ["trees", TREE_ID, "persons", "root-person"] as const;
    const collectionPath = ["trees", TREE_ID, "persons"] as const;

    await assertSucceeds(getDoc(doc(ownerDb, ...personPath)));
    await assertSucceeds(getDocs(collection(ownerDb, ...collectionPath)));
    await assertFails(getDoc(doc(otherDb, ...personPath)));
    await assertFails(getDocs(collection(otherDb, ...collectionPath)));
    await assertFails(getDoc(doc(unauthDb, ...personPath)));
    await assertFails(getDocs(collection(unauthDb, ...collectionPath)));
  });

  it("allows only the owner to get and list relationships", async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const relationshipPath = [
      "trees",
      TREE_ID,
      "relationships",
      "security-relationship",
    ] as const;
    const collectionPath = ["trees", TREE_ID, "relationships"] as const;

    await assertSucceeds(getDoc(doc(ownerDb, ...relationshipPath)));
    await assertSucceeds(getDocs(collection(ownerDb, ...collectionPath)));
    await assertFails(getDoc(doc(otherDb, ...relationshipPath)));
    await assertFails(getDocs(collection(otherDb, ...collectionPath)));
    await assertFails(getDoc(doc(unauthDb, ...relationshipPath)));
    await assertFails(getDocs(collection(unauthDb, ...collectionPath)));
  });

  it("denies direct tree writes even for the owner", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(db, "trees", "new-tree"), {ownerId: OWNER_UID}));
    await assertFails(updateDoc(doc(db, "trees", TREE_ID), {name: "Changed"}));
    await assertFails(deleteDoc(doc(db, "trees", TREE_ID)));
  });

  it("denies direct person writes even for the owner", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const existing = doc(db, "trees", TREE_ID, "persons", "root-person");
    await assertFails(setDoc(doc(db, "trees", TREE_ID, "persons", "new"), {}));
    await assertFails(updateDoc(existing, {firstName: "Changed"}));
    await assertFails(deleteDoc(existing));
  });

  it("denies direct relationship writes even for the owner", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const existing = doc(
      db,
      "trees",
      TREE_ID,
      "relationships",
      "security-relationship",
    );
    await assertFails(
      setDoc(doc(db, "trees", TREE_ID, "relationships", "new"), {}),
    );
    await assertFails(updateDoc(existing, {type: "PARTNER_OF"}));
    await assertFails(deleteDoc(existing));
  });

  it("denies unknown top-level collections by default", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const unknown = doc(db, "securityUnknown", "test");
    await assertFails(getDoc(unknown));
    await assertFails(setDoc(unknown, {value: true}));
  });
});
