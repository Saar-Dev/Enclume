## v83 — 2026-06-06 — Fiche Drone + Design System CSS + Migration catalogue compétences

### Fiche Drone — Programmes
- [add] Catalogue de 34 programmes logiciels (LdB p.281) : Détection, Ami/Ennemi, Armement, Esquive, Pilotage, Analyse, Médical, Communication, Spécialisés
- [add] Section "Duel d'ordinateurs" regroupant les programmes Sécurité, Offensif, Contre-attaque et Rempart
- [add] Tooltip description au survol du nom de programme (texte LdB complet)
- [add] Mode "Catalogue" : sélection depuis le catalogue organisé par catégorie
- [add] Mode "Personnalisé" : saisie libre avec catégorie assignable (pour programmes custom hors LdB)
- [add] Validation contrainte ordinateur : niveau max (gen + 2×NT) et potentiel total (10 + gen×NT×2)
- [add] Intégrité actuelle éditable directement par le GM

### Interface Combat — Design System
- [chg] 9 composants combat migrés de styles JS inline vers classes CSS centralisées dans index.css
- [add] 27 tokens CSS --combat-* dans :root
- [add] Section 11 COMBAT WINDOW SYSTEM (~320 lignes) : .combat-win, .combat-float-win, .btn-tac-confirm, .combat-timeline-bar, badges, chips, selects

### Catalogue compétences (migration 74)
- [fix] 10 groupes structurels manquants insérés (Mutation, Pouvoirs Polaris, Armes Spéciales, Arts martiaux, Commerce/Trafic, Pilotage, Génie technique…)
- [fix] Compétence Arts martiaux restaurée avec le bon attribut (COO/ADA) et le malus (-3) sur ses sous-compétences
- [fix] MUTATION_* et POUVOIRS_POLARIS_* : marqueur (X) appliqué — ces compétences se masquent correctement si non acquises
- [fix] Prérequis CHIRURGIE, FALSIFICATION et 3 compétences Polaris/Mutation ajoutés
- [fix] Typo identifiant ACCROBATIE_EQUILIBRE → ACROBATIE_EQUILIBRE

---

## v81 — 2026-06-05 — Sprint Annonce v2 + corrections combat + roster personnages

### Combat — Phase Annonce
- [chg] Déclaration séquentielle stricte : une fenêtre à la fois dans l'ordre d'initiative, le GM ne peut plus grouper des PNJs en batch
- [add] Ghost de déplacement (cube bleu semi-transparent) visible pour tous après chaque déclaration
- [add] Ligne ambre reliant l'assaillant à sa cible annoncée, visible pour tous les spectateurs
- [add] Mini-panneau "vient d'annoncer" en bas-gauche (nom, INI, destination, cible)
- [chg] Timeline phase Annonce : le déclarant actif est affiché en grand, les déclarés sont atténués
- [add] Bouton "Passer" dans la fenêtre GM quand un joueur bloque le flux d'annonce

### Combat — Monitoring GM en temps réel
- [add] Le GM voit en direct ce que le joueur actif est en train de déclarer : actions choisies, cible visée, destination de déplacement, mode de combat — mis à jour en temps réel (150ms) sans attendre la confirmation
- [add] Reconnexion du GM en cours de déclaration : le preview courant est resynchronisé automatiquement

### Combat — Fenêtre de déclaration
- [add] Roster PNJs collapsible (GM) avec mémorisation de l'état ouvert/fermé
- [add] Roster de personnages collapsible (joueurs) : liste tous les persos du joueur en combat, visible dans tous les états (attente, déclaré, formulaire). Utile pour hackers avec drones ou PNJ alliés assignés
- [add] Ligne de déplacement bleue de l'origine à la destination + nom du token au-dessus — les spectateurs voient clairement qui se déplace et où

