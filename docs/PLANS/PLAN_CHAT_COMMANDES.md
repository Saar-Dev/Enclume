# PLAN_CHAT_COMMANDES.md — Extension des commandes de chat

> Version 1 — 2026-09-04 (Claude/Saar). Origine : demande directe de Saar (commandes `/heal`, `/t`,
> comblement de deux dettes connues sur `/help` et `/r`). Rédigé après exploration complète du module
> chat existant et deux passes d'analyse à charge (corrections listées §7).
>
> Marquage (`docs/METHODO_PLAN.md`, étendu comme `PLAN_INTERACTIONS_CONNECTEURS.md`) :
> **[VÉRIFIÉ]** = lu dans le code cette session, source citée. **[CIBLE]** = architecture proposée,
> rien codé. **[OUVERT]** = décision non tranchée, bloque l'implémentation du point concerné.
>
> **Un sujet codé à la fois** (contrat `AGENTS.md`) — ce document couvre 4 sujets sous une même
> responsabilité (« étendre le Command Registry du chat »), mais chacun reste un lot d'implémentation
> séparé, validé indépendamment par Saar avant de passer au suivant. Ordre recommandé : §3 → §4 → §5 →
> §6.

---

## 0. Responsabilité unique

Étendre `chatCommandRegistry` (`server/src/chat/chatCommands.js`) avec des commandes utilitaires
(`/heal`, `/t`) et combler deux dettes déjà identifiées du module chat (`docs/SYSTEME/CHAT.md`) — sans
dupliquer une autorité serveur existante (Blessures, Tests Polaris, dés). Aucune nouvelle mécanique de
jeu : chaque commande orchestre des services déjà autoritaires (`woundService.js`, `diceParser.js`,
`polarisTestResolution.js`).

---

## 1. Sources [VÉRIFIÉ]

- `docs/SYSTEME/CHAT.md` (audit 2026-08-26) — état réel du module : Phases 1-3 du Strangler Fig closes
  et validées en jeu (2026-08-05), Phase 4 (dés/macros persistés) non commencée. `/r`/`/roll` restent
  une exception client, jamais migrés (§5, §6, §9 du document).
- `docs/Old/PLAN_CHAT.md` — plan archivé, origine du Command Registry (`CommandRegistry`,
  `permission: 'gm'|'player'`, contrat `i18nKey`/`params`).
- `docs/ROADMAP.md:172` — `Commande de chat MJ /healall` déjà notée en dette, jamais détaillée avant ce
  document.
- `docs/PLANS/PLAN_BLESSURES_GUERISON.md` §3.2/§3.3 — mécanique Guérison/Infection (citée, pas relue
  intégralement cette session — le comportement pertinent pour ce plan a été vérifié directement dans
  `woundEvolutionService.js`, §4 ci-dessous).
- `.claude/rules/core.md` — interdiction de réutiliser `users.role === 'admin'` comme raccourci
  d'autorisation (appliquée §4 : `/heal` reste strictement `permission: 'gm'`, aucun repli admin).

---

## 2. Vue d'ensemble

| § | Sujet | Type de changement | Statut |
|---|---|---|---|
| 3 | Fix i18n `/help` | Client uniquement (locale + un hook) | Codé, validé par Saar |
| 4 | `/heal` + `/heal all` | Serveur (nouvelle commande, nouvelle colonne, nouveau service) + 1 fix client | Codé, validé par Saar |
| 5 | Persistance `/r`/`/roll` | Serveur (écriture) + 1 point de normalisation client | Codé, validé par Saar |
| 6 | `/t [compétence] [difficulté] [@personnage]` | Serveur (nouvelle commande) + UI autocomplétion client | Codé, non testé en navigateur |

**Écarté** : un mode « invulnérabilité » MJ (`/god`) a été envisagé en cours de discussion puis
explicitement retiré par Saar avant conception détaillée — non traité dans ce document.

---

## 3. `/help` — dette i18n [CIBLE]

### Constat [VÉRIFIÉ]

`registerChatHandlers` est bien monté (`server/src/socket/index.js:280`), `useChatSocket.js` résout
bien `t(message.i18nKey, message.params)` pour toute réponse `system:true` (`useChatSocket.js:73-83`).
Mais le namespace `chat.commands.*` n'existe dans **aucun** fichier de `client/src/locales/` — `t()`
retombe sur la clé brute. Seuls 3 fichiers consomment aujourd'hui les clés `chat.*` existantes
(`placeholder`, `send`, `loadingOlder`) : uniquement `SidebarChatTab.jsx:135,138,157` (vérifié par
recherche exhaustive, aucun autre consommateur).

