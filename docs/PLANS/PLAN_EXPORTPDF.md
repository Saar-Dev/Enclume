# PLAN_EXPORTPDF — Export PDF des fiches personnage (Wizard)
> 2026-07-08 · Master plan multi-lots (séquentiel)
> Statut : 🔶 PROPOSITION — architecture à valider par Saar avant Lot 0. Aucun code écrit.

---

## 0. CONTEXTE

Demande Saar : permettre l'export en PDF d'une fiche personnage créée via le Wizard. Deux pistes
possibles à l'origine :
1. Remplir la fiche officielle du jeu (`docs/Character/FDP_polaris_editable.pdf`, fournie par Saar).
2. Générer notre propre PDF depuis les données de la fiche.

Saar a explicitement écarté le bricolage : "on a le temps, mais bricolage interdit" — recherche de
solutions robustes/pérennes exigée, pas de correctif rapide, inspiration de dépôts GitHub/pratiques
pro avant d'implémenter.

**Contrainte Raspberry Pi 4 en train de s'assouplir** (l'autre développeur du projet développe un
frontend de plus en plus lourd) — les options serveur plus gourmandes (headless Chrome) redeviennent
envisageables, alors qu'elles auraient été écartées d'office il y a quelques sessions.

---

## 1. INVESTIGATION — Fiche officielle (`FDP_polaris_editable.pdf`)

Inspection technique réalisée (script `pdf-lib` jetable, scratchpad, lecture du PDF) :

- **Formulaire XFA dynamique** (Adobe LiveCycle), pas un AcroForm classique. `pdf-lib` le signale
  explicitement : *"Removing XFA form data as pdf-lib does not support reading or writing XFA"*.
  Confirmé par un second indice : la structure interne ne compte que 2 pages
  (`topmostSubform.Page1`/`Page2`) alors que le lecteur PDF annonce 16 pages — signature classique
  d'un rendu XFA dynamique recalculé à l'ouverture, découplé de la structure statique du fichier.
- **420 champs de formulaire, tous nommés génériquement** (`Champ_de_texte1[0]` à `[290]`,
  `Case_à_cocher1[0-3]`, etc.) — aucun nom sémantique exploitable. Même en écartant XFA, un mapping
  manuel d'environ 400 champs à leur position visuelle serait nécessaire pour savoir lequel
  correspond à Force, Coordination, chaque ligne de compétence, etc.
- Recherche externe confirmée : **XFA est déprécié par Adobe**. La plupart des bibliothèques
  open-source (`pdf-lib`, `pypdf`, `pdfrw`) l'ignorent ou le suppriment au lieu de le lire/écrire. Une
  conversion propre XFA→AcroForm nécessite Acrobat Pro (conversion manuelle unique, non scriptable,
  non reproductible en CI) ou des SDK commerciaux (Apryse/Datalogics).
