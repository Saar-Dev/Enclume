# SCRATCH Session 64 — Sprint 7.3 display
> Fichier temporaire de travail. NE PAS COMMITTER. Supprimer après session.

## État actuel (après fix)

### Implémenté ✅
- Attack roll : DICE_RESULT sans skillLabel → chat standard + animation D20
- Damage roll : DICE_RESULT avec skillLabel → chat structuré, zone incluse dans label
- WOUND_ADDED → SessionPage → woundVersions → CharacterWindow → bumpInventoryVersion → ArmorWoundPanel reload

### Pas encore implémenté ❌
- Localisation roll : calculée en interne, NON diffusée en DICE_RESULT
- Affichage COMBAT_ATTACK_RESULT dans CombatOverlay (Sprint 7.4)
- Fenêtre joueur pour localisation + dégâts (non documenté PLAN11 — à clarifier)
- Couleur blessure dans chat (nécessite Sidebar.jsx modification)

---

## Questions en attente de confirmation Saar

**Q1 — Fenêtre joueur localisation+dégâts :**
PLAN11 ne documente pas ce comportement. Est-ce Sprint 7.4 (display CombatOverlay) ?
Ou nouvelle exigence à documenter maintenant ?

**Q2 — Format jet localisation dans chat :**
Proposition : DICE_RESULT avec skillLabel='Localisation — Distance', total=rollLoc, 
chancesDeReussite=label zone (ex: 'Corps'). Sidebar affichera "Localisation — Distance | 7 | Corps".
Acceptable sans toucher Sidebar.jsx ?
Alternative : modifier Sidebar.jsx pour interactionType='combat_localisation'.

**Q3 — Couleur blessure dans chat :**
DICE_RESULT.color = couleur joueur (bleu/rouge perso). Impossible de mettre la couleur de gravité
sans modifier Sidebar.jsx (nouveau interactionType='combat_damage').
Confirme qu'on touche Sidebar.jsx ?

---

## Fichiers à modifier (approuvés)

| Fichier | Changement | Statut |
|---|---|---|
| server/src/socket/index.js | + DICE_RESULT localisation | EN ATTENTE confirmation Q2 |
| server/src/socket/index.js | update DICE_RESULT damage label/color | EN ATTENTE confirmation Q3 |
| client/src/components/Sidebar.jsx | nouveau interactionType combat | EN ATTENTE confirmation Q2/Q3 |
| client/src/components/CombatOverlay.jsx | affichage COMBAT_ATTACK_RESULT | Sprint 7.4 |

---

## Tables localisation Polaris (PLAN11 p.228)

### Distance (V1 actuel)
| Jet 1d20 | Zone | slotCode | wound_location |
|---|---|---|---|
| 1-2 | Tête | T | tete |
| 3-8 | Corps | C | corps |
| 9-11 | Bras Droit | BD | bras_droit |
| 12-14 | Bras Gauche | BG | bras_gauche |
| 15-17 | Jambe Droite | JD | jambe_droite |
| 18-20 | Jambe Gauche | JG | jambe_gauche |

### Contact (V2 — reporté)
Non documenté encore dans PLAN11.

---

## Formule complète vérifiée

```
CDR = skillTotal + totalModComp + effectiveMalus - carenceArmure
roll <= CDR → TOUCHE
mr = CDR - roll (positif si touche)

Localisation : 1d20 → table distance → slotCode → wound_location

degautsBruts = parseDice(weapon.ref_damage_h) + getModifier(mrTable, mr) + modDegatsMode
rd = calcResistanceDommages(for_na_cible, con_na_cible)
degatsNets = max(0, degautsBruts - etq - rd)

Gravité : ≥30 mortelle+lethal | ≥25 mortelle | ≥20 critique | ≥15 grave | ≥10 moyenne | ≥5 légère
```

---

## SEVERITY_COLORS (woundConstants.js — à vérifier)
À lire avant de coder la couleur chat.
