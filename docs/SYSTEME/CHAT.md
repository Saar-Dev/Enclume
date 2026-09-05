Documentation exhaustive de l'existant

    Version 2.1 — 2026-09-05 (commandes /heal et /t, persistance /r — PLAN_CHAT_COMMANDES.md clos,
    archivé en docs/Old/). Nouveauté par rapport à 2.0 : /heal, /t enregistrés dans le Command
    Registry (§6) ; /r/roll persistés (sans passer par l'EventBus/Message Builders envisagés par
    PLAN_CHAT.md — écart assumé, voir §9) ; nouveau type de message persisté SYSTEM (§8) ;
    campaigns.current_battlemap_id (migration 324) — carte actuelle du groupe, distincte de
    default_battlemap_id, consommée par /heal (§6) et par SessionPage.jsx à la reconnexion.
    Audit de compréhension approfondie 2026-08-26 : événements CHAT_* confirmés dans shared/events.js,
    9 fichiers server/src/chat/ confirmés (comptage §11 corrigé), eventBus.js confirmé réellement
    inerte (listenEvents() jamais appelé, aucun eventBus.publish nulle part dans server/). Aucune
    autre correction nécessaire au-delà de la migration déjà réparée en §3.
    Version 2.0 — 2026-08-05 (réécriture post-migration, PLAN_CHAT.md Phases 1-3 closes)
    Version 1.0 (2026-08-01) archivée en historique de conversation — décrivait le système
    éphémère pré-migration, entièrement remplacé par ce qui suit.

1. Vue d'ensemble

Le chat texte (messages tapés + whispers) est désormais persisté en base (table `chat_messages`),
survit au rechargement (F5) et se paginer par curseur. Les jets de dés libres (`/r`/`/roll`, non
secrets) sont persistés depuis la v2.1 (§5, §6) — écriture directe (`chatService.sendMessage`), pas
via l'EventBus/Message Builders que `PLAN_CHAT.md` envisageait pour cette migration (§9). Les autres
types de messages du flux (macros, actions entité, trade, combat, notices système, jets secrets)
restent éphémères, non persistés, routés par les mécanismes historiques — cohabitation assumée, pas
une migration à moitié faite.

Propriétés fondamentales (texte persisté)

    Persistant : table `chat_messages`, survit au F5, paginé par curseur (`created_at`, `id`).

    Double transport : REST pour l'historique (`GET /campaigns/:id/chat/messages`), WebSocket
    pour l'envoi et le temps réel (`chat:send` → `chat:message_created`/`chat:message_deleted`).

    Deux canaux : `general` (public, room de campagne) et `whisper` (privé, filtré par
    `recipient_user_id`) — pas de canaux visibles dans l'UI, les deux se mélangent dans un seul
    flux chronologique côté client (V1, voir EN_COURS.md Roadmap "Chat multi-canal").

    Commandes slash côté serveur : `/help`, `/w <joueur> <message>`, `/gm <message>`, `/heal`,
    `/t <compétence> [difficulté]` interceptées et exécutées par `chatCommandRegistry`
    (`server/src/chat/socketChat.js`) — le client envoie le texte brut, aucun parsing dupliqué.
    `/r`/`/roll` restent une exception client (§6) : jamais envoyés comme `chat:send`, mais leur
    résultat est persisté depuis la v2.1 (§5 flux non migrés).

    Validation, sanitization, rate limiting : 2000 caractères max, échappement HTML + whitelist
    Markdown (gras/italique/code/citation), 10 messages/s/utilisateur.

Propriétés fondamentales (types non migrés — macros, actions, combat, système, jets secrets)

    Éphémères, comme avant la migration : perdus au F5. Exception ciblée depuis la v2.1 : un jet
    /r/roll non secret est persisté (id numérique de la ligne chat_messages), mais reste diffusé en
    direct par le même DICE_RESULT qu'avant — deux mécanismes distincts pour un même jet (§5).

    IDs fabriqués côté client par concaténation de strings (sauf le jet /r persisté ci-dessus).

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