### Cible [CIBLE] — révisée en préparant le code (2026-09-04)

Le plan initial proposait un `chat.json` en namespace i18next séparé (patron `combat.json`). **Corrigé
avant codage** : `chatCommands.js` (serveur) émet des clés **déjà entièrement qualifiées avec le préfixe
`chat.`** (`'chat.commands.help.description'`, etc., `chatCommands.js:48,62,88...`), et `useChatSocket.js`
les résout via le `t` **par défaut** (`useTranslation()` sans namespace, comme `SidebarChatTab.jsx:28`).
i18next résout un point (`.`) comme séparateur de clé *à l'intérieur* du namespace actif, jamais comme
un renvoi implicite vers un namespace du même nom — `t('chat.commands.help.description')` cherche
`translation.chat.commands.help.description`. Créer un vrai namespace `chat` séparé casserait cette
résolution (déplacerait les clés hors de portée du `t` par défaut) sauf à aussi changer les constantes
serveur (`chatCommands.js` + son fichier de test, qui vérifie les chaînes exactes) — hors du scope
« client uniquement » de ce sujet, pour un bénéfice d'organisation marginal (~15-20 clés, largement sous
la taille des domaines qui justifient réellement leur propre fichier comme `combat.json`).

- **Aucun nouveau fichier, aucun changement de namespace.** Ajout d'un objet `commands` à l'intérieur du
  bloc `"chat": {...}` déjà existant dans `fr.json` (`fr.json:303-307`), clés strictement identiques aux
  chaînes émises par `chatCommands.js` : `commands.help.description`, `commands.whisper.description`/
  `usage`/`targetNotFound`, `commands.gm.description`/`usage`/`notFound`, plus les clés réservées par
  §4/§6 (`commands.heal.*`, `commands.t.*`).
- `placeholder`/`send`/`loadingOlder` restent inchangées en place — aucune raison de les déplacer
  puisqu'aucun namespace séparé n'est créé ; `SidebarChatTab.jsx` n'a aucun call site à modifier pour ce
  sujet.
- `help.list` rend une liste dynamique (`params.commands = [{name, descriptionKey}, ...]`) — i18next ne
  boucle pas dans une seule chaîne `t()`. **Exception documentée** au contrat générique
  `system:true + i18nKey + params → t()` : `useChatSocket.js` construit ce texte spécifiquement pour
  cette clé (intro + une ligne par commande, chaque `descriptionKey` résolu individuellement), avec un
  commentaire expliquant pourquoi. Construire une infrastructure de rendu dédiée pour ce seul cas serait
  disproportionné (une seule commande a une réponse en liste).

### Hors-scope

Namespace i18n pour les futures réponses de `/heal`/`/t` — leurs clés sont réservées dans `chat.json`
mais rédigées avec chaque sujet, pas anticipées ici.

---

## 4. `/heal` et `/heal all` [CIBLE]

### RAW / mécanique [VÉRIFIÉ]

Enclume n'a pas de « PV » à restaurer — système de Blessures (Légère/Moyenne/Grave/Critique/Mortelle)
avec Guérison résolue par échéance de temps de jeu, **à la discrétion du MJ, jamais par un jet serveur**
(`docs/VOCABULARY.md:38`, `woundEvolutionService.js`). `/heal` n'imite donc aucune règle RAW — c'est un
outil MJ de contournement (test, rattrapage), pas une mécanique de jeu.

### Ce qui existe déjà et sera réutilisé [VÉRIFIÉ]

