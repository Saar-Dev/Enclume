# Maquette — réaction du blessé (Chance)

> Subordonnée à [`../PLAN_CHANCE.md`](../PLAN_CHANCE.md) §8 (lots 6b/6c). Aucune décision ici : ce dossier matérialise
> dans le dépôt la maquette validée ou à valider par Saar (règle : un chantier dont le livrable est un rendu visuel
> n'est pas prêt à coder tant que la maquette n'est pas dans le dépôt). Archivée avec le plan à sa clôture.

| Fichier | Rôle |
|---|---|
| `preview.html` | Rendu statique navigable des 9 planches (A-I) — ouvrir dans un navigateur. |

**Statut (2026-09-25)** : maquette validée par Saar, implémentée à l'identique (lots 6a-1 et 6c, validés en jeu) — `WoundReactionDock.jsx` ; le bandeau MJ « Tour en attente » (planche G) reste à faire (lot 6a-3).

## Ce que la maquette fixe / ne fixe pas
- **Fait autorité** : la structure du composant (résumé, bouton Chance qui déplie les coûts, bouton Accepter, compte à
  rebours ou mention « le Tour attend »), l'absence de fenêtre quand il n'y a rien à décider, la pile compacte pour
  plusieurs blessés, le bandeau MJ « Tour en attente », l'ancrage (au-dessus du compte rendu de dégâts).
- **Ne fait PAS autorité** : les valeurs visuelles (palette, tailles, polices) — la source est
  `client/src/index.css` (jetons copiés en tête de `preview.html`) ; les textes — propositions, à passer par i18n.
- Couleur de la gravité « Mort subite » : `#5c5c66` (gris, `shared/woundConstants.js`) ; peu contrastée sur fond sombre,
  à juger sur la planche A.
