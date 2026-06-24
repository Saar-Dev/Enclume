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
- **Backend** : Express REST + Socket.IO (pattern `registerTradeHandlers`)
- **Frontend** : React composant `TradeWindow.jsx` dans l'overlay session
- **BDD** : PostgreSQL (migrations dédiées)

### Données existantes réutilisables
- `ref_equipment` — catalogue complet (family, category, name, price, weight, tech_level, rarity, stats arme/armure…)
- `char_inventory` — inventaire perso (equipment_id → ref_equipment, container, quantity)
- `char_sheet.sols` — argent du personnage
- `characters` — liste persos (pour échanges PJ↔PJ)

---

## Migrations nécessaires

### Migration 84 — `merchants`
Table des marchands configurés par le GM.

```sql
merchants
  id           UUID PK
  campaign_id  UUID FK campaigns
  name         TEXT NOT NULL
  status       TEXT CHECK IN ('OPEN','CLOSED') DEFAULT 'CLOSED'
  mod_global   INTEGER DEFAULT 0           -- % modificateur prix global
  nt_max       INTEGER DEFAULT 6
  niv_max      INTEGER DEFAULT 5
  dispo_min    INTEGER NULLABLE            -- filtre rareté minimum
  rules        JSONB DEFAULT '[]'          -- règles inclusion/exclusion/param
  allowed_ids  TEXT[] DEFAULT '{}'        -- character_ids autorisés
  created_at / updated_at
```

### Migration 85 — `trade_log`
Journal des transactions (livre de compte GM).

```sql
trade_log
  id              UUID PK
  campaign_id     UUID FK campaigns
  type            TEXT CHECK IN ('merchant_buy', 'player_transfer', 'gm_grant')
  from_char_id    UUID FK characters NULLABLE   -- NULL = marchand/GM
  to_char_id      UUID FK characters NULLABLE
  merchant_id     UUID FK merchants NULLABLE
  sols_delta      INTEGER DEFAULT 0             -- positif = reçu, négatif = dépensé
  items_json      JSONB DEFAULT '[]'            -- snapshot [{equipment_id, name, qty, unit_price}]
  note            TEXT NULLABLE
  created_at
```

---

## Composants React

### `TradeWindow.jsx`
Fenêtre flottante draggable (pattern existant : `CombatGmDeclareWindow`).

**Vue GM (onglets) :**
1. **Marchands** — CRUD marchand (nom, statut OPEN/CLOSED, règles catalogue)
2. **Catalogue** — arbre FAM→CAT→ITEM, checkbox tri-state inclusion/exclusion, sliders mod prix / NT max / dispo min
3. **Joueurs autorisés** — checkboxes par personnage dans la campagne
4. **Livre de compte** — liste chronologique `trade_log` (filtrable par type)

**Vue Joueur :**
1. Sélecteur de marchand (ouvert + autorisé)
2. Catalogue navigable (famille → catégorie → items)
3. Panneau détail item (stats, prix aperçu, dispo)
4. Panier + checkout (déduction `sols`, ajout `char_inventory`)

**Vue Échange PJ↔PJ :**
- Sélection du personnage cible
- Proposition d'objets + montant en sols
- Confirmation de l'autre joueur (ACK Socket.IO)
- Transaction atomique côté serveur

---

## API REST

```
GET    /api/campaigns/:id/merchants            — liste marchands
POST   /api/campaigns/:id/merchants            — créer marchand (GM)
PUT    /api/campaigns/:id/merchants/:mid       — modifier marchand (GM)
DELETE /api/campaigns/:id/merchants/:mid       — supprimer marchand (GM)

GET    /api/campaigns/:id/merchants/:mid/catalog — catalogue filtré pour un joueur
POST   /api/campaigns/:id/merchants/:mid/buy   — achat (débit sols + ajout inventaire)

GET    /api/campaigns/:id/trade-log            — livre de compte (GM)
POST   /api/campaigns/:id/trade/transfer       — échange PJ↔PJ (propose)
```

## Événements Socket.IO

```
TRADE_MERCHANT_UPDATED   — GM modifie un marchand → sync UI joueurs
TRADE_TRANSFER_OFFER     — PJ propose un échange à un autre PJ
TRADE_TRANSFER_ACCEPTED  — PJ accepte → serveur exécute
TRADE_TRANSFER_DECLINED  — PJ refuse
TRADE_LOG_UPDATED        — nouvelle entrée livre de compte (GM only)
```

---

## Logique catalogue (adaptée de Kiwi)

### Règles inclusion/exclusion (stockées en JSONB `merchants.rules`)
```json
{ "mode": "INCLUDE|EXCLUDE|PARAM", "level": "FAM|CAT|ITEM",
  "fam": "", "cat": "", "name": "",
  "mod_pct": null, "nt_max": null, "dispo_min": null }
```

### Filtrage disponibilité
`ref_equipment.rarity` format Polaris : `"15(15)"` → extraire le premier entier → comparer avec `dispo_min`.

### Calcul prix
- Prix fixe : `ref_equipment.price`
- Prix expression (`price_modifier`) : à évaluer avec variables NT/niv si pertinent
- Modificateur marchand : `prix × (1 + mod_global/100)` puis arrondi au demi-sol

---

## Échange PJ↔PJ — flow

```
PJ A ouvre TradeWindow → sélectionne PJ B → compose offre (items + sols)
  → TRADE_TRANSFER_OFFER émis (Socket.IO → PJ B)
PJ B voit notification → accepte ou refuse
  Si accepte → serveur :
    - Vérifie que PJ A possède encore les items/sols
    - Transaction atomique :
        UPDATE char_sheet SET sols = sols - montant WHERE id = charA
        UPDATE char_sheet SET sols = sols + montant WHERE id = charB
        UPDATE char_inventory SET character_id = charB WHERE id IN (items)
        INSERT trade_log (type='player_transfer', ...)
    - Broadcast TRADE_LOG_UPDATED (GM)
    - ACK ok aux deux PJ
```

---

## Priorités d'implémentation

| Étape | Contenu | Dépendance |
|---|---|---|
| 1 | Migrations 84 + 85 | — |
| 2 | API REST marchands (CRUD GM) | M84 |
| 3 | API catalogue (filtrage, prix) | M84 + ref_equipment |
| 4 | API achat marchand + trade_log | M84 + M85 |
| 5 | UI GM — `TradeWindow` onglet Marchands + Catalogue | Étapes 2-3 |
| 6 | UI Joueur — catalogue + panier + checkout | Étape 3-4 |
| 7 | Échange PJ↔PJ (Socket.IO flow) | M85 + Étape 4 |
| 8 | Livre de compte GM | M85 |

---

## Pièges à anticiper

- **P1** : `char_inventory.equipment_id` peut être NULL (objet custom) → l'achat marchand créera toujours un item référencé
- **P2** : Transaction sols + inventaire doit être atomique (knex transaction) — échec partiel interdit
- **P3** : Le joueur peut avoir plusieurs `char_inventory` avec le même `equipment_id` (même objet en plusieurs slots) → utiliser `id` pas `equipment_id` comme clé
- **P4** : Échange PJ↔PJ : vérifier que le perso source est bien dans la campagne active
- **P5** : `rarity` format Polaris `"15(15)"` — parser le premier entier uniquement
- **P6** : Marchand CLOSED = invisible pour les joueurs (filtrer côté serveur, pas côté client)

---

## Non dans le scope de ce plan

- Gestion du stock marchand (quantités limitées) — sprint futur
- Prix dynamiques NT/niv/gen (Kiwi les calcule) — prévu mais non prioritaire
- Interface mobile — déjà géré par le CSS responsive existant
