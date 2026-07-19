# EN COURS — Dettes actives et prochaines étapes
> **2026-07-15 — base commune de travail** : après sauvegarde complète, les espaces `8193/8194` et
> `8293/8294` repartent du tag `baseline/common-20260715` sur les branches distinctes `dev/cousin`
> et `dev/monde`. Seul le code versionné est synchronisé ; les configurations, bases et assets ne
> sont jamais recopiés entre instances. Le détail et le retour arrière sont dans
> `docs/WORKFLOW_FUSION.md` et `/home/codex/backups/enclume-common-baseline-20260715-125308`.
> Synchronisation validée : les trois arbres Git sont identiques, les buckets actifs sont désormais
> `enclume-assets-cousin`, `enclume-assets-monde` et `enclume-assets-fusion`, et les trois couples
> client/API répondent avec leur proxy same-origin. Tests : 124 monde + 3 configuration, deux builds
> Vite et quatre handshakes Socket.IO.
>
> **2026-07-15 — première fusion commune déployée** : les environnements historiques restent séparés
> sur `8193/8194` et `8293/8294`. Le worktree `/home/codex/Enclume-fusion`, branche `integration`,
> porte le merge `1f048cd` de `92ae9a9` avec la tête cousin `bad0190` et est déployé isolément sur `8393/8394`, base
> `vtt_fusion`. `origin/fusion-kiwi` est explicitement exclue car son éditeur Surface v2 régresserait
> le document monde v12. Workflow durable : `docs/WORKFLOW_FUSION.md`. Contrat d'autorité :
> `docs/FUSION_PROJET_COUSIN.md`.
> Point de restauration préalable vérifié : `backup/pre-fusion-20260715-110349` et
> `/home/codex/backups/enclume-pre-fusion-20260715-110349`.
> Validation : 124 tests monde/serveur, 28 tests Surface, ESLint ciblé, build Vite et smoke
> Playwright Chromium passent ; les six services historiques et de fusion sont actifs.
> Reste opérationnel : publier `integration` et son tag de sauvegarde sur GitHub dès qu'une
> authentification propre est disponible pour le compte `codex`. Ne pas détourner les identifiants
> du dépôt du cousin pour contourner ce point.
> Données cousin non fusionnées automatiquement : `vtt` contient actuellement `Drone 1` (GLB déjà
> copié dans MinIO fusion) et `Mechant` en plus de la campagne commune. Leur éventuel import doit
> inclure les relations de fiche/personnage et faire l'objet d'un chantier de données explicite.
> Accès `8393` : UFW public, NAT active, origines LAN et publique autorisées explicitement par
> `CLIENT_URLS`. Les comptes et hashes de mots de passe sont identiques dans les trois bases ; aucun
> compte n'a été supprimé pendant la fusion.
> Le navigateur utilise toujours une API et un Socket.IO same-origin sur `8393` ; Vite relaie en
> interne vers `8394`. Ne pas remettre une URL API publique figée dans les 34 consommateurs client.
>
> **2026-07-13 — transition instance Codex** : ajout des marqueurs de migrations historiques
> 75-83 et idempotence des migrations 143/149. Objectif : basculer l'instance de test 8293 de
> l'ancien dépôt monde vers `codex/world-engine-integration` sans perdre la base existante. La
> procédure impose une sauvegarde PostgreSQL + MinIO + code, puis une répétition complète sur une
> base jetable avant le redémarrage réel.
> Première répétition : défaut de découverte corrigé, les fichiers `*.test.mjs` ne sont plus
> chargés comme migrations par `NaturalMigrationSource`.
> Deuxième contrôle : les noms datés sont désormais classés selon leur numéro interne afin que
> 154-157 suivent réellement 153, y compris lors d'une installation vide.
> **Dette distincte découverte** : une base entièrement vide atteint correctement la migration
> 135, puis celle-ci exige l'équipement `TMP II`, normalement fourni par le seed historique. Le
> serveur exécutant les migrations avant les seeds, une installation neuve sans base restaurée
> reste à corriger dans le chantier catalogue combat. La montée de la base Codex existante n'est
> pas concernée : répétition réussie avec 86 migrations, comptes de lignes inchangés et démarrage
> serveur validé.
> Déploiement : les unités systemd Codex sont maintenant versionnées sous `deploy/` et doivent
> toutes deux cibler `/home/codex/Enclume-integrated`; le client utilise obligatoirement
> `--strictPort` sur 8293.
> **Bascule terminée** : batch 15/86 migrations appliqué à `vtt_codex`, comptes principaux
> inchangés, client 8293 et serveur 8294 actifs sous systemd depuis le dépôt intégré. Point de
> restauration complet : `/home/codex/backups/enclume-switch-20260713-172000`.

> Dernière mise à jour cousin : 2026-07-13 — Session 141 (suite 31) : transfert du skin Wizard
> (Section 12, sci-fi premium/glassmorphism) vers Login, Dashboard et les pages de configuration de
> campagne — clos et confirmé ; Session 141 (suite 30) : `docs/PLAN_MODING_PHASEB.md` Groupe 2

