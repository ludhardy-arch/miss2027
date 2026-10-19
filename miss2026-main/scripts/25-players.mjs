/**
 * MISS FRANCE 2027 — 25 player browser simulation.
 *
 * Safe default: checks 25 pages on public TEST, no Firebase writes.
 * Full mode is strictly LOCAL and requires Firebase Auth + RTDB EMULATORS,
 * a locally running Vite dev server and explicit --local-emulator.
 *
 * Local example:
 *   npx.cmd firebase-tools emulators:start --only auth,database --project demo-miss2027
 *   VITE_USE_FIREBASE_EMULATORS=true npm run dev
 *   node scripts/25-players.mjs --local-emulator --headed
 *
 * Keep the admin page open separately in a browser at http://127.0.0.1:5173.
 * Use the local Firebase Auth Emulator for admin login, with admin UID
 * matching VITE_ADMIN_UID. Never change production data.
 */
import { chromium } from 'playwright';
import readline from 'node:readline/promises';
import process from 'node:process';

const COUNT = 25, CONCURRENCY = 5;
const local = process.argv.includes('--local-emulator');
const headed = process.argv.includes('--headed');
const base = local ? 'http://127.0.0.1:5173' : 'https://miss2027-test.onrender.com';
const browser = await chromium.launch({ headless: !headed });
const sessions = [];
const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
const pause = async message => { await prompt.question('\n' + message + ' — Entrée pour continuer : '); };
const path = page => new URL(page.url()).hash;
const waitFor = (p, f, timeout = 60000) => p.waitForFunction(f, { timeout });
const report = (s, txt) => console.log(s.pseudo.padEnd(9), txt);
async function batches(items, task) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(async s => {
      try { await task(s); } catch(e) { s.errors.push(e.message); report(s, 'ÉCHEC ' + e.message); }
    }));
  }
}
try {
  for (let n = 1; n <= COUNT; n++) {
    const pseudo = 'Test' + String(n).padStart(2, '0');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    sessions.push({ pseudo, context, page, errors: [] });
  }
  await batches(sessions, async s => {
    await s.page.goto(base + '/#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await s.page.getByPlaceholder('Ton pseudo').waitFor();
    if (local) {
      // Prevent running against the real Firebase by requiring emulator-only network use.
      // Local Vite must be started with VITE_USE_FIREBASE_EMULATORS=true.
      const source = await s.page.evaluate(async () => {
        const response = await fetch('/src/firebase.js');
        return response.text();
      });
      if (!source.includes('connectDatabaseEmulator') || !source.includes('connectAuthEmulator')) {
        throw new Error('Le serveur local ne fournit pas la configuration des émulateurs.');
      }
    }
    report(s, 'page ouverte');
  });
  if (!local) {
    console.log('Lecture seule : ' + sessions.filter(s => !s.errors.length).length + '/25 pages ouvertes. Aucun joueur inscrit.');
  } else {
    console.log('\nMODE LOCAL : vérifier que la base Auth et RTDB sont deux émulateurs, sans accès au vrai Firebase.');
    await pause('Dans la fenêtre ADMIN locale, ouvre les connexions');
    await batches(sessions.filter(s => !s.errors.length), async s => {
      await s.page.getByPlaceholder('Ton pseudo').waitFor({ state: 'visible' });
      await waitFor(s.page, () => {
        const el = document.querySelector('input[placeholder="Ton pseudo"]');
        return el && !el.disabled;
      });
      await s.page.getByPlaceholder('Ton pseudo').fill(s.pseudo);
      await s.page.getByRole('button', { name: /Participer au concours/i }).click();
      await s.page.waitForURL(/#\/(player|waiting)/, { timeout: 45000 });
      report(s, 'inscrit');
    });
    console.log('Inscriptions terminées. Fais ton suivi dans la page administrateur locale.');
    for (const [tour, count] of [[1, 12], [2, 5], [3, 5]]) {
      await pause('ADMIN LOCAL : place le jeu au tour ' + tour + ', ouvre les votes');
      await batches(sessions.filter(s => !s.errors.length), async s => {
        const p=s.page;
        await p.waitForURL(/#\/(player|waiting)/, { timeout:60000 });
        await p.waitForFunction(n => document.querySelector('.tv-tour-tag')?.textContent?.includes('Tour '+n) || document.body.innerText.includes('Tour '+n), tour, { timeout:60000 });
        await p.getByRole('button', { name: /Valider mon (vote|classement)/i }).waitFor({ state: 'visible' });
        await waitFor(p, () => {
          const b=Array.from(document.querySelectorAll('button')).find(e => /Valider mon (vote|classement)/i.test(e.textContent));
          return b && !b.disabled;
        });
        const cards = p.locator('.grid .miss-card');
        await cards.first().waitFor();
        if (tour < 3) {
          const available=await cards.count();
          if (available < count) throw new Error('Pas assez de candidates : '+available);
          const idx=Array.from({length:available},(_,i)=>i).sort((a,b)=>((a*7+s.pseudo.length*3)%available)-((b*7+s.pseudo.length*3)%available)).slice(0,count);
          for(const j of idx) await cards.nth(j).click();
          await p.getByRole('button',{name:'Valider mon vote'}).click();
        } else {
          if(await cards.count()!==5) throw new Error('La finale attend 5 candidates');
          for(let j=0;j<5;j++) await cards.nth(j).locator('select').selectOption(String(j+1));
          await p.getByRole('button',{name:'Valider mon classement'}).click();
        }
        await p.waitForURL(/#\/waiting/, {timeout:45000});
        report(s, 'tour '+tour+' voté');
      });
      console.log('Tour '+tour+' : '+sessions.filter(s=>!s.errors.length).length+' joueurs sans erreur.');
      await pause('ADMIN LOCAL : vérifie les résultats, ferme les votes, prépare les sélections pour le tour suivant');
    }
  }
  console.log('\nBILAN : ' + sessions.filter(s=>!s.errors.length).length + '/25 sessions sans erreur.');
  sessions.filter(s=>s.errors.length).forEach(s=>console.log(s.pseudo, s.errors.join(' | ')));
  if (headed && process.stdin.isTTY) await pause('Inspecte les fenêtres si nécessaire');
} finally {
  prompt.close();
  await Promise.all(sessions.map(s=>s.context.close().catch(()=>{})));
  await browser.close();
}
