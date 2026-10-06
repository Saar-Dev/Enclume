# BETATEST.md — Scénarios à vérifier avec des beta-testeurs

> Responsabilité unique de ce document : lister les scénarios de validation qui exigent plusieurs
> clients connectés simultanément (Saar ne peut pas les reproduire seul) — à dérouler à la
> prochaine session de beta-test. Chaque entrée référence son ticket (`/admin/tickets`) pour le
> détail ; ne pas dupliquer le diagnostic ici (Règle 2/11, `docs/RegleDocumentaire.md`).
>
> Une fois un scénario validé (ou invalidé) : noter le résultat dans le ticket lié et dans
> `docs/JOURNAL8.md`, puis retirer l'entrée d'ici — ce fichier ne garde que ce qui reste à tester.

---

## Combat

### COMBAT-DAMAGE-WINDOW-WRONG-TARGET — file de dégâts multi-cibles
**Ajouté le** : 2026-10-03.
**Contexte** : correctif codé (`client/src/lib/combatDamageQueue.js`), vérifié par test unitaire pur
(8/8) et build client, mais jamais exercé en combat réel — nécessite un PJ tireur qui touche deux
PJ différents dans le même round (condition que Saar ne peut pas réunir seul).

**Scénario à dérouler :**
1. Mettre en place un combat avec un PJ tireur capable de toucher deux cibles PJ distinctes dans le
   même round (double armement, ou deux actions de Tir/CaC validées par le MJ).
2. Le tireur touche la cible A **et** la cible B au même round.
3. Il clique « Lancer » pour A, vérifie que les dégâts affichés correspondent bien à A, ferme la
   fenêtre.
4. Vérifier que la fenêtre suivante affiche bien la cible B (nom **et** formule de dégâts corrects),
   pas les restes de A.
5. Lancer les dégâts de B, fermer, vérifier que le Tour se termine normalement (rien ne reste
   bloqué en « Gestion des dégâts en cours »).

**Résultat attendu :** chaque fenêtre affiche la bonne cible avec ses propres dégâts ; le combat ne
se bloque jamais entre les deux résolutions.

### COMBAT-WINDOW-CLOSES-BEFORE-DONE — résultats de tir en rafale (durcissement, pas une correction confirmée)
**Ajouté le** : 2026-10-03.
**Contexte** : signalé par Saar et un beta-testeur (fenêtre de combat qui disparaît avant la fin de
l'action). Pas de mécanisme unique identifié avec certitude pour ce symptôme précis — mais un défaut
confirmé de même nature que `COMBAT-DAMAGE-WINDOW-WRONG-TARGET` a été trouvé et corrigé par
précaution (`attackResult` écrasait silencieusement un résultat de tir par un autre lors d'attaques
multiples). **Ce correctif durcit un défaut réel, il ne ferme pas ce ticket avec certitude.**

**Scénario à dérouler :**
1. Combat avec un PJ qui enchaîne plusieurs attaques dans le même round (idéalement un mélange
   Raté puis Touché, pas seulement des Touchés).
2. Vérifier que le bandeau « Touché/Raté » de `CombatModifiersWindow` correspond bien à l'attaque en
   cours, jamais à une attaque déjà close.
3. Noter précisément toute disparition de fenêtre avant la fin d'une action (quelle fenêtre, quelle
   action en cours, PJ ou MJ) — c'est l'information qui manque pour trancher si ce ticket est
   réellement clos ou s'il reste une autre cause ailleurs.

**Résultat attendu :** aucune fenêtre ne disparaît tant qu'une action n'est pas terminée, validée ou
annulée explicitement.

### COMBAT-MULTI-ATTACK-ROUND-BROKEN — architecture vérifiée, aucun nouveau défaut trouvé à ce stade
**Ajouté le** : 2026-10-03.
**Contexte** : exploration complète de l'enchaînement d'attaques multiples (sélection côté PJ,
découpage en entrées d'échelle séparées, malus recalculé dynamiquement, résolution entrée par
entrée). Architecture cohérente vérifiée en lisant le code actuel — aucun défaut concret trouvé en
dehors de ceux déjà corrigés (`COMBAT-DAMAGE-WINDOW-WRONG-TARGET`,
`COMBAT-WINDOW-CLOSES-BEFORE-DONE`). Le signalement initial (« plusieurs attaques par round ne
fonctionne pas correctement ») reste possiblement couvert par ces deux correctifs, ou par un défaut
non encore identifié faute de repro précise.

**Scénario à dérouler :**
1. PJ en CaC qui déclare 2 ou 3 attaques (chips « Attaques » du panneau CaC), une cible différente
   par attaque si possible.
2. Vérifier que chaque attaque résout bien contre SA cible déclarée (pas une confusion de cible entre
   attaques).
