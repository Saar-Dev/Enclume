# JOURNALTEMP.md — Mémoire externe, chantier CHOC1 (Palier 1)

> Scratch analytique local (non partagé, non versionné en pratique — CLAUDE.md §10). Sert de mémoire
> de travail pas-à-pas pour la vérification du prérequis "damage_h == null sur arme équipée" avant
> de coder le Palier 1. Écrit au fil de l'investigation, pas relu/nettoyé.

---

## Contexte — pourquoi cette investigation

Avant de brancher le Choc catégorie 2 (armes "Choc pur" : Flex, Fusil choc Stun, Pistolet choc Stun II,
Fusil sonique incap. sirène, Dague neurale Brain — toutes `damage_h = null` en base), il faut d'abord
vérifier que le moteur de combat sait déjà gérer une arme réellement équipée qui n'a aucun dégât
physique. Aujourd'hui il ne sait pas — mais la nature exacte du problème n'était pas claire au premier
passage (Saar a eu raison de demander de vérifier avant de conclure).

## Déjà établi, vérifié

1. **Client — pas de trou** : `CombatActionWindow.jsx:404-406`, le filtre des armes CaC sélectionnables
   ne teste que `ref_category === 'Arme de contact'`, jamais `damage_h`. Dague neurale Brain est donc
   déjà sélectionnable normalement dans l'UI.
2. **Client — convention déjà propre** : `CombatActionWindow.jsx:408` — commentaire explicite
   *"undefined=auto, null=mains nues explicite, id=choix explicite"*. `weaponInvId` truthy = une arme
   précise a été choisie, sans ambiguïté possible avec "mains nues".
3. **Pipeline profond déjà robuste** : `damageService.js` — `_severityForDamage(0)` renvoie
   `{severity: null, is_lethal: false}` proprement (pas de crash, pas de blessure créée). Le Test de
   Choc (`chocTotal !== null` branche, ligne ~296) se déclenche indépendamment de la sévérité physique.
   **`resolveTargetHit` n'a pas besoin d'être modifié pour gérer "0 dégât physique".**
4. **Le vrai problème, localisé précisément** : pas "damage_h==null mal géré" en général, mais deux
   endroits distincts qui confondent "la ligne arme n'existe pas" avec "la colonne damage_h de cette
   ligne est vide" :
   - `socketCombatHelpers.js:1222` (CaC, `resolveMeleeAction`) : `if (weapon?.ref_damage_h) damageFormula = weapon.ref_damage_h` — teste la mauvaise chose.
   - `damageService.js:42` (tir, `getEffectiveWeaponDamage`) : `if (!row?.weapon_formula) return null` — même confusion, function qui doit de toute façon être modifiée pour le Palier 1 (elle produira le Choc arme).
   - `socketCombatHelpers.js:2358` (tir, `resolveAssaultAction`) : dépend du point précédent, bloque tout tir avec une arme Choc pur aujourd'hui.
5. **Risque identifié, pas encore résolu** : si on corrige juste le point CaC (`weapon?.ref_damage_h` →
   `weapon` truthy), `damageFormula` devient `null` pour Dague neurale Brain. Plus loin dans la
   confirmation du dégât, `parseDice(formula.replace(...))` **plante** sur un `formula` null
   (`.replace` sur `null` = TypeError). Il faut donc AUSSI corriger le point où les dés sont lancés
   pour qu'il traite "formule vide" comme "0 dégât, ne pas lancer de dés" — pas juste changer
   l'affectation initiale.

## Étape 2 (2026-07-22) — carte complète des points de code concernés

### Côté CaC — 3 endroits touchent `damageFormula`, un seul est la cause racine

Chaîne complète tracée : `resolveMeleeAction` (Déclaration) → soit `confirmMeleeDefense` (PNJ attaquant,
résolution immédiate) soit `confirmDamage` (PJ attaquant, résolution différée après clic joueur).
`damageFormula` calculé une fois dans `resolveMeleeAction`, puis transporté tel quel dans les deux
chemins suivants (jamais recalculé) :

1. **`resolveMeleeAction:1222`** (cause racine) — `if (weapon?.ref_damage_h) damageFormula = weapon.ref_damage_h`
   sinon reste à `'1D4'` (mains nues). Confond "arme trouvée" et "damage_h non vide".
