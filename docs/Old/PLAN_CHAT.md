Module Chat Persistant

    Version 1.1 — 2026-08-04 (revue de complétude avant implantation Phase 1, voir §16)
    Statut : Validé pour implantation Phase 1

16. Revue de complétude (2026-08-04, avant codage Phase 1)

Écarts trouvés entre ce plan (V1.0) et l'état réel du dépôt, tranchés explicitement avant de coder
(aucun n'est un raccourci silencieux) :

    Numérotation migration : §4.3 disait "après 227". La règle de parité pair(Codex)/impair(Claude)
    de CLAUDE.md §5 est abrogée (Codex/Kiwi hors projet, 2026-08-04) — numérotation séquentielle.
    Dernière migration réelle = 231 → cette migration est la 232.

    Autorisation absente (§5.4, §5.5) : ni chatRoutes.js ni socketChat.js ne vérifiaient
    l'appartenance à la campagne. Décision : réutiliser le pattern exact de tradeRoutes.js
    (`requireAuth` + vérification `campaign_members` avant toute lecture/écriture/suppression REST).
    Côté socket, la room de campagne fait déjà foi (même convention que socketDice.js existant).

    Schéma whisper incomplet (§4.1 vs §10) : la table ne portait aucune colonne pour cibler un
    destinataire, alors que §10 décrit `recipients: [senderId, targetId]`. Un payload JSONB non
    indexé ne permet pas de filtrer correctement qui a le droit de voir un whisper. Décision :
    ajouter `recipient_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL` à la table
    (§4.1 mis à jour) et un canal dédié `channel_id = 'whisper'` (pas de mélange avec `general`).

    Validation/sanitization (§5.1, §11) supposaient Zod + une lib de sanitization Markdown.
    Aucune des deux n'est dans server/package.json, et aucun autre module serveur n'utilise Zod
    (vérifié). Décision : pas de nouvelle dépendance pour ce module — `chatValidation.js` est un
    validateur maison (longueur/type/forme), `chatSanitizer.js` échappe le HTML puis applique une
    whitelist regex des 4 patterns autorisés (gras/italique/code/citation).

    Migration sans `down()` (§4.1) : complété avec un rollback symétrique, pattern
    `231_kneeling_position.js`.

    Nommage événements (§5.5, §14) : `chat:message.created`/`chat:message.deleted` utilisaient un
    point, absent de toute autre entrée de `shared/events.js` (convention `namespace:verbe_snake`
    uniquement). Renommés `CHAT_MESSAGE_CREATED`/`CHAT_MESSAGE_DELETED`/`CHAT_SEND` →
    `chat:message_created`/`chat:message_deleted`/`chat:send`.

    i18n (§5.6, §9) : les réponses de commandes (`/help`, `/w`, `/gm`) du plan initial renvoyaient du
    texte français figé ("Usage : /w <joueur> <message>", etc.) — violation directe de
    `.claude/rules/i18n.md` ("le serveur n'émet jamais de texte FR figé destiné à l'utilisateur").
    `chatCommands.js` renvoie désormais des clés `i18nKey` (namespace `chat.commands.*`), résolues
    côté client en Phase 3 (pattern déjà en place : `socketCombatHelpers.js` + `useSessionSocket.js`,
    `system: true` + `i18nKey`). Les entrées `client/src/locales/*.json` correspondantes seront créées
    en Phase 3, pas maintenant (rien n'émet encore ces clés).

    Permission de commande (§5.6) : chaque commande déclare `permission` ('player'/'gm') mais
    `CommandRegistry.execute` du plan ne le vérifiait jamais. Enforcement ajouté (rejet si
    `permission === 'gm'` et `!context.isGm`) — aucune commande V1 n'est actuellement 'gm', mais le
    champ ne doit pas rester mort.

Statut : ces 5 points ferment les seuls trous bloquant une Phase 1 sérieuse (schéma DB + squelette
module, rien branché dans l'existant). Les écarts déjà identifiés en Phase 3-4 (structure
`sessionStore.messagesByCampaign` sans `channelId`, topic `combat.damage` vs événements réels de
`shared/events.js`, i18n des nouveaux libellés) restent ouverts et seront traités au moment de ces
phases, pas maintenant — ils ne bloquent pas la Phase 1 car rien n'est branché dans l'existant à ce
stade.

1. Objectif

Transformer le chat d'Enclume, actuellement éphémère et éclaté dans plusieurs fichiers, en un module autonome avec persistance et architecture événementielle, capable de servir de journal de campagne.
2. État actuel (rappel synthétique)

    Messages stockés en mémoire Zustand, perdus au rechargement (F5).

    Handler CHAT_MESSAGE dans socketDice.js, sans module dédié.

    Trois hooks clients distincts (useSessionSocket, useEntitySocket, useCombatSocket) appellent addMessage.

    Aucune table chat_messages, aucune API REST, aucune pagination.

    Commandes slash : seul /r est implémenté.

    Pas de messagerie privée, pas de validation, pas de rate limiting.

3. Architecture cible
text

┌─────────────────────────────────────────────────────────────────────┐
│                       MODULES MÉTIER                                │
│  Combat  ──┐                                                        │
│  Trade   ──┼──> EventBus ──> ChatService ──> PostgreSQL             │
│  Entity  ──┤       │                              │                 │
│  Dice    ──┘       │                              │                 │
│                    │                              ▼                 │
│                    └───────────────────────> Socket.IO              │
│                                              (rooms campagne +      │
│                                               rooms utilisateur)    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT                                      │
│  useChatSocket.js  ──> sessionStore  ──> MessageRendererRegistry    │
│       (unique)          (paginé)              (rendu par type)      │
└─────────────────────────────────────────────────────────────────────┘

4. Base de données
4.1 Table chat_messages
sql

CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL DEFAULT 'general',
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_cursor
    ON chat_messages (campaign_id, channel_id, created_at DESC, id DESC);

-- recipient_user_id : NULL sauf channel_id = 'whisper' (destinataire du message privé).
-- Voir §16 — ajouté à la revue de complétude, absent du schéma initial V1.0.

4.2 Justification des colonnes
Colonne	Justification
id BIGSERIAL	Tri temporel, performant pour curseur, natif PostgreSQL
campaign_id	Scope campagne (chat par campagne)
channel_id TEXT	Anticipation canaux multiples (général, combat, privé)
sender_user_id	Auteur humain, nullable pour messages système
character_id	Personnage lié, nullable pour messages joueur pur
recipient_user_id	Destinataire d'un whisper (`channel_id = 'whisper'`), NULL sinon — ajouté §16
type TEXT	Discriminant : TEXT, DICE, COMBAT_DAMAGE, SYSTEM_JOIN, etc.
payload JSONB	Données métier brutes (formule, résultats, texte, etc.)
created_at	Horodatage serveur autoritaire
deleted_at	Suppression douce, pas de perte de données
4.3 Migration

232 (numérotation séquentielle, voir §16 — la convention pair/impair de CLAUDE.md §5 est abrogée).
5. Module serveur server/src/chat/
5.1 Structure des fichiers
text

server/src/chat/
├── chatService.js          # Logique métier centrale
├── chatRepository.js       # Accès PostgreSQL (Knex)
├── chatRoutes.js           # API REST
├── socketChat.js           # Handlers WebSocket
├── chatCommands.js         # Command Registry (/help, /w, /r)
├── messageBuilders/        # Transformateurs événement → message
│   ├── combatDamage.js
│   ├── diceRoll.js
│   └── systemJoin.js
├── eventBus.js             # Abstraction EventBus
├── chatValidation.js       # Schémas Zod
└── chatSanitizer.js        # Sanitization Markdown

5.2 chatService.js — Logique centrale

Responsabilités :

    sendMessage(campaignId, channelId, senderUserId, characterId, type, payload) : valide, sanitize, persiste, broadcast.

    getHistory(campaignId, channelId, cursor, limit) : pagination par curseur.

    registerBuilder(topic, builder) : enregistre un transformateur événement → message.

    listenEvents() : s'abonne à l'EventBus pour les topics enregistrés.

5.3 chatRepository.js — Accès données
js

async function insertMessage(data) {
    return db('chat_messages').insert(data).returning('*');
}

async function getMessages(campaignId, channelId, { beforeDate, beforeId, limit = 50 }) {
    let query = db('chat_messages')
        .where({ campaign_id: campaignId, channel_id: channelId })
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit);

    if (beforeDate && beforeId) {
        query = query.where(function() {
            this.where('created_at', '<', beforeDate)
                .orWhere(function() {
                    this.where('created_at', beforeDate)
                        .where('id', '<', beforeId);
                });
        });
    }
    return query;
}

async function softDelete(messageId, userId) {
    return db('chat_messages')
        .where({ id: messageId })
        .update({ deleted_at: db.fn.now() });
}

5.4 chatRoutes.js — API REST
Méthode	Route	Description
GET	/api/campaigns/:campaignId/chat/messages?channelId=general&limit=50&beforeDate=&beforeId=	Historique paginé
POST	/api/campaigns/:campaignId/chat/messages	Envoi message (texte seul en V1)
DELETE	/api/campaigns/:campaignId/chat/messages/:messageId	Suppression douce (auteur ou GM)

Réponse GET :
json

{
    "messages": [
        {
            "id": 9875,
            "channelId": "general",
            "type": "TEXT",
            "payload": { "text": "Bonjour !" },
            "author": { "id": "uuid", "username": "Saar", "color": "#4A90D9" },
            "character": null,
            "createdAt": "2026-08-01T10:00:00Z"
        }
    ],
    "pagination": {
        "hasMore": true,
        "nextCursor": { "beforeDate": "2026-08-01T10:00:00Z", "beforeId": 9825 }
    }
}

5.5 socketChat.js — Handlers WebSocket

Événements :
Événement	Direction	Payload
chat:message.created	Serveur → Room	{ id, channelId, type, payload, author, character, createdAt }
chat:message.deleted	Serveur → Room	{ id, channelId }
chat:send	Client → Serveur	{ channelId, type, payload }
chat:typing	Client → Serveur → Room	{ channelId, userId, username } (optionnel V1)
5.6 chatCommands.js — Command Registry
js

class CommandRegistry {
    constructor() {
        this.commands = new Map();
    }
    register(command) {
        this.commands.set(command.name, command);
    }
    execute(name, context, args) {
        const cmd = this.commands.get(name);
        if (!cmd) throw new Error('Commande inconnue');
        return cmd.execute(context, args);
    }
}

// Commandes V1 :
registry.register({
    name: 'help',
    description: 'Affiche l\'aide',
    permission: 'player',
    execute(ctx, args) { /* retourne la liste des commandes */ }
});
registry.register({
    name: 'w',
    description: 'Message privé',
    permission: 'player',
    execute(ctx, args) { /* /w joueur message */ }
});
registry.register({
    name: 'r',
    description: 'Jet de dés',
    permission: 'player',
    execute(ctx, args) { /* /r 1d20+3 */ }
});

6. Event Bus
6.1 Abstraction
js

// server/src/chat/eventBus.js
import { EventEmitter } from 'node:events';

class EventBus {
    constructor() {
        this.emitter = new EventEmitter();
    }
    publish(topic, payload, schema) {
        if (schema) {
            const result = schema.safeParse(payload);
            if (!result.success) throw new Error(`Invalid event payload for ${topic}`);
        }
        this.emitter.emit(topic, payload);
    }
    subscribe(topic, handler) {
        this.emitter.on(topic, async (payload) => {
            try {
                await handler(payload);
            } catch (error) {
                console.error(`[EventBus] Handler error for ${topic}:`, error);
            }
        });
    }
}

export const eventBus = new EventBus();

6.2 Topics initiaux
Topic	Émetteur	Payload
combat.damage	socketCombatHelpers.js	{ attackerId, targetId, amount, damageType, ... }
dice.roll.completed	socketDice.js	{ userId, formula, rolls, total, ... }
trade.offer.sent	socketTrade.js	{ offerId, fromCharName, ... }
session.user.joined	socket/index.js	{ userId, username }
session.user.left	socket/index.js	{ userId, username }
6.3 Intégration Strangler

Phase 1 : l'EventBus est créé, ChatService.listenEvents() s'abonne, mais les anciens appels directs (io.to().emit(CHAT_MESSAGE)) restent en place.

Phase 2 : les modules métier commencent à publier sur l'EventBus en plus de leurs émissions directes. ChatService déduplique via eventId.

Phase 3 : les appels directs sont supprimés un par un.
7. Message Builders

Chaque builder transforme un événement métier en message chat.
js

// messageBuilders/combatDamage.js
export default {
    topic: 'combat.damage',
    build(event) {
        return {
            channelId: 'general',
            type: 'COMBAT_DAMAGE',
            senderUserId: null,  // système
            characterId: event.attackerCharacterId,
            payload: {
                attackerId: event.attackerId,
                targetId: event.targetId,
                amount: event.amount,
                damageType: event.damageType,
                targetName: event.targetName,
            },
        };
    },
};

Builders V1 : combatDamage, diceRoll, systemJoin, systemLeave, tradeOfferSent, tradeOfferReceived, entityActionPending.
8. Client
8.1 useChatSocket.js — Hook unifié

Remplace les trois hooks actuels pour l'ajout de messages. Écoute chat:message.created et chat:message.deleted. Appelle sessionStore.addMessage et sessionStore.removeMessage.
8.2 sessionStore.js — Extensions

Nouveaux setters :

    setMessages(campaignId, channelId, messages) : initialise depuis l'historique.

    prependMessages(campaignId, channelId, messages) : pagination ascendante.

    removeMessage(campaignId, messageId) : suppression douce.

    addMessage : enrichi pour dédupliquer par id.

8.3 MessageRendererRegistry.js — Rendu côté client
js

const registry = {
    TEXT: (msg) => <TextMessage {...msg} />,
    DICE: (msg) => <DiceMessage {...msg} />,
    COMBAT_DAMAGE: (msg) => <CombatDamageMessage {...msg} />,
    SYSTEM_JOIN: (msg) => <SystemMessage {...msg} />,
    // ...
};

function renderMessage(msg) {
    const Renderer = registry[msg.type] || registry.TEXT;
    return <Renderer {...msg} />;
}

Ce registre remplace la cascade if/else de Sidebar.jsx.
8.4 Chargement initial

Au SESSION_JOINED, le client appelle GET /chat/messages?channelId=general&limit=50. Les messages sont stockés via setMessages. Les messages temps réel qui arrivent pendant le chargement sont ajoutés normalement ; la déduplication par id évite les doublons.
8.5 Scroll infini

Un IntersectionObserver surveille une sentinelle en haut de la liste. Quand elle devient visible, le client appelle GET /chat/messages?beforeDate=...&beforeId=... et prependMessages.
9. Commandes slash V1
Commande	Description	Permission
/r <formule>	Jet de dés (existant, migré vers Command Registry)	player
/roll <formule>	Alias /r	player
/help	Liste des commandes disponibles	player
/w <joueur> <message>	Message privé	player
/gm <message>	Message au MJ	player

Le parsing côté client intercepte les commandes avant émission chat:send. Pour /r, le flux existant est conservé (émission DICE_ROLL, résultat via DICE_RESULT), mais le résultat sera persisté comme message de type DICE.
10. Messagerie privée

    Chaque socket rejoint user:<userId> à la connexion.

    /w Saar Bonjour → le serveur crée un message de type WHISPER avec recipients: [senderId, targetId].

    Le message est routé vers io.to("user:<senderId>") et io.to("user:<targetId>").

    Les whispers apparaissent dans un canal private ou avec un indicateur visuel spécifique.

    Les whispers sont persistés comme les autres messages, mais seuls l'expéditeur et le destinataire peuvent les voir via l'API.

11. Sanitization et validation

    Longueur max : 2000 caractères.

    Rate limiting : 10 messages/seconde/utilisateur via rate-limiter-flexible (déjà utilisé pour trade).

    Markdown autorisé : **gras**, *italique*, `code`, > citation.

    Tout autre HTML est échappé.

    Sanitization dans chatSanitizer.js, appelée par chatService.sendMessage() avant persistence.

12. Stratégie de migration
Phase 1 — Création table et module (sans changement visible)

    Exécuter la migration chat_messages.

    Créer server/src/chat/ avec service, repository, routes, socket, EventBus.

    Ne rien brancher dans l'existant.

Phase 2 — Double écriture

    Ajouter un appel à chatService.sendMessage() dans le handler CHAT_MESSAGE existant (en plus du broadcast direct).

    Les messages sont maintenant persistés, mais le client ne les lit pas encore.

    Feature flag CHAT_PERSISTENCE_ENABLED pour activer/désactiver.

Phase 3 — Bascule en lecture

    Le client appelle GET /chat/messages au chargement et utilise le store paginé.

    Le listener chat:message.created remplace progressivement les anciens listeners.

    Les hooks useEntitySocket et useCombatSocket continuent de fonctionner pour les anciens types de messages non encore migrés.

Phase 4 — Nettoyage

    Tous les anciens appels directs sont supprimés.

    Tous les modules métier publient sur l'EventBus.

    Les anciens événements (CHAT_MESSAGE, DICE_RESULT pour le chat) sont dépréciés.

    Le MessageRendererRegistry devient l'unique moteur de rendu.

13. Tests
Niveau	Cible	Outils
Unitaire	chatService, chatSanitizer, chatValidation, Message Builders, Command Registry	Node test runner
Intégration	chatRoutes + chatRepository + PostgreSQL réel (Docker)	Docker Compose, Knex migrations, socket.io-client
End-to-end	Scénario utilisateur complet : envoi, réception, rechargement, historique, scroll, commandes, whisper	Playwright
14. Livrables V1

    Migration chat_messages.

    Module server/src/chat/ complet.

    shared/events.js : nouveaux événements chat:message.created, chat:message.deleted, chat:send.

    useChatSocket.js unifié.

    MessageRendererRegistry.js.

    Store sessionStore.js étendu.

    Sidebar.jsx refactorisé pour utiliser le Registry.

    Commandes /help, /w, /gm.

    API REST fonctionnelle avec pagination.

    Tests unitaires et d'intégration.

15. Hors scope V1

    Persistance des dés et macros via le nouveau module (conservation du flux actuel DICE_RESULT temporairement).

    Canaux multiples visibles dans l'UI (le channel_id est en base mais seul general est utilisé).

    /r migré vers le Command Registry (reste dans Sidebar.jsx en attendant).

    Batching UI (file d'attente + requestAnimationFrame) — le rendu actuel messages.map() est conservé.

    Suppression des anciens hooks (useEntitySocket, useCombatSocket) — ils cohabitent.