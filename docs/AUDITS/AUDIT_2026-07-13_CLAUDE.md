# AUDIT — CLAUDE.md / analyse contradictoire
> Date : 2026-07-13
> Statut : clos — lecture seule
> Périmètre : `CLAUDE.md`, confronté à `docs/FOUNDATION.md`, `docs/RegleDocumentaire.md` et `docs/AUDIT.md`.

---

## Cadrage

- Mode : baseline ciblée.
- Question : les instructions permanentes de `CLAUDE.md` sont-elles cohérentes, applicables et proportionnées à un audit ou un développement sûr du projet ?
- Sources lues : `CLAUDE.md` intégralement (1 424 lignes), `docs/FOUNDATION.md`, `docs/RegleDocumentaire.md`, `docs/AUDIT.md` et les chemins référencés ci-dessous.
- Flux contrôlé : instruction persistante → lecture par un agent → documents/règles exigés → planification, journalisation et clôture.
- Limite : aucune vérification d’exécution ; aucun changement de code, de configuration nodemon ou de règle métier.

---

## Unité close — protocole d’instructions

### Constats

1. **[Haute] Références au journal actif cassées.** `[SOURCE]` `CLAUDE.md:27,38,41` imposait `docs/JOURNAL5.md`, alors que ce chemin est absent. `docs/JOURNAL6.md` existe et est la cible citée dans l’état courant. Le premier point a été corrigé séparément après cet audit ; ce constat demeure la preuve du diagnostic initial.
2. **[Haute] Garde obligatoire de combat pointant vers un fichier inexistant.** `[SOURCE]` `CLAUDE.md:77` exige `docs/REGLESYSCOMBAT.md`, absent. La source réelle est `docs/REGLES/REGLESYSCOMBAT.md`, utilisée par ailleurs à `CLAUDE.md:162,447`. La règle est juste dans son intention mais inexécutable telle qu’écrite.
3. **[Haute] Nomenclature des reworks obsolète.** `[SOURCE]` `CLAUDE.md:109-110` annonce `docs/ARCHI_REWORK.md` et `docs/ARCHI_REWORK_DONE.md`, absents à la racine ; leurs versions sont dans `docs/Old/`. Cela crée une fausse source d’autorité pour une analyse architecturale.
4. **[Haute] Violation de responsabilité documentaire et duplication.** `[SOURCE]` `docs/RegleDocumentaire.md` Règles 1 et 2 imposent une responsabilité et une localisation uniques. Or `CLAUDE.md` mêle protocole (l.6-88), projet/nomenclature (l.89-114), état et historique (l.115-1357), pièges et conventions (l.1358-1424). L’état occupe 1 243/1 424 lignes (87,3 %) et duplique des détails de `EN_COURS.md` et `JOURNAL6.md`.
5. **[Moyenne] État courant difficile à interpréter comme état.** `[SOURCE]` la séquence commence par les suites 31, 30, 29, 27, 26, 28, 25 (`CLAUDE.md:117+`) puis remonte jusqu’à la session 133. C’est une chronique non triée ; le prochain travail et les dettes sont noyés dans les comptes rendus.
6. **[Moyenne] Gouvernance documentaire ambiguë.** `[INCONNU]` `FOUNDATION.md` établit une hiérarchie des sources de vérité, mais ne situe pas `CLAUDE.md`. En cas de conflit avec un manuel, un système ou `EN_COURS.md`, l’autorité de décision n’est pas explicitement définie.
7. **[Moyenne] Obligations de clôture disproportionnées.** `[SOURCE]` `CLAUDE.md:40-50` demande la mise à jour de six documents après chaque tâche, sans critère « seulement si la source change ». Cette règle augmente les modifications transversales, les conflits Git et la duplication, y compris pour une tâche documentaire ou un petit correctif.
8. **[Moyenne] Chargement automatique des règles non vérifiable.** `[SOURCE]` `CLAUDE.md:28,112` affirme que `.claude/rules/` est chargée automatiquement. Le dossier et ses neuf fichiers existent, mais le mécanisme, son déclencheur et sa couverture ne sont pas définis. Un agent peut croire à tort avoir lu une règle nécessaire.
9. **[Moyenne] Garde-fous de processus trop absolus.** `[SOURCE]` « un seul bug », confirmations systématiques et exigence de solution pérenne sont utiles, mais `CLAUDE.md:6-88` ne définit ni niveau de risque, ni exception, ni différence entre découverte, correction et effet de bord. Les récits d’état signalent eux-mêmes plusieurs bugs dans une même session.
10. **[Moyenne] P53 documente un contournement, pas une réduction durable du risque.** `[SOURCE]` `CLAUDE.md:1393` décrit le risque qu’une écriture dans `server/` relance nodemon et applique les migrations, puis recommande `node -e` inline « Bash » alors que le projet est opéré sous PowerShell (`CLAUDE.md:96`). Le défaut architectural reste actif.

### Faux positifs écartés

- `[SOURCE]` Le compteur « 147 migrations stables » correspond aux 147 fichiers présents lors de l’audit. Des préfixes numériques dupliqués existent, déjà documentés par P53, mais le compteur n’était pas faux.
- `[SOURCE]` Le dossier `.claude/rules/` et ses neuf règles existent. Le problème est le contrat de chargement, non l’absence des fichiers.

### Bilan

**Audité :** cohérence documentaire, références de chemins, source d’autorité et applicabilité du protocole de `CLAUDE.md`.

**Non audité :** comportement d’un chargeur de règles, exécution de nodemon, application réelle des migrations et correction des constats.

**Hypothèses restantes :** `[INCONNU]` sur la surface qui charge automatiquement `.claude/rules/` et sur l’autorité de `CLAUDE.md` dans la hiérarchie documentaire.

**Suites proposées :** corriger séparément les chemins combat et reworks ; décider d’une séparation durable entre protocole, état de reprise, pièges et historique ; définir des critères de proportionnalité pour les règles de processus.