2. **`confirmMeleeDefense:684`** (PNJ attaquant, résolution immédiate) — `const { total: rawDice } =
   await parseDice(damageFormula.replace(/\s/g, ''))`. Plante si `damageFormula` est `null`.
3. **`confirmDamage:795`** (PJ attaquant, résolution différée, branche `pendingType === 'melee'`) —
   même chose : `const rolled = await parseDice(formula.replace(/\s/g, ''))`. Plante si `formula` est
   `null`. `formula` ici vient de `damageFormula` transporté via `combat_pending.payload` (posé par
   `confirmMeleeDefense:653`, `formula: damageFormula`).

**Donc 3 points à toucher côté CaC**, pas un seul : le calcul initial + les deux endroits qui lancent
réellement les dés (PNJ et PJ). Aucun des deux ne protège contre une formule vide aujourd'hui.

### Côté Tir — bonne nouvelle, les appelants sont déjà bien écrits

`getEffectiveWeaponDamage` (`damageService.js:42`) est LA cause racine unique : `if (!row?.weapon_formula)
return null` — traite "pas de formule physique" comme "arme invalide".

Tous ses appelants, en revanche, branchent déjà proprement sur la présence du résultat (pas sur le
contenu d'une formule) :
- `resolveAssaultAction` (PNJ, ligne ~2731) : `effectiveDamage ? effectiveDamage.total : parseDice(weapon.ref_damage_h...)`
  — si `getEffectiveWeaponDamage` est corrigé pour renvoyer `{total: 0, ...}` au lieu de `null`, ce
  point **se corrige automatiquement**, rien à toucher ici.
- `confirmDamage` (PJ, ligne ~808-821) : même pattern, même auto-correction.
- `getEffectiveWeaponFormulaPreview` (`damageService.js:102`, aperçu affiché au joueur avant de
  confirmer) : même défaut à sa racine que `getEffectiveWeaponDamage` — problème mineur (affichage
  `null` au lieu d'un texte propre), pas un crash, mais à corriger en même temps puisque c'est la
  même fonction jumelle.
- `resolveAssaultAction:2358` (le blocage total trouvé au run à vide) : dépend directement de
  `getEffectiveWeaponDamage` — une fois celle-ci corrigée, ce garde doit vérifier autre chose que
  `damage_h` (par exemple que la ligne `weapon` existe bien) pour ne plus bloquer les armes Choc pur.

**Donc côté tir : corriger une seule fonction cause racine (+ sa jumelle preview) suffit** — les
appelants n'ont pas besoin d'être touchés un par un, contrairement au CaC.

### Bilan — 6 points de code identifiés, aucun encore modifié

| # | Fichier:ligne | Rôle | Type de correctif |
|---|---|---|---|
| 1 | `socketCombatHelpers.js:1222` | CaC, cause racine | Distinguer "arme trouvée" de "damage_h rempli" |
| 2 | `socketCombatHelpers.js:684` (`confirmMeleeDefense`) | CaC, PNJ, jet réel | Sauter le jet si formule vide → 0 |
| 3 | `socketCombatHelpers.js:795` (`confirmDamage`) | CaC, PJ, jet réel | Sauter le jet si formule vide → 0 |
| 4 | `damageService.js:42` (`getEffectiveWeaponDamage`) | Tir, cause racine | Renvoyer un résultat `{total:0,...}` au lieu de `null` |
| 5 | `damageService.js:102` (`getEffectiveWeaponFormulaPreview`) | Tir, affichage | Même correctif, cosmétique |
| 6 | `socketCombatHelpers.js:2358` (`resolveAssaultAction`) | Tir, garde d'entrée | Vérifier autre chose que `damage_h` |

**Rien codé.** Prochaine étape : décider avec Saar de la forme exacte du correctif #1 (distinguer les
deux cas sans casser le fallback "mains nues" légitime) avant d'écrire quoi que ce soit.

## Étape 3 (2026-07-22) — verdict architecture : trou précis, pas un CaC "pas au niveau" globalement

Confirmé par le code lui-même : `damageService.js:30-32` porte un commentaire explicite —
*"Point de résolution unique du dégât effectif d'une arme... Réutilisé par tous les appelants (PNJ
immédiat et PJ différé)... jamais une 2ᵉ copie."* C'est un principe d'architecture déjà acté et
appliqué côté **tir** (Chantier 11 Étape 2 Lot A, session ~152). Le **CaC n'a jamais reçu l'équivalent**
— probablement parce que les sprints CaC 1/2 (session 67/68) sont antérieurs à ce principe. Résultat :
le tir a UNE fonction (`getEffectiveWeaponDamage`) que tout le monde appelle ; le CaC recalcule/relance
les dés indépendamment à 2 endroits (`confirmMeleeDefense` PNJ + `confirmDamage` branche melee) à
partir d'une simple chaîne `damageFormula` transportée telle quelle.

