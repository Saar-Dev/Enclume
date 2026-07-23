# CLAUDE.md — Contrat commun du projet Enclume

> Version proposée : 2026-07-15.
> Ce contrat s'applique aux espaces Claude/règles et Codex/moteur monde après validation et
> installation dans le dépôt.

---

## 1. Priorités absolues

1. Le code et les données observées priment sur la mémoire et la conversation.
2. Lire les fichiers concernés avant de diagnostiquer ou modifier.
3. Chercher la cause racine ; ne jamais empiler des rustines sur une architecture incohérente.
4. Une propriété métier ou physique possède une autorité unique.
5. Préserver les changements existants et ne jamais réinitialiser un worktree sans autorisation.
6. Une modification n'est terminée qu'après validation proportionnée au risque.
7. Signaler séparément ce qui est testé et ce qui ne l'est pas.
8. Un résumé de conversation aide à continuer ; il ne remplace pas la lecture des fichiers utiles.

Hiérarchie documentaire : Livre de Base Polaris > `FOUNDATION` > `VOCABULARY` > `SYSTEME` >
règles domaine > `MANUEL` > `PLAN`.

---

## 2. Routage des règles

- Claude charge `.claude/rules/*.md` selon leur frontmatter `paths`.
- Codex lit manuellement `.claude/rules/conventions.md`, puis chaque règle dont un `paths`
  correspond aux fichiers qu'il va toucher.
- Une règle domaine ne remplace jamais la lecture du fichier source concerné.
- Avant un nouveau concept métier, lire ou mettre à jour `docs/VOCABULARY.md`.
- Avant un nouveau document, lire `docs/RegleDocumentaire.md` et vérifier sa responsabilité unique.
- Pour le monde 3D, lire `docs/SYSTEME/MOTEUR_MONDE.md` et `.claude/rules/world.md`.
- Pour le combat, lire `docs/REGLES/REGLESYSCOMBAT.md`, `docs/SYSTEME/COMBAT.md` et
  `.claude/rules/combat.md`.
- Avant de conclure qu'aucun piège connu ne couvre un sujet, vérifier `docs/SYSTEME/CONVENTIONS.md`
  §19 (index maître des codes P/PE/PC/PI) — les `rules/` routées ne pointent qu'une partie du domaine,
  l'index est la source complète.

---

## 3. Espaces de travail

| Développeur | Branche | Dépôt serveur | Client/API |
|---|---|---|---|
| Claude / règles | `dev/Saar` | `/home/didier/Enclume` | `8193/8194` |
| Codex / moteur monde | `dev/monde` | `/home/codex/Enclume-integrated` | `8293/8294` |
| Validation commune | `integration` | `/home/codex/Enclume-fusion` | `8393/8394` |

- Ne jamais développer directement dans `integration` ou `master`.
- Ne jamais modifier le worktree de l'autre développeur pendant son travail.
- `.env`, PostgreSQL, MinIO, caches et `node_modules` restent propres à chaque instance.
- La fusion du code ne fusionne jamais implicitement les données vivantes.
- Le workflow complet et le retour arrière sont dans `docs/WORKFLOW_FUSION.md`.
- Les autorités combat/monde sont dans `docs/FUSION_PROJET_COUSIN.md`.

---

## 4. Synchronisation Git sûre

Avant une nouvelle tâche dans un dépôt :

```bash
git status --short --branch
git branch --show-current
git fetch origin
```

- Si le worktree est sale, identifier et préserver les modifications avant toute synchronisation.
- Si la branche possède un upstream publié, avancer uniquement avec `git merge --ff-only`.
- Ne jamais utiliser un `git pull` aveugle, `reset --hard`, `checkout --` ou nettoyage destructif.
- Si l'upstream n'existe pas encore, ne pas inventer de synchronisation : signaler la publication
  manquante et suivre `WORKFLOW_FUSION.md`.
