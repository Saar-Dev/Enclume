# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-08-09 — Nettoyage post-beta (retrait de toutes les entrées closes,
> intégration de la liste des bugs beta-testeurs dans une section temporaire).

## MÉTHODE — Triage → Reproduire → Analyser → Instrumenter → Corriger → Valider

> **Règle d'hygiène :** Tout bug clos est **SUPPRIMÉ** de ce registre. En cas de divergence entre docs et code → vérifier le code réel.

> **Loi fondamentale :** Lire le code → au mieux `[HYPOTHÈSE]`. `[VÉRIFIÉ]` exige instrumentation + observation du code **en exécution**. Ce sont deux choses distinctes — ne jamais les confondre.

| Phase | Action | Règle critique |
|---|---|---|
| **1. Triage** (batch) | Lister tous les bugs → sévérité + priorité → identifier clusters → mettre à jour EN_COURS.md | Ne pas coder à cette étape |
| **2. Reproduire** | Reproduire le bug de façon fiable et répétable. Documenter les conditions exactes. | **Sans reproduction confirmée, aucune analyse n'est valide.** |
| **3. Analyser** (par cluster) | Lire les fichiers → formuler une hypothèse — "5 Pourquoi" → effets de bord possibles | Résultat = `[HYPOTHÈSE]` uniquement. |
| **4. Instrumenter** | Énoncer la prédiction, ajouter `[DBG-BUGID]`, reproduire, observer → `[HYPOTHÈSE] → [VÉRIFIÉ]` | **Toujours obligatoire.** |
| **5. Correctif** (par cluster) | 1 commit par cause racine. | Ne jamais mixer deux clusters. |
| **6. Validation** | Test fonctionnel → zones adjacentes → fermer EN_COURS.md | Fermeture sans test fonctionnel → interdit. |

**Définition cluster** : même fichier source / même cause racine / même mécanique / fix A nécessite fix B.

---

## BETA — Retours beta-testeurs (2026-08-07)

> **Temporaire** — Ces bugs seront dispatchés dans les clusters adéquats après première analyse. Aucune correction lancée à ce stade.

| # | Description (affinée) | Domaine | Type | Priorité | Orientation |
|---|---|---|---|---|---|
| 1 | Absence totale de tooltips d'explication dans le wizard (priorité Step 4 Profession). Aucun système existant. | Wizard | Amélioration UX | Haute | Créer un système de tooltips. |
| 5 | Tableau des attributs trop large (layout). | Wizard | Amélioration UX | Basse | CSS responsive de l'étape 2. |
| 7 | Broadcast incohérent : Step 1 temps réel, Step 4 envoie directement au récapitulatif et y reste. | Wizard | Bug (broadcast) | Haute | `PERSONNAGE_WIZARD.md`, flux WS. |
| 10 | Page Profession dense : grille de compétences apparaît avant sélection, retirer description des compétences pro. | Wizard | Bug (affichage) | Haute | Rendu conditionnel Step 4. |
| 11 | Symbole /!\\ trop petit. | Wizard | Amélioration UX | Basse | Icône d'avertissement. |
| 13 | Points déjà investis dans les compétences professionnelles mal calculés. | Wizard | Bug | Haute | `SYSTEME/PERSONNAGE_CALCULS.md`. |
| 14 | Prérequis des métiers techniquement présents mais invisibles/incompréhensibles (ex. Pilote de chasseur). | Wizard | Amélioration UX | Haute | Affichage des prérequis. |
| 15 | Compétences inabordables non grisées, causant des soldes négatifs. | Wizard | Bug (validation) | Haute | Logique de points disponibles. |
| 17 | Tirages d'avantages optionnels consomment des PC. | Wizard | Bug (calcul PC) | Haute | `REGLE_AVANTAGES.md`. |
| 18 | Métiers affichés par UUID dans le récapitulatif (régression). | Wizard | Bug | Bloquant | Jointure/sérialisation. |
| 19 | Page Avantages & Désavantages très chargée, à regrouper par famille. | Wizard | Amélioration UX | Moyenne | `REGLE_AVANTAGES.md`, `REGLEREVERS.md`. |
| 20 | Équipement : joueur doit proposer une wishlist en naviguant dans `ref_equipment`, afficher le descriptif. | Wizard | Fonctionnalité manquante | Haute | Step 6, `SYSTEME/TRADE.md`. |
| 21 | Afficher le type de munition des armes, lien arme↔munitions. | Wizard | Fonctionnalité manquante | Haute | Modèle arme, `REGLESMUNITIONS.md`. |
| 22 | Borner le maximum de points d'attributs selon RAW. | Wizard | Bug (règle absente) | Haute | `REGLES/ATTRIBUTS.md`. |
| 32 | Implants : rien n'existe. Règle RAW à identifier, mécanique à concevoir. | Items | Hors scope | Basse (à planifier) | Chantier à part. |
| 34 | Module arme disparu de la fiche (gap local/distant, en cours par Saar). | Playground | Bug (régression) | Critique (en cours) | `equipment-admin.html`, migration. |

---

## Clusters actifs (après nettoyage)

*(les clusters F, H, Q ont été dissous — tous leurs bugs étaient clos)*

### Cluster A — dette COUVERTURE_TOTALE
*(inchangée)*

### Cluster B — dette WNDMORT-UI / WNDMORT-HORSCOMBAT
*(supprimés, clos)*

### Cluster C — MODING4 (ATI/Mémoire/Projecteur/Intégration)
*(inchangé, dettes non closes)*

### Cluster D — ASCENSEUR1, COM27, ANNONCE-PRECHECK-STALE1, CATASTROPHE-SCOPE1, ENTITYCLICK1
*(suspendus ou non reproductibles, conservés)*

### Cluster E — EQAMMOCOMPAT1, SCHEMADRIFT-EXOTEMPLATES1, SCHEMADRIFT-BATTLEMAPSVOXEL1
*(dettes techniques non closes)*

### Cluster G — UI4, HORLOGE-TEST1, HORLOGE-OVERFLOW1
*(HORLOGE-OVERFLOW1 clos, retiré ; UI4 clos, retiré ; reste HORLOGE-TEST1)*

### Cluster I — CHARSTORE-NULLISH1
*(dette mineure non close)*

### Cluster J — Dettes diverses (I18N-LINT3, VX1, AU1, DCO1, MAP1, DEPLACEMENT3, TOURTRANSITION1, I18N-LINT2)
*(seules les non closes subsistent)*

### Cluster K — FEAT4 (aura CaC)
*(feature, conservée ? selon décision)*

### Cluster L — GRID2D1
*(suspendu)*

### Cluster M — DARTS-TAGDUP, MUT4, POL1, TRADE2, RELOAD-INHAND, ASSAULT-CATEGORY
*(POL1 et TRADE2 clos → supprimés ; restent DARTS-TAGDUP, MUT4, RELOAD-INHAND, ASSAULT-CATEGORY)*

### Cluster N — B‑VX
*(non clos)*

### Cluster O — COUVERTURE_TOTALE (déjà A)

### Cluster P — UI divers (UI2, UI3)
*(non clos)*

### Cluster Q — INVENTAIRE-RECHERCHE-CATEGORIE
*(feature, retirée → ROADMAP)*

### Cluster R — Features combat : COMBAT-INTERAGIR-AUTOMOVE, COMBAT-CLICK-RECAP, COMBAT-CLICK-AUTOSOLVE
*(features, retirées → ROADMAP)*

### Cluster S — ARME-DEGATS-LABELS
*(clos, supprimé)*

### Cluster T — DEP1
*(dette non close)*

### Cluster U — CHARMODAL-DEAD1
*(clos, supprimé)*

---

## Détail des bugs/dettes non closes (extraction des clusters ci-dessus)

*(je conserve ci-dessous uniquement les entrées qui n'étaient pas closes avant le nettoyage, dans leur format d'origine)*

### Dette COUVERTURE_TOTALE — « Couverture totale » (tir) n'existe nulle part, client ni serveur
*(inchangé)*

### Dette MODING4-ATI — Analyseur Tactique Individuel : aucune interface de configuration cible/mode
*(inchangé)*

### Dette MODING4-MEMOIRE — Mémoire de cibles : aucune interface d'enregistrement de cibles
*(inchangé)*

### Dette MODING4-PROJECTEUR — Projecteur de mouvement : "cible en zigzag" n'existe nulle part
*(inchangé)*

### Dette MODING4-INTEGRATION — Groupe 4 jamais appelé en résolution réelle
*(inchangé)*

### Bug ASCENSEUR1 — World builder : fenêtre de propriétés d'un ascenseur s'ouvre puis se ferme aussitôt
*(suspendu)*

### Dette COM27 — CaC multi-attaque : le jet de défense semble se lancer avant le jet d'attaque
*(suspendu)*

### Bug ANNONCE-PRECHECK-STALE1 — "Action non autorisée dans cet état de combat" en fin de combat
*(nouveau, suspendu)*

### Bug CATASTROPHE-SCOPE1 — Une Catastrophe semble affecter deux protagonistes
*(nouveau, suspendu)*

### Bug ENTITYCLICK1 — Clic sur entité interactive sans effet (porte/échelle)
*(nouveau, suspendu)*

### Dette EQAMMOCOMPAT1 — `ref_equipment_ammo_compat` jamais consommée, jamais peuplée
*(décision Saar en attente)*

### Dette SCHEMADRIFT-EXOTEMPLATES1 — Colonnes/contraintes `ref_exo_templates` absentes des migrations
*(hors périmètre Phase 1)*

