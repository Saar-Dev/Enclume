# PLAN 13 — Jets Favoris (Macros de compétences)
> Créé : 2026-05-29 Session 66
> Statut : En cours de conception — pas encore codé

---

## Objectif

Permettre à chaque joueur (et au GM pour ses PNJs) de créer des boutons de jet rapide liés aux stats vivantes de son personnage.  
Un clic → l'app lit les stats actuelles → calcule le seuil → lance 1d20 → affiche résultat formaté dans le chat.

**Exemple concret :**
- "Piratage avec mon PC" → Compétence Piratage + mod +10 → `/me pirate le système → {résultat}/{seuil} → {succès}`
- "Jet de Force" → Attribut Force pur → `/me pousse la caisse → {résultat}/{seuil} → {succès} {critique}`
- "Résistance au choc" → Attribut secondaire Seuil Choc + mod blessure → `/me encaisse le choc → {résultat}/{seuil} → {succès}`

---

## Décisions prises

| # | Décision | Raison |
|---|---|---|
| D1 | 3 types de source : Attribut / Compétence / Attribut secondaire | Couvre tous les cas Polaris |
| D2 | Sources multiples combinables (tableau JSONB) | "Qui peut le plus, peut le moins" — sans cas d'usage actuel, mais pas fermé |
| D3 | Modificateur fixe entier (+/−) sur le seuil | Situation persistante (PC, équipement, contexte) |
| D4 | Message template avec variables | Très apprécié par les joueurs, pattern Roll20/Foundry éprouvé |
| D5 | Succès/échec calculé **serveur** (pas dans le template) | Plus fiable, moins de logic côté client, pattern Foundry VTT |
| D6 | Stockage **serveur** lié au personnage | Persistance multi-session, multi-device, Raspberry Pi |
| D7 | Joueur → ses persos / GM → ses PNJs | Symétrie naturelle du projet |
| D8 | Jets secrets : utilise le système existant "JET AU MJ" | Pas de réinvention, cohérence |

---

## Variables du template (inspiré Roll20 + Foundry)

| Variable | Valeur | Exemple |
|---|---|---|
| `{me}` | Nom du personnage | "Pagan" |
| `{source}` | Nom de l'attribut/skill/secondaire | "Piratage" |
| `{résultat}` | Valeur du dé (1–20) | "34" |
| `{seuil}` | Seuil calculé live (base + mod) | "55" |
| `{modificateur}` | Modificateur fixe signé | "+10" ou "−5" |
| `{succès}` | "Succès" ou "Échec" | "Succès" |
| `{critique}` | "" ou "critique !" ou "fumble !" | "critique !" |

**Règles Polaris intégrées serveur :**
- roll ≤ seuil → Succès
- roll = 1 → Succès critique (quel que soit le seuil)
- roll = 20 → Échec critique / fumble (quel que soit le seuil)

**Exemple de template :**
```
/me fait les yeux doux → {résultat}/{seuil} → {succès} {critique}
```
→ Chat : *Pagan fait les yeux doux → 14/47 → Succès*

---

## Architecture technique

### Modèle de données — Migration 59

```sql
character_macros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sources     JSONB NOT NULL DEFAULT '[]',
  -- sources = [{ type: 'skill'|'attribute'|'secondary', ref_id: '...', ref_label: '...' }]
  modifier    INTEGER NOT NULL DEFAULT 0,
  template    TEXT,
  sort_order  SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)
```

**Types de source :**
- `attribute` → `ref_id` = id attribut Polaris (FOR, COO, PER, ADA, INT, VOL, CON, CHA...)
- `skill` → `ref_id` = UUID dans `ref_skills` / `char_skills`
- `secondary` → `ref_id` = clé texte parmi : `rea`, `seuil_etourdi`, `seuil_incons`, `seuil_choc`, `souffle`, `resistance_drogues`, `resistance_naturelle`

---

### Routes REST

```
GET    /api/char-sheet/:characterId/macros        → liste des macros du perso
POST   /api/char-sheet/:characterId/macros        → créer une macro
PUT    /api/char-sheet/:characterId/macros/:id    → modifier (ordre, template, modifier)
DELETE /api/char-sheet/:characterId/macros/:id    → supprimer
```

---

### Event WebSocket — MACRO_ROLL

**Payload client → serveur :**
```js
socket.emit(WS.MACRO_ROLL, {
  macroId:     'uuid',
  characterId: 'uuid',
  secret:      false,
})
```

**Traitement serveur :**
1. Fetch character (attributes + skills + wounds + inventory pour malus)
2. Pour chaque source : calcule la valeur via `charStats.js`
3. `threshold = sum(valeurs) + macro.modifier`
4. Roll 1d20 (seed aléatoire, log côté serveur)
5. Évalue succès/échec/critique
6. Substitue les variables dans `macro.template`
7. Broadcast `MACRO_ROLL_RESULT` → room (ou whisper si secret)

