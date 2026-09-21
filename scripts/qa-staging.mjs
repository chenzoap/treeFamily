import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const project = 'treefamily-staging-2026';
const config = 'packages/firebase.staging.json';
const args = process.argv.slice(2);
const draftOnly = args[4] === '--case' && args[5] === 'draft';
const finalRun = args[4] === '--case' && args[5] === 'final';
assert.deepEqual(args, ['--project',project,'--config',config,...(draftOnly ? ['--case','draft'] : finalRun ? ['--case','final'] : [])]);
assert.equal(JSON.parse(readFileSync(config)).hosting.site,project);
const origin = `https://${project}.web.app`;
const functionsOrigin = `https://us-central1-${project}.cloudfunctions.net`;
const env = Object.fromEntries(readFileSync('packages/frontend/.env.staging.local','utf8').trim().split('\n').map(l=>l.split('=')));
assert.equal(env.VITE_FIREBASE_PROJECT_ID,project);
const credentialPath = finalRun ? '.staging-qa-final.local' : '.staging-qa.local';
const credentials = existsSync(credentialPath) ? JSON.parse(readFileSync(credentialPath)) : {
  project, email:`qa.staging.${Date.now()}@example.com`, password:randomBytes(24).toString('base64url'), registered:false,
};
assert.equal(credentials.project,project);
writeFileSync(credentialPath,JSON.stringify(credentials),{mode:0o600});
const resultDir = '.staging-qa-results';
mkdirSync(resultDir,{recursive:true});
const results = {project, checks:[], viewports:[], requests:{auth:0,firestore:0,functions:0}, forbidden:[], errors:[]};
const browser = await chromium.launch({headless:true});
const check = label => { results.checks.push(label); console.log('PASS:',label); };
async function prepare(context) {
  await context.route('**/*',async route=>{
    const r=route.request(), u=new URL(r.url());
    const body=r.postData()??'';
    const target=decodeURIComponent(r.url())+' '+body;
    const allowed=[new URL(origin).host,new URL(functionsOrigin).host,`${project}.firebaseapp.com`,'identitytoolkit.googleapis.com','securetoken.googleapis.com','firestore.googleapis.com'];
    const foreignProject=[...target.matchAll(/projects\/([a-z0-9-]+)\//g)].some(m=>m[1]!==project);
    if (!allowed.includes(u.host) || /tree-gen-chenzoap-2026|treefamily\.arsalix\.com|localhost|127\.0\.0\.1/.test(target) || foreignProject || (u.searchParams.has('key')&&u.searchParams.get('key')!==env.VITE_FIREBASE_API_KEY)) {
      results.forbidden.push({host:u.host,path:u.pathname}); return route.abort();
    }
    if(u.host==='identitytoolkit.googleapis.com'||u.host==='securetoken.googleapis.com')results.requests.auth++;
    if(u.host==='firestore.googleapis.com')results.requests.firestore++;
    if(u.origin===functionsOrigin)results.requests.functions++;
    if(u.origin===origin&&u.pathname.startsWith('/assets/')&&u.pathname.endsWith('.js')) {
      const response=await route.fetch(), source=await response.text();
      const local=readFileSync('packages/frontend/dist-staging'+u.pathname,'utf8');
      assert.equal(createHash('sha256').update(source).digest('hex'),createHash('sha256').update(local).digest('hex'));
      const m=source.match(/,([\w$]+)=[\w$]+\(([\w$]+)\),([\w$]+)=[\w$]+\(\2,"us-central1"\),([\w$]+)=[\w$]+\(\2\)/);
      assert.ok(m,'SDK instrumentation requires review');
      return route.fulfill({response,body:source+`;window.__qaServices={db:${m[1]},functions:${m[3]},auth:${m[4]}};`});
    }
    await route.continue();
  });
}
async function inspectSdk(page) {
  const info=await page.evaluate(()=>{
    const {auth,db,functions}=window.__qaServices;
    return {projects:[auth.app.options.projectId,db.app.options.projectId,functions.app.options.projectId],authDomain:auth.app.options.authDomain,db:db._databaseId.database,host:db._settings.host,region:functions.region,emulators:[auth.emulatorConfig,functions.emulatorOrigin]};
  });
  assert.deepEqual(info.projects,[project,project,project]);
  assert.equal(info.authDomain,`${project}.firebaseapp.com`);
  assert.equal(info.db,'(default)');assert.equal(info.host,'firestore.googleapis.com');
  assert.equal(info.region,'us-central1');assert.deepEqual(info.emulators,[null,null]);
}
async function login(page) {
  await page.goto(origin+'/login');
  await page.getByRole('heading',{name:'Inicia sesión'}).waitFor();
  await inspectSdk(page);
  await page.getByLabel(/Correo electrónico/i).fill(credentials.email);
  await page.getByLabel(/^Contraseña$/i).fill(credentials.password);
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await expect(page).toHaveURL(/\/(tree|create-profile)$/,{timeout:90000});
}
const selector=page=>page.getByRole('combobox',{name:'Selecciona una persona'});
const select=async(page,name)=>{await selector(page).selectOption({label:name});await expect(selector(page).locator('option:checked')).toHaveText(name);};
async function draftCheck(page) {
  await select(page,'Alma Ficticia');
  const options = await selector(page).locator('option').evaluateAll(items => items.map(o => ({value:o.value,label:o.textContent})));
  const active = await selector(page).inputValue();
  const target = options.find(o => o.label === 'Bruno Revisado');
  assert.ok(target?.value && target.value !== active);
  await page.getByRole('button',{name:'Editar persona',exact:true}).click();
  const form = page.getByRole('form',{name:'Editar información de la persona'});
  await expect(form.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Alma');
  await expect(form.getByRole('button',{name:'Guardar cambios'})).toBeDisabled();
  await form.getByRole('textbox',{name:'Nombre',exact:true}).fill('Borrador no guardar');
  await expect(form.getByRole('button',{name:'Guardar cambios'})).toBeEnabled();
  await selector(page).selectOption({label:'Bruno Revisado'});
  await expect(page.getByRole('alertdialog',{name:'Tienes cambios sin guardar'})).toBeVisible();
  await page.getByRole('button',{name:'Seguir editando'}).click();
  await expect(form.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Borrador no guardar');
  await expect(selector(page).locator('option:checked')).toHaveText('Alma Ficticia');
  await selector(page).selectOption({label:'Bruno Revisado'});
  await page.getByRole('button',{name:'Descartar y cambiar'}).click();
  await expect(selector(page).locator('option:checked')).toHaveText('Bruno Revisado');
  await expect(form).toHaveCount(0);
  check('draft kept then discarded with explicit confirmation');
}
async function draftRaceRegression(page) {
  await select(page,'Alma Ficticia');
  await page.getByRole('button',{name:'Editar persona',exact:true}).click();
  const form = page.getByRole('form',{name:'Editar información de la persona'});
  await expect(form.getByRole('button',{name:'Guardar cambios'})).toBeDisabled();
  // Deliver a dirty notification and a selection event in the same JS turn.
  // React has no opportunity to commit the parent's setState between them.
  const personSelector = await selector(page).elementHandle();
  await form.evaluate((element, select) => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.memoizedProps?.onDirtyChange !== 'function') fiber = fiber.return;
    if (!fiber) throw new Error('EditPersonForm callback unavailable for race regression');
    const target = [...select.options].find(o => o.textContent === 'Bruno Revisado');
    if (!target || target.value === select.value) throw new Error('Regression requires a different person');
    fiber.memoizedProps.onDirtyChange(true);
    select.value = target.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }, personSelector);
  await personSelector.dispose();
  await expect(page.getByRole('alertdialog',{name:'Tienes cambios sin guardar'})).toBeVisible();
  await page.getByRole('button',{name:'Seguir editando'}).click();
  await expect(selector(page).locator('option:checked')).toHaveText('Alma Ficticia');
  await form.getByRole('button',{name:'Cancelar',exact:true}).click();
  check('regression: dirty notification and selection before React commit');
}
async function visibleNodes(page,names,label) {
  await expect(page.locator('[data-person-id]')).toHaveCount(names.length,{timeout:20000});
  await expect.poll(async()=>page.locator('[data-person-id]').evaluateAll(nodes=>nodes.every(n=>{
    const b=n.getBoundingClientRect(),s=n.ownerSVGElement.getBoundingClientRect();
    return b.width>20&&b.height>10&&b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1&&s.width>100&&s.height>100;
  })),{timeout:15000,message:'All person cards must be inside visible SVG'}).toBe(true);
  for(const name of names)await expect(page.locator('[data-person-id]').filter({has:page.locator('title',{hasText:name})})).toBeVisible();
  const geometry=await page.locator('main svg').evaluate(svg=>({width:svg.getBoundingClientRect().width,height:svg.getBoundingClientRect().height,nodes:svg.querySelectorAll('[data-person-id]').length,paths:svg.querySelectorAll('path').length}));
  if(names.length>1)assert.ok(geometry.paths>0);
  await page.screenshot({path:`${resultDir}/${label}.png`});
  results.viewports.push({label,viewport:page.viewportSize(),...geometry});
  check(label+': visible cards and connectors');
}
try {
  const context=await browser.newContext({viewport:{width:1440,height:900}});await prepare(context);
  const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto(origin+'/login');await page.getByRole('heading',{name:'Inicia sesión'}).waitFor();await inspectSdk(page);
  // Before introducing data: callable must reach staging and reject unauthenticated access.
  const preflight=await page.evaluate(async url=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{}})});return {status:r.status,body:await r.json()};},functionsOrigin+'/getMyTreeSummary');
  assert.equal(preflight.status,401);assert.equal(preflight.body.error.status,'UNAUTHENTICATED');check('pre-data SDK routing and callable auth rejection');
  if (draftOnly) {
    assert.ok(credentials.registered, 'Focused draft QA requires the existing fixture');
    await login(page);
    await select(page,'Bruno Revisado');
    await page.getByRole('button',{name:'Editar persona',exact:true}).click();
    await page.getByRole('textbox',{name:'Lugar de nacimiento',exact:true}).fill(`Lugar ficticio diagnóstico ${Date.now()}`);
    await expect(page.getByRole('button',{name:'Guardar cambios'})).toBeEnabled();
    await page.getByRole('button',{name:'Guardar cambios'}).click();
    await expect(page.getByText('Información actualizada correctamente.')).toBeVisible({timeout:60000});
    await draftCheck(page);
    await draftRaceRegression(page);
    assert.deepEqual(results.forbidden,[]);
    assert.deepEqual(results.errors,[]);
    results.status='PASS';
  } else {
  if(!credentials.registered) {
    await page.goto(origin+'/signup');
    await page.getByLabel(/Correo electrónico/i).fill(credentials.email);
    await page.getByLabel(/^Contraseña$/i).fill(credentials.password);
    await page.getByLabel(/Confirmar contraseña/i).fill(credentials.password);
    await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
    await expect(page).toHaveURL(/\/create-profile$/,{timeout:90000});
    credentials.registered=true;writeFileSync(credentialPath,JSON.stringify(credentials),{mode:0o600});check('signup QA');
  } else await login(page);
  const claims=await page.evaluate(async()=>{const t=await window.__qaServices.auth.currentUser.getIdTokenResult();return {aud:t.claims.aud,iss:t.claims.iss};});
  assert.equal(claims.aud,project);assert.equal(claims.iss,`https://securetoken.google.com/${project}`);check('Auth token audience/issuer staging');
  if(page.url().endsWith('/create-profile')) {
    await page.getByLabel(/Nombre del árbol/i).fill('Familia ficticia QA staging');
    await page.getByLabel(/Tu nombre/i).fill('Alma');
    await page.getByLabel(/^Apellido/i).fill('Ficticia');
    await page.getByLabel(/Fecha de nacimiento/i).fill('1990-01-15');
    await page.getByRole('button',{name:'Crear mi árbol'}).click();
    await expect(page).toHaveURL(/\/tree$/,{timeout:90000});check('create tree/root via callable');
  }
  await selector(page).waitFor({timeout:60000});
  await select(page,'Alma Ficticia');
  let labels=await selector(page).locator('option').allTextContents();
  if(labels.filter(label=>label!=='Selecciona una persona').length===1)await visibleNodes(page,['Alma Ficticia'],'desktop-root');
  for(const [role,name,last]of [['padre','Bruno','Ficticio'],['madre','Clara','Ficticia']]) {
    labels=await selector(page).locator('option').allTextContents();
    if(labels.some(v=>v.startsWith(name+' ')))continue;
    await page.getByRole('button',{name:`Agregar ${role}`,exact:true}).click();
    await page.getByLabel(`Nombre ${role==='padre'?'del padre':'de la madre'}`).fill(name);
    await page.getByRole('textbox',{name:'Apellido',exact:true}).fill(last);
    await page.getByRole('button',{name:`Guardar ${role}`,exact:true}).click();
    await expect(selector(page).locator('option',{hasText:`${name} ${last}`})).toHaveCount(1,{timeout:60000});check('add '+role);
  }
  if(await page.getByRole('button',{name:'Conectarlos',exact:true}).count()) {
    await page.getByRole('button',{name:'Conectarlos',exact:true}).click();
    await expect(page.getByText('Padre y madre conectados como pareja.')).toBeVisible({timeout:60000});check('connect parents');
  }
  labels=await selector(page).locator('option').allTextContents();
  if(!labels.includes('Dario Ficticio')) {
    await page.getByRole('button',{name:'Agregar pareja',exact:true}).click();
    await page.getByLabel('Estado de la relación').selectOption('current');
    await page.getByLabel('Nombre de la pareja',{exact:true}).fill('Dario');
    await page.getByLabel('Apellido',{exact:true}).fill('Ficticio');
    await page.getByRole('button',{name:'Crear y relacionar pareja'}).click();
    await expect(selector(page).locator('option',{hasText:'Dario Ficticio'})).toHaveCount(1,{timeout:60000});check('add partner');
  }
  labels=await selector(page).locator('option').allTextContents();
  if(!labels.includes('Elena Ficticia')) {
    await page.getByRole('button',{name:'Agregar hijo/a',exact:true}).click();
    const options=await page.getByLabel('Conexión familiar').locator('option').evaluateAll(o=>o.map(x=>({value:x.value,text:x.textContent})));
    const pair=options.find(o=>o.text.includes('Dario'));assert.ok(pair);
    await page.getByLabel('Conexión familiar').selectOption(pair.value);
    await page.getByRole('combobox',{name:/^Alma Ficticia/}).selectOption('mother');
    await page.getByRole('combobox',{name:/^Dario Ficticio/}).selectOption('father');
    await page.getByLabel('Nombre del hijo/a').fill('Elena');
    await page.getByRole('textbox',{name:'Apellido',exact:true}).fill('Ficticia');
    await page.getByRole('button',{name:'Guardar hijo/a'}).click();
    await expect(selector(page).locator('option',{hasText:'Elena Ficticia'})).toHaveCount(1,{timeout:60000});check('add child with explicit parent roles');
  }
  labels=await selector(page).locator('option').allTextContents();
  await select(page,labels.includes('Bruno Revisado')?'Bruno Revisado':'Bruno Ficticio');
  await page.getByRole('button',{name:'Editar persona',exact:true}).click();
  // Ensure a real edit also when the original fixture has already been edited.
  await page.getByRole('textbox',{name:'Lugar de nacimiento',exact:true}).fill(`Lugar ficticio QA ${Date.now()}`);
  await page.getByRole('textbox',{name:'Apellido',exact:true}).fill('Revisado');
  await expect(page.getByRole('button',{name:'Guardar cambios'})).toBeEnabled();
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await expect(page.getByText('Información actualizada correctamente.')).toBeVisible({timeout:60000});check('edit person saved');
  await draftCheck(page);
  const deleteTrigger = page.getByRole('button',{name:'Eliminar persona',exact:true});
  await deleteTrigger.focus();
  await page.keyboard.press('Enter');
  const deleteDialog = page.getByRole('dialog',{name:'¿Eliminar a Bruno Revisado?'});
  const cancelDelete = deleteDialog.getByRole('button',{name:'Cancelar',exact:true});
  await expect(cancelDelete).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(deleteDialog.getByRole('button',{name:'Eliminar persona',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancelDelete).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteDialog).toHaveCount(0);
  await expect(deleteTrigger).toBeFocused();
  check('dialog keyboard open, focus trap, Escape and focus restoration');
  const names=['Alma Ficticia','Bruno Revisado','Clara Ficticia','Dario Ficticio','Elena Ficticia'];
  await visibleNodes(page,names,'desktop-family');
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await login(page);
  await visibleNodes(page,names,'desktop-persistence');check('logout/login persists tree and saved edit, excludes draft');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await prepare(mobile);
  const mp=await mobile.newPage();mp.on('pageerror',e=>results.errors.push(e.message));await login(mp);
  await expect(mp.getByRole('tab',{name:'Panel',exact:true})).toBeVisible();
  await select(mp,'Clara Ficticia');
  await mp.getByRole('button',{name:'Editar persona',exact:true}).click();
  await mp.getByRole('textbox',{name:'Nombre',exact:true}).fill('Borrador movil');
  await expect(mp.getByRole('button',{name:'Guardar cambios'})).toBeEnabled();
  await selector(mp).selectOption({label:'Alma Ficticia'});
  await expect(mp.getByRole('alertdialog')).toBeVisible();await mp.getByRole('button',{name:'Seguir editando'}).click();
  await expect(mp.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Borrador movil');
  await mp.getByRole('button',{name:'Cancelar',exact:true}).click();check('mobile draft protection and editing controls');
  for(const width of [390,375,320]) {
    await mp.setViewportSize({width,height:844});
    await mp.getByRole('tab',{name:'Árbol',exact:true}).click();
    await visibleNodes(mp,names,`mobile-${width}`);
    assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
    await mp.getByRole('tab',{name:'Panel',exact:true}).click();await expect(selector(mp)).toBeVisible();
  }
  await mp.getByRole('tab',{name:'Árbol',exact:true}).click();
  await visibleNodes(mp,names,'mobile-return-to-tree');
  assert.ok(results.requests.auth>0&&results.requests.firestore>0&&results.requests.functions>0);
  assert.deepEqual(results.forbidden,[]);assert.deepEqual(results.errors,[]);check('all observed Auth/Firestore/Functions traffic restricted to staging');
  results.status='PASS';
  }
} catch(error) {
  results.status='FAIL';results.failure=String(error);
  for(const [i,context]of browser.contexts().entries())for(const [j,page]of context.pages().entries()) {
    await page.screenshot({path:`${resultDir}/failure-${i}-${j}.png`}).catch(()=>{});
    writeFileSync(`${resultDir}/failure-${i}-${j}.txt`,await page.locator('body').innerText().catch(()=>''));
  }
  console.error(results.failure);process.exitCode=1;
} finally {
  writeFileSync(`${resultDir}/${draftOnly ? 'draft-results' : finalRun ? 'final-results' : 'results'}.json`,JSON.stringify(results,null,2));
  await browser.close();
}