### Combat — Test de Choc
- [add] Option campagne "Appliquer l'étourdissement automatiquement" (activée par défaut) — désactivez pour arbitrer manuellement
- [add] Bouton "Appliquer l'étourdissement" dans le panneau résultat GM quand l'option est désactivée
- [fix] L'échec d'un Test de Choc applique désormais le badge Étourdi ou Inconscient sur le token
- [fix] La fin du combat retire automatiquement les badges Étourdi/Inconscient des participants
- [fix] Le MJ voit le panneau résultat dégâts quand un PJ attaque un PNJ

### Combat — Bugs corrigés
- [fix] Écran noir joueur au passage en mode combat (erreur JavaScript interne)
- [fix] Bouton "Assaut (tir)" grisé à tort pour les armes n'ayant jamais été rechargées via l'interface (migration 70 : initialisation automatique du chargeur à l'équipement)

---

## v80 — 2026-06-04 — Bibliothèque : images uploadées dans le cloud

### Bibliothèque
- [fix] Images insérées dans un document sont maintenant hébergées sur le serveur (était : stockées en base64 dans le contenu, alourdissait les documents)
- [chg] Le bouton image dans l'éditeur upload le fichier et insère un lien — comportement identique côté MJ

---

## v79 — 2026-06-04 — Fix placement tokens

### Playground — Tokens
- [fix] Tokens posés sur des demi-dalles (`slab_bottom`) ne flottent plus dans les airs
- [fix] Drop du token se fait maintenant à l'endroit exact où le ghost était affiché, pas là où pointe le curseur
- [fix] Ghost ne saute plus sur la case voisine en bord de voxel pendant le drag
- [fix] Crash écran noir au démarrage de session (TDZ `statusPanel`)

---

## v77 — 2026-06-04 — Optimisation Voxels Phase B

### Playground — Voxels
- [fix] Cubes avec textures multi-faces (east≠south≠top…) affichent désormais la bonne texture sur chaque face lors d'une rotation (r=1/2/3). Invisible avec les textures actuelles (toutes `all`) — correction active pour les futurs packs multi-faces.

---

## v76 — 2026-06-04 — Menu radial Token + Design System + Optimisation Playground

### Playground — Tokens
- [add] Menu radial SVG sur les tokens (clic simple) : 8 secteurs, style hard-SF HUD
- [add] "Fiche" : ouvre la fiche personnage directement depuis le token
- [add] "Retirer" : retire le token du plateau
- [add] Boussole directionnelle dans le cœur du menu : orienter le token en 8 directions
- [add] Cœur coloré selon la pire blessure active (jaune → rouge foncé)
- [add] Animation bloom + pulse danger si critique/mortelle
- [chg] Clic simple sur token = menu radial (était : rotation 45°)

### Playground — Performances voxels
- [perf] Rendu voxels : faces cachées entre cubes adjacents éliminées (face culling)
- [perf] Draw calls réduits de N voxels → nb_textures × 6 maximum
- [perf] Carte complexe : lag quasi supprimé (confirmé session)

### Design System — Interface
- [add] Police Venus Rising active sur les titres (Login, Dashboard)
- [add] 36 tokens CSS : surfaces session, couleurs blessures, accents statuts, familles de polices
- [add] 15 icônes HUD hexagonales de statuts (étourdi, hypothermie, en feu…)
- [add] Boutons harmonisés : style chamfré hard-SF unifié sur Dashboard, Sidebar, CombatOverlay, CombatActionWindow, SessionPage, LibraryPanel
- [add] Badges MJ/Joueur/Résultat chamfrés sur toutes les vues
- [add] Bouton "Quitter la session" dans l'onglet Profil (→ tableau de bord)
- [fix] Timeline mode combat : ne chevauche plus la sidebar (s'arrête au bord gauche de la sidebar)
- [chg] Bouton ⚔ Combat : rouge en mode combat actif, bleu sinon

---

## v75 — 2026-06-03 — Bibliothèque de campagne

### Bibliothèque
- [add] Onglet "Bibliothèque" dans la Sidebar : liste des documents de campagne accessibles
- [add] Éditeur de texte riche (Quill 2.0) : gras, italique, titres, listes, alignement, liens, couleurs, images inline
- [add] Notes du MJ : second éditeur visible uniquement par le MJ
- [add] Permissions par document : "Personne / Tous les joueurs / sélection individuelle" (dropdown multi-select)
- [add] Indicateurs de partage : œil masqué (non partagé), œil ouvert (tous), punaise colorée (joueur(s) spécifique(s))
- [add] Propagation temps réel : document créé/modifié/supprimé visible instantanément par les joueurs autorisés

### Interface
- [chg] Fusion onglets "Joueurs" et "Config" → onglet "Profil" (réglages en haut, liste connectés en bas)

---

## v74 — 2026-06-02 — CaC : Attaque multiple

### Combat — Corps à corps
- [add] Attaque multiple melee : déclarer 2 attaques (malus −5) ou 3 attaques (malus −7) en un tour (LdB p.218)
- [add] Sélection séquentielle des cibles dans le panel CaC (PJ) : N boutons "Choisir l'adversaire"
- [add] GM : chips "1 / 2 (−5) / 3 (−7)" dans le panneau CaC + queue étendue (N cibles par PNJ)
- [add] Résolution séquentielle dans le même slot : attaque 1 → résultat → attaque 2 → etc.

---

## v73 — 2026-06-01 — Correctifs UX & Playground

### Dashboard
- [fix] Boutons Créer/Rejoindre asymétriques → deux cartes identiques avec formulaire inline (filigrane + et →)
- [add] Carte "Rejoindre une campagne" avec champ pré-rempli #code-invitation toujours visible

### Playground — Tokens
- [fix] Étiquettes de nom des tokens ne faisaient pas face à la caméra (Billboard drei)
- [fix] Couleur des étiquettes ne correspondait pas à la couleur du joueur (user_color via JOIN)
- [fix] Drag & Drop imprécis sur terrain plat : token snappe désormais au centre de la case
- [fix] Drag & Drop décalé sur terrain en altitude : raycast voxel remplace plan y=0

### Fiche personnage
- [add] Panel description compétence : bouton ⓘ sur chaque compétence → panel fixe avec texte complet du LdB (scrollable, fermeture clic extérieur)

### Chat
- [fix] Messages partagés entre toutes les campagnes → chaque campagne conserve son propre historique

## v72 — 2026-06-01 — Multi-adversaires Corps à Corps

### Combat — Corps à corps
- [add] Malus encerclement CaC (LdB p.224) : −5 pour 2 adversaires, −7 pour 3, −10 pour 4+
- [add] Critère positionnel : tout ennemi à portée (3m + allonge de son arme) au moment de la résolution
- [add] Alerte ⚠ dans le popup défense PJ : "Encerclé — malus −X à votre défense" si applicable
- [add] Alerte ⚠ dans le panneau résultat melee : indique qui est encerclé et de combien

## v71 — 2026-06-01 — Timeline combat BG3-style

### Combat — Timeline initiative
- [add] Portraits illustrés plein format (illustration fiche personnage)
- [add] Bordure de carte = couleur de la pire blessure active (légère jaune → mortelle rouge foncé)
- [add] Carte active agrandie (64px vs 44px) avec halo doré
- [add] Phase Annonce : cartes triées INI croissante (lents à gauche), curseur flèche ←
- [add] Phase Résolution : cartes depuis les actions déclarées, curseur flèche →
- [add] Timer de tour (si configuré dans les options campagne) — vert/orange/rouge
- [add] Maximum 12 cartes affichées, badge +N pour le surplus
- [add] Animations fluides : entrée/sortie et réordonnancement si INI change (Motion FLIP)
- [fix] Portrait URL cassée (image jamais affichée depuis session 57)
- [fix] Blessures temps réel : bordure se met à jour sans rechargement

## v70 — 2026-06-01 — Token par défaut campagne + stabilité serveur

### Tokens 3D
- [fix] Crash écran noir quand un token sans modèle 3D est placé sur une carte
- [add] Token par défaut de campagne : le GM peut uploader un GLB dans les options campagne
- [add] Bouton "Réinitialiser" pour retirer le token par défaut de campagne
- [add] Hiérarchie fallback : modèle personnage → token campagne → défaut bundle → silhouette

### Serveur
- [fix] Migrations automatiques au démarrage du serveur (plus de migration manuelle)
- [fix] "Erreur lors de l'enregistrement" sur la page Options campagne (colonne inconnue)

## v69 — 2026-06-01 — Serveur Alpha Kiwi + correctifs UI

### Serveur distant Alpha "Kiwi"
- [add] Déploiement sur serveur Linux maison (accessible via internet)
- [add] Services systemd — démarrage automatique au boot, redémarrage en cas de crash
- [fix] api.js : baseURL hardcodée `localhost:3001` → `VITE_API_URL` (fix critique distant)
- [fix] Titres onglets navigateur : toutes les pages s'appelaient "client" → titres explicites par page
- [fix] SessionPage : titre dynamique `Enclume — <nom de la campagne>`

### Atelier du GM
- [fix] Bouton "Supprimer ce pack" maintenant visible sur les packs sans propriétaire (packs migrés)
- [fix] Séparation des droits : Export (propriétaire uniquement) vs Supprimer (propriétaire ou pack orphelin)

## v68 — 2026-05-31 — Modes de combat Corps à Corps + correctifs Dashboard

### Modes CaC (Sprint CaC 3)
- [add] Mode Défensif : aucune attaque, +3 défense si attaqué (LdB p.223)
- [add] Mode Retraite : aucune attaque, +5 défense si attaqué, recul optionnel gratuit (zone lente)
- [add] Recul Retraite : sélection destination en zone lente (identique Charge), ini_mod=0 forcé serveur
- [fix] Chips modes CaC : même couleur verte pour les 5 modes (Défensif/Retraite n'étaient pas verts)
- [fix] Mode Défensif/Retraite : arme QB non modifiée au clic — état arme inchangé (règle LdB)

### Modes CaC (Sprint CaC 2)
- [add] Mode Offensif : +3 attaque, −5 défense si attaqué — déclarable Phase 1
- [add] Mode Charge : +3 attaque, +3 dégâts, −7 défense / requiert ≥3m + déplacement court gratuit
- [add] Sélecteur de mode (chips) dans le panneau CaC côté joueur et côté GM
- [add] Charge PJ : flux séquentiel automatique (déplacement → cible, zone lente uniquement)
- [add] Charge PNJ (GM) : queue combinée move_short + cible, panneau droit étendu (720px)
- [add] Validation distance déplacée en Phase 2 (post-déplacement réel) — Phase 1 = intention libre
- [chg] GM : fenêtre Corps à corps étendue à 720px avec panneau droit dédié
- [chg] GM : batch PNJs libre (DST+CTC ensemble) — filtre type arme appliqué uniquement au démarrage assault
- [fix] Double sélection Assaut+CaC lors du clic CaC (GM) — corrigé
- [fix] Boutons "Passer" fantômes quand deux queues actives simultanément (GM) — corrigé

### Dashboard
- [fix] Formulaire "Rejoindre avec un code" restauré (champ absent depuis la refonte UI)
- [fix] Card "Créer une campagne" : label centré, "+" flottant supprimé

## v67 — 2026-05-31 — Corps à Corps, Rechargement en combat

### Corps à Corps (Sprint CaC 1)
- [add] Action "Corps à corps" déclarable en Phase 1 : sélection cible + arme de contact (ou mains nues)
- [add] Allonge des armes de contact respectée (lance +3m, bâton +2m, etc.)
- [add] Résolution en opposition : jet attaquant vs jet défenseur (Polaris LdB)
- [add] Défenseur PJ lance son dé interactivement — le slot reste bloqué jusqu'à confirmation
- [add] Dégâts melee : formule arme + Mod.Dom. (FOR_na) — identique au corps à corps Polaris
- [add] GM : sélection cible PNJ séquentielle (même queue que l'assaut)
- [add] Résultat opposition affiché (jets attaque/défense, touche ou esquive)
- [fix] Auto-ciblage impossible (on ne peut pas se cibler soi-même)
- [fix] Message d'erreur explicite si cible hors portée (distance affichée)
- [fix] Sélections décochées automatiquement au nouveau tour

### Rechargement en combat
- [add] Action "Rechargement" en Phase 1 : sélection munitions dans panneau droit
- [add] Phase 2 : résultat rechargement (succès / aucune munition) affiché au joueur
- [add] Option campagne : mode de rechargement Chargeur complet (défaut) ou Complément
- [chg] Le joueur ne clique plus "Agir" pour le rechargement — le MJ est maître du timing
- [fix] Exclusion mutuelle des actions de combat (Assaut, CàC, Rechargement, etc.)
- [fix] "Assaut (tir)" grisé automatiquement si chargeur vide

## v66 — 2026-05-30 — Décompte munitions, Jets Favoris, Test de Choc, i18n
- [add] Localisation i18n : 17 composants wired (fiche perso, builder, sidebar, sessions, auth…)
- [add] Fiche personnage : labels Polaris FR (attrs, stats, bio, tooltips allures LdB)
- [add] Système i18n prêt pour EN futur (structure Option C documentée)
- [chg] RegisterPage : traduite en français (était en anglais)
- [add] Décompte munitions en combat (ammo_remaining, skip si chargeur vide)
- [add] Option campagne : munitions illimitées pour les PNJs
- [add] Rechargement avec picker de variante de munition
- [add] Jets Favoris : macros en un clic depuis le DicePanel
- [add] Formulaire création macro avec aperçu du seuil en direct
- [add] Fenêtres combat déplaçables (drag + localStorage)
- [add] Changelog Dashboard (ce panneau)
- [add] Code d'invitation beta (accès sécurisé)
- [add] Test de Choc : résultat affiché (Résistance / Étourdi / Inconscient) + is_stunned appliqué
- [fix] Sévérité promue correctement diffusée dans résultats PNJ (bug P49)

## v65 — 2026-05-28 — Combat avancé, Pathfinding, DicePanel v3
- [add] Sélecteurs d'état dynamiques (couverture, vitesse, mode de tir)
- [add] Déclaration assaut avec sélection de cible sur le canvas
- [add] Déplacement PNJ séquentiel avec queue
- [add] Assaut PNJ (mode minimal) avec picker cible
- [add] Pathfinding A* Chebyshev en temps réel pour le déplacement combat
- [add] Raycast précis sur terrain élevé (fast-voxel-raycast)
- [add] Roue radiale D20 avec favoris persistants et jets secrets au MJ
- [chg] Refonte complète DicePanel v3

## v64 — 2026-05-24 — Jets d'attaque, Dégâts, Blessures combat
- [add] Phase Résolution : jets d'attaque, dégâts, blessures localisées
- [add] Fenêtre dégâts joueur (animation + résultats colorés par sévérité)
- [add] Jet de toucher interactif côté joueur (CombatModifiersWindow)
- [add] Déclaration assaut : cadence CC/RC/RL, dual-wield, sélection cible
- [fix] Calcul compétence arme via chaîne weapon_inv_id → ref_equipment_skill_assoc

## v62 — 2026-05-18 — Phase Résolution combat
- [add] Phase Résolution complète : slots, avancement, fin de tour
- [add] Déplacement combat avec zones A* et anneaux concentriques
- [chg] Payload déclaration v2 — états + mapActions + quick

## v57 — 2026-05-10 — Fondations combat Polaris
- [add] Timeline initiative, phases Surprise, Annonce & Résolution
- [add] Roster de combat avec vérification équipement pré-combat
- [add] Fenêtre déclaration PJ (21 actions, multi-select, INI delta)
- [fix] Distinction PJ / PNJ / Entité de décor (PC27)

