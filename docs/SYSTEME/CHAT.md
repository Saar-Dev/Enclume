Documentation exhaustive de l'existant

    Version 2.0 — 2026-08-05 (réécriture post-migration, PLAN_CHAT.md Phases 1-3 closes)
    Version 1.0 (2026-08-01) archivée en historique de conversation — décrivait le système
    éphémère pré-migration, entièrement remplacé par ce qui suit.

1. Vue d'ensemble

Le chat texte (messages tapés + whispers) est désormais persisté en base (table `chat_messages`),
survit au rechargement (F5) et se paginer par curseur. Les autres types de messages du flux
(dés, macros, actions entité, trade, combat, notices système) restent éphémères, non persistés,
routés par les mécanismes historiques — cohabitation assumée, pas une migration à moitié faite
(voir §9, Strangler Fig, Phase 4 non commencée).

Propriétés fondamentales (texte persisté)

    Persistant : table `chat_messages`, survit au F5, paginé par curseur (`created_at`, `id`).

    Double transport : REST pour l'historique (`GET /campaigns/:id/chat/messages`), WebSocket
    pour l'envoi et le temps réel (`chat:send` → `chat:message_created`/`chat:message_deleted`).

    Deux canaux : `general` (public, room de campagne) et `whisper` (privé, filtré par
    `recipient_user_id`) — pas de canaux visibles dans l'UI, les deux se mélangent dans un seul
    flux chronologique côté client (V1, voir EN_COURS.md Roadmap "Chat multi-canal").

    Commandes slash côté serveur : `/help`, `/w <joueur> <message>`, `/gm <message>` interceptées
    et exécutées par `chatCommandRegistry` (`server/src/chat/socketChat.js`) — le client envoie le
    texte brut, aucun parsing dupliqué. `/r`/`/roll` restent une exception client (§5).

    Validation, sanitization, rate limiting : 2000 caractères max, échappement HTML + whitelist
    Markdown (gras/italique/code/citation), 10 messages/s/utilisateur.

Propriétés fondamentales (types non migrés — dés, actions, combat, système)

    Éphémères, comme avant la migration : perdus au F5.

    IDs fabriqués côté client par concaténation de strings.

    Toujours dispersés entre plusieurs fichiers serveur et hooks client (§7).

