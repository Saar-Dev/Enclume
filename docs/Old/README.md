# docs/Old/ — Archive du projet Enclume

Contient les documents retirés du flux de travail actif.
**Jamais supprimé — toujours archivé ici.**

Convention (session 70+) : tout archivage est noté dans ce fichier avec sa raison et son statut vis-à-vis du Livre de Base.

---

## Archivés session 70 (2026-06-01)

| Fichier | Raison | Contenu LdB |
|---|---|---|
| `JARMES.md` | Plan pré-impl Sprint 10-4 (Module Armes Équipées) — ✅ fait session 55 | Non |
| `PLAN_10-4_ARMES.md` | Doublon de JARMES.md, même sprint ✅ | Non |
| `ROADMAP_CHARACTER.md` | Roadmap domaine Character session 45, workflow upload-based dépassé, toutes sessions ✅ | Non |
| `JOURNALBDD.md` | Journal nettoyage BDD ref_equipment pour seed — seed appliqué session 70 ✅ | Non |
| `SCHEMA_EQUIPMENT.md` | Schéma session 47 — indiquait "char_inventory non déployé" (faux depuis migration 50, session 51) | Non |
| `JOURNAL_ROADMAP.md` | Plan intégration dev externe session ~45 — références tables inexistantes (char_weapons, npc_templates) | Non |
| `REGLES_Contact.md` | Extrait LdB CaC uniquement — subset de `REGLES_LdB.md` qui couvre tout le combat (actions, déplacements, CaC, tir) | ✅ Contenu dans `docs/SYSTEME/REGLES_LdB.md` |

---

## Archivés sessions antérieures (pré-session 70)

Archivés avant la mise en place de ce README.

| Fichier | Nature | Contenu LdB / Note |
|---|---|---|
| `SYSTEME.md` | Monolithe technique — éclaté en `docs/SYSTEME/` (9 fichiers, session 65) | Supplanté par `docs/SYSTEME/` |
| `JOURNAL1.md` | Journal sessions 1–30 | Lire `docs/JOURNAL3.md` |
| `JOURNAL2.md` | Journal sessions 31–63 | Lire `docs/JOURNAL3.md` |
| `JOURNAL43.md`, `JOURNAL44.md` | Journaux intermédiaires session 44 | Supplanté par JOURNAL3 |
| `JREGLES.md` | Extraits LdB combat — valeurs portée incorrectes (−2/−4/−8 vs réel −5/−10/−15) | ❌ Incorrect — source de vérité : `docs/SYSTEME/COMBAT.md` |
| `PLAN_12_CONTACT.md` | Plan Sprint CaC 1/2/3 | ✅ fait sessions 67-68 — voir `docs/SYSTEME/COMBAT.md` |
| `PLAN_11_SYSCOMBAT.md` | Plan Chantier 11 Système Combat | ✅ fait — voir `docs/ROADMAP.md` |
| `PLAN_13_JetFavori.md` | Plan PLAN13 Jets Favoris | ✅ fait session 66 |
| `PLAN_chantier10.md` | Plan Chantier 10 Équipement | ✅ fait sessions 46–56 |
| `PLAN_INVENTORY.md`, `PLAN_EQUIPMENT.md` | Plans inventaire/équipement | ✅ faits |
| `PLAN_ARMUREBLESSURE.md`, `PLAN_CHAR_BLESSURE_v3.md` | Plans module armures/blessures | ✅ faits session 53-54 |
| `COMPLEMENT_CHAR_BLESSURE.md` | Complément spec blessures | Supplanté par `docs/SYSTEME/BLESSURES.md` |
| `PLAN_XP.md` | Plan module XP | ✅ fait session 37 |
| `PLAN_WORKSHOP.md` | Plan Atelier GM | ✅ fait |
| `PLAN_ENTITY.md`, `PLAN_ENTITE_v1.md`, `PLAN_ENTITE_v2.md` | Plans entités | ✅ faits |
| `PLAN_VOXELS.md` | Plan voxels | ✅ fait |
| `COMBAT_GOAL.md` | Spec objectifs combat initial | ✅ fait — voir `docs/SYSTEME/COMBAT.md` |
| `SPRINT7_NOTES.md` | Notes Sprint 7 | ✅ fait session 64 |
| `DEV_ASSAULT_DROPDOWN_GM.md` | Plan UI dropdown GM assault | ✅ fait |
| `WoundManager.jsx` | Composant JSX remplacé par `LocationPanel.jsx` session 55 | — |
| `ANALYSE_9AB.md`, `MISSION_chantier_9.md` | Planification chantier 9A/B | ✅ faits |
| `ARCHITECTURE_session14.md`, `CONVENTIONS_session14.md` | Docs d'architecture session 14 | Supplanté par `docs/SYSTEME/CONVENTIONS.md` |
| `JournalGemini.md` | Journal de travail avec Gemini (dev externe) | Historique |
| `journalChantier_FichePerso.md` | Journal chantier fiche personnage | Supplanté par JOURNAL3 |
| `Dice rework.md` | Notes Dice Rework | ✅ fait session 44 |
| `script Extraction Excel/` | Scripts extraction + seed data BDD Polaris | Seed appliqué session 70 — `2_seed_equipment.js` en prod |
| `Planification DiceRewok2/` | Plans intermédiaires dés V2 | Supplanté par implémentation finale |
| `bruno/` | Collection Bruno API tests | Remplacé par tests manuels |
