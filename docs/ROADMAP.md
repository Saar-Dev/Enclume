# ROADMAP — Projet Enclume

> **Rôle de ce document** : planification prospective — quoi reste à faire, ce qui est cadré ou pas,
> ce qui bloque. Ce n'est **pas** un historique : les décisions déjà prises, le détail de ce qui est
> clos et les comptes-rendus de session vivent dans `docs/JOURNAL8.md` (décisions/validations
> durables) et `docs/ASBUILT.md` (ce qui est réellement déployé et stable). **Un chantier clos est
> retiré d'ici**, jamais laissé en `~~barré~~` — s'il faut le retrouver, il est dans JOURNAL8/ASBUILT.
> Les bugs actifs vivent dans `bug_tickets` (`/admin/tickets`, `docs/SYSTEME/TICKETS.md`), jamais ici.
>
> **Carte complète de la documentation** : `docs/SYSTEME/INDEX.md`. **Vision produit et versions
> (v1/v2/v3/vX)** : `docs/FOUNDATION.md`. **État RAW chapitre par chapitre** : `docs/SYSTEME/COUVERTURE_RAW.md`.
> Les trois se référencent mutuellement, aucun ne duplique le contenu d'un autre (Règle 2, `docs/RegleDocumentaire.md`).
>
> **Approche de travail (peut évoluer)** : couverture RAW complète (backend) avant esthétique/frontend,
> tant que des mécaniques entières manquent côté serveur. Priorité assumée, pas un invariant.
>
> **Séquence principale** : AOE → Portes → Exo A/B → **Usure/Intégrité + Informatique/pannes exo** →
> Drones (télépilotage) → Armes spéciales + Tir de suppression → Force Polaris (cœur + pouvoirs à cible
> unique) → Arts martiaux / Moral. Détail des dépendances réelles vs priorités : `docs/SYSTEME/COUVERTURE_RAW.md`
> (section « Ordre »). Casables en parallèle sans dépendance : Milieu par pièce, Silhouette exo UI,
> i18n Lot 5, Fatigue Lot 4 (§1).
>
> **Avancement (2026-09-09)** : AOE / Portes / Exo A/B **clos**. Armes spéciales — fusil à pompe +
> lance-flammes clos (PJ/PNJ/exo/drone), socle AOE data-driven + registre de mécanismes. **Grenades :
> frag + lancer/dispersion + explosion différée T+1 + marqueur 3D + mode percussion/minuterie clos et
> validés** ; squelette 3-bis (`circleGrenade.js`) + grenade à énergie livrés. **Chantier grenades gelé
> au 2026-09-09** à un point de pause propre (`docs/PLANS/PLAN_GRENADES.md` §6) — reprise : 4 types « à
> statut » prêts (`grenade_stun`/`flashbang`/`concussion`/`sonic`), puis les types « à zone »
> (incendiaire, gaz, capsules) qui attendent la fondation ci-dessous. **En cours (agent parallèle)** :
> Usure & Intégrité (plan doc bouclé, phase code). Bloqué : tir de suppression (chantier Chance +
> fondation zones dangereuses).

---

## 1. Chantiers actifs — prêts à reprendre sans cadrage supplémentaire

