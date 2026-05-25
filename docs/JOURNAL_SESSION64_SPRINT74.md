# JOURNAL TEMPORAIRE — Session 64 Sprint 7.3 + 7.4
> Créé 2026-05-25. Remplace SCRATCH_SESSION64.md pour les sprints résolution assaut + dégâts.
> À conserver jusqu'à confirmation fonctionnelle complète et push Git stable.
> Ce fichier contient TOUT ce que l'agent sait sur le sujet — pièges inclus, incertitudes signalées.

---

## ÉTAT GLOBAL — QU'EST-CE QUI EST FAIT ?

### Sprint 7.2 — CombatModifiersWindow ✅ CONFIRMÉ FONCTIONNEL (session 64)
Voir JOURNAL2.md pour le détail. Validé par Saar.

### Sprint 7.3 — Résolution assaut serveur ⚠ CODÉ, NON CONFIRMÉ
Code dans `server/src/socket/index.js` fonction `resolveAssaultAction`.
Jamais testé de bout en bout. À valider.

### Sprint 7.4 — Fenêtre "Gestion des dégâts" PJ ⚠ CODÉ, NON CONFIRMÉ
Code réparti sur 4 fichiers client + handler serveur.
La fenêtre côté client a été réécrite dans la session 25/05/2026.
Jamais testé de bout en bout. À valider.

---

## FICHIERS MODIFIÉS — SPRINT 7.3 + 7.4

### shared/events.js
Ajout de 3 nouvelles constantes (à la fin du bloc Combat) :
```js
COMBAT_DAMAGE_PROMPT:  'combat:damage_prompt',    // serveur → socket tireur PJ : invite à lancer les dés
COMBAT_DAMAGE_CONFIRM: 'combat:damage_confirm',   // PJ → serveur : déclenche le calcul (jets serveur)
COMBAT_DAMAGE_RESULT:  'combat:damage_result',    // serveur → socket tireur PJ : résultats pour affichage fenêtre
```
Note : COMBAT_ATTACK_RESULT existait déjà.

### server/src/socket/index.js
**Ajouts au niveau module (avant initSocket) :**
```js
const pendingDamageActions = new Map()  // clé = token_id tireur

const LOC_TABLE = [
  { max: 2,  slot: 'T'  },   // Tête
  { max: 8,  slot: 'C'  },   // Corps
  { max: 11, slot: 'BD' },   // Bras droit
  { max: 14, slot: 'BG' },   // Bras gauche
  { max: 17, slot: 'JD' },   // Jambe droite
  { max: 20, slot: 'JG' },   // Jambe gauche
]
```

**Ajouts aux imports :**
```js
import { resolveWoundInsertion, isShockTestRequired } from '../lib/woundUtils.js'
import { SLOT_TO_WOUND_LOCATION, LOCATION_LABELS } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
```
Note : calcResistanceArmure, calcCarenceArmure, calcSeuils, getShockMalus, calcResistanceDommages étaient déjà importés depuis charStats.js.

**Constantes locales dans initSocket :**
```js
const PORTEE_MOD_COMP = {
  bout_portant: 5, courte: 0, moyenne: -5, longue: -10, extreme: -15
}
const SITUATION_MODS = {
  // allures tireur
  lente_tireur: 5, moyenne_tireur: 0, rapide_tireur: -5,
  // allures cible
  lente_cible: 5, moyenne_cible: 0, rapide_cible: -5,
  // couverture / obscurité (valeurs approximatives — à confirmer LdB)
  couverture_partielle: -5, couverture_totale: -15,
  obscurite_partielle: -5, obscurite_totale: -15,
}
const TAILLE_MODS = { petite: -5, normale: 0, grande: 5, tres_grande: 10 }
```
⚠ INCERTITUDE : Les valeurs exactes de SITUATION_MODS ne sont pas confirmées dans le LdB. À vérifier lors de la prochaine session.

**Signature resolveAssaultAction :**
```js
async function resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character)
```
Appelée depuis le handler COMBAT_ACTION_CONFIRM quand `action.action_key === 'assault'`.

