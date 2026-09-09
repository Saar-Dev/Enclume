# PLAN_GRENADES.md — Grenades et capsules à explosion (Segment 3 du chantier armes de zone)

> Rédigé 2026-09-06 (Claude/Saar) · révisé 2026-09-08 (§3d-3 marqueur 3D ; §3f mode Percussion recadré + analyse à charge, §6/§10.4). Sorti de `PLAN_ARMES_SPECIALES.md` §2 (devenu trop gros — un
> chantier multi-segments mérite son document, RegleDocumentaire Règle 1). **Autorité : Livre de Base
> Polaris > ce PLAN.** Tout écart RAW = décision écrite dans `docs/JOURNAL8.md` (invariant AGENTS.md #5).
>
> **Débloqué par** : le pipeline AOE (`PLAN_AOE.md`) — socle + registre de mécanismes (Segment 1.5)
> + tireur exo/drone — tous clos et validés (`PLAN_ARMES_SPECIALES.md` §6).
>
> **Rapports :**
> - `docs/REGLES/REGLES_ARMES_SPECIALES.md` — RAW (règles de combat « Grenades et mines » + section
>   « Grenades — catalogue »). Ce PLAN ne recopie pas le RAW.
> - `docs/PLANS/PLAN_NUAGE.md` — fumigènes + gaz (nuage volumétrique) : **hors périmètre de ce PLAN**.
> - `docs/PLANS/PLAN_ARMES_SPECIALES.md` §2.6 — grenade à neuro-charge (Segment 4, mécanique de
>   debuff de zone, différée).

---

## 1. RAW — où le lire

| Sujet | Emplacement |
|---|---|
| Règles de combat (amorçage, Test de Coordination, dispersion 1D6 sur échec, explosion au Tour suivant, dégression par palier, protections/couverture) | `REGLES_ARMES_SPECIALES.md` § « Grenades et mines » |
| Catalogue (tableau, descriptions par type, options percussion/drone, capsules, lanceurs) | `REGLES_ARMES_SPECIALES.md` § « Grenades — catalogue » |

**Dégression standard (rappel, exprimée en rayon depuis le point d'explosion)** — le RAW parle de
*diamètre de la zone d'effet* ; lecture retenue : une cible à distance `r` du point d'impact est dans
le palier de diamètre `2r`. **[HYPOTHÈSE — seule lecture cohérente ; écart candidat `JOURNAL8.md`]**

| Palier | Rayon | Modif. dégâts (**+ Choc**) | Localisations | Test de Chance |
|---|---|---|---|---|
| Centre | ≤ 1 m | +1D10 | 1D3 | — |
| Courte | 1 – 2,5 m | +0 | 1 | — |
| Moyenne | 2,5 – 5 m | −1D10 | 1 | — |
| Longue | 5 – 10 m | −2D10 | 1 | oui |
| Extrême | 10 – 15 m | −3D10 | 1 | oui (+5) |
| — | > 15 m | rien (RAW : « Rien d'autre n'est affecté ») | — | — |

---

## 2. Audit catalogue — 2026-09-06 [VÉRIFIÉ base locale + RAW Saar]

23 lignes `category IN ('Grenade','Capsules')` (hors faux positifs « lu**mine**uses » / Détecteur de
mines). Aucune ne porte de forme structurée — la zone est en texte libre dans `description`.

| Régime | Lignes | Amplitude |
|---|---|---|
| **Dégression standard** | grenade à fragmentation **(Segment 3)** · grenade à concussion, grenade sonique **(Segment 3-bis** — un concern nouveau chacun, §3/§6**)** | rayon max 15 m ; table de paliers = constante de code |
| **Rayon fixe, effet uniforme** | grenade assommante (Ø 5 → r 2,5), grenade incendiaire (Ø 5 → r 2,5), grenade à énergie (Ø 5 → r 2,5), grenade étourdissante (Ø 20 → r 10) ; capsule napalm (Ø 3 → r 1,5), capsule explosive (r 2), capsule acide (r 1,5 — écart RAW, §3) | par ligne |
| **Nuage volumétrique** → `PLAN_NUAGE.md` | grenade fumigène + 6 grenades gaz + capsule fumigène + 6 capsules gaz | hors ce plan |
| **Debuff de zone** → `PLAN_ARMES_SPECIALES.md` §2.6 (Segment 4) | grenade à neuro-charge | — |

Effets spéciaux au-delà des dégâts bruts (à traiter en `postResolve` du mécanisme concerné, comme le
feu continu du lance-flammes) :

- **concussion** : échec au Test de résistance au Choc → durée d'étourdissement **doublée** ; sous
  l'eau, portée doublée.
- **incendiaire / capsule napalm** : feu (1 Tour / 10 Tours) → `exposeToHazard({ durationDice })`,
  déjà écrit pour le lance-flammes.
- **capsule acide** : DoT 1D10/Tour × 2D6 Tours, matières organiques seulement.
- **assommante** : Choc 2D10 (sphères de caoutchouc), dégâts 1D6.
- **étourdissante** : **aucun dé de dégât** — applique le statut « étourdi » 1D6 Tours ; Test de
  Réaction d'anticipation (yeux fermés + oreilles bouchées → sans effet).

---

## 3. Décisions tranchées (jugement délégué par Saar, 2026-09-06)

1. **La famille grenade = plusieurs mécanismes de registre, pas un `grenade_blast` fourre-tout.**
   Le registre AOE (Segment 1.5) est « un `mechanic` ↔ une stratégie de résolution » (patron Foundry) —
   `shotgun_spread` et `flamethrower` sont séparés bien qu'ils soient tous deux des cônes. De même :
   `grenade_frag` (dégression, éclats) est le **premier** mécanisme ; `grenade_incendiary`,
   `grenade_flashbang`, `grenade_stun`, `grenade_energy`, `capsule_explosive`, `capsule_acide`
   s'ajoutent ensuite comme des entrées de registre réutilisant le même pipeline (exactement comme le
   lance-flammes après le fusil à pompe).

   **Segment 3 = grenade à fragmentation SEULE** (analyse à charge de 3a, 2026-09-06). C'est la seule
   charge utile à **zéro effet spécial** : pas de Choc (`Choc: -` au catalogue), pas de feu, pas de
   statut. Elle valide toute l'infra risquée (viser un point, dispersion, explosion différée, cercle,
   dégression) contre le payload minimal. **concussion** (extension de durée d'étourdissement sur échec
   du Test de Choc → question `statusService`) et **sonique** (§3 pt 3) rejoignent le **Segment 3-bis**,
   un concern nouveau chacun.

2. **Options de détonation** : RAW « toutes les grenades peuvent être dotées de l'une des options »
   → **universel, rien à seed par ligne** ; l'option est un choix au moment du lancer.
   **Correction RAW (analyse à charge 2026-09-08)** : le RAW ne nomme que **percussion** et **drone**.
   Le comportement par défaut (sans option) n'a pas de nom RAW — appelé ici `minuterie` (explosion au
   Tour+1 au rang d'Initiative du lanceur, déjà codé en 3d). Enum retenu, autorité unique
   `shared/combatAoe.js` (client + serveur) : `aoe.detonation ∈ { 'minuterie' (défaut), 'percussion',
   'drone' }`. Champ frère de `aoe.mode` / `aoe.intendedOrigin`, pas de collision.
   - **minuterie + percussion en v1.** Pas de `programmerExplosion` (croquis initial abandonné, cf.
     §10.3/§10.4) : le lancer est extrait en `resolveGrenadeThrow` (Test de Coordination + dispersion
     + retrait inventaire + snapshot, partagé) ; `resolveAoeAssaultAction` branche ensuite —
     `minuterie` planifie l'entrée `combat_timeline_entries` T+1, `percussion` **poursuit dans le bloc
     explosion existant** (Tour T, même appel). Un seul « lancer », deux suites. Détail §10.4.
   - **drone différé.** Projectile-entité autonome (détection, homing, 10 min, Tours propres, NT V,
     ×10 coût) — dépend d'un sous-système « entité autonome en combat » non construit (dette
     `COUVERTURE_RAW.md` §2). `aoe.detonation = 'drone'` accepté **structurellement** par l'enum,
     rejeté à la résolution avec message clair (patron `AOE_MECHANICS`).

