REWORK-05 — Panneaux d'action partagés
Problème : 3 panneaux droits (Tir, CaC, Drone) + 1 bloc log (DeclareLogContent) sont copiés-collés entre CombatGmDeclareWindow (~1214 lignes) et CombatActionWindow (~1878 lignes). ~370 lignes dupliquées. Résultat : ACTION_LABELS, PURE_MOVE_TYPES, chips mode de combat, logique CC/RC/RL redéfinies deux fois — toute correction doit être appliquée à la main dans les deux fichiers.

Trigger ARCHI_REWORK : même bloc dupliqué N≥3 fois (compte les futurs FenetreDrone, FenetreExoArmure). Bug COM5 est une conséquence directe : le handler GM dans le panneau CaC est différent du handler Joueur, donc le bug n'existe que d'un côté.

Décision architecturale
Extraire 3 sous-composants partagés + 1 export de contenu log + migration de 4 constantes vers combatSections.js. Les deux fenêtres parentes deviennent des orchestrateurs qui montent les panneaux. Compatible avec la future vision FenetreGM / FenetreJoueur / FenetreDrone — les panneaux seront déjà des modules propres que chaque service monte indépendamment.

Fusion GM+Joueur en un seul composant : rejetée — différence structurelle réelle (navigation de slots, multi-phases, preview temps réel).

Interface cible

// combatSections.js — nouveaux exports
export const ACTION_LABELS = { assault: 'Assaut (tir)', melee: 'Assaut (CaC)', ... }  // migré depuis les 2 fichiers
export const PURE_MOVE_TYPES = new Set([...])                                          // migré depuis les 2 fichiers
export const COMBAT_MODE_DEFS = [
  { k: 'normal',   l: 'Normal',   tooltip: '...' },
  { k: 'offensif', l: 'Offensif', tooltip: '...' },
  { k: 'charge',   l: 'Charge',   tooltip: '...' },
  { k: 'defensif', l: 'Défensif', tooltip: '...' },
  { k: 'retraite', l: 'Retraite', tooltip: '...' },
]

// CombatDeclareLog.jsx — nouvel export (contenu seul, sans header draggable)
export function DeclareLogContent({ maxHeight })
// Lit announcedActions + tokens depuis les stores directement (pas de prop drilling)
// maxHeight : string CSS optionnel — '170px' pour l'inline Joueur, pas de limite pour GM

// AssaultRangedPanel.jsx — panneau tir partagé (interface réelle après P2)
export default function AssaultRangedPanel({
  weapon,              // { name, slot } | null
  weaponMd,            // { name, slot } | null — Joueur dual wield, null pour GM
  currentFireMode,     // 'CC' | 'RC' | 'RL'
  assaultBulletCount,  // number | 'multi' | null
  assaultVariantAB,    // 'A' | 'B'
  assaultTargetId,     // string | null
  isDualWield,         // bool — false pour GM
  dualWieldBonusComp,  // number — 0 pour GM
  onBulletCountChange, // (count) => void
  onVariantABChange,   // (ab) => void
  onChooseTarget,      // () => void
  getLabel,            // (tokenId) => string
  showReadyBadge,      // bool
  // styles : RETIRÉ — voir P2 (panneau définit ses propres styles internes)
})

// MeleeCombatPanel.jsx — panneau CaC partagé (interface réelle après P2/P3/P4)
export default function MeleeCombatPanel({
  availableWeapons,    // [{ id, label, slot, damage, allonge }]
  selectedWeaponId,    // string | null (mains nues)
  isWeaponDrawn,       // bool — grisage armes contact. ⚠ GM passait true hardcodé (faux) — voir P3+P7
  hasMeleeInInventory, // bool — hint Joueur si arme en inventaire non équipée. false pour GM
  onWeaponChange,      // (id | null) => void

  combatMode,          // 'normal'|'offensif'|'charge'|'defensif'|'retraite'
  onModeChange,        // (mode) => void — PAS de target auto (fix COM5)
  onStartCharge,       // () => void — parent gère le flow move+target
  onStartRetraite,     // () => void | null — null = pas de recul (GM)

  chargeMoveDest,      // { targetPosX, targetPosY } | null — normalisé P4
  chargeTargetLabel,   // string | null

  meleeCount,          // 1 | 2 | 3
  effectiveMeleeCount, // 1 | 2 | 3 (charge → toujours 1)
  onMeleeCountChange,  // (n, prevN) => void

  perSlotTargeting,    // bool — true=Joueur (bouton par slot) / false=GM (Cibler unique)
  targetIds,           // string[]
  isInTargetMode,      // bool — feedback "⚔ Cliquez sur la cible" (GM uniquement)
  tokens,              // pour label lookup
  onChooseTarget,      // (index) => void

  showReadyBadge,      // bool
  // styles : RETIRÉ — voir P2 (panneau définit ses propres styles internes)
})

