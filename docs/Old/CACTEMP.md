# CACTEMP.md — Scratch pad CaC (session 2026-06-12)
> Périssable. Ne pas inclure dans lecture obligatoire.
> Consolider vers MANUELSYSCOMBAT.md + JOURNAL4.md en fin de session.

---

## Objectif

Corriger et compléter §6.2 de `docs/MANUELSYSCOMBAT.md` (Combat au Contact humanoïde).
Créer §6.9 Arts martiaux.
Clarifier drone CaC pour §7 (investigation code requise avant écriture).

Sources lues cette session :
- `docs/Old/REGLES_Contact.md` ✅
- `docs/MANUELSYSCOMBAT.md` ✅
- `docs/SYSTEME/BLESSURES.md` ✅
- `docs/SYSTEME/COMBAT.md` ✅
- `docs/BUGIDENTIFIE.md` ✅
- `server/src/socket/index.js` (resolveDroneAssaultAction) ❌ PAS LU — requis avant §7

---

## §6.2 — Ce qui est vérifié et prêt à écrire

### [4] Formule dégâts — CORRIGÉE (deux corrections)

**Dommages_Bruts :**
```
Règle LdB  : Dommages_Arme + MR + ModDom(FOR_attaquant)
Implémentation V1 : rawDice + ModDom(FOR_attaquant)     ← MR absent — dette connue Session 67
```

**Dommages_Nets :**
```
Dommages_Nets = max(0, Dommages_Bruts - etq - rd)
  etq = calcResistanceArmure(armures équipées, localisation touchée).etq   [mille-feuille]
  rd  = calcResistanceDommages(FOR_na_cible, CON_na_cible)                 [table RD_TABLE, positif ou négatif]
```

### Modes de combat — VÉRIFIÉ (implémenté Session 68)

