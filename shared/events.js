export const WS = {
  // Connexion session
  SESSION_JOIN:        'session:join',
  SESSION_JOINED:      'session:joined',
  SESSION_USER_JOINED: 'session:user_joined',
  SESSION_USER_LEFT:   'session:user_left',

  // Tokens
  TOKEN_MOVE:    'token:move',
  TOKEN_MOVED:   'token:moved',
  TOKEN_CREATED: 'token:created',
  TOKEN_DELETED: 'token:deleted',
  TOKEN_UPDATED: 'token:updated',
  TOKEN_ROTATE:  'token:rotate',   // joueur/GM → serveur : rotation 45° (9F-A)

  // Voxels (carte 3D)
  VOXEL_ADD:     'voxel:add',
  VOXEL_ADDED:   'voxel:added',
  VOXEL_REMOVE:  'voxel:remove',
  VOXEL_REMOVED: 'voxel:removed',
  VOXEL_UPDATE:  'voxel:update',
  VOXEL_UPDATED: 'voxel:updated',

  // Dés
  DICE_ROLL:   'dice:roll',
  DICE_RESULT: 'dice:result',

  // Battlemap
  MAP_SWITCH:   'map:switch',
  MAP_VIEWPORT: 'map:viewport',

  // Documents
  DOC_SHARED: 'doc:shared',

  // Characters
  CHARACTER_UPDATED: 'character:updated',

  // Chat
  CHAT_MESSAGE: 'chat:message',

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
  COMBAT_ACTION_DECLARE: 'combat:action_declare',   // joueur → serveur
  COMBAT_ACTION_DECLARED:'combat:action_declared',  // serveur → room
  COMBAT_SKIP_PLAYER:    'combat:skip_player',      // GM → serveur
  COMBAT_TURN_SKIPPED:   'combat:turn_skipped',     // serveur → room
  // Résolution (Sprint 3/4)
  COMBAT_ACTION_WINDOW:  'combat:action_window',    // serveur → socket joueur actif
  COMBAT_ACTION_CONFIRM: 'combat:action_confirm',   // joueur/GM → serveur
  COMBAT_ATTACK_RESULT:  'combat:attack_result',    // serveur → room : résumé dégâts
  COMBAT_DAMAGE_PROMPT:  'combat:damage_prompt',    // serveur → socket tireur PJ : invite à lancer les dés
  COMBAT_DAMAGE_CONFIRM: 'combat:damage_confirm',   // PJ → serveur : déclenche le calcul (jets serveur)
  COMBAT_DAMAGE_RESULT:  'combat:damage_result',    // serveur → socket tireur PJ : résultats pour affichage fenêtre
}
