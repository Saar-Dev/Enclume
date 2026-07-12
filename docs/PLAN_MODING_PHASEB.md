# PLAN_MODING_PHASEB.md — Effets mécaniques des mods d'armes en combat
> Rédaction initiale : Session 141 (suite 21 suite), 2026-07-12
> Fait suite à `docs/PLAN_MODING.md` (Phase A — rangement pur, terminée). Ce document couvre
> exclusivement la Phase B : l'effet mécanique en combat des mods déjà installables depuis la
> Phase A. Responsabilité unique de ce fichier : planifier Phase B, ne duplique pas Phase A.
> **Aucun code écrit à ce stade — session de planification/analyse critique pure.**
> **État (2026-07-12)** : Groupe 1 (bonus fixes) et Groupe 3 (Trépied/Harnais) entièrement tranchés,
> prêts à coder — en attente d'instruction Saar pour lancer le codage. Groupe 2 (Lunette) et
> Groupe 4 (mécaniques à seuil de fonctionnement) restent ouverts.

---

## Méthode

Demande explicite Saar : rigueur avant vitesse ("sérieuse", "Architecture robuste", "Analyse
critique"), travail séquentiel groupe par groupe, jamais plusieurs groupes dans le même chantier de
code. Ce document capture l'état de la réflexion à date — certains groupes sont prêts à coder,
d'autres restent ouverts.

Sources vérifiées avant toute proposition (jamais de mémoire) :
- `docs/REGLES/REGLESYSCOMBAT.md` lu (Test de tir, Tir visé, Tir de précision, modificateurs de
  circonstances)
- Les 16 lignes `ref_equipment` (`family='Armes'`, `category='Accessoires pour armes'`) — colonnes
  `bonus`/`description` complètes, croisées avec la source brute pré-migration
  (`docs/Old/script Extraction Excel/equipement/ref_equipments_data.js`, texte LdB intégral, pas
  tronqué)
- Code de résolution combat réel : `resolveAssaultAction` (`server/src/socket/
  socketCombatHelpers.js:1239-1345`) — point d'insertion exact identifié
- Mécanisme d'exclusivité déjà livré pour Tir visé (`shared/combatExclusiveActions.js`, Session 141
  suite 17) — pattern de référence pour toute nouvelle exclusivité

---

## Constat central — la colonne `bonus` ne veut pas dire la même chose partout

