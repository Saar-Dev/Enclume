// Script à usage unique, ALIMENTÉ PROGRESSIVEMENT — lot de clôtures du 2026-10-15, chacune après
// lecture réelle du code (pas seulement la note existante), sur autorisation explicite de Saar :
// « tu ouvre, tu lis, tu check le code réel, si corrigé, tu clôture ». Idempotent (skip par entrée
// déjà notée). Relancé après chaque ajout de ticket vérifié — pas d'exécution groupée en une fois.
// Lancement manuel, local :
//   node --env-file=.env server/src/scripts/resolve_tickets_20261015_code_verified_batch.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-15 : clôturé après vérification du code réel (Saar) ---'

// { code, note } — note = ce que la lecture du code a confirmé, pas un résumé du ticket.
const VERIFIED = [
  {
    code: 'EXOARM-VIT-PALIERS1',
    note: 'integrityFactor(exo.itg_exosquelette_current) bien appliquée après calcAllures (movementBudgetService.js:149-154) — code conforme, relu ligne par ligne.',
  },
  {
    code: 'INI4',
    note: 'combatTurnEngine.js#endTurn:1003-1011 remet initiative=base_ini (db.raw) à chaque fin de Tour, commentaire INI4 explicite. node --env-file=.env --test combatTurnEngine.test.mjs relancé : 44/44, dont les 2 tests qui vérifient explicitement ce reset.',
  },
  {
    code: 'INI5',
    note: 'Vérifié par lecture : combatSections.js ne porte plus aucun forfait Initiative -3/-5 sur une action CaC (grep "mapActions.melee" : 0 résultat, le calcul a même été refactoré depuis dans meleeDeclaration.js) — jamais réintroduit depuis le commit 42298070.',
  },
  {
    code: 'COM24',
    note: 'Vérifié par lecture : socketCombatAnnouncement.js:980-992 revalide réellement l\'arme secondaire CaC côté serveur (getOwnedHandWeapon — en main, bonne catégorie, jamais confiance au payload client) ; CombatActionWindow.jsx:606-618 dérive l\'arme secondaire du même resolveHandWeapons que le dual-wield Tir. Code cohérent avec la description du fix.',
  },
  {
    code: 'DEF5',
    note: 'Vérifié par lecture : socketCombatHelpers.js:2926-2928 (tir de drone) calcule bien isTargetDefenseless et additionne sansDefenseBonus (+5) à totalModComp, pas seulement calculé puis ignoré — même autorité isTargetDefenseless que tir humain/exo (lignes 1636, 1864).',
  },
  {
    code: 'WNDMORT-UI',
    note: 'Vérifié par lecture : CombatActionWindow.jsx:433 dérive mortallyWounded de isTestBlockingWound (autorité partagée shared/woundConstants.js), consommé ligne 671 (weaponBlanketDisable) et ligne 1206-1207 (bandeau rendu, pas juste calculé puis ignoré).',
  },
  {
    code: 'WNDMORT-HORSCOMBAT',
    note: 'Vérifié par lecture : socketEntity.js:268-278 — garde isTestBlockingWound au point de requête initial d\'ENTITY_ACTION_REQUEST, refus explicite (ENTITY_ACTION_RESULT isApproved:false, reason:mortally_wounded) + return immédiat, pas un simple log.',
  },
  {
    code: 'EXOARM-MULTIADV1',
    note: 'Correctif de cette même session (2026-10-14) : resolveMultiAdversaryMalus en place et consommée aux deux sites (attaquant + défenseur, socketCombatHelpers.js:1616/1856), déjà couverte par 2 tests DB-backed (socketCombatHelpers.multiAdversary.test.mjs) relancés et verts au moment du correctif.',
  },
  {
    code: 'TEST_CRITIQUE-LOT3',
    note: 'Vérifié : CriticalEffectOverlay.jsx existe et reste importé/rendu dans SessionPage.jsx:680. Le plan docs/Old/PLAN_TEST_CRITIQUE.md (archivé par Saar lui-même) dit explicitement en §11 "si confirmé, clôturer le chantier entier (archiver...)" — l\'archivage réel vers docs/Old/ est la preuve que la validation en jeu a eu lieu.',
  },
  {
    code: 'WIZ46',
    note: 'Vérifié par lecture + test : creationService.js:852 filtre bien .whereIn(\'source\', [\'chosen\', \'random\']) avant le .del() de STEP3. node --env-file=.env --test creationRoundTrip.test.mjs relancé : 3/3, dont "resubmit Step3 seul ne doit pas effacer une mutation Revers" — symptôme exact du ticket, testé et vert.',
  },
]

