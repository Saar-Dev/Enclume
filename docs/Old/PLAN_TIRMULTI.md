# PLAN_TIRMULTI.md — Sprint Tir Multi : Attaque multiple à distance (LdB p.218, `docs/REGLES/REGLESYSCOMBAT.md`)

> **✅ CHANTIER CLOS (2026-07-19, Session 165, dev/Saar).** Archivé conformément à `docs/RegleDocumentaire.md`
> Règle 10 — contenu durable transféré vers `docs/SYSTEME/COMBAT.md` (section « Attaques multiples —
> Tir Multi ») et `docs/VOCABULARY.md` (entrée « Attaques multiples »). Détail Testé/Non testé complet :
> `docs/EN_COURS.md` Items 94/95 (archive, pas mis à jour ici après clôture). Reste ouvert et non traité
> par ce chantier : dette **INI5** (`docs/BUGIDENTIFIE.md`, audit forfait Initiative CaC demandé par
> Saar) et dette doc `docs/SYSTEME/COMBAT.md:850` (`pendingDamageActions` obsolète).
>
> Créé : 2026-07-17 (dev/Saar). Statut : **⚠️ EN PAUSE, mais débloqué (2026-07-19)** — le chantier de
> fond dont ce plan dépendait est terminé et archivé : `docs/Old/PLAN_COMBAT_TIMELINE.md`, contenu
> durable dans `docs/SYSTEME/COMBAT.md` (section « Échelle de phases »). Ce qui a commencé comme un
> simple prérequis (`docs/Old/PLAN_COMBAT_ACTION_QUEUE.md`, réparer un bug de chaînage) a révélé un
> besoin plus profond : une vraie timeline de combat à phases (une carte = une action, entrelacée entre
> tous les combattants), qui a aussi rendu implémentable « Retarder son Action » (LdB p.218). Le Tir
> Multi devient désormais une déclinaison quasi directe de ce modèle (une attaque supplémentaire = une
> carte supplémentaire dans la timeline) — D3/D4/D5 sont absorbés par cette architecture ; **D8 devient
> sans objet** : CaC et Tir sont désormais mutuellement exclusifs à la déclaration (nouvelle règle
> ajoutée en cours de route, plus fidèle au RAW — à répercuter explicitement dans ce plan à sa reprise,
> pas une simple conséquence automatique à assumer). **Prêt à être repris**, pas encore fait.
> Nom de fichier choisi `PLAN_TIRMULTI` plutôt que le terme littéral demandé (« attaqueMultiple ») : ce
> dernier désigne déjà, dans le code et les logs, le mécanisme **CaC** (`multiAttackMalus`, breakdown
> `'Attaque multiple'`, `socketCombatHelpers.js:502-503/547`) — garder deux chantiers distincts sous deux
> noms distincts évite l'ambiguïté documentaire (§2).
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md`/`docs/VOCABULARY.md`.

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

### RAW réel `[VÉRIFIÉ]` — trois mécaniques distinctes, ne pas les confondre

Le grep initial a fait remonter **trois** paragraphes RAW différents contenant le mot « plusieurs » /
« multiple » appliqués au tir. Ce chantier ne couvre que le premier :

1. **« Effectuer plusieurs Attaques par Tour » (RÈGLE AVANCÉE, p.218-219,
   `docs/REGLES/REGLESYSCOMBAT.md:604-618`)** — **c'est la cible de ce plan**. Règle générique
   (déclarée dès l'étape de déclaration d'intention), pas spécifique CaC ni Tir : « Un personnage peut
   effectuer jusqu'à trois Attaques par Tour de combat […]. Il subit toutefois un malus pour toutes les
   Attaques du Tour : -5 s'il veut effectuer 2 Attaques, ou -7 pour 3 Attaques. » Le texte RAW décrit
   aussi un décalage de phase d'Initiative (-5/-10 par attaque supplémentaire) — **non implémenté côté
   CaC** (voir §0.2) : le précédent existant applique uniquement le malus au jet, jamais de
   replanification de phase. Le texte RAW **n'exige pas de cibles distinctes** — rien dans ce paragraphe
   ne l'impose (voir §4, D2).
   Déjà livré côté CaC — **Sprint CaC 4b** (`docs/ROADMAP.md`, ✅ session 74). Jamais livré côté Tir —
   **Sprint Tir Multi**, objet de ce plan.
2. **« Rafale longue sur plusieurs adversaires » (action exclusive, p.228,
   `docs/REGLES/REGLESYSCOMBAT.md:1519-1529`)** — **hors scope, mécanique distincte**. Un seul Test de
   tir par groupe de 5 balles tirées en Rafale longue, plusieurs cibles espacées de 3m maximum, sans
   malus à portée courte / -5 à portée moyenne. N'a rien à voir avec le malus -5/-7 « Attaques multiples »
   : formule de malus différente, condition de portée différente, action exclusive au lieu d'une
   déclaration standard. **Stub client existant déjà présent** (`combatSections.js:177-182`,
   `RL_BUTTONS` bouton `{ value: 'multi', label: 'Multi' }` → `FIRE_MODE_VARIANTS.RL.find(v => v.id ===
   'rl_mc')`, ligne 169 : `{ id: 'rl_mc', bulletCount: 5, bonusComp: 0, bonusDmg: 0 }`) — bonus à 0,
   jamais branché à une vraie mécanique multi-cible côté serveur (`resolveAssaultAction` ne contient
   aucune boucle sur plusieurs `target_token_id`, grep `[VÉRIFIÉ]`). **Ne pas toucher à ce stub dans ce
   chantier** — un futur plan séparé le reprendra si besoin (§6 CLAUDE.md, un plan = un problème).
3. **« Combat à deux armes » — tir simple/RC dual-wield, deux cibles (p.223,
   `docs/REGLES/REGLESYSCOMBAT.md:1567-1580`)** — **hors scope, déjà livré**. Deux Tests de tir
   indépendants (un par arme), le second à chances divisées par deux — mécanique différente (deux armes
   distinctes, pas une même arme tirant plusieurs fois), déjà codée et active
   (`AssaultRangedPanel.jsx:127-146`, prop `showDualWieldSection`/`isDualWield`,
   `dualWieldBonusComp`). Ne pas confondre les deux « armes » de ce mode avec les 2-3 « attaques »
   de ce plan.

### 0.1 Ce qui existe déjà et sera réutilisé `[VÉRIFIÉ]` (recherche interne exhaustive)

**Déclaration (client)** :
- `MeleeCombatPanel.jsx` — composant CaC déjà **partagé** Joueur/GM (`perSlotTargeting` bool
  distingue les deux UX). Sélecteur 1/2/3 attaques = 3 `CountChip` en dur (lignes 268-270), tooltip
  citant le malus RAW. Ciblage : un bouton par slot côté joueur (lignes 284-308,
  `Array.from({length: effectiveMeleeCount}, ...)`), sélection chaînée séquentielle côté GM (lignes
  309-339, `selectNext(idx)` récursif).
- `CombatActionWindow.jsx` (joueur) — state `meleeCount`/`meleePendingTokenIds` (array), tronqué à la
  volée si le nombre d'attaques diminue (`onMeleeCountChange`, ligne 1196). Payload
  `mapActions.melee` = **array** `[{ targetTokenId, weaponInvId, naturalWeaponCharMutationId }, ...]`
  (lignes 582-588). **Aucune vérification de distinctness des cibles**, ni côté client ni côté serveur
  (gap pré-existant sur le CaC lui-même, §4 D2).
- `CombatGmDeclareWindow.jsx` (MJ) — même structure de payload, sélection de cibles via une chaîne de
  rappels `onEnterTargetMode` au lieu de boutons par slot (lignes 357-383).
- **`mapActions.attack` (tir) est aujourd'hui un OBJET UNIQUE**, pas un array, des deux côtés
  (`CombatActionWindow.jsx` ligne ~569-580, `CombatGmDeclareWindow.jsx` lignes 443-453) —
  **aucune structure de déclaration multi-tir n'existe côté client** (ni state, ni UI, ni payload).
  `AssaultRangedPanel.jsx` (`[VÉRIFIÉ]` lecture complète) : `assaultTargetId` est une string unique,
  aucun compteur, aucun array — le composant n'a **aucune** plomberie commune avec le motif
  compteur+slots de `MeleeCombatPanel.jsx`.
- **Coût Initiative à la déclaration** (`socketCombatAnnouncement.js:261-264`) — CaC paye un forfait
  fixe : `-3` de base pour l'action CaC, `+ -5` supplémentaire **fixe** si `mapActions.melee.length > 1`
  (2 **et** 3 attaques payent le même -5 de coût d'engagement — distinct du malus -5/-7 appliqué au jet
  en résolution). Le tir simple aujourd'hui **ne paye aucun coût Initiative de base** dans ce bloc (seul
  `cover_shot` -3/-5 et Tir visé `getAimIniCost` y contribuent, lignes 265-267 et 290) — aucun
  équivalent « coût d'engagement tir multiple » n'existe encore (§4 D3).
- **Stub mort à ne pas réactiver** `[VÉRIFIÉ]` : `combatSections.js:132`, entrée `MAP_ACTIONS`
  `{ k: 'multi', l: 'Attaque multiple', tooltip: 'Attaque sur plusieurs cibles -5.', ini: -5, active:
  false }` — jamais rendue (`active:false`), les deux fenêtres de déclaration envoient
  systématiquement `mapActions.multi: false` en dur. Vestige d'un ancien design antérieur au CaC 4b
  actuel (compteur 1/2/3 + slots) — **à ignorer/nettoyer, pas à réutiliser** (créerait un deuxième
  mécanisme « Attaque multiple » incompatible avec celui déjà en prod, violerait §1.4 CLAUDE.md).

**Déclaration (serveur)** — `socketCombatAnnouncement.js`, handler `COMBAT_ACTION_DECLARE` :
- Boucle `for (const {...} of mapActions.melee)` (lignes 341-361) insère une row `combat_actions` par
  élément, **sans cap serveur à 3** (le cap n'existe que côté client, 3 `CountChip` figées) ni
  vérification de distinctness. `mapActions.attack` est traité comme un objet singulier
  (ligne 145 `if (mapActions?.attack) {...}`, ligne 320 insertion unique) — **le handler ne supporte
  structurellement pas un array `mapActions.attack` aujourd'hui**.
- Toute la validation tir existante (arme requise PC22, munitions suffisantes lignes 209-220,
  compétence Tir automatique RC/RL PC23) traite `mapActions.attack` comme un objet unique — à revoir
  si le payload devient un array (§4 D1).

**Résolution (serveur)** — `server/src/socket/socketCombatHelpers.js` :
- `resolveMeleeAction(io, campaignId, action, character, remainingMeleeActions = [], totalMeleeCount =
  1, confirmedModifiers = null, pendingMaps)` (ligne 327) — malus `multiAttackMalus = totalMeleeCount
  === 2 ? -5 : totalMeleeCount >= 3 ? -7 : 0` (ligne 502-503), injecté dans `chancesAttaque` (ligne
  530), ligne de breakdown `{ label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' }`
  (ligne 547, affichage 100% générique côté client — `Sidebar.jsx` `DiceBreakdownPopover` itère le
  tableau sans logique spécifique au libellé, aucune modif client nécessaire pour la ligne
  équivalente côté tir).
- **Mécanisme « attaque suivante »** : recursion explicite sur `remainingMeleeActions`.
  - Défenseur **PNJ** (lignes 692-806) ou **drone** (lignes 807-836) : résolution complète immédiate
    (pas de jet de défense pour le drone), puis rappel direct `resolveMeleeAction(...,
    remainingMeleeActions.slice(1), totalMeleeCount, ...)` avant de retourner.
  - Défenseur **PJ** (lignes 838-855) : bloque le slot — `INSERT combat_pending(type:'melee_defense',
    payload: commonPending)` (payload transportant `remainingMeleeActions`/`totalMeleeCount`),
    `setFSMSubPhase(..., 'AWAITING_DEFENSE')`, retourne `{ suspend: true }`. La boucle appelante
    (`socketCombatResolution.js:216-328`) lit ce `suspend` et **n'avance pas le slot**. La suite est
    reprise dans le handler `COMBAT_MELEE_DEFENSE_CONFIRM` (lignes 544-763), qui rappelle
    `resolveMeleeAction` avec la queue restante (lignes 733-742) une fois le jet de défense du joueur
    reçu.
- `resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options =
  {})` (ligne 1316) — **aucun paramètre équivalent** `remainingAssaultActions`/`totalAssaultCount`.
  Assemblage du Seuil (`totalModComp`, lignes 1455-1475) : c'est **exactement là** (entre
  `aimedLocationMalus` et `shieldAtkMalus`, ou juste après) que s'insérerait un terme
  `multiAttackMalus` ranged, avec sa ligne de breakdown au même patron `{ label, value, type }`
  (lignes 1479-1498).
  **Divergence structurelle majeure avec le CaC** — pas de jet de défense opposé en tir
  (`isSuccess = rollAttaque <= chancesDeReussite` suffit, ligne 1477) :
  - Tireur **PJ**, touché (lignes 1564-1612) : ne calcule pas les dégâts tout de suite —
    `INSERT combat_pending(type:'damage', payload:{...})`, `setFSMSubPhase(..., 'AWAITING_DAMAGE')`,
    le joueur lance lui-même ses dégâts via `COMBAT_DAMAGE_CONFIRM`
    (`socketCombatResolution.js:334-536`). **`resolveAssaultAction` retourne toujours `{ suspend:
    false }`** (ligne 1709), y compris ici — **le slot avance déjà** (boucle `nonMeleeActions`,
    `socketCombatResolution.js:218-303`, aucun `needsDefenseWait` pour `assault`) **avant même que le
    joueur ait confirmé ses dégâts**. `COMBAT_DAMAGE_CONFIRM` lui-même ne fait ni recursion ni
    `advanceSlot` en sortie (`[VÉRIFIÉ]` lecture complète lignes 334-540) — c'est une divergence
    d'architecture FSM par rapport au CaC, pas un détail (§4 D4/D5).
  - Tireur **PNJ**, touché (lignes 1613-1684) : résolution complète immédiate
    (`damageService.resolveTargetHit`), pas de pending — un chaînage « tir suivant » façon CaC PNJ y
    serait immédiat, sans complication.
  - **Miss** : pas de pending non plus (PJ : `COMBAT_ATTACK_PLAYER_RESULT{hit:false}` sur son socket ;
    PNJ : `COMBAT_ATTACK_RESULT{isSuccess:false}` à la room) — un chaînage devrait s'y accrocher
    immédiatement, avant le `return`.
  - `character.type === 'drone'` délègue entièrement à `resolveDroneAssaultAction` (fonction séparée,
    ligne 1004-1314) — branche attaquant distincte à traiter séparément si le Tir Multi doit couvrir
    les tireurs-drones (§4, à trancher — hors scope par défaut sauf décision contraire, aucune
    demande Saar en ce sens à ce stade).
  - `resolveAssaultAction` ne calcule **aucun malus multi-adversaires**
    (`multiMalusAttaquant`/`multiMalusDefenseur`, `countAdversaires`/`multiAdversaryMalus`,
    présents uniquement côté `resolveMeleeAction` lignes 496-500/588-592) — cohérent avec le RAW,
    « Combat contre plusieurs adversaires » (p.224) est explicitement rattaché à la section **Combat
    au contact** (renvoi croisé Arts martiaux ligne 1272-1273 : « voir Combat au contact, Combat contre
    plusieurs adversaires, page 224 ») — confirmé hors scope pour le tir, pas une simplification à
    corriger.

