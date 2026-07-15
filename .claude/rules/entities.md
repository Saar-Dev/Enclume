---
description: Entités, tokens, personnages, transformations et occupation du monde
paths:
  - "server/src/routes/entities*.js"
  - "server/src/services/*entity*.js"
  - "client/src/**/*Entity*.jsx"
  - "client/src/**/*Token*.jsx"
  - "client/src/stores/*entit*.js"
  - "client/src/hooks/use*Entit*.js"
  - "shared/world/entityTransform.js"
---

# Entités et tokens

- PostgreSQL est l'autorité durable des entités et personnages.
- Le serveur vérifie campagne, propriétaire, droits et cohérence avant toute création ou mutation.
- Les transformations persistées suivent le contrat d'axes de `shared/world/entityTransform.js`.
- L'échelle persistante appartient à `state.transform.scale`; éviter une seconde représentation.
- Le modèle GLB est une apparence. Collider, volume occupé, capacités et règles viennent des données
  déclarées et du moteur monde.
- Placement et déplacement interrogent le `WorldSnapshot` et l'occupation runtime, jamais Redis,
  un voxel ou le mesh rendu.
- Le client envoie l'intention de placement/déplacement; le serveur renvoie l'état accepté.
- Une prévisualisation de translation, rotation ou échelle reste annulable avant confirmation.
- Les sockets mettent à jour le store central sans dupliquer l'entité ni écraser une édition locale
  en cours sans règle explicite de résolution.
- La suppression nettoie références, occupation et abonnements via le service autoritaire.
- Ne jamais confondre token de table, personnage de règles et asset visuel: leurs identifiants et cycles
  de vie restent distincts.
