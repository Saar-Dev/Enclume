# PLAN_TRADE.md — Système de Trade (échange d'objets & d'argent)
> Session 120 — 2026-06-24

---

## Objectif

Fenêtre permettant :
- L'achat d'objets depuis un **marchand** (catalogue géré par le GM)
- L'**échange direct** d'objets et d'argent entre personnages
- Un **livre de compte** visible par le GM

---

## Référence Kiwi

| Fichier Kiwi | Ce qu'il apporte |
|---|---|
| `23_Trade_Engine.gs` | Moteur : marchands JSON, catalogue `ref_equipment`, règles inclusion/exclusion par famille/catégorie/item, calcul prix (expressions NT/niv/gen), checkout 2 phases (prepare + commit) |
| `33_Trade_WebApp.gs` | API WebApp : boot MJ, CRUD marchands, contexte joueur, catalogue arbre, lignes de panier, checkout |
| `TradeMJ.html` | UI GM : liste marchands, paramètres (statut OPEN/CLOSED, mod prix global, NT max, niv max, gen max, dispo min), joueurs autorisés (checkbox), catalogue tri-state FAM→CAT→ITEM |
| `TradePlayer.html` | UI Joueur : sélecteur marchand, catalogue famille→catégorie→items, panier, checkout + modal d'emplacement de rangement, panneau détail item |

---

## Architecture cible (Enclume)

### Stack
- **Backend** : Express REST + Socket.IO (pattern `registerTradeHandlers` — voir ARCHI_REWORK.md)
- **Frontend** : React composant `TradeWindow.jsx` dans l'overlay session
- **BDD** : PostgreSQL (migrations 84, 85, 86)

### Données existantes réutilisables
- `ref_equipment` — catalogue complet (family, category, name, price, weight, tech_level, generation, rarity, stats arme/armure…)
- `char_inventory` — inventaire perso (equipment_id → ref_equipment, container, quantity)
- `char_sheet.sols` — argent du personnage (INTEGER — entier strict, demi-sol arrondi côté calcul uniquement)
- `characters` — liste persos (pour échanges PJ↔PJ)
- `campaigns` — contient `tour_duration` (option campagne) → durée d'expiration des offres

### Fichiers à créer
| Fichier | Rôle |
|---|---|
| `server/src/socket/socketTrade.js` | `registerTradeHandlers(io, socket, context)` — handlers WS (pattern REWORK-17) |
| `server/src/routes/tradeRoutes.js` | Routes REST marchands + catalogue + log |
| `server/src/services/tradeService.js` | Logique métier — fonctions pures + à effets |
| `shared/events.js` | +8 constantes `TRADE_*` |
| `server/src/socket/index.js` | Import + appel `registerTradeHandlers` dans SESSION_JOIN |
| `client/src/.../MerchantsPanel.jsx` | UI GM préparation (Dashboard) — section de WorkshopPage ou page dédiée |
| `client/src/components/TradeWindow.jsx` | UI in-session — vue GM lite + vue Joueur + vue Échange PJ↔PJ |

⚠️ Lire `WorkshopPage` avant de coder `MerchantsPanel` — vérifier la structure de navigation et le pattern d'ajout de section.

---

## Migrations nécessaires

### Migration 84 — `merchants`
Table des marchands configurés par le GM.

```sql
merchants
  id                UUID PK DEFAULT gen_random_uuid()
  campaign_id       UUID FK campaigns NOT NULL
  name              TEXT NOT NULL
  status            TEXT CHECK (status IN ('OPEN','CLOSED')) DEFAULT 'CLOSED'
  mod_global        INTEGER DEFAULT 0           -- % modificateur prix global
  nt_max            INTEGER DEFAULT 6
  niv_max           INTEGER DEFAULT 5
  gen_max           INTEGER DEFAULT 5           -- filtre génération max (Kiwi TradeMJ.html)
  dispo_min         INTEGER                     -- filtre rareté minimum (NULLABLE)
  rules             JSONB DEFAULT '[]'          -- règles inclusion/exclusion/param
  -- allowed_char_ids : voir note architecture ci-dessous
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Migration 85 — `trade_log`
Journal des transactions (livre de compte GM).

```sql
trade_log
  id              UUID PK DEFAULT gen_random_uuid()
  campaign_id     UUID FK campaigns NOT NULL
  type            TEXT CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant'))
  from_char_id    UUID FK characters     -- NULL = marchand ou GM
  to_char_id      UUID FK characters
  merchant_id     UUID FK merchants
  sols_delta      INTEGER DEFAULT 0      -- positif = reçu, négatif = dépensé (INTEGER strict)
  items_json      JSONB DEFAULT '[]'     -- snapshot [{equipment_id, name, qty, unit_price}]
  note            TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Migration 86 — `trade_offers`