**Décision (Saar, confirmée)** : pas de refonte générale du CaC. Pas non plus 3 patchs séparés aux
points #1/#2/#3 du tableau ci-dessus (ce serait dupliquer le correctif 2 fois — exactement le
bricolage interdit). **La bonne solution : construire une fonction équivalente à
`getEffectiveWeaponDamage` pour le CaC**, appelée par les deux endroits qui lancent les dés
aujourd'hui (`confirmMeleeDefense` PNJ et `confirmDamage` melee), au lieu que chacun le refasse à sa
façon. Referme le trou d'architecture en même temps que le prérequis Choc catégorie 2 — un seul
chantier, pas deux.

**Révision du tableau des 6 points** : les points #2 et #3 (CaC, jets réels) ne sont plus deux
correctifs séparés — ils deviennent "brancher sur la nouvelle fonction unique" une fois qu'elle
existe. Le vrai travail CaC se résume à : (a) construire la fonction, (b) la faire consommer par
`resolveMeleeAction` (remplace le point #1), (c) la faire consommer par `confirmMeleeDefense` et
`confirmDamage` au lieu de leur `parseDice` direct.

## Étape 4 (2026-07-22) — séquencement acté avec la refonte CaC

`docs/PLAN_REFONTECAC.md` créé (constat seul, pas de solution). Décision Saar : **le correctif
minimal `CHOC1` passe en premier**, la refonte CaC (autre agent) attend qu'il soit fermé avant de
démarrer — mêmes fichiers touchés (`resolveMeleeAction`, `confirmMeleeDefense`, `confirmDamage`),
verrou documenté dans les deux plans pour que ce ne soit pas à redemander. Prochaine étape réelle :
concevoir puis écrire le correctif minimal (les 6 points de code déjà cartographiés à l'Étape 2/3
ci-dessus), pas la refonte.

## Étape 5 (2026-07-22) — correctif minimal codé

6 modifications appliquées, une seule et même logique partout ("distinguer arme introuvable / arme
sans dégât physique") — pas 6 patchs indépendants :

1. `socketCombatHelpers.js` — `resolveMeleeAction` (~1213) : `damageFormula` devient `null` (pas
   `'1D4'`) quand une arme est trouvée sans `ref_damage_h`.
2. `socketCombatHelpers.js` — `confirmMeleeDefense` (~684, PNJ) : `parseDice` sauté si
   `damageFormula` est `null`, `rawDice = 0` directement.
3. `socketCombatHelpers.js` — `confirmDamage` (~795, branche melee) : même garde.
4. `socketCombatHelpers.js` — `resolveAssaultAction` (~2358) : le garde d'entrée teste désormais
   `primaryWeapon?.equipment_id` (présence de l'arme) au lieu de `ref_damage_h`.
5. `damageService.js` — `_fetchWeaponAndAmmo` : ajout de `weapon_ref_id` (signal fiable "arme
   trouvée", indépendant de `damage_h`).
6. `damageService.js` — `getEffectiveWeaponDamage` : garde changée pour `weapon_ref_id` ; nouvelle
   branche renvoyant `{total:0, rolls:[], formula:'', tags, choc}` si `weapon_formula` est vide, au
   lieu de `null`. `getEffectiveWeaponFormulaPreview` : même garde, renvoie `'—'` au lieu de `null`.

**Testé** : `node --check` sur les deux fichiers, syntaxe valide. **Rien d'autre.**
**Non testé** : aucun scénario en jeu. À faire par Saar avant de considérer le prérequis clos :
tir avec Flex (Choc pur), CaC avec Dague neurale Brain (Choc pur), non-régression sur une arme
normale (Matraque Mao), les trois avec un PNJ en plus d'un PJ.

## Étape 6 (2026-07-22) — auto-correction : le correctif de l'Étape 5 contredit l'Étape 3

**Erreur reconnue.** L'Étape 3 concluait explicitement "pas de patchs séparés aux points #2/#3 —
exactement le bricolage interdit — construire une fonction équivalente à `getEffectiveWeaponDamage`
pour le CaC". L'Étape 5 a fait exactement l'inverse (3 patchs indépendants avec des gardes locales)
sans revenir corriger la décision. Repéré par l'agent refonte en lisant ce journal avant de committer
— la vérification croisée a fonctionné comme prévu.

**Reprise demandée** : construire `damageService.js` une fonction unique, même contrat de forme que
`getEffectiveWeaponDamage` (fetch → formule → jet → `{total, rolls, formula, ...}`), avec 3
producteurs (arme équipée, arme naturelle, mains nues par défaut), appelée par `confirmMeleeDefense`
et `confirmDamage` à la place de leurs `parseDice` directs. Point à vérifier avant de coder : est-ce
que cette fonction doit **re-fetcher** l'arme au moment de la confirmation (comme le fait le tir,
pour la fenêtre réelle "arme changée entre Déclaration et Confirmation") ou simplement rouler une
formule déjà résolue à la Déclaration ? Si re-fetch : il faut aussi vérifier que `weaponInvId`/
`naturalWeaponCharMutationId` sont bien transportés dans les payloads `combat_pending` (`melee_defense`
puis `damage`) jusqu'à la confirmation — pas encore vérifié, à faire avant d'écrire la fonction.

## Étape 7 (2026-07-22) — reprise complète : 5 sites, pas 2, une seule fonction

En construisant la fonction, découverte de **3 sites supplémentaires** jamais vus à l'Étape 2/3 :
`resolveMeleeAction` contient lui-même 3 branches de résolution PNJ immédiate (cible sans défense
ligne ~1597, PNJ défenseur ~1654, drone défenseur ~1762) qui appelaient chacune `parseDice(damageFormula...)`
directement — ma cartographie initiale ne couvrait que le chemin défenseur-PJ (`confirmMeleeDefense`/
`confirmDamage`). Preuve concrète que patcher au cas par cas rate des sites ; une fonction unique les
attrape tous.

**`getEffectiveMeleeDamage` créée** (`damageService.js`, même contrat de forme que
`getEffectiveWeaponDamage`) — 3 producteurs (arme naturelle > arme équipée > mains nues), un seul
consommateur. **Choix de conception assumé, pas un raccourci** : les 2 sites différés
(`confirmMeleeDefense`/`confirmDamage`, après le round-trip défense) ne repassent jamais par le
producteur "arme naturelle" — ils s'appuient sur `fallbackFormula` (formule déjà résolue à la
Déclaration) pour ce cas, parce qu'une formule de mutation est un contenu catalogue statique, sans
fenêtre de péremption comme une arme équipable/désequipable. Seul le producteur "arme équipée" est
re-fetché à ces 2 sites (même risque de péremption que côté tir, déjà documenté). Les 3 sites internes
à `resolveMeleeAction` (même tick que la Déclaration) utilisent, eux, les 3 producteurs complets.

**`weaponInvId` ajouté au transport** `commonPending` (Déclaration → défense PJ) et au payload
`damage` (défense confirmée → dégât PJ) — absent avant, nécessaire pour que les 2 sites différés
puissent re-fetcher l'arme équipée.

**Les 5 sites, tous branchés sur `getEffectiveMeleeDamage`** :
1. `resolveMeleeAction` — cible sans défense.
2. `resolveMeleeAction` — PNJ défenseur.
3. `resolveMeleeAction` — drone défenseur.
4. `confirmMeleeDefense` — PNJ attaquant (défenseur PJ touché).
5. `confirmDamage` — PJ attaquant, branche melee.

**Testé** : `node --check` sur les deux fichiers, syntaxe valide. **Rien d'autre — toujours aucun
scénario exécuté en jeu.** Le plan de test de l'Étape 5 reste valable et s'étend maintenant aux 3
nouveaux chemins PNJ (cible sans défense, PNJ vs PNJ, PNJ vs drone) — à couvrir avant de considérer
le prérequis clos.

## Étape 8 (2026-07-22) — validation en jeu + un site supplémentaire trouvé et corrigé

**Validé en jeu (logs serveur, Saar)**, dans l'ordre : tir Flex (Choc pur, plusieurs coups, aucune
erreur) → CaC Matraque Mao (arme normale, `1D10 → 4`, non-régression) → CaC mains nues (`1D4 → 4`) →
**CaC Dague neurale Brain (Choc pur) — coup touché, log `getEffectiveMeleeDamage` confirmant
`formule:(vide, Choc pur) → total:0`, aucune erreur serveur.** C'est le cas qui manquait pour
considérer le prérequis réellement couvert, pas seulement syntaxiquement correct.

**Site supplémentaire trouvé en cours de route, hors CaC/tir (item "reste à vérifier" ci-dessous,
maintenant traité)** : `shared/weaponSlots.js::isWeaponItem` — même confusion générique que partout
ailleurs, mais sur la *détection* d'arme plutôt que sur son *dégât*. Ne testait que `fire_mode`
(tir) et `damage_h` (contact), jamais `shock` : une arme Choc pur en main (Dague neurale) disparaissait
entièrement de `resolveHandWeapons`, donc invisible à `CombatGmDeclareWindow` (route
`/combat-equipment`). N'affectait que le MJ/PNJ — `CombatActionWindow` (joueur) sélectionne au contact
par `ref_category`, jamais par cette fonction. Corrigé : `isWeaponItem` teste désormais aussi
`shock`/`ref_shock` ; `ref_equipment.shock` ajouté à la requête `/combat-equipment`
(`server/src/routes/battlemaps.js`) qui ne le sélectionnait pas ; 2 cas ajoutés à
`shared/weaponSlots.test.mjs` (15/15 verts).

**Dette identifiée, non corrigée, volontairement hors scope** : `socketCombatHelpers.js` ~2765
(`resolveAssaultAction`, branche PNJ tir) — filet de secours `parseDice(weapon.ref_damage_h...)` sans
garde `null`, atteint seulement si `getEffectiveWeaponDamage` renvoie `null` (arme introuvable, fenêtre
de péremption Déclaration→Résolution) ET que l'arme est Choc pur. Risque étroit, mais même famille de
bug. Noté dans `docs/EN_COURS.md` Item 106 pour ne pas le perdre — pas traité ici (un problème à la
fois).

**Prérequis `CHOC1` considéré fermé.** Verrou levé sur `docs/PLAN_REFONTECAC.md`. Reste ouvert et non
tranché : le Palier 1 (câblage réel du Choc porté par l'arme — voir `docs/PLAN_CHOC1.md` §4/§6, décision
de scope toujours due à Saar).

## Étape 9 (2026-07-22) — run à vide post-commit : nouvelle dette jumelle trouvée, documentée

Saar a demandé un run à vide critique après le commit ("le plan est prêt à 100% ?"). Réponse honnête :
non — Palier 1 pas commencé (c'est le vrai sujet de `CHOC1`, toujours 0% fait), et en relisant le code
committé plutôt que ma propre description, trouvé un trou non documenté : `getEffectiveMeleeDamage`
confond "arme introuvable" et "était Choc pur puis desequipée" dans son repli `?? '1D4'` — jumeau
exact de la dette déjà connue côté tir (`resolveAssaultAction ~2765`), jamais fermé côté CaC. Les deux
dettes documentées ensemble dans `docs/EN_COURS.md` Item 106 et `docs/PLAN_CHOC1.md` §6 point 6 — pas
corrigées maintenant (décision Saar : continuer l'analyse d'abord). Ne pas corriger l'une sans l'autre
quand ce sera fait.

## Étape 10 (2026-07-22) — 3ᵉ trouvaille (dual-wield) + les 3 corrigés ensemble

En continuant l'analyse à la demande de Saar, balayage complet de `ref_damage_h`/`weapon_formula`
dans les deux fichiers : trouvé un 3ᵉ cas, `socketCombatHelpers.js:~2405` (tir à deux armes,
`if (fetched.weapon?.ref_damage_h)` sur la main secondaire) — celui-ci **reproductible à volonté**,
pas une fenêtre de timing comme les deux autres. Tracé jusqu'au bout avant de corriger (exigence
Saar : "sûr à 100%") : `fires === 'both'` ne calcule le dégât que sur l'arme principale — déjà le cas
avant tout correctif CHOC1, comportement de dual-wield existant non lié à ce bug, rien de nouveau
introduit par le fix. `fires === 'offhand'` (arme secondaire seule) alimente correctement
`getEffectiveWeaponDamage` une fois la détection réparée. `resolveDualWieldFire`
(`shared/ammoRules.js`) vérifié : aucune dépendance à `ref_damage_h`, uniquement `ammo_remaining`.

**Les 3 corrigés dans la foulée** (même invariant partout, même correctif déjà validé 6× dans ce
fichier) :
1. `socketCombatHelpers.js:~2765` — repli à 0 si `weapon.ref_damage_h` vide, plus de `parseDice` sur
   chaîne vide.
2. `damageService.js::getEffectiveMeleeDamage` — retiré le `?? '1D4'` superflu qui écrasait un
   `fallbackFormula` légitimement `null` (Choc pur).
3. `socketCombatHelpers.js:~2405` — test sur `equipment_id` au lieu de `ref_damage_h` pour la main
   secondaire.

**Testé, au-delà de la syntaxe** : script Node isolé important `getEffectiveWeaponDamage`/
`getEffectiveMeleeDamage` directement + requête réelle sur `char_inventory` pour deux armes Choc pur
réellement équipées en base (Dague neurale Brain, Flex). 7/7 assertions passées, dont le cas exact du
bug CaC corrigé aujourd'hui (arme introuvable + `fallbackFormula=null` → `total:0`, pas `1D4`
fantôme) et la détection dual-wield (`equipment_id` truthy là où `ref_damage_h` était faux). **Non
testé** : le parcours complet en jeu (sockets, FSM, un vrai tir à deux armes) — hors de portée d'un
script isolé, nécessite un serveur + client réels.