3. **Grenade sonique = dégression standard, mais Segment 3-bis** (pas Segment 3). Le RAW ne donne
   aucune zone ; c'est une onde de choc anti-personnel avec dés de dégâts (5D10) **+ Choc (1D10)** —
   or c'est la **seule** grenade du régime dégression à porter un Choc, et la dégression RAW s'applique
   aussi au Choc (« La réduction… concerne aussi les Dommages de Choc »). Le tronc ne sait pas dégresser
   un Choc aujourd'hui → sous-problème réel, résolu une fois en 3-bis. Écart RAW (dégression appliquée)
   → `JOURNAL8.md`.

4. **Capsule acide = cercle rayon 1,5 m** (Ø 3 m, calé sur la capsule napalm — l'autre « capsule de
   liquide qui couvre une zone »). Le RAW ne donne aucun Ø. Écart RAW → `JOURNAL8.md`.

5. **Migration catalogue APRÈS le moteur, une seule fois par segment.** On ne seed pas un `aoe_profile`
   qui pointe vers un mécanisme absent du registre. Segment 3 : mécanisme `grenade_frag` (3a) →
   migration de **la seule ligne fragmentation** (3g). Segment 3-bis : chaque mécanisme apporte sa/ses
   ligne(s). Pas de nouvelle colonne — `aoe_profile` JSONB existant.

**Hors périmètre de ce PLAN :** mines (système entité-piège, `PLAN_ARMES_SPECIALES.md` §2.4) ;
lancer une grenade **au lance-grenades / lance-capsules** (Test de tir `ARMES_LOURDES` au lieu du Test
de Coordination — variante de livraison) ; grenade drone (DRO) ; nuages (`PLAN_NUAGE.md`) ;
neuro-charge (Segment 4).

---

## 4. Ce qui existe et sera réutilisé, jamais dupliqué [VÉRIFIÉ 2026-09-06]

| Brique | Où | Réutilisation |
|---|---|---|
| Registre de mécanismes AOE | `server/src/lib/aoeMechanisms/registry.js` + `shared/combatAoe.js#AOE_MECHANICS` | `grenade_frag` = une entrée. Le tronc ne connaît aucun mécanisme par son nom. |
| Géométrie `circle` | `shared/world/aoeShapes.js#isPointInAoeShape` (shape `circle` : `distanceWorld <= amplitudeWorld`) | `amplitudeM` = rayon. Aucune ligne à écrire. |
| Dispersion 1D6 sur échec | `shared/world/aoeShapes.js#resolveScatter` (`{throwerPosition, intendedOrigin, failureMarginM, d6Roll}` → point dévié ; `failureMarginM<=0` → point inchangé) | **Écrite, jamais câblée.** Câblage = 3d. |
| Primitive de palier par distance | `shared/world/distanceBands.js` (`normalizeDistanceBands` / `resolveDistanceBand`) | **Écrite, jamais consommée** — `grenade_frag` est son 1ᵉʳ client. |
| Table de paliers RAW figée | patron `shared/combatRange.js#SHOTGUN_SPREAD_BY_BAND` (objet gelé `{ widthM, damageDice, savePossible, saveBonus }`) | Miroir : `GRENADE_FRAG_BANDS` gelé `{ maxDistanceM, damageDice, locations, chanceTest, chanceBonus }`. |
| Dé signé de dégression | `shotgunSpread.js#rollSignedDie('-2D10')` | **Extrait vers `server/src/lib/diceParser.js`** en 3a (utilitaire de dé, pas de la logique fusil à pompe ; déjà importé par les 2 mécanismes) ; `shotgunSpread.js` bascule dessus — move pur. |
| Dégât brut | `server/src/lib/combatAttackRoll.js#computeAssaultRawDamage({ rawDice, mr, portee, fireModeBonusDmg })` | **`mr` non pertinent pour une grenade** (§5) → `computeTargetDamage` grenade n'appelle PAS cette fonction : `degautsBruts = baseRaw + rollSignedDie(band)`. |
| Application par cible + finalisation | `socketCombatAoe.js#resolveAoeTargetDamage` / `finalizeAoeResults` | **Déjà génériques** (dispatch drone/exo/humanoïde, `outcome`, émissions ; 1D3 Loc au centre = `locationsCount: 3` déjà supporté). **Extraits de `socketCombatAoe.js` vers un module partagé en 3e** — ils servent le nouvel orchestrateur grenade sans passer par `resolveAoeAssaultAction`. |
| Feu continu | `environmentalHazardService.js#exposeToHazard({ durationDice })` | `grenade_incendiary` (Segment 3-bis). |
| LOS + couverture | `worldVisibilityService.js#evaluateAoeVisibility` | Inchangé. `target.visibility.coverage` **existe** par cible mais ni le fusil à pompe ni le lance-flammes ne consomment la couverture *partielle* (LOS binaire ; couverture *totale* = déjà gérée par LOS bloquée). Couverture partielle RAW (−1 à −2D10) = amélioration transverse AOE, **hors Segment 3**, écart noté. |
| Résolution différée inter-tours | **`combat_timeline_entries`** (`turn_number`, `phase_position`, `status:'scheduled'`, `combat_action_id`, `resolution_snapshot`) + `pickNextTimelineStep` + `advanceTimeline` + dispatch `action.type` (`socketCombatResolution.js:383+`) | **Tranché (exploration 2026-09-06) : infra EXISTANTE.** L'explosion = ligne `combat_timeline_entries` pour T+1 @ `phase_position` du lanceur → `combat_action` synthétique `type:'grenade_explosion'`. Explose au rang d'Ini du lanceur même s'il meurt (l'entrée est indépendante de son état). Pas de minuteur, pas de nouvelle table. |

---

## 5. Divergences structurelles grenade vs fusil à pompe / lance-flammes — [VÉRIFIÉ code 2026-09-06]

Le tronc `socketCombatAoe.js` a été écrit pour un modèle **mono-phase** : un Test de tir (Phase A,
compétence de l'arme) dont la marge `mr` module le dégât, puis résolution immédiate. La grenade rompt
**quatre** hypothèses de ce modèle :

1. **Deux phases inter-tours.** RAW : Tour 1 = amorcer + lancer (Test de Coordination). Tour 2 =
   explosion, au rang d'Initiative normal du lanceur. Le tronc n'a aucune infra d'action différée
   inter-tours (vérifié : grep serveur, zéro). → **3e**, avec sa propre analyse à charge (touche la
   FSM combat, code humain le plus testé).

2. **Le « jet » du lancer est un Test de Coordination (attribut), pas la compétence de l'arme.**
   `runAoePhaseA` lit `ref_equipment_skill_assoc` → Seuil de compétence. Une grenade se lance sur un
   Test de **Coordination** (RAW littéral). `[INCONNU]` : honorer littéralement l'attribut COO, ou
   utiliser la compétence `ARMES_DE_JET` (COO/PER, marker −3) ? → à trancher en **3d**.

3. **La marge du jet ne module PAS les dégâts.** Pour le fusil à pompe / lance-flammes, RAW « le
   modificateur d'échec réduit les dommages ». Pour la grenade, l'échec du Test de Coordination
   **déplace le point d'impact** (dispersion), il ne réduit rien. Les dégâts dépendent uniquement de
   la distance cible↔impact (dégression). → `grenade_frag.computeTargetDamage` ignore `mr`.

4. **Le lanceur vise un POINT, pas une direction.** Fusil à pompe / lance-flammes : `aoe.direction`.
   Grenade : `aoe.intendedOrigin` (un point au sol dans la portée de lancer). Nouveau champ de
   payload + nouvel aperçu (cercle centré sur un point). → **3c**.

**Conséquence de cadrage** : `grenade_frag` (3a) ne modélise **que l'explosion** — origine donnée,
profil de zone → dégâts par cible. Il ne fait ni le lancer, ni le Test de Coordination, ni la
dispersion, ni le différé. Ces quatre points sont 3c/3d/3e, chacun avec sa propre étape.

**Conséquence d'architecture — RÉVISÉE après lecture du moteur de timeline (2026-09-06, exploration
avant 3b).** Deux constats changent le plan :

