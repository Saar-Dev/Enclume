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
- Une migration qui cible une ligne d'une table peuplée par seed (ex. `ref_equipment`) ne référence
  jamais son `id` en dur : les seeds (`server/src/db/seeds/`) laissent PostgreSQL générer l'UUID à
  l'insertion et ne garantissent l'idempotence que par clé métier (`name`) — deux instances seedées
  indépendamment ont des `id` différents pour la même ligne. Matcher par la clé métier de la table
  (vérifiée dans le seed correspondant), jamais par `id` (vécu : migration 209, `id` codé en dur
  valide en local, introuvable sur Kiwi seedé séparément).
- **Interdiction formelle : ne jamais réutiliser `users.role === 'admin'` (`requireAdmin`) comme
  autorisation de confort pour un besoin métier plus étroit** (ex. « qui a le droit de créer un
  drone/une exo-armure hors campagne »). `admin` ouvre déjà la gestion des utilisateurs
  (`adminUsers.js`), les tickets admin (`adminTickets.js`) et le CRUD complet de `ref_equipment`
  (`equipment.js`) — l'emprunter pour autre chose donnerait ces droits-là à quiconque reçoit la
  permission visée. Une autorisation métier nouvelle (ex. MJ hors campagne) exige sa propre colonne/
  rôle explicite, jamais un détournement du rôle admin global.