| Chantier | Doc | État | Prochaine étape |
|---|---|---|---|
| Exo-armures (v2) | `PLANS/PLAN_EXOARMURE.md` | **§16.3 Étape A (déplacement) et §16.4 Étape B (Tir/CaC) codés et validés en combat réel le 2026-08-27** — premier combat exo-armure fonctionnel du projet (Tir qui touche, résolution complète, étourdissement de la cible, échange normal dans les deux sens). Détail mécanique : `docs/SYSTEME/EXOARMURE.md` §5. Lots 1-4 + 2bis + §16.2.1/2.2/2.5 déjà codés et testés antérieurement. `ExoSheetWindow.jsx` fonctionne | Points ouverts, non bloquants pour jouer : (1) **[FAIT 2026-08-27]** Compétence Tir Automatique (PC23) exo RC/RL — règle identique à l'humanoïde, gate + message explicite dans `socketCombatAnnouncement.js` branche `isExo`, cf. `docs/SYSTEME/EXOARMURE.md` §5 ; (2) **[FAIT 2026-08-28]** Initiative projetée près de DÉCLARER — pastille `CombatDeclareIniWidget`, calcul partagé `shared/combatIniCost.js` (chantier RW fenêtres de déclaration, clos, `docs/JOURNAL8.md`) ; (3) combat drone jamais retesté en jeu réel depuis le refactor DRY de `resolveDroneAssaultAction` (2026-08-26, extraction pure non prouvée) — Saar teste ; (4) **[FAIT 2026-08-30]** statuts d'état exo (posture / vitesse / arme) : câblés sur le satellite `CombatDeclareStatePanel` (`axes=['position','vitesse','weapon']`, `handleDeclare` envoie `state:{position,weapon,vitesse}`), + posture `prone` → `handleStandUp`. Chantier RW déclaration, clos (`docs/JOURNAL8.md` 2026-08-30) |
| Silhouette d'avaries exo (UI) | — (pas de PLAN écrit) | Saar a produit `docs/PLANS/exoarmor.svg` (silhouette exo 6 zones, même découpage que le wound panel char_sheet). `client/src/components/BodySilhouetteSvg.jsx` existe déjà (mêmes 6 zones, `fillFor`/`strokeFor`/`onClickLocation` génériques), consommé par `SilhouettePanel.jsx` (onglet Matériel char_sheet) | À l'occasion (Saar) — voie naturelle : composant frère type `ExoAvariesPanel.jsx` réutilisant le patron `fillFor`/`strokeFor` de `BodySilhouetteSvg.jsx` avec les paths d'`exoarmor.svg` (et `BodySilhouetteSvg` utilise déjà la géométrie `human.svg` depuis le RW déclaration), pas un nouveau pattern |
| Interactions d'entité (moteur générique : déplacer un objet pour se couvrir, leviers/consoles) | — (pas de PLAN — moteur déjà construit) | **Re-vérifié le 2026-08-25 sur demande de Saar — le moteur générique est déjà entièrement construit et câblé**, contrairement à ce que suggérait l'entrée précédente de ce document. Confirmé par lecture directe : `server/src/socket/socketEntity.js` (`ENTITY_ACTION_REQUEST`/`ENTITY_ACTION_RESOLVE` — interaction avec Test de compétence, confirmation MJ, jet de dé, bonus critique ; `ENTITY_MOVE_REQUEST` — pousser/tirer un objet avec validation de portée, direction et sens serveur, PE27), `client/src/pages/SessionPage.jsx` (`handleEntityAction`/`handleEntityMove`, menu radial au clic sur une entité), `client/src/components/EntityBuilderTab.jsx` (éditeur complet pour définir états/interactions sur un blueprint, i18n fini). Ascenseur déjà fonctionnel (système dédié séparé, `worldElevatorService.js`). Porte/serrure : livré séparément et validé en session le 2026-09-02 (`.claude/rules/world.md` § « Interaction runtime sur une porte », `JOURNAL8.md`). **Le seul vrai manque : le contenu**, `SELECT` sur `entity_blueprints` confirme **zéro** blueprint avec une interaction définie en base à ce jour — le moteur n'a jamais été utilisé | Créer un blueprint "caisse" (interaction `move_type`) et vérifier en jeu réel que déplacer l'objet affecte bien la couverture/LOS (`state_cover`) — win rapide, contenu seul |
| Milieu par pièce (moteur monde) | `PLANS/PLAN_ENVIRONNEMENT_MILIEUX.md` | Architecture tranchée (Option A — `room.environment` statique, repli `battlemaps.default_environment`, 2026-08-24). Planification pure, rien codé | Implémenter §4 (schéma `surface_data`, compilateur, requête `getEnvironmentAtPosition`, éditeur Surface). Débloque la résolution propre du milieu hybride exo (§16.2.5 ci-dessus) **et** prépare v3 (sous-marin/abysses, `docs/FOUNDATION.md`) |
| i18n Lots 1-4 (Combat/Équipement/Builder/Dés) | `PLANS/PLAN_LOCALISATION.md` §2-6 | Codés et commités, zéro texte en dur restant (vérifié par script de résolution i18next à chaque fichier) | Session de test navigateur groupée (décision Saar : pas de validation fichier par fichier) — puis archiver le plan dans `docs/ASBUILT.md` |
| i18n Lot 5 (texte de catalogue `ref_*`, ~1519 lignes / 10 tables) | `PLANS/PLAN_LOCALISATION.md` §7 | Architecture tranchée (colonnes JSONB `<champ>_i18n` par table, 2026-08-11), exécution non commencée | Écrire l'audit de lots détaillé (ordre des 10 tables, quel champ en premier) puis exécuter. Ne dépend d'aucune validation produit — exécutable en autonomie |
| Fatigue & Dommages | `PLANS/PLAN_FATIGUE_DOMMAGES.md` | Lots 0-3 clos et confirmés en navigateur (horloge de campagne, Blessures/Guérison, Chute/Acide/Décompression/Feu) | Lot 4 (Fatigue), indépendant du reste. Lot 6 (Noyade/Asphyxie) cadré (§12) mais **décision en attente** : déclenchement automatique par une Catastrophe (Usure/Intégrité) ou toujours volontaire ? |
| Fenêtres de RÉSOLUTION combat — passe esthétique (couleurs) | — | Non commencé. Suite de la teinte Wizard des fenêtres de déclaration (`PLAN_RW_DECLARE_DESIGN` P7 / R4, 2026-08-29). `CombatModifiersWindow` / `CombatDamageWindow` / `CombatCacModifiersWindow` / `CombatStunWindow` sont sur `--bg-session-*` + ~60 hex en dur + accent doré — pas `--combat-*` | Passe CSS pure (convertir les hex, aligner sur la teinte Wizard, garder ou non le doré) — aucune logique, fastidieux. À faire après le chantier déclaration |

