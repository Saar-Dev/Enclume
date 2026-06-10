# JOURNAL4 — Projet Enclume
> Démarré : Session 86 (2026-06-10)
> JOURNAL1, JOURNAL2, JOURNAL3 archivés dans `docs/Old/`

---

## Session 86 — Mise à jour documentaire complète — 2026-06-10

**Objectif :** Archivage et rationalisation de la documentation accumulée depuis Session 64.

**Actions réalisées :**
- `docs/JOURNAL3.md` archivé → `docs/Old/JOURNAL3.md` (Sessions 64–85, ~3000 lignes)
- `docs/JOURNAL4.md` créé (ce fichier)
- Plans terminés archivés → `docs/Old/` :
  - `PLAN_REWORKDESIGN.md` (Sprint Rework Design — achevé Session 83)
  - `PLAN15_BIBLIOTHEQUE.md` (Sprint Bibliothèque — achevé Session 75/80)
  - `PLAN14_StatusEffects.md` (Status effects — architecture différente, superseeded par PLAN_STATUT)
  - `Character/PLAN_STATUT.md` (Token statuses — migration 68, TokenStatusPanel — achevé Session 77)
- `docs/EN_COURS.md` réduit à sa forme canonique (dettes actives + prochains chantiers uniquement)
- `docs/ASBUILT.md` mis à jour : header Session 85, migrations 74–75, annotations composants Sessions 84–85

**`docs/PLAN_DRONE.md` conservé** — Sprint 2 (intégration combat : initiative INI 12, jets programme, dommages intégrité, taille cible) non encore défini.

---

## Session 87 — Audit critique PLAN_DRONESYSCOMBAT.md — 2026-06-10

**Objectif :** Analyse exhaustive du plan drone combat (25 issues V1–V25), résolution de toutes les ambiguïtés, application de 15 corrections au plan.

### Analyse (V1–V25)

Issues identifiées et résolues sur `docs/PLAN_DRONESYSCOMBAT.md` :

| # | Nature | Résolution |
|---|---|---|
| V3 | Formule `integrite_actuelle` FAUSSE (Math.floor/5 = 3–5× trop) | `integrite -= 1` par hit, sauf `'detruit'` → 0 (LdB p.82-88) |
| V5 | Contrainte XOR absente sur Migration 76 | `ADD CONSTRAINT chk_weapon_xor CHECK (weapon_inv_id IS NULL OR drone_weapon_inv_id IS NULL)` |
| V6 | COMBAT_ACTION_DECLARE bloque les drones (type='drone' tombe dans `else` → `user_id = null` → refusé) | Étendre condition : `character.type === 'pnj' \|\| character.type === 'drone'` |
| V8+V13 | Deux bugs structurels Sprint 2b : modDegatsMode absent + rawDice indisponible pour PJ | Architecture deux branches : Cas A (PNJ→drone dans resolveAssaultAction) + Cas B (PJ→drone dans COMBAT_DAMAGE_CONFIRM après calcul commun degautsBruts) |
| V10 | `drone_sheet.token_id` inexistant | tokenId passé en paramètre → signature `resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets)` |
| V11 | `combat_actions.roster_id` FK supposée | FAUX POSITIF — combat_actions utilise token_id (migration 54), pas roster_id |
| V14 | `weapon.melee` inexistant dans drone_weapons | `weapon.fire_mode === 'cc'` |
| V15 | `isRushedMod` dans formule drone (dead code) | Supprimé — drones ne se précipitent pas |
| V16 | `ammo_restant` hors schéma | Hors scope V1 → TODO B6 |
| V18 | `r.character_type` inexistant dans combat_roster | JOIN SQL combat_roster→tokens→characters |
| V19 | `computeSequence(12)` inexistant | `sequence: 3` directement |
| V20 | Guard ~3443 bloque drone_auto (weapon_inv_id=null) | Dispatch drone_auto AVANT le guard existant |
| V21 | INI télépilotage non défini | **Option C** : propriétaire déclare "Télépiloter" → `drone_weapon_inv_id` dans ses combat_actions → drone `status='done'` ce round |
| V23 | Migration state_control_mode absente | Migration 77b ajoutée dans Sprint 3 |
| V24 | `fire_mode` nullable sans default | `NOT NULL DEFAULT 'rc'` |

**Faux positif :** V11 (roster_id) — pas d'action requise.
**Hors scope confirmés :** V2 (déplacement CaC), V17 (portée auto-parsée).
**Décisions design :** V12 (épave intentionnelle — pas de TOKEN_DELETED auto), V21 (Option C).

### 15 corrections appliquées à `docs/PLAN_DRONESYSCOMBAT.md`

1. Vision table — catégorie armement par fire_mode explicite
2. Différences mécaniques — "Dégâts PJ" — COMBAT_DAMAGE_PROMPT+CONFIRM
3. Migration 76 — contrainte XOR CHECK ajoutée
4. Sprint 2a — `forcedNotSurprised: true` + note is_surprised=false dans rosterRows.map
5. Sprint 2b — restructuration complète en deux branches (Cas A PNJ + Cas B PJ)
6. `resolveDroneIntegrityLoss` — signature tokenId, formule V3, épave documentée, TODO B4
7. Smoke test Sprint 2b — deux smoke tests (A et B)
8. Sprint 2c — `fire_mode === 'cc'`, suppression isRushedMod, ammo_restant → TODO B6
9. Sprint 2d — JOIN SQL, suppression state_control_mode filter, sequence=3, token_id (pas roster_id)
10. Sprint 3 — Migration 77b ajoutée, Phase ANNOUNCEMENT → Option C, séquence télépilotage
11. "Ce qui NE change PAS" — COMBAT_DAMAGE_CONFIRM → deux lignes (Sprint 2b + path humanoïde)
12. PD2 — dispatch drone_auto AVANT le guard (pas modification du guard)
13. PD8 — marqué ✅ RÉSOLU (tokenId en paramètre)
14. drone_weapons schéma — `fire_mode NOT NULL DEFAULT 'rc'`
15. TODO — B4 mis à jour (overflow seul), B6 ajouté (ammo_restant), B5 lié à B4

### État du plan après Session 87

`docs/PLAN_DRONESYSCOMBAT.md` : **prêt pour implémentation**.
- Migrations définies : 76, 76b, 77, 77b
- Sprints 2a, 2b, 2c, 2d, 3 : architecture complète, bugs résolus
- Prérequis avant Sprint 2c : C1 (migration split catégories armement_distance/armement_contact)


