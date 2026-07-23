# PLAN_CHOC1.md — Choc étourdissant : ce qui manque réellement, catégorie par catégorie

> Document temporaire (Règle 10 `RegleDocumentaire.md`) — archivé/intégré dans `docs/SYSTEME/COMBAT.md`
> une fois le chantier tranché et clos.
> Origine : dette `CHOC1` (`docs/BUGIDENTIFIE.md`), initialement titrée "Choc structurellement limité
> aux munitions à distance". Remise à plat demandée par Saar (2026-07-19) après qu'une première
> explication orale se soit révélée imprécise et incomplète — ce document remplace cette explication.
> Aucun code écrit pour ce chantier à ce stade — recherche et inventaire uniquement.

---

**Document système de référence (2026-07-22)** : `docs/SYSTEME/DOMMAGES.md` documente désormais la
distinction Physique/Choc, l'autorité unique (`resolveShockTest`, deux portes d'entrée), et la
décision actée de ne jamais fusionner Choc avec Poison/Maladie/Drogue/Irradiation malgré leur
proximité de schéma dans `char_mutation_effects_view` (mécaniques RAW incompatibles — l'une résolue
sur un seul coup, l'autre sur un niveau qui persiste et évolue dans le temps réel). Ce plan sera
absorbé dans ce document une fois le chantier clos (Règle 10 `RegleDocumentaire.md`).

## 1. Le vrai problème n'est pas "tir vs CaC" — c'est "munition vs arme"

**Cadrage initial (imprécis)** : *"Choc limité au tir, absent du CaC."*

**Cadrage réel, vérifié en lisant le code ET le catalogue réel** (`docs/Old/script Extraction Excel/
equipement/STEP1_cleaned_data.js`, source des données `ref_equipment`) :

- Le Choc porté par une **munition** (`ammo_effects` DSL, clause `CHOC=`) fonctionne — construit
  Session 152/Lot B `docs/Old/PLAN_ARMES_DSL.md`, lu par `resolveTargetHit`.
- Le Choc porté par une **arme elle-même** (colonne `ref_equipment.shock`, migration 48) **n'est lu
  nulle part dans le moteur de combat** — ni en CaC, ni en tir. Confirmé : `ref_shock` est bien
  sélectionné dans 5 requêtes (`char-sheet.js`, `inventoryService.js`) mais jamais réutilisé après en
  résolution.
- Or des armes **à distance** (Flex, Fusil choc Stun, Pistolet choc Stun II, Fusil sonique d'attaque...)
  portent leur Choc sur la colonne `shock` de l'arme, pas sur une munition — leur Choc est donc **déjà
  cassé aujourd'hui en tir**, pas seulement en CaC. Le titre original de `CHOC1` était donc inexact
  sur l'axe du problème.

**Correction (analyse critique du plan, Saar) — ce n'est pas de la donnée morte, c'est une UI qui
ment** : `client/src/character/WeaponPanel.jsx:59` **affiche déjà** `ref_shock` sur la fiche d'arme
("CHC : 2D10" pour une Matraque Mao). Le joueur voit donc aujourd'hui une statistique de Choc réelle
sur son arme, sans que rien ne se produise en jeu quand il l'utilise — plus grave qu'une simple lacune
silencieuse, c'est une incohérence visible.

**Donnée vérifiée en base réelle (2026-07-21/22) — priorité #1 close** : la requête
`SELECT name, family, category, damage_h, shock, protection_shock, description FROM ref_equipment
WHERE shock IS NOT NULL` a été exécutée sur la base réelle (accès Postgres local trouvé via `.env`,
34 lignes retournées). Chaque valeur `shock` des deux catégories d'armes concernées (Armes de contact,
Armes étourdissantes et soniques, 45 armes au total en comptant celles sans Choc) a ensuite été
recroisée ligne à ligne avec les tables RAW du Livre de Base fournies par Saar — **zéro écart
trouvé**. Les différences observées lors du premier essai de lecture (Chalumeau, Dague thermique,
Lance thermique, Hache lourde, Masse, Bâton de combat, Batte Dicta) étaient une erreur de lecture
d'un tableau mal structuré en texte brut, pas une erreur de base — corrigée en confrontant à un
second tableau proprement formaté. **Confirmé par Saar** : les valeurs de `ref_equipment` reflètent
la mise à jour du supplément **Guide technique**, pas le LdB de base seul — écart volontaire et
valide entre les deux sources, sans impact sur la règle elle-même (p.243 inchangée par le supplément).
Détail du croisement complet : §3.

**Référence unique pour les 3 catégories théoriques (déjà écrites, ne pas dupliquer ici)** :
`docs/VOCABULARY.md`, entrée "Dommages de Choc". Ce plan ne fait qu'y ajouter l'inventaire catalogue
concret et les décisions de scope.

**Correction (analyse à charge, 2026-07-21) — provenance réelle de la dette `CHOC1`** : ce plan ouvre
en citant `docs/BUGIDENTIFIE.md` et un titre initial "Choc structurellement limité aux munitions à
distance". `[VÉRIFIÉ]` en remontant à l'origine effective : `docs/Old/PLAN_MUTATION2.md` Lot 4
sous-lot B (2026-07-12, clos session 141) montre que `CHOC1` a été **créée** au moment précis où le
bonus "+1D6 Choc si tête" de la mutation Corne a été identifié comme hors périmètre de ce lot (ligne
"documenté comme gap différé, nouvelle dette `[CHOC1]`, pas silencieusement perdu"). Corne n'est donc
pas un "rappel hors catalogue" annexe (voir correction §3.4) — c'est le cas fondateur de cette dette.
Le titre a dérivé avec le temps ; sans impact sur le scope, mais à corriger dans `BUGIDENTIFIE.md`
pour que la traçabilité reste honnête (priorité 1 du contrat commun : le code et les données observées
priment sur la mémoire/le récit accumulé).

---

## 2. Sources RAW vérifiées (relues intégralement pour ce plan)

- `docs/REGLES/REGLEBLESSURES.md` (p.243, "Dommages étourdissants et assommants") — règle générale :
  deux jets séparés (dégâts physiques, puis Choc additionnel), jamais une blessure physique. Restriction
  générale : arme "normale" avec Choc en supplément → **Tête uniquement**. Exception explicite : armes
  qui **ne causent QUE du Choc** (ex. électriques) → **aucune restriction de localisation**.
- `docs/REGLES/REGLESMUNITIONS.md` ("Balles assommantes"/"Balles explosives") — règle spécifique
  munitions : Choc additionnel appliqué **sans restriction de portée ni de localisation**, valeurs
  fixes. Cette règle est la source réelle qui justifie le retrait de "Tête uniquement" pour les
  munitions (migration 160) — **ce n'était pas une erreur, contrairement à mon explication orale
  initiale qui ne citait pas cette source précise.**

**Conclusion RAW** : le gate de localisation dépend de **si l'arme/munition inflige aussi de vrais
dégâts physiques en plus du Choc**, pas de "tir vs CaC" :
- Dégâts physiques réels + Choc en supplément → Tête uniquement (sauf règle munition spécifique
  contraire, cf. Assommante).
- Choc seul (aucun dégât physique réel) → aucun gate.

**Correction (analyse à charge, 2026-07-21) — sourcing du retrait de gate en munitions** :
`REGLESMUNITIONS.md` ne contient **aucune** occurrence textuelle de "tête"/"localisation" (vérifié,
0 résultat) — le retrait du gate "Tête uniquement" pour la catégorie 3 n'est donc pas une règle
explicite de ce texte, mais une lecture par silence. C'est une interprétation **légitime et déjà
tranchée**, pas une nouvelle hypothèse : `docs/Old/PLAN_ARMES_DSL.md` (Lot B, confirmé Saar
2026-07-16) documente explicitement cette décision et l'a livrée/testée (migration
`160_fix_ref_equipment_choc_assommante.js`, scénarios "Choc appliqué quelle que soit la localisation").
**La source de vérité pour ce point est donc la décision Saar du Lot B, pas `REGLESMUNITIONS.md` lu
seul** — à citer ainsi pour qu'un lecteur qui vérifie la source retrouve l'autorité réelle.

