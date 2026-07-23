## Session 163 (Saar) — 2026-07-19 — Anomalie infra notée : `knex migrate:rollback` inopérant ⚠️ NON INVESTIGUÉ

**Contexte** : en validant le retour arrière de la migration `178_ammo_charge_electrique.js`
(`docs/PLAN_CAC_BATTERIE.md`), `knex migrate:rollback` (CLI) annonce un succès (« Batch rolled
back ») mais ne modifie ni la ligne `knex_migrations` correspondante ni les données — vérifié :
`migration_time` identique avant/après l'appel, aucune ligne `ref_equipment` revenue en arrière.

**Isolé `[VÉRIFIÉ]`** : le `down()` de la migration n'est pas en cause — appelé directement en
Node (import du fichier de migration, `migMod.down(db)`, en contournant la CLI), il s'exécute
correctement (20 lignes → 0, aucune exception). Le problème est donc dans le chemin rollback de
Knex lui-même sur ce projet, pas dans une migration précise.

**Piste non creusée** : `server/src/db/naturalMigrationSource.cjs` (chargeur de migrations custom
du projet, `NaturalMigrationSource`) — jamais vérifié spécifiquement côté rollback jusqu'ici.
`migrate:latest` fonctionne correctement avec ce même chargeur (vérifié à plusieurs reprises), donc
si la cause est bien là, elle est spécifique au chemin de lecture/exécution du rollback.

**Décision (Saar)** : ne pas investiguer maintenant — noter et enquêter seulement si le besoin de
rollback se reproduit en pratique.

**Contournement utilisé cette session** (fiable, vérifié deux fois) : suppression manuelle de la
ligne `knex_migrations` concernée puis `migrate:latest` normal, plutôt que `migrate:rollback`.

**Non testé** : cause racine réelle de l'anomalie CLI. **Retour arrière** : sans objet (rien codé,
constat uniquement).

---

## Session 166 (Saar) — 2026-07-19 — Cluster bugs combat (audit `COMPARATIF.md`) : INI4, MELEE-MR, DEF5, TIRIMP, WNDMORT ✅ codés, navigateur non testé

**Contexte** : reprise du triage `docs/BUGIDENTIFIE.md` pendant que le chantier Tir Multi attendait sa
validation navigateur (commité et clos entre-temps, session 165). Priorisation proposée par Saar :
purge des dettes fantômes/déjà résolues avant tout code (JSON1, KIWI2 — jamais mis à jour dans les
registres malgré résolution antérieure), puis le cluster combat confirmé par `docs/Old/COMPARATIF.md`,
un correctif isolé à la fois, chaque RAW exact revérifié dans `docs/REGLES/REGLESYSCOMBAT.md`/
`REGLEBLESSURES.md` avant de coder — plusieurs paraphrases de `BUGIDENTIFIE.md` se sont révélées
imprécises ou incomplètes à la relecture du texte source.

**Hygiène registre (avant tout code)** : `JSON1` (déjà résolu par le merge `caaf1af` "Fusion Kiwi",
jamais retiré du registre) et `KIWI2` (résolu, confirmé Saar) clos sans code. Corrections de
nomenclature `MANUELSYSCOMBAT.md` déjà faites (vérifié). `ST1` et `CH1` reclassés chantiers UI/UX
dédiés (`docs/ROADMAP.md`) plutôt que correctifs ponctuels, sur diagnostic affiné par Saar.

