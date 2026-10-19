/**
 * Miss France 2027 — 45 isolated Playwright player sessions.
 *
 * Default: READ-ONLY. Loads 45 independent browser contexts and reports
 * registration availability without adding a player to Firebase.
 *
 * To register players, you must explicitly opt in with --register AND
 * ALLOW_SHARED_FIREBASE_WRITES=YES. The current TEST environment shares
 * the production Firebase room, so do NOT use --register until the room
 * has been isolated and you intentionally want 45 test accounts.
 *
 * Install (from miss2026-main/):
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/45-players.mjs
 *   node scripts/45-players.mjs --headed
 *   ALLOW_SHARED_FIREBASE_WRITES=YES node scripts/45-players.mjs --register
 */
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://miss2027-test.onrender.com/#/login';
const COUNT = 45;
const BATCH = 5;
const REGISTER = process.argv.includes('--register');
const HEADED = process.argv.includes('--headed');
const EXPLICIT_WRITE = process.env.ALLOW_SHARED_FIREBASE_WRITES === 'YES';

if (!URL.startsWith('https://miss2027-test.onrender.com/') && process.env.ALLOW_CUSTOM_TEST_URL !== 'YES') {
  throw new Error('URL non autorisée : seules les URL TEST sont acceptées par défaut.');
}
if (REGISTER && !EXPLICIT_WRITE) {
  throw new Error('Inscription bloquée : TEST partage Firebase avec la production. Il faut isoler Firebase avant utilisation.');
}
console.log(REGISTER ? 'ATTENTION : inscriptions réelles activées.' : 'Mode lecture seule : aucune inscription ni vote.');
const browser = await chromium.launch({ headless: !HEADED });
const sessions = [];
const results = [];
try {
  for (let start = 0; start < COUNT; start += BATCH) {
    const jobs = Array.from({ length: Math.min(BATCH, COUNT - start) }, (_, i) => start + i + 1);
    await Promise.all(jobs.map(async (number) => {
      const pseudo = 'Test' + String(number).padStart(2, '0');
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      sessions.push({ context, page, pseudo });
      try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const input = page.getByPlaceholder('Ton pseudo');
        await input.waitFor({ timeout: 25000 });
        const status = ((await page.locator('[role="status"]').first().textContent()) || '').trim();
        if (REGISTER) {
          await page.waitForFunction(() => {
            const input = document.querySelector('input[placeholder="Ton pseudo"]');
            return input && !input.disabled;
          }, { timeout: 30000 });
          await input.fill(pseudo);
          await page.getByRole('button', { name: /Participer au concours/i }).click();
          await page.waitForURL(/#\/(player|waiting)/, { timeout: 30000 });
        }
        results.push({ pseudo, ok: true, status: REGISTER ? 'Inscrit' : status });
        console.log(pseudo, REGISTER ? 'inscrit' : 'prêt (lecture seule)', status);
      } catch (error) {
        results.push({ pseudo, ok: false, error: String(error.message).slice(0, 220) });
        console.error(pseudo, 'ERREUR:', error.message);
      }
    }));
  }
  const ok = results.filter(x => x.ok).length;
  console.log('\nRésultat :', ok + '/' + COUNT, REGISTER ? 'inscriptions' : 'sessions ouvertes');
  if (REGISTER) {
    console.log('Les 45 contextes restent ouverts jusqu’à Entrée, pour tester les votes manuellement.');
    if (process.stdin.isTTY) {
      await new Promise(resolve => {
        process.stdin.resume();
        process.stdin.once('data', resolve);
      });
    }
  }
  if (ok !== COUNT) process.exitCode = 1;
} finally {
  await Promise.all(sessions.map(x => x.context.close().catch(() => {})));
  await browser.close();
}