2. Architecture
```
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE SERVEUR                                  │
│                                                                             │
│  server/src/chat/                                                         │
│    chatService.js      sendMessage/getHistory/deleteMessage — point       │
│                         d'entrée unique, valide+sanitize+persiste+diffuse │
│    chatRepository.js   Accès Postgres (Knex), curseur created_at/id       │
│    chatRoutes.js       REST /campaigns/:campaignId/chat/messages          │
│    socketChat.js       WS chat:send → chatCommandRegistry ou sendMessage  │
│    chatCommands.js     /help /w /gm — i18nKey, jamais de texte figé       │
│    chatSanitizer.js    Échappement HTML + whitelist Markdown              │
│    chatValidation.js   Longueur, type, forme                              │
│    chatBroadcast.js    Diffusion partagée REST/WS (room ou user ciblé     │
│                         pour un whisper)                                  │
│    eventBus.js         Existe, aucun module métier n'y publie encore      │
│                         (Message Builders — hors scope V1, §9)            │
│                                                                             │
│  Chemins non migrés (inchangés, cohabitent) :                             │
│    socket/socketDice.js       CHAT_MESSAGE (legacy, plus jamais émis par  │
│                                la saisie réelle — Phase 4 le retirera),   │
│                                DICE_RESULT, MACRO_ROLL_RESULT             │
│    socket/socketCombatHelpers.js → COMBAT_SYSTEM_NOTICE (notice ciblée,   │
│                                un seul joueur, jamais persistée),         │
│                                COMBAT_ATTACK_RESULT, COMBAT_DECLARE_ERROR,│
│                                COMBAT_RESOLVE_MOVE_BLOCKED                │
│    socket/socketEntity.js     ENTITY_ACTION_PENDING, TRADE_SELL_REQUEST  │
│    socket/socketTrade.js      TRADE_OFFER_RECEIVED                       │
└───────────────────────────────────────────────────────────────────────────┘
                              │
              REST (historique)  +  WebSocket (temps réel + legacy)
                              │
┌───────────────────────────────────────────────────────────────────────────┐
│                               SIDE CLIENT                                  │
│                                                                             │
│  lib/useChatSocket.js   Nouveau, unique pour le texte persisté :          │
│                         charge l'historique (general+whisper fusionnés,   │
│                         triés chronologiquement) au montage, écoute       │
│                         chat:message_created/_deleted, expose             │
│                         loadOlderMessages (scroll infini — câblé à un     │
│                         IntersectionObserver dans SidebarChatTab.jsx, §10)│
│  lib/useSessionSocket.js  Inchangé pour SESSION_*/DICE_RESULT/            │
│                         MACRO_ROLL_RESULT/COMBAT_SYSTEM_NOTICE ; la       │
│                         branche CHAT_MESSAGE reste écoutée mais plus      │
│                         jamais émise par la saisie réelle (dormante)      │
│  lib/useEntitySocket.js   Inchangé (ENTITY_ACTION_*, TRADE_*)            │
│  lib/useCombatSocket.js   Inchangé (COMBAT_DECLARE_ERROR, etc.)          │
│                         │                                                 │
│                  ┌──────┴──────┐                                          │
│                  │  addMessage │  (sessionStore.js — dédup par id)       │
│                  │ setMessages │  (historique initial, fusion pas replace)│
│                  │prependMessages│ (scroll infini)                       │
│                  │removeMessage│  (suppression douce)                    │
│                  └──────┬──────┘                                          │
│                         ▼                                                 │
│              messagesByCampaign[campaignId]  (flux unique, non partitionné│
│                                                par canal — §1, V1)         │
│                         │                                                 │
│                         ▼                                                 │
│      components/MessageRendererRegistry.jsx  (dispatch par type)          │
│                         │                                                 │
│                         ▼                                                 │
│              components/Sidebar.jsx  (conteneur, formulaire d'envoi)      │
└───────────────────────────────────────────────────────────────────────────┘
```

3. Base de données — `chat_messages` (créée dans `29_chat_messages.js`, contraintes/index dans
   `126_chat_messages_constraints.js` dont `idx_chat_messages_cursor`, FK dans
   `223_chat_messages_foreign_keys.js` — corrigé 2026-08-26, pas "migration 232", réattribuée à
   `drone_sheet_foreign_keys.js`)
```sql
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL DEFAULT 'general',
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- whisper uniquement
    type TEXT NOT NULL,               -- 'TEXT' | 'WHISPER' en V1
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ            -- suppression douce
);
CREATE INDEX idx_chat_messages_cursor
    ON chat_messages (campaign_id, channel_id, created_at DESC, id DESC);
```

Forme renvoyée par l'API (`chatService.toClientMessage`) :
```json
{
  "id": 254,
  "channelId": "general",
  "type": "TEXT",
  "payload": { "text": "Bonjour !" },
  "author": { "id": "uuid", "username": "Saar", "color": "#4A90D9" },
  "character": null,
  "recipientUserId": null,
  "createdAt": "2026-08-05T21:22:18.196Z"
}
```

4. Flux — texte persisté (TEXT/WHISPER)
| Étape | Fichier | Détail |
|---|---|---|
| Saisie | `Sidebar.jsx` `sendMessage` | `/r`\/`/roll` interceptés localement (inchangé) ; sinon texte brut envoyé tel quel |
| Émission | `Sidebar.jsx` | `socket.emit(WS.CHAT_SEND, { channelId: 'general', type: 'TEXT', payload: { text } })` |
| Réception serveur | `socketChat.js` | Détecte une commande slash (`/help`/`/w`/`/gm`) ou un message normal |
| Commande | `chatCommands.js` via `chatCommandRegistry` | Réponse privée (i18nKey, non persistée) ou message WHISPER persisté |
| Message normal | `chatService.sendMessage` | Rate limit → validation → sanitization → persistance → enrichissement auteur |
| Diffusion | `chatBroadcast.js` | Room entière (`general`) ou seulement expéditeur+destinataire (`whisper`) |
| Réception client | `useChatSocket.js` `onCreated` | `system:true` (réponse commande) résolu en texte i18n ; sinon `addMessage(message)` tel quel |
| Rendu | `MessageRendererRegistry.jsx` `renderText`/`renderWhisper` | Whisper : même corps + indicateur 🔒 |