État des offres PJ↔PJ en cours. Source de vérité persistante — survive aux redémarrages serveur.

```sql
trade_offers
  id             UUID PK DEFAULT gen_random_uuid()
  campaign_id    UUID FK campaigns NOT NULL
  from_char_id   UUID FK characters NOT NULL    -- initiateur
  to_char_id     UUID FK characters NOT NULL    -- destinataire
  status         TEXT CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
                 DEFAULT 'PENDING'
  items_json     JSONB DEFAULT '[]'   -- [{char_inventory_id, equipment_id, name, qty}]
  sols_offer     INTEGER DEFAULT 0   -- sols offerts par from_char (INTEGER strict)
  expires_at     TIMESTAMPTZ NOT NULL -- = NOW() + campaigns.tour_duration au moment de la création
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at     TIMESTAMPTZ
```

**Note architecture — liste de joueurs autorisés :**
Deux options pour stocker les autorisations d'accès par personnage :

- **Option TEXT[]** (simple) : colonne `allowed_char_ids TEXT[] DEFAULT '{}'` dans `merchants`. Requête Knex : `whereRaw('? = ANY(allowed_char_ids)', [charId])`. Adapté à 4–8 joueurs. Inconvénient : syntaxe `whereRaw` non idiomatique Knex.
- **Option table de jointure** (propre) : table séparée `merchant_char_access(merchant_id UUID, char_id UUID, PK composite)`. Requête standard Knex `.where({ merchant_id, char_id })`. Inconvénient : migration supplémentaire + join à chaque appel `getCatalog`.

→ **Choix retenu à confirmer avant implémentation.** Pour 4–8 joueurs, TEXT[] est suffisant. Table de jointure si on anticipe une fonctionnalité "groupes de joueurs" (sprint futur).

---

Pourquoi la table `trade_offers` est nécessaire (vs Map in-memory) :
- Offre survit au restart serveur
- `expires_at` = source de vérité pour l'expiration (vérifiée DANS la transaction forUpdate, pas avant)
- Audit : toutes les offres DECLINED/CANCELLED sont traçables
- Un PJ peut avoir au plus 1 offre PENDING à la fois (contrainte applicative, pas DB)

---

## Événements Socket.IO

À ajouter dans `shared/events.js` — convention `trade:xxx` (aligné sur `combat:action_precheck`) :

```js
TRADE_MERCHANT_UPDATED:  'trade:merchant_updated',   // GM modifie un marchand → sync UI joueurs
TRADE_OFFER_RECEIVED:    'trade:offer_received',     // PJ B reçoit une offre de PJ A
TRADE_OFFER_ACCEPTED:    'trade:offer_accepted',     // transaction exécutée → broadcast aux deux PJ
TRADE_OFFER_DECLINED:    'trade:offer_declined',     // PJ B refuse → notif PJ A
TRADE_OFFER_CANCELLED:   'trade:offer_cancelled',    // PJ A annule → notif PJ B
TRADE_OFFER_EXPIRED:     'trade:offer_expired',      // expiration détectée → notif aux deux PJ
TRADE_LOG_UPDATED:       'trade:log_updated',        // nouvelle entrée trade_log → GM only
TRADE_ERROR:             'trade:error',              // erreur métier → socket émetteur only
```

Payloads :
- `TRADE_OFFER_RECEIVED` → `{ offerId, fromCharName, items, solsOffer, expiresAt }`
- `TRADE_OFFER_ACCEPTED / DECLINED / CANCELLED / EXPIRED` → `{ offerId }`
- `TRADE_LOG_UPDATED` → `{ entry }` (row trade_log complète)
- `TRADE_ERROR` → `{ code, message }` — codes : `INSUFFICIENT_FUNDS`, `ITEM_UNAVAILABLE`, `OFFER_EXPIRED`, `OFFER_NOT_FOUND`, `RATE_LIMITED`

---

## Interface cible — `tradeService.js`

Signature standard ARCHI_REWORK.md : `async function verbNoun(io, db, campaignId, pendingMap, params)`

