## v0.8.0 — 2026-05-30 — Jets Favoris & Fenêtres combat
- [add] Macros "Jets Favoris" en un clic depuis le DicePanel
- [add] Formulaire création macro avec aperçu du seuil en direct
- [add] Fenêtres combat déplaçables (drag + localStorage)
- [fix] Sélection du personnage cible pour les macros GM
- [add] Code d'invitation beta (8 chiffres, accès sécurisé)

## v0.7.8 — 2026-05-22 — Combat : états dynamiques
- [add] Sélecteurs d'état (couverture, vitesse, mode de tir)
- [add] Matrices de coût INI asymétriques par transition d'état
- [add] Déclaration d'assaut avec sélection de cible sur le canvas
- [chg] Payload déclaration v2 — states + mapActions + quick

## v0.7.5 — 2026-05-18 — Phase résolution & dégâts
- [add] Phase Résolution : jets d'attaque, dégâts, blessures localisées
- [add] Fenêtre dégâts joueur (animation + résultats colorés)
- [add] Jet de toucher interactif côté joueur
- [fix] Calcul skillTotal via chaîne weapon_inv_id → ref_equipment_skill_assoc

## v0.7.0 — 2026-05-10 — Lanceur de dés v3
- [add] Roue radiale D20 avec favoris persistants
- [add] Jets secrets au MJ
- [add] D20 normales Blender exactes (20 faces validées)
- [chg] Refonte complète DicePanel

## v0.6.5 — 2026-05-02 — Déplacement combat
- [add] Zones de déplacement concentriques (4 allures Polaris)
- [add] Mode déplacement GM/PNJ séquentiel
- [fix] Altitude anneaux combat PE34 (pos_z + 1.0)

## v0.6.0 — 2026-04-24 — Fondations combat
- [add] Timeline initiative, phases Surprise & Annonce
- [add] Roster de combat avec vérification équipement pré-combat
- [add] Fenêtre déclaration PJ (21 actions, multi-select)
- [fix] Distinction PJ / PNJ / Entité de décor (PC27)
