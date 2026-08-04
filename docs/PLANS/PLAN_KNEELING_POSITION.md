# PLAN_KNEELING_POSITION.md — Ajout de la position « à genou » (kneeling)

> Créé : 2026-08-04 (dev/Saar). Statut : **planification uniquement, aucun code écrit.**
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré dans `docs/SYSTEME/COMBAT.md` (matrices de transition) et
> `docs/SYSTEME/ETATS_PERSONNAGE.md` (ETP2, mis à jour plutôt que dupliqué).
> Responsabilité unique de ce document : rendre `kneeling` réellement sélectionnable en jeu (catalogue
> déjà en place depuis `PLAN_CHARACTER_STATES.md` Lot 0, mais jamais atteignable). Ne traite aucune
> autre règle de jeu, aucune autre valeur d'état.

---

## 0. Cadrage

### 0.1 Constat `[VÉRIFIÉ]`

`ref_character_state_values`/`character_states` connaissent déjà `kneeling` (Lot 0, migration `229`),
mais la valeur est inatteignable en jeu :
- `combat_roster.chk_state_position` (migration `56_combat_v2.js`) n'autorise que
  `'standing'|'crouching'|'prone'` — un `UPDATE` avec `'kneeling'` échouerait (violation `CHECK`).
- `VALID_POS` (`server/src/socket/socketCombatState.js`, handler `COMBAT_INIT_STATE`) rejette
  silencieusement toute valeur hors de ce même triplet.
- `STATE_DEFS.position.states` (`client/src/components/combatSections.js`) — source du sélecteur
  affiché au joueur/MJ (`CombatInitStateWindow.jsx`, `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx`,
  tous consommateurs de `STATE_DEFS`, `[VÉRIFIÉ]` grep) — ne liste que ce même triplet.

### 0.2 RAW `[VÉRIFIÉ]` — le livre ne donne pas de coût nommé pour « à genou »

`REGLESYSCOMBAT.md:929-941` liste 4 positions descriptives (« debout, accroupi, à genou, allongé ») mais
ne nomme un coût d'Initiative que pour 2 transitions : « S'accroupir/Se redresser » (-3), « Se jeter à
terre, plonger » (-5), plus « Se relever » (-10, depuis allongé/après une chute). Aucune ligne ne
mentionne « à genou ».

**Décision explicite (Saar, 2026-08-04)** : `kneeling` coûte exactement ce que coûte `crouching`, sur
toute paire de transition vers/depuis `standing` et `prone`. Simplification RAW assumée et documentée
ici — pas un raccourci silencieux (`CLAUDE.md` §1 point 9).

**Décision explicite complémentaire (Saar, 2026-08-04, relecture à charge)** : la transition directe
`crouching↔kneeling` — la seule paire que « même coût qu'accroupi » ne couvre pas explicitement, trouvée
en relisant ce plan avant de coder — est **gratuite (coût 0)**. Les deux postures étant mécaniquement
identiques partout ailleurs dans le système, passer de l'une à l'autre ne procure aucun avantage caché.

### 0.3 Duplication déjà existante, pas créée par ce plan `[VÉRIFIÉ]`

La table de coût de transition existe en **deux copies manuellement synchronisées** :
- Serveur : `STATE_COSTS` inline dans `socketCombatAnnouncement.js:357-363` (utilisée pour le calcul du
  coût d'Initiative réel, `transitionCost`, ligne 394).
- Client : `STATE_DEFS.position.cost` dans `combatSections.js:17-21` (utilisée pour l'aperçu du coût
  affiché avant validation, `stateTransitionCost`).

Même classe de dette que celle déjà corrigée ailleurs dans ce projet pour les mods de situation CaC/Tir
(`PLAN_RW_SYSCOMBAT.md` §0.4/§2.1.a — tables déplacées vers `shared/`). Comme ce plan doit de toute
façon toucher les deux copies pour ajouter `kneeling`, l'occasion est prise de les unifier (règle Saar
de cette session : améliorer un fichier qu'on touche déjà plutôt que d'empiler une 3ᵉ copie).

**Portée du dédoublonnage** : uniquement la table de coût de `position` (`STATE_COSTS.position` /
`STATE_DEFS.position.cost`) — celle qui doit changer pour ce chantier. `weapon`/`fire_mode`/`vitesse`
ont la même duplication mais ne sont pas touchées ici (hors périmètre, § ci-dessous) — pas de raison de
les auditer/déplacer dans ce plan.

### 0.4 Consommateurs de `state?.position !== entry?.state_position` — pas de changement requis

`shared/combatExclusiveActions.js:101` (`getAimIneligibilityReasons`, éligibilité Tir Visé) compare les
positions par égalité stricte, sans énumération de valeurs — fonctionne pour toute 4ᵉ valeur sans
modification. À vérifier en jeu réel (§4) plutôt que supposé.

---

## 1. Architecture retenue

