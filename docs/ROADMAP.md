# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-08-06 — Blessures : Guérison/Infection
> (`docs/Old/PLAN_BLESSURES_GUERISON.md`) clos, confirmé fonctionnel par Saar en navigateur ;
> contenu durable transféré vers `docs/SYSTEME/BLESSURES.md`. Chantier 11 (Module Blessures) : badges
> de statut — animation d'apparition ajoutée, confirmée fonctionnelle (détail `docs/JOURNAL8.md`).
> 2026-08-05 — Refonte UX Matériel : Étapes 0-5 closes et confirmées
> fonctionnelles par Saar (`docs/PLANS/PLAN_INVENTORY_UX.md`, drag & drop complet). Étapes 6-8 codées
> (filtres/pagination catalogue GM, confirmation suppression + séparation Coffre, bouton "Prendre dans
> le Sac"), Étape 9 codée partiellement (libellés de slot) — toutes non testées en navigateur. Retrait
> différé du `<select>` de Slot dans `InventoryPanel.jsx` (accessibilité clavier à traiter d'abord) ;
> le `<select>` de container (Sac/Coffre), lui, a été retiré (demande directe Saar 2026-08-05, bouton
> "Ranger dans le Coffre" ajouté en compensation). Bug drag & drop corrigé au passage : cliquer un
> élément interactif (select/input/bouton) dans une ligne draggable déclenchait un drag —
> `InteractiveAwarePointerSensor` (CharacterWindow.jsx) filtre l'activation sur ces éléments.
> 2026-07-30 — Fatigue & Dommages : Lot 3 clos (Chute/Acide/Décompression/Feu,
> `docs/PLAN_FATIGUE_DOMMAGES.md` §9), confirmé fonctionnel par Saar en navigateur. Prochaine étape du
> chantier : Lot 4 (Fatigue).
> 2026-07-30 — Exo-armures : Lot 0 clos, Lot 1 rédigé et prêt à coder
> (`docs/PLAN_EXOARMURE.md`) ; entrée "Catastrophes" remplacée par le chantier formel
> `docs/PLAN_TEST_CRITIQUE.md` (cadrage en pause côté Saar).
> 2026-07-30 — précision sur "Ergonomie et pédagogie des règles" (besoin concret
> noté en tranchant `docs/Old/PLAN_BLESSURES_GUERISON.md` §8, affichage UI des règles de Guérison/Infection).
> 2026-07-29 — ajout "Membres détruits" (Option de campagne, `docs/Old/PLAN_BLESSURES_GUERISON.md`, décision Saar de différer plutôt que de trancher la modélisation en base maintenant) ; ST1 (Badges statut token) clos en correctif ponctuel (28×28px taille écran fixe), retiré de "chantier UI/UX" ; ajout "Eau structurelle authorée" (v2, décision Saar suite dette EAU1) ; 2026-07-24 — Dette INI5 (forfait Initiative CaC) close, retirée (voir `docs/EN_COURS.md` item 111) ; 2026-07-21 — Moding Groupe 4 : chantier clos (Phases 1/3/4 codées et testées, dettes résiduelles dans `docs/BUGIDENTIFIE.md`).
> Ce document est prospectif. L’historique complet est dans `docs/ASBUILT.md` et `docs/JOURNAL8.md`.
> **Bugs et dettes techniques** : voir le registre unique `docs/BUGIDENTIFIE.md`.

---

## Phase 2 — Battlemap 3D + session de jeu (en cours)

### Chantier 11 — Module Blessures
- Étape 4 : Polish — animation Tests de Choc restante (apparition des badges de statut faite,
  `docs/JOURNAL8.md`) — 🔲

### Chantier `PLAN_MUTATION2.md` — Mutations & Avantages
- Lot 7 : Narratif/économie (priorité basse) — 🔲

### Options de campagne
- `revers` — 🔲
- `skill_natural_prog` — 🔲
- `celebrity` — 🔲
- Membres détruits (distinction Mortelle vs Membre détruit, `docs/Old/PLAN_BLESSURES_GUERISON.md` §3.2/§8
  — décision Saar 2026-07-29 : différé, la gravité Mortelle couvre Bras/Jambes comme Tête/Corps tant
  que cette option n'existe pas) — 🔲

### Autres chantiers immédiats
- Upload screenshot éditeur → MinIO — 🔲
- Jets Favoris : drag‑to‑reorder macros (UI) — 🔲
- Paramètre campagne GM entity move mode (reporté) — 🔲

---

## Phase 3 — Polish + assets
- Avatars utilisateur
- Optimisation voxel face culling
- Persistance viewport caméra
- Reconnexion WebSocket
- Favicon application

---

## Chantiers futurs — à planifier
- Arts Martiaux (techniques offensives/défensives, Saisie/Lutte)
- LOS & Raycast (replanifier avec Kiwi)
- Résolution des Tests critiques/Catastrophe par marge, pas par valeur de dé (`docs/PLAN_TEST_CRITIQUE.md`,
  cadrage v1 **en pause côté Saar** — doit revenir avec la lecture RAW exacte de la table de marge
  avant de trancher) — bloque uniquement le Lot 8 (Réparation) d'Exo-armures, aucune autre dépendance
- Fatigue, Maladies/Poisons, Drogues, Irradiations, Faim/soif, dangers environnementaux (Froid/Noyade), horloge de campagne — `docs/PLAN_FATIGUE_DOMMAGES.md`, plan en 10 lots. **Lots 0-3 clos et codés** (horloge de campagne, moteur d'échéances, Blessures/Guérison, Chute/Acide/Décompression/Feu — confirmés fonctionnels par Saar). Prochaine étape : Lot 4 (Fatigue)
- Exo-armures (`docs/PLAN_EXOARMURE.md`, plan en 8 lots + Lot 2bis, Lot 0 cadrage clos — **Lot 1
  (Fondations) rédigé et prêt à coder**, analyse à charge faite ; Lots 2/3 définis mais pas encore
  rédigés en détail, indépendants de `PLAN_TEST_CRITIQUE.md` ; seul le Lot 8 en dépend)
- Refonte UX Matériel (`docs/PLANS/PLAN_INVENTORY_UX.md`, plan en 10 étapes — **Étapes 0-5 closes et
  confirmées fonctionnelles par Saar 2026-08-05** : source unique de vérité inventaire, bandeau
  poids/sols, réorganisation Armes/Conteneurs, drag & drop complet avec dialogue de conflit
  main/2-mains). **Étapes 6-8 codées 2026-08-05, non testées en navigateur** (filtres/pagination
  catalogue GM, confirmation suppression + séparation visuelle Coffre, bouton "Prendre dans le Sac").
  **Étape 9 codée partiellement** (libellés de slot traduits) — le retrait du `<select>` de Slot reste
  différé (accessibilité clavier, voir ci-dessous). Décision Saar en cours de route : la grille 2
  colonnes (Étape 4) est annulée après test, retour à l'empilement vertical ; la zone "2 Mains" dédiée
  est supprimée (fusionnée dans Main Directrice/Secondaire) ; silhouette centrée horiz./vertical et
  agrandie à 80% de l'espace disponible (`SilhouettePanel.jsx`/`ArmorWoundPanel.jsx`) ; gras retiré des
  vignettes de dégâts (`index.css` `.badge-damage-normal/.badge-damage-choc .num`)
- Retrait du `<select>` de Slot dans `InventoryPanel.jsx` (décision Saar 2026-08-05 : redondant une
  fois le drag & drop en place) — **différé** : nécessite d'abord un `KeyboardSensor` `@dnd-kit` pour
  ne pas régresser l'accessibilité clavier exigée par `PLAN_INVENTORY_UX.md` §5.5 (dnd-kit ne supporte
  actuellement que la souris/tactile dans cette interface, `PointerSensor` seul). Option alternative :
  accepter explicitement le compromis d'accessibilité si le clavier n'est pas un besoin réel pour ce
  groupe de jeu. Le `<select>` de container (Sac/Coffre) a lui été retiré 2026-08-05 (demande directe
  Saar, même compromis d'accessibilité accepté pour ce select-là) — bouton "Ranger dans le Coffre"
  ajouté en compensation fonctionnelle (aucune zone de drop Coffre n'existe, §5.3)
- Tourelles / armes lourdes fixes (entités interactives)
- Moding Groupe 4 (slot logiciel) — chantier clos (Session 167, architecture `docs/SYSTEME/MODING.md`, Phases 1/3/4 codées et testées) ; 4 dettes résiduelles `docs/BUGIDENTIFIE.md` (`MODING4-*`) ; migration Groupe 1/2 (Phase 2) reportée (Strangler Fig)
- Ergonomie et pédagogie des règles (explication proactive des bonus/malus ; besoin concret noté
  2026-07-30 en cadrant `docs/Old/PLAN_BLESSURES_GUERISON.md` — afficher les règles de Guérison/Infection
  dans l'UI, tooltips envisagés, pas encore cadré)
- Export PDF fiche personnage
- Wizard création à deux (GM + joueur)
- Matériel → objets réels (conversion dans inventaire)
- Chat persistant (historique)
- Chat MP (messagerie privée)
- Mode spectateur
- Sauvegarde/export carte 3D
- Battlemap 2D (illustration ou tokens sur fond 2D) — `docs/PLAN_BATTLEMAP2D.md`, plan en 4 lots, Lot 0 (cadrage) clos, aucun code
- Spotlight / bibliothèque de présentation (personnage, document, indice) — besoin identifié pendant le cadrage Battlemap 2D, plan encore à écrire
- Eau structurelle authorée (lacs, sas et calles sèches de navires, ponts d'arrimage) — nécessite un outil d'édition dédié + compilation serveur dans le `WorldSnapshot`, pas une reconstruction géométrique côté client. Option différée de la dette `docs/BUGIDENTIFIE.md` EAU1 ; v2, décision Saar 2026-07-29 ("peut largement attendre")

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques