SYSTEME/SOURCES.md — Sources de contenu de catalogue (Livre de Base, suppléments)

    Créé 2026-10-04 (chantier ARMOR-STATS-DISPLAY-INCOMPLETE) — contenu durable extrait de
    docs/Old/PLAN_SUPPLEMENTS.md (Lots A/B, codés et testés le 2026-09-29 ; plan archivé à la
    clôture du chantier le 2026-10-08), qui reste la source
    historique (précédents étudiés, analyse à charge) mais ne doit plus être relu pour comprendre
    le mécanisme lui-même (Règle 10 RegleDocumentaire.md : un PLAN est temporaire).

    Lire pour : savoir si une ligne de catalogue (`ref_exo_templates`, `ref_equipment`) appartient au
    Livre de Base ou à un supplément, comment l'activer par campagne, où brancher la vérification
    sur un nouveau point d'écriture, comment ajouter une future source.

    > Voir aussi : docs/Old/PLAN_SUPPLEMENTS.md (historique, précédents Foundry VTT/Comp-Con/MekHQ,
    > analyse à charge détaillée). docs/VOCABULARY.md « Source (de contenu) ».

---

## 1. Concept

Une **source** = l'origine éditoriale d'une ligne de catalogue : le Livre de Base, ou un
supplément (ex. Guide Technique). Une source est une **ligne de données** dans `ref_sources`,
jamais une valeur d'enum figée dans le code — ajouter une future source est un INSERT, jamais une
migration de schéma.

- Le Livre de Base (`is_core = true`) est toujours actif, pour toute campagne, sans ligne
  d'activation. C'est la base du jeu, pas une source parmi d'autres (décision Saar 2026-09-29) :
  rien ne la désactive jamais.
- Toute autre source (`is_core = false`) doit être explicitement activée pour une campagne donnée
  avant que son contenu soit utilisable dans cette campagne.
- Deux sources actives peuvent porter un modèle du même nom sans fusion automatique (ex. deux
  « Mentor », un par source) — au MJ de choisir la ligne précise, jamais une priorité calculée.

## 2. Schéma

- `ref_sources` : `id` (uuid, généré par Postgres — jamais codé en dur), `code` (unique, ex.
  `ldb`, `guide_technique`), `name` (affichage), `description`, `is_core`.
- `ref_exo_templates.source_id`, `ref_equipment.source_id` : FK vers `ref_sources`,
  `UNIQUE(name, source_id)` — deux sources peuvent chacune avoir une ligne du même nom, jamais
  deux fois la même source.
- `campaign_enabled_sources` : `campaign_id` + `source_id`, PK sur les deux. Une ligne = cette
  source est active pour cette campagne. **Le Livre de Base n'y a jamais de ligne** (§1) — le
  filtrage est donc `is_core = true OR EXISTS(... campaign_enabled_sources ...)`, jamais une
  jointure pure.

## 3. Vérification serveur — autorité unique

`server/src/lib/sourceService.js::assertSourceActive(trx, campaignId, sourceId)` — lève une
`AppError(403)` si la source n'est ni core ni activée pour cette campagne. **Seul point
d'évaluation de l'invariant** ; un nouveau point d'écriture qui pose un `template_id`/
`equipment_id` choisi librement par l'appelant doit l'appeler, jamais recopier la logique
(`.claude/rules/core.md`, « une propriété métier = une autorité unique »).

Points d'écriture déjà gardés (audit complet du dépôt, 2026-09-29) :
- `exoTemplateService.js::applyExoTemplate` (seul point d'écriture sur `ref_exo_templates`).
- `server/src/routes/character/char-sheet.js` : `POST /:characterId/inventory`,
  `/quick-equip`, `/drone/programs`, `/drone/weapons`, `/exo/systems`, `/exo/weapons`,
  `/exo/programs` (tous sur `ref_equipment`).
- `server/src/services/tradeService.js::buyFromMerchant`.

Deux cas volontairement **non** gardés (pas un oubli) : `POST /:characterId/inventory/:itemId/
reload` et `/moding/install` ne posent jamais un `ref_equipment_id` choisi librement — la valeur
vient d'une ligne `char_inventory` déjà possédée et déjà vérifiée à son ajout.

## 4. Ce qui n'est pas encore fait (déficit connu, pas un oubli silencieux)

Le filtrage en **lecture** de `GET /api/equipment` reste différé : la route n'est pas filtrée par
source active, donc du contenu non-core reste visible dans les sélecteurs
(`InventoryPanel.jsx`, `MerchantsPage`, `DroneWindow`) même si sa source est désactivée pour la
campagne — seule l'**écriture** (§3) empêche de l'acquérir réellement. `GET /api/exo-templates`,
lui, filtre déjà en lecture (seul appelant : `ExoSheetWindow.jsx`, qui transmet `?characterId=`
pour que le serveur résolve la campagne lui-même — jamais un `campaignId` envoyé tel quel par le
client).

Le tag visuel (badge « nom de la source » sur le contenu non-core) n'existe aujourd'hui que sur le
sélecteur « Modèle » de la fiche Exo-armure (`ExoIdentityPanel.jsx`) — pas encore sur les
sélecteurs d'équipement, bien que `source_is_core`/`source_name` soient déjà exposés par
`ref_equipment`.

## 5. Gestion par le MJ

`GET/POST/DELETE /api/campaigns/:id/sources` (`campaigns.js`, `requireRole('gm')`) — active/
désactive une source pour une campagne ; rejette avec 400 toute tentative sur une source
`is_core`. Consommé par l'onglet « Sources de contenu » de la Configuration de campagne
(`client/src/components/campaignSettings/SectionSources.jsx`).

## 6. Ajouter une nouvelle source ou rattacher du contenu existant

1. Une migration insère la ligne `ref_sources` (`code`, `name`, `description`, `is_core = false`)
   — jamais d'`id` codé en dur, jamais de valeur recopiée d'une autre migration
   (`.claude/rules/core.md`, SEED-ID-DETERM).
2. Rattacher des lignes de catalogue existantes à cette source : `UPDATE ... WHERE name IN (...)`,
   **toujours par la clé métier `name`, jamais par `id`** — deux instances seedées
   indépendamment ont des `id` différents pour la même ligne.
3. **Avant d'écrire cette migration, vérifier exhaustivement** (pas en extrapolant depuis un
   échantillon) quelles lignes appartiennent réellement à la nouvelle source — le vécu de ce
   chantier (16 armures `ref_equipment` étiquetées `ldb` à tort, dont une repérée seulement après
   un second passage ligne par ligne contre le texte du Livre de Base) montre qu'un comptage
   partiel laisse des lignes mal étiquetées, invisibles tant que personne ne les cherche
   explicitement.
4. Ne jamais modifier les valeurs de jeu (Protection, Choc, coût…) dans la même migration que le
   rattachement de source, sauf si ces valeurs sont elles-mêmes erronées et vérifiées
   indépendamment contre le texte source — rattacher une source et corriger une statistique sont
   deux causes racines différentes (`.claude/rules/migrations.md` : une migration, une
   responsabilité).