4. Flux — texte persisté (TEXT/WHISPER/SYSTEM)
| Étape | Fichier | Détail |
|---|---|---|
| Saisie | `Sidebar.jsx` `sendMessage` | `/r`\/`/roll` interceptés localement (inchangé) ; sinon texte brut envoyé tel quel |
| Émission | `Sidebar.jsx` | `socket.emit(WS.CHAT_SEND, { channelId: 'general', type: 'TEXT', payload: { text } })` |
| Réception serveur | `socketChat.js` | Détecte une commande slash (`/help`/`/w`/`/gm`/`/heal`/`/t`) ou un message normal |
| Commande | `chatCommands.js` via `chatCommandRegistry` | Réponse privée (i18nKey, non persistée) ; message WHISPER persisté (`/w`, `/gm`) ; message `SYSTEM` public persisté avec `senderUserId: null` (`/heal`, bypass volontaire de rate limit/validation — v2.1) ; ou `{ handled: true }` (`/t`, effet déjà produit par la commande elle-même, rien à transmettre à `sendMessage`) |
| Message normal | `chatService.sendMessage` | Rate limit → validation → sanitization → persistance → enrichissement auteur (bypass si `senderUserId: null`, patron Message Builder) |
| Diffusion | `chatBroadcast.js` | Room entière (`general`) ou seulement expéditeur+destinataire (`whisper`) |
| Réception client | `useChatSocket.js` `onCreated` | `system:true` (réponse commande éphémère) résolu en texte i18n ; sinon `addMessage(message)` tel quel |
| Rendu | `MessageRendererRegistry.jsx` `renderText`/`renderWhisper`/`renderSystemPersisted` | Whisper : même corps + indicateur 🔒. SYSTEM : `payload.i18nKey`/`params` résolus au rendu (pas à la réception) |

Historique initial (`useChatSocket.js`, au montage de `Sidebar.jsx`) : deux appels REST fusionnés
(`channelId=general` + `channelId=whisper`, un whisper vit dans un canal séparé côté API — sans
les deux, les whispers disparaîtraient de la vue au chargement), triés par `createdAt` croissant,
fusionnés (pas remplacés) avec ce qui est déjà arrivé en temps réel pendant le chargement.

5. Flux — types non migrés (inchangés depuis avant la migration)

Tous les autres types de messages continuent d'utiliser exactement le même mécanisme qu'avant
(voir version 1.0 de ce document, en historique de conversation, pour le détail complet) :
macros, actions entité, trade, combat (`COMBAT_ATTACK_RESULT`, `COMBAT_DECLARE_ERROR`,
`COMBAT_RESOLVE_MOVE_BLOCKED`), messages système join/leave, jets secrets (`/r`/`/roll`/`/t` avec
`secret:true`). Un seul changement (Phase 3) : la notice "dual-wield dégradé" (COM29) a migré de
`CHAT_MESSAGE` vers `COMBAT_SYSTEM_NOTICE` (événement dédié, `socketCombatHelpers.js`).

