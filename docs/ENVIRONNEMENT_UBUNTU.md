# Environnement de développement Ubuntu

> Contrat poste local mis à jour le 2026-07-22. Le code peut être cloné localement, mais les
> instances partagées, PostgreSQL et MinIO restent sur Kiwi selon `docs/WORKFLOW_FUSION.md`.

## Versions retenues

| Outil | Version/profil | Usage |
|---|---|---|
| Node.js | 24.x LTS, lu depuis `.nvmrc` | tests, outils, client et serveur |
| npm | 11.x ; projet déclaré avec `npm@11.16.0` | installations reproductibles par lockfile |
| Git | version Ubuntu maintenue | branches, worktrees et fusion |
| Python | Python 3 système + `venv` | scripts auxiliaires uniquement |
| Blender | 4.x ou plus récent | fabrication explicite des assets ; jamais requis en production |
| Chromium Playwright | version gérée par Playwright | smoke et E2E |
| OpenSSH | client Ubuntu | tunnel vers Kiwi pour les E2E distants |

Les trois `package.json` refusent maintenant une autre génération de Node/npm via `engines`. Après
un nouveau clone :

```bash
nvm install
nvm use
npm ci
npm --prefix client ci
npm --prefix server ci
npx playwright install chromium
```

Le répertoire du clone est libre. `start.sh` résout sa propre position et ne dépend plus de
`$HOME/Enclume`.

## Exécution

- `./start.sh` démarre une pile **entièrement locale** avec Docker, API et Vite.
- Le développement hybride recommandé garde le code local et utilise les instances Kiwi décrites
  dans `docs/WORKFLOW_FUSION.md` ; ne pas copier les bases ou `.env` sans procédure de sauvegarde.
- `npm run test:e2e:remote` ouvre sous Ubuntu un tunnel SSH vers `8293`, puis lance Playwright.
  Les variables `ENCLUME_SSH_KEY`, `ENCLUME_SSH_HOST`, `ENCLUME_SSH_PORT` et
  `ENCLUME_LOCAL_PORT` permettent de remplacer les valeurs par défaut.
- Une clé privée recopiée depuis Windows doit appartenir à l'utilisateur et être protégée avec
  `chmod 600 /chemin/vers/la_cle`; OpenSSH refuse volontairement une clé lisible par d'autres.
- Au premier accès sur une machine neuve, OpenSSH enregistre automatiquement la clé hôte de Kiwi
  (`StrictHostKeyChecking=accept-new`). Une clé déjà connue qui change reste refusée : vérifier ce
  changement avec l'administrateur du serveur, ne jamais supprimer aveuglément l'ancienne entrée.
- Le runner PowerShell historique reste disponible avec `npm run test:e2e:remote:windows`.

## Politique de dépendances

Les versions mineures et majeures validées sont écrites dans les manifests et les lockfiles.
`npm audit` doit rester sans vulnérabilité connue dans les trois espaces. Exception volontaire :
Quill reste fixé à `2.0.2`, car `2.0.3` est la version touchée par l'avis XSS sur l'export HTML et
aucune version corrigée plus récente n'est publiée. Ne pas remplacer ce pin par un caret sans
réexaminer l'avis et `DocumentModal.jsx`.

Commandes de contrôle :

```bash
npm outdated
npm --prefix client outdated
npm --prefix server outdated
npm audit
npm --prefix client audit
npm --prefix server audit
```

Ne jamais lancer `npm audit fix --force` sur ce projet : une montée majeure doit être explicite,
testée et consignée.
