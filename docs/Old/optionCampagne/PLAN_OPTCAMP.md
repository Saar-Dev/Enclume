# Options de campagne — effets mécaniques — suivi de progression
> Mis à jour 2026-07-05 — Session 132 suite

Niveau 1 — la mécanique existe déjà, juste pas branchée sur le toggle GM (4 options)

Option	État	Le vrai problème
✅ ambiance	FAIT (Session 132 suite) — `WizardCreation.jsx` (mock supprimé), `creationStore.js`, `creationService.js` (`startCreation` transmet + `finalizeCreation` revalide via `validateStep1`) | Calcul complet (shared/polarisUtils.js), mais WizardCreation.jsx:38 utilisait mockAmbiance = 'INTERMEDIAIRE' en dur — corrigé
🔲 feminin_bonus	PROCHAIN SUJET | Bonus COO/PRE validé (polarisUtils.js G4), mais le sélecteur Sexe est toujours affiché à tous, indépendamment du toggle — la prop reçue est explicitement renommée _deprecated et jamais utilisée (Step1Attributes.jsx:36)	
🔲 random_mutations	 | Jet 1D20 + achat payant tous les deux codés (Step3Mutations.jsx), mais les deux méthodes sont toujours proposées au choix libre, jamais conditionnées	
🔲 skill_prerequisites (†)	 | Contrôle de prérequis déjà actif dans SkillsPanel.jsx:166-170 — mais appliqué en permanence, alors que le défaut documenté est OFF	
→ Pour ces 4, "brancher" = remplacer un mock/comportement inconditionnel par une vraie lecture de campaign.settings.X. Relativement contenu.

**Bonus découvert en câblant `ambiance`** : `validateStep1(attributs, ambiance, pcDispo, isFeminin)` existait déjà dans `shared/polarisUtils.js:187-231` (budget exact G1, PC max G2, bornes G3, bonus féminin G4) mais n'était appelée nulle part (code mort) — maintenant branchée dans `finalizeCreation` pour revalider `step1` côté serveur.

Niveau 2 — scaffolding DB présent, logique métier absente (2 options)

random_pro_advantages : colonnes pro_advantages/random_picks existent sur char_careers, jamais remplies — aucune table de référence, aucune UI de tirage.
revers : table ref_setbacks créée mais seedée avec 5 lignes sur ~50 attendues (dette déjà notée dans le code même : [DETTE-ETAPE4-5]), aucun déclencheur "tous les 3 ans après 10 ans d'XP".
Niveau 3 — quasi rien (5 options)

polaris_latent : aucun avantage seedé, aucune contrainte "1 par groupe".
skill_max_level : la fonction getMaxMasteryByYears() existe (polarisUtils.js:127) mais n'est appelée nulle part — code mort.
skill_natural_prog : pareil, calcSkillCost jamais appelé, aucun gain auto +1/an.
young_penalty : rien — getAgeEffects() ne couvre que les malus de vieillesse, pas 16-19 ans.
celebrity : une seule trace inerte (un avantage seedé avec mod_gauges.celebrity: 12, jamais lu par aucun service). Tout reste à construire (jauge, gain annuel, Tests).