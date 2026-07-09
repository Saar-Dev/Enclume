# PLAN_MUTATION2 — Effets mécaniques des Mutations et Avantages jamais appliqués
> Session 141 (suite 9) — 2026-07-09
> Statut : **DIAGNOSTIC UNIQUEMENT — pas de code**. Mis de côté pour une session dédiée future,
> sur demande explicite de Saar. Trouvé en testant le Lot D d'`AdvantagesPanel.jsx`
> (`docs/PLAN_ADVANTAGESPANEL.md`), mais le problème est **plus large que ce chantier** — il touche
> tout personnage, Wizard inclus, pas seulement les mutations octroyées en jeu.

---

## Contexte

En validant le Lot D (MJ octroie une mutation à un personnage déjà verrouillé), Saar a demandé :
*"ajouter une mutation implique forcément d'appliquer les EFFETS de la mutation (accès à une
compétence, perte ou gain de statistiques, etc...). Est-ce qu'on le gère dans le Wizard ça ?"*

Réponse vérifiée `[VÉRIFIÉ]` par recherche exhaustive dans le code (pas une supposition) : **non,
le Wizard ne le gère pas non plus.** Ce n'est pas une régression ni un oubli du Lot D — c'est un
gap architectural pré-existant, jamais comblé depuis la création des tables `ref_mutations`
(migration 95) et `ref_advantages` (migration 92).

Même diagnostic demandé pour les Avantages — **situation identique, confirmée par la même méthode
de recherche**, et même plus large en surface (76 lignes `ref_advantages` concernées contre 33
`ref_mutations`).

---

## Diagnostic — Mutations `[VÉRIFIÉ]`

- `char_mutation_effects_view` (créée migration 96, réécrite migration 109) agrège déjà
  `mod_FOR`/`mod_CON`/`mod_COO`/`mod_INT`/`mod_VOL`/`mod_PRE` + résistances + armure naturelle de
  toutes les mutations `status='active'` d'un personnage. **Recherche exhaustive (`grep` server +
  client) : cette vue n'est interrogée nulle part.** Vue morte depuis sa création.
- Plus profond que "juste la vue n'est pas branchée" : `calcNA(base_level, pc_modifier,
  mod_genotype)` (`server/src/lib/charStats.js:195`) — la fonction qui calcule le niveau final d'un
  attribut — **n'a que 3 paramètres**. Aucune place prévue pour un modificateur de mutation. Le
  calcul d'attribut n'a jamais été conçu pour recevoir un effet de mutation, pour personne.
- Conséquence concrète : un personnage avec la mutation "Caractère félin" (`mod_COO: 2`,
  `mod_acrobatie: 3` dans l'ancien schéma V1 — colonnes réelles actuelles à revérifier contre
  `ref_mutations`) n'a jamais eu ce bonus appliqué à sa fiche, qu'il l'ait choisie au Wizard Step3
  ou (désormais) reçue en jeu via le Lot D.
- Compétences débloquées par une mutation (ex. Maîtrise de la Force Polaris) : dette **`[CS7]`**,
  **transférée ici depuis `docs/PLAN_ADVANTAGESPANEL.md` Lot E** (décision Saar, Session 141
  suite 9 — les deux dettes "effets de mutation jamais appliqués" et "compétences liées à une
  mutation jamais débloquées" sont la même famille de problème, elles vivent ensemble). Détail
  complet ci-dessous, section dédiée.

## Diagnostic — Avantages `[VÉRIFIÉ]`

- `ref_advantages` a 12 colonnes de modificateurs potentiels : `mod_attribute`/`mod_value`,
  `mod_resistance`/`mod_res_value`, `mod_conditions` (JSONB), `mod_gauges` (JSONB), `mod_identity`
  (JSONB), `mod_savings`, `mod_monthly_income`/`mod_monthly_income_formula`, `mod_skill_points`,
  `mod_age`. Recherche exhaustive (`grep` server + client) sur ces 9 noms de colonnes : **aucune
  n'est lue en dehors des migrations qui les créent.**
- **Seule exception trouvée** : `adv_076` (Fécondité) → `char_archetype.is_fertile` — mais c'est un
  `if (advantageId === 'adv_076')` codé en dur dans `advantageService.js`, **pas** une lecture
  générique de `mod_identity` (qui contient pourtant `{is_fertile: true}` pour cette ligne). Même
  chose pour `adv_002` "Ambidextre" (`mod_identity: {hand_pref: "A"}`) : jamais appliqué, colonne
  ignorée.
- Sur 76 lignes `ref_advantages`, ~74 ont donc leurs effets mécaniques déclarés en base mais
  **jamais appliqués** : `adv_006` "Bons réflexes" (+3 Réaction), `adv_018` "Dur à cuire" (-1
  Résistance Dommages), `adv_020` "Formation" (+7 pts Compétence), `adv_003`/`adv_029` (argent/
  rente), etc. — aucun n'a d'effet réel sur la fiche ou le combat aujourd'hui.
- Plus large que les mutations en surface (plus de lignes concernées), mais racine identique :
  schéma bien conçu pour porter des effets, jamais raccordé à un pipeline de calcul.

---

## Pistes de résolution (non tranchées — à décider en session dédiée)

**Piste A — Agrégation à la lecture (cohérent avec le style déjà en place dans ce projet)**
Étendre `charStats.js` avec une fonction qui agrège les modificateurs actifs (mutations +
avantages) à chaque calcul de fiche, et étendre `calcNA` (ou lui adjoindre un 4ᵉ paramètre) pour
les inclure. Similaire dans l'esprit à `getAgeEffects()` (`shared/polarisUtils.js`) qui recalcule
un état absolu à chaque fois plutôt que d'accumuler — cohérent avec la convention déjà établie
dans ce projet (voir commentaire `creationService.js` STEP4 : *"set absolu (pas increment) : rejouer
la reconciliation... recalcule au lieu de cumuler"*). Pas de risque de double-application. Nécessite
de finir de brancher `char_mutation_effects_view` (mutations, colonnes fixes, facile) + construire
l'équivalent pour les avantages (plus complexe : `mod_attribute`/`mod_value` sont une paire
générique texte/nombre, pas des colonnes dédiées — agrégation dynamique par `switch`/mapping).

**Piste B — Application à l'écriture**
Appliquer les modificateurs directement sur `char_attributes`/tables cibles au moment de
l'ajout/retrait d'une mutation ou d'un avantage. Écarté a priori : plus fragile (il faut annuler
exactement le bon delta au retrait, risque de double-application si rejoué), et va à l'encontre du
pattern "recompute" déjà choisi ailleurs dans ce projet pour des raisons similaires.

