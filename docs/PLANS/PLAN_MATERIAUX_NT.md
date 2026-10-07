# PLAN_MATERIAUX_NT.md — Catalogue de matières RAW, classé par Niveau Technologique

> Créé le 2026-10-07. Statut : **code en cours, jamais vu en navigateur**. Source RAW :
> `docs/PLANS/GT_MATERIAUX.md` (Guide Technique Polaris, chapitre matériaux — extraction complète
> vérifiée, s'arrête net après l'intro « Alliages particuliers » pour enchaîner sur les propulseurs,
> ce n'est pas une troncature). Suite directe du mini-chantier miniatures Matière/Motif
> (`PLAN_WORLD_BUILDER_REWORK.md` §22) : Saar a constaté, miniatures sous les yeux, un vrai manque
> de variété visuelle du catalogue (8 matières génériques) — ce chantier le corrige à la source.

## 1. Objectif

Remplacer les matières génériques (Acier/Plastique/Bois/Béton) par un vrai catalogue RAW, organisé
par Niveau Technologique (NT I→VII), pour que le MJ puisse construire une station cohérente — une
épave délabrée (NT I-II) ou un vaisseau high-tech (NT V+) — en piochant dans une palette qui a du
sens narratif, pas des presets inventés.

## 2. Méthode — deux corrections importantes trouvées en cours de route

**Erreur initiale corrigée par Saar (2026-10-07) : le NT n'est PAS un axe de lignée.** Premier
réflexe faux : traiter un matériau (ex. le béton) comme une chaîne qui évolue de NT II à NT VII,
un preset par palier du MÊME matériau. Le bon modèle, donné explicitement par Saar : **le NT est
une catégorie/étiquette de filtrage**. Chaque matériau nommé du RAW est une entrée indépendante
avec son propre bruit ; le champ `nt` sert uniquement à regrouper/filtrer la palette (« donne-moi
tout le NT II-III pour une station délabrée »). Conséquence pratique : le béton (6 entrées, NT
II→VII) reste valide a posteriori — ce sont 6 matériaux canon distincts (VHSC/UHPC/Hyper-UHPC/
Nano-UHPC ont chacun leur propre nom RAW) — mais ce n'est **pas le patron à répéter** pour les
matériaux suivants. L'acier, par exemple, n'a pas de palier NT IV+ autonome dans le texte (voir §4).

**Deuxième ajustement (2026-10-07, acier) : la variété visuelle prime sur l'exactitude
métallurgique quand elles s'opposent.** Recherche faite : RHA/VHS/HY-80/HSLA-100 sont
indiscernables à l'œil en réalité (différence mécanique, pas visuelle). Premier réflexe (une seule
entrée pour les 4) jugé insuffisant par Saar — **objectif du catalogue = produire des matériaux
différents**, donc écart assumé avec la réalité plutôt que 4 doublons visuels. Logique de
différenciation non arbitraire : plus dur/trempé → grain plus fin et plus poli ; plus ductile →
grain plus large et plus mat.

**Méthode de travail** : pour chaque matériau, recherche pro (texture-artistes PBR, métallurgie
réelle) *avant* de coder un nouveau bruit, jamais une couleur inventée sans base. Réutiliser une
fonction de bruit existante par un paramètre quand le matériau est une variation plausible d'un
autre déjà fait (même famille) ; nouvelle fonction seulement quand le registre visuel change
vraiment (ex. facettes cristallines, tissage).

## 3. Architecture technique

Tout vit dans `client/src/lib/proceduralMaterials.js` (seul fichier touché à ce stade). Aucun
changement d'interface pour l'instant — chaque nouveau preset apparaît automatiquement dans la
grille Matière existante (`SurfaceMaterialEditor.jsx`, chantier miniatures). Le regroupement visuel
par `nt` dans cette grille **n'est pas câblé** (même patron que `PROCEDURAL_PATTERN_GROUPS` pour les
motifs — à faire, pas fait).

Champs ajoutés sur les presets (`MATERIAL_PRESETS`), tous optionnels, absents = comportement
historique inchangé :
- `nt` (string 'I'..'VII') : catégorie de filtrage, pas encore consommée par l'UI.
- `family` : regroupe plusieurs presets sur une même branche `materialBase()` paramétrée (ex.
  `'concrete'` pour la lignée béton — sert aussi `paintCoverageFor`).
