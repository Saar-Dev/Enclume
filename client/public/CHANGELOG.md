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