// DroneWeaponPanel.jsx — panneau drone partagé (interface réelle après P2)
export default function DroneWeaponPanel({
  droneWeapons,           // weapon[]
  selectedDroneWeaponId,  // string | null
  assaultTargetId,        // string | null
  onWeaponSelect,         // (id) => void
  onChooseTarget,         // () => void
  getLabel,               // (tokenId) => string
  showReadyBadge,         // bool
  // styles : RETIRÉ — voir P2 (panneau définit ses propres styles internes)
})
Périmètre
Fichiers modifiés :

Fichier	Changement
client/src/components/combatSections.js	+ACTION_LABELS, PURE_MOVE_TYPES, COMBAT_MODE_DEFS
client/src/components/CombatDeclareLog.jsx	+export DeclareLogContent — lit stores directement. ACTION_LABELS/PURE_MOVE_TYPES → import combatSections
client/src/components/AssaultRangedPanel.jsx	NOUVEAU — panneau tir CC/RC/RL
client/src/components/MeleeCombatPanel.jsx	NOUVEAU — panneau CaC (COM5 corrigé ici)
client/src/components/DroneWeaponPanel.jsx	NOUVEAU — panneau drone
client/src/components/CombatGmDeclareWindow.jsx	Panneaux droits → imports partagés. Fix COM5 : supprimer handleStartMelee() du click mode chip
client/src/components/CombatActionWindow.jsx	declareLogSection inline → <DeclareLogContent>. Panneaux droits → imports partagés. ACTION_LABELS/PURE_MOVE_TYPES → import combatSections
Fichiers NON touchés :

server/ — aucun changement côté serveur
shared/events.js — aucun nouvel événement
client/src/index.css — aucune nouvelle classe CSS (panneaux réutilisent les styles existants via prop styles)
SessionPage.jsx, CombatOverlay.jsx — point de montage inchangé
combatStore.js, tokenStore.js — inchangés
Plan — ordre obligatoire
Étape 1 — combatSections.js : migration des constantes

Ajouter ACTION_LABELS, PURE_MOVE_TYPES, COMBAT_MODE_DEFS (tooltip identiques à ceux dans les deux fichiers — vérifier par grep les chaînes exactes avant de copier)
Run à vide : node --check sur le fichier
Étape 2 — CombatDeclareLog.jsx : export DeclareLogContent

Extraire EntryLines déjà local + body → export function DeclareLogContent({ maxHeight })
Import ACTION_LABELS, PURE_MOVE_TYPES depuis combatSections.js (supprimer les définitions locales)
CombatDeclareLog default export utilise DeclareLogContent en interne
Run à vide : npm run build — vérifier Vite 200
Étape 3 — CombatActionWindow.jsx : declareLogSection → <DeclareLogContent> (CL2)

Remplacer le bloc inline declareLogSection (L.683–736) par <DeclareLogContent maxHeight="170px" />
Supprimer ACTION_LABELS (L.14–24) et PURE_MOVE_TYPES (L.25) → import depuis combatSections
Run à vide : npm run build
Étape 4 — DroneWeaponPanel.jsx : NOUVEAU

Créer le composant minimal — drone weapons list + target button
Run à vide : node --check
Étape 5 — AssaultRangedPanel.jsx : NOUVEAU

Créer le composant — weapon display + target + CC/RC/RL fire mode
Run à vide : node --check
Étape 6 — MeleeCombatPanel.jsx : NOUVEAU (fix COM5 ici)

Créer le composant — COMBAT_MODE_DEFS (depuis combatSections) + nombre attaques + cibles
Règle COM5 : onModeChange(mode) ne déclenche jamais de target mode — c'est le parent qui appelle onStartCharge / onChooseTarget séparément via boutons explicites
Run à vide : node --check
Étape 7 — CombatGmDeclareWindow.jsx : substitutions

Remplacer panneau tir (L.919–1062) → <AssaultRangedPanel />
Remplacer panneau CaC (L.779–916) → <MeleeCombatPanel />
Remplacer panneau drone (L.593–648) → <DroneWeaponPanel />
Fix COM5 : supprimer if (!isDefensif) handleStartMelee() (L.829) du mode chip click handler
Run à vide : npm run build
Étape 8 — CombatActionWindow.jsx : substitutions panneaux

