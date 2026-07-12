# PLAN_MODING_PHASEB.md — Effets mécaniques des mods d'armes en combat
> Rédaction initiale : Session 141 (suite 21 suite), 2026-07-12 — mis à jour Session 141 (suite 28), 2026-07-12
> Fait suite à `docs/PLAN_MODING.md` (Phase A — rangement pur, terminée). Ce document couvre
> exclusivement la Phase B : l'effet mécanique en combat des mods déjà installables depuis la
> Phase A. Responsabilité unique de ce fichier : planifier Phase B, ne duplique pas Phase A.
> **État (2026-07-12, Session 141 suite 28)** : **Architecture des slots exclusifs + Groupe 1 (bonus
> fixes optique) codés et confirmés fonctionnels par Saar** — migration `141_ref_equipment_mod_slots.js`
> (numérotée 141, collision de numéro 140 avec une session parallèle, voir `docs/JOURNAL6.md`
> "Session 141 (suite 28)" pour le détail complet des tests). Groupe 2 (Lunette) reste entièrement
> tranché mais non codé — prochain chantier. Groupe 3 (Trépied/Harnais) retiré de Phase B →
> `docs/ROADMAP.md`. Groupe 4 (logiciel) structuré, pas détaillé ligne à ligne.

---

## Méthode

Demande explicite Saar : rigueur avant vitesse ("sérieuse", "Architecture robuste", "Analyse
critique"), travail séquentiel groupe par groupe, jamais plusieurs groupes dans le même chantier de
code. Ce document capture l'état de la réflexion à date — certains groupes sont prêts à coder,
d'autres restent ouverts.

Sources vérifiées avant toute proposition (jamais de mémoire) :
- `docs/REGLES/REGLESYSCOMBAT.md` lu (Test de tir, Tir visé, Tir de précision, modificateurs de
  circonstances)
- `docs/REGLES/REGLECOMPETENCE.md` lu (Armes lourdes contact/tir, Tir automatique — règle "stable")
- Les 16 lignes `ref_equipment` (`family='Armes'`, `category='Accessoires pour armes'`) — colonnes
  `bonus`/`description` complètes, croisées avec la source brute pré-migration
  (`docs/Old/script Extraction Excel/equipement/ref_equipments_data.js`, texte LdB intégral, pas
  tronqué)
- Code de résolution combat réel : `resolveAssaultAction` (`server/src/socket/
  socketCombatHelpers.js:1239-1345`) — point d'insertion exact identifié
- Mécanisme d'exclusivité déjà livré pour Tir visé (`shared/combatExclusiveActions.js`, Session 141
  suite 17) — pattern de référence pour toute nouvelle exclusivité
- `docs/Old/JARMES.md` (Session 8) — historique de la dette "Tr traité comme 2M"

---

## Constat central — la colonne `bonus` ne veut pas dire la même chose partout

