# EN COURS — Dettes actives et prochaine étape

> **Discipline obligatoire (tout agent)** : ce fichier ne contient QUE ce qui est réellement actif — dettes ouvertes, chantier en cours, points de vigilance permanents. Aucun historique de session ne s'accumule ici, jamais.
>
> À la clôture d'un chantier (✅ confirmé, ou ⚠️ clos partiel devenu confirmé sans reste à tester) :
> 1. Retirer sa ligne/son bloc de ce fichier (Dettes actives / Prochaine étape / Roadmap).
> 2. Écrire le compte-rendu détaillé (contexte, décisions, fichiers touchés, **Testé / Non testé /
>    Données / Retour arrière**) dans `docs/JOURNAL8.md`, format `## Session N (Dev) — Date — Titre`.
> 3. Ne laisser ici que ce qui reste vraiment ouvert — un `⚠️ clos partiel` (code fait, navigateur non testé) reste une ligne active tant que Saar ne l'a pas confirmé en jeu.
> 4. Le détail technique d'un bug reste dans `docs/BUGIDENTIFIE.md` (autorité unique) — ne pas le dupliquer ici au-delà d'une ligne de suivi (ID, description courte, priorité).
>
> Cette règle existe parce que ce fichier a grossi jusqu'à 386 Ko / 4083 lignes avant nettoyage
---

## CHANTIER PARALLÈLE — MOTEUR DE MONDE

Branche `codex/world-engine-integration`, sans modification du dépôt de l'autre développeur.

- Phases 0 à 14 terminées : contrat métrique, document canonique, compilateur, navigation serveur,
  LOS/couverture, structures verticales, régions/effets runtime, cabine d'ascenseur mobile et
  branchement spatial complet du combat, tranches d'étage isolées avec profondeur visible dans les
  seuls volumes multniveau, murs courbes physiques, empreintes exclusives de salles non
  rectangulaires, fusion de volumes à hauteurs différentes et profils verticaux de murs.
- `surface_data` v12 porte tranches verticales, arcs et apparences intérieures canoniques. Salle,
  mur et objet sélectionnés utilisent des panneaux contextuels déplaçables ; les réglages longs sont
  repliables et la barre latérale d'édition ne conserve que les outils réellement actifs.
- Un profil de mur couvre la hauteur totale de la salle. Une passerelle liée par `clipRoomId` est
  intersectée avec la même empreinte intérieure au rendu, dans le snapshot et dans la navigation.
- `entities.state.transform.scale` est partagé par le rendu, l'occupation et la LOS ; une mutation
  d'apparence ne peut pas désynchroniser le volume physique.
- Les anciennes cartes voxel ne sont pas une cible de compatibilité. Elles peuvent seulement servir
  de fixtures et peuvent être supprimées si elles gênent le modèle canonique.
- L'ascenseur est une cabine physique mobile : aucune arête verticale ou téléportation ne doit être
  réintroduite. Ses passagers sont attachés à son repère local durable.
- Le combat déclare désormais une destination ; le serveur dérive l'allure, replanifie sous verrou
  et applique l'arrêt réel. Portées, contact, interactions, LOS et couverture sont mesurés dans le
  monde 3D canonique.
- Les autorités voxel/Redis/pathfinder historiques ont été supprimées. Aucune rétrocompatibilité
  des cartes anciennes n'est exigée.
- Prochaine étape : validation fonctionnelle Playwright et manuelle sur une carte canonique
  multi-étages, puis revue d'intégration avec la prochaine tête du projet combat.

Référence obligatoire : `docs/SYSTEME/MOTEUR_MONDE.md`.

---

## ⚡ PROCHAINE ÉTAPE EXACTE

**TEST_CRITIQUE Lot 3** (tooltips degré + popup Réussite critique/Catastrophe) ✅ codé
(2026-08-04), **non testé en navigateur** — détail `docs/Old/PLAN_TEST_CRITIQUE.md` §11 (archivé,
Règle 10 — contenu durable transféré dans `docs/SYSTEME/COMBAT.md` §"Résolution des Tests"). Prochaine
étape : validation par Saar (tooltip au survol des badges de résultat, popup en combat et via macro).

---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- Dernière migration appliquée : **232** (`232_chat_messages.js`) — détail complet et historique
  des migrations : `docs/ASBUILT.md` § Base de données

---