| Mode | Mod attaque | Mod défense | Contrainte |
|---|---|---|---|
| `normal` | ±0 | ±0 | — |
| `offensif` | +3 | −5 (jusqu'à prochaine action) | — |
| `charge` | +3 attaque, +3 dommages | −7 (jusqu'à prochaine action) | dist > 3m, déplacement court gratuit, **→ voir §6.4 exclusivité** |
| `defensif` | pas d'attaque | +3 | action retardée obligatoire |
| `retraite` | pas d'attaque | +5 | action retardée + recul gratuit |

Stockage DB : `combat_roster.state_combat_mode` (TEXT). Reset à `'normal'` chaque `endTurn`.
Déclaration : ANNOUNCEMENT uniquement — ne peut pas changer de mode hors déclaration.

### Multi-adversaires — VÉRIFIÉ (implémenté Session 72)

Malus appliqué à l'attaque ET à la défense.

| Adversaires distincts en portée CaC | Malus |
|---|---|
| 2 | −5 |
| 3 | −7 |
| 4+ | −10 |

"En portée CaC" = distance PE14 ≤ 3m + allonge_max de l'adversaire.
Max 4 adversaires simultanés (au-delà → ils se gênent mutuellement, LdB p.224).

### Allonge — VÉRIFIÉ (pas d'implémentation serveur V1 — client affichage seulement)

Règle exacte : quand les deux combattants ont une allonge, seul le personnage avec la **plus grande** allonge garde un bonus = `allonge_lui - allonge_adversaire`. L'autre ne gagne rien.
Double tranchant : si le bénéficiaire de l'allonge perd le test → l'adversaire peut casser la distance (arme difficile à manœuvrer au corps à corps).

---

## §6.9 Arts martiaux — VÉRIFIÉ, non implémenté V1

**Compétence limitative** sur Combat à mains nues / Combat armé (limite le niveau utilisé).
Une seule technique par Tour de combat.

### Techniques offensives
*Condition : Initiative ≥ adversaire, mode Normal/Offensif/Charge.*

| Technique | Mécanique |
|---|---|
| Frappe puissante | +3 dommages (+6 si Charge) |
| Frappe incapacitante | Dommages normaux + Test Choc défenseur malus −5 (cumule si blessure déclenche aussi un Choc) |
| Frappe précise | Malus localisation ciblée réduits de 3 |
| Enchaînement | Attaques multiples — malus réduits vs règle générale : 2 attaques (+0/−3), 3 attaques (−3/−5/−7). Voir §6.3. |
| Combat à deux armes | +3 (déjà compté) + attaque supplémentaire gratuite à −5 |
| Balayage | Succès attaque → défenseur Test COO. Échec : perd (5 + MR) INI sur prochaine action. Catastrophe : chute. Intersection §3 (mutation INI). |

### Techniques défensives
*Condition : mode Normal/Défensif/Retraite.*

| Technique | Mécanique |
|---|---|
| Garde de combat | Adversaire −3 au test |
| Contre-attaque simultanée | Mode Défensif seulement — Test combat −5 pour contre-attaquer dans le même mouvement |
| Esquive | Retraite sans obligation de reculer physiquement |
| Combat à deux armes | +3 en défense |
| Défense multi-adversaires | Malus multi-adversaires réduits de 3 |
| Dégagement/saisie | Test AM(Techniques déf.) pour se libérer d'une prise adverse |

### Lutte
*Condition : modes Normal/Offensif/Défensif, corps à corps strict.*

Saisie = Préparation −3 INI (déclarée en ANNOUNCEMENT). **→ voir §6.6.**
Si saisie réussie → choix : Clé/Immobilisation / Étranglement / Projection.

---

## §7 Drone CaC — INVESTIGUÉ (socket/index.js ligne 3731-3733)

### Verdict `bout_portant`

```js
// socket/index.js ligne 3731-3733 (actuel)
// armement_contact : toujours bout_portant — drone en contact physique, pas de fenêtre modificateurs
const portee = (category === 'armement_contact') ? 'bout_portant' : (confirmedModifiers?.portee ?? 'courte')
let totalModComp = PORTEE_MOD_COMP[portee] ?? 0  // bout_portant → +5 APPLIQUÉ RÉELLEMENT
```

**C'est un bug.** Le +5 entre dans `chancesDeReussite`. Ce n'est pas un artefact inoffensif.

### Modificateurs légitimes pour `armement_contact` drone (§7.3)

| Modificateur | Applicable | Raison |
|---|---|---|
| Portée | **NON** | Contact physique ≤ 3m = portée satisfaite par définition. Pas de modificateur (0). |
| Taille cible | OUI | `TAILLE_MODS[confirmedModifiers.taille]` |
| Obscurité | OUI | via `confirmedModifiers.situation` |
| Couverture | OUI | via `confirmedModifiers.situation` |

### Fix requis — Sprint CaC Drone

```js
// Remplacer lignes 3731-3733 :
const porteeModComp = (category === 'armement_contact')
  ? 0
  : (PORTEE_MOD_COMP[confirmedModifiers?.portee] ?? 0)
let totalModComp = porteeModComp
```

Retirer aussi `porteeModDrone` du breakdown (ligne ~3752) si `armement_contact`.

### Ce qui est confirmé pour §7

- Test SIMPLE (D20 ≤ niveau programme `armement_contact`) — pas de test d'opposition
- Pas de `CombatModifiersWindow` (flow "Agir" direct)
- Modificateurs légitimes : taille, obscurité, couverture — **portée = 0 (pas de modificateur)**
- Localisation : zone fixe `drone_sheet.localisation_ref` (§7.6) — pas de D20
- Bug `bout_portant` (+5) : confirmé dans le code — à corriger Sprint CaC Drone

---

## Checklist avant écriture dans MANUELSYSCOMBAT.md

- [x] Formule Dommages_Nets corrigée et vérifiée source
- [x] Dommages_Bruts divergence règle/impl documentée
- [x] Modes de combat vérifiés (impl + règles)
- [x] Multi-adversaires vérifié (impl + règles, attaque ET défense)
- [x] Allonge formulation précise
- [x] Arts martiaux synthèse (règles uniquement, non impl V1)
- [x] Drone CaC — bout_portant investigué, bug confirmé, fix documenté
- [x] BUGIDENTIFIE.md — ajouter bug bout_portant (nouveau bug distinct de DC1/DC2) ✅ DC3 ajouté session précédente
