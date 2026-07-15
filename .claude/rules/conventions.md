---
description: Conventions communes applicables à tout le dépôt
paths:
  - "**/*"
---

# Conventions

- Employer le vocabulaire défini dans `docs/VOCABULARY.md`; l'étendre avant d'introduire un concept.
- Lire les fichiers et leurs appelants utiles avant de diagnostiquer ou modifier.
- Distinguer `[OBSERVÉ]`, `[VÉRIFIÉ]`, `[HYPOTHÈSE]` et `[INCONNU]` dans les analyses sensibles.
- Une règle ou propriété possède une autorité unique; ne pas dupliquer la logique métier.
- Chercher la cause racine; une refonte cohérente vaut mieux qu'une succession de contournements.
- Préserver les changements existants, même hors périmètre.
- Aucun texte visible ne doit être codé en dur si le système i18n du contexte le couvre.
- Les événements temps réel viennent de `shared/events.js`, jamais de chaînes libres dispersées.
- Toute modification est accompagnée de tests proportionnés et d'une clôture **Testé / Non testé**.
- Les règles contiennent des invariants actifs; les dettes restent uniquement dans `docs/EN_COURS.md`.