## 1bis. Cadré, différé (priorité basse — philosophie backend-first)

| Chantier | Doc | Pourquoi différé |
|---|---|---|
| Animations squelettiques de tokens | `PLANS/PLAN_RW_TOKEN.md` (en-tête réel : `PLAN_ANIMATIONS.md`, nom de fichier trompeur — référencé par 7 fichiers dont 1 fichier de code réel) | Chantier esthétique/frontend, non prioritaire tant que des mécaniques RAW entières manquent côté serveur (approche actuelle de Saar, peut évoluer — voir banner en tête de ce document). **Pas totalement isolé** : `server/src/lib/characterStateShadowCheck.js`/`docs/SYSTEME/ETATS_PERSONNAGE.md` reportent un nettoyage jusqu'à la Phase 7 de ce plan (urgence faible). **Décalage trouvé (2026-08-25)** : le plan écrit démarre directement par le rig squelettique complet (Mixamo, Phase 1) — Saar décrit la séquence réellement voulue comme (1) animations spécifiques liées aux actions des tokens d'abord, (2) rig/masque squelettique ensuite pour l'animation continue. **Le document ne reflète pas cet ordre voulu** — à recadrer avant de le renommer ou d'y toucher, pas juste un problème de nom de fichier |

## 2. Chantiers à cadrer avant tout code

