PLAN_INVENTORY_UX.md — Refonte ergonomique de l’onglet Matériel

    Version : V1.7 — 2026-08-05
    Statut : Étapes 0 à 5 codées, testées et confirmées fonctionnelles en navigateur par Saar
    (2026-08-05). Étapes 6 à 8 codées (2026-08-05), **non testées en navigateur**. Étape 9 codée
    partiellement (uniformisation des libellés de slot uniquement — voir écart ci-dessous), reste non
    testée en navigateur.

    Écarts tranchés par Saar en cours de route (documentés, pas des raccourcis silencieux) :
    - Étape 4 (grille 2 colonnes) **annulée** après test : bloc équipement trop massif, silhouette
      écrasée. Retour à l'empilement vertical d'origine (ArmorWoundPanel puis WeaponPanel).
    - Étape 5 : `@dnd-kit/sortable` cité en §5.1 finalement non installé — l'usage réel (glisser vers
      des zones distinctes, jamais réordonner une liste) ne nécessite que `@dnd-kit/core` +
      `@dnd-kit/utilities`.
    - Étape 5 : la zone "2 Mains" dédiée (§2.1, §4.2, §5.3) a été supprimée après validation — une arme
      2 mains déposée sur Main Directrice OU Secondaire s'équipe directement sur le bon slot (2M/Tr),
      la seconde main est couverte automatiquement. Le choix Trépied (2M ↔ Tr) devient un bouton
      apparaissant *après* l'équipement (`weaponPanel.switchToTripod`/`switchToTwoHands`), plus un
      `<select>` préalable.
    - Retrait du `<select>` Sac/Coffre (déplacement de container) dans InventoryPanel.jsx : demandé
      explicitement par Saar 2026-08-05, **fait** malgré la réserve d'accessibilité clavier notée
      ci-dessous (§5.5) — le `<select>` de Slot (équipement), lui, reste en place, non concerné par
      cette demande. Aucune zone de drop Coffre n'existant (§5.3), un nouveau bouton symétrique
      "Ranger dans le Coffre" (Sac/Ceinture → Coffre, déséquipe d'abord si besoin) complète "Prendre
      dans le Sac" (Étape 8) pour ne perdre aucun chemin fonctionnel. Le retrait du `<select>` de Slot
      reste **différé** — nécessite un `KeyboardSensor` dnd-kit pour ne pas régresser l'accessibilité
      clavier exigée par §5.5. Noté dans `docs/ROADMAP.md`.
    - Bug drag & drop trouvé en testant l'Étape 6/9 : cliquer sur le `<select>` de Slot (ou tout
      élément interactif imbriqué dans une ligne draggable) déclenchait un drag au lieu d'ouvrir le
      menu — le seuil de distance (6px) seul ne suffisait pas, dnd-kit capture le pointerdown sur les
      descendants avant l'évaluation du seuil. Corrigé par `InteractiveAwarePointerSensor`
      (CharacterWindow.jsx, pattern officiel dnd-kit — ignore l'activation sur select/input/
      textarea/button/option), remplace le simple `PointerSensor` partout dans l'onglet Matériel.

    Bug d'exécution évité (Étape 0) : ModingWindow.jsx exclu de la bascule store (§3.2) avec son propre
    signal de rafraîchissement, sinon perdu à la suppression du reloadKey legacy. Règle asymétrique
    sols (joueur = baisse uniquement) documentée et implémentée dans InventoryBanner.jsx. `sols` vit
    dans `characterStore.js` (`solsByCharId`), tranché en codant l'Étape 0 (§3.4 point 4).
    Responsabilité unique : Définir l’architecture cible et le plan de migration pour la refonte UX de l’onglet Matériel de la fiche personnage Enclume.

1. Objectif

[VÉRIFIÉ] Validé en Phase 3 avec Saar.

    Offrir dans l’onglet Matériel une vue unifiée et interactive de l’équipement porté (armures, armes, conteneurs physiques) et de l’inventaire de sac/ceinture, tout en gardant le Coffre comme stockage distant clairement séparé, non accessible en situation, sans impact sur le poids porté.

1.1 Problèmes UX résolus
#	Problème	Solution
1	Fragmentation des sections : le joueur doit mentalement relier armures (haut), armes (milieu) et inventaire (bas)	Disposition en 2 colonnes : blessures/armures à gauche, armes/conteneurs à droite. Vue unifiée de l’équipement porté.
2	Les armes n’apparaissent pas sur/autour de la silhouette	Les armes sont dans la colonne de droite, à côté de la silhouette, visibles sans scroll.
3	Codes de slot cryptiques dans l’inventaire (MG, BD, etc.)	Remplacés par des libellés traduits (pattern déjà en place dans WeaponPanel).
4	Conteneurs conditionnels non explicités (pourquoi le Sac n’apparaît-il pas ?)	Message explicite dans la zone conteneurs : « Pas de sac équipé — équipez un sac à dos (emplacement Dos) ».
5	Équipement depuis le Coffre impossible sans déplacement préalable	Un bouton « Prendre dans le Sac » automatise le transfert Coffre → Sac + équipement en une action.
6	Erreurs de conflit invisibles dans InventoryPanel	Ajout d’un feedback visuel (bordure rouge, message) cohérent avec WeaponPanel et LocationPanel.
7	Catalogue GM sans filtres	Ajout de filtres par catégorie, famille, rareté et poids.
8	Suppression sans confirmation	Ajout d’un dialogue de confirmation avant suppression.
9	Redondance équipement armes (deux chemins différents)	L’équipement des armes se fait uniquement via le bloc Armes (colonne droite). L’inventaire ne propose plus d’équiper une arme, seulement de la déplacer vers le Sac.
10	Resync complète à chaque mutation	Résolu par la source unique de vérité (§3) : store partagé + upsert/remove incrémental depuis les payloads WS déjà envoyés par le serveur. Plus « hors scope », c'est le socle de l'Étape 0.
2. Architecture cible
2.1 Disposition visuelle
text