1. **L'infra de résolution différée inter-tours EXISTE déjà.** `combat_timeline_entries`
   (`turn_number`, `phase_position`, `status: 'scheduled'`, `combat_action_id`, `resolution_snapshot`)
   + `pickNextTimelineStep(campaignId, turnNumber)` (prend l'entrée `scheduled` de `phase_position`
   la plus haute) + `advanceTimeline` (point d'entrée unique « fais avancer la résolution ») +
   dispatch par `action.type` dans `socketCombatResolution.js:383+`. → **L'explosion différée (3e) =
   « insérer, à la résolution du lancer (T1), une ligne `combat_timeline_entries` pour T+1 au
   `phase_position` du lanceur, pointant vers un `combat_action` synthétique `type:
   'grenade_explosion'` ».** Pas de nouveau moteur, pas de minuteur, pas de nouvelle table.

2. **`resolveAoeAssaultAction` peut rester l'orchestrateur unique**, via des **capacités déclarées
   par le mécanisme** (défaut = comportement actuel), pas un `if (mechanic === ...)` :
   `needsWeaponRange` (défaut `true`), `rollsPhaseA` (défaut `true`), `decrementsAmmo` (défaut
   `true`), `losSource` (défaut `'caster'` — déjà porté par `grenade_frag`). `grenade_frag` les
   met toutes à `false`/`'origin'`. Même précédent que le lance-flammes (« un petit bloc » assumé) —
   et si ça prolifère, l'extraction en helpers partagés se fait plus tard, jugement identique au
   Segment 1.5. **L'extraction n'est PAS un prérequis** (l'analyse à charge de 3a la supposait ; la
   lecture du dispatch montre qu'un `combat_action` synthétique emprunte naturellement le même
   chemin).

3. **`resolveAoeAssaultAction` n'a AUCUN test d'orchestration** (`socketCombatAoe.test.mjs` ne couvre
   que les fonctions pures `filter*` / `resolveAoeAttackRoll`). Le filet doit être **proportionné au
   risque de chaque étape** :
   - **3b** (capacités de flux) : changement **behavior-preserving par construction** — chaque garde
     est `mech.X ?? <défaut historique>`, aucun appelant existant ne déclare `X`. Le risque est « le
     câblage de la garde », pas « une dérive silencieuse » → filet = revue + `node --check` + tests
     purs verts + **session Saar** (qu'il fait de toute façon pour toute modif AOE). Fait `92df5ed`.
   - **3d / 3e** (nouveau flux : lancer + timeline + explosion différée) : c'est LÀ que le risque
     justifie une **couverture d'intégration** (`socketCombatAoe.integration.test.mjs`, fixture monde
     compilé + combat, patron `combatantContextService.test.mjs` `skip = !DATABASE_URL`) — elle
     pinne le nouveau chemin grenade **et** exerce fusil à pompe / lance-flammes par le tronc partagé.
     Construite en préalable de 3d.

---

## 6. Découpage

### Segment 3 — grenade à **fragmentation SEULE**, lancée à la main, MIN + PER

| | Contenu | Nature | Filet |
|---|---|---|---|
| **3a** ✅ CLOS (`6a4e6ad`+`1815df3`+`e94c51e`) | `rollSignedDie`→`diceParser.js` · `grenadeFrag.js` (6 hooks invariants + `GRENADE_FRAG_BANDS` + `losSource: 'origin'`) + `registry.js` + `AOE_MECHANICS` + 3 fichiers de test. Inatteignable par l'appli. | résolution pure | ✅ 17 tests fixtures |
| **3b** ✅ CLOS (2026-09-06, `92df5ed`) | Capacités de flux lues par `resolveAoeAssaultAction` avec défaut = comportement historique : `needsWeaponRange` / `decrementsAmmo` / `losSource`. `grenade_frag` déclare les 3 (false/false/'origin'). `rollsPhaseA` (Test de Coordination) reporté à 3d. Fusil à pompe / lance-flammes inchangés *par construction* (`?? défaut`). | tronc | guards à défaut + `node --test` 63/509 ; validé jeu réel 2026-09-08 (grenade 3d) |
| **3c/1** ✅ CODÉ (`50ee8cc`) | Payload `COMBAT_ACTION_DECLARE` : la validation AOE branche sur `aoe_profile.shape` — `circle` → `aoe.intendedOrigin` (`{x,y,z}` finis) ; cône/rayon → `aoe.direction`, inchangé. Serveur valide la forme du point seulement (portée/dispersion = 3d). Behavior-preserving, inerte (aucune arme `shape:circle` avant migration). | serveur | `node --check`, branche `else if` identique |
| **3c/2a** ✅ CODÉ (`9cc8c81`) | `aoePreviewShape.js` : `buildCircleSpan(radiusM)` + `projectCircleFan(span, center, steps)` — frères de `buildConeSpan`/`projectConeTriangles`, mais **centrés sur le point d'impact** (pas le tireur). Aperçu = disque d'effet seul (dégression résolue serveur). Pur, 15 tests, lint OK. | client pur | ✅ tests + lint |
| **3c/2b-1** ✅ (`187c767`) | `buildDeclarePayload.js` : `buildAoeField` → `{ intendedOrigin }` \| `{ direction }` \| null ; 3 builders basculent dessus. Golden master 79/79, chemin direction byte-identique. | client pur | ✅ tests + lint |
| **3c/2b-2** ✅ (`03b91a7`) | `useCombatUIState.js` : `handleEnterAoeTargetMode` détecte `shape==='circle'` → `aimMode:'point'` (`pendingPoint`/`onPointSelected`/`onPendingPoint`). `handleValidateAoeDirection`→`handleValidateAoeAim` (dispatch). `CombatOverlay.jsx` : panneau branche sur `aimMode`. `combat.json` : + clés point. Chemin direction inchangé. Build OK. | client (état + panneau) | build + lint |
| **3c/2b-3** ✅ (`59ca32d`) | `Canvas3D.jsx` : `useFrame` fige le POINT survolé (`aoePreviewPoint`, coords monde) ; clic → `onPendingPoint` ; aperçu = disque (`projectCircleFan`, `radiusM`) **centré sur le point d'impact**. Bloc direction gardé `aimMode!=='point'`, inchangé. Build OK, 0 erreur lint nouvelle. | client (interaction 3D) | build + lint |
| **3c/2b-4a** ✅ (`b40c0eb`) | Serveur : `grenadeFrag.buildShape` lit `aoe_profile.radiusM` (autorité unique) ; garde `aoe.intendedOrigin && !aoe.resolvedOrigin` → message « Segment 3d » clair. | serveur | node --test 57/57 |
| **3c/2b-4b/c/d** ✅ (`1fa002c` `eae69dc` `3714806`) | Fenêtres arment le mode point + stockent `aoeIntendedOrigin` : exo · drone (2 hôtes) · humanoïde (reducer `assaultDeclaration` + action `SET_AOE_POINT`). Exclusivité 3 modes, reset slot, libellé « Viser un point ». 129 tests client, build OK, 0 erreur lint nouvelle. | client UI | tests + build |
| **3c/2b-5** ✅ (`1fa36d6`) | **Migration 325** `aoe_profile` `{shape:'circle', mechanic:'grenade_frag', radiusM:15}` sur la SEULE ligne « Grenade à fragmentation ». Appliquée par nodemon, vérifiée en base. | migration | node --check |
| **3d-0** ✅ (`15c0ec7`) | `resolveHumanoidTestContext` : option `attributeId` (Test d'ATTRIBUT, Seuil = attribut net + malus). RAW « Test de Coordination » = attribut, pas Compétence. Générique. | contexte de Test | 41 tests |
| **3d-1** ✅ (`4eef102`) | **Lancer** (garde `aoe.intendedOrigin && !aoe.resolvedOrigin`) : humanoïde ; Test de Coordination sur **COO** (`resolveAoeAttackRoll`) ; `resolveScatter(marginM = -mr, d6)` → point d'impact ; `jsonb_set` `resolvedOrigin` + `weaponSnapshot` ; `turn_number` action bumpé T+1 ; entrée `resolve_on_turn = T+1` @ `base_ini×100 + 1`, `resolution_snapshot.autoResolve` ; grenade retirée de `char_inventory`. Notice `session.grenadeArmed`. Écart RAW : pas de malus « zone visée » (`JOURNAL8`). | résolution | node --check + import ; **validé jeu réel 2026-09-08** |
| **3d-2** ✅ (`2c7cf57`) | Capacité `rollsPhaseA` (défaut `true`, `grenade_frag` = `false`). **Résolution autonome** : patron registre (`combatTurnEngine.js` `registerAutonomousStepResolver` ← injecté par `socketCombatResolution.js`) — `advanceTimeline` détecte `autoResolve`, résout **sans clic**. `finalizeAoeResults` tolère `rollResult` absent. `flushEmissions` garde null sur `to:'socket'`. PJ : `COMBAT_ATTACK_PLAYER_RESULT` filtré (écart, `JOURNAL8`) + notice `grenadeExploded`. Extensible : mines/pièges. | dispatch + moteur | 17 tests (+`autoResolve`) ; **validé jeu réel 2026-09-08** |
| **3d-3** ✅ | **Marqueur 3D de grenade armée.** Events `COMBAT_GRENADE_ARMED { entryId, tokenId, resolvedOrigin, explodesOnTurn, scattered }` / `COMBAT_GRENADE_EXPLODED { entryId }` (`shared/events.js`). Serveur : lancer `.insert(...).returning('id')` → `emissions.push` ARMED ; `resolveAutonomousStep` émet EXPLODED **en tête** (avant les `return` anticipés + l'appel qui peut lever) ; reconnexion (`socket/index.js`) ré-émet ARMED pour `status:'scheduled' AND resolve_on_turn >= current_turn AND autoResolve`. Client : `combatStore.grenadeMarkers` (dédup entryId, purge `resetCombat` + `onStateSync`), `useCombatSocket` handlers, `Canvas3D` rend `/models/grenade.glb` (bbox normalisée → `GRENADE_MARKER_SIZE_U`) + triangle ⚠ `<Billboard>` + anneaux de dégression (composant `GrenadeBlastRings` partagé avec l'aperçu §10.2). Murs : déjà gérés (`losSource:'origin'`). | events + serveur ×3 + client ×3 + `grenade.glb` | `node --check` ×4 ; 17 tests moteur ; lint (0 nouvelle) + build ; **validé jeu réel 2026-09-08** |
| **3d-4** | **Animation de jet** (client pur, différé). Token → `resolvedOrigin` en 1..X arcs strictement décroissants, départ `scale:0`. Repli reconnexion = marqueur statique 3d-3. Timing calé sur `COMBAT_GRENADE_ARMED`. | client | session |
| **3f — mode Percussion (PER)** | **Recadré 2026-09-08 (analyse à charge, §10.4).** L'estimation « 1 branche » était fausse : aucun choix de détonation n'existe dans le code (grep : zéro). Vrai livrable = **extraction du seam de lancer `resolveGrenadeThrow` + enum d'intention déclarée de bout en bout**. La branche percussion elle-même est triviale ; l'extraction est le point (chaque type de 3-bis + le futur `drone` la réutilisent). ~10 fichiers, 2 fenêtres, i18n, golden master. Sous-étapes ci-dessous, un fichier / pause (feedback_segment_by_file). | | |
| 3f/1 | `shared/combatAoe.js` (+ `.test.mjs`) : `GRENADE_DETONATION_MODES` gelé + `GRENADE_DETONATION_DEFAULT` (`'minuterie'`) + `normalizeGrenadeDetonation(raw)` (inconnu → défaut). Autorité unique de l'enum, client + serveur. | shared pur | `node --test` |
| 3f/2 | `socketCombatAnnouncement.js` : dans la branche `isPointAoe` (~l.671-683), `aoe.detonation = normalizeGrenadeDetonation(aoe.detonation)` **avant** persistance (l.698). Chemin `direction` (fusil à pompe / lance-flammes) non touché. *(Option forte — whitelist explicite de l'objet `modifiers.aoe` persisté — notée en dette séparée avec `weaponHasRangedAttackPath` §10.1, hors 3f.)* | serveur | `node --check` |
| 3f/3 | `socketCombatAoe.js` : **extraction behavior-preserving** de `resolveGrenadeThrow(io, campaignId, { action, aoe, character, weapon, shooterToken, worldMetrics })` — absorbe l.496-560 (Test de Coordination + garde blessure mortelle + `resolveAoeAttackRoll` + `maybeTriggerCatastrophe` + `resolveScatter` + `weaponSnapshot` + **mutation mémoire `aoe.resolvedOrigin`/`aoe.weaponSnapshot`** + `jsonb_set` frères préservés + retrait `char_inventory`) ; retourne `{ blocked?, diceEmission, resolvedOrigin, weaponSnapshot, scattered, d6Roll, failureMarginM }` (patron `runAoePhaseA` : émission retournée, pas poussée). `minuterie` reste le **seul** chemin — bump `turn_number+1` + insert `combat_timeline_entries` + notice `grenadeArmed` + marqueur `COMBAT_GRENADE_ARMED` restent dans `resolveAoeAssaultAction`. | serveur (le tronc bouge) | `node --check` + **session non-régression** : grenade minuterie + fusil à pompe + lance-flammes |
| 3f/4 | `socketCombatAoe.js` : `switch (normalizeGrenadeDetonation(aoe.detonation))` après `resolveGrenadeThrow` — `minuterie` → planification existante ; `percussion` → notice `session.grenadeThrownPercussion`, **pas de `return`**, fall-through vers le bloc explosion (l.578+, Tour T) ; `drone` → `COMBAT_DECLARE_ERROR` clair, `return`. **+ aggradation** : le catch du tronc (l.735) retourne `emissions` (l'accumulé) + pousse un `COMBAT_DECLARE_ERROR` au lieu de `emissions: []` — bénéficie aussi au fusil à pompe / lance-flammes (aujourd'hui : exception en cours de résolution AOE = silence total, jet déjà lancé perdu). | serveur | `node --check` + session réelle (percussion multi-cibles à paliers différents) |
| 3f/5 | `client/src/lib/assaultDeclaration.js` (+ `.test.mjs`) : `aoeDetonation: 'minuterie'` à l'init ; case `SET_AOE_DETONATION` ; **reset dans `SELECT_WEAPON` + `CLEAR`** ; modifieur indépendant (pas touché par `SET_AOE_POINT`/`SET_AOE_DIRECTION` — ce n'est pas une exclusivité de visée). | client pur | `node --test` + eslint |
| 3f/6 | `client/src/lib/useAssaultDeclaration.js` : `setAoeDetonation` + exposition (pas de miroir `stateRef` — champ hors ciblage/exclusivité). | client | eslint |
| 3f/7 | `client/src/locales/combat.json` **puis** `AssaultRangedPanel.jsx` : clés i18n d'abord (`assaultPanel.detonation*`) ; segmenté `.btn-toggle` Minuterie \| Percussion (défaut Minuterie) + tooltips, **uniquement** dans la sous-branche `isAoeEligible` + `getAoeProfile(weaponAoeProfile)?.shape === 'circle'`. Invisible pour cône/rayon. | client UI | eslint + build |
| 3f/8 | `CombatActionWindow.jsx` **ET** `CombatGmDeclareWindow.jsx` (les deux utilisent `AssaultRangedPanel` + le même `assaultDecl`) : passer `aoeDetonation` / `onAoeDetonationChange` au panneau + ajouter `aoeDetonation` aux **deux** sites de sélection payload (`CombatActionWindow.jsx:771`, `CombatGmDeclareWindow.jsx:647`). Un PNJ qui lance une percussion est un cas MJ légitime. | client (2 fenêtres) | eslint + build |
| 3f/9 | `client/src/lib/buildDeclarePayload.js` (+ `.test.mjs`) : `buildAoeField`/`buildAttackEntries` prennent `aoeDetonation` ; chemin `intendedOrigin` → `{ intendedOrigin, detonation }`, **`detonation` TOUJOURS présent** (défaut `GRENADE_DETONATION_DEFAULT` importé de `shared/combatAoe.js` si `aoeDetonation` absent — cas exo/drone dont les builders ne le passent pas). Décision (2026-09-08, délégation Saar) : le serveur lit `aoe.detonation` **inconditionnellement** (3f/2 + 3f/4) → un champ toujours consommé est toujours présent ; l'asymétrie « parfois là » est la source de bug à éviter. Golden master des cas grenade existants gagne `detonation: 'minuterie'` (le diff documente le changement de forme, règle d'en-tête du fichier). Chemin `direction` **byte-identique**. | client pur | `node --test` |
| 3f/9-bis (visuel percussion) | **Marqueur 3D éphémère.** Architecture A (délégation Saar 2026-09-09) : la résolution serveur percussion reste **synchrone/immédiate** (RAW « au contact »), acté. Le marqueur (`grenade.glb` + ⚠ + anneaux de dégression, à `resolvedOrigin`) n'est que présentationnel : montre où la grenade a atterri, **concomitant** à l'explosion (jet + dégâts + marqueur en même temps) — pas un délai avant explosion. `socketCombatAoe.js` branche percussion : pousse `COMBAT_GRENADE_ARMED { entryId: action.id, resolvedOrigin, scattered, explodesOnTurn: null, ephemeral: true }` avant le fall-through. `shared/events.js` : `ephemeral?` documenté. **Durée d'affichage = jusqu'à la fin du Tour** (choix Saar 2026-09-09, écarté un timer 5 s « trop court » et un clic « fragile — 3 déclencheurs selon type de client PJ/MJ/spectateur ») : `combatStore.clearEphemeralGrenadeMarkers` (filtre `!g.ephemeral`), appelé dans `useCombatSocket.onPhaseChanged` sur `phase === 'ANNOUNCEMENT'`. Déterministe, identique tous clients, aucun timer. **Minuterie inchangé** (`ephemeral` absent → survit T→T+1, persiste jusqu'à `COMBAT_GRENADE_EXPLODED`). Pas de ré-émission reconnexion pour l'éphémère (rien de persisté). Pas de VFX d'explosion (le marqueur + les popups de dégâts *sont* la visualisation). | serveur + client | `node --check` + eslint + build + session (validé : marqueur + AOE apparaissent en percussion) |
| 3f/10 | Doc (recouvre partiellement 3g) : `JOURNAL8.md` — (a) écart RAW : percussion = explosion immédiate Tour T = interprétation ; (b) détonation = choix au lancer, pas variante catalogue ; (c) **écart de comportement minuterie** : une explosion différée (T+1) qui lève une exception affiche désormais un `COMBAT_DECLARE_ERROR` en room (catch durci 3f/4) au lieu d'un silence total — vérifié bout en bout (`flushEmissions` gère `to:'room'` avec `socket=null`) ; (d) `[INCONNU]` noté : `isImpossibleRangedSituation` (Allure max / obscurité totale) bloque le lancer de grenade — comportement hérité (minuterie), défendable RAW (« lancer prend un Tour de combat » = Action pleine), à trancher hors 3f ; (e) marqueur éphémère percussion (3f/9-bis). `docs/SYSTEME/COMBAT.md` § résolution grenade ; `client/public/CHANGELOG.md`. | doc | — |
| **3g** | Doc : écarts `JOURNAL8.md` (dégression = diamètre/2, sonique, acide), `docs/SYSTEME/COMBAT.md` § résolution grenade, `client/public/CHANGELOG.md`. | doc | — |

Chaque sous-segment validé avant le suivant (feedback_segment_by_file). Filet proportionné (§5 pt 3) :
3b = guards à défaut + session ; **la couverture d'intégration est construite en préalable de 3d**
(le nouveau flux). 3d/3e s'appuient sur le moteur `combat_timeline_entries` existant (§5) — pas de
nouvelle infra de différé.

### Segment 3-bis — autres grenades/capsules à explosion (après Segment 3, un mécanisme = un concern nouveau)

**Fondation (2026-09-09, avant le 1ᵉʳ type)** :
- **3-bis/0** ✅ — retrait du garde `!== 'grenade_frag'` dans `resolveGrenadeThrow` (redondant : 2
  invariants amont — `findAoeMechanismEntry` + annonce valide `shape:'circle'`). Le lancer est
  désormais commun à tout mécanisme cercle. *(commit + validé jeu réel Saar)*
- **3-bis/1a** ✅ — `aoeMechanisms/circleGrenade.js` (neuf) : squelette partagé des grenades cercle
  (`buildCircleShape` · `filterCircleHitTargets` LOS + in-zone sans enrichissement · `CIRCLE_GRENADE_FLOW`
  = 4 capacités gelées · no-ops nommés). **Décision archi (analyse à charge)** : extraire maintenant
  (N=2, 6 consommateurs nommés, la forme a déjà bougé en 3f) plutôt que copier — pas proactif,
  `feedback_aggradation_criterion`. *(commit + validé)*
- **3-bis/1b** ✅ — `grenadeFrag.js` refondu pour consommer `circleGrenade.js` (behavior-preserving,
  17 tests fixtures inchangés + session frag = filet). *(commit)*

| Mécanisme | Grenades / capsules | Concern nouveau vs `grenade_frag` | État |
|---|---|---|---|
| `grenade_energy` | grenade à énergie | rayon fixe uniforme (Ø 5 → r 2,5 m), 6D10, pas de dégression/Choc/statut | ✅ **3-bis/1** (migration 328, validé jeu réel) |
| `capsule_explosive` | capsule explosive | rayon fixe 2 m, « pas d'effet de souffle » | à faire |
| `grenade_incendiary` | grenade incendiaire · capsule napalm | feu court (`exposeToHazard({ durationDice })`, durée fixe) | à faire |
| `grenade_stun` | grenade assommante | Choc 2D10 (rayon fixe, pas de dégression) | à faire |
| `grenade_flashbang` | grenade étourdissante | **zéro dé de dégât** — applique le statut « étourdi » 1D6 Tours, Test de Réaction d'anticipation | à faire |
| `capsule_acide` | capsule acide | DoT acide 1D10/Tour × 2D6 Tours, matières organiques | à faire |
| `grenade_frag` + flag `concussion` | grenade à concussion | échec Test de Choc → **doubler** la durée d'étourdissement (`statusService`) | à faire |
| `grenade_sonic` (ou `grenade_frag` + param Choc) | grenade sonique | **dégression du Choc** (le tronc ne sait pas dégresser un `chocDsl`) — le seul dur | à faire |

Chacun = une entrée de registre (`grenade<X>.js` sur le squelette `circleGrenade.js`) + sa ligne de
migration, pipeline inchangé. **Écart RAW noté** (`grenade_energy`, 3g) : un « champ d'énergie » est-il
arrêté par une armure physique ? RAW silencieux → `armorReductionFactor: 1` par défaut, à confirmer.

### Segment 4 — grenade à neuro-charge

Mécanique de debuff de zone (malus = marge d'attaque, Test de Volonté). Non cadré —
`PLAN_ARMES_SPECIALES.md` §2.6.

---

## 7. Plan détaillé — 3a : mécanisme `grenade_frag` (résolution pure)

### 7.1 Périmètre exact de 3a

**Dans 3a (un fichier à la fois, pause entre chaque — feedback_segment_by_file) :**
1. **Extraction `rollSignedDie`** de `shotgunSpread.js` vers `server/src/lib/diceParser.js` ;
   `shotgunSpread.js` bascule sur l'import. Move pur, couvert par `node --test` (shotgun + un test
   unitaire neuf sur `rollSignedDie`). Fait **avant** `grenadeFrag.js` pour ne pas créer une
   dépendance mécanisme→mécanisme.
2. `server/src/lib/aoeMechanisms/grenadeFrag.js` — objet stratégie, 6 hooks, même forme que
   `shotgunSpread.js` / `flamethrower.js`. Sémantique **fragmentation seule** (pas de Choc, pas de
   feu, pas de statut). `GRENADE_FRAG_BANDS` figée **dans ce fichier** (précédent : `flamethrower.js`
   porte ses constantes inline ; un seul consommateur → YAGNI).
3. `registry.js` — `{ key: 'grenade_frag', ...grenadeFragMechanism }`.
4. `shared/combatAoe.js#AOE_MECHANICS` — `+ 'grenade_frag'`.
5. Tests : `grenadeFrag.test.mjs` (fixtures) + extension `registry.test.mjs` (3 mécanismes, 6 hooks) +
   `combatAoe.test.mjs` (`'grenade_frag' ∈ AOE_MECHANICS`).

**Contrainte des hooks — invariants à l'orchestrateur** : aucun hook de `grenadeFrag.js` ne lit
`ctx.rollResult`, `ctx.weapon.ref_range`, la position de `ctx.shooterToken`, ni `ctx.metrics` autrement
qu'en passe-plat. Tout ce qui est en forme de Phase-A ou de direction. Ainsi le mécanisme reste bon
que l'orchestrateur runtime (3e) soit `resolveAoeAssaultAction` bardé de branches OU un nouveau
`socketCombatGrenade.js` — choix explicitement reporté à 3e.

**Hors 3a (explicite) :** aucune modification du tronc `socketCombatAoe.js` (sauf import du nouveau
`diceParser.rollSignedDie` si `socketCombatAoe.js` l'utilisait — à vérifier), aucun payload, aucune
migration, aucune UI, aucun Test de Coordination, aucune dispersion, aucun différé.

### 7.2 Contrat des 6 hooks pour `grenade_frag`

| Hook | Comportement |
|---|---|
| `buildShape(ctx)` | **Trivial** : `normalizeAoeShape({ shape: 'circle', origin: ctx.aoe.resolvedOrigin, amplitudeM: 15 })`. `resolvedOrigin` = point d'impact déjà dévié, posé par l'orchestrateur en 3d (qui a le résultat du Test de Coordination) ; en 3a/fixtures, fourni directement. **`resolveScatter` n'est PAS appelé ici** — il a besoin de la marge du Test, domaine combat, pas géométrie de forme. |
| `filterTargets(ctx, visTargets)` | Pur. Pour chaque candidat : exclure le lanceur (`candidate.tokenId === ctx.action.token_id`) **seulement s'il n'est pas dans la zone** — RAW §5.5 PLAN_AOE : le lanceur peut être pris dans sa propre explosion (dispersion vers lui), pas d'exclusion silencieuse ; exclure hors-LOS ; `isPointInAoeShape(circle r=15)`. Retenus : `{ ...candidate, band: resolveGrenadeBand(distanceToOriginM) }`. |
| `extraTargets(ctx, hitTargets)` | `[]` — pas de pseudo-cible (le lanceur, s'il est dans la zone, est déjà une cible normale via `filterTargets`, contrairement au lance-flammes où l'auto-éclaboussure < 3 m est un contrôle séparé). |
| `targetRowModifier(ht)` | `{ band: ht.band.name, damageDice: ht.band.damageDice }` (persisté dans `combat_action_targets.damage_modifier`, nullable depuis segment 0c). |
| `computeTargetDamage(ctx, ht, { baseRaw })` | `spreadRaw = rollSignedDie(ht.band.damageDice)` ; `degautsBruts = baseRaw + spreadRaw` (**pas** de `mr`, **pas** de `fireModeBonusDmg` — §5 pt 3) ; `locationsCount = ht.band.locations` (3 au centre via `parseDice('1D3')`, sinon 1) ; `armorReductionFactor = 1` (protections normales, RAW). **Aucun Choc** — la fragmentation n'en porte pas (`Choc: -` au catalogue). La dégression du Choc est un problème de Segment 3-bis (sonique). |
| `postResolve(io, campaignId, ctx, perTargetResults)` | `[]` — fragmentation pure, aucun effet post-résolution. (concussion / feu / statut = Segment 3-bis.) |

### 7.3 `GRENADE_FRAG_BANDS` (table RAW figée)

```
Object.freeze({
  centre:  { maxDistanceM: 1,  damageDice: '+1D10', locations: 3, chanceTest: false },
  courte:  { maxDistanceM: 2.5, damageDice: '+0',   locations: 1, chanceTest: false },
  moyenne: { maxDistanceM: 5,  damageDice: '-1D10', locations: 1, chanceTest: false },
  longue:  { maxDistanceM: 10, damageDice: '-2D10', locations: 1, chanceTest: true,  chanceBonus: 0 },
  extreme: { maxDistanceM: 15, damageDice: '-3D10', locations: 1, chanceTest: true,  chanceBonus: 5 },
})
```

`resolveGrenadeBand(distanceM)` = `normalizeDistanceBands([...])` puis `resolveDistanceBand`.
**Garde-fou** : au-delà de 15 m, `resolveDistanceBand` renvoie le dernier palier (`extreme`) — c'est
`isPointInAoeShape(circle r=15)` dans `filterTargets` qui exclut ces cibles **avant** l'appel à
`resolveGrenadeBand`. Les deux ne sont jamais découplés (même discipline que le commentaire de tête de
`distanceBands.js`).

### 7.4 Invariants

- **Une propriété = une autorité** (AGENTS.md #3) : la table de dégression vit à **un** endroit ; la
  géométrie du cercle est `aoeShapes.js`, jamais recalculée.
- **Pas de second moteur** : `grenade_frag` réutilise `resolveAoeTargetDamage`/`finalizeAoeResults`
  du tronc — il n'introduit aucun chemin d'application de dégâts parallèle.
- **`mr` volontairement ignoré** — documenté dans le fichier (écart de modèle vs shotgun/flamethrower,
  justifié par le RAW).
- **Fonction pure** : `grenadeFrag.js` n'importe aucune DB pour ses hooks purs (`buildShape`,
  `filterTargets`, `targetRowModifier`) ; `computeTargetDamage`/`postResolve` peuvent être `async`
  (dés, io) comme les autres mécanismes.

### 7.5 Plan de tests 3a (`node --test`, fixtures, aucune base)

- `resolveGrenadeBand` : 0,5 m → centre ; 1 m → centre ; 1,01 m → courte ; 2,5 m → courte ; 5 m →
  moyenne ; 10 m → longue ; 15 m → extreme ; (>15 m n'est jamais passé — testé via `filterTargets`).
- `filterTargets` : lanceur hors zone → exclu ; lanceur dans la zone (dispersion) → **inclus** ;
  cible sans LOS → exclue ; cible à 16 m → exclue ; cibles à 0,5 / 3 / 12 m → incluses avec
  `band` = centre / moyenne / extreme.
- `computeTargetDamage` : centre → `baseRaw + roll('+1D10')`, `locationsCount ∈ {1,2,3}` ; extreme →
  `baseRaw + roll('-3D10')`, `locationsCount = 1` ; jamais de contribution `mr`/`fireModeBonusDmg`.
- `targetRowModifier` : `{ band: 'moyenne', damageDice: '-1D10' }`.
- `extraTargets` : toujours `[]`.
- `registry.test.mjs` : 3 mécanismes, chacun 6 hooks ; `findAoeMechanismEntry('grenade_frag')` défini.
- `combatAoe.test.mjs` : `'grenade_frag' ∈ AOE_MECHANICS` ; `isKnownAoeMechanic('grenade_frag')`.

### 7.6 [INCONNU] — tranchés à l'analyse à charge de 3a (2026-09-06)

1. **Dégression du Choc** → **neutralisé pour 3a** : la fragmentation ne porte pas de Choc. Le
   problème (le tronc ne sait pas dégresser un `chocDsl`) ne se pose qu'à la grenade sonique →
   **Segment 3-bis**.
2. **Couverture partielle (−1 à −2D10)** → **hors 3a, cohérent.** La donnée existe
   (`target.visibility.coverage` par cible) mais ni le fusil à pompe ni le lance-flammes ne consomment
   la couverture *partielle* (couverture *totale* = déjà gérée par LOS bloquée). Ne pas faire de la
   grenade la première à mapper « objet coverage → dé signé » : amélioration transverse AOE, plus
   tard. Écart RAW noté (déjà noté pour les autres armes AOE).
3. **Emplacement `GRENADE_FRAG_BANDS`** → **`grenadeFrag.js`** (précédent `flamethrower.js`, un seul
   consommateur).
4. **`rollSignedDie`** → **extrait vers `diceParser.js`** (utilitaire de dé, supprime une dépendance
   mécanisme→mécanisme). Premier fichier de 3a.
5. **Test de Chance non câblé** → **OK, aucun écart.** `SHOTGUN_SPREAD_BY_BAND` porte déjà
   `savePossible`/`saveBonus` non câblés. `chanceTest`/`chanceBonus` = donnée RAW latente, prête pour
   le chantier Chance (`PLAN_CHANCE.md`).

**Vérifié au passage (pas un [INCONNU]) :** `getEffectiveWeaponDamage` sur une ligne d'inventaire
grenade (appelée par le tronc pour tout tireur humanoïde) — code lu : pas d'ammo → repli sur
`weapon_formula` (« 5D10 »), renvoie `{ total }` sain, le `rangeBand` passé est ignoré (pas de
mécanique munition). Aucun opt-out nécessaire en 3b sur ce point.

---

## 8. Validation (proportionnée au risque — clôture AGENTS.md)

- **3a** : `node --test` (rollSignedDie + shotgunSpread non-régression + grenadeFrag + registry +
  combatAoe) · `node --check`. Aucun risque combat.
- **3b** : + non-régression fusil à pompe **et** lance-flammes en session réelle Saar (le tronc
  bouge).
- **3c–3d** : + `buildDeclarePayload.test.mjs`, lint + build client, session réelle (viser un point,
  dispersion sur échec visible).
- **3f** : 3f/1-3f/2 (shared + validation) = `node --test` / `node --check`. **3f/3** (extraction
  `resolveGrenadeThrow`, le tronc bouge) = `node --check` + session non-régression grenade minuterie +
  fusil à pompe + lance-flammes. **3f/4** (branche percussion + catch) = `node --check` + session
  réelle percussion multi-cibles à paliers différents. 3f/5-3f/9 (client) = `node --test` golden
  master + eslint + build. 3f/10 = doc.
- **3e** : analyse à charge dédiée + non-régression fusil à pompe/lance-flammes (extraction des
  helpers) + scénario FSM complet (grenade lancée T1, explosion T2 au bon rang d'Ini, lanceur mort
  entre-temps, reconnexion PJ, répétition réseau).
- **3g** : + scénario réel multi-cibles à paliers différents (centre 1D3 Loc, extrême −3D10) + build
  client.

## 9. Retour arrière

3a–3b : refactor pur / additif, `git revert` suffit. 3e (FSM) : tag avant + sauvegarde si le risque
le justifie, décidé à l'analyse à charge de 3e. 3f : 3f/1-3f/2 + 3f/5-3f/10 = additif, `git revert`
suffit ; **3f/3 (extraction du tronc AOE) = commit isolé, `git revert` par sous-étape** — behavior-
preserving par construction, aucune migration, pas de tag nécessaire.

---

## 10. Dettes ouvertes & suite (annoté 2026-09-06, session à faible contexte)

**État (2026-09-08) : 3a→3d-3 CLOS et VALIDÉS EN JEU RÉEL.** La grenade à fragmentation est jouable
de bout en bout : déclaration « viser un point » → lancer (Test de Coordination + dispersion, Tour T)
→ marqueur 3D au sol → explosion autonome au rang d'Initiative du lanceur, Tour T+1, dégression par
palier. Détail des sous-segments : §6 (tableau) + `JOURNAL8.md` (2026-09-07 moteur de tour ; 2026-09-07
grenades 3d ; 2026-09-08 grenades 3d-3). Reste : **3f (mode Percussion — plan recadré + analysé à
charge 2026-09-08, §6 + §10.4, prêt à coder à partir de 3f/1)** · 3d-4 (anim de jet, client pur) ·
3-bis (autres grenades) · 3e (FSM, si besoin). ~7 commits locaux non poussés au moment de l'annotation
(`544744f`..`852dd0c`).

### 10.1 Fix `ref_fire_mode || isAoeWeapon` — SOUND (analyse critique 2026-09-06, mon 1ᵉʳ jet était FAUX)

Commit `fdd613c` : la liste des armes de **Tir** (`CombatActionWindow.jsx:368`, `CombatGmDeclareWindow.jsx:395`
+ garde `pickedGmRanged:338`) filtrait sur `ref_fire_mode`. La grenade `grenade_frag` = 1ʳᵉ arme AOE
sans `fire_mode` → jamais listée. Patch = `|| isAoeWeapon(...)`.

**Mon 1ᵉʳ diagnostic (« contredit `combat.md`, fix robuste = `!== 'Arme de contact'` ») était erroné.**
Il confondait deux questions distinctes :
- **classifier** une arme déjà jouable : Tir vs CaC → `category === 'Arme de contact'` (`combat.md`,
  correct partout : `socketCombatHelpers.js:2575`, `socketCombatExo.js:301`, `useExoDeclare/useDroneDeclare`).
- **admettre** une arme dans la liste des candidates à une déclaration d'attaque → test de **capacité**
  (un chemin de résolution existe-t-il pour cette arme ?). C'est ce que fait la liste humanoïde.

Audit catalogue (`scratchpad/weapons_audit.js`, DB locale) — le fix `!== 'Arme de contact'` **régresserait** :
il verserait **35 lignes** dans le panneau Tir humanoïde, dont ~20 **sans chemin de résolution** —
15 `Armes de jet` (javelot, haches, disques… mécanique de jet jamais câblée), 7 grenades + 4 capsules
**non encore migrées** (pas d'`aoe_profile` → `isAoeWeapon` faux → traitées comme arme à feu sans mode
→ `fire_mode || 'cc'` → cassé), 6 `Torpilles et missiles` Taille 1-3, 2 `Systèmes défensifs`
(non tenus en main). Vérifié : **0** arme de contact avec `fire_mode` ; **100 %** des catégories à
résolution « arme à feu » standard (épaule, poing, lourde, trait, énergie, supercav, sous-marine,
lanceur) ont un `fire_mode`.

⟹ **`fire_mode IS NOT NULL` est un proxy fidèle de « chemin de résolution arme à feu standard »**, pas
un accident. Et `isAoeWeapon(aoe_profile)` = « mécanisme AOE câblé », **data-gated** : une nouvelle
grenade (concussion…) apparaît automatiquement dès que sa migration pose l'`aoe_profile`, sans toucher
au code (pattern `combatAoe.js`, inspiré Foundry dnd5e). Les deux clauses sont des **tests de capacité
pilotés par la donnée** — c'est déjà le bon modèle. **Le patch reste tel quel.**

**Seule aggradation retenue (petite, risque nul)** : extraire le prédicat `w.ref_fire_mode ||
isAoeWeapon(w.ref_aoe_profile)` (dupliqué 3×) en une fonction nommée partagée — p.ex.
`weaponHasRangedAttackPath(item)` dans `shared/combatAoe.js` (accepte `ref_*` et `*` nus). Rend
l'intention lisible (« a un chemin de résolution à distance », pas « a un fire_mode »), DRY, testable.
**Zéro changement de comportement.** 3 sites : `CombatActionWindow.jsx:368`, `CombatGmDeclareWindow.jsx:338`
et `:395`.

**Dette réelle séparée, PAS pour ce chantier** : les **15 `Armes de jet`** (armes de lancer physiques)
n'ont aucun chemin de combat — futur chantier dédié type « moteur de jet » (comme les grenades ont eu
le leur), pas un ride-along. Noté ici pour ne pas reperdre l'info.

### 10.2 Aperçu multi-anneaux — dégression visible ✅ FAIT (2026-09-06, commits `8c992be` + suivant)

Avant : aperçu = **un seul disque** r=15. Maintenant : **5 anneaux concentriques** aux rayons RAW
(diamètre/2 = 1 / 2,5 / 5 / 10 / 15 m), opacité graduée centre → extrême + ligne de bord par palier.

**Décisions actées :**
- **Home de la table = `shared/combatRange.js`** (pas un fichier dédié). Section miroir de
  `SHOTGUN_SPREAD_BY_BAND` — même motif : table mécanique RAW d'une arme AOE partagée apercu+résolveur,
  `shotgunSpread.js` l'importe déjà de là. `grenadeFrag.js` re-exporte (surface publique inchangée).
  Move nécessaire, pas cosmétique : `grenadeFrag.js` importe `parseDice` d'un chemin serveur → le
  client ne peut pas importer ce module. **Seam futur** (pas maintenant) : si concussion/sonique
  arrivent (§6), extraire `shared/grenadeBands.js` avec toutes les tables de la famille.
- **Un mesh + une ligne par anneau** (10 objets), pas un mesh par facette — le survol re-render à
  ~5 cm, 485 meshes auraient été lourds.
- **Opacité = donnée d'affichage** (`GRENADE_RING_OPACITY` local à `aoePreviewShape.js`, calibré à
  l'œil : 0,45 → 0,12), **pas** dans la table RAW partagée.
- **Choix anneaux vs disque** = `aoe_profile.mechanic === 'grenade_frag'` dans Canvas3D (1 ligne,
  cohérent avec le `shape === 'cone'` voisin). `buildCircleSpan`/`projectCircleFan` conservés en repli
  pour une future arme `circle` d'un autre mécanisme.
- Pas de label texte sol, pas de dégradé continu, rouge unique (opacité pas teinte) — comme cadré.

**Fichiers :** `shared/combatRange.js` (+`GRENADE_FRAG_BANDS`/`GRENADE_FRAG_MAX_RADIUS_M`/`resolveGrenadeBand`),
`shared/combatRange.test.mjs`, `server/.../grenadeFrag.js` (re-export), `server/.../grenadeFrag.test.mjs`,
`client/src/lib/aoePreviewShape.js` (+`buildGrenadeBlastRings`/`projectRingQuads`/`projectCircleOutline`),
`client/src/lib/aoePreviewShape.test.mjs`, `client/src/components/Canvas3D.jsx`.
**Testé :** `node --test` combatRange (12) / aoeMechanisms (24) / aoePreviewShape (21) / `shared/**` (519) ;
`npm run build` client OK ; eslint 0 nouvelle erreur. **Visuel = Saar** (5 anneaux à la déclaration,
les 3 plateformes).

### 10.3 Segment 3d ✅ FAIT (2026-09-07/08) — voir §6 + JOURNAL8

Implémentation retenue (diffère du croquis initial : ni `mode:'grenade'`, ni `combat_action`
synthétique) : **Test de Coordination sur l'attribut COO** (pas de compétence `ARMES_DE_JET`) via l'option `attributeId` de
`resolveHumanoidTestContext` (3d-0). Pas de `combat_action` synthétique `grenade_explosion` : l'entrée
`combat_timeline_entries` porte `resolution_snapshot.autoResolve` et le moteur de tour la résout
lui-même (`registerAutonomousStepResolver`, 3d-2) en réutilisant l'`combat_action` du lancer
(`turn_number` bumpé à T+1, `modifiers.aoe.resolvedOrigin` + `weaponSnapshot` posés par `jsonb_set`).
`resolveScatter` câblé (3d-1). Le garde `aoe.intendedOrigin && !aoe.resolvedOrigin` (`socketCombatAoe.js`)
est bien le point de branchement. Marqueur 3D + events `COMBAT_GRENADE_ARMED/_EXPLODED` (3d-3).

### 10.4 Segment 3f — analyse à charge (2026-09-08, avant code)

**Lecture code, pas déduite.** Le fall-through percussion vers le bloc explosion existant
(`socketCombatAoe.js:578-734`) a été tracé ligne à ligne pour un `grenade_frag` entrant en mode
percussion après le lancer.

**[VÉRIFIÉ] Ce qui tient — le fall-through est sain :**

| Point du bloc explosion | Comportement en percussion (Tour T) | Verdict |
|---|---|---|
| `amplitudeM` (l.583) | `needsWeaponRange:false` → sauté | ✓ |
| `buildShape` (l.601) | lit `ctx.aoe.resolvedOrigin` — muté en mémoire par `resolveGrenadeThrow` | ✓ |
| `evaluateAoeVisibility` `losSource:'origin'` (l.617) | depuis le point d'impact, positions **actuelles** | ✓ **plus juste que minuterie** : percussion = « heurte » = instantané, les cibles ne fuient pas (RAW-cohérent) |
| `rollsPhaseA:false` (l.632) | `runAoePhaseA` **et son `maybeTriggerCatastrophe`** sautés | ✓ **pas de double catastrophe** — seul le jet de Coordination du lancer déclenche |
| `decrementsAmmo:false` (l.648) | pas de re-requête `char_inventory` | ✓ |
| `getEffectiveWeaponDamage(db, action.weapon_inv_id)` (l.710) | ligne d'inventaire **déjà supprimée au lancer** → `_fetchWeaponAndAmmo` sans `weapon_ref_id` → `return null` → repli `weapon.ref_damage_h` (l.712-714) | ✓ **exactement le mécanisme qui fait marcher minuterie** (validé 2026-09-08) — pas une régression |
| `finalizeAoeResults({ isPnjResult:false })` (l.726) | émet `COMBAT_ATTACK_PLAYER_RESULT { targets:[...] }` agrégé → `CombatModifiersWindow` liste par cible (l.307-324) → joueur ferme via `onAttackConfirmed` | ✓ **chemin tireur-PJ du fusil à pompe, déjà validé** |
| retour `{ suspend:false }` (l.734) | `advanceTimeline` enchaîne, pas d'`AWAITING_DAMAGE` | ✓ identique au fusil à pompe |

Autres [VÉRIFIÉ] : `CombatModifiersWindow` s'ouvre déjà pour une grenade (`isAoeAction`, l.130) →
`confirmedModifiers` peuplé, gate `isImpossibleRangedSituation` (l.417) déjà exercé par le lancer
minuterie, PER ne change rien. Idempotence répétition réseau = chemin fusil à pompe AOE (action
marquée `resolved` par le handler CONFIRM avant résolution, `socketCombatResolution.js:417`). Grenade
consommée avant explosion = correct RAW (amorcée + lancée = partie).

**Corrections au plan (portées dans §3 pt 2 + §6) :**

1. **Le catch aveugle du tronc (`socketCombatAoe.js:735` : `return { emissions: [] }`) est un vrai
   trou** — une exception en cours de résolution AOE efface **toutes** les émissions, y compris le
   `DICE_RESULT` déjà lancé (fusil à pompe et lance-flammes compris). PER le rend visible (grenade
   consommée + Test de Coordination joué, joueur voit *rien*). → **aggradation ajoutée à 3f/4** : le
   catch retourne `emissions` (l'accumulé) + pousse un `COMBAT_DECLARE_ERROR`. Bénéficie aux 3 armes.
2. **3f/8 touche 2 fenêtres** (`CombatActionWindow` + `CombatGmDeclareWindow`, même `AssaultRangedPanel`),
   pas 1.
3. **« 1 branche » sous-estimait** : aucun choix de détonation n'existe (grep : zéro). Vrai livrable =
   seam `resolveGrenadeThrow` + enum d'intention déclarée de bout en bout (~10 fichiers).
4. **Enum en français** aligné RAW : `'minuterie'` / `'percussion'` / `'drone'`.
5. **Reset d'état** : `aoeDetonation` remis à `'minuterie'` dans `SELECT_WEAPON` + `CLEAR` (3f/5).
6. **Persistance annonce (3f/2)** : normalisation en place, chemin `direction` non touché. Whitelist
   explicite de `modifiers.aoe` = dette séparée (avec `weaponHasRangedAttackPath` §10.1), hors 3f.

**Conclusion : faire.** Pas un patch — l'extraction `resolveGrenadeThrow` transforme ~95 lignes inline
en seam nommé que chaque type de 3-bis + le futur `drone` réutilisent ; l'enum + le toggle = infra
consommée telle quelle par 3-bis ; le catch-retourne-émissions durcit les 3 armes AOE. Percussion
(blast sans échappatoire vs zone-denial différée) est un vrai choix tactique.
