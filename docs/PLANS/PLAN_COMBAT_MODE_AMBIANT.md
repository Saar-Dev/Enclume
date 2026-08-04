# PLAN_COMBAT_MODE_AMBIANT.md — Correction du cycle de vie des modes d'interaction ambiants en combat

> Version : V0.4 — 2026-08-04
> Statut : **Confirmé fonctionnel en jeu (PJ, MJ non-drone) — résiduel drone reporté sur
> CLICKATTACK-MOVECONFLICT1 (`docs/BUGIDENTIFIE.md`). Compte-rendu : `docs/JOURNAL8.md`.**
> Responsabilité unique : cartographier l'état actuel, nommer le défaut structurel réel (et écarter
> ceux qui n'en sont pas) pour le « mode ambiant » (survol déplacement + clic-attaque direct) en
> combat côté client.

---

## 1. Origine

Décision Saar (2026-08-04) : ALLURE-TURNGATE1 (fenêtre allure/déplacement visible en permanence, hors
tour, pour PJ et MJ) et CLICKATTACK-MOVECONFLICT1 (clic sur un token adverse déclenche un déplacement
au lieu d'une attaque) partagent la même cause — traités ensemble comme un chantier plutôt que deux
correctifs isolés (CLAUDE.md §5 : « plusieurs fichiers peuvent changer ensemble s'ils implémentent le
même invariant »).

**V0.1 → V0.2** : la V0.1 proposait un rework à 6 fichiers (déclarant unique PJ/PNJ/drone, hook ambiant
unique). Après recherche (§3.2) et relecture critique, ce périmètre était surdimensionné — voir §3.3.
Le vrai défaut est concentré dans **un seul fichier**.

---

## 2. État actuel [VÉRIFIÉ par lecture]

### 2.1 Le state partagé

`client/src/lib/useCombatUIState.js` possède `combatMoveMode` (objet `{ tokenId, allures,
onMoveSelected, onCancel, onPendingMove }` ou `null`) et `combatTargetMode` (objet analogue pour le
ciblage explicite), transmis en props à `Canvas3D.jsx` et `CombatOverlay.jsx`.

### 2.2 Les deux mécanismes ambiants

`useAutoMoveMode.js` et `useCombatClickAttack.js` arment automatiquement (sans clic préalable,
décisions Saar 2026-07-31) respectivement `combatMoveMode` et le handler de clic-attaque, via un
`useEffect` déclenché par une condition `enabled`. Appelés 3 fois (PJ, MJ/PNJ, drone), chaque fois avec
une condition différente — aucune ne vérifie la phase ni si c'est réellement le tour du déclarant,
alors que ce booléen existe déjà, correct, ailleurs dans les deux mêmes fichiers
(`isMyTurnInResolution`/`rosterEntry?.has_announced` côté PJ, `isActivePnj` côté MJ).

### 2.3 Le nettoyage est partiel

`handleModeReset` (existant, câblé sur `COMBAT_END`/`PHASE_CHANGED`/`COMBAT_SLOT_ADVANCED`) vide
`combatMoveMode` correctement à ces moments — mais `useAutoMoveMode` réarme instantanément dès que
`combatMoveMode` retombe à `null`, tant que sa condition `enabled` reste vraie (toujours vraie ici,
§2.2). Le nettoyage existant est donc immédiatement contredit par le réarmement.

### 2.4 Ce qui n'est pas concerné

`combatTargetMode` — déclenché uniquement par un clic utilisateur explicite (bouton « Cibler »),
jamais par un effet ambiant. **Vérifié** : les 5 appels à `onEnterTargetMode` dans le code sont tous
à l'intérieur de handlers de clic nommés (`handleChooseTarget`, `handleStartAttack`, etc.), aucun dans
un `useEffect`. Il s'auto-nettoie déjà correctement à la sélection/l'annulation. Non touché.

---

## 3. Diagnostic

### 3.1 Le vrai défaut

`useAutoMoveMode.js` sait **armer** `combatMoveMode` (via son effet) mais n'a jamais reçu la moitié
« désarmer quand ce n'est plus légitime » de son propre cycle de vie. C'est un seul fichier avec une
responsabilité incomplète, pas une architecture à refaire.

### 3.2 Recherche effectuée

- [Don't Sync State. Derive It! — Kent C. Dodds](https://kentcdodds.com/blog/dont-sync-state-derive-it) :
  référence sur ce problème précis. Un state ne doit jamais être synchronisé depuis un autre via un
  effet — soit il est calculable à la volée (dérivé), soit c'est une vraie interaction (doit rester un
  state). Ici, *qui a le droit d'être le déclarant* est calculable ; *la case survolée / le chemin en
  cours* est une vraie interaction utilisateur, pas dérivable.
- [Deriving Data with Selectors — Redux officiel](https://redux.js.org/usage/deriving-data-selectors) :
  le patron pour calculer une permission depuis un store centralisé (Zustand ici, même famille) est une
  petite fonction pure appliquée au store — patron déjà en place dans ce projet
  (`useTokenStore(s => s.tokens)`), rien à importer.
- XState (`statelyai/xstate`) — machines à états pour jeux au tour par tour : la pratique établie est
  un acteur/calcul par rôle (joueur, MJ), pas un type unique qui absorbe les deux rôles.

### 3.3 Pourquoi la V0.1 était surdimensionnée

- **Défaut #1 de la V0.1** (« pas de source unique du déclarant ») supposait que le calcul PJ (mes
  propres tokens) et le calcul MJ (tout le roster PNJ) sont la même règle dupliquée par accident. Rien
  ne le prouve — ce sont deux autorités métier différentes (un joueur n'agit que sur ses tokens, un MJ
  gère un roster entier) qui se ressemblent par coïncidence de style. Les fusionner en un type unique
  aurait risqué de cacher une vraie distinction plutôt que de supprimer une duplication réelle.
- **Défaut #2** correct mais mal exploité en V0.1 : \"rendre le mode ambiant dérivé\" ne s'applique qu'à
  la moitié \"qui est le déclarant\", jamais à la sélection en cours (vraie interaction souris).
- Conséquence : le seul point réellement commun aux 3 appelants est le cycle de vie armer/désarmer,
  pas leur définition de \"déclarant légitime\" — donc un seul fichier à corriger
  (`useAutoMoveMode.js`), chaque appelant gardant son propre calcul métier (déjà correct, juste jamais
  branché sur `enabled`).

---

## 4. Correctif ciblé

1. **`useAutoMoveMode.js`** — ajouter le désarmement manquant : quand `enabled` passe de vrai à faux
   (ou au démontage du composant appelant), et que `combatMoveMode` appartient bien à ce token
   (`combatMoveMode?.tokenId === tokenId`), appeler `combatMoveMode.onCancel()` — le même chemin que le
   bouton « Annuler » existant, pas un nouveau mécanisme. Corrige les 3 appelants (PJ, MJ/PNJ, drone) en
   un seul endroit.
2. **`CombatActionWindow.jsx`** — relocaliser (pas dupliquer) le calcul déjà existant
   `isMyTurnInResolution` avant l'appel au hook (contrainte d'ordre des hooks, patron déjà utilisé dans
   ce fichier pour `useCombatClickAttack`), puis l'ajouter à `enabled`.
