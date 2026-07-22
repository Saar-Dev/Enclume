# EN COURS — Dettes actives et prochaines étapes
> **2026-07-22 — grille mono-plan validée et déployée sur `8293/8294`** : murs, sols, plafonds, passerelles et trappes
> entièrement ajourés utilisent maintenant une seule grille recto-verso ; les escaliers validés
> restent inchangés. Même les empreintes découpées/courbes ne sont plus extrudées visuellement. Le
> volume physique demeure complet. Validation locale, build et rendu du vrai renderer depuis deux
> caméras opposées réussis ; health API et smoke Chromium distant validés après redémarrage. La
> recette utilisateur est acceptée et le lot monde Session 159 est prêt pour la fusion.
>
> **2026-07-22 — correctif visuel grille déployé sur `8293/8294`** : les marches ajourées sont maintenant des
> plateaux minces recto-verso au lieu de blocs opaques empilés. Leur motif utilise une densité ×4
> corrigée par les dimensions du giron. Les murs ajourés restent visibles depuis les deux côtés et
> ne subissent plus la coupe caméra des murs pleins. Validation locale et rendu Chromium bilatéral
> réussis, puis health API et smoke Chromium distant validés après redémarrage.
>
> **2026-07-22 — raffinement des grilles et architecture des trappes 3D déployés sur `8293/8294`** : les marches utilisent
> un motif de grille deux fois plus serré. Les autres surfaces ajourées affichent une coque unique
> de 4,5 cm au lieu de deux grilles séparées par toute leur profondeur, sans modifier leur volume
> physique. Les trappes tournent maintenant à gauche/droite par quarts de tour et peuvent recevoir
> un blueprint GLB animé de connecteur `hatch`; la version procédurale reste le fallback. Il reste à
> produire les variantes artistiques (écoutille, coulissante, boîtier) selon ce contrat. Health API
> et smoke Chromium distant validés après redémarrage.
>
> **2026-07-22 — trappe d'échelle et grille ajourée déployées sur `8293/8294`** : poser une échelle
> ajoute par défaut une trappe au palier haut. Fermée, elle remplace la dalle comme support et ferme
> la traversée ; ouverte, elle pivote, libère le trou et autorise la montée. Le motif procédural
> **Grille industrielle ajourée** s'applique aux surfaces et structures avec un vrai cutout alpha ;
> le preset physique `grate` reste collider sans occulter la LOS. Validation locale et Kiwi :
> 141 tests monde/serveur, 41 tests Surface, 3 configuration, build Vite, ESLint ciblé, inspection
> du PNG RGBA sur damier et smoke Chromium distant sans exception. Reste non testé : recette
> fonctionnelle complète dans une vraie carte/une vraie session.
>
> **2026-07-18 — palier haut du colimaçon livré sur 8293** : la trémie n'est plus le carré
> englobant de l'escalier. Elle suit le secteur de volée qui exige réellement de la garde au
> plafond et conserve le secteur suivant comme palier praticable devant la dernière marche.
> Rotation et sens horaire/antihoraire transforment la même géométrie canonique. Le renderer et le
> snapshot physique découpent le même multipolygone. Validation : 138 tests monde/serveur,
> 39 tests Surface, build Vite, ESLint ciblé et recette visuelle réelle sur 8293 aux quatre
> orientations puis avec le sens inversé, et après rechargement ; l'escalier utilisateur a été remis
> exactement dans son état initial.
>
> **2026-07-18 — colimaçon canonique et tokens réellement au sol livrés sur 8293** :
> **Objets 3D > Escaliers** propose maintenant un colimaçon paramétrique de 3,75 m de diamètre.
> Sa définition unique dérive 21 marches courbes, colonne centrale, garde-corps, trémie, collisions,
> occlusion et ancrages intermédiaires. L'entrée tourne à la molette avant pose ; le popup permet
> ensuite rotation, sens horaire/antihoraire, garde-corps, coût et apparence. Les GLB de token ne
> reçoivent plus un décalage vertical commun : chacun est recalé par sa boîte englobante sur le
> point de contact monde. Validation : 136 tests monde/serveur, 38 tests Surface, build Vite et
> recette réelle 8293 avec aperçu, pose, rotation, inversion du sens, sauvegarde/recharge et
> suppression finale de l'objet de test.
>
> **2026-07-18 — rotation à la molette livrée sur 8293** : tout fantôme orientable se tourne par
> quarts de tour avec la molette sans zoomer la caméra. Cela couvre les objets 3D libres, escaliers,
> échelles et dalles en verre. Le tooltip mobile de rotation a été supprimé. Les objets muraux
> conservent l'orientation imposée par leur face d'ancrage.
>
> **2026-07-18 — orientation avant pose et vision verticale livrées sur 8293** : la palette tourne
> désormais l'aperçu des escaliers, échelles et dalles en verre avant le clic ; la même orientation
> alimente la définition structurelle posée. Les verrières disposent d'un fantôme cyan visible. Les
> intérieurs inférieurs restent rendus derrière les vraies dalles : trémies et verre les révèlent,
> sans appliquer la coupe transparente aux murs inférieurs. Le petit jour sous le token est retiré
> par un ajustement visuel de 3 cm qui ne touche pas sa position monde. Validation : 61 tests ciblés,
> 133 monde/serveur, 3 configuration, build Vite et contrôle visuel réel dans Chromium sur 8293.
> L'aperçu de l'escalier a été observé à 0° puis 90°, celui de la dalle a été observé sur le sol, et
> une copie temporaire colorée a montré l'étage bas dans la trémie et derrière la verrière avec ses
> murs opaques. Campagne, carte et adhésion temporaires supprimées puis contrôlées à zéro.
>
> **2026-07-16 — escalier droit paramétrique livré sur 8293** : `surface_data` v13 impose une
> définition structurelle stricte dont `stairGeometry` dérive marches, garde-corps, trémie,
> colliders, occluders et ancrages praticables. La pose se fait depuis **Objets 3D > Escaliers** et
> crée automatiquement la traversée verticale ; l'ancien outil direct n'est plus exposé. La
> rotation, les rails, le coût et l'apparence sont éditables dans le popup. Validation : 133 tests
> monde/serveur, 3 configuration, build, lint ciblé et recette Playwright Chromium réelle :
> prévisualisation, pose de 21 marches, rotation persistée et trémie visible au niveau 1. L'échelle
> suit la même UX dans **Objets 3D > Échelles** : vrai aperçu, connecteur automatique, sélection,
> popup et rotation, également confirmés dans Chromium. Prochaines extensions : trappe liée à
> l'échelle et variantes d'escalier, sans dupliquer le moteur.
>
> **2026-07-16 — plan historique de fusion clos** : les lots 4 et 5 étaient déjà résolus dans
> l'architecture courante mais n'avaient pas été reportés dans le plan. La topologie systemd
> `8193/8293/8393` est volontairement isolée et les scripts Python hydroponiques sont des outils
> Blender dev-only. Le scénario 8.F a maintenant été exécuté dans Chromium sur `8393` avec un vrai
> compte joueur et un GM : mouvement valide, arrêt par budget, mur fermé refusé en 409, vide refusé
> au joueur et téléportation libre réservée au MJ. Toutes les données temporaires ont été supprimées
> et contrôlées à zéro en base. Les contrats définitifs vivent dans `WORKFLOW_FUSION`,
> `SYSTEME/MOTEUR_MONDE` et `SYSTEME/ASSETS` ; le plan est archivé sous `docs/Old/`.
>
> **2026-07-16 — deuxième fusion commune validée** : `integration` réunit le moteur monde
> `72743e8` et les règles `1af7d78` via les merges `3e337f1` et `eec54df`. L'ancien Surface présent
> dans l'ascendance de `dev/Saar` n'a pas été importé : seul le delta règles
> `60056b3..1af7d78` a été appliqué, le moteur Session 150 restant l'autorité spatiale. L'instance
> `8393/8394` est active sur `vtt_fusion` et `enclume-assets-fusion`. Validation : 131 tests
> monde/serveur, 3 configuration, 59 ciblés, lint, build, smoke Playwright, carte 3D/combat
> multi-étages réellement chargée aux niveaux 0 et 1, et création HTTP atomique d'un PNJ avec
> suppression et contrôle de base. Retour arrière :
> `/home/codex/backups/enclume-pre-fusion-20260716-144903` et tags
> `backup/pre-fusion-*-20260716-144903`. Publication GitHub encore bloquée par l'absence
> d'authentification du compte système `codex` ; le dépôt du cousin n'a pas été modifié.
>
> **2026-07-16 — surface océanique continue et garde sous-marine** : le rendu de l'océan ne
> réutilise plus les colonnes physiques, volontairement absentes dans les salles étanches. La
> surface visible est un plan continu sur l'emprise globale et se trouve cinq hauteurs d'étage
> au-dessus du sommet structurel réel. Vérifié sur la session 8293 exacte : station dégagée au
> niveau 0, nappe animée sans trous au niveau 7. Validation : 59 tests ciblés, 131 monde/serveur,
> 3 configuration, lint et build.
>
> **2026-07-16 — toitures exposées au niveau affiché** : un plafond sans sol supérieur est désormais
> traité comme une toiture extérieure. Il reste opaque sur le plan du niveau sélectionné, tandis
> qu'une interface partagée privilégie le sol de la salle haute. Les salles multi-étages ne créent
> toujours aucun plan intermédiaire. Vérifié dans le navigateur avec, au niveau 1, le sol supérieur
> et le toit d'une salle simple affichés côte à côte. La copie de validation a été supprimée, puis
> le même résultat a été confirmé directement sur les salles existantes de la carte originale.
>
> **2026-07-16 — altitude canonique des interfaces horizontales** : l'absence de `yOverride` n'est
> plus convertie en `0`. Un sol de salle sans surcharge utilise donc réellement `room.y`, tandis
> qu'un plafond utilise le haut de la salle ; une surcharge explicite égale à zéro reste valide.
> Sur la session réelle `b27cbed4-fd59-4530-b43b-dae57c33f092`, le sol de la salle haute est
> désormais rendu à `y = 2,5 m`, opaque, sur toute son empreinte. Le passage réel 0 → 1 a été
> contrôlé après redémarrage complet dans le navigateur.
>
> **2026-07-16 — contexte caméra strictement lié à son étage** : le volume actif de l'ancien niveau
> est invalidé dès le changement de `displayLevel`, sans attendre une frame 3D. Cette correction
> supprime l'exception de visibilité périmée, mais ne déterminait pas l'altitude physique du sol ;
> la validation visuelle initialement inscrite ici est remplacée par celle de l'altitude canonique
> ci-dessus.
>
> **2026-07-16 — enveloppe basse sans intérieur** : au niveau courant, l'intérieur est complet ;
> aux niveaux inférieurs, seuls les murs opaques et les portes, fenêtres ou objets fixés dessus
> restent visibles. Sols, plafonds, objets libres, tokens et effets inférieurs sont masqués. Le
> volume multi-niveau actif conserve son intérieur sur toute sa hauteur. Validation : 51 tests
> ciblés, 131 monde/serveur, 3 configuration, lint ciblé et build.
>
> **2026-07-16 — autorité unique des interfaces horizontales** : les sols de salle ne possèdent plus
> de chemin de rendu indépendant. Chaque `roomHorizontalInterface` choisit la face plafond au niveau
> bas puis la face sol, opaque et appartenant à la salle haute, dès son étage. Les trois interfaces
> empilées de la carte réelle basculent bien de `ceiling` au niveau 0 vers `floor` au niveau 1.
> Validation : 24 tests ciblés, 131 monde/serveur, 3 configuration, lint, build et carte réelle
> chargée au niveau 1.
>
> **2026-07-16 — coupe d'étage, halo des portes et verrières corrigés** : une interface partagée est
> le plafond découpé de l'étage bas, puis le sol opaque de l'étage haut ; seuls les murs et objets
> muraux des étages inférieurs restent opaques, leur intérieur étant masqué. Le halo des portes est attaché au GLB réel et suit
> sa rotation. Les **Dalles en verre** utilisent bien le renderer structurel et sont posables depuis
> **Objets 3D**. Validation : 65 tests ciblés, 131 monde/serveur, 3 configuration, lint, build et
> parcours navigateur réel avec nettoyage de la dalle de test.
>
> **2026-07-16 — interactions 3D et interfaces horizontales** : les clips GLB intégrés alimentent
> désormais des états Fermé/Ouvert partagés par entités et portes ; les tooltips colorables possèdent
> un aperçu compact ; les `skylight` sont accessibles sous **Objets 3D > Dalles en verre**. La
> suppression de campagne possède un panneau d'avertissement dédié. Validation : 131 tests
> monde/serveur, 3 configuration, 6 ciblés, lint, build et navigateur réel.
>
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

