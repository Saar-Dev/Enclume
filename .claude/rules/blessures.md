---
description: Blessures, promotions, pénalités et interaction avec les armures
paths:
  - "server/src/**/*blessure*.js"
  - "server/src/**/*wound*.js"
  - "server/src/**/*armure*.js"
  - "client/src/**/*Blessure*.jsx"
  - "client/src/**/*Wound*.jsx"
  - "client/src/**/*Armure*.jsx"
---

# Blessures et armures

Lire `docs/REGLES/REGLEARMURE.md` et la section blessures des règles de combat.

- Le serveur calcule et persiste les blessures; le client ne décide jamais de leur niveau final.
- Appliquer les promotions de blessure dans l'ordre prévu, sans sauter un palier intermédiaire.
- Les arrondis sont effectués à l'étape définie par la règle, pas prématurément dans l'UI.
- Une pénalité n'est appliquée qu'aux jets et actions explicitement couverts par la règle.
- L'armure absorbe, transforme ou transmet les dégâts selon son état et sa zone couverte.
- Toute usure ou rupture d'armure est persistée atomiquement avec la conséquence qui la provoque.
- Conserver la provenance des dégâts et les identifiants nécessaires à l'audit du combat.
- Tester seuils exacts, valeurs immédiatement sous/au-dessus, promotions multiples et armure épuisée.