Piège trouvé en creusant : sur les 16 accessoires, `ref_equipment.bonus` est un nombre non-null
pour 9 d'entre eux, mais **seuls 5 sont un vrai bonus additif au Test de tir**. Les 4 autres sont un
**seuil de fonctionnement** pour un mécanisme entièrement différent (Test séparé dont le résultat
modifie autre chose que le Test de tir lui-même). Confondre les deux aurait produit un bug de règle
silencieux (ex. ajouter +15 au Test de tir pour un Projecteur de mouvement qui n'en donne pas).

| Item | `bonus` | Nature réelle | Slot |
|---|---|---|---|
| Système de tir assisté : Cyclope PVI | 4 | Bonus fixe Test de tir | optique |
| Système de tir assisté : Implant palmaire | 1 | Bonus fixe Test de tir | optique |
| Système de tir assisté : Visière Onarck P | 2 | Bonus fixe Test de tir | optique |
| Système de tir assisté : Visière Vanguard | 3 | Bonus fixe Test de tir | optique |
| Systèmes d'aide à la visée : Visée laser | 2 | Bonus fixe Test de tir | optique |
| Systèmes d'aide à la visée : Calculateur laser | null | Outil de mesure, aucun bonus | optique |
| Systèmes d'aide à la visée : Lunette de visée (×10, niv.1-10) | 1 à 10 (réel, par ligne) | Variante de Tir visé — mécanique propre | optique |
| Mémoire de cibles Mémo | 15 | Seuil de fonctionnement (Test de reconnaissance de cible) | logiciel |
| Projecteur de mouvement | 15 | Seuil de fonctionnement (Test réduisant le malus de cible en mouvement) | logiciel |
| Système réactif autonome R.N.T. Jaguar 400 | 12 | Seuil de fonctionnement (arme autonome — IA de tir) | logiciel |
| Analyseur tactique individuel A.T.I Alpha | 8 | Seuil de fonctionnement (bonus/malus croissant par round, stateful) | logiciel |
| Mémoire de cibles : Bloc afficheur de données | null | Compagnon explicite du Mémo ("à coupler avec") — jamais exclusif | **aucun** |
| Poignée d'identification | null | Narratif (sécurité), aucun effet mécanique | poignee |
| Silencieux | null | Narratif (discrétion — mécanique Furtivité, hors Test de tir) | canon |
| Trépied | null | Retiré de Phase B → `docs/ROADMAP.md` | support (hors Phase B) |
| Harnais mécanisé | null | Retiré de Phase B → `docs/ROADMAP.md` | support (hors Phase B) |

---

## Architecture des slots exclusifs — fondation commune Groupe 1/2/4

**Décision validée par Saar (2026-07-12), remplace toute tentative précédente de gérer
l'exclusivité au moment du calcul de combat** (`accessory_group` + "prendre le max" — abandonné,
cassait dès qu'un item à mécanique conditionnelle comme la Lunette entrait dans le même groupe
qu'un bonus plat). L'exclusivité se règle **à l'installation**, jamais à la résolution.

### Principe

Chaque arme a au plus **un item actif par slot**. Installer un 2ᵉ item dans un slot déjà occupé
**remplace automatiquement** l'ancien (retour en inventaire), dans la même transaction — pas de
rejet 409 "désinstallez d'abord", pas de bouton "désinstaller" séparé à concevoir. Comme il ne peut
jamais y avoir plus d'un item par slot, le calcul de combat n'a plus jamais besoin de choisir entre
plusieurs candidats — il n'y en a jamais qu'un.

### Modèle de données

```
ref_equipment.mod_slot          TEXT nullable   -- 'optique' | 'logiciel' | 'canon' | 'poignee' | NULL
ref_equipment.mod_requires_aim  BOOLEAN NOT NULL DEFAULT false  -- true uniquement pour les 10 lignes Lunette
```

Deux axes orthogonaux, décidés séparément :
- `mod_slot` = quel emplacement physique exclusif l'item occupe (bloque l'installation croisée)
- `mod_requires_aim` = comment son bonus se calcule (plat sur chaque tir vs conditionné à un Tir visé)

### Slots retenus (validés Saar)

| Slot | Items | Exclusivité |
|---|---|---|
| `optique` | Cyclope PVI, Implant palmaire, Onarck P, Vanguard, Visée laser, Calculateur laser, Lunette ×10 niveaux | Un seul actif — remplacement auto |
| `logiciel` | Système réactif autonome, Analyseur tactique, Projecteur de mouvement, Mémoire de cibles Mémo | Un seul actif — remplacement auto |
| `canon` | Silencieux | Un seul candidat aujourd'hui — aucun conflit possible |
| `poignee` | Poignée d'identification | Un seul candidat aujourd'hui — aucun conflit possible |
| **aucun** (`NULL`) | Bloc afficheur de données | Jamais exclusif — compagnon explicite du Mémo (`"à coupler avec"`), le mettre dans `logiciel` désinstallerait le Mémo qu'il accompagne |
| *(hors Phase B)* | Trépied, Harnais | Retirés → `docs/ROADMAP.md` "Tourelles / armes lourdes fixes" |

**Calculateur laser** rejoint `optique` bien qu'il n'ait aucun bonus (`bonus=null`) — l'exclusivité
de slot est physique (un seul point de fixation optique), pas conditionnée à l'existence d'un bonus
de Test de tir. Erreur initiale corrigée en discussion : "pas de bonus" et "pas de slot" sont deux
questions indépendantes, confondues par réflexe la première fois.

### Branchement — `modingService.installMod`