Piège trouvé en creusant : sur les 16 accessoires, `ref_equipment.bonus` est un nombre non-null
pour 9 d'entre eux, mais **seuls 5 sont un vrai bonus additif au Test de tir**. Les 4 autres sont un
**seuil de fonctionnement** pour un mécanisme entièrement différent (Test séparé dont le résultat
modifie autre chose que le Test de tir lui-même). Confondre les deux aurait produit un bug de règle
silencieux (ex. ajouter +15 au Test de tir pour un Projecteur de mouvement qui n'en donne pas).

| Item | `bonus` | Nature réelle |
|---|---|---|
| Système de tir assisté : Cyclope PVI | 4 | Bonus fixe Test de tir |
| Système de tir assisté : Implant palmaire | 1 | Bonus fixe Test de tir |
| Système de tir assisté : Visière Onarck P | 2 | Bonus fixe Test de tir |
| Système de tir assisté : Visière Vanguard | 3 | Bonus fixe Test de tir |
| Systèmes d'aide à la visée : Visée laser | 2 | Bonus fixe Test de tir |
| Systèmes d'aide à la visée : Lunette de visée | "niv" (texte, pas un nombre) | Variante de Tir visé — mécanique propre |
| Mémoire de cibles Mémo | 15 | Seuil de fonctionnement (Test de reconnaissance de cible) |
| Projecteur de mouvement | 15 | Seuil de fonctionnement (Test réduisant le malus de cible en mouvement) |
| Système réactif autonome R.N.T. Jaguar 400 | 12 | Seuil de fonctionnement (arme autonome — IA de tir) |
| Analyseur tactique individuel A.T.I Alpha | 8 | Seuil de fonctionnement (bonus/malus croissant par round, stateful) |
| Systèmes d'aide à la visée : Calculateur laser | null | Outil de mesure, aucun bonus |
| Mémoire de cibles : Bloc afficheur de données | null | Affichage seul, aucun bonus |
| Poignée d'identification | null | Narratif (sécurité), aucun effet mécanique |
| Silencieux | null | Narratif (discrétion — mécanique Furtivité, hors Test de tir) |
| Trépied | null | Support (évite division par 2 des chances — voir Groupe 3) |
| Harnais mécanisé | null | Réduction de poids (`ne permet que` — voir Groupe 3, nuance non tranchée) |

---

## Découpage en groupes — état à date

### Groupe 1 — bonus fixes au Test de tir ✅ PLAN VALIDÉ, PRÊT À CODER
**Périmètre exact : 5 items, et seulement ceux-là** (voir tableau ci-dessus, colonne "Bonus fixe
Test de tir"). Les 11 autres items n'entrent PAS dans ce lot.

**Décision de conception validée par Saar** : exclusion totale entre TOUS les systèmes d'aide au
tir/visée — pas seulement l'exclusivité textuelle explicite de la famille "Système de tir assisté"
(4 items, LdB : *"Ces systèmes ne sont pas cumulables, si plusieurs sont installés on prend le plus
performant"*), mais étendue par choix de conception à Visée laser et Lunette de visée. Raisonnement
retenu : les deux familles catalogue vendent la même promesse ("meilleure précision via technologie
d'assistance") par des fabricants concurrents (New Dynamic vs Trinicom) — interprétation, pas un
fait sourcé, assumée comme choix de campagne.

**Modèle de données** : nouvelle colonne `ref_equipment.accessory_group` (TEXT, nullable).
Backfill sur **6 lignes** (pas 5) : les 4 "Système de tir assisté" + Visée laser + **Lunette de
visée** → `accessory_group = 'aide_visee'`. La Lunette est incluse dès maintenant dans le groupe
(cohérence conceptuelle actée par Saar) mais restera **inerte** en Groupe 1 : son `bonus` n'est pas
un entier parseable ("niv"), la fonction de calcul l'ignore silencieusement (jamais de crash, jamais
de `NaN`). Elle deviendra active seulement quand Groupe 2 sera codé — aucune double-modification de
cette ligne nécessaire plus tard, le lien est déjà posé.

**Migration 138** (prochain numéro libre confirmé, `ls migrations/` au 2026-07-12) :
```js
// 138_ref_equipment_accessory_group.js
ref_equipment.accessory_group  TEXT nullable
// backfill : 6 lignes → 'aide_visee' (Cyclope PVI, Implant palmaire, Onarck P, Vanguard,
// Visée laser, Lunette de visée)
```

**Logique** — nouvelle fonction pure dans `server/src/services/modingService.js` :
```
calcWeaponModBonus(installedMods)
  → filtre les mods dont accessory_group est renseigné ET bonus est un entier valide
  → groupe par accessory_group, garde le MAX de chaque groupe
  → retourne { total, breakdown: [{ name, value }] }
```
Les mods sans `accessory_group` (les 11 autres items, y compris ceux à seuil de fonctionnement) sont
**ignorés par construction** — la fonction ne traite QUE ce qui est explicitement groupé, jamais un
"tout ce qui a un bonus numérique par défaut". C'est la garde qui empêche un item comme l'Analyseur
tactique (bonus=8, seuil de fonctionnement) d'être confondu avec un vrai bonus de Test de tir.

**Branchement** — `resolveAssaultAction` (`socketCombatHelpers.js:1239-1345`) :
- fetch `char_inventory_mods ⋈ ref_equipment` pour `action.weapon_inv_id`, en parallèle du fetch
  arme existant (ligne 1239, ajout au `Promise.all`)
- `weaponModComp = calcWeaponModBonus(installedMods).total` ajouté à `totalModComp` (ligne 1322)
- entrée `breakdown` ajoutée (ligne ~1334, même emplacement que `aimBonusComp`), nommant l'item
  précis retenu (ex. "Cyclope PVI" +4), pas juste "Mod arme"

**Tests prévus avant livraison** (réels, base réelle, fixture jetable + nettoyage vérifié — pattern
Phase A) :
- Sans mod installé → comportement strictement identique à aujourd'hui (`weaponModComp = 0`)
- 1 mod du groupe installé seul → bonus appliqué exactement
- 2 mods du groupe installés ensemble (ex. Cyclope PVI + Onarck P) → doit rester au max (+4, pas +6)
- Lunette de visée installée seule → `weaponModComp = 0`, aucun crash (vérifie le filtre "entier
  valide")
- Item hors groupe installé (ex. Analyseur tactique) → jamais pris en compte dans `weaponModComp`

---

### Groupe 2 — Lunette de visée ⏸ NON PLANIFIÉ EN DÉTAIL, complexité identifiée
Pas un bonus additif — une variante du Tir visé lui-même. Règle LdB : niveau 1-10 (+1/niveau,
max +10), Tir visé obligatoire, **1 point d'Initiative par point de bonus** (au lieu de 2 pour le
Tir visé de base), bonus lunette et bonus Tir visé **non cumulatifs** (le plus élevé des deux
seulement).

**Gap de données non résolu** : le catalogue n'a qu'**une seule ligne** "Lunette de visée" avec
`bonus="niv"` — aucune notion de niveau 1-10 nulle part (`ref_equipment.max_level` existe mais sert
à un usage différent, vérifié dans `tradeService.js` — seuil marchand, pas niveau d'objet). Décision
à prendre avant de coder : 10 lignes catalogue distinctes (prix différents par niveau) ou un niveau
saisi à l'installation (`char_inventory_mods.level`) ?

**Impact code si repris** : touche `AIM_MAX_TRANCHES`/`AIM_INI_PER_TRANCHE`
(`shared/combatExclusiveActions.js`), aujourd'hui des constantes fixes — devraient devenir
dépendantes du niveau de lunette équipée. Touche aussi potentiellement l'UI de déclaration Tir visé
côté client (`AssaultRangedPanel.jsx`) pour refléter un plafond différent selon l'arme. **Non
détaillé ligne à ligne — session dédiée quand ce groupe sera repris.**

---

### Groupe 3 — Trépied / Harnais ✅ PLAN VALIDÉ, PRÊT À CODER

**Déclencheur confirmé par Saar** : pas une propriété intrinsèque de l'arme (on n'ajoute PAS de
colonne "cette arme a besoin d'un support" sur `ref_equipment` — retomberait exactement dans
`calcCarenceArmure`, mécanique déjà rejetée Session 141 suite 16 pour absence de source LdB). Le
déclencheur est **le choix de slot du joueur/MJ** : arme équipée en slot `char_inventory.slot =
'Tr'` (déjà un slot valide existant, `VALID_SLOTS`/`WEAPON_SLOTS` dans `inventoryService.js`,
traité aujourd'hui exactement comme `'2M'` — deux mains occupées, aucune règle spéciale). Une arme
équipée en `'2M'` à la place n'est jamais concernée — le joueur a choisi de la tenir normalement.

**Trépied et Harnais ne sont pas de simples variantes interchangeables** — vérifié dans la source
brute (`ref_equipments_data.js`), description identique aux deux lignes catalogue (un seul
paragraphe de règle réutilisé tel quel), mais le Harnais **ajoute** un effet que le Trépied n'a
pas : *"Le harnais ne permet que de réduire de moitié le poids d'une arme"* — lu comme "en plus du
support de base, tout ce que le Harnais apporte de plus, c'est la réduction de poids" (cohérent avec
le prix : Trépied 600 sols, Harnais 3000 sols, 5×). **Deux mécaniques indépendantes, pas un
`accessory_group` à la Groupe 1** :
1. Malus de précision : présence de **Trépied OU Harnais** (peu importe lequel) → pas de malus
2. Réduction de poids : **Harnais spécifiquement** → poids de l'arme ÷ 2 (effet **inventaire**, pas
   combat — touche `inventoryService.getInventory` `totalWeight`, pas `resolveAssaultAction`, lot de
   code séparé du malus de précision même si même item)

**Formule (malus de précision)** — recherche faite, **aucun précédent de division dans le code
actuel** : le "chances divisées par deux" du tir à deux armes (main non directrice) est en réalité un
**second jet séparé** (2 Tests de tir distincts), pas un modificateur sur le même jet, et n'est de
toute façon implémenté aujourd'hui que comme un bonus additif (+3/+5, `dualWieldBonusComp`) — pas une
vraie division. Trépied/Harnais serait donc le **premier mécanisme de division** dans
`resolveAssaultAction`. Convention d'arrondi trouvée par recherche (`docs/REGLES/REGLEARMURE.md:568`,
seul exemple de fraction dans les règles combat/armure : *"diminuées d'un tiers, arrondissez au
niveau inférieur"*) → arrondi vers le bas retenu, cohérent avec la convention du système :
```
chancesDeReussite = Math.floor(chancesDeReussite / 2)  // si arme en slot 'Tr' sans Trépied/Harnais
```
Appliqué en **dernière étape**, après tous les modificateurs additifs existants (lecture la plus
naturelle de "chances de réussite du Test divisées par deux" = le Seuil final, pas juste la
Compétence de base) — donc après un éventuel bonus Groupe 1 déjà inclus dans `chancesDeReussite`.

**Branchement** : `resolveAssaultAction` (`socketCombatHelpers.js`) — après le calcul actuel de
`chancesDeReussite` (ligne 1325), avant le jet (ligne 1326) : si `weapon.slot === 'Tr'` (à fetcher,
`char_inventory.slot` pas encore sélectionné dans le fetch arme actuel) et aucun Trépied/Harnais dans
`char_inventory_mods` pour cette arme → appliquer le floor/2. Entrée `breakdown` dédiée ("Sans
support" ou similaire, `type: 'malus'`) pour que le joueur comprenne la division dans le log.

**Vérifié en base réelle (2026-07-12)** : 0 arme actuellement équipée en slot `'Tr'` toutes
campagnes confondues — aucun risque de régression surprise pour un joueur existant en activant ce
malus.

---

### Groupe 4 (nouveau, identifié en cours d'analyse) — mécaniques à seuil de fonctionnement
Mémoire de cibles Mémo, Projecteur de mouvement, Système réactif autonome, Analyseur tactique
individuel. **4 mécaniques distinctes**, pas un groupe homogène malgré le rapprochement de nom —
chacune son propre Test, sa propre condition de déclenchement, son propre effet :
- Mémoire de cibles : Test de reconnaissance, évite un tir sur cible amie préenregistrée
- Projecteur de mouvement : Test réduisant (jusqu'à annuler) le malus de cible en mouvement lors
  d'un Tir visé
- Système réactif autonome : arme tirant seule selon des conditions programmées — IA de combat,
  hors mécanique "bonus de Test", nécessiterait probablement une automatisation complète du tour
  (hors échelle d'un "mod")
- Analyseur tactique : bonus/malus **croissant par round** contre une cible spécifique — nécessite
  un état persistant par combat/par cible (aucun stockage équivalent aujourd'hui dans
  `combat_roster`/`combat_actions`)

**Non planifié — chacun mériterait probablement sa propre décision de priorité, certains
(Système réactif autonome notamment) posent la question de savoir s'ils entrent seulement dans le
périmètre "moding" ou dans un chantier de combat séparé.**

---

### Modification de canon / Modification de poignée — pas d'exclusivité à gérer
Confirmé par Saar : Silencieux → "Modification de canon", Poignée d'identification → "Modification
de poignée". **Un seul item possible dans chacune** avec le catalogue actuel — aucune logique
d'exclusivité à coder (rien à exclure face à un seul candidat). Les deux sont de toute façon
narratifs (`bonus = null`), donc **aucun effet mécanique** à câbler pour l'instant, qu'ils
appartiennent à Groupe 1-4 ou non. Catégories prêtes à accueillir du contenu catalogue futur si le
jeu en ajoute, sans impact sur le code actuel.

---

## Prochaine étape

**Groupe 1 et Groupe 3 sont tous les deux entièrement tranchés** (données vérifiées, décisions de
conception actées, formule/branchement identifiés précisément dans le code réel, régression
vérifiée en base pour Groupe 3). Prêts à passer en codage sur confirmation Saar — **un seul des deux
à la fois** (règle "un sujet à la fois"), aucun autre groupe touché par un lot donné.

Reste ouvert si on continue à préparer avant de coder : Groupe 2 (Lunette — gap de données sur les
niveaux 1-10 à trancher), Groupe 4 (4 mécaniques à seuil de fonctionnement, à prioriser
individuellement).
