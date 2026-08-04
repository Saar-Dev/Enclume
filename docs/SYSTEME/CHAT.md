Documentation exhaustive de l'existant

    Version 1.0 — 2026-08-01
    Rédigé d'après l'analyse de 14 fichiers (serveur + client + shared)

1. Vue d'ensemble

Le chat est le hub d'interaction textuelle de la session de jeu. Il reçoit du texte libre, des commandes slash, des jets de dés, des résultats de macros, des annonces de combat, des dégâts, des demandes d'arbitrage entité, des offres de trade, et des notifications système (connexion/déconnexion, erreurs, tours de combat sautés).
Propriétés fondamentales

    Éphémère : rien n'est persisté, tout est perdu au rechargement (F5).

    Temps réel : les messages transitent uniquement par WebSocket (Socket.IO), jamais par HTTP.

    Identifiants clients : les IDs de message sont fabriqués côté client par concaténation de strings (pas d'UUID serveur).

    Absence de module : le code du chat est éclaté entre 5 fichiers serveur et 3 hooks client.

2. Architecture
text

┌─────────────────────────────────────────────────────────────────┐
│                        SIDE SERVEUR                              │
│                                                                  │
│  socket/index.js          → SESSION_USER_JOINED / LEFT           │
│  socket/socketDice.js     → CHAT_MESSAGE (texte)                 │
│                           → DICE_RESULT (dés libres)              │
│                           → MACRO_ROLL_RESULT (macros)            │
│  socket/socketEntity.js   → DICE_RESULT (interactions entité)    │
│                           → ENTITY_ACTION_PENDING (arbitrage GM)  │
│  socket/socketTrade.js    → TRADE_SELL_REQUEST (vente GM)        │
│                           → TRADE_OFFER_RECEIVED (échange PJ)    │
│  socket/socketCombat*.js  → COMBAT_ATTACK_RESULT (dégâts combat) │
│                           → COMBAT_DECLARE_ERROR                 │
│                           → COMBAT_RESOLVE_MOVE_BLOCKED           │
│                           → COMBAT_TURN_SKIPPED                   │
│                           → DICE_RESULT (dégâts, choc, drones)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                     WebSocket (Socket.IO)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        SIDE CLIENT                               │
│                                                                  │
│  useSessionSocket.js  → CHAT_MESSAGE, DICE_RESULT,               │
│                         MACRO_ROLL_RESULT, SESSION_*             │
│  useEntitySocket.js   → ENTITY_ACTION_PENDING,                   │
│                         ENTITY_ACTION_RESULT,                    │
│                         ENTITY_MOVE_RESULT,                      │
│                         TRADE_SELL_REQUEST,                      │
│                         TRADE_OFFER_RECEIVED                     │
│  useCombatSocket.js   → COMBAT_DECLARE_ERROR,                    │
│                         COMBAT_RESOLVE_MOVE_BLOCKED,             │
│                         COMBAT_TURN_SKIPPED                      │
│                         │                                        │
│                  ┌──────┴──────┐                                 │
│                  │  addMessage │  (sessionStore.js)              │
│                  └──────┬──────┘                                 │
│                         ▼                                        │
│              messagesByCampaign[campaignId]                      │
│                         │                                        │
│                         ▼                                        │
│                   Sidebar.jsx (rendu)                            │
└─────────────────────────────────────────────────────────────────┘

3. Détail des flux par type de message
3.1 Message texte standard
Étape	Fichier	Détail
Émission	Sidebar.jsx:335	socket?.emit(WS.CHAT_MESSAGE, { text })
Réception serveur	socketDice.js	Handler CHAT_MESSAGE
Enrichissement	socketDice.js	getUserColor() → { userId, username, color, text, timestamp }
Broadcast	socketDice.js	io.to(campaignId).emit(WS.CHAT_MESSAGE, payload)
Réception client	useSessionSocket.js:onChatMessage	addMessage({ id, user, color, text, time })
Rendu	Sidebar.jsx:message	Bloc standard

Format payload reçu par le client :
js

{
  userId: "uuid",
  username: "Saar",
  color: "#4A90D9",
  text: "Bonjour !",
  timestamp: "2026-08-01T12:00:00.000Z"   // ISO 8601
}

Format stocké dans le store :
js

{
  id: "uuid-2026-08-01T12:00:00.000Z",   // concaténé côté client
  user: "Saar",
  color: "#4A90D9",
  text: "Bonjour !",
  time: "12:00"                           // reformaté HH:MM
}

3.2 Message système (connexion / déconnexion)
Étape	Fichier	Détail
Trigger	socket/index.js:SESSION_JOIN	Un utilisateur rejoint/quitte la room
Émission	socket/index.js	socket.to(campaignId).emit(WS.SESSION_USER_JOINED, { userId, username })
Réception client	useSessionSocket.js:onUserJoined	addMessage({ id: 'sys-join-...', system: true, text: t('session.userJoined', { username }), time })

Format stocké :
js

{
  id: "sys-join-uuid-1234567890",
  system: true,
  text: "Saar a rejoint la session",   // i18n
  time: "12:00"
}

3.3 Message système i18n générique

Le serveur peut émettre CHAT_MESSAGE avec { system: true, i18nKey, timestamp }. Le client résout i18nKey via t(). Cas documenté : COM29 (dual-wield dégradé). Le handler est useSessionSocket.js:onChatMessage, branche payload.system.
3.4 Jet de dés libre (/r)
Étape	Fichier	Détail
Parsing	Sidebar.jsx:339	text.match(/^\/r(?:oll)?\s+(.+)$/i)
Émission	Sidebar.jsx:341	socket?.emit(WS.DICE_ROLL, { formula })
Traitement serveur	socketDice.js:DICE_ROLL	parseDice(formula) → rolls, total, critiques
Broadcast	socketDice.js	io.to(campaignId).emit(WS.DICE_RESULT, payload)
Réception client	useSessionSocket.js:onDiceResult	addMessage({ type: 'dice', formula, rolls, total, ... })
Rendu	Sidebar.jsx:dice	Bloc dé avec icône

Format stocké :
js

{
  id: "dice-uuid-timestamp",
  type: 'dice',
  user: "Saar",
  color: "#4A90D9",
  formula: "1d20+3",
  rolls: [15],
  total: 18,
  isCriticalSuccess: false,
  isCriticalFail: false,
  time: "12:00"
}

3.5 Macro favori
Étape	Fichier	Détail
Émission	DicePanel.jsx	socket.emit(WS.MACRO_ROLL, { macroId, characterId, secret? })
Traitement serveur	socketDice.js:MACRO_ROLL	Calcul seuil (compétence/attribut + malus), jet 1d20, substitution template
Broadcast	socketDice.js	io.to(campaignId).emit(WS.MACRO_ROLL_RESULT, payload)
Réception client	useSessionSocket.js:onMacroRollResult	addMessage({ type: 'dice', interactionType: 'macro_result', ... })
Rendu	Sidebar.jsx:macro_result	Bloc étoile avec message formaté
3.6 Action entité (demande d'arbitrage)
Étape	Fichier	Détail
Demande joueur	socketEntity.js:ENTITY_ACTION_REQUEST	Le joueur demande une interaction
Notification GM	socketEntity.js	gmSocket.emit(WS.ENTITY_ACTION_PENDING, { requestId, playerName, ... })
Conversion chat	useEntitySocket.js:onEntityActionPending	addMessage({ type: 'entity_action', gmOnly: true, ... })
Rendu	Sidebar.jsx:entity_action	Bloc avec boutons Accepter / Auto / Refuser
3.7 Action entité (résultat)

L'arbitrage du GM (ENTITY_ACTION_RESOLVE) déclenche un jet serveur, dont le résultat est diffusé via DICE_RESULT avec des champs supplémentaires : skillLabel, mechanicalTotal, chancesDeReussite, isSuccess, mr, breakdown, interactionType.
interactionType	Rendu dans Sidebar
undefined (skillcheck)	Bloc dé avec compétence, badge succès/échec
'displacement'	Bloc poussée/traction avec MR
'combat_damage'	Bloc épée avec dégâts, localisation, sévérité
3.8 Trade (vente, échange)
Événement serveur	Listener client	Type dans le store	Rendu
TRADE_SELL_REQUEST	useEntitySocket.js:onSellRequest	'sell_request'	Bloc vente GM avec bouton Voir
TRADE_OFFER_RECEIVED	useEntitySocket.js:onOfferReceived	'exchange_offer'	Bloc échange avec bouton Voir
3.9 Messages de combat
Type store	Événement WS	Listener client	Rendu
'declare_error'	COMBAT_DECLARE_ERROR	useCombatSocket.js:onDeclareError	Bloc erreur (⊗)
'resolve_move_blocked'	COMBAT_RESOLVE_MOVE_BLOCKED	useCombatSocket.js:onResolveMoveBlocked	Bloc blocage
système (skip)	COMBAT_TURN_SKIPPED	useCombatSocket.js:onTurnSkipped	system: true
dégâts combat	COMBAT_ATTACK_RESULT → DICE_RESULT	useSessionSocket.js:onDiceResult	Bloc épée
choc	DICE_RESULT (depuis statusService)	useSessionSocket.js:onDiceResult	Bloc skillcheck
drone damage	DICE_RESULT	useSessionSocket.js:onDiceResult	Bloc skillcheck
4. Commandes slash
Commande	Implémentation	Fichier
/r <formule>	Regex + DICE_ROLL	Sidebar.jsx:339-342
/roll <formule>	Alias de /r	idem
/help	Non implémenté	—

La commande est interceptée avant l'émission CHAT_MESSAGE : le texte saisi n'est jamais envoyé comme message.
5. Store Zustand (sessionStore.js)
js

{
  onlineUsers: new Set(),
  messagesByCampaign: {},       // { [campaignId]: Message[] }
  activeCampaignId: null,
  pendingEntityId: null,

  addMessage(message)           // push en fin de tableau pour la campagne active
  resetSession()                // vide tout
}

Aucune pagination, aucun chargement asynchrone, aucun setter setMessages ou prependMessages.
6. Rendu dans Sidebar.jsx

Le rendu itère sur messages.map(...) avec une cascade if/else basée sur msg.type et msg.system :
Condition	Rendu
msg.system	Texte centré italique (join/leave, skip tour, erreurs)
msg.type === 'entity_action'	Bloc arbitrage GM (visible si isGm)
msg.type === 'sell_request'	Bloc vente GM
msg.type === 'exchange_offer'	Bloc échange PJ
msg.type === 'declare_error'	Bloc erreur combat
msg.type === 'resolve_move_blocked'	Bloc blocage déplacement
msg.type === 'dice'	Bloc dé (plusieurs sous-types selon interactionType)
Défaut	Bloc texte standard
7. Fichiers impliqués
Serveur (5)
Fichier	Rôle dans le chat
socket/index.js	SESSION_USER_JOINED/LEFT
socket/socketDice.js	CHAT_MESSAGE (texte), DICE_ROLL (dés), MACRO_ROLL (macros)
socket/socketEntity.js	ENTITY_ACTION_PENDING, DICE_RESULT (interactions)
socket/socketTrade.js	TRADE_SELL_REQUEST, TRADE_OFFER_RECEIVED
socket/socketCombat*.js	COMBAT_ATTACK_RESULT, COMBAT_DECLARE_ERROR, COMBAT_RESOLVE_MOVE_BLOCKED, COMBAT_TURN_SKIPPED
Client (4)
Fichier	Rôle dans le chat
components/Sidebar.jsx	Input, commandes slash, rendu de tous les types
lib/useSessionSocket.js	Listeners CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, SESSION_*
lib/useEntitySocket.js	Listeners ENTITY_ACTION_*, TRADE_SELL_REQUEST, TRADE_OFFER_RECEIVED
lib/useCombatSocket.js	Listeners COMBAT_DECLARE_ERROR, COMBAT_RESOLVE_MOVE_BLOCKED, COMBAT_TURN_SKIPPED
stores/sessionStore.js	Stockage messagesByCampaign, setter addMessage
Shared (1)
Fichier	Rôle
shared/events.js	Constantes de tous les événements WebSocket
8. Problèmes et limites
Problème	Impact
Aucune persistance	Tout est perdu au F5.
Pas d'UUID serveur	IDs clients non garantis uniques, impossibles à utiliser pour la déduplication.
Handler CHAT_MESSAGE noyé dans socketDice.js	Pas de séparation des responsabilités, impossible à faire évoluer isolément.
Trois hooks clients distincts appellent addMessage	Aucune couche d'abstraction ; un changement de format message impacterait tous les hooks.
Pas de limite de taille	Pas de validation serveur sur la longueur du texte.
Pas de rate limiting	Pas de protection contre le spam (sauf pour les offres trade, qui ont leur propre limite).
Pas de sanitization	Le texte brut est rendu dans des <p> sans échappement.
Pas de typage explicite sur les messages texte standard (pas de champ type: 'text').	
Aucune pagination	messages.map() sur tout le tableau.
Pas de /help	Demandé.
Pas de messagerie privée	Demandé.
9. Événements WebSocket utilisés par le chat
Constante	Émetteur serveur	Listener client	Type store
CHAT_MESSAGE	socketDice.js	useSessionSocket.js	texte / système i18n
DICE_RESULT	socketDice.js, socketEntity.js, socketCombatHelpers.js, statusService.js	useSessionSocket.js, useEntitySocket.js	'dice'
MACRO_ROLL_RESULT	socketDice.js	useSessionSocket.js	'dice'
SESSION_USER_JOINED	socket/index.js	useSessionSocket.js	system: true
SESSION_USER_LEFT	socket/index.js	useSessionSocket.js	system: true
ENTITY_ACTION_PENDING	socketEntity.js	useEntitySocket.js	'entity_action'
ENTITY_ACTION_RESULT	socketEntity.js	useEntitySocket.js	system: true
ENTITY_MOVE_RESULT	socketEntity.js	useEntitySocket.js	system: true
TRADE_SELL_REQUEST	socketTrade.js	useEntitySocket.js	'sell_request'
TRADE_OFFER_RECEIVED	socketTrade.js	useEntitySocket.js	'exchange_offer'
COMBAT_DECLARE_ERROR	socketCombatResolution.js	useCombatSocket.js	'declare_error'
COMBAT_RESOLVE_MOVE_BLOCKED	socketCombatResolution.js	useCombatSocket.js	'resolve_move_blocked'
COMBAT_TURN_SKIPPED	socketCombat*.js	useCombatSocket.js	system: true
COMBAT_ATTACK_RESULT	socketCombatHelpers.js	useCombatSocket.js → état local + DICE_RESULT	'dice'
10. Types de messages dans le store
Champ type	Champ system	Origine
absent	undefined	Texte standard
absent	true	Join/leave, skip tour, résultats entité
'dice'	undefined	Dés, macros, dégâts combat
'entity_action'	undefined	Demande arbitrage GM
'sell_request'	undefined	Demande vente GM
'exchange_offer'	undefined	Offre échange PJ
'declare_error'	undefined	Erreur déclaration combat
'resolve_move_blocked'	undefined	Blocage déplacement combat
11. Conclusion

Le chat actuel est un système de messagerie temps réel éphémère, sans persistance, sans module dédié, sans validation, mais avec une couverture fonctionnelle déjà riche (12 types de messages, 14 événements WebSocket, rendu conditionnel). Le rework devra :

    Créer un module chat autonome (chatService.js + socketChat.js).
    Ajouter une persistance (table chat_messages, endpoint REST).
    Unifier les trois points d'entrée client vers un seul service.
    Ajouter la validation (longueur, rate limiting).
    Implémenter /help et la messagerie privée.
    Supporter la pagination pour l'historique.