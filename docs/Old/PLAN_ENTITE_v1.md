# ENTITY.md — Documentation technique du domaine Entités
> Domaine : Entités interactables sur battlemap
> Dernière mise à jour : 2026-04-20 — v4 post-session 33 (refonte game design)
> Statut : **Décisions figées — certaines migrations à produire avant code**

---

## Sommaire

1. [Définition et positionnement](#1-définition-et-positionnement)
2. [Modèle de données](#2-modèle-de-données)
3. [Blueprints — préfabriqués](#3-blueprints--préfabriqués)
4. [Instances — entités posées](#4-instances--entités-posées)
5. [Système d'états et d'interactions](#5-système-détats-et-dinteractions)
6. [Rendu Three.js — intégration Editor3D / Canvas3D](#6-rendu-threejs--intégration-editor3d--canvas3d)
7. [Flux réseau — protocole d'interaction joueur](#7-flux-réseau--protocole-dinteraction-joueur)
8. [Commande /sc — parseur Sidebar](#8-commande-sc--parseur-sidebar)
9. [UI GM — Centre de notifications (Action Queue)](#9-ui-gm--centre-de-notifications-action-queue)
10. [Interface éditeur — mode Entités](#10-interface-éditeur--mode-entités)
11. [Atelier du GM — TexturePacksPage étendue](#11-atelier-du-gm--texturepackspage-étendue)
12. [Événements WebSocket — nouveaux](#12-événements-websocket--nouveaux)
13. [Pièges anticipés](#13-pièges-anticipés)
14. [Hors scope V1 — documenté pour plus tard](#14-hors-scope-v1--documenté-pour-plus-tard)

---

## Journal des modifications v3 → v4

| Sujet | Décision |
|---|---|
| width/height/depth | **Supprimé.** Entité = 1×1×1 uniquement. Pas de dimensions variables en V1. |
| Atelier du GM | **Fusionné dans TexturePacksPage.** Nouvel onglet "Entités" → `EntityBlueprintsTab.jsx` séparé. Page dédiée abandonnée. |
| Textures entités | **Partagées avec les voxels.** `geometry.faces` référence `voxel_textures.id` — même système, même pack. |
| `voxel_textures.usage_hint` | **Nouveau champ optionnel.** `voxel` \| `entity` \| `both` \| null (null = les deux). Trie le sélecteur de faces — jamais exclusif. |
| `entity_blueprints.pack_id` | **Nouveau champ.** FK → `texture_packs.id`. Un blueprint appartient à un pack. |
| Pose entité en éditeur | **Harmonisé avec les voxels.** Clic gauche simple = pose. Clic maintenu = désactivé silencieusement (pas de peinture). Double-clic supprimé. |
| Sélection rectangulaire | **Reportée V2.** Trop complexe en 3D pour un bénéfice limité. |

---

## 1. Définition et positionnement

### Vocabulaire

| Terme | Définition |
|---|---|
| **Matériau** | Texture PNG brute uploadée dans un pack |
| **Voxel** | Géométrie + matériaux. Décor statique, sans comportement |
| **Entité** | Voxel + états + interactions. Objet de jeu avec comportement |
| **Blueprint** | Préfabriqué d'entité — configuré dans l'Atelier, posé en instance sur la carte |
| **Instance** | Entité posée sur une battlemap — paramètres indépendants du blueprint |

### Ce qu'est une Entité

Une Entité est un objet de jeu placé sur la battlemap par le GM, distinct des voxels (décor statique) et des tokens (personnages).

| Propriété | Valeur |
|---|---|
| Appartenance | GM uniquement — aucun propriétaire joueur |
| Mobilité | Immobile côté joueur. Déplaçable/supprimable par le GM en mode éditeur uniquement |
| Apparence | Voxel 1×1×1 (géométrie + textures) OU modèle GLB |
| Interaction | Icône flottante Drei `<Html>` au survol → panneau d'interaction indépendant |
| Persistance | État courant stocké en base, survit aux rechargements |

### Exemples concrets

Portes, sas, coffres, terminaux, baies de serveurs, barils, pièges, interrupteurs.

### Positionnement dans les layers

Les Entités vivent visuellement dans le **layer voxel** (rendu entre les voxels et les tokens). Elles sont dans leur propre table en base — la séparation est logique, pas visuelle. En mode éditeur, les entités sont distinctes des voxels (section dédiée dans la palette, même onglet).

### Découvrabilité — touche Alt

Les entités interactables ne sont pas visuellement distinguables des voxels de décor au repos. Pour éviter le "pixel hunting", la touche `Alt` maintenue enfoncée active un **liseré cyan** sur toutes les entités visibles sur la carte.

Implémentation V1 : second mesh légèrement agrandi (`scale * 1.05`), `side: THREE.BackSide`, couleur `#00ffff`. Activé/désactivé via un state React dans `Canvas3D` sur `keydown/keyup Alt` (`e.code` — PE16).

---

## 2. Modèle de données

### Deux tables — pattern Blueprint / Instance

```
entity_blueprints   ← le modèle réutilisable (créé dans l'Atelier)
entities            ← les instances posées sur une battlemap
```

**Règle fondamentale :** une modification d'un blueprint ne se répercute **pas** sur les instances déjà posées. À partir du moment où une entité est posée, elle est unique — ses paramètres lui appartiennent.

---

### Table `entity_blueprints` — avec migrations à produire

```sql
id              UUID     PK DEFAULT gen_random_uuid()
created_by      UUID     FK → users.id
pack_id         UUID     FK → texture_packs.id NULL   -- ⚠️ NOUVEAU — migration 43
                                                       -- null = blueprint orphelin (legacy)
label           TEXT     NOT NULL              -- "Porte de sas", "Coffre standard"
glb_url         TEXT     NULL                  -- chemin MinIO si GLB, sinon NULL
geometry        JSONB    NOT NULL DEFAULT '{}'  -- faces uniquement (voir §3) — width/height/depth supprimés
states          JSONB    NOT NULL DEFAULT '[]'  -- définition des états (voir §5)
interactions    JSONB    NOT NULL DEFAULT '[]'  -- définition des interactions (voir §5)
deprecated      BOOLEAN  NOT NULL DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

> **Convention :** pas de `ON DELETE RESTRICT` sur la FK `entities.blueprint_id → entity_blueprints.id`.
> Le GM désactive un blueprint via `deprecated = true` — il ne le supprime pas.
> Pattern identique à `voxel_textures.deprecated`.

---

### Table `voxel_textures` — champ à ajouter

```sql
usage_hint      TEXT     NULL   -- ⚠️ NOUVEAU — migration 43
                                -- valeurs : 'voxel' | 'entity' | 'both' | null
                                -- null = utilisable partout (comportement par défaut)
                                -- JAMAIS exclusif — c'est un hint de tri, pas une règle métier
```

> **Règle d'or `usage_hint` :** ce champ ne bloque rien. Il trie l'affichage dans les sélecteurs.
> Un GM peut toujours utiliser une texture taggée `voxel` sur une entité — via "Voir tout".
> Cas légitimes : porte voxel décorative, coffre caché avec texture de mur.

---

### Table `entities` — inchangée

```sql
id                    UUID     PK DEFAULT gen_random_uuid()
battlemap_id          UUID     FK → battlemaps.id ON DELETE CASCADE
blueprint_id          UUID     FK → entity_blueprints.id
pos_x                 INT      NOT NULL
pos_y                 INT      NOT NULL   -- profondeur (axe Z Three.js) — PE14
pos_z                 INT      NOT NULL   -- altitude  (axe Y Three.js) — PE14
r                     INT      NOT NULL DEFAULT 0
current_state_id      INT      NOT NULL DEFAULT 0
gm_only               BOOLEAN  NOT NULL DEFAULT false
label_override        TEXT     NULL
interaction_overrides JSONB    NOT NULL DEFAULT '{}'
disabled_interactions TEXT[]   NOT NULL DEFAULT '{}'
state                 JSONB    NOT NULL DEFAULT '{}'
notes_gm              TEXT     NULL
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

> **⚠️ Convention pos_x / pos_y / pos_z — NON NÉGOCIABLE (PE14)**
> - `pos_x` = axe X Three.js
> - `pos_y` = profondeur (axe **Z** Three.js)
> - `pos_z` = altitude  (axe **Y** Three.js)
> Ne jamais interpréter `pos_y` comme l'altitude. Toujours passer par `threeToDb()`.

---

## 3. Blueprints — préfabriqués

### Champ `geometry` (JSONB) — simplifié

`width/height/depth` **supprimés**. Toutes les entités sont 1×1×1 en V1.
`geometry` ne contient plus que les faces.

```json
{
  "faces": {
    "top":    14,
    "bottom": null,
    "north":  15,
    "south":  15,
    "east":   15,
    "west":   15
  }
}
```

- `faces` : IDs pointant vers `voxel_textures.id` — même 6 faces nommées que les voxels
- `null` sur une face = face invisible (guard PE4)
- Si `glb_url` défini : `faces` ignoré pour le rendu. Hitbox = BoxGeometry 1×1×1.

### Sélecteur de textures — ordre d'affichage

Dans le formulaire d'édition de blueprint, le sélecteur de faces affiche :
1. En premier : textures du pack avec `usage_hint = 'entity'` ou `'both'` ou `null`
2. Séparateur "Voir tout"
3. Toutes les textures du pack (y compris `usage_hint = 'voxel'`)

---

## 4. Instances — entités posées

### Ce qui est overridable par instance

| Champ | Description |
|---|---|
| `label_override` | Nom affiché au survol — remplace le label du blueprint |
| `current_state_id` | État courant (index dans `states[]`) |
| `state` | Données libres JSONB |
| `interaction_overrides` | Override partiel par interaction : difficulté et/ou compétence requise |
| `disabled_interactions` | Tableau d'IDs d'interactions désactivées sur cette instance |
| `gm_only` | Visibilité joueur |
| `notes_gm` | Texte libre GM |
| `r` | Rotation de l'instance |

### Résolution des overrides d'interaction

```js
const blueprintInteraction = blueprint.interactions.find(i => i.id === interactionId)
const override = entity.interaction_overrides[interactionId] ?? {}
const resolved = { ...blueprintInteraction, ...override }
// resolved.difficulty_dc et resolved.skill_id sont les valeurs effectives
```

### Ce qui n'est PAS overridable par instance

Géométrie/faces, liste des states, liste des interactions (structure), textures de base.
Modifier ces éléments = éditer le blueprint (sans effet rétroactif sur les instances).

---

## 5. Système d'états et d'interactions

### Champ `states` (JSONB — tableau)

```json
[
  {
    "id": 0,
    "name": "Fermé",
    "is_blocking": true,
    "is_transparent": false,
    "visual_override": {
      "opacity": 1.0,
      "face_overrides": {}
    }
  },
  {
    "id": 1,
    "name": "Ouvert",
    "is_blocking": false,
    "is_transparent": true,
    "visual_override": {
      "opacity": 0.0,
      "face_overrides": {
        "north": null,
        "south": null
      }
    }
  }
]
```

- `is_blocking` : réservé collision (non implémenté V1, stocké pour l'avenir)
- `is_transparent` : réservé ligne de vue (non implémenté V1, stocké pour l'avenir)
- `opacity` : float 0.0→1.0
- `face_overrides` : remplace les textures de `geometry.faces` pour cet état. `null` = face invisible

### Champ `interactions` (JSONB — tableau)

```json
[
  {
    "id": "forcer",
    "action_label": "Forcer la porte",
    "required_state_ids": [0],
    "target_state_id": 1,
    "skill_id": "ATHLETISME",
    "difficulty_dc": 15,
    "range": 1.5
  },
  {
    "id": "pirater",
    "action_label": "Pirater le verrou",
    "required_state_ids": [0, 1],
    "target_state_id": 2,
    "skill_id": "INFORMATIQUE",
    "difficulty_dc": 18,
    "range": 1.5
  }
]
```

- `id` : identifiant textuel unique dans le tableau
- `required_state_ids` : tableau d'états depuis lesquels l'interaction est disponible
- `target_state_id` : index de l'état cible en cas de succès
- `skill_id` : référence `ref_skills.id` (TEXT — jamais UUID — PE2)
- `difficulty_dc` : difficulté de base — overridable par instance
- `range` : distance max en unités voxel

### Interactions multiples sur un même état

Plusieurs interactions peuvent partager un `required_state_ids` commun. Le joueur voit toutes les interactions disponibles et choisit. Le GM voit laquelle a été tentée dans son centre de notifications.

### Désactivation par instance

`disabled_interactions: ["pirater"]` → l'interaction `"pirater"` n'est pas proposée sur cette instance. Permet de créer une variante sans dupliquer le blueprint.

---

## 6. Rendu Three.js — intégration Editor3D / Canvas3D

### Composant `EntityMesh.jsx`

Composant partagé Canvas3D + Editor3D, analogue à `Voxel.jsx`. Toutes les entités = 1×1×1.

**Logique de rendu :**

```
si blueprint.glb_url
  → useGLTF(glb_url) + SkeletonUtils.clone() — pattern identique TokenMesh
  → hitbox invisible BoxGeometry(1, 1, 1)
sinon
  → BoxGeometry(1, 1, 1)
  → 6 matériaux face par face depuis voxel_textures (via loadVoxelTextures)
  → faces null = MeshBasicMaterial transparent (guard PE4)
  → opacity depuis current_state.visual_override.opacity
  → face_overrides appliqués par-dessus geometry.faces
```

**Liseré de surbrillance (touche Alt — PE16) :**

```js
{altPressed && (
  <mesh scale={[1.05, 1.05, 1.05]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
  </mesh>
)}
```

**Positionnement — entité 1×1×1 :**

```js
// pos_y = profondeur (Z Three.js), pos_z = altitude (Y Three.js) — PE14
position = [
  entity.pos_x + 0.5,   // axe X
  entity.pos_z + 0.5,   // altitude  — axe Y Three.js ← pos_z en base
  entity.pos_y + 0.5,   // profondeur — axe Z Three.js ← pos_y en base
]
```

**Fallback état invalide (PE11) :**

```js
const currentState = stateList[entity.current_state_id] ?? stateList[0] ?? null
```

**Hitbox raycasting :**

`BoxGeometry(1, 1, 1)` invisible, `userData.isEntity = true`, `userData.entityId = entity.id`.

**Rotation :**

`r` = 0/1/2/3, `rotation.y = r * Math.PI / 2`.

### Panneau d'interaction joueur

Au clic sur l'icône `<Html>` flottante :
- Panneau `position: fixed` indépendant de la Sidebar
- Contenu : nom (`label_override ?? blueprint.label`), état courant, interactions disponibles
- Fermeture : croix ou clic extérieur
- Clic interaction → `WS.ENTITY_ACTION_REQUEST`

---

## 7. Flux réseau — protocole d'interaction joueur

### Vue d'ensemble

```
Joueur                    Serveur                    GM
  |                          |                        |
  | [clic icône Html]        |                        |
  | [panneau interaction]    |                        |
  | [choix interaction]      |                        |
  |-- ENTITY_ACTION_REQUEST→ |                        |
  |   { requestId,           |-- ENTITY_ACTION_      |
  |     characterId,         |   PENDING ----------→ |
  |     entityId,            |  [badge Sidebar GM]   |
  |     interactionId,       |                        |
  |     skillTotal }         |  [GM clique Actions]  |
  |                          | ←- ENTITY_ACTION_      |
  |                          |    RESOLVE ----------- |
  |                          |   { requestId,         |
  |                          |     isApproved,        |
  |                          |     autoSuccess,       |
  |                          |     gmModifier }       |
  |                          |                        |
  | ←-- DICE_RESULT -------- |                        |
  | ←-- ENTITY_UPDATED ----  |                        |
```

### Étape 1 — Déclenchement joueur

**Déclencheur unique : clic sur une interaction dans le panneau flottant.**

**Validation client avant émission :**
- Distance token ↔ entité < `interaction.range`
- `required_state_ids.includes(entity.current_state_id)`
- `interactionId` absent de `entity.disabled_interactions`
- `skillTotal` calculé depuis le store fiche perso — le serveur ne recalcule jamais (PE1)

```js
socket.emit(WS.ENTITY_ACTION_REQUEST, {
  requestId,      // crypto.randomUUID() côté client
  characterId,
  entityId,
  interactionId,
  skillId,        // après résolution override
  skillTotal,     // calculé client
})
```

### Étape 2 — Mise en attente (serveur)

**Validations serveur :**
1. `characterId → characters.user_id === socket.data.userId`
2. L'entité existe sur la battlemap courante
3. L'interaction existe dans le blueprint et n'est pas désactivée sur l'instance

**Timeout (PE12) :** 60s → refus automatique si aucun `ENTITY_ACTION_RESOLVE`.

### Étape 3 — Arbitrage GM

```js
socket.emit(WS.ENTITY_ACTION_RESOLVE, {
  requestId,
  isApproved,
  autoSuccess,
  gmModifier,
})
```

### Étape 4 — Résolution (serveur)

- `isApproved: false` → `ENTITY_ACTION_RESULT { isApproved: false, reason: 'refused' }`
- `isApproved: true, autoSuccess: false` → jet 2D10 → `DICE_RESULT` + si succès `ENTITY_UPDATED`
- `isApproved: true, autoSuccess: true` → `DICE_RESULT { type: 'auto' }` + `ENTITY_UPDATED`

---

## 8. Commande /sc — parseur Sidebar

### Périmètre V1 — jets libres uniquement

`/sc` est **réservé aux jets de compétence libres**, sans lien avec les entités.
Décision définitive : ambiguïté de ciblage irrésoluble sans sélection explicite.

### Syntaxe

```
/sc [character] competence [+/-modificateur]
```

---

## 9. UI GM — Centre de notifications (Action Queue)

### Principe

Onglet **"Actions"** dans la Sidebar, visible uniquement si `isGm`. Badge compteur sur l'onglet.

### Panneau d'arbitrage

```
┌─────────────────────────────────────────┐
│  JEAN veut PIRATER                      │
│  sur TERMINAL ALPHA                     │
│                                         │
│  Compétence : INFORMATIQUE              │
│  Score joueur : 14                      │
│                                         │
│  Difficulté  : [ 18 ]                   │
│  Modif. GM   : [ +0 ]                   │
│                                         │
│  [ Accepter ]  [ Réussite auto ]  [ Refuser ] │
└─────────────────────────────────────────┘
```

### État dans SessionPage

```js
entityActionQueue = [
  {
    requestId,
    playerName,
    characterName,
    entityLabel,
    interactionLabel,
    skillId,
    skillTotal,
    defaultDifficulty,
    gmModifier: 0,
    receivedAt,
  },
]
```

---

## 10. Interface éditeur — mode Entités

### Palette unifiée dans la Sidebar

```
── Voxels ──────────────────────
[Mur béton] [Sol métal] [Plafond]...

── Entités ─────────────────────
[Porte de sas] [Coffre] [Terminal]...
```

- Même palette, séparateur visuel entre les deux sections
- Opacité croisée : onglet Voxels actif → entités à 60% / onglet Entités actif → voxels à 60%

### Contrôles en mode Entités — harmonisés avec les voxels

| Action | Contrôle |
|---|---|
| Orienter avant pose | Touche `R` — r = 0/1/2/3 (PE13) |
| Poser une entité | **Clic gauche simple** — identique voxels |
| Peinture (clic maintenu) | **Désactivée silencieusement** — entité posée une seule fois |
| Déplacer une entité | Mousedown + mouvement > 4px |
| Configurer | Clic droit → fenêtre de configuration |
| Supprimer | Bouton dans la fenêtre de configuration |

### Raccourcis clavier actifs (complets)

| Touche | Action |
|---|---|
| `R` | Rotation ghost (0/1/2/3) avant pose, ou rotation entité existante sous curseur |
| `Digit1` | Géométrie cube |
| `Digit2` | Géométrie dalle basse |
| `Digit3` | Géométrie dalle haute |
| `Digit4` | Géométrie slope |
| `Digit5` | Géométrie wedge |
| `Alt` (maintenu) | Liseré cyan sur toutes les entités |
| `Ctrl+Z` | Undo (voxels uniquement — V1) |
| `Ctrl+Y` | Redo (voxels uniquement — V1) |
| `Suppr` | Supprimer token sélectionné |

> Toujours `e.code` — jamais `e.key` (invariant AZERTY/QWERTY — P38/PE16).

### Fenêtre de configuration d'une entité (instance)

| Onglet | Disponible en | Contenu |
|---|---|---|
| **État** | Play + Éditeur | État courant, label override, notes GM |
| **Configuration** | Éditeur uniquement | interaction_overrides, disabled_interactions, gm_only, r |

---

## 11. Atelier du GM — TexturePacksPage étendue

### Architecture

`TexturePacksPage.jsx` = shell. Onglets du détail d'un pack :
- **Voxels** (existant) → constructeur voxel actuel
- **Entités** (nouveau) → `EntityBlueprintsTab.jsx` chargé en tant que composant séparé
- **Textures PNG** (existant) → grille de fichiers

Pattern identique à SessionPage → Canvas3D/Editor3D : même shell, composants distincts, pas de monolithe.

### Onglet Entités — `EntityBlueprintsTab.jsx`

Layout : liste blueprints à gauche + formulaire à droite (identique à l'onglet Voxels).

**Liste blueprints :**
- Nom du blueprint, badge `deprecated`
- Bouton "+ Nouveau blueprint"
- Clic → charge le formulaire

**Formulaire blueprint :**

```
Nom           [ Porte de sas          ]
Pack          [ sélectionné automatiquement — pack courant ]

Apparence
  ○ Voxel (textures par faces)
  ○ Modèle GLB [ upload ]

Faces (si Voxel) — sélecteur identique TexturePacksPage
  Les textures taggées 'entity' ou 'both' apparaissent en premier.
  [ Voir tout ] pour accéder à toutes les textures du pack.

États
  [ + Ajouter un état ]
  Par état : nom, opacity, face_overrides

Interactions
  [ + Ajouter une interaction ]
  Par interaction : id, label, skill_id, difficulty_dc, required_state_ids[], target_state_id, range

[ Désactiver ]  [ Enregistrer ]
```

### Migrations nécessaires avant code

**Migration 43 — deux altérations :**

```javascript
// 1. Ajouter pack_id sur entity_blueprints
await knex.schema.alterTable('entity_blueprints', (table) => {
  table.uuid('pack_id').references('id').inTable('texture_packs').nullable()
  // nullable — blueprints existants sans pack (legacy)
})

// 2. Ajouter usage_hint sur voxel_textures
await knex.schema.alterTable('voxel_textures', (table) => {
  table.string('usage_hint').nullable()
  // 'voxel' | 'entity' | 'both' | null
  // null = utilisable partout — comportement par défaut
})
```

> **Ordre :** texture_packs existe (migration 21) → pas de dépendance bloquante.
> Les blueprints existants auront `pack_id = null` — comportement legacy acceptable.

---

## 12. Événements WebSocket — nouveaux

Déjà implémentés dans `shared/events.js` (session 9C) :

```js
ENTITY_ACTION_REQUEST:  'entity_action_request',
ENTITY_ACTION_PENDING:  'entity_action_pending',
ENTITY_ACTION_RESOLVE:  'entity_action_resolve',
ENTITY_ACTION_RESULT:   'entity_action_result',
ENTITY_UPDATED:         'entity_updated',
ENTITY_CREATED:         'entity_created',
ENTITY_DELETED:         'entity_deleted',
ENTITY_MOVED:           'entity_moved',
```

---

## 13. Pièges anticipés

| Code | Description |
|---|---|
| PE1 | `skillTotal` envoyé par le client — le serveur affiche sans recalculer. |
| PE2 | `skill_id` dans les interactions = TEXT référençant `ref_skills.id` — jamais UUID. |
| PE3 | `geometry` pilote hitbox ET rendu. Si GLB présent, hitbox seule. |
| PE4 | Face `null` = face invisible. Guard `if (faceId === null \|\| faceId === undefined)` obligatoire. |
| PE5 | ~~Double-clic MapControls~~ — **OBSOLÈTE**. Pose = clic simple, harmonisé avec voxels. |
| PE6 | `disabled_interactions` est un `TEXT[]` PostgreSQL — pas un JSONB. |
| PE7 | `current_state_id` est un index entier dans `states[]` — pas un UUID. |
| PE8 | Blueprints : `deprecated = true` pour désactiver. Pas de suppression physique si instances. |
| PE9 | `requestId` généré côté client (`crypto.randomUUID()`). |
| PE10 | Rotation `r` = 0/1/2/3 uniquement. |
| PE11 | Fallback état invalide : `stateList[entity.current_state_id] ?? stateList[0] ?? null`. |
| PE12 | Timeout serveur 60s — `clearTimeout` + `pendingEntityActions.delete(requestId)` obligatoires. |
| PE13 | Touche `R` = rotation ghost OU entité existante sous curseur — jamais les deux (mousePosRef). |
| PE14 | `pos_y` base = Z Three.js (profondeur). `pos_z` base = Y Three.js (altitude). NON NÉGOCIABLE. |
| PE15 | Résolution overrides : `{ ...blueprintInteraction, ...override }`. Jamais remplacer l'objet entier. |
| PE16 | `e.code` pour Alt (`AltLeft`/`AltRight`) — invariant AZERTY/QWERTY. |
| PE17 | `usage_hint` est un **hint de tri, jamais une règle d'exclusion**. "Voir tout" toujours disponible. |
| PE18 | `entity_blueprints.pack_id` nullable — les blueprints legacy (avant migration 43) ont `pack_id = null`. Guard avant tout accès à `pack_id`. |

---

## 14. Hors scope V1 — documenté pour plus tard

| Fonctionnalité | Note |
|---|---|
| `width/height/depth` variables | Supprimé V1 — entités 1×1×1 uniquement. V2 si besoin confirmé en pratique. |
| Sélection rectangulaire de zone | Trop complexe en 3D, bénéfice limité. Reporté V2. |
| `is_blocking` (collision tokens) | Champ stocké, non implémenté. Dépend d'un système de pathfinding futur. |
| `is_transparent` (LOS) | Champ stocké, non implémenté. Dépend du système de ligne de vue futur. |
| Animations Three.js | `visual_override` gère opacity + face swap uniquement en V1. |
| Rotation libre (axes X/Z) | V1 = quarts de tour axe Y uniquement. |
| `auto_reset_timer` | Non stocké en V1. Chantier serveur dédié (timers persistants). |
| `/sc` couplé à une entité | Décision définitive : ambiguïté de ciblage irrésoluble. Jets libres uniquement. |
| Toggle global gm_only | V1 = par instance. Toggle global = futur. |
| Suppression blueprint avec purge | V1 = `deprecated`. Cascade = futur si besoin. |
| Export/import pack avec blueprints | V1 = textures + voxels uniquement. Blueprints dans le ZIP = V2. |

---

## Plan d'implémentation — chantier 9D

### Prérequis

- 9C complet ✅ (code en place, non testable sans blueprint)
- Ce document validé ✅

### Étapes dans l'ordre strict

**Étape 1 — Migration 43**
`alterTable entity_blueprints` → ajouter `pack_id`.
`alterTable voxel_textures` → ajouter `usage_hint`.

**Étape 2 — Route PUT /api/entity-blueprints/:id**
Ajouter `pack_id` dans les champs modifiables.
Ajouter `usage_hint` dans `PUT /api/voxel-textures/:id`.

**Étape 3 — EntityBlueprintsTab.jsx**
Nouveau composant. Liste blueprints + formulaire complet (faces, states, interactions).
Sélecteur de faces trié par `usage_hint`. Bouton "Voir tout".

**Étape 4 — TexturePacksPage.jsx**
Ajouter onglet "Entités" qui monte `EntityBlueprintsTab`.
Passer `packDetail` et `packFiles` en props.

**Étape 5 — App.jsx + DashboardPage.jsx**
Aucun changement de routing — la page `/texture-packs` existante suffit.
Optionnel : renommer le lien Dashboard "Atelier" au lieu de "Packs de textures".

**Étape 6 — Sidebar éditeur**
Ajouter section "Entités" dans la palette avec séparateur visuel.
Blueprints filtrés par pack actif (ou tous si aucun pack sélectionné).

**Validation fonctionnelle attendue**
- Créer un blueprint "Porte de sas" avec 2 états et 1 interaction → SR OK
- Poser une instance sur la carte → visible dans Canvas3D
- Joueur clique l'icône → panneau d'interaction → jet → résolution GM → état change visuellement