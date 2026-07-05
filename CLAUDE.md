# CLAUDE.md — Projet Enclume
> Session 132 — 2026-07-05

---

## RÈGLES ABSOLUES

CODE > conversation. Jamais travailler de mémoire. Lire les fichiers.
1. Lire le fichier concerné avant toute proposition.
2. Confirmer la lecture : *"Fichier [nom] lu. Trouvé : [...]. Continuer ?"*
3. Plan exact avant de coder — lignes touchées, ce qui change, ce qui ne change pas.
4. "Je code ?" une seule fois, plan complet.
5. Relire le fichier produit en entier avant livraison.
6. Confirmation fonctionnelle obligatoire avant étape suivante.
7. **Un seul bug à la fois.** Plan pour un bug → validation → bug suivant. Jamais deux bugs dans le même plan.
8. **Reprise depuis un résumé = nouvelle session.** Exécuter le protocole complet sans exception.

---

## PROTOCOLE

### Début de session
> **Reprise depuis un résumé = nouvelle session — le résumé ne remplace jamais la lecture.**

- `docs/EN_COURS.md` [[docs/EN_COURS|EN_COURS]] → si la prochaine étape n'est pas claire depuis `## ÉTAT COURANT` ci-dessous.
- `docs/ASBUILT.md` [[docs/ASBUILT|ASBUILT]] → si la tâche touche à l'architecture (nouvelles routes, migrations, nouveaux services).
- `docs/JOURNAL5.md` [[JOURNAL5]] (dernier `## Session N` uniquement) → si un bug précis nécessite l'historique d'une décision.
- **Fichiers domaine → chargés automatiquement** via `.claude/rules/` quand les fichiers source sont ouverts.

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad. Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender [[JOURNAL5]]
- Mettre à jour le header date de tout fichier `.md` modifié.
- Proposer un scénario de test (étapes + résultat attendu) avant de passer à la suite.
- Fin de session : mettre à jour [[docs/EN_COURS|EN_COURS]], [[docs/ROADMAP|ROADMAP]], [[docs/ASBUILT|ASBUILT]], [[CLAUDE]]
- Fin de session : mettre à jour [[client/public/CHANGELOG|CHANGELOG]] — `## vN — date — titre`.
- Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

### Fermeture de bug
Toute clôture ✅ exige :
- **Testé :** [ce qui a été vérifié]
- **Non testé :** [ce qui reste] → si non vide : `⚠️ clos partiel`

### Jamais
- Coder sans confirmation.
- Réécrire un fichier sans l'avoir relu dans cette session.
- Avancer sans confirmation fonctionnelle.
- Écrire "probablement / suppose / certainement" sur une cause non lue → `[INCONNU]` + `[DBG-X]`.
- Proposer un plan couvrant plusieurs bugs simultanément → un seul bug par plan.
- Traiter un résumé de conversation comme substitut à la lecture obligatoire des fichiers.
- Proposer un correctif par contournement ou patch arithmétique quand l'architecture correcte existe — toujours la solution robuste et pérenne, même pour un bug mineur.

---

## DÉTECTEUR DE DÉRIVE

→ "rapide / suppose / probablement / certainement / évidemment / je pense que / devrait" → STOP. Tous les fichiers lus ?
→ Diagnostic de cause racine sans lecture de code → STOP. `[INCONNU]` + `[DBG-X]`.
→ Fermer un bug sans "Testé / Non testé" → STOP.
→ "Je code ?" pour la 2e fois sur le même sujet → STOP. Plan complet → code directement.
→ Question de diagnostic console F12 → STOP. Lisible dans le code source ?
→ Créer événement WS / composant / fonction → STOP. Existe déjà ?
→ Implémenter mécanique de combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?
→ Conversation reprise depuis un résumé → STOP. Protocole début de session complet avant toute proposition.
→ Plan mentionnant deux bugs ou plus → STOP. Un bug à la fois.
→ Déclarer `[VÉRIFIÉ]` après lecture du code uniquement → STOP. Lire = `[HYPOTHÈSE]`. `[VÉRIFIÉ]` = instrumenté + observé en exécution.
→ Proposer un correctif sur une cause `[HYPOTHÈSE]` non instrumentée → STOP. Étape instrumentation obligatoire d'abord.
→ Bug non reproductible avant analyse → STOP. Documenter les conditions, ne pas analyser à l'aveugle.
→ Solution "temporaire" / "pour l'instant" / "patch rapide" proposée → STOP. Concevoir pour la durée dès le départ.

---

## PROJET