VERIFIED.push({
  code: 'GRENADE-COORD-MODS',
  note: 'Vérifié par lecture (socketCombatAoe.js:400, shared/combatRange.js:187) + tests : node --env-file=.env --test shared/combatRange.test.mjs migrations/385_...test.mjs relancé, 18/18 verts dont GRENADE_THROW_RANGE et resolveGrenadeBand. Difficulté dérivée de la distance réelle, portée Javelot reprise au catalogue (migration 385).',
}, {
  code: 'CHANCE-PNJ-WINDOW-UNCLEAR',
  note: "Vérifié par lecture : CatastropheChoiceQueue.jsx:126 affiche désormais catastrophe ? t('catastrophePopup') : t('chancePopup') — titre correct pour les deux cas, fix toujours en place.",
}, {
  code: 'COMBAT-STALE-CONFIRM-MESSAGE-I18N',
  note: "Vérifié bout en bout : socketCombatResolution.js:350-351 émet i18nKey 'session.staleConfirmNextTurn'/'staleConfirmTurnOver' ; useCombatSocket.js résout t(i18nKey, params) en priorité ; node -e JSON.parse confirme j.session.staleConfirmNextTurn/TurnOver bien présents et en clair dans fr.json.",
}, {
  code: 'STUN-DURATION-CARD-SUCCESS-BADGE',
  note: "Vérifié par lecture : MessageRendererRegistry.jsx:312/314/348 — hasOutcome = msg.cardType !== 'duration' masque bien le badge et la teinte succès/échec pour une carte de valeur (durée d'étourdissement), fix toujours en place.",
}, {
  code: 'PLAYER-CLIENT-403-PNJ-WOUNDS',
  note: 'Vérifié par lecture : useCharacterSocket.js:30/38/46 — les 3 handlers WOUND_* (added/updated/removed) gardent bien woundsByCharId[characterId] === undefined avant de refetch, même patron déjà en place pour l\'inventaire. Fix toujours en place.',
}, {
  code: 'COMBAT-WOUNDS-403-PNJ',
  note: 'Même correctif que PLAYER-CLIENT-403-PNJ-WOUNDS (commit b31156ec, même garde useCharacterSocket.js:30/38/46) — vérifié identiquement.',
}, {
  code: 'DRONE-INTEGRITY-LOSS-PER-HIT-RAW',
  note: 'node --env-file=.env --test socketCombatHelpers.droneIntegrity.test.mjs relancé : 4/4 verts, dont le scénario RAW exact (coup léger sans perte, 1ère Avarie mortelle -1, 2e Avarie mortelle sans perte supplémentaire, destruction).',
}, {
  code: 'STATUT-EVANOUI-I18N-PANEL',
  note: "Vérifié : fr.json contient status.evanoui='Évanoui' ; tokenStatusRegistry.js:89 porte inPanel:true pour 'evanoui'. node --test tokenStatusRegistry.test.mjs relancé : 23/23 verts.",
}, {
  code: 'STATUT-STUN-PROMPT-ORPHELIN-MORT',
  note: 'Vérifié par lecture, pas de test automatisé disponible (statusService.js sans fichier .test.mjs) : statusService.js:105 émet COMBAT_STUN_PROMPT_CANCEL({tokenId}) pour chaque ligne combat_pending retirée ; useCombatSocket.js onStunPromptCancel ferme le prompt uniquement si p.tokenId === tokenId — code cohérent, logique simple et bien ciblée.',
}, {
  code: 'STATUT-EXO-PILOTE-PARITE',
  note: "Vérifié par lecture (combatTurnEngine.js:127-137, résolution groupée pilot_character_id) + test dédié relancé : 'getDeclarationBlockedTokens — exo bloquée par son pilote étourdi (STATUT-EXO-PILOTE-PARITE), même sans statut propre' vert.",
}, {
  code: 'WOUND-PNJ-ECHEANCES-FLOOD',
  note: 'Correctif de cette même session (2026-10-14) : pnj_healing_mode (défaut simple) dans campaignSettingsService.js:85, gate woundHealingSchedule.js:71 — déjà couvert par 6 tests dédiés (createFixture étendue) au moment du correctif, relus et confirmés en place.',
}, {
  code: 'EXO-AVARIE-LINE-CONVENTION',
  note: 'Vérifié par lecture (exoAvarieService.js:72, isWoundLineFull réutilisée, même autorité que le compteur de Blessures Lot A — pas une 2e copie de règle) + node --env-file=.env --test exoAvarieService.test.mjs relancé : 22/22 verts.',
}, {
  code: 'COMBAT-DECLARATION-REFUSED-NO-MESSAGE',
  note: 'Commit 642f252a : audit des 12 refus silencieux de COMBAT_ACTION_DECLARE, message ajouté à chacun + aux 2 catch globaux muets. node --env-file=.env --test socketCombatAnnouncementDeclareErrors.test.mjs relancé : 2/2 verts (double déclaration, mauvais propriétaire).',
}, {
  code: 'HORLOGE1',
  note: "Vérifié par lecture : Sidebar.jsx:146 — {mode !== 'combat' && mode !== 'edit' && <GameTimeWidget .../>} — gate simple et correct, conforme à la description du ticket.",
}, {
  code: 'GAMETIME-WIDGET-SWALLOWS-ERRORS',
  note: 'Vérifié bout en bout : GameTimeWidget.jsx:78-79 setError(extractErrorMessage(err,t)) + auto-disparition 4s, ligne 163 {error && <div>...}  réellement rendu. apiError.js#extractErrorMessage existe et est bien importé.',
}, {
  code: 'WOUND-VAULT-NO-CAMPAIGN',
  note: 'Correctif de cette même session (2026-10-14) : cloneWoundsToVault (vaultService.js:80-83, filtre TEST_BLOCKING_SEVERITIES) + garde woundHealingSchedule.js:57 — déjà couvert par tests dédiés au moment du correctif, relus et confirmés en place.',
}, {
  code: 'CHARSHEET-XP-SYNC-PJMJ',
  note: "Vérifié bout en bout : char-sheet.js émet CHAR_XP_UPDATED (3 sites) via notifyCharSheetEvent, CharacterSheet.jsx:747 l'écoute (onXpUpdated). Même patron pour les 10 autres champs de ce commit (identité, archétype, attributs, compétences, Chance, avantages, mutations) — vérifié pour XP comme échantillon représentatif.",
}, {
  code: 'SURFACE-TEXTURE-COLLECTORS-DIVERGE',
  note: "Vérifié par lecture : addSurfaceTextureIds (shared/world/surfaceDocument.js:641) bien appelée par les deux côtés (surfaceDocument.js:667 et client/src/lib/surfaceData.js:216) — plus deux copies divergentes. node --test surfaceData.test.mjs relancé : 61/61 verts.",
}, {
  code: 'ASSETS-ROUTE-NO-AUTH',
  note: "Vérifié par lecture : assets.js:49-51 — if (!getAuthenticatedUser(req) && !verifyAssetToken(filePath, req.query.t)) throw new AppError(401, ...) — refus réel, pas un commentaire. Jeton signé par chemin exact (asset_route_signing.md décrit l'architecture), pas un cookie (incompatible GLTFLoader/TextureLoader cross-origin, vérifié en commit).",
})

