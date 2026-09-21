import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const project = 'treefamily-staging-2026';
const config = 'packages/firebase.staging.json';
const args = process.argv.slice(2);
if (args[1] !== '--project' || args[2] !== project || args[3] !== '--config' || args[4] !== config || args.length !== 5) {
  throw new Error('Explicit staging --project and --config required');
}
const staging = JSON.parse(readFileSync(config));
const canonical = JSON.parse(readFileSync('packages/firebase.json'));
if (staging.hosting.site !== project || staging.hosting.public !== 'frontend/dist-staging' ||
    JSON.stringify(staging.firestore) !== JSON.stringify(canonical.firestore) ||
    JSON.stringify(staging.functions) !== JSON.stringify(canonical.functions)) {
  throw new Error('Staging config does not match isolated release contract');
}
const remote = (command) => {
  const output = execFileSync('firebase', [...command, '--project', project, '--config', config, '--non-interactive', '--json'], {encoding:'utf8'});
  // predeploy npm hooks precede the CLI JSON envelope on stdout.
  const envelope = [...output.matchAll(/\{\s*"status"\s*:/g)].at(-1);
  if (!envelope) throw new Error('Firebase returned no JSON status envelope');
  const response = JSON.parse(output.slice(envelope.index));
  if (response.status !== 'success') throw new Error('Firebase operation did not succeed');
  return response.result;
};
const projects = remote(['projects:list']);
const identity = projects.find(p => p.projectId === project);
if (identity?.projectNumber !== '233536230940' || identity.displayName !== 'TreeFamily Staging' || identity.state !== 'ACTIVE') {
  throw new Error('Staging remote identity mismatch');
}
console.log('Verified staging identity:', identity.projectId, identity.projectNumber);
switch (args[0]) {
  case 'service-status':
  case 'enable-firestore':
  case 'verify-rules':
  case 'cost-status': {
    // Reuse the installed CLI's session entirely in memory. Never export tokens.
    const require = createRequire('/usr/lib/node_modules/firebase-tools/lib/bin/firebase.js');
    const auth = require('../auth');
    const options = {project, nonInteractive:true};
    auth.setActiveAccount(options, auth.getGlobalDefaultAccount());
    await require('../requireAuth').requireAuth(options);
    if (args[0] === 'enable-firestore') {
      await require('../ensureApiEnabled').ensure(project, 'firestore.googleapis.com', 'staging');
      console.log('Firestore API enabled for staging');
    } else if (args[0] === 'verify-rules') {
      const { Client } = require('../apiv2');
      const client = new Client({urlPrefix:'https://firebaserules.googleapis.com', apiVersion:'v1'});
      const release = (await client.get(`projects/${project}/releases/cloud.firestore`)).body;
      const ruleset = (await client.get(release.rulesetName)).body;
      const actual = ruleset.source.files;
      const expected = readFileSync('packages/firebase/firestore.rules', 'utf8');
      if (!actual.some(f => f.content === expected)) throw new Error('Deployed rules differ from canonical rules');
      console.log('Deployed Firestore rules match canonical source:', release.name);
    } else if (args[0] === 'cost-status') {
      const { Client } = require('../apiv2');
      const client = new Client({urlPrefix:'https://artifactregistry.googleapis.com', apiVersion:'v1'});
      const repo = (await client.get(`projects/${project}/locations/us-central1/repositories/gcf-artifacts`)).body;
      console.log(JSON.stringify({repository:repo.name,cleanupPolicies:repo.cleanupPolicies,dryRun:repo.cleanupPolicyDryRun ?? false}));
    } else {
      console.log('billingEnabled:', await require('../gcp/cloudbilling').checkBillingEnabled(project));
      const c = await require('../gcp/identityPlatform').getConfig(project);
      console.log(JSON.stringify({name:c.name, emailPassword:c.signIn?.email, authorizedDomains:c.authorizedDomains}));
    }
    break;
  }
  case 'deploy-auth':
    console.log(remote(['deploy', '--only', 'auth']));
    break;
  case 'create-app': {
    const apps = remote(['apps:list', 'WEB']);
    if (apps.length) throw new Error('An app already exists; inspect before reusing');
    console.log(remote(['apps:create', 'WEB', 'TreeFamily Staging Web']));
    break;
  }
  case 'create-database':
    console.log(remote(['firestore:databases:create', '(default)', '--location', 'nam5', '--edition', 'standard']));
    break;
  case 'inventory':
    for (const cmd of [['apps:list'], ['firestore:databases:list'], ['hosting:sites:list']]) console.log(cmd[0], JSON.stringify(remote(cmd)));
    break;
  case 'functions-inventory': {
    const list = remote(['functions:list']);
    const expected = ['createTreeWithRootPerson','getMyTreeSummary','getTreeData','updatePerson','deletePerson','deleteRelationship','reassignParentRelationship','updatePartnerRelationshipStatus','createUnion','addPartnerToPerson','addChildToUnion','addParentToPerson'];
    if (list.length !== 12 || list.some(f => !expected.includes(f.id) || f.project !== project || f.region !== 'us-central1' || f.state !== 'ACTIVE' || f.runtime !== 'nodejs24' || f.maxInstances !== 1 || (f.minInstances ?? 0) !== 0 || f.concurrency !== 1 || f.availableMemoryMb !== 256 || f.timeoutSeconds !== 60)) throw new Error('Remote Functions inventory or resource limits mismatch');
    console.log(JSON.stringify(list.map(f => ({name:f.id,project:f.project,region:f.region,state:f.state,runtime:f.runtime,minInstances:f.minInstances ?? 0,maxInstances:f.maxInstances,memoryMiB:f.availableMemoryMb,cpu:f.cpu,concurrency:f.concurrency,timeoutSeconds:f.timeoutSeconds}))));
    break;
  }
  case 'web-config': {
    const apps = remote(['apps:list', 'WEB']);
    if (apps.length !== 1 || apps[0].displayName !== 'TreeFamily Staging Web') throw new Error('Unexpected web app');
    const result = remote(['apps:sdkconfig', 'WEB', apps[0].appId]);
    const sdk = typeof result.sdkConfig === 'string' ? JSON.parse(result.sdkConfig) : result.sdkConfig;
    if (sdk.projectId !== project || sdk.messagingSenderId !== '233536230940' || sdk.appId !== apps[0].appId) throw new Error('SDK identity mismatch');
    const values = {PROJECT_ID:sdk.projectId, API_KEY:sdk.apiKey, AUTH_DOMAIN:sdk.authDomain, MESSAGING_SENDER_ID:sdk.messagingSenderId, APP_ID:sdk.appId};
    writeFileSync('packages/frontend/.env.staging.local', Object.entries(values).map(([k,v])=>`VITE_FIREBASE_${k}=${v}`).join('\n')+'\n', {mode:0o600});
    console.log('Wrote ignored staging web configuration');
    break;
  }
  case 'deploy-hosting':
    execFileSync('npm', ['run', 'build:staging', '-w', 'packages/frontend'], {stdio:'inherit'});
    console.log(remote(['deploy', '--only', 'hosting']));
    break;
  case 'deploy-functions': {
    const require = createRequire('/usr/lib/node_modules/firebase-tools/lib/bin/firebase.js');
    const auth = require('../auth');
    const options = {project, nonInteractive:true};
    auth.setActiveAccount(options, auth.getGlobalDefaultAccount());
    await require('../requireAuth').requireAuth(options);
    if (!await require('../gcp/cloudbilling').checkBillingEnabled(project)) throw new Error('Staging requires user-managed Blaze activation; billing will not be linked automatically');
    if (process.env.FIREBASE_EMULATOR_HUB || process.env.FUNCTIONS_EMULATOR) throw new Error('Emulator environment forbidden for release');
    console.log(remote(['deploy', '--only', 'functions']));
    break;
  }
  case 'artifact-policy':
    console.log(remote(['functions:artifacts:setpolicy', '--location', 'us-central1', '--days', '1', '--force']));
    break;
  case 'deploy-rules':
    console.log(remote(['deploy', '--only', 'firestore:rules,firestore:indexes']));
    break;
  default: throw new Error('Unsupported staging action');
}