3. **`CombatGmDeclareWindow.jsx`** — même chose avec `isActivePnj` (déjà calculé plus bas dans le
   fichier, inclut déjà « pas encore déclaré »), pour le seul appel non-drone.

**Vérifié pendant cette passe** : le correctif résiste au mode strict de développement de React
(double-montage volontaire utilisé pour détecter les effets mal nettoyés) — un cas déjà rencontré et
corrigé une fois dans ce projet (COM7, `CombatGmDeclareWindow.jsx`). Le comportement se rétablit tout
seul dans le même cycle, sans état bloqué.

### Explicitement exclu de ce correctif

- **Le drone** — son survol et son clic-attaque partagent aujourd'hui un seul réglage
  (`moveHoverEnabled` dans `useDroneDeclare.js`). Le corriger toucherait aussi le clic-attaque, donc
  l'autre bug (CLICKATTACK-MOVECONFLICT1). Le drone restera concerné par ALLURE-TURNGATE1 jusqu'à ce
  que l'autre bug soit traité séparément.
- **`useCombatClickAttack.js`** — bug séparé, pas touché ici.

### Question produit ouverte (pas une question technique — à trancher par Saar)

Pendant l'analyse, un cas a été trouvé : un joueur qui contrôle 2 personnages dans le même combat, dont
un a déjà déclaré son action et l'autre pas encore, peut voir le mauvais personnage pris en compte pour
savoir « c'est mon tour ou pas ». Ce n'est pas un problème d'architecture, c'est une question de règle :
en phase Annonce, l'ordre de déclaration entre plusieurs personnages d'un même joueur est-il libre ou
imposé ? Le correctif ci-dessus ne tranche pas cette question, il ne fait qu'utiliser la règle telle
qu'elle existe aujourd'hui (libre, non enforced). **Pas besoin d'y répondre maintenant** — sans
importance pour valider ce correctif, sauf si Saar veut la trancher au passage.

---

## 5. Hors périmètre (confirmé)

- Aucun changement serveur, aucune migration — le mode ambiant est 100 % local au client.
- `combatTargetMode` (§2.4).
- Format des payloads `COMBAT_ACTION_DECLARE`/`world-move`/`world-visibility`.

---

## 6. Effort et risques

**Fichiers impactés : 3** (`useAutoMoveMode.js`, `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx`),
contre 6 en V0.1.

**Risque principal** : aucun changement de comportement pour la validation/l'annulation explicite d'un
déplacement (déjà vérifié : ces deux chemins vident déjà `combatMoveMode` immédiatement, avant même que
le nouveau désarmement n'entre en jeu). Le risque résiduel est concentré sur le cas multi-personnages
(§4, question ouverte) — pas aggravé par ce correctif, juste pas résolu par lui.

**Non testable par moi en navigateur** — validation fonctionnelle (PJ solo, PJ multi-perso, MJ+PNJ,
drone) à la charge de Saar.

---

## 7. Prochaine étape

Valider ce périmètre resserré avant de coder. Aucun code n'a été écrit à ce stade.
