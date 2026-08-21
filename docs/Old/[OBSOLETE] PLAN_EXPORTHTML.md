# PLAN_EXPORTHTML — Export fiche personnage (Wizard) vers une fiche HTML autonome

> 2026-08-15 · Remplace `docs/Old/[OBSOLETE] PLAN_EXPORTEXCEL.md`
> Statut : 🔴 CONCEPTION — aucun code écrit pour ce nouveau plan, points ouverts non tranchés (§5).

---

## 0. Contexte et décision

Objectif inchangé depuis le départ : donner à un joueur ayant créé son personnage via le Wizard une
fiche personnage portable, utilisable hors d'Enclume (à table, hors connexion).

Une première tentative a exporté vers le classeur Excel de référence (`Fiche Polaris Online -
Vierge.xlsx`, dérivé d'une Google Sheet que Saar juge par ailleurs "parfaite"). Abandonnée après une
série de défauts **structurels** du format, pas des bugs isolés : styles détruits par `xlsx`/SheetJS
à chaque écriture, commentaires Excel non supportés par `xlsx-populate` (reconstruction manuelle
nécessaire), formules "colonne entière" buguées, cases à cocher natives de Google Sheets qui ne se
traduisent jamais en contrôle Excel à l'export, fonctions `XLOOKUP`/`LET`/`SCAN` écrites sans le
préfixe `_xlfn.` qu'Excel exige d'un fichier tiers (artefact de l'export Google Sheets → Excel), case
à cocher colorée et case à cocher réellement cliquable étant mutuellement exclusives sous Excel/
LibreOffice (les contrôles de formulaire ne supportent pas de couleur personnalisée). Historique
technique complet conservé dans le plan archivé.

**Décision (2026-08-15, avec Saar)** : produire une fiche **HTML autonome** générée par Enclume,
plutôt que de continuer à adapter les données au format d'un tiers non conçu pour l'export
programmatique. Enclume contrôle 100% du rendu — plus de fidélité à négocier avec un moteur externe.

---

## 1. Nature de l'artefact (décisions actées avec Saar)

- Fichier HTML autonome, généré à la demande depuis Enclume (déclenchement UI probablement identique
  à ce qui était prévu pour l'export Excel — bouton dans `CharacterWindow.jsx`).
- Embarque une **photo instantanée** : les données du personnage au moment de l'export (Lot 1
  existant, §2) et le sous-ensemble du catalogue de référence nécessaire au recalcul local (§4 Lot A).
- Une fois généré, le fichier vit de façon autonome : **aucune connexion réseau vers Enclume après
  export**. Cocher une blessure, changer un objet équipé, faire évoluer une maîtrise de compétence
  recalculent localement, en JavaScript, dans le fichier lui-même.
- **Péremption assumée, pas un défaut à corriger** : si le catalogue Enclume change après l'export
  (nouvelle arme, compétence modifiée...), le fichier déjà généré ne le sait pas. Saar : "ça s'arrête
  là." Le même défaut existe déjà dans la Google Sheet actuelle (son onglet catalogue est aussi une
  copie figée) — ce n'est pas une régression introduite par le choix du HTML.
- **Discuté, explicitement pas retenu pour l'instant** (Saar : "c'était juste pour info") :
  - Réimport du fichier édité dans Enclume (symétrique à l'export) — faisable, mais pose un vrai
    problème de conflit (le personnage a pu changer côté Enclume entre-temps ; sans version/date,
    importer écrase sans savoir quoi) et exige la même rigueur de validation qu'une entrée
    utilisateur normale (le serveur ne doit jamais faire confiance à un JSON édité à la main).
  - Bouton de synchronisation live *depuis* la page HTML exportée — écarté : nécessiterait d'embarquer
    un jeton d'accès dans un fichier baladeur (imprimable, partageable, hors du contrôle d'Enclume une
    fois distribué), contrairement à une session de connexion normale. Le bénéfice (récupérer des
    données à jour) est déjà couvert gratuitement par un réexport. Si le réimport (point précédent)
    est un jour retenu, il doit se faire côté Enclume authentifié normalement, jamais par un jeton
    embarqué dans le fichier exporté.

---

## 2. Ce qui est réutilisé sans modification

- **`server/src/services/characterExportService.js`** — agrégation identité/attributs/compétences
  (catalogue complet hors réservées non apprises et catégories sans attribut)/avantages-désavantages/
  inventaire (avec emplacements équipés, `slots`) d'un personnage. Le format de sortie de cette
  fonction est indépendant du support de rendu — elle alimentait l'écriture Excel, elle alimentera le
  gabarit HTML sans modification.
- Toute la connaissance métier qui s'y trouve déjà branchée (`shared/polarisUtils.js`,
  `advantageService.js`, `mutationService.js`, `inventoryService.js`) — autorité inchangée.

---

## 3. Ce qui est abandonné

- `server/src/services/excelExportWriter.js`, `excelExportAssembler.js`
- `tools/audit-excel-named-ranges.js`
- Migrations `244_seed_polaris_export_template.js` / `245_update_polaris_export_template_column_widths.js`
- `server/src/db/seed-assets/polaris-export/fiche-polaris-vierge.xlsx` et
  `docs/PLANS/Fiche Polaris Online - Vierge.xlsx`

Retrait effectif de ces fichiers du dépôt : à faire une fois le nouveau Lot C (§4) livré et validé —
pas avant, pour ne pas perdre le point de comparaison pendant la conception. Décision de suppression
définitive à confirmer avec Saar au moment venu (§5).

---

## 4. Reste à concevoir (prochaines étapes, séquentielles — un lot à la fois)

- **Lot A — Périmètre exact du recalcul local.** Lister précisément quelles règles doivent être
  réimplémentées en JavaScript dans le fichier exporté, et quelle tranche de données de référence
  embarquer pour chacune :
  - Blessure cochée → malus (`shared/woundConstants.js`)
  - Objet équipé par emplacement → protection Armure/Choc/Malus (`shared/armorConstants.js`,
    `ref_equipment` — mêmes champs que ceux déjà remontés par `inventoryService.js`)
  - Maîtrise de compétence → total (portée à trancher, §5)
- **Lot B — Structure du fichier HTML.** Gabarit/mise en page, format des données embarquées (JSON
  inline), organisation du JavaScript de recalcul.
- **Lot C — Génération serveur.** Route + assembleur HTML (symétrique à l'ancien Lot 2/3 Excel).
- **Lot D — Déclenchement UI.** Bouton, téléchargement — probablement inchangé par rapport à ce qui
  existait déjà pour l'Excel (`CharacterWindow.jsx`).

---

## 5. Points ouverts — à trancher avec Saar avant de lancer un lot

- **Évolution de compétence sur la fiche autonome** : recalcul arithmétique simple (total = base +
  maîtrise, la maîtrise étant modifiable à la main sur la fiche), ou gestion complète d'une économie
  de dépense XP (comme le mode Progression d'Enclume) ? Question posée, pas encore répondue.
- **Mise en page** : reproduire fidèlement la maquette Google Sheet (grille, silhouette, sections), ou
  repartir sur une mise en page plus simple à affiner ensuite ? Question posée, pas encore répondue.
- **Retrait des fichiers Excel abandonnés (§3)** : supprimer maintenant ou garder jusqu'à validation
  du nouveau pipeline ?
