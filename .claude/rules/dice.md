---
description: Dés, résultats déterministes, calibration et transport des jets
paths:
  - "server/src/**/*dice*.js"
  - "server/src/**/*Dice*.js"
  - "client/src/**/*Dice*.jsx"
  - "client/src/**/*dice*.js"
  - "shared/**/*dice*.js"
---

# Dés

- Le serveur est autoritaire sur le jet, sa graine, son horodatage et son résultat métier.
- Un événement `DICE_RESULT` peut ne pas porter `dieType`; le consommateur le déduit du contexte
  contractuel plutôt que d'inventer une valeur silencieuse.
- Même graine et mêmes paramètres doivent reproduire le même résultat logique.
- La physique ou l'animation 3D illustre le résultat; elle ne le remplace pas.
- La calibration utilise la route et l'outil dédiés du projet, avec paramètres validés et versionnés.
- Un jet possède un identifiant stable pour éviter double application après reconnexion ou répétition.
- Les payloads utilisent le registre `shared/events.js` et restent compatibles entre émetteur et
  consommateurs dans un même commit de fusion.
- Ne jamais journaliser un secret permettant de prédire des jets futurs.
- Tester déterminisme, bornes, distribution utile, reconnexion et absence de double résolution.