Historique initial (`useChatSocket.js`, au montage de `Sidebar.jsx`) : deux appels REST fusionnés
(`channelId=general` + `channelId=whisper`, un whisper vit dans un canal séparé côté API — sans
les deux, les whispers disparaîtraient de la vue au chargement), triés par `createdAt` croissant,
fusionnés (pas remplacés) avec ce qui est déjà arrivé en temps réel pendant le chargement.

5. Flux — types non migrés (inchangés depuis avant la migration)

Tous les autres types de messages continuent d'utiliser exactement le même mécanisme qu'avant
(voir version 1.0 de ce document, en historique de conversation, pour le détail complet) :
dés libres (`/r`, `DICE_ROLL`/`DICE_RESULT`), macros, actions entité, trade, combat
(`COMBAT_ATTACK_RESULT`, `COMBAT_DECLARE_ERROR`, `COMBAT_RESOLVE_MOVE_BLOCKED`), messages système
join/leave. Un seul changement : la notice "dual-wield dégradé" (COM29) a migré de `CHAT_MESSAGE`
vers `COMBAT_SYSTEM_NOTICE` (événement dédié, `socketCombatHelpers.js` — trouvé en préparant la
Phase 3 : c'était le seul endroit du fichier à détourner `CHAT_MESSAGE` au lieu de suivre le
patron "un événement par situation" déjà utilisé partout ailleurs).

6. Commandes slash
| Commande | Où | Détail |
|---|---|---|
| `/r <formule>`, `/roll <formule>` | Client (`Sidebar.jsx`), inchangé | Jamais envoyé comme message chat — flux `DICE_ROLL`/`DICE_RESULT` direct. Hors scope V1 de la migration (`PLAN_CHAT.md` §15) |
| `/help` | Serveur (`chatCommandRegistry`) | Liste les commandes, réponse privée non persistée |
| `/w <joueur> <message>` | Serveur | Crée un message `WHISPER`, persisté, visible seulement de l'expéditeur et du destinataire |
| `/gm <message>` | Serveur | Whisper vers le MJ de la campagne |

7. Store Zustand (`sessionStore.js`)
```js
{
  messagesByCampaign: {},   // { [campaignId]: Message[] } — flux unique, pas partitionné par canal
  addMessage(message)       // dédup par id (un message chat peut arriver 2x : historique + temps réel)
  setMessages(campaignId, channelId, messages)     // historique initial — fusionne, ne remplace pas
  prependMessages(campaignId, channelId, older)    // scroll infini — dédup par id
  removeMessage(campaignId, messageId)             // suppression douce — retire du flux local
}
```

8. Rendu — `MessageRendererRegistry.jsx`

Remplace l'ancienne cascade if/else de `Sidebar.jsx` (330 lignes). Dispatch : `msg.system` →
rendu système ; `registry[msg.type]` connu (`entity_action`, `sell_request`, `exchange_offer`,
`declare_error`, `resolve_move_blocked`, `dice`, `TEXT`, `WHISPER`) → renderer dédié ; sinon repli
texte simple. `dice` garde ses sous-branches internes (macro/combat_damage/déplacement/skillcheck/
jet normal) en une seule entrée de registre — les séparer exigerait une clé de discrimination
absente de la donnée.

9. État de la migration (Strangler Fig, `PLAN_CHAT.md` archivé — `docs/Old/PLAN_CHAT.md`)

