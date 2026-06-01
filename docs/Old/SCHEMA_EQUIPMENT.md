# SCHEMA_EQUIPMENT.md — Schéma déployé : Module Équipement
> Source de vérité : migration 48 (`server/src/db/migrations/48_ref_equipment.js`)
> Dernière mise à jour : session 47 (2026-05-06)
> Sprint déployé : sprint 1 (catalogue ref_equipment). Sprint 2 (char_inventory) : non déployé.

---

## Vue d'ensemble

```
ref_equipment          ← catalogue statique (1 ligne = 1 type d'objet Polaris)
  ├── ref_equipment_skills       ← junction : item ↔ compétences boostées/requises
  ├── ref_equipment_skill_assoc  ← junction : item ↔ compétence d'utilisation
  └── ref_equipment_ammo_compat  ← junction : munition ↔ armes éligibles (auto-référence)
```

Aucune table d'inventaire joueur n'est encore déployée.

---

## Table `ref_equipment`

### Colonnes

| Colonne | Type SQL | Nullable | Défaut | Notes |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `family` | TEXT | NOT NULL | — | Ex : `Armes`, `Protections`, `Munitions` |
| `category` | TEXT | NOT NULL | — | Sous-famille |
| `name` | TEXT | NOT NULL | — | Nom de l'objet |
| `description` | TEXT | nullable | — | |
| `price` | INTEGER | nullable | — | Prix en crédits |
| `price_modifier` | VARCHAR(50) | nullable | — | Ex : `x niv`, `x (gen x NT)` |
| `weight` | FLOAT | nullable | — | Poids en kg |
| `tech_level` | INTEGER | NOT NULL | — | Niveau technologique — CHECK 1–7 |
| `manufacturer` | VARCHAR(50) | nullable | — | |
| `bonus` | VARCHAR(50) | nullable | — | Bonus textuel libre |
| `max_level` | INTEGER | nullable | — | Niveau max pour objets levelables |
| `nation` | VARCHAR(50) | nullable | — | Faction (Veilleurs, Ligue rouge…) |
| `damage_h` | VARCHAR(50) | nullable | — | Dégâts humains (H). Ex : `2D6+4` |
| `damage_v_low` | VARCHAR(50) | nullable | — | Dégâts V− (blindage léger) |
| `damage_v_high` | VARCHAR(50) | nullable | — | Dégâts V+ (blindage lourd) |
| `shock` | VARCHAR(50) | nullable | — | Dés de choc arme |
| `range` | VARCHAR(50) | nullable | — | Portée. Ex : `7/20/30/50` |
| `min_str` | INTEGER | nullable | — | Force min requise — CHECK 3–20 |
| `init_mod` | INTEGER | nullable | — | Modificateur initiative — CHECK < 0 |
| `fire_mode` | VARCHAR(20) | nullable | — | Voir CHECK ci-dessous |
| `ammo_count` | VARCHAR(50) | nullable | — | Nb munitions chargeur. Ex : `40` |
| `ammo_cost` | VARCHAR(50) | nullable | — | Prix munitions. Ex : `400` |
| `caliber` | VARCHAR(50) | nullable | — | Type de munition compatible |
| `rarity` | VARCHAR(20) | NOT NULL | `'20(20)'` | Disponibilité. Ex : `5(10)`, `-20(-15)`, `Introuvable` |
| `linked_attr` | TEXT | nullable | — | Attribut lié — CHECK liste fermée |
| `protection` | INTEGER | nullable | — | Valeur d'armure physique |
| `protection_modifier` | VARCHAR(50) | nullable | — | Ex : `+niv` |
| `protection_shock` | INTEGER | nullable | — | Valeur d'armure choc |
| `location` | VARCHAR(50) | nullable | — | Localisations. Ex : `T/C/B/J` |
| `malus_cat` | TEXT | nullable | — | Catégorie malus armure — CHECK liste fermée |
| `capacity` | FLOAT | nullable | — | Contenance (conteneurs) |
| `waterproof` | BOOLEAN | nullable | — | `true` = étanche, `null` = non applicable |
| `ammo_effects` | TEXT | nullable | — | DSL effets munitions. Ex : `DMG=SET(1D6+2);CHOC=SET(5D10)` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Auto |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Auto |

### Contraintes CHECK

| Contrainte | Règle |
|---|---|
| `chk_eq_tech_level` | `tech_level BETWEEN 1 AND 7` |
| `chk_eq_min_str` | `min_str IS NULL OR min_str BETWEEN 3 AND 20` |
| `chk_eq_init_mod` | `init_mod IS NULL OR init_mod < 0` |
| `chk_eq_fire_mode` | `fire_mode IS NULL OR fire_mode IN ('CC','RC','RL','CC/RC','CC/RL','RC/RL','CC/RC/RL','-')` |
| `chk_eq_linked_attr` | `linked_attr IS NULL OR linked_attr IN ('FOR','CON','COO','ADA','PER','INT','VOL','PRE')` |
| `chk_eq_malus_cat` | `malus_cat IS NULL OR malus_cat IN ('S','A','B','C','D')` |

