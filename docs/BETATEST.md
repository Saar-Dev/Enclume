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