### Dette SCHEMADRIFT-BATTLEMAPSVOXEL1 — `battlemaps.voxel_data` DROP DEFAULT non versionné
*(hors périmètre)*

### Dette HORLOGE-TEST1 — `adjustGameTime` sans aucun test automatisé
*(non close)*

### Dette CHARSTORE-NULLISH1 — `?? false` mort après un `===` dans `characterStore.js`
*(non close)*

### Dette I18N-LINT3 — `setState` synchrone dans un `useEffect` (plusieurs fichiers)
*(traitée partiellement, reste des occurrences)*

### Dette I18N-LINT2 — Variables/props inutilisées (ESLint) dans plusieurs fichiers Combat
*(traitée partiellement)*

### Dette VX1 — `getVoxelSurfaceTop` : pas de cas slope/wedge
*(accepté V1)*

### Dette AU1 — `useDiceAudio.js` : sons dés manquants
*(non close)*

### Dette DCO1 — `onTokenRotate` : dead code Canvas3D/Scene
*(non close)*

### Dette MAP1 — `MAP_VIEWPORT` : pas de déclencheur UI côté GM
*(non close)*

### Dette DEPLACEMENT3 — Premier "Déplacement" après déplacement validé : latence ~0,5-1s
*(non prioritaire)*

### Dette TOURTRANSITION1 — Latence + message "En attente de {{nom}}" en chaînant des actions de PNJ
*(non prioritaire)*

### Dette FEAT4 — Aura de portée CaC
*(feature, conservée dans bugs car demande fonctionnelle précise)*

### Bug GRID2D1 — Grille 2D non affichée malgré `grid_enabled=true`
*(suspendu, cause inconnue)*

### Dette DARTS-TAGDUP — `TXT=DEPTH=...|DEPTH=...` : clés dupliquées
*(latent)*

### Dette MUT4 — Griffes : bonus Escalade +3 / malus dextérité manuelle -3 jamais câblés
*(non close)*

### Dette RELOAD-INHAND — Rechargement sans vérification "en main"
*(non close)*

### Dette ASSAULT-CATEGORY — Tir : aucune vérification de catégorie d'arme
*(non close)*

### Bug B‑VX — Modification faces voxel non exposée dans l’UI
*(non close)*

### Bug UI2 — Dés : alignement visuel incorrect
*(non close)*

### Bug UI3 — Dé 100 : affichage chat incorrect
*(non close)*

### Dette DEP1 — Allure Maximale accessible même chargé/encombré
*(non close)*

---

## Notes de nettoyage

- Toutes les entrées marquées `✅` ou closes dans les sessions récentes (2026-07-29 à 2026-08-05) ont été supprimées.
- Les fonctionnalités non-bugs (COMBAT-INTERAGIR-AUTOMOVE, COMBAT-CLICK-RECAP, COMBAT-CLICK-AUTOSOLVE, INVENTAIRE-RECHERCHE-CATEGORIE) ont été retirées du registre et doivent être replacées dans `docs/ROADMAP.md`.
- La section BETA est temporaire ; ses éléments seront dispatchés dans les clusters existants ou de nouveaux clusters après analyse initiale.

# --------------

Bug 22 non existant, verification faite.

Bug #25 — Parasite : jet de dé non implémenté

Ce que le code montre :

    La logique de tirage aléatoire (rollOneMutation, finalizeRoll) ne contient aucune trace d'un traitement spécial pour la mutation Parasite(s). Le tirage se contente de choisir aléatoirement dans la table, sans demander de jet supplémentaire.

    La fiche de mutation Parasite (dans mutations chargées depuis l'API) a probablement un champ has_subtable ou special_effect décrivant la règle RAW (jet pour déterminer le nombre), mais le code ne l'exploite pas.

Verdict : Fonctionnalité absente du composant. Le tirage de la mutation Parasite fonctionne, mais le sous-jet pour déterminer le nombre de parasites n'est pas implémenté.

Bug 18 déjà corrigé. verification faite.

Bug #15 — Compétences inabordables non grisées → soldes négatifs

Ce que le code montre :

    Le serveur valide strictement le budget de compétences via computeSkillAllocation :
    js

    if (err.code === 'over_budget') {
      throw new AppError(400, `Budget de compétences dépassé : ${err.totalCost} pts dépensés sur ${err.budget} disponibles`)
    }

    Donc un solde négatif est rejeté côté serveur. Mais cette validation n'a lieu qu'à la réconciliation, pas en temps réel dans le composant client.

Verdict : Le bug #15 est purement client. Le composant Step4Experience.jsx (ou CareersAllocator.jsx) doit griser les boutons + quand le coût dépasse le budget disponible. Le serveur rejette déjà correctement, mais l'expérience utilisateur est dégradée car le joueur découvre l'erreur seulement en soumettant.

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