- `experimental` (bool) : matériau hors-RAW assumé (ex. béton NT VII), affiché tel quel dans le
  libellé tant qu'aucun badge UI n'existe.
- `grainFineness`/`grainVariance` : paramétrage du bruit béton existant (fréquence/amplitude du
  mouchetage), défaut 1 = rendu historique du VHSC inchangé.
- `brushFineness`/`brushContrast` : paramétrage du bruit « brossé » (repli final de
  `materialBase()`, déjà utilisé par acier/inox/alu/titane), défaut 1 = rendu historique inchangé.
- `hammerScale`/`hammerDarken`/`hammerDepth` : déclenche la branche martelage/porosité
  (`hammeredField`, voir plus bas) — grandes empreintes profondes (fer forgé) ou petites et denses
  (fonte, acier moulé), même fonction.

Nouvelles fonctions de bruit (toutes déterministes, hash2-based, même style que l'existant) :
- `cellularNoise(x, y, scale, seed)` — Worley/Voronoi : facettes à bords nets (f1, edge, cellShade).
  Utilisée par le béton cristallin (NT IV-V-VII) et le bronze (plaques de patine).
- `hammeredField(x, y, scale, seed)` — empreintes circulaires qui se chevauchent (accumulation,
  pas appartenance à une cellule). Utilisée par fer forgé/fonte/acier moulé.
- Tissage twill 2×2 du composite carbone : inline dans sa branche `materialBase()` (pas une
  fonction à part, usage unique pour l'instant) — deux diagonales perpendiculaires alternant par
  bloc 2×2. **Approximation géométrique non vérifiée visuellement**, premier motif vraiment tissé
  du catalogue, à ajuster après retour de Saar en navigateur.

**Point vérifié important (2026-10-07)** : `pbrForProcedural` (`SurfaceDungeonScene.jsx`) lit déjà
`roughness`/`metalness` directement depuis le preset (`PROCEDURAL_MATERIAL_PRESETS.find(...)`) — un
incident similaire (Inox/Alu/Titane retombant sur un défaut générique) a déjà été corrigé avant ce
chantier. Donc aucun risque de table dupliquée à resynchroniser pour les nouveaux presets — vérifié
en lisant le code, pas supposé depuis `MATERIAUX.md` qui est resté sur l'ancienne description.

## 4. Catalogue construit à ce jour (9 matériaux neufs/retravaillés)

### Béton (NT II→VII) — chaîne canon I→V + extrapolation VII, cf. §2 (pas un patron à répéter)
- **NT II** `concrete` — Béton armé [VHSC]. Juste étiqueté, zéro changement visuel (preset déjà
  existant avant ce chantier).
- **NT III** `concrete_uhpc` — Béton armé [UHPC]. GT : « plus de micro-fibres, contrôles plus
  poussés » — grain affiné/régularisé (`grainFineness`/`grainVariance`), mêmes couleurs.
- **NT IV** `concrete_hyper_uhpc` — Hyper-béton [UHPC]. GT : Cylast = trichites « sans défaut,
  matrice parfaite » → bruit cellulaire neuf (facettes à bords nets), justifié par le texte.
- **NT V** `concrete_nano_uhpc` — Nano-béton [UHPC]. Même structure cellulaire que NT IV,
  coefficients écrasés (poli jusqu'à dissimuler sa fabrication), teinte blanc froid — ancre
  esthétique « Citadelle/Moissonneurs » (Mass Effect, confirmé : la Citadelle EST une technologie
  Moissonneur, pas une simple avancée humaine).
- **NT VII** `concrete_nt7_absorbant` — **`experimental: true`, aucun texte GT au-delà de V**.
  Matrice qui piège la lumière plutôt que la réfléchir — principe géométrique du Vantablack réel
  (absorption, jamais de reflet spéculaire : rugosité haute, pas un noir brillant).
- **NT VI bloqué, documenté, pas esquivé** : un vrai reflet irisé demande
  `MeshPhysicalMaterial.iridescence` (natif Three.js, confirmé — `KHR_materials_iridescence`), mais
  `SurfaceDungeonScene.jsx` n'assemble aujourd'hui que des `MeshStandardMaterial`
  (`pbrForProcedural`/`proceduralMaterialAt`). Extension hors périmètre de `proceduralMaterials.js`
  seul — peindre un dégradé arc-en-ciel statique dans le canvas aurait été un faux irisé (ne réagit
  pas à la caméra), refusé.
- **Variété intra-palier déjà couverte, sans code neuf** : 11 motifs importés du groupe « Béton »
  (§14 `PLAN_WORLD_BUILDER_REWORK.md`, ambientCG) — dont « Sol béton endommagé »/« usé » pour du
  béton cassé — se combinent avec n'importe quel palier NT (matière et motif = deux axes
  indépendants, le motif ne touche jamais l'albédo).

### Ferreux (NT I-II)
- **NT I** `iron_wrought` — Fer forgé. Martelage réel (recherche PBR faite) : empreintes
  circulaires superposées, `hammeredField` grandes/profondes.
- **NT I** `cast_iron` — Fonte. Même fonction, échelle fine/dense (porosité de moule de sable,
  aléatoire, pas dirigée comme le martelage).
- **NT II** `steel` — Acier laminé [RHA] (ancien `steel` générique, **id conservé** — données déjà
  persistées en base référencent cet id, renommer l'id aurait cassé le rendu de cartes existantes).
  Réutilise le repli « brossé » déjà existant.
- **NT II** `steel_vhs` — Acier laminé [VHS]. Grain resserré/poli (`brushFineness: 2.2`).
- **NT II** `steel_hy80` — Acier laminé [HY-80]. Grain large/mat (`brushFineness: 0.6`) — HY-80 est
  aussi le nom d'un vrai acier de coque de sous-marin US Navy, référence réelle pas juste RAW.
- **NT II** `steel_hsla100` — Acier laminé [HSLA-100]. Entre-deux assumé entre HY-80 et RHA.
- **NT II** `steel_cast` — Acier moulé [AM]. Même porosité que la fonte (métallurgie réelle : cast
  steel et cast iron quasi indiscernables à l'œil — recherche faite), teinte acier plus claire.

### Autres
- **NT I** `bronze` — Bronze. GT : résistant à la corrosion, revêtement protecteur de l'acier — la
  patine EST la couche protectrice (vrai en métallurgie), donc incluse dans l'identité de base, pas
  un effet d'usure à part. Plaques irrégulières (bruit cellulaire, seuil) de patine vert-bleu sur
  fond doré, pas un voile uniforme (recherche : la vraie patine est disparate, pas homogène).
- **NT II** `composite_carbon` — Composite (fibre de carbone/résine époxy). GT : « protection qui
  vaut plus du double de l'acier RHA à masse égale ». Tissage twill 2×2 approximé — voir
  l'avertissement §3 sur la fiabilité visuelle non vérifiée.

**Non retravaillés, presets génériques existants, pas encore étiquetés NT** : `stainless_steel`,
`aluminum`, `titanium`, `anticorrosion_coating`, `plastic`, `wood`.

## 5. Validation à chaque étape

`eslint`/`npm run build`/`node --test proceduralMaterials.test.mjs materialDecision.test.mjs
surfaceData.test.mjs` (73 tests) propres après chaque matériau ajouté — aucune régression sur tout
le chantier. **Rien de tout ça n'a encore été vu en navigateur** : la lisibilité réelle des bruits
(cristallin, martelage, tissage surtout) reste à confirmer par Saar avant de considérer un
matériau « fini ».

## 6. Reste à faire

- Voir l'ensemble en navigateur, ajuster ce qui ne lit pas bien (le tissage carbone en premier
  candidat probable).
- Regroupement visuel par NT dans la grille Matière (même patron que `PROCEDURAL_PATTERN_GROUPS`).
- Étiqueter NT les presets génériques restants (inox/alu/titane/revêtement anticorrosion/
  plastique/bois) — certains ont un équivalent RAW direct (ex. Titane structurel, Aluminium
  structurel), d'autres non (plastique/bois ne sont pas des entrées GT nommées).
- Continuer le catalogue : céramique technique, verre/verre trempé (matériaux transparents — même
  famille de blocage que l'irisé NT VI, demande probablement `MeshPhysicalMaterial`/`transmission`),
  tungstène, composites multicouches (Al/TiC, acier/céramique/acier, tungstène/WC), NT III+
  (super acier, hyper acier, ALON, plastitane...).
- NT VI (irisé) : extension `SurfaceDungeonScene.jsx` pour supporter `MeshPhysicalMaterial` sur les
  matériaux qui le demandent — son propre sous-chantier, pas mélangé à l'ajout de presets.
- Option C notée par Saar, non cadrée, basse priorité : un éditeur de matériau custom pour les MJ
  qui veulent sortir du catalogue RAW.