**Rappel important pour le Palier 1 (catégories 1/2, §4)** : LdB p.243 dit, pour l'arme "normale" à
`shock` — *"la Résistance aux blessures du personnage s'applique"* au jet de Choc. C'est l'**inverse**
de la catégorie 3, où le Choc de munition est brut, jamais réduit (confirmé Saar, Lot B). Les
catégories 1/2 et 3 ne partagent donc pas le même comportement de réduction — un point que le §4
d'origine ne traitait pas (voir correction dans ce paragraphe plus bas).

---

## 3. Inventaire catalogue vérifié — armes à `shock` (`STEP1_cleaned_data.js`)

Toutes les armes ci-dessous existent réellement en base (`ref_equipment.shock` peuplé).

**Note (2026-07-22, confirmé Saar)** : les valeurs de `ref_equipment` (dégâts/Choc) peuvent différer
de la table "ARMES DE CONTACT" du Livre de Base — la base reflète la mise à jour du supplément
**Guide technique**, pas le LdB seul. Écart volontaire et valide, pas une erreur d'import. Vérifié par
recoupement ligne à ligne (Chalumeau, Dague thermique Thermo IV, Lance thermique Solar/Fléau,
Hache lourde, Masse, Bâton de combat, Batte Dicta, Poing choc, Grenade sonique, Grenade assommante) :
toutes les valeurs `shock` de ce catalogue sont confirmées exactes une fois cette source prise en
compte — aucune anomalie de catalogue restante sur ce périmètre. Seul bug réel trouvé, sans rapport
avec `CHOC1` : `damage_h` tronqué en base sur 4 armes (Chalumeau, Dague thermique Thermo IV, Lance
thermique Solar, Lance thermique Fléau — ex. `"2D10 (+1"` au lieu de `"2D10 (+1/tr)"`), à corriger
séparément si besoin, sans impact sur le Choc lui-même.

