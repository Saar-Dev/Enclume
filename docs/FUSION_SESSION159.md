# FUSION_SESSION159.md — transmission du lot monde Session 159

> Préparé le 2026-07-22. Statut : **prêt à fusionner, pas encore intégré sur `8393/8394`**.

## Sources et périmètre

- source monde immuable : tag `handoff/world-session159-20260722` sur `dev/monde` ;
- dernier commit fonctionnel : `932a041` (`Session 159 suite 3 - Grilles mono-plan recto-verso`) ;
- dernière tête monde observée avant la clôture de cette fiche : `a78f9c9` ;
- base d'intégration observée : `355e388`, tag `baseline/common-20260718` ;
- dernière référence Saar visible depuis le worktree de fusion : `origin/dev/Saar` `1733aaa`, déjà
  absorbée par la base commune. Cette référence ne prouve pas que Saar n'a rien produit depuis : la
  tête active doit être rafraîchie ou confirmée par Saar au moment de la fusion.

Le tag de transmission inclut toute la Session 159 et sa documentation de recette. Le lot couvre
la remise à niveau Ubuntu/Node/npm, la trappe d'échelle, le matériau procédural de grille ajourée,
les plaques minces d'escalier et le rendu mono-plan recto-verso des surfaces ajourées. Il ne contient
aucune migration de base de données. Les volumes canoniques, collisions, supports et calculs de LOS
restent ceux de `surface_data` v13 et du `WorldSnapshot`.

## Validation du lot monde

- 141/141 tests monde/serveur ;
- 41/41 tests Surface ;
- 3/3 tests de configuration serveur ;
- ESLint ciblé et build Vite réussis ;
- rendu du vrai `SurfaceDungeonScene` depuis deux caméras opposées sans double grille ni exception ;
- services `8293/8294` actifs, health API vert et client HTTP 200 ;
- smoke Playwright Chromium distant réussi ;
- recette utilisateur acceptée le 2026-07-22.

Les instances Saar `8193/8194` et fusion `8393/8394` n'ont pas été modifiées pendant cette
préparation.

## Prévisualisation de merge

Un `git merge-tree --write-tree` entre `integration` `355e388` et la tête monde préparée montre que
les fichiers moteur et runtime se combinent automatiquement. Sept conflits préexistants sont à
résoudre :

1. `CLAUDE.md` : conserver les responsabilités fusionnées et l'environnement Node 24/npm 11 ;
2. `client/public/CHANGELOG.md` : conserver les deux historiques dans l'ordre chronologique ;
3. `docs/ASBUILT.md` : conserver les livraisons règles et monde ;
4. `docs/EN_COURS.md` : conserver les dettes des deux domaines et retirer seulement les états clos ;
5. `docs/FUSION_PROJET_COUSIN.md` : garder l'historique d'intégration et les contrats monde v13 ;
6. `docs/JOURNAL6.md` : conserver les deux journaux, sans écraser les sessions Saar ;
7. `docs/Old/PLAN_LOS.md` : garder le déplacement vers `docs/Old/` effectué par l'intégration et y
   incorporer l'avertissement monde indiquant que la LOS voxel est historique. Ne pas recréer
   `docs/PLAN_LOS.md` à la racine.

Cette liste décrit la fusion du lot monde avec la base actuelle. Une nouvelle tête Saar peut créer
d'autres conflits ; elle doit être analysée séparément avant tout commit commun.

## Procédure de reprise

1. confirmer les têtes exactes de `integration`, du tag monde et de Saar ;
2. créer les tags et sauvegardes code/PostgreSQL/MinIO prévus par `docs/WORKFLOW_FUSION.md` ;
3. dans `/home/codex/Enclume-fusion`, fusionner le tag monde avec `--no-commit --no-ff` ;
4. résoudre les sept fichiers ci-dessus, puis importer la tête Saar selon
   `docs/FUSION_PROJET_COUSIN.md` ;
5. exécuter les tests monde, serveur, Surface, le lint ciblé, le build et le smoke Chromium ;
6. tester sur `8393` une carte v13 multi-étages avec grilles, trappe, escaliers et une vraie session
   combat ;
7. committer et déployer uniquement après validation complète, puis publier `integration`.

Le tag de transmission est une source, pas un point de retour de l'instance fusion. Le tag et la
sauvegarde de restauration de `integration` doivent être créés juste avant la vraie fusion.