┌──────────────────────────────┬──────────────────────────────┐
│  BLOC BLESSURES / ARMURES    │  BLOC ARMES + CONTENEURS     │
│  (ArmorWoundPanel allégé)    │  (WeaponPanel enrichi)       │
│                              │                              │
│  Tête    │        │ Corps    │  ARMES (affichage contextuel)│
│  Bras G  │ SILH.  │ Bras D   │  - Si arme 2M → emplacement  │
│  Jambe G │        │ Jambe D  │    2M uniquement             │
│                              │  - Sinon → Main Dir + Main   │
│                              │    Sec + option 2M si armes  │
│                              │    disponibles               │
│                              │                              │
│                              │  ────────────────────────    │
│                              │  CONTENEURS PORTÉS           │
│                              │  🎒 Sac (nom, poids)         │
│                              │  🧱 Ceinture (nom, poids)    │
│                              │  (ou message si non équipé)  │
│                              │  [Bouton Customisation]      │
├──────────────────────────────┴──────────────────────────────┤
│  BANDEAU POIDS + SOLS (toujours visible)                    │
│  [■■■■■■■■■■■■■■■■░░░░░░] 76%   Total : 34.2/45.0 kg       │
│  Solde : 1 250 sols                                         │
├─────────────────────────────────────────────────────────────┤
│  INVENTAIRE [▼ Déplier]                                     │
│  (accordéon : Sac / Ceinture)                                │
│  ──────────────────────────                                  │
│  Coffre ⓘ (tooltip « Stockage distant »)                     │
│  + Catalogue GM (+ filtre)                                  │
└─────────────────────────────────────────────────────────────┘

2.2 Adaptation responsive

[VÉRIFIÉ] La fenêtre CharacterWindow a une taille initiale de 720×600 px et une taille minimale de 500×400 px.

    Largeur ≥ 720 px : disposition en 2 colonnes (chaque bloc ~340 px).

    Largeur entre 500 et 719 px : disposition en 1 colonne (empilement vertical : blessures/armures → armes/conteneurs → bandeau → inventaire). Comportement dégradé, sans perte de fonctionnalité.

    Hauteur : le bloc équipement (armures + armes) + bandeau tient dans ~400 px. L’inventaire déplié occupe le reste, avec scroll interne si nécessaire.