3. Vérifier le malus « Attaque multiple » affiché (-5 pour 2, -7 pour 3+) et qu'il reste cohérent si
   une attaque de la série est perdue/sautée en cours de round (RAW : recompté sur les attaques
   survivantes, pas figé à la déclaration).
4. Même déroulé en Tir Multi (rafale, plusieurs tirs/cibles) si disponible.
5. Si quelque chose « ne fonctionne pas », noter précisément : quelle étape (sélection, résolution,
   fenêtre), quel nombre d'attaques, CaC ou Tir, cible unique ou multiple — c'est l'information qui
   manque aujourd'hui pour aller plus loin.

### COMBAT-RANGE-PLAYER-EDITABLE — synchro MJ↔joueur de la Portée et de la Taille en résolution
**Ajouté le** : 2026-10-04.
**Contexte** : correctif codé (nouvel événement `COMBAT_RESOLUTION_OVERRIDE`, `shared/events.js` +
`combatTurnEngine.js` + `socketCombatResolution.js` + `socketCombatHelpers.js` +
`CombatModifiersWindow.jsx` + `CombatOverlay.jsx`), étendu le même jour à Allure tireur/cible,
Couverture et Obscurité (lecture seule pour le MJ en supervision, sans nouveau canal — ces 3 champs
n'ont pas d'autorité serveur à corriger, voir `docs/JOURNAL8.md`), vérifié par build, lint et les
suites existantes qui exercent `resolveAssaultAction` (105/105, chemin par défaut sans surcharge),
mais jamais exercé avec un vrai second client — nécessite un MJ et un joueur, le joueur avec un PJ
en train de résoudre un Tir.

**Scénario à dérouler :**
1. MJ et joueur en combat, le joueur déclare un Tir qui entre en phase RÉSOLUTION.
2. Vérifier que le MJ voit désormais une fenêtre de modificateurs pour cet assaut (avant ce
   correctif : rien ne s'affichait côté MJ pour un PJ).
3. Vérifier que les champs Portée ET Taille cible sont en lecture seule chez le joueur (pas de
   `<select>`), et modifiables uniquement chez le MJ.
4. Le MJ change la Portée, puis la Taille (séparément) dans sa fenêtre — vérifier à chaque fois que
   le joueur voit le changement apparaître **en direct**, sans recharger, avant de cliquer "Lancer
   les dés" — et que changer l'un ne réinitialise pas l'autre (ex. changer la Taille après avoir
   fixé la Portée ne doit pas effacer la Portée déjà posée).
5. Le joueur lance les dés — vérifier que le résultat (touché/raté, dégâts) correspond bien à la
   Portée ET à la Taille que le MJ a fixées, pas aux valeurs calculées automatiquement.
6. Vérifier que le bouton "Lancer les dés" n'apparaît PAS dans la fenêtre du MJ (seul le joueur
   lance ses propres dés).
7. Vérifier que Allure tireur, Allure cible, Couverture et Obscurité sont AUSSI en lecture seule
   chez le MJ (pas de `<select>` ni de case cochable) — ces 4 champs n'ont volontairement aucun
   canal de surcharge, contrairement à Portée/Taille.
8. Refaire sans intervention du MJ (il laisse Portée et Taille automatiques) — vérifier que rien ne
   change par rapport au comportement d'avant ce correctif.
9. Vérifier que le MJ résolvant lui-même un PNJ/drone/exo (pas un PJ) garde le comportement
   inchangé pour tous les champs (bouton "Lancer" visible, select local comme avant, y compris pour
   Allure/Couverture/Obscurité).

**Résultat attendu :** le MJ supervise et peut corriger la Portée ET la Taille d'un PJ en temps
réel, indépendamment l'une de l'autre ; Allure/Couverture/Obscurité restent lecture seule pour lui
(aucun nouveau pouvoir) ; le joueur ne peut jamais éditer Portée/Taille lui-même ; sans intervention
MJ, le comportement reste celui d'avant.

### I18N-COMBAT-DICE-TEXT — texte des jets de dés et tests de combat (Lot 7 localisation)
**Ajouté le** : 2026-10-06.
**Contexte** : chantier de fond (`PLANS/PLAN_LOCALISATION.md` §9) — tout le texte affiché pour un
jet de dé ou un test de combat (titre de la carte, détail du calcul ⊞, choix Chance) est passé
d'un texte composé côté serveur à une clé résolue côté client. Changement entièrement interne :
**aucun texte affiché ne doit changer**, seulement sa façon d'être construit. Vérifié à chaque étape
par comparaison directe texte-contre-texte (pas en jeu), mais seul un vrai combat à plusieurs joueurs
peut confirmer qu'aucun cas réel n'a été manqué — les ~100 textes concernés touchent Tir, CaC,
Drone, Exo-armure, grenades, réparation, Choc, Surprise et les Tests hors combat (`/t`, Tests
arbitrés MJ), soit la quasi-totalité des cartes de jet du jeu.

**Scénario à dérouler** (MJ + au moins un joueur, idéalement deux pour croiser PJ/PNJ) :
1. Dérouler un combat normal qui enchaîne plusieurs types d'action : Tir (toucher et défendre),
   Corps à corps, une Manœuvre d'armure si un PJ en exo est disponible, une attaque Drone et une
   attaque Exo-armure, une grenade (lancer + un jet « Éviter la zone » si une cible est à portée
   longue/extrême).
2. Après chaque jet, ouvrir le détail du calcul (bouton ⊞) et vérifier que chaque ligne (Précipitation,
   Taille cible, Couverture, Portée, Allure, État de l'arme, etc.) affiche un texte normal — jamais
   une clé technique brute (ex. `combat:breakdown.xxx`) ni `undefined`.
3. Provoquer au moins un choix Chance (risque de Catastrophe) et vérifier que le titre du Test
   affiché sur la carte de choix est correct.
4. Si possible : un Test de Choc, un Test de Réaction (Surprise, début de combat), une réparation
   d'équipement en combat, et un Test hors combat (`/t`) ou un Test arbitré par le MJ (bouton
   « Réussite auto » ou Test MJ sur une entité/porte).
5. Vérifier que l'animation du dé 3D correspond toujours au bon type de dé (d20 pour un Test, pas un
   d6 ou une animation absente).

**Résultat attendu** : tous les textes de jets de dés et de tests sont identiques à avant ce
chantier — aucune clé brute, aucun texte manquant, aucune animation de dé incohérente. Si quelque
chose cloche : noter précisément quelle action, quel texte/ligne, et si possible une capture —
c'est l'information qui manque pour corriger vite.

## Carte

### MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS — propagation live d'une édition de carte
**Ajouté le** : 2026-10-04.
**Contexte** : correctif codé (nouvel événement `MAP_UPDATED`, `shared/events.js` +
`battlemaps.js` + `useEntitySocket.js`), vérifié par tests unitaires/partagés et build client, mais
jamais exercé avec un vrai second client connecté — nécessite un joueur déjà en session sur la
carte que le MJ modifie.

**Scénario à dérouler :**
1. MJ et joueur connectés sur la même carte (le joueur doit l'avoir déjà affichée, pas juste la
   campagne ouverte).
2. Le MJ édite la géométrie dans l'éditeur 3D (ajouter/déplacer un mur, une salle) et sauvegarde.
3. Vérifier que la carte du joueur se met à jour **sans qu'il recharge la page** et sans action de
   sa part.
4. Même vérification après une édition de voxels (textures/décors) et après un changement de
   métadonnées (nom, grille) via les Paramètres de la carte.
5. Vérifier qu'un joueur sur une **autre** carte (pas celle éditée) ne subit aucun rechargement
   inutile.

**Résultat attendu :** la carte affichée chez le joueur reflète l'édition du MJ en quelques
secondes, sans rechargement manuel ; une carte non concernée reste silencieuse.

## Personnage

### CHARSHEET-XP-SYNC-PJMJ — sync fiche personnage entre MJ et joueur
**Ajouté le** : 2026-10-04.
**Contexte** : correctif codé (11 nouveaux événements `CHAR_*` ciblés, `shared/events.js` +
`char-sheet.js` + `CharacterSheet.jsx` + `AdvantagesPanel.jsx`), vérifié par build client, lint et
tests partagés (941/941), mais jamais exercé avec un vrai second client — nécessite un MJ et un
joueur ayant chacun la fiche du même personnage ouverte en même temps.

**Scénario à dérouler :**
1. MJ et joueur ouvrent chacun la fiche du même personnage (fenêtre Personnage).
2. Le joueur passe en Mode Progression et achète une compétence, puis augmente un attribut (Modif.
   PC) — vérifier que le XP disponible ET la compétence/l'attribut se mettent à jour **côté MJ**
   sans qu'il rouvre la fenêtre.
3. Le MJ modifie le solde XP disponible (champ XP, debounce 500ms) — vérifier que le joueur voit la
   nouvelle valeur sans recharger.
4. Le MJ édite un champ d'identité (ex. signe distinctif) pendant que le joueur achète une
   compétence au même moment — vérifier que ni l'un ni l'autre ne perd sa saisie en cours.
5. Le MJ octroie un Avantage/une Mutation, ajoute une note "Autre" — vérifier l'apparition
   immédiate côté joueur ; puis les retire — vérifier la disparition immédiate.
6. Fermer/réouvrir le pouvoir Polaris (toggle) côté joueur — vérifier que le MJ voit le changement.

**Résultat attendu :** chaque champ modifié par l'un des deux clients apparaît chez l'autre en
quelques secondes, sans rechargement manuel, sans écraser une saisie en cours sur un AUTRE champ.
