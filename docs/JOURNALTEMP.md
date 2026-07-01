# JOURNALTEMP — Audit Wizard Session 129 suite 5
> 2026-07-01 — Contenu périssable (scratch pad analytique)

---

## TO-DO LIST — Observations terrain (à analyser un par un)

### STEP 2 — Génotype

| ID | Observation | Type |
|---|---|---|
| S2-1 | Modifier "Vos attributs après sélection" → "Evolution des attributs" | UI copy |
| S2-2 | Modifier en "Compétence spéciale : HYBRIDE" (format + majuscules) | UI copy |

---

### STEP 3 — Mutation

| ID | Observation | Type |
|---|---|---|
| S3-1 | Écran titre : supprimer le choix 3 "Aucune mutation" + ajouter "Aucune mutation" en **premier choix** du menu "Achat de mutation" | UX |
| S3-2 | Achat de mutation + Mutation aléatoire : basés sur mockup hardcodé, pas sur `ref_mutations` DB | Architecture |

---

### STEP 4 — Origine / Milieu / Formation / Études

| ID | Observation | Type |
|---|---|---|
| S4-B1 | **Vérification** : TOUTES les compétences affichées et leurs bonus sont-ils bien reportés et appliqués en DB ? | Test/Audit |
| S4-B2 | Mise en forme compétences : lien vers `ref_skills` pour afficher tooltips au mouseOver | UX/Feature |
| S4-B3 | Gestion des "au choix" (choice_group) — non implémenté | Feature |

---

### STEP 4 — Professions (Carrières)

| ID | Observation | Type |
|---|---|---|
| S4-C1 | Importer les autres seeds carrières (actuellement : 5 sur ~29) | Data |
| S4-C2 | Illustrations métiers uploadées dans MinIO `enclume-assets/assets/` : voir liste ci-dessous | Feature |
| S4-C3 | Compétences à 0 dans le récapitulatif — où sont les points à répartir par le joueur ? | Bug/UX |

**Assets MinIO disponibles :**
```
s4_archeologue.webp      s4_artisan.webp          s4_assassin.webp
s4_barman.webp           s4_contrebandier.webp    s4_diplomate.webp
s4_docker.webp           s4_eleveur.webp          s4_enqueteur.webp
s4_hybride.webp          s4_marchand.webp         s4_marchanditinerant.webp
s4_medecin.webp          s4_mercenaire.webp       s4_mineur.webp
s4_officiermilitaire.webp s4_officiernaval.webp   s4_pilote.webp
s4_pirate.webp           s4_pretretrident.webp    s4_prostitue.webp
s4_scientifique.webp     s4_soldat.webp           s4_soldatelite.webp
s4_sousmarinier.webp     s4_technicien.webp       s4_technohybride.webp
s4_veilleur.webp         s4_voleur.webp
```
(29 assets total — couverture complète de toutes les carrières prévues)

---

### STEP 4 — Récapitulatif

| ID | Observation | Type |
|---|---|---|
| S4-R1 | "PC dépensés : x / 20" → à supprimer | UI |
| S4-R2 | Selon les règles : il manque matériel, jauge ennemi/contact/alliés, etc. | Feature gap |

---

---

### BUGS identifiés en test

| ID | Observation | Fichier |
|---|---|---|
| BUG-S2-1 | ✅ Step 2 Technohybride — label `step2.conditionsTitle` manquant | creation.json |
| BUG-S4-1 | ✅ Step 4 "Délinquance/Criminalité" — encodage corrompu → migration 101 | 101_fix_background_names_encoding.js |

---

## STATUT

- [x] S2-1 ✅ — copy Génotype
- [x] S2-2 ✅ — copy Génotype
- [x] S3-1 ✅ — UX Mutation
- [ ] S3-2 — Architecture Mutation → ref_mutations
- [ ] S4-B1 — Audit compétences backgrounds
- [ ] S4-B2 — Tooltips ref_skills
- [ ] S4-B3 — Gestion "au choix"
- [ ] S4-C1 — Seeds carrières complètes
- [ ] S4-C2 — Illustrations MinIO
- [x] S4-C3 ✅ — `displayedSkills` filter (`mastery > 0 || allocatable`) — clos partiel (non testé : multi-carrières avec skills partagées)
- [x] S4-R1 ✅ — Supprimer "PC dépensés x/20"
- [ ] S4-R2 — Matériel + jauges au récap

---

## ORDRE D'ANALYSE SUGGÉRÉ (à confirmer)

Les items UI copy (S2-1, S2-2, S4-R1) sont triviaux — 1 Edit chacun.
Les items architecture (S3-2, S4-B1, S4-C1) nécessitent lecture de fichiers.
Les items feature (S4-B2, S4-B3, S4-C2, S4-R2) sont des sprints entiers.