**Nouveau fichier partagé** : `shared/combatStatePositionCost.js` — responsabilité unique : la matrice
de coût d'Initiative des transitions de position, pure donnée, aucune dépendance i18n/présentation
(la liste des positions avec leurs clés i18n reste dans `combatSections.js`, propre au client — le
serveur n'en a pas besoin, seulement des coûts).

```javascript
// shared/combatStatePositionCost.js
export const POSITION_TRANSITION_COST = {
  standing:  { crouching: -3, kneeling: -3, prone:      -5 },
  crouching: { standing:  -3, kneeling:  0, prone:      -5 },
  kneeling:  { standing:  -3, crouching:  0, prone:      -5 },  // alias exact de crouching (décision §0.2)
  prone:     { standing: -10, crouching: -10, kneeling: -10 },
}
```

Serveur (`socketCombatAnnouncement.js`) et client (`combatSections.js`) importent tous les deux cette
constante au lieu de la définir localement — un seul endroit, une correction de valeur (errata futur)
redevient un seul edit.

---

## 2. Lots — un seul problème par lot, validé avant le suivant

| Lot | Contenu | Risque | Statut |
|---|---|---|---|
| **Lot 1 (dédoublonnage)** | Créer `shared/combatStatePositionCost.js` avec le triplet actuel (`standing`/`crouching`/`prone`, valeurs inchangées). Basculer `socketCombatAnnouncement.js` et `combatSections.js` pour l'importer au lieu de définir `STATE_COSTS.position`/`STATE_DEFS.position.cost` localement. Comportement identique bit-à-bit — aucune nouvelle valeur. | Faible — refactor pur | **Clos** — test unitaire vert, ESLint propre, validé en jeu réel par Saar (coût Initiative inchangé) |
| **Lot 2 (ajout kneeling)** | Migration (numéro à vérifier au moment de coder, actuellement 231 libre) : élargir `chk_state_position` à 4 valeurs. `VALID_POS` (`socketCombatState.js`) + entrée `kneeling` dans `POSITION_TRANSITION_COST` (§1, coût = alias `crouching`) + `STATE_DEFS.position.states` (`combatSections.js`) + `states.position.kneeling` (`combat.json`, labels "À genou"/"Genou"). | Faible-moyen — migration additive (élargit une contrainte, aucune donnée existante affectée) + synchronisation client/serveur/i18n | Non commencé |

Chaque lot = un commit isolé, testé et confirmé par Saar avant le lot suivant (`CLAUDE.md` §5, §11).

---

## 3. Hors périmètre de ce plan

- Dédoublonnage de `weapon`/`fire_mode`/`vitesse` (même dette, §0.3) — pas touchés ici.
- Toute révision du coût RAW de `kneeling` au-delà de l'alias `crouching` décidé §0.2.
- Lot 2c de `PLAN_CHARACTER_STATES.md` (retrait des colonnes `combat_roster.state_position`/`state_weapon`) — indépendant, toujours différé.
- `CombatRosterWindow.jsx` (affichage GM du roster) — lit déjà `STATE_DEFS`/le broadcast, aucun changement de code attendu, à vérifier visuellement seulement (§4).

---

## 4. Validation attendue

- **Testé (Lot 1)** : comportement identique — un changement `standing↔crouching↔prone` en jeu réel,
  coût d'Initiative inchangé côté aperçu client ET côté résolution serveur.
- **Testé (Lot 2)** : déclarer `kneeling` en jeu réel (MJ via `CombatInitStateWindow.jsx`, ou joueur/MJ
  via l'annonce de tour) — coût d'Initiative correct (identique à `crouching` sur chaque transition),
  label "À genou" affiché correctement (sélecteur + roster GM), persistance d'un tour sur l'autre
  (comme `standing`/`crouching`/`prone` depuis `PLAN_CHARACTER_STATES.md` Lot 2b), Tir Visé toujours
  refusé après un passage à `kneeling` ce tour (§0.4, non-régression à vérifier explicitement).
- **Non testé** : ce qui reste après le lot en cours.
- **Données** : migration Lot 2 (élargissement `CHECK`, aucune donnée existante affectée).
- **Retour arrière** : chaque lot est un commit isolé.

---

## 5. Fichiers concernés

| Fichier | Action | Lot |
|---|---|---|
| `shared/combatStatePositionCost.js` | Créer | 1 |
| `server/src/socket/socketCombatAnnouncement.js` | Modifier (import au lieu de `STATE_COSTS.position` inline) | 1, 2 |
| `client/src/components/combatSections.js` | Modifier (import au lieu de `STATE_DEFS.position.cost` inline ; Lot 2 : `states` +kneeling) | 1, 2 |
| `server/src/db/migrations/231_kneeling_position.js` (numéro à confirmer) | Créer | 2 |
| `server/src/socket/socketCombatState.js` (`VALID_POS`) | Modifier | 2 |
| `client/src/locales/combat.json` (`states.position.kneeling` — label "À genou", short "Gen." pour rester cohérent avec "Deb."/"Acc."/"Couc.") | Modifier | 2 |
| `shared/combatStatePositionCost.test.mjs` | Créer (premier filet automatisé sur cette table, fonction pure) | 1 |
| `docs/SYSTEME/COMBAT.md` (matrices de transition, table persistance) | Mettre à jour | 2 (clôture) |
| `docs/SYSTEME/ETATS_PERSONNAGE.md` (ETP2) | Mettre à jour | 2 (clôture) |
| `docs/PLANS/PLAN_KNEELING_POSITION.md` | Archiver dans `docs/Old/` | Clôture |
