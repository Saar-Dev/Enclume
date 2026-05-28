# JOURNALTEMP — Mémoire externe de travail
> Dernière mise à jour : 2026-05-28 session 65
> Usage : mémoire de travail entre sprints. Écraser à chaque mise à jour.

---

## STATUT ACTUEL

| Sprint | État | Bloqué par |
|---|---|---|
| Sprint Pathfinding | ✅ CONFIRMÉ FONCTIONNEL | — |
| Sprint Raycast | ✅ CONFIRMÉ FONCTIONNEL | — |
| Sprint GM-B — Move PNJ | ✅ CONFIRMÉ FONCTIONNEL | — |
| Sprint GM-B — Assault PNJ (Mode Minimal) | Plan complet — prêt à coder | rien |
| Sprint Waypoints | En attente | priorité basse |

---

## SPRINT GM-B — Assault PNJ (Mode Minimal)
> Plan valide — indépendant du Sprint GM-B Move.

### Props à ajouter (CombatOverlay → CombatGmDeclareWindow)
```jsx
battlemapId={battlemap?.id}
onEnterTargetMode={onEnterTargetMode}
combatTargetMode={combatTargetMode}
onValidateTarget={onValidateTarget}
```

### State à ajouter dans CombatGmDeclareWindow
```js
const [assaultSelections,    setAssaultSelections]    = useState({})
const [currentTargetTokenId, setCurrentTargetTokenId] = useState(null)
const [equipment,            setEquipment]            = useState({})
```

### Format /combat-equipment (GET /:id/combat-equipment)
```json
{ "equipment": { "<tokenId>": { "characterId": N, "weapon": { "inv_id": N, "name": "...", "slot": "MD" }, "armorPieces": [...] } } }
```

### Payload attack
```js
attack: weapon && assault?.targetTokenId ? {
  weaponInvId: weapon.inv_id, targetTokenId: assault.targetTokenId,
  bulletCount: 1, fireModeBonusComp: 0, fireModeBonusDmg: 0,
  isDualWield: false, dualWieldBonusComp: 0,
} : null
```

---

## SPRINT WAYPOINTS — Discussion
> Priorité basse. À traiter après un tour de combat fonctionnel complet.

- Waypoints = partie intégrante de la déclaration serveur (pas juste visuel)
- Interface : alt+clic ajoute une case avec liseré blanc ; alt+clic sur waypoint l'annule
- Le serveur doit recevoir la liste ordonnée de waypoints pour reconstruire le chemin exact
