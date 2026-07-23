> **[HISTORIQUE, archivé 2026-07-21 Session 167]** — Chantier clos (Phases 1/3/4 codées et testées,
> Phase 2 différée — Strangler Fig). Contenu définitif intégré dans `docs/SYSTEME/MODING.md` (Règle
> 10, `docs/RegleDocumentaire.md`). Conservé pour l'historique de conception (3 passages d'analyse à
> charge, citations RAW). Dettes résiduelles : `docs/BUGIDENTIFIE.md` (`MODING4-*`). Ne plus modifier
> ni citer comme référence active — voir `docs/SYSTEME/MODING.md`.

## Système de mods d'armes

Document de conception consolidé, Audit à charge requis.

> **Correctif (analyse critique, 2026-07-21)** — Audit à charge effectué, vérifié contre le code
> réel (`socketCombatAnnouncement.js`, `socketCombatHelpers.js`, migrations 141/142). Quatre
> problèmes trouvés et corrigés ci-dessous, tous marqués `> Correctif` à l'endroit concerné :
> (1) le plan initial oubliait que la Lunette a un pied en **Phase 1 Déclaration**
> (`getAimIniCost`/`getAimBonusComp`) distinct de son pied en **Phase 2 Résolution** — exactement le
> piège déjà trouvé et corrigé dans `docs/PLAN_MODING_PHASEB.md` Groupe 2, reproduit ici par manque
> de vérification du code source avant conception ; (2) le registre dupliquait `mod_slot`, déjà
> autorité unique en base (migration 141) ; (3) le mapping registre↔catalogue n'était pas tranché
> pour la Lunette (10 `equipment_id` réels) ; (4) "Système réactif autonome" disparaissait de la
> Phase 4 sans decision explicite. Point 5 ajouté : proportionnalité de la migration Groupe 1/2 déjà
> livré face au risque de régression.
>
> **Second passage (2026-07-21, recherche externe demandée par Saar)** — Comparaison avec un système
> professionnel équivalent et mature : **PF2e Rule Elements** (système officiel Pathfinder 2e pour
> Foundry VTT, open-source, des milliers d'utilisateurs, même problème exact — un item modifie un
> jet de combat sans dupliquer la logique de résolution). Deux décisions du premier passage sont
> révisées à la lumière de ce précédent, pas juste inspirées dessus :
> - **`mod_key` remplace `equipmentIds`** : chez PF2e, "Rule elements attach directly to items as
>   arrays in the data model — not through a separate registry" (le type de comportement est une
>   donnée sur l'item, pas une liste d'ID en dur dans un fichier JS). Correction du §2.1 : au lieu
>   d'un tableau `equipmentIds` codé dans `weaponModRegistry.js`, une colonne `ref_equipment.mod_key`
>   (même migration que `mod_slot`/`mod_requires_aim`, 141) porte le type de comportement. Ajouter
>   un futur item au même comportement ne touche alors qu'une donnée catalogue, jamais un fichier JS.
> - **`priority` remplace "ordre d'installation"** : PF2e exécute les Rule Elements par `priority`
>   explicite (nombre, plus petit = exécuté en premier), jamais par un ordre implicite dérivé d'un
>   historique d'actions utilisateur. "Ordre d'installation" est fragile (désinstaller/réinstaller un
>   item le change silencieusement) — remplacé ci-dessous par un `priority` porté par le handler.
> - **`phase` unifie Déclaration et Résolution au lieu de les séparer** : PF2e exécute ses Rule
>   Elements en phases nommées (`applyAEs`/`beforeDerived`/`afterDerived`/`beforeRoll`) — la même
>   architecture générique gère des moments différents du pipeline, au lieu d'avoir un système neuf
>   pour une moitié du pipeline et un code legacy permanent pour l'autre. Le correctif du premier
>   passage ("Déclaration hors périmètre, reste sur l'ancien code indéfiniment") est une solution
>   honnête mais pas la plus robuste : elle laisse un second moteur vivre en permanence, ce que
>   `CLAUDE.md` §13 désigne comme un risque de dérive même quand il est documenté. Remplacée
>   ci-dessous par un hook `onDeclare` dans le même registre, qui unifie réellement l'architecture au
>   lieu de la scinder — cohérent avec l'exigence de Saar : « architecture robuste et pérenne, jamais
>   de bricolage même temporaire ».
>
> Sources : [PF2e Quickstart guide for rule elements](https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements),
> [Rule Elements — PF2e for Foundry VTT](https://mintlify.wiki/foundryvtt/pf2e/concepts/rule-elements),
> [Strangler Fig Pattern — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig).
>
> **Troisième passage (2026-07-21, analyse à charge) — 3 failles vérifiées contre le code réel, texte
> RAW des 3 mécaniques Groupe 4 retrouvé et cité.**
> 1. **Signatures "pures" fausses pour Groupe 4** : `server/src/lib/diceParser.js:22` —
>    `parseDice` est `async`. Tout handler appelant `context.rollDice(...)` (ATI/Mémoire/Projecteur)
>    doit donc être `async`, pas une "fonction pure" synchrone comme écrit partout dans ce document.
>    Corrigé : les hooks `onCalculateModifiers` de `optiqueBonus`/`lunette` (Groupe 1/2, aucun dé)
>    restent des fonctions pures synchrones ; tout handler Groupe 4 impliquant un Test est explicitement
>    `async (modState, context) => ...`.
> 2. **Test Groupe 4 — hypothèse initiale infirmée par la source, contexte déjà suffisant.** Texte RAW
>    retrouvé (`docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js`, EQ_00001/00002/
>    00005, jamais cité par `PLAN_MODING_PHASEB.md` ni la version initiale de ce document) : les 3
>    mécaniques disent chacune *"on effectue un Test avec le niveau de l'appareil"* — le Seuil est la
>    valeur `bonus` de l'item (déjà `modLevel` dans `ModHookContext`), **pas une compétence de
>    personnage**. Contrairement à l'hypothèse soulevée dans l'analyse précédente (calquée sur le Test
>    de tir classique qui fetch `char_skills`), aucun champ de contexte supplémentaire n'est requis —
>    `rollDice('1d20')` comparé à `modLevel` suffit. Détails RAW précis absents des deux plans jusqu'ici,
>    à respecter dans les handlers Phase 4 :
>    - **ATI** : ne devient efficace qu'après avoir cumulé **20 points de marge de réussite** (Seuil −
>      jet, sommée Test après Test) ; une fois actif, chaque nouveau Test réussi augmente le bonus/malus
>      de +1, **plafond +4** ; efficace contre **une seule cible à la fois** ; perd tout à la fin du
>      combat (déjà su, `COMBAT_END`).
>    - **Mémoire** : Test raté → système en panne, **ne reconnaît pas** la cible (tir normal, pas de
>      blocage) ; Test réussi sur une cible préenregistrée → blocage (confirme l'interprétation déjà
>      dans 4.2.2).
>    - **Projecteur** : Test raté → tir automatiquement raté (confirme 4.3.2) ; le bonus ne dépasse
>      jamais le malus de mouvement à annuler (déjà dans 4.3.2) ; **règle manquante des deux plans** :
>      si la cible se déplace en zigzag/imprévisible, le niveau de l'appareil (`modLevel`) est réduit
>      de moitié avant le Test — à ajouter en 4.3.2.
> 3. **`state` orphelin lors d'un swap de slot en cours de combat** : la contrainte d'exclusivité
>    (migration 141) retourne l'ancien occupant en inventaire dès qu'un nouveau item prend le même
>    slot — mécanisme déjà en prod, jamais croisé avec `char_inventory_mods.state` (Phase 1.4) dans ce
>    document. Décision : `modingService.installMod` remet `state` à `null` sur la ligne swap-out, dans
>    la même transaction que le swap déjà existant (le `cumulativeMR` de l'ATI n'a aucun sens hors
>    combat sur un item désinstallé) — même logique que le nettoyage `COMBAT_END` (Phase 3.4), déclenché
>    ici par le swap plutôt que par la fin de combat.
>
> Points mineurs : `token_statuses` (migrations 68/79) n'a pas de colonne numérique — reste un badge
> cosmétique, la magnitude réelle (bonus croissant ATI) vit uniquement dans `state`, jamais recalculée
> depuis `token_statuses`. Toute écriture dans `token_statuses` passe par `statusService.js` (déjà
> l'autorité pour ce type d'écriture, cf. `applyStunWithDuration`), pas un insert ad-hoc dans
> `weaponModService.js` (`.claude/rules/core.md` : "les accès DB passent par les services existants").

