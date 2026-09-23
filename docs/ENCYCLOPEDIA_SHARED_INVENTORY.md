# ENCYCLOPEDIA_SHARED_INVENTORY

> Index des tables RAW de l'Encyclopédie et de leurs sources dans `shared/`.
> **Documentaire uniquement** — ne contient aucune valeur de règle, uniquement des pointeurs.
> Si une table `shared/` change, ce fichier ne change pas.
>
> Dernière mise à jour : 2026-09-23 (v1 — incomplet, voir §5 ; chapitre Personnages et statistiques §4bis).
> Voir `docs/ENCYCLOPEDIA_CONTEXT.md` §4 et `docs/PLAN_ENCYCLOPEDIA.md` §5 pour les invariants.

---

## 1. Objet et règle d'or

Ce fichier porte le mapping **nom RAW (article JSON) ↔ constante(s) `shared/`**. Il sert trois usages :

1. **Pendant la conversion** — « cette table existe-t-elle déjà ? » (colonne RAW)
2. **Pendant la relecture** — « cette table moteur est-elle documentée ? » (colonne orpheline)
3. **Pour le branchement** — savoir où ajouter une entrée dans `dataSources.js`

**Interdit** : copier une valeur. Si `TAILLE_MODS` évolue, ce document ne bouge pas.

Statuts :
- `branché` — la source est pointée dans `dataSources.js` et rendue dans un article
- `orpheline` — table `shared/` sans article identifié à ce jour
- `à localiser` — article demande une table, source inconnue
- `à créer` — aucune table `shared/` ni ailleurs, à créer

---

## 2. Chapitre — Tests et actions

| Nom RAW (article JSON) | Constante(s) `shared/` | Fichier | Statut |
|---|---|---|---|
| `DIFFICULTE_ACTION_MODIFICATEURS` | `DIFFICULTE_ACTION_MODIFICATEURS` | `polarisUtils.js` | branché |
| `DIFFICULTE_NON_ALEATOIRE_SEUILS` | `DIFFICULTE_NON_ALEATOIRE_SEUILS` | `polarisUtils.js` | branché |
| `MR_TABLE` | `MR_TABLE` | `polarisTestResolution.js` | branché |

**Vérifié avec Saar 2026-09-22** : pas de table manquante dans l'article Chance — `ACCOMPLISSEMENT_CHANCE`
retiré de cette liste, ce n'était pas un gap réel.

---

## 3. Chapitre — Combat

| Nom RAW (article JSON) | Constante(s) `shared/` | Fichier | Statut |
|---|---|---|---|
| `DEPLACEMENT_ACTION_MALUS` | `DEPLACEMENT_ACTION_MALUS` | `polarisUtils.js` | branché |
| `DISTANCES_DEPLACEMENT_SOL` | `DISTANCES_DEPLACEMENT_SOL` | `polarisUtils.js` | branché |
| `DISTANCES_DEPLACEMENT_EAU` | `DISTANCES_DEPLACEMENT_EAU` | `polarisUtils.js` | branché |
| `COMBAT_MULTIPLE_ADVERSAIRES_MALUS` | `COMBAT_MULTIPLE_ADVERSAIRES_MALUS` | `polarisUtils.js` | branché |
| `DISTANCE_TIR_MODIFICATEURS` | `PORTEE_MOD_COMP` | `combatSituationMods.js` | branché |
| `TAILLE_CIBLE_MODIFICATEURS` | `TAILLE_MODS` | `combatSituationMods.js` | branché |
| `MODIFICATEURS_CIRCONSTANCES_TIR` | `RANGED_SITUATION_MODS` | `combatSituationMods.js` | branché |
| `LOCALISATION_DOMMAGES_TABLE` | `LOC_TABLE` + `LOC_TABLE_CONTACT` | `armorConstants.js` | branché |
| `AIMED_LOCATION_MALUS` | `AIMED_LOCATION_MALUS` | `armorConstants.js` | branché |

---

## 4. Chapitre — États de santé

