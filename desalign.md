# Rapport de désalignement — Chantier "Refonte UI Combat" (session du 2026-07-31)

> Rédigé par l'agent Claude en cours à la demande explicite de Saar, après un STOP et un constat de
> boucle de réflexion sur le chantier `COMBAT-DEPLACEMENT-HOVER`. Un autre agent reprend la suite.
> **Rien n'est commité** — tout l'état ci-dessous est dans le worktree, branche `dev/Saar`.

---

## 1. Demande initiale de Saar (verbatim, à relire en premier — ne pas réinterpréter)

Message d'ouverture du chantier combat, reproduit intégralement :

> Refondre l'UI combat :
> 1- Corriger l'UI combat : retirer "INTERARGIR" des options de combat et le mettre sur les objets
>    environnementaux/entités interactives. (+ verifier la distance d'interaction - si >1.5m, impossible)
> 2- Corriger l'UI combat : retirer "DEPLCEMENT" des options de combat et rendre l'option toujours
>    active au survol des cases.
> 3- Cliquer sur un token (qui n'est pas possédé) propose une solution de tir/attaque corps à corps
>    intelligente : selection automatique du mode (CaC ou Tir, verifie et affiche la ligne de vue,
>    verifie et affiche la distance (portée), etc..

Plus tard dans la conversation, sur le clic token adverse, Saar a aussi demandé :
> mon idée (soumise à critiques) : utilisateur clique sur token (non owned), l'interface propose une
> solution de tir (ou de Cac en fonction du type d'arme équipée) en fournissant un déplacement si
> nécessaire pour avoir une ligne de vue ou etre à portée.

---

## 2. Où est le désalignement (diagnostic honnête)

**Point 2** de la demande dit "rendre l'option toujours active au survol des cases" — j'ai construit
un chantier (`COMBAT-DEPLACEMENT-HOVER`) qui rend le mode déplacement ambiant en permanence dès que
c'est le tour du joueur, sans distinguer assez tôt "survol d'une case libre" de "survol d'un token".

**Point 3** dit explicitement que cliquer sur un token non possédé doit **directement** proposer une
solution d'attaque (CaC ou Tir auto-détecté) — **sans étape préalable de clic sur un bouton
"Attaque"**. J'ai classé ce point comme un chantier séparé et plus gros
(`COMBAT-CLICK-AUTOSOLVE`, voir `docs/BUGIDENTIFIE.md`), volontairement différé "après consolidation
du survol de déplacement" — décision que j'ai documentée mais qui n'a, à aucun moment, été
explicitement validée par Saar comme un report acceptable du point 3 de sa demande d'origine.

**Conséquence concrète** : tous mes correctifs sur `Canvas3D.jsx` (3 itérations successives) ont été
construits en supposant implicitement que "cliquer Attaque/CaC d'abord, puis cliquer une cible" restait
le flux correct et à préserver. Saar teste en cliquant/survolant **directement** un token, sans passer
par un bouton Attaque au préalable (cohérent avec le point 3 qu'il a demandé depuis le début) — il
obtient donc systématiquement une proposition de déplacement, jamais une interaction de ciblage,
puisque ce chemin direct n'a jamais été construit. J'ai cherché le bug au mauvais endroit à chaque
itération (dans "le flux après clic Attaque") au lieu de remettre en question l'hypothèse de base.

Saar l'a signalé sans ambiguïté dans son dernier message : **"je ne veux pas APRÈS avoir cliqué sur
attaque/CaC"**.

**Second symptôme de dérive** : après un premier "Aucun changement" de Saar, j'ai enchaîné un second
correctif spéculatif sans revenir à l'étape "Instrumenter/confirmer" du protocole
(`docs/BUGIDENTIFIE.md` §MÉTHODE) — Saar a dû interrompre explicitement ("STOP", puis "Attention à la
boucle de réflexion") pour que je reparte d'une lecture exhaustive plutôt que d'un rustinage
supplémentaire.

---

## 3. Ce qui a été fait cette session (chronologie complète)

### 3.1 Registre
`docs/BUGIDENTIFIE.md` a reçu ~10 nouvelles entrées (section "UI Combat" et "UI Inventaire — armes et
recherche", 2026-07-31) — toutes les demandes de Saar y sont documentées, y compris
`COMBAT-CLICK-AUTOSOLVE` (le point 3 différé) et `COMBAT-INTERAGIR-AUTOMOVE`. **À relire en premier**,
c'est la source de vérité sur ce qui a été discuté/décidé/triée.

### 3.2 Correctifs clos et validés par Saar en navigateur
- **ARME-DEGATS-LABELS** — labels colorés Normal/Choc en inventaire + équipement. Validé fonctionnel
  par Saar. Fichiers : `client/src/lib/damageTypeBadges.js` (nouveau), `client/src/index.css`,
  `client/src/character/WeaponPanel.jsx`, `client/src/character/InventoryPanel.jsx`.

### 3.3 Codé mais jamais testé en jeu par Saar
- **COMBAT-LOS-PRECHECK-DIVERGENCE** — réintégration de `checkLOSForPrecheck` dans
  `COMBAT_ACTION_PRECHECK` pour le Tir (`server/src/socket/socketCombatResolution.js`), même patron que
  le check de portée CaC déjà actif. Décision de principe ajoutée à `.claude/rules/combat.md` §Autorité
  (ANNONCE laisse tout déclarer, RÉSOLUTION seule vérifie). Build + tests serveur (`node --test`, 77/77)
  passés, **jamais vérifié en situation réelle de Tir bloqué par LOS**.

### 3.4 COMBAT-DEPLACEMENT-HOVER — en cours, bloqué, à réévaluer entièrement
Chantier principal, celui qui a dérapé. Fichiers touchés :
- `client/src/lib/useAutoMoveMode.js` (nouveau) — hook partagé d'entrée automatique en mode
  déplacement, réutilisé par les 3 points d'appel ci-dessous.
- `client/src/lib/useDroneDeclare.js` — même patron pour le déplacement drone (PJ et GM), séparation
  `isSelectingTarget` (ciblage explicite) / `isSelectingOnMap` (calculé, inclut le déplacement en
  attente).
- `client/src/components/CombatOverlay.jsx` — propage `combatMoveMode`/`pendingMoveSelection` vers
  `CombatActionWindow`/`CombatGmDeclareWindow` (ces props n'existaient pas avant).
- `client/src/components/CombatActionWindow.jsx` — survol ambiant pour le PJ, fenêtre masquée
  seulement si une destination est posée et attend validation (plus du tout pendant le simple survol).
- `client/src/components/CombatGmDeclareWindow.jsx` — même chose côté PNJ.
- `client/src/components/Canvas3D.jsx` — **3 itérations successives**, la dernière introduit un point
  de vérité unique `combatMoveHasPriority()` (mémoïsé) consulté par `handleDragStart`/
  `handlePointerMove`/`handlePointerUp`, plus un filtre d'occupation de case (survol sur un token = pas
  de curseur/chemin) et un effet de nettoyage étendu (`combatCursorPos`/`currentPath`).

**Tout ce travail suppose que "cliquer Attaque avant de cibler" reste le flux correct.** Si la vraie
attente de Saar (point 3, confirmé par son dernier message) est qu'un clic direct sur un token
fonctionne **sans** ce préalable, une partie de cette architecture (notamment la logique de priorité
`combatTargetMode` vs `combatMoveMode` dans `Canvas3D.jsx`) devra être repensée en fonction de ce que
le clic direct sur un token doit réellement déclencher — pas seulement corrigée en surface.

---

## 4. Ce que le prochain agent doit faire en priorité

1. **Relire la section 1 de ce document (demande verbatim) avant toute chose**, puis
   `docs/BUGIDENTIFIE.md` (entrées Session 2026-07-31, en particulier `COMBAT-CLICK-AUTOSOLVE`,
   `COMBAT-DEPLACEMENT-HOVER`, `COMBAT-INTERAGIR-SYNC/DISTANCE/AUTOMOVE`).
2. **Ne pas continuer à patcher `Canvas3D.jsx`** sans avoir d'abord fait confirmer par Saar la question
   centrale : le clic direct sur un token adverse (sans clic préalable sur Attaque/CaC) doit-il
   fonctionner maintenant, ou le flux actuel (choisir l'action d'abord) reste-t-il transitoirement
   acceptable en attendant `COMBAT-CLICK-AUTOSOLVE` ? Cette réponse détermine si le travail Canvas3D
   déjà fait est une bonne base ou doit être repensé.
3. `git status`/`git diff` donnent l'état exact et complet — rien n'est commité, tout est inspectable
   et réversible sans perte.
4. Ne pas supposer que les correctifs déjà en place sont corrects simplement parce qu'ils sont
   documentés comme "codés" dans le registre — plusieurs itérations précédentes se sont révélées
   incomplètes ou construites sur une hypothèse de flux erronée.