1. Références

    Pattern Pipes and Filters (Fowler, 2002) et Component System (Godot, Factorio).

    Express.js middleware : (req, res, next) comme modèle d'interception chaînée.

    Redux middleware : store => next => action => { ... } pour la transformation de contexte.

2. Structure définitive
2.1 Registre unique (shared/weaponModRegistry.js)

Un tableau d'objets. Chaque objet décrit un type de mod et ses hooks.
Champ	Type	Description
key	string	Identifiant du comportement, doit correspondre à une valeur de `ref_equipment.mod_key` (ex: 'lunette', 'ati', 'memoire')
priority	number	Ordre d'exécution explicite quand plusieurs mods s'appliquent au même hook (plus petit = exécuté en premier) — jamais dérivé de l'ordre d'installation
hooks	object	Fonctions pures importées, une par hook

> **Correctif — pas de champ `slot` dans le registre.** `ref_equipment.mod_slot` (migration 141),
> snapshotté sur `char_inventory_mods.mod_slot` avec contrainte `UNIQUE` partielle, est déjà
> l'autorité unique de l'exclusivité par slot, en production. Redéclarer le slot dans le registre JS
> créerait une deuxième source de vérité pour la même propriété (interdit par `CLAUDE.md` §1.4) —
> risque concret : une nouvelle ligne catalogue reçoit un `mod_slot` en base mais personne ne met à
> jour le registre (ou l'inverse), et les deux déclarations divergent silencieusement. Le registre
> ne fait que router `mod_key → handler` ; l'exclusivité à l'installation reste uniquement du
> ressort de `modingService.installMod` (déjà livré, hors périmètre de cette refonte).
>
> **Correctif — mapping Lunette, aligné sur le précédent PF2e (donnée sur l'item, pas liste d'ID en
> JS).** La Lunette a 10 `ref_equipment.id` distincts (migration 142, `bonus` = 1 à 10 par ligne) mais
> un seul comportement. Nouvelle colonne `ref_equipment.mod_key TEXT nullable` (migration parallèle à
> 141, même style), valeur `'lunette'` sur les 10 lignes — une seule entrée registre `key: 'lunette'`
> les couvre toutes. `modLevel` dans le contexte du hook est simplement la colonne `bonus` de la
> ligne installée (déjà fetchée dans `installedMods`, aucune requête supplémentaire). Ajouter demain
> un 11ᵉ item au même comportement ne touche qu'une donnée catalogue (`mod_key`), jamais
> `weaponModRegistry.js`.
2.2 Les quatre hooks
Hook	Appelé dans	Signature	Retourne
onDeclare	socketCombatAnnouncement.js (Phase 1 Déclaration)	(modState, context) => { iniCostDelta, bonusComp } — synchrone, Lunette n'implique aucun dé	Coût en Initiative + bonus stocké sur `combat_actions` — remplace `getAimIniCost`/`getAimBonusComp` pour la Lunette
onTurnStart	startResolutionPhase	async (modState, context) => { updatedState, tokenEffects } — asynchrone (ATI appelle context.rollDice)	Nouvel état + effets token_statuses
onBeforeAttack	resolveAssaultAction, resolveMeleeAction	async (modState, context) => { blocked, reason, adjustedModifiers } — asynchrone (Mémoire/Projecteur appellent context.rollDice)	Interruption + modificateurs ajustés
onCalculateModifiers	resolveAssaultAction, resolveMeleeAction	(modState, context) => { bonusAttaque, bonusDefense, breakdowns } — synchrone pour optiqueBonus/lunette (aucun dé) ; async pour un futur handler qui en aurait besoin	Bonus/malus + détail

> **Correctif — signatures corrigées, "fonctions pures" restreint aux handlers sans dé.** `parseDice`
> (`server/src/lib/diceParser.js:22`) est `async`. `resolveModHooks` doit `await` chaque appel de
> handler indistinctement (un mélange sync/async silencieux serait fragile) ; seuls `optiqueBonus` et
> `lunette` (Groupe 1/2, aucun Test) sont réellement des fonctions pures au sens strict — les qualifier
> ainsi pour ATI/Mémoire/Projecteur (qui appellent `context.rollDice`) serait inexact.

> **Correctif — hook `onDeclare` ajouté, remplace la scission Déclaration/Résolution du premier
> passage.** Vérifié : `getAimIniCost`/`getAimBonusComp` (`socketCombatAnnouncement.js:423,473`)
> calculent le coût INI et le bonus stocké de la Lunette en **Phase 1 Déclaration**, avant que
> `confirmedModifiers`/`portee` n'existent (Phase 2 Résolution, cf. `docs/PLAN_MODING_PHASEB.md`
> Groupe 2). Plutôt que de laisser ce calcul en dehors du registre indéfiniment (solution du premier
> passage, honnête mais pas la plus robuste), un hook `onDeclare` dédié — même principe que le champ
> `phase` de PF2e (`applyAEs`/`beforeDerived`/`afterDerived`/`beforeRoll`, des moments différents du
> pipeline gérés par le même système de règles) — unifie réellement l'architecture : la Lunette
> devient un seul handler avec deux hooks (`onDeclare` pour le coût INI, `onCalculateModifiers` pour
> le clamp par portée), au lieu d'un handler neuf + une fonction legacy vivant en parallèle pour
> toujours.
2.3 Contexte standard
typescript

