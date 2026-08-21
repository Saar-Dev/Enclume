# PLAN_EXPORTEXCEL — Export fiche personnage (Wizard) vers Excel via plages nommées

> **[OBSOLETE] (2026-08-15)** — Abandonné après une série de défauts structurels du format Excel
> (styles détruits par `xlsx`/SheetJS, commentaires non supportés par `xlsx-populate`, colonnes
> entières buguées, cases à cocher Google Sheets non traduisibles en Excel, `XLOOKUP`/`LET` mal
> encodés par l'export Google Sheets → Excel, case à cocher colorée et cliquable mutuellement
> exclusives sous Excel/LibreOffice). Remplacé par `docs/PLANS/PLAN_EXPORTHTML.md` (fiche HTML
> autonome). Conservé ici pour l'historique technique (investigation des plages nommées, bugs trouvés
> et corrigés) — ne pas reprendre ce plan tel quel.

> 2026-08-13, mis à jour 2026-08-15 · Master plan multi-lots (séquentiel)
> Statut : 🟡 LOT 3 TESTÉ NAVIGATEUR PAR SAAR, BUG TROUVÉ ET CORRIGÉ — export fonctionnel de bout en
> bout (bouton, téléchargement, mise en forme intacte via `xlsx-populate`), mais fiche générée avec
> des `#VALEUR!`/`###` en cascade sur tout le classeur (personnage `Baboulinet`, génotype jamais
> choisi au Wizard). Cause racine identifiée et corrigée : `writeGenotype` écrivait une chaîne vide
> dans `Liste_TypeGen` quand `genotype_id` est `null`, au lieu du défaut "Humain" déjà utilisé partout
> ailleurs (`CharacterSheet.jsx`, `archetype.genotype_id || 'HUMAIN'`) — §2.2ter. Corrigé, revérifié
> par recalcul LibreOffice réel sur le même personnage (`Baboulinet` : cascade disparue, zéro nouvelle
> erreur introduite ailleurs sur le classeur). Reste à confirmer par Saar : réexport en navigateur
> avec le correctif. Lot 0b (test Saar indépendant) toujours en attente. Rien commité pour l'instant.

---

## 0. CONTEXTE

Demande Saar : permettre l'export d'une fiche personnage créée via le Wizard vers le classeur
Excel fourni `docs/PLANS/Fiche Polaris Online - Vierge.xlsx`, en écrivant dans ses **plages
nommées** (`definedNames`) plutôt qu'en remplissant un PDF (piste déjà écartée, voir
piste PDF écartée après investigation — formulaire XFA de la fiche officielle, 420 champs
anonymes ; doc d'investigation depuis archivé/retiré du dépôt).

Ce classeur est en meilleure posture de départ que le PDF officiel : ses ~300 plages sont **toutes
nommées sémantiquement** (`ATTBaseFor`, `CompNom`, `Avantages`...). Mais l'investigation ci-dessous
montre que le classeur porte lui-même un risque structurel sérieux (origine Google Sheets, formules
non portables) qui doit être tranché **avant** tout travail de mapping — voir §1.3.

---

## 1. INVESTIGATION — Le classeur `Fiche Polaris Online - Vierge.xlsx`

Le fichier `.xlsx` n'est pas lisible directement (format binaire zip) : inspection réalisée en
l'extrayant comme archive et en lisant `xl/workbook.xml` (`definedNames`) et les XML de feuilles
(scripts Node jetables, scratchpad, rien d'écrit dans le dépôt).

### 1.1 Vue d'ensemble

Classeur multi-feuilles construit à l'origine dans **Google Sheets** (confirmé indépendamment par
le rapport d'investigation Wizard §Découverte majeure : lignage direct avec
`docs/Old/Kiwi/10_WebApp_Competences.gs` et `docs/Old/script Extraction Excel/`) puis exporté en
`.xlsx`.

**308 plages nommées** (`[OBSERVÉ]`, une plage `MunitionsCAL` pointe vers `#REF!` — référence déjà
cassée, défaut préexistant du fichier, indépendant de nous) réparties sur 6 feuilles :

| Feuille | Plages nommées | Nature |
|---|---|---|
| `Personnage` | 181 | Fiche du personnage (identité, attributs, compétences, blessures, équipement porté...) |
| `Divers` | 33 | Colonnes-sources des listes déroulantes (validation de données) |
| `Equipements` | 31 | Catalogue **statique** d'objets (717 lignes déjà remplies dans le fichier "Vierge" — `_xlnm._FilterDatabase = Equipements!$A$1:$AJ$718`) |
| `Inventaire` | 31 | Table **par-personnage**, vide dans le "Vierge" (objets possédés) |
| `Bourses` | 24 | Registre de transactions financières (journal, pas un solde) |
| `Compétences` | 7 | Catalogue **statique** des compétences (colonnes entières) |

### 1.2 Trois familles de plages, pas une seule

