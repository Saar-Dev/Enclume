# COUVERTURE_RAW.md — État d'implémentation du Livre de Base, chapitre par chapitre

> **Responsabilité unique** : suivre, au niveau de chaque sous-règle du sommaire du Livre de Base
> Polaris, si elle est implémentée, non pertinente pour Enclume, ou en attente — et vers quel `PLAN`
> se tourner si elle ne l'est pas. Ne duplique pas `docs/SYSTEME/COMBAT REFERENCE.md` (qui documente
> le **détail** pipeline/écarts/régression du combat implémenté) ni `docs/ROADMAP.md` (qui suit
> l'état des **chantiers**, pas des sous-règles) — celui-ci répond à « cette ligne précise du sommaire
> RAW, fait ou pas ? », les deux autres à des questions différentes.
>
> **Origine** : audit exhaustif ligne à ligne du sommaire du Livre de Base fait par Saar (2026-08-25),
> discussion de fond sur l'ordre du backend restant. Philosophie actée le même jour (voir
> `docs/FOUNDATION.md` §2) : **couverture RAW complète (backend) avant esthétique/frontend**.
> Légende : ✅ fait — 🔲 non fait — ⏭️ non pertinent pour Enclume — ❓ fait, à revérifier — 🚧 en cours —
> 🕓 un PLAN existe, pas encore codé.

---

## 1. Tests et actions (LdB p.202-211)

Essentiellement fait. Non retenu comme non pertinent pour un VTT automatisé (jet réel côté serveur,
pas de simulation de hasard "à trancher par le MJ") : Tests non aléatoires, Tests d'opposition non
aléatoires, Défier le destin, Regagner des points de Chance, Chance des PNJ, Personnages héroïques,
Chance de groupe, Nouvelles tentatives et compte à rebours.

🔲 non fait, optionnel/mineur : Limitations en cascade, Échecs différenciés, Compétences utilisées en
soutien, Travail en équipe, Anticiper le danger, Nouveaux adversaires dans le combat (mi-combat).
Aucun PLAN écrit — pas de dépendance identifiée avec le reste, priorité basse.

## 2. Combat (LdB p.212-233)

Le cœur du moteur (initiative, déclaration, actions, mouvement, corps à corps de base, tir de base,
dommages, protections) est ✅ fait. Gaps identifiés :

| Sous-règle | État | Doc |
|---|---|---|
| Armes spéciales (fouets/chaînes, fusil à pompe, lance-flammes, grenades/mines) | 🔲 | `PLANS/PLAN_ARMES_SPECIALES.md` (stub, à cadrer) |
| Arts martiaux et techniques, Lutte, Combat contre plusieurs adversaires, Allonge | 🔲 | RAW transcrite (`REGLES/REGLECACARTMARTIAUX.md`) — **aucun PLAN écrit**, gap trouvé 2026-08-25 |
| Moral | 🔲 | `PLANS/PLAN_MORAL.md` (stub, à cadrer, RAW optionnelle) |
| Tir de suppression | 🔲 | nécessite une résolution de zone d'effet — voir §9 |
| Combat sous l'eau, déplacements sous l'eau/apesanteur | 🔲 | reporté à v3 (sous-marin/abysses), décision Saar |
| Barrières (protection) | 🔲 | pas encore cadré, proche du chantier Armes spéciales |
| Tir en aveugle, Combat en aveugle, Attaquer un personnage sans défense, Attaquer à mains nues un armé, Attaquer par surprise, Repérer le danger, Balles perdues, Tir instinctif, Ramper, Changer d'intention, Utiliser une arme lente | 🔲 | sous-règles ponctuelles, aucune dépendance identifiée, priorité basse |
| Viser avec une arme auto, Tir de précision, Blessures dues au feu, Maladies et poisons, Tests et équipement | ❓ | fait, à revérifier en jeu réel |

## 3. États de santé (LdB p.234-251)

Blessures physiques, Choc, Soins/guérison, Chutes/Acide/Décompression/Feu/Froid/Noyade sont ✅ fait
et confirmés en navigateur (`PLANS/PLAN_FATIGUE_DOMMAGES.md` Lots 0-3, `docs/Old/PLAN_BLESSURES_GUERISON.md`).