Avant d'insérer dans `char_inventory_mods` : si `modRef.mod_slot` n'est pas `NULL`, chercher un mod
déjà installé sur la même arme avec le même `mod_slot`. Si trouvé → le retourner en inventaire
(même mécanisme que `removeItem`, sens inverse — réinsertion/incrément `char_inventory`) dans la
**même transaction**, puis installer le nouveau. Réutilise et étend la logique déjà posée pour P7
(gestion des stacks) sans construire de fonctionnalité "désinstallation libre" séparée — le swap est
interne, déclenché uniquement par une installation conflictuelle.

**Garde-fou DB obligatoire (analyse critique 2026-07-12)** : le check-then-act ci-dessus, seul,
reproduit exactement le bug de course déjà trouvé et corrigé en Phase A pour l'anti-doublon
`equipment_id` (deux installations concurrentes dans le même slot pourraient toutes les deux lire
"slot vide" avant qu'aucune n'ait commité). Postgres ne peut pas contraindre `UNIQUE` sur une colonne
d'une autre table via JOIN — `char_inventory_mods` ne connaît aujourd'hui que `equipment_id`, pas
`mod_slot`. Correctif : **dénormaliser `mod_slot` sur `char_inventory_mods` elle-même**, snapshotté à
l'installation (même principe que `mod_name` déjà snapshotté), avec :
```
char_inventory_mods.mod_slot  TEXT nullable
UNIQUE (weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL   -- index partiel, précédent uq_char_mut_no_sub
```
Le code applicatif (check-then-swap) reste comme optimisation du cas normal ; la contrainte devient
la vraie garde contre la course, avec le même pattern de catch (`23505` → 409) que Phase A.

