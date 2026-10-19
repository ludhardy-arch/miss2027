# Test isolé : 45 joueurs / trois tours

Ce dispositif fonctionne **sur ton ordinateur**, avec Firebase Emulator. Il ne doit PAS viser
`miss2027-test.onrender.com`, car ce site partage actuellement les données de la production.

## Installation, après téléchargement de la branche `auth-2027-preparation`

Dans le dossier `miss2026-main`, ouvre PowerShell :

```powershell
npm.cmd install
npm.cmd install --no-save playwright
npx.cmd playwright install chromium
```

Il faut aussi la CLI Firebase. Tu peux la lancer avec `npx.cmd firebase-tools` sans installation globale.

## Exécution : trois fenêtres PowerShell ouvertes dans `miss2026-main`

**Fenêtre A — services Firebase locaux**

```powershell
npx.cmd firebase-tools emulators:start --only auth,database --project miss2027
```

Cela démarre deux serveurs locaux aux ports 9099 (Auth) et 9000 (Realtime Database).
Le fait d'utiliser l'identifiant du projet dans la commande ne déploie rien : tous
les accès sont redirigés vers les émulateurs locaux.

**Fenêtre B — copie locale du site**

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --mode loadtest
```

La variable `VITE_USE_FIREBASE_EMULATORS=true` est définie uniquement par
`.env.loadtest.local`. Le fichier `src/firebase.js` n'active les émulateurs qu'en
mode Vite développement.

**Fenêtre C — 45 joueurs**

```powershell
node scripts/45-players-local.mjs
```

Pour voir les fenêtres, utilise `node scripts/45-players-local.mjs --headed`.

## Déroulement

Le script initialise la base **locale**, inscrit les joueurs `Test01` à `Test45`,
ouvre successivement les trois tours et fait voter chaque joueur. Il attend que
chaque joueur arrive sur la page d'attente avant le tour suivant.
Tout est détruit lorsque les émulateurs locaux sont arrêtés (sauf export explicite).

**Précautions :** Ne change jamais les URL locales du script pour des URL Render.
N'utilise jamais `--register` avec l'ancien script contre le site en ligne.
Le script n'a pas encore été exécuté ni validé sur l'ordinateur de l'utilisateur.