```js
// Marchands (REST — pendingMap = null)
async function getMerchants(io, db, campaignId, null, { role })
async function upsertMerchant(io, db, campaignId, null, { merchant })       // create + update
async function deleteMerchant(io, db, campaignId, null, { merchantId })

// Catalogue (REST — pendingMap = null)
async function getCatalog(io, db, campaignId, null, { merchantId, characterId })
  // → filtre OPEN + allowed_char_ids + rules (nt_max, niv_max, gen_max, dispo_min, INCLUDE/EXCLUDE)
  // → calcule prix = Math.round(ref_equipment.price × (1 + mod_global/100))

// Achat marchand (REST — atomique)
async function buyFromMerchant(io, db, campaignId, null, { merchantId, characterId, items })
  // → transaction knex forUpdate : lock char_sheet + vérif sols + débit + INSERT char_inventory + INSERT trade_log

// Échange PJ↔PJ (WS)
async function proposeTransfer(io, db, campaignId, null, { fromCharId, toCharId, items, sols })
async function acceptTransfer(io, db, campaignId, null, { offerId, acceptingCharId })
async function declineTransfer(io, db, campaignId, null, { offerId, decliningCharId })
async function cancelTransfer(io, db, campaignId, null, { offerId, cancellingCharId })

// Livre de compte (REST — GM only)
async function getTradeLog(io, db, campaignId, null, { page, type })
```

---

## Rate limiting — offres PJ↔PJ

Bibliothèque : `rate-limiter-flexible` (référence Node.js production pour Socket.IO).

```js
// Dans socketTrade.js — scope : TRADE_TRANSFER_OFFER uniquement
import { RateLimiterMemory } from 'rate-limiter-flexible'

const tradeOfferLimiter = new RateLimiterMemory({
  points: 3,     // 3 offres max
  duration: 60,  // par minute (fenêtre glissante)
})

socket.on(WS.TRADE_TRANSFER_OFFER, async (data) => {
  try {
    await tradeOfferLimiter.consume(socket.userId)  // clé = userId, pas IP (joueurs authentifiés)
  } catch {
    socket.emit(WS.TRADE_ERROR, { code: 'RATE_LIMITED', retryAfter: 60 })
    return
  }
  // suite du handler
})
```

Pourquoi `userId` (pas `socket.id` ni IP) :
- `socket.id` change à chaque reconnexion → contournement trivial
- IP : inefficace en LAN (tous derrière la même gateway)
- `userId` : stable, identifie le joueur authentifié

---

## Atomicité — échange PJ↔PJ

Pattern `knex forUpdate()` — vérification et débit dans la même transaction PostgreSQL :

```js
// tradeService.js — acceptTransfer
await db.transaction(async (trx) => {
  // 1. Lock l'offre — bloque toute acceptation concurrente du même offerId
  const offer = await trx('trade_offers')
    .where({ id: offerId, campaign_id: campaignId, to_char_id: acceptingCharId, status: 'PENDING' })
    .forUpdate()
    .first()
  if (!offer) throw new Error('OFFER_NOT_FOUND')
  if (new Date(offer.expires_at) < new Date()) throw new Error('OFFER_EXPIRED')

  // 2. Lock les sols de l'initiateur
  const fromSheet = await trx('char_sheet')
    .where({ character_id: offer.from_char_id })
    .forUpdate()
    .first()
  if (fromSheet.sols < offer.sols_offer) throw new Error('INSUFFICIENT_FUNDS')

  // 3. Lock chaque item offert (vérif présence dans l'inventaire de PJ A)
  for (const item of offer.items_json) {
    const inv = await trx('char_inventory')
      .where({ id: item.char_inventory_id, character_id: offer.from_char_id })
      .forUpdate()
      .first()
    if (!inv) throw new Error('ITEM_UNAVAILABLE')
  }

  // 4. Exécuter les mutations
  if (offer.sols_offer > 0) {
    await trx('char_sheet').where({ character_id: offer.from_char_id }).decrement('sols', offer.sols_offer)
    await trx('char_sheet').where({ character_id: offer.to_char_id }).increment('sols', offer.sols_offer)
  }
  for (const item of offer.items_json) {
    await trx('char_inventory')
      .where({ id: item.char_inventory_id })
      .update({
        character_id: offer.to_char_id,
        container: 'Coffre',  // P9 — reset conteneur : l'item arrive à la racine du destinataire
        slot: null,           // slot spécifique au PJ A — invalide pour PJ B
      })
  }

  // 5. Clore l'offre + insérer dans le log
  await trx('trade_offers').where({ id: offerId }).update({ status: 'ACCEPTED', updated_at: trx.fn.now() })
  await trx('trade_log').insert({
    campaign_id: campaignId,
    type: 'player_transfer',
    from_char_id: offer.from_char_id,
    to_char_id:   offer.to_char_id,
    sols_delta:   offer.sols_offer,
    items_json:   offer.items_json,
  })
})
// Après la transaction : emit TRADE_OFFER_ACCEPTED aux deux sockets + TRADE_LOG_UPDATED au GM
```