"Charge électrique" (`docs/PLAN_CAC_BATTERIE.md`, Session 163) est un système de **munitions/recharge**
indépendant — une arme qui tourne sur Charge électrique n'a pas forcément de Choc (ex. Dague moléc.
Pulsar : `shock=null`), et une arme peut avoir du Choc sans être liée à ce système. **Les deux ne sont
pas corrélés, attention à ne pas les confondre.**

### 3.1 — Cas simples : dégâts physiques réels + Choc (catégorie 1)

**`[HYPOTHÈSE]` non vérifiée par arme — à ne pas coder comme un fait acquis.** J'ai appliqué la règle
générale `REGLEBLESSURES.md` ("Tête uniquement" pour une arme normale + Choc) à ces 6 armes par
défaut, **sans relire la description propre de chacune** pour confirmer qu'aucune ne déroge — alors
que Gant choc (§3.3) déroge déjà pour une autre raison sur ce même principe général. Avant de coder le
gate, relire individuellement la `base_description` de chaque ligne ci-dessous dans
`STEP1_cleaned_data.js` pour chercher une dérogation explicite, comme fait pour Gant choc/Bâton
Ordonnateurs.

| Arme | Type | `damage_h` | `shock` | Note |
|---|---|---|---|---|
| Matraque Mao | CaC | 1D10 | 2D10 | Cas de référence, le plus simple |
| Poing choc | CaC | 1D6+3 | 1D10+2 | Idem |
| Électro-fouet | CaC | 1D10+3 | 1D10 | + mécanique de Saisie (chantier Lutte absent, séparé — voir §5) |
| Fusil sonique d'attaque | Tir | 1D10+3 | 1D10 | Confirme que la catégorie 1 existe aussi à distance |
| Gén. d'onde de choc | Tir | 1D10 | 2D10 | Arme de **zone** (ZE) — cible unique non représentative, voir §5 |
| Modulateur sonique | Tir | 1D6+1 | 1D6 | Arme de **zone constante** (ZE 10m, ré-attaque chaque Tour), voir §5 |

### 3.2 — Cas "Choc pur" (catégorie 2, aucun gate) — existe réellement, pas que théorique

**Correction (analyse à charge, 2026-07-21) — la même réserve que §3.1 s'applique ici, elle avait été
omise** : le plan initial appliquait la règle générale de dérogation individuelle uniquement au §3.1,
en présentant §3.2 comme propre/générique. Faux : `base_description` de **Dague neurale Brain**
(`STEP1_cleaned_data.js:2002`) dit littéralement *"Elle ignore toute protection"* — dérogation
explicite au comportement générique par défaut. Conséquence directe sur le §4 (armure/RD) : si le
Palier 1 réduit le Choc catégories 1/2 par `protection_shock` (RAW p.243, voir §2), Dague neurale
Brain doit être **exemptée** de cette réduction — donc pas un mécanisme purement générique à 5 armes
identiques, au moins une bespoke dans le lot "propre". Les 4 autres lignes ci-dessous ont été relues
individuellement (2026-07-21) : aucune autre dérogation trouvée dans leur `base_description`.

| Arme | Type | `damage_h` | `shock` | Note |
|---|---|---|---|---|
| Dague neurale Brain | CaC | **null** | 3D10 | **Dérogation confirmée** : ignore `protection_shock` (description propre) |
| Flex | Tir (pistolet) | **null** | 1D10 | Relue, rien de particulier |
| Fusil choc Stun | Tir | **null** | 3D10 | Relue, rien de particulier |
| Fusil sonique incap. sirène | Tir (zone) | **null** | 2D10+2 | Relue, rien de particulier (zone : voir §5) |
| Pistolet choc Stun II | Tir | **null** | 2D10 | Relue, rien de particulier |

### 3.3 — Exceptions bespoke, PAS candidates au mécanisme générique

| Arme | Pourquoi c'est un cas à part |
|---|---|
| Gant choc | Choc conditionné à l'**armure de la cible** ("sans protection ou protection simple"), pas à la localisation |
| Bâton Ordonnateurs | Mode électrique désactivable, attaque perforante spéciale, Test de panne électronique — arme unique multi-mécanique (80 000 sols) |
| Canon à infrasons | `damage_h`/`shock` = "Spécial" — table de 20 effets narratifs différents (1D20), rien à voir avec un jet de Choc standard |
| Sonar d'attaque(s) | `shock` = "Spécial" — zone sous-marine, "Test de résistance au Choc malus -5" sur toutes les créatures de la zone, pas un jet de dégâts |
| Canon sonique | `shock: null` malgré le nom — son "Choc" n'est qu'une conversion narrative sur Catastrophe, pas une valeur numérique |
| Disrupteur neural | `damage_h`/`shock` tous deux `null` — mécanique de malus/Test de Volonté propre, pas du Choc du tout malgré la catégorie catalogue |