| Brique | Fichier | Rôle réutilisé |
|---|---|---|
| Suppression unitaire d'une blessure + broadcast | `DELETE /api/char-sheet/:characterId/wounds/:woundId` (`char-sheet.js:963-984`), émet `WOUND_REMOVED` | Appelée en boucle, une transaction par personnage, plutôt qu'un nouvel événement bulk |
| Point d'entrée unique pose de blessure | `applyWound` (`woundService.js:10`) | Aucune modification nécessaire pour `/heal` (seulement pour un futur `/god`, écarté) |
| Résilience des échéances à une blessure disparue | `woundHealingCheckHandler`/`woundInfectionCheckHandler` (`woundEvolutionService.js:81-87,179-183`) | **Vérifié directement dans le code** (pas supposé) : les deux gèrent déjà `if (!wound) return { resolved: true, ... }` — supprimer en masse ne laisse aucune échéance orpheline qui planterait |
| Suppression de statut | `token_statuses` (table), pattern `statusService.js:189` | Requête bulk `where({token_id}).delete()` par token concerné |
| Relais de changement de carte | `MAP_SWITCH` (`socketBattlemap.js`), déclenché uniquement par le MJ (`useBattlemapManager.js:180`, seul point d'émission réel, toujours `userIds: []`) | Étendu pour persister l'état (voir ci-dessous) — actuellement un simple relais sans écriture DB |

### Nouveau [CIBLE]

**Colonne `campaigns.current_battlemap_id`** (nouvelle migration, numéro attribué à la création — dernière
migration réelle : `323`). Nullable, `references battlemaps(id) on delete set null`, distincte de
`default_battlemap_id` (qui reste la config « carte d'accueil », vérifié inchangée dans tous ses autres
usages : suppression de carte, dossiers, bouton "Définir comme accueil").

- `socketBattlemap.js` (handler `MAP_SWITCH`) écrit cette colonne avant de relayer, dans la même
  validation déjà en place (carte appartient à la campagne).
- `campaigns.js` : `PUT /:id` — ajouter `current_battlemap_id` à la liste `.returning([...])` (ligne
  ~279, symétrie avec `default_battlemap_id` déjà présent). `GET /:id` n'a rien à changer (`SELECT *`).
- **`SessionPage.jsx:287` corrigé dans le même geste** : `campaignData.current_battlemap_id ??
  campaignData.default_battlemap_id`. Ce n'est pas un effet de bord annexe : c'est la même colonne
  respectée partout où « quelle carte afficher » est décidé — sinon elle ne serait autoritaire qu'à
  moitié. Corrige au passage un bug latent trouvé en investiguant (un joueur qui se reconnecte après un
  changement de carte chargeait `default_battlemap_id`, potentiellement périmé).

**[OUVERT — non bloquant, noté pour mémoire]** : `MAP_SWITCH` accepte un paramètre `userIds` (déplacer
une partie du groupe seulement — scission de groupe). Vérifié : aucune UI ne le peuple aujourd'hui (seul
point d'émission réel toujours `userIds: []`). `current_battlemap_id` modélise donc « la carte actuelle
de la campagne » comme un concept singulier, correct en pratique. Si `userIds` est un jour exploité
(scission réelle du groupe), ce modèle à une seule colonne devra être revu — décision explicitement
différée, pas ignorée en silence.

**Service `server/src/lib/woundService.js`** — nouvelle fonction (nom à trancher en codant, ex.
`clearCharacterWoundsAndStatuses(io, db, campaignId, characterId)`) :
1. Récupère tous les `token_id` du personnage sur le périmètre concerné.
2. Transaction : supprime toutes les lignes `character_wounds` du `char_sheet_id`, toutes les lignes
   `token_statuses` des tokens trouvés.
3. Émet `WOUND_REMOVED` par blessure supprimée (réutilise le format existant) + `TOKEN_STATUS_UPDATED`
   par token (réutilise `emitTokenStatusUpdated`).
4. **Une transaction par personnage**, pas une transaction globale pour tout le groupe — un échec sur un
   personnage n'annule pas ce qui a réussi sur les autres ; la commande reste ré-exécutable sans risque.

**`chatCommands.js`** — nouvelle commande :
```js
chatCommandRegistry.register({
  name: 'heal',
  descriptionKey: 'chat.commands.heal.description',
  permission: 'gm',   // strictement — jamais de repli sur users.role==='admin' (core.md)
  async execute(context, args) {
    const scope = args[0]?.toLowerCase() === 'all' ? 'campaign' : 'map'
    // scope==='map'  → tokens.where({ battlemap_id: context.currentBattlemapId ?? context.defaultBattlemapId })
    // scope==='campaign' → characters.where({ campaign_id: context.campaignId })
    // Portée : TOUT personnage avec une fiche — PJ + PNJ + exo + drone (décision Saar 2026-09-04,
    // tranchée après question explicite : le MJ peut vouloir soigner un PNJ en cours de test comme un PJ)
  },
})
```

**Trace visible** : tranchée par Saar (2026-09-04) — message système dans le chat, visible de tous, pas
une confirmation privée au MJ.

- Nouveau `type: 'SYSTEM'`, générique et réutilisable par toute future annonce système publique (pas
  spécifique à `/heal`) : `payload: { i18nKey: 'chat.commands.heal.done', params: { count } }`,
  `senderUserId: null`. **[VÉRIFIÉ]** aucune contrainte `CHECK` en base sur `chat_messages.type`
  (`126_chat_messages_constraints.js` — seuls index/PK, colonne `TEXT` libre) : introduire ce type ne
  nécessite aucune migration.
- **[VÉRIFIÉ]** le mécanisme d'attribution est déjà compatible sans toucher `socketChat.js` :
  `sendMessage({ campaignId, senderUserId: user.id, ...result.send })` (`socketChat.js:70`) — le spread
  de `result.send` vient *après* `senderUserId: user.id` dans le literal, donc un `senderUserId: null`
  porté par le `send` retourné par `/heal` écrase bien la valeur par défaut. Rien à modifier côté
  dispatch générique.
- Rendu : `MessageRendererRegistry.jsx` gagne un cas `SYSTEM` qui résout `payload.i18nKey`/`payload.params`
  via `t()` au moment du rendu (pas au moment de la réception, contrairement au patron
  `system:true`/réponse privée éphémère de §3 qui résout une fois à la réception) — cohérent avec le
  fait qu'un message persisté peut être rendu plusieurs fois (historique, scroll infini) sans dépendre
  d'un état de résolution figé.

### Hors-scope

Ciblage nominatif (`/heal CharacterX`) évoqué en tout début de discussion — abandonné au profit de
`/heal` (carte) / `/heal all` (campagne), plus utile pour l'usage MJ/test décrit.

---

## 5. Persistance de `/r` / `/roll` [CIBLE]

### Constat [VÉRIFIÉ]

`DICE_ROLL` (`socketDice.js:45-105`) diffuse déjà en direct à toute la room (`io.to(campaignId).emit`,
ligne 98) — le broadcast temps réel fonctionne. Ce qui manque, confirmé par `docs/SYSTEME/CHAT.md`
(§1/§5/§6/§9, audité 2026-08-26) : la **persistance**. Un jet n'est jamais écrit dans `chat_messages` —
invisible en historique paginé, perdu à la reconnexion — dette assumée explicitement (Phase 4, « non
commencée »).

### Piège trouvé en vérifiant le rendu réel — pas anticipé au départ [VÉRIFIÉ]

Le message `dice` **live** (`useSessionSocket.js:onDiceResult`, lignes 64-75) est un objet **plat**
(`{ id, type:'dice', user, color, formula, rolls, total, ... }`), construit champ par champ. Le message
**persisté** (`chatService.toClientMessage`) produit `{ id, type, payload:{...}, author:{...}, ... }` —
les données du jet seraient sous `payload`, pas à la racine. `MessageRendererRegistry.jsx:renderDice`
n'a jamais vu que la forme plate. Sans adaptation, un jet rechargé depuis l'historique afficherait des
champs `undefined`. **Deuxième piège lié** : le registre de rendu indexe `dice` en minuscule
(`MessageRendererRegistry.jsx:432`), alors que la convention DB/API pour un type persisté est en
majuscule (`'TEXT'`, `'WHISPER'`).

**Deuxième piège, validation** : `chatValidation.js:11` — `USER_SUBMITTABLE_TYPES = new Set(['TEXT',
'WHISPER'])`. Persister avec `senderUserId: user.id` (attribution normale) ferait passer le message par
`validateMessagePayload`, qui **rejette `type:'DICE'` à chaque appel** (400, silencieusement avalé par le
`catch` de `DICE_ROLL`) — la persistance échouerait systématiquement.

### Cible [CIBLE]

- Persister avec **`senderUserId: null`** (patron « Message Builder », déjà prévu par
  `chatValidation.js:6-9` : « les types produits par les Message Builders (DICE…) sont des messages
  système à payload structuré, pas de la saisie utilisateur ») — bypass volontaire de
  validation/sanitization/rate-limit, cohérent avec l'intention déjà écrite dans ce fichier.
  `username`/`color`/`userId` portés directement dans `payload` (même forme que le `DICE_RESULT` live),
  pas résolus via `buildAuthorInfo` (qui exige un `senderUserId` non-null).
- **Uniquement la branche non-secrète.** Un jet secret (`secret:true`) ne touche aujourd'hui que le
  lanceur et le(s) GM (`socketDice.js:89-96`) — le persister sur le canal `general` le rendrait visible
  de tous via `GET /chat/messages`, alors qu'il ne l'est jamais en direct. Le persistance modèle actuel
  (`recipient_user_id` singulier) ne supporte pas nativement un « whisper à plusieurs destinataires »
  (lanceur + N GM) sans changement de schéma hors scope de ce fix — **le secret reste éphémère, exactement
  comme aujourd'hui.**
- **Point de normalisation, revu en préparant le code (2026-09-04)** : le plan initial prévoyait
  d'aplatir `payload.*` « historique ou temps réel » dans `onCreated`. **Corrigé** — `chatService.
  sendMessage` (`chatService.js:48-80`) ne diffuse rien elle-même ; c'est l'appelant qui décide d'un
  éventuel `broadcastMessageCreated`. Si `/r` appelait les deux (persistance + broadcast
  `CHAT_MESSAGE_CREATED`), un jet apparaîtrait **deux fois** dans le flux d'un client déjà connecté : une
  fois via le `DICE_RESULT` live existant (`onDiceResult`, id `dice-${userId}-${timestamp}`), une fois
  via `onCreated` (id numérique de la ligne DB) — deux ids différents, la dédup par id de
  `sessionStore.addMessage` ne les fusionnerait pas.
  **Décision** : `/r` appelle uniquement `sendMessage` (persistance), **jamais**
  `broadcastMessageCreated` — le `DICE_RESULT` live existant reste l'unique canal temps réel, inchangé.
  La persistance ne sert que l'historique (rechargement, scroll infini, reconnexion), conformément au
  besoin identifié (§ Constat). Conséquence : la normalisation `payload.*` → racine + `type:'DICE'` →
  `'dice'` n'a plus sa place dans `onCreated` (jamais atteint pour un jet) mais dans les **deux** points
  de lecture d'historique de `useChatSocket.js` (chargement initial + `loadOlderMessages`) — un helper
  `normalizeMessage(msg)` partagé par les deux plutôt que dupliqué.
  **Troisième champ à renommer, trouvé en vérifiant `renderDice` intégralement** : la forme live utilise
  `msg.user` (`MessageRendererRegistry.jsx:247,273,312,361`, plusieurs branches), alors que le payload
  serveur de `DICE_ROLL` porte `username` (`socketDice.js:73`) — la normalisation doit renommer
  `username` → `user`, pas seulement aplatir.

### Hors-scope

`MACRO_ROLL` — structurellement dans le même cas (éphémère, `docs/SYSTEME/CHAT.md` §5), non demandé par
Saar, non traité ici. Noté comme dette sœur pour référence future, pas oublié.

---

## 6. `/t [compétence] [difficulté] [@personnage]` [CODÉ — non testé en navigateur]

### Mécanique [VÉRIFIÉ]

Décision Saar : jet **immédiat, sans validation MJ** — écarte explicitement
`resolveGmArbitratedTestService.js` (flux d'approbation utilisé par `ENTITY_ACTION_RESOLVE` et
équivalents). Utilise `resolvePolarisTest` (`polarisTestService.js:18`, brique pure : 1d20 + seuil,
retest automatique sur échec critique). Structurellement quasi identique au handler `MACRO_ROLL`
existant (`socketDice.js:139-229` : calcul seuil compétence/attribut + malus actifs ; lignes 283-288 :
vérification Catastrophe via `maybeTriggerCatastrophe`, garde combat actif).

### Cible [CIBLE], codé en `server/src/lib/characterTestContext.js` + `server/src/lib/skillTestService.js`

- **Extraction** du calcul « seuil compétence/attribut pour un personnage » (`socketDice.js:139-229`)
  dans `characterTestContext.js:loadCharacterTestContext` (nommé ainsi en codant, pas
  `skillTestContext.js`), réutilisé par `MACRO_ROLL` (inchangé dans son comportement — mêmes requêtes,
  même ordre, vérifié champ par champ) et par `/t` (`skillTestService.js:resolveSkillTestCommand`) —
  pas de duplication d'un second moteur de calcul de seuil.
- **Catastrophe automatique obligatoire** : `/t` doit appeler `maybeTriggerCatastrophe` sous la même
  garde combat actif que `MACRO_ROLL` (7ᵉ site RAW) — confirmé explicitement par Saar (« un test déclenché
  via cette commande doit pouvoir déclencher une Catastrophe »). Omission = écart RAW silencieux, à ne
  pas laisser passer.
- **Résolution du personnage cible** : `characters.where({ user_id: user.id, campaign_id })`.
  - 1 résultat → cible normale.
  - 0 résultat → erreur i18n (cas réel : spectateur, MJ sans PJ propre).
  - 2+ résultats → erreur i18n invitant à préciser (cas vérifié comme techniquement possible mais
    n'arrivant jamais en pratique, Saar 2026-09-04) — pas de choix arbitraire silencieux.
  - Fallback **`@<personnage>`** en premier argument (ex. `/t @Jean Discrétion -2`) : recherche
    **exclusivement parmi les personnages du joueur qui tape la commande**, jamais parmi ceux des
    autres joueurs (sinon brèche : forcer un test sur le personnage de quelqu'un d'autre).
- **Matching de compétence : exact, pas flou — élargi en codant.** Correspondance insensible
  casse/accents contre **tout le référentiel `ref_skills`**, pas seulement les compétences apprises du
  personnage : cohérent avec `MACRO_ROLL`, qui ne valide jamais qu'une source référence une compétence
  effectivement connue (`calcSkillTotal` dégrade proprement avec `charSkill` absent — vérifié). Pas de
  préfixe/flou pouvant matcher deux compétences à la fois. L'autocomplétion client garantit déjà qu'un
  usage normal tape un nom réel ; le serveur reste strict.
  **Piège trouvé en codant, corrigé avant tout test** : `ref_skills` n'a pas de colonne `name` (vérifié
  contre le schéma réel et `refI18n.js:27`) — le champ d'affichage est `label`. Un premier jet du code
  utilisait `.name` partout (matching serveur *et* autocomplétion client), ce qui aurait fait planter
  `/t` à chaque appel (`undefined.normalize is not a function`) plutôt que de simplement mal fonctionner
  — corrigé aux deux endroits avant tout test navigateur.
- **Parsing des arguments** : dernier token matchant `^[+-]?\d+$` = modificateur de Seuil signé optionnel
  (convention RAW confirmée, `socketEntity.js:322-323` : positif = bonus, négatif = malus, ajouté
  directement au Seuil — pas une DC classique) ; tout le reste (hors préfixe `@...`) joint = nom de
  compétence.
- **Autocomplétion** (`SidebarChatTab.jsx`) : dès que l'input commence par `/t `, liste déroulante
  filtrée sur les compétences du personnage du joueur (chargées une fois au montage, pas de round-trip
  par frappe). Aucun composant d'autocomplétion existant dans le projet (vérifié) — nouveau composant
  minimal, pas de réutilisation possible.

### Non-problèmes vérifiés

- Un MJ tapant `/t` n'a typiquement aucun personnage à son `user_id` (0 résultat → erreur) — cohérent
  avec le fait que `/t` est un outil de test rapide pour joueur ; le MJ dispose déjà de
  `MACRO_ROLL`/du flux arbitré pour ses PNJ.
- Un exo/drone n'a pas besoin d'un filtre de type explicite pour être exclu de `/t` : `characters.
  where({user_id, campaign_id})` ne le retourne déjà jamais, puisqu'un exo/drone est piloté via
  `exo_sheet.pilot_character_id`, pas possédé par `characters.user_id` — vérifié dans
  `combatantContextService.js` avant de coder plutôt que supposé.

### Contrat `chatCommandRegistry` étendu en codant

`/t` réussi ne produit ni `reply` ni `send` (le jet a déjà broadcasté `DICE_RESULT` lui-même dans
`resolveSkillTestCommand`) — un cas que le contrat `execute()` ne prévoyait pas (`docs/Old/PLAN_CHAT.md`
§5.6 ne connaissait que réponse privée ou message à envoyer). Sans extension, `socketChat.js` aurait
appelé `sendMessage({...result.send})` avec `result.send` `undefined`, rejeté par
`validateMessagePayload` (type/payload absents) → un `CHAT_ERROR` parasite envoyé au joueur malgré un
jet réussi. Ajout d'un troisième cas `{ handled: true }` (effet déjà entièrement produit par une closure
du context), géré par une garde explicite dans `socketChat.js` avant l'appel à `sendMessage`.

### Hors-scope

Ciblage d'un personnage tiers (autre joueur, PNJ) — jamais permis par cette commande, quelle que soit la
syntaxe.

---

## 7. Corrections trouvées en analyse à charge (résumé, pour traçabilité)

- **§6, trouvé en test navigateur par Saar (2026-09-05)** : le premier jet de code envoyait un
  `DICE_RESULT` de forme « jet brut » (`formula: "1d20 (Compétence — Perso)"`, sans `skillLabel`) —
  improvisé au lieu de vérifier comment le projet affiche déjà un Test compétence-vs-Seuil. Deux
  symptômes, une seule cause : (1) aucun Seuil ni badge Réussite/Échec affiché — la branche de rendu
  `skillLabel !== undefined` (`MessageRendererRegistry.jsx:renderDice`) n'était jamais atteinte ; (2)
  animation 3D d'un d6 au lieu d'un d20 — `useSessionSocket.js:onDiceResult` n'anime un dé que si
  `skillLabel` est absent, et la formule décorée ne se réduisait pas proprement à `"d20"` pour
  l'extraction de type de dé, d'où le repli sur d6. Corrigé en reprenant **à l'identique** la forme de
  `gmArbitratedTestService.js` (même mécanique RAW : Test compétence vs Seuil, déjà résolue ailleurs
  dans le projet pour les actions d'entité/connecteur) — `skillLabel`, `mechanicalTotal`,
  `chancesDeReussite`, `diffLabel`, `mr`, `breakdown` désormais tous fournis. Confirme au passage un
  fait déjà vrai dans tout le projet, pas propre à `/t` : **aucun Test de compétence n'anime de dé 3D**,
  seul un jet brut (`/r`) le fait — ce n'est donc pas une régression à corriger côté animation, la bonne
  forme de payload suffit.
- **§5** : persistance `/r` avec `senderUserId: user.id` aurait échoué systématiquement
  (`chatValidation.js`) — corrigé en `senderUserId: null` + payload auto-porté.
- **§5** : jets secrets auraient fui sur le canal public si persistés sans distinction — exclus du scope.
- **§5** : forme de rendu `dice` live vs persistée incompatible sans normalisation — point de
  normalisation unique ajouté dans `useChatSocket.js`.
- **§4** : suppression en masse des blessures aurait pu laisser des échéances orphelines en erreur —
  vérifié directement dans le code (`woundEvolutionService.js`) que ce n'est pas le cas.
- **§4** : un `character_id` peut avoir plusieurs `tokens` (`229_character_states.js:5`) — la requête de
  nettoyage des statuts doit couvrir tous les tokens du personnage, pas un seul.
- **§4** : `current_battlemap_id` n'aurait servi qu'à moitié sans corriger aussi
  `SessionPage.jsx:287` — inclus dans le même lot plutôt que différé.
- **§6** : `/t` sans déclenchement de Catastrophe aurait été un écart RAW silencieux — rendu obligatoire
  explicitement.
- **§6** : `ref_skills` n'a pas de colonne `name` (c'est `label`) — un premier jet aurait fait planter
  `/t` à chaque appel, pas seulement mal fonctionner. Corrigé serveur + client avant tout test.
- **§6** : `/t` réussi ne rentre dans aucun des deux cas prévus par le contrat `execute()` d'origine
  (ni `reply` ni `send`) — aurait produit un `CHAT_ERROR` parasite malgré un jet réussi. Contrat étendu
  avec `{ handled: true }`.

---

## 8. État — tous les sujets codés

§3, §4, §5, §6 sont tous codés (voir statut en tête de chaque section). Aucun point bloquant restant.
Reste à valider en navigateur (Saar) avant de pousser.

---

## 9. Ordre d'implémentation

§3 (`/help`, aucune dépendance) → §4 (`/heal`) → §5 (persistance `/r`) → §6 (`/t`, dépend indirectement
de rien mais le plus gros morceau). Un seul sujet codé à la fois, diff présenté avant tout commit,
validation fonctionnelle de Saar avant de passer au suivant (contrat `AGENTS.md`).