---

## FLUX COMPLET — ASSAUT PJ (Sprint 7.3 + 7.4)

```
1. GM clique "Agir" sur slot assaut
   → COMBAT_ACTION_CONFIRM { tokenId, confirmedModifiers: { portee, situation[], taille } }
   → handler socket → resolveAssaultAction(...)

2. resolveAssaultAction — jet d'attaque :
   a. Fetch tireur : token → character → char_sheet → attrs → archetype → genotype
   b. Fetch arme : action.weapon_inv_id → char_inventory JOIN ref_equipment → weapon
   c. Fetch compétence : weapon → ref_equipment_skill_assoc → ref_skills + char_skills → calcSkillTotal (BUG C)
   d. Fetch blessures + poids encombrement tireur (PI4, L9)
   e. is_rushed ← state_character.is_rushed (BUG B)
   f. Calcul CDR :
      skillTotal + porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp + effectiveMalus - carenceArmure
   g. parseDice('1d20') → rollAttaque
   h. io.to(campaignId).emit(DICE_RESULT, { ... }) — sans skillLabel → chat standard + animation D20
   i. isSuccess = rollAttaque <= CDR
   j. mr = CDR - rollAttaque

3. Si SUCCÈS (isSuccess) :
   a. Fetch cible : action.target_token_id → tokens → characters → char_sheet → attrs → for_na/con_na/vol_na
   b. targetName = character.name ?? token.label ?? 'Cible'
   c. BIFURCATION selon character.type :

   === CAS PJ ===
   - pendingDamageActions.set(action.token_id, { campaignId, targetTokenId, characterIdCible,
     char_sheet_id_cible, mr, portee: confirmedModifiers.portee, fire_mode_bonus_dmg,
     formula: weapon.ref_damage_h, for_na_cible, con_na_cible, vol_na_cible,
     tireurUsername, tireurColor, userId: character.user_id, targetName })
   - socket.emit(COMBAT_DAMAGE_PROMPT, { tokenId: action.token_id, formula, targetName })
   → SessionPage : setDamagePayload(data)
   → CombatDamageWindow monte : Phase 1 (dés vides + bouton "Lancer les dés")

   === CAS PNJ ===
   - Calcul immédiat complet (mêmes étapes que COMBAT_DAMAGE_CONFIRM, voir ci-dessous)
   - io.to(campaignId).emit(COMBAT_ATTACK_RESULT, { ... })
   - Pas de fenêtre visible aux joueurs

4. PJ clique "Lancer les dés" dans CombatDamageWindow :
   - setIsRolling(true) → animation CSS .dice-rolling sur les "?"
   - socket.emit(COMBAT_DAMAGE_CONFIRM, { tokenId })

5. Handler COMBAT_DAMAGE_CONFIRM :
   a. pendingDamageActions.get(tokenId) → pending
   b. pendingDamageActions.delete(tokenId)
   c. parseDice('1d20') → rollLoc
   d. LOC_TABLE.find(r => rollLoc <= r.max) → slotCode
   e. SLOT_TO_WOUND_LOCATION[slotCode] → localisation ('tete'/'corps'/'bras_gauche'/etc)
   f. Fetch armures cible : char_inventory JOIN ref_equipment WHERE slot NOT NULL
      + filtre PI8 : ('/' + slot + '/').includes('/' + slotCode + '/')
      + calcResistanceArmure(armuresSlot) → { etq }
   g. getMrTable() → modDomAttaque = getModifier(mrTable, mr)
   h. isShortRange = ['bout_portant', 'courte'].includes(portee)
      modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0
   i. parseDice(formula.replace(/\s/g, '')) → { rawDice, dmgRolls, dmgSeed }
   j. degautsBruts = rawDice + modDomAttaque + modDegatsMode
   k. rd = calcResistanceDommages(for_na_cible, con_na_cible)
   l. degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)
   m. Sévérité (seuils hardcodés) :
      ≥30 → 'mortelle' is_lethal=true
      ≥25 → 'mortelle'
      ≥20 → 'critique'
      ≥15 → 'grave'
      ≥10 → 'moyenne'
      ≥5  → 'legere'
      <5  → null (blessure légère non enregistrée)
   n. Si severity && char_sheet_id_cible :
      resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity) → { wound, promoted }
      finalSeverity = result.wound.severity  // P49 — promotion possible
      io.to(campaignId).emit(WOUND_ADDED, { characterId, wound, promoted, shock_test_required })
      Si isShockTestRequired(finalSeverity, localisation) :
        calcSeuils(for_na, con_na, vol_na) → { etourdissement, inconscience }
        getShockMalus(severity, localisation, is_lethal) → shockMalus
        parseDice('1d20') → rollChoc
        outcome = ok/etourdi/inconscient
        shockResult = { triggered, roll, outcome, shockMalus }

6. Émissions après calcul :
   a. socket.emit(COMBAT_DAMAGE_RESULT, { rollLoc, locLabel, degautsBruts, degatsNets, dmgRolls, severity, severityColor })
      → SessionPage : setDamageResults(data)
      → CombatDamageWindow : Phase 3 (résultats + couleur sévérité + "Fermer")
   b. io.to(campaignId).emit(DICE_RESULT, { skillLabel:'Localisation — Distance', ... })
      → chat : jet localization structuré (pas d'animation D20)
   c. io.to(campaignId).emit(DICE_RESULT, { skillLabel:'Dégâts — [zone]', ... })
      → chat : jet dégâts structuré
   d. Si finalSeverity : io.to(campaignId).emit(DICE_RESULT, { interactionType:'combat_damage', ... })
      → Sidebar : "X dégâts à [zone] de [cible]" avec couleur sévérité
   e. io.to(campaignId).emit(COMBAT_ATTACK_RESULT, { ... })

7. PJ clique "Fermer" :
   - onConfirmed() → setDamagePayload(null) + setDamageResults(null)
   - CombatDamageWindow démonte
```