| Nom RAW (article JSON) | Constante(s) `shared/` | Fichier | Statut |
|---|---|---|---|
| `BLESSURE_SEUILS_TABLE` | `BLESSURE_SEUILS_TABLE` | `woundConstants.js` | branché |
| `COMPTEUR_BLESSURES_TABLE` | `WOUND_MAX_COUNTS` | `woundConstants.js` | branché |
| `BLESSURE_EFFETS_TABLE` (article blessures-description) | `BLESSURE_EFFETS_TABLE` + `WOUND_PENALTIES` | `woundConstants.js` | branché (2026-09-22) |
| `CHOC_DUREE_TABLE` | `CHOC_DUREE_TABLE` | `woundConstants.js` | branché (2026-09-22, créée — n'existait nulle part) |
| `DUREE_GUERISON_SOINS_TABLE` | `DUREE_GUERISON_SOINS_TABLE` (parallèle à `WOUND_HEALING`, voir son commentaire) | `woundConstants.js` | branché (2026-09-22) |
| `SEQUELLES_*` (×11, pas 12 — corrigé) | `SEQUELLES_TETE_*` (×3), `SEQUELLES_CORPS_*` (×2), `SEQUELLES_BRAS_*` (×3), `SEQUELLES_JAMBES_*` (×3) | `sequellesConstants.js` (nouveau fichier) | branché (2026-09-22) |
| `FALL_DAMAGE_TABLE` (article dommages-chutes) | `FALL_DAMAGE_TABLE` + `FALL_DAMAGE_GROUND_LEVEL` | `fallDamageConstants.js` | branché (2026-09-22 — existait déjà côté moteur, jamais branchée avant) |

**Note** : `WOUND_INFECTION` (woundConstants.js) reste orpheline côté dataTable — l'article
blessures-description la référence en texte/lien plutôt qu'en table (décision actée avec Saar
2026-09-22 : la donnée est déjà portée par les clés de `WOUND_INFECTION`, une table dédiée
dupliquerait l'information sans rien ajouter).

---

## 4bis. Chapitre — Personnages et statistiques (LdB p.112-114)

| Nom RAW (article JSON) | Constante `shared/` | Fichier | Statut |
|---|---|---|---|
| `APTITUDE_NATURELLE_TABLE` (article competences) | `AN_TABLE` | `polarisUtils.js` | branché (2026-09-23 — existait déjà, était orpheline) |
| `RESISTANCE_DOMMAGES_TABLE` (article resistance-dommages) | `RD_TABLE` | `polarisUtils.js` | branché (2026-09-23 — existait déjà, était orpheline) |
| `RESISTANCE_NATURELLE_TABLE` (article resistances-naturelles) | `RES_NAT_TABLE` | `polarisUtils.js` | branché (2026-09-23 — existait déjà, était orpheline) |
| `MODIFICATEUR_DOMMAGES_TABLE` (article modificateur-dommages) | `FORCE_MOD_DOMMAGES_TABLE` | `polarisUtils.js` | branché (2026-09-23, **créée** — n'existait nulle part) |

**Note** : `FORCE_MOD_DOMMAGES_TABLE` n'a **aucun consommateur moteur** (grep sur `shared/`, `server/src/`,
`client/src/` : aucune autre occurrence d'un modificateur de dommages en corps à corps lié à la Force).
Elle est aujourd'hui une donnée RAW pure, pas la représentation d'une règle appliquée. Si le moteur
combat applique ce modificateur ailleurs sous un autre nom, c'est une duplication à réconcilier ;
sinon, c'est une règle RAW non implémentée — dans les deux cas, à trancher hors encyclopédie.
Les lignes « Etc. » des trois tables à plafond (RD, Résistance naturelle, Modificateur) sont
ajoutées à la main dans les `transform*` de `dataSources.js` (la formule de dépassement n'est pas
figée en table côté `shared/`).

---

## 5. Tables `shared/` orphelines (aucun article identifié)

Ces tables existent dans `shared/` (repérées par grep), aucune n'est branchée à ce jour. À examiner lors des conversions à venir.
(`AN_TABLE`, `RD_TABLE`, `RES_NAT_TABLE` ont quitté cette liste le 2026-09-23 — voir §4bis.)

| Constante `shared/` | Fichier | Notes |
|---|---|---|
| `CAC_SITUATION_MODS` | `combatSituationMods.js` | Modificateurs CaC — cible probable : combat-contact |
| `EXO_RD_TABLE` | `exoConstants.js` | Table exo-armure (chapitre non communiqué) |
| `EXO_CONTACT_DAMAGE_TABLE` | `exoConstants.js` | idem |
| `EXO_GRAPPLE_MALUS_TABLE` | `exoConstants.js` | idem |
| `EXO_PRONE_RECOVERY_TABLE` | `exoConstants.js` | idem |
| `EXO_AVARIE_TABLE` | `exoConstants.js` | idem |
| `FATIGUE_LEVEL_MALUS` | `fatigueConstants.js` | Fatigue — cible probable : article fatigue |
| `FATIGUE_TEST_MALUS` | `fatigueConstants.js` | idem |
| `FATIGUE_CHOC_MALUS` | `fatigueConstants.js` | idem |
| `RANGE_BANDS` | `combatRange.js` | Noms de paliers de portée (déjà utilisés indirectement via `PORTEE_MOD_COMP`) |
| `GRENADE_FRAG_BANDS` | `combatRange.js` | Grenade frag — cible probable : armes-speciales |
| `SHOTGUN_SPREAD_BY_BAND` | `combatRange.js` | Fusil à pompe — idem |
| `CATASTROPHE_EFFECT_TABLE` | `catastropheEffectTable.js` | Effets de catastrophe |
| `QUALITY_TABLE` | `integrityRules.js` | Qualité matériel (équipement) |
| `DEFAULT_PNJ_ALLURES` | `polarisUtils.js` | Valeurs par défaut mécaniques — peut-être pas RAW |
| `DECOMPRESSION_PRESETS` | `environmentalHazardPresets.js` | Presets hazard — à vérifier RAW vs moteur |
| `CAREER_RANDOM_EFFECTS_BY_CODE` | `careerRandomEffectsData.js` | Création de carrière (Livre 1-2-3 ?) |
| `REVERS_EFFECTS_BY_NAME` | `reversEffectsData.js` | Revers (Livre 1-2-3 ?) |
| `BUILTIN_WORLD_EFFECTS` | `world/worldEffects.js` | ⚠ Piège bundle client — `shared/world/` ne doit pas être tiré par le client |

---

## 6. Zones incomplètes (v1)

- **Non couverts** : Livre 4 chapitre Force Polaris (cartographie faite, contenu à vérifier/réécrire
  partiellement), chapitre Expérience, Livres 1-2-3 (texte non communiqué)
- **Non couverts** : tous les fichiers `shared/` non grepés — la liste §5 est partielle (deux greps ciblés uniquement)
- **Non couverts** : Combat — audit paramètres moteur non tranché (Préparations, Enchaînement,
  modificateurs de contact — voir `PLAN_ENCYCLOPEDIA.md` §6), Froid/Feu (États de santé — constantes
  partielles ou absentes, investigation nécessaire avant branchement)
- **Résolu 2026-09-22** : `WOUND_PENALTIES` branché (via `BLESSURE_MALUS_TABLE`, article
  blessures-description). `WOUND_INFECTION` confirmée orpheline **par choix**, pas par oubli — voir §4
  note.

Une v2 consolidera ces zones au fil des conversions, sans jamais ajouter de valeur — uniquement des pointeurs.

---

## 7. Duplication résolue

| Constante | Fichier A | Fichier B | Statut |
|---|---|---|---|
| `DIFFICULTY_MOD_TABLE` (serveur, libellés français en dur) | `server/src/lib/charStats.js` | doublon de `DIFFICULTE_ACTION_MODIFICATEURS` (`shared/polarisUtils.js`) | **résolu 2026-09-22** |

**Résolu** : `DIFFICULTY_MOD_TABLE` supprimée — vérifiée non consommée par aucun code serveur (grep sur
tout `server/`, seule sa propre déclaration matchait) ni par aucun test. Autorité unique désormais
`DIFFICULTE_ACTION_MODIFICATEURS` (`shared/polarisUtils.js`). Tests `charStats.test.mjs` et
`combatantContextService.test.mjs` verts après suppression.