### Points de vigilance

- **`waterproof`** : stocké `true | null` — jamais `false`. Unchecked = null (non applicable), pas faux.
- **`malus_cat`** : valeurs autorisées `S A B C D` uniquement (5 valeurs). malusMap applicatif : S=0, A=-2, B=-3, C=-4, D=-6.
- **`tech_level`** : INTEGER 1–7, pas de chiffres romains en base.
- **`rarity`** : NOT NULL avec défaut `'20(20)'`. Peut contenir `Introuvable` (string), des négatifs (`-20(-15)`), ou des formules.
- **`price_modifier`** et **`protection_modifier`** : champs texte libres pour les formules (ex : `x niv`).

---

## Table `ref_equipment_skills`

Compétences **boostées ou requises** par un item (ex : une armure qui exige Discrétion).

| Colonne | Type | Contrainte |
|---|---|---|
| `item_id` | UUID | FK → `ref_equipment.id` ON DELETE CASCADE |
| `skill_id` | TEXT | FK → `ref_skills.id` ON DELETE RESTRICT |

PK composite : `(item_id, skill_id)`

---

## Table `ref_equipment_skill_assoc`

Compétence **d'utilisation** de l'item (ex : la compétence sur laquelle on fait le jet quand on utilise cet objet).

| Colonne | Type | Contrainte |
|---|---|---|
| `item_id` | UUID | FK → `ref_equipment.id` ON DELETE CASCADE |
| `skill_id` | TEXT | FK → `ref_skills.id` ON DELETE RESTRICT |

PK composite : `(item_id, skill_id)`

---

## Table `ref_equipment_ammo_compat`

Armes sur lesquelles une munition peut être chargée (auto-référence sur `ref_equipment`).

| Colonne | Type | Contrainte |
|---|---|---|
| `ammo_id` | UUID | FK → `ref_equipment.id` ON DELETE CASCADE |
| `weapon_id` | UUID | FK → `ref_equipment.id` ON DELETE CASCADE |

PK composite : `(ammo_id, weapon_id)`

---

## API déployée — `/api/equipment`

Auth : JWT cookie httpOnly (`requireAuth`). Pas de vérification de rôle — page admin GM-only par convention.

| Méthode | Route | Description | Réponse |
|---|---|---|---|
| GET | `/api/equipment` | Liste résumée (id, family, category, name, tech_level, rarity) | `{ items: [...] }` |
| GET | `/api/equipment/ref/skills` | Liste `ref_skills` pour dropdowns | `{ skills: [{id, label, family}] }` |
| GET | `/api/equipment/:id` | Item complet + arrays junction | `{ item: { ...colonnes, skills[], skill_assoc[], ammo_compat[] } }` |
| POST | `/api/equipment` | Création (transaction atomique) | `201 { item }` |
| PUT | `/api/equipment/:id` | Remplacement complet (transaction atomique) | `200 { item }` |
| DELETE | `/api/equipment/:id` | Suppression (cascade FK junction) | `204` |

**Stratégie PUT — remplacement total :** les 3 junction tables sont vidées puis réinsérées dans la même transaction. Payload identique au POST.

### Payload POST

```json
{
  "family": "Armes",
  "category": "Pistolets",
  "name": "Beretta 9mm",
  "tech_level": 2,
  "...": "autres colonnes ref_equipment",
  "skills": ["skill_uuid_1", "skill_uuid_2"],
  "skill_assoc": ["skill_uuid_3"],
  "ammo_compat": []
}
```

Champs `skills`, `skill_assoc`, `ammo_compat` : arrays d'IDs. Arrays vides autorisés.

### Sanitize appliqué au POST

| Groupe | Champs | Comportement |
|---|---|---|
| Entiers | `price`, `tech_level`, `max_level`, `min_str`, `init_mod`, `protection`, `protection_shock` | Vide/null → null. Sinon parseInt |
| Flottants | `weight`, `capacity` | Vide/null → null. Sinon parseFloat |
| Booléen | `waterproof` | `true/'true'/'1'/'on'` → true. Tout autre → null |
| Texte | Tous les autres | Vide/null → null. Sinon string brut |

### Validation serveur (POST)

- `family`, `category`, `name` : requis → 400 si absent
- `tech_level` : requis, doit être 1–7 → 400 si null après sanitize, PostgreSQL CHECK sinon

---

## Page admin

`http://localhost:3001/equipment-admin.html` (servi par `express.static`)

Saisie manuelle par le GM. Fonctionne avec le JWT cookie de la session React (même domaine `localhost`).

---

## Ce qui n'est pas encore déployé (sprint 2)

- Table `char_inventory` — instances d'objets par personnage
- Moteur mille-feuille (calcul protections par zone)
- Moteur d'encombrement (malus global)

Spécification : `docs/PLAN_chantier10.md`