---

## DÉTAIL FICHIERS CLIENT — SPRINT 7.4

### client/src/components/CombatDamageWindow.jsx
**Réécriture complète** (version précédente montrait résultats pré-calculés — MAUVAIS).

**Props :**
- `payload` : `{ tokenId, formula, targetName }` — reçu via COMBAT_DAMAGE_PROMPT
- `results` : null | `{ rollLoc, locLabel, degautsBruts, degatsNets, dmgRolls, severity, severityColor }` — reçu via COMBAT_DAMAGE_RESULT
- `socket` : socket.io client
- `onConfirmed` : callback → nettoie les deux states dans SessionPage

**State local :**
- `isRolling` (boolean) — true après clic "Lancer les dés", false tant que results=null, pas de Phase 3

**Phases :**
- Phase 1 (isRolling=false, results=null) : "?" dans les deux zones + bouton "Lancer les dés" (bleu)
- Phase 2 (isRolling=true, results=null) : animation CSS `.dice-rolling` sur les "?", bouton "Calcul en cours..." désactivé
- Phase 3 (results non-null) : rollLoc, locLabel, degautsBruts, dmgRolls, degatsNets, severityColor, banner sévérité + bouton "Fermer"

**Animation CSS :**
```css
@keyframes diceRoll {
  0%, 100% { transform: rotate(-8deg) scale(0.95); opacity: 0.5; }
  25%       { transform: rotate(8deg) scale(1.05); opacity: 0.9; }
  50%       { transform: rotate(-4deg) scale(0.98); opacity: 0.6; }
  75%       { transform: rotate(6deg) scale(1.02); opacity: 0.85; }
}
.dice-rolling { animation: diceRoll 0.35s ease-in-out infinite; }
```
Appliquée via `className={isRolling && !results ? 'dice-rolling' : ''}` sur les valeurs numériques.

**Layout :**
- Header : "Gestion des dégâts" + "→ {targetName}"
- diceRow : 2 blocs côte à côte séparés par divider
  - Bloc Localisation : label "LOCALISATION (DISTANCE)" + valeur D20 (? ou rollLoc) + badge zone (D20 ou locLabel coloré)
  - Bloc Dégâts : label "DÉGÂTS ({formula})" + valeur brute (? ou degautsBruts) + rollsDetail [dmgRolls] + netDmg "{degatsNets} nets"