Remplacer panneau tir humanoid (L.1440–1593) → <AssaultRangedPanel />
Remplacer panneau tir drone (L.1386–1436) → <DroneWeaponPanel />
Remplacer panneau CaC (L.1177–1383) → <MeleeCombatPanel />
Run à vide : npm run build
Étape 9 — SR

.\start.ps1 — vérifier absence d'erreur
Validation
Scénario 1 — Tir GM PNJ, mode CC
Setup : slot actif = PNJ ranged → cliquer ACTION → Assaut (tir) → panneau droit s'ouvre avec weapon + target + CC options
Résultat attendu : comportement identique à avant REWORK — tir simple, répétition slider, A/B variant fonctionnels

Scénario 2 — COM5 : mode de combat GM ne lance plus la cible auto
Setup : slot actif = PNJ CaC → cliquer Mêlée → dans le panneau CaC, cliquer "Offensif"
Résultat attendu (avant fix) : mode visée s'ouvre automatiquement (bug)
Résultat attendu (après fix) : seul le mode change visuellement — pas de mode visée déclenché

Scénario 3 — CL2 : log déclarations Joueur = même contenu que GM
Setup : 2 joueurs déclarent avant mon tour → ouvrir CombatActionWindow
Résultat attendu : DeclareLogContent affiche exactement le même rendu que CombatDeclareLog standalone GM (même format acteur/action/destination)

Scénario 4 — Non-régression : CaC Joueur, mode Charge
Résultat attendu : flow charge inchangé (move court → cible CaC chaînés automatiquement)

Scénario 5 — Non-régression : Drone GM, tir
Résultat attendu : sélection arme drone + cible fonctionne identiquement

Définition of done
 npm run build — 0 erreur Vite
 grep -c "currentFireMode === 'CC'" client/src/components/CombatGmDeclareWindow.jsx → 0
 grep -c "currentFireMode === 'CC'" client/src/components/CombatActionWindow.jsx → 0
 Scénario 1 validé ✅ Session 99
 Scénario 2 validé (COM5 ✅) ✅ Session 99
 Scénario 3 validé (CL2 ✅) ✅ Session 99
 Scénario 4 validé (non-régression) ✅ Session 99
 Scénario 5 validé (non-régression drone) ✅ Session 99
 ARCHI_REWORK.md appendé avec REWORK-05 ✅ Session 99
 JOURNAL4.md appendé ✅ Session 99

---

## Session 99 — Validation complète + observations post-test

### Statut final : ✅ CLOS COMPLET (5/5 scénarios validés)

### Bugs identifiés pendant les tests

**BUG-W1 — PNJ CaC : arme rangée mais sélectionnée pour l'assaut**
- Observation : slot PNJ avec `state_weapon = 'holstered'` — panneau CaC s'ouvre avec l'arme équipée pré-sélectionnée malgré qu'elle soit rangée.
- Comportement attendu : si arme pas `'drawn'` → sélection par défaut = Mains nues.
- Fichier concerné : `CombatGmDeclareWindow.jsx` — initialisation `selectedGmMeleeWeaponId`.

**BUG-W2 — PNJ CaC 2 attaques : crash silencieux sélection cible**
- Observation : clic "Corps à corps" déclenche immédiatement la sélection de cible (slot 0). Si on change le compteur d'attaques à 2, puis clique sur une cible : la sélection s'arrête sans ouvrir de fenêtre ni compléter le slot 1.
- Cause probable [INCONNU — lecture code requise] : `handleStartMelee()` déclenché au clic "CaC" avant que `meleeCount` soit à 2. Quand le count passe à 2, le state des cibles est peut-être réinitialisé.
- Fichiers concernés : `MeleeCombatPanel.jsx` (onMeleeCountChange), `CombatGmDeclareWindow.jsx` (handleStartMelee, meleeTargets).

### Demandes ergonomiques — weapon state auto-transition (Session 99)

Ces demandes adressent directement P7 (state_weapon 3 états) et sont liées à REWORK-06.

**ERG-W1 — Auto-draw au clic "Assaut (tir)"**
- Comportement actuel : bouton "Assaut (tir)" grisé si arme pas `'drawn'`.
- Comportement demandé : bouton cliquable (pas grisé). Au clic → appliquer coût INI de transition + passer `state_weapon = 'drawn'` localement, puis ouvrir le panneau.
- Coût INI : `holstered→drawn = −5`, `ready→drawn = −3` (dépend de l'état courant).

**ERG-W2 — CaC : sélection arme par défaut selon state_weapon**
- Si `state_weapon ≠ 'drawn'` → arme sélectionnée par défaut = Mains nues (null).
- Si `state_weapon === 'drawn'` → arme sélectionnée par défaut = arme CaC équipée.
- Au clic sur arme équipée → `state_weapon = 'drawn'` + coût INI (`holstered→drawn = −5`, `ready→drawn = −3`).
- Au clic sur "Mains nues" → `state_weapon = 'holstered'` + coût INI (`drawn→holstered = −10`).
- Afficher le coût INI dynamiquement dans l'UI (dépend de l'état courant, jamais fixe — P7).

