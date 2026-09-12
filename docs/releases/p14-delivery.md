# TreeFamily MVP — P14 Production Delivery

## Release status

- MVP RELEASE: **PASS**.
- PRODUCTION: **LIVE**.
- Stable domain: <https://treefamily.arsalix.com>.
- Release date: 2026-09-12.

## Release candidate

- Validated candidate: `v0.1.0-rc.2`.
- Target before final documentation: `7224e32d0177a48ff6dafe14c5040f13b82be41c`.
- `v0.1.0-rc.1` remains immutable at `1518861714e9b1cec0aa50fb8220b54e74aace74`.

## Firebase production infrastructure

- Project ID: `tree-gen-chenzoap-2026`.
- Project Number: `72998121513`.
- Firebase plan: Blaze / Free Trial.
- Authentication: Email/Password enabled; the custom production domain is authorized.
- Firestore: database `(default)`, Standard edition, location `nam5`.
- Production Firestore Rules: deployed and verified.
- Cloud Functions: exactly 12 callable Functions, generation v2, runtime Node.js 24, region `us-central1`.
- Artifact Registry cleanup: one-day retention in `us-central1`.
- Hosting site: `tree-gen-chenzoap-2026`.
- Default Hosting URL: <https://tree-gen-chenzoap-2026.web.app>.
- Custom domain: <https://treefamily.arsalix.com>.
- Custom-domain status: connected; managed SSL active and verified.

## Production Functions

The production surface contains exactly:

1. `createTreeWithRootPerson`
2. `getMyTreeSummary`
3. `getTreeData`
4. `updatePerson`
5. `deletePerson`
6. `deleteRelationship`
7. `reassignParentRelationship`
8. `updatePartnerRelationshipStatus`
9. `createUnion`
10. `addPartnerToPerson`
11. `addChildToUnion`
12. `addParentToPerson`

The DEV-only or legacy Functions `claimTreeOwnership`, `addPerson` and `addRelationship` are absent from production.

## Hosting

- Canonical release config: `packages/firebase.json`.
- Firebase project root: `packages/`.
- Functions path: `functions`.
- Firestore Rules path: `firebase/firestore.rules`.
- Hosting public directory: `frontend/dist`.
- SPA rewrite: `**` → `/index.html`.

## Production smoke

The production smoke test passed across the complete functional chain:

- the custom HTTPS domain loaded successfully;
- signup and Firebase Authentication succeeded;
- the root tree was created through the callable Cloud Function;
- the private tree owner matched the authenticated QA user;
- the frontend read and rendered the tree and its root person;
- logout followed by login restored the same tree.

The reusable production smoke fixture is intentionally retained and consists of one QA Auth user, one private QA tree, one root person and zero relationships. This document intentionally excludes its email address, UID, document IDs and credentials. Do not delete the fixture.

## Security

- Direct client writes to Firestore are blocked by production Rules.
- Client reads are restricted using the canonical `ownerId` on the tree document.
- DEV-only and legacy Functions are absent from production.
- The production frontend bundle contains no Emulator endpoints or fake Emulator API key.
- `packages/frontend/.env.production.local` remains local and untracked.
- The custom production domain is authorized in Firebase Authentication.

## Known non-blocking warnings

- The main frontend bundle is approximately 801.68 kB.
- Vite reports the chunk-size warning above 500 kB.
- The tooling reports the `module.register()` deprecation.
- Firestore delete protection is disabled.
- Firestore point-in-time recovery (PITR) is disabled.

These warnings do not block the TreeFamily MVP v0.1.0 release.

## Rollback

- Source rollback candidate: `v0.1.0-rc.2`.
- Prior candidate: `v0.1.0-rc.1`.
- Data rollback remains operationally separate from source rollback.

See [`docs/releases/p13-acceptance-and-rollback.md`](p13-acceptance-and-rollback.md) for the rehearsed rollback contract and data constraints.

## Final verdict

P14 PASS

TreeFamily MVP v0.1.0 approved for stable release.
