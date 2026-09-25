# PLAN_OBJETS_AU_SOL — « À terre » réel : un objet lâché devient une entité 3D ramassable

> Créé 2026-09-25. **Stub — cadrage non commencé, zéro code.** Plan **temporaire** (`RegleDocumentaire.md` Règle 10).
> Origine : la v1 de « Permuter » (`PLAN_PRISE_EN_MAIN.md`) **refuse** la permutation quand l'arme sortante ne rentre pas dans son
> conteneur (R17) ; Saar a réservé la vraie solution à une v2 : ceci.
> Prérequis : « Permuter » v3.1 clos. Aucun autre chantier ne le bloque. Il fournit à son tour la primitive dont a besoin la branche
> « tombe au sol » des Catastrophes (§2bis) — **dont le handler est un autre chantier** (`PLAN_USURE&INTEGRITE.md` §10.2, lot L9).

## 1. Décisions de Saar (2026-09-25)

- « À terre » est une **vraie sortie de l'inventaire** : l'objet est stocké dans un emplacement **temporaire lié à la carte** et apparaît
  **physiquement au pied du personnage**.
- Il est représenté par une **entité 3D interactive**, **cliquable** pour ramasser l'objet.
- L'objet **reste au sol** (persiste) ; **n'importe qui** peut le ramasser. **Pas de butin** (aucun système de loot posé par le MJ).
- L'asset 3D n'existe pas encore : **Saar le fournira** le moment venu (jamais un prérequis à coder avant).
- **« À quelques pas » = à portée de l'Allure lente** (décision Saar, 2026-09-25) : la distance de ramassage lointain se mesure au
  budget de déplacement en Allure lente du personnage (`movementBudgetService`, autorité spatiale existante), jamais à un nombre en dur.