### Décision architecture (à confirmer)

BUG-W2 (crash silencieux) : bug isolé, peut être traité sans REWORK-06.
BUG-W1 + ERG-W1 + ERG-W2 : liés au weapon state — idéalement dans REWORK-06 (combatDeclarationStore), mais peuvent être implémentés comme callbacks props en attendant.

**Option A — Sprint isolé bugs + ergonomie sans REWORK-06**
Implémenter BUG-W1, ERG-W1, ERG-W2 via callbacks dans `CombatGmDeclareWindow` uniquement (GM d'abord). Prop `onWeaponStateChange(newState)` dans `MeleeCombatPanel` et `AssaultRangedPanel` → parent recalcule INI delta + update `localStates.weapon`.
Avantage : rapide, ciblé. Risque : ajoute des callbacks qui disparaîtront avec REWORK-06.

**Option B — REWORK-06 d'abord, puis features triviales**
Créer `combatDeclarationStore`, migrer les deux parents, puis ERG-W1/W2 = 5 lignes chacune.
Avantage : propre, sans dette. Risque : sprint long avant la moindre amélioration visible.

Lecture requise avant tout plan : `docs/SYSTEME/COMBAT.md`, `MeleeCombatPanel.jsx`, `CombatGmDeclareWindow.jsx` (sections weapon state).
Deux points notés avant de coder — statut post-implémentation :

styles prop — ✅ RÉSOLU par P2 : styles retiré des interfaces, chaque panneau définit ses propres styles internes. Aucune prop styles passée.

getLabel — ✅ RÉSOLU : GM passe getLabel(tokenId) local, Joueur passe tokens.find inline. Chaque parent passe sa propre implémentation via prop.

7 pièges identifiés (P7 ajouté Session 98)
P1 — DeclareLogContent : corps uniquement, pas de titre

Le GM met "Déclarations · Tour N" dans son header draggable. Le Joueur le met en titre de section inline. Si DeclareLogContent inclut le titre, il sera doublé côté GM. Révision : DeclareLogContent = les entrées seulement. Chaque parent gère son propre titre.

P2 — Supprimer styles prop des 3 panneaux

Passer l'objet de styles du parent (S GM vs W Joueur) en prop signifie que le panneau casse silencieusement si le parent renomme une clé. Or les styles internes (assaultSection, assaultOption, assaultRadio…) sont quasi-identiques entre GM et Joueur — les panneaux peuvent les définir eux-mêmes. La seule vraie différence est le container wrapper (280px GM vs 360px Joueur en flex) — et ça reste dans le parent. Révision : styles retiré des interfaces. Les 3 panneaux définissent leurs propres styles internes.

P3 — MeleeCombatPanel : il faut isWeaponDrawn

CombatActionWindow grise les armes de contact si states.weapon !== 'drawn' (L.1201). Cette info n'est pas dans les props prévues. Révision : ajouter isWeaponDrawn: bool — le parent passe states.weapon === 'drawn'.
⚠ GM passait isWeaponDrawn={true} hardcodé ("PNJ auto-géré") — hypothèse fausse découverte Session 98. Un PNJ peut avoir son arme rangée. Voir P7 pour les conséquences et REWORK-06 pour la correction complète.

P4 — MeleeCombatPanel : normaliser GM chargeSelection?.move vs Joueur moveSelection

Les deux parents ont des structures différentes pour le feedback charge. Révision : prop renommée chargeMoveDest: { targetPosX, targetPosY } | null — le GM passe chargeSelection?.move ?? null, le Joueur passe moveSelection ?? null.

P5 — handleStartMelee() n'est pas supprimée, elle est déplacée (COM5)

Clarification importante : handleStartMelee() reste dans le GM — elle est seulement retirée du click-mode-chip. Après fix, le flux devient : clic "Corps à corps" → panneau CaC apparaît → mode sélectionné → bouton "Cibler" (dans le panneau partagé, déjà présent côté Joueur L.1363) → onChooseTarget(0) → parent appelle handleStartMelee(). Le bouton explicite aligne la UX GM sur la UX Joueur. ✅

P6 — COMBAT_MODE_DEFS : tooltips divergents entre GM et Joueur

Les libellés des tooltips ne sont pas identiques (ex. Joueur : "+3 à l'attaque / −5 à la défense si attaqué jusqu'à la prochaine action." vs GM : "+3 attaque / −5 défense si attaqué."). Décision : version Joueur = source canonique (plus complète, avec référence LdB). Grep à faire avant de coder pour capturer les chaînes exactes.

P7 — state_weapon : 3 états, pas 2 — tooltip existant incorrect (découvert Session 98)

MeleeCombatPanel L.138 affiche "−3 INI" pour sortir l'arme. C'est FAUX.
Source : docs/SYSTEME/COMBAT.md — matrice de transition réelle :

  holstered → ready  : −3 INI
  holstered → drawn  : −5 INI   ← auto-draw depuis rangée coûte −5, pas −3
  ready     → drawn  : −3 INI
  drawn     → holstered : −10 INI  ← mains nues depuis drawn = très punitif
  drawn     → ready  : −3 INI

state_weapon ('holstered'|'ready'|'drawn') est PERSISTANT entre les tours (contrairement à position/cover/vitesse).

Conséquences pour toute future feature touchant weapon state :
- Ne jamais afficher un coût fixe dans les tooltips — dépend de l'état courant en DB
- "Clic mains nues = holster" peut coûter −10 INI si weapon était drawn — à signaler à l'utilisateur
- isWeaponDrawn={true} hardcodé côté GM (P3) = présupposait que PNJ = toujours drawn, ce qui est faux
- Ces features sont HORS SCOPE REWORK-05 → sprint dédié

Note architecture (Session 98) : les deux parents (GM + Joueur) maintiennent weapon state en local React state. Toute feature d'auto-draw nécessite un callback parent→composant ou une refonte vers combatDeclarationStore. → REWORK-06 validé (voir ci-dessous).

---

Limite de REWORK-05 — Prémices de REWORK-06 (validé Session 98)

REWORK-05 a correctement extrait les panneaux partagés. Il n'a pas résolu le problème sous-jacent : le staging state de la déclaration (weapon, position, cover, fire_mode, vitesse + arme sélectionnée + cibles) est fragmenté en local React state dans deux composants différents. Quand un panneau partagé doit affecter ce state, il ne peut pas y accéder directement — d'où les callbacks, la prop drilling, et les débats d'architecture.

Pattern professionnel identifié (boardgame.io, Zustand best practices 2025) : distinguer server state (combatStore existant) et staging state (état client en construction avant submit). Le staging state de la déclaration combat = un store Zustand dédié.

REWORK-06 — combatDeclarationStore
Créer client/src/stores/combatDeclarationStore.js :

  {
    // État déclaré (local, envoyé au serveur à COMBAT_ACTION_DECLARE)
    weapon:    'holstered',   // 'holstered' | 'ready' | 'drawn'
    position:  'standing',
    cover:     'exposed',
    fire_mode: 'cc',
    vitesse:   'normal',

    // Sélections d'action
    selectedMeleeWeaponId:  null,
    selectedDroneWeaponId:  null,
    assaultTarget:          null,    // { targetTokenId } | null
    meleeTargets:           [],
    combatMode:             'normal',

    // Actions
    setWeapon:           (state) => ...,
    setMeleeWeapon:      (id) => ...,
    setAssaultTarget:    (target) => ...,
    resetDeclaration:    () => ...,   // appelé au submit + annulation + changement de slot
  }

Résultat attendu :
- CombatGmDeclareWindow + CombatActionWindow → orchestrateurs de flux WS uniquement (plus de local state déclaration)
- MeleeCombatPanel, AssaultRangedPanel, DroneWeaponPanel → lisent/écrivent dans le store directement, zéro callback, zéro prop drilling
- Auto-draw devient trivial : setWeapon('drawn') depuis n'importe quel composant
- Reset propre sur submit, annulation, changement de slot actif
- Features ergonomiques (auto-draw, default mains nues) implémentables sans débat architectural

Périmètre REWORK-06 (sprint dédié — ne pas mélanger avec des bugs) :
- Nouveau fichier : client/src/stores/combatDeclarationStore.js
- Migrer local state déclaration de CombatGmDeclareWindow vers le store
- Migrer local state déclaration de CombatActionWindow vers le store
- Simplifier les props de MeleeCombatPanel, AssaultRangedPanel, DroneWeaponPanel
- Implémenter auto-draw + default mains nues proprement
- Serveur inchangé — payload COMBAT_ACTION_DECLARE identique