Règle : checks `OFFER_EXPIRED` et `INSUFFICIENT_FUNDS` **à l'intérieur** de la transaction, après `forUpdate()`. Jamais avant.

---

## Composants React

### Principe fondamental — le catalogue est un filtre

Un marchand **ne possède pas sa propre liste d'articles**. Il définit des **règles de filtrage sur `ref_equipment`** (le catalogue global existant en DB). Le GM ne sélectionne pas des items un par un : il configure des règles d'inclusion/exclusion par famille, catégorie ou item individuel, plus des seuils globaux. Le catalogue visible par le joueur est calculé à la volée en appliquant ces règles à `ref_equipment`.

Conséquence : ajouter un item au jeu (nouvelle ligne `ref_equipment`) le rend potentiellement disponible chez tous les marchands dont les règles l'incluent — sans aucune action GM supplémentaire.

### `MerchantsPanel.jsx` — Dashboard GM (préparation hors session)

Section de `WorkshopPage` (ou page dédiée selon structure existante).
Accès : navigation Campaign/Workshop, hors session active.

**Contenu :**
- Liste des marchands de la campagne (CRUD complet : créer, renommer, dupliquer, supprimer)
- Sélection d'un marchand → panneau de configuration :
  1. **Paramètres globaux** : statut OPEN/CLOSED, `mod_global`, `nt_max`, `niv_max`, `gen_max`, `dispo_min`
  2. **Catalogue — constructeur de filtres** :
     - Arbre FAM→CAT→ITEM issu de `ref_equipment` (groupé par `family` → `category` → `name`)
     - Chaque nœud : `hérité` (défaut) / `INCLUDE` (forcé inclus) / `EXCLUDE` (forcé exclu)
     - Mode `PARAM` sur un nœud : surcharge locale de `mod_pct`, `nt_max`, `gen_max`, `dispo_min`
     - Prévisualisation : liste des items effectivement visibles après application de toutes les règles
  3. **Joueurs autorisés** : checkboxes par personnage de la campagne. Vide = tous autorisés.

### `TradeWindow.jsx` — In-session (ajustements à chaud + joueurs)

Fenêtre flottante draggable (pattern existant : `CombatGmDeclareWindow`).
Accès : menu radial sur le token du joueur → secteur **"Trade"**.

**Vue GM (lite — ajustements à chaud uniquement) :**
1. **Marchands** — liste des marchands de la campagne avec, par marchand : toggle OPEN/CLOSED + slider `mod_global`. Pas de CRUD, pas de config catalogue (→ Dashboard).
2. **Livre de compte** — liste chronologique `trade_log` (filtrable par type : achat / échange / don GM)

**Vue Joueur :**
1. Sélecteur de marchand (ouvert + autorisé uniquement — filtré serveur)
2. Catalogue navigable (famille → catégorie → items)
3. Panneau détail item (stats, prix aperçu, dispo)
4. Panier + checkout (déduction `sols`, ajout `char_inventory`)

**Vue Échange PJ↔PJ :**
- Sélection du personnage cible
- Composition de l'offre : objets + montant en sols
- Affichage du timer d'expiration (= `tour_duration` campagne)
- Confirmation du destinataire (ACK Socket.IO)
- Annulation disponible des **deux côtés** avant acceptation

### Déclencheur UI
- **Dashboard** : navigation WorkshopPage (chemin exact à confirmer à la lecture de `WorkshopPage`)
- **In-session — token propre** : menu radial sur son propre token → secteur "Trade" → `TradeWindow` s'ouvre sur la vue Joueur (catalogue marchand) ou vue Échange (sélection cible manuelle)
- **In-session — token cible** : menu radial sur le token d'un autre PJ → secteur "Trade" → `TradeWindow` s'ouvre directement sur la vue Échange **avec `to_char_id` pré-rempli**. Évite la sélection manuelle dans une liste de personnages.

