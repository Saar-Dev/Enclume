---
# Pas de paths — chargé à chaque session (maintenir < 20 lignes)
---
# Conventions & Glossaire

**Ambiguïtés termes → `docs/VOCABULARY.md`** | **Conventions détail → `docs/SYSTEME/CONVENTIONS.md`**

- SR = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- Félicitations ≠ validation. `[INCONNU]` + `[DBG-X]` pour toute cause non lue.
- "Seuil" dans l'UI joueur — jamais "CDR" (terme interne).
- Avant tout nouvel event WS / composant / fonction utilitaire → vérifier `shared/events.js` + `client/src/` + `server/src/lib/` — existe déjà ?
- `style={}` JSX = layout/position calculé uniquement — jamais visuel. Valeurs dynamiques → CSS custom property.
