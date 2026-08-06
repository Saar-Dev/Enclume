# PLAN_COMBATANT_CONTEXT.md — Découpler la résolution de Test combat de `char_sheet`

> Créé : 2026-08-06 (dev/Saar). Statut : **planification uniquement, aucun code écrit.**
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md` (nouvelle section "Contexte de
> Test par type de combattant").
> Responsabilité unique de ce document : permettre à `socketCombatHelpers.js` de résoudre un Test de
> combat (Seuil, malus, ModDom) pour un combattant dont les données ne vivent pas sur un simple
> `char_sheet` — sans jamais fusionner les types de combattant entre eux, sans jamais dupliquer des
> stats d'un personnage vers un autre. Ni un plan de dédup (`docs/PLANS/PLAN_RW_SYSCOMBAT.md`), ni le
> plan de la fonctionnalité Exo-armures elle-même (`docs/PLANS/PLAN_EXOARMURE.md`, qui reste seul
> responsable des règles RAW détaillées de l'exo-armure) — un problème d'architecture serveur précis.
> Origine : `EXOARM-COMBATFILE` (`docs/EN_COURS.md`) — bloque `docs/PLANS/PLAN_EXOARMURE.md` Lot 2
> (plafond de Compétence par Manœuvre d'armure, 1 seule Attaque/Tour).

---

## 0. Cadrage — décisions actées avec Saar (2026-08-06)

1. **Portée de ce plan** : le point de couture générique de résolution de Test combat — d'où vient un
   Seuil, un malus, un ModDom pour *n'importe quel type* de combattant. Pas les règles RAW détaillées
   de l'exo-armure elle-même (plafond exact par spécialité de Manœuvre d'armure, 1 seule Attaque/Tour,
   table EXF→ModDom) : ça reste `docs/PLANS/PLAN_EXOARMURE.md` Lot 2, qui **reprend** une fois ce plan
   clos, pas mélangé ici (`CLAUDE.md` §13, un plan = un problème).
2. **Substitution d'attributs — règle générale actée (Saar, 2026-08-06)** : les attributs utilisés en
   combat pour un pilote d'exo-armure sont **ceux du pilote**, sauf exception RAW explicite. Deux
   exceptions déjà connues et vérifiées :
   - **FOR → EXF** (`docs/MANUELS/MANUEL_EXOARMURE.md:171,175` — *"La FOR du pilote est ignorée pour
     les dommages au contact et la capacité de port. On utilise l'EXF."*) — s'applique à `modDom`/
     `for_na` côté dégâts et encombrement, jamais aux autres calculs d'Attribut.
   - **VIT → mouvement** (COO+Athlétisme pour `calcAllures`) — déjà tranché et codé
     (`PLAN_EXOARMURE.md` §7.4), hors périmètre de ce plan (fichier autonome
     `movementBudgetService.js`, aucun rapport avec `socketCombatHelpers.js`).
   - Toute autre substitution éventuelle (au-delà de FOR/VIT) reste à instruire au cas par cas dans
     `PLAN_EXOARMURE.md` Lot 2 — l'architecture de ce plan doit juste être **capable** d'exprimer une
     substitution par attribut, pas figer aujourd'hui la liste complète.
3. **Jamais de duplication de stats entre personnages** — jamais copier les stats du pilote dans une
   fiche exo, ni l'inverse. Toujours lu à la volée au moment du Test (voir §1, patron Lancer/Starfinder
   déjà validé par la recherche `PLAN_EXOARMURE.md` §4 pour le *stockage* ; ce plan l'étend à la
   *résolution de Test*, jamais traitée jusqu'ici).
4. **Migration en deux temps, jamais mélangés** : d'abord extraire le chemin humain existant
   (comportement identique, zéro risque RAW) vers le point de couture unique ; la branche `'exo'`
   n'est ajoutée qu'une fois ce socle validé stable — jamais dans le même lot (§3).

---

## 1. Recherche (patrons pro) — étend `PLAN_EXOARMURE.md` §4, ne la refait pas

`PLAN_EXOARMURE.md` §4 a déjà établi, par lecture de code réel (API GitHub, pas de déduction) :
**Pilote et Mech = deux `Actor` distincts et persistants, jamais fusionnés** (`Eranziel/foundryvtt-lancer`,
`pilot.ts:11`/`mech.ts:33`) ; **stats jamais copiées, injectées à la volée** ; **stats dérivées jamais
stockées** (patron `prepareData()`). Ce plan-ci s'appuie sur ces décisions déjà actées (§0.3) et ajoute
la couche manquante : **comment la résolution d'un Test (pas juste l'affichage d'une fiche) va chercher
la bonne donnée au bon endroit.**

**Nouveau — `Eranziel/foundryvtt-lancer`, architecture des Flows (`docs/flow_api.md`) :**
- Une "Flow" est une classe abstraite à étapes composables : *"Specific flows are implementations of
  the `Flow` abstract class. Each flow type has a pre-defined list of steps, which are either functions
  or another flow."* — chaque étape lit/enrichit un état central partagé, jamais une resynchronisation
  ad hoc entre étapes.
- Point d'entrée unique par Actor source : `new Flow(source, stateData)` — que la source soit un
  pilote, un mech ou une arme, tous les appelants passent par la même forme d'entrée. Confirme
  directement le patron déjà en place dans Enclume (`ctx` assemblé par la coquille, `ok`/ `{ suspend,
  emissions }`, `docs/PLANS/PLAN_RW_SYSCOMBAT.md` §1.5/§2.1) — pas une architecture à réinventer, une
  confirmation externe du même principe.
- Le bonus d'attaque d'un mech ("Grit") est une stat qui **vit sur l'Actor pilote**, lue au moment du
  jet — jamais copiée sur le mech. Exactement l'équivalent RAW recherché : Manœuvre d'armure vit sur le
  personnage pilote, jamais sur `exo_sheet`.

**Nouveau — Starfinder (`foundryvtt-starfinder`), combat de vaisseau :**
- Chaque poste d'équipage (Capitaine, Pilote, Canonnier, Chef mécano) **lance sa propre Compétence**
  pour faire agir le vaisseau — jamais une Compétence dupliquée sur la fiche du véhicule. Deuxième
  confirmation indépendante (après Lancer) du même principe : *le combattant qui résout un Test est
  toujours celui qui possède la Compétence, jamais l'engin qu'il pilote.*

**Confronté à l'existant Enclume — F2 déjà en vigueur, pas une nouveauté à importer.**
`docs/SYSTEME/SERVICES_COMBAT.md` §8, code F2 : *"`resolveDroneAssaultAction` a 3 branches distinctes...
Ne pas uniformiser."* Déjà appliqué et validé deux fois dans `socketCombatHelpers.js`
(`docs/PLANS/PLAN_RW_SYSCOMBAT.md` Lots 2/4/6, branches Pj/Pnj/Drone jamais fusionnées). Les 3 sources
(Lancer, Starfinder, F2 interne) convergent sur un seul principe : **dispatcher par type de combattant,
jamais fusionner ; ne jamais copier une donnée d'un personnage vers un autre, la lire à la source à
chaque Test.** Aucune architecture nouvelle à inventer — ce plan applique un principe déjà en vigueur
dans ce fichier à une zone qui y a échappé jusqu'ici (la résolution de Test elle-même, pas seulement le
branchement attaquant/défenseur).

**Écarté explicitement — registre/plugin générique.** Un système à `registry.register('exo',
resolver)` (pattern plugin) a été envisagé puis écarté : ce projet a déjà tranché ce débat pour un
problème structurellement identique (`PLAN_RW_SYSCOMBAT.md` §1.3, Railway-Oriented Programming écarté
au profit d'une convention descripteur simple) — un registre ajouterait de l'indirection pour 2-3 types
de combattant réels (`pj`/`pnj` traités identiquement, `exo`), quand une suite de guard clauses
(`docs/SYSTEME/SERVICES_COMBAT.md` §8, catalogue Fowler déjà cité 3× dans ce projet) suffit et reste
lisible. Les drones, qui ne passeront jamais par ce point de couture (§2), confirment qu'un registre
générique pour "tout type de combattant possible" serait une sur-ingénierie pour un besoin qui ne s'est
jamais présenté.

---

## 2. État réel du code — 7 sites vérifiés par lecture intégrale (pas "~8", l'estimation initiale)

`PLAN_EXOARMURE.md` §7.1 estimait "~8 endroits" sans lecture exhaustive. Vérifié précisément par grep
puis lecture intégrale de chaque site : **exactement 7**, avec **deux comportements de panne distincts,
pas un seul** — distinction absente de la première estimation et qui change la priorité réelle des
sites.

| # | Fonction | Ligne | Rôle | Comportement actuel si pas de `char_sheet` |
|---|---|---|---|---|
| 1 | `isTargetDefenseless` | L.1225 | Cible — vérifie Blessure mortelle (DEF5) | **Gracieux** — `if (sheet)` garde déjà, retombe sur `false` (pas sans-défense). Priorité basse : dépend surtout du futur pipeline de dégâts exo (Lot 4 `PLAN_EXOARMURE.md`), pas de ce point de couture |
| 2 | `resolveMeleeAction` | L.1249 | **Attaquant CaC** | **Blocage dur** — `if (!sheetAttaquant) return { suspend:false, emissions }` : l'action est **silencieusement abandonnée**, aucune émission. Seul site réellement bloquant aujourd'hui |
| 3 | `resolveMeleeAction` | L.1556 | Défenseur CaC (cible) | Gracieux — `if (sheetCible) {...}`, sinon `defenderSkillTotal=0` (Test de défense toujours perdu, pas d'abandon) |
| 4 | `resolveDroneAssaultAction` | L.2335 | Cible PNJ/décor (drone attaquant) | Gracieux — `cibleSheet` optionnelle, replis `for_na:8,con_na:8,vol_na:8` |
| 5 | `resolveDroneAssaultAction` | L.2388 | Cible PJ (drone attaquant) | Gracieux — même repli que #4 |
| 6 | `resolveAssaultAction` | L.2589 | **Tireur** | Gracieux — `if (sheetTireur) {...}`, sinon `skillTotal=0` (Tir toujours raté, pas d'abandon) |
| 7 | `resolveAssaultAction` | L.2789 | Cible (Tir) | Gracieux — même repli que #4/#5 |

**Conséquence directe sur la priorité** : un pilote d'exo-armure ne peut **aujourd'hui pas du tout**
attaquer au corps à corps (site #2, abandon silencieux). Il *pourrait* déjà tirer ou se défendre — mais
toujours avec un Seuil de 0, donc un échec garanti, jamais un crash. Cette nuance manquait à la
première estimation (`PLAN_EXOARMURE.md` §7.1, qui décrivait "aucun personnage sans `char_sheet` ne
peut donc attaquer aujourd'hui" comme un seul comportement uniforme) — vérifiée fausse pour 6 sites sur
7 : ce n'est pas qu'ils ne "peuvent pas" agir, c'est qu'ils agissent **toujours mal**, silencieusement.

**Contrat de sortie commun aux 7 sites — 3 paliers, pas 2** (corrigé en analyse à charge : la première
rédaction n'en distinguait que 2 et sur-spécifiait le besoin réel du site #1) :
1. **Palier complet** (sites #2 attaquant CaC, #6 tireur) : `{ skillTotal, effectiveMalus, modDom,
   for_na, con_na, vol_na, sheetId, mastery }`.
2. **Palier NA seul** (sites #4, #5, #7 — cibles Tir/Drone) : `{ for_na, con_na, vol_na, sheetId }`,
   consommé par `resolveTargetHit`/`fetchCibleNA` — jamais de calcul de Compétence pour ces sites, un
   simple Seuil d'action n'y a pas de sens (ce sont des cibles, pas des acteurs qui testent).
3. **Palier identité seule** (site #1, `isTargetDefenseless`) : `{ sheetId }` **uniquement**, pour aller
   chercher `character_wounds` (vérifier `isTestBlockingWound`) — `[VÉRIFIÉ]` par lecture, ce site ne
   lit ni `for_na`/`con_na`/`vol_na` ni aucune Compétence. Le contrat complet reste néanmoins compatible
   (site #1 peut recevoir la forme complète et n'utiliser qu'un champ, même convention que les `ctx`
   déjà en place ailleurs dans ce fichier, `docs/PLANS/PLAN_RW_SYSCOMBAT.md` §2.4.c) — mais la
   documentation ne doit plus prétendre que ce site "a besoin" des NA, ce serait un sur-cadrage inexact
   repris tel quel dans le code au moment de détailler le Lot C.
`skillId = null` sélectionne le palier 2 (NA seul) — le palier 3 (site #1) peut soit réutiliser le
palier 2 en ignorant les NA non lues, soit être traité par un appel encore plus minimal
(`{ sheetId }` seul) — décision d'implémentation à trancher en détaillant le Lot C (§4), pas figée ici.

---

## 3. Architecture retenue

### 3.1 Nouveau fichier — une seule responsabilité

**`server/src/lib/combatantContextService.js`** — responsabilité unique : *résoudre le contexte de Test
d'un combattant, quel que soit son type*. Aucun fichier existant n'a cette responsabilité :
- `charStats.js` est explicitement pur (*"aucun accès DB"*, `charStats.js:4`) et son périmètre déclaré
  est le calcul, pas la résolution de source de données — l'y ajouter mélangerait deux responsabilités.
- `damageService.js` résout des dégâts, pas des Compétences.
- Un nouveau fichier est donc justifié par `docs/RegleDocumentaire.md` Règle 14 ("quelle est sa
  responsabilité ?") — pas une fragmentation gratuite.

### 3.2 Point d'entrée unique

```js
// server/src/lib/combatantContextService.js
// Résout le contexte de Test combat d'un personnage, quel que soit son type — jamais un fetch
// char_sheet direct depuis socketCombatHelpers.js, toujours ce point d'entrée.
export async function resolveCombatantTestContext(db, character, skillId) {
  if (character.type === 'exo') return resolveExoTestContext(db, character, skillId)
  return resolveHumanoidTestContext(db, character, skillId)
  // Drones : hors périmètre (§3.5) — ne passent jamais par ce point d'entrée.
}
```

Forme de retour, commune aux deux branches (§2, contrat de sortie déjà identifié) :
```js
{ skillTotal, effectiveMalus, modDom, for_na, con_na, vol_na, sheetId, mastery }
```
Guard clauses, pas de table (§1, doctrine Fowler déjà appliquée 3× dans ce fichier) — seulement 2
branches réelles aujourd'hui (`pj`/`pnj` traités identiquement, `exo`), une table serait une indirection
sans bénéfice pour ce nombre de cas.

**Risque trouvé en analyse à charge, corrige le séquencement §4 : `resolveCombatantTestContext`
(le dispatcher complet ci-dessus) n'est PAS construit avant le Lot G.** Si les Lots B-F appelaient ce
dispatcher tel quel, la branche `character.type === 'exo'` appellerait `resolveExoTestContext` —
fonction qui n'existe pas encore avant le Lot G, `ReferenceError` immédiat. Risque réel, pas
théorique : la migration 233 (`characters.type` CHECK incluant `'exo'`) existe déjà sur disque
`[VÉRIFIÉ]` (`server/src/db/migrations/233_exo_sheet.js`, non committée) — `docs/SYSTEME/CONVENTIONS.md`
P53 documente que nodemon réapplique toute migration présente dès l'écriture du fichier ; impossible de
garantir depuis ce plan que `type='exo'` est encore inaccessible en base au moment des Lots B-F.
**Correctif de séquencement** : les Lots B-F appellent directement `resolveHumanoidTestContext` (jamais
le dispatcher), avec le même garde de type que le code actuel préserve implicitement — voir §4, colonne
Contenu de chaque lot, mise à jour. Le dispatcher `resolveCombatantTestContext` n'est assemblé, et les
7 sites rebranchés dessus, que dans le Lot G — une seule fois, pas 7 fois. Sûr indépendamment de l'état
réel de la migration 233 en base, jamais besoin de le vérifier pour que ce plan reste correct.

### 3.3 `resolveHumanoidTestContext` — extraction Strangler Fig, comportement identique

Reprend **telle quelle** la chaîne déjà écrite 7 fois avec des variations mineures (attrs/archetype/
charSkill/refSkill/wounds/inventory/mutationEffects → `calcSkillTotal`/`calcAttributeNA`/
`calcActiveMalus`/`getModDom`, toutes fonctions pures déjà existantes de `charStats.js`/
`activeMalusRegistry.js`) — **aucune nouvelle logique**, un seul point d'écriture au lieu de 7 copies
divergentes. Couvre `pj` et `pnj` identiquement (aucune différence de source de données entre les
deux aujourd'hui, `[VÉRIFIÉ]` par lecture des 7 sites — seul `character.type` change le comportement
*ailleurs* dans le fichier, jamais dans le fetch `char_sheet` lui-même).

**`skillId` optionnel** — corrigé en analyse à charge pour refléter les 3 paliers du §2, pas 2 :
`resolveHumanoidTestContext(db, character, null)` retourne le palier NA seul
(`{ for_na, con_na, vol_na, sheetId }`, sites #4/#5/#7) sans calculer `skillTotal`/`effectiveMalus`/
`modDom` (évite un fetch `ref_skills`/`char_skills` inutile). Le site #1 (palier identité seule, §2)
n'a besoin que de `sheetId` — à trancher en détaillant le Lot C (§4) : soit il consomme le palier NA en
ignorant les 3 champs inutiles (le plus simple, une seule forme de retour pour `skillId=null`), soit une
3ᵉ forme d'appel plus stricte est ajoutée si le coût du fetch NA s'avère réellement mesurable — pas une
décision à figer avant d'avoir écrit le code.

### 3.4 `resolveExoTestContext` — nouveau, combine deux sources jamais fusionnées

**Squelette d'architecture seulement — le détail RAW complet reste `PLAN_EXOARMURE.md` Lot 2 (§0.1).**
Ce que ce plan fige :

```js
async function resolveExoTestContext(db, exoCharacter, skillId) {
  const exoSheet = await db('exo_sheet').where({ character_id: exoCharacter.id }).first()
  if (!exoSheet?.pilot_character_id) return null  // exo sans pilote assigné — pas de Test possible
  const pilot = await db('characters').where({ id: exoSheet.pilot_character_id }).first()
  // Contexte du PILOTE — attributs/Compétences/mastery, toujours les siens (§0.2 décision Saar),
  // jamais une copie sur exo_sheet.
  const pilotCtx = await resolveHumanoidTestContext(db, pilot, skillId)
  // Contexte propre à l'exo — dépendance externe, pas construite ici (voir note ci-dessous).
  const exoStats = await computeExoStats(db, exoSheet)  // PLAN_EXOARMURE.md Lot 2, pas ce plan
  return {
    ...pilotCtx,
    for_na: exoStats.exf,        // §0.2 exception FOR→EXF — seul override confirmé aujourd'hui
    // con_na/vol_na/skillTotal/effectiveMalus/mastery : ceux du pilote, inchangés (§0.2 règle générale)
  }
}
```

**Dépendance externe explicite, pas construite par ce plan** : `computeExoStats(db, exoSheet)` (ou
`calculateDynamicExoAttributes`, patron déjà esquissé `docs/MANUELS/MANUEL_EXOARMURE.md` V3, jamais
codé — `[VÉRIFIÉ]`, aucun fichier `server/src/**/*exo*` hors la migration 233 n'existe aujourd'hui) —
calcule EXF/BLD/RD effectifs à partir des paliers d'Intégrité (`itg_exosquelette_current`, etc.,
`MANUEL_EXOARMURE.md:284-299`). **Responsabilité de `PLAN_EXOARMURE.md`, pas de ce plan** (règle 14
documentaire — c'est un calcul propre au domaine exo-armure, pas au point de couture générique) :
`resolveExoTestContext` l'appelle, ne le réimplémente pas. Point de dépendance entre les deux plans à
noter explicitement dans les deux documents une fois celui-ci écrit.

**Ce que ce plan NE tranche PAS ici (renvoyé à `PLAN_EXOARMURE.md` Lot 2, §0.1)** :
- Le plafond de Compétence par Manœuvre d'armure lui-même (comment `pilotCtx.skillTotal` est
  effectivement plafonné) — l'architecture ci-dessus rend le plafond possible (le contexte pilote
  complet, avec sa propre Compétence Manœuvre d'armure, est disponible au moment de composer
  `resolveExoTestContext`), mais où et comment appliquer ce plafond reste à concevoir en détail.
- "1 seule Attaque/Tour" — un guard côté Déclaration (`socketCombatAnnouncement.js`), pas ce point de
  couture (qui ne concerne que la Résolution).
- Toute substitution d'attribut au-delà de FOR→EXF (§0.2).

### 3.5 Drones — hors périmètre, confirmé pas une omission

Les 7 sites listés en §2 sont tous côté humain/exo. `resolveDroneAssaultAction` (attaquant drone)
n'appelle jamais `char_sheet` pour le drone lui-même — `drone_programs.level` sert directement de
Seuil (`docs/SYSTEME/COMBAT_FLUX.md` §6, confirmé `[VÉRIFIÉ]` en lisant la fonction pendant
`PLAN_RW_SYSCOMBAT.md` Lot 6). Aucun changement nécessaire ni souhaitable ici — un drone qui passerait
par `resolveCombatantTestContext` violerait F2 (fusionner un patron qui n'a jamais eu ce problème).

---

## 4. Découpage en lots — un seul problème par lot, validé avant le suivant

**Principe de séquençage (§0.4)** : lots A-F construisent et migrent le chemin humain (`pj`/`pnj`),
zéro changement de comportement, risque faible à moyen (mêmes classes de risque que
`PLAN_RW_SYSCOMBAT.md` Lots 2/4/6/7 — écritures DB indirectes via `calcActiveMalus`/fetch wounds,
vérification par fixture jetable, pas de shadow-mode pur). Le lot G (`exo`) n'est ajouté qu'après.

| Lot | Contenu | Risque |
|---|---|---|
| **A** | Créer `combatantContextService.js` + `resolveHumanoidTestContext` (extraction depuis le site #2, le plus complet des 7 — les 6 autres n'utilisent qu'un sous-ensemble de sa sortie). Pas encore branché : `resolveMeleeAction` continue d'utiliser son fetch inline en parallèle (double-calcul, comparaison `[DBG-DECOUPLAGE]`, patron Scientist déjà utilisé `PLAN_RW_SYSCOMBAT.md` §2.3). Test unitaire dédié sur les cas déjà couverts par les 7 sites (skill trouvée/absente, mains nues, blessures, encombrement). | Faible — nouveau code non branché, aucun comportement existant modifié |
| **B** | Site #2 (`resolveMeleeAction`, attaquant CaC) bascule sur `resolveHumanoidTestContext` **directement, pas le dispatcher** (correctif analyse à charge, §3.2) — même garde de type que le code actuel (implicite : seuls `pj`/`pnj` produisent un `char_sheet`), retrait du double-calcul. **Le site le plus risqué mais aussi le plus prioritaire** (seul blocage dur, §2) — fixture jetable + session de jeu réelle avant de considérer ce lot clos. | Moyen |
| **C** | Sites #3 (défenseur CaC) + #1 (`isTargetDefenseless`) — regroupés car tous deux côté "cible CaC", même fixture réutilisable. Site #1 n'a besoin que de `sheetId` + `character_wounds` (§2, contrat resserré) — pas de `for_na`/`con_na`/`vol_na`, à ne pas sur-spécifier à la légère. | Faible-Moyen |
| **D** | Site #6 (`resolveAssaultAction`, tireur) — direct sur `resolveHumanoidTestContext`, même correctif qu'au Lot B. | Moyen |
| **E** | Sites #4 + #5 + #7 (toutes les cibles restantes — CaC déjà couvert par C, il ne reste que Tir/Drone) — regroupés, même forme de fetch, même repli par défaut. | Faible-Moyen |
| **F** | Nettoyage — vérifier qu'aucun site ne fait plus de fetch `char_sheet` direct pour un rôle combattant (grep de contrôle, même discipline que les analyses à charge de `PLAN_RW_SYSCOMBAT.md`), mise à jour `docs/SYSTEME/COMBAT.md`. À ce stade, les 7 sites appellent tous `resolveHumanoidTestContext` directement — **aucun ne passe encore par un dispatcher**, un personnage `type='exo'` qui atteindrait un de ces sites aujourd'hui obtiendrait exactement le même comportement gracieux/bloquant qu'avant ce chantier (zéro régression, le correctif exo n'existe pas encore). | Faible |
| **G** | Assemble enfin `resolveCombatantTestContext` (le dispatcher, §3.2) + `resolveExoTestContext` (§3.4) — **et seulement maintenant**, rebranche les 7 sites du direct `resolveHumanoidTestContext` vers le dispatcher (un seul passage, pas 7 lots séparés). **Ne débloque pas encore `PLAN_EXOARMURE.md` Lot 2 à lui seul** : dépend aussi de `computeExoStats` (autre plan) et du détail du plafond Manœuvre d'armure (autre plan). Ce lot livre l'architecture, pas la mécanique RAW complète. | Moyen — premier test réel avec un personnage exo, dépend d'une fixture avec `exo_sheet`/`ref_exo_templates` peuplés ; re-vérifier les 7 sites (comportement `pj`/`pnj` inchangé après rebranchement sur le dispatcher, pas seulement le cas exo) |

Chaque lot = un commit isolé, testé et confirmé par Saar avant le suivant (`CLAUDE.md` §5/§11) — même
discipline que `PLAN_RW_SYSCOMBAT.md`.

---

## 5. Hors périmètre de ce plan

- Le détail RAW du plafond de Compétence par Manœuvre d'armure et de "1 seule Attaque/Tour" —
  `PLAN_EXOARMURE.md` Lot 2, reprend une fois ce plan clos (au moins jusqu'au Lot G).
- `computeExoStats`/`calculateDynamicExoAttributes` (calcul EXF/BLD/RD dynamiques) — dépendance externe
  du Lot G, construite par `PLAN_EXOARMURE.md`, pas ici.
- Toute substitution d'attribut au-delà de FOR→EXF (§0.2) — à instruire au cas par cas ailleurs.
- Le pipeline de dégâts exo (Blindage/RD dynamiques en tant que cible) — `PLAN_EXOARMURE.md` Lot 4,
  recoupe le site #1 (`isTargetDefenseless`) sans en dépendre structurellement.
- Le type `characters.type='vehicle'` (mentionné comme extensible, `docs/SYSTEME/COMBAT.md` PC27) —
  aucune instance aujourd'hui, rien à anticiper avant qu'il existe réellement.

---

## 6. Validation attendue

- **Lot A** : test unitaire `combatantContextService.test.mjs` (nouveau fichier — aucun test n'existe
  aujourd'hui sur cette logique, dispersée dans 7 copies jamais testées) ; `node --check`.
- **Lots B-E** : par site, équivalence numérique ancienne chaîne inline / nouveau point d'entrée
  (script isolé, sans DB, sur des valeurs représentatives) + fixture jetable en base réelle (0 résidu)
  + `node --check` + session de jeu réelle Saar couvrant au moins le chemin `pj`/`pnj` concerné par le
  site migré.
- **Lot F** : grep de contrôle (`db\('char_sheet'\)` dans `socketCombatHelpers.js` limité aux sites hors
  périmètre de ce plan — ex. `char-sheet.js` routes, hors ce fichier) + mise à jour
  `docs/SYSTEME/COMBAT.md`.
- **Lot G** : fixture avec personnage `type='exo'` réel (`exo_sheet` + `ref_exo_templates` peuplés,
  pilote assigné) — au minimum un Test résolu sans crash, `skillTotal`/`for_na` correctement dérivés du
  pilote/de l'EXF respectivement. Scénario de jeu réel différé tant que `PLAN_EXOARMURE.md` Lot 2 n'a
  pas de mécanique à tester par-dessus (le Lot G seul n'est pas jouable de bout en bout).
- **Données** : aucune migration nouvelle (le schéma `exo_sheet`/`ref_exo_templates` existe déjà,
  migration 233 — pas encore appliquée en base au moment de la rédaction, à vérifier avant le Lot G).
- **Retour arrière** : chaque lot est un commit isolé, `git revert` suffit — aucune donnée vivante
  affectée avant le Lot G (les lots A-F ne changent que l'organisation du code, pas son résultat).

---

## Sources

- [Eranziel/foundryvtt-lancer — flow_api.md](https://github.com/Eranziel/foundryvtt-lancer/blob/master/docs/flow_api.md)
- [foundryvtt-starfinder/foundryvtt-starfinder](https://github.com/foundryvtt-starfinder/foundryvtt-starfinder)
- Recherche Lancer/MekHQ/derived-stats déjà citée et non refaite : `docs/PLANS/PLAN_EXOARMURE.md` §4
