---
description: Assets 3D, packs, MinIO, cache et séparation apparence/physique
paths:
  - "server/src/**/*asset*.js"
  - "server/src/**/*Asset*.js"
  - "client/src/**/*Asset*.jsx"
  - "client/src/**/*asset*.js"
  - "shared/**/*asset*.js"
---

# Assets

- Chaque instance utilise son propre bucket MinIO; ne jamais partager implicitement les assets vivants.
- Un pack possède un UUID stable et des chemins déterministes; son nom affiché n'est pas son identité.
- Après publication, un nom ou chemin d'asset référencé reste immuable; créer une nouvelle version.
- Les URL GLB incluent la version/cache key prévue (`?v=` ou équivalent centralisé).
- Les routes statiques de packs précèdent les routes paramétrées qui pourraient les intercepter.
- Valider type, taille, chemin, droits et intégrité avant stockage ou import.
- Un import est idempotent ou détecte explicitement les doublons; il ne remplace pas silencieusement.
- Le GLB, la texture et l'icône décrivent l'apparence. Collision, support, coût, occlusion et capacités
  sont déclarés séparément dans le modèle monde.
- Nettoyer les fichiers orphelins seulement après preuve qu'aucune donnée durable ne les référence.
- Ne jamais copier `.env`, identifiants MinIO ou secrets avec un pack ou dans la documentation.