**INI4** — `initiative` jamais remise à `base_ini` en fin de tour. Une ligne ajoutée à l'`UPDATE
combat_roster` déjà existant dans `endTurn` (`socketCombatHelpers.js`), même requête que les 6 autres
champs déjà réinitialisés par tour.

**MELEE-MR** — dégâts CaC calculés sans le MR (dette Session 67). La table `mrTable`/`getModifier`
déjà utilisée côté tir portée aux 4 sites CaC réels (`confirmMeleeDefense` PNJ/PJ-attaquant,
`confirmDamage` branche melee, `resolveMeleeAction` défenseur PNJ/drone) — `socketCombatResolution.js`
ne contenait plus de duplicata depuis le Lot D `docs/Old/PLAN_COMBAT_TIMELINE.md`, cité à tort par la
dette d'origine (fichier réorganisé depuis).

**DEF5** — « Cible sans défense » (+5, pas d'opposition). RAW exact relu
(`REGLESYSCOMBAT.md:1052-1058`) : deux clauses (ne peut voir son assaillant / n'a pas conscience de
l'attaque). Scope tranché avec Saar après discussion (la clause "surprise" initialement écartée —
système d'embuscade jugé non géré — a été réintégrée : le Test de Réaction à `COMBAT_START` existe
déjà). Nouveau helper unique `isTargetDefenseless` (statuts `unconscious`/`blinded`/`stunned` +
`is_surprised` limité au Tour 1) consommé identiquement tir/CaC ; en CaC, généralise le pattern déjà
utilisé pour le défenseur drone à tout type de défenseur, corrigeant au passage un vrai trou (un PNJ
inconscient relançait un jet de défense actif). Dette annexe trouvée et loguée séparément :
`SURPRISE1` (`is_surprised` jamais remis à `false`).

**TIRIMP** — garde serveur absent sur "Tir impossible". Saar a directement questionné le sentinel
numérique `-99` (son propre historique de code) comme du bricolage — recherche faite (wiki Rule
Elements PF2e/Foundry) confirmant le pattern pro (predicate booléen toujours séparé du modificateur
numérique). Refonte : nouveau `shared/combatSituationMods.js`, autorité unique client
(`CombatModifiersWindow.jsx`) + serveur (`socketCombatHelpers.js`, table locale ne garde plus que les
clés CaC), plus aucun `-99` dans le projet. Garde ajouté à `resolveAssaultAction` **et**
`resolveDroneAssaultAction` (faille identique trouvée en migrant, hors scope initial mais corrigée).
Dette annexe : `COUVERTURE_TOTALE` (troisième condition RAW jamais câblée, ni client ni serveur,
regroupée avec le futur chantier "Tir en aveugle").

**WNDMORT** — Blessure mortelle codée comme malus `-20` au lieu de bloquer les Tests. Extrait RAW
initial tronqué (accident d'extraction PDF) — Saar a fourni le texte exact et une contre-proposition
(menu restreint à Déplacement Allure lente/Passer le tour, plutôt qu'un blocage brut) adoptée. Question
annexe de Saar sur un Test de Choc récurrent par action vérifiée dans le texte : ce pattern existe pour
la Fatigue (`REGLEBLESSURES.md:1377-1381`), pas les blessures physiques — chantier Fatigue ajouté à
`docs/ROADMAP.md`, non mélangé à WNDMORT. `WOUND_PENALTIES.mortelle` -20→0,
`isTestBlockingWound`/`isMortalWoundImmobilized` nouveaux. Garde de déclaration en miroir exact du stun
guard existant ; défense CaC via `isTargetDefenseless` étendu (pas de second mécanisme) ; défense en
profondeur dans les deux résolveurs (réutilise les données déjà fetchées). Dettes annexes :
`WNDMORT-UI` (pas de repli visuel client) et `WNDMORT-HORSCOMBAT` (`socketEntity.js` non gardé).

**Fichiers touchés** : `server/src/socket/socketCombatHelpers.js`, `socketCombatAnnouncement.js`,
`server/src/routes/character/char-sheet.js`, `client/src/components/CombatModifiersWindow.jsx`,
`client/src/character/CharacterSheet.jsx`, `client/src/locales/{fr,en}.json`, nouveaux
`shared/combatSituationMods.js` + `shared/woundConstants.js` (étendu) et leurs tests ;
`docs/BUGIDENTIFIE.md`/`EN_COURS.md` (items 96-100)/`ROADMAP.md` mis à jour au fur et à mesure, pas en
fin de session.

**Testé** : `node --check` sur tous les fichiers serveur touchés, build Vite client propre (×2), 64
tests `shared/*.test.mjs` rejoués dont 15 nouveaux (`combatSituationMods`, `woundConstants`) — 0
régression. **Non testé** : aucune connexion PostgreSQL disponible depuis cet environnement — chaque
scénario réel (Précipiter/Dégainer répétés, CaC dans les 4 combinaisons PJ/PNJ/drone, statuts
inconscient/aveuglé/étourdi/surpris, tir à Allure maximale/obscurité totale, déclaration avec Blessure
mortelle) reste à valider par Saar en navigateur avant de considérer le cluster réellement clos.
**Données** : aucune migration sur l'ensemble du cluster. **Retour arrière** : rien committé avant
cette session — un `git diff`/`git checkout` suffirait ; après commit, un `git revert` isolé par
correctif reste possible si un test navigateur invalide l'un des cinq indépendamment des autres.