**`/r`/`/roll` non secrets, persistés depuis la v2.1** (`socketDice.js:DICE_ROLL`) — seule exception à
« non migré » dans cette liste, et volontairement à part de la migration Strangler Fig d'origine
(pas d'EventBus, pas de Message Builder `diceRoll.js` — écart assumé, §9) :
- Diffusion live inchangée : `io.to(campaignId).emit(WS.DICE_RESULT, payload)`, toujours la seule
  source du rendu temps réel.
- En plus, uniquement si `!secret` : `chatService.sendMessage({ senderUserId: null, type: 'DICE',
  channelId: 'general', payload })` — le même `payload` que le direct (`userId`/`username`/`color`/
  `formula`/`rolls`/`total`/... portés dans `payload`, jamais résolus via `author` puisque
  `senderUserId` est `null`). Non bloquant : un échec de persistance ne remonte jamais au joueur.
- Un jet secret n'est **jamais** persisté : le modèle `recipient_user_id` (singulier) ne représente
  pas un « whisper à plusieurs destinataires » (lanceur + N MJ) sans changement de schéma — décision
  assumée, pas un oubli.
- Lecture d'historique (`useChatSocket.js`, chargement initial + `loadOlderMessages`) : un message
  `type: 'DICE'` traverse `normalizeChatMessage.js:normalizeMessage`, qui aplatit `payload.*` vers la
  racine et force `type:'dice'` (minuscule) — `MessageRendererRegistry.jsx:renderDice` n'a jamais vu
  que cette forme plate, jamais la forme générique `{payload:{...}}` des autres types persistés.
  Jamais rencontré côté `onCreated` (temps réel) : un jet non secret n'est jamais rediffusé via
  `CHAT_MESSAGE_CREATED`, seulement persisté — un second broadcast aurait dupliqué le jet chez tout
  client déjà connecté (le `DICE_RESULT` direct l'a déjà livré, avec un id différent).

**Tests de compétence (`/t`, actions d'entité/connecteur via `gmArbitratedTestService.js`)** —
partagent une forme `DICE_RESULT` commune (`skillLabel`, `mechanicalTotal`, `chancesDeReussite`,
`diffLabel`, `mr`, `breakdown` — Test compétence-vs-Seuil RAW p.201-205), routée par
`renderDice` (branche `skillLabel !== undefined`) vers un rendu Seuil + badge Réussite/Échec, jamais
le rendu "jet brut". Depuis la v2.1, `useSessionSocket.js:onDiceResult` anime aussi un dé 3D pour
cette forme (`dieType: 'd20'`, déduit directement — un Test est toujours 1d20 par construction RAW,
jamais parsé depuis `formula` qui porte ici un libellé de compétence, pas une notation de dé) : ce
fix vit dans le mécanisme partagé, donc les actions d'entité/connecteur en bénéficient aussi, pas
seulement `/t`.

6. Commandes slash
| Commande | Où | Détail |
|---|---|---|
| `/r <formule>`, `/roll <formule>` | Client (`Sidebar.jsx`), inchangé | Jamais envoyé comme message chat — flux `DICE_ROLL`/`DICE_RESULT` direct. Résultat non secret persisté depuis v2.1 (§5) |
| `/help` | Serveur (`chatCommandRegistry`) | Liste les commandes, réponse privée non persistée |
| `/w <joueur> <message>` | Serveur | Crée un message `WHISPER`, persisté, visible seulement de l'expéditeur et du destinataire |
| `/gm <message>` | Serveur | Whisper vers le MJ de la campagne |
| `/heal` (portée carte), `/heal all` (portée campagne) | Serveur, MJ uniquement (`permission:'gm'`, jamais de repli `users.role==='admin'`) | Vide `character_wounds`/`token_statuses` de chaque personnage trouvé (`woundService.js:healCampaignCharacters`) — tout type (PJ/PNJ/exo/drone). Portée carte = `tokens.battlemap_id = campaigns.current_battlemap_id` (repli `default_battlemap_id`, migration 324). Trace : message `SYSTEM` public |
| `/t <compétence> [difficulté] [@personnage]` | Serveur, tout joueur | Test 1d20 immédiat contre Seuil, **sans validation MJ** (écarte `gmArbitratedTestService.js`) — `skillTestService.js:resolveSkillTestCommand`. Cible le personnage du joueur (`characters.user_id`), fallback `@<personnage>` si plusieurs. Matching de compétence exact (insensible casse/accents) contre tout `ref_skills`. Déclenche la Catastrophe automatique (7ᵉ site RAW) comme `MACRO_ROLL` |

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
rendu système éphémère (`renderSystem`, cas spécial `chat.commands.help.list` — liste dynamique
construite dans `useChatSocket.js`, i18next ne boucle pas dans un seul `t()`) ; `registry[msg.type]`
connu (`entity_action`, `sell_request`, `exchange_offer`, `declare_error`, `resolve_move_blocked`,
`dice`, `TEXT`, `WHISPER`, `SYSTEM` — v2.1) → renderer dédié ; sinon repli texte simple. `dice` garde
ses sous-branches internes (macro/combat_damage/déplacement/skillcheck/jet normal) en une seule
entrée de registre — les séparer exigerait une clé de discrimination absente de la donnée.
`SYSTEM` (`renderSystemPersisted`, v2.1) diffère de `msg.system` : message **persisté** et
**public** (`/heal`), `payload.i18nKey`/`params` résolus au moment du rendu (pas à la réception,
puisqu'un message persisté peut être rendu plusieurs fois — historique, scroll infini).

9. État de la migration (Strangler Fig, `PLAN_CHAT.md` archivé — `docs/Old/PLAN_CHAT.md`)

| Phase | Statut |
|---|---|
| 1 — Table + module, rien branché | ✅ close |
| 2 — Double-écriture non bloquante (`CHAT_PERSISTENCE_ENABLED`) | ✅ close |
| 3 — Bascule client (lecture, rendu, envoi) | ✅ close, confirmée en jeu par Saar (2026-08-05) |
| 4 — Nettoyage (retirer `CHAT_MESSAGE`/ancien listener, Message Builders sur l'EventBus, canaux visibles) | Non commencée — basse priorité, rien ne dépend de son retrait |

**Écart assumé (v2.1, `docs/Old/PLAN_CHAT_COMMANDES.md`)** : la persistance de `/r`/`/roll` (§5)
n'emprunte **pas** le chemin Phase 4 (Message Builder `diceRoll.js` + `eventBus.publish`) que
`PLAN_CHAT.md` envisageait pour cette migration précise — écriture directe dans `socketDice.js`
(`chatService.sendMessage`), plus simple, sans dépendre d'une infrastructure EventBus toujours
inerte (`listenEvents()` jamais appelé, confirmé §audit 2026-08-26). Ne pas lire ce tableau comme
« Phase 4 commencée » : c'est un raccourci ciblé pour un seul type, pas le début du chantier
Message Builders décrit par la Phase 4.

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
    combat, actions entité restent éphémères. `/r`/`/roll` non secrets font exception (§5, écriture
    directe, pas via ce mécanisme).

    Un jet secret (`/r`/`/roll`/`/t` avec `secret:true`) n'est jamais persisté — le modèle
    `recipient_user_id` singulier ne représente pas un whisper à plusieurs destinataires (lanceur +
    N MJ) sans changement de schéma. Décision assumée (v2.1), pas un oubli.

    `campaigns.current_battlemap_id` (migration 324, v2.1) — `MAP_SWITCH` (`socketBattlemap.js`)
    était un relais stateless avant cette colonne ; `userIds` (scission du groupe sur plusieurs
    cartes) reste un paramètre du protocole jamais peuplé en pratique (seul point d'émission réel,
    `useBattlemapManager.js`, toujours `userIds: []`) — si ça change un jour, cette colonne (une
    seule carte "actuelle" par campagne) devra être revue.

11. Fichiers impliqués
Serveur — module chat
| Fichier | Rôle |
|---|---|
| `server/src/chat/chatService.js` | Logique centrale : valide, sanitize, persiste, diffuse |
| `server/src/chat/chatRepository.js` | Accès Postgres (Knex) |
| `server/src/chat/chatRoutes.js` | REST `/campaigns/:campaignId/chat/*` |
| `server/src/chat/socketChat.js` | WS `chat:send` — dispatch commandes, injecte `healCharacters`/`rollSkillTest` dans le context (`chatCommands.js` ne touche jamais la DB) |
| `server/src/chat/chatCommands.js` | `/help /w /gm /heal /t` |
| `server/src/chat/chatSanitizer.js` | Échappement HTML + whitelist Markdown |
| `server/src/chat/chatValidation.js` | Longueur, type, forme (`TEXT`/`WHISPER` uniquement — `senderUserId: null` bypasse) |
| `server/src/chat/chatBroadcast.js` | Diffusion partagée REST/WS |

Serveur — Tests et dés (v2.1)
| Fichier | Rôle |
|---|---|
| `server/src/lib/characterTestContext.js` | Contexte de stats (compétences/attributs/malus actifs) d'un personnage — extrait de `MACRO_ROLL`, réutilisé par `/t` |
| `server/src/lib/skillTestService.js` | Résolution de `/t` : personnage, compétence, seuil, jet, broadcast, Catastrophe |
| `server/src/lib/woundService.js` | `clearCharacterWoundsAndStatuses`/`healCampaignCharacters` (`/heal`) |
| `server/src/db/migrations/324_campaigns_current_battlemap_id.js` | `campaigns.current_battlemap_id` |

Serveur — chemins non migrés (inchangés, sauf mention)
| Fichier | Rôle |
|---|---|
| `socket/socketDice.js` | `CHAT_MESSAGE` (dormant), `DICE_ROLL`/`DICE_RESULT` (persistance `/r` non secret depuis v2.1), `MACRO_ROLL` (refactoré sur `characterTestContext.js`, comportement inchangé) |
| `socket/socketBattlemap.js` | `MAP_SWITCH` — écrit `current_battlemap_id` depuis v2.1 (était un relais stateless) |
| `socket/socketCombatHelpers.js` | `COMBAT_SYSTEM_NOTICE`, `COMBAT_ATTACK_RESULT`, etc. |
| `socket/socketEntity.js`, `socket/socketTrade.js` | Actions entité, trade |

Client (8)
| Fichier | Rôle |
|---|---|
| `components/Sidebar.jsx` | Conteneur : formulaire d'envoi, appel à `renderMessage()` |
| `components/SidebarChatTab.jsx` | Saisie, autocomplétion `/t` (catalogue `ref_skills` chargé une fois) |
| `components/MessageRendererRegistry.jsx` | Rendu par type |
| `lib/useChatSocket.js` | Historique + temps réel texte persisté ; normalise les messages `DICE` via `normalizeChatMessage.js` |
| `lib/normalizeChatMessage.js` | Aplatit un message `DICE` persisté vers la forme plate attendue par `renderDice` (v2.1) |
| `lib/useSessionSocket.js` | `SESSION_*`, `DICE_RESULT` (anime un d20 aussi pour un Test compétence-vs-Seuil depuis v2.1), `MACRO_ROLL_RESULT`, `COMBAT_SYSTEM_NOTICE` |
| `stores/sessionStore.js` | `messagesByCampaign`, setters |
| `pages/SessionPage.jsx` | Charge `current_battlemap_id ?? default_battlemap_id` à la (re)connexion (v2.1) |

Shared (1)
| Fichier | Rôle |
|---|---|
| `shared/events.js` | `CHAT_SEND`, `CHAT_MESSAGE_CREATED`, `CHAT_MESSAGE_DELETED`, `CHAT_ERROR`, `COMBAT_SYSTEM_NOTICE` + registre historique |