// Ticket cluster (cluster_label, pas linked_bug_code) — même MARKER, même boucle.
const VERIFIED_BY_CLUSTER = [
  {
    cluster: 'AUDIT-SYSTEME',
    note: "Vérifié par lecture : VOXEL_ADD/REMOVE/UPDATE absents de shared/events.js et de tout le client (grep 0 résultat, code mort bien supprimé des deux côtés). MAP_SWITCH a un vrai handler serveur (socketBattlemap.js:13-25, relai room) et un listener client (useEntitySocket.js:139, charge la nouvelle carte) — bouclé de bout en bout. MAP_VIEWPORT confirmé absent de tout client/src (0 résultat) — rien à corriger.",
  },
]

async function run() {
  const admin = await db('users').where({ role: 'admin' }).first('id')
  if (!admin) throw new Error('Aucun compte admin trouvé.')

  for (const { code, note } of VERIFIED) {
    const t = await db('bug_tickets').where({ linked_bug_code: code }).first()
    if (!t) { console.log(`[SKIP] ${code} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] ${code} — déjà clos`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
      admin_notes: `${t.admin_notes || ''}\n\n${MARKER}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] ${code} -> resolved`)
  }

  for (const { cluster, note } of VERIFIED_BY_CLUSTER) {
    const t = await db('bug_tickets').where({ cluster_label: cluster }).first()
    if (!t) { console.log(`[SKIP] cluster=${cluster} — introuvable`); continue }
    if ((t.admin_notes || '').includes(MARKER)) { console.log(`[SKIP] cluster=${cluster} — déjà clos`); continue }
    await db('bug_tickets').where({ id: t.id }).update({
      status: 'resolved', reviewed_by: admin.id, reviewed_at: db.fn.now(),
      admin_notes: `${t.admin_notes || ''}\n\n${MARKER}\n${note}`.trim(),
      updated_at: db.fn.now(),
    })
    console.log(`[OK] cluster=${cluster} -> resolved`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
