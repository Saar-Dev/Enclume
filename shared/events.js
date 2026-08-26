export const WS = {
  // Connexion session
  SESSION_JOIN:        'session:join',
  SESSION_JOINED:      'session:joined',
  SESSION_USER_JOINED: 'session:user_joined',
  SESSION_USER_LEFT:   'session:user_left',

  // Tokens
  TOKEN_MOVE:    'token:move',
  TOKEN_MOVED:   'token:moved',
  TOKEN_MOVE_REJECTED: 'token:move_rejected',
  TOKEN_CREATED: 'token:created',
  TOKEN_DELETED: 'token:deleted',
  TOKEN_UPDATED: 'token:updated',
  TOKEN_ROTATE:         'token:rotate',          // joueur/GM → serveur : rotation 45° (9F-A)
  TOKEN_SET_ROTATION:   'token:set_rotation',    // joueur/GM → serveur : orientation absolue (0..7)
  TOKEN_STATUS_TOGGLE:  'token:status_toggle',   // client → serveur : { tokenId, statusCode }
  TOKEN_STATUS_UPDATED: 'token:status_updated',  // serveur → room   : { tokenId, statuses[] }

  // Dés
  DICE_ROLL:   'dice:roll',
  DICE_RESULT: 'dice:result',
  // docs/PLAN_BLESSURES_GUERISON.md §6.1 : joueur/GM → serveur, { echeanceId } — Test de Constitution
  // contre l'Infection, seuil calculé et jet effectué côté serveur (jamais un simple DICE_ROLL
  // d'affichage, mute character_wounds via resolveEcheanceNow).
  WOUND_INFECTION_ROLL: 'wound:infection_roll',
  // docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4 : serveur → room, résultat d'un Test de Fatigue (jet,
  // seuil, issue, nouveau palier/case) — diffusion visible MJ + joueur (patron MACRO_ROLL_RESULT),
  // pas seulement un retour HTTP au MJ qui a déclenché le Test.
  FATIGUE_TEST_RESULT: 'fatigue:test_result',

  // Battlemap
  MAP_SWITCH:   'map:switch',
  MAP_VIEWPORT: 'map:viewport',
  WORLD_RUNTIME_UPDATED: 'world:runtime_updated',

  // Documents
  DOC_SHARED:  'doc:shared',
  DOC_CREATED: 'doc:created',  // serveur → sockets autorisés : nouveau document
  DOC_UPDATED: 'doc:updated',  // serveur → sockets autorisés : document modifié
  DOC_DELETED: 'doc:deleted',  // serveur → sockets autorisés : document supprimé

  // Characters
  CHARACTER_UPDATED: 'character:updated',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  // Chat persistant (docs/PLANS/PLAN_CHAT.md Phase 1) — pas encore émis, module non branché
  CHAT_SEND:            'chat:send',             // client → serveur : { channelId, type, payload }
  CHAT_MESSAGE_CREATED: 'chat:message_created',   // serveur → room/socket : message persisté
  CHAT_MESSAGE_DELETED: 'chat:message_deleted',   // serveur → room : { id, channelId }
  CHAT_ERROR:           'chat:error',             // serveur → socket émetteur : erreur métier (pattern TRADE_ERROR/WIZARD_ERROR)

  // Entités interactables
  ENTITY_ACTION_REQUEST:    'entity:action_request',    // joueur → serveur : demande d'interaction
  ENTITY_ACTION_PENDING:    'entity:action_pending',     // serveur → GM : demande en attente d'arbitrage
  ENTITY_ACTION_RESOLVE:    'entity:action_resolve',     // GM → serveur : décision d'arbitrage
  ENTITY_ACTION_RESULT:     'entity:action_result',      // serveur → joueur : résultat (refus ou timeout)
  ENTITY_ACTION_GM_DIRECT:  'entity:action_gm_direct',   // GM → serveur : action directe sans arbitrage
  ENTITY_UPDATED:           'entity:updated',            // serveur → room : état entité mis à jour
  ENTITY_CREATED:           'entity:created',            // serveur → room : entité posée sur la carte
  ENTITY_DELETED:           'entity:deleted',            // serveur → room : entité retirée de la carte
  ENTITY_MOVED:             'entity:moved',              // serveur → room : entité déplacée (éditeur GM)
  ENTITY_MOVE_REQUEST:      'entity:move_request',       // joueur → serveur : demande de déplacement entité (9F-B)
  ENTITY_MOVE_RESULT:       'entity:move_result',        // serveur → joueur : résultat jet + positions finales (9F-B)

  // Blessures (Chantier 11)
  WOUND_ADDED:   'wound:added',    // serveur → room : blessure ajoutée (+ promoted, shock_test_required)
  WOUND_UPDATED: 'wound:updated',  // serveur → room : blessure stabilisée
  WOUND_REMOVED: 'wound:removed',  // serveur → room : blessure supprimée (guérison)

  // Inventaire (Chantier 10)
  INVENTORY_ADDED:   'inventory:added',    // serveur → room : item ajouté
  INVENTORY_UPDATED: 'inventory:updated',  // serveur → room : item modifié
  INVENTORY_REMOVED: 'inventory:removed',  // serveur → room : item supprimé
  SOLS_UPDATED:      'sols:updated',       // serveur → room : solde sols modifié
  // PLAN_WIZARD_MATERIEL_GAUGES.md §7 — room résolue comme les autres routes inventaire
  // (resolveInventoryBroadcastRoom), pas comme SOLS_UPDATED : les jauges sont éditables dès Step6.
  GAUGE_UPDATED:     'gauge:updated',      // serveur → room : jauge de matériel modifiée (delta MJ)

  // Moding (docs/PLAN_MODING.md Phase A) — event dédié plutôt que détourner INVENTORY_UPDATED sur
  // une ligne d'arme qui, elle, ne change pas réellement (les mods vivent dans une table séparée)
  MOD_INSTALLED: 'mod:installed',  // serveur → room : mod installé sur une arme { characterId, weaponInvId, mods }

  // Combat (Chantier 11 — Sprint 1+)
  // Démarrage / arrêt
  COMBAT_START:          'combat:start',           // GM → serveur
  COMBAT_STARTED:        'combat:started',          // serveur → room : roster + phase
  COMBAT_END:            'combat:end',              // GM → serveur
  COMBAT_ENDED:          'combat:ended',            // serveur → room : reset client
  // Sync reconnexion
  COMBAT_STATE_SYNC:     'combat:state_sync',       // serveur → socket : joueur qui rejoint en cours
  // Roster
  COMBAT_ROSTER_UPDATED: 'combat:roster_updated',   // serveur → room
  // Phases
  COMBAT_PHASE_CHANGED:  'combat:phase_changed',    // serveur → room : nouvelle phase + données
  COMBAT_SLOT_ADVANCED:  'combat:slot_advanced',    // serveur → room : index slot courant
  // Surprise (Sprint 2)
  COMBAT_SURPRISE_ROLL:  'combat:surprise_roll',    // serveur → socket joueur surpris
  COMBAT_SURPRISE_RESULT:'combat:surprise_result',  // joueur → serveur
  // Annonce (Sprint 2)
  COMBAT_ANNOUNCE_START:  'combat:announce_start',  // GM → serveur : transition ROSTER→ANNOUNCEMENT
  COMBAT_INIT_STATE:      'combat:init_state',       // joueur (son PJ) ou GM (un PNJ) → serveur : état initial (phase ROSTER)
  COMBAT_ACTION_DECLARE: 'combat:action_declare',   // joueur → serveur
  COMBAT_ACTION_DECLARED:'combat:action_declared',  // serveur → room
  COMBAT_SKIP_PLAYER:    'combat:skip_player',      // GM → serveur
  COMBAT_TURN_SKIPPED:   'combat:turn_skipped',     // serveur → room
  // Résolution (Sprint 3/4)
  COMBAT_ACTION_WINDOW:  'combat:action_window',    // serveur → socket joueur actif
  COMBAT_ACTION_CONFIRM: 'combat:action_confirm',   // joueur/GM → serveur
  COMBAT_ATTACK_RESULT:  'combat:attack_result',    // serveur → room : résumé dégâts
  COMBAT_DAMAGE_PROMPT:          'combat:damage_prompt',           // serveur → socket tireur PJ : invite à lancer les dés
  COMBAT_DAMAGE_CONFIRM:         'combat:damage_confirm',          // PJ → serveur : déclenche le calcul (jets serveur)
  COMBAT_DAMAGE_RESULT:          'combat:damage_result',           // serveur → socket tireur PJ : résultats pour affichage fenêtre
  COMBAT_ATTACK_PLAYER_RESULT:   'combat:attack_player_result',    // serveur → socket tireur PJ : résultat jet de toucher
  COMBAT_RELOAD_RESULT:          'combat:reload_result',           // serveur → socket joueur rechargeur : succès ou échec
  COMBAT_MELEE_DEFENSE_PROMPT:   'combat:melee_defense_prompt',    // serveur → socket défenseur PJ : invite à défendre
  COMBAT_MELEE_DEFENSE_CONFIRM:  'combat:melee_defense_confirm',   // défenseur PJ → serveur : déclenche la résolution
  COMBAT_MELEE_RESULT:           'combat:melee_result',            // serveur → room : résultat jets en opposition (attaque/défense)
  COMBAT_DECLARE_ERROR:          'combat:declare_error',           // serveur → socket : erreur de validation déclaration (ex: hors portée)
  COMBAT_RESOLVE_MOVE_BLOCKED:   'combat:resolve_move_blocked',    // serveur → socket : déplacement refusé en résolution (case occupée)
  COMBAT_ANNOUNCE_PREVIEW:       'combat:announce_preview',        // PJ → serveur → room : sélections en cours (éphémère, non persisté)
  COMBAT_ACTION_PRECHECK:        'combat:action_precheck',          // client → serveur (ACK) : { tokenId, actionKey } → callback({ ok })
  COMBAT_APPLY_STUN:             'combat:apply_stun',              // GM → serveur : appliquer is_stunned manuellement { tokenId, outcome, duration }
  COMBAT_STUN_EXPIRED:           'combat:stun_expired',            // serveur → room : étourdissement expiré en fin de tour { tokenId }
  COMBAT_STUN_PROMPT:            'combat:stun_prompt',             // serveur → socket PJ ou GM : prompt D6 durée { tokenId, outcome }
  COMBAT_STUN_CONFIRM:           'combat:stun_confirm',            // PJ ou GM → serveur : lancer le D6 { tokenId }
  // Catastrophe automatique en combat (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1) — jet 1D10 RAW
  // "CATASTROPHES EN COMBAT" toujours filtré par une validation MJ avant application réelle.
  CATASTROPHE_PENDING:           'combat:catastrophe_pending',     // serveur → room (filtré MJ côté client) : nouvelle entrée en attente { id, tokenId, tableEntry, context, rolledAt }
  CATASTROPHE_RESOLVE:           'combat:catastrophe_resolve',     // GM → serveur : { pendingId, override? } — override = numéro d'entrée 1-10 alternatif, absent = confirme le jet tel quel
  CATASTROPHE_APPLIED:           'combat:catastrophe_applied',     // serveur → room : effet réellement appliqué après validation MJ { id, tokenId, appliedEntry }
  // Notice système combat — retour éphémère à un seul joueur (pas un message de chat persistant,
  // cf. docs/PLANS/PLAN_CHAT.md). Remplace un détournement de CHAT_MESSAGE (COM29 dual-wield),
  // même famille que COMBAT_DECLARE_ERROR/TRADE_ERROR/WIZARD_ERROR.
  COMBAT_SYSTEM_NOTICE:          'combat:system_notice',           // serveur → socket (ou room fallback) : { i18nKey, params?, timestamp }

  // Échelle de phases (docs/PLAN_COMBAT_TIMELINE.md Lot B)
  COMBAT_TIMELINE_UPDATED:       'combat:timeline_updated',        // serveur → room : entrées du Tour en cours + étape courante { turnNumber, entries, currentStep }
  COMBAT_ACT_NOW:                'combat:act_now',                 // PJ ou GM → serveur : « Agir maintenant » pour un token en delayed_waiting { tokenId }
  COMBAT_DELAYED_PASS:           'combat:delayed_pass',            // PJ ou GM → serveur : « Passer » consciemment au tour obligatoire de fin de Tour { tokenId }

  // Drones
  DRONE_INTEGRITY_UPDATED: 'drone:integrity_updated',  // serveur → room : intégrité drone mise à jour (combat)

  // Exo-armures (PLAN_EXOARMURE.md Lot 4)
  EXO_AVARIE_UPDATED: 'exo:avarie_updated',  // serveur → room : compteur d'Avaries/ITG exo mis à jour (combat)

  // Jets favoris — macros compétences (PLAN 13)
  MACRO_ROLL:        'macro:roll',         // joueur → serveur : exécuter une macro
  MACRO_ROLL_RESULT: 'macro:roll_result',  // serveur → socket : résultat + message formaté

  // Campagne
  CAMPAIGN_SETTINGS_UPDATED: 'campaign:settings_updated',  // serveur → room : paramètres campagne modifiés
  CAMPAIGN_GAME_TIME_ADJUSTED: 'campaign:game_time_adjusted',  // serveur → room : horloge de campagne ajustée (docs/PLAN_FATIGUE_DOMMAGES.md §7)
  // Avance en attente (Lot 2, docs/PLAN_FATIGUE_DOMMAGES.md §8 + docs/PLAN_BLESSURES_GUERISON.md §6.1)
  CAMPAIGN_ADVANCE_PENDING:   'campaign:advance_pending',    // serveur → room : une revue MJ vient de s'ouvrir (signal léger, pas le détail)
  CAMPAIGN_ADVANCE_RESOLVED:  'campaign:advance_resolved',   // serveur → room : avance confirmée, { characterIds } touchés
  CAMPAIGN_ADVANCE_CANCELLED: 'campaign:advance_cancelled',  // serveur → room : avance annulée (undo rejoué), { characterIds } touchés
  GAME_ECHEANCE_RESOLVED:     'game_echeance:resolved',      // serveur → room : { echeanceId } — une échéance individuelle du lot vient d'être résolue

  // Trade (marchands + échanges PJ↔PJ)
  // client → serveur
  TRADE_TRANSFER_OFFER:     'trade:transfer_offer',     // PJ A → serveur : proposer une offre
  TRADE_TRANSFER_ACCEPTED:  'trade:transfer_accepted',  // PJ B → serveur : accepter l'offre
  TRADE_TRANSFER_DECLINED:  'trade:transfer_declined',  // PJ B → serveur : refuser l'offre
  TRADE_TRANSFER_CANCELLED: 'trade:transfer_cancelled', // PJ A → serveur : annuler l'offre
  TRADE_SELL_PROPOSED:      'trade:sell_proposed',      // PJ → serveur : proposer une revente au GM
  TRADE_SELL_ACCEPTED:      'trade:sell_accepted',      // GM → serveur : accepter la revente (+ solsFinal)
  TRADE_SELL_DECLINED:      'trade:sell_declined',      // GM → serveur : refuser la revente
  // serveur → client
  TRADE_MERCHANT_UPDATED: 'trade:merchant_updated',   // serveur → room : marchand modifié (statut, mod_global)
  TRADE_SELL_REQUEST:     'trade:sell_request',        // serveur → socket GM : demande de revente PJ
  TRADE_SELL_RESULT:          'trade:sell_result',           // serveur → socket PJ : résultat (accepted/declined)
  TRADE_SELL_COUNTER:         'trade:sell_counter',          // GM → serveur : contre-offre
  TRADE_SELL_COUNTER_RECEIVED:'trade:sell_counter_received', // serveur → PJ : contre-offre reçue
  TRADE_SELL_COUNTER_ACCEPTED:'trade:sell_counter_accepted', // PJ → serveur : accepter la contre-offre
  TRADE_SELL_COUNTER_DECLINED:'trade:sell_counter_declined', // PJ → serveur : refuser la contre-offre
  TRADE_OFFER_RECEIVED:   'trade:offer_received',     // serveur → socket PJ B : offre reçue de PJ A
  TRADE_OFFER_ACCEPTED:   'trade:offer_accepted',     // serveur → sockets A+B : transaction exécutée
  TRADE_OFFER_DECLINED:   'trade:offer_declined',     // serveur → socket PJ A : PJ B a refusé
  TRADE_OFFER_CANCELLED:  'trade:offer_cancelled',    // serveur → socket PJ B : PJ A a annulé
  TRADE_OFFER_EXPIRED:    'trade:offer_expired',      // serveur → sockets A+B : offre expirée
  TRADE_LOG_UPDATED:      'trade:log_updated',        // serveur → GM only : nouvelle entrée trade_log
  TRADE_ERROR:            'trade:error',              // serveur → socket émetteur : erreur métier
  // Rechargement drone (owner → drone, immédiat, sans offre)
  TRADE_DRONE_TRANSFER:   'trade:drone_transfer',     // PJ owner → serveur
  TRADE_DRONE_TRANSFERRED:'trade:drone_transferred',  // serveur → socket owner : confirmé (non utilisé v1 — ACK suffisant)

  // Wizard collaboratif GM/Joueur (docs/PLAN_WIZARDCOLLAB.md Lot A1)
  WIZARD_JOIN:        'wizard:join',         // joueur ou GM → serveur : rejoint la room wizard:<sheetId> { sheetId }
  WIZARD_LOCK_UPDATE: 'wizard:lock_update',  // GM → serveur : bascule un seul verrou { sheetId, step, optionKey, locked }
  WIZARD_LOCKS_SYNC:  'wizard:locks_sync',   // serveur → room wizard:<sheetId> : état complet des verrous { sheetId, locks }
  WIZARD_ERROR:       'wizard:error',        // serveur → socket émetteur seul : erreur métier (accès refusé, pas MJ)
  // serveur → room wizard:<sheetId> : contenu de fiche réconcilié, uniquement les steps soumis cette
  // fois { sheetId, step1?, step2?, step3?, step4?, step5? } — sans ça, un MJ déjà sur la fiche ne
  // voit jamais les avancées du joueur sans recharger la page (bug réel, docs/PLAN_WIZARDCOLLAB.md).
  WIZARD_STATE_SYNC:  'wizard:state_sync',
  // joueur ou GM (mode guide désactivé) → serveur → room wizard:<sheetId> SAUF émetteur (socket.to,
  // pas io.to) : brouillon en cours de saisie, éphémère, jamais persisté ni validé { sheetId, step,
  // data } — distinct de WIZARD_STATE_SYNC (durable, source de vérité). docs/PLAN_WIZARDCOLLAB.md
  // §2.5/§5bis (Lot A4) — motif Yjs Awareness / Liveblocks Presence : jamais écrit dans le Doc/DB.
  WIZARD_LIVE_UPDATE: 'wizard:live_update',
}
