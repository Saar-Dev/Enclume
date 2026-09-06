# PLAN_GRENADES.md — Grenades et capsules à explosion (Segment 3 du chantier armes de zone)

> Rédigé 2026-09-06 (Claude/Saar). Sorti de `PLAN_ARMES_SPECIALES.md` §2 (devenu trop gros — un
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

| Régime | Lignes en périmètre de CE plan | Amplitude |
|---|---|---|
| **Dégression standard** | grenade à fragmentation, grenade à concussion, **grenade sonique** (écart RAW — §3) | rayon max 15 m ; table de paliers = constante de code |
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
   `grenade_frag` (dégression, éclats + Choc) est le **premier** mécanisme ; `grenade_incendiary`,
   `grenade_flashbang`, `grenade_stun`, `grenade_energy`, `capsule_explosive`, `capsule_acide`
   s'ajoutent ensuite comme des entrées de registre réutilisant le même pipeline (exactement comme le
   lance-flammes après le fusil à pompe).

2. **Options MIN / PER / DRO** : RAW « toutes les grenades peuvent être dotées de l'une des options »
   → **universel, rien à seed par ligne** ; l'option est un choix au moment du lancer.
   - **MIN + PER en v1.** Couture unique `programmerExplosion(point, profil, quand)` avec
     `quand ∈ { maintenant, TourSuivant@Ini }` — deux valeurs d'un paramètre, pas deux chemins.
   - **DRO différé.** Projectile-entité autonome (détection, homing, 10 min, Tours propres, NT V,
     ×10 coût) — dépend d'un sous-système « entité autonome en combat » non construit (dette
     `COUVERTURE_RAW.md` §2). `detonation_mode = 'drone'` accepté **structurellement**, rejeté à la
     résolution avec message clair (patron `AOE_MECHANICS`).

3. **Grenade sonique = dégression standard** (`grenade_frag`). Le RAW ne donne aucune zone ; c'est une
   onde de choc anti-personnel avec dés de dégâts (5D10) + Choc (1D10). Écart RAW → `JOURNAL8.md`.

4. **Capsule acide = cercle rayon 1,5 m** (Ø 3 m, calé sur la capsule napalm — l'autre « capsule de
   liquide qui couvre une zone »). Le RAW ne donne aucun Ø. Écart RAW → `JOURNAL8.md`.

5. **Migration catalogue APRÈS le moteur, une seule fois.** On ne seed pas un `aoe_profile` qui
   pointe vers un mécanisme absent du registre. Ordre : mécanisme `grenade_frag` (3a) → migration des
   2 lignes concernées (3g). Pas de nouvelle colonne — `aoe_profile` JSONB existant.

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
| Dé signé de dégression | `shotgunSpread.js#rollSignedDie('-2D10')` | Même helper (à sortir en partagé si `grenade_frag` le réutilise — sinon copie assumée d'une ligne). |
| Dégât brut | `server/src/lib/combatAttackRoll.js#computeAssaultRawDamage({ rawDice, mr, portee, fireModeBonusDmg })` | **`mr` non pertinent pour une grenade** (§5) → `computeTargetDamage` grenade n'appelle PAS cette fonction, ou l'appelle avec `mr: 0, portee: null`. |
| Application par cible + finalisation | `socketCombatAoe.js#resolveAoeTargetDamage` / `finalizeAoeResults` | Génériques — 1D3 Loc au centre = `locationsCount: 3` déjà supporté (lance-flammes). |
| Feu continu | `environmentalHazardService.js#exposeToHazard({ durationDice })` | `grenade_incendiary` (Segment 3-bis). |
| LOS + couverture | `worldVisibilityService.js#evaluateAoeVisibility` | Inchangé. Couverture partielle RAW (−1 à −2D10) : couche 3, à cadrer en 3a §7. |

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

---

## 6. Découpage

### Segment 3 — grenade à fragmentation + grenade à concussion (+ sonique), lancées à la main, MIN + PER

| | Contenu | Nature | Touche le combat humain ? |
|---|---|---|---|
| **3a** | Mécanisme `grenade_frag` : entrée de registre + `GRENADE_FRAG_BANDS` + les 6 hooks. **Fonction pure, fixtures.** Enregistré mais inatteignable par l'appli tant que 3c n'existe pas. | résolution pure | non |
| **3b** | Adaptations du tronc : un mécanisme peut déclarer qu'il ne passe pas par `runAoePhaseA` (compétence d'arme) et qu'il tire son amplitude de `aoe_profile` (pas de `ref_range`) ; `ctx.aoe.intendedOrigin` transporté. Non-régression fusil à pompe + lance-flammes. | tronc | oui — clôture session Saar |
| **3c** | Déclaration « Viser un point » : payload `aoe.intendedOrigin` (`socketCombatAnnouncement.js`), aperçu cercle (`aoePreviewShape.js` + `Canvas3D.jsx`), éligibilité aux 3 fenêtres de déclaration. | payload + UI | non (déclaration seule) |
| **3d** | **Lancer** : Test de Coordination serveur (§5 pt 2) + `resolveScatter` câblé → point d'impact dévié sur échec (1D6 direction × marge). | résolution | oui |
| **3e** | **Explosion différée (MIN)** — couture `programmerExplosion(…, quand)` + action résolue au Tour suivant au rang d'Ini du lanceur. **Analyse à charge dédiée + recherche pattern (Foundry delayed effects, PF2e) avant tout code.** | infra neuve | oui — FSM |
| **3f** | Mode **PER** : `quand = maintenant` sur la même couture (raffinement « détonation contre un obstacle intercalé » via le LOS déjà calculé = ultérieur). | 1 param | oui |
| **3g** | **1 migration** `aoe_profile` pour fragmentation + concussion (+ sonique) · doc : écarts `JOURNAL8.md`, `docs/SYSTEME/COMBAT.md` § résolution grenade, `client/public/CHANGELOG.md`. | migration + doc | non |

Chaque sous-segment est validé avant le suivant (feedback_segment_by_file). 3a–3b livrables sans
risque combat. 3e est le vrai morceau.

### Segment 3-bis — autres grenades/capsules à explosion (après Segment 3, un mécanisme à la fois)

`grenade_incendiary` (+ capsule napalm) · `grenade_flashbang` (étourdissante — statut, zéro dé de
dégât) · `grenade_stun` (assommante) · `grenade_energy` · `capsule_explosive` · `capsule_acide`.
Chacun = une entrée de registre + une ligne de migration, pipeline 3c–3f inchangé.

### Segment 4 — grenade à neuro-charge

Mécanique de debuff de zone (malus = marge d'attaque, Test de Volonté). Non cadré —
`PLAN_ARMES_SPECIALES.md` §2.6.

---

## 7. Plan détaillé — 3a : mécanisme `grenade_frag` (résolution pure)

### 7.1 Périmètre exact de 3a

**Dans 3a :**
- `server/src/lib/aoeMechanisms/grenadeFrag.js` — objet stratégie, 6 hooks, même forme que
  `shotgunSpread.js` / `flamethrower.js`.
- `GRENADE_FRAG_BANDS` — table RAW figée (dans `grenadeFrag.js` ou `shared/combatRange.js` à côté de
  `SHOTGUN_SPREAD_BY_BAND` — **à trancher** : la dégression grenade est-elle « mécanique RAW
  partagée » comme le fusil à pompe, ou propre au mécanisme ? Défaut proposé : dans `grenadeFrag.js`,
  elle n'a qu'un seul conscommateur).
- `registry.js` — `{ key: 'grenade_frag', ...grenadeFragMechanism }`.
- `shared/combatAoe.js#AOE_MECHANICS` — `+ 'grenade_frag'`.
- Tests : `grenadeFrag.test.mjs` (fixtures) + extension `registry.test.mjs` (3 mécanismes, 6 hooks).

**Hors 3a (explicite) :** aucune modification du tronc `socketCombatAoe.js`, aucun payload, aucune
migration, aucune UI, aucun Test de Coordination, aucune dispersion, aucun différé. Le mécanisme est
enregistré et unit-testé ; il devient atteignable par l'appli en 3b+3c.

### 7.2 Contrat des 6 hooks pour `grenade_frag`

| Hook | Comportement |
|---|---|
| `buildShape(ctx)` | `origin = ctx.aoe.resolvedOrigin` (point d'impact — posé par le tronc en 3d après dispersion ; en 3a/fixtures, fourni directement). `amplitudeM = 15` (rayon max RAW). `normalizeAoeShape({ shape: 'circle', origin, amplitudeM })`. |
| `filterTargets(ctx, visTargets)` | Pur. Pour chaque candidat : exclure le lanceur (`candidate.tokenId === ctx.action.token_id`) **seulement s'il n'est pas dans la zone** — RAW §5.5 PLAN_AOE : le lanceur peut être pris dans sa propre explosion (dispersion vers lui), pas d'exclusion silencieuse ; exclure hors-LOS ; `isPointInAoeShape(circle r=15)`. Retenus : `{ ...candidate, band: resolveGrenadeBand(distanceToOriginM) }`. |
| `extraTargets(ctx, hitTargets)` | `[]` — pas de pseudo-cible (le lanceur, s'il est dans la zone, est déjà une cible normale via `filterTargets`, contrairement au lance-flammes où l'auto-éclaboussure < 3 m est un contrôle séparé). |
| `targetRowModifier(ht)` | `{ band: ht.band.name, damageDice: ht.band.damageDice }` (persisté dans `combat_action_targets.damage_modifier`, nullable depuis segment 0c). |
| `computeTargetDamage(ctx, ht, { baseRaw })` | `spreadRaw = rollSignedDie(ht.band.damageDice)` ; `degautsBruts = baseRaw + spreadRaw` (**pas** de `mr`, **pas** de `fireModeBonusDmg` — §5 pt 3) ; `locationsCount = ht.band.locations` (3 au centre via `parseDice('1D3')`, sinon 1) ; `armorReductionFactor = 1` (protections normales, RAW). **Choc** : la dégression s'applique aussi au Choc (RAW) — le `shooterChocDsl` générique du tronc ne sait pas dégresser → `grenade_frag` renvoie en plus `chocDamageDice: ht.band.damageDice` **[à valider en analyse à charge : le tronc applique-t-il un dé signé au Choc, ou faut-il l'étendre ?]**. |
| `postResolve(io, campaignId, ctx, perTargetResults)` | Segment 3 fragmentation pure : `[]`. Concussion (profil `{ mechanic:'grenade_frag', concussion:true }`) : pour chaque cible dont le Test de résistance au Choc a échoué, **doubler la durée d'étourdissement** — `[à cadrer : statusService expose-t-il une prolongation, ou re-`applyStun` ?]`. |

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

### 7.6 [INCONNU] à lever en analyse à charge de 3a (tour suivant)

1. **Dégression du Choc** — le tronc (`resolveAoeTargetDamage`) passe `chocDsl` tel quel à
   `resolveTargetHit` ; il n'existe pas de « dé signé appliqué au Choc ». Étendre le tronc, ou
   `grenade_frag` construit-il un `chocDsl` déjà dégressé ? Impacte le contrat `computeTargetDamage`.
2. **Couverture partielle (−1 à −2D10 selon la protection)** — `evaluateAoeVisibility` renvoie-t-il un
   niveau de couverture exploitable par cible, ou seulement un booléen LOS ? Si booléen seul →
   couverture partielle = écart RAW noté, hors 3a.
3. **Table `GRENADE_FRAG_BANDS` : `grenadeFrag.js` ou `shared/combatRange.js` ?** (un seul
   consommateur aujourd'hui — défaut : local au mécanisme).
4. **`rollSignedDie`** — sortir de `shotgunSpread.js` en helper partagé, ou copie d'une ligne ?
5. **Test de Chance (paliers longue/extrême)** — `chanceTest: true` est porté par la table mais **non
   consommé en v1** (chantier Chance, `PLAN_CHANCE.md`). Confirmer que le porter en donnée dès 3a
   (sans le câbler) est acceptable — cohérent avec `savePossible`/`saveBonus` du fusil à pompe, déjà
   dans la table sans être tous câblés.

---

## 8. Validation (proportionnée au risque — clôture AGENTS.md)

- **3a** : `node --test` (grenadeFrag + registry + combatAoe) · `node --check`. Aucun risque combat.
- **3b** : + non-régression fusil à pompe **et** lance-flammes en session réelle Saar (le tronc
  bouge).
- **3c–3d** : + `buildDeclarePayload.test.mjs`, lint + build client, session réelle (viser un point,
  dispersion sur échec visible).
- **3e** : analyse à charge dédiée + scénario FSM complet (grenade lancée T1, explosion T2 au bon
  rang d'Ini, lanceur mort entre-temps, reconnexion PJ, répétition réseau).
- **3g** : + scénario réel multi-cibles à paliers différents (centre 1D3 Loc, extrême −3D10),
  concussion (double étourdissement), + build client.

## 9. Retour arrière

3a–3b : refactor pur / additif, `git revert` suffit. 3e (FSM) : tag avant + sauvegarde si le risque
le justifie, décidé à l'analyse à charge de 3e.