- Avant fusion : noter les têtes, créer les tags de restauration et sauvegarder code, DB et assets.
- Après validation commune : replacer les deux branches de travail sur le commit `integration`
  seulement lorsque toutes leurs contributions sont déjà absorbées.

---

## 5. Collaboration à deux

- Une tâche active possède une ligne `🔒 En cours (Dev) : ...` dans `docs/EN_COURS.md`.
- La ligne est posée sur la branche du développeur et retirée au commit de clôture.
- Une correction de bug traite une cause racine atomique à la fois.
- Plusieurs fichiers peuvent changer ensemble s'ils implémentent le même invariant.
- Une demande regroupant plusieurs fonctionnalités est découpée en étapes vérifiables.
- Format des journaux et commits : `Session N (Dev) — Titre`.
- Après une tâche fonctionnellement confirmée : commit sur la branche du développeur puis push de
  cette branche, jamais push direct vers `master` ou `integration`.
- La publication distante manquante est un blocage de diffusion, pas une permission d'emprunter les
  identifiants de l'autre développeur.

### Migrations

- Numéros pairs : Codex / moteur monde ; numéros impairs : Claude / règles.
- Vérifier les fichiers présents et `knex_migrations` avant de choisir un numéro.
- Une migration doit être rétrocompatible avec le code encore déployé pendant la fusion.
- Migration, test et éventuel script de réparation forment un commit isolé sur la branche de travail.
- Ne pas fusionner ni déployer ce commit avant validation de la migration et du code consommateur.
- Ne jamais appeler manuellement `up()` deux fois ; vérifier d'abord le journal Knex.
- Ne jamais utiliser la CLI Knex brute pour tester le rollback d'une migration précise mal triée.
- Éviter tout fichier de test temporaire sous `server/` : un watcher peut appliquer la migration.

---

## 6. Avant de coder

1. Lire les règles routées, les fichiers concernés et leurs appelants directs.
2. Pour une UI, inventorier boutons, champs, handlers, sélection et persistance concernés.
3. Pour un bug, reproduire ou instrumenter avant d'affirmer la cause.
4. Lecture seule = hypothèse ; observé en exécution ou par test = vérifié.
5. Présenter le plan exact : fichiers, invariant, changements et hors périmètre.
6. Si l'utilisateur a déjà demandé la modification, coder sans redemander une autorisation identique.
7. Demander une décision uniquement si elle change réellement le produit, les données ou le scope.
8. Un plan ne couvre qu'un seul bug ou problème à la fois ; le suivant attend la validation du précédent.

Termes interdits sans preuve : « probablement », « certainement », « évidemment ». Employer
`[INCONNU]`, formuler l'hypothèse et définir l'instrumentation qui la tranche.

---

## 7. Pendant le développement

- Modifier avec des patchs ciblés ; ne pas réécrire un fichier entier inutilement.
- Préserver les changements utilisateur, même non liés à la tâche.
- Réutiliser les événements, services, composants, stores et utilitaires existants avant d'en créer.
- Aucun événement WebSocket en string libre : registre unique `shared/events.js`.
- Pas de logique métier dupliquée entre client et serveur.
- Le serveur reste autoritaire ; le client prévisualise et envoie une intention.
- Une apparence 3D ne devient jamais une collision implicite.
- Un test temporaire reste hors des dossiers surveillés et hors du dépôt partagé.
- Les validations techniques automatisables n'exigent pas une pause utilisateur entre chaque étape.
- Une validation utilisateur reste requise pour fermer un comportement visuel ou une règle de jeu.

---

## 8. Autorité du moteur monde

Le `WorldSnapshot` (compilé depuis `surface_data` v12 par `worldCompiler.js`) est l'autorité unique
des supports, barrières, collision, occupation, LOS et navigation ; PostgreSQL est durable, Redis et
`voxel_data` ne sont jamais l'autorité spatiale. Détail complet et invariants actifs, auto-chargés dès
qu'un fichier du périmètre est touché : `.claude/rules/world.md` + `docs/SYSTEME/MOTEUR_MONDE.md`.