- Précédent communautaire : le module Foundry VTT `pdf-sheet` (référence dans l'écosystème TTRPG)
  choisit délibérément d'exiger en entrée un PDF **déjà fillable** (non-XFA), plutôt que de gérer XFA
  — confirmation indépendante que même les devs pro évitent cette voie.

**Conclusion : la voie "remplir la fiche officielle" est écartée.** Dépendance à une techno
dépréciée, non scriptable proprement avec de l'outillage libre, mapping manuel fragile de 400 champs
anonymes — l'inverse d'une solution pérenne.

La fiche officielle reste néanmoins utile comme **référence visuelle** (mise en page, regroupements,
libellés) pour la génération de notre propre PDF (Lot 1).

---

## 2. INVESTIGATION — Génération de notre propre PDF

Deux architectures candidates identifiées et comparées (recherche + vérification compatibilité) :

| Critère | `@react-pdf/renderer` | Puppeteer (Chromium headless) |
|---|---|---|
| Compatibilité React 19 | ✅ depuis v4.1.0 (vérifié) | N/A — rend du HTML/CSS, pas du React |
| Réutilisation de `CharacterSheet.jsx` (1184 lignes) | ❌ sous-ensemble JSX/CSS propriétaire (Yoga flexbox, **pas de CSS Grid**, pas de pseudo-sélecteurs) — layout à réécrire intégralement | ✅ réutilise le vrai moteur CSS (grid/tables identiques à l'écran) — fidélité totale |
| Poids / dépendances | Léger, **zéro binaire natif**, génération <500ms | Chromium embarqué (~100 Mo+), génération 2-5s |
| Compatible Raspberry Pi 4 | ✅ sans réserve | ✅ possible — builds ARM64 officiels via Chrome for Testing (`chrome-headless-shell`), mais montée en charge mémoire à surveiller/limiter (`--max-old-space-size`, contexte incognito réutilisé plutôt que relancer le navigateur à chaque export) |
| Risque de divergence dans le temps | **Élevé** — deux implémentations de layout (écran + PDF) à maintenir en parallèle, sur une fiche qui continue d'évoluer (Wizard toujours en chantier actif) | **Faible** — un seul layout source de vérité, le PDF suit automatiquement les futures évolutions de `CharacterSheet.jsx` |

**Recommandation : Puppeteer.** Le critère décisif est la maintenance à long terme, pas la
performance brute : `CharacterSheet.jsx` est dense (1184 lignes) et continue d'évoluer à chaque
session liée au Wizard/fiche perso — dupliquer son layout dans le sous-ensemble contraint de
`react-pdf` créerait une dette de synchronisation permanente, à l'opposé de l'exigence "pérenne".
Puppeteer, via une vue HTML dédiée à l'impression (CSS `@media print`), garde un seul layout source
de vérité.

**À valider par Saar avant Lot 0** — c'est un choix structurant, pas un détail d'implémentation.

Sources de la recherche (résumé) :
- [pdf-lib — limitation XFA](https://pdf-lib.js.org/docs/api/classes/pdfform)
- [Datalogics — Static XFA, Dynamic XFA and AcroForms](https://www.datalogics.com/pdf-forms)
- [Datalogics — XFA Forms Deprecated](https://www.datalogics.com/xfa-form-deprecation-what-it-means-and-what-to-do)
- [react-pdf — compatibilité React](https://react-pdf.org/compatibility)
- [react-pdf — issue support React 19](https://github.com/diegomura/react-pdf/issues/2935)
- [PDF Generation on the Server: Puppeteer vs @react-pdf/renderer (Production Comparison)](https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg)
- [Foundry VTT — module `pdf-sheet` (GitHub)](https://github.com/arcanistzed/pdf-sheet)
- [Puppeteer sur ARM/Raspberry Pi](https://chsamii.medium.com/puppeteer-on-raspbian-nodejs-3425ccea470e)

---

## 3. DÉCOUPAGE EN LOTS (proposition, séquentiel — un lot = un plan détaillé avant code)

> Détail ligne-à-ligne volontairement absent à ce stade — comme pour `PLAN_REWORKFINAL`, chaque lot
> sera cadré précisément (fichiers, lignes, ce qui change) juste avant son propre "Je code ?", pas
> maintenant. Ce découpage sert à fixer la séquence et le périmètre de chaque étape.

- **Lot 0 — Socle technique.** Installer Puppeteer côté serveur, vérifier l'exécution sur
  l'environnement cible (dev + Raspberry Pi si accessible), route serveur minimale
  (`GET /api/characters/:id/export-pdf` ou équivalent) qui rend une page HTML de test (identité
  seule) en PDF et la retourne en téléchargement. Objectif : valider la chaîne technique de bout en
  bout avant d'investir dans la mise en page complète.
- **Lot 1 — Vue imprimable dédiée + mapping des données.** Nouveau composant (ou route
  serveur-rendu) reproduisant visuellement la fiche officielle (attributs, compétences, carrières,
  mutations, avantages, inventaire, description physique/main directrice) avec les vraies données
  de `char_sheet`. Plus gros lot — nécessite l'inventaire exhaustif des données affichées par
  `CharacterSheet.jsx` (1184 lignes, jamais lu en entier dans cette conversation) et leur
  disponibilité via l'API existante. CSS `@media print` dédié (pagination, marges).
- **Lot 2 — Déclenchement UI.** Bouton d'export depuis `CharacterWindow.jsx`/`CharacterSheet.jsx`
  (et/ou la liste de personnages), gestion du téléchargement, état de chargement (génération
  Puppeteer non instantanée), gestion d'erreur.
- **Lot 3 — Polish.** Pagination propre sur plusieurs pages si besoin, en-tête/pied de page
  (nom du personnage, date d'export), éventuellement illustration de carrière/génotype. Portée à
  affiner selon retour de Saar après Lot 1.

---

## 4. CE QUI NE CHANGE PAS

- Aucune migration DB prévue — l'export lit les données déjà persistées par le Wizard
  (`reconcileCreation`), il n'en crée pas de nouvelles.
- La fiche officielle (`FDP_polaris_editable.pdf`) n'est plus une cible de remplissage automatique —
  conservée uniquement comme référence visuelle pour le Lot 1.
- `CharacterSheet.jsx` (écran) n'est pas modifié par ce chantier — l'export construit une vue
  séparée dédiée à l'impression, pas une transformation du composant existant.

---

## 5. POINTS OUVERTS — à trancher avec Saar avant Lot 0

1. **Architecture** : confirmer Puppeteer (recommandé) vs `@react-pdf/renderer`.
2. **Déclencheur** : export depuis la fiche perso uniquement, ou aussi depuis la liste de
   personnages / en fin de Wizard (bouton "Terminer" propose aussi un export) ?
3. **Portée visuelle** : reproduire fidèlement la mise en page de la fiche officielle (2 colonnes
   denses façon LdB), ou une mise en page maison plus simple/lisible à l'écran comme à l'impression ?
4. **Personnages GM/PNJ** : export disponible aussi pour les fiches créées/gérées par le GM, ou
   strictement pour les fiches joueur issues du Wizard ?