> **Correctif (implémentation, Phase 4) — `modLevel` mal conçu comme champ global du contexte
> partagé.** Repéré en préparant les handlers ATI/Mémoire/Projecteur : si `resolveModHooks` traite
> plusieurs mods actifs simultanément (slots orthogonaux, ex. Lunette + ATI sur la même arme),
> `modLevel` doit être la valeur `bonus` DU mod en cours d'évaluation, jamais une valeur unique
> partagée par tous — sinon faux pour tous les mods sauf un. Corrigé dans `weaponModService.js` :
> chaque résolveur (`onDeclare`/`onTurnStart`/`onBeforeAttack`/`onCalculateModifiers`) construit
> `modContext(mod, context)` = `{ ...context, modLevel: mod.bonus }` juste avant d'appeler le handler
> de CE mod — un seul endroit, comme pour `rollDice`. `getAllCombatMods` (Phase 3) étendu pour
> sélectionner `re.bonus`, qui manquait à l'origine.

interface ModHookContext {
  tokenId: string; characterId: string; campaignId: string; currentTurn: number;
  targetCharacterId?: string; isMelee: boolean; isAimedShot: boolean; portee?: string;
  modLevel: number;  // propriété DU MOD (ref_equipment.bonus), injectée par mod — jamais un champ global
  rollDice: (formula: string) => Promise<{ total: number, rolls: number[], seed: number }>; // async, basé sur parseDice (server/src/lib/diceParser.js:22)
}

