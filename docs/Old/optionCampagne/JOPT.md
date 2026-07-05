# Options de campagne — Plan d'intégration
> Mis à jour 2026-07-05 — statut : CODÉ (blocs serveur 1-3 + client 4-6 + doc 7). Bug rapporté après SR : stub cassé `client/src/pages/CampaignSettingsPage.jsx` (préexistant, hors scope de mes modifs serveur) — corrigé par le déplacement §5 (stub supprimé, `App.jsx` pointe vers `components/campaignSettings/`). En attente : test fonctionnel (scénario ci-dessous) + `git push`.

**Contrat :** `SectionGameRules` et `SectionCharacterSheet` reçoivent `initialData` = sous-objet `settings.*`. Leur `onChange(patch)` est wrappé par le shell en `{ settings: patch }`. `handleSectionChange` merge profondément `settings`. `SectionDice` émet `dice_config` hors settings.

---

## Recherche — bonnes pratiques appliquées

- **Pattern expand/contract** (suppression de colonne en production) : le code qui arrête de lire une colonne doit être mis à jour avant/avec la migration qui la supprime — jamais après. Sources : [Prisma Data Guide](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern), [Tim Wellhausen](https://www.tim-wellhausen.de/papers/ExpandAndContract/ExpandAndContract.html), [Enol Casielles](https://www.enolcasielles.com/en/blog/database-migrations-strategy).
- **JSONB vs colonnes plates** : JSONB adapté aux attributs optionnels/semi-structurés (les 16 options de campagne) ; colonnes dédiées conservées pour ce qui reste structuré/validé (`dice_config`) ou géré par route dédiée (`default_token_glb_url`). Source : [SQLPad — JSONB vs Columns](https://sqlpad.io/tutorial/postgresql-jsonb-vs-columns-performance-guide/).
- **Knex** : DROP COLUMN et toute opération dépendante dans la même transaction ; jamais de migration de suppression sans que le code consommateur soit déjà mis à jour. Source : [Knex.js — Migrations](https://knexjs.org/guide/migrations.html).
- Application à Enclume (mono-instance, déploiement `git pull` + redémarrage, pas de rolling-deploy) : pas de rollout multi-releases (sur-ingénierie inutile ici) — mais migration + mise à jour de tous les points de lecture livrées **ensemble**, jamais l'une sans l'autre.

---

## Cause racine du risque identifié en review

5 fichiers serveur faisaient chacun leur propre `.select('pnj_unlimited_ammo')` / `.select('reload_mode')` etc. avec valeur par défaut dupliquée inline. Cette duplication est ce qui a permis au risque de régression combat de passer inaperçu dans la V1 du plan. Le plan corrige la cause : **un point d'accès unique** aux settings de campagne (`campaignSettingsService.js`), pas seulement le symptôme.

---

## Bugs identifiés en review critique du code (à corriger AVANT le déplacement)

### 🔴 1. `SectionDice.jsx` — closures obsolètes via `setTimeout(fn, 0)`
Pattern répété partout dans le fichier :
```js
const toggleDice = (val) => { setDiceEnabled(val); setTimeout(() => onChange({ dice_config: val ? buildConfig() : null }), 0) }
const toggleSuccess = (val) => { setSuccessActive(val); setTimeout(notify, 0) }
```
`buildConfig`/`notify` sont des `useCallback` dont la closure capture les valeurs **du rendu où le clic a eu lieu** — `setTimeout(fn, 0)` ne rafraîchit rien, JS ne relit pas un état plus récent dans une fonction déjà créée. Conséquence : à chaque interaction, la valeur envoyée au parent est celle **d'avant le dernier clic**, jamais l'actuelle. La dernière modification avant "Enregistrer" est systématiquement perdue (ex : activer "dice_config" puis sauvegarder immédiatement → `dice_config: null` est envoyé malgré la case cochée).
Comparaison : l'ancien monolithe (`git show HEAD:client/src/pages/CampaignSettingsPage.jsx:249-270`) recalculait `dice_config` directement dans `handleSave` depuis l'état courant — pas de `setTimeout`, pas de ce bug. Régression introduite par l'extraction en composant séparé.
**Correctif** : remplacer tous les `setTimeout(fn, 0)` par `useEffect(() => { onChange({ dice_config: buildConfig() }) }, [diceEnabled, expertMode, expertRows, successActive, successOn, failActive, failOn])`.

### 🔴 2. `SectionGameRules.jsx` — aucun `useState`, un champ modifié réinitialise les 3 autres
```js
const pnjUnlimitedAmmo = initialData.pnj_unlimited_ammo ?? true   // recalculé à CHAQUE rendu depuis initialData figé (prop jamais mise à jour après montage)
```
Sans état local, `notify(patch)` renvoie systématiquement les 3 autres champs à leur valeur **de chargement serveur**, écrasant silencieusement toute modification faite juste avant sur un autre champ de la même section (ex : décocher "Munitions illimitées PNJ" puis changer "Mode de rechargement" → le premier changement est perdu).
**Correctif** : reproduire le pattern déjà correct de `SectionCharacterSheet.jsx` — un `useState` par champ, `handleX = (val) => { setX(val); onChange({x: val}) }`.

### 🟠 3. `SectionTokens.jsx` — désynchronisé de `formRef`, upload annulable silencieusement
`<SectionTokens initialData={initialData} campaignId={campaignId} />` — aucun `onChange` transmis. Le composant fait ses appels API directement (upload, clear) sans jamais notifier le parent. `formRef.current.default_token_glb_url` reste figé à la valeur de chargement et est réenvoyé à **chaque** clic sur "Enregistrer" (n'importe quelle section) → un token fraîchement uploadé peut être silencieusement écrasé par l'ancien si le GM sauvegarde ensuite depuis un autre onglet.
Vérifié : l'ancien monolithe (`git show HEAD` lignes 262-268) n'envoyait **jamais** `default_token_glb_url` depuis `handleSave` — seuls l'upload/clear le faisaient. Régression introduite par le découpage en sections.
**Correctif** : passer `onChange` à `SectionTokens`, appeler `onChange({ default_token_glb_url })` après chaque upload/clear réussi.

### 🟡 4. i18n — écarts vérifiés par extraction automatique (75 clés `t('settings.*')` utilisées vs `fr.json`/`en.json`/`i18n.json`)
- `femininBonusLabel` / `femininBonusHint` (utilisées dans `SectionCharacterSheet.jsx:131,133`) : absentes du draft `i18n.json` **et** de `fr.json` — vrai trou, pas seulement "pas encore copié".
- Les 29 autres clés du draft sont réellement nouvelles (aucun doublon avec `fr.json` existant) — pas de redondance.
- EN : 30 clés manquantes dans `en.json`, dont `shockAutoStunLabel/Hint` qui existent déjà en FR mais n'ont jamais été traduites (dette préexistante indépendante, à corriger dans le même lot).
- Mineur : `ambianceREALISTE/INTERMEDIAIRE/HEROIQUE` (boutons) et `ambianceRealiste/Intermediaire/Heroique` (tableau) sont deux jeux de clés distincts pour les 3 mêmes libellés — duplication évitable.

### Vérifié sain (pas de bug)
- `sharedStyles.js` : toutes les clés utilisées par les 5 Sections sont exportées, aucune référence manquante.
- Migration : `DROP COLUMN reload_mode` supprime automatiquement la contrainte `chk_reload_mode` associée (comportement Postgres standard).
- `MODIF campaigns.js` : validation par clé correcte, pas de trou dans `ALLOWED_SETTINGS`.
- `api.js` : pas de header `Content-Type` global forcé — upload FormData fonctionnera normalement.

---

## Ordre de codage

Un seul bloc cohérent serveur (1-3), SR, puis un seul bloc client (4-6), test, puis doc (7). Le détail de chaque étape est dans "Étapes du plan" ci-dessous (§ correspondants).

1. Service `campaignSettingsService.js` + migration `104_campaign_settings.js` (§1, §2)
2. Les 6 consommateurs — 5 serveur + `SessionPage.jsx` (§3)
3. Route `PUT /campaigns/:id` (§4)
   → **SR** (serveur redémarré sans erreur) avant de passer au client.
4. Correction des 3 bugs composants — `SectionDice.jsx`, `SectionGameRules.jsx`, `SectionTokens.jsx` (voir "Bugs identifiés")
5. Déplacement client vers `components/campaignSettings/` + `App.jsx` (§5)
6. i18n FR/EN (§6)
7. `docs/ASBUILT.md` (§7)

**Scénario de test fonctionnel avant clôture** (à dérouler une fois le tout en place) :
- Recharge d'arme PNJ (`pnj_unlimited_ammo`), résolution stun (`shock_auto_stun`), timer d'action (`action_timer_sec`, affichage `CombatOverlay` inclus), annulation LOS (`allow_los_cancel`) — vérifier que le combat fonctionne identiquement à avant.
- Sauvegarde des 11 nouvelles options (cocher, sauvegarder, recharger la page, vérifier la persistance).
- Upload token par défaut, puis modification d'un autre onglet + Enregistrer → vérifier que le token n'est pas écrasé.
- Navigation retour/avant entre sections sans perte de modification non sauvegardée.

---

## Étapes du plan

### 1. Service centralisateur — `server/src/lib/campaignSettingsService.js` (nouveau)
Exporte `SETTINGS_SCHEMA` (clé → `{ type, default, enum? }` pour les 16 settings : les 11 nouvelles options + `pnj_unlimited_ammo`, `reload_mode`, `action_timer_sec`, `shock_auto_stun`, `allow_los_cancel`) et `getCampaignSettings(db, campaignId)` (`SELECT settings` + merge avec les defaults). Devient la seule source de vérité — réutilisée par le service ET par la route PUT (schéma de validation partagé, pas de duplication de la liste de clés).

### 2. Migration — `server/src/db/migrations/104_campaign_settings.js` (nouveau — remplace `XXX_campaign_settings.js`)
- Chemin/numéro corrigés : `server/src/db/migrations/` (pas `server/db/...`), `104` = suite de `103b_seed_armes_satellites.js`.
- `up()` : ajoute `campaigns.settings JSONB DEFAULT '{}'` → backfill depuis `ambiance`, `pnj_unlimited_ammo`, `reload_mode`, `action_timer_sec`, `shock_auto_stun`, `allow_los_cancel` (+ defaults pour les 11 nouvelles clés) → `DROP COLUMN` sur ces 6 colonnes → `DROP TABLE campaign_rules` (table morte, migration 97, aucune référence ailleurs dans le code — vérifié par grep global).
- `down()` : symétrique — recrée les colonnes, restaure depuis `settings`, recrée `campaign_rules`.
- **Ce qui ne change pas** : `dice_config` et `default_token_glb_url` restent des colonnes dédiées (structure validée / gérée par route d'upload séparée).

### 3. Fichiers consommateurs à mettre à jour (avec la migration, jamais après)

| Fichier | Lignes actuelles | Changement |
|---|---|---|
| `server/src/lib/losService.js` | 16-19, 101 | `.select('allow_los_cancel','pnj_unlimited_ammo')` → `getCampaignSettings(db, campaignId)` |
| `server/src/lib/statusService.js` | 102-103, 123-124 | idem → `.shock_auto_stun` |
| `server/src/socket/socketCombatAnnouncement.js` | 162-163 | idem → `.pnj_unlimited_ammo` |
| `server/src/socket/socketCombatHelpers.js` | 813-816, 1388-1389 | idem → `.pnj_unlimited_ammo`, `.reload_mode` |
| `server/src/socket/socketCombatState.js` | 34-35 | idem → `.action_timer_sec` |
| `client/src/pages/SessionPage.jsx` | 810 | `campaign?.action_timer_sec ?? 0` → `campaign?.settings?.action_timer_sec ?? 0` (affichage timer `CombatOverlay`, masqué silencieusement par le `?? 0` sinon) |

**Ce qui ne change pas** : la logique métier (PC17 auto-skip, résolution stun, décompte munitions PNJ, LOS cancel) — uniquement la source de lecture. `client/src/lib/useSessionSocket.js:42` (`onCampaignUpdated`) est un simple passthrough vers le store — aucun changement nécessaire.

### 4. Route `PUT /campaigns/:id` — `server/src/routes/campaigns.js:171-216`
Reprend le draft `MODIF campaigns.js` (validation stricte par clé — déjà bien conçue), avec 2 améliorations :
- `ALLOWED_SETTINGS` remplacé par un import de `SETTINGS_SCHEMA` (évite la double maintenance de la liste de clés entre le service et la route).
- Merge JSONB **atomique côté DB** au lieu d'un read-then-write applicatif (évite une race condition entre deux sauvegardes concurrentes) — pattern déjà établi dans ce projet (`.claude/rules/combat.md` PC39, `state_character || ?::jsonb`) :
  ```js
  updates.settings = db.raw('settings || ?::jsonb', [JSON.stringify(settings)])
  ```
- `.returning([...])` : retire les colonnes supprimées, ajoute `settings`.

### 5. Client — déplacement + branchement
- Déplacer les 7 fichiers de `docs/optionCampagne/` vers `client/src/components/campaignSettings/` : `CampaignSettingsPage.jsx`, `sharedStyles.js`, `SectionDice.jsx`, `SectionGameRules.jsx`, `SectionTokens.jsx`, `SectionPlayers.jsx`, `SectionCharacterSheet.jsx` — contenu déjà validé, aucun changement de contenu nécessaire.
- Supprimer `client/src/pages/CampaignSettingsPage.jsx` (stub actuellement cassé en working tree — imports vers des fichiers inexistants dans `pages/`).
- `client/src/App.jsx:9` — import mis à jour : `./pages/CampaignSettingsPage` → `./components/campaignSettings/CampaignSettingsPage`.

### 6. i18n — `client/src/locales/fr.json` et `en.json`
Ajouter les ~29 clés déjà rédigées en FR (`docs/optionCampagne/i18n.json`) sous `settings.*`. Traduction EN à rédiger — actuellement 0 clé côté `en.json`.

### 7. Documentation
- `docs/ASBUILT.md` (lignes 179, 245, 247, 250-251, 254) : remplacer la description des colonnes plates par `campaigns.settings JSONB` + référence au service centralisateur `campaignSettingsService.js`.

---

## Hors scope (dettes existantes, non traitées par ce plan)

- **Wizard** : `mockAmbiance`, `mockIsFeminin` encore en dur dans `WizardCreation.jsx` — 🔲 dans le tableau ci-dessous, sprint futur.
- **Convention CSS** : `style={}` visuel utilisé dans toutes les Sections (contrevient à la convention `.claude/rules/react.md` — `style={}` = layout uniquement). Problème réel mais indépendant — à traiter en correctif séparé (règle "un seul bug à la fois").

---

## Options — État d'avancement

| OPT | Nom | Défaut | UI | Migration | Serveur | Wizard |
|---|---|---|---|---|---|---|
| 01 | Ambiance | INTERMEDIAIRE | ✅ | ✅ 104 | ✅ | 🔲 Step1 |
| 02 | Bonus/Malus féminin | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step1 |
| 03 | Mutations aléatoires | ON | ✅ | ✅ 104 | ✅ | 🔲 Step3 |
| 04 | Polaris latent/non maîtrisé | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step5 |
| 05 | Avantages pro aléatoires | ON | ✅ | ✅ 104 | ✅ | 🔲 Step4 |
| 06 | Personnages expérimentés (Revers) | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step4 |
| 07 | Compétences avec conditions † | OFF | ✅ | ✅ 104 | ✅ | 🔲 SkillsPanel |
| 08 | Niveau max Compétences | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step4, SkillsPanel |
| 09 | Compétences progression naturelle | OFF | ✅ | ✅ 104 | ✅ | 🔲 SkillsPanel |
| 10 | Personnages très jeunes | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step1 |
| 11 | Célébrité | OFF | ✅ | ✅ 104 | ✅ | 🔲 Step4, Step5, CharSheet |

Colonne "Serveur" = stockage/lecture (`campaignSettingsService.js` + route PUT) uniquement. Aucune des 11 options n'a encore d'effet mécanique branché (Wizard, SkillsPanel, CharSheet) — c'est le sens de la colonne Wizard 🔲, hors scope de ce plan (voir "Hors scope").

---

## Fichiers concernés par le plan

| Fichier | Statut | Action prévue |
|---|---|---|
| `client/src/components/campaignSettings/CampaignSettingsPage.jsx` | ✅ Déplacé | `SectionTokens` reçoit désormais `onChange={handleSectionChange}` |
| `client/src/components/campaignSettings/sharedStyles.js` | ✅ Déplacé (renommé `.js`) | — |
| `client/src/components/campaignSettings/SectionDice.jsx` | ✅ Corrigé + déplacé | `setTimeout(fn,0)` → `useEffect` unique sur les deps de `buildConfig` |
| `client/src/components/campaignSettings/SectionGameRules.jsx` | ✅ Corrigé + déplacé | `useState` par champ (pattern `SectionCharacterSheet.jsx`) |
| `client/src/components/campaignSettings/SectionTokens.jsx` | ✅ Corrigé + déplacé | `onChange({ default_token_glb_url })` après upload/clear |
| `client/src/components/campaignSettings/SectionPlayers.jsx` | ✅ Déplacé tel quel | — |
| `client/src/components/campaignSettings/SectionCharacterSheet.jsx` | ✅ Déplacé tel quel | — |
| `server/src/db/migrations/104_campaign_settings.js` | ✅ Créé | `settings JSONB` + backfill + drop 6 colonnes + drop `campaign_rules` |
| `server/src/routes/campaigns.js` | ✅ Modifié (L171-213) | `SETTINGS_SCHEMA` importé, merge JSONB atomique `db.raw` |
| `server/src/lib/campaignSettingsService.js` | ✅ Créé | §1 |
| `server/src/lib/losService.js` | ✅ Modifié | §3 |
| `server/src/lib/statusService.js` | ✅ Modifié | §3 |
| `server/src/socket/socketCombatAnnouncement.js` | ✅ Modifié | §3 |
| `server/src/socket/socketCombatHelpers.js` | ✅ Modifié | §3 (2 sites) |
| `server/src/socket/socketCombatState.js` | ✅ Modifié | §3 |
| `client/src/pages/SessionPage.jsx` | ✅ Modifié (L810) | `campaign?.settings?.action_timer_sec ?? 0` |
| `client/src/App.jsx` | ✅ Modifié | Ligne 9 — import vers `components/campaignSettings/` |
| `client/src/pages/CampaignSettingsPage.jsx` | ✅ Supprimé | Stub cassé, superseded |
| `client/src/locales/fr.json` | ✅ Modifié | +31 clés (29 draft + `femininBonusLabel`/`Hint`) |
| `client/src/locales/en.json` | ✅ Modifié | +33 clés (31 nouvelles + `shockAutoStunLabel`/`Hint` dette préexistante) |
| `docs/ASBUILT.md` | ✅ Modifié | §7 |

**Bug préexistant découvert (hors scope, non corrigé) :** `client/src/locales/en.json` contient une erreur de syntaxe JSON antérieure à cette session — clé `deleteMapConfirm`, guillemets non échappés autour de `{{name}}`. Rend tout `en.json` invalide. À corriger séparément.

**Bug fonctionnel trouvé en test (corrigé)** — `CampaignSettingsPage.jsx` : `initialData` (`useState`, rempli une fois au chargement) + `formRef` (`useRef`, jamais reflété dans le state) → changer d'onglet démonte/remonte la Section active, dont le `useState` local se réinitialise depuis `initialData` (jamais mis à jour) au lieu de la valeur éditée. La modif semblait perdue visuellement (mais restait en réalité dans `formRef.current`, donc Enregistrer fonctionnait). Correctif : `formRef` supprimé, `initialData` renommé `formData` et devient l'unique source de vérité vivante — `handleSectionChange` fait `setFormData(prev => ...)` au lieu de muter un ref. `handleSave` lit `formData` (ajouté aux deps). Testé : persistance ✅, combat (recharge PNJ/stun/timer/LOS) ✅, upload token non écrasé ✅. Non testé : navigation retour/avant entre onglets après ce correctif (en attente de confirmation).

---

## Dettes restantes après implantation de ce plan

- **Wizard** : `mockAmbiance`, `mockIsFeminin` — hors scope, sprint futur.
- **Convention CSS** : `style={}` visuel dans les 7 fichiers Section*/CampaignSettingsPage — hors scope, correctif séparé.
