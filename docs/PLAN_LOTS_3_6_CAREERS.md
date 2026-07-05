# PLAN_LOTS_3_6_CAREERS — Vérification + implantation lots 3 à 6
> Session 134 (2026-07-05) — Statut : **Tâche 1/2/3 terminées côté code — validation fonctionnelle navigateur en attente**
> Migrations 112-116 appliquées et testées (round-trip up/down/up), 37/37 carrières en base,
> 0 orphelin FK, 0 carrière sans illustration. Détail : `docs/JOURNAL6.md` "Session 134".

---

## Contexte

Suite lot 2 (migration 108) : vision globale demandée par Saar sur l'état des lots 1-6
(sources vérifiées ? FK ok ? illustrations ?) avant de continuer. Séquence actée :
1. Vérifier tous les lots restants (skill_id + illustrations MinIO) avant d'écrire du code
2. Puisqu'on retouche les seeds, inclure les illustrations directement dans chaque migration
   (au lieu d'une migration séparée comme pour lot1/lot2)
3. Implanter (écrire + appliquer) seulement une fois tout vérifié

Grâce à la FK ajoutée en migration 111 (`docs/PLAN_CAREER_SKILLS_FK.md`), la vérification
skill_id devient une garantie DB automatique pour tout nouveau seed — un `skill_id` invalide
sera rejeté à l'insert. Reste à vérifier manuellement les fichiers illustration MinIO (aucun
garde-fou DB pour ça) et l'exactitude des champs libres (`required_genotype` notamment).

## État — Tâche 1 (vérification)

| Lot | Carrières | skill_id vérifiés (DB) | Illustrations vérifiées (MinIO) | Anomalie trouvée |
|---|---|---|---|---|
| 3 | marchand, marchand_itinerant, medecin_chirurgien, mercenaire, mineur | ✅ 63/63 | ✅ 5/5 | — |
| 4a | officier_naval_civil, officier_naval_militaire, officier_militaire_souterrain, officier_militaire_surface, ouvrier_docker | ✅ 44/44 | ✅ 5/5 | — |
| 4b | pilote_chasse_sous_marin, pilote_chasse_atmospherique, pirate | ✅ 42/42 | ✅ 3/3 | — |
| 5 | policier_enqueteur, pretre_trident, prostitue, scientifique_ingenieur, soldat_milicien | ✅ 52/52 | ✅ 5/5 | — |
| 6 | soldat_elite_commando_marin/souterrain/surface, soldat_elite_forces_speciales, sous_marinier, technicien_mecanicien, techno_hybride, veilleur, voleur_criminel | ✅ 76/76 | ✅ 9/9 | **`techno_hybride.required_genotype` : `'techno_hybride'` (inexistant) → doit être `'TEC_HYB'`** (même bug que hybride_trident lot2, `ref_genotypes` confirmé : `HUMAIN`/`HYB_NAT`/`GEN_HYB`/`TEC_HYB`) |

**Codes carrière** : tous vérifiés libres (aucun déjà en base) pour les 27 carrières des lots 3-6.

## Mapping illustrations (lots 3-6, tous vérifiés MinIO)

| Code | Illustration |
|---|---|
| marchand | assets/s4_marchand.webp |
| marchand_itinerant | assets/s4_marchanditinerant.webp |
| medecin_chirurgien | assets/s4_medecin.webp |
| mercenaire | assets/s4_mercenaire.webp |
| mineur | assets/s4_mineur.webp |
| officier_naval_civil | assets/s4_officier_naval_civil.webp |
| officier_naval_militaire | assets/s4_officier_naval_militaire.webp |
| officier_militaire_souterrain | assets/s4_officier_militaire_souterrain.webp |
| officier_militaire_surface | assets/s4_officier_militaire_surface.webp |
| ouvrier_docker | assets/s4_docker.webp |
| pilote_chasse_sous_marin | assets/s4_pilote_chasse_sous_marin.webp |
| pilote_chasse_atmospherique | assets/s4_pilote_atmospherique.webp |
| pirate | assets/s4_pirate.webp |
| policier_enqueteur | assets/s4_enqueteur.webp |
| pretre_trident | assets/s4_pretretrident.webp |
| prostitue | assets/s4_prostitue.webp |
| scientifique_ingenieur | assets/s4_scientifique.webp |
| soldat_milicien | assets/s4_soldat.webp |
| soldat_elite_commando_marin | assets/s4_soldat_elite_commando_marin.webp |
| soldat_elite_commando_souterrain | assets/s4_soldat_elite_commando_souterrain.webp |
| soldat_elite_commando_surface | assets/s4_soldat_elite_commando_surface.webp |
| soldat_elite_forces_speciales | assets/s4_soldat_elite_forces_speciales.webp |
| sous_marinier | assets/s4_sousmarinier.webp |
| technicien_mecanicien | assets/s4_technicien.webp |
| techno_hybride | assets/s4_technohybride.webp |
| veilleur | assets/s4_veilleur.webp |
| voleur_criminel | assets/s4_voleur.webp |

## Décision scope (confirmée Saar)

Toutes les tables enfants peuplées pour chaque lot (skills, titres, education,
point_categories, equipment, random_benefits, illustration) — comme au lot 2, même si
equipment/random_benefits/point_categories restent non consommés par le code actuel
(voir `docs/PLAN_CAREER_SKILLS_FK.md` § Décision annexe).

**Simplification actée** : `skill_group` n'existe plus dans le schéma (migration 111) —
les migrations de seed pour lots 3-6 n'incluent PAS ce champ (il serait rejeté par
PostgreSQL, colonne inexistante), contrairement aux fichiers `.cjs` sources qui le
contiennent encore (résidu pré-refactor, à ignorer).

## Tâche 2/3 — Migrations à écrire (seed + illustration incluse)

| Migration | Lot | Statut |
|---|---|---|
| 112 | Lot 3 (5 carrières) | à écrire |
| 113 | Lot 4a (5 carrières) | à écrire |
| 114 | Lot 4b (3 carrières) | à écrire |
| 115 | Lot 5 (5 carrières) | à écrire |
| 116 | Lot 6 (9 carrières) | à écrire |

Chaque migration suit le pattern établi (108/109 fusionnés) : `ref_careers` (avec
`illustration`) + `ref_career_skills` (sans `skill_group`) + `ref_career_titles` +
`ref_career_education` + `ref_career_point_categories` + `ref_career_equipment` +
`ref_career_random_benefits`. `down()` : `whereIn('code', CODES).delete()` (CASCADE).

Correction lot6 à appliquer au moment d'écrire la migration 116 :
`techno_hybride.required_genotype` : `'techno_hybride'` → `'TEC_HYB'`.

Round-trip `up`/`down`/`up` testé pour chaque migration avant de passer à la suivante
(process appris lot2 : éviter les fichiers de test dans `server/` — nodemon auto-applique
au moindre changement de fichier — utiliser `node -e` inline).
