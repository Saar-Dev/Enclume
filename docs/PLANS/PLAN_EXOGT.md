# PLAN_EXOGT.md — Peuplement du Guide Technique dans `ref_exo_templates`

> Statut (2026-09-29) : **26 des 36 fiches d'exo-armures du Guide Technique insérées** (migration
> `380_ref_exo_templates_guidetech_seed.js`, `source_id = guide_technique`) — uniquement les champs
> transcrits **sans la moindre ambiguïté** depuis `docs/REGLES/GUIDE_TECHNIQUE_ARMURES.md`. Ce
> document liste tout ce qui a été volontairement laissé de côté : 10 fiches entières exclues, et
> des champs précis sur les 26 insérées (vitesses, modes de déplacement, quelques malus
> d'initiative, armement/systèmes complets). Rien n'a été deviné — consigne explicite de Saar
> (2026-09-29) : « Remplis ce qu'il est possible de remplir SANS LA MOINDRE AMBIGUÏTÉ. Le reste
> doit être noté ici. »
>
> Vérifié en base après migration : le filtre par source (`PLAN_SUPPLEMENTS.md` Lot A) et le tag
> visible sur le sélecteur Modèle (`PLAN_SUPPLEMENTS.md` §8) fonctionnent correctement avec ce vrai
> contenu — 42 modèles visibles une fois `guide_technique` activé pour une campagne (16 LdB + 26
> GT), deux fiches « Mentor » distinctes correctement affichées.

---

## 1. Question bloquante non résolue — notation de vitesse

Posée à Saar le 2026-09-29, **restée sans réponse** (Saar a demandé d'avancer sur le reste plutôt
que d'attendre) — toujours ouverte, bloque `base_speed_underwater`/`base_speed_surface` pour les
36 fiches sans exception.

Le Livre de Base (`SEEDEXO.md`) donne la vitesse directement dans l'unité de la base
(`base_speed_underwater`/`surface`, entiers = points de mouvement/VIT) : `Vitesse : sous l'eau : 10
(exo-palmes)` → `base_speed_underwater: 10`, aucune conversion.

Le Guide Technique utilise une notation composite jamais rencontrée dans le Livre de Base, ex.
Faust : `4 nœuds/1(1) (PIT) / 3 km/h/<1(1) (surface)`. Un motif proche existe dans
`REGLEDRONE.md` pour les drones (`VIT (points de mouv.) : X (Y) / Z nœuds`), qui confirme que la
valeur VIT est présente quelque part dans la notation — mais :

1. **L'ordre est inversé** entre drones (`VIT(Y)/nœuds`) et armures GT (`nœuds/VIT(Y)`) — jamais
   vérifié que c'est bien la même grammaire.
2. **Le sens du `(Y)` entre parenthèses n'est pas confirmé** (un palier d'allure ? un malus déjà
   appliqué ? autre chose ?).
3. **Certaines valeurs sortent en `<1`** (ex. Faust, surface — `<1(1)`), qui n'est pas un entier
   valide pour une colonne `integer`. Aucune règle confirmée pour ce que ça doit devenir (`0` ?
   `null` ? autre ?).

**Tant que ceci n'est pas tranché avec Saar (idéalement sur 2-3 exemples chiffrés), aucune valeur
de vitesse ne doit être insérée pour les fiches du Guide Technique.** Colonnes concernées, sur les
26 fiches déjà insérées : `base_speed_underwater`, `base_speed_surface`, `speeds_extra` — toutes
`NULL`/`[]` aujourd'hui. `underwater_movement_mode`/`surface_movement_mode` ont été laissés à leur
défaut schéma (`'vit'`) : **valeur non vérifiée contre la source**, à ne pas prendre comme un fait
tant que les vitesses elles-mêmes ne sont pas résolues.

---

## 2. Les 10 fiches exclues entièrement

Aucune ligne `ref_exo_templates` créée pour ces armures — insertion différée en bloc jusqu'à
résolution de l'ambiguïté citée pour chacune.

### 2.1 Catégorie hors de l'énumération existante (`EXO_CATEGORY_ORDER`, `shared/exoConstants.js`)

`category` est `NOT NULL` et l'énumération actuelle ne connaît que `exo-alpha, exo-0` à `exo-6`,
`exo-omega`. Ces 6 fiches donnent une catégorie avec un suffixe ou une forme que rien ne permet de
faire correspondre sans deviner :

| Armure | Section | Catégorie donnée par la fiche | Ambiguïté |
|---|---|---|---|
| Moloch | §1.7 | `Exo-4B` | Le suffixe « B » n'existe dans aucune énumération du dépôt — round vers `exo-4` perdrait l'info sans confirmation que c'est sans conséquence. |
| Orka | §1.12 | `Exo-4C` | Même problème, suffixe « C ». |
| Condor | §2.3 | `Exo-1 Delta` | Suffixe « Delta » — aucune trace ailleurs dans le dépôt d'un tel sous-type. |
| Sylph 56 | §3.10 | `Exo-1E` | Suffixe « E ». |
| Exo-Sol | §2.8 | `Exo-sol` | Ne correspond à aucune valeur de l'énumération (pas un gabarit numéroté). |
| Oméga | §1.11 | `Type : Exo-Oméga` **mais** `Catégorie : Véhicule léger (V-)` | Deux champs distincts dans la fiche, contradictoires quant à savoir lequel alimente la colonne `category` — `Véhicule léger (V-)` ressemble à une classification d'Échelle, pas à un gabarit d'armure. |
| Enigma | §2.7 | `Armure simple Oméga semi-mécanisée` | Ne ressemble à aucun gabarit standard ; probablement une armure hors-catalogue par nature (trouvée, pas fabriquée en série). |

### 2.2 Exo-Force non numérique

`base_exoforce` est `integer NOT NULL`. Ces fiches donnent une formule dépendant du pilote, pas une
valeur fixe :

| Armure | Section | Exo-Force donnée |
|---|---|---|
| Explora | §3.2 | `Force du pilote +5` |
| Enigma | §2.7 | `Force du pilote +18` |
| Exo-Sol | §2.8 | `Force du personnage +4` |
| Pirate (Classique) | §3.7 | `Force du personnage +4` |
| Sylaco | §3.9 | `Force du personnage +6` |

Explora, Enigma et Exo-Sol cumulent d'ailleurs déjà l'exclusion de catégorie (§2.1 pour Exo-Sol et
Enigma) — trois raisons indépendantes de ne pas insérer ces lignes, pas une seule.

**Décision à prendre avec Saar avant de débloquer ces 10 fiches** : soit une évolution de schéma
(`base_exoforce` acceptant une formule texte en plus d'un entier — impact sur tout le code qui lit
cette colonne comme un nombre, `computeExoStats` notamment), soit une valeur de référence acceptée
par convention (ex. Force de pilote standard = 10, donc Explora = 15) — **jamais tranché ici**.

---

## 3. Champs laissés de côté sur les 26 fiches insérées

### 3.1 Vitesses et modes de déplacement (les 26, sans exception)

Cf. §1 — `base_speed_underwater`, `base_speed_surface`, `speeds_extra` = `NULL`/`[]` ;
`underwater_movement_mode`/`surface_movement_mode` = défaut schéma `'vit'`, **non vérifié**.

### 3.2 Malus d'initiative non désambiguïsé (5 fiches sur 26)

Laissés à `0`/`0` (défaut schéma) plutôt qu'à la valeur donnée, faute de savoir à quelle colonne
l'attribuer :

- **Sirya IV** (§1.14), **Syd** (§1.15) : une seule valeur non étiquetée (`Malus d'initiative :
  -2` / `-3`) sur une fiche sous-marine — pourrait s'appliquer à la seule dimension pertinente
  (sous l'eau) mais aucune fiche du Guide ne confirme cette convention pour une valeur isolée.
- **Éclipse** (§2.5), **Endoval Mrk II** (§2.6) : fiches classées Terrestres mais avec une
  profondeur explicitement donnée (armures amphibies) — contrairement à Bulldog/Cobalt/Vauban où
  la valeur isolée a pu être attribuée sans risque à `malus_init_surface` (aucune capacité
  sous-marine documentée), ici la présence d'une profondeur interdit cette même simplification.
- **Varan** (§2.11) : `Modificateur d'initiative : +1` — un **bonus**, pas un malus, avec un nom de
  champ différent de toutes les autres fiches. Aucune colonne `malus_init_*` ne représente
  proprement un bonus positif sans convention de signe confirmée.

### 3.3 Profondeur partielle (2 fiches)

**Endoval Mrk II** (§2.6) et **Solar 1** (§2.10) : une seule valeur de profondeur donnée (« 100 m »
/ « 100 m si lestée »), pas le triplet Opérationnelle/Limite/Écrasement. `depth_operational` posé à
100, `depth_limit`/`depth_crush` laissés `NULL` plutôt que déduits d'un ratio — le ratio ×1,2/×1,5
observé sur la majorité des fiches à triplet complet **n'est pas universel** : Assassin (§3.1) a
`Limite = Opérationnelle` (17 000 m les deux), donc appliquer le ratio ailleurs sans triplet complet
aurait été une supposition, pas une transcription.

### 3.4 Armement, systèmes auxiliaires/vitaux, ordinateurs — aucune des 36 fiches

Le Guide Technique donne, pour chaque armure, des listes d'armement et de systèmes par leur nom
propre (« Sonscan actif Dauphin II », « Lance-harpon lourd, 10 charges »). Les rattacher à
`ref_exo_template_equipment`/`ref_exo_template_computers` (le loadout copié par `applyExoTemplate`)
demande de faire correspondre chaque nom à une ligne `ref_equipment` existante, ou d'en créer une
nouvelle — chantier de contenu à part entière (terrain du Lot B, `PLAN_SUPPLEMENTS.md` §2.5),
largement plus gros que le peuplement des stats de base fait ici. **Volontairement hors périmètre
de cette première passe**, pas oublié.

### 3.5 Autres notes de transcription (non bloquantes, juste documentées)

- **Sirya IV** (§1.14) : le texte source note lui-même une coquille probable (« Sirya IV » pour
  « Syria IV » — le fichier illustration existant est `exo_syria4.png`). Le nom retenu en base est
  celui du titre de fiche (« Sirya IV »), littéral — à corriger si Saar confirme la coquille.
- **Prix « avec RTG »** (Cougar, Typhon) : seul le prix de base a été retenu (ex. Typhon 300 000,
  pas 500 000 « avec RTG ») — la variante RTG n'a pas de colonne dédiée dans `ref_exo_templates`.
- **Manufacturer** : `Fabricant (Nation)`, ou juste `Fabricant` quand les deux sont identiques (ex.
  Pirates, Empire des Généticiens) — jamais de duplication inutile.
- **tech_level** : `/` normalisé en `-` pour matcher la convention déjà en place (« III/IV » du
  Guide → « III-IV », comme les entrées LdB existantes).

---

## 4. Prochaines étapes possibles (non décidées, à discuter avec Saar)

1. Résoudre la notation de vitesse (§1) avec 2-3 exemples chiffrés confirmés par Saar, puis
   compléter `base_speed_underwater`/`surface`/`speeds_extra`/modes sur les 26 fiches déjà
   insérées (`UPDATE`, pas une nouvelle migration d'insertion).
2. Décider du traitement des 5 malus d'initiative non désambiguïsés (§3.2) et des 2 profondeurs
   partielles (§3.3) — cas par cas, chacun a sa propre raison de blocage.
3. Trancher le schéma pour les Exo-Force non numériques (§2.2) avant de débloquer Explora, Enigma,
   Exo-Sol, Pirate (Classique), Sylaco.
4. Décider quoi faire des 6 catégories hors énumération (§2.1) : étendre `EXO_CATEGORY_ORDER`,
   ou les traiter comme des variantes d'une catégorie existante (perte d'info assumée) ?
5. Chantier séparé, plus gros : loadout armement/systèmes/ordinateurs (§3.4) — dépend du Lot B.