- **Coût du ramassage** (décision de Saar, 2026-09-25) : à portée de main **−3** (RAW) ; « à quelques pas » **−5** pour un objet
  **à une main** (grenades et shurikens sont des objets à une main : « de lancer » n'est pas une catégorie à part), **−10** pour un
  objet à **deux mains**. Ce coût **remplace** le −3 de l'Allure lente (un seul paiement). Le personnage **se déplace jusqu'au tas**.
- **Lâcher une arme débloque aussi les Catastrophes correspondantes** (Saar, 2026-09-25) : voir §2bis. Le sol a donc **deux
  consommateurs** — « Permuter » (arme sortante qui ne rentre pas) et les Catastrophes — et « lâcher » doit être une primitive
  autonome, pas un détail de la permutation. **Les Catastrophes sont un autre chantier** (le handler du lot L9) : ce chantier ne
  livre que la primitive.
- **Déclenchement sur une Catastrophe** : le **MJ**, après sa fenêtre « Catastrophe » et son choix ; **on suit le RAW** (l'arme
  *tombe au sol* pour les armes blanches ; une arme à feu *s'enraye* ; une arme de mauvaise qualité *se casse*).
- **Bouclier = objet tenu comme un autre** (Saar : rien ne le distingue d'une arme dans la main) : il est déposable de la même façon.

## 2. RAW (`REGLESYSCOMBAT.md`, relu le 2026-09-25)

- **« Lâcher un objet ou une arme au sol » = Action gratuite** (l.333-334) : déposer l'arme sortante ne coûte rien de plus.
- **« Saisir un objet : Initiative −3 s'il est à portée de main, −5 à −10 s'il est à quelques pas de là »** (Préparations, l.441).
- Ramasser un objet au sol **« ne nécessite normalement aucun Test »**, le MJ décide (l.546-547).
- « À quelques pas » est défini par Saar : **portée de l'Allure lente**, avec **−5 (une main ou lancer) / −10 (deux mains)** et un
  déplacement jusqu'au tas (§1) : c'est une **décision de conception de Saar**, dans la fourchette −5 à −10 que le RAW laisse au MJ.
- **Cumul avec le déplacement : tranché.** Une Allure lente coûte déjà **−3** d'Initiative (`shared/combatMovement.js`) ; le −5 / −10 du
  ramassage le **remplace** (un seul paiement, comme R3 de « Permuter »). [À prévoir au plan] le déplacement lié au ramassage ne doit
  pas être facturé une seconde fois par le calcul d'Initiative existant.

## 2bis. Second consommateur : les Catastrophes en combat

RAW (`REGLESYSCOMBAT.md` l.720-726, « CATASTROPHES EN COMBAT », entrée 2 **Arme inutilisable**) : *« l'arme tombe au sol (armes
blanches), s'enraye (armes à feu), ou se casse (…). Le personnage peut aussi perdre son bouclier. »*
État actuel [VÉRIFIÉ] : `shared/catastropheEffectTable.js` — les 10 entrées ont `mechanized: false` ; le handler de l'entrée 2 n'existe
pas (`PLAN_USURE&INTEGRITE.md` §10.2, lot L9 : « tombe au sol / perd son bouclier sont spatiaux/narratifs — hors système ITG »).
**Séquencement (décision Saar, 2026-09-25) :** les Catastrophes sont **un autre chantier / une autre étape** — le handler de l'entrée 2
(lot L9 du plan Usure). Ce chantier-ci ne livre que la **primitive de dépôt** (`dropItemToGround`, §5 n° 4bis) que ce handler appellera.
Déclenchement : **le MJ**, après sa fenêtre « Catastrophe » et son choix (`chanceCatastropheChoiceService.js`) ; portée : **celle du
RAW** — l'arme tombe au sol pour les armes blanches ; les armes à feu s'enrayent et les armes de mauvaise qualité se cassent (branches
du système Usure & Intégrité, hors dépôt). « Perd son bouclier » : le bouclier se dépose comme une arme (rien ne l'en distingue ;
`updateItem` libère seul ses localisations d'armure au déséquipement).

## 3. Constat [VÉRIFIÉ, 2026-09-25]

- **Aucun concept d'objet au sol** dans le code ni dans les docs.
- **Création d'entité réservée au MJ**, par une route REST (`server/src/routes/entities.js` l.118-122 : `member.role !== 'gm'`) ; le
  contrôle d'occupation est écrit **dans la route**. Aucun service serveur de création : la résolution d'un combat ne peut aujourd'hui
  pas créer une entité.
- **Le moteur d'interactions** (`docs/SYSTEME/ENTITES.md` §10) ne connaît que « changer d'état » et « déplacer » ; **aucun effet
  « transférer un objet »**. Il fournit déjà la **portée serveur** (`measureBattlemapTokenEntityDistance`, défaut 1,5 m) et la
  résolution directe sans jet (interaction sans compétence → `resolveEntityState`).
- **Les 15 caisses / coffres ouvrables n'ont aucun contenu** : l'ouverture est purement visuelle. Le tas au sol serait la première
  entité contenant des objets.
- **Une entité non bloquante** (`state.is_blocking === false`) est empilable sans restriction : un objet au sol doit l'être (une
  apparence 3D n'implique jamais une collision).
- **`char_inventory.character_id`** désigne le porteur d'un objet ; les données propres à l'exemplaire (chargeur, type chargé, intégrité,
  panne, mods `char_inventory_mods`, nom) sont sur la ligne et ses tables filles.
- **Lien avec le combat** : comment une interaction d'entité s'articule avec une déclaration de combat est [INCONNU] (aucun câblage
  trouvé dans l'annonce) — à explorer.

## 4. Référence externe

Foundry VTT *Item Piles* (<https://github.com/fantasycalendar/FoundryVTT-ItemPiles>, <https://foundryvtt.com/packages/item-piles>) : un tas
est un jeton non lié qui **contient** les objets, créé quand on lâche un objet, dont l'image change selon l'état ouvert / fermé / vide.
[INCONNU] Fusion des tas, portée de ramassage, suppression du tas vide : le wiki n'a pas pu être lu ; à lire avant le plan.

## 5. Architecture envisagée [HYPOTHÈSE — à valider par un vrai plan et une analyse à charge]

1. **L'objet garde sa ligne d'inventaire** (jamais une copie ou un instantané : une seule autorité de l'état d'exemplaire). Le porteur
   devient « un personnage **ou** un tas au sol » (exactement un des deux). *À mesurer avant de trancher :* `character_id` est lu par
   une quinzaine de services (`tradeService`, `vaultService`, `inventoryService`, `damageService`…) ; alternatives à comparer.
2. **Un tas est une entité** (blueprint générique « objets au sol », non bloquante), créée par un **service serveur partagé avec la
   route** (extraction de la logique inline de `entities.js` — REST et Socket.IO partagent le même service).
3. **Un objet lâché sur une case qui porte déjà un tas le rejoint** (patron Item Piles) ; le tas se vide, puis disparaît.
4. **Ramasser = un nouvel effet du moteur d'interactions**, avec la portée serveur existante (à portée de main) ou le budget en Allure
   lente (« quelques pas », `movementBudgetService`) et le coût décidé par Saar (§1). Le déplacement jusqu'au tas suit l'ordre de
   résolution **déjà en place** (déplacement `sequence` 1, puis `micro` `sequence` 2) : ramasser à quelques pas = un déplacement
   vers la case du tas suivi de la prise [HYPOTHÈSE à vérifier au plan : le mouvement passe par `executeBattlemapTokenMovement` et son
   budget d'Allure lente, jamais un déplacement recalculé à part].
4bis. **« Lâcher » = une primitive serveur unique** (`dropItemToGround`, service partagé) : l'objet quitte l'inventaire, l'entité-tas est
   créée ou complétée à la position du token, l'inventaire et la carte sont rediffusés. Appelée par « Permuter » (dernier barreau de la
   destination), par le handler de Catastrophe (§2bis) et par une éventuelle action libre « Lâcher » (RAW : Action gratuite).
5. **Suppression d'un tas non vide par le MJ** : confirmation, le contenu retourne au Coffre de celui qui l'a lâché (patron INV1,
   `confirmEmptyContainer`) — il faut donc mémoriser l'auteur du dépôt.
6. **En combat, le sol devient la 3ᵉ source de « Permuter »** et le dernier barreau de la destination de l'arme sortante
   (`planStowDestination`, point d'extension prévu par `PLAN_PRISE_EN_MAIN.md` §5).

## 6. Questions ouvertes

- Un tas au sol persiste-t-il à la fin de la session, du combat, à la suppression de la carte ? (persistance décidée : oui, jusqu'au
  ramassage ; reste le cas de la carte supprimée.)
- Ramassage hors combat : clic direct sur le tas ; en combat : action déclarée (coût). Articulation avec l'annonce : [INCONNU].
- Asset générique unique (recommandé : le catalogue d'objets est trop grand pour un modèle par objet) — à fournir par Saar.
- Repli d'une arme sortante vers l'**autre** conteneur avant le sol (non retenu en v1).

## 7. Hors périmètre

Butin posé par le MJ ; contenu des caisses / coffres existants (le tas au sol en est seulement la première brique) ; marchands.