### 3.4 — Mutation Corne — réécrit intégralement (analyse à charge, 2026-07-21)

**Le plan initial se trompait sur deux points ici : la citation du mécanisme et l'état réel
d'avancement. Corne n'est pas "hors catalogue armes, à part" — c'est le cas fondateur de `CHOC1`
(voir correction §1) et le candidat le plus avancé de tout l'inventaire.**

**Citation erronée corrigée** : ce n'est pas `char_mutation_effects_view` (vérifié : cette vue ne
porte que des modificateurs passifs d'attribut/résistance — `mod_FOR`..`mod_PRE`,
`mod_res_shock`/`mod_res_damage`/etc., migration 127 — rien sur une attaque active). Le vrai
branchement est `ref_mutations.natural_weapon_formula` / `natural_weapon_requires_grapple`
(migration `138_ref_mutations_natural_weapon.js`) + `shared/naturalWeapons.js` +
`resolveMeleeAction` (`socketCombatHelpers.js:1225-1251`), livré par `docs/Old/PLAN_MUTATION2.md`
Lot 4 sous-lot B.

**État réel `[VÉRIFIÉ]`** :
- Le dégât physique de base de Corne (`1D10`) est **déjà câblé, testé, confirmé par Saar en
  navigateur** ("Lot 4 ✅ CLOS — Session 141 (suite 25), fonctionnel confirmé Saar en navigateur").
- Le gate "après saisie" (`natural_weapon_requires_grapple: true`) lit `token_statuses` où
  `status_code='grappled'` — ce statut est **une infrastructure pleinement fonctionnelle** (toggle
  manuel MJ/joueur, `socketToken.js:143-169`, `TokenStatusPanel.jsx`), pas une simulation. Seule
  l'automatisation du Test d'opposition Lutte qui *poserait* ce statut par les dés reste absente
  (`docs/Old/COMPARATIF.md` §6.6) — mais Corne n'a besoin que de *lire* le statut, pas de le produire,
  et cette lecture existe déjà. Corne est donc **jouable aujourd'hui** pour ses dégâts physiques,
  contrairement à Électro-fouet (§5) dont l'usage Saisie est une action de l'arme elle-même, jamais
  câblée.