- Banner sévérité (si results.severity) : "Blessure {severity}" avec fond coloré
- Bouton : "Lancer les dés" (bleu) → "Calcul en cours..." (grisé) → "Fermer" (couleur sévérité)

### client/src/pages/SessionPage.jsx
**Changements ajoutés :**

1. State ajouté (ligne ~98) :
```js
const [damageResults, setDamageResults] = useState(null)
```

2. Handler socket ajouté (après COMBAT_DAMAGE_PROMPT handler) :
```js
s.on(WS.COMBAT_DAMAGE_RESULT, (data) => {
  setDamageResults(data)
})
```

3. Fix DICE_RESULT destructuration : ajout de `targetName, localisation, severity, severityColor`
   dans la destructuration du payload ET dans l'objet addMessage.
   Ces 4 champs sont undefined pour tous les jets normaux — seul `interactionType:'combat_damage'` les remplit.

4. Props CombatOverlay :
```jsx
damagePayload={damagePayload}
damageResults={damageResults}
onDamageConfirmed={() => { setDamagePayload(null); setDamageResults(null) }}
```
Note : les deux states nettoyés ensemble pour éviter flash Phase 3 residuel au prochain assaut.

### client/src/components/CombatOverlay.jsx
**Changements :**
- `damageResults` ajouté dans la signature de la fonction
- Passé à CombatDamageWindow : `results={damageResults}`

### client/src/components/Sidebar.jsx
**Changement (session précédente) :**
Ajout du cas `msg.interactionType === 'combat_damage'` dans le rendu des messages DICE_RESULT.
Affiche : icône ⚔ + username + time + "[X dégâts] à [localisation] de [targetName]" + badge sévérité coloré.
Champs utilisés : `msg.total`, `msg.localisation`, `msg.targetName`, `msg.severity`, `msg.severityColor`, `msg.color`.

---

## DONNÉES STOCKÉES DANS pendingDamageActions

Clé : `action.token_id` (string UUID du token tireur)
Valeur :
```js
{
  campaignId,            // string — pour les broadcasts room
  targetTokenId,         // UUID — token cible
  characterIdCible,      // UUID | null — character de la cible (null si entité pure sans character)
  char_sheet_id_cible,   // UUID | null — char_sheet de la cible (null si pas de fiche)
  mr,                    // integer — marge de réussite du jet d'attaque
  portee,                // string — 'bout_portant' | 'courte' | 'moyenne' | 'longue' | 'extreme'
  fire_mode_bonus_dmg,   // integer — bonus dégâts mode de tir (migration 57)
  formula,               // string — ex: '2d6+3' — ref_damage_h de l'arme
  for_na_cible,          // integer — FOR NA de la cible (default: 8 si pas de fiche)
  con_na_cible,          // integer — CON NA de la cible (default: 8)
  vol_na_cible,          // integer — VOL NA de la cible (default: 8)
  tireurUsername,        // string — nom d'affichage chat
  tireurColor,           // string — couleur hex chat tireur
  userId,                // string — character.user_id du tireur (pour DICE_RESULT broadcast)
  targetName,            // string — nom affiché
}
```

---

## FORMULES POLARIS UTILISÉES

### Jet d'attaque (Sprint 7.3)
```
CDR = skillTotal + porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp + effectiveMalus - carenceArmure

Où :
  effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(totalWeight, forValue)  // P51
  carenceArmure  = calcCarenceArmure(equippedItems, for_na_tireur)  // min_str - forNA, 0 si ok

isSuccess = rollAttaque <= CDR
mr = CDR - rollAttaque
```

### Modificateurs portée (PORTEE_MOD_COMP)
```
bout_portant: +5, courte: 0, moyenne: -5, longue: -10, extreme: -15
```

### Calcul dégâts (Sprint 7.3 / 7.4)
```
modDomAttaque = getModifier(mrTable, mr)  // table polaris_mr, migration 46 — LdB p.209
modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0  // BUG A — colonne correcte : ref_damage_h

degautsBruts = parseDice(formula) + modDomAttaque + modDegatsMode
rd = calcResistanceDommages(for_na_cible, con_na_cible)  // table FOR+CON
etq = calcResistanceArmure(armuresSlot).etq  // mille-feuille armures slot

degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)
```

### Seuils sévérité (hardcodés, à vérifier contre LdB)
```
≥30 → mortelle (is_lethal=true)
≥25 → mortelle
≥20 → critique
≥15 → grave
≥10 → moyenne
≥5  → legere
<5  → null (pas de blessure)
```

### Résistance Armure (PI8 — filtre mille-feuille)
```js
armuresSlot = armuresCible.filter(a =>
  a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')
)
// CRITICAL : ne jamais utiliser WHERE slot = slotCode (PI8 — multi-slot ne matcherait pas)
```

### Jet de choc (isShockTestRequired)
Déclenché si : severity = 'critique' | 'mortelle', OU severity = 'grave' ET location = 'tete' | 'corps'
```js
outcome = rollChoc <= seuils.etourdissement + shockMalus ? 'ok'
        : rollChoc <= seuils.inconscience    + shockMalus ? 'etourdi'
        :                                                   'inconscient'
```
⚠ shockResult est calculé mais jamais broadcast ni affiché côté client pour l'instant.
COMBAT_ATTACK_RESULT contient shockResult, mais aucun composant ne le consomme.

---

## CHAÎNE SKILL_ID (BUG C — résolu)

```
action.weapon_inv_id
  → char_inventory.item_id (= ref_equipment.id de l'arme)
  → ref_equipment_skill_assoc WHERE item_id = X → skill_id
  → ref_skills WHERE id = skill_id → ref_skills row
  → char_skills WHERE char_sheet_id = sheetTireur.id AND skill_id = X
  → calcSkillTotal(attrs, charSkill, refSkill, geno)
```
⚠ Si pas d'association skill, fallback : skillTotal = 0 (jet presque impossible — acceptable V1).

---

## PIÈGES ACTIFS POUR CE SPRINT

### P49 — Promotion blessures
`resolveWoundInsertion` peut changer la sévérité par promotion en cascade.
`finalSeverity = result.wound.severity` — PAS la sévérité initiale calculée.
Utilisé pour la couleur, le WOUND_ADDED, et le COMBAT_DAMAGE_RESULT.

### PI8 — Filtre armures multi-slot
```js
('/' + a.slot + '/').includes('/' + slotCode + '/')
// Correct pour slots comme '/T/C/' (qui couvre T ET C)
// Jamais : WHERE slot = slotCode — ne matcherait pas les slots composites
```

### BUG A — Colonne dégâts (résolu dans plan, implémenté)
Colonne réelle dans `ref_equipment` : `damage_h`
Alias dans GET /inventory : `ref_damage_h`
Jamais `ref_degats` ou `ref_degats_total`.
```js
formula: weapon.ref_damage_h  // ✓
```

### BUG B — is_rushed (résolu)
```js
rosterTireur?.state_character?.is_rushed  // ✓
// Jamais : SELECT FROM combat_actions WHERE action_key='rushed' (table vidée en endTurn, PC28)
```

### BUG C — Chaîne skill_id (résolu)
Voir section "Chaîne skill_id" ci-dessus.

### PC27 — Entité ≠ PNJ
`!token.character_id` → entité de décor, pas de blessure, pas d'assaut contre elle.
`character.type === 'pnj'` → PNJ avec fiche, suit le flux PNJ.

### P3 — socket dans deps
Tout useCallback qui émet via socket : inclure socket dans les deps.

---

## INCERTITUDES ET QUESTIONS OUVERTES

### ⚠ 1 — SITUATION_MODS valeurs
Les valeurs de SITUATION_MODS (couverture, obscurité) dans socket/index.js ne sont pas confirmées
dans le LdB. Elles ont été estimées. À valider avec Saar.

### ⚠ 2 — modDegatsMode portée
`modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0`
Le bonus de mode de tir (RC/RL) n'est appliqué qu'à courte/bout_portant portée.
Règle à confirmer : s'applique-t-il aussi en portée moyenne ?

### ⚠ 3 — shockResult non affiché
Le jet de choc est calculé et dans COMBAT_ATTACK_RESULT, mais aucun composant ne l'affiche.
COMBAT_ATTACK_RESULT n't pas non plus consommé visible côté client (Sprint 7.4 display partiel).

### ⚠ 4 — Entité sans character_id
Si cibleToken.character_id est null (entité de décor) :
- char_sheet_id_cible = null, characterIdCible = null
- for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8 (valeurs par défaut)
- Pas de blessure insérée (guard `if (severity && char_sheet_id_cible)`)
- WOUND_ADDED non émis
Comportement acceptable pour V1 mais la cible sera quand même "blessée" dans les dégâts nets calculés.

### ⚠ 5 — Pas de timeout sur pendingDamageActions
Solution A validée par Saar : pas de timeout, la fenêtre reste ouverte jusqu'au clic joueur.
Risque : si le socket se déconnecte sans confirmation, le pending reste en mémoire.
Nettoyage au prochain SESSION_JOIN ? Non documenté — à traiter si problème en test.

### ⚠ 6 — Pas de test fonctionnel
Sprint 7.3 et 7.4 n'ont jamais été testés de bout en bout. Plusieurs interactions à tester :
- Assaut PJ touche → fenêtre apparaît ✓ (à vérifier)
- PJ clique "Lancer les dés" → animation → résultats ✓ (à vérifier)
- Chat : 3 DICE_RESULT + 1 COMBAT_ATTACK_RESULT ✓ (à vérifier)
- Blessure insérée dans character_wounds ✓ (à vérifier)
- WOUND_ADDED → ArmorWoundPanel se recharge ✓ (à vérifier)
- Assaut PNJ → invisible + blessure directe ✓ (à vérifier)
- Assaut contre entité sans fiche → pas de crash ✓ (à vérifier)

---

## PROTOCOLE NON RESPECTÉ (à noter pour audit)

Dans la session 25/05/2026, l'agent a codé Sprint 7.4 sans :
1. Lire les 4 docs obligatoires (JOURNAL2.md, ASBUILT.md, EN_COURS.md, SYSTEME.md)
2. Confirmer chaque lecture
3. Demander "Je code ?"
4. Attendre confirmation fonctionnelle

L'agent a interprété "go" de l'utilisateur comme permission de coder directement.
Les 4 étapes du protocole s'appliquent même après "go" — elles doivent précéder le code.
Violation enregistrée pour référence future.

---

## PROCHAINE ÉTAPE RECOMMANDÉE

1. SR (redémarrer le serveur)
2. Tester l'assaut complet de bout en bout avec deux PJs connectés
3. Vérifier le chat (3 entrées DICE_RESULT + message narratif coloré)
4. Vérifier blessure dans ArmorWoundPanel de la cible
5. Confirmer le jet de choc (calcul ok même si non affiché)
6. Confirmer le path PNJ (assaut PNJ contre PJ)
7. Appender JOURNAL2.md avec confirmation fonctionnelle
8. Push Git

---

## CONTENU EXACT DES ÉVÉNEMENTS WS

### COMBAT_DAMAGE_PROMPT (serveur → socket tireur uniquement)
```js
{ tokenId, formula, targetName }
```

### COMBAT_DAMAGE_CONFIRM (PJ → serveur)
```js
{ tokenId }
```

### COMBAT_DAMAGE_RESULT (serveur → socket tireur uniquement)
```js
{ rollLoc, locLabel, degautsBruts, degatsNets, dmgRolls, severity, severityColor }
```

### WOUND_ADDED (serveur → room)
```js
{ characterId, wound: { id, char_sheet_id, location, severity, is_stabilized }, promoted, shock_test_required }
```

### COMBAT_ATTACK_RESULT (serveur → room)
```js
{ tireurId, cibleId, localisation, degautsBruts, degatsNets, severity, is_lethal, isSuccess, shockResult }
```

