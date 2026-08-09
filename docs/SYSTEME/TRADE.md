# SYSTEME/TRADE.md — Marchands et Échange

> Responsabilité unique : le domaine transactionnel entre personnages et avec le MJ — catalogue
> marchand + achat, échange PJ↔PJ, revente PJ→GM, transfert direct (ex. recharge de drone).
> Autorité de la fiche personnage, de l'inventaire (`char_inventory`) et du solde `sols` :
> `docs/SYSTEME/CHARACTER.md` — ce document ne redéfinit pas ces structures, il documente
> uniquement ce qui les fait bouger dans un contexte commercial.
> Vocabulaire : `docs/VOCABULARY.md` (« Marchand », « Échange (PJ↔PJ) », « Revente (PJ→GM) »).

---

## 1. Vue d'ensemble

Un seul service serveur (`tradeService.js`) et une seule table d'offres (`trade_offers`) portent
quatre flux distincts :

| Flux | Déclencheur | Validation | Table d'offre |
|---|---|---|---|
| **Achat marchand** | PJ sélectionne un catalogue, ajoute au panier | Immédiate (REST, transaction atomique) | aucune — pas d'offre, exécution directe |
| **Échange PJ↔PJ** | PJ A propose un transfert à PJ B (ou à un drone qu'il possède) | Double validation (B accepte/refuse), sauf transfert direct vers son propre drone | `trade_offers` type `EXCHANGE` |
| **Revente PJ→GM** | PJ propose de vendre des objets à un marchand | Le GM accepte, refuse ou fait une contre-offre ; le PJ peut accepter/refuser la contre-offre | `trade_offers` type `SELL` |
| **Transfert direct (drone)** | PJ propriétaire recharge son propre drone | Aucune (même propriétaire des deux côtés) — transfert immédiat, sans offre ni TTL | aucune |

Un ancien service concurrent (`echangeService.js`, Lot A0) a existé en parallèle puis a été retiré
en session 153 : jamais branché à une UI, aucune trace vivante. `tradeService.js` est la seule
autorité depuis.

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              SIDE SERVEUR                                  │
│                                                                             │
│  server/src/services/tradeService.js                                     │
│    getMerchants / upsertMerchant / deleteMerchant                        │
│    getCatalog (filtre marchand) / buyFromMerchant (transaction atomique) │
│    acceptTransfer (échange PJ↔PJ, transaction atomique)                  │
│    executeSell (revente PJ→GM, transaction atomique)                     │
│    getMyActiveSellOffer / getTradeLog                                    │
│                                                                             │
│  server/src/socket/socketTrade.js                                        │
│    Tous les handlers WS temps réel (offres, acceptation, contre-offre,   │
│    transfert drone) — délègue l'exécution transactionnelle au service    │
│    ci-dessus, ne fait lui-même que routage + résolution de socket cible  │
│                                                                             │
│  server/src/routes/tradeRoutes.js                                        │
│    merchantsRouter  → /api/campaigns/:campaignId/merchants (CRUD, achat) │
│    tradeLogRouter   → /api/campaigns/:campaignId/trade-log (lecture GM)  │
└───────────────────────────────────────────────────────────────────────────┘
                              │
              REST (catalogue, achat, CRUD marchand, journal)
                              +
              WebSocket (offres temps réel, notifications)
                              │
┌───────────────────────────────────────────────────────────────────────────┐
│                               SIDE CLIENT                                  │
│                                                                             │
│  pages/MerchantsPage.jsx                                                  │
│    Dashboard GM plein écran — CRUD marchand, arbre de règles catalogue   │
│    (FAM→CAT→ITEM), gestion des PJ autorisés. Route dédiée, hors session. │
│                                                                             │
│  components/TradeWindow.jsx                                               │
│    Fenêtre flottante in-session (GM lite + vue joueur) — onglets         │
│    Marchands/Journal/Reventes (GM), Catalogue/Vente (joueur)             │
│                                                                             │
│  components/ExchangeWindow.jsx                                            │
│    Fenêtre flottante dédiée à l'échange PJ↔PJ (et transfert drone),      │
│    ouverte depuis TokenRadialMenu ou une notification chat               │
│                                                                             │
│  components/TokenRadialMenu.jsx    secteur "echange" → ouvre ExchangeWindow│
│  components/MessageRendererRegistry.jsx  renderSellRequest/renderExchangeOffer│
│  lib/useEntitySocket.js            notifications chat (sell_request, exchange_offer)│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Base de données

### `merchants` (migration 84)

| Colonne | Type | Rôle |
|---|---|---|
| `campaign_id` | UUID | Scope campagne |
| `name` | TEXT | Nom affiché |
| `status` | TEXT `OPEN`\|`CLOSED` | `CLOSED` = invisible et inaccessible aux PJ (le GM voit toujours tout) |
| `mod_global` | INT | Modificateur de prix en % appliqué à tout le catalogue |
| `nt_max` / `niv_max` / `gen_max` | INT | Seuils globaux (NT, niveau max, génération) — un objet qui dépasse est invisible sauf règle locale `INCLUDE` |
| `dispo_min` | INT nullable | Rareté minimale requise (`ref_equipment.rarity` casté en entier) |
| `rules` | JSONB `[]` | Filtres en cascade FAM → CAT → ITEM, voir §4 |
| `allowed_char_ids` | TEXT[] | Liste blanche de personnages ; tableau vide = tous les PJ de la campagne autorisés |

### `trade_offers` (migration 86, étendue 88/90)

| Colonne | Type | Rôle |
|---|---|---|
| `type` | TEXT `EXCHANGE`\|`SELL` | Distingue échange PJ↔PJ et revente PJ→GM (même table, migration 88) |
| `from_char_id` | UUID | Toujours renseigné |
| `to_char_id` | UUID nullable | `NULL` pour une revente (`SELL`, destinataire = le GM implicitement) |
| `merchant_id` | UUID nullable | Marchand concerné par une revente (migration 90), `NULL` pour un échange |
| `status` | TEXT | `PENDING` → `COUNTER_OFFERED` (SELL uniquement) → `ACCEPTED`\|`DECLINED`\|`CANCELLED` |
| `items_json` | JSONB `[]` | Snapshot des objets proposés (`char_inventory_id`, nom, quantité, prix) |
| `sols_offer` | INT | Sols proposés (échange) ou prix demandé (revente) |
| `counter_sols` | INT nullable | Prix contre-offert par le GM (migration 90, `SELL` uniquement) |
| `expires_at` | TIMESTAMPTZ | Voir §6 — TTL fixe, pas lié à l'horloge de campagne malgré le commentaire de la migration 86 |

**[OBSERVÉ]** Le commentaire de la migration 86 (`expires_at = NOW() + campaigns.tour_duration`)
décrit une intention non implémentée : le code (`socketTrade.js`, `SELL_OFFER_TTL_SEC = 120`) fixe
un TTL constant de 120 secondes pour les deux types d'offre, sans lien avec `campaigns.tour_duration`.

### `trade_log` (migration 85, étendue 89/91)

Livre de compte en lecture seule (GM), une ligne par transaction exécutée.

| `type` | Émis par |
|---|---|
| `merchant_buy` | `buyFromMerchant` |
| `player_transfer` | `acceptTransfer` (échange PJ↔PJ) |
| `player_sell` | `executeSell` (revente PJ→GM, migration 89) |
| `drone_reload` | Handler `TRADE_DRONE_TRANSFER` (migration 91) |
| `gm_grant` | Réservé en base (contrainte CHECK), aucun code n'insère ce type actuellement |

Contrainte CHECK explicite sur `type` (pas d'enum applicatif séparé) — chaque ajout de type a
nécessité une migration dédiée (89, 91) pour l'étendre.

---

## 4. Catalogue marchand — évaluation des règles

`getCatalog` (et sa réplique interne dans `buyFromMerchant`, même logique, pas de duplication de
règle métier mais duplication de code à connaître si l'un des deux évolue) :

1. **Seuils globaux** (`passesGlobalThresholds`) : NT, niveau max, génération, rareté minimale du
   marchand. Un objet qui échoue est invisible par défaut.
2. **Cascade de règles** (`evaluateItem`) : la règle la plus spécifique gagne — `ITEM` > `CAT` >
   `FAM`. Une règle `INCLUDE` rend visible malgré l'échec aux seuils globaux ; `EXCLUDE` masque
   malgré la réussite ; `PARAM` applique un modificateur de prix local (`mod_pct`) et/ou des seuils
   locaux (`passesLocalThresholds`) sans changer la visibilité par elle-même.
3. **Prix final** = `ref_equipment.price × (1 + (mod_global + modPct_local) / 100)`, arrondi.

Le PJ ne voit que le catalogue d'un marchand `OPEN` auquel il est autorisé
(`allowed_char_ids` vide = tous ; sinon son `char_id` doit y figurer). Le GM voit tout, y compris un
marchand `CLOSED`.

---

## 5. Flux — Achat marchand

REST uniquement, transaction atomique (`buyFromMerchant`) :

1. Lock `merchants` (`forUpdate`) — vérifie `status = OPEN`.
2. Recalcule les prix catalogue pour les items demandés (ne fait jamais confiance au prix envoyé
   par le client).
3. Lock `char_sheet` (`forUpdate`) — vérifie `sols >= total`.
4. Débite `sols`.
5. Insère dans `char_inventory` :  **un objet équipable acheté en quantité N devient N lignes**
   distinctes (`quantity: 1` chacune, un exemplaire = un objet équipable indépendant) ; un objet non
   équipable reste **une seule ligne** `quantity: N`. Autorité de la distinction équipable/non :
   `isEquippableLocation` (`server/src/lib/inventoryRules.js`).
6. Insère une ligne `trade_log` (`type: merchant_buy`).

Aucun événement WebSocket n'est émis à l'issue de cette route REST — voir §8 (pas de diffusion
`SOLS_UPDATED`/inventaire).

---

## 6. Flux — Échange PJ↔PJ

Séquence WS complète (`socketTrade.js` + `tradeService.acceptTransfer`) :

| Émetteur | Événement | Effet |
|---|---|---|
| PJ A | `TRADE_TRANSFER_OFFER` | Insère `trade_offers` (`EXCHANGE`), `expires_at = now + 120s`. Notifie PJ B via `TRADE_OFFER_RECEIVED` (recherche du socket par `char_id → user_id`, ou socket GM si le personnage cible n'a pas de `user_id`, ex. PNJ). |
| PJ B | `TRADE_TRANSFER_ACCEPTED` | `acceptTransfer` : transaction atomique — vérifie l'offre `PENDING` non expirée, lock `char_sheet` de A (solde suffisant), lock chaque ligne `char_inventory` proposée, déplace sols et items (mutation `character_id`), **vide `char_inventory_slots`** pour chaque item transféré (un transfert de propriété déséquipe toujours l'item côté destinataire), clôture l'offre `ACCEPTED`, insère `trade_log` (`player_transfer`). Diffuse `TRADE_OFFER_ACCEPTED` aux deux sockets + `TRADE_LOG_UPDATED` au GM. |
| PJ B | `TRADE_TRANSFER_DECLINED` | Statut `DECLINED`, notifie A. |
| PJ A | `TRADE_TRANSFER_CANCELLED` | Annule une offre encore `PENDING`, notifie B. |

**Rate limit** : `TRADE_TRANSFER_OFFER` et `TRADE_SELL_PROPOSED` partagent un même limiteur mémoire
(3 offres / 60s / utilisateur, `RateLimiterMemory`) — pas de persistance du compteur entre
redémarrages serveur.

**MJ agissant au nom d'un personnage** : côté proposant seulement, un socket `role === 'gm'` peut
émettre `TRADE_TRANSFER_OFFER` pour n'importe quel personnage de la campagne (test/orchestration,
décision Saar 2026-07-16). Le destinataire garde toujours l'obligation d'accepter lui-même — cette
relaxation ne couvre jamais le côté acceptant.

### Transfert direct (recharge de drone)

`TRADE_DRONE_TRANSFER` — un PJ transfère des items vers un personnage `type: 'drone'` dont il est
le seul `user_id` propriétaire (des deux côtés). Aucune offre, aucun TTL, aucune double validation :
transaction immédiate qui déplace les lignes `char_inventory` et vide leurs `char_inventory_slots`,
avec une ligne `trade_log` (`type: drone_reload`).

---

## 7. Flux — Revente PJ→GM (avec contre-offre)

```
PJ                              Serveur                            GM
│  TRADE_SELL_PROPOSED  ──────▶ │ insert trade_offers(SELL,        │
│                                │ PENDING) + enrichit items        │
│                                │ (ref_price, catalog_price)   ──▶ │ TRADE_SELL_REQUEST
│                                │                                  │ (+ notif chat sell_request)
│                                │                              ◀── │ TRADE_SELL_ACCEPTED (solsFinal)
│  ◀── TRADE_SELL_RESULT         │ executeSell (transaction) : ──── │
│      {accepted:true, sols}     │ supprime les items du vendeur,  │
│                                │ crédite solsFinal, ACCEPTED,     │
│                                │ trade_log(player_sell)          │
│                                │                              ◀── │ … ou TRADE_SELL_COUNTER
│  ◀── TRADE_SELL_COUNTER_RECEIVED│ status → COUNTER_OFFERED,      │ (counterSols)
│      {counterSols}             │ counter_sols en DB               │
│  TRADE_SELL_COUNTER_ACCEPTED ─▶│ relit counter_sols en DB (ne    │
│  (ou _DECLINED)                │ fait jamais confiance au client) │
│                                │ → executeSell / DECLINED         │
```

Une offre `SELL` en attente ou contre-offerte survit à un rechargement de page : au montage,
`TradeWindow.jsx` (vue joueur) appelle `GET /merchants/my-sell-offer?charId=` pour restaurer l'état
exact (`PENDING` ou `COUNTER_OFFERED`) depuis la DB.

---

## 8. Autorité sols/inventaire — absence de diffusion depuis Trade

**[OBSERVÉ]** Aucun des trois flux transactionnels (achat, échange, revente) n'émet
`SOLS_UPDATED` ni d'équivalent inventaire vers la room de campagne. Le solde `sols` et
`char_inventory` restent autoritaires côté serveur (transactions avec `forUpdate`), mais leur mise à
jour n'est visible en temps réel que pour les clients directement notifiés par les événements
`TRADE_*` de la transaction (qui rappellent `loadInventory()` localement après coup). Un tiers
(ex. un autre joueur consultant la fiche de A pendant que A achète) ne verra le nouveau solde qu'au
prochain chargement de sa propre vue. Autorité de `SOLS_UPDATED` et de la route `PUT
/:characterId/sols` : `docs/SYSTEME/CHARACTER.md`.

---

## 9. Événements WebSocket (`shared/events.js`)

| Événement | Sens | Rôle |
|---|---|---|
| `TRADE_TRANSFER_OFFER` | PJ → serveur | Proposer un échange |
| `TRADE_TRANSFER_ACCEPTED` / `_DECLINED` / `_CANCELLED` | PJ → serveur | Résoudre une offre d'échange |
| `TRADE_OFFER_RECEIVED` / `_ACCEPTED` / `_DECLINED` / `_CANCELLED` / `_EXPIRED` | serveur → PJ concernés | Notifications échange |
| `TRADE_SELL_PROPOSED` | PJ → serveur | Proposer une revente |
| `TRADE_SELL_REQUEST` | serveur → socket GM | Nouvelle demande de revente |
| `TRADE_SELL_ACCEPTED` / `_DECLINED` / `_COUNTER` | GM → serveur | Résoudre une revente |
| `TRADE_SELL_COUNTER_RECEIVED` | serveur → PJ | Contre-offre reçue |
| `TRADE_SELL_COUNTER_ACCEPTED` / `_DECLINED` | PJ → serveur | Résoudre une contre-offre |
| `TRADE_SELL_RESULT` | serveur → PJ | Résultat final de la revente |
| `TRADE_DRONE_TRANSFER` | PJ → serveur | Transfert direct vers son drone |
| `TRADE_DRONE_TRANSFERRED` | — | Défini mais non utilisé (ACK du callback suffit en v1) |
| `TRADE_MERCHANT_UPDATED` | serveur → room | Défini ; non trouvé émis dans `socketTrade.js` actuel — mise à jour marchand propagée par re-fetch REST côté client, pas par cet événement |
| `TRADE_LOG_UPDATED` | serveur → socket GM uniquement | Nouvelle ligne au journal |
| `TRADE_ERROR` | serveur → émetteur | Erreur métier (`OFFER_NOT_FOUND`, `OFFER_EXPIRED`, `INSUFFICIENT_FUNDS`, `ITEM_UNAVAILABLE`, `RATE_LIMITED`, `SERVER_ERROR`…) |

---

## 10. Notifications chat

`useEntitySocket.js` écoute `TRADE_SELL_REQUEST` et `TRADE_OFFER_RECEIVED` en permanence (pas
seulement fenêtre ouverte) et pousse un message éphémère dans le flux du Sidebar
(`type: sell_request` / `exchange_offer`, jamais persisté — famille des types "non migrés" de
`docs/SYSTEME/CHAT.md` §5). `MessageRendererRegistry.jsx` rend un bouton d'action qui ouvre la
fenêtre concernée avec le contexte pré-rempli (`onOpenTrade({ mode: 'reventes' })` /
`onOpenExchange({ incomingOffer })`).

---

## 11. Points d'entrée UI

| Entrée | Composant | Portée |
|---|---|---|
| Dashboard GM → bouton "Marchands" | `MerchantsPage.jsx` (route `/campaigns/:id/merchants`) | CRUD marchand complet, arbre de règles catalogue, liste des PJ autorisés — hors session, plein écran |
| Radial menu sur un token (clic droit) | `TokenRadialMenu.jsx` secteur `echange` | Ouvre `ExchangeWindow` ciblée sur ce personnage |
| Notification chat (revente / offre reçue) | `MessageRendererRegistry.jsx` | Ouvre `TradeWindow` (onglet Reventes) ou `ExchangeWindow` avec contexte pré-rempli |
| Fenêtre in-session (GM) | `TradeWindow.jsx` | Vue lite : toggle statut/mod_global rapide, journal, file de reventes — pas de gestion de règles catalogue (réservée à `MerchantsPage`) |
| Fenêtre in-session (joueur) | `TradeWindow.jsx` (onglets Catalogue/Vente) | Achat et proposition de revente |

`ExchangeWindow.jsx` : le MJ incarne un **PNJ** via un sélecteur "Agir en tant que"
(`gmActingAsId`, filtré aux personnages `type === 'pnj'`), jamais un PJ — la cible reste toujours un
PJ (ou le drone d'un PJ). Cette contrainte est purement côté client (le serveur, dans
`socketTrade.js`, n'a jamais imposé de type sur `fromCharId`) ; `effectiveCharId = isGm ?
gmActingAsId : myCharId` est l'autorité unique d'identité agissante dans ce composant.

---

## 12. Fichiers impliqués

Serveur (3)
| Fichier | Rôle |
|---|---|
| `server/src/services/tradeService.js` | Logique métier + transactions atomiques |
| `server/src/socket/socketTrade.js` | Handlers WS temps réel |
| `server/src/routes/tradeRoutes.js` | REST marchands + journal |

Migrations (6)
| Fichier | Rôle |
|---|---|
| `84_merchants.js` | Table `merchants` |
| `85_trade_log.js` | Table `trade_log` |
| `86_trade_offers.js` | Table `trade_offers` (échange PJ↔PJ) |
| `88_trade_offers_sell.js` | Ajoute `type` (EXCHANGE/SELL), `to_char_id` nullable |
| `89_trade_log_sell.js` | Ajoute `player_sell` au CHECK de `trade_log.type` |
| `90_trade_offers_counter.js` | Ajoute `COUNTER_OFFERED`, `counter_sols`, `merchant_id` |

Client (5)
| Fichier | Rôle |
|---|---|
| `pages/MerchantsPage.jsx` | Admin GM plein écran |
| `components/TradeWindow.jsx` | Fenêtre in-session GM lite + joueur (marchands/journal/reventes/catalogue/vente) |
| `components/ExchangeWindow.jsx` | Fenêtre dédiée échange PJ↔PJ + transfert drone |
| `components/TokenRadialMenu.jsx` | Point d'entrée secteur `echange` |
| `components/MessageRendererRegistry.jsx` | Renderers `sell_request` / `exchange_offer` |

Shared (1)
| Fichier | Rôle |
|---|---|
| `shared/events.js` | Registre `TRADE_*` (§9) |