2.4 Service de résolution (server/src/services/weaponModService.js)

    Point d'entrée unique : resolveModHooks(mods, hookName, context).

    Parcourt les mods triés par priority croissante (§2.1), appelle les handlers du registre, agrège les résultats.

    Interrompt immédiatement si blocked: true — aucun handler suivant n'est appelé, les adjustedModifiers déjà accumulés sont ignorés (l'attaque est bloquée, pas partiellement modifiée).

> **Correctif — chaînage du contexte et ordre non précisés dans le plan initial, alignés sur le
> précédent PF2e (`priority` explicite, cf. §2.1).** Pour `onCalculateModifiers`, chaque handler ne
> voit que son propre `modState` (isolation déjà actée en §2.5) — les bonus/malus retournés sont donc
> additionnés indépendamment (`bonusAttaque`/`bonusDefense` sommés, `breakdowns` concaténés), pas de
> chaînage de contexte nécessaire, seul l'ordre d'affichage des `breakdowns` dépend de `priority`.
> Pour `onBeforeAttack`, en revanche, un `adjustedModifiers` retourné par un mod (ex. Projecteur de
> mouvement réduisant un malus) doit être visible par le mod suivant dans l'ordre de `priority` avant
> que celui-ci ne décide `blocked` — sinon deux mods actifs simultanément (slots `optique`+`logiciel`
> orthogonaux, donc cumulables) donneraient un résultat qui dépend d'un ordre non spécifié. Un ordre
> dérivé de "quand le joueur a installé l'item" (proposition initiale) aurait été fragile — réinstaller
> le même item plus tard change silencieusement le résultat, alors qu'un `priority` fixe par type de
> mod est stable et prévisible. `resolveModHooks` doit donc *réduire* (fold) le contexte au fil des
> handlers triés par `priority` pour ce hook précis, pas les appeler tous avec le contexte original.

2.5 Décisions intégrées (corrigées au 2e passage, §2.1/§2.4)

    key : chaque mod installé est identifié par ref_equipment.mod_key (donnée catalogue, migration 1.6). Le registre mappe mod_key → handler — jamais equipment_id → handler, pour que plusieurs lignes catalogue (les 10 niveaux de Lunette) partagent un seul handler sans liste d'ID en dur.

    Ordre d'exécution : priority explicite par handler (§2.1), jamais l'ordre du tableau installedMods — un ordre dérivé de l'historique d'installation serait instable dès qu'un item est réinstallé.

    Isolation : un handler ne reçoit que son propre modState. Aucun accès à l'état d'un autre mod.

3. Cycle de vie
text

[Installation] → [Chaque tour] → [Résolution] → [Fin de combat]
     │                │               │               │
     │          onTurnStart    onBeforeAttack      COMBAT_END
     │                │        onCalculateModifiers   │
     │                │               │               │
     ▼                ▼               ▼               ▼
char_inventory_mods  token_statuses   calcul seuil    reset state
  .state = {...}     (effets tour)    (bonus/malus)   .state = null

4. Plan de migration

    Créer les handlers pour les mods existants (Groupes 1 et 2) et futurs (Groupe 4).

    Modifier resolveAssaultAction et resolveMeleeAction pour remplacer les appels directs par resolveModHooks.

    Tests de non-régression avec les scénarios documentés.

    Déprécier les anciennes fonctions après validation.
-------
Plan d’implantation détaillé — Refonte du système de mods d’armes

Document de travail. Chaque étape est atomique et testable. L’ordre proposé minimise les régressions et maximise la vérifiabilité.
Phase 1 — Socle technique (nouveaux fichiers, aucune modification des résolveurs)

Objectif : Mettre en place le registre, les handlers purs, et le service de résolution, sans encore les brancher.
Étape	Action	Fichiers	Invariant
1.1	Créer shared/weaponModRegistry.js avec le tableau WEAPON_MOD_REGISTRY vide.	shared/weaponModRegistry.js	Fichier prêt, importable, sans effet.
1.2	(retiré — voir correctif ci-dessous)