## Dettes actives

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| **CLICKATTACK-MOVECONFLICT1** | Clic sur token adverse déclenche un déplacement au lieu d'une attaque. Signalé Saar 2026-08-04, non analysé. Hérite aussi le résiduel drone d'ALLURE-TURNGATE1 (clos, `docs/BUGIDENTIFIE.md`) — même fichier `useDroneDeclare.js` | À investiguer |
| **SIDEBAR-CDL-CONTRAST1** | Récapitulatif des Déclarations illisible dans la Sidebar (texte bleu foncé sur fond bleu marine) — Saar demande d'en profiter pour séparer le module. Signalé 2026-08-04, non analysé | À investiguer |
| **COM26** | 2 munitions catalogue (`Darts 7.62mm ST - Projectile SAP`, `Flèche - Projectile IEM`) portent le DSL Assommante par erreur de copié-collé — `description` et `ammo_effects` incohérents. Trouvé en corrigeant Lot B (migration 160) `docs/PLAN_ARMES_DSL.md` | Basse — à refaire lors de C1/C2 |
| **ASCENSEUR1** | World builder : fenêtre de propriétés d'un ascenseur s'ouvre puis se ferme aussitôt (spécifique ascenseur, pas porte/échelle). Suspendu — non reproductible au moment du signalement suivant, détail `docs/BUGIDENTIFIE.md` | En attente d'une nouvelle occurrence |
| **HORLOGE1** | Horloge de campagne (`GameTimeWidget`, Sidebar.jsx) codée pour être masquée en mode Combat et Édition (`Sidebar.jsx`, gate sur `mode`) | En attente de validation en jeu par Saar |
| **HORLOGE-TEST1** | `adjustGameTime` (Lot 1, `gameTimeService.js`) sans aucun test automatisé — seule la projection pure `shared/gameTime.js` est testée, trouvé en analyse à charge avant le Lot 2, détail `docs/BUGIDENTIFIE.md` | À faire avant/pendant le Lot 2 |
| EQSKILLS1 | `ref_equipment_skills` ("compétences boostées/requises") jamais consommée en jeu — seulement écrite/relue par l'API admin `routes/equipment.js`, aucun calcul ne la lit. 1 item (TMP II) a une entrée visiblement erronée (`ANALYSE_EMPATHIQUE`). Fusion avec `ref_equipment_skill_assoc` possible mais non prioritaire | Basse |
| CH1 | Historique chat perdu au F5 (rechargement page) — Phase 1 (`docs/PLANS/PLAN_CHAT.md`) ✅ clos et confirmé 2026-08-04 : module `server/src/chat/` codé et testé (33 tests), rien branché dans l'existant. Reste Phases 2 (double-écriture) à 4 (bascule client + nettoyage) | Chantier dédié — Phase 1 close, Phase 2 non commencée |
| COM27 | CaC multi-attaque : jet de défense semble se lancer avant le jet d'attaque (signalé Saar, non instrumenté) | À investiguer |
| FEAT4 | Aura de portée CaC (3m + allonge arme) autour du personnage actif | Basse — sprint futur |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| **CSPLAYERSTAB** | `CampaignSettingsPage.jsx` — avertissement React (mélange `background`/`backgroundColor` entre `s.navItem`/`s.navItemActive`) sur les onglets de réglages campagne — préexistant, repéré en testant `docs/PLAN_VAULT.md` Lot 4 (onglet "Joueurs"). Cosmétique, aucun impact fonctionnel | Très basse |
| **EAU1** | Nappe d'eau ambiante `computeSurfaceWaterCells`/`WaterSheets` retirée (improvisation client hors autorité serveur, décision Saar 2026-07-29) — eau en jeu recentrée sur l'effet runtime "inondation" déjà câblé (compartiments + `runtimeEffectRegions`). Codé, tests/build/lint OK | Basse — validation en jeu par Saar avant clôture |
| **DEPLACEMENT3** | Latence résiduelle ~0,5-1s au premier "Déplacement" après un déplacement validé — confirme la piste notée dans DEPLACEMENT1 (`runtime_revision` bump sur simple déplacement de token invalide aussi le cache structurel) | Très basse — "rien de gênant" (Saar) |
| **TOURTRANSITION1** | Latence + message "En attente de {{nom}}" en chaînant plusieurs actions de PNJ (`CombatActionWindow.jsx:772-782`) — non instrumenté | Très basse — "rien de gênant" (Saar) |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **MUT3** | Effets mécaniques des mutations et avantages — Lots 1-6 (attributs, résistances, armure/arme naturelle, déblocage de compétences, identité sex/is_fertile/hand_pref) ✅ clos et fonctionnels. Reste Lot 7 (Narratif/économie, priorité basse) — `docs/Old/PLAN_MUTATION2.md` (archivé, chantier clos) | Lot 7 à détailler quand Saar voudra enchaîner |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| **UI2** | Alignement dés | Basse — Cluster Q |
| **UI3** | Dé 100 : affichage chat | Basse — Cluster Q |
| **WIZ-2** | Deux compteurs PC (header store vs CareersAllocator local) | Basse — cosmétique |
| **WIZ-3** | Formation "apprentissage_technique" → choix de spécialité non implémenté | Moyenne — COUCHE 4c |
| **CAR1** | Mécanisme "au choix" (`conditional:true`) non implémenté — 34 occurrences lots 2-6 | Moyenne — Step4 UI |
| **CAR2** | `ref_background_skills.skill_id` sans FK vers `ref_skills.id` (même défaut que `ref_career_skills` avant migration 111) | Basse — pas de bug connu, préventif |
| **CAR3** | Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) non insérés dans `ref_career_prerequisites` | Moyenne — migration dédiée post lots 2-6 |
| **DBG-C1** | `character.user_id` null quand GM crée pour joueur absent (steps 1-3) | Moyenne — sprint futur |
| **OPT-W1** | 3/11 options de campagne (revers, skill_natural_prog, celebrity) sans effet mécanique branché — `ambiance` ✅ Session 132 suite, `random_mutations` ✅ Session 136, `feminin_bonus` ✅ Session 137, `random_pro_advantages`/`skill_prerequisites` ✅ Session 141, `skill_max_level` ✅ Session 141 (suite 2), `young_penalty` ✅ Session 141 (suite 4), `polaris_latent` ✅ Session 141 (suite 6) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |
| **MUT1** | `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable | Basse — à investiguer |
| **ADV3** | Bénéfices de carrière débloquant l'accès à une compétence (mutation/compétence "développée automatiquement" via tirage) — non géré, aucun câblage vers `char_skills`/`char_mutations` | Moyenne — roadmap Session 141 suite 12 |
| **WIZ4** | `Step4Experience.jsx` — le mini-stepper (`isClickable`) ne revalide jamais les blocages durs de la sous-step quittée (ex. retirer sa seule carrière puis cliquer directement sur une sous-step déjà "reachable"). Filet serveur (`reconcileCreation` STEP4) empêche toute donnée invalide persistée — juste un rejet tardif au lieu d'un blocage immédiat | Basse — architecture navigation mini-stepper |
| **WIZLOCK1** | 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé, avant le correctif d'atomicité Session 141 (suite 14) — `handleTerminate` faisait 2 appels réseau séparés (`reconcile` puis `lock`), toute coupure entre les deux laissait la fiche bloquée. Corrigé pour les finalisations futures ; dette documente seulement l'historique | Basse — historique, pas un risque actif |
| **DOC1** | `docs/VOCABULARY.md` était un squelette vide depuis sa création, jamais réellement adopté par le protocole. Peuplé Session 141 (suite 18) avec un premier seed réel — reste à enrichir au fil des sessions | Basse — enrichissement continu |
| **DOC2** | `docs/SYSTEME/REGLES_LdB.md` — dump brut d'extraction LdB, encodage mojibake par endroits, mal placé selon `RegleDocumentaire.md` Règle 8 (devrait être dans `REGLES/`), doublon probable avec `docs/REGLES/REGLESYSCOMBAT.md`. Bandeau d'avertissement ajouté ; vérification/déplacement à faire en session dédiée | Basse — session dédiée à planifier |
| **GEOM1** | `docs/PLAN_GEOMETRIE.md` (Rampe/Slope/Porte, Atelier du GM) jamais codé, obsolète depuis le nouveau builder (Kiwi) selon Saar — **question posée à Codex** : des fragments (recherche `THREE.ExtrudeGeometry`/`UVGenerator`, décisions d'architecture) sont-ils réutilisables avant archivage/suppression du plan ? Archiver vers `docs/Old/` ou supprimer dès réponse de Codex (Session 149) | En attente réponse Codex |
| ~~**INI4**~~ | ~~`initiative` jamais remise à `base_ini` en fin de tour~~ | ⚠️ clos partiel Session 166 (Saar), item 96 — codé, scénario réel navigateur non testé |
| ~~**INI5**~~ | ~~CaC : forfait Initiative de déclaration (-3/-5) doublon sans base RAW avec le décalage de phase~~ | ⚠️ clos partiel Session 176 (Saar), item 111 — audit tranché, retiré, scénario réel navigateur non testé |
| ~~**COM24**~~ | ~~Bonus "deux armes" (+3 CaC) déconnecté de l'arme réellement déclarée~~ | ⚠️ clos partiel Session 176 (Saar), item 112 — codé (mécanisme complet, miroir Tir), scénario réel navigateur non testé |
| **MELEE-INHAND** | Arme principale CaC jamais vérifiée "en main" à la résolution (contrairement à l'arme secondaire du dual-wield, COM24) — trouvé en codant COM24. Détail `BUGIDENTIFIE.md` | Basse — asymétrie consciente, pas un risque actif |
| ~~**MELEE-MR**~~ | ~~Dégâts CaC calculés sans le MR (dette Session 67)~~ | ⚠️ clos partiel Session 166 (Saar), item 97 — codé, scénario réel navigateur non testé |
| ~~**DEF5**~~ | ~~« Cible sans défense » (+5, pas d'opposition) absent en tir ET en CaC~~ | ⚠️ clos partiel Session 166 (Saar), item 98 — codé, scénario réel navigateur non testé ; tir de drone non couvert |
| ~~**SURPRISE1**~~ | ~~`is_surprised` jamais remis à `false` après `COMBAT_START`~~ | ⚠️ clos partiel Session 176 (Saar), item 110 — codé, scénario réel navigateur non testé |
| ~~**TIRIMP**~~ | ~~Garde serveur absent sur « Tir impossible »~~ | ⚠️ clos partiel Session 166 (Saar), item 99 — codé, scénario réel navigateur non testé |
| **COUVERTURE_TOTALE** | « Couverture totale » (tir) n'existe nulle part, ni client ni serveur — trouvé en clôturant TIRIMP. Détail `BUGIDENTIFIE.md` | Basse — à regrouper avec le futur chantier Tir en aveugle |
| ~~**WNDMORT**~~ | ~~Malus blessure « mortelle » codé -20 fixe au lieu de bloquer les Tests~~ | ⚠️ clos partiel Session 166 (Saar), item 100 — codé, scénario réel navigateur non testé |
| **WNDMORT-UI** | Fenêtre de déclaration sans repli visuel pour Blessure mortelle — le serveur rejette déjà, l'UI ne prévient pas avant. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : validé) : bandeau d'avertissement + tuiles grisées codés, scénario réel navigateur non testé |
| **WNDMORT-HORSCOMBAT** | Test générique hors-combat (`socketEntity.js`) non gardé pour Blessure mortelle. Détail `BUGIDENTIFIE.md` | ⚠️ clos partiel — Session (Saar, 2026-08-01, décision Saar : bandeau centré) : garde + bandeau centré codés, scénario réel navigateur non testé |
| **ETATSPERS-LOT2C** | `combat_roster.state_position`/`state_weapon` non retirées — `entry` (`socketCombatAnnouncement.js:139`, coût d'Initiative + validation Tir Visé) toujours lu directement depuis `combat_roster`, pas encore migré vers `characterStateService`. Détail `docs/SYSTEME/ETATS_PERSONNAGE.md` | Basse — différé volontairement (Codex/Kiwi hors projet, plus d'urgence fusion) ; clôture alignée sur `docs/PLANS/PLAN_RW_TOKEN.md` (Phase 7) quand ce chantier reprendra |

---

## Roadmap

- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n équipement/builder/dés** — Lot 1 (Combat) clos item 108, reste Lots 2-4, voir
  `docs/PLAN_LOCALISATION.md` (norme : `docs/SYSTEME/LOCALISATION.md`)

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PC45 — `combat_actions.type` (serveur, valeur brute) ≠ `action_key` (client, clé UI) — deux colonnes distinctes, valeurs identiques pour 'melee'. Confondre les deux → 0 résultat sur les queries
- PC46 — `meleePrecheckId` dans `CombatOverlay` : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION. `useEffect` doit inclure `[meleePrecheckId, socket]` — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `docs/SYSTEME/CORE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `docs/SYSTEME/CORE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `docs/SYSTEME/DICE.md`
