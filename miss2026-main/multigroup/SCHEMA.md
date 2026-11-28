# V2 multigroupes — contrat de données proposé (test uniquement)

Aucun import/migration de rooms/miss2027. Aucun accès à la production.
Le projet Firebase de test reste à créer/configurer. Ce document n'est pas une règle de sécurité déployable.
Les écrans actuels ne sont pas raccordés à ce modèle à ce stade.

## Arborescence RTDB

Sous events/{eventId} (identifiant immuable d'une édition/partie) :

| Chemin | Données |
| --- | --- |
| control | gameId, connectionsOpen, demoEnabled, tour, votesOpen, finaleStarted, phase de finale |
| officialSelections | tour1, tour2, tour3 ; écriture régie exclusivement |
| players/{uid} | pseudo, createdAt, statut ; UID Firebase Auth, jamais le pseudo comme clé |
| votes/{uid} | tour1, favorite, tour2, tour3 ; une seule fois par identité |
| groups/{groupId} | name, type private/public, ownerUid si privé, inscriptions ouvertes, capacité |
| groupDirectory/{groupId} | nom affichable/recherchable si autorisé ; jamais d'adresse mail ni de secret |
| groupMembers/{groupId}/{uid} | true, appartenance active |
| playerGroup/{uid} | groupId unique, index inverse (privé OU public) |
| chats/{groupId}/{messageId} | uid, pseudo affiché, texte, date, état de modération |
| results/{version}/groups/{groupId} | classement local figé, accès membres |
| results/{version}/players/{uid} | score, rang national, total national, identifiant et rang du groupe |
| results/{version}/nationalTop | podium national et ex aequo, sans votes ni liste complète |
| control/resultsVersion | version publiée, basculée après préparation complète des résultats |

Les données de vérification des invitations et mots de passe de groupe doivent être séparées des données lisibles par les clients. Vérification côté serveur (hachage adapté aux mots de passe, limitation des tentatives, invitation révocable). Le mot de passe du compte créateur relève de Firebase Auth et ne doit jamais être enregistré en clair dans RTDB.

Les index d'appartenance doivent être cohérents : écritures groupées par un service de confiance, avec allocation atomique des places publiques (30 maximum) et contrôle obligatoire d'un seul groupe par UID, privé ou public. La recherche ne doit pas divulguer les participants ni les secrets. Un UID ne peut appartenir qu'à un seul groupe. Pas de duplication des votes.

## Identité et droits

- Anonyme : UID stable sur le navigateur tant que l'identité est conservée. Prévoir la persistance locale et la reconnexion au même groupe sans recréer l'utilisateur. Aujourd'hui la persistance est par onglet.
- Créateur : compte email/mot de passe. Si déjà anonyme, lier le compte ou prévoir une migration contrôlée, sans perdre ses votes.
- Administrateur national : rôle vérifié côté serveur, distinct des créateurs.
- Créateur : modération et gestion de ses membres, aucun accès aux votes des autres, au barème ou à la régie.
- UID unique ne garantit pas une personne physique unique : autres appareils ou effacement du stockage restent un risque. Politique de récupération et anti-multicomptes à décider.
- Règles RTDB à concevoir puis tester : accès minimal par chemin, votes validés par tour ouvert, verrouillage des champs, aucun accès aux votes d'autrui, résultats non lisibles avant publication, contrôles de rôle et d'appartenance. Ne pas autoriser toute la base aux utilisateurs authentifiés.

## Finale

Une régie unique. À la fin, figer officiellement résultats, votes, éligibilité et appartenance; empêcher des modifications pendant le calcul. Le moteur pur finalResults.js réutilise le barème existant et calcule les points de chaque UID une seule fois. Les classements locaux filtrent les scores nationaux selon les membres de chaque groupe. Proposition de rangs ex aequo 1,1,3; le tri alphabétique est une présentation, pas un départage.

Calcul et publication à effectuer par un backend de confiance, jamais en téléchargeant tous les votes nationaux chez chaque joueur. Publier les vues nécessaires et basculer resultsVersion une fois le calcul terminé. Prévoir reprise/idempotence du calcul. Une seule révélation nationale par session du show.

Show local du groupe unique avec animations actuelles, puis rang national personnel et lauréat(s). Pour un groupe seul, vide, ou ex aequo, prévoir scène adaptée.

## Décisions encore ouvertes

- Autorisation de rejoindre des groupes après début du vote (recommandation : figer les appartenances pour le classement avant ouverture du premier tour; à valider).
- Éligibilité des inscrits n'ayant pas joué, votes partiels et départage final (le calculateur demande explicitement eligibleUids).
- Visibilité dans la recherche, récupération des invités sur autre appareil, changement éventuel de groupe avant le premier tour. Un seul groupe par joueur est validé.
- Mise en place d'un backend de confiance, règles Firebase, authentification créateurs, déploiement, capacité et tests de charge.

## Test unitaire

Depuis miss2026-main : node --test multigroup/finalResults.test.js

Les tests ne contactent pas Firebase. La validation du moteur ne valide pas les règles, la concurrence des inscriptions, les droits, ni la compatibilité de l'interface.

## Accueil — décision du 26 novembre

Sans invitation : trois boutons uniquement, aucun champ pseudo initial. Accéder au concours en salle publique dans : + chrono, puis bouton vert dès ouverture par la régie. Rejoindre un groupe. Créer / Gérer son groupe. Pseudo uniquement après choix de jouer/rejoindre. Avec invitation : bienvenue dans le groupe (nom issu de la vérification serveur), pseudo, accès/chrono. Aucun bouton deuxième groupe. Le code de recherche et gestion et l'attribution effective du groupe doivent être raccordés au backend avant activation. Couronnes, instructions, démo et accès admin inchangés.

## Brouillon des règles

`database.rules.draft.json` est un brouillon non déployé. Toutes les écritures clientes sont refusées par défaut. Les lectures sont limitées aux données publiques de l'événement, au joueur connecté, à son groupe et aux résultats publiés. Ce fichier ne fonctionne pas avec l'ancien AppContext ni avec l'ancienne régie. Ne pas le déployer avant d'avoir raccordé les fonctions serveur de confiance, testé les règles sur émulateur et créé le Firebase indépendant. Le moteur de recherche, la validation d'invitation et les opérations de création/attribution sont volontairement non raccordés à l'étape de la maquette d'accueil.

## Optimisation Firebase — branche test-optimisation-firebase

- Le chat hérité côté joueur écoute les 100 dernières clés de messages (ordre des push Firebase), sans se réabonner quand la bulle est ouverte ou fermée. Aucun message n'est effacé, la régie conserve son historique complet. Vérifier les avertissements ciblés, les reconnexions et les badges avant toute activation.
- `trendSnapshot.js` prépare une synthèse par groupe (tour, inscrits, votes validés, compteurs par candidate), destinée à être calculée dans un backend de confiance. Le test couvre 1 000 votes synthétiques, la pondération de la finale, les groupes et les votes invalides. Le calcul ne remplace pas le barème des pronostics et n'est pas raccordé à Firebase ni à l'interface.
- Proposition : publier les synthèses sous `events/{eventId}/trends/{groupId}`, lecture réservée aux membres, écriture exclusivement serveur. Regrouper les publications fréquentes (intervalle initial à tester de 1 à 2 secondes), utiliser une version liée au tour et à la partie et empêcher une publication obsolète d'écraser une version récente. Ne pas déployer de règles sans tests émulateur. Les votes individuels restent enregistrés immédiatement et indépendamment.
- La finale doit utiliser les résultats figés côté serveur, sans réutiliser les tendances. Ne supprimer la lecture de tous les joueurs du client qu'après raccordement et tests des tendances, des résultats et de la reconnexion. Le test de charge réel doit utiliser un Firebase indépendant et un plafond de consommation contrôlé. Aucun changement de la production, du forfait ou des données réelles.
- Lancer les tests purs depuis `miss2026-main` : `node --test multigroup/trendSnapshot.test.js multigroup/finalResults.test.js`.

### Publication des tendances sur changement
`trendPublisher.js` implémente une fenêtre fixe de 2 secondes après la première notification, sans minuterie ni lecture en période inactive. Les changements reçus pendant une publication déclenchent une nouvelle fenêtre. Une synthèse identique à la dernière publication réussie dans le processus n'est pas réécrite. Les erreurs entraînent une nouvelle tentative espacée ; les votes restent indépendants. La fermeture autoritaire des votes et la confirmation des écritures acceptées doivent précéder `flushFinal()`, qui attend la publication en cours et relit l'état final sans délai volontaire. Un échec de fermeture doit être signalé et réessayé.
 
Intégration encore nécessaire : un seul ordonnanceur de confiance par partie/tour/groupe, notifications après confirmation des votes et changements de membres, lecture cohérente des données sources, garde transactionnelle contre les écritures de parties/tours périmés, reprise après redémarrage avec relecture et déduplication persistante. La latence réseau, une panne ou une écriture en cours peuvent dépasser les 2 secondes ; ce n'est pas une garantie temps réel. Les notifications ne doivent pas être le seul mécanisme de réconciliation. Les résultats officiels restent indépendants des tendances. Aucun déploiement ni changement de règles Firebase.
 
Tests : `node --test multigroup/trendPublisher.test.js multigroup/trendSnapshot.test.js multigroup/finalResults.test.js`. Les tests de l'ordonnanceur utilisent une horloge simulée et un adaptateur mémoire, pas une instance Firebase.