### DICE_RESULT — localisation (serveur → room)
```js
{
  userId, username, color,
  formula: '1d20', rolls: locRolls, total: rollLoc,
  isCriticalSuccess: false, isCriticalFail: false,
  seed: locSeed, timestamp,
  skillLabel: 'Localisation — Distance',
  mechanicalTotal: rollLoc, diffLabel: '',
  chancesDeReussite: LOCATION_LABELS[localisation],  // ex: 'Corps'
  isSuccess: true,
}
```

### DICE_RESULT — dégâts (serveur → room)
```js
{
  userId, username, color,
  formula,  // ex: '2d6+3'
  rolls: dmgRolls, total: degautsBruts,
  isCriticalSuccess: false, isCriticalFail: false,
  seed: dmgSeed, timestamp,
  skillLabel: `Dégâts — ${LOCATION_LABELS[localisation]}`,
  mechanicalTotal: rawDice,
  diffLabel: `ETQ:${etq ?? 0} RD:${rd}`,
  chancesDeReussite: degatsNets,
  isSuccess: degatsNets > 0,
}
```

### DICE_RESULT — combat_damage narratif (serveur → room, si finalSeverity)
```js
{
  userId, username: tireurUsername, color: severityColor,
  formula: '', rolls: [], total: degatsNets,
  isCriticalSuccess: false, isCriticalFail: false,
  seed: '', timestamp,
  interactionType: 'combat_damage',
  skillLabel: `${tireurUsername} inflige ${degatsNets} dégâts`,
  targetName,
  localisation: LOCATION_LABELS[localisation],  // ex: 'Corps'
  severity: finalSeverity,
  severityColor,
  isSuccess: true,
}
```

---

## LOCALISATION — TABLE DE CORRESPONDANCE

```
LOC_TABLE (1d20) :
  1-2  → slot 'T'  → wound_location 'tete'
  3-8  → slot 'C'  → wound_location 'corps'
  9-11 → slot 'BD' → wound_location 'bras_droit'
  12-14→ slot 'BG' → wound_location 'bras_gauche'
  15-17→ slot 'JD' → wound_location 'jambe_droite'
  18-20→ slot 'JG' → wound_location 'jambe_gauche'

Mapping : SLOT_TO_WOUND_LOCATION (shared/armorConstants.js)
Labels  : LOCATION_LABELS (shared/armorConstants.js) — ex: 'tete' → 'Tête'
```

---

## resolveWoundInsertion — COMPORTEMENT EXACT

Depuis `server/src/lib/woundUtils.js` :
1. Récupère le count actuel de (char_sheet_id, location, severity)
2. Si count >= maxCount - 1 ET next severity existe → supprime toutes les blessures de ce type + promotion récursive
3. Si count >= maxCount (après promotion impossible) → AppError 400 (gravité maximale atteinte)
4. Sinon → INSERT nouvelle blessure
5. Retourne { wound, promoted }

`WOUND_MAX_COUNTS` vient de `shared/woundConstants.js`.
Exemple : corps/legere = 3 max (à vérifier).

---

## FICHIERS NON MODIFIÉS EN SPRINT 7.3/7.4 (mais référencés)

- `server/src/lib/charStats.js` — calcResistanceDommages, calcResistanceArmure, calcSeuils, getShockMalus, calcCarenceArmure, calcWoundPenalty, calcEncumbrancePenalty
- `server/src/routes/character/char-sheet.js` — GET /:characterId/weapon-skill/:weaponInvId (Sprint 7.2)
- `shared/woundConstants.js` — SEVERITY_COLORS, WOUND_MAX_COUNTS, WOUND_SEVERITIES
- `shared/armorConstants.js` — SLOT_TO_WOUND_LOCATION, LOCATION_LABELS
- `shared/polarisUtils.js` — polarisRound (PI11)
- `client/src/stores/combatStore.js` — phase, roster, activeSlotIdx, actions
- `client/src/components/CombatModifiersWindow.jsx` — Sprint 7.2 confirmé fonctionnel