| Chantier | Doc(s) | Ce qui manque |
|---|---|---|
| Armes spéciales (fusil à pompe, lance-flammes, grenades/mines) | `PLANS/PLAN_ARMES_SPECIALES.md` | **Plan rédigé + analyse critique 2026-09-03** (recherche code + RAW + réf. pro Foundry dnd5e). Prérequis AOE levé — fusil à pompe clos (PNJ + PJ). **Segment 0 — Socle de résolution AOE : cadré, soutenu par Saar, pas commencé** (§1.4/§1.6) : 0a extraction `socketCombatAoe.js` du god-file · 0b `ref_equipment.aoe_profile` JSONB (l'AOE-ness devient une donnée, plus de `ref_name ===` en dur) · 0c `damage_modifier` nullable · 0d tronc + résolution par arme = fonction pure testable + refonte agrégat étape 10 · 0e primitive `resolveTargetLocations`. Non-régression fusil à pompe (PNJ+PJ) = sessions Saar. **Lot 1 — lance-flammes** : décisions A-G tranchées, bloqué par le socle ; après = ligne de seed `aoe_profile` + migration `shock_mechanism='pure'` + `exposeToHazard` param + aperçu cône + `resolveFlamethrowerTargets` (~40 l.). **Lot 2 — grenades : `PLAN_GRENADES.md` (chantier GELÉ 2026-09-09 à un point de pause propre)** — frag + lancer/dispersion + explosion différée T+1 + marqueur 3D + mode percussion/minuterie (§3f) **clos et validés** ; squelette 3-bis `circleGrenade.js` + grenade à énergie livrés. Reprise : 4 types « à statut » prêts (`grenade_stun`/`flashbang`/`concussion`/`sonic`, ~1 incrément chacun), puis les types « à zone » (incendiaire, gaz, capsules) qui attendent la **fondation zones dangereuses** (ligne dédiée ci-dessous). 3d-4 (anim jet) différé. Mines : hors scope v1. Neuro-charge : Segment 4. Fouets/chaînes : → Arts martiaux. |
| **Résolution de zone d'effet (AOE)** | `PLANS/PLAN_AOE.md` (v11, §12 tient l'avancement réel à jour) | **Rafraîchi 2026-09-03 (analyse code, pas déduit).** **CLOS** : **fusil à pompe jouable de bout en bout, tireur PNJ ET PJ** (validé session réelle Saar). PNJ : étapes 1-9, commit `117b18a`. **Tireur PJ : clos 2026-09-03** (§8 étape 10 + JOURNAL8) — deux plans intermédiaires écartés après conception ((1) « rework de séparation des fenêtres » : dépendance inexistante ; (2) « N `armAwaitingDamage` FIFO » : le pipeline différé + le hook client supposent 1 cible, N pending d'un seul appel corrompt l'UI). Design retenu : résolution immédiate, tireur PJ = même boucle que le PNJ + un `COMBAT_ATTACK_PLAYER_RESULT { targets: [...] }` agrégé, liste par cible dans `CombatModifiersWindow` ; ne touche aucun code différé partagé. **Tir de suppression — doublement bloqué**, plus lourd qu'il n'y paraît : (i) toute la résolution repose sur un Test de Chance, absent du schéma (chantier Chance différé, §4) ; (ii) c'est une zone **persistante inter-tours** qui contraint le déplacement — il faut un objet zone vivant dans `combat_state` que `planCombatWorldMovement` consulte (les zones AOE actuelles sont ponctuelles). Attend le chantier Chance a minima. **Grenade à fragmentation CLOSE et validée jeu réel (2026-09-08)** : lancer un point → déviation 1D6 à l'échec → explosion au Tour suivant au rang d'Ini du lanceur (résolue par le moteur de tour, sans clic) + marqueur 3D. Voir `PLAN_GRENADES.md` §6. | Prochain pas AOE : les 4 grenades « à statut » restantes (3-bis, sur `circleGrenade.js`), quand le chantier grenades reprendra. Tir de suppression reste bloqué (chantier Chance **+ fondation zones dangereuses**). |
| **Fondation « zones dangereuses persistantes »** | `PLANS/PLAN_ZONES_DANGER.md` (**cadrage TERMINÉ 2026-09-09 — prêt à coder sur validation Saar**) | `world_effect_instances` + `shared/world/worldEffects.js` = échafaudage (données + modifiers + propagation OK ; aucun hook exécuté, aucune boucle de Tour, `duration_rounds` jamais décrémenté, rien ne spawn depuis le combat). **Cadrage bouclé** : 5 cas RAW (§4.1–4.5) + recherche pro (§5 : Foundry v12 Regions, PF2e Persistent Damage, FG SAVEO, module Danger Zone) + analyse à charge révisée (§7) + **schéma consolidé §4.8** (8 types de ligne d'effet + 4 blocs) + **timing moteur de tour §7.5** + **plan d'implémentation §8** (7 incréments Z0→Z6, noyau Z0→Z4). Décisions : patron **spawner** (zone pose une condition `token_statuses`, tick hazard généralisé la résout) · **hors-combat = HORS SCOPE** · **nuage intégré** · déclaratif = lignes typées + préréglages · volume 3D réel (forme non tranchée, §4.7 sous-chantier indépendant) · preuve = **feu + un gaz simple**. **Débloque** : grenade incendiaire + gaz/fumigène (`PLAN_NUAGE.md`) + capsules + tir de suppression + zones dangereuses MJ. v2 différé : `test`/Souffle/routage de compétence/mouvement forcé, animation géométrique (eau qui monte), interaction zone × zone, pièges. |
| Corps à corps avancé / Arts martiaux (techniques offensives/défensives, Saisie/Lutte) | — (RAW transcrite : `REGLES/REGLECACARTMARTIAUX.md`, **aucun PLAN écrit**, gap trouvé 2026-08-25) | Rien cadré. Indépendant d'AOE/Usure — peut être cadré en parallèle |
| Force Polaris (pouvoirs) | — (aucun PLAN écrit, absent de ce document jusqu'au 2026-08-25) | Chapitre entier non entamé, ~40 pouvoirs RAW nommés (détail `COUVERTURE_RAW.md` §4). **[VÉRIFIÉ] 2026-08-26** — `docs/REGLES/REGLEPOLARIS.md` existe et a été lu directement (la note du 25 cherchait le mauvais nom de fichier) : le cœur du mécanisme (Maîtriser/Libérer/Contrôler, Choc Polaris, Incidents 1D100) est indépendant de l'AOE et codable seul ; la majorité des pouvoirs ont réellement un paramètre Zone d'effet (confirmé, pas déduit) ; un sous-ensemble à cible unique (Contrôle mental confirmé, Dague psychique probable) ne dépend pas de l'AOE. **Premier lot réaliste sans attendre l'AOE** : cœur du mécanisme + pouvoirs à cible unique. Reste à faire avant cadrage complet : cataloguer les ~40 pouvoirs un par un (zone vs cible unique), pas fait en entier |
| Décorations murales (décals) | `PLANS/PLAN_DECALS.md` **+** `PLANS/PLAN_RW_MATERIAUX.md` Lot 3 | **Chevauchement réel non résolu** (trouvé 2026-08-25) : Lot 3 de RW_MATERIAUX traite les décals comme motifs cuits dans la texture procédurale (`PATTERN_PRESETS`, uniforme ou en masque) ; `PLAN_DECALS.md` les traite comme objets placés individuellement (position/rotation/taille propres, clic pour poser). Deux réponses concurrentes à la même question. **À trancher avec Saar** avant de cadrer l'un ou l'autre : l'un remplace l'autre, ou les deux coexistent comme deux sous-lots complémentaires — puis fusionner les deux documents (Règle 11, une info = un endroit). Actuellement en analyse par un agent parallèle (2026-08-25) |
| Rework matériaux/textures (texture de base + PBR + procédural par-dessus) | `PLANS/PLAN_RW_MATERIAUX.md` | Spécification complète (Lots 0-4, dont Lot 3 = décals ci-dessus), aucune trace de code démarré malgré une spec détaillée et datée (2026-08-02). Chantier esthétique — cohérent avec la philosophie backend-first, à cadrer mais pas prioritaire |
| Usure & Intégrité du matériel | `PLANS/PLAN_USURE&INTEGRITE.md` (stub) + `MANUELS/MANUEL_USURE.md` v1.5 | **Logique de jeu bouclée** : `MANUEL_USURE.md` v1.5 après 3 analyses à charge (2026-09-08/09), `REGLE_USURE&INTEGRITE.md` nettoyé, `VOCABULARY` V2.7. Reste à écrire le PLAN technique. **V1 ne mécanise aucune entrée de la table Catastrophe combat** — les entrées #2/#8 (matériel) sont un Lot 2 explicite (via `EFFECT_HANDLERS`, `MANUEL_USURE.md` §8) ; le « taper dessus » et les pièces détachées un autre Lot 2 (dépend du helper `resolveChanceTest`). **Confirmé Saar (2026-08-25) : nécessaire pour finir Exo-armures**, avec Informatique ci-dessous |
| Informatique (ordinateurs + pannes électroniques + IEM) | `PLANS/PLAN_INFORMATIQUE.md` (stub, périmètre décidé 2026-09-09) | Fusion de « Informatique et pannes » et de « Mécanique IEM » (ex-backlog §4) en un seul chantier. RAW transcrite (`REGLES/REGLE_ORDINATEUR.md`), rien cadré. **Dépend d'Usure & Intégrité** (primitive de test de panne). **Confirmé Saar (2026-08-25) : nécessaire pour finir Exo-armures** |
| Moral | `PLANS/PLAN_MORAL.md` | Stub (`Lire @REGLE_MORAL.md`). Règle RAW optionnelle, aucune dépendance technique identifiée — priorité basse, à caser selon préférence produit plutôt que contrainte |

## 3. Bloqués

| Chantier | Doc | Bloqué par |
|---|---|---|
| Sauvegarde automatique de l'instance | `PLANS/PLAN_ADMIN_BACKUP.md` | Lots 1-3 prêts à déployer, Lots 4-5 spécifiés pour activation future — attend le remplacement du serveur distant Kiwi par une instance stable (confirmé Saar, 2026-08-25) |
| Battlemap 2D (illustration/tokens sur fond 2D) | `PLANS/PLAN_BATTLEMAP2D.md` | Lot 0 (cadrage) clos, aucun code. Non urgent, peu pertinent actuellement (confirmé Saar, 2026-08-25) |

## 4. Backlog — idée retenue, aucun PLAN écrit

- **Export Google Sheets (fiche personnage)** — décision Saar 2026-08-23, remplace le chantier PWA fiche hors-ligne abandonné (`docs/Old/PLAN_FICHE_HORSLIGNE.md`, code des 5 lots resté commité mais déprioritisé ; `docs/Old/PLAN_RW_EXPORT.md`, rework de cette même PWA, périmé par le même abandon, archivé le 2026-08-25). Scope exact (lecture seule vs édition, quelles données, authentification Google) à définir avant de coder
- LOS & Raycast (replanifier — dépôt Kiwi/dev-monde arrêté depuis le 2026-08-04, voir `CLAUDE.md` §3)
- Tourelles / armes lourdes fixes (entités interactives)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus en UI — tooltips envisagés, pas cadré)
- Chat persistant (historique), Chat MP, Chat multi-canal (backend `chat_messages.channel_id`/`whisper` déjà partiel, dépend de `docs/Old/PLAN_CHAT.md` Phase 3/4 non reprise)
- Mode spectateur
- Sauvegarde/export carte 3D
- Spotlight / bibliothèque de présentation (personnage, document, indice) — besoin identifié en cadrant Battlemap 2D
- Eau structurelle authorée (lacs, sas/calles sèches de navires, ponts d'arrimage) — nécessite un outil d'édition dédié + compilation serveur (`WorldSnapshot`), pas une reconstruction géométrique client. Différé (Saar, 2026-07-29 : "peut largement attendre")
- Mutations & Avantages, narratif/économie (`docs/Old/PLAN_MUTATION2.md` Lot 7) — priorité basse
- **Mécanique de point de Chance** — **cadrage écrit : `PLANS/PLAN_CHANCE.md` (2026-09-05)**.
  Ressource RAW transversale (relancer un jet, réduire la gravité d'une Blessure ou de Dommages
  d'armure, forcer un Test de Chance) : bouton PJ « Utiliser sa Chance » transversal. **Le score
  existe déjà** (`char_sheet.chc`, déjà consommé par le Test de Chance du Petit bouclier) — ce qui
  manque = la réserve dépensable + la primitive partagée + le geste de dépense + l'UI. **Bloqué en
  amont** : le cœur des règles (« chapitre système de jeu — Chance ») n'est pas transcrit, pages
  Livre de Base à fournir par Saar. Débloque le tir de suppression + lève l'écart RAW du Test de
  Chance AOE longue/extrême portée.

## 5. Dettes ponctuelles ouvertes (non couvertes par un PLAN)

- **[PRIORITÉ HAUTE] `dice_config` / SectionDice — « Réussite et échec critique » contraire au RAW
  Polaris** (trouvé 2026-09-08, analyse à charge `PLAN_USURE&INTEGRITE` / `MANUEL_USURE` §4.1). La
  page Config campagne → « Réussite et échec critique » (`client/src/components/campaignSettings/
  SectionDice.jsx`, i18n `settings.diceTitle`) écrit `campaigns.dice_config` (JSONB) avec un défaut
  d20 **réussite critique = 20, échec critique = 1** — la convention D&D, **inversée** pour un Test
  Polaris en `D20 ≤ Seuil` : réussite critique = `roll === seuil` (`shared/polarisTestResolution.js:76`),
  échec critique = `roll === 20` (`:75`), un 1 naturel est une réussite automatique, jamais un échec.
  Un MJ qui lit cette page en déduit une règle de critique fausse. **Portée réelle limitée** :
  `dice_config` n'est lu que par le handler `DICE_ROLL` (`server/src/socket/socketDice.js:51-64`) —
  les jets libres `/r` sans seuil ; les Tests de compétence / combat / macro passent tous par
  `resolvePolarisTest` → `polarisTestResolution.js` et **ignorent `dice_config`** (le moteur de Test
  est correct et indépendant). Le bug est donc conceptuel/pédagogique : un libellé « critique » et un
  défaut qui enseignent l'inverse du RAW, sur une fonction qui ne décore qu'un indicateur du fil de
  chat. **Fix** : recadrer la section en ce qu'elle fait réellement (surlignage des valeurs extrêmes
  du dé sur les jets libres, qui n'ont pas de Seuil), ou la retirer si elle induit surtout en erreur —
  jamais la câbler aux Tests. Peut aussi justifier un `bug_tickets`.
- **Audit de compréhension approfondie des 31 docs `docs/SYSTEME/*.md` (2026-08-26) — CLOS**, les
  31 en statut 🔎 dans `INDEX.md` (upgrade depuis le premier passage ✅ plus superficiel du même jour,
  25/33 par sondage d'agents). Deuxième passage : lecture intégrale de chaque doc par moi-même,
  confrontation directe au code (pas de confiance aveugle dans un rapport d'agent), un fichier à la
  fois. Trouvailles les plus significatives, au-delà des ~50 numéros de migration périmés (refonte
  2026-08-22) déjà corrigés : `CHARACTER_FLUX.md` décrivait une architecture d'inventaire (`reloadKey`)
  remplacée par `characterStore` sans que le doc ait suivi ; `COMBAT REFERENCE.md` §6.3 décrivait les
  Attaques Multiples comme non construites alors qu'elles le sont depuis la Session 165 ; deux dettes
  documentées comme actives (STUN2, RW17-1) se sont révélées déjà résolues ; `CONVENTIONS.md`
  contenait une collision de code non résolue (PC28 utilisé pour 3 significations distinctes) ;
  `EXOARMURE.md` citait une route/fichier `exo-equipment`/`exoEquipment.js` inexistants (le catalogue
  passe par `/api/equipment`) — pertinent pour l'Étape B ci-dessus. Un vrai bug de code trouvé au
  passage (pas juste un problème de doc) : ticket `bug_tickets`/`AUDIT-SYSTEME` ("VOXEL_ADD/REMOVE/
  UPDATE et MAP_SWITCH/MAP_VIEWPORT — client émet, aucun handler serveur"), **résolu depuis** (code
  mort supprimé, `MAP_SWITCH` recréé dans `socketBattlemap.js`). `docs/SYSTEME/INDEX.md` §8 (nouvelle
  section) indexe les couplages inter-systèmes trouvés en route (Entités/Tokens ↔ Moteur monde, Coffre
  ↔ Character) — alimentée au fil de l'eau, pas une carte de dépendances exhaustive dédiée (décision
  explicite : le risque de péremption d'une carte sans déclencheur de mise à jour naturel dépasse sa
  valeur, voir discussion 2026-08-26).
- **Dispatch de résolution combat (Tir/CaC × PJ/PNJ/Drone/Exo) — architecture incohérente, trouvé en
  écrivant l'Exo-CaC (2026-08-26)**. Deux problèmes distincts, tous deux dans
  `server/src/socket/socketCombatHelpers.js`/`socketCombatResolution.js`/`socketCombatExo.js` :
  1. `resolveDroneAssaultAction` mélange encore Drone-Tir ET Drone-CaC dans une seule fonction
     (branchement interne `isCaCWeapon`) — c'est la seule des 6 combinaisons type×action qui ne soit
     pas déjà scindée (Humain-Tir/Humain-CaC/Exo-Tir/Exo-CaC le sont chacune, cf. `resolveAssaultAction`/
     `resolveMeleeAction`/`socketCombatExo.js`).
  2. Le point de dispatch (quelle fonction appeler selon `character.type` × `action.type`) est éclaté à
     deux endroits avec deux styles différents : pour `'assault'`, le redirect drone vit *dans*
     `resolveAssaultAction` elle-même (`character.type==='drone'` interne), alors que le redirect exo
     vit *dans* `socketCombatResolution.js` (évite un import circulaire avec `socketCombatExo.js`,
     qui importe déjà des helpers de `socketCombatHelpers.js`) ; pour `'melee'`, drone ET exo sont
     tous deux routés depuis `socketCombatResolution.js`. Trois styles pour la même décision.

  **Rework ciblé recommandé** (pas les 6 cases — voir ci-dessous) : scinder `resolveDroneAssaultAction`
  en `resolveDroneAssaultAction`(Tir)/`resolveDroneMeleeAction`(CaC), et unifier tout le dispatch en un
  seul endroit dans `socketCombatResolution.js` (une table `{characterType, actionType} → resolver`),
  jamais un redirect caché à l'intérieur d'un résolveur humain. **Ne pas toucher**
  `resolveAssaultAction`/`resolveMeleeAction` (le contenu humain lui-même, hors leur redirect drone à
  retirer) — code le plus testé/joué du projet, aucun besoin fonctionnel de le réécrire, uniquement du
  risque. Décision Saar (2026-08-26) : rework ciblé plutôt que les 6 modules complets, pas mélangé à
  l'ajout de fonctionnalité — chantier à part, pas cadré plus finement à ce jour.
- **Badge de type exo « PJ » au lieu de « EXO »** (`CombatRosterWindow.jsx:224-226`, signalé Saar 2026-08-28) — la logique `isDrone ? 'drone' : isPnj ? 'pnj' : 'pj'` fait tomber `charType === 'exo'` dans le défaut `'pj'`. Fix : `isExo` + classe `combat-badge-exo` (`index.css`) + clé `rosterWindow.typeBadge.exo` (`combat.json:148`) + grep du même patron `? 'pj'` / `? 'pnj'` ailleurs (même famille que `feedback_exo_pilot_routing_bug`). Correctif isolé, hors chantier `PLAN_RW_DECLARE_WINDOWS`
- Module Blessures — animation Tests de Choc restante (l'apparition des badges de statut est faite)
- Options de campagne à finir : `revers`, `skill_natural_prog`, `celebrity`
- Membres détruits (distinction Mortelle vs Membre détruit) — différé (Saar 2026-07-29), la gravité Mortelle couvre Bras/Jambes comme Tête/Corps tant que cette option n'existe pas
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (redondant depuis le drag & drop) — différé : nécessite un `KeyboardSensor` `@dnd-kit` d'abord pour ne pas régresser l'accessibilité clavier (`PointerSensor` seul aujourd'hui), sauf si le compromis d'accessibilité est explicitement accepté
- Upload screenshot éditeur → MinIO
- Jets Favoris : drag-to-reorder macros (UI)
- Paramètre campagne GM entity move mode (reporté)
- Sprint Drones 2d/2e/3 (auto-annonce, `resolveDroneAutoAction`, télépilotage). **+ 2 bugs pré-existants trouvés en test 2026-08-28, ticketés** : (1) `getCharacterMovementBudget` (`movementBudgetService.js:34-41`) sans branche `drone` → `world-path-preview` 500 en boucle pour un token drone, latent aussi dans `planCombatWorldMovement` — fix = `getDroneMovementBudget` lisant `drone_sheet.vitesse`, bloqué sur le mapping `vitesse` (entier) → allures (RAW) ; (2) bloc melee de l'annonce (`socketCombatAnnouncement.js:627-704`) sans branche `isDrone` → CaC drone sans programme `armement_contact` accepté puis dissous en silence à la résolution
- Sprint CaC 4b — validation fonctionnelle requise avant
- Sprint Annonce v2 — actions précédentes en lecture seule
- Sprint Tooltips Compétences (`SkillsPanel` bouton ⓘ)
- Sprint Waypoints — déplacement par points intermédiaires
- Sprint Page Santé Serveur — `/api/health/detailed`
- Moding Groupe 1/2 (slot logiciel legacy) — migration vers l'architecture Groupe 4 reportée (Strangler Fig), 4 dettes résiduelles suivies via `bug_tickets` (`MODING4-*`)
- Avatars utilisateur, optimisation voxel face culling, persistance viewport caméra, reconnexion WebSocket, favicon application (Phase 3 — Polish + assets)

---

## Hors scope V1

- Fog of war
- Webcam / audio / vidéo