**Confirmé en jeu (2026-07-22, log serveur Saar)** : CaC Dague neurale Brain, coup touché via la
branche "PNJ défenseur" de `resolveMeleeAction` (site interne #2) — `getEffectiveMeleeDamage` appelée,
`producteur:arme équipée`, `formule:(vide, Choc pur)`, `total:0`. Aucun `1D4` fantôme, aucun crash.
Confirme le correctif pour ce site précis, en conditions réelles.
**Toujours non testé** : `confirmMeleeDefense`/`confirmDamage` (défenseur PJ), "cible sans défense",
drone défenseur, dual-wield, non-régression sur une arme physique normale (aucune arme autre que
Dague neurale Brain vue dans les logs jusqu'ici).

## Étape 11 (2026-07-22) — Palier 1 codé (migration 190 + producteurs + resolveTargetHit + câblage CaC)

Scope tranché GO par Saar sur lecture de préparation technique (docs/PLAN_CHOC1.md §4, "Décision de
lancement actée"). Format d'architecture validé contre prior art (Rule Elements PF2e/Foundry VTT)
avant tout code — voir plan. Implémentation :

1. **Migration 190** (`190_choc1_palier1_shock_mechanism.js`) — `ref_equipment.shock_mechanism`
   ('tete_gated'|'pure'|NULL, seul signal d'opt-in — jamais dérivé de la simple présence de `shock`,
   qui reste peuplée pour ~15 armes hors scope) + `shock_reduced_by_armor` (bool, défaut true) +
   `ref_mutations.natural_weapon_choc_formula`. Peuplement : 13 armes catégorie 1 (`tete_gated`), 5
   catégorie 2 (`pure`, dont Dague neurale Brain `reduced_by_armor=false`), Corne (`1D6`). Assertions
   de comptage dans `up()` (throw si un nom catalogue ne matche pas) — noms vérifiés un par un contre
   la base réelle avant écriture (13/13, 5/5, 1/1, 1/1). **Exclus explicitement de ce palier** (angles
   morts non tranchés, voir plan §5) : Lance-flammes (note "Rafale longue" non détaillée dans le plan),
   armes de zone hors Fusil sonique incap. sirène (Gén. d'onde de choc, Modulateur sonique, Grenade
   assommante/sonique — simplification cible unique non tranchée), 4 armes `damage_h` tronqué
   (Chalumeau, Dague thermique Thermo IV, Lance thermique Solar/Fléau, bug séparé).
2. **`damageService.js`** — `_weaponShockDsl(row)` (nouveau helper interne, réutilisé tir+CaC) construit
   `{action:'SET', value, gateLocation, reducedByArmor}` depuis `shock_mechanism`. Précédence : Choc
   munition (catégorie 3, déjà câblé) prioritaire si présent, Choc arme en complément sinon — averti si
   les deux coexistent (anomalie catalogue). `getEffectiveWeaponDamage` (tir) et `getEffectiveMeleeDamage`
   (CaC, + branche mutation naturelle) retournent désormais `.choc` dans tous leurs cas (y compris
   repli/mains nues → `null`). `resolveTargetHit` : `prt` (protection_shock, calculé depuis
   Session 152 mais jamais consommé) maintenant capturé ; gate de localisation (`chocDsl.gateLocation`
   vs `localisation` déjà connue à l'étape 1) et réduction d'armure (`chocDsl.reducedByArmor` vs `prt`)
   appliqués au point 3bis, avant combinaison de sévérité — sans toucher au chemin catégorie 3 (chocDsl
   munition n'a jamais ces deux clés, comportement inchangé par construction).
3. **`socketCombatHelpers.js`** — câblage CaC (jamais fait jusqu'ici, cf. Étape 6) : `chocDsl` passé aux
   4 call sites `resolveTargetHit` concernés (`confirmMeleeDefense`, `confirmDamage` branche melee,
   `resolveMeleeAction` défenseur sans défense + défenseur PNJ). Côté tir : **aucun changement** —
   `effectiveDamage.choc`/`effectiveChocDsl` étaient déjà transportés (Lot B), l'extension du contenu de
   `.choc` suffit. **Hors scope, signalé pas silencieux** : `resolveDroneAssaultAction` (drone
   attaquant, ~ligne 2217) ne passe par aucun des deux producteurs communs — Choc arme non câblé pour
   un drone tireur, problème distinct non ouvert par ce palier.

**Testé (2026-07-22)** :
- `node --check` sur les 3 fichiers touchés (migration, damageService.js, socketCombatHelpers.js).
- Migration appliquée sur la base réelle (auto par le watcher nodemon actif) ; peuplement vérifié ligne
  par ligne (18/18 armes + Corne, valeurs `shock_mechanism`/`shock_reduced_by_armor` exactes).
- `node --test shared/*.test.mjs shared/mods/*.test.mjs shared/world/*.test.mjs` : 214/214, 0 régression.
- Script isolé (hors `server/`, jamais chargé par le watcher) importe `getEffectiveWeaponDamage`/
  `getEffectiveMeleeDamage`/`resolveTargetHit` directement contre la base réelle : 15/15 assertions —
  Matraque Mao (tir ET CaC, `gateLocation:'tete'`), Dague neurale Brain (`gateLocation:null`,
  `reducedByArmor:false`, physique `total:0`), Flex (`reducedByArmor:true`), gate de localisation
  (Tête→calculé, Torse→`chocTotal:null`), Choc pur (jamais gaté), **non-régression catégorie 3**
  (chocDsl munition sans `gateLocation`/`reducedByArmor` : jamais gaté, quelle que soit la
  localisation — comportement historique intact). Corne non testable par ce script (aucun personnage
  actif avec cette mutation trouvé en base actuellement) — à couvrir par le test en jeu.
- **Réduction d'armure réelle, couverte séparément (2026-07-22, Saar ne pouvant pas exécuter ce test
  lui-même — "je ne peux pas l'inventer")** : script isolé additionnel, **une transaction jamais
  commitée** (`db.transaction()` + `rollback()` dans un `finally`, vérifié après coup : zéro trace en
  base) — fabrique un personnage temporaire réel portant une armure catalogue réelle (Pagan) équipée
  au slot Tête, appelle `resolveTargetHit` via la transaction. 3/3 assertions : `prt` correctement lu
  depuis le vrai join `char_inventory_slots`/`ref_equipment` (=4, valeur de test) ; `reducedByArmor:true`
  → total toujours dans la plage attendue (brut 19/20 − 4 = 15/16, 15 tirages) ; `reducedByArmor:false`
  → total toujours brut (19/20, contrôle sans réduction, 15 tirages). **Découverte séparée, sans
  rapport avec CHOC1** : `protection_shock` est `NULL` sur les 100% des lignes `ref_equipment`
  actuellement — aucune armure catalogue ne porte de valeur réelle aujourd'hui. La réduction est câblée
  et vérifiée correcte (d'où le besoin de fabriquer une valeur de test), mais n'aura aucun effet
  observable en jeu tant qu'aucune armure catalogue n'a de `protection_shock` réel — dette de donnée
  distincte, à signaler séparément si Saar veut la traiter.

**Non testé** : scénario complet en jeu (sockets, FSM, UI de breakdown) — hors de portée d'un script
isolé. En particulier : mutation Corne (bonus "+1D6 si tête" en situation de Saisie réelle, aucun
personnage actif avec cette mutation en base actuellement pour la tester même en isolé) ; Localisation
précise (COM9, `aimed_location`) forçant une Tête sur une arme catégorie 1 ; non-régression PJ réel
(attaquant différé, PNJ vs PJ, drone défenseur) au-delà des scripts isolés.

## Étape 12 (2026-07-22) — Run à vide : relecture à froid du code livré, aucun serveur démarré

Trois vérifications ciblées pour chercher des pièges dans ce qui vient d'être codé, pas de nouvelle
fonctionnalité.

**Écarté (vérifié, pas un problème)** :
- `ref_equipment.name` — pas de doublon actuellement (`GROUP BY name HAVING count(*)>1` → 0 ligne),
  donc les `whereIn(name)` de la migration 190 ont bien mis à jour les 18 bonnes lignes une par une, pas
  une coïncidence de comptage. Note structurelle, pas un bug : aucune contrainte `UNIQUE` en base sur
  `name` (seulement une clé primaire sur `id`) — si une future arme catalogue réutilisait un nom
  existant, une migration de ce type par nom redeviendrait fragile. Rien à corriger aujourd'hui, juste
  à garder en tête pour une future migration du même genre.
- Client (`CombatResultPanels.jsx`, `ShockBlock`) — entièrement générique, s'affiche dès que
  `shockResult?.triggered`, sans aucune condition sur la source (arme/mutation/munition). Catégories 1/2
  s'afficheront donc correctement sans aucun changement client, tout comme la catégorie 3 aujourd'hui.

**Trouvé — incohérence réelle mais actuellement dormante, pas corrigée (à trancher)** :
Dans `getEffectiveWeaponDamage`, la branche `mechanic.chocFixed` (Lot C1, 6 familles de munitions
spéciales : Explosive/Assommante/SAP/HP/SLAP/IEM) écrit `choc = mechanic.chocFixed ? {...} :
resolveChoc(parsed.choc)` — si une munition charge une de ces mécaniques, le Choc intrinsèque de l'arme
(`weaponShockDsl`) est silencieusement ignoré, **sans le warning** que `resolveChoc()` émet pourtant
dans les deux autres branches de la fonction pour le même genre de conflit. Incohérence de
construction, pas juste esthétique : si un jour une des 5 armes à distance du Palier 1 (Fusil sonique
d'attaque, Fusil choc Stun, Pistolet choc Stun II, Fusil sonique incap. sirène, Flex) charge une
munition à mécanique spéciale, son propre Choc catalogue disparaîtrait sans message d'avertissement.
**Vérifié sur le catalogue réel** : toutes les munitions portant `FX=EXPLOSIVE/ASSOMMANTE/SAP/HP/SLAP/
IEM` aujourd'hui sont des calibres d'armes à feu classiques (9mm, 7.62mm, etc.), sans lien de
compatibilité avec ces 5 armes — dormant, aucun cas réel ne le déclenche actuellement.

**Corrigé (2026-07-22, confirmé Saar)** : `choc = mechanic.chocFixed ? {...} : resolveChoc(parsed.choc)`
→ `choc = resolveChoc(mechanic.chocFixed ? {...} : parsed.choc)` — les 4 points de construction de
`choc` dans `getEffectiveWeaponDamage` (Choc pur, branche `mechanic`, branche normale, repli `catch`)
passent maintenant uniformément par `resolveChoc()`, même précédence et même avertissement partout.
`node --check` OK, suite `shared/*.test.mjs` 237/237 (0 régression), script isolé Palier 1 re-passé
intégralement (mêmes 15/15 assertions qu'avant le correctif).

## Reste à vérifier (prochaines étapes)

- [x] Vérifier s'il y a d'autres endroits (hors CaC/tir) qui lisent `ref_damage_h`/formula d'une arme
      et supposeraient aussi qu'elle n'est jamais vide pour une arme équipée — un trouvé et corrigé
      (`shared/weaponSlots.js`, Étape 8). `resolveAssaultAction:~2765` trouvé aussi mais laissé en
      dette ouverte (voir ci-dessus).
- [x] Correctif #1 (CaC, cause racine) conçu et codé : `getEffectiveMeleeDamage`, formule vide → 0,
      jamais un objet ambigu (Étapes 6-7).

---