> Dernière mise à jour (dev/Saar) : 2026-07-15 — Session 144 : bascule `dev/Saar` en branche
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

- Phases 0 à 16 terminées : contrat métrique, document canonique, compilateur, navigation serveur,
  LOS/couverture, structures verticales, régions/effets runtime, cabine d'ascenseur mobile et
  branchement spatial complet du combat, tranches d'étage isolées avec profondeur visible dans les
  seuls volumes multniveau, murs courbes physiques, empreintes exclusives de salles non
  rectangulaires, fusion de volumes à hauteurs différentes et profils verticaux de murs.
- `surface_data` v13 porte tranches verticales, arcs, apparences intérieures canoniques et escaliers
  paramétriques stricts. Salle,
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
- Intégration du 2026-07-16 validée sur `8393` avec une carte multi-étages, un combat actif et un
  parcours HTTP authentifié de personnage. Les extensions monde continuent sur les variantes
  d'escalier et de passerelle, sur les contrats canoniques déjà en place.

Référence obligatoire : `docs/SYSTEME/MOTEUR_MONDE.md`.

---

## ⚡ PROCHAINE ÉTAPE EXACTE

🔒 En cours : — (aucune session active)

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

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
| INFRA-R1 | `ioredis` reste déclaré dans `server/package.json` sans aucun import runtime. Son retrait du lockfile et l'arrêt éventuel de l'infrastructure Redis doivent être traités séparément après vérification des autres consommateurs du serveur ; aucun service partagé n'est coupé dans la clôture documentaire de la fusion. | Basse — nettoyage infrastructure |
| EQSKILLS1 | `ref_equipment_skills` ("compétences boostées/requises") jamais consommée en jeu — seulement écrite/relue par l'API admin `routes/equipment.js`, aucun calcul ne la lit. 1 item (TMP II) a une entrée visiblement erronée (`ANALYSE_EMPATHIQUE`). Fusion avec `ref_equipment_skill_assoc` possible mais non prioritaire | Basse |
| ST1 | Badge statut illisible sur token canvas (texte trop petit) | Haute — Sprint 14-2 |
| ST3 | Fenêtre THUG STATUTS trop petite — overflow des icônes statuts | Moyenne |
| CH1 | Historique chat perdu au F5 (rechargement page) | Haute |
| COM2 | Vérif statut arme absente côté GM | Moyenne |
| COM7 | Multi-attaque CaC : duplicata / bouton grisé | Moyenne |
| COM9 | Viser une localisation précise — non implémenté | Moyenne — sprint dédié |
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
| **CHOC1** | Mutation Corne — bonus LdB "+1D6 dommages de Choc si le coup porte à la tête" non câblé. `calcResistanceArmure` calcule déjà un `prt` (protection_shock) jamais consommé par `damageService.js` — aucun pool de "dommages de Choc" distinct des dégâts physiques n'existe dans le pipeline actuel | Moyenne — chantier séparé, non trivial |

---

## Roadmap

- ~~**Sprint Tir visé**~~ ✅ → Session 141 (suite 17), `shared/combatExclusiveActions.js` — déblocage
  du Lot B2 `docs/PLAN_MODING.md` confirmé, pause levée Session 141 (suite 21).
- ~~**Sprint Dégâts Drone**~~ ✅ → B6 (Loc) + B7 (Dmg) — Clos Sessions 94
- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint PLAN 14-1** — Menu contextuel token (right-click → ajouter/retirer statuts)
- **Sprint PLAN 14-2** — Affichage badges (SVGs `docs/Character/Statuts/`, Canvas3D)
- **Sprint PLAN 14-3** — FIX-D + mécaniques enforced (bypass défense stunned/surprised)
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
- coordonnées runtime — tokens actifs en `world-feet`; adaptateurs uniques
  `dbPositionToWorldPoint` / `worldPointToDbPosition`; aucun offset voxel dans la physique
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- resolveEntityState — returning doit inclure battlemap_id (PE26)
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
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `CLAUDE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `CLAUDE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `CLAUDE.md`
