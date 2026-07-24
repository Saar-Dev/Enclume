# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-07-21 — Moding Groupe 4 : chantier clos (Phases 1/3/4 codées et testées, dettes résiduelles dans `docs/BUGIDENTIFIE.md`).
> Ce document est prospectif. L’historique complet est dans `docs/ASBUILT.md` et `docs/JOURNAL6.md`.
> **Bugs et dettes techniques** : voir le registre unique `docs/BUGIDENTIFIE.md`.

---

## Phase 2 — Battlemap 3D + session de jeu (en cours)

### Chantier 11 — Module Blessures
- Étape 4 : Polish — animations Tests de Choc, états santé (Étourdi/Inconscient/Coma) — 🔲

### Chantier `PLAN_MUTATION2.md` — Mutations & Avantages
- Lot 7 : Narratif/économie (priorité basse) — 🔲

### Chantier 11 — Système de Combat Polaris
- Dette INI5 : audit forfait Initiative CaC — 🔲

### Options de campagne
- `revers` — 🔲
- `skill_natural_prog` — 🔲
- `celebrity` — 🔲

### Autres chantiers immédiats
- Upload screenshot éditeur → MinIO — 🔲
- Jets Favoris : drag‑to‑reorder macros (UI) — 🔲
- Paramètre campagne GM entity move mode (reporté) — 🔲

---

## Phase 3 — Polish + assets
- Scènes 2D ambiance
- Avatars utilisateur
- Optimisation voxel face culling
- Persistance viewport caméra
- Reconnexion WebSocket
- Favicon application

---

## Chantiers futurs — à planifier
- Arts Martiaux (techniques offensives/défensives, Saisie/Lutte)
- LOS & Raycast (replanifier avec Kiwi)
- Catastrophes (seuil à formaliser)
- Fatigue, Maladies/Poisons, Drogues, Irradiations, Faim/soif, dangers environnementaux (Chute/Feu/Froid/Noyade), horloge de campagne — `docs/PLAN_FATIGUE_DOMMAGES.md`, plan en 10 lots, Lot 0 (cadrage) clos, aucun code
- Exo‑armures (manuel existant, jamais implanté)
- Tourelles / armes lourdes fixes (entités interactives)
- Moding Groupe 4 (slot logiciel) — chantier clos (Session 167, architecture `docs/SYSTEME/MODING.md`, Phases 1/3/4 codées et testées) ; 4 dettes résiduelles `docs/BUGIDENTIFIE.md` (`MODING4-*`) ; migration Groupe 1/2 (Phase 2) reportée (Strangler Fig)
- Badges statut token (chantier UI/UX)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus)
- Export PDF fiche personnage
- Wizard création à deux (GM + joueur)
- Matériel → objets réels (conversion dans inventaire)
- Chat persistant (historique)
- Chat MP (messagerie privée)
- Mode spectateur
- Sauvegarde/export carte 3D
- Environnement carte 2D (Roll20‑like)

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques