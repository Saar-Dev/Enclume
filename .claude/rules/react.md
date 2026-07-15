---
description: Composants React, hooks, stores et rendu client
paths:
  - "client/src/**/*.jsx"
  - "client/src/**/*.js"
  - "client/src/**/*.css"
---

# React et client

- Respecter les règles des hooks; aucune condition autour d'un hook et dépendances exhaustives.
- Un listener Socket.IO est enregistré avec une fonction stable puis retiré avec la même référence.
- Les effets libèrent listeners, timers, observers, contrôles Three.js et ressources GPU créées.
- Les stores contiennent l'état partagé; éviter une seconde copie locale divergente.
- Le client prévisualise une intention mais n'est pas autoritaire sur les résultats métier ou spatiaux.
- Les interactions de sélection, aperçu, validation et annulation doivent former un état explicite.
- Une ouverture de panneau ou tooltip ne doit pas provoquer la perte de la sélection qu'il édite.
- Les tooltips restent intégralement dans le viewport, se repositionnent après redimensionnement et
  peuvent être déplacés si le composant le prévoit.
- Tout texte utilisateur passe par i18n; conserver les clés existantes et ajouter toutes les langues
  requises par le projet.
- Réutiliser les composants et styles du design existant; éviter les styles inline dupliqués.
- Avec Three.js, cloner un matériau avant de modifier une instance et disposer géométries, matériaux
  et textures uniquement lorsqu'ils ne sont plus partagés.
- Les aperçus de rotation, échelle et pose sont réversibles jusqu'à confirmation serveur.