**Edge case swap + catalogue supprimé** : si l'ancien occupant du slot a son `ref_equipment`
supprimé entretemps (`char_inventory_mods.equipment_id` → `NULL` via `ON DELETE SET NULL`), le
retour en inventaire n'a plus d'`equipment_id` valide à réinsérer. À gérer explicitement au codage
(ex. skip le retour + log, l'item est perdu proprement plutôt que de planter la transaction) —
pas laissé implicite.

### Validation externe — recherche pro demandée par Saar (2026-07-12)

**Contrainte UNIQUE partielle** : confirmée comme LE pattern PostgreSQL de référence pour "un seul
actif par groupe" (doc officielle, exemple canonique "une seule souscription active par
utilisateur" — structurellement identique à notre besoin), pas une solution maison. **Détail
d'implémentation à retenir** : si le code utilise un jour `ON CONFLICT` (upsert) plutôt qu'un
`INSERT` + catch d'erreur, la clause `ON CONFLICT` doit reproduire *exactement* (caractère pour
caractère) la condition `WHERE` de l'index partiel pour être reconnue — non applicable au design
actuel (catch `23505` prévu, pas d'`ON CONFLICT`), mais à surveiller si l'approche change au codage.

**Comparaison avec un système pro comparable** : les "Weapon Fusions" de Starfinder (Foundry VTT,
dépôt open-source `foundryvtt-starfinder`) résolvent le même problème (mods multiples sur une arme)
par un **budget de capacité** (somme des niveaux de fusions ≤ niveau de l'arme) plutôt que des slots
exclusifs par catégorie. **Alternative écartée consciemment, pas ignorée** : notre source LdB
énonce une exclusion catégorielle explicite ("non cumulables, on prend le plus performant"), pas un
budget de points — le modèle slots reste le choix fidèle au texte sourcé.

**Trouvaille collatérale, valide notre rigueur de test** : le dépôt Starfinder a un ticket ouvert
réel (**issue #455**, `foundryvtt-starfinder/foundryvtt-starfinder`) — *"Weapon accessories and
fusions not adding their modifiers to weapons rolls"*. Un système professionnel shippé a rencontré
exactement la classe de bug qu'on cherche à éviter depuis le début de Phase B (mod installé sans
effet réel sur le jet) — confirme que les tests réels prévus (pas seulement en théorie) sont
justifiés, pas de la prudence excessive.

Sources : [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html),
[PostgreSQL Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html),
[Starfinder Weapon Fusions — Archives of Nethys](https://www.aonsrd.com/Rules.aspx?ID=86),
[Issue #455 — foundryvtt-starfinder](https://github.com/foundryvtt-starfinder/foundryvtt-starfinder/issues/455).

---

## Découpage en groupes — état à date

### Groupe 1 — bonus fixes au Test de tir ✅ CODÉ, confirmé fonctionnel Saar (Session 141 suite 28)

**Périmètre exact : les items `mod_slot='optique'` avec `mod_requires_aim=false`** — Cyclope PVI,
Implant palmaire, Onarck P, Vanguard, Visée laser (Calculateur laser aussi dans le slot mais
`bonus=null`, ne contribue jamais). La Lunette (`mod_requires_aim=true`) est **structurellement
exclue** de ce calcul — pas par un filtre "entier valide" fragile comme dans une version précédente
de ce plan (cassé dès que la Lunette a de vraies valeurs entières 1-10), mais par la colonne dédiée.

**Logique** — nouvelle fonction pure dans `server/src/services/modingService.js` :
```
calcWeaponModBonus(installedMods)
  → cherche le (au plus un, garanti par le slot) item mod_slot='optique' installé
  → si trouvé ET mod_requires_aim=false ET bonus est un entier valide → { total: bonus, breakdown: [{name, value}] }
  → sinon → { total: 0, breakdown: [] }
```
Plus besoin de "grouper puis prendre le max" — l'exclusivité étant déjà garantie à l'installation,
il n'y a jamais qu'un seul candidat à examiner.

**Branchement** — `resolveAssaultAction` (`socketCombatHelpers.js:1239-1345`) :
- fetch `char_inventory_mods ⋈ ref_equipment` pour `action.weapon_inv_id`, en parallèle du fetch
  arme existant (ligne 1239, ajout au `Promise.all`)
- `weaponModComp = calcWeaponModBonus(installedMods).total` ajouté à `totalModComp` (ligne 1322)
- entrée `breakdown` ajoutée (ligne ~1334, même emplacement que `aimBonusComp`), nommant l'item
  précis retenu (ex. "Cyclope PVI" +4), pas juste "Mod arme"

**Tests prévus avant livraison** (réels, base réelle, fixture jetable + nettoyage vérifié — pattern
Phase A) :
- Sans mod installé → comportement strictement identique à aujourd'hui (`weaponModComp = 0`)
- 1 mod optique installé → bonus appliqué exactement
- Installer un 2ᵉ mod optique → le 1ᵉʳ revient en inventaire, un seul actif, `weaponModComp` reflète
  uniquement le nouveau
- Lunette installée seule (`mod_requires_aim=true`) → `weaponModComp = 0`, jamais confondue avec un
  bonus plat
- Item `logiciel` installé (ex. Analyseur tactique) → jamais pris en compte dans `weaponModComp`
  (slot différent)

---

### Groupe 2 — Lunette de visée ✅ PLAN VALIDÉ, PRÊT À CODER

Pas un bonus additif — une variante du Tir visé lui-même. Règle LdB : niveau 1-10 (+1/niveau,
max +10), Tir visé obligatoire, 1 point d'Initiative par point de bonus (au lieu de 2 pour le
Tir visé de base), bonus lunette et bonus Tir visé non cumulatifs (le plus élevé des deux).

**Modèle catalogue** : le gap de données (une seule ligne générique `bonus="niv"`, aucune notion de
niveau 1-10) est résolu par **10 lignes catalogue distinctes** ("Lunette de visée niv. 1" à
"niv. 10"), chacune `bonus` = l'entier réel 1-10, `mod_slot='optique'`, `mod_requires_aim=true`,
`price` littéral précalculé (1000×niv², formule trouvée dans `ref_equipment.price_modifier` —
jamais exploitée par le code d'achat, voir dette `EQ1` dans `BUGIDENTIFIE.md`, hors scope ici).
Remplace l'ancienne ligne générique, **0 usage réel vérifié** (0 en `char_inventory`, 0 en
`char_inventory_mods`) — remplacement propre sans perte de données.

**Plafond par portée** — LdB : *"un personnage ne devrait pas pouvoir utiliser une lunette de
niveau supérieur à 3 à courte portée, ou supérieur à 5 à moyenne portée"* :
```js
// shared/combatExclusiveActions.js
export const LUNETTE_MAX_NIVEAU = 10  // LdB : "jusqu'à un maximum de +10"
export const LUNETTE_PORTEE_CAP = {
  bout_portant: 0,        // EXTRAPOLÉ — non sourcé LdB, validé comme hypothèse par Saar
  courte:       3,
  moyenne:      5,
  longue:       LUNETTE_MAX_NIVEAU,
  extreme:      LUNETTE_MAX_NIVEAU,
}
```

**Refonte du calcul Tir visé** — au lieu d'un mode que le joueur choisit, le joueur choisit toujours
"combien de points de bonus" (comme aujourd'hui), le serveur prend automatiquement le taux le moins
cher entre le système classique et la lunette (capture "non cumulatifs, on prend le plus élevé"
sans aucun nouveau contrôle UI) :
```js
function getClassicAimCost(points) {
  return points > AIM_MAX_TRANCHES ? Infinity : points * 2
}
function getLunetteAimCost(points, lunetteNiveau, portee) {
  const cap = Math.min(lunetteNiveau ?? 0, LUNETTE_PORTEE_CAP[portee] ?? 0)
  return points > cap ? Infinity : points * 1
}
export function getAimIniCost(points, { lunetteNiveau = 0, portee = null } = {}) {
  const cost = Math.min(getClassicAimCost(points), getLunetteAimCost(points, lunetteNiveau, portee))
  return cost === Infinity ? null : -cost
}
```
`lunetteNiveau` provient du (au plus un, garanti par le slot `optique`) item `mod_requires_aim=true`
installé sur l'arme utilisée — 0 si aucune lunette installée, comportement strictement identique à
aujourd'hui.

**Correction critique (analyse 2026-07-12) — `getAimBonusComp` oublié dans la refonte initiale.**
Vérifié dans le code réel (`socketCombatAnnouncement.js:220,263`) : le serveur appelle **deux
fonctions séparées** — `getAimIniCost(aimTranches)` pour le coût ET `getAimBonusComp(aimTranches)`
pour le bonus réellement stocké sur `combat_actions.aim_bonus_comp`. Ne redessiner que la première
aurait produit une incohérence silencieuse : coût moins cher grâce à la lunette, mais bonus stocké
resté plafonné à l'ancien maximum (5) — le joueur paierait moins pour un résultat jamais amélioré.
Les deux fonctions doivent changer de signature **en miroir**, avec le même contexte :
```js
export function getAimBonusComp(points, { lunetteNiveau = 0, portee = null } = {}) {
  const cost = getAimIniCost(points, { lunetteNiveau, portee })
  return cost === null ? 0 : points  // points atteignable si un coût fini existe pour ce nombre de points
}
```
(signature exacte à affiner au codage — le principe à retenir est qu'aucune des deux fonctions ne
doit être étendue sans l'autre).

**Impact code, périmètre réel (élargi après vérification)** :
- `AIM_MAX_TRANCHES`/`AIM_INI_PER_TRANCHE`/`getAimBonusComp`/`getAimIniCost`
  (`shared/combatExclusiveActions.js`) — les deux fonctions, en miroir, pas une seule
- `socketCombatAnnouncement.js:220,263` — passer `{ lunetteNiveau, portee }` aux deux appels
- **`AssaultRangedPanel.jsx:193`** — pas juste "refléter un plafond différent" : le contrôle que le
  joueur manipule (`aimTranches`) est aujourd'hui **physiquement limité à `AIM_MAX_TRANCHES` (5)**
  dans l'UI elle-même. Sans étendre cette plage, une lunette niv.6-10 resterait inutilisable en
  pratique même avec un serveur correct. **Vérifié : composant partagé** — utilisé à la fois par la
  fenêtre joueur (`CombatActionWindow.jsx`) et `CombatGmDeclareWindow.jsx:840` (import direct), donc
  un seul endroit à corriger, pas une duplication à chercher dans les deux fenêtres.

**Non détaillé à ce stade** : le câblage exact ligne-à-ligne (nouvelle plage de valeurs dans l'UI,
affichage du plafond effectif selon portée/lunette équipée) — le modèle de données et les deux
formules sont figés, l'intégration précise dans les fichiers existants reste à faire au moment de
coder.

**Conditions environnementales Visée laser — non automatisées, à confirmer explicitement.**
*"Ne fonctionne pas dans l'eau, ni en cas de brouillard ou de fumée épaisse"* — jamais mentionné
avant l'analyse critique. Aucun état de ce type n'est actuellement suivi (`combat_roster`/situation)
de façon exploitable automatiquement. Traité comme jugement MJ narratif (cohérent avec le reste du
non-mécanisé de ce plan), **pas un oubli** — mais tranché ici explicitement plutôt que laissé
implicite.

---

### Groupe 3 — Trépied / Harnais ❌ RETIRÉ DE PHASE B, déplacé vers `docs/ROADMAP.md`

Analysé en détail (déclencheur slot `'Tr'`, formule de division, non-régression vérifiée en base —
0 arme équipée en `'Tr'` aujourd'hui), puis **reconsidéré par Saar (2026-07-12)** : une arme de type
tourelle/lourde n'est pas un item porté avec un simple malus de Test de tir — c'est une **entité
interactive placée sur le playground** (réutilise le système d'entités déjà construit, Chantiers
9C-9E ✅), pas une arme d'inventaire. Trépied/Harnais deviennent des **prérequis achetables** pour
interagir avec ce type d'entité, pas des mods installés sur une arme portée au sens de la Phase A.

**Hors responsabilité de ce document** (Phase B = effets mécaniques des mods installés sur une arme
d'inventaire existante). Détail complet, y compris la règle source retrouvée entre-temps
(`REGLECOMPETENCE.md` : la division par deux s'applique au **niveau de la Compétence**, pas au
Seuil final — correction par rapport à la formule initialement esquissée ici) : voir
`docs/ROADMAP.md` §"Tourelles / armes lourdes fixes".

---

### Groupe 4 — slot `logiciel` ⏸ STRUCTURÉ, PAS DÉTAILLÉ LIGNE À LIGNE

4 items partagent le slot exclusif `logiciel` (Système réactif autonome, Analyseur tactique,
Projecteur de mouvement, Mémoire de cibles Mémo) — **4 mécaniques distinctes**, pas un calcul
homogène malgré le slot commun :
- Mémoire de cibles Mémo : Test de reconnaissance, évite un tir sur cible amie préenregistrée
  (compagnon non-exclusif : Bloc afficheur de données, voir Architecture des slots)
- Projecteur de mouvement : Test réduisant (jusqu'à annuler) le malus de cible en mouvement lors
  d'un Tir visé
- Système réactif autonome : arme tirant seule selon des conditions programmées — IA de combat,
  hors mécanique "bonus de Test", nécessiterait probablement une automatisation complète du tour
  (hors échelle d'un "mod")
- Analyseur tactique : bonus/malus **croissant par round** contre une cible spécifique — nécessite
  un état persistant par combat/par cible (aucun stockage équivalent aujourd'hui dans
  `combat_roster`/`combat_actions`)

**L'exclusivité (slot) est tranchée — le calcul de chaque mécanique individuelle ne l'est pas.**
Chacun mériterait sa propre session de planification dédiée, certains (Système réactif autonome
notamment) posent la question de savoir s'ils entrent seulement dans le périmètre "moding" ou dans
un chantier de combat séparé plus large.

---

## Prochaine étape

**Groupe 1 + architecture des slots exclusifs : codés et confirmés fonctionnels (Session 141 suite
28)** — migration `141_ref_equipment_mod_slots.js`, `modingService.js` (`calcWeaponModBonus` +
swap dans `installMod`), `socketCombatHelpers.js` (`resolveAssaultAction`). Détail complet des tests :
`docs/JOURNAL6.md` "Session 141 (suite 28)".

**Groupe 2 (Lunette de visée) reste entièrement tranché, prêt à coder** — l'architecture de slots
étant désormais livrée, Groupe 2 la réutilise telle quelle (aucun nouveau prérequis).

Reste ouvert si on continue à préparer avant de coder : Groupe 4 (4 mécaniques du slot `logiciel`,
à détailler et prioriser individuellement).

**Prochain numéro de migration à reconfirmer au moment de coder** (P53 — dérive déjà constatée trois
fois sur ce chantier, dont une collision réelle Session 141 suite 28) — 142 libre au 2026-07-12, ne
pas s'y fier sans revérifier `ls migrations/`.
