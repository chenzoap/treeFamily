import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const project = 'treefamily-staging-2026';
const config = 'packages/firebase.staging.json';
assert.deepEqual(process.argv.slice(2), ['--project', project, '--config', config]);
assert.equal(JSON.parse(readFileSync(config)).hosting.site, project);
const origin = `https://${project}.web.app`;
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  const prohibited = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (/tree-gen-chenzoap-2026|treefamily\.arsalix\.com|127\.0\.0\.1|localhost/.test(url + (request.postData() ?? ''))) {
      prohibited.push(new URL(url).hostname);
      return route.abort();
    }
    if (url.startsWith(`${origin}/assets/`) && url.endsWith('.js')) {
      const response = await route.fetch();
      const source = await response.text();
      const filename = new URL(url).pathname.split('/').at(-1);
      assert.ok(readdirSync('packages/frontend/dist-staging/assets').includes(filename));
      const local = readFileSync(`packages/frontend/dist-staging/assets/${filename}`, 'utf8');
      assert.equal(createHash('sha256').update(source).digest('hex'), createHash('sha256').update(local).digest('hex'));
      // Observe initialized SDK objects in this browser only; deployed bytes remain unchanged.
      const match = source.match(/,([\w$]+)=[\w$]+\(([\w$]+)\),([\w$]+)=[\w$]+\(\2,"us-central1"\),([\w$]+)=[\w$]+\(\2\)/);
      assert.ok(match, 'Could not locate initialized SDK objects; review build before updating probe');
      const [,db,,functions,auth] = match;
      const probe = `;window.__stagingProbe={authProject:${auth}.app.options.projectId,authDomain:${auth}.app.options.authDomain,authEmulator:${auth}.emulatorConfig,firestoreProject:${db}.app.options.projectId,firestoreDatabase:${db}._databaseId.database,firestoreHost:${db}._settings.host,functionsProject:${functions}.app.options.projectId,functionsRegion:${functions}.region,functionsEmulator:${functions}.emulatorOrigin};`;
      return route.fulfill({response, body:source+probe});
    }
    return route.continue();
  });
  const response = await page.goto(`${origin}/login`);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', {name:'Inicia sesión'}).waitFor();
  const sdk = await page.evaluate(()=>window.__stagingProbe);
  for (const key of ['authProject','firestoreProject','functionsProject']) assert.equal(sdk[key],project);
  assert.equal(sdk.authDomain, `${project}.firebaseapp.com`);
  assert.equal(sdk.firestoreDatabase, '(default)');
  assert.equal(sdk.firestoreHost, 'firestore.googleapis.com');
  assert.equal(sdk.functionsRegion, 'us-central1');
  assert.equal(sdk.authEmulator, null);
  assert.equal(sdk.functionsEmulator, null);
  assert.deepEqual(errors, []);
  assert.deepEqual(prohibited, []);
  console.log(JSON.stringify({url:origin, sdk, pageErrors:errors, forbiddenRequests:prohibited, status:'SDK routing verified before data creation; full QA pending deployed Functions'},null,2));
} finally {
  await browser.close();
}