**Payload serveur → client :**
```js
{
  macroId, characterId, characterName,
  sourceName, result, threshold, modifier,
  isSuccess, isCriticalSuccess, isCriticalFail,
  formattedMessage,   // template substitué
  secret,
  timestamp,
}
```

---

### Nouveaux events (shared/events.js)

```js
MACRO_ROLL        : 'macro_roll'
MACRO_ROLL_RESULT : 'macro_roll_result'
```

---

## UX Client

### DicePanel — section Favoris enrichie

**Chips actuels** (formule pure) → conservés, inchangés  
**Nouveaux chips macro** → affichage différent : badge coloré + source indiquée  

Exemple visuel :
```
[★ Piratage +10]     [★ Force]     [★ Choc −3]
```

Clic → exécution directe (MACRO_ROLL)  
Shift+clic → ouvre l'éditeur de cette macro

### Formulaire de création

Bouton dédié "+ Macro" (distinct de l'existant "+ Enregistrer comme favori")

Champs :
1. **Nom** — input texte
2. **Sources** — jusqu'à 3 lignes : dropdown Type (Attribut/Compétence/Secondaire) + dropdown valeur + aperçu seuil actuel
3. **Modificateur** — input +/−
4. **Aperçu seuil calculé** — affiché en live : "Seuil actuel : 47 + 10 = 57"
5. **Template message** — textarea avec aide variables (`{me}`, `{résultat}`...)
6. **Prévisualisation** — ligne d'exemple avec données fictives

---

## Ce qui est nécessaire (non existant)

| Besoin | Status |
|---|---|
| `charStats.js` — toutes les fonctions secondary | ✅ Déjà présentes |
| Routes char-sheet + accès DB attributes | ✅ Déjà existantes |
| `shared/events.js` MACRO_ROLL | ❌ À ajouter |
| Migration 59 `character_macros` | ❌ À créer |
| Routes CRUD macros | ❌ À créer |
| Handler WS MACRO_ROLL | ❌ À créer |
| DicePanel — chips macro | ❌ À créer |
| Formulaire création | ❌ À créer |
| Affichage résultat chat (Sidebar.jsx) | ❌ À adapter |

---

## Plan des sprints

### Sprint A — Fondations serveur ✅ CONFIRMÉ (Session 66)
- Migration 59 : table `character_macros` ✅
- Routes GET/POST/PUT/DELETE ✅
- `shared/events.js` : +MACRO_ROLL, +MACRO_ROLL_RESULT ✅

### Sprint B — Exécution WS ✅ CONFIRMÉ (Session 66)
- `socket/index.js` : handler MACRO_ROLL complet ✅
- Calcul threshold live (charStats.js) ✅
- Substitution template 7 variables + broadcast secret ✅

### Sprint C1 — Chips + Chat ✅ CONFIRMÉ (Session 66)
- DicePanel : fetch macros, chips ★ dorés, exécution MACRO_ROLL, suppression mode ÉDITER ✅
- SessionPage : listener MACRO_ROLL_RESULT → addMessage ✅
- Sidebar : branche macro_result (formattedMessage + résultat/seuil + badge) ✅

### Sprint C2 — Formulaire de création (à venir)
- Section création inline DicePanel : 3 dropdowns source + mod + template + aperçu seuil live
- Endpoint POST /char-sheet/:characterId/macro-preview (calcul threshold côté serveur)
- Drag-to-reorder ou ▲▼ boutons en mode ÉDITER

---

## Questions ouvertes

| # | Question | Statut |
|---|---|---|
| Q1 | Aperçu seuil live dans le formulaire (nécessite fetch stats) ? | ✅ Oui |
| Q2 | Ordre des macros modifiable par drag ? | ✅ Oui (sort_order prévu en DB) |
| Q3 | Macros partagées entre joueurs (macro publique GM) ? | Non pour l'instant |
| Q4 | Limite du nombre de macros par personnage ? | ✅ 10 max (CHECK serveur) |
| Q5 | Formulaire dans DicePanel ou fenêtre séparée ? | ✅ Extension du DicePanel |

---

## Inspirations VTT

**Roll20** : syntaxe `@{character|attribute}` simple, templates figés, `/gmroll` pour secret. **Pattern à copier** : simplicité des variables pour les joueurs.

**Foundry VTT** : templates Handlebars, succès/échec pré-calculé serveur, hook API JavaScript. **Pattern à copier** : données pré-calculées serveur (pas de logique dans le template), séparation data/affichage.

**Décision Enclume** : syntaxe simple type Roll20 (`{variable}`) + calcul serveur type Foundry. Meilleur des deux mondes pour notre contexte.
