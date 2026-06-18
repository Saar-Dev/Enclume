---
paths:
  - "client/src/**/*.jsx"
  - "client/src/lib/use*.js"
---
# Domaine : React, Hooks & Composants

**Spec technique → `docs/SYSTEME/REACT.md`**
**Pattern hooks WS (REWORK-09 ✅) → `docs/ARCHI_REWORK_DONE.md`**

## Pièges critiques

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**P4/P48 — Ordre de déclaration**
Callback A qui appelle B doit être déclaré APRÈS B.
`handleEntityMove` déclaré APRÈS `handleEntityClick` (P48).

**TDZ — hooks après tous les useState (fix Session 103)**
Les hooks personnalisés (`useTokenSocket`, `useEntitySocket`, `useCombatSocket`) déclarés
APRÈS tous les `useState` de SessionPage — avant → Temporal Dead Zone silencieuse.

**Pattern listen(s) impératif (REWORK-09)**
```js
useEffect(() => {
  const s = io(...)
  tokenSocket.listen(s)   // impératif — pas dans les deps
  entitySocket.listen(s)
  combatSocket.listen(s)
  setSocket(s)
  return () => s.disconnect()
}, [campaignId, reconnectTrigger, loadSession])
```
`listen` n'est pas dans les deps (fonction ordinaire, pas useCallback). Les setters capturés sont stables.

**i18n — jamais de string UI hardcodée**
Toujours `useTranslation` → `t('section.cle')`.
Clé ajoutée dans `client/src/locales/fr.json` AVANT de l'utiliser dans le JSX.
Combat (12) + équipement (6) : hors scope — sprint dédié futur.

**CSS — jamais de `style={}` visuel**
`style={}` = layout/position calculé uniquement (width, flex, margin, top, zIndex calculé).
Classes visuelles → `index.css` Section 10/11.
Valeurs visuelles dynamiques → CSS custom property.

**Boutons / Badges**
- Bouton → `className="btn"` ou `.btn-ghost / .btn-danger / .btn-gold / .btn-icon / .btn-toggle / .btn-tool`
- Badge → `className="badge badge-gm"` etc.
- Modifier une classe CSS = modifier partout (classes partagées).

**mat.clone() avant mutation Three.js (P20)**
Jamais muter un material partagé directement.