**Schéma `combat_actions`** `[VÉRIFIÉ]` (migrations 54/56/57/76/134/138/156/164) — **entièrement
réutilisable tel quel**, aucune migration nécessaire pour ce chantier : `type='assault'`,
`weapon_inv_id`/`drone_weapon_inv_id` (FK XOR), `target_token_id`, `fire_mode`, `bullet_count`,
`fire_mode_bonus_comp`/`fire_mode_bonus_dmg`, `aim_bonus_comp`, `aimed_location`, `modifiers` (jsonb).
`sequence` ne code pas l'ordre inter-attaques (même valeur `3` pour toutes les rows d'une même
catégorie, déjà le cas pour `melee`) — l'ordre vient du array déclaré, transporté par la recursion, pas
d'une colonne DB. Pas de colonne « nombre total » à ajouter : `totalMeleeCount` actuel est calculé à la
résolution via `meleeActions.length` (comptage des rows), jamais stocké — le Tir Multi suivrait le même
principe.

### 0.2 Absent aujourd'hui `[VÉRIFIÉ]`

- Aucune structure de déclaration multi-tir côté client (state, UI, payload).
- Le handler serveur de déclaration ne sait traiter `mapActions.attack` qu'en objet singulier.
- `resolveAssaultAction` n'a aucun paramètre de queue ni de recursion « tir suivant ».
- Le couple `suspend`/`needsDefenseWait` qui bloque l'avancement de slot côté CaC n'a pas d'équivalent
  côté tir — le slot d'un tireur PJ avance déjà avant sa confirmation de dégâts.
