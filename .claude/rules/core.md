---
description: Authentification, HTTP, Socket.IO, stockage et fondations serveur
paths:
  - "server/src/**"
  - "shared/events.js"
  - "client/src/stores/**"
  - "client/src/hooks/useSocket*.js"
---

# Core serveur et transport

- PostgreSQL est la source durable; Redis sert uniquement les usages explicitement transitoires.
- Les accès DB passent par les services/repositories existants et respectent les transactions du flux.
- Tester `value == null` quand `null` et `undefined` signifient tous deux « absent ».
- Les routes Express statiques sont déclarées avant les routes paramétrées susceptibles de les capter.
- L'authentification utilise le mécanisme de session/token déjà centralisé; ne jamais exposer un secret
  dans le client, les logs ou une URL.
- Les cookies d'authentification restent `httpOnly` et suivent les politiques `secure`/`sameSite` de
  l'environnement déployé.
- Les événements Socket.IO sont déclarés dans `shared/events.js` avec un nom et un payload stables.
- Le serveur valide l'identité, les droits, le contexte et les données avant toute mutation.
- Une action mutante émet après succès l'événement nécessaire aux autres clients; éviter les doubles
  écritures optimistes et les boucles d'écho.
- Nettoyer listeners, rooms, timers, locks et ressources lors d'une déconnexion ou d'un échec.
- REST et Socket.IO d'une même fonctionnalité partagent le même service métier autoritaire.
- Ne pas créer de stockage spatial Redis: le moteur monde et PostgreSQL portent ces responsabilités.
