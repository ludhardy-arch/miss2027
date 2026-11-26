# Reprise Miss2027 — environnement de test uniquement

## Règle absolue
Ne pas toucher à main, au site miss2027.onrender.com, au Firebase officiel, aux inscriptions ou pronostics officiels. Les deux services de test doivent pointer vers la branche auth-2027-preparation et exclusivement le Firebase miss2027-test-v2. Ne jamais copier de secret dans GitHub ni dans le chat.

## État du code
- Inscriptions privées et publiques (30 joueurs maximum par salle publique), une appartenance par UID, récupération navigateur, recherche avec mot de passe, création via email vérifié.
- Gestion du propriétaire : accès récent par email vérifié et mot de passe du groupe, puis session de gestion serveur 15 minutes ; liste actualisable, renommage, ouverture/fermeture, retrait avant verrouillage, lien direct secret et révocable (nouveau lien invalide le précédent).
- Ouverture du premier vote via la régie serveur : verrouillage des appartenances jusqu'à remise à zéro du jeu. Pas de retrait ni de nouvelles inscriptions après verrouillage ; reconnexion possible pour les inscrits.
- Votes par UID et tour : 12 + favori, 5, classement ordonné de 5 ; validation atomique et retry idempotent.
- Chat de chaque salle avec messages administrateur identifiés côté serveur, avertissement privé, blocage/déblocage national, conservation des 120 derniers messages par salle (80 visibles dans la lecture). Modération propriétaire non raccordée.
- Finale : calcul serveur atomique à partir du barème existant et des résultats officiels, publication seule après fermeture et classement officiel ; classement local, rang national personnel et podium national. Joueurs ayant voté au moins un tour éligibles, points des tours effectivement joués ; ex aequo 1,1,3. Conservation de l'animation existante avec adaptations pour groupes vides et ex aequo.
- Réinitialisations séparées avec confirmation : jeu (garde inscriptions et chats), inscriptions (exige d'abord remise à zéro du jeu).

## Vérifications effectuées
31 scénarios unitaires de logique pure exécutés avec succès sur les fichiers récupérés depuis GitHub dans un environnement JavaScript isolé (assertions équivalentes, pas Node/Firebase). Syntaxe JS serveur contrôlée. Présence des raccords UI contrôlée par inspection. Pas de compilation Vite ni test navigateur ni test des règles Firebase, ni test de charge. La limite globale provisoire est 1500 appels/minute, ce n'est pas une capacité garantie.

## Suite obligatoire avant mise en service
1. Confirmer l'espace Render et inspecter UNIQUEMENT miss2027-test et miss2027-test-api, leurs branches et leur dernier déploiement. Ne pas toucher au service officiel. La branche test-multigroupes est une ancienne maquette ; la branche avancée identifiée est auth-2027-preparation.
2. Compiler le front et lancer npm test dans multigroup/server, ainsi que node --test multigroup/finalResults.test.js depuis miss2026-main.
3. Contrôler les règles RTDB effectivement déployées sur le Firebase test (pas de lecture cliente des registres, secrets, votes d'autrui ou résultats non publiés ; régie test authentifiée). Tester via émulateur et tests d'accès réels.
4. Test Safari avec plusieurs identités et groupes : invitation, reconnexion, votes, chat, avertissement/blocage, classement/show, les deux resets (seulement données de test). Tester les erreurs réseau, e-mails en français et quota, session propriétaire, accès par lien sur un autre appareil.
5. Mesurer la charge, notamment transactions racine et lectures périodiques ; adapter architecture/limites au nombre réel de joueurs. Aucun changement en production avant validation explicite de l'utilisateur.