**Piste C — Scope réduit, priorisé**
Ne pas viser l'exhaustivité des 12 colonnes de suite. Prioriser ce qui a un impact combat/mécanique
réel (`mod_attribute`/`mod_value`, `mod_resistance`/`mod_res_value`, mutations `mod_FOR..PRE` +
résistances) avant le narratif/économique (`mod_savings`, `mod_monthly_income`, `mod_conditions`,
`mod_gauges`) qui peut rester géré par le MJ manuellement plus longtemps sans bloquer le jeu.

**Recommandation (faible, à discuter)** : Piste A pour la cohérence architecturale + Piste C pour
le séquencement (ne pas tout faire d'un coup). Aucune de ces trois pistes n'a été creusée en
profondeur (pas de recherche de bonnes pratiques externes à ce stade) — à faire en ouverture de la
session dédiée.

---

## Dette transférée — `[CS7]` `SkillsPanel.jsx activeMutations` (ex-Lot E `PLAN_ADVANTAGESPANEL.md`)

Trouvé en creusant PC14 (`docs/Character/CHARACTER.md`) pendant l'analyse du Lot A d'
`AdvantagesPanel.jsx` — même cause racine que le diagnostic mutations ci-dessus (données jamais
branchées), rayon d'impact plus large. Transféré ici (Session 141 suite 9, décision Saar) car il
appartient à la même famille de problème que ce plan, pas au chantier `AdvantagesPanel.jsx`.

- `SkillsPanel.jsx:135-141` (`activeMutations`) reproduit exactement le même bug que
  `AdvantagesPanel.jsx` avant ses Lots A-D : lit `charAdvantages.type === 'MUTATION'` +
  `.muta_numero`, des champs qui n'existent dans aucune ligne V2 réelle → Set **toujours vide**.
- Conséquence vérifiée en base réelle (`ref_skill_requirements where type='MUTATION'`, 10 lignes) :
  `MUTATION_CONTAGION`, `MUTATION_CONTROLE_MOLECULAIRE`, `MUTATION_EMPATHIE`,
  `MUTATION_METAMORPHOSE`, `MUTATION_PURULENCE`, `MUTATION_RADIATIONS`, `MUTATION_SONAR`,
  `MUTATION_AGILITE_CAUDALE`, `MAITRISE_DE_LA_FORCE_POLARIS`, `MAITRISE_DE_LECHO_POLARIS` sont
  **structurellement invisibles pour tout personnage**, quelle que soit la mutation réellement
  possédée dans `char_mutations` — aucune erreur, aucun signal (pattern silencieux déjà vu P54/P56).
- Piste de correction (non détaillée, pas encore planifiée ligne à ligne) : `activeMutations`
  doit être dérivé de `char_mutations` (déjà correctement peuplé par le Wizard Step3 **et
  désormais par le Lot D**, `docs/PLAN_ADVANTAGESPANEL.md`), pas de `charAdvantages` — nécessite de
  faire remonter `char_mutations` jusqu'à `SkillsPanel.jsx` (déjà fait pour `AdvantagesPanel.jsx`
  via `charMutations`/`mutationService.getMutations`, potentiellement réutilisable).
- **Interaction à surveiller avec le Lot A** (`AdvantagesPanel.jsx`) : les 2 skills
  `MAITRISE_DE_LA_FORCE_POLARIS`/`MAITRISE_DE_LECHO_POLARIS` ont aujourd'hui un prérequis
  `type:'MUTATION', value:'muta_029'` dans `ref_skill_requirements` — un gate distinct de celui
  d'`AdvantagesPanel.jsx` (`adv_079` "Force Polaris"), actuellement inopérant (Set toujours vide)
  mais qui redeviendrait un vrai blocage contradictoire si `[CS7]` est corrigé sans revoir ce
  prérequis (un personnage avec `adv_079` mais sans la mutation `muta_029` resterait bloqué sur ces
  2 compétences précises). À trancher en session dédiée.

---

## Impact / risque si on ne fait rien

Aucune régression introduite par le Lot D — ce gap existait déjà pour tout personnage créé par le
Wizard, silencieusement, depuis le début du projet. Le Lot D ne fait que le rendre visible plus tôt
(Saar a testé et remarqué l'absence d'effet immédiatement après un ajout). Pas d'urgence
technique — c'est un manque de fonctionnalité, pas un bug qui casse quelque chose de fonctionnel.

## Ce qui n'est PAS dans ce plan

Le reste d'`AdvantagesPanel.jsx` (Lots A/B/C, le "bookkeeping" du Lot D — ajout/retrait/affichage
d'une mutation) est **fonctionnel et clos**, voir `docs/PLAN_ADVANTAGESPANEL.md`. Ce plan couvre
uniquement : les effets **chiffrés** jamais appliqués (attributs, résistances, armure, économie) et
`[CS7]` (déblocage de compétences liées à une mutation).
