import { chromium } from 'playwright';

const SITE = 'http://127.0.0.1:5173/#/login';
const DATABASE = 'http://127.0.0.1:9000/.json?ns=miss2027-default-rtdb&auth=owner';
const COUNT = 45;
const BATCH = 5;
const makeWait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function seed(state) {
  const result = await fetch(DATABASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
  if (!result.ok) throw new Error('Emulator database initialization failed: ' + result.status);
}
async function setValue(key, data) {
  const url = 'http://127.0.0.1:9000/rooms/miss2027/' + key + '.json?ns=miss2027-default-rtdb&auth=owner';
  const result = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!result.ok) throw new Error('Emulator write failed: ' + key + ' HTTP ' + result.status);
}
async function checkLocal() {
  const web = await fetch('http://127.0.0.1:5173').catch(() => null);
  if (!web?.ok) throw new Error('Démarre Vite sur 127.0.0.1:5173 (mode loadtest) avant le script.');
  const db = await fetch('http://127.0.0.1:9000/.settings/rules.json?ns=miss2027-default-rtdb').catch(() => null);
  if (!db) throw new Error('Démarre Firebase Database Emulator sur 127.0.0.1:9000.');
}
await checkLocal();
const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const sessions = [];
let successes = 0;
try {
  await seed({ rooms: { miss2027: {
    players: {}, adminSelections: { tour1: [], tour2: [], tour3: [] },
    votesOpen: false, connectionsOpen: true, tour: 1, finaleStarted: false, gameId: 'local-45'
  } } });
  console.log('45 inscriptions en local (aucune écriture Firebase en ligne).');
  for (let base = 0; base < COUNT; base += BATCH) {
    await Promise.all(Array.from({ length: Math.min(BATCH, COUNT - base) }, (_, i) => base + i + 1).map(async number => {
      const pseudo = 'Test' + String(number).padStart(2,'0');
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('dialog', d => d.accept().catch(() => {}));
      sessions.push({ pseudo, page, context });
      await page.goto(SITE, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('Ton pseudo').waitFor();
      await page.waitForFunction(() => !document.querySelector('input[placeholder="Ton pseudo"]').disabled, { timeout: 45000 });
      await page.getByPlaceholder('Ton pseudo').fill(pseudo);
      await page.getByRole('button', { name: /Participer au concours/i }).click();
      await page.waitForURL(/#\/(player|waiting)/, { timeout: 45000 });
      console.log('INSCRIT', pseudo);
    }));
  }
  for (const [tour, count, selection] of [[1,12,null],[2,5,Array.from({length:12},(_,i)=>i+1)],[3,5,Array.from({length:5},(_,i)=>i+1)]]) {
    console.log('\nDébut du tour',tour);
    await setValue('tour',tour);
    if (tour === 2) await setValue('adminSelections/tour1',selection);
    if (tour === 3) await setValue('adminSelections/tour2',selection);
    await setValue('votesOpen',true);
    await makeWait(1500);
    let done = 0;
    for (let base = 0; base < COUNT; base += BATCH) {
      await Promise.all(sessions.slice(base,base+BATCH).map(async ({ page, pseudo }) => {
        await page.goto('http://127.0.0.1:5173/#/player');
        await page.locator('.miss-card').first().waitFor({ timeout: 30000 });
        if (tour !== 3) {
          const cards = page.locator('.miss-card');
          for(let k=0;k<count;k++) await cards.nth(k).click();
          await page.getByRole('button',{name:'Valider mon vote'}).click();
        } else {
          const cards = page.locator('.miss-card');
          for(let k=0;k<count;k++) await cards.nth(k).locator('select').selectOption(String(k+1));
          await page.getByRole('button',{name:'Valider mon classement'}).click();
        }
        await page.waitForURL(/#\/waiting/, { timeout: 30000 });
        done++;
        console.log('TOUR',tour,pseudo,'OK');
      }));
    }
    await setValue('votesOpen',false);
    console.log('Tour',tour,'terminé :',done+'/'+COUNT);
    if(done!==COUNT)throw Error('Votes incomplets');
  }
  successes = COUNT;
  console.log('\nSUCCÈS — 45 joueurs inscrits et 3 tours de votes réalisés DANS LES ÉMULATEURS LOCAUX.');
} catch(error) {
  console.error('\nÉCHEC:', error.message);
  process.exitCode = 1;
} finally {
  await Promise.all(sessions.map(s=>s.context.close().catch(()=>{})));
  await browser.close();
}