- Seul le bonus "+1D6 Choc si tête" manque — et c'est *exactement* le travail du Palier 1
  (`docs/Old/PLAN_MUTATION2.md:822-830`, "câbler le bonus de Corne proprement demanderait d'abord de
  brancher ce pool de Choc, chantier séparé et non trivial, hors scope [à l'époque]").

**Conséquence sur le scope Palier 1** : "ferme cette dette en même temps, sans travail supplémentaire"
était trop optimiste — il faut au minimum une nouvelle colonne (`ref_mutations.natural_weapon_choc_formula`
ou équivalent, même convention que `natural_weapon_formula`) et un branchement de `resolveMeleeAction`
dans le pipeline Choc générique du Palier 1 (voir §4). Ce n'est pas gratuit, mais c'est du **même ordre
de grandeur** que brancher une arme catalogue de plus — pas un chantier à part, et strictement moins de
travail que n'importe quelle arme à équipement puisque le gate de localisation et le gate de saisie
sont tous les deux déjà résolus par l'infrastructure existante.

---

## 4. Scope proposé — à trancher avec Saar avant tout code

**Palier 1 (généralisable, valeur immédiate — mais pas "juste brancher l'existant")** : mécanisme
générique s'appuyant sur le pool de Choc déjà construit (`damageService.resolveTargetHit`) pour les
§3.1 et §3.2. **Travail réel identifié (analyse critique du plan), pas un simple branchement** :

1. Les requêtes qui fetchent l'arme ne sélectionnent pas `shock` aujourd'hui — vérifié :
   `socketCombatHelpers.js:1216-1219` (CaC) et `:2293-2300` (tir, `fetchAssaultWeaponAndMods`) ne
   lisent que `damage_h`/`range`/`category`/`ammo_count`. Ajouter `ref_equipment.shock` aux deux
   `SELECT` est un prérequis, pas un détail acquis.
0. **Ajouté (run à vide, 2026-07-22) — prérequis bloquant catégorie 2, trouvé en traçant le code
   pas à pas plutôt qu'en le supposant correct** : le code actuel suppose partout que `damage_h IS
   NULL` signifie "pas d'arme, mains nues", jamais "arme réelle sans dégât physique" :
   - **Tir** : `resolveAssaultAction` (`socketCombatHelpers.js:2358`) refuse d'agir si
     `!primaryWeapon?.ref_damage_h` — `return` silencieux, aucune émission, un simple
     `console.warn` côté serveur. Flex/Fusil choc Stun/Pistolet choc Stun II/Fusil sonique incap.
     sirène (`damage_h=null`) **ne peuvent pas tirer du tout aujourd'hui**, indépendamment du Choc.
   - **CaC** : `resolveMeleeAction` (ligne 1214) initialise `damageFormula = '1D4'` (mains nues) et
     ne l'écrase que si `weapon?.ref_damage_h` est vrai (ligne 1222) — Dague neurale Brain
     (`damage_h=null`) résout donc aujourd'hui un **1D4 physique fantôme**, sans base RAW.
   - Corne n'est pas concernée (chemin `natural_weapon_formula` séparé, jamais ce gate).
   - À corriger **avant** de brancher le Choc catégorie 2, pas après — sinon Dague neurale Brain
     combine un Choc réel avec un dégât physique qui ne devrait pas exister, et Flex/Stun/Pistolet
     Stun II/sirène restent inutilisables même une fois le Choc câblé.
   - **Cause racine identifiée (2026-07-22, voir `docs/JOURNALTEMP.md` détail complet)** : côté tir,
     un seul point de résolution (`getEffectiveWeaponDamage`) existe déjà et suffit à corriger tous
     ses appelants automatiquement. Côté CaC, **ce point de résolution unique n'existe pas** — la
     formule de dégât est recalculée indépendamment à 2 endroits (`confirmMeleeDefense` PNJ,
     `confirmDamage` branche melee), chacun avec son propre `parseDice` non protégé. Ce n'est pas un
     bug isolé : c'est un trou d'architecture plus large, documenté séparément dans
     `docs/PLAN_REFONTECAC.md` (constat seul, aucune solution, portée volontairement plus large que
     `CHOC1`). **Ce plan (`CHOC1`) ne dépend que du correctif minimal** (distinguer "arme trouvée" de
     "damage_h vide" aux 3 points CaC + 2 points tir déjà cartographiés dans `JOURNALTEMP.md`) — il
     n'attend pas la refonte complète pour avancer, mais **les deux chantiers touchent les mêmes
     fichiers** (`resolveMeleeAction`, `confirmMeleeDefense`, `confirmDamage`) : à séquencer, jamais
     en parallèle sur le même code (risque de collision, voir décision Saar en cours).
2. Séquencement à concevoir avec `resolveTargetHit` : cette fonction calcule elle-même la localisation
   du coup (jet 1d20 interne ou `forcedSlotCode`) — le gate "Tête uniquement" catégorie 1 doit soit
   être vérifié **après** l'appel en lisant `localisation` dans son retour, soit être passé **en
   paramètre d'entrée** si on veut l'appliquer avant le calcul du pool. Non tranché dans ce plan — à
   décider avant de coder, pas pendant.
3. Câblage requis dans `resolveMeleeAction`/`confirmMeleeDefense` (CaC, absent aujourd'hui) **et**
   `resolveAssaultAction`/`getEffectiveWeaponDamage` (tir, absent aujourd'hui malgré la croyance
   initiale que "le tir marche déjà" — il marche pour les munitions, pas pour l'arme).
4. **Ajouté (analyse à charge, 2026-07-21) — réduction d'armure, point RAW manquant dans la version
   initiale** : p.243 dit explicitement que la Résistance du personnage (`protection_shock`/`prt`)
   s'applique au Choc catégories 1/2 (§2) — comportement **opposé** à la catégorie 3 (munitions),
   où le Choc reste brut par décision Saar (Lot B). `resolveTargetHit` calcule déjà `prt`
   (`ref_protection_shock`, lignes 208/226) mais le jette : le commentaire du code lui-même
   (`damageService.js:191-193`) annonce que `prt` est *"réservé au futur mécanisme arme (catégories
   1/2)"* — ce plan est ce mécanisme, il doit consommer ce `prt` déjà calculé. Exception à prévoir :
   Dague neurale Brain (§3.2) l'ignore explicitement.
   **Précision close (2026-07-22, voir `docs/SYSTEME/DOMMAGES.md` §1)** : "la Résistance du
   personnage" pour le Choc désigne `protection_shock` **seul** — jamais RD (Résistance aux
   Dommages), qui ne s'applique qu'au physique. Un seul flag `reducedByArmor` suffit, pas deux.
5. **Ajouté (analyse à charge, 2026-07-21) — invariant anti-double-Test-de-Choc, déjà rencontré une
   fois** : le Lot B (catégorie 3) a dû concevoir et tester explicitement *"un seul Test de Choc par
   coup, jamais deux"* quand dégât physique et Choc se combinent sur le même coup
   (`docs/Old/PLAN_ARMES_DSL.md`, §Lot B). Le Palier 1 recrée la même situation par construction
   (catégorie 1 = dégât physique + Choc sur le même coup, ex. Matraque Mao) — le même invariant doit
   être repris, pas reconçu.

**Recommandation d'architecture (analyse à charge, 2026-07-21)** : ne pas construire un second
pipeline parallèle à celui du Lot B. `resolveTargetHit` a déjà un pipeline générique et testé
(`chocDsl` → jet → total combiné avec le physique → sévérité unique → `resolveShockTest` unique). La
seule différence structurelle entre catégorie 3 (déjà câblée) et catégories 1/2 (Palier 1) est : (a)
un gate de localisation optionnel (`tete` uniquement pour catégorie 1, aucun pour catégorie 2 — la
munition catégorie 3 n'en a pas) et (b) une réduction d'armure optionnelle (catégories 1/2 oui,
catégorie 3 non). Le plus sûr est d'étendre la forme du paramètre `chocDsl`/`choc` déjà transporté par
`getEffectiveWeaponDamage`/`resolveTargetHit` avec deux champs (`gateLocation: 'tete'|null`,
`reducedByArmor: boolean`) plutôt que dupliquer la logique de combinaison/sévérité/test pour un
"Palier 1" séparé — c'est strictement la même mécanique RAW (p.243), seuls les paramètres changent
par catégorie. Deux producteurs alimenteraient ce même paramètre : `ref_equipment.shock` (armes) et
`ref_mutations.natural_weapon_choc_formula` (Corne, §3.4) — un seul consommateur, comme aujourd'hui.

**Décision actée (2026-07-22, Saar délègue le choix technique à Claude, recherche de prior art
demandée explicitement)** : format confirmé, aucune alternative retenue. Validation croisée avec
un système de référence de l'industrie VTT — les "Rule Elements" du système Pathfinder 2e pour
Foundry VTT (`foundryvtt/pf2e`, système en production, large communauté) résolvent la même classe de
problème ("effet secondaire conditionnel sur un coup, réutilisable par plusieurs sources catalogue")
avec un objet descriptif typé (`key`/`selector`/`value`/`predicate`) consommé par un moteur générique
unique — `predicate` jouant exactement le rôle du gate proposé ici, `value` celui de la réduction.
Extension `chocDsl` (`{action:'SET', value}` → `+ {gateLocation, reducedByArmor}`) confirmée comme la
même famille de solution, pas une improvisation isolée. Deux points vérifiés dans le code réel pour
s'assurer que l'extension ne demande aucun mécanisme nouveau :
- `chocDsl` est déjà un objet typé (`shared/weaponAmmoDsl.js:94-96`), pas une chaîne brute — ajouter
  deux clés est une croissance de la même forme, pas un nouveau concept à maintenir.
- `prt` (protection_shock) est déjà calculé par `calcResistanceArmure` (`server/src/lib/charStats.js:309-317`,
  retourne `{etq, prt}`) mais jeté à `damageService.js:302` (seul `.etq` est repris) — `reducedByArmor`
  ne demande donc aucun nouveau calcul, seulement de cesser de jeter une valeur déjà produite.
- Le gate `gateLocation` se vérifie après l'étape 1 de `resolveTargetHit` (localisation déjà connue,
  ligne ~250), avant la combinaison du total au point 3bis (ligne ~333) — pas de changement de
  séquencement de la fonction, une condition de plus sur un chemin déjà exécuté à chaque coup.

Point technique du §6 (point 2) clos par cette recherche — reste uniquement la décision de scope
(lancement Palier 1 maintenant ou différé, question ouverte ci-dessous), qui n'est pas un choix
technique et reste à Saar.

**Inventaire final, vérifié base réelle + tables RAW du Livre de Base/Guide technique (2026-07-22,
zéro écart trouvé sur les deux catégories, détail §1/§3)** :

- **Palier 1 (généralisable, ~19 candidats)** — catégorie 1 (physique + Choc, gate Tête) : Matraque
  Mao, Poing choc, Électro-fouet, Fusil sonique d'attaque, Batte Dicta, Bâton de combat, Canne de
  combat, Gant énergétique, Hache, Hache lourde (2M), Masse, Massue en bois, Massue en os, Lance-flammes
  (Choc seul, réserve Rafale longue — voir §5) ; catégorie 2 (Choc pur, aucun gate) : Dague neurale
  Brain (réduction d'armure exclue, §3.2), Flex, Fusil choc Stun, Fusil sonique incap. sirène,
  Pistolet choc Stun II ; + mutation Corne (§3.4). Chalumeau/Dague thermique Thermo IV/Lance thermique
  Solar/Fléau ont un Choc catégorie 1 confirmé RAW mais restent **non câblables tant que leur
  `damage_h` tronqué n'est pas corrigé séparément** (§3, bug distinct de `CHOC1`).
- **Armes de zone** (Gén. d'onde de choc, Modulateur sonique, Fusil sonique incap. sirène, Grenade
  assommante, Grenade sonique) : Choc confirmé RAW, traitées en cible unique dans ce palier — voir §5
  pour la réserve sur cette simplification. Grenade sonique porte en plus une réduction d'armure
  bespoke, indépendante du Choc.

**Palier 2 (bespoke, un par un, comme les Lots SAP/HP/Explosive de `PLAN_ARMES_DSL.md`)** : Gant choc
(gate sur l'armure de la cible, pas la localisation), Bâton Ordonnateurs (mode électrique togglable,
consomme une charge) — chacun sa propre petite mécanique, indépendante du Palier 1. TMP I/II hors
scope pour une raison structurelle différente : domaine "armes à énergie" déjà mis à part
(`REGLEDRONE.md`, migration 178), et physique/Choc y sont deux **modes alternatifs** du tireur, jamais
combinés sur le même tir — le pipeline générique (toujours combiné) ne peut pas s'appliquer tel quel.

**Hors scope explicite, confirmé RAW, aucun Choc réel** : Canon à infrasons, Sonar d'attaque(s),
Disrupteur neural, Canon sonique, Grenade étourdissante — mécaniques narratives/spéciales ou tirage
direct sur le Test de Choc sans pool de dégâts, aucune ne dépend de `CHOC1`. Armes de zone en tant que
**mécanisme de zone réel** (plusieurs cibles) — nécessite un système de zone d'effet qui n'existe pas
encore, tous domaines confondus (pas seulement Choc).

**Décision de lancement actée (Saar, 2026-07-22)** : Saar a explicitement refusé de trancher sur un
critère d'usage en jeu ("nous sommes en développement, TOUT est à faire, les seules priorités sont
techniques") et délégué le go/no-go à une lecture de préparation technique — GO. Justification
technique de ce GO, pas un usage de campagne : les deux verrous qui auraient rendu un lancement
prématuré sont déjà levés (prérequis catégorie "damage_h vide ≠ arme introuvable" codé et validé en
jeu, Session 168 ; séquencement avec `docs/PLAN_REFONTECAC.md` clos) et le format technique du
mécanisme est déterminé et validé contre un système de référence (§4 ci-dessus) — aucun blocage
architectural résiduel ne justifierait d'attendre. Corne reste le candidat le plus sûr pour valider le
mécanisme en premier (le moins de nouvelles inconnues, déjà prêt côté physique/gate de saisie) —
c'est aussi le cas qui a motivé la création de `CHOC1` (§1), sa fermeture referme la dette à sa
racine.

---

## 5. Angles morts identifiés par analyse critique du plan — aucun tranché

- **Équilibrage** : aucune évaluation du risque qu'une arme catégorie 1/2 touchant en Tête plus
  souvent que prévu par les auteurs du LdB ne devienne un stun-lock trop efficace en jeu réel. À
  évaluer après un premier test, pas avant — mais à ne pas oublier de le faire.
- **Interaction avec Localisation précise (COM9)** : si un joueur force un coup en Tête via Viser une
  Localisation (`aimed_location`), le gate catégorie 1 doit logiquement s'activer — non vérifié que
  `resolveTargetHit`/`forcedSlotCode` expose cette information au bon endroit pour ce cas précis.
- **Armes de zone** (Gén. d'onde de choc, Modulateur sonique, Fusil sonique incap. sirène) : les
  traiter en cible unique (Palier 1) est une simplification, pas une implémentation fidèle — à évaluer
  si c'est acceptable ou si mieux vaut les exclure du Palier 1 plutôt que de les dénaturer.
- **Électro-fouet** : classé "simple" en §3.1, mais son usage complet dépend d'un chantier entier
  absent (Lutte/Saisie, `docs/REGLES/REGLESYSCOMBAT.md` §6.6, confirmé absent par
  `docs/Old/COMPARATIF.md`). **Précision (analyse à charge, 2026-07-21)** : sa description catalogue
  (`STEP1_cleaned_data.js:2212`) dit que l'arme peut *"saisir"* elle-même la cible et lui infliger des
  dégâts "à chaque Tour tant qu'elle ne s'est pas dégagée" — c'est une action de Saisie **active**
  (écrire le statut `grappled`), pas une simple lecture. C'est différent du cas Corne (§3.4, corrigé),
  qui ne fait que *lire* un statut `grappled` déjà posé par ailleurs — infrastructure de lecture
  existante et suffisante pour Corne, insuffisante pour la Saisie active de l'Électro-fouet. Son Choc
  seul (catégorie 1, gate Tête) peut être câblé indépendamment par le Palier 1, mais ne pas présenter
  l'arme comme pleinement fonctionnelle pour autant — sa fonction de Saisie reste hors scope, bloquée
  par le même chantier Lutte que documenté ici.
- **Réduction d'armure catégories 1/2** : traitée comme angle mort dans la version initiale de ce
  plan — déplacée en §4 point 4 (RAW p.243 explicite, pas une nuance de design).

---

## 6. Non fait dans ce document

Aucune ligne de code, aucune migration, aucun test — recherche et inventaire uniquement, conformément
à la demande de Saar. **Scope tranché (2026-07-22) : Palier 1 GO** (voir §4, "Décision de lancement
actée"). Ce plan est maintenant clos pour sa mission (recherche + scope) ; le design détaillé
d'exécution (fichiers exacts, migration, séquencement des changements) est produit séparément avant
tout code, tracé dans `docs/EN_COURS.md`/`docs/JOURNALTEMP.md` comme les chantiers précédents de ce
même document (prérequis Étapes 5-9) — pas dupliqué ici une fois clos (Règle 10).

**Implémenté (2026-07-22, `docs/JOURNALTEMP.md` Étape 11)** : migration 190, producteurs
`damageService.js`, gate/réduction `resolveTargetHit`, câblage CaC `socketCombatHelpers.js`. Testé par
scripts isolés (dont la réduction d'armure réelle, transaction jamais commitée) + non-régression suite
`shared/*.test.mjs` (214/214) — **non testé en jeu**, reste l'étape de clôture avant absorption
définitive dans `docs/SYSTEME/DOMMAGES.md`. Découverte séparée au passage : `protection_shock` est
NULL sur 100% du catalogue `ref_equipment` aujourd'hui — la réduction d'armure catégories 1/2 est
câblée et vérifiée correcte, mais restera sans effet observable tant qu'aucune armure catalogue n'a de
valeur réelle (dette de donnée distincte, hors scope `CHOC1`).

**Reste bloquant avant tout code (mis à jour 2026-07-22)** :
1. ~~La requête base réelle du §1~~ — **close** : exécutée, recroisée avec les deux tables RAW
   (Armes de contact + Armes étourdissantes et soniques), zéro écart, inventaire final au §4.
2. ~~La décision sur le format exact de la recommandation d'architecture du §4~~ — **clos (2026-07-22)** :
   Saar a explicitement délégué ce choix technique et demandé une recherche de prior art avant de le
   figer. Format confirmé (extension `chocDsl` avec `gateLocation`/`reducedByArmor`), validé contre le
   système de "Rule Elements" de PF2e/Foundry VTT (même classe de problème, pattern de production
   établi) et contre le code réel (`chocDsl` déjà un objet typé, `prt` déjà calculé et jeté) — détail
   complet §4. N'est plus un point bloquant pour la conception ; reste seulement la décision de scope
   ci-dessous (non technique, celle-là reste à Saar).
   **Prérequis (point 0 ci-dessus) codé (2026-07-22, repris à l'Étape 7 après retour de l'agent
   refonte)** — côté tir : correctif ciblé (`getEffectiveWeaponDamage`/`getEffectiveWeaponFormulaPreview`/
   garde `resolveAssaultAction`). Côté CaC : **une fonction unique** `getEffectiveMeleeDamage`
   (`damageService.js`, même contrat que le tir), qui remplace 5 appels directs à `parseDice`
   trouvés dans `resolveMeleeAction` (3, pas 2 comme cartographié initialement) +
   `confirmMeleeDefense` + `confirmDamage` — détail complet, raisons de conception et statut
   Testé/Non testé dans `docs/JOURNALTEMP.md` Étape 6/7. **Validé en jeu (2026-07-22, Étape 8,
   `docs/EN_COURS.md` Item 106)** : tir Flex, CaC Matraque Mao (non-régression), CaC mains nues, CaC
   Dague neurale Brain (cas critique) — tous testés avec succès, aucune erreur serveur. Bug additionnel
   trouvé et corrigé au passage : `shared/weaponSlots.js` ne reconnaissait pas une arme Choc pur comme
   "arme en main" côté MJ. **Prérequis clos, verrou de séquencement avec `docs/PLAN_REFONTECAC.md` levé.**
   Chemins non exercés en jeu (PJ réel, cible sans défense, PNJ vs drone) : seulement `node --check`,
   risque résiduel jugé faible (même fonction unique que le chemin testé).
3. Correction séparée, non bloquante pour `CHOC1` : `damage_h` tronqué sur 4 armes (Chalumeau, Dague
   thermique Thermo IV, Lance thermique Solar/Fléau) — les empêche d'être câblées au Palier 1 tant que
   ce n'est pas corrigé, mais indépendant de la mécanique Choc elle-même.
4. Correction cosmétique différée, non bloquante : retitrer l'entrée `CHOC1` dans
   `docs/BUGIDENTIFIE.md` pour refléter l'origine réelle (§1).
6. **Ajouté puis clos (run à vide post-commit, 2026-07-22)** : trois trous de la même famille trouvés
   en continuant l'analyse après le commit du prérequis — deux fenêtres étroites (tir
   `resolveAssaultAction ~2765`, CaC `getEffectiveMeleeDamage`) et un bug reproductible à volonté
   (tir à deux armes, arme Choc pur en main secondaire jamais détectée). **Les trois corrigés**,
   syntaxe vérifiée, non testés en jeu. Détail complet : `docs/EN_COURS.md` Item 106,
   `docs/JOURNALTEMP.md` Étape 9/10.
5. ~~**Séquencement acté (Saar, 2026-07-22)**~~ — **clos.** Le correctif minimal `CHOC1` (`getEffectiveMeleeDamage`,
   `docs/JOURNALTEMP.md` Étapes 5-8) est codé et testé en jeu (Session 168, `docs/EN_COURS.md` Item 106).
   Verrou levé sur `docs/PLAN_REFONTECAC.md` — la refonte CaC peut reprendre sa planification. Le Palier 1
   (ce document, point 2 ci-dessus) reste une décision de scope séparée, toujours due à Saar.