🔲 non fait, mineur : Infection, Suractivité, Séquelles, Souffle, Hyperventilation, Drogues
(Narco-dommages/Accoutumance/Dépendance/manque/Effets secondaires), Irradiations. Non pertinent pour
Enclume selon Saar : Faim et soif, Contracter une maladie, Être victime d'un empoisonnement,
Évolution des maladies, Traitements.

🕓 Fatigue — `PLANS/PLAN_FATIGUE_DOMMAGES.md` Lot 4, prochaine étape indépendante des Lots 0-3 clos.

## 4. Force Polaris (LdB p.252-267)

🔲 **Chapitre entier non entamé — aucun PLAN écrit, absent de `docs/ROADMAP.md` jusqu'à ce jour**
(gap trouvé 2026-08-25). Couvre : maîtriser/libérer/contrôler l'effet Polaris, Choc Polaris, Pouvoir
incontrôlé, Incidents Polaris, table de libération accidentelle, et **~40 pouvoirs nommés**
(Altération temporelle, Attaque psychique, Barrière de force/moléculaire/psychique, Bête du flux,
Brouillage, Cauchemar, Champ de force/moléculaire/psychique, Contrôle mental, Dague psychique,
Déchirure du flux, Désintégration/Disruption moléculaire, Destructuration, Foudre, Guérison
psychique/moléculaire, Lames d'énergie/psychiques, Mangeur d'esprit, Masse de destruction,
Modification de la masse/pression/température, Oblitération psychique, Ondes de choc/psychiques,
Ondes Polaris, Pacification/furie, Passage, Perturbation de la réalité, Prescience, Prison mentale,
Pulsion électromagnétique, Régénération moléculaire, Sensibilité psychique, Siphon d'énergie, Sonscan,
Sphère de gravité/répulsion organique/temporelle/terreur, Télékinésie, Téléportation, Tempête du flux,
Tourbillon(s), Vortex psychique) + le flux Polaris (géographie, entités, plongée, possession).

**Dépendance technique majeure** : une part significative de ces pouvoirs sont des effets de zone
(barrières, ondes de choc, champs, sphères) — même prérequis d'infrastructure que les Armes spéciales
à aire d'effet, voir §9. Aucun cadrage possible avant qu'une décision de scope soit prise (tout le
chapitre, ou un sous-ensemble prioritaire de pouvoirs).

## 5. Expérience (LdB p.268-271)

✅ fait — progression, amélioration compétences/attributs.

## 6. Équipement (LdB p.272-337, hors armures mécanisées voir §7)

| Sous-règle | État | Doc |
|---|---|---|
| Acquisition, Munitions spéciales, Armes étourdissantes/soniques, Accessoires pour armes, Armures/protections simples, Encombrement, Drones courants | ✅ | — |
| Intégrité du matériel, Tests de panne, Usure et détérioration, Réparation du matériel | 🔲 | `PLANS/PLAN_USURE&INTEGRITE.md` (stub, à cadrer) — **prérequis explicite d'Exo-armures** (Saar, 2026-08-25) |
| Grenades et autres armes à aire d'effet, Explosifs | 🔲 | `PLANS/PLAN_ARMES_SPECIALES.md`, nécessite la résolution de zone d'effet (§9) |
| Champs de force portatifs, Micro-drones/nano-drones, Dégradation des armures simples | 🔲 | pas cadré, aucune dépendance connue |
| Le marché légal, Le marché noir | 🔲 | non pertinent en l'état actuel (pas de simulation économique) selon la note de Saar, à confirmer |

## 7. Armures mécanisées / Exo-armures (LdB p.322-337)

🚧 **En cours** — `PLANS/PLAN_EXOARMURE.md`. Gestion, catégories, gabarit, attributs, combat et
actions en armure : Lots 1-4/2bis codés et testés, §16.2.1/16.2.2/16.2.5 (plafond Manœuvre d'armure,
armures assistées, milieu hybride) codés et testés le 2026-08-25. Reste : Étape A (déplacement),
Étape B (attaque Tir/CaC), §16.2.3/16.2.4 (munitions).

| Sous-règle | État | Doc |
|---|---|---|
| Réparation (armure) | 🔲 | dépend de la résolution Tests critiques/Catastrophe par marge, `Old/PLAN_TEST_CRITIQUE.md` (cadrage en pause côté Saar) |
| Systèmes électroniques et informatiques, pannes | 🔲 | RAW transcrite (`REGLES/REGLE_ORDINATEUR.md`) — **aucun PLAN écrit**, gap trouvé 2026-08-25, dépendance explicite d'Exo-armures (Saar) |