| Phase | Statut |
|---|---|
| 1 — Table + module, rien branché | ✅ close |
| 2 — Double-écriture non bloquante (`CHAT_PERSISTENCE_ENABLED`) | ✅ close |
| 3 — Bascule client (lecture, rendu, envoi) | ✅ close, confirmée en jeu par Saar (2026-08-05) |
| 4 — Nettoyage (retirer `CHAT_MESSAGE`/ancien listener, Message Builders sur l'EventBus, canaux visibles) | Non commencée — basse priorité, rien ne dépend de son retrait |

10. Limites connues / dette assumée

    Scroll infini câblé (2026-08-22, CHAT-SCROLL1) : sentinelle en tête de `SidebarChatTab.jsx`,
    observée via `IntersectionObserver` (root = le conteneur scrollable lui-même, pas le viewport) —
    déclenche `loadOlderMessages` (`useChatSocket.js`, retourné par `Sidebar.jsx`, threadé en props
    jusqu'à `SidebarChatTab.jsx`, jamais un second appel du hook). L'auto-scroll vers le bas
    (`messagesEndRef`) ne se déclenche que si le DERNIER message change (vraie arrivée temps réel),
    jamais lors d'un préfixage d'historique — sinon charger l'historique en scrollant vers le haut
    ramenait aussitôt la vue en bas.

    Canaux non visibles dans l'UI (V1 assumé) — general et whisper se mélangent dans un seul flux
    chronologique côté client, distingués seulement par l'indicateur 🔒 sur les whispers.

    `CHAT_MESSAGE` et son listener (`useSessionSocket.js`) restent vivants mais dormants (plus
    jamais émis par la saisie réelle) — retrait prévu en Phase 4, pas un risque actif.

    Message Builders (`combatDamage`, `diceRoll`, `systemJoin`...) jamais branchés sur l'EventBus —
    dés, combat, actions entité restent éphémères, hors scope V1.

11. Fichiers impliqués
Serveur — nouveau module (7)
| Fichier | Rôle |
|---|---|
| `server/src/chat/chatService.js` | Logique centrale : valide, sanitize, persiste, diffuse |
| `server/src/chat/chatRepository.js` | Accès Postgres (Knex) |
| `server/src/chat/chatRoutes.js` | REST `/campaigns/:campaignId/chat/*` |
| `server/src/chat/socketChat.js` | WS `chat:send` |
| `server/src/chat/chatCommands.js` | `/help /w /gm` |
| `server/src/chat/chatSanitizer.js` | Échappement HTML + whitelist Markdown |
| `server/src/chat/chatValidation.js` | Longueur, type, forme |
| `server/src/chat/chatBroadcast.js` | Diffusion partagée REST/WS |

Serveur — chemins non migrés (inchangés)
| Fichier | Rôle |
|---|---|
| `socket/socketDice.js` | `CHAT_MESSAGE` (dormant), `DICE_ROLL`/`DICE_RESULT`, `MACRO_ROLL` |
| `socket/socketCombatHelpers.js` | `COMBAT_SYSTEM_NOTICE`, `COMBAT_ATTACK_RESULT`, etc. |
| `socket/socketEntity.js`, `socket/socketTrade.js` | Actions entité, trade |

Client (5)
| Fichier | Rôle |
|---|---|
| `components/Sidebar.jsx` | Conteneur : formulaire d'envoi, appel à `renderMessage()` |
| `components/MessageRendererRegistry.jsx` | Rendu par type |
| `lib/useChatSocket.js` | Historique + temps réel texte persisté |
| `lib/useSessionSocket.js` | `SESSION_*`, `DICE_RESULT`, `MACRO_ROLL_RESULT`, `COMBAT_SYSTEM_NOTICE` |
| `stores/sessionStore.js` | `messagesByCampaign`, setters |

Shared (1)
| Fichier | Rôle |
|---|---|
| `shared/events.js` | `CHAT_SEND`, `CHAT_MESSAGE_CREATED`, `CHAT_MESSAGE_DELETED`, `CHAT_ERROR`, `COMBAT_SYSTEM_NOTICE` + registre historique |
