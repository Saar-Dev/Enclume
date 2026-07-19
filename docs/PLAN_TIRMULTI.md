# PLAN_TIRMULTI.md — Sprint Tir Multi : Attaque multiple à distance (LdB p.218, `docs/REGLES/REGLESYSCOMBAT.md`)

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

## 1. Scope tranché (provisoire — dépend des réponses à §4)

**Inclus** : porter le mécanisme RAW « Attaques multiples » (p.218-219, malus -5/2 attaques ou -7/3
attaques) au tir, pour un tireur PJ ou PNJ utilisant une arme à feu en mode Tir simple/Tir à répétition
(CC) — décliner jusqu'à 3 tirs dans le même Tour, cibles au choix (distinctes ou non, voir D2).

**Exclus (confirmé §0)** : Rafale longue sur plusieurs adversaires (p.228, stub `rl_mc` existant,
mécanique distincte) ; Combat à deux armes / dual-wield deux cibles (p.223, déjà livré) ; malus
multi-adversaires (p.224, CaC uniquement, confirmé par le RAW) ; Rafale courte/longue elles-mêmes
(bonus déjà câblés, inchangés).

**À trancher avant de figer ce scope** : tireurs-drones (§0.1, dernier point), interaction avec RC/RL
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

## 4. Points ouverts — décisions à trancher avec Saar avant le Lot A

Contrairement à `PLAN_BOUCLIER.md` (où l'essentiel avait déjà été tranché en session avant rédaction),
ce plan est un premier jet : les 8 points suivants changent réellement l'architecture ou le
comportement produit (`CLAUDE.md` §6.7) et ne sont pas tranchés unilatéralement ici.

- **D1 — Forme du payload `mapActions.attack`.** (a) le transformer en array systématiquement, comme
  `mapActions.melee` — cohérent, mais casse le contrat actuel : tous les lecteurs actuels de
  `mapActions.attack` comme objet singulier (`socketCombatAnnouncement.js:145`, `:265`, `:320`, `:494`,
  côté client `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`) doivent être ré-audités et adaptés.
  (b) garder `mapActions.attack` singulier, ajouter un nouveau champ array dédié (ex.
  `mapActions.attackMulti`) peuplé seulement quand « Tir Multi » est choisi, chemin de code parallèle.
  Recommandation : (a) par cohérence avec le précédent CaC et l'autorité unique (`CLAUDE.md` §1.4) —
  mais c'est un changement de contrat plus large que ce que (b) impliquerait, à evaluer avant de lancer
  le Lot A.
- **D2 — Cibles distinctes obligatoires ou non ?** Le RAW p.218 ne l'exige pas ; le CaC 4b actuel ne le
  vérifie pas non plus (gap pré-existant, ni client ni serveur). Répliquer ce comportement permissif
  pour le tir (fidèle RAW + cohérent CaC), ou profiter de ce chantier pour introduire la vérification
  dans les deux mécaniques à la fois (aligné avec la formulation ROADMAP actuelle « cibles séparées »,
  qui est une reformulation Saar, pas une exigence RAW littérale) ?
- **D3 — Coût Initiative de déclaration.** Le CaC paye un forfait fixe (-3 engagement CaC, -5
  supplémentaire fixe si 2 ou 3 attaques). Le tir simple ne paye aujourd'hui aucun coût Initiative de
  base dans ce bloc. Faut-il un forfait équivalent pour Tir Multi (et si oui, lequel — même -5 fixe,
  ou un forfait propre au tir), ou le malus au jet (-5/-7) suffit-il seul, sans coût d'engagement
  Initiative séparé ?
- **D4 — Mécanisme de chaînage « tir suivant ».** Le point le plus structurant du Lot B. Pas de jet de
  défense opposé en tir (contrairement au CaC) : pour un tireur PNJ ou en cas de miss, le chaînage peut
  s'insérer immédiatement dans `resolveAssaultAction` (comme le fait déjà le CaC pour PNJ/drone). Pour
  un tireur **PJ qui touche**, la résolution crée un `combat_pending(type:'damage')` et attend
  `COMBAT_DAMAGE_CONFIRM` — il faut décider où accrocher le tir suivant : dans `COMBAT_DAMAGE_CONFIRM`
  lui-même (après le calcul des dégâts du tir N, déclencher la résolution du tir N+1), ce qui suppose
  de transporter la queue restante dans le payload du pending `damage` (comme le CaC le fait pour
  `melee_defense`).
- **D5 — `suspend`/`needsDefenseWait` côté tir.** Aujourd'hui le slot d'un tireur PJ avance dès la fin
  de `COMBAT_ACTION_CONFIRM`, sans attendre `COMBAT_DAMAGE_CONFIRM`. Un Tir Multi cohérent avec le CaC
  (slot bloqué tant que toute la séquence n'est pas résolue) demande d'introduire un vrai `suspend` côté
  tir — extension d'architecture FSM, pas un simple ajout de formule. Alternative plus légère : laisser
  le slot avancer comme aujourd'hui et enchaîner les tirs en tâche de fond (paie le prix d'un état
  transitoire plus complexe à suivre pour le MJ, mais ne touche pas à la FSM). À trancher explicitement.
- **D6 — RC/RL et tireurs-drones inclus ou non ?** Voir §1 « à trancher ».
- **D7 — Nettoyage du stub `k:'multi'` mort** (`combatSections.js:132`) — le retirer maintenant (code
  mort confirmé, jamais rendu) ou le laisser (risque de confusion future avec ce chantier, déjà noté
  dans ce document comme vestige) ?
- **D8 — Interaction avec une déclaration CaC simultanée.** `[VÉRIFIÉ]` : `mapActions.melee` et
  `mapActions.attack` peuvent aujourd'hui coexister dans la même déclaration (`mapSelected` est un
  `Set`, `attackSelected`/`meleeSelected` non mutuellement exclusifs,
  `CombatActionWindow.jsx:404-408`) — un personnage peut déjà tirer **et** frapper au contact dans le
  même Tour s'il a le budget Initiative. Le RAW « jusqu'à trois Attaques par Tour » semble viser un
  pool global (toutes attaques confondues), pas 3 CaC + 3 Tirs indépendamment cumulables. Ce plan
  suppose par défaut que **Tir Multi et CaC 4b restent deux compteurs indépendants** (comme c'est déjà
  implicitement le cas entre l'action CaC normale et l'action de tir normale aujourd'hui) — à confirmer
  explicitement, sinon un vrai pool global à 3 (toutes attaques confondues) serait un chantier plus
  large que ce plan.

---

## 5. Lots séquentiels proposés (provisoire, dépend de §4 — un seul codé à la fois, validé avant le suivant)

**Lot A — Déclaration.**
- Selon D1 : adaptation du payload `mapActions.attack` (array ou nouveau champ), UI compteur 1/2/3 +
  sélection de cible(s) sur `AssaultRangedPanel.jsx`/`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`
  (motif `MeleeCombatPanel.jsx`, pas nécessairement le même composant).
- Handler `COMBAT_ACTION_DECLARE` (`socketCombatAnnouncement.js`) : boucle d'insertion `combat_actions`
  (comme `mapActions.melee` aujourd'hui), validation arme/munitions par tir déclaré (chaque tir
  consomme potentiellement une balle différente — vérifier le total de munitions requises AVANT
  d'insérer, pas tir par tir), coût Initiative selon D3.
- `docs/VOCABULARY.md` : entrées §2.

**Lot B — Résolution (le plus structurant, dépend de D4/D5).**
- `resolveAssaultAction` : nouveau(x) paramètre(s) équivalents `remainingMeleeActions`/`totalMeleeCount`,
  `multiAttackMalus` inséré dans `totalModComp`, ligne de breakdown.
- Chaînage « tir suivant » selon D4 (branches PNJ/miss immédiates, branche PJ-touché via le pending
  `damage`) et blocage de slot selon D5.

**Lot C — Nettoyage et polish.**
- D7 (stub mort) si tranché en ce sens.
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