Enclume — VTT maison. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT httpOnly.
Zustand déjà en place pour les fonctionnalités existantes — tout nouveau domaine (ex : wizard création) suit le même pattern. Jamais de state local inter-étapes ou inter-composants quand un store existe.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.
Démarrage : `.\start.ps1` depuis `Enclume/`. Vérification : `http://localhost:3001/api/health` + `http://localhost:5173`.
Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/`.
Serveur Alpha "Kiwi" : `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`.

**Nomenclature docs :**
| Préfixe | Rôle |
|---|---|
| `docs/SYSTEME/*.md` | Spécifications techniques d'implémentation (lire sur demande via rules) |
| `docs/REGLE*.md` | Sources de vérité règles Polaris (LdB) — source absolue |
| `docs/MANUEL*.md` | Synthèse technique des règles (séquences, pipeline) |
| `docs/PLAN_*.md` | Planifications réalisées ou en cours |
| `docs/ARCHI_REWORK.md` | Bible des reworks actifs |
| `docs/ARCHI_REWORK_DONE.md` | Specs complètes des reworks achevés |
| `.claude/rules/*.md` | Règles domaine — chargées automatiquement (path-scoped) |

---

## ÉTAT COURANT — Session 132 (2026-07-05)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **108 migrations stables** (104_campaign_settings — Session 132)

**Session 132 — Options de campagne ✅ clos :**
- `campaignSettingsService.js` (NOUVEAU) : `SETTINGS_SCHEMA` (16 clés) + `getCampaignSettings(db, campaignId)` — source unique de vérité
- `104_campaign_settings.js` : `campaigns.settings JSONB` — consolide 6 colonnes plates + 11 nouvelles options, DROP `campaign_rules` (table morte)
- 5 consommateurs combat + `SessionPage.jsx` migrés vers `getCampaignSettings()` (expand/contract — jamais de lecture cassée)
- `routes/campaigns.js` PUT réécrit — validation `SETTINGS_SCHEMA`, merge JSONB atomique (`db.raw`, pattern PC39)
- 3 bugfixes composants (`SectionDice` closures `setTimeout`, `SectionGameRules` état manquant, `SectionTokens` désync `onChange`) + bugfix `CampaignSettingsPage` (`formRef`→`formData`, perte visuelle au changement d'onglet)
- 7 fichiers déplacés vers `client/src/components/campaignSettings/` + i18n FR/EN complétés (31/33 clés)
- **Testé :** SR ✅, combat inchangé (recharge PNJ/stun/timer/LOS) ✅, persistance 11 options ✅, upload token non écrasé ✅, navigation onglets ✅
- **Non testé :** effet mécanique des 11 options (stockage/lecture seulement pour l'instant)

**Dettes actives :**
- **Résiduel split-brain** — `COMBAT_STATE_SYNC` reconnexion RESOLUTION — sprint futur
- "Changer le mode de tir" — non implémenté — sprint futur
- `useDiceAudio.js` — sons dés
- `.gitattributes:3` — attribut invalide
- Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1
- `onTokenRotate` dead code Canvas3D/Scene
- `getVoxelSurfaceTop` — pas de cas slope/wedge
- Sprint Annonce v2 — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- Surprise critique (roll=1) → initiative=1 — à analyser
- [DBG-C1] Owner wizard — `character.user_id` null quand GM crée pour joueur absent (steps 1-3 non implémentés)
- **[WIZ-1]** Personnages incomplets (creation_state ≠ 'complete') visibles dans la liste — à filtrer côté Dashboard/liste
- **[WIZ-2]** Deux compteurs PC (header store vs CareersAllocator local) — cosmétique, sprint COUCHE 4c
- **[WIZ-3]** Formation "apprentissage_technique" → choix spécialité non implémenté — sprint COUCHE 4c
- **[JSON1]** `client/src/locales/en.json` invalide — guillemets non échappés `deleteMapConfirm` (préexistant) — casse tout le fichier EN
- **[OPT-W1]** 11 options de campagne sans effet mécanique branché (Wizard/SkillsPanel/CharSheet) — sprint futur
- **[OPT-W2]** `style={}` visuel dans `client/src/components/campaignSettings/*` (convention CSS) — basse priorité

---

## PIÈGES CRITIQUES

**P1 — token.owner_id mort**
→ Toujours : `token.character_id → characters.user_id`.

**PE14 — coordonnées entités pos_y/pos_z inversés**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → DB
```

**BUG C — weapon_inv_id ≠ item_id**
`ref_equipment_skill_assoc.item_id` FK → `ref_equipment.id`, pas `char_inventory.id`.
Pattern : `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`.
Erreur → skillTotal = 0, assaut toujours raté.

**P51 — effectiveMalus formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor. PNJ = `character.type === 'pnj'`.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**[R8-27] — socket.campaignId / socket.role dépendance implicite post-REWORK-08**
`socket.campaignId` et `socket.role` restent settées dans SESSION_JOIN. Les helpers de `socketCombat.js` (`resolveMeleeAction`, `resolveReloadAction`, `COMBAT_MELEE_DEFENSE_CONFIRM`) les utilisent via `io.fetchSockets()` pour retrouver des sockets tiers. Supprimer ces deux lignes de SESSION_JOIN casse le CaC PJ↔PJ silencieusement.

---

## CONVENTIONS

**Communication :**
- SR = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- Félicitations ≠ validation.
- **CaC = Corps à corps** (melee). **CC = Coup par coup** (mode de tir, tir unique distance).

**CSS (Session 76) :**
- Bouton → `className="btn"` ou variante (`.btn-ghost`, `.btn-danger`, `.btn-gold`, `.btn-icon`, `.btn-toggle`, `.btn-tool`)
- Badge → `className="badge badge-gm"` etc.
- `style={}` = layout/position calculé uniquement (width, flex, margin, top) — jamais visuel.
- Valeurs visuelles dynamiques → CSS custom property.
- Classes dans `index.css` Section 10 — modifier une classe = modifier partout.

**i18n :**
- Aucune string UI hardcodée. Toujours `useTranslation` → `t('section.cle')`.
- Source unique : `client/src/locales/fr.json`. Ajouter la clé avant de l'utiliser.
- Combat (12) + équipement (6) : hors scope — sprint dédié futur.
