# FUSION_SESSION160.md — transmission du lot monde Session 160

> Préparé le 2026-07-22. Statut : **déployé sur `8293/8294`, prêt techniquement à fusionner après
> recette utilisateur**.

## Sources et périmètre

- source monde prévue : tag immuable `handoff/world-session160-20260722` sur `dev/monde` ;
- moteur et UX : `aabf0f8` (`Session 160 (Codex) - Construire les acces verticaux`) ;
- catalogue Blender/GLB : `46694fc` (`Session 160 (Codex) - Generer huit trappes animees`) ;
- tête monde documentée : le tag de transmission, créé après cette fiche ;
- base d'intégration observée : `355e388` ;
- dernière référence Saar disponible dans ce dépôt : tag de sauvegarde
  `backup/pre-fusion-saar-20260718-095537` (`1733aaa`). Cette sauvegarde ne remplace pas la
  confirmation d'une éventuelle tête Saar plus récente.

Le lot remplace l'objet présenté comme **Échelle** par un constructeur d'**Accès vertical**. La
trémie `ladder.topOpening` devient indépendante de la trappe et peut être rectangulaire ou
circulaire. Le `WorldSnapshot`, le renderer et la navigation consomment la même ouverture ; une
passerelle peut rejoindre le palier haut sans trappe. Le popup permet de retirer ou remplacer le
connecteur `hatch` sans supprimer l'échelle ni sa trémie.

Le pack `output/vertical_access_hatches/` ajoute huit modèles animés : battants blindés, battants
avec écoutille de service, coulissants bipartites et coulissants tripartites radiaux, chacun en
carré et en rond. Il comprend le `.blend` source, les GLB, deux planches de rendu, le manifeste et
le générateur reproductible. Il n'ajoute aucune migration de base de données ni dépendance npm.
NumPy est une dépendance locale de l'exporteur Blender, pas une dépendance de production.

## Validation du lot monde

- 144/144 tests monde/serveur ;
- 42/42 tests Surface ;
- 3/3 tests de configuration serveur ;
- 8/8 assets acceptés par `validate-3d-manifest`, sans erreur ni avertissement ;
- ESLint ciblé sans erreur et build Vite réussi ;
- inspection des planches Blender fermée/ouverte ;
- services `8293/8294` actifs, health API vert et client HTTP 200 ;
- catalogue intégré passé de 92 à 100 modèles et métadonnées des huit entrées contrôlées en base ;
- GLB distant HTTP 200 et smoke Playwright Chromium distant réussi ;
- retour arrière serveur : `backup/pre-session160-20260722` (`69164fe`).

Les instances Saar et fusion n'ont pas été redémarrées ni déployées pendant ce chantier. La recette
fonctionnelle utilisateur sur une vraie carte reste le dernier feu vert avant fusion commune.

## Prévisualisation de merge

`git merge-tree --write-tree integration handoff/world-session160-20260722`, simulé contre
`integration` `355e388`, combine automatiquement les fichiers moteur, les assets, les locales et le
runtime. Huit conflits documentaires/préexistants restent à résoudre :

1. `CLAUDE.md` : conserver les responsabilités fusionnées et l'environnement Node 24/npm 11 ;
2. `client/public/CHANGELOG.md` : conserver les deux historiques dans l'ordre chronologique ;
3. `docs/ASBUILT.md` : conserver les livraisons règles et monde ;
4. `docs/EN_COURS.md` : conserver les dettes des deux domaines et l'état de recette Session 160 ;
5. `docs/FUSION_PROJET_COUSIN.md` : garder l'historique d'intégration et les contrats monde v13 ;
6. `docs/JOURNAL6.md` : conserver les deux journaux sans écraser les sessions Saar ;
7. `docs/Old/PLAN_LOS.md` : conserver son archivage et l'avertissement sur la LOS voxel historique ;
8. `docs/VOCABULARY.md` : réunir les concepts règles et conserver la définition **Accès vertical**,
   dont la trémie est l'autorité et la trappe une couverture facultative.

Les auto-merges de `SessionPage.jsx`, `fr.json`, `en.json`, `battlemaps.js` et des manifests serveur
doivent quand même être relus : une nouvelle tête Saar peut modifier ces zones et créer d'autres
conflits.

## Procédure de reprise

1. confirmer les têtes exactes d'`integration`, du tag monde et de Saar ;
2. créer les tags et sauvegardes PostgreSQL/MinIO prévus par `docs/WORKFLOW_FUSION.md` ;
3. dans `/home/codex/Enclume-fusion`, fusionner le tag monde avec `--no-commit --no-ff` ;
4. résoudre les huit fichiers ci-dessus, puis importer la tête Saar selon
   `docs/FUSION_PROJET_COUSIN.md` ;
5. relancer les tests monde, serveur, Surface, le lint ciblé, le build, le validateur des assets et
   le smoke Chromium ;
6. tester sur `8393` une carte v13 avec accès sans trappe relié à une passerelle, trappe ronde,
   trappe carrée, états fermé/ouvert/verrouillé et animation tripartite ;
7. committer et déployer uniquement après validation complète, puis publier `integration`.

Le tag de transmission est une source. Le rollback de l'instance fusion doit toujours utiliser la
sauvegarde créée immédiatement avant la vraie fusion, jamais le tag de rollback de `8293/8294`.
