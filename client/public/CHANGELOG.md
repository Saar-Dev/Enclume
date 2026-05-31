## v67 — 2026-05-31 — Rechargement en combat, options campagne
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
