# PLAN_TIMELINE — Refonte CombatTimeline BG3-style
> Créé : 2026-06-01 Session 71
> Statut : EN COURS — implémentation terminée, en attente de validation fonctionnelle

---

## 1. Objectif

Refondre `CombatTimeline.jsx` pour se rapprocher du modèle Baldur's Gate 3 :
- Portraits illustrés (illustration 2D fiche perso)
- Cadre de carte = couleur de la pire blessure active
- Acteur actif = carte plus grande, les autres normales
- Lecture gauche→droite, curseur avance selon la phase
- Indicateur de phase + flèche directionnelle (droite de la barre)
- Max 12 cartes affichées, surplus = badge `+N`
- Animation fluide lors des changements d'INI (précipité / retardé)

---

## 2. Décisions de design validées

| Sujet | Décision |
|---|---|
| Sens de lecture | Fixe gauche→droite. Le **curseur actif** avance de droite→gauche en ANNONCE (lents en premier), de gauche→droite en RÉSOLUTION (rapides en premier). Les cartes **ne se réordonnent pas** entre les phases. |
| Visibilité actions | Tout le monde voit tout (LOS = couche future optionnelle). |
| Card ANNONCE | 1 card par acteur (depuis `roster[]`), triées ASC initiative. Apparaissent à la validation du roster par le GM. |
| Card RÉSOLUTION | 1 card par action (depuis `actions[]`), triées par `sequence` ASC. Un acteur avec 2 actions = 2 cartes adjacentes. |
| Source portrait | `character.portrait_url` — chemin MinIO, URL complète = `${VITE_API_URL}/api/assets/${portrait_url}` |
| Bordure sans blessure | Teinte neutre très subtile (`rgba(255,255,255,0.08)`) — cadre visible même si sain. |
| Différenciation PJ/PNJ | Aucune — intentionnel. |
| Clic GM sur carte | Comportement inchangé (prop `onPortraitClick` déjà implémentée). |
| Overflow | MAX_CARDS = 12. Badge `+N` pour le surplus. |
| Timer | Non intégré dans la timeline (existant conservé séparément). |
| Fog of war | Couche future — hors scope de ce sprint. |
| `state_vitesse='delayed'` animé | Hors scope — la carte se repositionne si l'INI change, mais le mécanisme delayed n'est pas implémenté. |

---

## 3. Analyse des données existantes

### Ce qui existe déjà

| Donnée | Source | Statut |
|---|---|---|
| `portrait_url` | `characters` table + store | ✅ Présent — bug URL à corriger (manque prefix `/api/assets/`) |
| `roster[]` | `combatStore` | ✅ Contient `token_id, initiative, has_announced, is_surprised` |
| `actions[]` | `combatStore` | ✅ Contient `id, token_id, type, sequence, status, ...` |
| `activeSlotIdx` / `activeTokenId` | `combatStore` | ✅ Pour déterminer la carte active |
| `SEVERITY_COLORS` | `shared/woundConstants.js` | ✅ `{ legere, moyenne, grave, critique, mortelle }` |
| `phase` | `combatStore` | ✅ `'ROSTER' \| 'ANNOUNCEMENT' \| 'RESOLUTION' \| null` |

### Ce qui manque — `worst_wound_severity` par personnage

La couleur de bordure nécessite la pire blessure active de chaque personnage. Cette donnée n'est pas dans `characters` ni dans le store actuellement.

**Solution retenue : enrichissement du fetch `GET /campaigns/:id/characters`**

Ajouter un sous-SELECT corrélé côté serveur (`characters.js`) :
```sql
(
  SELECT cw.severity
  FROM character_wounds cw
  INNER JOIN char_sheet cs ON cs.id = cw.char_sheet_id
  WHERE cs.character_id = characters.id
  ORDER BY CASE cw.severity
    WHEN 'mortelle' THEN 1 WHEN 'critique' THEN 2 WHEN 'grave' THEN 3
    WHEN 'moyenne' THEN 4 WHEN 'legere' THEN 5 END
  LIMIT 1
) as worst_wound_severity
```

Retourné avec chaque personnage → disponible dans `characterStore` sans store supplémentaire.

**Mise à jour temps réel : à vérifier**

Quand des blessures sont appliquées en combat, `worst_wound_severity` doit se mettre à jour dans la timeline. À vérifier : est-ce que le broadcast existant `WOUND_UPDATED` (ou équivalent) met à jour le characterStore ? Si non → ajouter l'update dans le handler WS de blessure.

> ⚠️ **À vérifier avant de coder** : lire `char-sheet.js` routes `/wounds` et identifier le broadcast WS existant.

---

## 4. Bibliothèque d'animation

### Problème à résoudre
Quand l'INI d'un acteur change (précipité), sa carte doit se déplacer fluidement dans la liste. React DOM natif ne fait pas de FLIP (First-Last-Invert-Play) automatiquement.

### Solution retenue : `motion` (anciennement framer-motion)

**Pourquoi :**
- Standard industrie pour animations layout React (30M+ dl/semaine npm)
- `layoutId` prop = chaque carte conserve son identité à travers les re-renders
- `layout` prop = animation FLIP automatique lors du changement de position
- `AnimatePresence` = animation enter/exit pour apparition/disparition de cartes
- Tree-shakeable — on n'importe que ce qu'on utilise
- **Aucun conflit avec R3F/Three.js** (DOM uniquement, pas WebGL)

**Alternatives écartées :**
- FLIP manuel (`getBoundingClientRect` + transforms) — fragile, 200 lignes de code pour reproduire ce que Motion fait en 2 props
- CSS View Transitions — support partiel browsers, pas adaptable à un tri dynamique
- `react-spring` — équivalent mais Motion est plus adapté aux layout animations

**Installation :**
```bash
cd client && npm install motion
```

**Import pattern :**
```js
import { motion, AnimatePresence } from 'motion/react'
```

**Références :**
- [Motion Layout Animations (FLIP)](https://motion.dev/docs/react-layout-animations)
- [Motion Reorder — sorted lists](https://motion.dev/docs/react-reorder)
- Inspiré de : [Foundry VTT SCS (Simultaneous Combat System)](https://github.com/arcanistzed/scs) — même architecture Annonce/Résolution

---

## 5. Architecture des composants

```
CombatTimeline.jsx               ← refonte complète
├── PhaseLabel                   ← inline, gauche : "Tour N"
├── <AnimatePresence>
│   └── cards.map → <motion.div layoutId={cardKey} layout>
│       └── TimelineCard.jsx     ← NOUVEAU composant extrait
│           ├── portrait (img ou initiale)
│           ├── label (nom)
│           ├── initiative score
│           └── badges (✓ annoncé, ⚠ surpris, actif)
├── OverflowBadge                ← "+N" si surplus > MAX_CARDS
└── DirectionIndicator           ← inline, droite : phase + flèche
```

### Règles de cardKey (identifiant stable pour `layoutId`)
- Phase ANNONCE : `roster-${entry.token_id}`
- Phase RÉSOLUTION : `action-${action.id}`
- Changement de phase → clé différente → les cartes disparaissent/apparaissent proprement

### Tailles cartes
| État | Portrait | Hauteur totale |
|---|---|---|
| Normal | 40×40px | ~70px |
| Actif | 60×60px | ~96px |

La taille change via `layout` prop de Motion → transition FLIP automatique.

---

## 6. Comportement par phase

### Phase ROSTER
- Timeline masquée (`phase === 'ROSTER' → return null`)
- Comportement inchangé par rapport à l'existant.

### Phase ANNOUNCEMENT
```
Source    : roster[] trié ASC initiative (lents à gauche)
Curseur   : activeTokenId — met en surbrillance la carte de qui doit annoncer
Flèche    : ← (droite→gauche) — indique que le curseur progresse de droite vers gauche
Apparition: cartes présentes dès le début de la phase (roster validé)
Badge     : ✓ vert si has_announced === true
```

### Phase RESOLUTION
```
Source    : actions[] triés ASC sequence (sequence=1 à gauche)
Curseur   : actions[activeSlotIdx] — carte active plus grande
Flèche    : → (gauche→droite) — indique que le curseur progresse de gauche vers droite
Acteur avec 2 actions : 2 cartes adjacentes (même portrait_url, même label)
```

---

## 7. Fichiers à modifier

| Fichier | Type | Description |
|---|---|---|
| `client/src/components/CombatTimeline.jsx` | Réécriture | Nouveau layout, Motion, phases, max 12 |
| `client/src/components/TimelineCard.jsx` | NOUVEAU | Composant carte extrait |
| `server/src/routes/characters.js` | Modification | +`worst_wound_severity` dans GET /campaigns/:id/characters |
| `client/package.json` | Modification | +`motion` dependency |
| `client/src/locales/fr.json` | Modification | +clés phase indicator si textes UI |

**Pas de migration DB nécessaire.** Toutes les données existent en base.

---

## 8. Questions ouvertes — RÉSOLUES

| # | Question | Réponse |
|---|---|---|
| Q1 | Le broadcast WS blessures met-il à jour `characterStore` ? | ❌ Non. Les 3 events (`WOUND_ADDED/UPDATED/REMOVED`) sont émis et reçus dans `SessionPage` mais uniquement pour re-render `WoundManager` via `woundVersions`. `characterStore` n'est pas mis à jour. → **Patch requis** (voir §7 Étape 1 bis). |
| Q2 | `actions[]` dans combatStore contient-il `sequence` ? | ✅ Oui. `startResolutionPhase` envoie les lignes complètes de `combat_actions` (ordonnées par `sequence` ASC) dans `COMBAT_PHASE_CHANGED`. |
| Q3 | Faut-il localiser les textes du phase indicator ? | Non bloquant — court texte, peut rester en dur FR pour ce sprint. |

### Détail Q1 — état exact des payloads WS blessures

| Event | Payload actuel | `worst_wound_severity` présent ? |
|---|---|---|
| `WOUND_ADDED` | `{ characterId, wound, promoted, shock_test_required }` | ❌ Non |
| `WOUND_UPDATED` | `{ characterId, wound }` | ❌ Non |
| `WOUND_REMOVED` | `{ characterId, woundId }` | ❌ Non |

**Solution** : ajouter un helper serveur `getWorstWoundSeverity(charSheetId)` et l'inclure dans les 3 payloads. `SessionPage` fait ensuite `upsertCharacter({ id: characterId, worst_wound_severity })`.

```js
// server/src/routes/character/char-sheet.js — helper à ajouter
async function getWorstWoundSeverity(charSheetId) {
  const ORDER = ['mortelle','critique','grave','moyenne','legere']
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  return wounds.reduce((worst, w) =>
    ORDER.indexOf(w.severity) < ORDER.indexOf(worst) ? w.severity : worst
  , 'legere')
}
```

---

## 9. Étapes de développement

### Étape 0 — Préparation ✅
- [x] Lire `char-sheet.js` routes `/wounds` — broadcast WS vérifié (Q1 résolu)
- [x] Lire `SessionPage.jsx` handler `COMBAT_PHASE_CHANGED` — `sequence` confirmé (Q2 résolu)
- [x] `npm install motion` dans `client/` — 5 packages, React 19 compatible
- [x] Plan confirmé

### Étape 1 — Enrichissement données serveur ✅

**1a — `characters.js` : `worst_wound_severity` dans le fetch initial** ✅
- [x] Subquery corrélée ajoutée dans `GET /campaigns/:id/characters`

**1b — `char-sheet.js` : `worst_wound_severity` dans les 3 events WS blessures** ✅
- [x] Helper `getWorstWoundSeverity(charSheetId)` ajouté (module-level async)
- [x] `worst_wound_severity` dans payload `WOUND_ADDED`
- [x] `worst_wound_severity` dans payload `WOUND_UPDATED`
- [x] `worst_wound_severity` dans payload `WOUND_REMOVED`

**1c — `SessionPage.jsx` : listeners WS → updateCharacter** ✅
- [x] `updateCharacter` ajouté au destructure `useCharacterStore`
- [x] `WOUND_ADDED` : patch → `updateCharacter({ id, worst_wound_severity })`
- [x] Listener `WOUND_UPDATED` ajouté
- [x] Listener `WOUND_REMOVED` ajouté

### Étape 2 — Composant TimelineCard ✅
- [x] `client/src/components/TimelineCard.jsx` créé
- [x] Portrait URL corrigée : `${VITE_API_URL}/api/assets/${portrait_url}`
- [x] Bordure = `SEVERITY_COLORS[worst_wound_severity]` ou `rgba(255,255,255,0.08)`
- [x] Taille portrait 44px (normal) / 64px (actif), transition CSS 0.2s
- [x] Badges ✓ annoncé, ⚠ surpris

### Étape 3 — Refonte CombatTimeline ✅
- [x] `motion`, `AnimatePresence`, `LayoutGroup` importés depuis `motion/react`
- [x] `cards[]` dérivé depuis `roster` (ANNOUNCEMENT) ou `actions` (RESOLUTION)
- [x] `MAX_CARDS = 12`, badge `+N`
- [x] `Tour N` (gauche) + Phase + flèche (droite)
- [x] `motion.div layout` sur chaque carte — FLIP automatique
- [x] `AnimatePresence initial={false}` — fade y: -10 → 0

### Étape 4 — Tests et validation ⏳
- [ ] Test ANNOUNCEMENT : cartes apparaissent, curseur progresse, badge ✓ se met à jour
- [ ] Test RÉSOLUTION : cartes depuis actions[], actif plus grand, curseur avance
- [ ] Test changement INI (précipité) : animation FLIP fluide
- [ ] Test portrait absent : placeholder initial propre
- [ ] Test blessure appliquée en combat : bordure se met à jour

---

## 10. Références

- [Motion/Framer — Layout Animations FLIP](https://motion.dev/docs/react-layout-animations)
- [Foundry VTT — SCS (Simultaneous Combat System)](https://github.com/arcanistzed/scs) — architecture Annonce/Résolution
- [Foundry VTT — Combat Tracker Extensions](https://github.com/Anderware/Combat-Tracker-Extensions) — phases multiples, initiative inversée
- `shared/woundConstants.js` — SEVERITY_COLORS
- `client/src/components/CombatTimeline.jsx` — existant à refondre
- `server/src/routes/characters.js` — enrichissement worst_wound_severity
