import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const read = path => JSON.parse(readFileSync(path));

test('staging uses separate Hosting output and canonical backend resources', () => {
  const staging = read('packages/firebase.staging.json');
  const production = read('packages/firebase.json');
  assert.equal(staging.hosting.public, 'frontend/dist-staging');
  assert.equal(staging.hosting.site, 'treefamily-staging-2026');
  assert.equal(production.hosting.public, 'frontend/dist');
  assert.deepEqual(staging.functions, production.functions);
  assert.deepEqual(staging.firestore, production.firestore);
  assert.equal(read('packages/.firebaserc').projects.default, 'tree-gen-chenzoap-2026');
});
test('CI uses Node 24 and the config-free production build path without bypassing staging', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /run:\s*npm run build -w packages\/frontend/);
  assert.doesNotMatch(workflow, /build:staging|VITE_FIREBASE_|CI=true/);
});
for (const args of [[], ['--project','tree-gen-chenzoap-2026','--config','packages/firebase.staging.json'], ['--project','treefamily-staging-2026','--config','packages/firebase.json']]) {
  test(`remote wrapper rejects unsafe target before accessing Firebase: ${args.join(' ')}`, () => {
    const result = spawnSync(process.execPath,['scripts/firebase-staging.mjs','deploy-hosting',...args],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Explicit staging/);
    assert.equal(result.stdout,'');
  });
}
test('release entrypoint exposes exactly the twelve allowed Functions', () => {
  assert.ok(!process.env.FUNCTIONS_EMULATOR && !process.env.FIREBASE_EMULATOR_HUB);
  const require = createRequire(import.meta.url);
  const functions = require('../packages/functions/lib/functionsEntry.js');
  assert.deepEqual(Object.keys(functions).sort(), [
    'createTreeWithRootPerson','getMyTreeSummary','getTreeData','updatePerson',
    'deletePerson','deleteRelationship','reassignParentRelationship',
    'updatePartnerRelationshipStatus','createUnion','addPartnerToPerson',
    'addChildToUnion','addParentToPerson',
  ].sort());
  for (const fn of Object.values(functions)) assert.equal(fn.__endpoint.platform,'gcfv2');
});
for (const project of ['treefamily-staging-2026', 'tree-gen-chenzoap-2026']) {
  test(`cost options are isolated: ${project}`, () => {
    const childEnv = {...process.env, GCLOUD_PROJECT:project};
    delete childEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['-e', `
      const f = require('./packages/functions/lib/functionsEntry.js');
      process.stdout.write(JSON.stringify(Object.values(f).map(fn => fn.__endpoint)));
    `], {encoding:'utf8', env:childEnv});
    assert.equal(result.status,0);
    const endpoints = JSON.parse(result.stdout);
    assert.equal(endpoints.length,12);
    for (const endpoint of endpoints) {
      if (project === 'treefamily-staging-2026') {
        assert.deepEqual(endpoint.region,['us-central1']);
        assert.equal(endpoint.maxInstances,1);
        assert.equal(endpoint.minInstances,0);
        assert.equal(endpoint.concurrency,1);
        assert.equal(endpoint.timeoutSeconds,60);
        assert.equal(endpoint.availableMemoryMb,256);
      } else {
        assert.ok(endpoint.maxInstances == null);
        assert.ok(endpoint.region == null);
      }
    }
  });
}