⚠️ Les deux points d'entrée in-session émettent vers le même composant `TradeWindow` avec un prop `initialContext: { mode: 'exchange', toCharId }` optionnel.
⚠️ Lire le composant menu radial avant de coder — vérifier la structure des secteurs existants et comment passer le contexte token cliqué.

---

## API REST

```
GET    /api/campaigns/:id/merchants                  — liste marchands (GM : tous / PJ : OPEN + autorisé)
POST   /api/campaigns/:id/merchants                  — créer marchand (GM)
PUT    /api/campaigns/:id/merchants/:mid             — modifier marchand (GM)
DELETE /api/campaigns/:id/merchants/:mid             — supprimer marchand (GM)

GET    /api/campaigns/:id/merchants/:mid/catalog     — catalogue filtré (PJ autorisé ou GM)
POST   /api/campaigns/:id/merchants/:mid/buy         — achat marchand (débit sols + ajout inventaire)

GET    /api/campaigns/:id/trade-log                  — livre de compte (GM only)
```

Note : les opérations PJ↔PJ (propose, accept, decline, cancel) passent **exclusivement par Socket.IO**.

---

## Logique catalogue (adaptée de Kiwi)

### Règles inclusion/exclusion (stockées en JSONB `merchants.rules`)
```json
{ "mode": "INCLUDE|EXCLUDE|PARAM", "level": "FAM|CAT|ITEM",
  "fam": "", "cat": "", "name": "",
  "mod_pct": null, "nt_max": null, "gen_max": null, "dispo_min": null }
```

### Filtrage disponibilité
`ref_equipment.rarity` format Polaris : `"15(15)"` → `parseInt(rarity, 10)` → comparer avec `dispo_min`.
⚠️ P5 : certaines raretés peuvent être non numériques (`"Unique"`, `"Spécial"`). `parseInt` retourne `NaN` → l'item doit être traité comme **toujours disponible** (pas exclu silencieusement).
```js
const rarityVal = parseInt(item.rarity, 10)
const passesRarity = isNaN(rarityVal) || dispo_min == null || rarityVal >= dispo_min
```

### Filtrage génération
`ref_equipment.generation` → comparer avec `gen_max` marchand.
⚠️ P8 : vérifier l'existence de la colonne avant de coder (`SELECT column_name FROM information_schema.columns WHERE table_name='ref_equipment'`).

### Ordre d'évaluation des règles tri-state (cascade)
Les règles `merchants.rules` (JSONB) sont évaluées du **plus général au plus spécifique**, la règle la plus spécifique l'emportant :
1. Seuils globaux du marchand (`nt_max`, `niv_max`, `gen_max`, `dispo_min`) — appliqués en premier
2. Règles niveau `FAM` (famille entière)
3. Règles niveau `CAT` (catégorie dans une famille)
4. Règles niveau `ITEM` (item individuel) — priorité maximale

Exemple : `EXCLUDE FAM="Armes Lourdes"` + `INCLUDE ITEM="Lance-roquettes"` → le lance-roquettes est visible malgré l'exclusion de sa famille. L'algorithme de `getCatalog` doit appliquer les règles dans cet ordre et permettre à un INCLUDE spécifique d'annuler un EXCLUDE général.

### Calcul prix
- Prix de base : `ref_equipment.price` (INTEGER)
- Modificateur marchand : `Math.round(price × (1 + mod_global / 100))` → résultat INTEGER
- Prix dynamiques NT/niv/gen (Kiwi) : hors scope — sprint futur

---

## Échange PJ↔PJ — flow complet

```
PJ A ouvre TradeWindow (menu radial) → Vue Échange → sélectionne PJ B → compose offre (items + sols)
  → TRADE_TRANSFER_OFFER émis (rate limit : 3/min par userId)
  → serveur : INSERT trade_offers (status=PENDING, expires_at = NOW() + tour_duration)
  → serveur → emit TRADE_OFFER_RECEIVED à socket PJ B

PJ B voit notification dans TradeWindow
  Option A — Accepte :
    → TRADE_TRANSFER_ACCEPTED émis
    → serveur : transaction atomique forUpdate (voir §Atomicité)
    → emit TRADE_OFFER_ACCEPTED aux deux PJ + TRADE_LOG_UPDATED au GM
  Option B — Refuse :
    → TRADE_TRANSFER_DECLINED émis
    → serveur : UPDATE status='DECLINED' + emit TRADE_OFFER_DECLINED à PJ A
  Option C — Expiration (timer atteint côté client) :
    → client émet TRADE_TRANSFER_CANCEL
    → serveur : check expires_at dans la transaction → OFFER_EXPIRED si dépassé

PJ A peut annuler à tout moment avant acceptation :
  → TRADE_TRANSFER_CANCEL émis
  → guard serveur : status='PENDING' + from_char_id = charId du socket
  → UPDATE status='CANCELLED' + emit TRADE_OFFER_CANCELLED à PJ B
```