- Aucune entrée `docs/VOCABULARY.md` pour « Attaques multiples » (le mécanisme générique p.218,
  **déjà en production côté CaC depuis la session 74 sans avoir jamais été documenté** — dette
  pré-existante indépendante de ce chantier, à corriger en même temps par cohérence plutôt que dans un
  chantier séparé qui ne toucherait à rien d'autre).
- **Note annexe, dette documentaire hors scope de ce plan** : `docs/SYSTEME/COMBAT.md:850` décrit un
  `pendingDamageActions` comme une **Map in-memory** (« perd son contenu si le serveur redémarre ») —
  grep exhaustif `[VÉRIFIÉ]` : ce nom n'existe nulle part dans le code actuel. Le mécanisme réel est
  `combat_pending` (table Postgres, durable), déjà confirmé ci-dessus. Ce SYSTEM doc a dérivé de la
  réalité sur ce point précis — à signaler à Saar, correction séparée (pas dans ce plan, un plan = un
  problème).

---

## 1. Scope tranché (2026-07-19, confirmé Saar — voir §4 pour le détail RAW)

**Inclus** : porter le mécanisme RAW « Attaques multiples » (p.218-219, malus -5/2 attaques ou -7/3
attaques) au tir, pour un tireur PJ ou PNJ **humanoïde** utilisant une arme à feu en mode Tir simple/Tir
à répétition (CC) uniquement — décliner jusqu'à 3 tirs dans le même Tour, cibles distinctes ou non
(RAW muet sur ce point, D2).

**Exclus (confirmé §0 + §4)** : Rafale courte/longue et tireurs-drones (RAW p.218-219 ne les couvre
pas — Rafale longue est de toute façon une action exclusive, structurellement incompatible ; RC et les
tireurs-drones restent hors scope par défaut faute de texte RAW, D6) ; Rafale longue sur plusieurs
adversaires (p.228, stub `rl_mc` existant, mécanique distincte) ; Combat à deux armes / dual-wield deux
cibles (p.223, déjà livré) ; malus multi-adversaires (p.224, CaC uniquement, confirmé par le RAW) ;
Rafale courte/longue elles-mêmes (bonus déjà câblés, inchangés).

**Arme** : une seule arme pour toute la série, jamais de changement d'arme entre deux tirs du même Tour
Multi (D9, tranché Saar).

**§4 entièrement tranché — prêt pour le Lot A.**
(le malus -5/-7 « Attaques multiples » a-t-il un sens en Rafale, ou est-il réservé au Tir simple/CC
comme le CaC est réservé aux armes de contact ?) — voir §4.

---

## 2. Terminologie — `docs/VOCABULARY.md`

Aucune entrée existante pour ce mécanisme, ni CaC ni Tir (`[VÉRIFIÉ]`, grep `VOCABULARY.md` vide sur
« Attaque multiple »/« CaC 4b »/« Tir Multi »). À ajouter avant le code (`CLAUDE.md` §2) :

- Entrée générique **« Attaques multiples »** (LdB p.218-219) : définition RAW, malus -5 (2)/-7 (3),
  distinction du coût d'Initiative d'engagement (forfait déclaration) vs malus au jet (résolution).
- Sous-entrée **CaC 4b** (déjà livré, à documenter rétroactivement — dette indépendante) et
  **Tir Multi** (ce chantier), même mécanique RAW, deux implémentations distinctes.
- Désambiguïsation explicite avec **« Rafale longue sur plusieurs adversaires »** (p.228) et
  **« Combat à deux armes / dual-wield »** (p.223) — même risque de confusion que Échange/Transfert ou
  Tir visé/Viser une Localisation (précédents déjà tranchés dans ce projet).

---

## 3. Ce qui reste identique au CaC (pas de nouveau design nécessaire)

- **Malus au jet** : `totalCount === 2 ? -5 : totalCount >= 3 ? -7 : 0`, même formule, même
  emplacement conceptuel dans l'assemblage du Seuil, même patron de ligne de breakdown.
- **Comptage** : `totalAssaultCount` = nombre de rows `combat_actions` de type `assault` déclarées ce
  tour (comme `meleeActions.length` aujourd'hui), jamais stocké en base.
- **Plafond à 3** : reste une limite UI uniquement (comme le CaC), pas une contrainte serveur (à
  moins que §4 D1 en décide autrement en même temps).
- **`MeleeCombatPanel.jsx` comme référence de composant** : le motif compteur `CountChip` (1/2/3) +
  slots de cible est directement transposable à un composant tir analogue (pas nécessairement le même
  composant réutilisé tel quel — `AssaultRangedPanel.jsx` porte déjà beaucoup d'état spécifique au tir
  — mais le même *motif* UX, pas un nouveau design UX à inventer).

---

## 4. Points ouverts — état après vérification code réelle + arbitrage RAW (2026-07-19)

`docs/EN_COURS.md` Item 82/88 : entre la rédaction initiale de ce plan (session 157) et sa reprise
(session 164+), la refonte de l'échelle de phases (`docs/Old/PLAN_COMBAT_TIMELINE.md`, session 159) a
changé la donne — plusieurs points ci-dessous ne sont plus des décisions produit, mais des constats de
code vérifiés `[VÉRIFIÉ]` (2026-07-19, lecture directe, pas le souvenir de la session 157).

- **D1 — Forme du payload `mapActions.attack`.** **Tranché : (a) array**, comme `mapActions.melee`.
  Cohérent avec le seul précédent existant (CaC 4b) et avec la façon dont `buildTimelineEntries` va
  devoir traiter les deux types de façon symétrique (voir Lot A/B ci-dessous) — (b) aurait dupliqué la
  logique de groupement pour un gain nul.
- **D2 — Cibles distinctes obligatoires ou non ?** RAW p.218 ne l'exige pas (`[VÉRIFIÉ]`,
  `REGLESYSCOMBAT.md:604-618`, aucune mention de distinctness). **Tranché : permissif**, comme le CaC
  4b actuel (aucune vérification, ni client ni serveur) — fidèle RAW + cohérent avec le précédent.
- **D3 — Coût Initiative de déclaration.** RAW p.218-219 décrit **un seul** mécanisme chiffré : le
  décalage de phase de -5 Initiative par attaque supplémentaire (« Deuxième Action : score d'Initiative
  -5 », `REGLESYSCOMBAT.md:611-618`) — **déjà entièrement implémenté** par `computeSeriesPositions`
  (`socketCombatHelpers.js:207-209`, `basePosition - idx * 500` à l'échelle ×100). Aucun autre malus
  Initiative chiffré n'existe dans le texte RAW pour la déclaration elle-même. **Tranché : aucun forfait
  supplémentaire pour Tir Multi** — le décalage de phase EST le coût RAW, il ne s'ajoute à rien.
  **Note hors scope** : le CaC actuel applique en plus un `-3` d'engagement CaC + `-5` fixe si
  `mapActions.melee.length > 1` (`socketCombatAnnouncement.js:305-308`) — un forfait qui semble
  redondant avec le décalage de phase déjà RAW, mais c'est un comportement CaC pré-existant, hors
  périmètre de ce plan (un plan = un problème, `CLAUDE.md` §13) ; à signaler séparément si Saar veut
  l'auditer.
- **D4/D5 — Chaînage « tir suivant » / suspend de slot.** **Devenus sans objet** — l'ancienne conception
  (recursion `remainingAssaultActions`, `suspend` dédié) appartenait au modèle `combat_roster` /
  `active_slot_idx`, retiré migration 174. Avec l'échelle de phases : chaque tir déclaré devient sa
  propre `combat_timeline_entries` (comme chaque attaque CaC), résolue individuellement par
  `advanceTimeline` — aucune récursion à écrire. Le chaînage du calcul de dégâts PJ est déjà générique
  et déjà testé en prod : `confirmDamage` (`socketCombatHelpers.js:707-736`) consomme une file FIFO de
  `combat_pending(type:'damage')` par token (`docs/Old/PLAN_COMBAT_ACTION_QUEUE.md` §3, item 83 —
  codé et validé en base réelle avant ce chantier). `resolveAssaultAction` ne suspend déjà jamais le
  slot (`suspend:false` dans toutes ses branches) — rien à changer sur ce point.
- **D6 — RC/RL et tireurs-drones inclus ou non ?** RAW p.218-219 (« Attaques multiples ») ne mentionne
  ni mode de tir automatique ni drones. Rafale longue est de toute façon une **action exclusive**
  (`REGLESYSCOMBAT.md:1510-1511`, registre `shared/combatExclusiveActions.js`) — structurellement
  incompatible avec une deuxième Action dans le même Tour, donc exclue de fait. Rafale courte n'est pas
  couverte par le texte RAW de ce paragraphe. **Tranché (défaut Saar : RAW muet → interdit) : Tir Multi
  couvre uniquement Tir simple/Tir à répétition (CC), personnage humanoïde (PJ/PNJ), pas RC/RL, pas de
  tireur-drone.**
- **D7 — Nettoyage du stub `k:'multi'` mort** (`combatSections.js:132`) — **tranché : retiré en Lot C**
  (code mort confirmé `[VÉRIFIÉ]`, `active:false`, jamais rendu — le garder ne fait qu'entretenir un
  risque de confusion avec ce chantier).
- **D8 — Interaction avec une déclaration CaC simultanée.** **Devenu sans objet** — CaC et Tir sont
  désormais mutuellement exclusifs à la déclaration, guard serveur ajouté session 159
  (`socketCombatAnnouncement.js:86-97`, `COMBAT_DECLARE_ERROR` si `mapActions.attack` ET
  `mapActions.melee` non vide). Le pool à 3 Attaques reste donc bien deux compteurs indépendants CaC/Tir
  de fait, puisqu'un seul des deux peut être déclaré par Tour.
- **D9 — Une arme différente par tir de la série, ou une seule arme pour toute la série ?** RAW muet.
  **Tranché (Saar, 2026-07-19) : une seule arme pour toute la série** — changer d'arme entre deux tirs
  du même Tour Multi n'est pas envisageable. Contrairement au CaC (`mapActions.melee[i].weaponInvId`
  par slot, mais toujours peuplé de la même valeur en pratique — `CombatActionWindow.jsx:589`, aucun
  vrai précédent de changement d'arme par slot), le payload `mapActions.attack[]` porte donc une arme
  unique au niveau de la série — pas de `weaponInvId` par élément.
- **D10 — Tir visé / Tir à deux armes / Viser une Localisation, cumulables avec Tir Multi ?**
  - **Tir visé** (LdB p.227-228) : **exclu**, mécanique — `isAimEligible`
    (`shared/combatExclusiveActions.js:89-111`) exige déjà « aucune autre action ce Tour », une série de
    2-3 tirs en est une par construction. Extension directe d'une règle d'exclusivité déjà en place, pas
    une nouvelle décision produit.
  - **Tir à deux armes / dual-wield** (LdB p.223) : **exclu**, RAW — cumuler dual-wield (2 Tests par tir)
    avec 3 Attaques multiples donnerait jusqu'à 6 Tests dans le même Tour, alors que le RAW plafonne
    explicitement à trois Attaques par Tour (« c'est le maximum autorisé », p.218).
  - **Viser une Localisation précise** (LdB p.229-230, malus -3/-5/-7/-7 à -10 selon la zone) — RAW
    officiel, pas une mécanique maison (correction : je l'avais qualifiée à tort de « maison » en
    session). **Tranché (Saar, 2026-07-19) : exclu, non cumulable avec Tir Multi** — comme Tir visé et
    le dual-wield, un seul de ces trois raffinements de tir à la fois, jamais combiné avec une série de
    plusieurs attaques.

---

## 5. Lots séquentiels proposés (2026-07-19, resserré après vérification code — un seul codé à la fois, validé avant le suivant)

Principe directeur (`CLAUDE.md` §1.4, autorité unique) : le CaC 4b a déjà résolu le même problème une
fois (groupement par `declaration_group_id`, étalement de position, calcul du malus par comptage de
sœurs vivantes). Ne pas dupliquer cette logique pour le tir — l'**extraire en fonctions partagées**
utilisées par les deux mécaniques, plutôt que copier-coller une seconde implémentation qui divergerait
avec le temps.

**Lot A — Déclaration.**
- D1 : `mapActions.attack` devient un array (comme `mapActions.melee`). Tous les lecteurs actuels en
  objet singulier ré-audités : `socketCombatAnnouncement.js` (lignes 92, 160, 178, 238, 280, 286, 296,
  305 zone tir, 316, 323, 361-379, 482, 501), client `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`.
- UI compteur 1/2/3 + sélection de cible(s) (et d'arme si D9 le confirme) sur
  `AssaultRangedPanel.jsx`/`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (motif
  `MeleeCombatPanel.jsx`, pas nécessairement le même composant).
- Handler `COMBAT_ACTION_DECLARE` : boucle d'insertion `combat_actions` (comme `mapActions.melee`
  aujourd'hui), validation arme/munitions par tir déclaré (total de munitions requises vérifié AVANT
  d'insérer, pas tir par tir). Pas de coût Initiative de déclaration à ajouter (D3 tranché).
- `buildTimelineEntries` (`socketCombatHelpers.js:211-266`) : généraliser la boucle de groupement
  actuellement spécifique à `type==='melee'` (lignes 215-236) pour couvrir aussi `type==='assault'` —
  une seule fonction de groupement/étalement paramétrée par type, pas deux copies.
- `docs/VOCABULARY.md` : entrées §2.

**Lot B — Résolution.**
- Extraire le calcul `multiAttackMalus` de `resolveMeleeAction` (`socketCombatHelpers.js:1290-1299`)
  en fonction partagée (ex. `computeMultiAttackMalus(actionId)`), réutilisée par `resolveAssaultAction`
  — même formule RAW (-5/2, -7/3+), même patron de ligne de breakdown, une seule implémentation.
  Aucun autre changement structurel requis (D4/D5 sans objet — voir §4) : `resolveAssaultAction` garde
  son flux actuel (`suspend:false`, pending `damage` FIFO déjà générique).

**Lot C — Nettoyage et polish.**
- D7 : retrait du stub mort `combatSections.js:132`.
- Vérification de l'affichage combat existant (`CombatGmDeclareWindow.jsx`, roster, logs) avec un
  Tir Multi réel — probablement déjà correct par générécité (comme confirmé pour le Bouclier,
  `docs/PLAN_BOUCLIER.md` Lot C), à vérifier avant d'écrire du code neuf.
- Correction de la dette documentaire `docs/SYSTEME/COMBAT.md:850` (`pendingDamageActions` obsolète) —
  si Saar valide de la traiter ici plutôt que séparément.

---

## 6. Hors scope (rappel)

Rafale longue sur plusieurs adversaires (p.228, stub `rl_mc`), Combat à deux armes dual-wield (p.223,
déjà livré), malus multi-adversaires (p.224, CaC uniquement, confirmé RAW). Si un chantier futur reprend
la Rafale longue multi-cibles, il fera l'objet d'un nouveau plan séparé (`CLAUDE.md` §6.8).