## 8. Interactions avec l'environnement (transversal, pas un chapitre dédié du LdB)

Bucket cité par Saar comme manquant, mais en réalité trois états très différents :

| Interaction | État réel | Doc |
|---|---|---|
| Porte/échelle (ouvrir, verrouiller) | 🔲 non fait — seul l'ascenseur a une interaction joueur fonctionnelle aujourd'hui | `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` (base de recherche, pas encore un plan) |
| Se cacher derrière un mur (couverture) | ✅ **déjà largement implémenté** — `state_cover`/`coverageModifier` dans `socketCombatHelpers.js`, intégré au calcul de Seuil du tireur | pas un gap réel, à vérifier seulement en jeu (navigateur) |
| Inonder un environnement | 🟡 infrastructure partielle — `BUILTIN_WORLD_EFFECTS` inclut déjà `flooded`/« Inondé » et une propagation par compartiments (`shared/world/worldEffects.js`, `buildCompartmentPropagationGraph`) | reste à vérifier : un déclencheur MJ existe-t-il déjà, ou seulement la donnée/le rendu ? [À vérifier avant de cadrer quoi que ce soit ici] |

## 9. Infrastructure technique partagée — pas un chapitre RAW, un prérequis transversal

**Résolution de zone d'effet (AOE)** — 🔲 **aucune trace dans le pipeline de combat actuel** (recherche
faite 2026-08-25 sur `server/src/socket/`, `server/src/lib/`, `shared/` — zéro occurrence). Prérequis
technique partagé par au moins trois chantiers listés ci-dessus, jamais construit une seule fois pour
tous :
- Armes spéciales — fusil à pompe (cône, bandes de portée), lance-flammes (zone + persistant),
  grenades/mines (zone + dispersion sur échec) ;
- Force Polaris — barrières, ondes de choc, champs, sphères (§4) ;
- Tir de suppression / de couverture (§2).

Construire cette brique une seule fois (multi-cibles, résolution par zone/cône/rayon, application des
dégâts/malus à chaque cible dans la zone) avant d'attaquer le contenu qui en dépend évite de la
réinventer trois fois — mais reste à cadrer : aucun document ne décrit encore cette brique
techniquement (candidat naturel : un nouveau `SYSTEME` une fois écrit, pas un `PLAN` isolé, puisque
plusieurs chantiers en dépendront durablement).

---

## Ordre proposé (à valider avec Saar, `docs/ROADMAP.md` reflète l'état une fois tranché)

Pas encore une décision — une proposition fondée sur les dépendances techniques trouvées ci-dessus,
pas sur une préférence de contenu :

1. **Usure & Intégrité du matériel** — prérequis explicite d'Exo-armures (Saar), débloque aussi
   Informatique/pannes exo et une partie d'Armes spéciales. Cadrage à écrire en premier (stub
   aujourd'hui).
2. **Résolution de zone d'effet (AOE)** — brique technique partagée, prérequis d'Armes spéciales ET
   de Force Polaris. Vaut la peine d'être cadrée/construite une fois, avant le contenu qui en dépend.
3. **Armes spéciales** — une fois §1/§2 disponibles, cadrage RAW déjà transcrit, contenu borné (4
   mécaniques).
4. **Corps à corps / Arts martiaux** — indépendant de §1/§2, RAW déjà transcrite, aucun PLAN écrit —
   peut être cadré en parallèle de §1-3.
5. **Force Polaris** — le plus gros morceau (~40 pouvoirs), dépend de §2. Nécessite d'abord une
   décision de scope (tout le chapitre ou un sous-ensemble).
6. **Informatique/pannes exo** — dépend de §1, complète Exo-armures (§16 du plan).
7. **Interactions environnement** — portes/échelles à cadrer (`PLAN_INTERACTIONS_CONNECTEURS.md`),
   couverture déjà faite (juste à vérifier en jeu), inondation à vérifier avant de cadrer quoi que ce
   soit.
8. **Combat sous-marin** — reporté à v3 (Saar), après tout ce qui précède.

Exo-armures Étape A/B (déjà en cours, `docs/ROADMAP.md` §1) n'attend rien de cette liste — indépendant.
