# AGENTS.md — Contrat Codex du projet Enclume

Ce fichier impose à Codex le même contrat de travail que `CLAUDE.md` impose à Claude.

## Chargement obligatoire

1. Lire entièrement `CLAUDE.md` avant la première action sur une nouvelle tâche du dépôt.
2. Lire entièrement `.claude/rules/conventions.md`.
3. Examiner le frontmatter `paths` de chaque fichier `.claude/rules/*.md` et lire entièrement toute
   règle correspondant aux fichiers consultés ou modifiés.
4. Si le périmètre change pendant la tâche, charger les nouvelles règles avant d'agir.
5. Une compaction de conversation ne recommence pas une tâche déjà accomplie : reprendre depuis
   l'état réel du dépôt et le plan courant.

Codex ne chargeant pas automatiquement `.claude/rules`, ce routage manuel est obligatoire.

## Exécution

- Respecter toutes les priorités, autorités, validations et règles Git de `CLAUDE.md`.
- Lire les sources concernées avant tout diagnostic ou changement.
- Chercher la cause racine et protéger l'architecture, même si une refonte cohérente est nécessaire.
- Préserver tout changement utilisateur déjà présent dans le worktree.
- Ne jamais agir sur le dépôt, la base, les assets ou les services de l'autre développeur sans demande
  explicite visant précisément cet espace.
- Une demande de modification autorise son implémentation : présenter le périmètre utile, puis agir
  sans redemander la même permission.
- Ne demander une décision que si elle change réellement le produit, les données ou le périmètre.
- Employer le serveur comme autorité et le client comme prévisualisation/intention.
- Pour toute propriété spatiale, appliquer `world.md` et refuser un second moteur implicite.
- Avant livraison, relire le diff, lancer les validations proportionnées et distinguer clairement
  **Testé** de **Non testé**.

## Documentation

Les documents du dépôt sont des sources de vérité, pas des substituts au code observé. Toute
modification structurelle doit laisser assez de documentation pour qu'un autre développeur puisse
reprendre sans reconstituer l'intention depuis l'historique de conversation.