---

## 9. Contrat avec le combat

La FSM combat orchestre le non-spatial (initiative, compétences, actions, dégâts, armures) ; toute
décision spatiale passe par les services `world*`, jamais une lecture directe de `surface_data`,
Three.js ou `voxel_data`. Détail complet et invariants actifs, auto-chargés dès qu'un fichier du
périmètre est touché : `.claude/rules/combat.md` + `docs/SYSTEME/COMBAT.md`.

---

## 10. Documentation

- `docs/EN_COURS.md` est la source unique des dettes et de la prochaine étape.
- `docs/JOURNAL6.md` conserve les décisions et validations durables, pas les notes de réflexion.
- Le scratch analytique est local et ignoré par Git ; ne pas partager `JOURNALTEMP.md` entre devs.
- `docs/ASBUILT.md` décrit ce qui est réellement déployé et stable.
- `docs/ROADMAP.md` décrit la suite, sans dupliquer les dettes.
- `client/public/CHANGELOG.md` décrit les changements visibles par les utilisateurs.
- Mettre à jour la date des documents réellement modifiés.
- Une règle domaine contient des invariants actifs, jamais une dette ni un long historique de session.

---

## 11. Validation et clôture

- Relire le diff et les fichiers produits avant livraison.
- Exécuter les tests ciblés, puis les tests transverses proportionnés au risque.
- Pour le monde : tests Node, test Surface, build client et scénario multi-étages.
- Pour le combat : tests métier, transport WebSocket/REST et scénario réel concerné.
- Pour une fusion : appliquer intégralement `WORKFLOW_FUSION.md`.
- Vérifier `git diff --check`, le statut du worktree et l'absence de secrets.
- Ne pas corriger automatiquement les vulnérabilités npm avec `--force`.

Toute clôture indique :

- **Testé :** commandes et scénarios réellement exécutés ;
- **Non testé :** ce qui reste ; si non vide, marquer `⚠️ clos partiel` ;
- **Données :** migrations, imports ou effets runtime éventuels ;
- **Retour arrière :** tag, sauvegarde ou commit applicable si le risque le justifie.

---

## 12. État courant

Le détail courant vit uniquement dans `docs/EN_COURS.md`.

Base commune initiale : tag `baseline/common-20260715`, branches `dev/Saar`, `dev/monde` et
`integration`, trois arbres identiques au commit documenté par le workflow. L'instance commune est
un sas de validation, jamais un espace de développement direct.

---

## 13. Détecteur de dérive

STOP si l'une de ces situations apparaît :

- diagnostic sans lecture ni instrumentation ;
- correctif proposé sur une cause `[HYPOTHÈSE]` non instrumentée, ou bug non reproductible analysé
  sans documenter d'abord les conditions ;
- solution « temporaire »/« pour l'instant », second moteur ou fallback legacy — sur tout domaine,
  pas seulement spatial ;
- nouvel événement, service ou composant sans recherche d'un équivalent ;
- nouveau terme métier ou mécanique nommée sans vérification de `docs/VOCABULARY.md` ;
- nouveau fichier `docs/*.md` créé sans vérifier sa responsabilité unique (`docs/RegleDocumentaire.md`) ;
- mécanique de combat implémentée sans avoir lu `docs/REGLES/REGLESYSCOMBAT.md` dans la session ;
- migration sans audit du numéro, du journal et du redémarrage automatique ;
- « Je code ? » posé une deuxième fois sur le même sujet — plan complet, coder directement ;
- plan couvrant deux bugs ou problèmes ou plus ;
- modification du dépôt, de la base ou des assets de l'autre développeur ;
- push direct vers `master` ou `integration` ;
- clôture sans « Testé / Non testé » ;
- dette copiée dans plusieurs documents ;
- résumé utilisé pour refaire, oublier un travail déjà terminé, ou sauter la lecture de reprise de
  session.