> **Correctif (implémentation) — étape 1.2 retirée.** Créer 5 fichiers `shared/mods/*.js` vides
> maintenant serait du code mort : `optiqueBonus.js`/`lunette.js` appartiennent à la Phase 2
> (différée, Strangler Fig), `ati.js`/`memoire.js`/`projecteur.js` à la Phase 4 (pas encore
> commencée). Chaque handler est créé directement par la phase qui lui donne un vrai contenu
> (4.1.1/4.2.1/4.3.1 pour Groupe 4 ; 2.2 pour Groupe 1/2, le jour où cette phase est lancée).
1.3	Créer server/src/services/weaponModService.js avec resolveModHooks(mods, hookName, context) qui parcourt les mods et appelle les handlers du registre.	server/src/services/weaponModService.js	Fonction opérationnelle mais inutilisée. Tests unitaires possibles sur des données mockées.
1.4	Ajouter la colonne state (JSONB) à char_inventory_mods via une migration.	Migration Knex	Colonne nullable, pas de valeur par défaut, rétrocompatible.
1.5	Mettre à jour fetchAssaultWeaponAndMods (ou équivalent) pour inclure la colonne state dans les mods fetchés.	socketCombatHelpers.js	Les mods portent désormais un champ state (actuellement null). Aucun impact fonctionnel.
1.6	Ajouter la colonne `mod_key` (TEXT nullable) à `ref_equipment`, même migration style que 141 (`mod_slot`/`mod_requires_aim`) — colonne seule, pas de population ici. Chaque phase consommatrice peuple ses propres valeurs à son tour (4.1.1/4.2.1/4.3.1 pour Groupe 4 ; 2.1 pour Groupe 1/2, quand cette phase différée sera lancée).	Migration Knex	Colonne nullable, rétrocompatible, aucune ligne (NULL partout) ne change de comportement.

> **Correctif (implémentation) — étape 1.7 retirée.** Câbler `resolveModHooks(..., 'onDeclare', ...)`
> avec un registre encore vide aurait contredit l'objectif même de la Phase 1 ("sans encore les
> brancher") et câblé du code mort. Ce câblage reste dans 2.2b (Phase 2, différée) où il a un
> handler réel (`lunette`) à appeler.
Phase 2 — Migration des mods existants (Groupes 1 et 2) vers le registre

Objectif : Remplacer les appels directs (calcWeaponModBonus, getLunetteNiveau, etc.) par l’appel au service de résolution, sans changer le comportement.
Étape	Action	Fichiers	Invariant
2.1	Peupler WEAPON_MOD_REGISTRY avec les entrées pour les bonus optiques (Cyclope, Implant, etc.) et la Lunette (10 niveaux). Chaque entrée référence le handler pur correspondant.	shared/weaponModRegistry.js	Le registre est complet pour les mods déjà en jeu.
2.2	Implémenter les handlers optiqueBonusOnCalculateModifiers et lunetteOnCalculateModifiers en reproduisant exactement la logique de calcWeaponModBonus et getLunetteNiveau/getEffectiveAimBonus. Les handlers reçoivent modState (inutilisé ici) et le contexte.	shared/mods/optiqueBonus.js, shared/mods/lunette.js	Comportement identique aux fonctions actuelles. Tests unitaires copiés/adaptés.
2.2b	Dans socketCombatAnnouncement.js (Phase 1 Déclaration, lignes 423/473), remplacer l'appel direct à getAimIniCost/getAimBonusComp par resolveModHooks(installedMods, 'onDeclare', context). Le handler `lunette` reproduit exactement leur logique actuelle (mêmes formules, même signature de résultat côté appelant).	socketCombatAnnouncement.js	Coût INI et bonus stocké identiques à aujourd'hui pour tout scénario avec/sans Lunette.
2.3	Dans resolveAssaultAction, remplacer l’appel à calcWeaponModBonus et getLunetteNiveau/getEffectiveAimBonus (Phase 2 Résolution, `socketCombatHelpers.js:2500-2502`) par un appel unique à resolveModHooks(installedMods, 'onCalculateModifiers', context). Le résultat est injecté dans totalModComp.	socketCombatHelpers.js	Le seuil de tir reste identique. Tous les scénarios de test Phase B passent.
2.4	Supprimer calcWeaponModBonus, getLunetteNiveau, getEffectiveAimBonus, getAimIniCost, getAimBonusComp de leurs modules d'origine — désormais entièrement couverts par les handlers `optiqueBonus`/`lunette` du registre (hooks `onDeclare` + `onCalculateModifiers`).	modingService.js, combatExclusiveActions.js	Aucune référence restante dans le code. Un seul chemin (le registre) pour la Lunette, plus de scission Déclaration/Résolution en deux systèmes.