2.3 Composants modifiés ou créés
Modifiés
Composant	Changements
CharacterWindow.jsx	Remplacement de l’empilement vertical des 3 sections par une grille CSS 2 colonnes (responsive). Gestion du bandeau poids/sols toujours visible.
ArmorWoundPanel.jsx	Retrait des ContainerPanel (Sac, Ceinture) de la colonne centrale. Retrait de l’overlay de poids (`weightColor`/`weightRatio`, logique actuelle lignes 69-72), qui migre vers InventoryBanner.jsx avec sa logique de couleur inchangée. La colonne centre ne contient plus que la silhouette (coloration par pire blessure, `SEVERITY_COLORS` — mécanisme indépendant, non touché).
WeaponPanel.jsx	Ajout de la section « Conteneurs portés » en dessous des armes. Reprise des ContainerPanel retirés d’ArmorWoundPanel. Ajout du bouton « Customisation » (moding), déplacé depuis InventoryPanel — `onOpenModing` devient une prop de WeaponPanel au lieu d’InventoryPanel. Le contenu de ModingWindow.jsx n’est pas affecté : il charge déjà l’ensemble des armes possédées via `/char-sheet/:id/moding/state`, indépendamment de ce qui est équipé.
InventoryPanel.jsx	Retrait de la capacité d’équiper une arme (le <select> de slot ne concerne plus que les armures). Ajout du dialogue de confirmation de suppression. Ajout des filtres au catalogue GM. Ajout du bouton « Prendre dans le Sac » pour les items du Coffre. Retrait du bouton Customisation (déplacé vers WeaponPanel). Le Coffre est affiché comme section séparée (hors accordéon Sac/Ceinture), avec tooltip `data-tooltip` (pattern déjà utilisé en `has-tooltip` dans WeaponPanel.jsx:56) portant le texte « Stockage distant ».
Créés
Composant	Responsabilité
InventoryBanner.jsx	Bandeau toujours visible : jauge de poids (barre + ratio + pourcentage), solde en sols (éditable inline si owner/GM, mais [VÉRIFIÉ char-sheet.js:1018-1020] un joueur non-GM ne peut que DIMINUER les sols — le serveur rejette (403) toute augmentation par un non-GM ; l'édition inline doit refléter cette asymétrie, ex. borne l'input à la valeur actuelle pour un non-GM plutôt que de laisser un 403 surprendre l'utilisateur). Extrait d’InventoryPanel pour être affiché même quand l’inventaire est replié.
Conservés sans modification
Composant	Raison
LocationPanel.jsx	Fonctionnel et bien intégré. Aucun changement nécessaire.
SilhouettePanel.jsx	Aucun changement (blessures uniquement).
ContainerPanel.jsx	Conservé tel quel, simplement déplacé d’ArmorWoundPanel vers WeaponPanel.
3. Flux de données — architecture révisée (source unique de vérité)

[VÉRIFIÉ 2026-08-04] Le mécanisme actuel n'a PAS de source unique pour l'inventaire, contrairement aux
blessures. Preuves relevées dans le code :

    `client/src/stores/*.js` (10 stores Zustand) : aucun ne contient de donnée inventaire — grep
    `inventory|weapon|container` sans résultat. Seul `characterStore.js` a `woundsByCharId` pour les
    blessures, alimenté par `useCharacterSocket.js`.

    `useCharacterSocket.js` écoute déjà WS.INVENTORY_ADDED/UPDATED/REMOVED et WS.MOD_INSTALLED, mais
    jette la donnée reçue : il incrémente juste un compteur générique `woundVersions` (nom trompeur —
    partagé entre blessures, inventaire et moding), transmis à CharacterWindow via la prop
    `inventoryReloadKey` (SessionPage.jsx:1132, seul consommateur externe vérifié). CharacterWindow le
    traduit en `inventoryVersion`/`bumpInventoryVersion`, passé en `reloadKey` aux 4 panneaux qui font
    chacun leur propre `api.get` indépendant.

    Le pattern « blessures », envisagé comme modèle à cloner, a lui-même un défaut : sur un event WS
    de blessure, la donnée est fetchée deux fois (une fois dans le handler WS direct vers le store,
    une fois via la cascade reloadKey dans ArmorWoundPanel.load()). Ce n'est pas un précédent propre à
    reproduire tel quel.

    Côté serveur (`char-sheet.js`), chaque WS.INVENTORY_ADDED/UPDATED porte déjà l'objet `item` complet,
    et INVENTORY_REMOVED porte `itemId` — la donnée nécessaire à un upsert/remove incrémental est déjà
    envoyée et actuellement inexploitée. `total_weight`/`threshold` en revanche sont calculés uniquement
    dans la réponse GET /inventory complète (`inventoryService.js:222-238`) et absents des payloads WS
    par item.

    `threshold = forValue * multiplier` (Force du personnage × un multiplicateur) : ce n'est PAS une
    donnée d'inventaire, c'est une donnée dérivée des stats du personnage qui transite par la même
    réponse. La conflater dans un état "inventaire" mélange deux autorités différentes (CLAUDE.md §1.4).

3.1 Store partagé — `characterStore.js` étendu

Par cohérence avec le pattern déjà en place pour `woundsByCharId` (même fichier, même granularité par
characterId — pas un nouveau store dédié) :

    `inventoryByCharId: {}` — items bruts par personnage.

    `setInventory(charId, items)` — remplacement complet, utilisé au premier chargement seulement.

    `upsertInventoryItem(charId, item)` / `removeInventoryItem(charId, itemId)` — écriture incrémentale
    depuis les handlers WS, sur le modèle de `upsertCharacter`/`removeCharacter` déjà existants.

    `sols` et `threshold` : à héberger séparément de `inventoryByCharId` (threshold n'est pas une donnée
    d'inventaire — cf. ci-dessus). Emplacement exact à trancher en 3.4.

3.2 Props et état — CharacterWindow

Les 4 consommateurs ArmorWoundPanel, WeaponPanel, InventoryPanel, InventoryBanner lisent
`inventoryByCharId[characterId]` par sélecteur au lieu de fetch indépendant. Un seul fetch initial
peuple le store si absent pour ce characterId.

[VÉRIFIÉ — CharacterWindow.jsx:596-601] ModingWindow.jsx est un CAS À PART, à ne pas mettre dans la
même bascule : il charge `/moding/state` (armes + mods déjà joints côté serveur, une forme différente
des items bruts d'`inventoryByCharId`) et reste volontairement hors du store (§2.3, §10 point 2 —
décision déjà actée, ne pas la recroiser silencieusement comme fait par erreur dans une version
antérieure de cette section). Il dépend aujourd'hui de `reloadKey={inventoryVersion}` /
`onInventoryMutated={bumpInventoryVersion}` (CharacterWindow.jsx:600-601) pour savoir quand se
rafraîchir. Si `inventoryVersion`/`bumpInventoryVersion` disparaît intégralement comme code mort,
ModingWindow perd silencieusement son seul déclencheur de rafraîchissement. Avant de supprimer ce
mécanisme, ModingWindow.jsx doit recevoir son propre signal local (petit hook dédié, écoute directe de
WS.INVENTORY_ADDED/UPDATED/REMOVED et WS.MOD_INSTALLED filtrée par characterId, sur le modèle de
useWizardInventorySync.js — légitime ici car la forme de donnée de ModingWindow ne doit pas rejoindre
le store, contrairement à InventoryPanel/StepMaterielEtBiens où la duplication était le problème).

`inventoryReloadKey`/`woundVersions` (partie inventaire, côté SessionPage/useCharacterSocket) et le
`inventoryVersion`/`bumpInventoryVersion` de CharacterWindow deviennent du code mort à retirer pour
les 4 consommateurs store, mais PAS pour ModingWindow qui garde son propre mécanisme équivalent local.
Ce n'est plus « conservé sans modification » comme documenté initialement.

3.3 WebSocket

[VÉRIFIÉ] Les événements INVENTORY_ADDED, INVENTORY_UPDATED, INVENTORY_REMOVED, SOLS_UPDATED sont déjà
émis par le serveur (char-sheet.js) avec la donnée complète (item ou itemId). Les handlers dans
useCharacterSocket.js écrivent directement dans le store via upsertInventoryItem/removeInventoryItem —
plus de refetch de rattrapage, plus de compteur générique.

3.4 Analyse critique de cette architecture — décisions tranchées le 2026-08-04

[VÉRIFIÉ] Saar délègue le jugement technique sur ces 4 points, avec boussole explicite : architecture
robuste/pérenne/adaptative, un fichier = une responsabilité, qualité >>> vitesse, le temps n'est pas
une contrainte, un refactor est légitime si le matériau de base n'est pas assez qualitatif.

    1. Course fetch-vs-subscribe — TRANCHÉ. Compteur `inventoryFetchEpoch` par characterId dans
       characterStore.js. Toute écriture (résolution de fetch complet, upsert WS, upsert depuis la
       réponse HTTP d'une mutation locale) est causale à cet epoch : une réponse de fetch périmée
       (une écriture plus récente a déjà eu lieu) est ignorée au lieu d'écraser le store. Mécanisme
       contenu entièrement dans characterStore.js — n'affecte aucun autre fichier.

    2. Optimistic UI vs attente WS — TRANCHÉ : pas d'écriture spéculative. L'auteur d'une mutation met
       à jour le store directement depuis la réponse HTTP de sa propre requête (déjà autoritaire :
       chaque route PUT/POST/DELETE de char-sheet.js renvoie déjà l'item ou l'itemId complet — vérifié
       lignes 1061-1135) sans attendre l'écho WS. Les autres clients connectés se synchronisent par WS
       (`io.to(room)`, qui inclut l'émetteur mais l'écriture est déjà faite, donc idempotente). Aucun
       mécanisme de rollback à construire : rien n'est jamais écrit avant confirmation serveur réelle.
       §4.1 du plan est révisé en conséquence (retrait de la mention « optimiste »).

    3. Portée de diffusion Wizard — TRANCHÉ PAR LECTURE DE CODE, pas une décision produit :
       - Le peek CharacterWindow (WizardCreation.jsx:378) est déjà `forceReadOnly`, sans
         `inventoryReloadKey` — snapshot statique par conception actuelle, aucune régression possible
         sur ce point précis.
       - Le socket du Wizard a bien rejoint `wizard:<sheetId>` avant tout accès au matériel (WIZARD_JOIN
         émis par WizardLockSync.jsx:66, monté en amont dans l'arbre — WizardCreation.jsx:243). L'accès
         réseau aux events INVENTORY_* n'est donc pas le problème.
       - Découverte en vérifiant ce point : `StepMaterielEtBiens.jsx` (étape Matériel du Wizard lui-même,
         pas le peek) réutilise directement `InventoryPanel.jsx`, alimenté par un second hook parallèle
         `useWizardInventorySync.js` — une DUPLICATION du même pattern bump-compteur que
         `useCharacterSocket.js`, documentée comme telle dans son propre commentaire (« Même mécanisme
         ici... »). Périmètre de la bascule store élargi à ce fichier : sans lui, l'étape Matériel du
         Wizard casse dès qu'InventoryPanel.jsx lit le store au lieu d'un reloadKey. C'est exactement le
         cas visé par « une correction peut être l'occasion d'un refactor si le matériau n'est pas assez
         qualitatif » — cette duplication disparaît en même temps que la bascule.

    4. Autorité de `threshold`/`sols` — TRANCHÉ pour le principe : `inventoryByCharId` ne porte
       STRICTEMENT que la liste d'items ; `threshold` (dérivé de la Force du personnage, pas de
       l'inventaire) et `sols` (monnaie, événement WS.SOLS_UPDATED dédié) vivent dans des clés séparées
       de characterStore.js, chacune avec sa propre action d'écriture. Une propriété = une autorité,
       même fichier store mais pas la même sous-clé que les items.
       [INCONNU — non tranché, à vérifier à l'écriture du code] L'emplacement exact de `sols` : le champ
       existe peut-être déjà sur les entrées de `characters` (chargées par loadSession) auquel cas
       l'action d'écriture existante suffit et `thresholdByCharId` serait la seule map réellement
       nouvelle. À lire dans characterStore.js/loadSession avant d'écrire le code du store — ne pas
       supposer une forme précise sans l'avoir vue.

Risques non bloquants, notés pour suivi (pas de décision requise) :

    5. Pas de purge de `inventoryByCharId`/`woundsByCharId` — chaque personnage consulté reste en
       mémoire pour la durée de la session. Non conçu, non bloquant pour un petit groupe.

    6. Bascule panneau par panneau = incohérence transitoire possible si mal séquencée. La bascule de
       la couche données (store + WS + StepMaterielEtBiens) doit être un commit atomique unique,
       séparé des étapes visuelles/layout qui suivent.

    7. Aucun test existant sur les stores Zustand (`**/stores/**/*.test.js` : 0 résultat) — la preuve
       de non-régression demandera une session multi-client réelle (GM + joueur, et Wizard), en plus
       des vérifications techniques automatisables.
4. Interactions utilisateur
4.1 Équiper une armure

Depuis l’inventaire :

    Le joueur déplie l’accordéon du conteneur (ex. Sac).

    Sur la ligne de l’item, un bouton « Équiper » ouvre un sous-menu : « Sur quelle localisation ? » → liste des 6 localisations disponibles.

    La localisation cible est mise à jour dès la réponse serveur (pas d'écriture spéculative — §3.4
    point 2). Un feedback de chargement bref (ex. léger effet de transition sur la cible) couvre le
    délai réseau au lieu d'un rollback, qui n'a plus lieu d'être.

Depuis la localisation :

    Inchangé : le <select> dans LocationPanel permet d’équiper directement.

Drag & drop :

    Source : ligne d’item dans l’inventaire (Sac ou Ceinture).

    Cible : zone LocationPanel correspondante.

    Si drop invalide (règle 1+S+S, 3 couches max), feedback visuel (bordure rouge clignotante) sans action.

4.2 Équiper une arme

Depuis l’inventaire :

    Le joueur déplie l’accordéon.

    Sur la ligne de l’item, un bouton « Équiper » → l’arme s’équipe automatiquement selon sa nature (1 main → main directrice si libre, sinon secondaire ; 2 mains → emplacement 2M).

    Si conflit (mains occupées), le système propose de déséquiper l’arme existante (avec confirmation).

Depuis le bloc Armes :

    Conservé : le <select> + bouton Équiper dans WeaponPanel.

Drag & drop :

    Source : ligne d’item dans l’inventaire.

    Cible : zone « Main Directrice », « Main Secondaire », ou « 2 Mains » dans le bloc Armes.

4.3 Déséquiper

Armure ou arme :

    Bouton × sur l’item équipé → l’objet retourne dans le Sac (ou la Ceinture si c’est un contenant).

Drag & drop :

    Source : item équipé (dans LocationPanel, WeaponCard, ou ContainerPanel).

    Cible : zone Sac ou Ceinture dans l’inventaire.

4.4 Déplacer entre conteneurs

Depuis l’inventaire :

    <select> de conteneur sur chaque ligne (conservé).

    Drag & drop d’une ligne vers l’en-tête d’un autre conteneur.

Bouton « Prendre dans le Sac » (Coffre → Sac) :

    Sur les lignes du Coffre, un bouton « Prendre dans le Sac » effectue un PUT container: 'Sac' en une action.

4.5 Ajout GM (catalogue)

    Bouton « + Ajouter » dans l’inventaire.

    Ouverture d’un panneau avec :

        Barre de recherche textuelle (conservée).

        Filtres : catégorie (armes, armures, équipement, munitions…), famille, rareté, poids max.

        Résultats paginés (20 par page) au lieu du slice(0, 50) actuel.

    Sélection d’un item → choix du conteneur + quantité → confirmation.

4.6 Suppression

    Sur la ligne de l’item, bouton « Supprimer » → dialogue de confirmation « Supprimer [nom de l’objet] ? Cette action est irréversible. »

    Suppression uniquement si l’utilisateur confirme.

5. Drag & drop — Spécifications
5.1 Bibliothèque

[VÉRIFIÉ 2026-08-04, recherche web] Choix confirmé : @dnd-kit/core + @dnd-kit/sortable. Standard
communautaire 2026 (~2.8M téléchargements/semaine), 6KB, accessible, activement maintenu. L'alternative
sérieuse (@atlaskit/pragmatic-drag-and-drop, Atlassian) ne devient pertinente qu'à l'échelle 1000+ items
avec détection de collision custom — hors sujet pour un inventaire de quelques dizaines d'objets. Le
pattern exact recherché (glisser entre plusieurs zones de drop distinctes : Sac, Ceinture, 6
LocationPanel, 3 slots d'arme) correspond au preset officiel « Sortable / Multiple Containers » de
dnd-kit.

5.2 Zones sources
Zone	Élément draggable	Contexte
Ligne d’item dans l’inventaire (Sac, Ceinture)	L’item entier (icône + nom + stats)	Item non équipé, dans un conteneur portable
Ligne d’item dans l’inventaire (Coffre)	Idem	Item en stockage distant — cible valide uniquement vers Sac/Ceinture (pas d’équipement direct)
Item équipé (LocationPanel, WeaponCard, ContainerPanel)	L’item équipé	Déséquipement = drop vers zone Sac ou Ceinture
5.3 Zones cibles
Zone	Action déclenchée	Restriction
LocationPanel (ex. « Bras Droit »)	PUT /inventory/:id { slot: 'BD' }	Règle 1+S+S, 3 couches max. Refus avec feedback si invalide.
Zone « Main Directrice »	PUT /inventory/:id { slot: dirSlot }	[VÉRIFIÉ inventoryService.js:470-474] Le serveur REJETTE (409) si le slot ou une arme 2M est déjà en place — aucun déséquipement automatique. Sur 409, déclencher le dialogue §4.2 (« Déséquiper l'arme actuelle ? ») ; si confirmé, PUT de déséquipement de l'arme en place (retour Sac) puis PUT d'équipement de la nouvelle arme — 2 requêtes séquentielles, chaque réponse HTTP met à jour le store (§3.4 point 2).
Zone « Main Secondaire »	PUT /inventory/:id { slot: secSlot }	Idem Main Directrice.
Zone « 2 Mains »	PUT /inventory/:id { slot: '2M' ou 'Tr' }	[VÉRIFIÉ inventoryService.js:466-469] Le serveur REJETTE (409) si une main est déjà occupée — aucun déséquipement automatique. Sur 409, dialogue §4.2 ; si confirmé, PUT de déséquipement de chaque main occupée (jusqu'à 2 requêtes) puis PUT d'équipement 2M — chaque réponse HTTP met à jour le store.
Zone « Sac » (dans inventaire)	PUT /inventory/:id { container: 'Sac' }	Sac doit être disponible.
Zone « Ceinture » (dans inventaire)	PUT /inventory/:id { container: 'Ceinture' }	Ceinture doit être disponible.
5.4 Feedback visuel

    Survol d’une cible valide : bordure bleue (#5b8dee), opacité légèrement augmentée.

    Survol d’une cible invalide : bordure rouge (#e05c5c), icône d’interdiction.

    Drop en attente : aucune écriture spéculative (§3.4 point 2) — l'item reste visuellement à sa
    position d'origine pendant la requête ; un indicateur de chargement bref apparaît sur la cible.

    Drop réussi (réponse serveur reçue) : l'item apparaît dans sa nouvelle position avec une transition
    de 200ms — c'est la réponse HTTP qui déclenche le changement, jamais le drop lui-même.

    Drop en échec (règle cliente violée type 1+S+S/3 couches, refus immédiat sans requête) : feedback
    bordure rouge, l'item n'a jamais quitté sa position — rien à faire « revenir ».

    Drop rejeté par le serveur (409, ex. conflit de mains — §5.3) : pas de rebond générique ; déclencher
    le dialogue de confirmation §4.2 quand le conflit est de ce type, sinon message d'erreur bref près de
    la cible. Dans les deux cas l'item n'a jamais quitté sa position d'origine.

5.5 Dégradation sans drag & drop

[VÉRIFIÉ] Toutes les interactions doivent rester possibles sans drag & drop, via des boutons et des menus. Le drag & drop est un raccourci pratique, pas le seul mode d’interaction. Cela garantit l’accessibilité (clavier, tactile) et la compatibilité avec les préférences utilisateur.
6. Stratégie de migration

[VÉRIFIÉ] Principe directeur : ne rien casser pendant le chantier. Chaque étape doit laisser l’application dans un état fonctionnel.
6.1 Ordre des modifications
Étape	Description	Composants touchés	Test de non-régression
Étape 0 ✅ confirmé 2026-08-05	Socle de données (§3, §3.4) — commit atomique, séparé de toute étape visuelle. Ajouter à characterStore.js : `inventoryByCharId`, `thresholdByCharId`, `sols` par charId, actions `setInventory`/`upsertInventoryItem`/`removeInventoryItem`, garde `inventoryFetchEpoch`. Réécrire les handlers INVENTORY_*/MOD_INSTALLED de useCharacterSocket.js pour écrire directement dans le store (fin du compteur `woundVersions` côté inventaire). Migrer useWizardInventorySync.js/StepMaterielEtBiens.jsx sur le même store (fin de la duplication). Basculer ArmorWoundPanel, WeaponPanel, InventoryPanel de reloadKey/fetch local vers lecture store par sélecteur. Donner à ModingWindow.jsx son propre signal local de rafraîchissement (petit hook dédié, écoute WS directe filtrée par characterId — il reste hors du store, §3.2) AVANT de retirer inventoryVersion/bumpInventoryVersion/inventoryReloadKey, pour ne pas casser son rafraîchissement.	characterStore.js, useCharacterSocket.js, useWizardInventorySync.js, StepMaterielEtBiens.jsx, ArmorWoundPanel.jsx, WeaponPanel.jsx, InventoryPanel.jsx, ModingWindow.jsx (nouveau hook local), CharacterWindow.jsx, SessionPage.jsx	Session à deux fenêtres (GM + joueur) : muter l’inventaire dans une fenêtre, vérifier la mise à jour par WS dans l’autre sans rechargement. Même scénario côté Wizard (StepMaterielEtBiens). Installer un mod dans ModingWindow et vérifier qu’il se rafraîchit toujours (régression ciblée sur le point corrigé). Vérifier qu’aucune régression visuelle n’apparaît ailleurs — seule la source de donnée change, l’affichage reste identique à avant l’étape.
Étape 1 ✅ confirmé 2026-08-05	Créer InventoryBanner.jsx et extraire la jauge de poids + sols de InventoryPanel, en lisant `thresholdByCharId`/`sols`/`inventoryByCharId` du store (Étape 0) plutôt qu’un fetch propre. Le bandeau s’affiche au-dessus de l’inventaire, même quand il est replié.	InventoryPanel.jsx, InventoryBanner.jsx, CharacterWindow.jsx	Vérifier que le poids et les sols sont visibles quand l’inventaire est replié.
Étape 2 ✅ confirmé 2026-08-05	Retirer ContainerPanel (Sac, Ceinture) de ArmorWoundPanel.jsx.	ArmorWoundPanel.jsx	Vérifier que les armures et la silhouette s’affichent correctement sans les conteneurs.
Étape 3 ✅ confirmé 2026-08-05	Ajouter la section « Conteneurs portés » dans WeaponPanel.jsx, en dessous des armes. Y intégrer les ContainerPanel. Déplacer le bouton Customisation (moding) d’InventoryPanel.jsx vers WeaponPanel.jsx (prop `onOpenModing` reroutée depuis CharacterWindow.jsx ; ModingWindow.jsx lui-même inchangé).	WeaponPanel.jsx, ContainerPanel.jsx (inchangé), InventoryPanel.jsx, CharacterWindow.jsx	Vérifier que le Sac et la Ceinture s’affichent et fonctionnent dans leur nouvelle position, et que le bouton Customisation ouvre toujours ModingWindow avec l’ensemble des armes possédées.
Étape 4 ❌ annulée 2026-08-05	Modifier CharacterWindow.jsx pour afficher les deux blocs en grille 2 colonnes (responsive) au lieu de l’empilement vertical. **Codée puis annulée après test** (bloc trop massif, silhouette écrasée) — retour à l'empilement vertical d'origine, décision Saar.	CharacterWindow.jsx	Vérifié : empilement vertical confirmé fonctionnel.
Étape 5 ✅ confirmé 2026-08-05	Ajouter le drag & drop dans InventoryPanel et les zones d’équipement, y compris le dialogue de confirmation en cas de conflit main/2M rejeté par le serveur (§4.2, §5.3).	InventoryPanel.jsx, WeaponPanel.jsx, LocationPanel.jsx	Scénario : équiper une arme par drag, équiper une armure par drag, déplacer entre conteneurs par drag, ET le scénario de conflit main/2M avec confirmation (§7.2) — c'est cette étape qui construit ce flux, il doit être vérifié ici, pas seulement listé globalement en §7.2.
Étape 6 ⚠️ codé 2026-08-05, non testé navigateur	Filtres catalogue GM (famille, catégorie, rareté, poids max — facettes déduites du catalogue chargé, pattern `families` de TradeWindow.jsx) et pagination réelle 20/page (remplace le `slice(0,50)`). `weight` ajouté au SELECT de `GET /api/equipment` (colonne déjà en base, absente du payload).	InventoryPanel.jsx, server/src/routes/equipment.js	Vérifier les 4 filtres (seuls ou combinés), la pagination (Précédent/Suivant, indicateur), et l'ajout d'un item après filtrage.
Étape 7 ⚠️ codé 2026-08-05, non testé navigateur	Confirmation avant suppression (`window.confirm`, pattern déjà utilisé WeaponPanel.jsx conflit main/2M). Message explicite si Sac/Ceinture non équipé et vide. Coffre séparé visuellement de l'accordéon Sac/Ceinture avec tooltip « Stockage distant » (pattern `data-tooltip` existant, WeaponPanel.jsx:56).	InventoryPanel.jsx	Vérifier que le dialogue apparaît avant suppression (annuler conserve l'item), que le message s'affiche si pas de sac/ceinture, que le Coffre est visuellement distinct avec sa tooltip.
Étape 8 ⚠️ codé 2026-08-05, non testé navigateur	Bouton « Prendre dans le Sac » pour les items du Coffre (PUT container:'Sac' en un clic).	InventoryPanel.jsx	Vérifier que l'item passe du Coffre au Sac en un clic.
Étape 9 ⚠️ codé partiellement 2026-08-05, non testé navigateur	Libellés de slot traduits (T/C/BG/BD/JG/JD/MG/MD/2M/Tr → libellés, réutilise `LOCATION_I18N_KEYS`/`SLOT_TO_WOUND_LOCATION`/`weaponPanel.slotLabels.*`) sur le `<select>` de Slot et le badge `[...]` de ligne. Le retrait du `<select>` de Slot reste différé (§10 — KeyboardSensor). Le `<select>` de container (Sac/Coffre), lui, a été retiré hors plan initial sur demande directe de Saar 2026-08-05 (voir écart en tête de document) — un bouton « Ranger dans le Coffre » complète « Prendre dans le Sac » pour ne perdre aucun chemin.	InventoryPanel.jsx	Vérifier qu'aucune régression n'est introduite ; vérifier spécifiquement le bug corrigé en même temps (clic sur le `<select>` de Slot n'entraîne plus l'item vers le curseur — `InteractiveAwarePointerSensor`, CharacterWindow.jsx).
6.2 Compatibilité ascendante

    Les routes API (/inventory, /sols) ne sont pas modifiées. Le serveur n’est pas impacté.

    Aucune migration de base de données n’est nécessaire.

    Les composants existants non touchés (SilhouettePanel, LocationPanel, ContainerPanel) conservent leur interface publique (props).

7. Plan de tests
7.1 Tests unitaires (Jest)
Test	Cible
upsertInventoryItem/removeInventoryItem mettent à jour inventoryByCharId sans affecter les autres characterId	characterStore.js
Une résolution de fetch périmée (epoch dépassé) n'écrase pas un upsert WS plus récent	characterStore.js
thresholdByCharId et sols restent inchangés par une mutation d'item (autorité séparée — §3.4 point 4)	characterStore.js
InventoryBanner affiche le poids formaté et la jauge	InventoryBanner.jsx
InventoryBanner affiche le solde en sols et permet l’édition si canEdit	InventoryBanner.jsx
WeaponPanel affiche le mode 2 mains quand une arme 2M est équipée	WeaponPanel.jsx
WeaponPanel affiche Dir/Sec quand une arme 1 main est équipée	WeaponPanel.jsx
WeaponPanel affiche les conteneurs portés	WeaponPanel.jsx
7.2 Tests d’intégration (Playwright ou manuel)
Scénario	Étapes
Synchronisation multi-client (Étape 0 — §3.4 point 7)	1. Ouvrir la fiche dans deux fenêtres (GM et joueur, ou deux onglets). 2. Muter l’inventaire dans l’une (équiper, déséquiper, ajouter). 3. Vérifier la mise à jour dans l’autre sans rechargement de page. 4. Répéter le scénario depuis StepMaterielEtBiens.jsx (Wizard) vers une fenêtre de session ouverte sur le même personnage si possible, sinon vérifier au minimum que le Wizard reste fonctionnel après la bascule.
Conflit main/2M avec confirmation (§4.2/§5.3)	1. Équiper une arme 1 main. 2. Glisser une arme 2 mains vers la zone « 2 Mains ». 3. Vérifier que le serveur rejette (409) et que le dialogue de confirmation apparaît au lieu d’un simple rebond. 4. Confirmer → vérifier les 2 requêtes séquentielles et l’état final (arme 1 main dans le Sac, arme 2 mains équipée).
Équiper une armure par drag & drop	1. Ouvrir l’onglet Matériel. 2. Déplier l’inventaire Sac. 3. Glisser un brassard vers la zone « Bras Droit ». 4. Vérifier que le brassard apparaît dans LocationPanel.
Équiper une arme à deux mains	1. Glisser un fusil depuis l’inventaire vers la zone « 2 Mains ». 2. Vérifier que les zones Main Dir/Main Sec sont masquées. 3. Vérifier que le fusil apparaît dans le bloc Armes.
Conflit d’armure (1+S+S)	1. Équiper une armure rigide (cat B) sur le Corps. 2. Tenter d’équiper une seconde armure rigide. 3. Vérifier que le drop est refusé avec un message d’erreur.
Suppression avec confirmation	1. Cliquer sur ✕ dans l’inventaire. 2. Vérifier que le dialogue apparaît. 3. Annuler → l’objet est conservé. 4. Confirmer → l’objet disparaît.
Catalogue GM avec filtres	1. Ouvrir le catalogue. 2. Filtrer par catégorie « Armures ». 3. Vérifier que seules les armures sont affichées. 4. Ajouter une armure au Sac.
Responsive	1. Ouvrir la fenêtre à 720 px → 2 colonnes. 2. Réduire à 500 px → 1 colonne. 3. Vérifier qu’aucun élément n’est coupé.
8. Livrables V1
Dans le scope

    ✅ Disposition en 2 colonnes (responsive).

    ✅ Bandeau poids/sols toujours visible.

    ✅ Migration des conteneurs (Sac, Ceinture) d’ArmorWoundPanel vers WeaponPanel.

    ✅ Affichage contextuel des armes (2M vs Dir/Sec).

    ✅ Drag & drop pour l’équipement (armes, armures) et les déplacements entre conteneurs.

    ✅ Filtres et pagination dans le catalogue GM.

    ✅ Dialogue de confirmation pour la suppression.

    ✅ Message explicite si Sac/Ceinture non disponibles.

    ✅ Bouton « Prendre dans le Sac » pour les items du Coffre.

    ✅ Libellés de slot traduits dans tout l’onglet.

    ✅ Source unique de vérité pour l’inventaire (store partagé, upsert/remove incrémental par WS) — Étape 0, préalable atomique aux étapes visuelles.

Hors scope

    ❌ Gestion de l’inventaire depuis le VTT (token, battlemap). Périmètre CharacterWindow uniquement.

    ❌ Refonte du SilhouettePanel pour afficher l’équipement sur la silhouette. La silhouette reste dédiée aux blessures.

    ❌ Refonte du ModingWindow (customisation d’armes). Le bouton d’accès est conservé sans changement.

    ❌ Internationalisation des nouveaux libellés (les clés i18n seront créées en français, la traduction sera faite dans un lot séparé).

9. Conformité au contrat

[VÉRIFIÉ] Ce plan respecte :

    CLAUDE.md : le code et les données observées priment, les règles de combat/monde ne sont pas impactées. Le périmètre visuel/UX reste l’onglet Matériel de CharacterWindow ; le périmètre de la source unique de vérité (Étape 0) inclut aussi useWizardInventorySync.js/StepMaterielEtBiens.jsx (Wizard), élargissement justifié en §3.4 point 3 (même donnée, même composant InventoryPanel.jsx réutilisé — éviter une deuxième implémentation divergente plutôt que respecter un périmètre artificiellement étroit).

    DOCUMENTATION_ARCHITECTURE.md : ce document est un PLAN (Règle 10), temporaire. Une fois implémenté, il sera archivé et la documentation définitive sera intégrée dans CHARACTER.md (DOMAIN).

    Règles Polaris : les règles de conteneurs (Sac/Ceinture conditionnels, 1+S+S, 3 couches max) sont strictement respectées. Aucune règle maison introduite.

    Hiérarchie documentaire : LdB > FOUNDATION > VOCABULARY > SYSTEM > DOMAIN > MANUEL > PLAN. Ce document est au niveau PLAN.

10. Points ouverts — tranchés le 2026-08-04

[VÉRIFIÉ] Décisions validées par Saar. Les deux mécanismes de couleur sont confirmés indépendants
dans le code actuel : `weightColor`/`weightRatio` (ArmorWoundPanel.jsx:69-72, basé sur
`totalWeight / threshold`) pour le poids, et `SEVERITY_COLORS` (shared/woundConstants.js, consommé
par SilhouettePanel.jsx) pour la pire blessure. Aucun couplage entre les deux à préserver ou à créer.

#	Question	Décision
1	L’overlay de poids actuellement superposé sur la silhouette (ArmorWoundPanel.jsx) doit-il migrer vers le bandeau ou être conservé ?	**Tranché.** Migre vers InventoryBanner.jsx, avec sa logique de couleur `weightColor` inchangée (basée sur le ratio de poids, PAS sur la sévérité de blessure — les deux logiques sont indépendantes et le restent). La coloration de la silhouette selon la pire blessure (SEVERITY_COLORS) n’est pas affectée.
2	Le bouton « Customisation » (moding) actuellement dans InventoryPanel doit-il rester dans l’inventaire ou migrer vers le bloc Armes ?	**Tranché.** Migre vers WeaponPanel.jsx. ModingWindow.jsx n’a pas besoin d’évoluer : il charge déjà l’ensemble des armes possédées (équipées et non équipées) via `/char-sheet/:id/moding/state`, indépendamment du contenu affiché dans WeaponPanel — seul le bouton déclencheur change de panneau.
3	Ordre des conteneurs dans l’accordéon : Sac / Ceinture / Coffre ou Coffre en dernier ?	**Tranché.** Le Coffre est explicitement séparé de l’accordéon Sac/Ceinture (section distincte), avec une tooltip « Stockage distant » sur le libellé Coffre (pattern `data-tooltip` déjà utilisé dans WeaponPanel.jsx:56, pas de nouveau mécanisme de tooltip).
