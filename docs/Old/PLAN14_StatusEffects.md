# PLAN 14 — Système de Statuts (Status Effects)
> Rédigé : 2026-05-31 Session 67
> Statut : **PLANIFIÉ** — icônes SVG en cours de production

---

## Vision

Icônes au-dessus de la tête des tokens sur le canvas 3D + compteur de tours.
Aucune interface complexe : le système **symbolise** un état sans l'automatiser entièrement.
Le GM ajoute / retire / ajuste les statuts. Le serveur décrémente le compteur de tours à chaque `endTurn`.

---

## Les 15 statuts

| # | Statut FR | Code | Source LdB | Temporalité |
|---|---|---|---|---|
| 1 | Étourdi | `stunned` | Choc (p.237) | Combat, N tours |
| 2 | Inconscient | `unconscious` | Choc (p.237) | Combat, durée variable |
| 3 | Saisi | `grappled` | Lutte / Clé (p.341) | Combat, maintenu |
| 4 | Entravé | `restrained` | Cordes, équipement | Persistant |
| 5 | Déséquilibré | `off_balance` | Balayage (p.255) | Combat, 1 tour |
| 6 | Enflammé | `burning` | Feu (p.243) | Combat, N tours DoT |
| 7 | Corrodé | `acid` | Acide (p.240) | Combat, N tours DoT |
| 8 | Asphyxie | `asphyxia` | Noyade / Souffle (p.244) | Combat, compteur souffle |
| 9 | Décompression | `decompression` | Décompression (p.240) | Combat, DoT |
| 10 | Électrocuté | `electrocuted` | Armes électriques (p.243) | Combat, 1 tour |
| 11 | Aveuglé | `blinded` | Fumée, flash, etc. | Combat, N tours |
| 12 | Hypothermie | `hypothermia` | Froid (p.243) | Long terme |
| 13 | Infecté | `infected` | Infection (p.239) | Long terme |
| 14 | Empoisonné | `poisoned` | Maladies / Poisons (p.244) | Long terme, niveau 0–30 |
| 15 | Irradié | `irradiated` | Setting Polaris | Long terme |

---

## Effets mécaniques Polaris à enforcer (priorité)

Ces effets doivent être lus par `COMBAT_ACTION_DECLARE` côté serveur :

### Étourdi (stunned)
- Pas d'attaque (Assaut / Corps à corps désactivés)
- –5 à toutes les actions
- Déplacement max : allure moyenne
- Se défendre : autorisé

### Inconscient (unconscious)
- Aucune action possible — token exclu du roster actif
- Retiré de la timeline d'initiative

### Saisi (grappled)
- Déplacement impossible
- Actions limitées au désengagement ou combat CàC

**Les 12 autres statuts** = affichage visuel uniquement pour l'instant (pas d'enforcement serveur V1 — GM arbitre).

---

## Architecture

### Nouvelle table `combat_status_effects`

```sql
CREATE TABLE combat_status_effects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  token_id        UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  status_type     TEXT NOT NULL,  -- enum 15 valeurs
  turns_remaining INTEGER,        -- NULL = permanent / hors-combat
  severity        INTEGER,        -- nullable, pour niveau Poison (0-30) etc.
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
)
```

**CHECK constraint** : `status_type IN ('stunned','unconscious','grappled','restrained','off_balance','burning','acid','asphyxia','decompression','electrocuted','blinded','hypothermia','infected','poisoned','irradiated')`

### Migration : à assigner au démarrage du sprint
> ⚠️ La migration 63 est prise (`63_melee`). Vérifier la prochaine disponible dans CLAUDE.md avant de créer le fichier de migration.

---

## Deux systèmes de temporalité

**Système A — Combat (per-tour)** : stocké dans `combat_status_effects`, `turns_remaining` décrémenté par `endTurn`. Effacé quand `turns_remaining = 0` ou `COMBAT_END`.

**Système B — Long terme (entre sessions)** : stocké dans `combat_status_effects` avec `turns_remaining = NULL`. Persistant entre les combats. Retiré manuellement par le GM ou via guérison.

---

## Affichage canvas 3D

- Pattern `Html` de `@react-three/drei` (déjà utilisé pour le D10)
- Position : au-dessus du token mesh (`pos_z + offset`)
- Icônes SVG fournis par Saar (1 SVG par statut = 15 fichiers)
- Compteur de tours affiché sous l'icône si `turns_remaining !== null`
- Plusieurs statuts simultanés : rangée horizontale d'icônes

---

## Interface GM

À définir lors du sprint — options :
- Bouton dans `CombatGmDeclareWindow` (Phase 1)
- Panneau dédié dans la timeline ou le roster
- Radial menu sur clic token (dans `RadialMenu`)

Décision reportée au sprint.

---

## Dépendances bloquantes

- [ ] **15 fichiers SVG** à produire (Saar) — 1 par statut, nommés `status_{code}.svg`
- [ ] Décision sur l'interface GM d'ajout/retrait

---

## Hors scope V1

- Enforcement automatique des effets DoT (dégâts par tour) — GM arbitre
- Niveau Poison (0–30) — affichage icône uniquement, pas de calcul auto
- Durée automatique calculée depuis la table LdB (blessure × localisation) — GM renseigne manuellement
- Suractivité — trop subjectif pour être codé

---

## PC45 — Pièges anticipés

- `turns_remaining` décrémenté dans `endTurn` → vérifier que le DELETE des statuts à 0 est atomique avec le reste du `endTurn`
- `COMBAT_END` doit purger les statuts de type combat (Système A) mais PAS les statuts long terme (Système B)
- Icônes `Html` R3F : ne pas oublier `depthTest: false` pour éviter l'occlusion par les voxels