> **Correctif (2e passage) — la scission proposée au 1er passage ("Déclaration hors périmètre, reste
> sur l'ancien code") est remplacée ici par une unification réelle via le hook `onDeclare` (§2.2).**
> Le 1er passage avait identifié le vrai problème (`getAimIniCost`/`getAimBonusComp` appelés en Phase
> 1, `socketCombatAnnouncement.js:423,473`, hors du flux de Résolution) mais proposait de laisser ces
> fonctions de côté indéfiniment — ce qui aurait laissé deux systèmes vivre en parallèle en
> permanence (un legacy pour la Déclaration, un registre neuf pour la Résolution), exactement le
> "second moteur" que `CLAUDE.md` §13 signale comme un risque même documenté. L'étape 2.2b ci-dessus
> migre aussi la Déclaration dans le même registre, via le hook dédié — l'architecture reste unifiée
> au lieu d'être scindée. Contrepartie assumée : cette étape ajoute du périmètre à la Phase 2 (un
> point d'insertion de plus, dans un 3ᵉ fichier) — accepté explicitement ici puisque Saar a confirmé
> que la quantité de travail n'est pas une contrainte face à la robustesse.
2.5	Vérifier que resolveMeleeAction n’utilise pas ces fonctions (actuellement il n’utilise pas de mods à distance). Si un jour il le fait, le même appel resolveModHooks pourra être ajouté.	socketCombatHelpers.js	Pas de régression sur le CaC.
Phase 3 — Infrastructure pour les mods à état (Groupe 4) ✅ CODÉE (Session 167)

Objectif : Préparer le terrain pour les mods qui ont besoin d’un tick de début de tour et d’un état persistant.
Étape	Action	Fichiers	Invariant
3.1	getAllCombatMods(campaignId) : pour un combat donné, tous les char_inventory_mods de chaque personnage en lice (toute arme, pas seulement celle d'une action précise), avec leur state.	weaponModService.js	Retourne [{ tokenId, mods: [{ id, mod_key, state }] }].
3.2	Dans startResolutionPhase, juste après buildTimelineEntries, appeler resolveModHooks(mods, 'onTurnStart', context) pour chaque token, persister updatedState (update char_inventory_mods.state par id) et tokenEffects (statusService.applyModStatus par effet).	socketCombatHelpers.js	Les mods avec état peuvent évoluer à chaque tour. Registre vide (Phase 4 pas câblée) → boucle sans effet observable aujourd'hui.
3.3	resolveModHooks injecte rollDice: parseDice dans le contexte, un seul endroit — aucun appelant n'a à y penser.	weaponModService.js	Les handlers onTurnStart/onBeforeAttack (Phase 4) l'utiliseront pour leurs Tests "avec le niveau de l'appareil".
3.4	COMBAT_END : remise à NULL de char_inventory_mods.state pour tous les mods des personnages du roster ; suppression des token_statuses dont le status_code est déclaré par un mod (getAllModStatusCodes(), jamais une liste en dur).	socketCombatState.js	Pas de fuite d'état ni de badge entre deux combats. Registre vide → modStatusCodes toujours [], nettoyage state inconditionnel mais sans effet tant qu'aucun mod n'écrit dedans.
3.5	(retiré — non-problème, voir correctif ci-dessous)

> **Contrats fixés en codant, à respecter par Phase 4 (pas à re-deviner) :**
> - `tokenEffects` (retour de `onTurnStart`) : tableau de `{ statusCode, expiresAtTurn? }` — un par
>   badge à poser, consommé un par un via `statusService.applyModStatus(io, db, campaignId, tokenId,
>   effect.statusCode, { expiresAtTurn })`.
> - Entrée de registre : `{ key, priority, hooks, statusCodes? }` — `statusCodes` (optionnel) liste
>   les codes que ce mod peut poser (ex. `['ati_offensive', 'ati_defensive']`), lue par
>   `getAllModStatusCodes()` pour le nettoyage `COMBAT_END`. Un mod qui pose un badge sans déclarer
>   son code ici fuira au prochain combat — à ne jamais oublier au moment de peupler l'entrée `ati`.
> - `statusService.applyModStatus`/`clearModStatus` (nouveau, même fichier que
>   `applyStunWithDuration`) : upsert par `ON CONFLICT (token_id, status_code)` (contrainte UNIQUE
>   déjà en base, migration 68) — pas de delete+insert manuel, pas d'exclusion mutuelle entre codes
>   de mods différents (contrairement au Stun).

> **Correctif (implémentation) — finding "state orphelin au swap" du 3ᵉ passage invalidé par
> lecture de `modingService.js:112-133`.** Le swap d'exclusivité de slot ne "désinstalle" pas au
> sens d'un changement de statut sur la même ligne : il `DELETE` purement et simplement la ligne
> `char_inventory_mods` de l'ancien occupant (`.del()`, ligne 130) et crée une ligne `char_inventory`
> séparée (table différente, sans colonne `state`) pour l'objet physique revenu en inventaire
> (`returnModToInventory`). La ligne entière disparaît, `state` avec — aucun état fantôme possible,
> aucune action supplémentaire à coder. Ce finding aurait dû être vérifié contre ce fichier avant
> d'être proposé ; corrigé ici plutôt que silencieusement laissé dans le plan.
Phase 4 — Implémentation des mods du Groupe 4 — mécaniques ✅ CODÉES, intégration live ⚠️ PARTIELLE (Session 167)

Objectif : Implémenter l’ATI, la Mémoire de cibles et le Projecteur de mouvement en utilisant les hooks.
4.1 Analyseur Tactique Individuel
Étape	Action
4.1.1	✅ Registre peuplé (`shared/weaponModRegistry.js` : `key: 'ati'`, hooks `onTurnStart`/`onCalculateModifiers`, `statusCodes: ['ati_offensive', 'ati_defensive']`) ; migration 184 pose `ref_equipment.mod_key='ati'` sur "Analyseur tactique individuel : A.T.I Alpha" (slot `logiciel` déjà porté par `mod_slot`, migration 141 — pas redéclaré ici).
4.1.2	✅ `atiOnTurnStart` (`shared/mods/ati.js`) codé et testé (7 scénarios) : Test `rollDice('1d20')` vs `modLevel` (RAW confirmé, pas une compétence) ; cumul de marge jusqu'à 20 (activation) puis +1/Test réussi plafonné à +4 ; mono-cible (changement de cible = reset). **[HYPOTHÈSE non tranchée par le RAW, à confirmer par Saar]** : le Test qui franchit le seuil de 20 active le dispositif mais ne compte pas lui-même comme le premier +1 — seul le Test suivant en donne un. **[HORS PÉRIMÈTRE]** "vérifie si la cible est en combat" (RAW) non implémenté : sans cible configurée le handler est un no-op total, condition strictement plus restrictive donc jamais un faux positif — sans conséquence tant que 4.1.4 n'est pas résolu.
4.1.3	✅ `atiOnCalculateModifiers` codé et testé (4 scénarios) : bonusAttaque/bonusDefense selon mode, scoping strict à `targetCharacterId` ("une seule cible à la fois").
4.1.4	❌ **Toujours ouvert — décision produit requise, pas technique.** Aucune interface ne permet au joueur de choisir mode/cible. Tant que ce n'est pas résolu, l'ATI reste fonctionnellement inatteignable en jeu même une fois câblé dans `resolveAssaultAction`.
4.2 Mémoire de cibles
Étape	Action
4.2.1	✅ Registre peuplé (`key: 'memoire'`, hook `onBeforeAttack`) ; migration 184 pose `mod_key='memoire'` sur "Mémoire de cibles Mémo" (pas le Bloc afficheur de données, compagnon non-exclusif — PHASEB).
4.2.2	✅ `memoireOnBeforeAttack` (`shared/mods/memoire.js`) codé et testé (4 scénarios) : Test `rollDice('1d20')` vs `modLevel`, réussite = reconnaissance = blocage, échec = tir normal (RAW EQ_00002). **[HORS PÉRIMÈTRE, même nature que 4.1.4]** : aucune interface pour enregistrer des cibles (`modState.memoire.registeredTargetIds`, RAW "24 cibles différentes") — décision produit distincte, pas technique.
4.2.3	✅ Déjà couvert par le moteur générique de Phase 1 (`resolveOnBeforeAttack` dans `weaponModService.js` gère `blocked` pour tout mod utilisant ce hook, Mémoire compris) — aucun code spécifique supplémentaire nécessaire.
4.3 Projecteur de mouvement
Étape	Action
4.3.1	✅ Registre peuplé (`key: 'projecteur'`, hook `onBeforeAttack`) ; migration 184 pose `mod_key='projecteur'`.
4.3.2	✅ `projecteurOnBeforeAttack` (`shared/mods/projecteur.js`) codé et testé (7 scénarios) : zigzag réduit `modLevel` de moitié avant le Test (RAW EQ_00005, règle absente des deux plans précédents) ; échec = tir raté ; réussite = réduction du malus de mouvement plafonnée à sa magnitude (jamais de bonus résiduel). **[HORS PÉRIMÈTRE — intégration non câblée]** : `context.targetIsMoving`/`targetMovementIsErratic`/`targetMovementMalus` ne sont pas encore fournis par `resolveAssaultAction` — dériver l'allure déclarée de la cible ce tour n'a pas été vérifié contre le code réel, à faire dans une prochaine session avant de câbler l'appel réel.
4.3.3	✅ Déjà couvert par le moteur générique de Phase 1 (chaînage `adjustedModifiers` dans `resolveOnBeforeAttack`) — aucun code spécifique supplémentaire nécessaire.

> **Bilan Phase 4 (Session 167)** : les 3 mécaniques sont codées et testées en isolation (18 tests
> unitaires sur les handlers purs + 4 tests d'intégration sur le registre réel dans
> `weaponModService.test.mjs`), fidèles au texte RAW retrouvé au 3ᵉ passage d'analyse à charge.
> **Non câblé volontairement** dans `resolveAssaultAction`/`resolveMeleeAction` : les résultats
> restent inatteignables en jeu réel tant que (1) une décision produit tranche comment le joueur
> configure cible/mode (ATI) et cibles enregistrées (Mémoire) — items 4.1.4/4.2.2, ouverts à Saar,
> pas un choix technique unilatéral ; (2) la source exacte de `targetIsMoving`/`targetMovementMalus`
> pour le Projecteur est vérifiée contre le code réel de `resolveAssaultAction` — pas encore fait,
> pas d'hypothèse non vérifiée injectée dans un chemin de résolution de combat live. Câbler l'appel
> `resolveModHooks` dans `resolveAssaultAction` reste une étape mécanique courte une fois ces deux
> points tranchés/vérifiés — délibérément pas fait à l'aveugle dans cette session.

> **Correctif — "Système réactif autonome" absent de cette Phase 4, tranché explicitement.**
> `docs/PLAN_MODING_PHASEB.md` Groupe 4 recense 4 mécaniques du slot `logiciel`, pas 3 : cette Phase 4
> ne détaille que ATI/Mémoire/Projecteur. Ce n'est pas un oubli — PHASEB notait déjà que le Système
> réactif autonome (arme tirant seule selon conditions programmées) "nécessiterait probablement une
> automatisation complète du tour, hors échelle d'un mod". Décision explicite ici : il reste **hors
> périmètre du système de hooks**, à traiter comme un chantier combat séparé (IA de tir autonome), pas
> comme un mod au sens de ce document. À ajouter à `docs/ROADMAP.md` s'il ne l'est pas déjà.
Phase 5 — Tests, nettoyage et documentation
Étape	Action
5.1	Tests unitaires pour chaque handler pur (ATI, Mémoire, Projecteur) avec des contextes simulés.
5.2	Tests d’intégration : scénarios de combat réels avec chaque mod, en vérifiant le seuil, les blocages, la progression de l’ATI.
5.3	Tests de non-régression complets sur les mods Groupes 1 et 2 (scénarios documentés dans PLAN_MODING_PHASEB.md).
5.4	Mise à jour de docs/ASBUILT.md, docs/SYSTEME/COMBAT.md et éventuellement docs/PLAN_MODING_PHASEB.md pour refléter la nouvelle architecture.

Ce plan est modulaire : chaque phase peut être livrée et testée indépendamment. La migration des existants (Phase 2) est le premier jalon critique pour valider le cadre sans introduire de nouveau comportement.

> **Correctif — ordre d'exécution tranché : Strangler Fig Pattern (Fowler / Microsoft Azure
> Architecture Center), pas d'arbitrage laissé ouvert.** Groupe 1/2 sont **déjà codés, testés (21
> scénarios), confirmés fonctionnels par Saar en navigateur** (`docs/PLAN_MODING_PHASEB.md`) — c'est
> exactement le cas d'usage documenté du Strangler Fig : "au lieu de démolir un système et de le
> reconstruire de zéro, on fait grandir le nouveau système à côté de l'ancien jusqu'à ce que l'ancien
> ne soit plus nécessaire", en migrant "pièce par pièce" pour que chaque étape reste isolément
> réversible. Réécrire Groupe 1/2 en premier (ordre initial du document) revient à l'inverse — un
> "big bang" partiel sur du code qui fonctionne, avant même d'avoir prouvé que l'abstraction tient sur
> un cas réel.
>
> **Ordre d'exécution retenu** : Phase 1 (socle, y compris 1.6/1.7) → Phase 3 (infrastructure état) →
> Phase 4 (Groupe 4 — code entièrement neuf, aucune régression possible sur l'existant, seul terrain
> où l'abstraction hooks/registre est réellement nécessaire aujourd'hui) → Phase 5 partielle
> (validation Groupe 4 seul). **Phase 2 (migration Groupe 1/2 vers le registre, y compris 2.2b) est
> reportée** : elle n'apporte aucun comportement nouveau et ne se justifie que si Groupe 4 démontre
> que le registre tient en conditions réelles. Une fois Phase 4 validée et confirmée par Saar en
> navigateur, Phase 2 devient un chantier séparément déclenchable — jamais un prérequis bloquant au
> reste de ce plan. Groupe 1/2 restent sur leur code actuel, stable et testé, tant que Phase 2 n'est
> pas explicitement lancée.
>
> Source : [Strangler Fig Pattern — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig).