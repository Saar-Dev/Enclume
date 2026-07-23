SYSTEME/SERVICES_COMBAT.md — Services métier de combat

    Dernière mise à jour : 2026-07-21 — ajout renvoi vers @MODING (mods d'armes).

    Lire pour : résolution de choc, étourdissement, dégâts, blessures, table MR, FSM combat.

    Source : ARCHI_REWORK_DONE.md (REWORK-01, 02, 03, 04, 08) et lecture directe des fichiers.

    > Voir aussi : @COMBAT_FLUX pour le déroulement complet d'un tour de combat (pipelines, phases, ordre des actions).
    > Voir aussi : @MODING pour l'architecture des mods d'armes (weaponModService, registre à hooks).

1. Architecture générale
text

server/src/lib/
├── statusService.js    — résolution du test de choc, étourdissement
├── damageService.js    — localisation, armure, dégâts nets, sévérité, blessure, shock
├── woundService.js     — insertion blessure + broadcast WOUND_ADDED
├── woundUtils.js       — utilitaires blessures (isShockTestRequired, resolveWoundInsertion, etc.)
├── mrTable.js          — table MR Polaris (singleton-promise)
├── combatFSM.js        — machine à états du combat (transitions, guards, sub_phase)
└── socketUtils.js      — getUserColor, checkTokenOwnership

Tous ces services respectent les conventions suivantes :

    Signature : io, db, campaignId, puis un objet de paramètres destructuré.

    Fonctions à effets (DB + WS) retournent void.

    Fonctions pures (calcul) retournent un objet résultat ou null.

    Les erreurs sont loggées et absorbées dans les fonctions à effets.

2. statusService.js
resolveShockTest

Fonction pure — aucun accès DB ni broadcast.
js

resolveShockTest({
  finalSeverity, localisation, is_lethal,
  for_na, con_na, vol_na,
  mod_mutation_shock,   // cumul mutations (getMutationModForResistance)
  mod_advantage_shock,  // cumul avantages (getAdvantageModForResistance)
})
// → null si le test n'est pas requis (blessure légère/moyenne hors Tête, ou pas de blessure)
// → { triggered, roll, rolls, seed, outcome, shockMalus, seuilEtourdi, seuilIncons }

Logique :

    isShockTestRequired(severity, location) → false → retourne null.

    Calcule les seuils via calcSeuils (dans shared/polarisUtils.js).

    Calcule le malus via getShockMalus (charStats.js).

    Lance 1D20 (parseDice).

    Compare le résultat aux seuils + malus → outcome = 'ok', 'etourdi' ou 'inconscient'.

applyStun

Effets DB + WS. Gère les différents cas (PJ, PNJ, shock_auto_stun).
js

await applyStun(io, db, campaignId, {
  targetTokenId, outcome, userId, username, color,
})
// → void

    Détermine si la cible est PJ ou PNJ.

    PJ connecté + shock_auto_stun=true (défaut) → émet COMBAT_STUN_PROMPT au joueur, insère dans combat_pending.

    shock_auto_stun=false → prompt envoyé au GM (qu'il s'agisse d'un PJ ou d'un PNJ).

    PNJ + shock_auto_stun=true → D6 auto serveur (_applyAutoStun).

    Fallback (joueur hors ligne, pas de GM) → D6 auto serveur.

Évolution post-REWORK-04 : le paramètre pendingStunActions a été retiré. L'état est persisté dans combat_pending (table DB) et consommé plus tard par COMBAT_STUN_CONFIRM.
emitShockDiceResult

Fonction synchrone — émet le résultat du D20 de Test de Choc.
js

emitShockDiceResult(io, campaignId, shockResult, userId, username, color)
// → void, émet WS.DICE_RESULT avec cardType: 'shock_test'

3. damageService.js
resolveTargetHit

Résolution complète côté cible : localisation → armure → dégâts nets → sévérité → blessure → shock.
js

await resolveTargetHit(io, db, campaignId, {
  degautsBruts,          // calculé par le caller (MR, modDom, etc.)
  characterIdCible,
  cibleType,             // 'pj', 'pnj', 'drone', null
  char_sheet_id_cible,
  for_na_cible, con_na_cible, vol_na_cible,
  chocDsl = null,        // optionnel — résolution DSL munition (Lot B)
  ammoFx = null,         // optionnel — effets mécaniques munition
  forcedSlotCode = null, // visée (tir visé)
  treatAsContact = false,// true pour CaC et armes de jet/trait
})
// → null si cibleType === 'drone'
// → { rollLoc, locRolls, locSeed, slotCode, localisation, etq, rd,
//      degatsNets, chocTotal, severity, is_lethal, finalSeverity,
//      shockResult, rollChance, chanceSuccess, ... }

Logique détaillée :

    Localisation — forcedSlotCode (visée) ou 1D20 aléatoire (LOC_TABLE).

    Armure — calcResistanceArmure sur les équipements équipés dans le slot touché. Gère le Bouclier (Petit et test de Chance, exclusion au contact/jet-trait). Applique les modificateurs d'armure des munitions mécaniques (armorMulFactor).

    Résistance aux dommages — calcResistanceDommages avec modificateurs de mutations/avantages.

    Dégâts nets — max(0, degautsBruts - (etq ?? 0) + rd).

    Choc (optionnel) — résolution DSL de la munition via resolveChocFormula. Dommages virtuels (jamais de blessure créée). Si présent, le Test de Choc utilise le total combiné physique+Choc.

    Sévérité — basée sur les dégâts physiques seuls (_severityForDamage).

    Blessure — appelle woundService.applyWound. Récupère finalSeverity (post-promotion P49).

    Test de choc — appelle statusService.resolveShockTest avec la sévérité combinée si Choc présent, ou la sévérité physique sinon.

getEffectiveWeaponDamage

Résout la formule de dégâts effective d'une arme avec sa munition chargée.
js

await getEffectiveWeaponDamage(db, weaponInvId, { rangeBand = null })
// → { total, rolls, formula, tags, choc } | null

    Fail-safe : en cas d'erreur DSL, repli sur damage_h brut de l'arme.

    Prend en charge les mécaniques FX (Shrapnel, etc.) et le Choc de munition.

    Retourne null si l'arme n'a pas de damage_h.

getEffectiveWeaponFormulaPreview

Aperçu de la formule (avant jet réel) pour l'affichage au joueur.
js

await getEffectiveWeaponFormulaPreview(db, weaponInvId, { rangeBand = null })
// → "3d10+5" | "4d10 ×0.5" | null

4. woundService.js
applyWound

Centralise l'insertion de blessure + broadcast WOUND_ADDED.
js

await applyWound(io, db, campaignId, {
  charSheetId, characterId, localisation, severity,
})
// → { finalSeverity } | null

    Utilise resolveWoundInsertion (transaction Knex, gestion de la promotion P49).

    Met à jour worst_wound_severity.

    Émet WS.WOUND_ADDED avec { characterId, wound, promoted, shock_test_required, worst_wound_severity }.

    Retourne null si severity ou charSheetId absents, ou en cas d'erreur (ligne pleine → comportement normal).

5. mrTable.js
getMrTable

Singleton-promise : un seul appel DB pour toute la durée de vie du serveur.
js

const mrTable = await getMrTable()
// → [{ mr_min, mr_max, modifier }]

Piège : le .then(r => r) est obligatoire pour convertir le QueryBuilder Knex en Promise native. Sans cela, chaque await ré-exécute la requête. Limitation connue (A13) : si la première requête échoue, la promesse rejetée est cachée pour tous les appels suivants.
getModifier
js

getModifier(mrTable, mr)
// → number (modificateur MR, 0 si non trouvé)

Cherche la ligne où mr_min <= mr <= mr_max.
6. combatFSM.js
TRANSITIONS

Table des transitions autorisées. Clés = phase|subPhase, événements = noms bruts (WS ou pseudo-events internes).

États principaux :
État	Événements
null|null	COMBAT_START
ROSTER|null	COMBAT_ANNOUNCE_START, COMBAT_END
ANNOUNCEMENT|null	COMBAT_ACTION_DECLARE, COMBAT_SKIP_PLAYER, START_RESOLUTION, COMBAT_END
RESOLUTION|SLOT_ACTIVE	COMBAT_ACTION_CONFIRM (guard only), COMBAT_SKIP_PLAYER, NEEDS_DEFENSE, NEEDS_DAMAGE, END_TURN, COMBAT_END, COMBAT_STUN_CONFIRM, COMBAT_ACT_NOW, COMBAT_DELAYED_PASS
RESOLUTION|AWAITING_DEFENSE	COMBAT_MELEE_DEFENSE_CONFIRM, COMBAT_SKIP_PLAYER, COMBAT_END
RESOLUTION|AWAITING_DAMAGE	COMBAT_DAMAGE_CONFIRM, COMBAT_SKIP_PLAYER, COMBAT_END

Événements hors FSM (pas de guard) : COMBAT_INIT_STATE, COMBAT_ANNOUNCE_PREVIEW, COMBAT_APPLY_STUN.
canTransition
js

canTransition(phase, subPhase, event) → boolean

Vérifie si la transition est autorisée. Utilisé comme guard en tête de chaque handler WS.
nextState
js

nextState(phase, subPhase, event) → { phase, subPhase } | null

Retourne l'état après transition. Ne pas utiliser pour COMBAT_ACTION_CONFIRM — l'état final est décidé par les helpers, pas par la table.
setFSMSubPhase
js

await setFSMSubPhase(db, campaignId, subPhase) → void

Écrit sub_phase dans combat_state. Appelé par startResolutionPhase, endTurn, et les helpers qui changent AWAITING_* ↔ SLOT_ACTIVE.
7. Flux type : assaut à distance
text

1. Client → COMBAT_ACTION_CONFIRM (assault)
2. socketCombatResolution.js :
   a. canTransition('RESOLUTION', 'SLOT_ACTIVE', 'COMBAT_ACTION_CONFIRM') → true
   b. Calcule degautsBruts (MR, modDom, arme)
   c. resolveTargetHit(io, db, campaignId, { degautsBruts, ... })
      ├── Localisation (1D20 ou forcedSlotCode)
      ├── Armure (calcResistanceArmure)
      ├── RD (calcResistanceDommages)
      ├── Dégâts nets
      ├── Sévérité
      ├── woundService.applyWound → INSERT blessure + WOUND_ADDED
      └── statusService.resolveShockTest → D20 choc
   d. Si shockResult.triggered → émet COMBAT_DAMAGE_RESULT au tireur
   e. Si dégâts > 0 → NEEDS_DAMAGE (sub_phase = AWAITING_DAMAGE)
3. PJ tireur → COMBAT_DAMAGE_CONFIRM (lance les dés de dégâts)
4. socketCombatResolution.js :
   a. canTransition('RESOLUTION', 'AWAITING_DAMAGE', 'COMBAT_DAMAGE_CONFIRM') → true
   b. Résout les dégâts, advanceSlot

8. Pièges principaux
Code	Description
F2	resolveDroneAssaultAction a 3 branches distinctes (drone cible, PNJ cible, PJ cible). Ne pas uniformiser.
F4	Guard cibleType === 'drone' obligatoire dans resolveTargetHit — retourne null, caller gère l'intégrité drone séparément.
A13	mrTablePromise peut cacher une Promise rejetée si la première requête DB échoue. Reset : mrTablePromise = null.
B3/B4	Race condition non-exploitable entre DELETE combat_pending et setFSMSubPhase(SLOT_ACTIVE). Guard FSM bloque toute transition concurrente.
P49	Promotion blessure : finalSeverity peut différer de severity. resolveTargetHit utilise finalSeverity pour le test de choc.
Choc	Dommages virtuels : jamais de character_wounds créée. Seule la sévérité combinée pilote le Test de Choc.
COMBAT_ACTION_CONFIRM	nextState() ne doit pas être utilisé pour cet événement. L'état final est décidé par les helpers.

Sources : lecture directe de statusService.js, damageService.js, woundService.js, mrTable.js, combatFSM.js au 2026-07-19.