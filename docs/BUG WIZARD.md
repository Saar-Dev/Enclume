Liste des bugs – Wizard de création de personnage
#	Bug / Remontée	Statut	Analyse & Correctif
Critiques – Bloquants ou corruption			
1	« Méthode de mutation invalide : null » (Étape 4 / Voir ma fiche)	✅ Corrigé (code) — non testé navigateur	Cause : getStep3State peut renvoyer method: null pour un personnage n’ayant que des mutations ‘revers’. openPeek/handleTerminate lisent des variables fermées, pas le store à jour. Correctif : remplacer null par 'none' dans getStep3State ; utiliser useCreationStore.getState() dans openPeek/handleTerminate. **Fix réel (2026-08-11)** : les deux correctifs proposés appliqués tels quels — `getStep3State` (`creationService.js`) et `openPeek`/`handleTerminate` (`WizardCreation.jsx`). Détail `docs/JOURNAL8.md`.
2	Organe sensoriel manquant coûte des PC au lieu d’en donner	✅ Corrigé (code) — non testé navigateur	Cause : Données incorrectes dans ref_mutations.cost_pc (valeur positive au lieu de négative). Correctif : corriger le seed ou la migration pour que les mutations désavantageuses aient un cost_pc négatif. Aucune modification de code nécessaire. **Fix réel (2026-08-11)** : « aucune modification de code nécessaire » était faux — le filtre `Step3Mutations.jsx` (`cost_pc >= 0`) excluait aussi toute mutation désavantageuse de l'écran d'achat, contredisant la RAW (`REGLE_CREATION.md:761-767`, achat délibéré d'une mutation désavantageuse autorisé et rémunéré). Migration 235 (signe cost_pc) + filtre corrigé + libellé i18n `step3.gain`. Détail `docs/JOURNAL8.md`.
3	Finalisation – Toutes les compétences remises à zéro	✅ Corrigé (code) — non testé navigateur	Cause : handleTerminate utilise des variables fermées ; getStep4State ne restitue pas les allocations, renvoyant skillAllocations: {} qui efface les compétences lors d’une réhydratation. Correctif : utiliser useCreationStore.getState() dans handleTerminate ; reconstruire skillAllocations dans getStep4State à partir de char_skills.mastery et des bonus d’origine. **Fix réel (2026-08-11)** : cause racine différente — `WIZARD_STATE_SYNC` s'auto-diffuse à l'émetteur (`creation.js`), écrasant le store avec l'écho lacunaire de `getStep4State` ; `openPeek`/`handleTerminate` renvoient ensuite ce step4 corrompu, que `reconcileCreation` réinsère tel quel (char_skills vidé). Reconstruction par recalcul jugée trop risquée (duplication du moteur de background) — persistance brute à la place : migration 236 (`char_pc_ledger.skill_allocations`/`autodidacte_allocations`), lues par `getStep4State`. Détail `docs/JOURNAL8.md`.
4	Finalisation – Message « PC insuffisants : 1 requis » avec 0 PC restants	✅ Corrigé (code) — non testé navigateur	Cause : pc_postcreation dans char_pc_ledger n’est pas pris en compte par getPcDispo() côté client, créant un écart avec le calcul serveur (sufficient_pc dans advantageConstraints.js). Correctif : vérifier la valeur de pc_postcreation en base (valeur résiduelle ?) et aligner le calcul client ou remettre à zéro pc_postcreation lors du démarrage d’un nouveau brouillon. **Fix réel (2026-08-11)** : `pc_postcreation` n'est écrit nulle part dans le serveur (toujours 0), écarté comme cause. Vraie cause : `getStepBudget()` (`creationStore.js`, prop `pcDispo` de Step3Mutations/CareersAllocator/Step5Advantages) incluait la contribution déjà committed de l'étape en cours d'édition, double-comptée avec le recalcul local du composant au retour sur une étape déjà validée. `getStepBudget(excludeStep)` corrige. Même dette que `EN_COURS.md` WIZ-2. Détail `docs/JOURNAL8.md`.
5	Étape 7 – L’âge progresse à chaque test sans jamais régresser	✅ Corrigé (code) — non testé navigateur	Cause : Le serveur stocke l’âge final dans char_archetype.age mais getStep4State le restitue comme âge de base ; le client le réutilise comme base, provoquant un cumul à chaque cycle. Correctif : stocker l’âge de base séparément (nouvelle colonne base_age) ou renvoyer un âge de base fixe (16 ans) dans getStep4State. **Fix réel (2026-08-11)** : colonne `base_age` séparée (migration 237), `getStep4State` renvoie aussi `finalAge` (régression que ce fix aurait introduite seule, trouvée par l'audit round-trip). Détail `docs/JOURNAL8.md`.
6	Récapitulatif – Métiers affichés en UUID au lieu de leur nom	Corrigé	Déjà résolu par l’ajout d’une jointure dans getStep4State. La version actuelle du code n’est pas affectée.
7	Playground – Augmentation possible des compétences limitatives sans prérequis	✅ Corrigé (code) — non testé navigateur	Cause : L’option skill_prerequisites est désactivée par défaut ; sans elle, ni le client ni le serveur ne vérifient SKILL_MIN. Correctif : Activer l’option par défaut, ou rendre la vérification indépendante de l’option. **Fix réel (2026-08-11)** : le mécanisme (route + SkillsPanel.jsx) était déjà cohérent client/serveur — seul le défaut était en cause. `SETTINGS_SCHEMA.skill_prerequisites.default` → `true` (LdB p.190, marqueur † présenté comme "NÉCESSAIRE (OPTIONNEL)" donc actif par défaut). Campagne réelle « La Forêt Maudite » basculée manuellement (avait déjà `false` explicite en JSONB, le changement de défaut seul ne l'aurait pas atteinte). Détail `docs/JOURNAL8.md`.
8	Playground – Module « arme » n’existe plus	Résolu	Le module WeaponPanel a été déplacé dans un onglet « Matériel » dédié. Il s’agit d’un défaut d’information, pas d’un bug.
Majeurs – Comportement incorrect mais contournable			
9	Points de compétence déjà investis mal calculés (Step 4)	Analysé	Cause : getStep4State renvoie skillAllocations: {}, effaçant les allocations lors d’un retour à l’étape 4. Correctif : reconstruire skillAllocations dans getStep4State (cf. bug #3) ou les persister dans une table dédiée.
10	Impossible d’empêcher / griser les compétences trop chères → soldes négatifs	Analysé	Conclusion : Le grisage fonctionne dans CareersAllocator et AutodidacteAllocator. Le bug n’est pas reproductible avec le code actuel ; il a probablement été corrigé entre-temps.
11	Les tirages d’avantages optionnels semblent coûter des points de compétence	Analysé	Cause : Confusion UX – le tirage retire 5 points du budget « avantages pro », pas des points de compétence. Conforme RAW. Correctif : améliorer la clarté de l’interface (libellés, tooltips).
12	Mutation Parasite : jet de dé non implémenté	✅ Corrigé (donnée) — non testé navigateur	Cause : rollOneMutation ne contient pas de logique pour le sous-jet 1d4. Correctif : ajouter un tirage 1d4 dans rollOneMutation et stocker le résultat dans count. **Fix réel (2026-08-11)** : solution proposée écartée (champ `count` ad hoc + cas spécial mutation_id, alors que `char_mutations.count` a déjà un sens générique différent — "nombre de fois choisie", utilisé par la vue SQL `char_mutation_effects`, migrations 109/127/128). "Parasite" a exactement la même structure RAW ("Lancez 1D4") que "Caractère génétique animal" (mutation_id 6), déjà géré par le mécanisme sous-type existant (`has_subtable`/`ref_mutation_subtypes`, `rollOneMutation`/modal d'achat déjà génériques). Migration 238 : 4 sous-types "1 à 4 parasites" ajoutés en donnée — zéro modification de code client ou serveur. Vérifié en base (GET /mutations, getStep3State round-trip réel). Détail `docs/JOURNAL8.md`.
13	Avantages & revers : aucun broadcast vers le MJ	✅ Corrigé (code) — non testé navigateur	Cause : useEffect de diffusion live dans Step4Experience.jsx ne liste pas proAdvantages ni randomPicks comme dépendances. Correctif : ajouter ces champs aux dépendances. **Fix réel (2026-08-11)** : diagnostic confirmé exact (ESLint le confirme indépendamment — `react-hooks/exhaustive-deps` sur l'ancien useEffect). Plutôt que d'ajouter ces 2 champs à la liste de deps *manuellement dupliquée* de l'effet (la solution proposée, qui referait dériver silencieusement au prochain champ ajouté à buildPayload), `buildPayload` est passé en `useCallback` avec sa propre liste de deps — vérifiable par ESLint contre son propre corps, effet réduit à `[buildPayload, onLiveChange]`. `npx eslint` : warning disparu. Détail `docs/JOURNAL8.md`.
14	Vérifier le maximum de points d’Attribut humainement possible selon RAW	Analysé	Conclusion : La limite à 20 est déjà appliquée côté client (Step1Attributes) et côté serveur (validateStep1). Aucune anomalie détectée.
15	L’âge n’est pas réinitialisé entre deux boucles de test	Analysé	Même cause que le bug #5. L’âge final persistant est réinterprété comme âge de base lors d’une réhydratation.
16	Traduction manquante : « Sens diminué (hearing) », « Faiblesse naturelle (drug) » et autres.	✅ Corrigé (donnée) — non testé navigateur	Cause : Données en anglais dans ref_advantages.name. Correctif : traduire les termes entre parenthèses dans les seeds de la table ref_advantages. **Fix réel (2026-08-11)** : diagnostic confirmé (Step5Advantages.jsx et AdvantagesPanel.jsx affichent bien `adv.name` directement, aucune indirection i18n). Migration 239 : 14 lignes réellement anglaises corrigées (vue/ouïe/odorat/toucher/goût, maladie, drogue) ; "poison" et "radiation" laissés tels quels (mots identiques en français, `REGLE_AVANTAGES.md:154`). Re-scan complet `ref_advantages.name`/`description` après coup : plus aucun terme anglais résiduel. Note du doc écartée après vérification : la correction n'"entraîne" pas la validation de `PLAN_LOCALISATION.md` (chantier disjoint — texte JSX en dur, pas données de référence). Détail `docs/JOURNAL8.md`.
Note : La correction de 16 entraine la validation de @PLAN_LOCALISATION (test beta-testeur achevé et corrigé)
Mineurs – UI / ergonomie			
18	Absence de textes de tutoriel en haut de chaque étape	Spécifié	Textes rédigés, contraintes i18n définies, composant StepTutorial à créer. À implémenter.
19	Main directrice modifiable manuellement après un tirage RAW	✅ Corrigé et testé en navigateur (2026-08-11)	Cause : Le <select> reste actif après tirage ; l’option Ambidextre est accessible sans coût. Correctif : désactiver le <select> après tirage ou le remplacer par un affichage texte ; retirer l’option ‘A’. **Fix réel (2026-08-11)** : cause confirmée mais correctif limité à l'option "A" (R/L restent librement modifiables — pas de règle RAW l'interdisant, contrairement à l'Ambidextre qui est un Avantage payant, `ref_advantages adv_002`, `cost_pc: 1`). `<option value="A" disabled={handPref !== 'A'}>` — non sélectionnable manuellement, atteignable uniquement via le bouton de tirage (renommé "Lancer 2D10", était "Définir", `creation.json`). Pas de garde serveur (incohérent avec les autres tirages Wizard, tous client-only sans aller-retour — aurait aussi rejeté à tort un vrai jet gagnant, indistinguable côté serveur d'une triche). Pas d'exemption MJ (le trait suit la même règle RAW pour un PJ créé par le MJ ; accès freeform déjà disponible hors Wizard via `PUT /char-sheet/:id/identity`). Détail `docs/JOURNAL8.md`.
20	Bouton « Suivant » grisé sans explication si le nom est vide	✅ Corrigé et testé en navigateur (2026-08-11)	Cause : Aucun message n’indique que le nom est requis. Correctif : ajouter un message conditionnel « Entrez un nom pour continuer ». **Fix réel (2026-08-11)** : diagnostic confirmé tel quel — `canNext` combine nom ET répartition valide, seul le cas répartition invalide avait un message. Bloc conditionnel ajouté (`charName.trim().length === 0`), indépendant de `validation.valide` (peut s'afficher simultanément à l'autre avertissement). Clé i18n `step1.name_required_warning`. Détail `docs/JOURNAL8.md`.
21	Carte « Aucune mutation » trop peu visible (Step 3)	✅ Corrigé et testé en navigateur (2026-08-11)	Correctif : améliorer le contraste et ajouter une icône. **Fix réel (2026-08-11)** : diagnostic confirmé (`noneTitle`/`noneDesc` en `#5a5a7a`/`#3a3a5e` sur fond quasi-noir, bordure identique au fond, contre `#c0c0d0`/`#6a6a8a` pour une carte mutation normale). Couleurs rapprochées du contraste des cartes (`#9090c8`/`#6a6a8a`), bordure éclaircie, icône "⊘" ajoutée. Détail `docs/JOURNAL8.md`.
22	Bouton Suivant placé tout en bas en mode Autodidacte (Step 4)	✅ Corrigé et testé en navigateur (2026-08-11)	Cause : La barre de navigation est dans le flux normal et repoussée par AutodidacteAllocator. Correctif : rendre la navigation sticky ou limiter la hauteur de l’allocateur. **Fix réel (2026-08-11)** : cause confirmée mais plus sévère que "tout en bas" — `WizardCreation.jsx` (`body: overflow:hidden`) coupe silencieusement tout contenu au-delà de sa hauteur, le bouton pouvait devenir totalement inatteignable, pas juste éloigné. Ni sticky (absent du reste du projet) ni max-height sur l'allocateur seul (aurait isolé son scroll du reste du contenu) : patron `container`(overflow:hidden)/`scroll`(flex:1, overflowY:auto, minHeight:0)/`nav`(flexShrink:0, hors du scroll) déjà utilisé par `StepMaterielEtBiens.jsx`, appliqué à `BackgroundSelector.jsx` (partagé par les 3 sous-étapes Origine géo/sociale/Formation, pas seulement Autodidacte). `Step4Experience.jsx` : `minHeight:0` ajouté sur son propre container, nécessaire pour que le scroll interne se déclenche. Détail `docs/JOURNAL8.md`.
23	Grille de répartition des compétences visible avant sélection d’une profession	✅ Corrigé et testé en navigateur (2026-08-11)	Correctif : conditionner l’affichage du board à selectedCareers.length > 0. **Fix réel (2026-08-11)** : diagnostic confirmé, appliqué tel quel — `wiz4-board` (`CareersAllocator.jsx`) enveloppé dans `{selectedCareers.length > 0 && (...)}`. Remontée par Saar en test réel avec une précision supplémentaire (ne s'affiche qu'une fois les années d'une profession confirmées via "Ajouter", pas juste sélectionnée dans la liste) — même correctif, `selectedCareers` est déjà le tableau des carrières ajoutées, pas la sélection en cours d'édition. Détail `docs/JOURNAL8.md`.
24	Boutons -/+ non harmonisés (Step 4)	Analysé	Les trois allocateurs utilisent les mêmes classes CSS (wiz4-sbtn). L’incohérence éventuelle vient du contexte CSS parent. Vérifier et uniformiser le style global.
25	Icône /!\ trop petite (Step 4 Profession)	Analysé	Correctif : augmenter la font-size de la classe wiz4-restr dans le CSS.
26	Tableau des attributs trop large (Step 2)	Analysé	Correctif : ajouter overflowX: auto et réduire la taille de police des en-têtes.
27	Tooltip explicatif manquant sur le génotype (Step 2)	Analysé	Couvert par les tutoriels globaux (bug #18). Sinon, ajouter un tooltip sur les cartes.
28	Avantages/désavantages à regrouper par famille (Step 5)	Analysé	Correctif : utiliser le champ family des données pour créer des groupes visuels dans Step5Advantages.jsx.
Fonctionnalités absentes			
29	Prérequis des carrières visibles dans l’UI	À implémenter	Les données sont disponibles dans ref_career_prerequisites ; les afficher lors de la sélection d’une carrière.
30	Wishlist de matériel avec validation du MJ (Step 6)	À implémenter	Nouvelle fonctionnalité.
31	Type de munition des armes affiché (Step 6)	À implémenter	Données probablement déjà disponibles.
32	Implants avec niveaux conformes aux règles RAW	À implémenter	Vérifier la logique existante et ajouter la gestion des niveaux.
Déjà corrigés ou non reproductibles			
33	Bug 18 (non spécifié)	✅ Corrigé	
34	Bug 22 (non spécifié)	✅ Non existant	

--------------------------------------------------------

Bug #15 — Compétences inabordables non grisées → soldes négatifs

Ce que le code montre :

    Le serveur valide strictement le budget de compétences via computeSkillAllocation :
    js

    if (err.code === 'over_budget') {
      throw new AppError(400, `Budget de compétences dépassé : ${err.totalCost} pts dépensés sur ${err.budget} disponibles`)
    }

    Donc un solde négatif est rejeté côté serveur. Mais cette validation n'a lieu qu'à la réconciliation, pas en temps réel dans le composant client.

Verdict : Le bug #15 est purement client. Le composant Step4Experience.jsx (ou CareersAllocator.jsx) doit griser les boutons + quand le coût dépasse le budget disponible. Le serveur rejette déjà correctement, mais l'expérience utilisateur est dégradée car le joueur découvre l'erreur seulement en soumettant.

Bug #9 — Sous-étape Autodidacte très longue, bouton Suivant tout en bas

Ce que le code montre :

    BackgroundSelector est un composant générique partagé par plusieurs sous-étapes (origine géo, sociale, formation, études supérieures). Il n'est pas spécifique à l'Autodidacte.

    Quand selectedItem.isAutodidacte est vrai, le composant <AutodidacteAllocator> est rendu dans le flux normal du conteneur (lignes ~138-142), avant la barre de navigation :
    jsx

    {selectedItem.isAutodidacte && (
      <AutodidacteAllocator
        refSkills={refSkills}
        allocations={autodidacteAllocations}
        onChange={onAutodidacteAllocationsChange}
      />
    )}

    La barre de navigation (s.nav, boutons Précédent/Suivant) est rendue après tous les détails, tout en bas du conteneur. Aucun footer sticky ou position fixed n'est utilisé.

    Le conteneur lui-même a display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '18px'. Rien ne garantit que le bouton reste visible si le contenu est long.

Verdict : La cause est confirmée. Le composant AutodidacteAllocator (dont la hauteur est potentiellement très grande — 7 points à répartir sur une longue liste de compétences) est inséré dans le flux normal, repoussant le bouton Suivant hors de l'écran. Le correctif doit soit :

    Rendre la barre de navigation sticky (position: sticky; bottom: 0; avec fond opaque), ou

    Donner une hauteur maximale à AutodidacteAllocator avec scroll interne, ou

    Faire les deux.

Fichier à modifier : BackgroundSelector.jsx (style de la navigation) et/ou AutodidacteAllocator.jsx (hauteur maximale).

Bug #10 — Grille de répartition visible avant sélection d'une profession

Ce que le code montre :

Le board de compétences (lignes ~220-270) est rendu sans aucune condition. Le bloc <div className="wiz4-board"> est présent à tous les coups, même si selectedCareers est vide. Aucune vérification du type {selectedCareers.length > 0 && ...} n'existe avant d'afficher la grille.

Verdict : Confirmé. La grille de répartition des points de compétences apparaît avant que le joueur n'ait ajouté la moindre profession. Le correctif est simple : envelopper le board dans une condition selectedCareers.length > 0.

Bug #13 — Points déjà investis mal calculés

Ce que le code montre :

Le calcul est entièrement délégué à computeSkillAllocation (importée depuis shared/careerSkills.js), qui prend state.skillAllocations et le contexte (carrières, bonus d'origine, plafonds). CareersAllocator ne fait qu'afficher le résultat (allocationResult.remaining, allocationResult.budget, allocationResult.errors). Aucun calcul local ne pourrait diverger.

Verdict : Si les points déjà investis sont mal calculés, la cause est dans computeSkillAllocation ou dans la manière dont le contexte est construit (skillAllocationCtx). Le composant lui-même est innocent. Pour vérifier, il faut lire shared/careerSkills.js.

Bug #15 — Compétences inabordables non grisées

Ce que le code montre :

Les boutons + sont déjà désactivés côté client via handleAllocInc :
js

const handleAllocInc = (row) => {
    if (allocationResult.remaining <= 0 || row.target >= row.cap) return
    dispatch(...)
}

Et dans le rendu :
js

<button
    className={`wiz4-sbtn${...}`}
    onClick={() => handleAllocInc(row)}
    disabled={allocationResult.remaining <= 0 || row.target >= row.cap}
>＋</button>

Le grisage fonctionne donc déjà côté client pour le budget de points de compétence.

Verdict : Le bug #15 n'est pas présent dans CareersAllocator. Si un testeur a vu des soldes négatifs, c'est probablement via l'Autodidacte (AutodidacteAllocator dans BackgroundSelector) ou via les boutons -/+ d'une autre étape (Step 1, Step 3, Step 5). Pour les compétences professionnelles, la validation temps réel est déjà en place.
---
#bug #1 — « Méthode de mutation invalide : null »
Cause racine

Le bug se situe dans WizardCreation.jsx, dans les fonctions openPeek (ligne ~138) et handleTerminate (ligne ~155). Ces deux fonctions envoient un payload complet au serveur en lisant step3Data depuis la fermeture du composant (variable JavaScript capturée lors du dernier rendu), et non depuis le store Zustand frais au moment du clic.
js

const openPeek = async () => {
    // ...
    await api.post(`/creation/${sheetId}/reconcile`, {
        step1: step1Data, step2: step2Data, step3: step3Data,  // ← variable fermée
        step4: step4Data, step5: step5Data,
    })
}

Le scénario de déclenchement est le suivant :

    Le joueur valide l’étape 3 normalement → step3Data dans le store vaut { method: 'chosen', ... }.

    Il revient plus tard à l’étape 3 et clique sur « Changer de méthode ». Le state local de Step3Mutations passe à method: null, mais le store n’est pas modifié (aucun appel à setStep3Data dans handleBackToMethod). L’ancienne valeur persiste dans le store.

    Il quitte l’étape 3 sans re-valider. Le store contient toujours l’ancienne valeur valide.

    À un moment ultérieur, loadExistingSheet est rappelé (ex. rechargement de page, ou le gmSyncKey côté MJ force un remontage). getStep3State lit les mutations en base et peut renvoyer method: null si la base ne contient que des mutations de source 'revers' (écrites par l’étape 4) ou aucune mutation 'chosen'/'random'. Le store est alors mis à jour avec step3Data: { method: null, ... }.

    Le joueur arrive à l’étape 6 ou 7 et clique sur « Voir ma fiche » ou « Finaliser ». La variable step3Data capturée par le rendu courant vaut { method: null, ... }. Le serveur reçoit method: null → AppError 400.

Pourquoi c’est subtil

Le flux normal (validation via advanceStep) met à jour le store AVANT l’appel API, donc la valeur envoyée est toujours fraîche. Mais openPeek et handleTerminate ne passent pas par advanceStep : elles lisent directement les variables du scope, qui peuvent être stale si un effet asynchrone (comme applyStateSync ou loadExistingSheet) a modifié le store entre le rendu et le clic.

De plus, getStep3State peut légitimement renvoyer method: null pour un personnage qui n’a eu que des mutations de source 'revers' (octroyées par l’étape 4, Revers ou tirages de carrière). C’est un état valide en base, mais le serveur le refuse dans le payload de reconcile car il attend toujours 'chosen', 'random' ou 'none'. Le serveur n’a pas tort de rejeter null (c’est un invariant métier), mais getStep3State ne devrait jamais renvoyer une valeur que reconcileCreation refuse ensuite.
Correctif proposé

Option A (défensive, la plus robuste) — côté serveur : dans getStep3State, quand aucune mutation 'chosen' ni 'random' n’existe mais que des mutations 'revers' sont présentes, retourner method: 'none' plutôt que null. Cela reflète la réalité : le joueur n’a pas choisi de mutation au step 3, il n’en a reçu que via l’étape 4. Le serveur acceptera 'none' sans erreur.
js

// getStep3State — correction
const method = mutations.some(m => m.source === 'random') ? 'random'
    : mutations.some(m => m.source === 'chosen') ? 'chosen'
    : 'none'  // ← était null, corrigé

Option B (défensive, côté client) : dans openPeek et handleTerminate, lire les données depuis useCreationStore.getState() au moment du clic, plutôt que depuis les variables fermées par le rendu. Cela garantit que la valeur envoyée est toujours la dernière en date. Mais cela ne corrige pas le problème de fond si getStep3State renvoie null.

Recommandation : appliquer les deux correctifs. Le correctif serveur (getStep3State) empêche la valeur null d’entrer dans le store. Le correctif client (getState() dans openPeek/handleTerminate) protège contre toute future incohérence similaire sur d’autres étapes.
Fichiers à modifier

    server/src/services/creationService.js — fonction getStep3State, ligne ~260 : remplacer null par 'none'.

    client/src/components/creation/WizardCreation.jsx — fonctions openPeek et handleTerminate : remplacer les variables capturées par useCreationStore.getState().stepNData.

Impact

    Données : aucun impact sur les données existantes. 'none' est déjà une valeur acceptée par reconcileCreation, elle signifie « aucune mutation volontaire ».

    Comportement : le récapitulatif (étape 7) affichera « Aucune mutation » au lieu de potentiellement ne rien afficher, ce qui est plus juste.

    Régression : aucune. 'none' est traité identiquement à null dans tout le reste du code, sauf qu’il passe la validation.

Testé / Non testé

    Testé : analyse statique du flux de données, identification de la source exacte.

    Non testé : reproduction en conditions réelles (le bug est probablement intermittent, lié à un rechargement ou un remontage de composant). ⚠️ clos partiel.

---
Bug #2 — Organe sensoriel manquant coûte des PC au lieu d’en donner
Analyse

Le calcul du coût total des mutations achetées dans Step3Mutations.jsx est :
js

const totalCost = selected.reduce((sum, m) => sum + (findMutation(m.mutation_id)?.cost_pc || 0), 0)

Le filtrage des mutations disponibles dans la grille d’achat est :
js

const availableMutations = mutations.filter(m => m.cost_pc >= 0 && m.cost_pc <= pcLeft)

Cela signifie que :

    Une mutation avec un coût négatif (qui rapporterait des PC) est exclue de l’achat. C’est conforme à la règle : « Les mutations désavantageuses sont réservées au tirage aléatoire ou à l’étape 5. » Elles ne doivent pas être achetables.

    Une mutation avec un coût positif est affichée et soustrait bien ce montant du total des PC disponibles.

Le bug ne peut donc pas provenir d’un problème de code (inversion de signe, calcul erroné). Si l’organe sensoriel manquant coûte des PC, c’est que son champ cost_pc dans la table ref_mutations est positif (ou nul). Or cette mutation est un désavantage : elle devrait avoir un cost_pc négatif (ex. -3) ou bien ne pas être disponible à l’achat du tout. Avec un cost_pc >= 0, elle passe le filtre et apparaît comme une mutation payante, d’où le comportement observé.
Cause racine probable

Erreur de données : la valeur de cost_pc pour la mutation « Organe sensoriel manquant » (et peut-être d’autres mutations désavantageuses) est incorrecte en base de données (positive au lieu de négative).
Vérification nécessaire

Il faut contrôler la ligne correspondante dans ref_mutations. Peux-tu exécuter cette requête ou me fournir le fichier de seed correspondant ?
sql

SELECT mutation_id, name, cost_pc FROM ref_mutations WHERE name ILIKE '%organe%';

Correctif attendu

    Mettre à jour cost_pc avec une valeur négative conforme aux règles (ex. -3 si elle rapporte 3 PC).

    Vérifier que les autres mutations désavantageuses (ex. « Sens diminué », « Faiblesse naturelle », etc.) ne présentent pas la même erreur.

    Aucune modification de code nécessaire si l’on conserve la règle « pas de désavantage achetable dans Step3 ». Les mutations avec cost_pc < 0 seront automatiquement exclues de la grille.
---
bug #3 — Toutes les compétences remises à zéro à la finalisation
Contexte

Le symptôme : après avoir cliqué sur « Finaliser », le personnage se retrouve avec ses compétences remises à zéro. Le code concerné est la réconciliation finale dans reconcileCreation (bloc STEP4) suivi de lockWizard, le tout appelé depuis handleTerminate dans WizardCreation.jsx.
Ce que fait le serveur

Dans reconcileCreation, quand step4 est présent :

    Suppression complète (DELETE) de toutes les lignes dans char_skills pour ce sheetId.

    Réapplication de tous les bonus de background (upsertSkillBonus).

    Parcours des carrières et validation des allocations de compétences.

    Insertion ou mise à jour de chaque compétence avec sa maîtrise target.

Si cette logique est exécutée correctement, les compétences sont persistées. Le problème vient donc d’un payload step4 absent, incomplet ou avec skillAllocations vide au moment de l’appel final.
Ce que fait le client
js

const handleTerminate = async () => {
    // ...
    await api.post(`/creation/${sheetId}/reconcile`, {
        step1: step1Data, step2: step2Data, step3: step3Data,
        step4: step4Data, step5: step5Data,
        finalize: true,
    })
}

Les variables step1Data..step5Data sont capturées par le rendu du composant. Comme pour le bug #1, si le store est modifié entre le rendu et le clic sur « Finaliser », ces variables peuvent être périmées. En particulier :

    step4Data pourrait être null (si le store a été réinitialisé, par exemple par loadExistingSheet ou applyStateSync avant que l’utilisateur ne clique) ou avoir des skillAllocations vides.

    Un rechargement asynchrone de l’état depuis le serveur (via applyStateSync ou loadExistingSheet) peut écraser les données locales par une version sans allocations (car getStep4State renvoie toujours skillAllocations: {} — voir commentaire « Best-effort » dans creationService.js).

Cause racine

Double problème :

    Fermeture stale : handleTerminate lit les props au lieu de useCreationStore.getState(), donc un rafraîchissement du store entre le rendu et le clic peut faire expédier une version obsolète ou vide.

    getStep4State ne préserve pas les allocations (cf. commentaire dans le code serveur : « skillAllocations/autodidacteAllocations ne sont PAS reconstructibles proprement »). Si le store est réhydraté depuis le serveur après une synchro MJ ou un rechargement, les allocations saisies localement sont perdues. Ensuite, la finalisation envoie un step4 avec skillAllocations: {}, ce qui vide les compétences.

Le scénario le plus probable :

    Le joueur a rempli ses compétences et est à l’étape 7.

    Le MJ ouvre la fiche (ce qui déclenche un WIZARD_STATE_SYNC → applyStateSync), ou le joueur a simplement navigué entre les étapes de manière à provoquer un remount via gmSyncKey.

    Le store est mis à jour avec les données du serveur, où step4Data.skillAllocations = {}.

    Le joueur clique sur « Finaliser » → le payload contient step4: { ..., skillAllocations: {} }.

    Le serveur supprime tout et réapplique les allocations vides → compétences à zéro.

Correctif proposé

    Côté client (robustesse) : dans handleTerminate (et openPeek), remplacer les variables capturées par useCreationStore.getState().stepNData pour garantir que la dernière version du store est envoyée.

    Côté serveur (préservation) : modifier getStep4State pour qu’il tente de reconstruire les allocations à partir de char_skills.mastery et des bonus de background. Actuellement, il y a un commentaire expliquant que cela n’est pas fait car « risqué », mais sans cette reconstruction, toute réhydratation du client détruit les allocations en cours. Si on ne veut pas le faire, au minimum, le serveur ne devrait jamais renvoyer un step4Data qui écrase des allocations existantes (on pourrait omettre skillAllocations du payload, mais le client s’attend à ce champ). Une autre approche serait de ne pas écraser step4Data côté client si l’utilisateur n’a pas explicitement re-soumis l’étape.

    Côté serveur (sécurité) : dans reconcileCreation, si step4.skillAllocations est fourni mais vide, et que la base contient déjà des compétences, on pourrait lever une erreur plutôt que d’effacer silencieusement. Cela protégerait contre un envoi accidentel.

Fichiers à modifier

    client/src/components/creation/WizardCreation.jsx (lignes handleTerminate et openPeek) — utiliser getState().

    server/src/services/creationService.js (fonction getStep4State) — tenter de reconstruire skillAllocations.

    Éventuellement server/src/services/creationService.js (bloc STEP4) — ajouter une garde si skillAllocations vide et qu’il existe déjà des compétences.

Impact

    Données : Aucune perte de données existantes ; les personnages déjà créés ne seront pas affectés.

    Régression : getStep4State modifié pourrait introduire des allocations incorrectes si le calcul est mal fait. Il faudra bien tester en recréant le scénario avec un MJ qui ouvre la fiche.

Testé / Non testé

    Testé : Analyse statique du flux et identification des causes potentielles.

    Non testé : Reproduction du bug exact. ⚠️ clos partiel.
---
 bug #4 — « PC insuffisants : X requis »
Cause probable

Le calcul du budget PC côté serveur (advantageConstraints.js, contrainte sufficient_pc) utilise la formule :
text

available = pc_total - spent + pc_gained_desavantages + pc_postcreation

Le calcul côté client (Step5Advantages.jsx) utilise :
text

pcRemaining = pcDispo + pcGained - pcSpent

pcDispo vient du store (getPcDispo()), qui ne tient pas compte de pc_postcreation. Si cette colonne contient une valeur (positive ou négative) héritée d’une session précédente ou d’un bug d’initialisation, le serveur voit un budget différent du client. Par exemple, un pc_postcreation = -1 alors que le client affiche 0 entraînerait exactement le message « PC insuffisants : 1 requis » avec 0 PC restants.
À vérifier

    Contenu de char_pc_ledger.pc_postcreation sur le personnage concerné.

    Quand cette colonne est-elle modifiée (rechercher toutes les occurrences de pc_postcreation dans le code serveur). Si elle n’est jamais remise à zéro après la création d’un nouveau brouillon, une valeur résiduelle d’un précédent personnage pourrait persister.

    Scénario de reproduction : créer un personnage jusqu’à l’étape 5, dépenser tous les PC, puis constater l’erreur à l’ajout d’un avantage coûtant 1 PC alors que l’affichage indique 0 restant. Comparer le available serveur et le pcRemaining client à cet instant.

Fichiers clés

    server/src/services/advantageConstraints.js — contrainte sufficient_pc

    client/src/stores/creationStore.js — getPcDispo()

    client/src/components/creation/Step5Advantages.jsx — calcul pcRemaining

    La migration SQL qui définit char_pc_ledger et ses valeurs par défaut
------------
bug #5 — L'âge progresse à chaque test sans jamais régresser

J'ai maintenant tous les éléments pour identifier la cause racine.
Flux de l'âge

Côté serveur (reconcileCreation, bloc STEP4) :
javascript

const finalAge = baseAge + higherEdYears + totalCareerYears
await trx('char_archetype').where({ char_sheet_id: sheetId }).update({ age: finalAge })

Le serveur écrit l'âge final dans char_archetype.age. Il ne stocke pas l'âge de départ séparément.

Côté serveur (getStep4State) :
javascript

return {
  age: archetype?.age ?? 16,
  // ...
}

Cette fonction lit char_archetype.age et le renvoie comme age. Mais ce champ contient désormais l'âge final, pas l'âge de base. Il n'y a pas de champ finalAge dans la réponse de getStep4State.

Côté client (Step4Experience) :
javascript

const [age, setAge] = useState(initialData?.age ?? 16)

Le state local est initialisé avec ce que le serveur renvoie (initialData?.age). Si le serveur renvoie l'âge final, le client le prend comme âge de départ.

Côté client (buildPayload) :
javascript

return {
  age,           // âge de départ local
  finalAge,      // calculé localement : age + higherEdYears + totalCareerYears
  // ...
}

Le client envoie à la fois l'âge de départ (age) et l'âge final (finalAge). Le serveur ignore finalAge et recalcule lui-même finalAge = baseAge + .... Mais le baseAge reçu est en réalité l'ancien âge final, car le serveur l'a renvoyé dans getStep4State.
Cause racine

Confusion des champs age (base) et finalAge dans le stockage serveur. Le serveur stocke l'âge final dans char_archetype.age, puis le renvoie au client sous le même nom age lors de la réhydratation. Le client interprète cette valeur comme un âge de base, ce qui entraîne un cumul.

Scénario de reproduction :

    Le joueur crée un personnage avec âge de base 16, deux ans d'études, puis 7 ans de carrière. Le client calcule finalAge = 16 + 2 + 7 = 25. Le serveur persiste char_archetype.age = 25.

    Le joueur recharge la page ou le MJ ouvre la fiche (ce qui déclenche loadExistingSheet ou applyStateSync). getStep4State renvoie age: 25.

    Le composant Step4Experience initialise age = 25. Le joueur ne remarque rien et clique sur « Suivant ». Le client envoie baseAge = 25 au serveur. Le serveur recalcule finalAge = 25 + 2 + 7 = 32, puis stocke char_archetype.age = 32.

    L'âge final augmente à chaque cycle de réhydratation + soumission, sans que le joueur n'ait rien changé.

Correctifs possibles

Option A (recommandée) : Stocker séparément l'âge de base dans char_archetype.base_age (nouvelle colonne ou utilisation de archetype.age uniquement pour l'âge de base). L'âge final resterait un champ calculé, jamais persisté.

Option B : Modifier getStep4State pour renvoyer à la fois un baseAge et un finalAge. Le serveur devrait retrouver l'âge de base (par exemple en soustrayant les années de carrière et d'études stockées en base — mais ce n'est pas fiable car les années d'études ne sont pas stockées séparément dans char_archetype).

Option C (minimale, à court terme) : Dans getStep4State, ne pas renvoyer age du tout, ou le renvoyer à 16 par défaut. Le client ne pourrait pas reprendre exactement où il en était, mais éviterait le cumul.
Impact du correctif

    Données : Le correctif ne modifierait pas les données existantes.

    Régression : Le retour à l'étape 4 après un rechargement pourrait réinitialiser l'âge de départ à 16, ce qui est correct pour un nouveau brouillon mais pourrait surprendre un joueur qui reprend une création existante.

    Complexité : L'option A demande une migration de schéma (nouvelle colonne base_age) et une mise à jour de reconcileCreation.
----
bug #7 — Augmentation des compétences limitatives sans prérequis

J'ai lu les fichiers fournis : SkillsPanel.jsx (client) et char-sheet.js (serveur). Voici mon analyse.
Fonctionnement actuel

    Côté client : En mode progression (progressionMode = true), un bouton d'achat (+X PE) est affiché pour chaque compétence visible. La visibilité est déterminée par isVisible, qui vérifie les prérequis MUTATION, ADVANTAGE, GENOTYPE et, si l'option skillPrerequisitesEnabled est activée, les prérequis SKILL_MIN.

    Côté serveur (route POST /skills/buy) : Les prérequis MUTATION, ADVANTAGE, GENOTYPE sont toujours vérifiés. Les prérequis SKILL_MIN ne sont vérifiés que si l'option skill_prerequisites est activée dans les paramètres de campagne.

Origine du bug

Le bug se produit lorsque les prérequis SKILL_MIN ne sont pas satisfaits, mais que l'option de campagne correspondante (skill_prerequisites) est désactivée (valeur par défaut false). Dans ce cas :

    Le client n'affiche pas la compétence comme verrouillée (car skillPrerequisitesEnabled est faux dans isVisible).

    Le serveur ne vérifie pas les prérequis SKILL_MIN (car settings.skill_prerequisites est faux dans la route).

Résultat : le joueur peut acheter et augmenter des compétences qui devraient normalement nécessiter un niveau minimum dans une autre compétence. Le testeur a probablement rencontré ce comportement avec l'option désactivée, ou bien l'option n'était pas encore implémentée côté serveur au moment du test.
Note importante

Si l'option est activée, le serveur bloque bien l'achat (erreur 400) et le client masque la compétence. Le mécanisme est donc fonctionnel, mais uniquement lorsque l'option est explicitement activée par le MJ.
Pistes de correction

    Si le comportement attendu est que les prérequis SKILL_MIN soient toujours respectés (même sans l'option), il faut les vérifier côté serveur sans condition, ou activer l'option par défaut.

    Si le comportement est correct et que le bug vient d'un test avec l'option désactivée, il s'agit simplement d'un malentendu. Une clarification dans l'interface (par exemple un tooltip indiquant que les prérequis sont désactivés) pourrait éviter la confusion.
Note Saar : Quelle option ? Si elle existe, il faut qu'elle soit active par défaut.
----
bug #9 — Points de compétence déjà investis mal calculés (Step 4)

J’ai lu careerSkills.js (la fonction computeSkillAllocation) et CareersAllocator.jsx (le composant client). Voici mon analyse.
Fonctionnement normal

    computeSkillAllocation est une fonction pure, sans appel à la base de données. Elle prend les allocations du joueur (skillAllocations), un contexte (carrières, bonus d’origine, compétences d’études supérieures, etc.) et retourne le budget total (10 * années de carrière), le coût total des points déjà investis, le solde restant et d’éventuelles erreurs.

    CareersAllocator utilise useReducer pour gérer skillAllocations (les modifications du joueur) et openedSkills. Chaque clic sur + ou - met à jour le reducer, qui modifie skillAllocations. Le résultat de computeSkillAllocation est affiché en temps réel.

    Les boutons + sont désactivés si le budget restant est épuisé ou si le plafond de la compétence est atteint. Les boutons - sont désactivés si la valeur cible est déjà au niveau de base.

Origine du bug

Le calcul des points déjà investis (allocationResult.totalCost) est correct tant que le composant reste monté et que le joueur ne recharge pas la page ou ne revient pas en arrière. Le bug se manifeste probablement lorsque le joueur revient à l’étape 4 après avoir déjà validé ses compétences.

Le problème est identique à celui déjà identifié pour l’âge : les allocations ne sont pas conservées lors d’une réhydratation depuis le serveur. En effet, la fonction getStep4State dans creationService.js renvoie toujours skillAllocations: {} (et autodidacteAllocations: {}), avec un commentaire expliquant que ces données « ne sont PAS reconstructibles proprement ».

Ainsi, si le joueur quitte l’étape 4 puis y revient (par exemple en naviguant entre les onglets, ou après un rechargement provoqué par le mode collaboratif), initialSkillAllocations est vide. Le composant repart de zéro, ce qui donne l’impression que les points déjà investis sont « mal calculés » — en réalité, ils sont tout simplement perdus.

Ce n’est donc pas un bug dans la fonction de calcul elle-même, mais un problème d’architecture lié à l’impossibilité de reconstruire les allocations depuis la base de données. Le serveur ne stockant pas la distinction entre les points d’origine et ceux ajoutés par le joueur, il ne peut pas restituer cette information.
Pistes de correction

    Stocker les skillAllocations dans une table dédiée (par exemple char_skill_allocations) pour pouvoir les reconstruire côté serveur.

    Alternativement, conserver les skillAllocations dans le store local du navigateur (localStorage) pour les restaurer après un rechargement, sans tenter de les récupérer du serveur.

    Une solution moins lourde serait de ne jamais réinitialiser skillAllocations dans le reducer si le composant est remonté avec des données vides et qu’il existe déjà des compétences en base — mais cela ne résout pas le cas où le joueur a réellement tout remis à zéro.
----
Bug #11 — Les tirages d'avantages optionnels semblent coûter des points de compétences

Sévérité : UX (non bloquant)
Description observée

Lorsqu'un joueur utilise un tirage aléatoire 1D10 dans l'étape 4 (« Avantages & Revers »), le budget d'avantages professionnels affiché diminue de 5. Les testeurs interprètent cela comme une dépense de points de compétence. En réalité, le tirage remplace la répartition manuelle des 5 points de la tranche — c'est strictement conforme à la règle RAW (LdB p. 154) qui dit « au lieu de répartir ses 5 points d'Avantages professionnels automatiques ». Aucun point de compétence n'est touché.
Fichiers concernés
Fichier	Rôle
client/src/components/creation/ProAdvantagesAndSetbacks.jsx	Interface de l'étape Avantages pro & Revers. Affiche le budget restant, les tirages, les catégories.
shared/careerAdvantages.js	Fonctions pures computeProAdvantageAllocation et computeRandomBudgetDelta.
Analyse

Deux budgets distincts existent dans le Wizard, sans aucun transfert entre eux :

    Points de compétence : 10 × années par carrière, géré par computeSkillAllocation (shared/careerSkills.js), affiché dans CareersAllocator.

    Points d'avantages professionnels : 5 × années par carrière, géré par computeProAdvantageAllocation (shared/careerAdvantages.js), affiché dans ProAdvantagesAndSetbacks.

Quand le joueur clique sur « Lancer 1D10 », le reducer START_AWAITING_ROLL puis RESOLVE_AWAITING_ROLL ajoute un pick au tableau randomPicks pour cette carrière et ce bloc. Le calcul du budget restant passe par computeProAdvantageAllocation, qui appelle computeRandomBudgetDelta. Cette dernière fonction applique la règle RAW :
js

// shared/careerAdvantages.js — computeRandomBudgetDelta
export function computeRandomBudgetDelta(picks, benefitRows) {
  let delta = 0
  for (const pick of picks ?? []) {
    delta -= 5  // ← retrait des 5 points manuels de la tranche
    if (pick.useAsPoints) {
      const row = rowByRoll.get(pick.roll)
      if (row?.points_alt != null) delta += row.points_alt
    }
  }
  return delta
}

Le budget manuel restant diminue donc de 5 points, ce qui est le comportement correct : le joueur a renoncé à répartir manuellement ces 5 points pour tenter le tirage. Le tirage lui-même ne coûte aucun PC et n'affecte pas le pool de points de compétence.
Cause racine

L'interface ne communique pas clairement :

    L'en-tête de la section tirage dit « Tirage 1D10 (optionnel) », sans expliquer que le tirage remplace les 5 points manuels.

    Les deux compteurs de « points restants » utilisent le même terme « points », sans qualificatif assez distinctif pour éviter la confusion avec les points de compétence.

    Aucun message transitoire n'indique « vous renoncez à 5 points manuels pour ce tirage ».

Correctif attendu

Modifier ProAdvantagesAndSetbacks.jsx pour améliorer la clarté :

    Texte du bouton de tirage : Changer le libellé de t('step4.career_random_title') (ou ajouter un tooltip) pour expliciter « au lieu de répartir 5 points manuels ».

    Ajouter une indication dans le bloc de tirage (après le clic) : un message discret « Vous renoncez aux 5 points manuels de cette tranche. ».

    Distinguer visuellement les deux budgets dans l'interface : le compteur de points de compétence (dans CareersAllocator) et celui des avantages pro (dans ProAdvantagesAndSetbacks) pourraient avoir des couleurs ou des labels plus distincts.

Contraintes

    Ne surtout pas modifier la logique de computeRandomBudgetDelta : le retrait de 5 points est mécaniquement correct et validé par les règles RAW.

    Les fichiers de traduction (creation.fr.json) contiennent déjà les clés step4.career_random_title, step4.career_random_roll_btn, etc. Ajouter de nouvelles clés si nécessaire.

    Le correctif est purement cosmétique et ne doit pas changer le comportement de validation ou de navigation.

Testé / Non testé

    Testé : analyse du code source, vérification de la séparation des budgets.

    Non testé : reproduction en conditions réelles avec un beta-testeur.
---
Bug #12 — Mutation Parasite : jet 1d4 manquant
Description

Lors du tirage aléatoire de mutations (méthode « Tirage aléatoire » de l’étape 3), la mutation Parasite(s) peut apparaître, mais aucun jet n’est effectué pour déterminer le nombre de parasites. D’après les règles, ce nombre doit être déterminé par un lancer de 1d4. Actuellement, le code ne contient aucune logique pour ce sous-jet.
Fichiers concernés
Fichier	Rôle
client/src/components/creation/Step3Mutations.jsx	Composant de l’étape 3 – contient rollOneMutation et le rendu des résultats
client/src/locales/creation.fr.json	Traductions pour les messages affichés
Comportement actuel

    rollOneMutation tire une mutation aléatoire et retourne un objet { mutation_id, subtype_id, subtype_name, d100 }.

    Aucune propriété count n’est produite.

    Le rendu affiche uniquement le nom de la mutation, sans mention du nombre.

Comportement attendu

    Quand la mutation tirée est Parasite(s) (identifiée par son mutation_id), un jet de 1d4 doit être simulé côté client (via Math.random()).

    Le résultat doit être stocké dans un champ count de l’objet mutation.

    L’affichage doit indiquer ce nombre, par exemple : « Parasite(s) — 3 parasites ».

    Le champ count doit être conservé lors de la conservation (handleKeep) et transmis au serveur dans handleSubmitRandom.

Solution proposée

    Dans rollOneMutation, après avoir tiré la mutation, vérifier si mut.mutation_id === 'parasite' (ou la constante correspondante). Si c’est le cas, générer un nombre aléatoire entre 1 et 4 :
    js

    const count = 1 + Math.floor(Math.random() * 4)

    L’ajouter au retour : return { ..., count }.

    Dans le rendu des résultats (section rollPending), si result.count existe, afficher le nombre à côté du nom de la mutation. Utiliser une clé de traduction, par exemple step3.parasite_count : "Parasite(s) — {{count}} parasites".

    Vérifier que handleKeep et handleSubmitRandom propagent bien le champ count (ils conservent l’objet complet, donc c’est normalement transparent).

Contraintes

    Utiliser Math.random() pour le 1d4, comme pour les D100 et les sous‑types – pas de WebSocket.

    Ne pas modifier la logique de tirage pour les autres mutations.

    La clé de traduction doit être ajoutée dans creation.fr.json (et creation.en.json si nécessaire).

Impact

    Aucun impact sur les autres mutations.

    Expérience utilisateur améliorée pour la mutation Parasite.
----
bug #13 — Points de compétence déjà investis mal calculés (Step 4)

J'ai lu shared/careerSkills.js et CareersAllocator.jsx. Voici mon analyse, en tenant compte de ton indication : le problème vient probablement de la réconciliation / des allers-retours entre les étapes.
Constat

La fonction computeSkillAllocation est une fonction pure, sans accès base. Elle prend skillAllocations — les compétences réellement touchées par le joueur — et calcule le coût total, le budget, le solde restant. Une compétence non modifiée (absente de skillAllocations) coûte 0, ce qui est correct. Le calcul est donc fiable tant que skillAllocations reflète fidèlement ce que le joueur a fait.

Le composant CareersAllocator utilise un reducer local (careersReducer). À l'initialisation, state.skillAllocations est peuplé depuis initialSkillAllocations, qui vient du parent (Step4Experience). Ce parent le reçoit de initialData.skillAllocations, qui provient du store creationStore.step4Data.
Le problème

Quand le joueur revient à l'étape 4 après avoir validé (par exemple en naviguant dans les onglets, ou après une réhydratation depuis le serveur), step4Data peut être écrasé par des données fraîches du serveur. Or, le serveur (getStep4State) retourne toujours skillAllocations: {}, car ces allocations ne sont pas reconstructibles depuis la base (les bonus d'origine et les allocations du joueur sont fusionnés dans char_skills.mastery, sans trace de qui a fait quoi).

Conséquence : CareersAllocator est monté avec initialSkillAllocations = {}. Le joueur voit le tableau de compétences avec current = baseMastery[skillId] (les bonus d'origine uniquement), comme s'il n'avait jamais investi de points. Les points précédemment dépensés sont perdus visuellement, ce qui donne l'impression qu'ils sont « mal calculés » — en réalité, ils ne sont plus visibles du tout.

Ce n'est donc pas un bug dans computeSkillAllocation ou dans le reducer, mais un problème de persistance des allocations entre les sessions.
----
Bug #14 — Avantages & revers : aucun broadcast vers le MJ
Description

Les modifications des avantages professionnels et les tirages aléatoires 1D10 dans l'étape 4 (sous‑étape « Avantages & Revers ») ne sont pas diffusés en temps réel au MJ. Le joueur effectue ses choix, mais le MJ n'en voit pas le reflet immédiat. Les autres étapes fonctionnent correctement.
Fichier à modifier
Fichier	Rôle
client/src/components/creation/Step4Experience.jsx	Composant de l'étape 4 — contient le useEffect de diffusion live
Comportement actuel

Le useEffect responsable de la diffusion live appelle onLiveChange(buildPayload()) mais ne liste pas proAdvantages ni randomPicks parmi ses dépendances. Par conséquent, lorsque le joueur modifie ces données via la sous‑étape ProAdvantagesAndSetbacks, le payload diffusé reste inchangé et le MJ ne reçoit aucune mise à jour.
Comportement attendu

Toute modification des avantages professionnels ou des tirages aléatoires doit déclencher une diffusion immédiate vers le serveur, qui relaie aux autres clients de la room (le MJ). Le MJ doit voir les choix du joueur en temps réel.
Solution proposée

Dans Step4Experience.jsx, ajouter proAdvantages et randomPicks au tableau de dépendances du useEffect qui appelle onLiveChange :
js

useEffect(() => {
    onLiveChange?.(buildPayload())
  }, [
    age, finalAge, originGeo, originSoc, training, higherEd, geoName, geoNation, socNation,
    careers, skillAllocations, openedSkills, autodidacteAllocations, validSetbackRolls, totalPC,
    conditionalChoices, 
    proAdvantages,    // ← ajout
    randomPicks,      // ← ajout
    onLiveChange,
  ])

Contraintes

    proAdvantages et randomPicks sont des dictionnaires indexés par career_id. Les callbacks handleProAdvantagesChange et handleRandomPicksChange créent de nouveaux objets, garantissant que la comparaison par référence déclenchera l'effet.

    Aucune modification du serveur n'est nécessaire : l'infrastructure WebSocket est déjà en place.

    Vérifier que les autres champs de la sous‑étape (Revers) sont bien couverts par validSetbackRolls (déjà présent).

Impact

    Aucune régression sur les autres étapes.

    Le MJ verra désormais les modifications des avantages pro et des tirages en temps réel.
--------
bugs #16 — Traductions manquantes (Sens diminué, Faiblesse naturelle, etc.)
Constat

Les libellés affichés dans l'étape 5 (Avantages & Désavantages) contiennent des termes anglais entre parenthèses, par exemple « Sens diminué (hearing) », « Faiblesse naturelle (drug) ». Ce ne sont pas des cas isolés : tous les noms d'avantages/désavantages qui comportent une précision entre parenthèses sont en anglais. Le problème vient très probablement des données brutes dans la table ref_advantages, dont le champ name n'a pas été entièrement traduit.
Solution pour l'agent

    Vérifier l'ensemble des enregistrements de la table ref_advantages (ou le fichier de seed correspondant) et traduire systématiquement les termes anglais entre parenthèses. Par exemple :

        (hearing) → (Ouïe)

        (drug) → (Drogues)

        (sight) → (Vue)

        (cold) → (Froid)

        etc.

    Si les parenthèses sont générées dynamiquement par une concaténation côté client, il faut plutôt intervenir dans le code pour utiliser les clés de traduction appropriées, mais l'hypothèse la plus probable est que le champ name est directement affiché.

    Une fois les données corrigées, le composant Step5Advantages.jsx affichera automatiquement les noms en français, car il utilise directement adv.name.
---
#Bug #18
Contexte

Les beta-testeurs ont signalé l'absence d'explications globales dans le Wizard de création de personnage. Il ne s'agit pas de tooltips (infobulles ponctuelles, déjà existantes) mais d'un texte de tutoriel affiché en haut de chaque étape, expliquant ce que le joueur va faire.

Les textes ont été rédigés par Saar en s'inspirant du Livre de Base Polaris (pages 116-131). Ils doivent être intégrés dans les composants d'étape du Wizard.
Textes à intégrer (validés par Saar)

Step 0 — Méthode de création

    Vous allez créer votre personnage. Vous disposez de 20 Points de Création (PC) à répartir entre toutes les étapes. Vous pouvez vous inspirer des archétypes proposés ou répartir librement vos points selon le concept de votre personnage. Chaque PC dépensé améliore un aspect : attributs, années d'expérience, avantages... Les Désavantages, eux, rapportent des PC supplémentaires.

Step 1 — Capacités de base

    Définissez les aptitudes physiques et mentales essentielles de votre personnage : ses Attributs. Le score de base de chaque Attribut est de 7. Vous disposez d'une réserve de points d'Attributs pour les améliorer. Vous pouvez aussi dépenser des PC pour obtenir plus de points d'Attributs (1 PC = +2 points) mais attention, les PCs sont communs à toutes les étapes de création et les niveaux 16 à 20 coûtent de plus en plus cher.

Step 2 — Type génétique

    Choisissez la nature génétique de votre personnage. Par défaut, vous êtes un humain normal (gratuit, sans modificateurs). Vous pouvez aussi choisir un type Hybride (naturel, géno-hybride ou techno-hybride), capable de survivre sous l'eau, mais cela coûte des PC et modifie vos Attributs. Certains Hybrides subissent des Désavantages importants. Le MJ peut déconseiller les Hybrides aux joueurs débutants.

Step 3 — Capacités spéciales

    Votre personnage possède-t-il des particularités hors du commun ? Cette étape concerne les Mutations (avantageuses, neutres ou désavantageuses) et la maîtrise de la Force Polaris. Deux méthodes : acheter les mutations souhaitées avec des PC, ou effectuer un tirage aléatoire gratuit (résultat imprévisible). Vous pouvez aussi n'acheter aucune mutation.

Step 4 — Expérience préliminaire

    Vous allez définir le passé de votre personnage : son âge de départ, ses origines (géographique, sociale), sa formation, puis une ou plusieurs Professions. Chaque année d'expérience professionnelle coûte 1 PC et donne 10 points de Compétence à répartir, des avantages, et des économies. L'âge final dépendra du nombre d'années passées dans ces professions.

Step 5 — Avantages et Désavantages

    Complétez votre personnage avec des Avantages (capacités innées, ressources, bonus divers) et/ou des Désavantages (défauts handicapants). Les Avantages coûtent des PC. Les Désavantages en rapportent. Certains sont uniques, d'autres cumulables. Attention à ne pas surcharger le personnage en Désavantages, au risque de le rendre injouable.

Step 6 — Récapitulatif

    Vérifiez l'ensemble de votre fiche de personnage avant de terminer. Tous vos choix sont affichés ici : Attributs, Génotype, Mutations, Professions, Compétences, Avantages et Économies. Vous pouvez revenir en arrière pour modifier ce qui ne vous convient pas. Quand tout est prêt, verrouillez votre fiche pour commencer à jouer.

Contraintes techniques

    Internationalisation (i18n). Les textes doivent être placés dans les fichiers de traduction fr.json et en.json du namespace creation. Chaque clé suivra le format stepN.tutorial. Exemple : "step1.tutorial": "Définissez les aptitudes...". Ne pas utiliser fr.json global mais bien les fichiers dédiés au wizard.

    Emplacement dans l'interface. Chaque composant d'étape doit afficher le tutoriel en haut de l'étape, entre la barre de navigation et le contenu spécifique. Il doit être visible immédiatement, sans action de l'utilisateur.

    Style. Le texte doit être présenté dans un bandeau discret mais lisible, avec une couleur de fond légèrement contrastée par rapport au fond du wizard. Police de taille ~13px, couleur de texte douce (ex. #9090c8 ou #c0c0d0), avec une icône ℹ️ ou un petit séparateur visuel pour le distinguer du contenu interactif.

    Pas de duplication. Créer un composant réutilisable <StepTutorial text={t('stepN.tutorial')} /> plutôt que de copier-coller le même markup dans chaque étape.

    Ne pas toucher au guideModeActive du store. Ce mode n'est pas lié aux tutoriels (il concerne l'assistance MJ/Joueur en mode collaboratif). Les tutoriels sont permanents pour toutes les créations.

    Aucune modification fonctionnelle. L'ajout des tutoriels ne doit rien changer au comportement du wizard (validation, navigation, données).

Fichiers concernés
Fichier	Action
client/src/locales/creation.fr.json	Ajouter les 7 clés stepN.tutorial
client/src/locales/creation.en.json	Ajouter les 7 clés stepN.tutorial
client/src/components/creation/StepTutorial.jsx	Nouveau — composant réutilisable
client/src/components/creation/WizardCreation.jsx	Intégrer <StepTutorial> dans chaque rendu d'étape (ou dans chaque composant d'étape si le tutoriel est spécifique)
client/src/components/creation/Step0Method.jsx	Ajouter le tutoriel
client/src/components/creation/Step1Attributes.jsx	Ajouter le tutoriel
client/src/components/creation/Step2Genotype.jsx	Ajouter le tutoriel
client/src/components/creation/Step3Mutations.jsx	Ajouter le tutoriel
client/src/components/creation/Step4Experience.jsx	Ajouter le tutoriel
client/src/components/creation/Step5Advantages.jsx	Ajouter le tutoriel
client/src/components/WizardReview.jsx (ou composant Step 6)	Ajouter le tutoriel
Tests

    Vérifier que chaque étape affiche son tutoriel au chargement.

    Vérifier que le tutoriel est masqué proprement si l'étape ne le nécessite pas (ex. sous-étapes de l'étape 4 — le tutoriel doit rester visible même en naviguant entre les sous-étapes).

    Vérifier l'affichage responsive (le bandeau ne doit pas déborder sur mobile).

    Vérifier que les textes apparaissent correctement en français et en anglais.
----
Bug #19 — Main directrice modifiable manuellement (écart RAW)
Comparaison des analyses

L'ancienne analyse et la nouvelle sont parfaitement cohérentes et aboutissent aux mêmes conclusions. La nouvelle version apporte simplement des précisions supplémentaires sur le comportement attendu après correction. Voici la synthèse :
Problème confirmé

    Le <select> propose trois options manuelles (R, L, A) et reste modifiable après un tirage via le bouton « Définir ». Le joueur peut donc contourner le résultat RAW.

    L'option Ambidextre (A) est accessible sans achat de l'Avantage, ce qui contredit les règles.

Correctif à appliquer

Deux approches possibles, à choisir selon l'expérience utilisateur souhaitée :

    Approche simple : Désactiver le <select> après un tirage réussi (handPref !== ''). L'utilisateur peut relancer le dé pour obtenir un autre résultat, mais ne peut pas modifier manuellement.

    Approche plus stricte : Supprimer le <select> et n'afficher que le bouton « Définir ». Après le tirage, le résultat est affiché en texte simple. L'utilisateur peut relancer le dé s'il le souhaite. L'option A n'est jamais accessible manuellement.

Dans les deux cas, l'option A doit être retirée du <select> (ou le <select> entièrement supprimé). L'Ambidextre ne peut être obtenu que par un tirage naturel (20 sur 2D10) ou par l'achat de l'Avantage dédié (hors scope de cette étape).
Impact

    Amélioration de la conformité aux règles RAW.

    Aucune régression sur les autres fonctionnalités de l'étape 1.
----
Bug #3 — Bouton Suivant grisé sans explication si le nom est vide

Ce que le code montre :

    canNext = charName.trim().length > 0 && validation.valide (ligne 124).

    Le bouton « Suivant » (ligne 393-398) a disabled={!canNext}.

    Le message d’erreur conditionnel (lignes 401-410) n’apparaît que si !validation.valide (bloc ligne 401) ou si budgetWarned (ligne 406). Aucun message spécifique pour le cas où seul le nom est vide et la validation est valide par ailleurs.

    Résultat : le bouton est grisé, le joueur ne voit rien lui indiquant pourquoi.

Verdict : Le bug est confirmé. Il suffit d’ajouter un message explicite lorsque !canNext et que charName.trim().length === 0, par exemple « Entrez un nom pour continuer ».
----
Bug #21 — « Aucune mutation » pas assez visible

Ce que le code montre :

    La carte « Aucune mutation » est rendue dans l'écran d'achat (method === 'chosen'), lignes 246-249 :
    jsx

    <div style={st.noneCard} onClick={handleNone}>
      <span style={st.noneTitle}>{t('step3.none')}</span>
      <p style={st.noneDesc}>{t('step3.noneDesc')}</p>
    </div>

    Elle est positionnée au-dessus de la grille des mutations, avec un style discret : bordure #1e1e2e, fond semi-transparent rgba(6,6,14,0.6), texte gris #5a5a7a / #3a3a5e.

    Elle est visuellement similaire à une carte normale mais avec un style moins contrasté.

Verdict : Le choix de conception est compréhensible (la grille est le choix principal), mais le manque de contraste et l'absence d'icône ou de bouton explicite peuvent la rendre invisible pour un débutant. Solution possible : utiliser un bouton « Aucune mutation » distinct, ou augmenter le contraste.

Note : Il n'y a pas de troisième voie dans le code actuel (contrairement au signalement beta : « OU troisième choix »). L'écran de choix n'a que deux cartes : Achat et Aléatoire.
----
#23 — Grille de répartition des compétences visible avant sélection d'une profession
Description

Dans l'étape 4, la grille de répartition des points de compétences s'affiche même si le joueur n'a encore ajouté aucune profession. Elle devrait rester masquée tant qu'aucun métier n'est retenu.
Fichier à modifier

client/src/components/creation/CareersAllocator.jsx
Analyse

Le board de compétences (lignes ~220-270) est rendu sans vérifier si selectedCareers.length > 0. Il apparaît donc immédiatement, alors qu'il n'y a pas encore de budget de compétences à répartir.
Comportement attendu

La grille ne doit être visible qu'après l'ajout d'au moins une profession.
Solution

Envelopper le bloc wiz4-board dans une condition :
jsx

{selectedCareers.length > 0 && (
  <div className="wiz4-board">
    ...
  </div>
)}

Simple et sans impact fonctionnel.
---
Bug #24 — Boutons -/+ non harmonisés (Step 4)
Fichiers analysés

    CareersAllocator.jsx

    AutodidacteAllocator.jsx

    ProAdvantagesAndSetbacks.jsx

Constat

Les trois composants utilisent exactement les mêmes classes CSS pour les boutons d’incrémentation :

    wiz4-sbtn (boutons − et ＋)

    wiz4-ctl (conteneur de la ligne)

    wiz4-val (valeur affichée)

La structure HTML est identique :
jsx

<div className="wiz4-ctl">
  <button className="wiz4-sbtn">−</button>
  <span className="wiz4-val">{pts}</span>
  <button className="wiz4-sbtn">＋</button>
</div>

Les conditions de désactivation et les textes diffèrent, mais la structure et les classes sont partagées.
Origine probable du bug

Les styles de ces boutons sont définis dans un fichier CSS global (ex. wizard.css ou similaire). Si les testeurs observent une incohérence visuelle (taille, couleur, alignement), elle provient probablement :

    D’une spécificité CSS différente selon le contexte d’affichage (par exemple, BackgroundSelector applique des styles de conteneur qui affectent les boutons d’AutodidacteAllocator).

    D’un état de chargement où le CSS n’est pas appliqué immédiatement.

    De boutons qui ne sont pas les wiz4-sbtn mais d’autres classes (comme wiz4-stepbtn pour les années, ou les boutons de la navigation), qui pourraient être confondus.

Correctif proposé

    Vérifier le CSS global des classes wiz4-sbtn, wiz4-ctl, wiz4-val.

    Uniformiser les éventuelles surcharges locales (par exemple, si un composant parent modifie font-size ou line-height, cela peut déformer les boutons).

    S’assurer que les boutons de l’Autodidacte, des compétences et des avantages pro ont la même apparence dans tous les cas (navigation entre sous-étapes, rechargement, etc.).

-----
Bug #26 — Tableau des attributs trop large (Step 2)
Analyse

Dans Step2Genotype.jsx, le tableau d'aperçu des attributs affiche 9 colonnes (1 label + 8 attributs). Les en-têtes utilisent whiteSpace: 'nowrap' avec les noms complets des attributs en français (ex. "Coordination", "Constitution", "Intelligence"). Les cellules de données ont une largeur minimale de 28px et un padding de 3px. Sans contrainte de largeur sur le conteneur parent et sans scroll horizontal, le tableau peut déborder de l'écran, surtout sur des résolutions réduites.
Fichier à modifier

client/src/components/creation/Step2Genotype.jsx
Correctif proposé

    Ajouter un conteneur scrollable autour du tableau : overflowX: 'auto' sur une div enveloppante.

    Réduire la taille des en-têtes : passer fontSize à 9px et permettre le retour à la ligne en supprimant whiteSpace: 'nowrap' sur les th.

    Réduire le padding des cellules : passer padding à 2px 1px pour les td.

    Alternative : utiliser des abréviations pour les noms d'attributs (ex. "Coord." au lieu de "Coordination").

Impact

    Aucune modification fonctionnelle. Améliore l'ergonomie sur écrans étroits.
----
Bug #28 — Avantages & Désavantages à regrouper par famille (Step 5)
Analyse

Le composant Step5Advantages.jsx affiche actuellement tous les avantages et désavantages sous forme de cartes dans une grille unique, sans regroupement. Les données reçues de l'API contiennent pourtant un champ family (utilisé par la contrainte family_limit côté serveur). Ce champ est ignoré lors de l'affichage.
Solution proposée

    Grouper les avantages par famille : au lieu d'un seul tableau advantages et disadvantages, créer des sous-sections par famille (ex. « Capacités innées », « Ressources », « Relations », etc.).

    Afficher un titre de famille au-dessus de chaque groupe, avec éventuellement un compteur « X/Y max » pour les familles limitées.

    Conserver la possibilité de filtrer (optionnel) pour faciliter la navigation.

Fichier à modifier

    client/src/components/creation/Step5Advantages.jsx

Contraintes

    Utiliser le champ family présent dans les objets avantages (issus de la base ref_advantages).

    Ne pas casser le système de sélection (l'état reste un tableau d'ID).

    Adapter le style pour les groupes (par exemple un petit en-tête par famille, indenté sous le titre « Avantages »).

Tests

    Vérifier que les familles s'affichent correctement et que la sélection fonctionne comme avant.

    Vérifier l'affichage responsive.
----