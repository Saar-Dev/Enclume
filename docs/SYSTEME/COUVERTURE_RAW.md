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
| Drones en combat — télépilotage (INI pilote, `min(programme_armement, TELEPILOTAGE_proprio)`, ciblage direct sans Détection/Ami-Ennemi), séquence autonome Détection→Ami/Ennemi→Armement avec retry −5 INI (12→7→2), cible acquise persistante, programmes Esquive (défense CaC) et Interception | 🔲 | Ajouté 2026-08-26 (gap trouvé en croisant `COUVERTURE_RAW.md` avec l'audit `COMBAT REFERENCE.md` §7.7, absent d'ici jusqu'à ce jour) — RAW transcrite (`REGLES/REGLEDRONE.md`), **aucun PLAN écrit**. Seul le mode autonome à INI 12 fixe + le jet générique `D20 ≤ programme.level` sont réellement câblés (`socketCombatState.js:62-66`, `socketCombatHelpers.js:2496`) ; le reste est une spec RAW transcrite mais jamais construite (`COMBAT REFERENCE.md` §7.7, matrice complète). Aucune dépendance identifiée avec les autres chantiers de cette liste — autonome. |

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

**Dépendance technique — [VÉRIFIÉ] (2026-08-26, correction de l'hypothèse du 25)** : le fichier RAW
existe bel et bien sous le nom `docs/REGLES/REGLEPOLARIS.md` (1655 lignes) — la note du 25 affirmait
à tort qu'aucun fichier n'existait (mauvais nom de fichier cherché). Lu directement pour trancher
l'hypothèse :

- **Le cœur du mécanisme** (Maîtriser/Libérer/Contrôler l'effet, Choc Polaris, Pouvoir incontrôlé,
  Libération involontaire, table Incidents Polaris 1D100 complète) est indépendant de l'AOE — un Test
  de Maîtrise puis un Test de Compétence, un jet de Choc, une table d'incidents. Codable seul.
- **La majorité des ~40 pouvoirs nommés ont réellement un paramètre `Zone d'effet` + `Portée max. du
  centre de la zone d'effet`** (confirmé en lisant Altération temporelle, Attaque psychique, Barrière
  de force/moléculaire/psychique, Bête du flux, Brouillage, Cauchemar — 7/7 sur l'échantillon lu en
  entier) — **l'hypothèse du 25 était juste**, ce n'est plus une déduction depuis des noms de sommaire.
- **Mais ce n'est pas universel** : au moins Contrôle mental (portée + cible unique, la zone d'effet
  n'existe que pour le cas de libération accidentelle/incontrôlée) et vraisemblablement Dague
  psychique (pas de ligne "Zone d'effet" dans son bloc de stats) sont cible unique, sans dépendance AOE.

**Conséquence pour le cadrage** : le chapitre n'est pas un bloc monolithique "tout ou rien derrière
l'AOE". Un premier lot réaliste sans attendre l'AOE : le cœur du mécanisme + les pouvoirs à cible
unique (Contrôle mental, Dague psychique, à confirmer une par une). Les pouvoirs à zone (majorité)
suivent une fois l'AOE (§9) construite. Reste à faire avant tout code : lister précisément les ~40
pouvoirs un par un (zone vs cible unique) — pas fait en entier ici, juste un échantillon suffisant
pour trancher la dépendance elle-même.

## 5. Expérience (LdB p.268-271)

✅ fait — progression, amélioration compétences/attributs.

## 6. Équipement (LdB p.272-337, hors armures mécanisées voir §7)

| Sous-règle | État | Doc |
|---|---|---|
| Acquisition, Intégrité et qualité (p.277), Munitions spéciales, Armes étourdissantes/soniques, Accessoires pour armes, Armures/protections simples, Encombrement, Autres types de dommages | ✅ | — |
| Drones courants — fiche, création, programmes, armes/ordinateurs | ✅ | — **mais leur comportement EN COMBAT a des gaps réels, voir §2** (télépilotage, séquence autonome, Esquive/Interception) — ne pas confondre "le drone existe et s'équipe" avec "le drone se comporte selon la RAW en combat" |
| Tests et équipement (p.277) | ❓ | fait, à revérifier en jeu réel |
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
| Réparation (armure) | 🔲 | **Corrigé (2026-08-26)** — n'est plus bloqué : `Old/PLAN_TEST_CRITIQUE.md` est clos (Lot 1 confirmé en navigateur par Saar 2026-07-30, Lots 2/3 codés), archivé, contenu durable transféré vers `COMBAT.md` §"Résolution des Tests" (`resolveTestOutcome`/`MR_TABLE`, vérifié actif aujourd'hui). Rien ne cadre encore ce sous-chantier (RAW MANUEL §4.12), mais plus aucun blocage technique — prêt à cadrer dès que priorisé |
| Systèmes électroniques et informatiques, pannes | 🔲 | RAW transcrite (`REGLES/REGLE_ORDINATEUR.md`) — **aucun PLAN écrit**, gap trouvé 2026-08-25, dépendance explicite d'Exo-armures (Saar) |

## 8. Interactions avec l'environnement (transversal, pas un chapitre dédié du LdB)

Bucket cité par Saar comme manquant. **Re-vérifié le 2026-08-25 sur son instruction** ("a déjà une
base dans le code, à vérifier") — état réel bien plus avancé que la première passe de ce document :

| Interaction | État réel | Doc |
|---|---|---|
| Interagir avec une entité (skill check + confirmation MJ + jet, ex. levier/console) | ✅ **moteur générique entièrement construit et câblé** — `server/src/socket/socketEntity.js` (`ENTITY_ACTION_REQUEST`/`RESOLVE`), menu radial client (`SessionPage.jsx` `handleEntityAction`), éditeur complet (`EntityBuilderTab.jsx`, i18n fini). **Zéro blueprint n'utilise la fonctionnalité en base** — gap de contenu, pas de moteur | — |
| Déplacer un objet (pousser/tirer, ex. caisse pour se couvrir) | ✅ **moteur générique entièrement construit et câblé** — `ENTITY_MOVE_REQUEST` (`socketEntity.js`, validation portée/direction/sens serveur PE27), `handleEntityMove` côté client. Même gap : aucun blueprint "caisse" n'existe | — |
| Porte/échelle (ouvrir, verrouiller) | 🔲 **vrai gap, confirmé** — ce sont des `surface_data.connectors`, un système structurel séparé des entités, pas branché sur le moteur ci-dessus. Ascenseur seul fonctionnel (système dédié à part, `worldElevatorService.js`) | `PLANS/PLAN_INTERACTIONS_CONNECTEURS.md` — **architecture tranchée (2026-08-25)** : `world_feature_states` (déjà générique, déjà utilisée par l'ascenseur, déjà attendue par `doorGeometry()` dans le compilateur) + un handler léger réutilisant le patron d'arbitrage `ENTITY_ACTION_REQUEST`, sans la complexité passagers/cinématique de l'ascenseur |
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

## Ordre

**Établi avec Saar (2026-08-26)**, après correction de l'hypothèse AOE↔Force Polaris (§4, maintenant
[VÉRIFIÉ] par lecture directe de `REGLEPOLARIS.md`) :

**AOE → Portes → Exo Étape A/B → Usure/Intégrité + Informatique/pannes exo → Drones (télépilotage
etc.) → [Armes spéciales + Tir de suppression, débloqués par l'AOE] → Force Polaris (Lot 1 : cœur +
pouvoirs à cible unique) → Arts martiaux/Moral.**

**Corrigé (analyse à charge, 2026-08-26)** — Armes spéciales et Tir de suppression avaient été cités
comme bénéficiaires de l'AOE dans le raisonnement, puis oubliés de la liste ordonnée elle-même lors
d'un premier passage. Replacés ici, juste après Drones (aucune contrainte technique ne les positionne
précisément — casables n'importe où après AOE, y compris avant Drones si préféré). Barrières
(protection) suit la même logique qu'Armes spéciales, non listée séparément mais dans le même groupe.

**Chantiers déjà "prêts" (`ROADMAP.md` §1) mais hors de cette séquence RAW** — indépendants des 9
chantiers ci-dessus, casables en parallèle sans attendre quoi que ce soit de cette liste :
Milieu par pièce (moteur monde — architecture déjà tranchée, prépare aussi v3 et le milieu hybride
exo §16.2.5), Silhouette d'avaries exo (UI, composant frère de `BodySilhouetteSvg.jsx`), i18n Lot 5
(catalogue `ref_*`), Fatigue Lot 4. Omis une première fois de cette discussion de séquence — pas
abandonnés, juste sur une piste parallèle qui ne concerne pas la couverture RAW backend.

- AOE en tête sur préférence explicite de Saar : une seule brique débloque 3 chantiers de contenu
  (Armes spéciales, Tir de suppression, Force Polaris) — meilleur rendement de toute la liste.
- AOE, Portes et Exo Étape A/B sont mutuellement indépendants sur le plan technique — leur ordre
  relatif est un choix de priorité assumé, pas une dépendance.
- Usure/Intégrité + Informatique/pannes suivent Exo Étape A/B : rendent l'exo-armure réellement
  complète (dégradation, pannes) après que l'Étape A/B l'ait rendue jouable (déplacement/attaque).
- Arts martiaux et Moral n'ont aucune dépendance technique identifiée — casables n'importe où dans
  cette liste selon préférence produit, placés en fin par défaut faute de priorité exprimée.
- Réparation (armure exo), marché légal/noir, champs de force portatifs, micro/nano-drones,
  dégradation armures simples, sous-règles mineures de §1/§2/§3 : hors de cette séquence, sans ordre
  particulier, à traiter au fil de l'eau une fois le bloc ci-dessus digéré.

**Historique** : une première version de cette section (2026-08-25) proposait un ordre par déduction
de dépendances techniques trouvées par recherche de code (grep), pas par compréhension du jeu — retiré
le jour même, un maillon (Force Polaris → AOE) reposant sur une hypothèse jamais vérifiée en lisant la
RAW. L'ordre ci-dessus a été établi différemment le lendemain : dépendances réelles vérifiées par
lecture RAW directe, priorités discutées explicitement avec Saar plutôt que déduites seul.

Exo-armures Étape A/B n'attend techniquement rien de cette liste — indépendant, placé après AOE/Portes
par préférence de Saar, pas par contrainte.
