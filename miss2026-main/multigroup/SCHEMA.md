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
| playerGroups/{uid}/{groupId} | true, index inverse |
| chats/{groupId}/{messageId} | uid, pseudo affiché, texte, date, état de modération |
| results/{version}/groups/{groupId} | classement local figé, accès membres |
| results/{version}/players/{uid} | score, rang national, total national, rangs par groupe |
| results/{version}/nationalTop | podium national et ex aequo, sans votes ni liste complète |
| control/resultsVersion | version publiée, basculée après préparation complète des résultats |

Les données de vérification des invitations et mots de passe de groupe doivent être séparées des données lisibles par les clients. Vérification côté serveur (hachage adapté aux mots de passe, limitation des tentatives, invitation révocable). Le mot de passe du compte créateur relève de Firebase Auth et ne doit jamais être enregistré en clair dans RTDB.

Les index d'appartenance doivent être cohérents : écritures groupées par un service de confiance, avec allocation atomique des places publiques (30 maximum) et contrôle d'une seule salle publique par UID si cette règle est confirmée. La recherche ne doit pas divulguer les participants ni les secrets. Un même UID peut rejoindre plusieurs groupes privés. Pas de duplication des votes.

## Identité et droits

- Anonyme : UID stable sur le navigateur tant que l'identité est conservée. Prévoir la persistance locale et le passage d'un lien d'invitation à l'autre sans recréer l'utilisateur. Aujourd'hui la persistance est par onglet.
- Créateur : compte email/mot de passe. Si déjà anonyme, lier le compte ou prévoir une migration contrôlée, sans perdre ses votes.
- Administrateur national : rôle vérifié côté serveur, distinct des créateurs.
- Créateur : modération et gestion de ses membres, aucun accès aux votes des autres, au barème ou à la régie.
- UID unique ne garantit pas une personne physique unique : autres appareils ou effacement du stockage restent un risque. Politique de récupération et anti-multicomptes à décider.
- Règles RTDB à concevoir puis tester : accès minimal par chemin, votes validés par tour ouvert, verrouillage des champs, aucun accès aux votes d'autrui, résultats non lisibles avant publication, contrôles de rôle et d'appartenance. Ne pas autoriser toute la base aux utilisateurs authentifiés.

## Finale

Une régie unique. À la fin, figer officiellement résultats, votes, éligibilité et appartenance; empêcher des modifications pendant le calcul. Le moteur pur finalResults.js réutilise le barème existant et calcule les points de chaque UID une seule fois. Les classements locaux filtrent les scores nationaux selon les membres de chaque groupe. Proposition de rangs ex aequo 1,1,3; le tri alphabétique est une présentation, pas un départage.

Calcul et publication à effectuer par un backend de confiance, jamais en téléchargeant tous les votes nationaux chez chaque joueur. Publier les vues nécessaires et basculer resultsVersion une fois le calcul terminé. Prévoir reprise/idempotence du calcul. Une seule révélation nationale par session du show.

Proposition UI, à valider : show local du groupe actif avec animations actuelles, résumé des résultats dans les autres groupes, puis rang national personnel et lauréat(s). Le groupe actif doit être choisi ou mémorisé avant le show; pas de vote à refaire. Pour un groupe seul, vide, ou ex aequo, prévoir scène adaptée. Ne pas rejouer automatiquement tout le show pour chaque groupe.

## Décisions encore ouvertes

- Autorisation de rejoindre des groupes après début du vote (recommandation : figer les appartenances pour le classement avant ouverture du premier tour; à valider).
- Éligibilité des inscrits n'ayant pas joué, votes partiels et départage final (le calculateur demande explicitement eligibleUids).
- Nombre de groupes privés autorisés, visibilité dans la recherche, récupération des invités sur autre appareil.
- Un seul groupe public par joueur : hypothèse retenue dans les tests, à confirmer.
- Mise en place d'un backend de confiance, règles Firebase, authentification créateurs, déploiement, capacité et tests de charge.

## Test unitaire

Depuis miss2026-main : node --test multigroup/finalResults.test.js

Les tests ne contactent pas Firebase. La validation du moteur ne valide pas les règles, la concurrence des inscriptions, les droits, ni la compatibilité de l'interface.