> Dernière mise à jour (dev/Saar) : 2026-07-17 — Session 156 : `docs/PLAN_BOUCLIER.md` Lots A+B+C
> — ✅ codés et testés, Lot A/B fonctionnel confirmé Saar en combat réel, Lot C navigateur non encore
> testé, item 81 ; **Session 157 (2026-07-18) : Sprint Tir Multi → refonte complète du moteur de tours
> combat, planification uniquement (aucun code) — `docs/PLAN_COMBAT_TIMELINE.md` intégralement conçu
> (4 Lots + analyses à charge + audit indépendant), correctif isolé `combat_pending` conçu et prêt à
> coder en premier, item 82** ; **Session 158 (2026-07-18) : correctif isolé `combat_pending`
> (`docs/PLAN_COMBAT_ACTION_QUEUE.md` §3) — ✅ codé et testé en base réelle (migration 170 + FIFO +
> guard prompt), item 83 ; Lot A (item 84) + correctif détection arme en main (item 85) — ✅ codés,
> testés, confirmés fonctionnels par Saar en navigateur ; Lots B+C+D (items 86-87) — ✅ codés (serveur
> testé par fixtures, client par build Vite propre — Lot D a trouvé et corrigé un bug réel du Lot B,
> fenêtre de réaction en boucle infinie), validation navigateur groupée encore à faire par Saar, rien
> committé** ; Session 154 : refonte `docs/PLAN_INVENTORY_SLOTS.md`
> (prérequis chantier Bouclier) — ✅ clos, fonctionnel confirmé Saar en navigateur, item 80 ;
> Session 153 : `docs/PLAN_ECHANGE.md` — correction
> du câblage MJ (Échange), retrait Lot A0, items équipés exclus du catalogue — ✅ clos, fonctionnel
> confirmé Saar en navigateur (parcours complet, item 79) ; Session 148 : fiche perso (compétences (X)/(-3),
> attributs) + `BUGIDENTIFIE.md` COM20 (affichage arme combat) — ✅ clos, item 76 ; Session 144 :
> bascule `dev/Saar` en branche
> exclusive de tout nouveau travail Claude (voir `CLAUDE.md` §3) ; Session 143 : `PLAN_MUTATION2.md`
> Lot 6 (Identité — sex/is_fertile/hand_pref, mutations et avantages unifiés dans
> `identityService.js`) — ✅ clos, fonctionnel confirmé Saar en navigateur (item 75) ; Session 142 :
> migration 158 (CASCADE `battlemap_texture_usage`) — crash serveur au démarrage résolu (item 74) ;
> Session 141 (suite 31) : Transfert du skin Wizard (Section 12,
> sci-fi premium/glassmorphism) vers le reste de l'interface — Login/Dashboard puis pages de
> configuration de campagne — ✅ clos, fonctionnel confirmé Saar ("magnifique") (item 73) ; Session 141
> (suite 30) : `docs/PLAN_MODING_PHASEB.md` Groupe 2
> (Lunette de visée) — ✅ clos, fonctionnel confirmé Saar (item 72) ; Session 141 (suite 29) : Interface d'ajout Avantage/
> Désavantage (octroi MJ narratif) + bug DELETE 500 pré-existant corrigé — ✅ clos, fonctionnel
> confirmé Saar (item 71) ; Session 141 (suite 27) : bug GENOTYPE "Hybride" visible pour un
> personnage Humain — ✅ clos (item 70) ; Session 141 (suite 26) : `PLAN_MUTATION2.md` Lot 5
> (Déblocage de compétences `[CS7]`) — ✅ clos, fonctionnel confirmé Saar (item 69) ; Session 141
> (suite 28) : `docs/PLAN_MODING_PHASEB.md` Groupe 1
> (bonus fixes optique) + architecture des slots exclusifs — ✅ clos, fonctionnel confirmé Saar
> (item 68) ; Session 141 (suite 25) : `PLAN_MUTATION2.md` Lot 4 (armure/arme
> naturelle) — ✅ clos, fonctionnel confirmé Saar en navigateur (item 67) ; Session 141 (suite 24) :
> détail de calcul en tooltip pour les
> attributs secondaires de la fiche perso (item 66) ; Session 141 (suite 23) : `PLAN_MUTATION2.md` Lot 3 (RD + Choc)
> câblés, consolidation resolveTargetHit, ✅ clos (item 65) ; Session 141 (suite 22) : Bug RD (Résistance aux Dommages)
> signe inversé corrigé, ⚠️ clos partiel (item 64) ; Session 141 (suite 21) : `docs/PLAN_MODING.md` — pause levée
> (Tir visé clos, dette `TIRVISE` close) + **Étape 0 codée et testée** (item 63) ; Session 141
> (suite 20) : Bonus féminin — règle fixe
> -2 FOR/+1 COO/+1 PRE + revalidation du bascule Sexe via `validateStep1` (item 62) ; Session 141
> (suite 19) : Résistances naturelles (poison/
> maladie/radiation/drogue) câblées + Attributs secondaires manquants ajoutés sur la fiche perso
> (item 61) ; Session 141 (suite 18) : Point documentaire — archivage de 8
> PLAN_*.md terminés, VOCABULARY.md peuplé, dettes `[DOC1]`/`[DOC2]` (item 60) ; Session 141
> (suite 17) : Tir visé (LdB p.227-228) + framework
> Actions Exclusives, `shared/combatExclusiveActions.js` (item 59) ; Session 141 (suite 16) :
> `ref_equipment_skill_assoc` reconstruite (migration 135, 154 paires arme↔compétence, trou de seed
> jamais peuplé depuis l'origine) suite à un audit de 4 signalements d'agents externes (item 58) ;
> Session 141 (suite 14) : cascade suppression token + char_sheet dédoublonné/UNIQUE + atomicité
> Wizard + bonus féminin corrigé (item 56) ; Coffre (Vault) terminé, Étapes 0-7 (item 57)
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL6.md`, `docs/Old/JOURNAL5.md et `docs/Old/JOURNAL4.md` et `docs/Old/JOURNAL3.md`

---

## CHANTIER PARALLÈLE — MOTEUR DE MONDE

Branche `codex/world-engine-integration`, sans modification du dépôt de l'autre développeur.

> Mise à jour monde 2026-07-14 : finition de l'éditeur contextuel et cohérence géométrique de bout
> en bout. Rotation/échelle uniforme des objets, panneaux latéraux automatiques et repliables, nom
> de salle éditable, identité de mur copiable, ajout de porte depuis le mur, halos de sélection,
> profils verticaux continus, volume multi-hauteur complet à la caméra et passerelles découpées par
> l'intérieur réel des murs courbes/profilés.
> Correctifs de finition du même jour : une salle multi-hauteur est traitée comme un `RoomVolume`
> solidaire. La position 3D réelle de la caméra est prioritaire quand elle entre dans la salle ; la
> cible des contrôles sert de repli stable quand elle reste dehors. Murs, passerelles, escaliers,
> connecteurs, objets 3D, tokens et effets du volume restent visibles sur toute sa hauteur. Les façades
> partagent une identité verticale et une normale intérieure canonique par salle. La coupe ne dépend
> donc plus de l'angle du rayon central ni d'un échantillon de cases : façades côté caméra
> transparentes, façades du fond opaques. La pose de porte conserve les arêtes canoniques, vise sa surface
> verticale et prévisualise le modèle 3D choisi. Rotation/échelle disposent aussi d'une
> prévisualisation locale, les passerelles sont rebranchées sur Sol/Plafond et les panneaux sont
> décalés de l'objet puis recalés verticalement à l'ouverture d'un accordéon.

- Phases 0 à 14 terminées : contrat métrique, document canonique, compilateur, navigation serveur,
  LOS/couverture, structures verticales, régions/effets runtime, cabine d'ascenseur mobile et
  branchement spatial complet du combat, tranches d'étage isolées avec profondeur visible dans les
  seuls volumes multniveau, murs courbes physiques, empreintes exclusives de salles non
  rectangulaires, fusion de volumes à hauteurs différentes et profils verticaux de murs.
- `surface_data` v12 porte tranches verticales, arcs et apparences intérieures canoniques. Salle,
  mur et objet sélectionnés utilisent des panneaux contextuels déplaçables ; les réglages longs sont
  repliables et la barre latérale d'édition ne conserve que les outils réellement actifs.
- Un profil de mur couvre la hauteur totale de la salle. Une passerelle liée par `clipRoomId` est
  intersectée avec la même empreinte intérieure au rendu, dans le snapshot et dans la navigation.
- `entities.state.transform.scale` est partagé par le rendu, l'occupation et la LOS ; une mutation
  d'apparence ne peut pas désynchroniser le volume physique.
- Les anciennes cartes voxel ne sont pas une cible de compatibilité. Elles peuvent seulement servir
  de fixtures et peuvent être supprimées si elles gênent le modèle canonique.
- L'ascenseur est une cabine physique mobile : aucune arête verticale ou téléportation ne doit être
  réintroduite. Ses passagers sont attachés à son repère local durable.
- Le combat déclare désormais une destination ; le serveur dérive l'allure, replanifie sous verrou
  et applique l'arrêt réel. Portées, contact, interactions, LOS et couverture sont mesurés dans le
  monde 3D canonique.
- Les autorités voxel/Redis/pathfinder historiques ont été supprimées. Aucune rétrocompatibilité
  des cartes anciennes n'est exigée.
- Prochaine étape : validation fonctionnelle Playwright et manuelle sur une carte canonique
  multi-étages, puis revue d'intégration avec la prochaine tête du projet combat.

Référence obligatoire : `docs/SYSTEME/MOTEUR_MONDE.md`.

---

## ⚡ PROCHAINE ÉTAPE EXACTE

🔒 En cours : — (aucune session active)

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

> **Item 93 (Session 164, dev/Saar) — Chantier 11 Étape 2 (Module Armes DSL) ✅ CLOS.** Lot C1 (armure
> APHC/SAP/SLAP/HP/Explosive/Shrapnel) codé. Recherche menée avant conception (demande explicite Saar :
> documentation + inspiration pros, pas de rush) : rule element `DamageDice` de PF2e/Foundry confirme
> le pattern "transformation calculée" pour SAP/SLAP (-1 dé recalculé depuis la formule réelle de
> l'arme, jamais lu depuis une chaîne catalogue par munition×arme) ; design RPG général confirme que
> l'AP doit réduire l'armure de la cible plutôt que gonfler le dé de dégât. **Écart trouvé en codant** :
> 3 des 6 familles (HP/EXPLOSIVE/SHRAPNEL) ont un DSL catalogue incompatible avec
> `docs/REGLES/REGLESMUNITIONS.md` (scaling `_ARME` inventé, `DMG_DROP=` jamais parsé) — même défaut que
> les 5 cas déjà confirmés fautifs ce chantier (dont Assommante/Choc, migration 160). **Décision
> d'architecture** : plutôt qu'une migration de plus (répétée à chaque nouvelle munition mal saisie),
> `AMMO_MECHANIC_ACTIONS` (`shared/weaponAmmoDsl.js`, nouveau registre par `tags.FX`) devient la seule
> autorité pour ces 6 familles — le catalogue devient cosmétique, aucune migration nécessaire, une
> nouvelle munition fonctionne automatiquement dès que `FX=` est posé. **Codé** :
> `reduceDiceCount`/`resolveAmmoMechanic`/`resolveMechanicDamageFormula` (`shared/weaponAmmoDsl.js`) ;
> `getEffectiveWeaponDamage`/`getEffectiveWeaponFormulaPreview` gagnent `rangeBand` (Shrapnel
> uniquement) et dispatchent sur le registre ; `resolveTargetHit` gagne `ammoFx` (armure cible
> multipliée par la fraction du registre) ; 2 sites `socketCombatHelpers.js` déjà rebranchés Lot A/B
> transmettent les nouveaux paramètres. **Testé** : 16 scénarios purs nouveaux
> (`shared/weaponAmmoDsl.test.mjs`, aucun fichier de test n'existait avant pour ce module), suite
> `shared/*.test.mjs` complète rejouée (49/49, 0 régression), `node --check` propre. **Non testé** :
> aucune connexion PostgreSQL disponible depuis cet environnement (scénario réel en base impossible
> ici), build Vite (aucun fichier client touché, hors scope), navigateur réel — à la charge de Saar, en
> particulier vérifier que les chaînes `FX=` réelles en base correspondent aux clés du registre
> (sensible à la casse). **Données** : aucune migration (décision explicite de ce Lot).
>
> **C2 (Test de panne IEM) — clôturé narratif, décision Saar.** Recherche de la règle exacte
> (`docs/REGLES/REGLEMATERIEL.md` p.273-274, "Test de panne" : 1D20 sous l'Intégrité de l'objet, échec
> = -1 Intégrité, Catastrophe = -1D6 Intégrité + réparation experte). Saar a précisé que les munitions
> IEM ciblent des systèmes électroniques (exo-armure, vaisseaux) qui n'existent pas encore dans le
> projet — construire le mécanisme maintenant serait "une brique dans le désert", assumé et volontaire.
> Blocage annexe identifié en creusant : le seuil numérique de "Catastrophe" (terme transversal utilisé
> partout dans le LdB — combat, tests, blessures, pouvoirs Polaris) n'est formalisé nulle part dans le
> projet, ni dans les extraits de règles disponibles. Saar a fourni le texte "Catastrophes en combat"
> (table 1D10 de conséquences), mais pas le seuil de déclenchement lui-même. **Décision explicite de
> Saar : pas la priorité, ne pas ouvrir de chantier dédié maintenant.** `DMG=MUL(0.5)` (mi-dégâts IEM)
> reste codé et actif (Lot A) — seul le malus Test de panne reste narratif/MJ. Aucune ligne de code
> ajoutée pour C2.
>
> **C3 (zone Shrapnel) — différé, décision Saar.** Le ciblage n'est pas une sélection MJ mais des cases
> adjacentes calculées par le futur builder — nécessite une collaboration avec Kiwi (monde/builder),
> hors périmètre solo. Armure/dégression par portée de Shrapnel déjà câblées par C1 ; seul le
> ciblage multi-cibles reste à faire, plus tard.
>
> **Clôture documentaire** : `docs/PLAN_ARMES_DSL.md` archivé vers `docs/Old/` (Règle 10,
> `docs/RegleDocumentaire.md`) — contenu durable (registre, invariants, décisions actées ci-dessus)
> transféré dans `docs/SYSTEME/COMBAT.md` §Munitions. `docs/ROADMAP.md` mis à jour (Étape 2 ✅ clos).

> ⚡ **Statut au 2026-07-18 fin de session : mécanisme central Retarder/Agir maintenant validé en
> navigateur par Saar, après une longue série de correctifs (Items 86-88 + refonte ci-dessous).**
> Validé en vrai (plusieurs Tours, plusieurs configurations Précipiter/Retarder croisées) : Agir
> maintenant actif exactement à partir de la propre phase d'Initiative du personnage retardé (jamais
> avant — vérifié explicitement contre un cas où un PNJ précipité passe légitimement devant), priorité
> RAW correcte à l'interruption, tous les participants résolvent dans le bon ordre sur plusieurs tests
> d'affilée. **Encore non testé avant de considérer le chantier clos** : le tour obligatoire de fin de
> Tour lui-même (aucun test récent n'a laissé un personnage retardé être le dernier debout — tous les
> tests l'ont fait interrompre en plein Tour) ; Passer consciemment ; deux personnages retardés
> simultanés (départage Initiative égale, RAW §0.1 point 5) ; un CaC retardé (seul le Tir a été retesté
> après les derniers correctifs) ; Retarder d'un Tour sur l'autre (RAW l'autorise explicitement, jamais
> exercé). ⚠️ **Rien n'est committé malgré une indication contraire de Saar** — `git status` au moment de
> la rédaction montre encore les 28 fichiers modifiés/nouveaux de toute la session (Lots B/C/D, refonte
> Item 88, tous les correctifs qui suivent) ; le dernier commit réel (`bb1bfef`) est antérieur à ce
> chantier. À vérifier par Saar avant toute autre action (mauvaise branche, mauvais dossier, échec
> silencieux) — ne pas supposer une sauvegarde qui n'existe pas.
> **Premier passage navigateur de Saar (2026-07-18)** — 3 correctifs additionnels appliqués avant de
> continuer les tests : CaC et Assaut n'étaient pas mutuellement exclusifs à la déclaration (plantait à
> la résolution — gap identifié mais jamais câblé pendant la conception du Lot B, corrigé client+serveur) ;
> couverture manuelle retirée (vestige déconnecté du vrai calcul de couverture, déjà auto-géré par le
> moteur monde — sera repris différemment par le futur builder) ; MJ devait resélectionner les 3 cibles
> d'une série CaC à chaque changement (un seul bouton relançait toute la chaîne) — corrigé au minimum
> (réutilise le pattern déjà correct côté joueur, un bouton par emplacement) pour ne pas bloquer les
> tests. **Chantier UI/UX dédié explicitement reporté** (décision Saar) : nettoyage CSS (classes de base
> `index.css` existantes mais contournées par du style en dur dans `StateSelector`/`MAP_ACTIONS`/
> `MeleeCombatPanel`) et refonte de l'affichage Retarder/Précipiter (actuellement fonctionnel mais peu
> lisible) — à lancer une fois les Lots B/C validés et stabilisés en jeu réel, pas maintenant.
> Détail complet, fichiers exacts et 2 bugs réels trouvés en
> auditant (dont un qui aurait cassé tout `COMBAT_START`) : Item 86 ci-dessous.
> **Troisième passage (2026-07-18)** — label « précipitation » du Tir visé faux pour Retarder (corrigé,
> renommé) ; motif racine du blocage « fenêtre de modificateur non validable, Tour planté » identifié
> (deux gardes silencieuses de `COMBAT_ACTION_CONFIRM`, jamais de message — corrigé, `COMBAT_DECLARE_ERROR`
> explicite) ; affordance « Agir maintenant » ajoutée pour un personnage en délai pendant une fenêtre de
> réaction ouverte (avant, seul le tour obligatoire l'affichait clairement). Détail complet : paragraphe
> dédié entre Items 86 et 87 ci-dessous.
> **Refonte architecturale (2026-07-18, Item 88)** — un 2ᵉ log de blocage a mené Saar à demander une
> réflexion de fond plutôt qu'un patch de plus : `AWAITING_REACTION_WINDOW` (sous-état FSM temporisé du
> Lot B) est **entièrement retiré**, remplacé par une règle unique conforme au RAW (« agir à n'importe
> quelle phase d'Action », aucun minuteur) — 3 bugs réels en une journée venaient tous de ce même
> sous-état. Detail complet : Item 88 ci-dessous, juste avant Item 87 (qui documente encore l'ancien
> comportement — lire Item 88 en premier pour l'état actuel).
> **Deuxième passage navigateur de Saar (2026-07-18)** — rapport de 6 points, tous traités :
> **bug racine réel corrigé** : `COMBAT_ACTION_CONFIRM` marquait l'entrée d'échelle `resolved` **avant**
> d'appeler `resolveMeleeAction`/`resolveAssaultAction` ; si le resolver levait une exception, le
> `catch` englobant l'avalait côté serveur uniquement (`console.error`) sans jamais appeler
> `advanceTimeline` — le Tour restait gelé en silence (symptôme "plantage sur Civil, aucun message"),
> et un `COMBAT_TIMELINE_UPDATED` de reconnexion ultérieur pouvait ensuite désigner directement le
> prochain token légitime, donnant l'impression qu'un personnage en délai « shuntait » tout le monde
> alors que c'était juste la suite normale d'une échelle où l'entrée cassée avait été traitée comme
> résolue. **Corrigé** : le bloc resolveur est isolé dans son propre `try/catch`, qui émet désormais un
> `COMBAT_DECLARE_ERROR` explicite en chat et appelle `advanceTimeline` dans tous les cas — l'échelle
> ne peut plus rester bloquée en silence. **Cause exacte de l'exception d'origine (Civil, double
> Scorpion) non identifiée avec certitude — `[INCONNU]`**, code relu sans trouver de suspect évident
> (dual-wield structurellement identique aux deux fenêtres) ; le filet de sécurité posé rendra l'erreur
> visible en chat si ça se reproduit, avec le message exact nécessaire à un vrai diagnostic.
> **Autres correctifs** : (1) sous-état `AWAITING_REACTION_WINDOW` absent de la table de transitions
> pour `COMBAT_ACTION_CONFIRM` — un joueur cliquant « Agir » pendant une fenêtre de réaction ouverte
> recevait le message générique « Action non autorisée dans cet état de combat » (cause du symptôme LOS
> rapporté, plausible mais pas certaine sans reproduction exacte) ; message désormais explicite par
> sous-état + bouton « Agir » désactivé côté client (`CombatActionWindow.jsx`, `CombatOverlay.jsx`)
> tant que la fenêtre est ouverte, plutôt qu'un clic voué à échouer. (2) Redirection d'interception LOS
> (§6 point 3, Item 86) vérifiée correcte par relecture — `checkCombatLOS`/`redirectToInterceptor`
> fonctionnent comme conçus, aucune correction nécessaire là. (3) MJ n'avait structurellement aucun
> bouton dédié Retarder/Précipiter — `InlineChip` est une puce à cycle (un seul clic fait défiler
> normal→précipité→retardé sans jamais montrer les 3 choix), contrairement à `StateSelector` côté
> joueur (3 boutons visibles). `StateSelector` exporté depuis `CombatActionWindow.jsx` et réutilisé tel
> quel dans `CombatGmDeclareWindow.jsx` pour la ligne vitesse. (4) Messages d'erreur de déclaration
> assaut (arme manquante, mode de tir incompatible, **compétence Tir Automatique manquante**, arme
> drone introuvable) routés vers l'événement générique `error` → bannière flottante isolée
> (`gmSocketError`) au lieu du fil de chat — convertis vers `COMBAT_DECLARE_ERROR` (même patron que
> « Tir visé : ... », explicitement salué par Saar comme le bon format) avec plus de détail
> (`socketCombatAnnouncement.js`, bloc PC22/PC23). **Testé** : `node --check` propre sur les 3 fichiers
> serveur touchés, build Vite complet propre, fixture de fumée (construction + pas courant) rejouée
> sans régression. **Non testé** : navigateur réel (à nouveau la charge de Saar) ; la cause exacte du
> crash Civil reste à confirmer par le message désormais visible en chat s'il se reproduit.

> **Troisième passage navigateur de Saar (2026-07-18)** — 4 points rapportés sur le Lot D/fenêtre de
> réaction, tous traités : (1) le motif d'inéligibilité « précipitation » du Tir visé
> (`shared/combatExclusiveActions.js` `getAimIneligibilityReasons`) s'affichait même quand le joueur
> venait de choisir Retarder — la clé compare `state.vitesse` à l'état persisté sans distinguer la
> direction du changement (normal→retardé/précipité/normal), le libellé « précipitation » était donc
> faux pour 2 des 3 transitions possibles. Renommé en « changement de vitesse » (générique, correct dans
> les 3 cas). (2) Bug racine réel identifié derrière « fenêtre de modificateur non validable, Tour
> planté » : `COMBAT_ACTION_CONFIRM` (`socketCombatResolution.js`) a deux gardes qui existaient déjà
> (garde FSM `canTransition` + garde `step.tokenId !== tokenId` re-vérifiant le pas courant au moment du
> clic) mais aucune des deux n'émettait de message en cas de rejet — retour silencieux (`return` nu).
> Scénario reconstitué : le MJ ouvre la fenêtre de modificateurs d'un PNJ (passe le PRECHECK, à ce
> moment légitime) puis, avant de cliquer Confirmer, un personnage en délai déclenche « Agir maintenant »
> (légitime aussi — priorité RAW sur l'action normale, §6ter point 3) : l'échelle est réordonnée sous les
> pieds du MJ, son clic Confirmer arrive ensuite sur un pas qui n'est plus le pas courant et échoue sans
> aucun retour — la fenêtre reste affichée, semble ne plus répondre, indiscernable d'un plantage. Ce
> n'est pas un bug de concurrence à éliminer (la priorité du personnage en délai est voulue) mais un
> silence à combler — même famille que le correctif Item 86 (Civil/Scorpion) généralisée ici aux deux
> gardes de `COMBAT_ACTION_CONFIRM` : message `COMBAT_DECLARE_ERROR` explicite (qui a pris la main,
> pourquoi la fenêtre n'est plus valide) au lieu d'un no-op muet. (3) L'unique affordance du joueur en
> délai pendant une fenêtre de réaction ouverte (pas le tour obligatoire de fin de Tour, un cas différent
> déjà bien traité) était un simple portrait cliquable dans la timeline, sans texte ni bouton — beaucoup
> trop discret (« la fenêtre Agir maintenant n'est apparue chez le joueur qu'au tour obligatoire, plus
> tard »). Ajouté : panneau explicite « <Perso> — action retardée : agir maintenant, avant la suite ? »
> avec bouton doré, un par personnage en délai contrôlé par ce viewer, même patron visuel que le panneau
> du tour obligatoire (sans bouton Passer — non valide pendant une fenêtre de réaction,
> `triggerDelayedPass` le rejetterait). (4) Message MJ/acteur bloqué pendant la fenêtre reformulé (texte
> plus explicite sur qui/pourquoi) — clarification minimale seulement, la refonte complète du panneau
> reste dans le chantier UI/UX différé (décision Saar, cf. plus haut). **Testé** : `node --check` propre
> sur `socketCombatResolution.js`, `esbuild` propre sur `CombatOverlay.jsx`, build Vite complet propre (0
> erreur, seul l'avertissement pré-existant de taille de chunk). **Non testé** : navigateur réel (à la
> charge de Saar) — en particulier le scénario exact qui a produit le blocage rapporté n'a pas pu être
> rejoué (pas de fixture dédiée à cette race précise, la garde touchée est un ajout de message sur un
> chemin de code par ailleurs inchangé). **Données** : aucune migration. **Retour arrière** : aucun
> schéma touché.

> **Analyse de log (2026-07-18, même journée)** — Saar a fourni les logs serveur d'un Tour test sans
> savoir interpréter un blocage ; bug racine réel trouvé en lisant le log (pas en reproduisant) :
> `[DBG] COMBAT_ACTION_CONFIRM — tokenId:238cb98c... mods:null` suivi de
> `[WS] COMBAT_ACTION_CONFIRM — assault sans confirmedModifiers` — l'assaut d'un PNJ a été marqué résolu
> sans jamais lancer de dé, aucun message. Cause : `COMBAT_ACTION_PRECHECK` traitait
> `AWAITING_REACTION_WINDOW` (et `AWAITING_DEFENSE`) comme un rejet dur (`callback({ ok:false })`,
> exactement le même traitement qu'un blocage LOS définitif) au lieu d'une attente transitoire comme
> `AWAITING_DAMAGE` (`callback({ awaiting:true })`, pattern déjà existant). Le PNJ de ce test avait son
> assaut présenté juste après le premier tir raté du Tour, au moment exact où le personnage retardé
> (Joueur 3) ouvrait une fenêtre de réaction — precheck rejeté en dur, `assaultPrecheckOk` passait à
> `false`, le bouton générique « Agir » (sans fenêtre de modificateurs) s'affichait à la place de
> `CombatModifiersWindow`, clic MJ, confirm sans `confirmedModifiers`, assaut ignoré en silence côté
> serveur. Corrigé : `AWAITING_REACTION_WINDOW`/`AWAITING_DEFENSE` rejoignent `AWAITING_DAMAGE` dans la
> branche `awaiting:true` (`socketCombatResolution.js`) ; le retry côté client (`CombatOverlay.jsx`,
> effets `meleePrecheckOk`/`assaultPrecheckOk`) dépendait uniquement de `precheckRetryKey`
> (`COMBAT_ATTACK_RESULT`) — ajouté `subPhase` aux dépendances pour retenter dès la fermeture de la
> fenêtre, pas seulement après une attaque déjà confirmée. Filet de sécurité ajouté en plus (double
> protection, pas un correctif du symptôme) : le cas `assault sans confirmedModifiers` émettait un
> `console.warn` serveur seul — émet désormais aussi `COMBAT_DECLARE_ERROR` en chat, au cas où ce chemin
> se reproduirait pour une autre raison. Non confirmé/hors scope : le log montre aussi une déclaration
> d'action (4e participant, INI 12) dont la ligne de log apparaît après celle de `startResolutionPhase` —
> pourrait indiquer une course entre deux `COMBAT_ACTION_DECLARE` concurrents autour du comptage « tout
> le monde a annoncé » (pré-existant, aucun lien avec les Lots B/C/D), mais les 4 participants ont bien
> été résolus dans la suite du log — pas de perte de donnée confirmée, seulement un ordre de log
> surprenant. `[INCONNU]`, non creusé (hors du signalement de Saar, à surveiller si un vrai symptôme
> apparaît). **Testé** : `node --check` propre, `esbuild` propre, build Vite complet propre. **Non
> testé** : navigateur réel (le scénario exact — assaut PNJ présenté pendant une fenêtre de réaction —
> n'a pas de fixture dédiée ; la relecture du log est la seule preuve disponible pour l'instant).

> **Item 91 (Session 162, dev/Saar) — COM29 : Tir à deux armes, seule la main directrice trackée
> (munitions) ✅ CLOS.** Cause `[VÉRIFIÉ]` (LdB `docs/REGLES/REGLESYSCOMBAT.md` p.226 "Tirer avec deux
> armes" relu et cité exactement) : le personnage tire réellement des deux armes en dual-wield (c'est
> la justification fictionnelle du bonus +3/+5), donc les deux doivent consommer et vérifier leurs
> munitions propres — `combat_actions` n'avait qu'une seule colonne arme (`weapon_inv_id`), la main non
> directrice n'était jamais fetchée, vérifiée ni décomptée. Trouvé par Saar en marge de COM25/COM28.
> **Décision produit (Saar)** : jamais de blocage total tant qu'une main peut encore tirer — l'autre
> main à sec dégrade en tir simple (bonus deux armes annulé), message système privé (chat, propriétaire
> du personnage uniquement) expliquant pourquoi, jamais un refus d'agir.
> **Correctif** : migration `176` (`combat_actions.offhand_weapon_inv_id`, FK `char_inventory`, CHECK
> XOR miroir de `drone_weapon_inv_id`) ; `shared/dualWieldRules.js` (nouveau module, `resolveDualWieldFire`
> — autorité unique de la décision "qui tire", séparée de `shared/ammoRules.js` qui ne connaît que le
> comptage de munitions, pas l'arbitrage de tir) consommée à l'identique par la Déclaration (fail-fast,
> ne bloque que si les deux mains sont à sec) et la Résolution (autorité, `resolveAssaultAction`
> restructurée pour déterminer l'arme effective — portée/dégâts/mods/compétence/décompte tous
> re-paramétrés sur elle, jamais un usage figé de la main directrice). Message système : `WS.CHAT_MESSAGE`
> étendu d'un flag `system`+`i18nKey` (résolu côté client via `t()`, jamais de texte figé serveur —
> nouvelles clés `session.dualWieldAmmoOutPrimary`/`dualWieldAmmoOutOffhand`, fr+en), acheminé par le
> mécanisme d'émission ciblée `to:'user'`/`fallback` déjà existant (aucun nouvel événement WebSocket).
> Client : `offhandWeaponInvId` ajouté au payload `mapActions.attack` (`CombatActionWindow.jsx` +
> `CombatGmDeclareWindow.jsx`, main non directrice = `weaponMg` quand `hasTwoWeapons`).
> **Testé** : 7 tests unitaires `shared/dualWieldRules.test.mjs` (4 combinaisons dual-wield + 3 cas
> tir simple) ✅ ; `node --check` sur les 2 fichiers serveur touchés ✅ ; build Vite complet propre ✅ ;
> **scénario réel en base confirmé fonctionnel par Saar** — dual-wield complet (bonus + double décompte),
> main non directrice à sec (tir simple, décompte MD seule, message privé reçu uniquement par le
> propriétaire), main directrice à sec (symétrique), les deux à sec (blocage inchangé), message absent
> chez les autres joueurs connectés. **Chantier clos complet**, plus de réserve. **Données** :
> migration `176`, nullable et rétrocompatible. **Retour arrière** : `down()` de la migration retire la
> colonne ; revert du commit pour le reste.
>
> **Item 92 (Session 163, dev/Saar) — PLAN_CAC_BATTERIE.md Lot A : munition générique "Charge
> électrique" ✅ CLOS (Lot A uniquement).** Suite directe de COM28 — Saar a rejeté le correctif
> d'affichage seul (« la Matraque Mao a des munitions, un correctif serait l'inverse de cacher la
> misère ») et demandé une vraie mécanique de recharge, indépendante CaC/tir. Investigation confirmée
> `[VÉRIFIÉ]` : `caliber` est déjà l'unique champ de liaison arme/munition du projet
> (`docs/Old/JARMES.md` §2.5, « Aucune exception : Toujours utiliser caliber »), utilisé par égalité de
> chaîne sans distinction de catégorie — rien à changer côté code, seulement de la donnée manquante sur
> 19 armes (`ammo_count` réel, `caliber` resté `NULL`). Piège évité en cours de route : `GP-*`
> (`GP-A1`…`GP-D4`, retrouvé lié à 13 armes à énergie + Poing Kryss) est une classification de sources
> d'énergie de **drones** (`docs/REGLES/REGLEDRONE.md`), réutilisée intentionnellement pour un domaine
> différent (confirmé `docs/Old/JOURNAL2.md:4587`, « enrichissement intentionnel... conservé ») — ne pas
> y raccrocher ce chantier. **Décision produit (Saar)** : munition générique unique "Charge électrique",
> `family='Munitions'`, `category='Charges électriques'`, `caliber='Charge électrique'`, 10 sols/charge
> (aligné sur `9 mm - Munition standard`) ; scope limité au Lot A (19 armes à charge numérique propre :
> 7 armes de contact + Flex + 11 armes étourdissantes/soniques) — Lots B (armes à durée, "1
> heure"/"1h de gaz", mécanique de jauge temporelle distincte), C (armes de trait, déjà liées à
> Flèche/Carreau, juste un lien à poser) et D (lanceurs, Capsule existe déjà pour Lance-capsules, les
> autres nécessitent un item dédié par type de projectile) volontairement reportés — root cause
> distincte par lot. **Correctif** : migration `178` (`server/src/db/migrations/178_ammo_charge_electrique.js`,
> 176 pris entre-temps par COM29) — INSERT munition + UPDATE `caliber` sur les 19 armes, idempotent
> (patron migration 75), échec net (`throw`) plutôt qu'état partiel silencieux si le nombre d'armes
> mises à jour ne correspond pas exactement. Aucun code applicatif touché : `resolveAmmoInit`/
> `reloadWeapon`/`weaponAmmoStatus` (COM28) fonctionnent immédiatement dès `caliber` peuplé. **Testé** :
> migration appliquée en base réelle (20/20 lignes liées, vérifié par requête) ; premier essai a échoué
> proprement sur `tech_level NOT NULL` manqué, transaction Postgres a tout annulé (aucune ligne
> orpheline), corrigé et réappliqué ; `node --test shared/ammoRules.test.mjs shared/dualWieldRules.test.mjs`
> → 15/15 (non-régression COM25/COM28/COM29) ; **scénario réel navigateur confirmé fonctionnel par
> Saar** (équiper/recharger une arme du Lot A, affichage munitions correct en combat). **Anomalie infra
> découverte en testant `down()`** (hors scope, signalée séparément) : `knex migrate:rollback` CLI
> n'exécute rien de constatable sur ce projet (bookkeeping et données inchangés malgré un message de
> succès) — `down()` lui-même vérifié fonctionnel par appel direct (20→0 lignes, 0 exception), donc pas
> en cause ; piste non creusée : `NaturalMigrationSource`. Détail complet : `docs/PLAN_CAC_BATTERIE.md`
> (reste actif — Lots B/C/D non fermés). **Retour arrière** : `down()` de la migration 178 fonctionnel
> (vérifié par appel direct, pas via la CLI cassée) ; aucune perte possible (`current_ammo` de ces armes
> n'a jamais pu être posé avant cette migration).
>
> **Item 90 (Session 160, dev/Saar) — COM25 + COM28 : munitions insuffisantes bloque le tir, statut
> munitions Matraque Mao ✅ CLOS** (session parallèle, code déjà présent au moment d'ouvrir Item 91
> ci-dessus — entrée reconstituée a posteriori depuis le diff réel, pas depuis une note prise en
> l'écrivant). COM25 : aucun garde n'empêchait de déclarer/résoudre un assaut avec `ammo_remaining=0`.
> COM28 : `weaponAmmoStatus` affichait "0/40 munitions" sur une arme de contact (Matraque Mao) sans
> calibre réel. **Correctif** : `shared/ammoRules.js` (nouveau module) — `hasEnoughAmmo` (autorité
> unique fail-fast Déclaration + autoritaire Résolution, `socketCombatAnnouncement.js` +
> `socketCombatHelpers.js`) et `weaponAmmoStatus` (déplacé depuis les copies locales
> `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`, gagne un paramètre `caliber` — non nul requis
> pour tout statut, cf. `resolveAmmoInit`). **Testé** : 8 tests unitaires `shared/ammoRules.test.mjs`.
>
> **Item 89 (Session 161, dev/Saar) — Cluster E / COM2 : statut arme absente côté MJ (2M/Tr jamais
> affichés) ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Cause `[VÉRIFIÉ]` par lecture croisée
> client/serveur : le bloc ARMEMENT de `CombatGmDeclareWindow.jsx` (statut munitions COM20) ne testait
> que `weaponMg`/`weaponMd` — un PNJ équipé uniquement d'une arme deux-mains (`2M`) ou montée sur
> trépied (`Tr`, slot réel — `inventoryService.js` `WEAPON_SLOTS`) n'affichait aucun statut arme côté
> MJ. Le `2M` avait déjà été ajouté côté PJ (`CombatActionWindow.jsx`, COM20/Session 158) mais jamais
> répercuté côté MJ — dérive du pattern « chaque composant maintient son propre tableau `[['MG', w],
> ['MD', w]]` en dur » ; `Tr` n'était affiché nulle part, ni PJ ni MJ.
> **Correctif** : nouvelle fonction pure `handSlotDisplayRows()` dans `shared/weaponSlots.js` — autorité
> unique de l'ordre d'affichage (dérivé de `HAND_WEAPON_SLOTS`) et de la règle de préfixe de main,
> consommée à l'identique par les deux fenêtres au lieu de dupliquer le tableau. `battlemaps.js`
> (`/combat-equipment`) transmet désormais `weapon2M`/`weaponTr` (déjà calculés par `resolveHandWeapons`
> mais jetés avant ce correctif). `CombatActionWindow.jsx` gagne `equippedTr` (même gap côté PJ).
> **Testé** : 5 nouveaux tests unitaires `shared/weaponSlots.test.mjs` (MG seul, MG+MD, 2M seul —
> reproduit COM2, Tr seul, aucune arme) ✅ ; build Vite complet propre ; `node --check` serveur/partagé
> propre ; confirmé fonctionnel par Saar en navigateur (MJ et PJ). **Non testé** : scénario `Tr` en
> conditions réelles (aucun item catalogue équipé en `Tr` disponible pour un test en jeu, couverture
> unitaire uniquement pour ce slot). **Données** : aucune migration, aucun effet runtime — changement
> d'affichage pur. **Retour arrière** : aucun schéma touché, revert du commit suffit.

> **Item 88 (Session 159, dev/Saar) — Retrait de la fenêtre de réaction temporisée (refonte
> architecturale, demandée explicitement par Saar après un 2ᵉ log de blocage : « qu'est-ce que tu
> essaies de faire ? Est-ce qu'on est vraiment alignés sur le fonctionnement souhaité d'un tour de
> combat ? Réflexion profonde. »).** Trois bugs réels en une seule journée de test (boucle infinie
> Item 87, confirmation silencieuse Item 87, precheck en rejet dur — paragraphe « analyse de log »
> ci-dessus) tous causés par le même sous-état FSM ajouté au Lot B (`AWAITING_REACTION_WINDOW`, minuteur
> 15s), jamais par Retarder lui-même. Relecture RAW à froid (`REGLESYSCOMBAT.md:554-567`) : « Le
> personnage peut alors agir à n'importe quelle phase d'Action » — **aucun minuteur dans le texte**, la
> fenêtre était une invention (actée avec Saar au moment du plan, §6ter point 3, mais dont le coût réel
> n'était pas visible avant de la tester en conditions réelles). Le tour obligatoire de fin de Tour (§6
> point 2, déjà codé au Lot B) faisait déjà, sans minuteur, ce que le RAW demande — la fenêtre de
> réaction était une couche redondante qui n'apportait rien de plus. **Décision (validée par Saar,
> "Ok, go") : supprimer entièrement `AWAITING_REACTION_WINDOW`, son minuteur, `justClosedReactionWindow`
> et tout leur câblage — unifier « Agir maintenant » en une seule règle valable à tout moment de
> `SLOT_ACTIVE` pendant la Résolution.**
> **Codé** : `combatFSM.js` — sous-état retiré du `TRANSITIONS` table (commentaire de tête réécrit,
> explique le retrait) ; `socketCombatHelpers.js` — `advanceTimeline` simplifiée (plus de
> `delayedCount`/`resolvedCount`/timer/`justClosedReactionWindow`, présente directement le pas suivant
> en `SLOT_ACTIVE`) ; `triggerActNow` unifiée (un seul chemin : si un pas normal existe, bloqué
> uniquement si `sub_phase !== 'SLOT_ACTIVE'` — c'est-à-dire si ce pas est déjà en cours de résolution,
> `AWAITING_DEFENSE`/`AWAITING_DAMAGE`, dés déjà lancés, cf. §6ter point 3 « explicitement écarté » du
> plan original ; sinon, tour obligatoire inchangé) ; `forceAdvanceResolution` — branche
> `AWAITING_REACTION_WINDOW` retirée (devenue impossible) ; `REACTION_WINDOW_MS`/
> `clearReactionWindowTimer`/`pendingMaps.reactionWindows` supprimés, ainsi que leur initialisation dans
> `socket/index.js` (`combatReactionWindows`) et le champ `reactionWindow` du payload
> `COMBAT_TIMELINE_UPDATED` (reconnexion comprise). `socketCombatResolution.js` — precheck et confirm
> perdent leurs branches `AWAITING_REACTION_WINDOW` (celles pour `AWAITING_DEFENSE`/`AWAITING_DAMAGE`,
> légitimes et pré-existantes, restent). **Client** : `combatStore.js` perd le champ `reactionWindow` ;
> `CombatTimeline.jsx` perd le minuteur dédié et la clé `isReactive` devient `subPhase === 'SLOT_ACTIVE'`
> (au lieu de `reactionWindow?.open`) — les cartes « en délai » restent cliquables en continu, plus
> seulement pendant une fenêtre ; `CombatOverlay.jsx` — le panneau « Agir maintenant » ajouté à la
> session précédente pour la fenêtre devient valable à tout moment de `SLOT_ACTIVE` (exclu pendant le
> tour obligatoire pour ne pas dupliquer son propre panneau) ; le panneau MJ « Forcer » perd la branche
> `AWAITING_REACTION_WINDOW` (ne reste que `AWAITING_DEFENSE`/`AWAITING_DAMAGE`, cas où un joueur ne
> répond vraiment pas) ; le bouton « Agir » du MJ et celui du joueur (`CombatActionWindow.jsx`) perdent
> leur état désactivé dédié à la fenêtre — une interruption reste possible à tout instant mais se résout
> proprement via le message d'erreur déjà en place (Item « analyse de log » ci-dessus, `step.tokenId !==
> tokenId`) plutôt que d'être pré-empêchée par un état de plus à synchroniser. Migration `174` non
> retouchée — son `CHECK` autorise encore `'AWAITING_REACTION_WINDOW'` en base, valeur simplement
> jamais plus écrite (permissif et inoffensif, pas de nouvelle migration pour un nettoyage cosmétique
> d'une valeur inutilisée). **Testé** : fixture jetable dédiée (10/10, campagne + 4 tokens + échelle
> construite à la main, 0 résidu après suppression) — Agir maintenant en plein `SLOT_ACTIVE` sans
> minuteur, retour naturel au pas suivant sans jamais passer par `AWAITING_REACTION_WINDOW`, blocage
> confirmé pendant `AWAITING_DEFENSE`, tour obligatoire toujours fonctionnel (Agir maintenant et Passer).
> `node --check` propre sur les 5 fichiers serveur touchés, build Vite complet propre (0 erreur, seul
> l'avertissement pré-existant de taille de chunk). **Non testé** : navigateur réel (à la charge de
> Saar) — la régression complète du Lot B (construction/interleaving/attaques multiples/`endTurn`) n'a
> pas été rejouée dans cette session (aucun de ces chemins n'a été touché par ce retrait, risque jugé
> faible, mais non vérifié empiriquement). **Données** : aucune migration. **Retour arrière** : aucun
> schéma touché, revert du commit suffit.
> **Correction (même session) — retour Saar, faute de compréhension réelle repérée par lui** : la
> première version de ce retrait autorisait « Agir maintenant » à *tout instant* de `SLOT_ACTIVE`, sans
> aucune borne — un personnage retardé avec une Initiative basse aurait pu interrompre un acteur avec
> une Initiative bien plus haute, ce qui contredit le sens même de Retarder (« plus tard dans le Tour »,
> jamais plus tôt — RAW `REGLESYSCOMBAT.md:554-567`). Saar a reformulé la règle en 3 points clairs et j'ai
> confirmé/corrigé chacun ; le point manquant était que « Agir maintenant » ne devient actif qu'une fois
> que le pas normal à résoudre atteint (ou dépasse) la **propre phase d'Initiative d'origine** du
> personnage en délai (`initiative × 100`), jamais avant — reste ensuite actif jusqu'à la fin du Tour.
> **Corrigé** : `triggerActNow` (`socketCombatHelpers.js`) compare désormais `referenceStep.position` à
> `rosterEntry.initiative × 100` et refuse (`return 'too_early'`) tant que ce n'est pas atteint ; la
> fonction retourne maintenant un statut (`'ok'`/`'too_early'`/`'busy'`/`'not_your_turn'`) au lieu d'un
> `undefined` muet, et `COMBAT_ACT_NOW` (`socketCombatResolution.js`) émet un `COMBAT_DECLARE_ERROR`
> explicite sur `'too_early'`. **Client** : `CombatTimeline.jsx` (cartes « en délai » cliquables) et le
> panneau dédié de `CombatOverlay.jsx` appliquent la même borne — le personnage n'apparaît plus cliquable
> avant sa propre phase, cohérent avec le retour Saar (« la fenêtre doit être active dès que… »).
> **Bug annexe trouvé en testant cette correction** : `endTurn` appelait encore
> `clearReactionWindowTimer`, fonction supprimée au retrait précédent — jamais détecté par le grep
> textuel (casse différente, `ReactionWindowTimer` vs le motif `reactionWindow` cherché), révélé
> uniquement en poussant une fixture jusqu'à la fin du Tour. Corrigé (appel retiré). **Testé** : nouvelle
> fixture jetable dédiée à la borne d'Initiative (9/9, campagne à 4 tokens Initiative 12/11/9/7, vérifie
> le refus tant que le pas courant n'a pas atteint 9, l'autorisation une fois atteint, et la priorité RAW
> à Initiative croisée) + fixture de régression complète Agir maintenant/tour obligatoire/Passer/`endTurn`
> (8/8, 0 résidu, a révélé le bug `clearReactionWindowTimer`) ; `node --check` et build Vite complet
> propres après correction. **Non testé** : navigateur réel.

> **Suite (même session, 2026-07-18) — bug réel trouvé au tour obligatoire d'un personnage en délai
> ayant déclaré un Tir (pas un CaC)** : `activeAssaultAction`/`playerActiveAssaultAction`
> (`CombatOverlay.jsx`) ne vérifiaient jamais `currentStep?.kind !== 'delayed_turn'`, contrairement à
> `activeMeleeAction`/`playerActiveMeleeAction` qui l'avaient déjà — asymétrie jamais remarquée. Résultat
> : dès que le tour obligatoire de fin de Tour présentait un personnage en délai ayant déclaré un
> assaut, la fenêtre de modificateurs de tir s'ouvrait quand même par-dessus le panneau dédié « Agir
> maintenant/Passer ». Cliquer « Valider » envoyait un `COMBAT_ACTION_CONFIRM` complet, rejeté en
> silence par le garde serveur (`step.tokenId !== tokenId`, l'entrée restant `delayed_waiting` puisque
> jamais repositionnée par un vrai Agir maintenant) — vécu comme un plantage total (« Crash combat, pas
> d'action du joueur ») alors que le serveur attendait légitimement. Root-caused via les logs de
> breadcrumbs ajoutés cette session : la dernière ligne visible était toujours le `COMBAT_ACTION_CONFIRM`
> initial, jamais la ligne juste avant la résolution — signature exacte d'un rejet précoce par ce garde.
> **Corrigé** : ajout de la même garde `currentStep?.kind !== 'delayed_turn'` aux deux variables assaut.
> **Testé** : `esbuild` + build Vite complets propres. **Non testé** : navigateur — scénario exact
> (personnage en délai avec un Tir déclaré, atteignant le tour obligatoire) à revalider par Saar.
> **Note annexe** : les logs de breadcrumbs `reconcileBattlemapElevators` ajoutés pour chasser un faux
> soupçon de deadlock se sont révélés bruyants (poll 300ms de `Canvas3D.jsx`/`Editor3D.jsx` tant qu'un
> ascenseur transite) — rendus silencieux sauf acquisition >100ms. `useCombatSocket.js` : `COMBAT_ENDED`
> ne réinitialisait que 2 états sur ~10 (retour Saar « mauvaise réinitialisation »), corrigé — tous les
> états de fenêtre/résultat sont désormais purgés à la fin d'un combat.

> **Bug racine réel, cause de toute la confusion « Agir maintenant » depuis le début de cette refonte
> (même session, 2026-07-18)** — Saar a demandé de vérifier la RAW pas à pas (déclaration croissante,
> résolution décroissante, dernier déclarant = plus rapide = premier à agir, donc un personnage retardé
> avec la PLUS HAUTE Initiative devrait pouvoir agir dès le tout début de la Résolution). Vérification :
> le raisonnement RAW de Saar est exact, et le code serveur (borne d'Initiative d'origine, item
> précédent) l'implémentait déjà correctement — **mais le client ne recevait jamais l'information pour
> l'afficher**. `combat_state.sub_phase` n'était diffusé aux clients qu'à la reconnexion
> (`COMBAT_STATE_SYNC`) — jamais pendant une partie normale. `subPhase` restait donc figé à `null` côté
> client du début à la fin d'une session de jeu, rendant fausses en permanence toutes les conditions
> `subPhase === 'SLOT_ACTIVE'` ajoutées cette session (panneau Agir maintenant mi-Tour, retry precheck,
> panneau MJ Forcer) — jamais détecté avant car le flux principal (bouton Agir normal, résolution pas à
> pas) ne dépend pas de `subPhase`, seulement `phase` et `currentStep`. **Corrigé à la source unique** :
> `broadcastTimelineState` (`socketCombatHelpers.js`) relit et inclut désormais toujours le `sub_phase`
> courant dans `COMBAT_TIMELINE_UPDATED` ; nouvel helper `broadcastCurrentSubPhase(io, campaignId)`
> ajouté aux 5 endroits où `setFSMSubPhase(..., 'AWAITING_DEFENSE'/'AWAITING_DAMAGE'/'SLOT_ACTIVE')` était
> appelé hors du chemin `advanceTimeline` (résolution suspendue en attendant un jet de dégâts/défense) et
> ne rediffusait donc jamais rien. **Client** : `combatStore.js` — `setTimelineState` ignorait
> silencieusement tout champ `subPhase` reçu (ne déstructurait que `turnNumber`/`entries`/`currentStep`)
> — LE bug exact qui annulait le fix serveur : même corrigé côté serveur, le client aurait continué à
> l'ignorer. Corrigé. **Testé** : fixture jetable dédiée (3/3 — premier broadcast de Résolution inclut
> bien `subPhase:'SLOT_ACTIVE'`, et `currentStep.position <= ownPosition` du personnage retardé à
> Initiative la plus haute dès ce tout premier broadcast, confirmant le scénario exact décrit par Saar).
> `node --check` + build Vite complets propres. **Non testé** : navigateur — c'est la pièce qui manquait
> à TOUTES les vérifications précédentes de cette session sur Agir maintenant ; à confirmer en vrai.

> **Item 87 (Session 158, dev/Saar) — Lot D de `docs/PLAN_COMBAT_TIMELINE.md` (§5, « Contrôle du temps
> MJ ») — ✅ CODÉ ET TESTÉ PAR FIXTURES.** Implanté avant tout retour navigateur sur les Lots B/C (Saar
> manque de temps pour tester dans l'immédiat, décision explicite : enchaîner plutôt que bloquer —
> risque accepté : si un test futur du Lot C révèle un bug du moteur central, le Lot D qui s'appuie
> dessus pourrait avoir besoin d'un ajustement mineur). **Généralisation de l'outil MJ existant** —
> même bouton, même événement `COMBAT_SKIP_PLAYER` (`socketCombatAnnouncement.js`), désormais autorisé
> par la FSM (`combatFSM.js`) depuis `AWAITING_DEFENSE`/`AWAITING_DAMAGE`/`AWAITING_REACTION_WINDOW` en
> plus de `SLOT_ACTIVE`/Annonce. Comportement par sous-état (`forceAdvanceResolution`,
> `socketCombatHelpers.js`) : `AWAITING_REACTION_WINDOW` → fermeture immédiate, comme une expiration
> normale ; `AWAITING_DEFENSE`/`AWAITING_DAMAGE` → « le serveur lance les dés à la place du joueur
> injoignable, il devient PNJ pour le Tour » — **découverte en implantant** : ces deux confirmations
> acceptaient déjà le MJ comme déclencheur autorisé (`!isGm` déjà présent dans leur garde de propriétaire,
> bien avant ce Lot) ; la seule pièce manquante était l'accès — `confirmMeleeDefense`/`confirmDamage`
> extraites des handlers `COMBAT_MELEE_DEFENSE_CONFIRM`/`COMBAT_DAMAGE_CONFIRM` vers des fonctions
> exportées de `socketCombatHelpers.js` (même code exact, aucune formule dupliquée — `forced:true`
> contourne uniquement la vérification de propriétaire et affiche le jet sous l'identité du personnage
> plutôt que celle du MJ) ; `SLOT_ACTIVE` — tour obligatoire d'un délai → équivaut à `COMBAT_DELAYED_PASS` ;
> entrée normale/pas simple bloqué → marqué `skipped`, l'échelle avance (le MJ dispose déjà par ailleurs
> du bouton « Agir » existant pour exécuter réellement l'action à la place d'un joueur silencieux — cette
> branche est un dernier recours, pas le chemin principal). **Client** : nouveau panneau MJ générique
> « Forcer » (`CombatOverlay.jsx`) visible pendant `AWAITING_DEFENSE`/`AWAITING_DAMAGE`/
> `AWAITING_REACTION_WINDOW`. **Bug réel du Lot B trouvé et corrigé en testant le Lot D** (pas en
> navigateur — par fixture, avant tout risque réel) : la fenêtre de réaction se rouvrait indéfiniment
> pour le même pas tant qu'un personnage restait en délai — `delayedCount>0 && resolvedCount>0` reste
> vrai en continu une fois la première entrée résolue, et rien ne distinguait « ce pas vient d'avoir sa
> fenêtre, ne pas la rouvrir » de « nouveau pas, fenêtre méritée » ; le minuteur naturel (15s) avait
> exactement le même défaut — **le Tour combat se serait bloqué pour de bon dès qu'un personnage
> retardait son Action**, jamais détecté par les fixtures du Lot B (qui ne poussaient jamais la fenêtre
> jusqu'à sa fermeture). Corrigé : `advanceTimeline` accepte un paramètre interne
> `justClosedReactionWindow` (jamais exposé à un event socket), positionné par le minuteur ET par
> `forceAdvanceResolution` — n'empêche l'ouverture que pour le pas qui vient d'être fermé, laisse les
> pas suivants légitimement candidats. **Testé** : `node --check` propre sur les 4 fichiers serveur
> touchés, `esbuild`/build Vite propres côté client, 2 scénarios de fixtures jetables (10/10 assertions,
> 0 résidu — fermeture de fenêtre sans boucle, entrée normale forcée, tour obligatoire forcé, no-op hors
> Résolution) + rejeu complet du scénario de régression Lot B (construction/interleaving/delay/act-now/
> endTurn, 7/7, 0 résidu) confirmant l'absence de régression du correctif `justClosedReactionWindow`.
> **Non testé** : navigateur réel (à la charge de Saar, comme Items 84-86) ; le cas à 2+ personnages
> delayed simultanés pendant un `COMBAT_ACT_NOW` (nuance mineure documentée dans le code, pas un bug
> confirmé). **Données** : aucune migration. **Retour arrière** : aucun schéma touché, revert du commit
> suffit si besoin.

> **Item 86 (Session 158, dev/Saar) — Lots B+C de `docs/PLAN_COMBAT_TIMELINE.md` (§5/§6ter/§6quater) :
> moteur de résolution générique + timeline client — ✅ CODÉS (serveur testé par fixtures, client par
> build Vite propre), ⚠️ AUCUNE VALIDATION NAVIGATEUR ENCORE OBTENUE.**
> Recherche best-practices faite avant code (exigence Saar) : FSM à sous-états explicites + parcours
> relu en direct sans curseur dupliqué (patron Foundry VTT `Combat.nextTurn`/lifecycle events, *Event
> Queue* de Game Programming Patterns) — confirme la conception déjà actée dans le plan, rien à
> corriger. **2 découvertes non anticipées par le plan, tranchées en codant** : (1) « Précipiter son
> Action » (+3 INI, -5 Action) était déjà presque entièrement câblé avant ce Lot
> (`combatSections.js`/`socketCombatAnnouncement.js` `iniDelta`, `resolveMeleeAction` `isRushedMod`) —
> Lot A capture déjà son effet sur `phase_position` du simple fait de l'ordre des étapes (iniDelta
> appliqué à `combat_roster.initiative` avant `buildTimelineEntries`) ; seul le guard RAW « précipité
> jamais retardable » restait à vérifier — **déjà garanti gratuitement** par le sélecteur `vitesse`
> exclusif à un seul choix (delayed/normal/rushed), rien à coder. (2) Un token sans aucune action
> complexe (juste déplacement/rechargement) n'a structurellement aucune entrée d'échelle (§5 « portée
> des entrées ») — le parcours générique doit donc fusionner deux sources triées ensemble : les entrées
> `scheduled` ET les membres du roster sans entrée ce Tour (`has_resolved`, colonne `combat_roster`
> existante depuis la migration 54, jamais câblée avant ce Lot).
> **Codé** (`server/src/lib/combatFSM.js`, `server/src/socket/socketCombatHelpers.js`,
> `server/src/socket/socketCombatResolution.js`, `server/src/socket/index.js`, `server/src/lib/
> losService.js`, `shared/events.js`) : nouveau sous-état FSM `AWAITING_REACTION_WINDOW` (minuteur en
> mémoire déclencheur, le FSM seul décide qu'on attend — corrige la proposition initiale erronée du
> plan §6ter point 3 correction 1) ; `pickNextTimelineStep`/`advanceTimeline` remplacent
> `advanceSlot`/`active_slot_idx` (fusion scheduled+simple ci-dessus, position DESC, relu en direct à
> chaque appel) ; `pickNextObligatoryDelayed` (tour obligatoire de fin de Tour, ascendant Initiative,
> §6 point 2) ; `triggerActNow`/`triggerDelayedPass` (nouveaux events `COMBAT_ACT_NOW`/
> `COMBAT_DELAYED_PASS`) — guard strict : Agir maintenant/Passer refusés hors fenêtre de réaction ou
> tour obligatoire de CE token précis (pas de resquille) ; position d'insertion Agir maintenant
> `référence + 100 + initiative` (priorité RAW sur l'action normale à la même phase + départage
> Initiative décroissante entre deux déclenchements simultanés, §6 point 8) ; `resolveMeleeAction`
> allégée (`remainingMeleeActions`/`totalMeleeCount` retirés, malus recalculé en direct depuis les
> entrées sœurs non `lost`/`skipped` du même `declaration_group_id`, §6bis point 3) ; `forfeitToken`
> (étourdissement — clôture aussi les entrées d'échelle orphelines, pas seulement `combat_actions`, sans
> quoi `pickNextTimelineStep` les resélectionnerait indéfiniment — piège trouvé en concevant, pas en
> testant) ; `COMBAT_ACTION_CONFIRM` résout désormais **une seule entrée à la fois** (plus « toutes les
> actions restantes » d'un token) ; extension LOS §6 point 3 (`losService.js` — un tir dont la cible
> devient hors de portée redirige vers un intercepteur sur le vecteur au lieu d'échouer muet, même
> patron que l'interposition déjà fonctionnelle). **Migration `174_combat_timeline_resolution.js`** :
> `combat_state.sub_phase` CHECK étendu (+`AWAITING_REACTION_WINDOW`) + colonne `active_slot_idx`
> supprimée (dernier lecteur retiré dans ce Lot, colonne réellement morte) — up/down/up testé en base
> réelle. **Bug de conception trouvé et corrigé en testant** (fixtures) : la position de référence d'un
> Agir-maintenant hors fenêtre (tour obligatoire) pointait vers la plus haute `phase_position` déjà
> résolue au lieu de la plus récente chronologiquement (`resolved_at` au lieu de `phase_position` pour
> trier) — sans impact gameplay (l'ordre réel de ce cas vient de `pickNextObligatoryDelayed`, pas de
> cette position, purement cosmétique/audit) mais corrigé par cohérence avec l'intention du code.
> **Testé** : `node --check` propre sur les 6 fichiers serveur touchés ; 2 scénarios de fixtures
> jetables en base réelle (campagne/battlemap/tokens disposables, 0 résidu confirmé après coup) — (1)
> construction + interleaving 3 personnages (série CaC ×3 normale, assault normal, CaC retardé),
> positions exactes vérifiées, tour obligatoire + Agir maintenant + `endTurn` (roster réinitialisé,
> aucune entrée orpheline) ; (2) fenêtre de réaction réelle de bout en bout via `advanceTimeline`
> (ouverture après la 1ʳᵉ résolution seulement, jamais avant, minuteur bien enregistré/nettoyé, position
> d'insertion Agir-maintenant-en-fenêtre exacte `référence+100+initiative`). **Non testé, volontairement
> reporté** : `resolveMeleeAction`/`resolveAssaultAction` eux-mêmes (jets de dés, dégâts, armure) —
> logique métier inchangée par ce Lot (changement de signature uniquement), déjà couverte par l'usage
> réel antérieur ; parcours HTTP/Socket.IO réel (aucun client ne peut encore déclencher Retarder/Agir
> maintenant/Passer, cf. ci-dessous) ; scénario à 2+ personnages en délai simultané.
> **Pourquoi pas de bouton temporaire pour valider le Lot B seul** : décision explicite Saar (2026-07-18,
> discussion directe hors questionnaire) — enchaîner Lot B et Lot C sans étape de validation
> intermédiaire plutôt que construire un bouton jetable (aurait été le genre de travail à double emploi
> explicitement interdit cette session).
> **Lot C — codé** (`client/src/stores/combatStore.js`, `client/src/lib/useCombatSocket.js`,
> `client/src/components/CombatTimeline.jsx`, `client/src/components/CombatOverlay.jsx`,
> `client/src/components/CombatActionWindow.jsx`) : nouvelles données de store `timelineEntries`/
> `currentStep`/`reactionWindow`, alimentées par `COMBAT_TIMELINE_UPDATED` (un seul event, poussé à
> chaque changement de l'échelle, y compris à la reconnexion — `server/src/socket/index.js`) ;
> `CombatTimeline.jsx` branche RÉSOLUTION reconstruite : une carte par entrée (clé `entry.id`, pas
> `token_id` — le piège déjà identifié au plan §6quater), carte éphémère non persistée pour un token
> sans entrée dont c'est le tour (actions simples seules, sinon il disparaîtrait de la timeline pendant
> son tour — régression non voulue, ajout au-delà du plan) ; nouvelle zone « en attente » — une carte
> par personnage `delayed_waiting`, portrait = déclencheur `COMBAT_ACT_NOW`, cliquable seulement si ce
> viewer contrôle le token ET (fenêtre de réaction ouverte OU c'est son tour obligatoire) ; `TimelineCard.jsx`
> réutilisé tel quel (déjà purement visuel). Nouveau panneau `CombatOverlay.jsx` dédié au tour obligatoire
> (« Agir maintenant » / « Passer », `COMBAT_DELAYED_PASS`) — portée volontairement limitée à ce cas
> précis, ne généralise pas l'outil MJ (ça, c'est le Lot D, « forcer la suite de l'étape en cours » sur
> n'importe quel sous-état bloqué). **2 bugs réels trouvés en écrivant le client, corrigés** : (1)
> `CombatOverlay.jsx` (`activeMeleeAction`/`playerActiveMeleeAction`) utilisait `actions.find(a =>
> a.token_id === X && a.action_key === 'melee')` — plusieurs lignes `combat_actions` du même token
> peuvent désormais rester `pending` simultanément (série CaC non intégralement résolue), `.find()`
> aurait pris la première de l'array au lieu de celle réellement due — remplacé par une correspondance
> sur `currentStep.entry.combat_action_id`. (2) `CombatActionWindow.jsx` `resolveSlotTid =
> sorted[activeSlotIdx]?.token_id` — `activeSlotIdx` n'existe plus côté RÉSOLUTION (colonne supprimée
> par la migration 174) — remplacé par `activeTokenId` (dérivé de `currentStep.tokenId` dans le store).
> **1 bug serveur supplémentaire trouvé en auditant après coup (grep exhaustif `active_slot_idx`), avant
> tout test navigateur — aurait cassé COMBAT_START** : `socketCombatState.js` insérait encore
> `active_slot_idx: 0` dans `combat_state` à la création d'un combat — colonne supprimée par la
> migration 174, l'INSERT aurait levé une erreur SQL au tout premier `COMBAT_START` suivant ce Lot.
> Corrigé (ligne retirée). **Simplification documentée, non construite** : survol MJ d'une carte « en
> attente » pour mettre en surbrillance le jeton sur la carte de bataille (§6quater) — micro-interaction
> non essentielle au mécanisme, reportée pour ne pas alourdir davantage un chantier déjà volumineux ; le
> clic seul (sans confirmation visuelle préalable) suffit à valider le mécanisme.
> **Testé** : `node --check` propre sur tous les fichiers serveur touchés (dont le correctif
> `socketCombatState.js`) ; `esbuild` propre sur les 6 fichiers client touchés ; **build Vite complet du
> client réussi (0 erreur)** ; grep exhaustif `active_slot_idx`/`activeSlotIdx` sur tout le dépôt (client
> + serveur) confirmant plus aucune lecture/écriture orpheline ; grep croisé confirmant que chaque
> nouvel event (`COMBAT_ACT_NOW`, `COMBAT_DELAYED_PASS`, `COMBAT_TIMELINE_UPDATED`) est bien émis ET
> consommé des deux côtés, aucun câblage orphelin. **Non testé** : aucun test navigateur réel (Claude ne
> pilote pas de navigateur, cf. mémoire projet) — c'est la prochaine étape, à la charge de Saar. Scénario
> à couvrir : Tour normal (non-régression), série CaC entrelacée avec un tir, un personnage Retarder +
> Agir maintenant pendant une fenêtre de réaction réelle, un Passer volontaire au tour obligatoire,
> reconnexion en cours de RÉSOLUTION (timeline resynchronisée). Survol MJ « en attente » non construit
> (voir ci-dessus).
> **Données** : migration `174` appliquée en base locale de développement (`vtt`), aucun effet sur les
> données de campagne existantes (colonne supprimée jamais lue par aucune donnée métier). **Retour
> arrière** : `down()` de la migration 174 testé et fonctionnel (round-trip up/down/up confirmé). Rien
> n'est committé à ce stade — voir rappel `git add`/`commit`/`push` en tête de session suivante.
>
> **Item 80 (Session 154) — Chantier Bouclier : refonte préalable `docs/PLAN_INVENTORY_SLOTS.md`
> ✅ CODÉE ET TESTÉE, CHANTIER CLOS ; suite Lot A/B en item 81.**
> Réflexion sur l'implantation des règles de Bouclier (`docs/REGLES/REGLEBOUCLIER.md`) : plan rédigé,
> analyse à charge, puis **run à vide du Lot A** a exposé un anti-pattern préexistant dans
> `char_inventory.slot` (liste `/`-délimitée à la place d'une table d'intersection — « Jaywalking »,
> Karwin, *SQL Antipatterns*) : un item à slot composite (futur bouclier `MG/BG/C`) échappait aux
> contrôles de conflit à égalité stricte, permettant un double-équipement non détecté. **Exigence
> Saar** : architecture robuste/pérenne/adaptative, aucun bricolage même temporaire, aucune zone
> d'ombre avant de coder, temps non contraint — décision : refonte complète avant de reprendre le
> bouclier, plutôt qu'un patch local.
> **`docs/PLAN_INVENTORY_SLOTS.md` livré en 3 lots** : **A** — nouvelle table `char_inventory_slots`
> (migration `162`, contrainte `UNIQUE` partielle slots main/contenant, `CHECK` codes valides, index
> perf, backfill + vérification round-trip auto), double-écriture dans `inventoryService.js`
> (`_writeSlots`, transactionnel). **B** — bascule de tous les lecteurs réels (serveur :
> `inventoryService.js`, `socketCombatHelpers.js` (4 consommateurs, plus que prévu), `battlemaps.js`
> (bug confirmé et corrigé — un item composite était invisible côté « main »),
> `socketCombatAnnouncement.js`, `damageService.js` ; API `getItemWithRef`/`getInventory` → `slots`
> tableau ; 6 fichiers client réellement concernés sur 9 audités, 3 faux positifs confirmés avant de
> conclure). **C** — retrait complet de `char_inventory.slot` (migration `166`, réversible,
> `down()` reconstruit depuis `char_inventory_slots`).
> **Run à vide post-implémentation demandé par Saar** avant clôture : recherche élargie
> (`['"]slot['"]|slot\s*:`, angle mort du premier audit qui ne cherchait que `.slot` en accès de
> propriété) → **4 fichiers réels encore cassés par le retrait de la colonne**, trouvés et corrigés :
> `modingService.js` (`returnModToInventory`), `tradeService.js` (achat marchand + `acceptTransfer`),
> `socketTrade.js` (cargo drone), `char-sheet.js` (largage cargo drone) — les 3 derniers transfèrent
> la propriété d'un item et devaient en plus vider `char_inventory_slots` de l'ancien propriétaire
> (identifié dans l'analyse critique mais pas appliqué du premier coup). **Testé en base réelle** à
> chaque lot (personnages jetables, 0 résidu) + **`tradeService.acceptTransfer` exercé de bout en
> bout** (transfert réel, slots bien vidés côté receveur). **Confirmé fonctionnel par Saar en
> navigateur** après un faux-négatif initial (voir ci-dessous) : équipement/déséquipement fiche
> perso, assaut à distance, corps à corps, filtrage du matériel équipé côté Échange.
> **Incident de méthode, sans rapport avec le code** : écran blanc puis comportements incohérents
> signalés en cours de validation (`ContainerPanel.jsx` "no export default", assaut/CaC/échange
> semblant cassés) — fichiers vérifiés syntaxiquement corrects (`esbuild`) et données réelles
> cohérentes en base au moment du signalement ; redémarrage complet des deux serveurs n'a rien
> changé, confirmant un cache **navigateur** (pas processus) — probablement lié au grand nombre de
> fichiers modifiés coup sur coup pendant que les serveurs de dev tournaient. Résolu côté Saar.
> **Trouvé en marge, hors scope** : `docs/BUGIDENTIFIE.md` dette TRADE2 — logique « Agir en tant
> que »/« Destinataire » de la fenêtre Échange MJ ne correspond pas à l'usage attendu par Saar
> (PNJ→PJ), le système livré Session 151 fait PJ→PJ au nom du MJ — décision produit non tranchée.
> **Non testé** : parcours HTTP/Socket.IO isolé de `socketTrade.js`/`char-sheet.js` (cargo drone) —
> même correctif que `tradeService.js` (prouvé), pas ré-exercé indépendamment.
>
> **Item 81 (Session 156) — `docs/PLAN_BOUCLIER.md` Lot A + Lot B ✅ CODÉS ET TESTÉS, fonctionnel
> confirmé Saar en combat réel.** Suite directe de l'item 80 (prérequis levé). **Lot A** : migration
> `168` (`ref_equipment.shield_atk_malus`/`shield_extra_locations`), `HAND_TO_ARM_SLOT`
> (`shared/armorConstants.js`), nouvelle branche composite dans `inventoryService.updateItem` (le
> client envoie la main, le serveur compose main+bras+localisations catalogue et réutilise
> `_handSlotConflict`/`_armorSlotOccupants` tels quels — décision §3.10), entrée VOCABULARY.md.
> **Incident de données réel pendant le codage, réparé** : la migration 168 a d'abord découvert que 3
> lignes catalogue "Bouclier" existaient déjà en base (import Excel de mai, jamais tracké en
> migration, une équipée par un personnage réel) — 1ʳᵉ version de la migration a créé des doublons
> puis, en testant son `down()`, supprimé les 3 vraies lignes par erreur (`DELETE WHERE
> category='Bouclier'` non discriminant), cassant la FK d'un personnage réel. Repéré immédiatement,
> réparé byte-for-byte depuis les données capturées avant l'incident, ré-attaché. Migration réécrite
> en `UPDATE` en place (jamais `INSERT`/`DELETE` par catégorie), cycle up/down/up revalidé. **Lot B** :
> `damageService.resolveTargetHit` — nouveau paramètre `treatAsContact` (exclut le bouclier de la
> résolution armure au contact/jet-trait — **découverte non anticipée par le plan** : le RAW sépare
> strictement malus [contact/jet-trait] et protection [armes à feu], sans garde-fou la requête armure
> existante aurait accordé la protection même à un coup au contact) + Test de Chance du Petit bouclier
> (`1d20 ≤ char_sheet.chc`, Corps/Tête uniquement, résultat retourné mais affichage repoussé Lot C).
> `resolveMeleeAction`/`resolveAssaultAction` : malus CaC de la cible plié dans le Seuil d'attaque
> avant le jet (nouvelle requête ajoutée aux `Promise.all` existants — le jet a lieu avant le fetch
> cible habituel dans ces deux fonctions), `treatAsContact` transporté aussi dans le payload différé
> PJ (`socketCombatResolution.js`, dérivé automatiquement pour tout `pendingType==='melee'`). Distinction
> arme à feu/jet-trait via `ref_equipment.category` (`'Armes de jet'`/`'Arme de trait'`, valeurs
> catalogue confirmées, §3.9 tranché). Hors scope confirmé : `resolveDroneAssaultAction` (armes de
> drone) laissé en comportement arme à feu par défaut. **Testé** : 9 assertions Lot A + 12 assertions
> Lot B sur personnages/tokens jetables (0 résidu à chaque fois) + **confirmé fonctionnel en combat
> réel par Saar**.
> **Lot C (UI)** : confirmé sans code neuf que `battlemaps.js`/fenêtres combat/`DiceBreakdownPopover`
> affichent déjà le bouclier et son malus génériquement. Ajouté : 2 colonnes au SELECT
> `inventoryService.js` (stats bouclier absentes côté API jusqu'ici) ; `WeaponPanel.jsx` — bouclier
> désormais équipable dans l'emplacement main dédié (corrige le bug original signalé par Saar), badge
> de main corrigé pour un slot composite, stats dédiées affichées ; **bug réel trouvé en codant Lot C**
> — `LocationPanel.jsx` appelait un retrait partiel de slot sur le bouton « × », que le serveur rejette
> pour un Bouclier (tout-ou-rien) — corrigé, tag visuel ajouté ; diffusion `DICE_RESULT` du Test de
> Chance ajoutée (même patron que `rollLoc`). **Tension signalée, non tranchée seul** : ces 4 fichiers
> character-sheet n'utilisent `useTranslation` nulle part (zone legacy antérieure au rollout i18n) —
> nouveau texte Lot C écrit en dur par cohérence locale, contraire à la règle générale i18n ; retrofit
> complet explicitement hors scope. **Testé** : colonnes SELECT vérifiées réel (0 résidu), ESLint 0
> erreur, **parcours navigateur réel confirmé fonctionnel par Saar** (test mené en parallèle du
> développement, avant le commit de clôture — confirmé 2026-07-18). **CHANTIER BOUCLIER CLOS**
> (commit `1733aaa`, Session 156) : `docs/PLAN_BOUCLIER.md` archivé vers `docs/Old/`, détail durable
> transféré dans `docs/ASBUILT.md` (Règle 10, `docs/RegleDocumentaire.md`).
>
> **Item 82 (Session 157, dev/Saar) — Chantier Sprint Tir Multi → refonte complète du moteur de tours
> ⚠️ PLANIFICATION UNIQUEMENT, AUCUN CODE ÉCRIT. Prochain agent : lire les 3 documents ci-dessous
> intégralement avant toute action, ils sont conçus pour être auto-suffisants.**
> Point de départ : Saar demande le Sprint Tir Multi (`docs/ROADMAP.md`, Chantier CaC). Plan rédigé
> (`docs/PLAN_TIRMULTI.md`), 8 points ouverts (D1-D8) discutés avec Saar — D4/D5 (comment enchaîner
> plusieurs tirs sans jet de défense opposé) révèlent que le mécanisme existant de chaînage
> multi-attaque CaC (`resolveMeleeAction` récursif) contient un bug réel de collision de clé primaire
> sur `combat_pending`, déjà vivant en production aujourd'hui (pas hypothétique — toute attaque
> multiple CaC touchant 2 défenseurs PJ distincts le déclenche silencieusement, la 2e/3e attaque
> disparaît sans erreur visible). Prérequis rédigé (`docs/PLAN_COMBAT_ACTION_QUEUE.md`). Puis une
> question de Saar (« la timeline peut-elle afficher plusieurs portraits par personnage à chaque
> action ? ») révèle que l'architecture de résolution actuelle (liste statique résolue en une passe,
> pas de vraie notion de phases) ne peut structurellement pas le faire — et que ce qui manque recoupe
> une règle RAW jamais implémentée, « Retarder son Action » (LdB p.218). **Décision Saar (Option A,
> « des bases saines seront toujours plus pertinentes »)** : refonte complète du moteur de tours en
> timeline à phases avant de reprendre quoi que ce soit d'autre — `docs/PLAN_COMBAT_TIMELINE.md`,
> désormais racine des 3 chantiers combat.
> **État de la conception** (`docs/PLAN_COMBAT_TIMELINE.md`) : cadrage RAW complet (6 règles du
> sous-système Initiative citées une seule fois, autorité unique), 4 Lots séquentiels intégralement
> conçus (A — nouvelle table `combat_timeline_entries` + additions `combat_actions`, schéma exact en
> §5 ; B — moteur de résolution générique + 2 nouveaux sous-états FSM `AWAITING_REACTION_WINDOW` + tour
> obligatoire ; C — `CombatTimeline.jsx` sur l'échelle, portrait = déclencheur « Agir maintenant » ; D —
> généralisation de l'outil MJ existant, reprise de `PLAN_TIRMULTI.md`), chacun passé par une analyse
> à charge dédiée, plus une analyse à charge globale (10 points), un audit indépendant demandé par
> Saar pour limiter le biais de confirmation (8 points, citations RAW et code revérifiées
> indépendamment, toutes confirmées exactes), et une relecture finale de cohérence (3 décalages de
> propagation trouvés et corrigés). Un seul point reste ouvert (§6 point 5 du document — mécanisme de
> secours du Lot B), sans impact sur le démarrage du Lot A, à trancher au moment de coder ce Lot précis.
> **Décision de jeu prise en cours de route, à répercuter dans `PLAN_TIRMULTI.md` à sa reprise (Lot
> D)** : CaC et Tir sont désormais mutuellement exclusifs à la déclaration (nouvelle règle, RAW « Types
> d'Actions » les range dans une seule catégorie « Action de combat » — vérifié
> `CombatActionWindow.jsx:404-408`, permissif aujourd'hui, à corriger).
> **Dettes annexes trouvées et documentées séparément, non traitées** : `BUGIDENTIFIE.md` DEP1 (Allure
> Maximale accessible même chargé/encombré, aucun filtre dans `calcAllures`/`getCharacterMovementBudget`)
> ; `shared/polarisUtils.js` — `DEPLACEMENT_ACTION_MALUS` ajouté (table RAW malus Précision/Équilibre/
> Furtivité/Vigilance selon l'Allure combinée à une Action, LdB p.220) pour ne pas perdre la donnée,
> non branchée à la résolution combat (aucune Action combinée n'est câblée à ce jour).
> **Codé** : rien. **Documenté** : conception complète des 3 plans + 2 fichiers annexes. **Non
> committé** (`git status`, branche `dev/Saar`) : `docs/PLAN_TIRMULTI.md`,
> `docs/PLAN_COMBAT_ACTION_QUEUE.md`, `docs/PLAN_COMBAT_TIMELINE.md` (nouveaux) ;
> `docs/BUGIDENTIFIE.md`, `shared/polarisUtils.js` (modifiés).
> **Exigence explicite de Saar avant de coder quoi que ce soit ci-dessous** : se documenter, chercher
> des dépôts GitHub inspirants et des patterns éprouvés (moteurs de tours à phases de jeux tactiques,
> VTT open-source type Foundry, implémentations de FSM pour systèmes de combat) avant d'écrire la
> moindre ligne — ne jamais coder from scratch un mécanisme non trivial sans avoir d'abord regardé
> comment des projets pro le résolvent. Aucune urgence de temps, la certitude architecturale prime.
> **Prochaine étape exacte, dans l'ordre, pas d'ambiguïté** :
> 1. **Correctif isolé `combat_pending`** — conception complète et prête dans
>    `docs/PLAN_COMBAT_ACTION_QUEUE.md` §3 (clé primaire propre par ligne, plusieurs entrées
>    `type='damage'` possibles par personnage, `melee_defense`/`stun` restent singuliers). Migration +
>    patch des points d'insertion/lecture. Livrer avant toute chose — bug de production connu,
>    indépendant de la Timeline. Une fois livré et testé : archiver `docs/PLAN_COMBAT_ACTION_QUEUE.md`
>    dans `docs/Old/` (son contenu de conception « file plate » reste obsolète, absorbé par le Lot B de
>    `PLAN_COMBAT_TIMELINE.md` — seul le correctif en est extrait).
> 2. **Lot A de `docs/PLAN_COMBAT_TIMELINE.md`** (§5) — schéma `combat_timeline_entries` détaillé
>    colonne par colonne, migration `combat_actions`, numéro de migration pair à auditer au moment du
>    code (`CLAUDE.md` §5).
> Lots B, C, D suivent dans cet ordre une fois A validé — ne pas paralléliser (`CLAUDE.md` §6.8).
>
> **Item 83 (Session 158, dev/Saar) — Correctif isolé `combat_pending` ✅ CODÉ ET TESTÉ EN BASE RÉELLE
> (`docs/PLAN_COMBAT_ACTION_QUEUE.md` §3, prérequis Lot A `docs/PLAN_COMBAT_TIMELINE.md`).** Migration
> `170_combat_pending_multi_damage.js` : PK composite `(campaign_id, token_id, type)` remplacée par un
> `id` uuid propre + index unique **partiel** `WHERE type <> 'damage'` (melee_defense/stun restent
> singuliers, seule `damage` autorise désormais plusieurs lignes par personnage) + index FIFO
> `(campaign_id, token_id, type, created_at)`. **Audit complet des points de lecture/écriture**
> (`combat_pending` grep exhaustif, 6 fichiers serveur) : `COMBAT_DAMAGE_CONFIRM`
> (`socketCombatResolution.js`) — sélectionne désormais la plus ancienne entrée (FIFO), supprime par
> `id` propre (jamais par le filtre composite, qui aurait supprimé toutes les entrées du même type),
> et si la file n'est pas vide après suppression, `sub_phase` reste `AWAITING_DAMAGE` + nouveau prompt
> émis pour la suivante (conception déjà écrite dans le plan, §3). **Piège trouvé en traçant
> l'enchaînement CaC 4b réel** (non anticipé par le plan d'origine) : le 2ᵉ/3ᵉ `INSERT` de
> `type='damage'` pour le même attaquant peut survenir alors que le 1ᵉʳ prompt n'a pas encore été
> confirmé par le joueur (le défenseur B confirme sa défense avant que l'attaquant ait cliqué "Lancer
> les dés" pour l'attaque contre le défenseur A) — émettre le prompt à chaque `INSERT` aurait fait
> perdre au joueur la visibilité du prompt encore non résolu. Corrigé aux 3 points d'insertion
> (`COMBAT_MELEE_DEFENSE_CONFIRM` et `resolveAssaultAction`/`resolveDroneAssaultAction` dans
> `socketCombatHelpers.js`) : le prompt n'est émis que si c'est la seule entrée en attente pour ce
> token (`COUNT` après insertion) — sinon il sera émis plus tard par `COMBAT_DAMAGE_CONFIRM` une fois
> la file FIFO consommée jusqu'à cette entrée. Sync reconnexion (`index.js`) alignée sur la même
> règle : ordonnée par `created_at`, ne restaure qu'**un seul** prompt `damage` (le plus ancien) au lieu
> d'en émettre un par ligne trouvée. **Testé** : migration (`up`/fonctionnel — 2 lignes `damage`
> coexistent sans erreur, 2ᵉ ligne `melee_defense` rejetée par la contrainte partielle —
> `down`/dédoublonnage défensif/`up` à nouveau, cycle complet validé en base locale) ; `node --check`
> 0 erreur sur les 4 fichiers touchés ; scénario réel simulé en transaction annulée (2 attaques CaC du
> même attaquant PJ touchant 2 défenseurs PJ distincts — plus de collision, ordre FIFO confirmé, un
> seul prompt visible à la fois à chaque étape), 0 résidu.
> **Bug réel trouvé en testant en navigateur (bloquait ce parcours), corrigé séparément —
> `BUGIDENTIFIE.md` COM7 (Multi-attaque CaC : bouton "Déclarer" grisé) ✅ CLOS.** Root cause
> `[VÉRIFIÉ]` : `CombatGmDeclareWindow.jsx:122-123`, `isMountedRef` initialisé à `true` via
> `useRef(true)` mais seul le cleanup de son `useEffect` le repassait à `false` — rien ne le réarmait à
> `true`. `StrictMode` (`main.jsx:8`, actif) double-invoque les effets de montage en dev (mount →
> cleanup → mount) pour détecter exactement ce cas : après ce cycle synthétique, `isMountedRef.current`
> restait bloqué à `false` pour toute la durée de vie du composant. La chaîne de sélection multi-cibles
> CaC (`selectNext`, ligne 373, `if (isMountedRef.current) selectNext(idx + 1)`) s'arrêtait donc
> systématiquement après la première cible — expliquant à la fois le bouton "Déclarer" grisé
> (`meleeTargets.length` ne pouvait jamais atteindre `effectiveMeleeCount`) et la sortie du mode de
> ciblage après une seule cible. **Preuve obtenue par instrumentation temporaire** (`[DBG-COM7]`,
> retirée après diagnostic) : le code de debug ajoutait par inadvertance
> `isMountedRef.current = true` dans le corps de l'effet — ce qui réarmait le ref après le double-mount
> StrictMode et corrigeait le bug par effet de bord (1er test Saar : "Fonctionnel") ; son retrait a fait
> réapparaître le bug à l'identique (2ᵉ test Saar : "Non fonctionnel") — correspondance exacte entre
> les deux tests et le diff, cause confirmée sans ambiguïté. **Corrigé** : `isMountedRef.current = true`
> déplacé dans le corps de l'effet (pattern "StrictMode-safe" standard, seul point d'usage de ce
> pattern dans le client, grep confirmé). **Testé** : build Vite propre (0 erreur/warning), committé et
> poussé par Saar (`412a318`, puis correctif COM7 committé séparément).
> **Parcours navigateur du correctif `combat_pending` confirmé fonctionnel par Saar** (2026-07-18) :
> attaque CaC multiple touchant 2 défenseurs PJ, dégâts confirmés un par un sans blocage ni collision —
> objet réel de Session 158 validé de bout en bout. **CHANTIER `combat_pending` CLOS.** **2 points
> trouvés en marge pendant ce test, documentés séparément (`BUGIDENTIFIE.md`), non traités ici** :
> **COM27** (nouveau, `[INCONNU]`) — Saar observe le jet de défense affiché avant le jet d'attaque en
> CaC multi-attaque ; lecture du code (`resolveMeleeAction` roll attaque avant l'insertion
> `melee_defense`) semble contredire le symptôme — à instrumenter avant toute conclusion, non bloquant
> pour la suite. **FEAT4** (nouveau) — demande Saar d'une aura visuelle (3m + allonge arme) autour du
> personnage actif en CaC pour visualiser sa portée — sprint futur, hors scope Timeline.
> **Dette trouvée en marge, non corrigée (hors scope, un seul problème par plan)** :
> `server/src/socket/index.js`, sync reconnexion `pendingDmgDrone` (recherche d'un dégât de drone en
> attente pour le joueur qui se reconnecte) utilise `.first()` sans tri, filtré uniquement par
> `payload->>'targetUserId'` (pas par `token_id`) — si 2 drones distincts ont chacun un dégât en
> attente contre le même PJ cible au moment de sa reconnexion, un seul est restauré. Préexistant à ce
> correctif (différents `token_id` ne collisionnaient déjà pas sur l'ancienne PK), non aggravé par ce
> changement — noté pour un futur audit, pas ajouté à `BUGIDENTIFIE.md` (portée trop étroite pour
> justifier une entrée dédiée à ce stade, à relier si `docs/PLAN_TIRMULTI.md` fait un jour intervenir
> plusieurs drones tireurs sur la même cible). **Données** : migration `170` appliquée en base locale de
> développement (`vtt`), aucun effet sur les données de campagne existantes (table `combat_pending`
> vide au moment de la migration). **Retour arrière** : `down()` de la migration 170 testé et fonctionnel
> (dédoublonnage défensif inclus).
> **Prochaine étape** : voir Item 84 (Lot A, ci-dessous) — codé et testé le jour même.
>
> **Item 84 (Session 158, dev/Saar) — Lot A de `docs/PLAN_COMBAT_TIMELINE.md` (§5) : modèle de données
> de l'échelle de phases ✅ CODÉ ET TESTÉ EN BASE RÉELLE.** Migration `172_combat_timeline_entries.js` :
> `combat_actions.turn_number` (backfill trivial, table vide en pratique) + nouvelle table
> `combat_timeline_entries` (schéma exact du plan — `id`, `campaign_id`, `turn_number`, `token_id`,
> `combat_action_id` FK, `declaration_group_id`, `phase_position`, `status` CHECK 5 valeurs,
> `resolved_at`, `resolution_snapshot`, 2 index). **6 sites scopés sur `turn_number`** (audit complet,
> exactement ceux listés au plan + `index.js`) : insertion déclaration (`socketCombatAnnouncement.js`),
> insertion skip (`skipPlayer` + `COMBAT_SURPRISE_RESULT`), lecture `startResolutionPhase`, 2 lectures
> `COMBAT_ACTION_PRECHECK`/`COMBAT_ACTION_CONFIRM` (guard stun ×2 + range CaC + lecture principale),
> sync reconnexion (`index.js`). `COMBAT_END` (wipe complet campagne) inchangé, cohérent avec
> "suppression réelle seulement à COMBAT_START". **`endTurn()`** : `DELETE combat_actions`
> inconditionnel (PC28) retiré — les lignes encore `pending` à la clôture du Tour sont marquées
> `skipped` explicitement, l'historique reste en base. **Construction de l'échelle**
> (`startResolutionPhase`, seul point de transition ANNONCE→RÉSOLUTION, nouvelle fonction
> `buildTimelineEntries`) : une entrée par action `type IN ('melee','assault')` déclarée ce Tour ;
> `phase_position = combat_roster.initiative × 100` pour la 1ʳᵉ attaque d'un token — **le décalage RAW
> -5 Initiative par attaque supplémentaire d'une série CaC multi-attaque (LdB p.218-219, jamais câblé
> avant ce Lot, cf. `PLAN_TIRMULTI.md` §0.1 point 1) devient réel** : 2ᵉ attaque `-500`, 3ᵉ `-1000`
> (même échelle ×100) ; position ≤ 0 → `status:'lost'` immédiat. `declaration_group_id` : un uuid par
> token ayant ≥1 action `melee` ce Tour (les 1-3 attaques d'une même déclaration partagent le même
> groupe) ; `null` pour `assault` (pas encore de Tir Multi, toujours singulier). Cette construction
> **alimente la table sans rien changer au moteur de résolution actuel** (`advanceSlot`/
> `active_slot_idx` inchangés) — bascule réelle de consommation au Lot B. **Testé** : migration
> up/down/up (round-trip complet, schéma vérifié colonne par colonne) ; 2 scénarios réels en base
> (fixture jetable — campagne/battlemap/tokens disposables, 0 résidu confirmé après coup) : (1)
> construction — 1 token 3 attaques CaC + 1 token 1 tir, positions `1500/1000/500`/`800` exactes,
> `declaration_group_id` partagé pour les 3 CaC et `null` pour le tir, décoy `turn_number` différent
> jamais ramassé et resté intact ; (2) `endTurn()` — ligne `pending` marquée `skipped` (pas supprimée),
> ligne déjà `resolved` intacte, aucune ligne supprimée, Tour incrémenté, phase repassée à
> `ANNOUNCEMENT`. `node --check` 0 erreur sur les 6 fichiers touchés. **Non testé** : parcours
> navigateur d'un Tour de combat complet — aucun changement visuel attendu (le moteur de résolution
> actif ne lit pas encore `combat_timeline_entries`), mais à confirmer qu'aucune régression n'a été
> introduite sur le flux existant (déclaration, résolution, fin de Tour) par les 6 sites scopés et le
> retrait du DELETE. **Données** : migration `172` appliquée en base locale de développement (`vtt`).
> **Retour arrière** : `down()` testé (drop table + drop colonne, round-trip validé).
> **Prochaine étape** : voir Item 85 (ci-dessous) — bug bloquant trouvé en testant le Tour de combat
> demandé par cet item, corrigé le même jour.
>
> **Item 85 (Session 158, dev/Saar) — Détection de l'arme en main : Bouclier confondu avec une arme,
> arme deux-mains (2M) ignorée ✅ CODÉ ET TESTÉ, CHANTIER CLOS.** Trouvé par Saar en jouant le Tour de
> combat demandé pour valider l'Item 84 (aucun rapport avec le Lot A lui-même — confirmé par
> `git log`/`git blame` : dernière modification des lignes fautives Session 154, `857becc` "Refonte
> char_inventory_slots", avant toute intervention de cette session). 3 symptômes, une seule cause
> racine par site : Loulou (PJ, Breather chargé en slot `2M`) détecté sans arme ; Mr sourire (PNJ,
> Bouclier en `MG` + Scorpion chargé en `MD`) détecté incapable de tirer ; Bourrin (PNJ, Matraque Mao
> CaC pure) — "Recharger" cliquable et silencieusement sans effet. **Root cause `[VÉRIFIÉ]`** (reproduit
> avec les données réelles des 3 personnages, cf. ci-dessous) : deux implémentations indépendantes de
> "quelle est l'arme en main" (`server/src/routes/battlemaps.js` route `combat-equipment`,
> `client/src/components/CombatActionWindow.jsx` fetch `assaultWeapons`) — aucune des deux ne gérait le
> slot deux-mains `2M`, et la route serveur ne filtrait en plus **aucune catégorie** (n'importe quel
> objet occupant `MG`/`MD` était pris pour "l'arme", donc le Bouclier de Mr sourire avant son Scorpion).
> **Exigence Saar avant de corriger** : aucun bricolage, architecture robuste/pérenne/adaptative.
> **Corrigé** : nouveau module `shared/weaponSlots.js` (`isWeaponItem` — discriminant `fire_mode` OU
> `damage_h`, volontairement indépendant de `ref_equipment.category`, liste ouverte d'une trentaine de
> catégories d'armes ; `resolveHandWeapons` — priorité RAW deux-mains > trépied > main directrice ;
> `flattenItemsBySlot` — normalise la forme `slots: []` de l'API client vers une ligne par slot,
> miroir du format déjà renvoyé par la jointure `char_inventory_slots` côté serveur), **autorité
> unique réutilisée aux deux endroits** (`core.md` — pas de logique dupliquée client/serveur) :
> `battlemaps.js` (ajout `ref_equipment.damage_h` au SELECT, `weaponMg`/`weaponMd`/`weapon` dérivés via
> `resolveHandWeapons`, constante locale `WEAPON_SLOTS_SET` dupliquée retirée au profit de
> `HAND_WEAPON_SLOTS` importé) ; `CombatActionWindow.jsx` (3 sites : fetch `assaultWeapons`, effet reset
> `fire_mode`, dérives `weaponMg`/`weaponMd`/`selectedWeapon`/`equippedMg`/`equippedMd` — `equipped2M`
> ajouté à l'affichage ARMEMENT/COM20). **Gap connexe corrigé dans le même geste** (même cause racine,
> même correctif) : `CombatGmDeclareWindow.jsx` — bouton "Recharger" n'était gardé par aucune condition
> (contrairement à "Tirer", déjà grisé sans arme à distance) ; ajout `noReloadWeapon = a.k==='reload' &&
> !rangedActive`, même garde que côté Joueur (`isAmmoFull || !selectedWeapon`), cohérence entre les deux
> fenêtres. **Testé** : 8 tests unitaires purs (`shared/weaponSlots.test.mjs`, `node --test`) — dont les
> 3 scénarios réels exacts (Breather 2M, Bouclier+Scorpion, Matraque Mao) reproduits avec des données
> synthétiques ; **rejoué avec les données réelles des 4 personnages du combat de Saar** (Loulou, Mr
> sourire, Bourrin, Civil) via le nouveau module — `primaryWeapon`/`isRanged` corrects pour les 4,
> Civil (déjà correct avant, double Scorpion MG+MD) non régressé ; build Vite propre (0 erreur/warning)
> après chaque édition client ; `node --check` propre sur `battlemaps.js`. **Non testé** : parcours
> navigateur réel (Saar doit rejouer Loulou/Mr sourire/Bourrin dans le combat en cours pour confirmer
> visuellement). **Données** : aucune migration, correctif de lecture uniquement. **Retour arrière** :
> aucun schéma touché, revert du commit suffit si besoin.
>
> **Item 79 (Session 153) — `docs/PLAN_ECHANGE.md` : correction du câblage MJ (Échange), retrait
> Lot A0 ✅ CODÉ ET TESTÉ, CHANTIER CLOS.** Suite de l'item 78 : le câblage MJ posé cette session-là était à l'envers (token
> cliqué devenait la source au lieu de la cible — trouvé par Saar en relisant, avant tout test
> navigateur, détail complet `docs/PLAN_ECHANGE.md` §2). **Retiré** : `server/src/services/
> echangeService.js` (Lot A0, jamais branché à une UI, redondant avec `tradeService.js`) et la route
> `POST /:characterId/echanges/admin` (`char-sheet.js`) ; `inventoryService.js` — paramètre `trxOrDb`
> de `getDefaultContainer`/`getItemWithRef` retiré (plus aucun appelant après la suppression du
> service, code mort sinon). **Corrigé** : `SessionPage.jsx` — `onOpenExchange` redevient
> inconditionnel (token cliqué = toujours la cible, MJ ou joueur) ; `ExchangeWindow.jsx` — nouvelle
> autorité unique `effectiveCharId` (`isGm ? gmActingAsId : myCharId`), substituée à `myCharId` dans
> `loadInventory`, l'effet de chargement (reset + rechargement à chaque changement d'identité, pas
> seulement quand l'inventaire est vide), `handleProposeOffer`, `handleAcceptOffer`, le filtre de
> recherche de cible et la désactivation du bouton proposer ; bandeau MJ devenu un vrai `<select>`
> (liste des PJ de la campagne hors cible déjà fixée) tant qu'aucun acteur n'est choisi, persistant
> ensuite tant que la fenêtre reste ouverte ; catalogue et zone de sols masqués tant que le MJ n'a pas
> choisi son acteur (évite le faux "inventaire vide") ; cas dégénéré (0 autre PJ dans la campagne)
> couvert par un message dédié. `fr.json` : 4 nouvelles clés (`ex_acting_as_select`,
> `ex_acting_as_placeholder`, `ex_no_other_pj`, `ex_select_actor_first`). **Hors scope confirmé
> (plan §5)** : `socketTrade.js`/`TokenRadialMenu.jsx` inchangés (déjà corrects) ; `handleCancelOffer`
> volontairement laissé sur `myCharId` — annulation MJ reste la limite déjà documentée item 78 (offre
> expire seule en 120s), pas une régression de ce correctif.
> **2 correctifs supplémentaires trouvés en testant en navigateur réel (Saar)** : (1) le catalogue
> d'offre listait aussi les items **équipés** (`slot` non null) — filtré via `availableItems`
> (`slot === null`), même convention que `ContainerPanel.jsx`. (2) le champ Destinataire restait
> visuellement vide même quand le clic sur un token pré-remplissait `exTargetId` — `searchText`
> n'était jamais synchronisé ; corrigé dans l'effet `initialContext` (résout le nom du personnage
> ciblé et l'affiche). **Signalement Saar investigué en navigateur réel, confirmé comportement
> voulu (pas un bug)** : la recherche manuelle de cible ne trouvait aucune suggestion — root cause
> `[VÉRIFIÉ]` par instrumentation temporaire (`console.log` retiré après diagnostic) : un joueur ne
> peut pas cibler un personnage qui lui est invisible (`characters.visible=false`), la liste reçue du
> serveur les exclut déjà à la source (`GET /campaigns/:id/characters`, comportement pré-existant,
> hors scope de ce correctif) — confirmé logique par Saar, aucun changement de code.
> **Audit d'architecture demandé par Saar avant clôture** : diff entier relu, recherche exhaustive de
> références orphelines à `echangeService`/`adminEchange`/`fromCharId` (une seule référence restante,
> légitime — commentaire expliquant la garde `PUT /sols`). **1 dernier résidu trouvé** : `campaignId`
> était déclaré en prop de `ExchangeWindow.jsx` mais jamais utilisé — hérité par copier-coller de
> `TradeWindow.jsx` (dont les routes sont scopées par campagne ; celles d'`ExchangeWindow` le sont
> toutes par personnage). Retiré de la signature du composant et du call site `SessionPage.jsx` —
> referme la dernière erreur ESLint du fichier. **Testé** : `node --check` (`char-sheet.js`,
> `inventoryService.js`, `socketTrade.js`) ; ESLint sur les 3 fichiers client touchés, **0 erreur, 0
> nouvelle** (`ExchangeWindow.jsx` propre après retrait de `campaignId`, `TokenRadialMenu.jsx`/
> `SessionPage.jsx` ne portent que des avertissements/l'erreur `doClose` pré-existants, confirmés par
> `git stash`) ; `fr.json` validé JSON ; relecture ciblée confirmant que pour `isGm=false`,
> `effectiveCharId === myCharId` sur 100% des chemins (priorité de test explicite du plan §7) ;
> **parcours navigateur complet confirmé fonctionnel par Saar** (ciblage MJ, catalogue filtré,
> comportement de visibilité, proposition, acceptation par un second compte joueur réel). **Non
> testé** : rien d'identifié en dehors de ce qui précède. **Données** : aucune migration, aucun effet
> runtime hors le retrait du service/route. **Retour arrière** : pas encore committé au moment de la
> rédaction ; voir commit de clôture pour le hash. `docs/PLAN_ECHANGE.md` archivé vers `docs/Old/`
> (Règle 10, `docs/RegleDocumentaire.md` — un PLAN terminé est archivé, pas laissé actif).

> **Item 78 (Session 151, suite) — Doublon découvert : le système Échange PJ↔PJ existait déjà
> (`docs/Old/PLAN_TRADE.md`, sessions 124-141) ; secteur MJ activé dans le menu radial ✅ CODÉ ET
> TESTÉ.** Demande Saar : ajouter "Échange" au menu Radial pour pouvoir tester le Lot A0 (item 77).
> **Erreur de méthode trouvée en cherchant le fichier `RadialMenu.jsx`** : `TokenRadialMenu.jsx` a
> déjà un secteur `echange` (ligne 178) qui ouvre `ExchangeWindow.jsx`, lui-même branché sur un
> système complet et fonctionnel — `server/src/services/tradeService.js`/`socketTrade.js`, table
> `trade_offers` (migrations 84-91), marchands, vente PJ→GM avec contre-offres, transfert drone
> immédiat (`trade:drone_transfer`, exactement l'idée "même propriétaire" du Lot A0). Livré et clos
> Sessions 124-141 sous `docs/Old/PLAN_TRADE.md` — jamais trouvé avant d'écrire `docs/PLAN_ECHANGE.md`
> (item 77) faute d'avoir cherché dans `docs/Old/` avant de concevoir un nouveau plan ; `docs/
> ROADMAP.md` Chantier 10 Sprint 6 était resté marqué 🔲 par erreur documentaire, corrigé cette
> session. **Root cause du "je ne l'ai jamais vu"** : le secteur `echange` est `enabled: !isGm`
> (masqué dès que l'acteur est MJ, quel que soit le personnage ciblé) — Saar étant toujours MJ dans sa
> propre campagne, il ne pouvait physiquement jamais le voir ni le cliquer. **Décision Saar** : plutôt
> qu'ajouter un bouton séparé pour le Lot A0, étendre le vrai système existant pour que le MJ puisse
> l'utiliser — "proposer au nom d'un PJ", scope volontairement réduit à ce seul côté (accepter/
> annuler restent inchangés, décision explicite pour limiter la surface touchée). **Codé** :
> `socketTrade.js` (`TRADE_TRANSFER_OFFER`) — `fromChar` résolu sans filtrer `user_id` quand
> `socket.data.role === 'gm'`, inchangé sinon ; `TokenRadialMenu.jsx` — secteur `echange` toujours
> `enabled: true`, prop `isGm` devenue inutile retirée (0 nouvelle erreur ESLint, comparé `git stash`) ;
> `SessionPage.jsx` — `onOpenExchange` distingue MJ (token cliqué devient `fromCharId`, cible à choisir
> dans la fenêtre) vs joueur (comportement historique inchangé, token cliqué = cible pré-remplie) ;
> `ExchangeWindow.jsx` — prop `isGm`, bandeau "MJ — agit au nom de : {name}" (nouvelle clé `fr.json`
> `ex_acting_as`, `en.json` toujours sans le namespace `trade` — préexistant, pas notre scope).
> **Limite assumée, non traitée** : le MJ ne peut pas encore annuler une proposition faite au nom d'un
> PJ (annulation reste réservée au vrai propriétaire) — l'offre expire seule en 120s, non bloquant.
> **Trouvé en marge, hors scope, loggé séparément** : `docs/BUGIDENTIFIE.md` dette `TRADE1` —
> `TRADE_TRANSFER_DECLINED` n'a aucune vérification d'ownership serveur (n'importe quel membre de la
> campagne pourrait refuser l'offre d'un autre s'il devine l'`offerId`), sévérité faible, non corrigé
> ici. **Testé** : requête knex relaxée vérifiée en base réelle (transaction annulée) — MJ résout un
> personnage qui n'est pas le sien, joueur non-propriétaire toujours bloqué (inchangé), propriétaire
> réel toujours résolu (non-régression) ; `node --check` (`socketTrade.js`) ; ESLint sur les 3 fichiers
> client touchés, 0 nouvelle erreur (comparé `git stash` à chaque fichier). **Non testé** : parcours
> navigateur réel (clic MJ sur un token → secteur Échange → proposition → acceptation par un vrai
> compte joueur) — à confirmer par Saar en navigateur, c'est l'objet même de sa demande. **Devenir du
> Lot A0 non tranché** : `echangeService.js`/`adminEchange` (item 77) reste codé et testé mais non
> branché à aucune route UI — fait probablement double emploi avec le système ci-dessus (le
> court-circuit MJ existant, `trade:drone_transfer`, ne couvre que "même propriétaire" ; un vrai
> "MJ déplace instantanément entre deux joueurs différents, sans double validation" n'existe nulle
> part ailleurs) — à décider avec Saar : garder comme action admin séparée, ou retirer comme code mort.
> Documents corrigés cette session (attribution erronée du terme "Échange" à Session 151) :
> `docs/VOCABULARY.md`, `docs/ROADMAP.md`, `docs/PLAN_ECHANGE.md` (bandeau d'avertissement ajouté).

> **Item 77 (Session 151) — Chantier 10 Sprint 6 (Échange), Lot A0 : court-circuit MJ ✅ CODÉ ET
> TESTÉ (2026-07-16).** Plan écrit après recherche externe (FoundryVTT Item Piles, `lets-trade-5e`,
> patterns de ledger atomique/réservation d'inventaire) puis auto-critique demandée par Saar avant
> tout code — détail complet `docs/PLAN_ECHANGE.md`. **Terminologie tranchée avant code** : le mot
> "Transfert" était déjà pris par le Coffre (copie Coffre→campagne) — la nouvelle mécanique s'appelle
> **"Échange"** (`docs/VOCABULARY.md`, ambiguïté trouvée en cadrant ce chantier). **Livré** : nouveau
> `server/src/services/echangeService.js` (`executeEchange` — seul point d'exécution atomique
> item/sols, réutilisé par les lots suivants ; `adminEchange` — court-circuit MJ, aucune table, aucune
> négociation), route `POST /:characterId/echanges/admin` (MJ uniquement) dans `char-sheet.js`,
> correctif `PUT /:characterId/sols` (garde asymétrique : le joueur peut toujours diminuer, seul le MJ
> peut augmenter). **3 bugs réels trouvés en auto-critique avant code** (jamais coder tant qu'un doute
> subsiste) : `user_id` NULL comparé à NULL aurait fait matcher deux PNJ sans propriétaire comme "même
> joueur" ; débit de sols par lecture-puis-écriture séparées au lieu d'une update conditionnelle
> atomique (course possible) ; aucun garde d'autorisation explicite sur "qui peut proposer depuis ce
> personnage" — résolu en réutilisant le `router.param('characterId')` déjà en place (même stratégie
> que `clone-to-vault`) plutôt qu'une nouvelle vérification. **1 bug réel trouvé en testant** (pas
> seulement en relisant) : `getItemWithRef`/`getDefaultContainer` (`inventoryService.js`) lisaient via
> la connexion `db` par défaut au lieu de la transaction en cours — sans garantie de voir l'écriture
> pas encore commitée. Corrigé en étendant le paramètre `trxOrDb` déjà utilisé par `removeItem` à ces
> deux fonctions, plutôt qu'un contournement local. **Testé** : 16 scénarios réels en base (transaction
> imbriquée par appel — SAVEPOINT via `trx.transaction()` —, exactement le comportement de
> `adminEchange` en production) : déplacement d'item (déséquipé, container par défaut destinataire),
> item déjà déplacé rejeté sans duplication, sols (débit/crédit, conservation stricte du total), sols
> insuffisants rejeté sans effet, auto-transfert rejeté, campagnes différentes rejetées, fiche
> destinataire introuvable rejetée avec annulation réelle du débit (atomicité vérifiée, pas supposée),
> `kind` invalide rejeté ; 0 résidu confirmé après coup ; `node --check` 0 erreur (3 fichiers touchés).
> **Non testé** : appel HTTP réel de bout en bout (route Express + guard `req.isGm` + émission WS),
> parcours navigateur — aucune UI dans ce lot. **Prochaine étape : Lot A1** (proposition/acceptation
> joueur↔joueur, réutilise `executeEchange` tel quel) — `docs/PLAN_ECHANGE.md`.
> **Retrait Session 153 (item 79)** : `echangeService.js` et la route `echanges/admin` retirés,
> redondants avec `tradeService.js` et jamais branchés à une UI — voir item 79.

> **2026-07-16 — Chantier 11 Étape 2 (Module Armes DSL), Lots A et B ✅ CODÉS ET TESTÉS.** Plan en 3
> lots (A: parseur DSL + branchement DMG ; B: dégâts de Choc, ferme partiellement `[CHOC1]` ; C: tags
> qualitatifs, affichage seul — détail complet `docs/PLAN_ARMES_DSL.md`). **Lot A livré** :
> `shared/weaponAmmoDsl.js` (NOUVEAU, `parseAmmoEffects`/`resolveDmgEffect`, registre `DMG_ACTIONS`),
> `damageService.getEffectiveWeaponDamage` (point de résolution unique), rebranchement
> `resolveAssaultAction`/`COMBAT_DAMAGE_CONFIRM` (chemins PJ/PNJ tir à distance, CaC et armement drone
> confirmés hors scope et non touchés). **Écart trouvé en codant** : `parseDice` n'accepte qu'un seul
> type de dé par formule — le dégât `ADD` munition ne peut jamais être précalculé à la Déclaration,
> résolution différée jusqu'au jet réel (`combat_pending` porte désormais `weaponInvId`, pas qu'une
> `formula` figée). **Testé** : parseur pur (8 scénarios + rejoué sans crash sur les 26 chaînes DSL
> réelles uniques du catalogue), scénario réel en base (arme "Cougar" 4D10, munition standard vs SLAP
> `DMG=SET(3D10+5)` → dégât effectivement différent constaté, transaction annulée, 0 résidu vérifié),
> `node --check` 0 erreur. **Non testé** : parcours navigateur réel, round-trip Socket.IO complet — à
> confirmer par Saar en navigateur. **Analyse à charge demandée par Saar → 2 correctifs appliqués au
> Lot A** : garde null manquante sur `getEffectiveWeaponDamage` (arme désequipée entre Déclaration et
> Confirmation → échec muet auparavant, repli explicite + log désormais) ; aperçu
> `COMBAT_DAMAGE_PROMPT` incohérent avec le jet réel (nouvelle `getEffectiveWeaponFormulaPreview`, sans
> jet de dé gaspillé). Les deux corrections testées en base réelle.
>
> **Lot B ✅ CODÉ ET TESTÉ, correctif appliqué (2026-07-16/17).** Bug trouvé après la 1ère livraison,
> confirmé par Saar : la restriction "Tête uniquement" venait de la règle p.243
> (`docs/Character/Statuts/REGLESTATUT.txt:90-121`), qui décrit en fait le Choc **des armes**
> (`ref_equipment.shock`, lourdes/contondantes ou électriques), pas celui des **munitions**. Le Choc de
> munition (Assommante/Explosive, `ammo_effects` DSL) relève d'un texte séparé
> (`docs/REGLES/REGLESMUNITIONS.md`) qui ne mentionne **aucune restriction de localisation** — 3
> catégories distinctes formalisées dans `docs/VOCABULARY.md` ("Dommages de Choc"). La table par bande
> de portée codée initialement (5D10→1D10) n'existait dans aucun des deux textes — invention de la
> donnée catalogue (`description`), 5ᵉ cas du même type que Shrapnel/HP/Explosive/IEM (§Lot C).
> **Correctif livré** : gate Tête retiré, formule fixe (`CHOC=SET(1D10+2)` Assommante), **Choc non
> réduit du tout** (ni `etq`, ni `prt`, ni `rd`), total **combiné** `degatsNets + chocTotal` (brut,
> jamais les sévérités séparées) pilote un **unique** `resolveShockTest` (natif si pas de Choc, combiné
> sinon) — la blessure reste basée sur le physique seul, jamais gonflée par le Choc virtuel.
> `shared/weaponAmmoDsl.js` (`resolveChocFormula` simplifié, formule fixe) ; `damageService.js`
> (`resolveTargetHit`, `chocDegatsNets`→`chocTotal`, `prt` retiré car inutilisé) ; les 2 callers
> (`socketCombatHelpers.js`/`socketCombatResolution.js`) simplifiés (`rangeBand` retiré). **Migration
> `160_fix_ref_equipment_choc_assommante.js`** appliquée : 12 munitions Assommante corrigées en base
> (DSL + description) ; 2 items exclus (DSL copié-collé par erreur, description totalement différente)
> → nouvelle dette **`COM26`**. **Testé** : purs (5 scénarios `resolveChocFormula`) + non-régression
> Lot A (10/10) + réel en base (transaction annulée) : Choc appliqué en tête ET hors tête (gate
> confirmé retiré), `chocTotal` toujours dans `[3,12]` jamais réduit, non-régression sans munition,
> scénario clé confirmé (physique seul insuffisant pour un test, total combiné 16 déclenche bien un
> Test de Choc sans créer de blessure). `node --check` 0 erreur (5 fichiers). **Non testé** : parcours
> navigateur réel, round-trip Socket.IO complet. Ferme partiellement `[CHOC1]` (reste non câblé : bonus
> mutation Corne, catégorie arme/`ref_equipment.shock`, hors scope de ce Lot). Détail complet :
> `docs/PLAN_ARMES_DSL.md` section "Lot B — ✅ CODÉ ET TESTÉ, CORRECTIF APPLIQUÉ".
>
> **Lot C recadré (2026-07-16) : effets mécaniques réels, plus un lot d'affichage.** Saar veut coder
> les effets des munitions spéciales autant que possible. Traduction complète de
> `docs/REGLES/REGLESMUNITIONS.md` faite et verrouillée (formules armure/dégâts pour Expansives,
> Assommantes, Explosives, IEM, Perforantes, SAP/SLAP, Shrapnel — table complète dans
> `docs/PLAN_ARMES_DSL.md`). Découpé en 3 sous-lots séquentiels (méthode pas-à-pas imposée par Saar,
> un seul à la fois) : **C1** modification d'armure (6 munitions, un seul point d'insertion `etq`/`prt`
> déjà étendu par Lot B) ; **C2** Test de panne (munitions IEM, mécanique "Test de panne" elle-même
> encore à définir, Saar fournira la règle le moment venu) ; **C3** zone d'effet Shrapnel (cône 3m
> multi-cibles, aucun ciblage de zone existant dans le pipeline combat — le plus gros morceau des 3).
> Obus canon d'assaut/uranium confirmés hors scope (pas d'exo-armure/navire). **Aucun sous-lot codé.**
> **✅ `COM9` codé (2026-07-17)** : "Viser une Localisation précise" (LdB p.229-230) — annoncée en
> phase ANNONCE (`AssaultRangedPanel.jsx`, même patron que Tir visé, `combat_actions.aimed_location`,
> migration 164), malus + bypass du D20 (`forcedSlotCode`) appliqués en RÉSOLUTION
> (`damageService.resolveTargetHit`). Détail complet : `docs/Old/PLAN_TIRVISE v2.md`. **Testé** :
> `node --check` (4 fichiers serveur), ESLint client (0 nouvelle erreur vs baseline), test réel
> `resolveTargetHit` (bypass confirmé + non-régression du tirage aléatoire sur 20 jets, side-effect-free).
> **✅ Parcours navigateur confirmé fonctionnel par Saar (2026-07-17)** — le blocage initial ("tir
> visé en Tête" impossible à forcer pour valider isolément le Lot B) est levé. Prochaine étape :
> reprendre la validation navigateur du Lot B (`PLAN_ARMES_DSL.md`) en s'appuyant sur `COM9`.

> **Item 76 (Session 148) — Fiche perso (compétences (X)/(-3), attributs) + `BUGIDENTIFIE.md` COM20
> ✅ CLOS.** Triage `BUGIDENTIFIE.md` repris (suite Session 145). **A.** Compétence `(X)` réservée :
> coût de déblocage 3→1 PE (`REGLECOMPETENCE.md:22-25` — 1 PE suffit), `mastery` → -3 au lieu de
> rester à 0 — amende PC11 (`CHARACTER.md`, exception documentée, pas une suppression). **B.**
> Compétence `(-3)` difficile : malus jamais câblé depuis la création du module XP (Session 37) —
> question **Q4** de `docs/Old/PLAN_XP.md` (2026-04, jamais répondue, confirmé par `git log --grep`)
> enfin tranchée : Base -3 dans `calcSkillTotal` (autorité serveur unique), pas de coût doublé (ça,
> c'est la règle `(X)` hors profession, pas `(-3)`). **C.** Attributs fiche perso : joueur pouvait
> éditer Niveau de base/Modif. PC directement (bug + route `PUT /attributes` sans guard GM,
> contournement UI possible) — verrouillé GM uniquement ; ajout symétrique demandé par Saar : achat
> du Modif. PC contre XP (5 PE/point, max 5), bouton "+1 / 5 PE" (2 lignes, gain/coût séparés après
> un 1er essai "+5" jugé ambigu), badge "MAX" au plafond. **D.** COM20 : fenêtre de déclaration
> combat (PJ+GM) n'affichait ni arme équipée, ni munitions, ni compétence liée avant action —
> ajouté dans la section ARMEMENT existante (nom, munitions avec code couleur ok/low/empty réutilisant
> `.combat-equip-*` déjà existant, compétence en tooltip). **Incident de méthode (D)** : 1er passage
> codé sans présenter le plan (§6.5 CLAUDE.md) — annulé (`git restore`), repris à la lettre
> (hypothèse → plan → go → code), puis réflexion UX dédiée avant le code définitif. **Testé** :
> `node --check`/ESLint sur tous les fichiers (0 nouvelle erreur, comparatif `git stash` systématique),
> scénarios réels en base (transaction annulée) pour A/B/C/D, requêtes SQL D vérifiées sur donnée
> réelle. **C et D confirmés fonctionnels par Saar en navigateur** ("Fonctionnel et validé" / "All
> ok"). **Non testé** : parcours navigateur A/B au-delà des scénarios en base. Aucune migration.
> Détail complet : `docs/JOURNAL6.md` "Session 148".

> **Item 75 (Session 143) — `docs/Old/PLAN_MUTATION2.md` Lot 6 : Identité (sex/is_fertile/hand_pref)
> ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Suite du Lot 5 (item 69, clos). Diagnostic
> initial du plan ("Mutations déjà câblé, rien à faire") élargi en lisant le code avant tout code :
> faux au retrait — `mutationService.removeMutation` marquait la mutation `removed` sans jamais
> annuler l'override `sex`/`is_fertile` posé à l'ajout. Trouvé aussi : `is_fertile` a deux sources
> indépendantes (mutation `mod_fertility` et avantage `adv_076` Fécondité) qui s'écrasaient sans se
> voir — trou croisé pré-existant. **Décision Saar : "on ne bricole jamais, même si cela implique
> plus de travail"** — un seul résolveur pour les deux catalogues. **NOUVEAU
> `server/src/services/identityService.js`** : `applyIdentityGrant`/`applyMutationIdentityGrant`
> (écriture directe à l'ajout — corrige au passage `adv_002` Ambidextre, en base depuis la migration
> 92 mais jamais appliqué depuis sa création) ; `recomputeIdentity(trx, sheetId, fields)` (retrait ou
> réinsertion Wizard — recalcule uniquement les champs passés en paramètre, mutations puis avantages,
> l'avantage l'emporte en cas de conflit, défaut fixe sinon : `hand_pref` `'R'`, `is_fertile` `false`,
> `sex` `'homme'`, décisions Saar). **Piège trouvé en concevant** : un recompute inconditionnel des 3
> champs aurait écrasé un `sex`/`hand_pref` choisi au Step1 dès qu'aucune source ne le concerne —
> corrigé par un paramètre `fields` explicite par appelant. **Extension de scope décidée par Saar** :
> même bug latent dans `creationService.js` STEP3 **et** STEP5 (Wizard "retravail", wipe-and-reinsert
> sans revert) — corrigé aux deux endroits avec le même résolveur. Fichiers touchés :
> `mutationService.js`, `advantageService.js`, `creationService.js` (STEP3+STEP5). Aucune migration,
> aucun fichier client. **Testé** : `node --check` (4 fichiers), 9 scénarios en base réelle
> (transaction annulée, état restauré vérifié), **SR + fonctionnel confirmé Saar en navigateur**.
> **Non testé** : parcours navigateur détaillé scénario par scénario (octroi/retrait Ambidextre/
> Fécondité, retravail Wizard Step3/Step5 avec désélection) — confirmé globalement, pas chaque cas
> limite isolément. **Chantier suivant identifié : Lot 7 (Narratif/économie, priorité basse)** quand
> Saar voudra enchaîner, ou Modding Groupe 4 (`docs/PLAN_MODING_PHASEB.md`, slot `logiciel`,
> structuré mais pas détaillé). Détail complet : `docs/Old/PLAN_MUTATION2.md` Lot 6 (archivé, chantier
> clos), `docs/JOURNAL6.md`
> "Session 143".

> **Item 74 (Session 142) — Migration 158 (CASCADE `battlemap_texture_usage`) réintégrée sur
> `master` ✅ CLOS.** Crash serveur au démarrage rencontré en pleine session Lot 6 (sans rapport,
> aucune migration touchée par Lot 6) : `knex_migrations` référençait
> `158_battlemap_texture_usage_cascade.js`, absent du dossier `migrations/` de `master`.
> **Root-cause `[VÉRIFIÉ]`** (`git merge-base`, `git worktree list`, `git reflog`) : le fichier n'a
> jamais existé sur `master` — commit unique `92cd8a4`, écrit et appliqué le 2026-07-15 pendant une
> session sur `dev/Saar`/`fusion-kiwi-v2`, jamais mergé. Ce worktree a servi indifféremment à
> `master` et `fusion-kiwi` le même jour, sur le même Postgres local — la règle "chaque instance
> garde sa propre base" (`CLAUDE.md` §3) n'a pas été respectée dans les faits. Correctif réel et
> isolé (1 seul fichier dans le commit — `battlemap_texture_usage.battlemap_id` sans `ON DELETE
> CASCADE`, bloquait `DELETE /api/campaigns/:id` dès qu'une battlemap a des textures posées).
> `git cherry-pick 92cd8a4` → `80e75e0` sur `master`, aucun conflit. Déjà appliqué en base (batch
> 108) — aucune ré-exécution. **Testé** : `knex_migrations` vérifiée (nom exact), `db.migrate.latest()`
> rejoué (`log: []`), SR confirmé (`.\start.ps1` sans erreur, confirmé Saar). **Non testé** :
> re-suppression réelle d'une campagne avec battlemap texturée (scénario d'origine du correctif) —
> pas re-rejoué, hors scope de cette réconciliation. Détail complet : `docs/JOURNAL6.md`
> "Session 142".

> **Item 73 (Session 141 suite 31) — Transfert du skin Wizard (Section 12) vers le reste de
> l'interface ✅ CLOS, fonctionnel confirmé Saar.** Demande Saar hors chantiers en cours : le skin
> "Sci-Fi Premium" du Wizard de création (glassmorphism, dégradé bleu-nuit `#061223→#102744`, halo
> radial pulsé, accent cyan `#2FD7FF`, `Venus Rising`) était scopé à `.wiz-page`/`.wiz-shell`
> (`client/src/components/creation/` uniquement) — 3 systèmes visuels coexistaient dans
> `index.css` (tokens de base Section 3, HUD chamfré Section 10 partagé par 25 fichiers dont les
> fenêtres combat, skin Wizard Section 12). **Exigence explicite Saar : "architecture propre, pas de
> bricolage"** — migration en alias sémantiques (les `--wiz-*` montent dans `:root`, les anciens
> tokens `--bg-app`/`--color-primary`/`--text-primary`/`--border-subtle` deviennent des alias vers
> ces primitives au lieu d'un renommage massif dans toute l'app) plutôt qu'un simple copier-coller de
> valeurs. `.card`/`button`/`input` (Section 7) et `.btn`/`.btn-ghost`/`.btn-danger`/`.btn-gold`/
> `.btn-success`/`.badge*`/`.btn-toggle` (Section 10) reskinnés : retrait du chamfer (`clip-path`),
> glass + halo cyan. Nouvelle classe **`.app-shell`** (fond dégradé + halo pulsé, réutilise l'animation
> `wizPulse` déjà existante) partagée par `.dashboard` et `CampaignSettingsPage` — pas une 3ᵉ
> duplication du même effet. **Étendu en 2 temps** (validé par Saar à chaque étape) : (1) Login +
> Dashboard, (2) pages de configuration de campagne (`CampaignSettingsPage.jsx` + 5 `Section*.jsx` +
> `sharedStyles.js`). **6 vrais bugs trouvés et corrigés en chemin** (pas des features) : `--border-
> normal` inexistant (`DashboardPage.jsx` + `sharedStyles.js` ×4 — inputs sans bordure visible),
> `--bg-card` inexistant (`sharedStyles.js`), `.login-error` jamais stylée (classe manquante),
> `.login-title` avec un var CSS mort (`--font-family`), 6 occurrences de bleu `#5b8dee`/
> `rgba(91,141,238,...)` figées en dur (désynchronisées du token `--color-primary` dès mon 1er lot).
> **Nettoyage architectural additionnel (pages Settings)** : suppression de `sharedStyles.section`/
> `optionBtn`/`optionBtnActive`/`btnSecondary`/`btnDanger` — dupliquaient `.card`/`.btn`/`.btn-ghost`/
> `.btn-danger`/`.btn-toggle` déjà existants, un seul système de boutons/cartes dans toute l'app
> désormais. **Hors scope confirmé/différé** : Section 11 (fenêtres combat, palette tactique
> délibérément distincte, commentaire code explicite) intacte ; `ChangelogPanel.jsx` (100% styles
> inline hex, zéro token — reskin = réécriture complète, pas une simple retouche) laissé tel quel ;
> `RegisterPage.jsx` (même bug `--border-normal` trouvé au passage, mais fichier séparé sans classe
> partagée, jamais dans le périmètre validé) non touché. Testé : équilibre CSS (script Node), ESLint
> sur les 9 fichiers touchés (0 nouvelle erreur introduite, confirmé `git stash`/`git stash pop` à 2
> reprises), grep de sweep (aucune référence résiduelle aux clés supprimées ni aux couleurs figées),
> **parcours navigateur réel confirmé fonctionnel par Saar** sur les 3 zones (Login, Dashboard,
> CampaignSettingsPage 5 onglets — "magnifique"). Non testé : chaque toggle de
> `SectionCharacterSheet.jsx` (11 options) cliqué individuellement — rendu visuel global confirmé, pas
> chaque interaction isolément. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 31)".

> **Item 72 (Session 141 suite 30) — `docs/PLAN_MODING_PHASEB.md` Groupe 2 : Lunette de visée
> ✅ CLOS, fonctionnel confirmé Saar.** Suite de Groupe 1 (item 68, clos). **Trou d'architecture
> trouvé et corrigé avant code** : le plan proposait de plafonner le coût/bonus de la Lunette selon
> `portee` dès la Déclaration (Phase 1) — impossible, `portee` n'est connue qu'en Résolution
> (Phase 2, `confirmedModifiers`). Rappel de Saar sur le principe des deux phases (Phase 1 = intention
> sans valeur numérique, Phase 2 = résolution serveur) : le plafond LdB par portée est désormais un
> **clamp en Phase 2** (`getEffectiveAimBonus`, `resolveAssaultAction`), pas un calcul à la
> Déclaration. Migration `142_ref_equipment_lunette_niveaux.js` (10 lignes niv.1-10, remplace la
> ligne générique) ; `shared/combatExclusiveActions.js` (`getAimBonusComp`/`getAimIniCost` en miroir
> + `lunetteNiveau`, `getLunetteNiveau`, `getEffectiveAimBonus`) ; `socketCombatAnnouncement.js`/
> `socketCombatHelpers.js` (Déclaration/Résolution) ; sous-requête `lunette_niveau` ajoutée à 2
> fetchs existants (`inventoryService.js`/`battlemaps.js`, aucun nouvel appel réseau) ; client
> (`AssaultRangedPanel.jsx`/`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`/
> `combatSections.js`, slider dynamique). **2 bugs trouvés et corrigés avant tout test** : régression
> d'écrêtage (renvoyait 0 au lieu de clamper au plafond au-delà de 5 sans lunette) ; migration —
> `weight` omis des 10 nouvelles lignes (corrigé + réparé en base), `down()` reconstruit avec les
> vraies valeurs vérifiées (pas devinées). Testé : 21 scénarios purs, migration round-trip, scénario
> réel en base (0 résidu), SR, fonctionnel confirmé Saar. Non testé : parcours navigateur réel.
> **Incident git signalé, sans rapport** : session parallèle a committé (`4c258cc`, déjà poussé) la
> majorité des fichiers de ce chantier sous un message sans rapport — contenu vérifié intact, même
> pattern déjà documenté (suite 23). **Prochain chantier : Groupe 4** (slot `logiciel`, 4 mécaniques
> à détailler individuellement) — `docs/PLAN_MODING_PHASEB.md`. Détail complet : `docs/JOURNAL6.md`
> "Session 141 (suite 30)".

> **Item 71 (Session 141 suite 29) — Interface d'ajout Avantage/Désavantage + bug DELETE 500
> pré-existant corrigé ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Demande Saar : le bouton
> "+" du bloc AVANTAGES & DÉSAVANTAGES ne permettait d'ajouter que Mutations/Force Polaris/Autres.
> **Point d'architecture trouvé avant tout code** : la route serveur `POST /advantages` existait déjà
> mais appelait `addAdvantage()` (fonction Wizard Step5, exige `char_pc_ledger`, débite réellement
> des PC) — inutilisable pour un personnage verrouillé (ledger presque toujours épuisé, dette
> `pc_postcreation` jamais crédité). **Décision Saar : octroi narratif MJ, sans coût PC, MJ
> uniquement** — même philosophie que Mutations (Lot D)/Autres (Lot C). Codé : `advantageConstraints.js`
> (`skipBudgetCheck`, saute `sufficient_pc` uniquement — `max_desavantage_pc` reste actif) ;
> `advantageService.js` (`grantAdvantage()` NOUVEAU, aucun contact ledger, retour aplati identique à
> `getAdvantages()` ; `removeAdvantage()` corrigé — bug latent trouvé et fermé avant de devenir actif,
> ne décrémente le ledger que si `acquired_during==='creation_step5'`) ; `char-sheet.js` (`POST
> /advantages` gagne `req.isGm`, bascule vers `grantAdvantage`) ; `ref.js` (`GET /char-ref/advantages`,
> NOUVEAU) ; `AdvantagesPanel.jsx` (4ᵉ bouton, grille 2×2, étape liste groupée Avantages/
> Désavantages) ; `fr.json` (6 clés). **Bug de production pré-existant trouvé en testant via une
> vraie requête HTTP (jamais fait avant pour cette route)** : `DELETE /advantages/:id` plantait en
> 500 à chaque clic du bouton "×" existant (`req.body` non gardé, Express 5 le laisse `undefined`
> sans body) — corrigé (1 ligne, même pattern déjà utilisé ailleurs dans le fichier). **Testé** :
> `node --check` 0 erreur, ESLint 0 nouvelle erreur, `fr.json` valide, tests via de vraies requêtes
> HTTP (JWT signé GM + joueur réels) — catalogue, octroi, rejets (déjà possédé/unique/plafond 10 PC
> désavantages/joueur non-GM 403), effet `adv_076`, bug 500 confirmé puis corrigé, ledger jamais
> requis/touché, base vérifiée propre après coup, SR. **SR + parcours navigateur confirmé
> fonctionnel par Saar**. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 29)".

> **Item 70 (Session 141 suite 27) — Bug GENOTYPE : compétence "Hybride" visible pour un personnage
> Humain ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Trouvé par Saar en testant l'item 69.
> `ref_skills.HYBRIDE` avait zéro ligne `ref_skill_requirements` — jamais gaté depuis sa création.
> Recherche élargie : `type='GENOTYPE'` avait zéro ligne dans toute la table, mécanisme jamais
> alimenté malgré son support déjà codé. Texte LdB : accessible aux génotypes `HYB_NAT`/`GEN_HYB`/
> `TEC_HYB` **OU** à la mutation Amphibie — 4 alternatives (OR), alors que le moteur existant traite
> tout en ET. **Recherche externe demandée par Saar avant tout code** ("aucun bricolage toléré") :
> 5etools (compendium figé, 2 niveaux ET/OU) retenu plutôt que le `Predicate` récursif PF2e (pensé
> pour du contenu homebrew, déjà écarté pour ce projet ailleurs). Codé : migration
> `140_ref_skill_requirements_or_group.js` (colonne `or_group`, même convention que
> `ref_career_skills.choice_group`) ; `shared/skillRequirements.js` (NOUVEAU, `areRequirementsSatisfied`,
> pattern `naturalWeapons.js`) ; `SkillsPanel.jsx` (`isVisible` généralisé) ; `char-sheet.js`
> (`POST /skills/buy` étendu à GENOTYPE). **Testé** : 9 scénarios purs, round-trip migration
> byte-identique, 2 scénarios en base réelle ("Mr sourire"), SR, **parcours navigateur confirmé
> fonctionnel par Saar**. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 27)".

> **Item 69 (Session 141 suite 26) — `docs/PLAN_MUTATION2.md` Lot 5 : Déblocage de compétences
> (`[CS7]`) ✅ CLOS, fonctionnel confirmé Saar en navigateur.** `SkillsPanel.jsx` (`activeMutations`)
> lisait `charAdvantages.type==='MUTATION'`/`.muta_numero` (champs inexistants en V2) → Set toujours
> vide → 10 compétences structurellement invisibles pour 100% des personnages. 8 des 10 lignes
> `ref_skill_requirements` référençaient encore l'ancien identifiant V1 (`muta_XXX`) — remappées vers
> le `mutation_id` V2 réel. **Erreur de donnée confirmée par Saar** : les 2 lignes restantes
> (`MAITRISE_DE_LA_FORCE_POLARIS`/`MAITRISE_DE_LECHO_POLARIS`) référençaient `muta_029`
> ("Sensibilité au Polaris") — mutation qui n'aurait jamais dû exister en V2, l'accès réel passe par
> l'Avantage `adv_079` "Force Polaris" (texte LdB déjà en base le confirme). Bascule vers un nouveau
> type de prérequis `ADVANTAGE`. **2ᵉ trou trouvé** : seul SKILL_MIN était revalidé côté serveur —
> fermé (MUTATION/ADVANTAGE désormais toujours revalidés à l'achat). Migration
> `139_fix_ref_skill_requirements_mutations.js`. **Hors scope, transféré en dette séparée**
> (`docs/BUGIDENTIFIE.md` POL1) : `adv_078` "Polaris non maîtrisé" doit déclencher un tirage
> aléatoire de 2 pouvoirs, jamais construit. **2 problèmes trouvés par Saar en testant, repris en
> items 70/71** : bug GENOTYPE "Hybride", absence d'interface Avantages/Désavantages. **Testé** :
> `node --check`, ESLint 0 nouvelle erreur, round-trip migration byte-identique, 5 scénarios en base
> réelle, SR, **parcours navigateur confirmé fonctionnel par Saar** (personnage de test "Mr sourire").
> Détail complet : `docs/PLAN_MUTATION2.md` Lot 5, `docs/JOURNAL6.md` "Session 141 (suite 26)".

> **Item 68 (Session 141 suite 28) — `docs/PLAN_MODING_PHASEB.md` Groupe 1 (bonus fixes optique) +
> architecture des slots exclusifs ✅ CLOS, fonctionnel confirmé Saar.** Migration
> `141_ref_equipment_mod_slots.js` (numérotée 141 — collision de numéro 140 avec une session
> parallèle, renommée après coup, `knex_migrations` corrigé) : `ref_equipment.mod_slot`/
> `mod_requires_aim` (16 lignes catalogue) + `char_inventory_mods.mod_slot` (snapshotté, backfillé)
> + `UNIQUE(weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL`. `modingService.js` :
> `installMod` swap le slot dans la même transaction (retour en inventaire), nouvelle fonction pure
> `calcWeaponModBonus`. `socketCombatHelpers.js` (`resolveAssaultAction`) : bonus branché dans
> `totalModComp` + breakdown. Aucun changement client (MOD_INSTALLED déclenche déjà un refetch
> complet côté tous les clients). Testé : migration round-trip byte-identique, 6 scénarios réels en
> base (fixture jetable, 0 résidu), SR, fonctionnel confirmé Saar. Non testé : parcours navigateur
> réel (rien de visuel à observer hors le breakdown du jet, aucun changement client dans ce lot).
> **Prochain chantier : Groupe 2 (Lunette de visée) — `docs/PLAN_MODING_PHASEB.md`, entièrement
> tranché, réutilise l'architecture de slots déjà livrée.** Détail complet :
> `docs/JOURNAL6.md` "Session 141 (suite 28)".

> **Item 67 (Session 141 suite 25) — `docs/PLAN_MUTATION2.md` Lot 4 : Armure naturelle → RD + Arme
> naturelle codées ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Suite du Lot 3
> (item 65, clos). Plan écrit ligne-à-ligne, analyse critique (recherche externe PF2e/Open5e/D&D5e)
> et vérification finale du pipeline déclaration→persistance→résolution avant tout code (2 vrais trous
> trouvés et corrigés à ce stade : colonne `combat_actions` manquante, architecture batch de la
> fenêtre MJ différente de la fenêtre PJ). **A. Armure naturelle → Résistance aux dommages** (décision
> Saar : `natural_armor` est une constante toujours active qui modifie directement RD, pas une pièce
> de plus dans le mille-feuille ETQ de l'armure portée) — aucune migration, nouveau
> `getNaturalArmorMod` (`shared/polarisUtils.js`) + 4 sites rebranchés (`damageService.js`,
> `socketDice.js`, `char-sheet.js`, `CharacterSheet.jsx`). **B. Arme naturelle** (Griffes/
> Excroissance osseuse/Crocs/Corne) : migration `138` (2 colonnes `ref_mutations` +
> `combat_actions.natural_weapon_char_mutation_id`, miroir `aim_bonus_comp`) ; `shared/
> naturalWeapons.js` (NOUVEAU, pattern `combatExclusiveActions.js` — gate "après saisie" réutilise le
> statut `grappled` déjà pleinement fonctionnel, lecture DB réelle) ; pipeline complet rebranché : 
> `mutationService.getMutations()`, `battlemaps.js` (`/combat-equipment` gagne `naturalWeapons` par
> token — MJ/PNJ), `socketCombatAnnouncement.js` (persistance), `resolveMeleeAction` (gate + formule,
> revalidation serveur complète), `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (PJ et MJ),
> `MeleeCombatPanel.jsx` (radios + tooltip). **Gap trouvé et différé, nouvelle dette `[CHOC1]`** :
> bonus "+1D6 Choc si tête" de Corne non câblé — `calcResistanceArmure` calcule déjà un `prt`
> (protection_shock) mais `damageService.js:50` ne l'utilise jamais, aucun pool de "dommages de Choc"
> distinct des dégâts physiques n'existe dans le pipeline actuel ; hors scope de ce lot. **Testé** :
> `node --check` 0 erreur (10 fichiers), ESLint client 0 nouvelle erreur (`git stash`, +1 warning
> `exhaustive-deps` même classe qu'un pattern déjà existant), round-trip migration 138 réel
> (byte-identique), 8 scénarios purs + 3 scénarios en base réelle (transaction annulée, incluant un
> **rejet confirmé** sur une mutation forgée appartenant à un autre personnage), SR, **parcours
> navigateur confirmé fonctionnel par Saar** (PJ et MJ/PNJ, Griffes libres, Crocs grisées/débloquées
> selon le statut "Saisi", RD +3 avec "Peau renforcée"). **Point de règle soulevé par Saar en
> validant, tranché** : texte LdB relu (`REGLE_MUTATION.md`) — Corne/Crocs conditionnées à "après
> avoir effectué une saisie" (aucune autre mécanique décrite pour ces deux mutations), Griffes/
> Excroissance osseuse sans précondition — lecture RAW confirmée correcte, conservée telle quelle.
> **Non testé** : les cas limites listés en section H un par un (validation globale) ; bonus "deux
> armes" avec une arme naturelle en conditions réelles. Détail complet : `docs/JOURNAL6.md`
> "Session 141 (suite 25)".

> **Item 65 (Session 141 suite 23) — `docs/PLAN_MUTATION2.md` Lot 3 : Résistance aux Dommages +
> Choc câblés ✅ CLOS, fonctionnel confirmé Saar en navigateur.** Suite du correctif RD (item 64). `shared/polarisUtils.js` :
> `getMutationModForResistance` (symétrique à `getAdvantageModForResistance`) + `calcResistanceDommages`/
> `calcSeuils` gagnent chacune 2 paramètres (mutation/avantage, addition directe). **Consolidation
> trouvée avant de coder** : la branche PNJ auto-résolution CaC (`socketCombatHelpers.js`,
> `resolveMeleeAction`) dupliquait presque intégralement `damageService.resolveTargetHit` — remplacée
> par un seul appel (au lieu d'y dupliquer une 2ᵉ fois le fetch mutations/avantages, même erreur que
> celle ayant nécessité 2 correctifs pour le bug RD). `resolveTargetHit` devient le seul point
> d'insertion RD/Choc pour toute la résolution de combat (4 appelants + branche CaC consolidée).
> Macros `seuil_etourdi`/`seuil_incons` complétées + nouvelle macro `resistance_dommages` (décision
> Saar). `CharacterSheet.jsx` : fiche et résolution combat rebranchées dans la même passe (plus
> d'écart), duplicata inline `seuilEtour`/`seuilIncons` remplacé par `calcSeuils` importé. **Testé** :
> 11 scénarios purs, `node --check`, ESLint 0 nouvelle erreur, grep de sweep, **vérification en base
> réelle** (personnage réel avec mutation "Squelette renforcé" — delta +2 RD/+3 seuil confirmé), SR.
> **Non testé** : parcours combat réel en navigateur — laissé de côté sur la même logique que le bug
> RD (item 64). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 23)".

> **Item 66 (Session 141 suite 24) — Fiche perso : détail de calcul en tooltip pour les attributs
> secondaires ✅ CLOS.** Suite du Lot 3 (item 65, confirmé fonctionnel). Réutilise le pattern déjà en
> prod `iniTooltip` (texte multi-lignes `\n`, CSS `pre-line` déjà en place) — pas de nouveau
> mécanisme. `shared/polarisUtils.js` : `getAdvantageRowsForAttr`/`getAdvantageRowsForResistance`
> (variante "liste nommée", refactor `sumModByKey` sur un `filterModByKey` partagé, comportement
> inchangé). **Décision Saar** : mutations affichées en total agrégé (pas nommées — éviterait un
> fetch supplémentaire pour un gain jugé secondaire), avantages affichés nommés (déjà disponibles).
> `CharacterSheet.jsx` : `buildSecondaryTooltips` + 2 helpers locaux (attribut / résistance), 9
> tooltips concernés (reaction, souffle, seuilEtour, seuilIncons, resistanceDommages + 4 résistances
> naturelles). `fr.json` : 3 clés génériques réutilisées. **Testé** : 4 scénarios réels, non-régression
> des fonctions refactorées, `node --check`, ESLint 0 nouvelle erreur, SR. **Non testé** : parcours
> navigateur (hover réel). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 24)".

> **Item 64 (Session 141 suite 22) — Bug RD (Résistance aux Dommages) : signe inversé corrigé
> ⚠️ CLOS PARTIEL.** Trouvé en ouvrant `docs/PLAN_MUTATION2.md` Lot 3 (lecture obligatoire de
> `docs/REGLES/REGLESYSCOMBAT.md` avant mécanique combat) : la règle dit d'**ajouter** le modificateur
> de Résistance aux Dommages aux dégâts ("un personnage fort et résistant va réduire les dégâts,
> faible... aggravés"), le code (`damageService.js`/`socketCombatHelpers.js`) le **soustrayait** —
> l'inverse. `RD_TABLE`/`calcResistanceDommages` (`shared/polarisUtils.js`) ne sont pas en cause,
> croisées correctes contre la table brute LdB (`docs/Old/AttributsTooltips.md`) — le bug est dans la
> formule de consommation, pas la donnée. `[VÉRIFIÉ]` par exécution réelle avant/après (`node -e`,
> 3 profils) : formule fautive donnait un personnage fort (FOR/CON 18/18) plus touché (14) qu'un
> faible (FOR/CON 4/4, 6) à dégâts bruts identiques — corrigé, désormais fort=6/faible=14, conforme
> à la règle. Corrigé aux 2 sites réels (`degautsBruts - etq - rd` → `+ rd`), doc alignée
> (`docs/SYSTEME/COMBAT.md`, `docs/MANUELSYSCOMBAT.md`, `docs/STRUCTURE_SYSCOMBAT.md`). Effet de bord
> positif : lève le "signe non trivial" ouvert dans `PLAN_MUTATION2.md` Lot 3 pour
> `adv_018`/`adv_030`/`adv_060` — le résolveur générique déjà construit pour les Résistances
> naturelles s'applique désormais tel quel à RD, sans inversion par `type`. **Testé** :
> instrumentation réelle avant/après, `node --check`, grep de sweep (aucun 3ᵉ site), SR. **Non
> testé** : parcours combat réel en navigateur — laissé non testé sur décision explicite de Saar pour
> enchaîner directement sur le Lot 3. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 22)".

> **Item 63 (Session 141 suite 21) — `docs/PLAN_MODING.md` Phase A : ✅ TERMINÉE (8/8 étapes,
> Étape 0 confirmée fonctionnelle par Saar, Étapes 1-7 codées et testées dans la foulée).** Pause du 2026-07-09 levée : Tir
> visé (bloquant Phase B) clos Session 141 (suite 17), dette `TIRVISE` close. Analyse critique du
> 2026-07-12 (contrainte UNIQUE anti-doublon) déjà intégrée au plan avant ce codage. **Étape 0**
> (extraction `server/src/services/inventoryService.js` depuis `char-sheet.js`) codée : les 6 routes
> (`getInventory`/`quickEquip`/`addItem`/`updateItem`/`reloadWeapon`/`removeItem`) + 4 helpers +
> 4 constantes déplacés à l'identique, routes `char-sheet.js` réduites à de purs wrappers
> (parse req → service → socket → réponse). **Dérive trouvée en cours de route** (le plan datait du
> 2026-07-09, le fichier avait grossi de 1928 à 2133 lignes entretemps) : une session parallèle
> (migration 131, dual-wield) avait ajouté `isEquippableLocation`/`SYMMETRIC_SLOT_PAIRS` (logique
> armure 1+S+S + paires symétriques BG/BD, JG/JD) au milieu des routes à extraire — déjà proprement
> modularisés par cette session (`lib/inventoryRules.js`/`shared/armorConstants.js`), simplement
> importés dans `inventoryService.js` plutôt que redéfinis. **1 site d'appel hors des 6 routes
> trouvé et corrigé** : `getDefaultContainer` était aussi utilisé par la route drone `cargo/:invId/
> drop` (hors scope Étape 0, non déplacée) — rebranché vers `inventoryService.getDefaultContainer`.
> `removeItem` accepte un `trxOrDb` optionnel (P7, réutilisé par le futur `modingService.installMod`
> à l'Étape 2). **Testé** : `node --check` 0 erreur (pas d'ESLint côté serveur — confirmé, seul
> `client/eslint.config.js` existe dans ce repo), 13 scénarios réels en base (fixture jetable,
> cascade `ON DELETE CASCADE` vérifiée pour le nettoyage) — stacking munitions, conflit "mains déjà
> occupées" (409), split P57 (arme équipable ×2 sans slot → 2 lignes indépendantes), armure 1+S+S,
> reload avec consommation totale de munitions, retrait partiel (décrément) et total, quick-equip,
> `getInventory` sur fiche vide — tous passés. SR confirmé (`/api/health` 200). **Non testé** :
> parcours navigateur détaillé scénario par scénario (ajout/équipement/recharge/suppression via
> l'UI Inventaire) — **SR + tests Étape 0 confirmés fonctionnels par Saar**. **Étapes 1-7 codées et
> testées ensuite (migration `137_char_inventory_mods` + contrainte UNIQUE, `modingService.js`,
> event `WS.MOD_INSTALLED`, routes `GET/POST .../moding/*`, handler socket client
> `onModInstalled`, `ModingWindow.jsx` NOUVEAU, wiring bouton "Customisation" dans
> `InventoryPanel.jsx`/`CharacterWindow.jsx`)** — testées à 3 niveaux : service (10 scénarios réels,
> dont vérification directe que la contrainte UNIQUE rejette bien un insert brut en double, `23505`),
> HTTP réel (JWT signé), **et navigateur réel (Playwright headless, parcours complet avec capture
> d'écran avant/après — installation d'un mod confirmée visuellement, inventaire rafraîchi en temps
> réel sans reload)**. **Incident post-livraison résolu** : Saar a d'abord signalé le bouton
> "Customisation" invisible — diagnostic par instrumentation (commit `dfc1283` vérifié complet
> ligne par ligne, fichier `InventoryPanel.jsx` relu sur disque, Vite confirmé servant
> `ModingWindow.jsx` sans erreur de compilation) a écarté toute régression de code ; cause retenue :
> onglet navigateur resté ouvert pendant le codage (HMR Vite n'a pas propagé le changement de
> structure de `CharacterWindow.jsx`, return passé en Fragment). **Rechargement complet (Ctrl+Shift+R)
> → confirmé fonctionnel par Saar.** **Phase A du plan 8/8 étapes codées et testées de bout en bout,
> parcours navigateur confirmé par Saar.** Phase B (effet mécanique des mods en combat) reste hors
> scope, à planifier séparément si voulu. Détail complet : `docs/PLAN_MODING.md`,
> `docs/JOURNAL6.md` "Session 141 (suite 21)", `server/src/services/inventoryService.js`/
> `modingService.js` (NOUVEAUX), `client/src/character/ModingWindow.jsx` (NOUVEAU).

> **Item 62 (Session 141 suite 20) — Bonus féminin : règle fixe ✅ CLOS.** Signalement Saar : la
> mécanique `feminin_bonus` (remise forfaitaire invisible sur COO/PRE, Session 141 suite 14) n'est
> pas compréhensible — demande de simplification en règle fixe et lisible, sans choix de répartition :
> Femme = FOR -2, COO +1, PRE +1. **Antécédent relu avant de coder** (Session 141 suite 14) : un 1er
> correctif direct sur COO/PRE avait déjà été abandonné (plafonnait le spinner, cassait l'achat PC
> normal au-delà du bonus) — vérifié que la répartition fixe demandée par Saar élimine cette source de
> complexité, aucun plafond de spinner recréé. **Vrai bug trouvé en testant le plan (captures Saar)** :
> basculer Sexe M↔F après avoir déjà réparti des points changeait silencieusement le budget sans jamais
> revalider — `Step1Attributes.jsx` ne passait jamais par `validateStep1` (le serveur seul l'appelait),
> et `validateStep1` lui-même ne rejetait jamais un budget dépassé (G1 traitait "dépassé" et "non
> dépensé" pareil). `shared/polarisUtils.js` : `getAttributeBase(attrId, isFeminin)` (remplace
> `getFemininBonusDiscount`) + G1bis (budget dépassé = erreur dure). `Step1Attributes.jsx` : gate
> "Suivant" alignée sur le pattern déjà établi par `CareersAllocator.jsx`/Étape 4 (`validation =
> useMemo(() => validateStep1(...))`), `handleSetFeminin` redevenu trivial. **Bug trouvé en testant ma
> propre correction** : valeur hors bornes (>20 après bascule) → `COST_LOOKUP` sans entrée → `NaN` dans
> le HUD — corrigé (`—` affiché). `Step2Genotype.jsx` : angle mort fermé au passage (ignorait
> `femininBonusEnabled`). Testé : lint 0 nouvelle erreur, scénarios `node -e` (G1bis + G3 sur bascule),
> **vérification en base réelle** (64 fiches non verrouillées, 0 en dépassement ; 0 personnage féminin
> en cours avec l'option active actuellement). SR + **fonctionnel confirmé Saar**. Non testé : parcours
> navigateur réel du bascule Sexe. Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 20)".

> **Item 61 (Session 141 suite 19) — Résistances naturelles (poison/maladie/radiation/drogue)
> câblées ✅ CLOS.** `docs/PLAN_RESNAT.md` — chantier issu du carve-out "Résistances naturelles" hors
> Lot 3 de `PLAN_MUTATION2.md`. Recherche pro (Foundry Active Effects, PF2e IWR) demandée par Saar
> avant tout code a fait rejeter un premier plan (inversion de signe à l'exécution) au profit d'une
> correction à la source. **Bug de données réel trouvé** : 6 lignes `ref_advantages`/`ref_mutations`
> stockaient un delta positif pour un effet censé améliorer la résistance — avec `Seuil = Intensité −
> Modificateur` (confirmé par Saar), ça dégradait le Seuil au lieu de l'améliorer (cas le plus
> parlant : "Contagion", immunité totale, aurait rendu un personnage immunisé **systématiquement en
> échec**). Migration `136` (NOUVEAU) corrige les 6 lignes + normalise `"drug"`/`"drugs"`. 0 personnage
> réel concerné — zéro régression. `getAdvantageModForResistance` (`shared/polarisUtils.js`, aucune
> inspection de `type`) + 4 sources de macro (`resistance_poison/maladie/radiation` + fix de
> `resistance_drogues`, buggée depuis toujours). **Addendum même session** : Saar signale l'absence de
> Résistance aux dommages/Résistances naturelles/Souffle sur la fiche perso (vs liste LdB p.114) —
> 5 fonctions consolidées de `charStats.js` vers `shared/polarisUtils.js` (même principe que `calcREA`
> Lot 2), 6 nouveaux champs ajoutés à `CharacterSheet.jsx` (rien retiré). Décision de scope :
> "Résistance aux dommages" affichée en valeur de base seulement (pas de mutation/avantage — la
> résolution de combat réelle ne les consomme pas encore, Lot 3 non traité). Testé : round-trip
> migration réel, 9 scénarios unitaires, test bout-en-bout base réelle (transaction annulée),
> non-régression numérique, ESLint 0 nouvelle erreur, SR + **parcours navigateur confirmé fonctionnel
> par Saar** (capture d'écran fiche réelle). Non testé : parcours navigateur des macros. **Passe UI/UX
> même session ✅ CLOS (3 itérations)** : mockup interactif → hybride cartes/liste choisi ; capture
> fiche complète → vraie cause de la longueur identifiée (bloc Compétences ~60 lignes, pas les
> Attributs secondaires) → **accordéon sur 6 blocs** (En-tête reste ancre fixe) + **mémorisation par
> TYPE de fiche** (`localStorage` `owned`/`other` via `isOwner`, pas par personnage — demande explicite
> "mes fiches perso ne s'affichent pas pareil que les autres") + **Attributs secondaires en 2 colonnes**
> (2 listes indépendantes, écart assumé vs maquette entrelacée) ; puis Allures regroupées avec
> Réaction/Initiative + séparateur discret. **Parcours navigateur confirmé fonctionnel par Saar à
> chaque itération** ("Conforme" final). Non testé : bascule owned/other avec capture dédiée, fenêtre
> très étroite, macros via `/macro-preview`. **Chantier suivant identifié : `PLAN_MUTATION2.md` Lot 3**
> (Résistance aux Dommages + Choc — scope déjà recentré, pas détaillé ligne à ligne). Détail complet :
> `docs/PLAN_RESNAT.md`, `docs/JOURNAL6.md` "Session 141 (suite 19)".

> **Item 60 (Session 141 suite 18) — Point documentaire ✅ CLOS.** Demande Saar : trier les chantiers
> terminés, évaluer la qualité de la doc, reset `JOURNALTEMP.md`, décider de l'usage de
> `FOUNDATION.md`/`VOCABULARY.md`. **8 fichiers `docs/PLAN_*.md` archivés** vers `docs/Old/`
> (`PLAN_TIRVISE`, `PLAN_VAULT`, `PLAN_ADVANTAGESPANEL`, `PLAN_DICEREWORK3`, `PLAN_SEXE`, `PLAN_MOVE`,
> `PLAN_RAYCAST`, `PLAN_WIZARD_REFACTOR` — code vérifié en place pour chacun avant archivage, pas
> seulement le statut écrit dans le fichier). Restent actifs : `PLAN_LOS.md` (Phases 1-3 ouvertes),
> `PLAN_GEOMETRIE.md` (0% codé), `PLAN_EXPORTPDF.md` (proposition), `PLAN_MUTATION2.md` (Lot 2+),
> `PLAN_MODING.md` (en pause). **Trouvailles qualité doc** : `docs/GLOSSAIRE.md` référencé par
> `.claude/rules/conventions.md` mais absent du repo (n'existe que dans le submodule
> `Enclume-codex/`) — référence corrigée vers `docs/VOCABULARY.md` ; `docs/SYSTEME/REGLES_LdB.md`
> = dump brut LdB à l'encodage cassé, mal placé selon `docs/RegleDocumentaire.md` Règle 8, doublon
> probable de `docs/REGLES/REGLESYSCOMBAT.md` — bandeau d'avertissement ajouté, suppression différée
> (dette `[DOC2]`). **Recadrage Saar en cours de session** : "ces docs sont rédigées pour toi" — bascule
> d'une simple passivité "table de référence" vers un **wiring actif** façon DÉTECTEUR DE DÉRIVE.
> `docs/VOCABULARY.md` (squelette vide depuis sa création) peuplé avec un premier seed réel (concepts
> métier, ambiguïtés déjà connues, acronymes, pièges historiques — dette `[DOC1]`, à enrichir en
> continu). `CLAUDE.md` : table Nomenclature docs étendue (FOUNDATION/VOCABULARY/RegleDocumentaire),
> 2 nouveaux triggers DÉTECTEUR DE DÉRIVE (nouveau terme métier → VOCABULARY.md à jour ? / nouvelle
> doc → responsabilité unique définie ?). `docs/JOURNALTEMP.md` reset (contenu confirmé consolidé
> ailleurs avant effacement). **Testé** : sans objet (session documentaire pure, aucun code touché).
> Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 18)".

> **Item 59 (Session 141 suite 17) — Tir visé (LdB p.227-228) + framework Actions Exclusives ✅ CLOS.**
> Chantier lancé par une demande de planification pure ("fonctionnalité qui semble manquer"), mené en
> plusieurs passes validées une à une : recherche externe (Nystrom *Game Programming Patterns*, trait
> "Flourish" Pathfinder 2e) → plan → 2 analyses critiques (7 puis 3 points corrigés avant tout code) →
> backend → client. `shared/combatExclusiveActions.js` (NOUVEAU) : évaluateur pur, pattern
> `careerEligibility.js` — `getAimIneligibilityReasons` (liste de raisons, pour le tooltip UI) dont
> `isAimEligible` dérive (jamais dupliqué) + `isExclusiveDeclaration` (registre générique, peuplé pour
> Tir visé seul — Charge/Rafale longue le rejoindront dans leurs propres sessions, leurs bonus
> mécaniques existant déjà). Règle centrale : *"tu ne vises que si tu ne fais que ça"* — aucune
> transition d'état (`state_*` sur `combat_roster`) ni autre action ce tour, résout mécaniquement en
> une fois l'immobilité/Précipiter/Rechargement. Migration `134` (`combat_actions.aim_bonus_comp`) +
> `socketCombatAnnouncement.js`/`socketCombatHelpers.js` (validation + Seuil). Client (×2 fenêtres
> PJ/MJ) : nouvelle option "Tir visé" dans `AssaultRangedPanel.jsx` (3ᵉ choix entre Tir simple/Tir à
> répétition), grisée avec tooltip listant les raisons d'inéligibilité. **1 correctif annexe** :
> commentaire JSDoc faux sur `isDualWield` MJ (jamais un bug réel, câblage déjà fonctionnel).
> **Trouvaille hors scope confirmée avec Saar** : "Viser une Localisation précise" (LdB p.229-230) est
> une règle distincte (malus pour choisir la zone touchée, pas de lien avec Tir visé) — déjà tracée
> sous `COM9` (`BUGIDENTIFIE.md`), suite possible non tranchée. **Dette `INI3` ajoutée**
> (`current_initiative` ≤ 0 non géré, gap systémique pré-existant, pas spécifique à Tir visé). Testé :
> 10 scénarios unitaires + test réel `resolveAssaultAction` (fixture jetable, nettoyage vérifié) +
> round-trip migration + ESLint (0 nouvelle erreur) + **SR + parcours navigateur confirmé fonctionnel
> par Saar**. Non testé : scénarios de rejet `COMBAT_DECLARE_ERROR` en conditions réelles navigateur.
> Détail complet : `docs/PLAN_TIRVISE.md`, `docs/JOURNAL6.md` "Session 141 (suite 17)".

> **Item 58 (Session 141 suite 16) — Audit combat suite à 4 signalements d'agents externes
> ("on a tout pété") + `ref_equipment_skill_assoc` reconstruite ✅ CLOS.** Chaque signalement vérifié
> indépendamment (DB réelle + code + Git) avant action — 1 seul bug majeur réel, 1 piste d'abord
> classée fausse alerte puis réouverte et confirmée (`calcCarenceArmure` — d'abord jugé règle de base
> LdB Session 56 sur la foi d'un tag `(LdB)` non sourcé dans `docs/Old/JOURNAL2.md:5053`, sans page
> citée ; recherche exhaustive relancée sur exigence Saar dans tout `docs/REGLES/*` → zéro trace
> textuelle trouvée → mécanique jugée non sourcée et **effacée entièrement** — fonction, 2 sites
> d'appel, breakdown, doc ; colonne `ref_equipment.min_str` conservée, donnée brute indépendante du
> calcul fabriqué), 2 constats exacts mais déjà tracés dans `docs/PLAN_MUTATION2.md` Lot 3 (non
> touchés ici). **Bug réel** : `ref_equipment_skill_assoc` (table "compétence d'utilisation" pour
> résoudre un jet de combat, distincte de `ref_equipment_skills` "compétences boostées/requises",
> jamais consommée en jeu — voir dette `[EQSKILLS1]`) n'avait **jamais été peuplée par aucun
> seed/migration** depuis sa création (migration 48) — 25 lignes seulement en base, saisies à la main
> via l'API admin, jamais reliées à la source. Trou touchant la quasi-totalité des catégories d'armes
> (pas seulement "Armes de poing" comme initialement rapporté). Migration `135` (NOUVEAU) : 130
> nouvelles paires arme↔compétence sourcées depuis `docs/ExtractCOMP.md` (vraie colonne "Compétence
> associée" du Google Sheet) + 3 corrections confirmées Saar après recoupement `REGLECOMPETENCE.md`
> (dont Lance-flammes : contact→distance, erreur de mémoire de Saar lui-même corrigée avant codage).
> **Vérification ×3 exigée par Saar** ("la faiblesse d'un LLM c'est sa mémoire") : triple recoupement
> automatisé (nom↔base, libellé↔catalogue, proposé↔existant), état final 154/154 paires (0 écart),
> round-trip `down`/`up` réel confirmé. **Testé** : recoupements automatisés + round-trip +
> **parcours combat réel en navigateur confirmé fonctionnel par Saar** (assaut arme de poing/CaC,
> effacement `calcCarenceArmure` inclus — "SR, fonctionnel, test OK"). Détail complet :
> `docs/JOURNAL6.md` "Session 141 (suite 16)" et "(suite 16 — correction)".

> **Item 56 (Session 141 suite 14) — 4 correctifs enchaînés, chacun trouvé en testant le précédent :**
> (1) suppression d'un character/battlemap ne supprimait jamais ses tokens (`tokenLifecycle.js`,
> NOUVEAU) ✅ CLOS fonctionnel confirmé (tests HTTP réels) ; (2) 9 personnages de "Camp LOCALE"
> avaient 2 lignes `char_sheet` chacun (bug historique, aucune contrainte `UNIQUE` depuis toujours)
> — migration `132` dédoublonne + ajoute la contrainte ✅ CLOS ; (3) `handleTerminate` faisait 2
> appels réseau non-atomiques (`reconcile` puis `lock`), laissant des personnages `complete` mais
> jamais verrouillés si le 2ᵉ échouait — fusionnés en un seul appel atomique (`reconcileCreation`
> gagne `finalize`) ✅ CLOS, testé (rejet + rollback complet en conditions réelles) mais **parcours
> complet navigateur jusqu'à "Terminer" jamais confirmé par Saar** (interrompu par (4)) ; (4) bonus
> féminin Coordination/Présence : plafonnait la valeur finale au lieu de remiser le coût PC (bug
> Session 137, jamais vu jusqu'ici) — remplacé par une remise forfaitaire dans `calcTotalCost`
> (`shared/polarisUtils.js`), **zéro nouvel état/UI** (proposition Saar, vérifiée mathématiquement
> équivalente à un décalage de base par attribut) ✅ CLOS **fonctionnel confirmé Saar**.
> Migration `133` (backfill `wizard_locked_at` pour 20 fiches historiques pré-Wizard) ✅ CLOS.
> **Dette `[WIZLOCK1]` ajoutée** (`CLAUDE.md`) : pourquoi 2 fiches `complete` n'avaient jamais été
> verrouillées avant ce correctif — cause probable identifiée (le double-appel réseau non-atomique
> ci-dessus), pas re-vérifiée a posteriori sur ces 2 cas précis.
> **Non testé / à confirmer par Saar** : parcours Wizard complet réel jusqu'à "Terminer" (le
> mécanisme d'atomicité est vérifié en isolation, pas le chemin heureux bout en bout) ; suppression
> réelle d'un character/battlemap en session live via l'UI (testé en HTTP direct uniquement).
> Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 14)".

> **CHANTIER REDESIGN STEP 4 PROFESSION → ✅ TERMINÉ (8/8 lots)** — plan maître archivé :
> **`docs/Old/PLAN_REWORKFINAL.md`**.
> **CHANTIER `docs/PLAN_ADVANTAGESPANEL.md` → ✅ TERMINÉ (Lots A/B/C/D) — Session 141 (suite 9)**.
> Lot A : Force Polaris (migration 123, OPT-04). Lot B : bloc liste réparé (badges `AVA`/`DÉS`).
> Lot C : notes "Autres" (migration 124, table `char_advantage_notes` dédiée). Lot D : MJ peut
> octroyer une mutation en jeu (migration 125, `mutationService.js`, badge "MUT", MJ uniquement) —
> bug **MUT2** corrigé au passage (`GET /char-ref/mutations`). Testé + SR + fonctionnel confirmé
> Saar (tous les lots). Détail complet : items "48."/"49."/"51."/"52." et `docs/JOURNAL6.md`
> "Session 141 (suite 6)"/"(suite 7)"/"(suite 9)".
> **Limite trouvée en testant le Lot D, transférée vers `docs/PLAN_MUTATION2.md`** :
> ajouter une mutation/avantage n'applique aucun effet mécanique (attributs, résistances,
> compétences débloquées) — **vérifié aussi jamais fait par le Wizard**, gap architectural
> pré-existant bien plus large que ce chantier (`calcNA` n'a pas de paramètre mutation, 74/76
> lignes `ref_advantages` sans effet appliqué). Lot E (`[CS7]`) transféré au même document.
> **Session 141 (suite 10) — plan affiné avec Saar** : mutations et avantages sont la même famille
> de problème (moteur d'application unique, deux sources normalisées vers la même forme),
> découpage retenu en **7 lots par type d'effet** (pas par catalogue source) — Lot 1 Attributs
> primaires, Lot 2 Attributs secondaires, Lot 3 Résistances, Lot 4 Armure/arme naturelle (le plus
> lourd — V2 n'a plus de colonnes structurées pour l'arme naturelle, contrairement à l'ancien
> schéma V1), Lot 5 Déblocage de compétences (`[CS7]` + mapping `muta_XXX` V1→V2 à faire), Lot 6
> Identité, Lot 7 Narratif/économie.
> **Lot 1 (Attributs primaires) ✅ CLOS — Session 141 (suite 13), fonctionnel confirmé Saar.**
> Consolidation `calcNA`/`calcAN` vers `shared/polarisUtils.js`, PI4 (encombrement) réellement
> corrigé + option de campagne `encumbrance_enabled`/`_multiplier`, ~20 sites serveur+client
> rebranchés. **4 bugs supplémentaires trouvés et corrigés en testant** (migrations 127/128) : vue
> `char_mutation_effects_view` aveugle aux sous-types de mutation, sélecteur de sous-type manquant
> côté Lot D, état client jamais rafraîchi après ajout/retrait, et surtout un `bigint` Postgres
> retourné comme chaîne par `node-pg` (jamais casté en `::integer`) qui corrompait le calcul par
> concaténation de chaîne au lieu d'addition (`10 + '2'` → `102` au lieu de `12`). Détail complet :
> item "55." et `docs/JOURNAL6.md` "Session 141 (suite 13)", `docs/PLAN_MUTATION2.md` section Lot 1.
> **Bilan/run à vide fait le 2026-07-11** (`docs/PLAN_MUTATION2.md` section "Bilan / run à vide",
> aucun code) : point resté ouvert non retesté — **aperçu Wizard ("peek") après fermeture/
> réouverture explicite, hypothèse jamais confirmée par Saar** (même cause présumée que le bug de
> rafraîchissement client du Lot 1) ; piège à surveiller pour tous les lots suivants — caster
> `::integer` tout nouvel agrégat SQL avant consommation JS (leçon du bug bigint-as-string).
> **Prochaine étape : détailler le Lot 2 (Attributs secondaires) ligne-à-ligne avec Saar, même
> méthode que le Lot 1 (jamais deux lots à la fois) — vérifier d'abord le point Wizard peek ouvert
> ci-dessus si l'occasion se présente.**
> **Chantier Options de campagne (item 41) : `revers` (OPT-06) ✅ câblée — Session 141 (suite 12)**
> (9/11 faites : `ambiance`, `random_mutations`, `feminin_bonus`, `random_pro_advantages`,
> `skill_prerequisites`, `skill_max_level`, `young_penalty`, `polaris_latent`, `revers`).
> **PROCHAINE OPTION À CÂBLER : à définir avec Saar** — voir item "41." (2/11 restantes :
> `skill_natural_prog`, `celebrity`).
> **Item 54 (Session 141 suite 12 — "suite 10" et "suite 11" déjà pris par deux sessions parallèles
> sans rapport, `PLAN_MUTATION2.md`/`PLAN_MODING.md`, repéré avant de commettre la collision) :
> Revers (OPT-06) ✅ CLOS + mode développeur écarté (UX à deux niveaux avertissement/blocage) ✅ CLOS
> + consolidation mini-stepper Avantages pro ✅ CLOS.** Nouvelle sous-step `SetbacksAllocator.jsx`
> (Revers, globale) et `ProAdvantagesAllocator.jsx` (Avantages pro, par métier — répartition
> manuelle + Tirage 1D10 fusionnés, retirés de `CareersAllocator.jsx`). Deux vrais bugs trouvés et
> corrigés en run à vide (signature d'avertissement incomplète, incohérence client/serveur sur le
> dépassement de budget). Roadmap ouverte (`[ADV1]`/`[ADV2]`/`[ADV3]`, `CLAUDE.md`) : Célébrité/
> Allié/Contact/revenus cumulatifs/déblocage de compétence non trackés mécaniquement — chantier
> dédié à planifier ensuite, décision Saar. Détail complet : item "54." ci-dessous et
> `docs/JOURNAL6.md` "Session 141 (suite 12)".
> **Item 46 (hors chantier options de campagne) : Formation "Autodidacte" ✅ câblée — Session 141
> (suite 3)** — 7 points libres réellement répartissables (mécanique de base, jamais un toggle
> campagne), voir détail ci-dessous.
> **Item 47 (hors chantier, interruption ponctuelle) : Correction dé D100/D10 3D ✅ CLOS — Session
> 141 (suite 5)** — `PLAN_DICEREWORK3.md`, voir détail ci-dessous.
> **Item 50 (suite de l'item 47, via l'outil de calibration étendu) : bug réel D4 face "4" + roulis
> aléatoire des dés ✅ CLOS — Session 141 (suite 8)** — voir détail ci-dessous.
> **Item 53 (hors chantiers ci-dessus) : `docs/PLAN_MODING.md` analysé + corrigé, chantier mis EN
> PAUSE — Session 141 (suite 11)**. Plan jamais commencé (0% codé) depuis sa rédaction Session 120.
> Corrigé et scindé en Phase A (rangement inventaire, plan complet, prêt à coder) / Phase B (effet
> mécanique sur le Test de tir, découpée en 5 lots B1-B5). **B2-B5 dépendent de Tir visé, mécanique
> combat qui n'existe pas dans le code** (0 référence trouvée). **Nouvelle dette distincte** de
> `COM9`("Localisation précise") et de "Changer le mode de tir" (mécaniques voisines dans
> `REGLESYSCOMBAT.md`, mais différentes — vérifié, pas la même règle). **Décision Saar : Tir visé
> est prioritaire, à planifier avant de
> reprendre le moding** — chantier entier mis en pause (pas seulement B2-B5). Aucun plan écrit pour
> Tir visé pour l'instant. Voir détail ci-dessous et `docs/JOURNAL6.md` "Session 141 (suite 11)".

> **Item 57 (hors chantiers ci-dessus, conversation dédiée) : `docs/PLAN_VAULT.md` — Coffre
> personnel (Vault) ✅ TERMINÉ, Étapes 0 à 7 codées et testées — 2026-07-10/11.** Nouvel espace de
> stockage de personnages indépendant des campagnes (inspiré Roll20 Character Vault/Foundry
> Compendium Packs, recherche faite avant conception) : transfert = copie, jamais un déplacement.
> Migrations `129`/`130` (table `vaults`, `characters.vault_id`, `vault_transfer_requests`),
> `vaultService.js` (registre extensible par type de compagnon PJ/PNJ/drone + garde-fou anti-dérive
> qui détecte automatiquement toute future table liée à un personnage non prise en compte), routes
> `/api/vault/*` + 1 route dans `char-sheet.js`, UI complète (carte "Coffre" sur le Dashboard, page
> dédiée, bouton d'envoi dans les fenêtres personnage/drone, onglet "Joueurs" de
> `CampaignSettingsPage.jsx` enfin rempli — texte placeholder "Phase 3" qui y dormait depuis Session
> 131, confirmé sans rapport avec un autre projet). **Testé à chaque étape par de vraies requêtes
> HTTP puis par un vrai navigateur piloté (Playwright)**, jamais seulement par lecture de code.
> **Dette ajoutée `[CSPLAYERSTAB]`** : avertissement React préexistant (mélange `background`/
> `backgroundColor` dans les styles d'onglets de `CampaignSettingsPage.jsx`), repéré en testant ce
> chantier mais antérieur à lui et sans rapport — cosmétique, non corrigé. Détail complet :
> `docs/PLAN_VAULT.md` (toutes les étapes documentées avec leurs tests), `docs/JOURNAL6.md` "Session
> Coffre (Vault)".

**72. `docs/PLAN_MODING_PHASEB.md` Groupe 2 : Lunette de visée ✅ CLOS — Session 141 (suite 30) (2026-07-13)**
   → Suite de Groupe 1 (item 68, clos). Plan déjà entièrement rédigé et tranché en amont ("prêt à
     coder") — session de codage, tous les fichiers concernés relus avant code (`AssaultRangedPanel.
     jsx`, `CombatActionWindow.jsx` entier, `combatSections.js`, `CombatModifiersWindow.jsx`,
     `battlemaps.js`, `docs/REGLES/REGLESYSCOMBAT.md` section Tir visé — obligatoire avant toute
     mécanique combat).
   → **Trou d'architecture trouvé et corrigé avant code** : le plan proposait de passer `portee` à
     `getAimIniCost`/`getAimBonusComp`, appelées en Phase 1 Déclaration (`socketCombatAnnouncement.
     js`) — or `portee` (`confirmedModifiers.portee`) n'existe que côté `socketCombatResolution.js`/
     `socketCombatHelpers.js`, Phase 2 Résolution. Rappel de Saar sur le principe des deux phases
     (Phase 1 = intentions déclarées sans valeur numérique, Phase 2 = résolution serveur) : le coût
     INI/bonus stocké à la Déclaration ne dépend que du niveau physique de la Lunette
     (`lunetteNiveau`) ; le plafond LdB par portée ("pas de lunette niv.>3 à portée courte") est
     désormais un **clamp en Phase 2**, dans `resolveAssaultAction` — qui connaît déjà
     `confirmedModifiers.portee` et lit déjà `action.aim_bonus_comp`. Nouvelle fonction
     `getEffectiveAimBonus(aimBonusComp, {lunetteNiveau, portee})` — `LUNETTE_PORTEE_CAP` reste donc
     réellement utilisé.
   → Migration `142_ref_equipment_lunette_niveaux.js` (10 lignes "niv. 1" à "niv. 10" remplaçant la
     ligne générique `bonus="niv"`, `mod_slot='optique'`, `mod_requires_aim=true`, `price=1000×niv²`).
     `shared/combatExclusiveActions.js` : `getAimBonusComp`/`getAimIniCost` en miroir (contexte
     `{lunetteNiveau}`, écrêtage au plafond global), `getLunetteNiveau` (pure, même forme d'entrée
     que `modingService.calcWeaponModBonus` Groupe 1), `getEffectiveAimBonus` (clamp Phase 2).
     `socketCombatAnnouncement.js` : fetch mods conditionnel (`aimTranches>0`), `lunetteNiveau`
     re-dérivé serveur (payload de déclaration inchangé, jamais confiance au client).
     `socketCombatHelpers.js` : clamp Phase 2, réutilise `installedMods` déjà fetché pour Groupe 1
     (aucune requête supplémentaire). `inventoryService.js`/`battlemaps.js` : sous-requête scalaire
     `lunette_niveau` ajoutée à 2 fetchs déjà existants — aucun nouvel appel réseau, évite de
     réintroduire le N+1 déjà écarté côté MJ (précédent suite 25, armes naturelles). Client (slider
     Tir visé dynamique, résumé recalculé) : `combatSections.js`/`AssaultRangedPanel.jsx`/
     `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`.
   → **2 bugs réels trouvés et corrigés avant tout test** : régression d'écrêtage (la 1ʳᵉ version de
     `getAimBonusComp`/`getAimIniCost` renvoyait `0` au lieu d'écrêter au plafond dès que les points
     demandés le dépassaient — cassait le comportement classique déjà en prod) ; migration 142 —
     `weight` (0.1 source) omis des 10 nouvelles lignes par le premier `up()` (déjà auto-appliqué par
     nodemon, P53) — corrigé + réparé directement en base ; `down()` initialement écrit avec des
     valeurs **devinées**, retrouvées et corrigées via la source pré-migration croisée avec les 15
     accessoires soeurs intacts en base (`tech_level=2`, `manufacturer="Trinicom"`, `rarity="15
     (20)"`).
   → **Testé** : 21 scénarios purs (sans lunette identique à avant, lunette niv.7/10, écrêtage
     correct post-correctif, clamp Phase 2 par portée), migration round-trip byte-identique
     (post-correctif), scénario complet en base réelle (fixture jetable, nettoyage vérifié 0 résidu)
     couvrant tout le pipeline installation→déclaration→résolution, `node --check` 0 erreur, ESLint
     0 nouvelle erreur, SR, **fonctionnel confirmé Saar** ("test validé").
   → **Non testé** : parcours navigateur réel (slider étendu, clamp visuel à la résolution).
   → **Incident git signalé, sans rapport avec le code** : session parallèle a committé (`4c258cc`,
     déjà poussé) la majorité des fichiers de ce chantier sous un message sans rapport — même
     pattern déjà documenté (suite 23, incident "Moding Phase A"), contenu vérifié intact.
   → **Prochain chantier : Groupe 4** (slot `logiciel`, 4 mécaniques à détailler individuellement).
   → Détail complet : `docs/PLAN_MODING_PHASEB.md` Groupe 2, `docs/JOURNAL6.md` "Session 141 (suite 30)".

**68. `docs/PLAN_MODING_PHASEB.md` Groupe 1 : bonus fixes optique + architecture des slots exclusifs ✅ CLOS — Session 141 (suite 28) (2026-07-12)**
   → Suite de `docs/PLAN_MODING.md` Phase A (item 63, terminée) — plan Phase B déjà entièrement
     rédigé et analysé en amont (architecture des slots + analyse critique validées Saar avant cette
     session de codage).
   → **Gap trouvé pendant la vérification finale ("sûr à 100%" demandé par Saar), corrigé avant
     code** : les 2 mods déjà installés en prod (Phase A) auraient eu `mod_slot = NULL` après
     l'`ALTER TABLE` sans backfill explicite — le garde-fou d'exclusivité ne les aurait jamais vus
     lors d'un swap futur. Migration corrigée pour backfiller `char_inventory_mods.mod_slot` en plus
     des 16 lignes catalogue. Vérifié aussi : apostrophes typographiques (`’` vs `'`) sur 4 des 16
     noms (inspection code point par code point), unicité globale des 16 noms, `ref_equipment.
     location` NULL confirmé (P57 — stacking légitime au retour en inventaire lors d'un swap).
   → **Incident de numérotation (P53)** : le numéro 140 pris entre-temps par une session parallèle
     (`140_ref_skill_requirements_or_group.js`) — ma migration renommée `141_ref_equipment_mod_slots.js`
     après coup, `knex_migrations` corrigé par UPDATE ciblé (même remédiation que l'incident P52,
     Session 134).
   → Migration `141` : `ref_equipment.mod_slot`/`mod_requires_aim` (16 lignes, 4 slots `optique`/
     `logiciel`/`canon`/`poignee`) + `char_inventory_mods.mod_slot` (snapshotté, backfillé) +
     `UNIQUE(weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL`. `modingService.js` : swap de slot
     dans `installMod` (retour en inventaire via nouvelle `returnModToInventory`, stacking P57) +
     nouvelle fonction pure `calcWeaponModBonus`. `socketCombatHelpers.js` (`resolveAssaultAction`,
     humanoïdes) : bonus branché dans `totalModComp` + breakdown nommant l'item précis. Aucun
     changement client — `MOD_INSTALLED` (déjà émis) déclenche déjà un refetch complet côté tous les
     clients connectés.
   → **Testé** : migration round-trip `down`/`up` byte-identique, 6 scénarios en base réelle (fixture
     jetable sur un personnage réel, nettoyage vérifié 0 résidu) — sans mod, 1 mod optique (+4 exact),
     swap vers un 2ᵉ mod optique (ancien revenu en inventaire), mod `logiciel` coexistant (jamais
     compté), swap vers la Lunette `mod_requires_aim=true` (0, jamais confondu avec un bonus plat),
     contrainte UNIQUE rejetant une insertion concurrente (`23505`). `node --check` 0 erreur, SR,
     **fonctionnel confirmé Saar** ("All tests OK").
   → **Non testé** : parcours navigateur réel (aucun changement client dans ce lot, rien de visuel à
     observer hormis le breakdown du jet de Test de tir).
   → **Prochain chantier : Groupe 2 (Lunette de visée)** — `docs/PLAN_MODING_PHASEB.md`, entièrement
     tranché, réutilise l'architecture de slots déjà livrée (aucun nouveau prérequis).
   → Détail complet : `docs/PLAN_MODING_PHASEB.md`, `docs/JOURNAL6.md` "Session 141 (suite 28)".

**62. Bonus féminin : règle fixe -2 FOR/+1 COO/+1 PRE + revalidation du bascule Sexe ✅ CLOS — Session 141 (suite 20) (2026-07-12)**
   → Demande Saar : la mécanique `feminin_bonus` (remise forfaitaire invisible sur les 2 premiers
     points investis en COO/PRE, Session 141 suite 14) n'est pas compréhensible. Simplification
     demandée : règle fixe, sans choix de répartition — Femme = FOR -2, COO +1, PRE +1.
   → **Antécédent relu avant tout code** : une 1ʳᵉ tentative de correctif direct sur COO/PRE (avant la
     remise forfaitaire) avait été abandonnée — elle plafonnait le spinner Mod.PC au quota, cassant
     l'achat PC normal au-delà du bonus. Vérifié que la répartition fixe demandée par Saar élimine
     cette source de complexité par construction (plus de choix joueur à arbitrer) — le nouveau
     correctif ne recrée aucun plafond de spinner, juste un décalage de base symétrique à FOR.
   → **Vrai bug trouvé en testant le plan (captures d'écran Saar)** : basculer Sexe M↔F après avoir
     déjà réparti des points changeait silencieusement le budget total sans jamais revalider l'état —
     `Step1Attributes.jsx` recalculait `pointsRestants`/`canNext` à la main, jamais via
     `validateStep1` (jusqu'ici appelé seulement côté serveur). Deuxième trouvaille en creusant
     `validateStep1` : G1 traitait "budget dépassé" et "budget non dépensé" comme un seul
     avertissement contournable — un dépassement n'était en réalité jamais rejeté, ni client ni
     serveur, ce qui aurait laissé passer un personnage sur-doté en Attributs via un simple appel API
     direct.
   → `shared/polarisUtils.js` : `getAttributeBase(attrId, isFeminin)` (FOR:5, COO:8, PRE:8, sinon 7)
     remplace `getFemininBonusDiscount`/`FEMININ_BONUS_MAX` (supprimés). `validateStep1` gagne **G1bis**
     (`totalCost > poolTotal` → erreur dure, distincte du simple solde non dépensé).
   → `Step1Attributes.jsx` : `validation = useMemo(() => validateStep1(...))` remplace le calcul
     maison — aligné sur le pattern déjà établi et éprouvé par `CareersAllocator.jsx`/Étape 4 (Lot 2,
     Session 139), pas un nouveau pattern inventé. `handleSetFeminin` redevenu trivial (plus de clamp
     spécial au bascule — toute invalidité est désormais détectée génériquement).
   → **Bug trouvé en testant ma propre correction (`node -e`)** : une valeur hors bornes (>20, possible
     juste après un bascule qui décale la base) fait sortir `COST_LOOKUP[valeur]` de la table (aucune
     entrée au-delà de 20) → `totalCost`/`pointsRestants` deviennent `NaN`, affichés littéralement
     dans le HUD. Corrigé (`—` affiché tant que `!validation.valide`).
   → `Step2Genotype.jsx` : angle mort fermé au passage (conséquence directe de la généralisation, pas
     une chasse au bug séparée) — son propre recalcul de base ignorait `femininBonusEnabled`.
   → **Testé** : `node --check`/ESLint 0 nouvelle erreur (`poolBase` non utilisé confirmé
     pré-existant via `git stash`), `creation.json` validé JSON, scénarios `node -e` (G1bis déclenché
     par recherche systématique, G3 déclenché sur 2 scénarios de bascule construits à la main).
     **Vérification en base réelle** (demande explicite Saar) : sur les 64 fiches non verrouillées
     existantes, aucune ne serait bloquée par le nouveau G1bis ; 0 personnage féminin en cours avec
     l'option active actuellement (test du nouveau plancher COO/PRE=8 vacuous faute de candidat, mais
     mécanisme validé synthétiquement par ailleurs). SR + **fonctionnel confirmé Saar**.
   → **Non testé** : parcours navigateur réel du bascule Sexe M↔F↔M après répartition (blocage dur +
     résolution par décrément) — validé uniquement par instrumentation directe et vérification en
     base, pas par un clic réel dans le Wizard.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 20)".

**57. `docs/PLAN_VAULT.md` — Coffre personnel (Vault) ✅ TERMINÉ — Étapes 0-7 (2026-07-10/11)**
   → Demande initiale Saar : stocker des personnages hors campagne pour les faire circuler entre
     parties sans les recréer. Recherche pro faite avant conception (Roll20 Character Vault,
     Foundry Compendium Packs) — décision "copie, jamais déplacement" directement inspirée de ces
     deux précédents. Relecture critique demandée deux fois par Saar avant tout code — un vrai trou
     trouvé à chaque passe (voir `docs/PLAN_VAULT.md` "Pièges à anticiper" P6/P7).
   → **Étape 0** : audit exhaustif des tables filles de `characters`/`char_sheet` (16 tables à
     cloner, 3 à exclure) — croisé avec une requête `information_schema` réelle, pas seulement
     lu à l'œil. **Étapes 1-2** : migrations `129_vaults.js`/`130_vault_transfer_requests.js`
     (invariant "un personnage a une campagne XOR un Coffre, jamais les deux" imposé par contrainte
     SQL réelle, motif reconnu "exclusive arc" — validé par recherche externe demandée par Saar).
   → **Étape 3** : `vaultService.js` — `COMPANION_REGISTRY` (extensible par type de personnage, PJ/
     PNJ partagent l'arbre `char_sheet`, drone son propre arbre) + garde-fou anti-dérive (compare la
     liste codée en dur à la réalité de `information_schema` à chaque clonage — toute future table
     liée à un personnage non enregistrée casse bruyamment au lieu de perdre une donnée en silence).
     Modification ciblée de `creationService.lockWizard` (paramètre `trxOpt` ajouté, rétrocompatible)
     — nécessaire pour que le clonage reste atomique en transaction.
   → **Étapes 4-6** : routes `/api/vault/*` + 1 route dans `char-sheet.js`. **Étape 7 (UI, 4 lots)** :
     carte "Coffre" en première position de la grille Dashboard (illustration fixe non modifiable,
     nom tranché avec Saar : "Coffre" plutôt que "Vault"/"Sas") ; page dédiée (liste/renommage/
     suppression) ; bouton d'envoi dans `CharacterWindow.jsx`/`DroneWindow.jsx` (texte pédagogique
     "copie, pas déplacement") ; sélecteur de campagne + badge "En attente" ; onglet "Joueurs" de
     `CampaignSettingsPage.jsx` enfin rempli (désactivé depuis Session 131, texte "Phase 3" confirmé
     sans rapport avec un autre projet via historique Git avant réutilisation).
   → **Bugs réels trouvés et corrigés avant tout impact utilisateur** : le garde-fou anti-dérive lui
     -même avait un angle mort (cherchait des colonnes nommées `character_id`, aurait raté
     `vault_transfer_requests.vault_character_id`) — corrigé pour chercher par vraie contrainte FK ;
     `characters.type` a 3 valeurs (`pj`/`pnj`/`drone`), pas 2 comme supposé une 1ʳᵉ fois — un
     forçage en dur aurait corrompu un drone cloné ; un personnage Wizard non finalisé ne peut pas
     être envoyé au Coffre (resterait bloqué sans mécanisme de reprise) ; un clone importé en
     campagne doit être explicitement "verrouillé" (`wizard_locked_at`), sans quoi il resterait
     invisible dans la liste des personnages sans aucune erreur.
   → **Testé à chaque étape** : scénarios en base réelle (transactions annulées) puis, pour l'Étape 7,
     par un vrai navigateur piloté (Playwright, JWT signé, cookie réel) — parcours complet
     clone-to-vault → liste → renommage → suppression → demande de transfert → approbation MJ,
     captures d'écran à l'appui. Nettoyage systématique vérifié après chaque test (aucune donnée
     réelle laissée en base). Activité concurrente réelle détectée en fin de test (brouillons créés
     en temps réel pendant les tests) — non touchée, seuls les artefacts de test identifiés avec
     certitude ont été supprimés.
   → **Dette ajoutée `[CSPLAYERSTAB]`** : avertissement React préexistant dans
     `CampaignSettingsPage.jsx` (mélange `background`/`backgroundColor` entre `s.navItem` et
     `s.navItemActive`) — présent sur les 4 onglets déjà actifs avant ce chantier, repéré seulement
     maintenant car l'onglet "Joueurs" était le seul désactivé. Cosmétique, non corrigé.
   → **Non testé** : bouton "Refuser" côté MJ pas recliqué séparément (symétrique à "Approuver",
     déjà testé côté service) ; parcours équivalent sur `DroneWindow.jsx` (code identique à
     `CharacterWindow.jsx`, vérifié par lecture + lint, pas par un clic réel) ; contenu non-personnage
     du Coffre (hors scope, prévu comme extension future).
   → Détail complet, étape par étape avec tous les tests : `docs/PLAN_VAULT.md`.

**55. PLAN_MUTATION2 Lot 1 — attributs primaires mutations ✅ CLOS — Session 141 (suite 13) (2026-07-10)**
   → Suite directe de "suite 10" (diagnostic + architecture, item ci-dessus) — conversation continue,
     pas une nouvelle session résumée. Note de numérotation : "suite 11"/"suite 12" déjà pris par deux
     sessions parallèles sans rapport (`PLAN_MODING.md`, Revers OPT-06, items "53."/"54.") au moment de
     refermer celle-ci — "suite 13" vérifié libre avant d'écrire.
   → **Décisions Saar avant codage** : AN/NA reste calculé dynamiquement des deux côtés (jamais
     stocké) — confirmé préservé, recherche faite (pattern "derived data" Foundry VTT, monorepo
     `shared/`) à sa demande explicite avant tout code. Aucun bricolage toléré : duplication de calcul
     (3 endroits) et convention PI4 (encombrement) sont de vrais gaps à corriger, pas des options
     équivalentes à une rustine — mémoire `feedback_no_hacks.md` renforcée après un premier brouillon
     fautif sur ce point précis.
   → Consolidation `calcNA`/`calcAN`/résolveurs de modificateur vers `shared/polarisUtils.js`
     (`charStats.js` importe, supprime ses 5 doublons) + PI4 réellement corrigé (5 sites, 2 manqués au
     premier passage, retrouvés en analyse à charge) + option de campagne `encumbrance_enabled`/
     `encumbrance_multiplier` (défauts `true`/`3`, comportement préservé) + ~20 sites serveur/client
     rebranchés (`char-sheet.js`, `socketEntity.js`, `socketCombatHelpers.js`,
     `socketCombatResolution.js`, `socketDice.js`, `CharacterSheet.jsx`, `CombatActionWindow.jsx`).
   → **4 bugs supplémentaires trouvés en testant avec Saar, tous corrigés dans le même chantier**
     (même cause profonde : mutations à sous-table jamais branchées de bout en bout) :
     1. Vue `char_mutation_effects_view` aveugle aux sous-types (`ref_mutation_subtypes` jamais
        jointe) — "Caractère génétique animal" (seule mutation `has_subtable`) retournait toujours 0.
        Migration `127_char_mutation_effects_view_subtypes.js`.
     2. Sélecteur de sous-type manquant côté Lot D (`AdvantagesPanel.jsx`, gap pré-existant de la
        session "suite 9") — ajout d'une étape de drill-down + `addMutation(sheetId, mutationId,
        subtypeId)` (upsert sur le bon index partiel, deux arbiters distincts).
     3. État client jamais rafraîchi après ajout/retrait (`onSaved` = simple ✓ visuel, ne recharge
        rien) — nouvelle route légère `GET /mutation-effects` + callback dédié `onMutationsChanged`.
     4. **Le plus sérieux** : `SUM()` Postgres sur colonne `integer` → `bigint` → retourné comme
        **chaîne JS** par `node-pg` (jamais casté) — `calcNA` concaténait au lieu d'additionner
        (`10+'2'` → `102` au lieu de `12`), cause exacte du "COO Niveau Actuel = 110" signalé par
        Saar. **Erreur de vérification reconnue** : la chaîne entre guillemets était visible dans mes
        propres tests plus tôt dans la session, pas identifiée comme un problème de type sur le
        moment. Migration `128_char_mutation_effects_view_int_cast.js` (cast `::integer` sur les 13
        colonnes). Piège Postgres trouvé en corrigeant : `CREATE OR REPLACE VIEW` refuse de changer
        le type d'une colonne existante (`DROP`+`CREATE` obligatoire). Audit du reste du code : un
        seul autre endroit à risque trouvé, déjà protégé correctement (`Number(...)`).
   → **Méthode** : chaque correctif vérifié par **instrumentation en base réelle** (connexion directe
     à la DB de dev, transactions systématiquement annulées — jamais de donnée réelle modifiée hors
     du flux normal de l'app), pas seulement déduit par lecture de code.
   → **Testé** : `node --check`/ESLint 0 nouvelle erreur (confirmé `git stash` à plusieurs reprises),
     `fr.json` valide, scénarios `node -e` (non-régression `calcAN`/`calcNA`/`calcEncumbrancePenalty`),
     vérifications instrumentées en base réelle (transactions annulées) pour chacun des 4 bugs,
     **SR + parcours navigateur confirmé fonctionnel par Saar** (Lot D sélection de sous-type félin,
     effet COO+2 visible immédiatement sans rechargement).
   → **Non testé** : effet en résolution de combat réelle (jet de compétence, vérifié seulement par
     scénarios `node -e`) ; bascule des options d'encombrement en navigateur ; aperçu Wizard ("peek")
     après fermeture/réouverture explicite (hypothèse même cause que bug 3, non confirmée par Saar) ;
     les 6 autres attributs primaires avec une mutation autre que "Caractère félin" ; retrait d'une
     mutation stackée en conditions réelles.
   → **Prochaine étape : Lot 2 (Attributs secondaires)**, à détailler ligne-à-ligne avec Saar.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 13)", `docs/PLAN_MUTATION2.md` section Lot 1.

**54. Options de campagne : `revers` (OPT-06) ✅ CLOS + mode développeur écarté ✅ CLOS + consolidation mini-stepper Avantages pro ✅ CLOS — Session 141 (suite 12) (2026-07-09/10)**
   → Note de numérotation : "suite 10" (`docs/PLAN_MUTATION2.md`) et "suite 11" (`docs/PLAN_MODING.md`,
     item 53 ci-dessous) étaient déjà pris par deux sessions parallèles sans rapport avec ce travail —
     repéré avant de commettre la collision, cette session prend "suite 12" (vérifié libre). Migration
     126 déjà réconciliée par la session "suite 11" (voir son entrée dans `docs/JOURNAL6.md`).
   → **Revers (OPT-06)** : table `docs/REGLES/REGLEREVERS.md` fournie par Saar (27 catégories 1D100,
     transcrites en base après relecture dans `docs/JOURNALTEMP.md` — un point ouvert, "Narco-
     dommages", confirmé erreur du livre de base par Saar sur l'exemplaire papier, exclu). Déclencheur
     = **total d'années cumulées toutes carrières confondues** (pas par métier, contrairement au
     Tirage 1D10) — confirmé par lecture de `REGLE_CREATION.txt:1190-1199`. Obligatoire, sans refus,
     narratif uniquement (même traitement que Force Polaris OPT-04). Migration `126_ref_setbacks_
     revers_table.js` (NOUVEAU, `ref_setbacks` restructurée en plages + `char_archetype.
     setback_rolls`), `shared/careerSetbacks.js` (NOUVEAU, fichier indépendant de `careerAdvantages.js`
     — analyse critique validée, mécaniques trop différentes pour fusionner), `SetbacksAllocator.jsx`
     (NOUVEAU, sous-step dédiée du mini-stepper Step4).
   → **Mode développeur demandé puis écarté** : Saar voulait un flag séparé (jamais dans les Options
     de campagne) pour accélérer les tests. Analyse serveur a révélé une incohérence pré-existante
     (Étape 1 bloquait un budget non dépensé côté serveur, Étape 4 jamais). Saar a proposé mieux : bouton
     "Suivant" toujours actif, avertissement au premier clic sur un solde non dépensé, confirmation au
     second — rend le mode développeur inutile. `shared/polarisUtils.js` (`validateStep1` sépare G1
     non-bloquant de G2/G3/G4), `Step1Attributes.jsx`/`CareersAllocator.jsx` (état dérivé, pas
     `useEffect`+`setState` — piège retrouvé et corrigé deux fois pendant la session).
   → **Consolidation Avantages pro** : Tirage 1D10 (Lot 6, déjà en prod) "invisible" dans l'onglet
     `CareersAllocator.jsx` selon Saar. Nouveau `ProAdvantagesAllocator.jsx` (sous-step dédiée,
     répartition manuelle + Tirage 1D10 fusionnés par métier — règle le risque de séquençage d'une
     conversion rétroactive de jet en points par construction, pas par un garde-fou). Onglet "avant"
     retiré intégralement de `CareersAllocator.jsx` (JSX + 8 actions reducer + imports).
   → **2 vrais bugs trouvés en run à vide** : signature d'avertissement ne couvrant pas `randomPicks`
     (avertissement obsolète après un jet) ; incohérence client/serveur sur le dépassement de budget
     (sur-dépensé traité comme un simple avertissement côté client alors que le serveur rejette
     toujours — corrigé en vrai blocage dur, cohérent avec le serveur).
   → **Dette `[WIZ-4]` ajoutée** (`CLAUDE.md`) : le mini-stepper ne revalide jamais les blocages durs
     de la sous-step quittée au clic direct — vérifié préexistant, pas une régression de cette
     session, filet de sécurité serveur toujours en place.
   → **Roadmap ouverte** (`[ADV1]`/`[ADV2]`/`[ADV3]`, `CLAUDE.md`) : Célébrité/Allié/Contact/Ennemi/
     Opposant, revenus cumulatifs par carrière, déblocage de compétence via tirage — non trackés
     mécaniquement nulle part, confirmé avec un vrai exemple en base (Cultivateur/Éleveur, migration
     108). **Décision Saar : chantier dédié à faire impérativement, planifié juste après celui-ci.**
   → **Testé** : couverture 1-100 vérifiée par script, `getSetbackBlockCount` testé aux bornes,
     `node --check`/ESLint 0 erreur introduite (sweep final sur tous les fichiers touchés), SR +
     double-clic avertissement confirmé Saar, mini-stepper Revers + board Avantages pro/tirages
     confirmés fonctionnels par Saar.
   → **Non testé** : scénario "conversion rétroactive" en conditions réelles navigateur (corrigé par
     construction — blocage dur — pas re-testé manuellement après coup) ; finalisation complète non
     confirmée scénario par scénario ("semble ok") ; persistance `char_archetype.setback_rolls`/
     `char_careers.pro_advantages`/`random_picks` non vérifiée directement en base.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 12)".
   → Prochaine migration disponible : **127** (126 consommée cette session).

**53. `docs/PLAN_MODING.md` — analyse critique + correction ✅ CLOS, chantier mis EN PAUSE — Session 141 (suite 11) (2026-07-09)**
   → Session analytique/planification pure — **aucun code écrit**. Plan rédigé Session 120
     (2026-06-24), jamais commencé depuis (vérifié : 0 migration, 0 service, 0 route, 0 trace
     `char_inventory_mods`).
   → **Corrections apportées au plan** : migration renumérotée (86 déjà pris par `trade_offers`) ;
     routes déplacées dans `char-sheet.js` (réutilise le guard ownership existant au lieu de le
     réimplémenter) ; référence `REGLEARMURE.md` retirée (mauvaise source — mécas, pas armes
     portatives, aucune règle de quota trouvée) ; socket `INVENTORY_*` requalifié obligatoire (pas
     optionnel) ; scope réduit à une **Phase A** (rangement pur, plan complet et corrigé, **prêt à
     coder**) — **Phase B** (effet mécanique combat) extraite séparément.
   → **Étape 0 ajoutée à la Phase A** (demande Saar) : extraction `inventoryService.js` depuis
     `char-sheet.js` (~1900 lignes) avant d'y ajouter le moding — portée exacte vérifiée ligne par
     ligne (6 routes + 4 helpers), `weapon-skill`/`sols`/drone explicitement exclus, dette
     `tradeService.js` (duplique déjà `char_inventory` sans socket) repérée mais non traitée.
   → **"On ne laisse rien au codage" (Saar) — 3 points fermés par lecture directe du code** : bug réel
     trouvé (DELETE inconditionnel du mod cassait si stack `quantity>1` — nouveau piège **P7**,
     corrigé via `inventoryService.removeItem`) ; mécanisme d'ouverture `ModingWindow` tranché
     (fenêtre flottante, pattern `TradeWindow.jsx`) ; rafraîchissement temps réel tracé jusqu'au
     fichier exact (`useCharacterSocket.js:36-44`, nouveau handler `onModInstalled`).
   → **Phase B découpée en 5 lots** après recherche dans `REGLESYSCOMBAT.md` + le code combat
     (`socketCombatHelpers.js:1340`) : seul **Lot B1** (bonus statiques Visée laser + exclusivité
     "Système de tir assisté") est sans dépendance manquante. **B2 (Lunette de visée) dépend de Tir
     visé — 0 référence trouvée dans tout `server/src/socket/*`**, nouvelle dette distincte de
     `COM9`("Localisation précise") et "Changer le mode de tir" (mécaniques voisines dans
     `REGLESYSCOMBAT.md`, vérifié différentes, pas la même règle). B3 (Analyseur tactique, état par combat), B4
     (Projecteur de mouvement, malus cible en mouvement inexistant), B5 (Mémoire de cibles/Système
     réactif autonome, hors sujet moding) également bloqués ou hors scope.
   → **Décision Saar : Tir visé jugé prioritaire, à planifier comme chantier à part entière avant de
     reprendre le moding** — `docs/PLAN_MODING.md` mis en pause dans son ensemble (pas seulement les
     lots dépendants). Aucun plan écrit pour Tir visé pour l'instant.
   → **Testé** : sans objet (aucun code touché). **Non testé** : sans objet.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 11)", `docs/PLAN_MODING.md`.

**52. AdvantagesPanel Lot D — mutations octroyées en jeu ✅ CLOS + PLAN_MUTATION2.md créé — Session 141 (suite 9) (2026-07-09)**
   → Périmètre confirmé avec Saar avant code (discussion directe, pas de questionnaire) : MJ
     uniquement (lecture seule pour le joueur), aucun coût PC (octroi narratif, pas un achat), pas
     de sélection de sous-type/tirage aléatoire (le MJ gère la nuance lui-même).
   → **Correction d'une erreur de ma propre analyse à charge du Lot C** : j'avais affirmé que les
     routes `/advantages` n'avaient aucun contrôle de propriété au-delà de `requireAuth` — faux,
     `router.param('characterId', ...)` (`char-sheet.js:54-76`) l'enforce déjà sur toutes les
     routes du fichier (pose `req.isGm`). Gate MJ du Lot D = une ligne, réutilise ce mécanisme
     existant (déjà utilisé 3 fois ailleurs dans le fichier).
   → Migration `125_char_mutations_source_campaign.js` (NOUVEAU, étend le CHECK `source` avec
     `'campaign'`) + `server/src/services/mutationService.js` (NOUVEAU — `getMutations`/
     `addMutation`/`removeMutation`, upsert stackable mirrors STEP3 `creationService.js` à
     l'identique, override `char_archetype.sex`/`is_fertile` si la mutation le prévoit, soft-delete
     `status='removed'`) + 3 routes `/char-sheet/:characterId/mutations` (GET public, POST/DELETE
     `req.isGm`) + `ref.js` (bug **MUT2** corrigé : `orderBy('muta_numero')` → `orderBy
     ('mutation_id')`) + `AdvantagesPanel.jsx` (`charMutations` fetch dédié `[characterId]`, 3ᵉ type
     `'mutation'` dans `combinedEntries`, badge "MUT", bouton "Mutations" grisé si `!isGm`,
     `handleAddMutation` réécrit vers `POST .../mutations`) + `CharacterSheet.jsx` (prop `isGm`
     descendue, 1 ligne).
   → **Testé** : `node --check`/ESLint 0 erreur (3 problèmes pré-existants `CharacterSheet.jsx`
     confirmés via `git stash`), migration vérifiée en base réelle (P53/P54), cycle complet réel
     `addMutation`→`getMutations`→`removeMutation` (mutation simple, mutation avec override sexe/
     fécondité — Asexué testé, mutation inconnue rejetée, soft-delete confirmé), MUT2 revérifié
     corrigé, SR + **fonctionnel confirmé Saar**.
   → **Limite trouvée par Saar en testant** : ajouter une mutation n'applique aucun effet mécanique.
     Vérification exhaustive (`grep` server+client) : `char_mutation_effects_view` jamais
     interrogée nulle part, `calcNA()` (`charStats.js`) n'a que 3 paramètres (aucune place pour un
     modificateur de mutation) — **gap pré-existant, vrai aussi pour le Wizard**, pas une
     régression du Lot D. Même diagnostic demandé et fait pour les Avantages : 74/76 lignes
     `ref_advantages` ont des colonnes `mod_*` déclarées mais jamais lues (seule exception : `adv_076`
     câblé en dur par ID, pas via lecture générique de `mod_identity`).
   → **`docs/PLAN_MUTATION2.md` créé** (diagnostic + 3 pistes non tranchées, aucun code) — Saar
     lance une session dédiée juste après celle-ci. Lot E (`[CS7]`) **transféré** dans ce document
     (décision Saar — même famille de problème). `docs/PLAN_ADVANTAGESPANEL.md` marqué chantier
     clos.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 9)".

**51. AdvantagesPanel Lot C — notes "Autres" ✅ CLOS — Session 141 (suite 9) (2026-07-09)**
   → Conception requise avant plan (signalé dans `PLAN_ADVANTAGESPANEL.md`) : discussion directe
     (pas de questionnaire structuré) sur pourquoi une nouvelle table plutôt que réutiliser le
     pattern texte libre d'avant migration 99. Tranché : le schéma V1 était souple (pas de FK
     catalogue) — la migration 99 a introduit un modèle strict pour de vrais avantages mécaniques,
     réintroduire "Autre" via une ligne catalogue générique contournerait ces garde-fous. Précédent
     déjà dans le projet : `char_mutations` séparée de `char_advantages` pour la même raison.
   → Analyse à charge demandée par Saar avant codage — 3 points vérifiés : `CharacterSheet` n'a pas
     de `key={characterId}` → ne remonte jamais au changement de personnage → `useEffect
     ([characterId])` réellement nécessaire pour les notes ; `Step5Advantages.jsx` (Wizard) n'a
     aucune notion de texte libre → confirme "Autre" 100% `CharacterSheet`, jamais le Wizard ;
     routes `/advantages` existantes sans contrôle de propriété au-delà de `requireAuth` — les
     nouvelles routes reproduisent cette absence pré-existante (hors scope, pas corrigé ici).
   → Migration `124_char_advantage_notes.js` (NOUVEAU, table dédiée, pas de soft-delete) +
     `advantageService.js` (3 fonctions) + `char-sheet.js` (3 routes `/advantage-notes`) +
     `AdvantagesPanel.jsx` (liste fusionnée `combinedEntries`, badge `AUT`, `handleAddOther`
     réécrit vers la nouvelle route au lieu de l'ancien `POST /advantages {type:'OTHER'}` qui
     échouait toujours). JSDoc du fichier corrigé (resté obsolète depuis Lots A/B).
   → **Testé** : `node --check`/ESLint 0 erreur, migration vérifiée en base réelle (P53/P54), 5
     scénarios `node -e` (validation + cycle complet add/get/remove, base nettoyée après test), SR
     + fonctionnel confirmé Saar.
   → **Bug MUT2 trouvé en testant, hors scope Lot C** : étape "Mutations" de la même modale (jamais
     touchée par Lot C) plante en 500 (`GET /char-ref/mutations` trie sur `muta_numero`, colonne
     inexistante). Analyse avant décision : même corrigé, `AdvantagesPanel.jsx` lit des champs
     inexistants (`mut.muta_numero`/`mut.nom`/`linked_skill_id`) et l'ajout échouerait quand même
     (400, `advantage_id` manquant) — patch isolé rejeté, **inscrit dans `docs/BUGIDENTIFIE.md`**
     ("Bug MUT2"), porte d'entrée du Lot D.
   → **Non testé** : affichage d'un désavantage réel dans la liste fusionnée (aucune ligne active
     trouvée en base) ; rejet serveur d'une note >255 caractères via appel API direct (contourne le
     `maxLength` navigateur) en conditions réelles.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 9)".

**50. Dé D4 face "4" mal orientée en jeu + roulis aléatoire des dés ✅ CLOS — Session 141 (suite 8) (2026-07-08)**
   → Découvert via l'outil de calibration `/dev/dice-calibration` étendu à tous les dés (demande
     Saar, suite item 47) : ordre N1-Nk instable pour les dés symétriques (D4/D6/D8/D20, tous les
     clusters ont le même nombre de triangles, rien ne les départageait) — corrigé par un tri
     secondaire déterministe (normale arrondie) dans `devFaceClusters.js`. Testé : rejoué avec
     2 ordres d'entrée différents → résultat identique aux 3 essais (avant, ça pouvait changer
     d'un rechargement à l'autre).
   → Investigation D8/D20 "cassé" dans l'outil (arête/pointe au lieu d'une face) : confirmé absent
     en jeu réel par Saar, clustering rejoué via le vrai `GLTFLoader` (identique, propre) — artefact
     de l'outil, pas un bug de calibration, non prioritaire (décision Saar de ne pas creuser plus).
   → **Vrai bug production trouvé** (pas juste l'outil) : la face "4" du D4 s'affichait mal orientée
     en vraie session — confirmé par une capture d'écran montrant "1,2,3" visibles sans "4" lisible.
     `getFaceRollCorrection(dieType, faceValue)` (`diceMath.js`, NOUVEAU) + application dans
     `DiceMeshGlb` (`DiceMesh.jsx`) — `setFromUnitVectors` seul ne garantit aucun contrôle du roulis,
     certaines faces ont besoin d'une inclinaison supplémentaire (trouvée via l'outil, confirmée en
     jeu par Saar). Scope volontairement limité à D4 face "4" (seule face signalée cassée).
   → **Demande Saar dans la foulée** : les dés semblaient toujours s'afficher avec le même roulis
     (orientation du chiffre à l'écran) pour un même résultat — `getRandomClockDeg(seed)` ajouté
     (PRNG seedé, jamais `Math.random()`), appliqué dans `DiceMeshGlb` sur toutes les faces sauf
     celles avec une correction manuelle (D4 "4", pour ne pas casser le fix qui vient d'être fait).
   → **Bug trouvé en testant ("aucun effet" signalé par Saar)** : pour un jet à un seul dé, `seed`
     (`server/src/lib/diceParser.js:65`, XOR d'un seul élément) **= la valeur du résultat elle-même**
     — deux jets tombant sur le même chiffre avaient donc toujours le même roulis. Fix : `timestamp`
     du jet (jusqu'ici jamais transmis, seulement utilisé pour la `key` React) propagé
     `DiceRoller.jsx` → `DiceMesh.jsx` → `DiceMeshGlb`, combiné à `seed` par XOR. Voir piège dédié
     dans `.claude/rules/dice.md`.
   → **Testé :** dérivation ordre stable (3 essais différents identiques), clustering D8 rejoué via
     le vrai `GLTFLoader` (identique à la lecture manuelle), maths de correction D4 vérifiées
     numériquement (vrai `three.js`), roulis aléatoire vérifié déterministe + variable par timestamp
     (même seed+timestamp → même angle, seeds/timestamps différents → angles différents), ESLint
     0 erreur introduite sur tous les fichiers touchés. **SR + D4 fonctionnel en jeu confirmé par
     Saar, roulis aléatoire fonctionnel en jeu confirmé par Saar.**
   → **Non testé :** confirmation visuelle des 6 autres dés (D6/D8/D10/D100/D12/D20) avec le nouveau
     roulis aléatoire ; comportement du roulis D4 "4" à un angle de caméra très différent du défaut
     (limite assumée, documentée).
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 8)", `docs/PLAN_DICEREWORK3.md`.

**49. AdvantagesPanel Lot B — affichage de la liste ✅ CLOS — Session 141 (suite 7) (2026-07-08)**
   → Tâche séparée du Lot A (règle "un seul bug à la fois"). Plan Lot B écrit à gros grain dans
     `PLAN_ADVANTAGESPANEL.md` (3 puces) — plan ligne-à-ligne construit en relisant
     `AdvantagesPanel.jsx` avant code. Confirmé avant codage contre une fiche réelle (`adv_002`
     "Ambidextre") : l'ancien code affichait badge "ATR" + **nom vide** (`adv.label` toujours
     `undefined` en V2).
   → `AdvantagesPanel.jsx` (bloc liste) : `adv.type === 'MUTATION'` → `adv.type === 'advantage'`
     (vs `'disadvantage'`) ; `adv.mutation_nom || adv.muta_numero` / `adv.label` → `adv.name` (seul
     champ réel) ; bloc `level` supprimé (mort, `adv.level` inexistant en V2). Styles renommés
     (`badgeMut`→`badgeAdvantage`, `badgeAtr`→`badgeDisadvantage`, même rendu visuel) + `s.level`
     supprimé. `fr.json` : `badgeMut`("MUT")/`badgeAttr`("ATR") → `badgeAdvantage`("AVA")/
     `badgeDisadvantage`("DÉS"). `en.json` non touché (déjà invalide, dette `[JSON1]`).
   → **Testé** : ESLint 0 erreur, `fr.json` valide, sortie réelle de `getAdvantages()` revérifiée
     (badge "AVA" + nom "Ambidextre" affichés correctement après fix), SR + fonctionnel confirmé Saar.
   → **Non testé** : affichage d'un désavantage réel (`type:'disadvantage'`) — aucune ligne active
     trouvée en base au moment du test, badge "DÉS" vérifié par lecture du code uniquement.
   → **Plan pas fini** : Lot C ("Autres" texte libre) et Lot D ("Mutations" en jeu, aucune route
     n'existe pour un personnage verrouillé) restent à planifier en détail, chacun sa session. Lot E
     (`[CS7]`) reste backlog.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 7)".

**48. AdvantagesPanel Lot A — Force Polaris (OPT-04) ✅ CLOS — Session 141 (suite 6) (2026-07-08)**
   → Reprise en session neuve depuis `docs/PLAN_ADVANTAGESPANEL.md` (Lot A déjà détaillé
     ligne-à-ligne par une session précédente, pas encore codé). Root cause confirmée par le plan :
     `AdvantagesPanel.jsx` n'a jamais été mis à jour après la migration `99_char_advantages_v2.js`
     (gate "Force Polaris" `hasMuta029` toujours faux en pratique).
   → **Écart trouvé avant codage, tranché avec Saar** : `docs/OPTIONS_CAMPAGNE.md` (OPT-04) mentionne
     une limite "1 seul Polaris latent/non maîtrisé par groupe" (campagne) que le plan Lot A
     n'implémentait pas (seulement `family_limit:1`, exclusion par personnage). Décision Saar : hors
     scope, géré manuellement par le MJ.
   → Migration `123_ref_advantages_polaris.js` (NOUVEAU) : 3 lignes `ref_advantages` (`adv_077`
     "Polaris latent" 3 PC, `adv_078` "Polaris non maîtrisé" 3 PC, `adv_079` "Force Polaris" 5 PC),
     `family:'Polaris'`/`family_limit:1` identique sur les 3, tous `mod_*` à `null` (narratif/MJ,
     house-rule assumé par Saar). `creationService.js` (`getStep5RefData(campaignId)` filtre
     077/078 si `settings.polaris_latent` OFF) + `routes/creation.js` + `advantageConstraints.js`
     (contrainte `polaris_option_enabled`, ciblée par ID pour ne jamais bloquer `adv_079`) +
     `advantageService.js` (résout `campaignId` par jointure `char_sheet→characters`, jamais fait
     jusqu'ici avec seulement `sheetId`) + `AdvantagesPanel.jsx` (`hasMuta029`→`hasForcePolaris` sur
     `adv_079`) + `fr.json` (libellés sans référence `muta_029`).
   → **Testé :** `node --check` (5 fichiers serveur) 0 erreur, ESLint client 0 erreur, migration 123
     vérifiée en base réelle (auto-appliquée par nodemon, P53/P54 respectés), `getStep5RefData`
     vérifié contre une campagne réelle, 5 scénarios `node -e` sur `validateAdvantage` (option
     ON/OFF, `adv_079` jamais gaté, exclusion `family_limit` toujours active, fail-closed si
     paramètre omis), **SR + parcours navigateur confirmé fonctionnel par Saar**.
   → **Non testé :** achat effectif de `adv_079` puis déblocage visuel du bouton "Force Polaris" en
     conditions réelles détaillé scénario par scénario (validation donnée globalement) ; dépendance
     PC 077/078→079 (`char_pc_ledger.pc_postcreation` jamais crédité) reste non résolue, hors scope.
   → **Prochaine étape : Lot B** (affichage liste, tâche séparée) — voir plan, à planifier en détail.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 6)".
   → Prochaine migration disponible : **124** (123 consommée cette session).

**47. Correction animation 3D dé D100 (percentile) + D10 ✅ CLOS — Session 141 (suite 5) (2026-07-08)**
   → Signalement Saar (hors chantier en cours) : faces non alignées, résultat serveur ≠ affiché
     ("30+7" pour un roll serveur de 1), dé des unités visuellement cassé. Diagnostic [VÉRIFIÉ] par
     instrumentation réelle (`tools/inspect-glb.js` sur les `.glb` commités) : les tables
     `D10_FACE_GLB`/`D10U_FACE_GLB`/`D10T_FACE_GLB` (`diceMath.js`) ne correspondaient à aucune face
     réelle, jamais recalculées correctement depuis leur introduction Session 65.
   → Recherche pro demandée par Saar (`byWulf/threejs-dice`, `Dice So Nice!`) : confirme le pipeline
     de rendu existant (normale → orientation caméra) déjà standard industrie ; piste "réactiver le
     D10 procédural" explicitement écartée par Saar (dés procéduraux médiocres, D20 procédural
     impossible à texturer proprement — raison probable du passage aux `.glb` Session 65).
   → `D10_FACE_GLB`/`D10U_FACE_GLB` (dupliquées à la main pour le même fichier `D10.glb`, relevé par
     Saar) fusionnées en `D10_GLB_NORMALS` unique, `d10_units` dérivée automatiquement. `D10T_FACE_GLB`
     (D100.glb, fichier distinct) recalibrée indépendamment. Harnais de calibration temporaire
     `/dev/dice-calibration` (composant autonome, retiré après usage) — Saar a lu les 20 valeurs
     réelles en direct sur les vrais modèles. Code mort D10 procédural supprimé (`DiceMesh.jsx`,
     `diceMath.js`).
   → **Testé :** dérivation référence stricte + bijection 0-9 vérifiées, ESLint 0 erreur introduite
     (2 warnings préexistants confirmés), **SR + jet D100 réel en session confirmé fonctionnel par
     Saar**. **Non testé :** scénarios limites un par un (00/100), retrait de dé en cours d'animation.
   → **Addendum demandé par Saar une fois le bug corrigé** : l'outil de calibration rendu
     **permanent** (`/dev/dice-calibration` reste, pas retiré) et **généralisé aux 7 dieType** —
     `client/src/lib/devFaceClusters.js` (k-means calculé à la volée depuis la géométrie chargée,
     zéro vecteur transcrit à la main) + `getClosestFaceValue()` (`diceMath.js`, affiche "le code
     prévoit : X" à côté de chaque face). Limite connue non bloquante : arête/pointe parfois affichée
     sur D8/D20 dans l'outil, **confirmée absente en jeu réel** par Saar (artefact outil, pas un bug
     — investigué en profondeur via le vrai `GLTFLoader`, décision de ne pas creuser plus loin).
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 5)", `docs/PLAN_DICEREWORK3.md`.

**46. Wizard Step 4 — Formation "Autodidacte" (7 points libres) ✅ CLOS — Session 141 (suite 3) (2026-07-08)**
   → Hors chantier "Options de campagne" (item 41) — mécanique de base LdB toujours active, pas un
     toggle campagne. Signalement Saar : "Autodidacte" affichait un texte informatif ("7 points
     libres...") sans aucune UI de répartition ni application de bonus — confirmé par lecture
     (`ref_background_skills` ne contient aucune ligne pour ce background ; le commentaire de la
     migration `98_ref_backgrounds.js` l'annonçait déjà : "gérés côté UI", jamais fait).
   → Réflexion préalable en plusieurs tours (clarifications + analyse à charge demandée par Saar
     avant tout code) : budget ≤7 points/+2 max par compétence (sous-consommation autorisée),
     compétences éligibles restreintes explicitement par Saar à **hors `(X)` réservées ET hors
     compétences à prérequis `SKILL_MIN`** (†, `ref_skill_requirements`) — exclusion plus stricte
     que la lettre de la règle (`REGLE_CREATION.txt:1026-1033`, qui autorise les `(X)` sous
     validation MJ jamais outillée dans le Wizard). Vérifié en base avant de concevoir l'UI : 29
     compétences éligibles sur 232 (10 familles) — liste plate groupée par famille retenue plutôt
     qu'un accordéon (volume trop faible pour le justifier).
   → `shared/autodidacte.js` (NOUVEAU) : règle pure (`isAutodidacteEligible`/
     `getAutodidacteEligibleIds`/`validateAutodidacteAllocations`), importée à l'identique côté
     client et serveur — zéro duplication de la règle d'éligibilité. `AutodidacteAllocator.jsx`
     (NOUVEAU) : widget de répartition monté dans `BackgroundSelector` (sous-étape Formation), zéro
     nouvelle classe CSS (réutilise `.wiz4-*` du board Avantages pro, Lot 4). `creationService.js` :
     `resolveAutodidacteSkills` réutilise tel quel le pipeline existant des bonus d'origine
     (`bgSkillsToApply`/`upsertSkillBonus`/`baseMastery`) — aucune modification de
     `shared/careerSkills.js` (P55) nécessaire.
   → **Analyse à charge demandée par Saar avant codage — 1 vrai bug trouvé et corrigé** :
     `handleSelectTraining`/`handleSelectGeoOrigin`/`handleSelectSocialOrigin` (`Step4Experience.jsx`)
     réinitialisaient l'état en cascade sur **tout** clic de carte, y compris un re-clic sur la carte
     déjà sélectionnée — un joueur ayant réparti ses 7 points pouvait les perdre sur un simple
     re-clic accidentel. Fix : garde `if (code === valeur actuelle) return` ajoutée aux 3 handlers
     (corrige au passage le même défaut préexistant sur `higherEd`/`conditionalChoices`, effet de
     bord positif). 2 correctifs mineurs additionnels : validation serveur tolérante aux entrées à 0
     point (ignorées plutôt que rejetées, évite un blocage dur pour un artefact bénin) ; garde de
     chargement dans `AutodidacteAllocator` si `refSkills` pas encore résolu.
   → **Testé** : `node --check` (shared + serveur) 0 erreur, ESLint client 0 erreur introduite (1
     erreur préexistante `Step4Experience.jsx:89` `remainingPC` confirmée via `git stash`), SR +
     **parcours navigateur confirmé fonctionnel par Saar**.
   → **Non testé** : les 6 scénarios détaillés un par un (validation donnée globalement "Test OK") ;
     re-clic accidentel sur la carte Autodidacte déjà sélectionnée (fix du bug trouvé en analyse à
     charge) en conditions réelles navigateur ; vérification directe `char_skills.mastery` en base
     post-`reconcileCreation` réel.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 3)".

**44. Redesign Step 4 Profession (rework multi-lots) — ✅ TERMINÉ (8/8 lots) — Session 139/140**
   → Plan maître (archivé) : `docs/Old/PLAN_REWORKFINAL.md` (8 lots). Design source : `docs/ClaudeDesign/project/Professions.dc.html`.
   → **Lot 0 ✅ CLOS** : `shared/careerEligibility.js` (évaluateur pur, raisons structurées) +
     `creationService.js` (4 validateurs `validateCareer*` → 1 `checkCareerEligibility`, parité stricte
     `reasons[0]`). Testé : parité 12/12 (node -e), SR + fonctionnel confirmé Saar.
   → **Lot 1 ✅ CLOS** : `shared/careerSkills.js` (`computeSkillAllocation`, réutilise
     `calcSkillCost`/`getMaxMasteryByYears` de polarisUtils — code mort jusqu'ici, 1er consommateur) +
     `education` dans `getStep4RefData`. Correction de modèle trouvée en lisant `REGLE_CREATION.txt:
     1103-1128,1250-1263` avant de coder : plafond compétence professionnelle = table par années
     cumulées (+2 études) ; plafond compétence d'origine non-pro = **fixe +5** (pas
     `getMaxMasteryByYears(0)=3` comme écrit initialement au plan). Invisible (ni payload ni UI).
     Testé : `node --check`, tests unitaires isolés (node -e), `getStep4RefData` vérifié en base
     réelle (12/12 lignes `ref_career_education`), SR + confirmé Saar.
   → **Lot 2 ✅ CLOS** : `CareersAllocator.jsx` réécrit (rail/agebar/detail/board GLOBAL/foot,
     `useReducer`, CSS `.wiz4-*`), payload `skillAllocations` per-career → top-level global,
     `reconcileCreation` STEP4 valide désormais le budget (Q2) via `computeSkillAllocation`. **2 bugs
     `-Infinity` trouvés et corrigés** (compétences réservées `(X)` avec bonus d'origine, puis
     compétences `(X)` professionnelles sans bonus d'origine — règle `REGLE_CREATION.txt:1129-1132`
     découverte en cours de route : une `(X)` est accessible dès qu'une carrière retenue la liste).
     Détail complet : `docs/JOURNAL6.md` "Lot 2". Testé : SR + fonctionnel confirmé Saar (filtres,
     sélection, board avec compétences `(X)` pro/non-pro, plafonds 5/10/13 conformes).
   → **Lot 3 ✅ CLOS** : onglet Carrière & économies (lecture seule) — table `.wiz4-prog`
     (titres/salaires triés, ligne courante surlignée) + encadré `.wiz4-ecobox` (économies pour la
     durée engagée) + tuile agebar « Économies de départ » (placeholder `—` remplacé). Reproduit
     exactement la formule serveur (`salaire du titre courant × années`, déjà persistée par
     `reconcileCreation`) — aucune migration, aucun changement serveur. `estimateSalaryFormula()`
     (nouveau, `shared/polarisUtils.js`) : estimation moyenne déterministe pour les salaires à formule
     aléatoire (jamais de `Math.random` en lecture seule), marquée `*`. Vérification base réelle
     (scénario Saar : 3 ans Chasseur de primes + 2 ans Cultivateur/Éleveur = 3500 sols, conforme).
     **Bugfix associé** : filtre carrières par défaut `'all'` → `'eligible'` (dette [CAR-DEF] repérée
     lors des tests Lot 2, signalée par Saar). Détail complet : `docs/JOURNAL6.md` "Lot 3".
     Testé : `node --check`/ESLint 0 erreur, `estimateSalaryFormula` isolé, non-régression
     `evaluateSalaryFormula`, SR + fonctionnel confirmé Saar. Non testé : les 8 scénarios détaillés un
     par un (validation globale « ook »), confirmation visuelle navigateur du bugfix filtre.
   → **Migration 120 (fix, hors lots)** : `ref_career_point_categories` manquantes sur 4 carrières Lot 1
     (`artisan_artiste`, `assassin`, `barman`, `contrebandier`) — trouvé en lisant avant de planifier
     le Lot 4 (même angle mort que la migration 106, jamais corrigé pour cette table). Vérification
     exhaustive des 30 sections restantes de `REGLE_PROFESSION.md` demandée par Saar : 30/30 conformes,
     bug isolé aux 4 carrières identifiées. `chasseur_primes` (5ᵉ carrière du lot) a 0 ligne
     légitimement (absent de la LdB p.156). Détail : `docs/JOURNAL6.md` "Migration 120".
   → **Lot 4 ✅ CLOS** : Avantages pro (5 pts/an **par métier**, `REGLE_CREATION.txt:1151-1159`) —
     `shared/careerAdvantages.js` (`computeProAdvantageAllocation`, pattern `careerSkills.js`) +
     validation serveur Q3 (`reconcileCreation`) + onglet "Avantages pro" (steppers, réutilise les
     classes CSS du board compétences, zéro nouvelle classe) + gating "Suivant" étendu. **Cas limite
     trouvé en relecture avant livraison** : métier à 0 catégorie (`chasseur_primes`) bloquait
     indéfiniment sans le fix `budget=0` si aucune catégorie. Détail complet : `docs/JOURNAL6.md`
     "Lot 4". Testé : 6 scénarios unitaires isolés, `getStep4RefData` vérifié en base réelle, ESLint/
     `node --check` 0 erreur (1 erreur pré-existante non liée), SR + fonctionnel confirmé Saar.
   → **Lot 5 ✅ CLOS** : Compétences « au choix » (`PLAN_REWORKFINAL §7`). Migration
     `121_ref_career_skills_choice_groups.js` (colonne `choice_group` + 24 lignes T3 réécrites en vrais
     enfants `ref_skills.parent`, groupées par `choice_group` scopé `career_id` + 4 doublons inertes
     supprimés Diplomate/Espion + 4 lignes Soldat d'élite flag corrigé `conditional=false`). **Avant
     tout code (demande Saar « sûr à 100% »)** : re-vérification directe de `REGLE_PROFESSION.md` (pas
     seulement du plan déjà écrit) sur les cas les plus ambigus + requêtes SQL réelles (44 lignes,
     `is_category`/`parent`, absence de collision) — 0 écart trouvé, tout confirmé avant codage.
     `shared/careerSkills.js` : nouvelle `validateChoiceGroups` (exclusivité par groupe). Payload
     `openedSkills` (déjà câblé serveur/moteur de coût depuis le Lot 2, jamais envoyé par le client
     avant ce lot) désormais rempli par `Step4Experience.jsx`. `CareersAllocator.jsx` : reducer étendu
     (2 nouvelles actions + purge au retrait de carrière), nouveau bloc UI "Compétences au choix"
     (checkbox T1 solo / radio T3 exclusif), verrouillé tant que le métier n'est pas retenu. **Gap
     trouvé en relecture avant livraison** : `provenanceFor` (tag de provenance du board) ne couvrait
     pas les compétences "au choix" ouvertes — corrigé. Détail complet : `docs/JOURNAL6.md` "Lot 5".
     Testé : migration round-trip `down`/`up` byte-identique en base réelle, `validateChoiceGroups`
     (6 scénarios `node -e`), `node --check`/ESLint 0 erreur introduite, SR, fonctionnel confirmé Saar
     ("All ok"). Non testé : vérification directe `char_skills.is_learned` en base post-finalisation.
   → **Nettoyage UI associé** : icône hexagonale du rail carrières retirée (`.wiz4-hex` + style inline
     `--hex`), colonne rail réduite `296px`→`246px`. `careerHexColor()` conservé (tags de provenance).
   → **Lot 6 ✅ CLOS — Session 140** : Tirage 1D10 (`PLAN_REWORKFINAL §8`). Migration
     `122_ref_career_random_benefits_lot1_and_points_alt.js` (colonne `points_alt` + backfill 37
     lignes `roll=10` + 50 lignes manquantes Lot 1). `shared/careerAdvantages.js`
     (`computeRandomBudgetDelta`, nouveau) + `creationService.js` (validation `randomPicks` + Q3
     étendu) + `WizardCreation.jsx` (`SocketProvider` monté pour la première fois dans le Wizard) +
     `CareersAllocator.jsx` (bloc UI + overlay `DiceRoller` réel, jamais `Math.random`). **Enquête
     Chasseur de primes** (demandée par Saar) : un extrait qu'il pensait être sa page LdB s'est avéré
     être un artefact de mise en page dupliquant Mercenaire — confirmé, 0 catégorie reste légitime
     pour ce métier ; le Lot 6 dissocie quand même "jet disponible" de "conversion en points" pour
     respecter sa table de tirage imprimée sans budget automatique. **Bug trouvé après 1er test
     navigateur** (Saar a soupçonné une mauvaise réutilisation du système de dés — à raison) :
     `DICE_RESULT` n'inclut jamais `dieType` server-side, tout jet hors `SessionPage` retombait sur un
     D6 — voir **P56**. **Bonus même session** : `Step3Mutations.jsx` "Lancer 1D20" converti en jet
     réel (même mécanique), `DiceLights.jsx` extrait en composant partagé. Détail complet :
     `docs/JOURNAL6.md` "Session 140". Testé : migration round-trip byte-identique, 8 scénarios
     unitaires `computeRandomBudgetDelta`, ESLint 0 erreur introduite, SR + fonctionnel confirmé Saar
     (Lot 6 après fix + D20 Step3). Non testé : les 4 rejets serveur en conditions réelles,
     `char_careers.random_picks` vérifié en base post-`reconcileCreation` réel.
   → **Chantier Redesign Step 4 Profession terminé (8/8 lots). Plan archivé : `docs/Old/PLAN_REWORKFINAL.md`.**
     Lots 7/8 (relations `char_relations` + panneau fiche perso / matériel inventaire) jamais cadrés
     en détail (`PLAN_REWORKFINAL §9-10`) —
     à reprendre comme chantier séparé si prioritaire. Prochaine migration disponible : **123**
     (122 consommée Session 140).

**45. Wizard Step1 — Description physique + Main directrice (2D10) ✅ CLOS — Session 139 suite 5 (2026-07-08)**
   → Hors chantier Redesign Step4. Ajout au Wizard des champs de la fiche perso (taille/poids/peau/
     corpulence/yeux/cheveux/signes particuliers) + Main directrice avec bouton "Définir" (tirage 2D10
     client, pattern identique au tirage aléatoire `Step3Mutations.jsx`). Schéma DB déjà complet
     (`char_identity`, migration 36) — **aucune migration**. `reconcileCreation` STEP1 étendu (insert/
     merge `char_identity`), champs optionnels/non bloquants (règle LdB confirmée narrative, pas
     mécanique — seule la Main directrice a un vrai tirage).
   → **Bug préexistant découvert (non corrigé, voir dette HP1)** : `hand_pref` est lu depuis `char_sheet`
     (colonne inexistante) au lieu de `char_identity` dans `socketCombatHelpers.js` et `char-sheet.js`
     (route inventaire) — la mécanique Main directrice retombe toujours sur `'R'` en combat.
   → Détail complet : `docs/JOURNAL6.md` "Session 139 (suite 5)".
   → **Testé** : `JSON.parse`/`node --check`/ESLint 0 erreur introduite, SR + fonctionnel confirmé Saar.
   → **Non testé** : scénarios détaillés un par un, vérification base réelle post-`reconcileCreation`.

**43. Fiche personnage consultable en permanence pendant le Wizard (fenêtre "peek") ✅ CLOS — Session 139 (2026-07-07)**
   → Plan complet rédigé en amont : `docs/STE6_FINAL.md`. `CharacterWindow.jsx` réutilisé inchangé
     (prop `forceReadOnly`) — zéro nouveau composant d'affichage. `finalizeCreation` →
     `reconcileCreation` (pattern reconciliation, payload partiel autorisé, rejouable — reset
     `is_fertile`/`char_skills`/`char_careers`/`char_advantages`+ledger avant réapplication) +
     `lockWizard` + `getCharacterPreview`. Migration 119 (`char_sheet.wizard_locked_at`) — sépare
     propriété "assistant" (rejouable) de propriété "runtime" (fiche éditable post-verrouillage).
     `routes/characters.js` : filtre liste gate désormais sur `wizard_locked_at` (au lieu de
     `creation_state`) pour ne jamais exposer un brouillon en cours au reste de la campagne.
   → Détail complet (déviations trouvées en codant vs le plan écrit, notamment l'appel
     `setCharacters` du store omis car inutile et risqué) : `docs/JOURNAL6.md` "Session 139".
   → **Testé** : `node --check`/ESLint 0 erreur, round-trip migration 119, SR + parcours fonctionnel
     confirmé par Saar.
   → **Non testé** : les 8 scénarios détaillés un par un de `docs/STE6_FINAL.md` §15 (validation
     donnée sur "SR et fonctionnel" globalement).
   → Prochaine migration disponible : **120** (119 consommée cette session).

**0. ~~MIGRATION 37-BIS (ref_skills) — migration 105~~** ✅ CLOS — Session 133 (2026-07-05). Détail complet : `docs/Old/JOURNAL5.md` "Session 133", `docs/Old/MIGRATION_37BIS.md`.

**1. ~~Lot 1 carrières — migration 106~~** ✅ CLOS — Session 134 (2026-07-05). 9 corrections `ref_career_skills` (voir `docs/Old/PLAN_LOT1_CAREERS.md` + `docs/JOURNAL6.md` "Session 134"). Round-trip `up`/`down`/`up` testé byte-identique + validation fonctionnelle navigateur confirmée par Saar (wizard Step4, 5 carrières).

**2. ~~Lots 2-6 carrières (32 carrières)~~ ✅ CLOS — Session 134 suite (2026-07-05)**
   → Migrations 108 (lot2) + 112-116 (lots 3-6) : 32 carrières + illustrations incluses directement. Détail complet : `docs/Old/PLAN_LOTS_3_6_CAREERS.md`, `docs/JOURNAL6.md` "Session 134 suite".
   → **Effet de bord majeur** : `ref_career_skills.skill_id` n'avait aucune FK vers `ref_skills.id` (PIÈGE 1) et `skill_group` était un texte libre jamais aligné avec `ref_skills.family` (bug de fragmentation UI trouvé en cours de route). Corrigé en profondeur — voir item "2bis" ci-dessous.
   → 2 bugs `required_genotype` trouvés et corrigés (valeurs inventées ne correspondant à aucun `ref_genotypes.id`) : `hybride_trident` → `GEN_HYB`, `techno_hybride` → `TEC_HYB`.
   → Prérequis (espion + autres, cf. PIÈGE 7 `JOURNALCOUCHE4.md`) : **non traité**, reste à faire (voir dette ci-dessous).
   → **Testé** : 37/37 carrières en base, 0 orphelin FK, 0 carrière sans illustration, round-trip `up`/`down`/`up` par migration, wizard Step4 confirmé fonctionnel par Saar (toutes carrières + génotypes).
   → **Non testé** : —

**2bis. ~~FK ref_career_skills.skill_id + suppression skill_group~~ ✅ CLOS — Session 134 suite (2026-07-05)**
   → Migration 111 : `ALTER TABLE` ajoute `FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT` + `DROP COLUMN skill_group`. Détail : `docs/Old/PLAN_CAREER_SKILLS_FK.md`.
   → Backend `creationService.js:133` (`getStep4RefData`) : JOIN `ref_skills` pour récupérer `family` (remplace le texte libre).
   → Frontend `CareersAllocator.jsx:44-46` : regroupement par `sk.family` au lieu de `sk.skill_group`.
   → **Dette identique non traitée** : `ref_background_skills.skill_id` a le même défaut (pas de FK) — table différente, hors scope (`98_ref_backgrounds.js:49`).
   → **Testé** : FK active (insert invalide rejeté, code Postgres `23503`), round-trip `up`/`down`/`up`, wizard Step4 confirmé fonctionnel (regroupement par famille correct).
   → **Non testé** : —

**3. ~~Wizard Step3 Mutations — mutations réelles (`ref_mutations`) au lieu du mock~~ ✅ CLOS — Session 136 (2026-07-05)**
   → ~~[[docs/PLAN_MUTATION|PLAN_MUTATION]]~~ ✅ CLOS — Session 135 (2026-07-05). Migration `109_mutation_stacking.js`
     (`stack_deltas` JSONB + réécriture `char_mutation_effects_view`) + upsert `count` dans
     `creationService.js:245-269` (`ON CONFLICT` sur l'index partiel `uq_char_mut_no_sub`). Testé (3
     scénarios formule + upsert anti-doublon, transactions Postgres annulées). Détail complet + incident
     lié au bug d'encodage `ref_mutations` (migration `108_fix_ref_mutations_encoding.js`, découvert et
     corrigé en aparté) : `docs/JOURNAL6.md` "Session 135". Plan archivé : `docs/Old/PLAN_MUTATION.md`.
   → ~~[[docs/PLAN_STEP4|PLAN_STEP4]]~~ ✅ CLOS — Session 136 (2026-07-05). Migration 117
     (`ref_mutation_subtypes.description`) + backend (`getStep3RefData`, route `/step3/ref`,
     `randomMutationsEnabled`) + réécriture complète `Step3Mutations.jsx` (achat + tirage aléatoire
     réel D100, variantes libellées vs rulebook, relance D100 sur doublon `is_unique`) +
     `mutationsMeta` pour `WizardReview.jsx` (plus d'accès i18n/DB). Correctif UX post-fonctionnel :
     halo de confirmation au clic (`.wiz3-card-flash`, `index.css`). Détail complet :
     `docs/JOURNAL6.md` "Session 136". Plan archivé : `docs/Old/PLAN_STEP4.md`.
   → **Testé** : SR + fonctionnel confirmé par Saar (parcours Step3), halo de confirmation confirmé
     fonctionnel. Lint/syntaxe validés sur tous les fichiers touchés.
   → **Non testé** : round-trip migration 117, achat stackable 2× et tirage D20/D100 en conditions
     réelles navigateur, toggle `random_mutations`.
   → Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) : à traiter dans une migration dédiée, cf. PIÈGE 7 `JOURNALCOUCHE4.md`.

**42. Fix `cost_pc` « Organe sensoriel manquant » (migration 118) + présentation cartes Step3 ✅ CLOS — Session 138 (2026-07-06)**
   → Signalement Saar (capture rulebook) : gain de PC faux pour "Organe sensoriel manquant" dans Step3. Vérification exhaustive des 45 lignes `ref_mutations` vs `docs/Character/Creation/REGLE_CREATION.txt:812-898` demandée par Saar avant tout plan (44/45 correctes).
   → Migration 118 : `cost_pc` corrigé sur 4 sous-types (smell/touch 0→1, hearing 1→2, sight 2→3 ; taste inchangé). Round-trip `down`/`up` byte-identique testé via appel direct des fonctions du module.
   → `Step3Mutations.jsx` : titre de carte tronqué (`overflow`/`ellipsis`/`nowrap`) → variante déplacée sur sa propre ligne (`st.cardVariant`, pattern repris de `st.rollSubtype`), troncature retirée de `st.cardName`. Bénéficie aussi à la vue "tirage aléatoire" (même style réutilisé).
   → **Effet de bord repéré (non corrigé, voir dette [MUT1])** : `Purulence` a `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) — pourrait l'exclure du filtre `cost_pc >= 0` en méthode achat libre.
   → Détail complet : `docs/JOURNAL6.md` "Session 138".
   → **Testé** : valeurs DB conformes à la rulebook, round-trip migration, ESLint 0 erreur, confirmation visuelle navigateur par Saar (coûts + titres non tronqués).
   → **Non testé** : achat effectif d'une des 4 mutations corrigées (dépense PC réelle, `finalizeCreation`).
   → Prochaine migration disponible : **119** (118 consommée cette session).

---

**35. ~~Wizard Phase 2 — corrections bugs B1/B5/B6/B8/B9 + A3 (store) ✅ Sessions 127–128~~**
   → B1 ✅ : variable `st` écrasée Step3Mutations (st→sub dans .map)
   → A3 ✅ : Zustand store `creationStore.js` — `getPcDispo()` dérivé, cascade null setters, PC budget temps réel
   → B5 ✅ : `addSkills` mastery = 0 → `sk.bonus ?? 0` (CareersAllocator)
   → B6 ✅ : unicité mutation non vérifiée → guard `meta.is_unique` dans `handleAdd`
   → B8 ✅ : doublon `classes_moyennes` → fusion + `allowed_parents` + filtre mis à jour
   → B9 ✅ : slider max=1 quand PC=0 → `disabled` + `max` corrigé
   → i18n ✅ : `wizard.step`, `wizard.pc_label`, `step3.none`, `step3.noneDesc`
   → Nav ✅ : bouton Précédent manquant dans sélection méthode Step3
   → **A1 ✅ Session 128 suite** : migrations 98 + 99 appliquées — 102 migrations totales

**36. ~~Wizard COUCHE 3 — Backend steps 4 & 5 ⚠️ clos partiel Session 129~~**
   → `advantageConstraints.js` : registre contraintes R1-R6 (exists/not_already_owned/unique/family/pc_max/sufficient)
   → `advantageService.js` : getAdvantages + addAdvantage (trx-or-db) + removeAdvantage (soft-delete)
   → `creationService.js` : getStep4RefData/State + validateAndPersistStep4 (snapshot + backgrounds + carrières + âge) + rollbackStep4 (snapshot-before + purge orphans) + getStep5RefData
   → `routes/creation.js` : monté `/api/creation` — 6 routes step4 + step5 — ownership guard param
   → `char-sheet.js` : advantages V1 → V2 (advantageService)
   → `index.js` : mount `/api/creation`
   → Fix rollback : purge skills hors snapshot (`whereNotIn`)
   → **Non testé** : aucune route appelée depuis le client

**37. ~~Wizard COUCHE 4a — câblage frontend → backend steps 0-3 ⚠️ clos partiel Session 129 suite 2~~**
   → `creationService.js` : +5 fonctions (`startCreation`, `validateAndPersistStep1/2/3`, `finalizeCreation`)
   → `creation.js` : +5 routes (`POST /start`, `/:sheetId/step1/2/3`, `/:sheetId/finalize`)
   → `creationStore.js` : réécriture — +`sheetId`, `campaignId`, `isStarting`, `startError`, `startCreation()` (axios)
   → `WizardCreation.jsx` : réécriture — `useParams` + `callStep` helper + handlers async
   → `Step1Attributes.jsx` : canNext + payload étendu — `App.jsx` : route path
   → `DashboardPage.jsx` : bouton "Créer un personnage" par card campagne
   → Fix : `fetch` relatif → `api` axios (fetch partait vers Vite port 5173 → 404)
   → **Testé** : SR ✅, start ✅ (bouton "Commencer" fonctionnel)
   → **Non testé** : steps 1-3 depuis client, finalizeCreation

**38. ~~Wizard COUCHE 4b ✅ clos Session 129 suites 3–5~~**
   → `CareersAllocator.jsx` : prop `careers` DB, `selectedCareerId` UUID, `allSkills` useMemo ✅
   → `Step4Summary.jsx` : réécriture 101L — suppression "PC dépensés x/20" ✅
   → `Step4Experience.jsx` : fetch refData, `finalAge` (base + études.years_added + carrières) ✅
   → `WizardCreation.jsx` : step4/5 async + rollback DELETE step4 + étape 6 (aperçu CharacterSheet) ✅
   → `Step5Advantages.jsx` : création 119L — toggle avantages/désavantages ✅
   → `WizardHeader.jsx` : stepper 6 étapes cliquables (dots + lignes + labels) ✅
   → `Step3Mutations.jsx` : "Aucune mutation" déplacée vers menu d'achat (UX) ✅
   → `100_seed_ref_careers.js` : 5 carrières seedées (ref_careers + skills + titles) ✅
   → `101_fix_background_names_encoding.js` : 8 noms corrompus (mojibake) corrigés ✅ — **104 migrations**
   → `creation.json` : S2-1 + S2-2 copy, `step2.conditionsTitle` manquant ✅
   → `index.css` : classes `.wiz-stepper*` ajoutées ✅
   → **Testé** : SR ✅, grille carrières ✅, âge final ✅ (19+2+6=27), step4→5→6→finalize ✅, step indicator ✅, encodage ✅
   → **Non testé** : steps 1-3 depuis client, multi-carrières avec skills partagées

**39. ~~Wizard COUCHE 5 — architecture client-primary ✅ Session 130~~**
   → Migration 102 : DROP `char_creation_snapshot` (FSM snapshot supprimé)
   → `creationService.js` : réécriture ~280L — `finalizeCreation` transaction unique (step1→step5)
   → `creation.js` : routes nettoyées — seul `POST /finalize` avec payload complet
   → `creationStore.js` : `highestStep` + merge semantics `setStep1Data` + `pcNet` dans `getPcDispo`
   → `WizardCreation.jsx` : `navigateToStep` (highestStep guard) + `handleFinalize` — plus d'appels FSM
   → `WizardReview.jsx` : nouveau composant pur store (remplace CharacterSheet en étape 6)
   → Step1/2/3/4/5 : hydratation `initialData` — retour arrière conserve les données
   → **Testé** : SR ✅, migration 102 ✅
   → **Non testé** : flux complet navigation retour → modifier → finaliser

**40. ~~Options de campagne — migration 104 (settings JSONB) + campaignSettingsService ✅ Session 132~~**
   → `campaignSettingsService.js` (SETTINGS_SCHEMA + getCampaignSettings) — source unique, remplace 5 lectures dupliquées
   → Migration 104 : `campaigns.settings JSONB` — consolide 6 colonnes + 11 nouvelles options, DROP `campaign_rules`
   → 3 bugfixes composants (`SectionDice` closures, `SectionGameRules` état manquant, `SectionTokens` désync) + bugfix `CampaignSettingsPage` (formRef→formData, onglets)
   → 7 fichiers déplacés vers `client/src/components/campaignSettings/` + i18n FR/EN complétés
   → **Testé** : SR ✅, combat inchangé ✅, persistance 11 options ✅, upload token non écrasé ✅, navigation onglets ✅
   → **Non testé** : effet mécanique des 11 options (stockage/lecture seulement — voir `docs/optionCampagne/JOPT.md`)

**41. Options de campagne — effets mécaniques (5/11) : `ambiance` ✅, `random_mutations` ✅, `feminin_bonus` ✅, `random_pro_advantages` ✅, `skill_prerequisites` ✅ — Session 141** ← EN COURS, un par un
   → Audit complet des 11 options dans `docs/Old/optionCampagne/PLAN_OPTCAMP.md` (Niveau 1/2/3 par complexité)
   → `ambiance` : mock supprimé (`WizardCreation.jsx`), `startCreation`/`creationStore` transmettent la vraie valeur, `finalizeCreation` revalide via `validateStep1` (code mort réactivé, `shared/polarisUtils.js:187`)
   → `random_mutations` : câblée Session 136 (masque la carte "Tirage aléatoire" Step3 si désactivée)
   → `feminin_bonus` : câblée Session 137 — élargie en cours de route à Sexe/Fécondité (Step1 pose `char_archetype.sex`, Step3 override via mutations Asexué/Androgyne/Autofécondation, Step5 désavantage Fécondité `adv_076` avec blocage si mutation stérilisante). Détail complet : `docs/PLAN_SEXE.md`, `docs/JOURNAL6.md` "Session 137".
   → `random_pro_advantages` : câblée Session 141 — gate le bloc "Tirage 1D10" (`CareersAllocator.jsx`, Lot 6 Session 140) selon le toggle, même pattern que `random_mutations`/`feminin_bonus`. Détail complet : `docs/JOURNAL6.md` "Session 141".
   → `skill_prerequisites` : câblée Session 141 (suite) — conflit de source résolu (`OPTIONS_CAMPAGNE.md` vs `CHARACTER.md`, confirmé option réelle par Saar). Gate `SKILL_MIN` dans `SkillsPanel.isVisible` (client, fermé par défaut) **+ revalidation serveur `POST /skills/buy`** (réutilise `calcSkillTotal` de `charStats.js`, déjà éprouvée en combat) — première option de ce chantier à toucher la fiche personnage en jeu (pas seulement le Wizard) et à fermer le gap côté serveur. `GET /char-sheet/:characterId` renvoie désormais `settings` (canal réutilisable pour les 6 options restantes). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite)".
   → **Testé** : SR ✅, parcours Wizard confirmé fonctionnel par Saar (options Wizard) ; parcours fiche personnage (MJ, PNJ, mode Progression) confirmé Saar pour `skill_prerequisites` — cascade de prérequis (Culture générale → Électronique/Informatique/Médecine → Chirurgie) vérifiée correcte
   → **Non testé** : les 8 scénarios détaillés de `PLAN_SEXE.md` un par un (validation donnée sur le parcours global) ; bascule ON→OFF en cours de wizard pour `random_pro_advantages` (non prévu par le design) ; rejet serveur `POST /skills/buy` par appel direct (masqué côté UI, non testé hors lecture de code)
   → **Prochain** : à définir avec Saar (6/11 restantes)

**41. Wizard COUCHE 4c → analyse terminée (session 2026-07-05 suite) : deux dossiers distincts, à ne plus confondre**
   → `PLAN_COUCHE4.md` (architecture wizard step-by-step, câblage frontend→backend) : confirmé **obsolète** — remplacé par COUCHE 5 (architecture client-primary, Session 130). Archivé par Saar dans `docs/Old/`.
   → `JOURNALCOUCHE4.md` (audit seeding carrières lots 1-6) : **toujours valide et exploitable**. Déplacé dans `docs/Old/` (réorganisation documentaire) mais reste la référence du seeding — voir item "1." en tête de fichier.
   → [WIZ-1] Filtrer personnages incomplets (creation_state ≠ 'complete') dans la liste Dashboard — dette indépendante, toujours ouverte
   → [WIZ-2] Synchroniser les deux compteurs PC (store header vs local CareersAllocator) — dette indépendante, toujours ouverte
   → [WIZ-3] Formation "apprentissage_technique" → choix de spécialité — dette indépendante, toujours ouverte
   → [S4-C1] ~~Seeder les ~24 carrières restantes~~ ✅ CLOS Session 134 suite — 37/37 carrières en base
   → [S4-C2] ~~Illustrations carrières depuis MinIO~~ ✅ CLOS Session 134 suite — 37/37 carrières ont leur illustration

**34. ~~Cluster N — UI combat~~** (en cours)
   → COM23 ✅ Session 127 : `TokenLabel` sprite CanvasTexture — label occludé par murs
   → FEAT3 ✅ Session 127 : `TokenActiveDisk` ring dorée — token actif combat
   → COM21 ✅ Session 127 : collision token-token — `isCellFree` DB direct + déplacement partiel (règle Polaris)
   → **COM20** ← PROCHAINE ÉTAPE : arme + munitions dans CombatActionWindow / CombatGmDeclareWindow

** Notes Saar (user) :
Projet en cours et priorité user : 
- Wizard : seeder les careers (en cours, item "2." ci-dessus) et les mutations (planifié, item "3." ci-dessus — PLAN_STEP4 + PLAN_MUTATION)
- Wizard : Step 4 Expérience (Origine, Milieu et formation) doivent imapcter réellement la fiche personnage
- Wizard : Step 4 Profession : revoir l'UI intégralement pour la clarté
- Option de campagne : Implanter les options de campagne relative au Wizard


---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **135 migrations appliquées** (135_ref_equipment_skill_assoc_weapons — Session 141 (suite 16) ;
  134_combat_actions_aim_bonus_comp — Tir visé, session parallèle ;
  133_char_sheet_wizard_locked_backfill — Session 141 (suite 14) ;
  132_char_sheet_dedupe_and_unique — Session 141 (suite 14) ;
  131_split_equippable_stacks — session parallèle ;
  130_vault_transfer_requests / 129_vaults — Session 141 (suite 15) ;
  126_ref_setbacks_revers_table — Session 141 (suite 12) ;
  125_char_mutations_source_campaign — Session 141 (suite 9) ;
  124_char_advantage_notes — Session 141 (suite 9) ;
  123_ref_advantages_polaris — Session 141 (suite 6) ;
  122_ref_career_random_benefits_lot1_and_points_alt — Session 140 ;
  121_ref_career_skills_choice_groups — Session 139 ;
  120_fix_ref_career_point_categories_lot1 — Session 139 ;
  119_char_sheet_wizard_lock — Session 139 ;
  118_fix_ref_mutations_organe_sensoriel_manquant — Session 138 ;
  117_ref_mutation_subtypes_description — Session 136 ;
  109_mutation_stacking + 108_fix_ref_mutations_encoding — Session 135 ;
  116_seed_ref_careers_lot6 — Session 134 suite ; deux numéros 108/109 distincts coexistent, voir P53)
- Migrations : voir `docs/ASBUILT.md` § Base de données

---

## En attente de validation fonctionnelle

**FEAT2-A — LOS outil menu radial ✅ MVP clos (ligne + overlay)**
- V1–V6 validés avant ajout caméra v2

**FEAT2-C — Caméra LOS v2 (épaule droite) ✅ clos complet — Session 112**
- `client/src/lib/useCameraLOS.js` réécrit — service complet (feature-as-service, ARCHI_REWORK.md)
- Canvas3D.jsx : zéro logique LOS — 1 appel `useCameraLOS(...)` + 4 callables `{ losLine, onTokenClick, onPointerUp, clearLine }`
- FEAT2-B (LOS automatique pipeline assaut) → sprint futur

---

## Dettes actives

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| ~~**COM25**~~ | ~~Arme sans munition restante continue de tirer~~ | ✅ Session 160 (Saar) |
| ~~**COM28**~~ | ~~Matraque Mao (arme CaC) affichait "0/40 munitions" en fenêtre de combat — `weaponAmmoStatus` ignorait `ref_caliber`~~ | ✅ Session 160 (Saar) |
| ~~**COM29**~~ | ~~Tir à deux armes : seule la main directrice trackée (munitions)~~ | ✅ Session 162 (Saar) |
| **COM26** | 2 munitions catalogue (`Darts 7.62mm ST - Projectile SAP`, `Flèche - Projectile IEM`) portent le DSL Assommante par erreur de copié-collé — `description` et `ammo_effects` incohérents. Trouvé en corrigeant Lot B (migration 160) `docs/PLAN_ARMES_DSL.md` | Basse — à refaire lors de C1/C2 |
| EQSKILLS1 | `ref_equipment_skills` ("compétences boostées/requises") jamais consommée en jeu — seulement écrite/relue par l'API admin `routes/equipment.js`, aucun calcul ne la lit. 1 item (TMP II) a une entrée visiblement erronée (`ANALYSE_EMPATHIQUE`). Fusion avec `ref_equipment_skill_assoc` possible mais non prioritaire | Basse |
| ST1 | Badge statut illisible sur token canvas (texte trop petit) | Haute — Sprint 14-2 |
| ST3 | Fenêtre THUG STATUTS trop petite — overflow des icônes statuts | Moyenne |
| CH1 | Historique chat perdu au F5 (rechargement page) | Haute |
| ~~**COM2**~~ | ~~Vérif statut arme absente côté GM~~ | ✅ Session 161 (Saar) |
| ~~**COM7**~~ | ~~Multi-attaque CaC : duplicata / bouton grisé~~ | ✅ Session 158 (Saar) |
| COM27 | CaC multi-attaque : jet de défense semble se lancer avant le jet d'attaque (signalé Saar, non instrumenté) | À investiguer |
| FEAT4 | Aura de portée CaC (3m + allonge arme) autour du personnage actif | Basse — sprint futur |
| ~~**COM9**~~ | ~~Viser une localisation précise — non implémenté~~ | ✅ Session 155 (Saar) |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| ~~**TIRVISE**~~ | ~~Tir visé — non implémenté, bloquait le Lot B2 de `docs/PLAN_MODING.md`~~ | ✅ Session 141 (suite 17) |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| **CSPLAYERSTAB** | `CampaignSettingsPage.jsx` — avertissement React (mélange `background`/`backgroundColor` entre `s.navItem`/`s.navItemActive`) sur les onglets de réglages campagne — préexistant, repéré en testant `docs/PLAN_VAULT.md` Lot 4 (onglet "Joueurs"). Cosmétique, aucun impact fonctionnel | Très basse |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **KIWI2** | Import GLB token : local ✅ / Kiwi ❌ | **Haute** — Cluster R |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **MUT3** | Effets mécaniques des mutations et avantages — Lots 1-6 (attributs, résistances, armure/arme naturelle, déblocage de compétences, identité sex/is_fertile/hand_pref) ✅ clos et fonctionnels. Reste Lot 7 (Narratif/économie, priorité basse) — `docs/Old/PLAN_MUTATION2.md` (archivé, chantier clos) | Lot 7 à détailler quand Saar voudra enchaîner |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| **COM23** | ~~Label token : fixe, ne rentre pas dans les murs~~ | ✅ Session 127 |
| **FEAT3** | ~~Token actif : cercle de sélection~~ | ✅ Session 127 |
| **UI2** | Alignement dés | Basse — Cluster Q |
| **UI3** | Dé 100 : affichage chat | Basse — Cluster Q |
| **WIZ-1** | Personnages incomplets (creation_state ≠ 'complete') visibles dans la liste | Moyenne — COUCHE 4c |
| **WIZ-2** | Deux compteurs PC (header store vs CareersAllocator local) | Basse — cosmétique |
| **WIZ-3** | Formation "apprentissage_technique" → choix de spécialité non implémenté | Moyenne — COUCHE 4c |
| **CAR1** | Mécanisme "au choix" (`conditional:true`) non implémenté — 34 occurrences lots 2-6 | Moyenne — Step4 UI |
| **CAR2** | `ref_background_skills.skill_id` sans FK vers `ref_skills.id` (même défaut que `ref_career_skills` avant migration 111) | Basse — pas de bug connu, préventif |
| **CAR3** | Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) non insérés dans `ref_career_prerequisites` | Moyenne — migration dédiée post lots 2-6 |
| **DBG-C1** | `character.user_id` null quand GM crée pour joueur absent (steps 1-3) | Moyenne — sprint futur |
| **JSON1** | `client/src/locales/en.json` invalide — guillemets non échappés `deleteMapConfirm` (préexistant, cassait déjà avant Session 132) | **Haute** — casse tout le fichier EN |
| **OPT-W1** | 3/11 options de campagne (revers, skill_natural_prog, celebrity) sans effet mécanique branché — `ambiance` ✅ Session 132 suite, `random_mutations` ✅ Session 136, `feminin_bonus` ✅ Session 137, `random_pro_advantages`/`skill_prerequisites` ✅ Session 141, `skill_max_level` ✅ Session 141 (suite 2), `young_penalty` ✅ Session 141 (suite 4), `polaris_latent` ✅ Session 141 (suite 6) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |
| **MUT1** | `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable | Basse — à investiguer |
| ~~**HP1**~~ | ~~Main directrice : `socketCombatHelpers.js:556/584` et `inventoryService.js:99/181` (déplacé depuis `char-sheet.js:810` lors de l'extraction Étape 0, item 63) lisaient `hand_pref` sur `char_sheet` (colonne inexistante, en réalité sur `char_identity`) → toujours `'R'` par défaut, quel que soit le choix réel du joueur ou l'Avantage Ambidextre. Corrigé : les 2 sites rejoignent désormais `char_identity` (même pattern déjà correct utilisé à 4 autres endroits du projet — `char-sheet.js:103`, `vault.js:49`, `creationService.js:306`, `identityService.js:44`)~~ | ✅ Session 143 |
| **ADV1** | Célébrité, Allié/Contact/Ennemi/Opposant et les autres "avantages relationnels" (`ref_career_random_benefits`, Revers, OPT-11) ne sont trackés nulle part mécaniquement sur la fiche personnage — aucune jauge/compteur réel. Bloque l'automatisation des tirages Avantages pro aléatoires (Lot 6) et de Revers (OPT-06) au-delà de la simple conversion en points | **Haute** — à faire impérativement (décision Saar, Session 141 suite 12) |
| **ADV2** | Bénéfices de carrière type "Revenus +10%/+20%/doublés à partir de cette année" (`ref_career_random_benefits`, ex. Cultivateur/Éleveur) — aucun mécanisme pour appliquer un modificateur cumulatif aux années futures | Moyenne — roadmap Session 141 suite 12 |
| **ADV3** | Bénéfices de carrière débloquant l'accès à une compétence (mutation/compétence "développée automatiquement" via tirage) — non géré, aucun câblage vers `char_skills`/`char_mutations` | Moyenne — roadmap Session 141 suite 12 |
| **WIZ4** | `Step4Experience.jsx` — le mini-stepper (`isClickable`) ne revalide jamais les blocages durs de la sous-step quittée (ex. retirer sa seule carrière puis cliquer directement sur une sous-step déjà "reachable"). Filet serveur (`reconcileCreation` STEP4) empêche toute donnée invalide persistée — juste un rejet tardif au lieu d'un blocage immédiat | Basse — architecture navigation mini-stepper |
| **WIZLOCK1** | 2 fiches trouvées `creation_state='complete'` mais `wizard_locked_at` jamais posé, avant le correctif d'atomicité Session 141 (suite 14) — `handleTerminate` faisait 2 appels réseau séparés (`reconcile` puis `lock`), toute coupure entre les deux laissait la fiche bloquée. Corrigé pour les finalisations futures ; dette documente seulement l'historique | Basse — historique, pas un risque actif |
| **DOC1** | `docs/VOCABULARY.md` était un squelette vide depuis sa création, jamais réellement adopté par le protocole. Peuplé Session 141 (suite 18) avec un premier seed réel — reste à enrichir au fil des sessions | Basse — enrichissement continu |
| **DOC2** | `docs/SYSTEME/REGLES_LdB.md` — dump brut d'extraction LdB, encodage mojibake par endroits, mal placé selon `RegleDocumentaire.md` Règle 8 (devrait être dans `REGLES/`), doublon probable avec `docs/REGLES/REGLESYSCOMBAT.md`. Bandeau d'avertissement ajouté ; vérification/déplacement à faire en session dédiée | Basse — session dédiée à planifier |
| **CHOC1** | ⚠️ Partiellement clos (Session 2026-07-16, Chantier 11 Étape 2 Lot B, `docs/PLAN_ARMES_DSL.md`) : le pool de "dommages de Choc" distinct des dégâts physiques existe désormais dans `damageService.resolveTargetHit` (`prt` consommé, `chocDegatsNets`, sévérité combinée, Test de Choc exclusif) — mais **uniquement pour les munitions `ammo_effects` CHOC=, tir à distance** (`resolveAssaultAction`/`COMBAT_DAMAGE_CONFIRM`). **Reste non câblé** : le bonus LdB propre à la mutation Corne ("+1D6 Choc si le coup porte à la tête" en CaC) — `resolveMeleeAction` ne passe toujours pas `chocDsl`/`rangeBand`, explicitement hors scope de Lot B (mécanisme mutation, pas munition) | Basse — reste un chantier séparé, mais l'infrastructure existe désormais |
| **GEOM1** | `docs/PLAN_GEOMETRIE.md` (Rampe/Slope/Porte, Atelier du GM) jamais codé, obsolète depuis le nouveau builder (Kiwi) selon Saar — **question posée à Codex** : des fragments (recherche `THREE.ExtrudeGeometry`/`UVGenerator`, décisions d'architecture) sont-ils réutilisables avant archivage/suppression du plan ? Archiver vers `docs/Old/` ou supprimer dès réponse de Codex (Session 149) | En attente réponse Codex |
| **INI4** | `initiative` jamais remise à `base_ini` en fin de tour (`endTurn`) — les modificateurs s'accumulent tour après tour. Trouvé par audit `docs/COMPARATIF.md`, détail `BUGIDENTIFIE.md` | Moyenne — correctif isolé |
| **MELEE-MR** | Dégâts CaC calculés sans le MR (dette Session 67, jamais close) — le tir à distance a une vraie table MR→ModDom, le CaC non. Détail `BUGIDENTIFIE.md` | Moyenne — correctif isolé |
| **DEF5** | « Cible sans défense » (+5, pas d'opposition) absent en tir ET en CaC — `is_surprised` sous-exploité. Détail `BUGIDENTIFIE.md` | Moyenne — un cluster, deux points d'insertion |
| **TIRIMP** | Garde serveur absent sur « Tir impossible » (allure/couverture/éclairage Totale, `-99`) — bloqué côté client uniquement, contournable. Détail `BUGIDENTIFIE.md` | Moyenne — trou de sécurité serveur |
| **WNDMORT** | Malus blessure « mortelle » codé -20 fixe au lieu de bloquer les Tests — décision produit à trancher avant de coder. Détail `BUGIDENTIFIE.md` | Basse — décision requise avant code |

---

## Roadmap

- ~~**Sprint Tir visé**~~ ✅ → Session 141 (suite 17), `shared/combatExclusiveActions.js` — déblocage
  du Lot B2 `docs/PLAN_MODING.md` confirmé, pause levée Session 141 (suite 21).
- ~~**Sprint Dégâts Drone**~~ ✅ → B6 (Loc) + B7 (Dmg) — Clos Sessions 94
- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- ~~**Sprint PLAN 14-1**~~ ✅ — Menu contextuel token codé (`TokenRadialMenu.jsx`/`TokenStatusPanel.jsx`)
- ~~**Sprint PLAN 14-2**~~ ✅ — Badges codés (`Canvas3D.jsx`) — reste `ST1`/`ST3` (dettes actives)
- ~~**Sprint PLAN 14-3**~~ ✅ — Option campagne `status_effects_mode` (`off`/`icon_only`/`enforced`,
  défaut `enforced`) codée 2026-07-16 — voir `docs/ROADMAP.md` §PLAN 14 pour le détail des 3 sites
  serveur gatés + menu/badges client. FIX-D abandonné (aucune base dans `REGLESYSCOMBAT.md`).
  **PLAN 14 entièrement clos.**
- ~~**Sprint stunted_until_turn**~~ ✅ — supplanté par Sprint 14-0 — voir PLAN 14
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n combat+équipement** — 18 composants hors scope (sprint dédié futur)

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PC45 — `combat_actions.type` (serveur, valeur brute) ≠ `action_key` (client, clé UI) — deux colonnes distinctes, valeurs identiques pour 'melee'. Confondre les deux → 0 résultat sur les queries
- PC46 — `meleePrecheckId` dans `CombatOverlay` : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION. `useEffect` doit inclure `[meleePrecheckId, socket]` — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `docs/SYSTEME/CORE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `docs/SYSTEME/CORE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `docs/SYSTEME/DICE.md`