Classer une plage nommée par sa forme suffit à distinguer trois usages très différents — confirmé
en inspectant les cellules cibles (présence ou non d'une balise `<f>` formule) :

1. **Entrées de création** — cellule statique (`<v>` sans `<f>`), à écrire depuis le Wizard.
   Exemples : `ATTBaseFor` (`Personnage!$AE$5`, valeur `7`), `ATTMPCFor` (`$AE$7`, valeur `1`),
   `Fiche_Nom` (`$B$6`), `Avantages` (`$W$70:$W$86`, bloc de 17 lignes).
2. **Calculs automatiques de la feuille** — cellule formule, à ne **jamais** écraser.
   Exemple : `ATTNaFor` = `ATTBaseFor+ATTMTGFor+ATTMPCFor+ATTMalFor` (`Personnage!$AE$9`) ;
   `ATTAnFor` = table de palier appliquée à `ATTNaFor` (`$AE$11`).
3. **Suivi de partie en cours** — n'existe pas encore à la création du personnage.
   Exemple : tout le bloc `Blessures*` (une quinzaine de plages 1-3 cellules), les 24 plages
   `Bourses*` (journal de transactions), les munitions/chargeurs actuels.

**`[TRANCHÉ]` (2026-08-13)** — Décision Saar confirmée pour la famille 3 :
- **`Bourses*`** : jamais rempli par le Wizard (aucune transaction n'existe encore à la création).
- **Emplacements d'équipement porté** (`ArmesObj1`, `TeteObj1/2/3`, `CorpsObj1/2/3`, `DosObj`,
  `CeintureObj`, JD/JG, munitions équipées) : jamais remplis — tout objet assigné par le Wizard
  (Step 6, optionnel) va dans `Inventaire`, jamais dans un emplacement équipé.
- **`Blessures*`** : reste vide, y compris pour les cas qui semblaient à première vue relever de la
  création (mutation "Organe sensoriel manquant", revers de carrière "main coupée"). Vérifié dans le
  code (§2.4) : aucun des deux ne produit d'enregistrement mécanique localisation+gravité
  compatible avec cette grille — le remplir demanderait d'inventer une interprétation mécanique hors
  RAW (CLAUDE.md §1.9). Le texte narratif de ces effets part dans les zones texte déjà prévues
  (Désavantages/notes), pas dans `Blessures*`.

### 1.3 Risque — formules non portables hors Google Sheets, et périmètre réel une fois dédupliqué

**`[OBSERVÉ]`** Sur la feuille `Personnage`, 1148 cellules formules (+ 29 sur `Divers`, soit 1177
au total) utilisent `__xludf.DUMMYFUNCTION("...")` — la balise que Google Sheets écrit à l'export
`.xlsx` quand une formule n'a pas d'équivalent Excel natif sérialisable. Point important :
**`__xludf.DUMMYFUNCTION` contient la formule Google Sheets d'origine intégralement, comme chaîne
de texte** — elle est donc récupérable par script (déséchappement des guillemets doublés), pas
perdue. La feuille `Inventaire` a ses 565 formules propres (0 `DUMMYFUNCTION`).

**Déduplication (script jetable, scratchpad)** : ces 1177 cellules ne portent que **47 formules
textuellement uniques** — la plupart des colonnes répètent la même formule sur des centaines de
lignes (`ROW()` relatif). Après lecture détaillée des 47 :

| Catégorie | Nb de motifs uniques | Nb de cellules | Dans le périmètre Wizard ? |
|---|---|---|---|
| Base/Total des compétences (`CompAttributs`→`ATTAn*`, puis `+Maîtrise+Blessures_Malus+ActionModMalCombat`) | 4 (2 formules × 2 variantes ligne 39 / lignes suivantes) | ~567+73 | **Oui** — seul bloc pertinent |
| Malus `ATTMalCoo` (`AK8`, basé sur `ProtMalRecap`) | 1 | 1 | Non — dépend d'armure équipée |
| Moteur armes/munitions/armures (parsing regex de dégâts `XDY+Z`, codes d'effets de munitions, filtrage des listes déroulantes par emplacement Tête/Corps/Ceinture/Dos/JD/JG, malus de charge) | 42 | ~600 | **Non** — équipement *porté en jeu*, jamais assigné par le Wizard (§2.5) |

**Conséquence directe** : le "moteur armes/munitions/armures" (42 formules sur 47, souvent
plusieurs milliers de caractères chacune, combinant `REGEXEXTRACT`/`REGEXMATCH`/`REGEXREPLACE`,
`FILTER`/`SORT`/`UNIQUE`/`XLOOKUP`/`MAP`+`LAMBDA`) reste cassé dans le fichier exporté — **et ce
n'est pas un problème** : pour un personnage qui sort du Wizard, ces emplacements (arme en main,
armure portée) sont vides, ces formules n'ont donc rien de significatif à calculer. Reconstruire ce
bloc n'est pas nécessaire pour cette fonctionnalité (à réévaluer séparément si un jour Enclume gère
l'équipement de combat en Excel — hors sujet ici).

**Ce qui reste réellement à traiter pour l'export Wizard** : uniquement les 4 motifs de compétences.
Bonne nouvelle supplémentaire : les totaux d'attributs (`ATTNaFor = ATTBaseFor+ATTMTGFor+ATTMPCFor
+ATTMalFor`, `ATTAnFor` = palier sur `ATTNaFor`) **ne sont pas cassés** — formules Excel natives
dès le départ, confirmé par lecture directe (pas de `DUMMYFUNCTION` sur `AE9`/`AE11`).

Le seul obstacle réel dans les 4 motifs de compétences : `REGEXMATCH(comp, "(^|/)\s*FOR(\s*/|$)")`
(détecte un code d'attribut du type `FOR` dans une chaîne `"FOR/CON"`) — `REGEXMATCH` est un nom
Google Sheets, sans existence native dans la plupart des versions d'Excel.

**`[VÉRIFIÉ]` (recherche 2026-08-13)** : `REGEXTEST`/`REGEXEXTRACT`/`REGEXREPLACE` n'existent que
sous abonnement Microsoft 365 à jour (+ Excel Web) — absents d'Excel 2019, Excel 2021 et même de la
version perpétuelle Office 2024
([Microsoft Support](https://support.microsoft.com/en-us/excel/functions/regexextract-function),
[Office Watch](https://office-watch.com/2025/excel-365-native-regex-functions/)). Les licences
perpétuelles restent largement répandues (Microsoft 365 ≈ 30 % du marché global des suites
bureautiques, cf.
[SQ Magazine, 2026](https://sqmagazine.co.uk/microsoft-365-statistics/)) — dépendre de `REGEXTEST`
romprait la compatibilité pour une bonne partie des utilisateurs potentiels du fichier exporté.

**Décision retenue : formule sans regex**, compatible avec toutes les versions d'Excel (y compris
anciennes), LibreOffice et Google Sheets :
```
REGEXMATCH(comp,"(^|/)\s*FOR(\s*/|$)")
  →  ISNUMBER(SEARCH("/FOR/", "/" & SUBSTITUTE(comp," ","") & "/"))
```
(espaces retirés, chaîne encadrée de `/`, recherche du code exact entouré de séparateurs — évite un
faux positif si un code plus long contenait `"FOR"` comme sous-chaîne). Même traduction à appliquer
aux 7 autres codes d'attribut (`CON`/`COO`/`ADA`/`PER`/`INT`/`VOL`/`PRE`) et aux deux `REGEXMATCH`
sur `indic` (motifs `\(-3\)` / `\(X\)`, également traduisibles en `SEARCH` simple puisque ce sont
des sous-chaînes littérales, pas de vraies regex).

**Décision Saar (2026-08-13) : Option A retenue** — reconstruire les formules concernées en Excel
natif plutôt que d'exporter des valeurs figées (Option B écartée). Le classeur exporté reste donc un
outil vivant : si la Maîtrise d'une compétence est modifiée après export, le Total se recalcule tout
seul. Portée réduite à ces 4 motifs de compétences, pas aux 43 autres formules (hors périmètre,
§1.3 tableau ci-dessus).

#### 1.3bis Exécution du Lot 0e (2026-08-13) — formules écrites, validation partielle

Formules finales (testées cellule par cellule sur une copie jetable, `xlsx-populate` + LibreOffice
comme moteur de calcul indépendant — outil de test uniquement, la bibliothèque retenue pour l'export
en production est `xlsx`/SheetJS, décidée après coup en §3.1) :

```
' CompBase (colonne P), remplace le motif #15/#17 :
IF(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)="","",SUM(
  IF(ISNUMBER(FIND("/FOR/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnFor,0),
  IF(ISNUMBER(FIND("/CON/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnCon,0),
  IF(ISNUMBER(FIND("/COO/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnCoo,0),
  IF(ISNUMBER(FIND("/ADA/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnAda,0),
  IF(ISNUMBER(FIND("/PER/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnPer,0),
  IF(ISNUMBER(FIND("/INT/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnInt,0),
  IF(ISNUMBER(FIND("/VOL/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnVol,0),
  IF(ISNUMBER(FIND("/PRE/","/"&SUBSTITUTE(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)," ","")&"/")),ATTAnPre,0)
))

' CompTotal (colonne T), remplace le motif #16/#18 :
IF(OR(ISBLANK(INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)),INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)=""),"",
  IF(AND(
    INDEX(CompBase,ROW()-ROW(INDEX(CompAttributs,1,1))+1)+INDEX(CompMaitrise,ROW()-ROW(INDEX(CompAttributs,1,1))+1)
    +IF(ISNUMBER(FIND("(-3)",INDEX(CompIndicateur,ROW()-ROW(INDEX(CompAttributs,1,1))+1))),-3,IF(ISNUMBER(FIND("(X)",INDEX(CompIndicateur,ROW()-ROW(INDEX(CompAttributs,1,1))+1))),-4,0))=0,
    ISBLANK(INDEX(CompMaitrise,ROW()-ROW(INDEX(CompAttributs,1,1))+1))
  ),"",
    INDEX(CompBase,ROW()-ROW(INDEX(CompAttributs,1,1))+1)+INDEX(CompMaitrise,ROW()-ROW(INDEX(CompAttributs,1,1))+1)
    +IF(ISNUMBER(FIND("(-3)",INDEX(CompIndicateur,ROW()-ROW(INDEX(CompAttributs,1,1))+1))),-3,IF(ISNUMBER(FIND("(X)",INDEX(CompIndicateur,ROW()-ROW(INDEX(CompAttributs,1,1))+1))),-4,0))
  )+Blessures_Malus+INDEX(CompModificateur,ROW()-ROW(INDEX(CompAttributs,1,1))+1)+ActionModMalCombat
)
```

Écart par rapport à la traduction annoncée en §1.3 : `FIND` remplace `SEARCH` (sensible à la casse,
fidèle au comportement par défaut de `REGEXMATCH`) ; `LET` a été retiré (voir ci-dessous), d'où la
répétition de `INDEX(CompAttributs,ROW()-ROW(INDEX(CompAttributs,1,1))+1)` — verbeux mais correct,
cohérent avec l'exigence de compatibilité maximale déjà actée pour `REGEXTEST` (§1.3).

**Validation effectuée** (LibreOffice 25.8.6.2, moteur de calcul réel, pas une simple lecture) :
- `ISNUMBER(FIND(...))`, `SUBSTITUTE(...)` : calculent exactement la valeur attendue — brique de
  traduction validée.
- `LET` : **non reconnu par LibreOffice 25.8.6.2** (version pourtant récente), vérifié à la fois sur
  un test minimal et sur les formules déjà existantes du fichier original (`L39`/`M39`, jamais
  modifiées) — confirme que même les formules "natives" du classeur ne survivraient pas telles
  quelles dans LibreOffice. D'où la réécriture sans `LET` ci-dessus.
- `INDEX(CompAttributs, ligne)` : **anomalie non résolue**. Échoue (`#NAME?`) sous LibreOffice sur
  cette plage précise, y compris sans `LET`, alors qu'`INDEX` fonctionne correctement sur une petite
  plage littérale ET sur une grande plage littérale de taille identique (1186 lignes) avec des
  données de test. La cause exacte n'a pas pu être isolée dans le temps investi ; tentative de
  comparaison avec Apache OpenOffice 4.1.16 (également installé, `C:\Applis\OpenOffice\program`)
  abandonnée — l'outil n'a pas respecté le mode `--headless` (fenêtre graphique bloquante à chaque
  tentative), rendant la comparaison automatisée impraticable dans le temps disponible.

**`[INCONNU]` reporté au Lot 0b** : est-ce un artefact propre à cette installation LibreOffice, ou un
vrai défaut de la formule ? Tranché par le test réel de Saar (ouverture du fichier avec les formules
ci-dessus, dans son logiciel habituel) plutôt que par une nouvelle tentative automatisée.

**`[VÉRIFIÉ]` (2026-08-14) — dépendances de la formule `CompTotal` contrôlées.** La formule
reconstruite référence `Blessures_Malus` (`Personnage!$BD$46`) et `ActionModMalCombat`
(`Personnage!$AH$15`) — vérifié avec `tools/audit-excel-named-ranges.js` que ces deux plages sont
statiques (`hasFormula: false`), pas des formules cassées du "moteur armes/munitions/armures" (§1.3).
Sans ce contrôle, une dépendance cassée aurait rendu `CompTotal` systématiquement `#NAME?` malgré une
traduction `REGEXMATCH`→`FIND` par ailleurs correcte — risque identifié en revue, écarté sur preuve.

**`[CORRIGÉ]` (2026-08-14) — le garde-fou `assertWritable` bloquait le seul remplacement de formule
prévu.** `assertWritable` refuse toute écriture sur une plage à formule, sans exception — il aurait
donc empêché Lot 2 de réécrire `CompBase`/`CompTotal`, précisément les 2 plages que §3.2 point 1
identifie comme à remplacer intentionnellement. Ajout de `assertReplaceableFormula(workbook, name,
expectedFragment)` dans le même fichier : vérifie que la formule *actuellement* présente contient
encore le fragment attendu (ex. `"REGEXMATCH"`, signature de la formule Google Sheets analysée)
avant d'autoriser le remplacement — inspiré du compare-and-swap : on n'écrase un état partagé qu'après
avoir confirmé qu'il correspond à ce qu'on a observé, jamais à l'aveugle via un simple drapeau de
contournement. Si le gabarit a changé depuis (formule déjà corrigée autrement, ou remplacée par autre
chose), le remplacement est refusé et force une revue du mapping plutôt que d'écraser une formule non
identifiée. Testé : 4 cas (remplacement autorisé sur `CompBase`, refusé si le fragment ne correspond
plus, refusé si la plage n'a plus de formule du tout, `assertWritable` toujours strict pour l'usage
normal).

#### 1.3ter `[VÉRIFIÉ]` (2026-08-14) — Balayage exhaustif des formules natives (hors `DUMMYFUNCTION`)

Le §1.3 n'avait analysé que les cellules `__xludf.DUMMYFUNCTION` (signature Google Sheets d'une
formule non portable). Avant de coder le Lot 2, balayage systématique de **toutes** les plages
nommées porteuses d'au moins une formule native (`hasFormula`, hors `DUMMYFUNCTION`) à la recherche
de fonctions récentes (`LET`, `LAMBDA`, `SCAN`, `XLOOKUP`, `FILTER`...) susceptibles du même problème
de portabilité que `LET` (§1.3bis) — un risque distinct du regex, jamais vérifié pour les formules
déjà "natives" en dehors de `L39`/`M39` testés ponctuellement.

**Résultat : deux plages dans le périmètre Wizard, jusque-là classées "entrée directe" par erreur,
portent en fait des formules `LET`/`LAMBDA`/`SCAN` vivantes :**

| Plage | Formule actuelle | Rôle |
|---|---|---|
| `CompAttributs` (`Personnage!$M$39:$M$1224`) | `LET(...)`, recherche `CompNom`/`CompSousNom` dans le catalogue `Compétences` (`CompetencesNom`/`CompetencesSousNom`) pour en tirer `CompetencesAttributs` | Code(s) d'attribut de la compétence (ex. "FOR/CON") |
| `CompIndicateur` (`Personnage!$L$39:$L$1224`) | `LET(...)` + `LAMBDA(...)` + `SCAN(...)`, même principe avec repli sur le parent pour une sous-compétence | Marqueur `(-3)`/`(X)` |

Le §2.3 (plus bas) prévoyait d'écrire directement dans ces deux plages en tant qu'entrées statiques
— une confusion entre "la cellule accepte du texte visuellement" et "la cellule ne porte aucune
formule à écraser" (§1.2 famille 2). `assertWritable` les aurait correctement refusées ; c'est en
croisant `resolveNamedRange` avec le contenu réel de chaque cellule qu'on l'a détecté avant d'écrire,
pas après un échec en production.

**Décision (autorité unique, CLAUDE.md §1.4) : ne pas reconstruire ces formules de lookup, les
remplacer par la valeur Enclume directement.** `ref_skills.attr_1`/`attr_2`/`marker` est déjà
l'autorité unique de cette donnée côté Enclume (déjà récupérée par le Lot 1) ; faire dépendre le
classeur d'un second lookup textuel (`CompNom` → correspondance exacte dans le catalogue
`Compétences`) recrée exactement la même classe de bug que le libellé de génotype (§2.2) — une
correspondance de chaînes qui peut silencieusement diverger. Écriture via `assertReplaceableFormula`
(fragment attendu : `"LET"` pour les deux) :
- `CompAttributs` ← `attr_1 + (attr_2 ? "/" + attr_2 : "")` (même format `"FOR/CON"` que celui déjà
  consommé par les formules `CompBase`/`CompTotal` reconstruites, §1.3bis — aucun changement côté
  `CompBase`/`CompTotal`, qui lisent la valeur de la cellule, peu importe qu'elle soit littérale ou
  calculée).
- `CompIndicateur` ← `marker` tel quel (`"(-3)"`, `"(X)"` ou vide).

Bénéfice secondaire : en rendant `CompAttributs` statique, l'anomalie `INDEX(CompAttributs, ligne)`
non résolue en Lot 0e (§1.3bis, `[INCONNU]`) porte sur une plage qui ne contiendra plus aucune
formule — à revérifier lors du test réel de Saar (0b), mais plausible que ce changement la fasse
disparaître (une chose de moins dépendant d'un comportement LibreOffice non expliqué).

**Une troisième plage, hors `Personnage`, est dans la même situation :** `InventairePoidsTotalObj`
(`Inventaire!$H$2:$H$566`, 565 cellules) = `LET(..., poids*qte)`, calcule le poids total d'une ligne
d'inventaire à partir de `InventairePoidsObj`/`InventaireQteObj` (les deux colonnes que le Wizard
alimente). Contrairement à `CompAttributs`/`CompIndicateur`, il n'y a pas de duplication d'autorité
ici — c'est un simple produit de deux valeurs déjà sur la même ligne, sans lookup textuel fragile.
**Décision : reconstruire en formule vivante sans `LET`, par référence directe à la ligne courante**
(`=IF(G{row}="","",F{row}*G{row})`, où `F`/`G` sont les colonnes réelles de `InventairePoidsObj`/
`InventaireQteObj`) plutôt qu'une valeur figée — cohérent avec l'Option A déjà retenue (§1.3), et
plus simple que `CompBase`/`CompTotal` : pas besoin d'`INDEX` puisqu'on connaît la ligne exacte au
moment de l'écriture (contourne au passage l'anomalie `INDEX` non expliquée, §1.3bis). Remplacement
via `assertReplaceableFormula(wb, 'InventairePoidsTotalObj', 'LET')`.

**Pour mémoire, 14 plages hors périmètre Wizard (moteur armes/armures déjà écarté, §1.3) utilisent
elles aussi `LET`/`XLOOKUP`** (`ProtBDMal`, `ProtTeteMal`, `ProtJGMal`, `ProtBGMal`, `protJDMal`,
`ProtCorpsMal`, `TeteCho1`, `TeteMal1`, `TeteArm1`, `Arme1FORPreReq`, `Arme1Cal`, `IniMalusArme`,
`ObjDosContenance`, `ObjCeintureContenance`) — cohérent avec le constat déjà acté : cassées mais sans
effet tant que les emplacements d'équipement porté restent vides (§1.2, `[TRANCHÉ]`). Aucune décision
supplémentaire requise, listé ici pour que le balayage soit traçable comme exhaustif.

### 1.4 Feuilles de référence à ne pas toucher

`Equipements` (catalogue statique, 717 objets déjà présents), `Compétences` (catalogue statique des
compétences) et une bonne partie de `Divers` (colonnes sources de listes déroulantes) sont des
**données de référence déjà présentes dans le gabarit "Vierge"**, indépendantes du personnage.
L'export ne doit rien y écrire — seule la feuille `Personnage` (et éventuellement `Inventaire` pour
les objets possédés) reçoit des données spécifiques au personnage exporté.

---

## 2. INVESTIGATION — Les données produites par le Wizard côté serveur

Recherche déléguée (lecture seule) : persistance (`char_sheet` + tables satellites), formules
(`shared/polarisUtils.js`), routes API (`server/src/routes/character/char-sheet.js`), composants
client (`CharacterSheet.jsx`, `CharacterWindow.jsx`).

### 2.0 `[VÉRIFIÉ]` (2026-08-14) — Le classeur n'a de destination que pour une petite partie de l'identité

Liste exhaustive des 308 noms passée en revue (`tools/audit-excel-named-ranges.js` + inspection
manuelle) : seuls `Fiche_Joueur` (`$B$3`), `Fiche_Nom` (`$B$6`) et `Liste_TypeGen` (`$F$18`,
génotype) existent côté identité/archétype. **Aucune plage ne correspond** à la taille, au poids, à
la peau, aux yeux, aux cheveux, à la corpulence, aux signes distinctifs, à la préférence de main,
à l'âge, au sexe, à l'origine géographique/sociale, à la formation, aux études supérieures
(`char_identity`/`char_archetype`, une quinzaine de champs), **ni à l'historique de carrières**
(`char_careers` : aucune plage `Carriere*` n'existe). Ce n'est pas un oubli de cette analyse — c'est
une limite du classeur "Vierge" lui-même, qui n'a jamais prévu ces informations en tant que données
scriptables. **Périmètre de l'export corrigé en conséquence** : seuls le nom du personnage/joueur et
le génotype sont exportables côté identité ; description physique et carrières restent hors
périmètre tant que le gabarit n'est pas modifié pour leur créer un emplacement (hors sujet de ce
plan, qui exporte *vers* le fichier donné, pas ne le redessine pas).

### 2.1 Persistance

Table pivot `char_sheet` (`character_id` FK unique) + tables satellites une-ligne-par-personnage :
`char_identity`, `char_archetype`, `char_attributes` (une ligne par attribut), `char_skills` (une
ligne par compétence apprise), `char_advantages` (V2, avec `snapshot_data` jsonb au moment de
l'octroi), `char_mutations`, `char_careers`, `char_gauges`, `char_inventory`. Service
`server/src/services/creationService.js` (`reconcileCreation`, `lockWizard`). Doc d'architecture :
`docs/SYSTEME/PERSONNAGE_WIZARD.md`.

### 2.2 Attributs — correspondance proposée avec le classeur

Formule exacte (`shared/polarisUtils.js:108`) :

```
calcNA(base_level, pc_modifier, mod_genotype, mod_mutation)
  = max(3, base_level + pc_modifier + mod_genotype + mod_mutation)
calcAN(na) → palier via AN_TABLE
```

Le classeur définit, par attribut, `ATTBase{X}`, `ATTMTG{X}`, `ATTMPC{X}`, `ATTMal{X}`, `ATTNa{X}`,
`ATTAn{X}`. Correspondance déduite de la formule (4 entrées additives → Na → An) :

| Plage classeur | Source Enclume | Statut |
|---|---|---|
| `ATTBase{X}` | `char_attributes.base_level` **+ `mod_mutation`** (voir décision ci-dessous) | `[TRANCHÉ]` |
| `ATTMPC{X}` | `char_attributes.pc_modifier` | `[HYPOTHÈSE]` cohérente (acronyme "PC" = Points de Création, `docs/VOCABULARY.md`) |
| `ATTMTG{X}` | `mod_genotype` (`getGenotypeModForAttr`) | `[VÉRIFIÉ]` — formule vivante (famille 2), lit une colonne différente de `Type_génétique` par attribut (`AE6`→colonne 2 … `AZ6`→colonne 9) ; ne pas écrire dedans, seulement renseigner `Liste_TypeGen` avec le bon génotype |
| `ATTMal{X}` | rien côté Enclume — malus générique/armure, vide pour 7 attributs sur 8 | `[VÉRIFIÉ]` — hors périmètre (§ci-dessous) |
| `ATTNa{X}` | résultat `calcNA` | Formule classeur déjà cohérente avec ce rôle |
| `ATTAn{X}` | résultat `calcAN` | Formule classeur déjà cohérente avec ce rôle |

**`[TRANCHÉ]` (2026-08-13)** — `ATTMal{X}` (`Mal` = Malus générique/armure portée, confirmé par
Saar) ne correspond à rien dans `calcNA` et reste vide/hors périmètre à l'export (formule d'armure
vivante à ne pas perturber sur Coordination). Le classeur n'a donc **aucun emplacement dédié** pour
`mod_mutation`. Décision (Option C) : le Wizard écrit `base_level + mod_mutation` directement dans
`ATTBase{X}`, au lieu de la seule `base_level` — n'importe quelle formule vivante du classeur, ne
crée aucun conflit d'écriture, résultat final (`ATTNa`/`ATTAn`) numériquement correct. Coût accepté :
la case "Base" affichée dans Excel n'est plus la valeur brute stockée en base, elle inclut aussi
l'éventuel modificateur de mutation — écart documenté ici (CLAUDE.md §1.9).

**`[VÉRIFIÉ]` (2026-08-15) — piste explorée puis fermée : pas d'écart RAW.** `calcNA`
(`shared/polarisUtils.js:108-111`) applique un plancher à 3 ; `ATTNa{X}` (formule Excel déjà
existante, jamais touchée par cet export) est une somme simple sans plancher — en théorie, ces deux-là
divergent pour un cas extrême (`TEC_HYB`, `mod_pre:-6`, aucun personnage de ce type en base
actuellement). Mais **`ATTNa{X}` n'est consommé par rien d'autre que `ATTAn{X}`** (palier
"Aptitude Naturelle", formule fournie par Saar :
`SI(ATTNaFor<=3;-4;SI(ATTNaFor=4;-3;...))`), et cette formule bucket déjà tout `<=3` (pas seulement
`=3`) sur le même palier `-4`. Côté Enclume, `calcAN` (`AN_TABLE.find(...)`, `polarisUtils.js:21-24`)
fait exactement la même chose : rien ne matche pour `na<3`, retombe sur `-4` par défaut. Les deux
convergent donc vers le même résultat final quel que soit le signe de la somme brute — le plancher
manquant sur `ATTNa{X}` ne change que l'affichage d'un nombre intermédiaire jamais utilisé ailleurs
(`CompBase`/`CompTotal` lisent `ATTAn{X}`, pas `ATTNa{X}`). Aucune action requise.

Point additionnel non couvert par les 4 entrées de `calcNA` : Enclume calcule aussi un modificateur
d'avantage par paire clé/valeur (`getAdvantageModForAttr`), qui n'a pas d'emplacement dédié évident
dans le classeur `[INCONNU]` — à traiter par la même méthode (fusion dans `ATTBase{X}`) si un
avantage affectant un attribut se présente, sauf décision contraire.

**🔴 `[VÉRIFIÉ]` (2026-08-14) — Bug concret trouvé : le libellé du génotype ne correspond pas à
l'exact entre la base et le classeur.** `ATTMTG{X}` dépend de `Liste_TypeGen` (`Personnage!$F$18`)
comparé par `MATCH()` exact à la colonne A de `Type_génétique` (`Divers!$A$1:$I$5`). Valeurs
comparées :

| `ref_genotypes.label` (migration `33_char_ref_genotypes.js`) | `Type_génétique` (Excel, `Divers!A2:A5`) | Identique ? |
|---|---|---|
| `Humain` | `Humain` | oui |
| `Hybride naturel` | `Hybride naturel` | oui |
| `Techno-hybride` | `Techno-hybride` | oui |
| **`Géno-hybride`** (avec accent) | **`Geno-hybride`** (sans accent) | **NON** |

Écrire `ref_genotypes.label` tel quel dans `Liste_TypeGen` pour un génotype Géno-hybride ferait
échouer silencieusement le `MATCH()` : `ATTMTG*` renverrait vide pour les 8 attributs, faussant
`ATTNa*`/`ATTAn*` en cascade, sans aucune erreur visible. **Décision : ne jamais réutiliser
`ref_genotypes.label` directement.** Le Lot 2 doit passer par une table de correspondance explicite
et commentée `{ id Enclume → libellé exact attendu par le classeur }` (4 entrées, écrites à la main,
avec le rappel de cette divergence en commentaire) plutôt que de faire confiance à l'égalité
supposée des deux chaînes.

### 2.3 Compétences

Catalogue statique `ref_skills` (`family`, `label`, `parent`, `attr_1`, `attr_2`, `marker`,
`description`) + instance `char_skills` (`skill_id`, `mastery`, `is_learned`). Formule
(`client/src/character/SkillsPanel.jsx:26-28`) :

```
Base  = AN(attr_1) + AN(attr_2)          (ou AN(attr_1)×2 si attr_2 est nul)
        marker === '(-3)' → Base - 3
Total = Base + mastery
```

**`[CORRIGÉ]` (2026-08-15) — la première lecture de cette section était fondée sur une fausse
hypothèse.** En observant que la feuille `Personnage` contient déjà des lignes non vides en 39-128
(~85 lignes), une première analyse a conclu à tort qu'il s'agissait d'un catalogue figé qu'il fallait
"retrouver" ligne par ligne (comparaison de libellés contre `ref_skills`, avec un taux de
correspondance mesuré à seulement 25 % — chiffre qui a déclenché une fausse alerte). Saar a corrigé :
le vrai catalogue complet est l'onglet `Compétences` (231 lignes, 204/249 `ref_skills` déjà
correspondantes en comparaison directe, le reste des typos/singulier-pluriel du classeur ou des
compétences jamais masterisables telles quelles). La confirmation définitive vient de
`docs/Old/Kiwi/10_WebApp_Competences.gs` (`comp_updatePersonnageAvecExportNamed_`) : la vraie
implémentation appelle `clearContent()` sur `B:K` + `CompMaitrise` **avant chaque écriture** — les
lignes 39-128 du fichier "Vierge" ne sont qu'un exemple resté dans le fichier fourni, à écraser
systématiquement, pas un jeu de données à préserver ou à matcher.

**Mapping retenu (Lot 2, fichier 2/5, `server/src/services/excelExportWriter.js::writeSkills`)** :
la feuille `Personnage` est effacée (lignes 39 à `max(90, nb lignes à écrire)`, marge sur les ~85
lignes d'exemple observées) puis réécrite intégralement à partir des seules compétences réellement
développées (`char_skills`, pas le catalogue complet — même décision que le reste du Lot 1).
Regroupement par `family` (`CompCategories`) puis par `parent` (une ligne d'en-tête `CompNom` = nom
du parent, sans Maîtrise/Attributs, pour un parent jamais développé lui-même — ex. "Manœuvre
d'armure" — sinon la compétence développée directement obtient sa propre ligne), même logique que le
script d'origine. `CompNom`/`CompSousNom`/`CompMaitrise`/`CompDescription` sont des entrées directes
(`assertWritable`) ; `CompAttributs`/`CompIndicateur`/`CompBase`/`CompTotal` sont des plages à formule
dans le classeur d'origine (§1.3ter) — remplacées via `assertReplaceableFormula`, pas écrites comme
des entrées ordinaires. `CompModificateur` (colonne `O`) n'a pas d'équivalent dans `char_skills` —
**`[VÉRIFIÉ]` (2026-08-14, 1186 lignes)** : 0 cellule non vide dans le classeur "Vierge", laissée
vide (référencée par la formule `CompTotal` reconstruite, toujours à 0 tant qu'elle est inutilisée).

**`[CORRIGÉ]` (2026-08-15) — la formule générique `CompBase` du §1.3bis contenait un bug jamais
exercé par ses tests.** Écrivant des formules par ligne connue (pas une formule générique glissée sur
1186 lignes), plus besoin de reconstruire `CompAttributs` en texte parsable par `FIND` : la formule
référence directement `ATTAn{attr_1}`/`ATTAn{attr_2}` depuis `attr_1`/`attr_2` déjà connus en JS. Ça a
révélé que `FIND("/INT/","/INT/INT/")` (convention du classeur pour une compétence à un seul
attribut) ne détecte la présence qu'une fois, jamais deux — la formule générique du §1.3bis aurait
donné `ATTAnInt` au lieu de `ATTAnInt×2` pour une compétence mono-attribut (contrairement à la règle
RAW). Bug sans conséquence pratique (cette formule générique n'est plus utilisée), mais confirmé par
calcul manuel + recalcul LibreOffice réel sur "Éducation/Culture générale" (INT seul, marker `(-3)`,
Maîtrise 2 → Base 4, Total 3, exact).

**`[CORRIGÉ]` (2026-08-15) — deux défauts trouvés en testant réellement l'écriture (pas en la
relisant) :**
- `xlsx` (SheetJS) supprime silencieusement une cellule formule écrite sans valeur `v` en cache lors
  de `XLSX.writeFile` — `writeColumnFormula` (Lot 0d) et le nouvel écrivain compétences en étaient
  tous deux affectés (jamais détecté avant faute d'avoir testé un aller-retour fichier réel sur une
  formule). Corrigé : toujours inclure un `v` factice (`0`) à côté de `f`, Excel recalcule à
  l'ouverture. Piège à retenir pour tout futur ajout de formule dans ce chantier.
- `ATTMalCoo` (`Personnage!$AK$8`) — déjà cataloguée en §1.3 comme l'une des formules
  `DUMMYFUNCTION` hors périmètre (malus Coordination lié à l'armure équipée) — a été reclassée en
  cours de test : contrairement aux 42 autres formules du même lot, elle est enveloppée dans
  `IFERROR(DUMMYFUNCTION(...), -2)`, qui retombe systématiquement sur `-2` hors Google Sheets, avec
  ou sans armure. C'est un malus fantôme actif sur Coordination pour tout export, pas une formule
  inerte. `writeAttributes` la remplace désormais via `assertReplaceableFormula` (fragment
  `"ProtMalRecap"`) plutôt que de la laisser cassée — corrige potentiellement aussi, sans certitude,
  l'anomalie `INDEX` non résolue du Lot 0e (§1.3bis) si elle provenait d'une valeur d'attribut déjà
  faussée en amont des tests de l'époque.

**Testé (2026-08-15)** : personnage réel (17 compétences développées, dont 4 avec parent — couvre
ligne racine, ligne d'en-tête non masterisée, ligne enfant) exporté puis recalculé par LibreOffice
réel (conversion `.xlsx → .ods → .xlsx`, la seule méthode qui force un recalcul complet — un simple
`--convert-to xlsx` ne recalcule pas et ne fait que recopier les valeurs déjà en cache). Les 17
lignes `CompBase`/`CompTotal` recalculées correspondent exactement au calcul manuel attendu,
y compris les cas `(-3)`/`(X)` et le cas mono-attribut doublé.

**`[CORRIGÉ]` (2026-08-15, revue à charge post-livraison) — deux défauts supplémentaires trouvés en
relisant le code livré, avant tout signalement extérieur :**
- `CompDescription` (colonne `A`, icône "🛈" + commentaire caché reprenant la description RAW de la
  compétence) n'était pas dans la liste des colonnes effacées. Les lignes 39-128 du "Vierge" portent
  ce commentaire pour leurs compétences d'exemple (vérifié : `A40`/`A42` ont un vrai commentaire
  attaché, pas juste l'icône) — sans le nettoyer, un export réel afficherait un commentaire décrivant
  une compétence différente de celle réellement affichée sur la même ligne (ex. l'info-bulle
  "Accrobatie/Équilibre" apparaîtrait sur la ligne d'un personnage qui a en fait développé
  "Manoeuvres sous-marines"). Pas une question de style : une donnée visiblement fausse sur la fiche.
  Corrigé en ajoutant `CompDescription` à la liste des colonnes effacées (pas de nouvelle tooltip
  écrite — resterait hors périmètre — juste l'ancienne supprimée). Vérifié par test réel : `A40`
  devient bien `undefined` après écriture, y compris après un aller-retour fichier complet.
- Les références de cellule dans les formules `CompBase`/`CompTotal` (`M{ligne}`, `P{ligne}`...)
  étaient construites avec des lettres de colonne codées en dur, alors que le reste du fichier
  résout systématiquement les colonnes depuis les plages nommées. Incohérence silencieuse si le
  classeur change un jour de disposition (l'écriture irait au bon endroit via `anchors`, la formule
  pointerait sur l'ancienne colonne). Corrigé : les références sont maintenant dérivées de
  `anchors[...].col` via `XLSX.utils.encode_col`. Revérifié par recalcul LibreOffice réel après
  coup : mêmes 6 valeurs `Total` qu'avant le correctif, aucune régression.

Aucune route API ne renvoie `ref_skills` avec `char_skills` déjà jointes — l'export devra les
combiner lui-même (ou une nouvelle route dédiée, voir §2.6).

### 2.4 Avantages / Désavantages / Mutations

`GET /char-sheet/:characterId/advantages` renvoie `{ name, type, description, cost_pc,
special_rule, mod_attribute, mod_value, mod_resistance, mod_res_value, acquired_at,
acquired_during }` — 9 champs par avantage. **Correspondance partielle, pas directe** (correction
2026-08-14) : les plages `Avantages`/`Desavantages` (`Personnage!$W$70:$W$86` / `$AF$70:$AF$86`,
17 lignes chacune) sont **une seule colonne de noms** — seul `name` a une destination. Il n'existe
aucune feuille catalogue "Avantages" dans le classeur (contrairement à `Equipements`/`Compétences`)
où `description`/`cost_pc`/`special_rule`/`mod_attribute`/`mod_value`/`mod_resistance`/
`mod_res_value` pourraient être affichés par recherche — ces 7 champs sur 9 n'ont donc **aucune
destination dans ce classeur** et ne seront pas exportés au-delà du nom. Mutations sur un endpoint
séparé (`/mutations`).

**`[TRANCHÉ]` (2026-08-13) — Mutations sans destination dans le classeur.** Aucune des 308 plages
nommées ne correspond aux mutations (`[VÉRIFIÉ]`, recherche exhaustive dans `definedNames`) — le
classeur "Vierge" n'a jamais prévu cet emplacement. Décision : les mutations restent **hors
périmètre de cet export** (ni écrites dans `Blessures*`, ni ailleurs) plutôt que d'inventer une zone.
Concerne notamment "Organe sensoriel manquant" (`ref_mutations`, migration
`235_fix_ref_mutations_organe_sensoriel_manquant_sign.js`) : c'est une mutation, pas un
avantage/désavantage ni une blessure — vérifié pour trancher le point 2 de §6 (l'exemple donné par
Saar ne correspond en fait à aucune plage existante du classeur).

Autre cas vérifié pour le même point : un revers de carrière "main coupée" (accident) est stocké par
`shared/reversEffectsData.js` comme effet **narratif uniquement**
(`{ type: 'narrative', key: 'mutilation.jambe_raide' }`), sans enregistrement mécanique
localisation+gravité — le commentaire du fichier documente explicitement que "Membre détruit" n'est
pas mécanisé (option de campagne différée, `docs/ROADMAP.md`). Aucune traduction possible vers
`Blessures*` sans inventer une règle hors RAW ; ce texte narratif, quand il existe, reste porté par
l'avantage/désavantage/revers d'origine déjà exporté via `Avantages`/`Desavantages` (§ci-dessus), pas
dupliqué dans la grille de blessures.

### 2.5 Équipement et argent — constat qui change le périmètre de l'export

**`[VÉRIFIÉ]`** Le Wizard **n'assigne aucun équipement ni argent de départ automatiquement**.
`char_sheet.sols` reste à sa valeur par défaut (`0`) après `reconcileCreation`/`lockWizard` — aucune
écriture dessus dans `creationService.js`. Les économies calculées par carrière
(`char_careers.savings`) ne sont jamais sommées ni reportées vers `sols`. L'étape "Step 6 — Matériel
&amp; Biens" du Wizard (`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md`) est un ajout **narratif et
optionnel**, sans validation mécanique de coût (décision Saar déjà actée, comparée à Foundry VTT).

**Conséquence pour l'export** : si le Wizard exporte "l'équipement et l'argent de départ", il n'y a
rien d'automatique à exporter — seulement l'état courant de `char_inventory` et `char_sheet.sols` au
moment du clic export (potentiellement vide ou à 0 pour un personnage qui vient d'être créé sans
qu'un MJ n'ait rien ajouté en Step 6). Ce n'est pas un défaut de l'export — comportement attendu,
décision actée en §6 (inclus).

**`[VÉRIFIÉ]` (2026-08-14) — correction : il existe bien une destination pour l'argent, distincte du
journal `Bourses*`.** Trois plages statiques (famille 1) sous l'intitulé `ARGENT_` (`Personnage!$W$64`)
: `InvArgentGroupe` (`$W$66`, sous "Du groupe"), `InvArgentPerso` (`$AG$66`, sous "Personnel"),
`InvArgentPersoCoffre` (`$AI$67`, sous "Coffre"). Aucune des trois n'était dans le radar initial de ce
plan (ni §1.1 ni §1.2 ne les mentionnaient). **Décision : `char_sheet.sols` → `InvArgentPerso`**
("Personnel" = argent sur soi, l'analogue direct d'un solde de personnage unique) — `InvArgentGroupe`
(trésorerie de groupe, concept qui n'existe pas dans Enclume, chaque personnage a son propre `sols`)
et `InvArgentPersoCoffre` (coffre/planque, aucune table Enclume équivalente) restent vides, faute de
source de données côté Enclume.

**`[CORRIGÉ]` (2026-08-15) — mapping Inventaire (31 plages), établi grâce à**
`docs/Old/Kiwi/50_Inventory_WebApp.txt` (script d'origine, non trouvé au premier passage — un onglet
`Equipements` liste déjà tout le catalogue statique, remarque de Saar qui a évité de réinventer un
matching par nom). Le vrai mécanisme n'est pas une formule Excel de lookup : le script d'origine
résout les stats spécifiques d'un item par nom contre l'onglet `Equipements`, puis les **écrit en dur**
par ligne (mêmes valeurs à chaque lecture, pas une formule vivante) — mais Enclume a déjà ces
données de façon plus fiable via `ref_equipment` (déjà joint dans `getInventory()`), donc aucun
matching par nom n'est nécessaire côté export. Trois familles :

| Famille | Plages | Source Enclume |
|---|---|---|
| Identité objet (9) | ID/Nom/Fam/CAT/Empl/Poids/Description/Qté/Notes | `char_inventory` (+ `custom_name`/`custom_desc` en priorité sur `ref_name`/`ref_description`, même motif que `client/src/character/InventoryPanel.jsx:480`) |
| Stats catalogue (18) | NT/Fabricant/Nation/Dom/Choc/Portée/FOR/Init/ModeDeTir/Mun/CAL/Dispo/Prot/ProtChoc/Loc/ArmureMalus/Contenance/Étanchéité | `ref_equipment` (`tech_level`/`manufacturer`/`nation`/`damage_h`/`shock`/`range`/`min_str`/`init_mod`/`fire_mode`/`ammo_count`/`caliber`/`rarity`/`protection`/`protection_shock`/`location`/`malus_cat`/`capacity`/`waterproof`) |
| État chargé (3) | ModInstalles/MunInstalles/ChargeurBallesRestantes | `char_inventory_mods.mod_name` (agrégé) / `current_ammo` (résolu en nom, voir plus bas) / `ammo_remaining` |
| Calculé (1) | PoidsTotalObj | déjà traité (§1.3ter) |

`getInventory()` (`server/src/services/inventoryService.js`) étendu (ajout pur, sans retrait ni
changement de comportement pour ses appelants existants) : 7 champs `ref_equipment` manquants
(`tech_level`/`manufacturer`/`nation`/`init_mod`/`rarity` ; `damage_v_low`/`damage_v_high`
délibérément exclus — jamais lus par `damageService.js`, résidus non exploités sur 13/717 lignes,
`damage_h` seul est la formule de dégâts vivante) + `mods_installed` (agrégation
`char_inventory_mods`) + `current_ammo_name`. **`[CORRIGÉ]` en cours de test** : `current_ammo` est
un UUID (`ref_equipment.id`, migration 52), jamais résolu en nom lisible par `getInventory()`
jusqu'ici (les appelants existants traitent l'UUID eux-mêmes) — écrire l'UUID brut dans
`InventaireMunInstalles` aurait été visiblement faux sur une fiche destinée à un humain. Ajout d'un
champ dédié `current_ammo_name` (sous-requête scalaire, même motif que `lunette_niveau` déjà présent
dans la même requête) plutôt que de changer la forme de `current_ammo` pour les autres appelants.

**Testé (2026-08-15)** : personnage réel (13 objets d'inventaire, catalogue et hors-catalogue mêlés)
exporté puis recalculé par LibreOffice réel. Toutes les colonnes vérifiées champ par champ contre
`ref_equipment` (ex. Bouclier — NT 2, FOR 13, Protection 10, Localisation "M"), `PoidsTotalObj`
recalculé exact (poids×quantité, y compris le cas poids vide → 0), `current_ammo_name` résolu en nom
lisible ("9 mm - Munition standard") au lieu de l'UUID brut.

**`[CORRIGÉ]` (2026-08-15) — bug trouvé dans l'outil central, pas dans l'écrivain lui-même.**
`resolveNamedRange` (`tools/audit-excel-named-ranges.js`, Lot 0d) décodait mal toute plage déclarée
en syntaxe colonne entière (`$H:$H`, ex. `InventairePoidsTotalObj`) : `XLSX.utils.decode_range`
renvoie `r: -1` pour une référence sans borne de ligne, faisant croire à `resolveNamedRange` qu'il
n'y avait qu'une seule ligne (invalide) à scanner — `assertReplaceableFormula` concluait donc à tort
qu'aucune formule n'existait. Jamais détecté avant : aucune autre plage écrite jusqu'ici n'utilisait
cette syntaxe (les plages `Comp*`/`ATT*` sont toutes bornées explicitement, ex. `$M$39:$M$1224`).
Corrigé à la racine : repli sur les bornes réelles de la feuille (`!ref`) quand la référence n'en
fournit pas, et le `ref` retourné est désormais toujours une plage bornée (jamais la syntaxe colonne
entière brute) — sans ce deuxième correctif, tout appelant en aval (`resolveAnchors` dans
`excelExportWriter.js`) aurait reproduit le même bug en redécodant la chaîne non bornée. Vérifié :
`XLSX.utils.encode_range` réduit bien une plage mono-cellule à `"B6"` (pas `"B6:B6"`) — aucune
régression sur `writeSingleCell`.

**`[CORRIGÉ]` (2026-08-15, revue à charge fichiers 1-4/5) — incohérence entre l'intention documentée
et le code réel dans `writeInventory`.** Le commentaire affirmait "effacé avant écriture par
cohérence avec `writeSkills`", mais la borne d'effacement était `items.length - 1` — pas la marge
généreuse (`Math.max(90, ...)`) utilisée par `writeSkills`. Sans effet aujourd'hui (`Inventaire`
vérifié vide dans le "Vierge" actuel), mais c'est exactement le même raisonnement qui a fait rater
le jeu d'exemple des compétences et le malus figé sur `ATTMalCoo` : un bloc "vérifié vide" peut ne
plus l'être dans une future version du classeur, et rien ne le redétecterait. Remplacé le nombre
magique `90` (skills) et le calcul `items.length - 1` (inventaire) par une fonction commune,
`findLastUsedRowOffset`, qui détecte dynamiquement la dernière ligne réellement occupée sur les
colonnes-clés du bloc avant de calculer la borne d'effacement — aucune marge devinée, aucune
hypothèse figée sur l'état du "Vierge". Revérifié sur les deux écrivains (compétences et inventaire) :
mêmes résultats qu'avant le changement, aucune régression.

**Testé (2026-08-15) — les 6 fonctions ensemble, sur le même classeur, pour la première fois** (les
tests précédents validaient chaque fonction isolément). `writeIdentity`/`writeGenotype`/
`writeAttributes`/`writeMoney`/`writeSkills`/`writeAdvantages`/`writeInventory` appelées en séquence
sur un même personnage réel, sans exception. Recalcul LibreOffice réel : nom, génotype, argent, total
d'une compétence dépendant des attributs (`Combat armé` = 10, identique à la valeur déjà vérifiée en
isolation), désavantage et objet d'inventaire tous corrects simultanément — aucune interférence entre
les blocs (feuilles différentes, plages nommées disjointes). `server/src/services/inventoryService.js`
revérifié : les 7 tests déjà existants (`inventoryService.test.mjs`) passent toujours après
l'extension additive du `SELECT` (aucune régression sur les appelants existants).

### 2.6 Pas de route API agrégée

Aucune route ne renvoie en un seul appel sheet + identity + archetype + attributes + skills +
advantages + mutations + inventory + careers. Résolu par le Lot 1 (§4) : service serveur dédié à
l'agrégation plutôt que d'enchaîner plusieurs `GET` côté client, pour éviter toute duplication de
logique métier.

---

## 3. ARCHITECTURE TECHNIQUE ENVISAGÉE

### 3.1 Bibliothèque d'écriture Excel

Le paquet **`xlsx` (SheetJS) `^0.18.5` est déjà présent** dans `package.json` racine — mais son seul
usage actuel dans le dépôt est `docs/Old/script Extraction Excel/equipement/0_extractor.js`, un
script d'import ponctuel et archivé (Excel → DB, sens inverse de ce qu'on veut faire).

**`[VÉRIFIÉ]` (2026-08-13/14) — Comparaison à trois, sur une copie jetable du vrai fichier** (`xlsx`,
`xlsx-populate`, `exceljs` — les trois principales bibliothèques Node du marché), avec une vraie
écriture testée (pas juste une relecture) :

| Critère | `xlsx` (SheetJS) | `xlsx-populate` | `exceljs` |
|---|---|---|---|
| 308 plages nommées | conservées | conservées | **185/308 — 123 perdues** |
| Formules (`DUMMYFUNCTION`, comptage) | conservées | conservées | conservées |
| Maintenance active | oui | **non — 6 ans sans version, 125 issues + 31 PR ouvertes** | oui |
| Déjà présent au projet | oui | non | non |
| Écriture réelle testée (`Fiche_Nom`, `ATTBaseFor`...) | fonctionne, relecture correcte, formule voisine (`ATTNaFor`) intacte | fonctionne, idem | non testé (disqualifié avant, cf. plages perdues) |

`exceljs` est éliminé malgré sa maintenance active : perdre 123 plages nommées sur 308 est un défaut
fonctionnel immédiat et reproductible sur l'architecture même de cet export — une bibliothèque à jour
qui casse le fichier est pire qu'une bibliothèque à l'arrêt qui fonctionne.

Reste `xlsx` vs `xlsx-populate`, à égalité sur les deux critères qui comptent (plages nommées et
formules). Un premier test avait orienté vers `xlsx-populate` sur un critère supplémentaire — fidélité
des images/dessins/commentaires (`xlsx` perdait `xl/drawings/*.xml`, `xl/media/*.png`,
`xl/persons/person.xml`, `sharedStrings.xml`). **Inspection du contenu réel de ces éléments avant de
trancher** (silhouette humaine + icône "rafraîchir" ancrées sur la feuille `Personnage`, décoratives,
sans lien avec les données du personnage ; le contenu réellement utile — 60+ commentaires reprenant
des descriptions de compétences du Livre de Base — dépend de `comments1.xml` et `vmlDrawing1.vml`,
tous deux **conservés par `xlsx`**, pas de `xl/drawings/*.xml`/`persons/person.xml` qui eux ne
portent que les 2 images décoratives et l'attribution nominative des commentaires).

**Décision (2026-08-13/14, Saar) : critère images/dessins écarté** — sans objet une fois vérifié ce
qu'il recouvrait réellement. **`xlsx` (SheetJS) retenu**, pas `xlsx-populate` : à fidélité
fonctionnelle égale sur ce qui compte (plages nommées, formules, contenu des commentaires), `xlsx`
l'emporte sur la pérennité (maintenance active vs bibliothèque à l'arrêt depuis 6 ans, 125 issues
ouvertes) et la simplicité (déjà présent dans `package.json`, pas de nouvelle dépendance). Écriture
par adresse résolue à l'avance (`sheet['B6'] = {t:'s', v:...}`), pas d'API "par nom" — à faire nous-
mêmes via le script de classification (§3.2 point 2), `xlsx` n'en propose pas nativement.

**`[REPRIS]` (2026-08-15) — décision finale : `xlsx-populate` remplace `xlsx`.** La piste écartée
ci-dessus était fondée sur un malentendu de cadrage, corrigé par un test réel de Saar sur un export
concret : la tâche n'est pas seulement "écrire des données", c'est "compléter le modèle fourni sans
le dénaturer" — la perte de mise en forme observée n'était donc pas hors périmètre, elle est
directement le "détruit" que Saar a signalé après ouverture du fichier exporté (aucune bordure,
aucune couleur, aucun cadre). `xlsx` reste incapable de ça par construction (§3.1 déjà mesuré :
`styles.xml` 69582 → 1289 octets sur tout export, y compris sans toucher une cellule).
`xlsx-populate` a été réinstallé (dépendance réelle, racine + `server/`, plus un test `--no-save`) et
tout `tools/audit-excel-named-ranges.js` + `excelExportWriter.js` + `excelExportAssembler.js`
réécrits pour son API (asynchrone au chargement/écriture, synchrone cellule par cellule — proche de
l'ancienne). Vérifié par test réel après réécriture complète : `styles.xml` identique à l'octet près
au fichier écrit (`AE5`/`AE7` gardent leurs remplissages d'origine, y compris sur les cellules
écrites par l'export), `sharedStrings.xml`/dessins/images intacts, toutes les valeurs/formules déjà
validées (identité, génotype, attributs, compétences, avantages, inventaire) recalculées identiques
par LibreOffice réel après la réécriture.

**Limite trouvée en cours de rework, résolue** : `xlsx-populate` n'a aucune API de commentaires
Excel (ni lecture, ni écriture) — un vrai problème puisque `writeSkills` doit réécrire les lignes de
compétences à chaque export, et les 85 commentaires d'origine du "Vierge" (icônes "🛈" + descriptions
RAW) restaient sinon accrochés aux cellules vidées (fantômes, décrivant la mauvaise compétence).
Résolu par reconstruction manuelle post-traitement : `excelExportAssembler.js::rebuildComments`
regénère `xl/comments1.xml` + `xl/drawings/vmlDrawing1.vml` directement (hors des deux bibliothèques,
aucune ne gère ce format), à partir de la liste des compétences réellement écrites (`ref_skills.
description`, déjà disponible côté Lot 1) — validé sur un exemple isolé avant généralisation
(aller-retour LibreOffice complet, ouverture + recalcul + sauvegarde, commentaire correct et aucune
corruption), puis sur l'export complet.

**Découverte annexe pendant le rework, corrigée** : `resolveNamedRange` (SheetJS, Lot 0d) avait un
bug non détecté sur les plages `Inventaire*` (déclarées en syntaxe colonne entière, `$A:$A` etc.) —
en réalité ces colonnes ont une ligne d'en-tête (ligne 1 : "ID", "Objet", "Poids total"...) et les
données commencent en ligne 2, jamais vérifié explicitement avant (le fallback SheetJS retombait sur
la ligne 1 comme point de départ). Risque réel : le premier objet d'inventaire aurait pu écraser la
ligne d'en-tête. Confirmé absent du nouveau code (`WHOLE_COLUMN_DATA_START_ROW = 2`,
`tools/audit-excel-named-ranges.js`) et vérifié par test réel (ligne 1 intacte après export).

### 3.2 Stratégie d'écriture

1. Ne jamais écrire dans une plage nommée dont la cellule cible porte une formule (§1.2 famille 2),
   **sauf** les 4 motifs de compétences identifiés en §1.3, réécrits en Excel natif sans regex
   (`FIND`/`ISNUMBER`/`SUBSTITUTE`, décision finale §1.3bis — pas `REGEXTEST`, écarté §1.3), via
   `assertReplaceableFormula` (pas `assertWritable`), puisqu'ils portent sur des plages que le Wizard
   alimente réellement (`CompBase`/`CompTotal`).
2. ✅ **Fait (Lot 0d)** : `tools/audit-excel-named-ranges.js` résout `nom → feuille + adresse(s)` et
   détecte la présence de `<f>` pour les 308 plages, à la volée depuis le classeur chargé (pas de
   liste figée). Script réexécutable, pas une doc à maintenir (`docs/RegleDocumentaire.md` Règle 1).
3. Les 42 formules du "moteur armes/munitions/armures" (§1.3) ne sont **ni écrites, ni
   reconstruites** — elles restent telles quelles (cassées mais sans effet, car les emplacements
   qu'elles lisent sont vides sur un personnage neuf).
4. Le mapping détaillé champ Enclume ↔ plage nommée sera fait plage par plage juste avant son
   propre "Je code ?" (même discipline que les autres chantiers multi-lots du projet), pas figé ici.
5. `[RISQUE NON ÉVALUÉ, à vérifier en Lot 2]` — les formules `CompBase`/`CompTotal` sans `LET`
   (§1.3bis) répètent jusqu'à 10 fois la même expression `INDEX(...)` imbriquée, sur potentiellement
   1186×2 cellules. Impact réel sur la taille du fichier et la fluidité de recalcul pour l'utilisateur
   final non mesuré — à tester sur un export réel avant de généraliser à toutes les lignes.
6. `[RISQUE NON ÉVALUÉ, à vérifier en Lot 2]` — SheetJS peut ignorer silencieusement une cellule
   écrite hors de la plage `!ref` déclarée d'une feuille (défaut connu de la bibliothèque). Nos tests
   d'écriture sont tombés dans des adresses déjà comprises dans `!ref` existant ; non vérifié comme
   robuste en général (ex. `Inventaire` au-delà des lignes actuellement utilisées). Le futur écrivain
   du Lot 2 doit vérifier/étendre `!ref` explicitement avant d'écrire, ne pas supposer que SheetJS le
   fait pour lui.

---

## 4. DÉCOUPAGE EN LOTS (proposition, séquentiel)

- **Lot 0 — Validation technique (bloquant, avant tout mapping).**
  a) ~~Vérifier la disponibilité de `REGEXTEST`~~ **Tranché (2026-08-13)** : formule sans regex
     retenue par défaut (§1.3) pour une compatibilité maximale, indépendante de la version d'Excel.
  b) ⏳ **Restant, à faire par Saar** : ouvrir `Fiche Polaris Online - Vierge.xlsx` dans son
     Excel/LibreOffice réel et forcer un recalcul complet — confirmer que les 42 formules hors
     périmètre (moteur armes/munitions/armures) n'affichent pas d'erreur bloquante ailleurs que sur
     les emplacements vides (comportement attendu, à vérifier quand même : une erreur en cascade
     inattendue serait un signal à réexaminer).
  c) ✅ **Fait (2026-08-13)** : test d'aller-retour `xlsx` vs `xlsx-populate` exécuté sur une copie
     jetable (scratchpad) — résultat et décision en §3.1.
  d) ✅ **Fait (2026-08-14)** : `tools/audit-excel-named-ranges.js` — résout les 308 plages nommées
     à la volée depuis le classeur chargé (jamais figées en dur), classe chaque plage
     (`single`/`block`/`column`/`broken`, formule ou statique). Exporte deux fonctions
     réutilisables pour le Lot 2 : `resolveNamedRange(workbook, name)` (inspection) et
     `assertWritable(workbook, name)` (garde-fou qui refuse d'écrire dans une plage cassée ou
     porteuse d'une formule — protège contre une dérive future du gabarit sans dépendre d'un
     mapping figé). Recherché au préalable : le fichier n'utilise pas la protection de cellule
     Excel native (aucune `<sheetProtection>`/`<protection>`), donc pas de raccourci possible via
     un marqueur d'intention déjà posé par l'auteur — la détection par présence de `<f>` est la
     seule voie fiable. Validé : audit CLI (308 total, 1 cassée = `MunitionsCAL`, 64 avec formule,
     243 statiques — chiffres identiques à l'investigation manuelle) + 4 cas de test sur
     `assertWritable`/`resolveNamedRange` (entrée acceptée, formule refusée, plage cassée refusée,
     bloc correctement résolu).
  e) 🟡 **Fait avec réserve (2026-08-13)** : formules écrites (§1.3bis), building blocks validés par
     un moteur de calcul réel (LibreOffice). Une anomalie (`INDEX` sur `CompAttributs`) reste
     non expliquée par les tests automatisés — validation finale reportée au test réel de Saar (0b).
- **Lot 1 — Agrégation serveur des données à exporter.** ✅ **Fait (2026-08-14)** :
  `server/src/services/characterExportService.js`, fonction `getCharacterExportData(characterId,
  campaignId)`. Réutilise `getGenotypeModForAttr`/`getMutationModForAttr` (`shared/polarisUtils.js`),
  `getAdvantages` (`advantageService.js`), `getInventory` (`inventoryService.js`) — aucune logique de
  calcul dupliquée. Retourne des données Enclume "propres" (attributs en 4 composantes séparées,
  `genotype_id` brut) : les décisions propres au classeur Excel (fusion `base_level+mod_mutation`
  dans `ATTBase{X}`, table génotype→libellé exact, jointure `char_skills`+`ref_skills` déjà faite
  ici mais Base/Total volontairement absents car recalculés par Excel lui-même, §1.3bis) restent au
  Lot 2. Identité limitée à `player_name`/`char_name` ; avantages/désavantages au nom seul (§2.0/§2.4
  — rien d'autre n'a de destination dans le classeur). **Testé sur les 30 personnages réels de la
  base de dev** (`node --env-file=../.env`) : aucune erreur, y compris cas limites (personnage sans
  campagne, sans identité, sans compétences) ; vérifié sur un personnage avec données réelles
  (compétences, attributs non-défaut) que les jointures produisent les bons champs.

  **`[VÉRIFIÉ]` (2026-08-14) — revue à charge du Lot 1, deux décisions produit tranchées avec Saar :**
  - **Personnage brouillon (Wizard non verrouillé) exportable sans restriction** — confirmé "aucune
    opposition ferme ni raison de bloquer". Cohérent avec le comportement actuel (aucune vérification
    de `wizard_locked_at` dans `getCharacterExportData`), rien à changer dans le code.
  - **Compétences exportées = uniquement celles développées (`char_skills`, jointure `INNER JOIN`),
    pas le catalogue complet.** Écart réel mesuré : `ref_skills` contient 249 compétences, un
    personnage réel testé (`JeanMi`) n'en a que 8 dans `char_skills`. Confirmé par Saar — cohérent
    avec l'exemple du gabarit "Vierge" (quelques lignes remplies, pas les 1186 disponibles). Décision
    qui avait été prise silencieusement en écrivant la jointure SQL, maintenant actée explicitement
    plutôt que laissée implicite dans le code.

  **Vérifications supplémentaires effectuées en revue** (au-delà de "aucune erreur", vérification des
  *valeurs* produites) :
  - `mod_genotype` **vérifié avec une vraie valeur non nulle** : personnage `GEN_HYB` réel,
    `{mod_for:1, mod_con:1, mod_coo:2}` — exactement conforme au seed (`33_char_ref_genotypes.js`).
  - Filtre avantages/désavantages **vérifié avec une vraie donnée non vide** : personnage `JeanMi`
    (`char_sheet_id 3356c5f0...`) a l'avantage "Allié ou Fournisseur supplémentaire", correctement
    classé (mon contrôle initial affichait 0 résultat sur toute la base à cause d'un motif de
    recherche mal formé pour du JSON multi-lignes — faux négatif corrigé, pas une absence de données).
  - `mod_mutation` **reste non vérifié avec une valeur non nulle** : les 2 seules mutations actives de
    toute la base de dev ("Androgyne") ont `mod_FOR/CON/COO/INT/VOL/PRE` = 0 par définition RAW (effet
    sur le sexe, pas les attributs) — confirmé en lisant `ref_mutations` directement, ce n'est pas un
    bug de `char_mutation_effects_view`. Mais aucun personnage de la base ne permet de vérifier le
    chemin "mutation avec effet d'attribut réel" par exécution — seulement par lecture de code
    (réutilise `getMutationModForAttr`, déjà utilisée ailleurs dans `charStats.js`/`inventoryService.js`
    pour le même calcul). À garder en tête si un bug apparaît un jour sur ce chemin précis.
  - `[RISQUE NON ÉVALUÉ, à vérifier avant Lot 3]` — `getCharacterExportData(characterId, campaignId)`
    fait confiance à `campaignId` tel quel, sans vérifier qu'il correspond au personnage. Aucune route
    ne l'expose encore donc rien d'exploitable aujourd'hui, mais la future route du Lot 3 devra
    impérativement passer `req.character.campaign_id` (déjà vérifié par le middleware d'ownership,
    `router.param('characterId', ...)`), jamais une valeur fournie par le client.
- **Lot 2 — Mapping et écriture (identité limitée au nom + génotype, attributs, compétences,
  avantages/désavantages en noms seuls, équipement/argent — §2.5, décidé inclus §6).** Uniquement
  les plages "entrée de création" (famille 1, §1.2), sur la base du garde-fou
  `assertWritable`/`assertReplaceableFormula` (Lot 0d, `tools/audit-excel-named-ranges.js`).
  Description physique et carrières hors périmètre (§2.0 — aucune destination dans le classeur).
  Découpé fichier par fichier (feedback_segment_by_file) :

  1. ✅ **Fait et testé (2026-08-14)** — `tools/audit-excel-named-ranges.js` étendu de
     `writeSingleCell`/`writeColumnCell`/`writeColumnFormula` (écriture par plage résolue à la
     volée, jamais d'adresse en dur). `server/src/services/excelExportWriter.js` créé :
     `writeIdentity`/`writeGenotype`/`writeAttributes`/`writeMoney`, table
     `GENOTYPE_LABEL_MAP` (§2.2) et `ATTR_SUFFIX` (aligné sur `ATTR_IDS_START`,
     `creationService.js`). Testé sur un personnage réel `GEN_HYB` : `Fiche_Nom`, `Liste_TypeGen`
     ("Geno-hybride" sans accent, correct), `ATTBaseFor`/`ATTMPCFor` (Option C), `InvArgentPerso`
     tous corrects en relecture indépendante ; `ATTNaFor` (formule vivante) confirmé intact,
     jamais écrasé.
  2. ✅ **Fait et testé (2026-08-15)** — `writeSkills` (§2.3, réécrit) : efface puis réécrit
     intégralement le bloc compétences (jamais un matching contre un catalogue figé — correction
     d'hypothèse en cours de route, voir §2.3). Groupement famille/parent, remplacement de
     `CompAttributs`/`CompIndicateur`/`CompBase`/`CompTotal` par référence directe à la ligne
     (formules simplifiées par rapport au §1.3bis, plus robustes). Corrige au passage `ATTMalCoo`
     (malus fantôme, §2.3) et le piège SheetJS "formule sans `v` = supprimée à l'écriture" (touche
     aussi `writeColumnFormula`, Lot 0d). Validé par recalcul LibreOffice réel sur un personnage à 17
     compétences (dont parent/enfant) — toutes les valeurs `Base`/`Total` exactes.
  3. ✅ **Fait et testé (2026-08-15)** — `writeAdvantages` (§2.4) : noms seuls dans `Avantages`/
     `Desavantages` (17 lignes chacun, confirmées vides sans donnée d'exemple ni commentaire —
     vérifié à nouveau après les surprises du fichier 2/5). Garde-fou : dépasser 17 entrées lève une
     erreur explicite plutôt que de tronquer silencieusement. Testé sur un personnage réel (1
     désavantage "Fécondité" correctement écrit, avantages vides correctement laissés vides) et sur
     un cas limite (20 avantages fictifs → exception levée comme attendu, message clair).
  4. ✅ **Fait et testé (2026-08-15)** — `writeInventory` (§2.5, mapping détaillé). Pas de matching
     par nom contre l'onglet Excel `Equipements` (contrairement au script d'origine) : Enclume a déjà
     la donnée source via `ref_equipment`. `getInventory()` étendu (7 champs `ref_equipment` +
     `mods_installed` + `current_ammo_name`, ajout pur). Corrige au passage un bug de fond dans
     `resolveNamedRange` (mauvaise gestion des plages en syntaxe colonne entière, `$H:$H`) et un UUID
     brut qui aurait été écrit tel quel (`current_ammo`). Validé par recalcul LibreOffice réel sur un
     personnage à 13 objets.
  5. ✅ **Fait et testé (2026-08-15)** — `excelExportAssembler.js::buildCharacterExportWorkbook`.
     Modèle chargé depuis MinIO (jamais un chemin `docs/` ni le disque local du serveur — migration
     244, `server/src/db/seed-assets/polaris-export/fiche-polaris-vierge.xlsx`, même convention que
     les autres assets fixes du projet, ex. migrations 144/145/146/148). Appelle les 6 écrivains dans
     l'ordre, retourne un `Buffer` prêt pour une future route (Lot 3). Testé de bout en bout sur un
     personnage réel : récupération MinIO réelle, ~755 ms au total, fichier résultant recalculé par
     LibreOffice réel — mêmes valeurs exactes que chaque test isolé (nom, génotype, `ATTMalCoo` bien
     vide, total de compétence, désavantage, objet d'inventaire). `!ref` des feuilles
     `Personnage`/`Inventaire` vérifié suffisamment large pour toutes les plages écrites
     (`[RISQUE ÉVALUÉ ET ÉCARTÉ]`, corrige §3.2 point 6 — plus un risque non évalué).

  Table de correspondance explicite `{id génotype → libellé exact Excel}` faite (§2.2,
  `GENOTYPE_LABEL_MAP`). Génération du fichier `.xlsx` en `Buffer` faite (point 5) ; le
  téléchargement/déclenchement HTTP reste au Lot 3.
- **Lot 3 — Déclenchement UI.** ✅ **Fait (2026-08-15)** :
  - `GET /api/char-sheet/:characterId/export-excel` (`server/src/routes/character/char-sheet.js`) —
    même middleware d'ownership que le reste de la route family, `req.character.campaign_id` transmis
    (jamais une valeur du client). Renvoie le buffer en pièce jointe (`Content-Disposition`, même
    motif que `texture-packs.js`). Testé : le serveur démarre sans erreur avec le nouvel import,
    401 sans authentification (route bien montée et protégée).
  - Bouton "Exporter en Excel" dans `CharacterWindow.jsx`, visible MJ ou propriétaire (même portée
    que l'upload GLB), état de chargement (`exportingExcel`), erreur affichée via `window.alert`
    (même motif que `handleSendToVault`). Téléchargement par blob (`URL.createObjectURL`), même
    motif que `WorkshopPage.jsx`/`TexturePacksPage.jsx` (export de pack de textures).
  - Clés i18n ajoutées à `fr.json` (`character.exportExcel`/`character.exportExcelError`).
  - ✅ **Testé en navigateur par Saar (2026-08-15)** — clic, téléchargement et ouverture réels
    confirmés fonctionnels ; mise en forme intacte (le problème `xlsx`/SheetJS ne revient pas).

**🔴 `[VÉRIFIÉ]` (2026-08-15) — §2.2ter, bug trouvé sur ce premier export réel : `#VALEUR!`/`###` en
cascade sur toute la fiche `Baboulinet`.** Ce personnage n'a jamais eu de génotype choisi au Wizard
(`archetype.genotype_id = null`). `writeGenotype` (fait avant cette entrée) écrivait alors une chaîne
vide dans `Liste_TypeGen`. Or `ATTMTGFor = IF(Liste_TypeGen="","",INDEX(...))` renvoie du texte `""`
sur `Liste_TypeGen` vide (pas une vraie cellule vide) : `ATTNaFor = ATTBaseFor+ATTMTGFor+ATTMPCFor+
ATTMalFor` fait alors `nombre + "" + ...` → `#VALEUR!`, confirmé texto par recalcul LibreOffice réel
(`<v>#VALUE!</v>` sur `AE9`). Cette erreur remonte dans `ATTAn{X}` (Aptitude naturelle, dépend de
`ATTNa{X}`), donc dans toutes les compétences (`CompBase`/`CompTotal` lisent `ATTAn{X}`), et dans
toute autre formule du classeur dépendant des attributs — d'où la cascade sur toute la fiche, pas 8
bugs séparés.

Root cause : `genotype_id` absent n'est pas un état "inconnu" à laisser vide, c'est un choix par
défaut déjà tranché ailleurs dans le code (`client/src/character/CharacterSheet.jsx:445`,
`archetype.genotype_id || 'HUMAIN'`) — `writeGenotype` était la seule couche à ne pas appliquer cette
convention. **Corrigé** (`excelExportWriter.js::writeGenotype`) : `genotypeId = data.archetype
?.genotype_id || 'HUMAIN'`.

Vérification (pas une relecture, un recalcul réel) : réexport de `Baboulinet` (même personnage),
recalcul forcé LibreOffice (`.xlsx→.ods→.xlsx`), diff des cellules en erreur (`t="e"`) entre le
classeur "Vierge" non modifié (1154 erreurs, quirks préexistants du gabarit sur des lignes exemple
vides — pas le périmètre de ce bug) et l'export corrigé (974 erreurs) : **zéro nouvelle erreur
introduite**, 180 résolues (toutes en colonnes `L`/`M` lignes 39-128, le bloc Compétences rempli de
vraies données). `ATTNaFor` recalculé = 12 (correct). Les `###`/`#VALEUR!`/`#NOM?` visibles sur
`Allure`/`Chance`/`Sous l'eau` dans le screenshot de Saar disparaissent avec la même cause (dépendent
tous de `ATTAn{X}`), confirmé indirectement par l'absence de toute nouvelle erreur post-correctif.

Les ~974 erreurs restantes sont préexistantes dans le "Vierge" lui-même (présentes même sans aucune
modification) — hors périmètre de ce bug, à ne pas confondre avec une régression de l'export.

**🔴 `[VÉRIFIÉ]` (2026-08-15) — §2.3bis, deuxième bug trouvé sur le même export réel : seules 5
compétences apparaissaient (celles où Saar avait mis un point au Wizard), pas le catalogue complet.**
`characterExportService.js` ne remontait que les lignes `char_skills` déjà investies (`JOIN`), jamais
les compétences à maîtrise 0 — alors qu'une fiche Polaris papier liste toute compétence utilisable, y
compris à 0. Demande explicite de Saar : exporter tout le catalogue **hors compétences réservées et
nulles**. Définitions tranchées par lecture du schéma/RAW (pas de devinette) :
- **Réservée** : `ref_skills.marker='(X)'` non apprise (`char_skills.is_learned` absent/`false`) — RAW
  p.188 (`REGLECOMPETENCE.md:14-25`), inutilisable tant qu'un niveau n'a pas été acheté. Même règle
  que `SkillsPanel.jsx` (règle 1 de son algorithme de visibilité, `CHARACTER.md` §"Algorithme de
  visibilité", PC15).
- **Nulle** : `ref_skills.attr_1 IS NULL` — 5 lignes catégorie sans attribut propre depuis la
  migration 105 (`PILOTAGE`, `ARME_SPECIALE_CONTACT`, `ARME_SPECIALE_DISTANCE`,
  `CONTROLE_DES_MUTATIONS`, `EXPRESSION_ARTISTIQUE`) : aucune Base calculable.

N'implémente pas l'algorithme complet de visibilité de `SkillsPanel.jsx` (règles 2-4, SKILL_MIN/
MUTATION/GENOTYPE) — non demandé, hors périmètre de cette demande précise.

Corrigé : `characterExportService.js` part maintenant de `ref_skills` (LEFT JOIN `char_skills`,
`mastery`/`is_learned` par défaut `0`/`false` si absent) avec les deux exclusions ci-dessus.
`excelExportWriter.js::groupSkillsForExport` corrigé en même temps : une ligne racine `is_category`
(ex. "Mécanique", "Tactique" — 12/17 catégories ont un attribut propre depuis la migration 105) reste
une ligne d'en-tête pure, jamais sa propre ligne Base/Total, même attribut renseigné — comportement
identique à `SkillsPanel.jsx:216` (une catégorie ne s'affiche jamais avec sa propre valeur). Sans ce
garde-fou, le passage au catalogue complet aurait fait apparaître une valeur Base/Total incorrecte
sur chaque catégorie.

Vérifié sur `Baboulinet` : 99 compétences exportées (249 au catalogue, 146 réservées non apprises et
5 nulles exclues), aucune réservée ni nulle résiduelle. Recalcul LibreOffice réel : toujours **zéro
nouvelle erreur** vs le "Vierge" non modifié (926 erreurs préexistantes restantes, en baisse par
rapport aux 974 d'avant ce fix — plus de lignes du bloc Compétences remplies de vraies données).
Capacité du classeur largement suffisante (`CompCategories`/`CompNom`/... : 1186 lignes disponibles).

~~Lot 4 — Équipement / argent (conditionnel)~~ **fusionné dans le Lot 2** (2026-08-14) — §6 avait déjà
tranché "inclus" pendant que cette ligne disait encore "conditionnel" ; contradiction corrigée en
retirant le lot séparé plutôt qu'en le laissant traîner à contre-emploi de la décision actée.

---

## 5. CE QUI NE CHANGE PAS

- Aucune migration ne touche au schéma applicatif (tables/colonnes) — l'export lit des données déjà
  persistées, il n'en crée pas. `[MIS À JOUR 2026-08-15]` une seule migration existe (244), et elle ne
  fait que seeder un fichier fixe dans MinIO (même famille que 144/145/146/148) : aucune conséquence
  sur le schéma, aucune donnée applicative créée.
- `CharacterSheet.jsx`/`CharacterWindow.jsx` ne sont pas modifiés — l'export est une projection des
  données existantes vers un fichier séparé, pas une transformation de l'UI de la fiche.
- Les feuilles `Equipements`, `Compétences` et les listes de `Divers` (données de référence déjà
  présentes dans le gabarit "Vierge") ne sont jamais écrites par l'export.
- Une plage nommée porteuse d'une formule (famille 2, §1.2) n'est jamais écrasée **sauf** les 6 cas
  explicitement identifiés et gardés par `assertReplaceableFormula` (`CompAttributs`/`CompIndicateur`/
  `CompBase`/`CompTotal`, §1.3ter ; `InventairePoidsTotalObj`, §1.3ter ; `ATTMalCoo`, §2.2) — jamais
  une écriture directe sans ce garde-fou de comparaison avant remplacement.

---

## 6. POINTS OUVERTS — à trancher avec Saar avant Lot 0

1. ~~Le classeur est-il fiable une fois recalculé hors Google Sheets ?~~ **Tranché (2026-08-13)** :
   risque réel confirmé mais confiné à 47 formules uniques, dont 43 hors périmètre Wizard (§1.3).
   ~~Option A vs B (formules vivantes vs valeurs figées)~~ **Tranché (2026-08-13) : Option A.**
   ~~Version d'Excel cible / `REGEXTEST`~~ **Tranché (2026-08-13)** : formule `SEARCH` sans regex,
   compatible toutes versions (§1.3).
   ~~Classification "entrée de création vs suivi de partie"~~ **Tranché (2026-08-13)** :
   `Bourses*` et emplacements d'équipement porté jamais remplis ; `Blessures*` reste vide même pour
   mutation/revers narratifs (§1.2, §2.4) ; mutations hors périmètre (aucune plage nommée
   correspondante, §2.4).
   ~~Résoudre `ATTMTG` vs `ATTMal`~~ **Tranché (2026-08-13)** : `ATTMTG`=modificateur génotype
   (formule vivante, confirmée), `ATTMal`=malus générique/armure (vide, hors périmètre) ;
   `mod_mutation` fusionné dans `ATTBase{X}` à l'export (Option C, §2.2). `CompModificateur` confirmé
   vide sur les données réelles du classeur (§2.3), laissé vide à l'export.
   ~~Équipement/argent de départ~~ **Tranché (2026-08-13)** : inclus. L'export écrit l'état courant
   de `char_inventory` (feuille `Inventaire`) et `char_sheet.sols`, quel que soit son contenu au
   moment de l'export (souvent vide/à 0 pour un personnage neuf sans ajout MJ en Step 6, §2.5 —
   comportement attendu, pas un défaut de l'export).
   ~~Bibliothèque d'écriture~~ **Tranché (2026-08-14)** : `xlsx` (SheetJS), sur preuve (comparaison
   à trois `xlsx`/`xlsx-populate`/`exceljs`, §3.1) — actively maintenu, déjà présent au projet,
   aucune perte sur ce qui compte (plages nommées, formules, commentaires). Décision initiale
   (`xlsx-populate`) revue après vérification que le critère images/dessins, écarté par Saar,
   n'aurait de toute façon changé aucune donnée fonctionnelle.

Tous les points ouverts d'origine sont tranchés. Lot 0 (hors 0b, test réel de Saar) et Lot 1 sont
faits. Le cadrage du Lot 2 a rouvert et corrigé trois points par balayage exhaustif (§1.3ter, §2.3,
§2.5) : formules `CompAttributs`/`CompIndicateur` (remplacées, pas des entrées),
`InventairePoidsTotalObj` (même traitement), destination de l'argent (`InvArgentPerso`). Reste à
faire avant d'écrire le code du Lot 2 : le mapping détaillé de la feuille `Inventaire` (31 plages,
pas encore fait).