**Expiration :** `expires_at = NOW() + campaigns.tour_duration` à la création de l'offre.
Vérifiée à l'intérieur de la transaction `acceptTransfer` (P7). Pas de job de nettoyage actif — lazy cleanup.

**Guard UI côté client :** quand le timer local atteint 0, le bouton "Accepter" doit être désactivé immédiatement côté client — sans attendre la réponse serveur. Évite d'envoyer une requête inutile qui reviendrait avec `TRADE_ERROR { code: 'OFFER_EXPIRED' }`.

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 1 | Migrations 84 + 85 + 86 | — |
| 2 | `shared/events.js` — 8 constantes `TRADE_*` | — |
| 3 | `tradeRoutes.js` + `tradeService.js` — API REST marchands CRUD + catalogue + log | M84 + M85 |
| 4 | `socketTrade.js` — `registerTradeHandlers` + rate limiter + handlers WS | Étape 2 |
| 5 | `tradeService.getCatalog` — filtrage complet (rules, nt/niv/gen/dispo, prix) | M84 + ref_equipment |
| 6 | `tradeService.buyFromMerchant` — achat atomique + trade_log | M84 + M85 |
| 7 | **Dashboard** — `MerchantsPanel.jsx` : CRUD marchands + constructeur filtres catalogue + joueurs autorisés | Étapes 3-5 |
| 8 | **In-session GM lite** — `TradeWindow` vue GM : toggle OPEN/CLOSED + mod_global + livre de compte | Étapes 3, 6 |
| 9 | **In-session Joueur** — `TradeWindow` vue Joueur : catalogue + panier + checkout | Étapes 5-6 |
| 10 | **In-session Échange PJ↔PJ** — propose + accept + decline + cancel + expiration | M86 + Étapes 4, 9 |
| 11 | Menu radial — secteur Trade (déclencheur `TradeWindow`) | Étape 9 |

---

## Pièges à anticiper

- **P1** : `char_inventory.equipment_id` peut être NULL (objet custom) → achat marchand créera toujours un item référencé
- **P2** : Transaction sols + inventaire doit être atomique (`knex.transaction` + `forUpdate`) — échec partiel interdit
- **P3** : Un PJ peut avoir plusieurs `char_inventory` avec le même `equipment_id` → clé d'offre = `char_inventory.id`, pas `equipment_id`
- **P4** : Échange PJ↔PJ : vérifier que `from_char_id` et `to_char_id` sont dans la campagne active
- **P5** : `rarity` format Polaris `"15(15)"` — parser le premier entier uniquement
- **P6** : Marchand CLOSED = invisible pour les joueurs — filtré côté serveur, jamais côté client
- **P7** : Check `expires_at > NOW()` et `sols suffisants` **à l'intérieur** de la transaction après `forUpdate()` — jamais avant, sinon race condition
- **P8** : `gen_max` filtre sur `ref_equipment.generation` — vérifier l'existence de la colonne avant de coder le catalogue
- **P9** : Transfert `char_inventory` — ne pas seulement mettre à jour `character_id`. Forcer aussi `container = 'Coffre'` et `slot = NULL`. Sans ça, l'item hérite du container/slot du PJ A (code comme `'equipped'` ou `'BG'`) et disparaît de l'interface du PJ B ou corrompt son arbre d'inventaire. Schéma lu : migration 50, `container string(20) NOT NULL DEFAULT 'Coffre'`, `slot nullable`.

---

## Non dans le scope de ce plan

- Gestion du stock marchand (quantités limitées) — sprint futur
- Prix dynamiques NT/niv/gen — prévu mais non prioritaire
- Contre-offre PJ↔PJ (un seul aller-retour, pas de négociation) — sprint futur
- Interface mobile — déjà géré par le CSS responsive existant
