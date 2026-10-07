// roughness/metalness = base PBR (0=miroir/non-metal .. 1=diffus/metal), avant modulation par pixel
// (usure, rouille, saleté — voir generateProceduralMaterialTexture). Seule source de verite pour le
// rendu Three.js : SurfaceDungeonScene.jsx lit ces champs, aucune valeur dupliquee ailleurs.
import { sampleDisplacementMap, isDisplacementMapReady, onDisplacementMapReady } from './displacementMaps.js'
const MATERIAL_PRESETS = [
  // ─── Ferreux (GT_MATERIAUX.md) ───
  {
    // NT I. Martelé à la forge : empreintes circulaires qui se chevauchent sur toute la surface —
    // recherche texture-artistes PBR faite avant de coder ("hammered iron"), pas une tache de
    // bruit diffuse. hammerScale/hammerDarken/hammerDepth pilotent hammeredField (voir plus bas,
    // même mécanisme que cellularNoise — grille gigue + hash2) : grandes empreintes profondes ici,
    // contrairement à la porosité fine de la fonte/l'acier moulé ci-dessous (même fonction,
    // échelle différente — un affinage paramétrique, pas trois algorithmes).
    id: 'iron_wrought',
    label: 'Fer forge',
    nt: 'I',
    substrate: [52, 46, 40],
    dark: [24, 21, 19],
    light: [92, 84, 76],
    rust: true,
    roughness: 0.7,
    metalness: 0.55,
    hammerScale: 9,
    hammerDarken: 0.38,
    hammerDepth: 0.1,
  },
  {
    // NT I. Porosité de moule de sable — petits creux denses et aléatoires (gaz emprisonné à la
    // coulée), jamais dirigés comme les coups de marteau du fer forgé. Métallurgie réelle : la
    // fonte et l'acier moulé sont quasi indiscernables à l'œil nu (recherche faite) — même
    // algorithme que steel_cast plus bas, seule la teinte change.
    id: 'cast_iron',
    label: 'Fonte',
    nt: 'I',
    substrate: [34, 34, 34],
    dark: [16, 16, 16],
    light: [58, 58, 58],
    rust: true,
    roughness: 0.78,
    metalness: 0.5,
    hammerScale: 24,
    hammerDarken: 0.22,
    hammerDepth: 0.035,
  },
  {
    id: 'steel',
    // NT II, AHL. RHA (plaque homogène laminé) = la trempe de référence du GT (toutes les
    // comparaisons de blindage s'y rapportent) — reste la trempe "standard", id conservé (donnée
    // déjà persistée). Les 3 autres trempes ci-dessous assument un écart avec la métallurgie
    // réelle pour la variété du catalogue (Saar, 2026-10-07) : logique commune aux 4, voir le
    // commentaire sur brushFineness/brushContrast dans materialBase.
    label: 'Acier lamine [RHA]',
    nt: 'II',
    substrate: [122, 130, 132],
    dark: [46, 52, 55],
    light: [190, 198, 198],
    rust: true,
    roughness: 0.55,
    metalness: 0.42,
  },
  {
    // Trempe extrême : grain resserré et poli plutôt que brossé large (plus dur -> plus fin).
    id: 'steel_vhs',
    label: 'Acier lamine [VHS]',
    nt: 'II',
    substrate: [128, 136, 142],
    dark: [42, 48, 54],
    light: [200, 208, 212],
    rust: true,
    roughness: 0.38,
    metalness: 0.55,
    brushFineness: 2.2,
    brushContrast: 0.6,
  },
  {
    // Grande ductilité (acier de coque de sous-marin réel, cette appellation existe dans le monde
    // actuel) : grain large et marqué, fini mat de travail plutôt que poli.
    id: 'steel_hy80',
    label: 'Acier lamine [HY-80]',
    nt: 'II',
    substrate: [116, 120, 112],
    dark: [50, 54, 52],
    light: [175, 180, 175],
    rust: true,
    roughness: 0.64,
    metalness: 0.38,
    brushFineness: 0.6,
    brushContrast: 1.4,
  },
  {
    // Évolution de l'HY-80 ("plus performant") : entre-deux assumé, pas une nouvelle extrémité.
    id: 'steel_hsla100',
    label: 'Acier lamine [HSLA-100]',
    nt: 'II',
    substrate: [118, 123, 124],
    dark: [48, 53, 54],
    light: [182, 188, 186],
    rust: true,
    roughness: 0.58,
    metalness: 0.4,
    brushFineness: 0.85,
    brushContrast: 1.1,
  },
  {
    // NT II. Coulé, pas laminé — même algorithme de porosité que la fonte (hammeredField, même
    // échelle fine), teinte acier plus claire et empreintes un peu moins marquées (finition parfois
    // plus lisse que la fonte brute, cf. recherche cast steel vs cast iron).
    id: 'steel_cast',
    label: 'Acier moule [AM]',
    nt: 'II',
    substrate: [108, 112, 116],
    dark: [55, 57, 60],
    light: [140, 143, 148],
    rust: true,
    roughness: 0.68,
    metalness: 0.5,
    hammerScale: 24,
    hammerDarken: 0.16,
    hammerDepth: 0.025,
  },
  {
    id: 'plastic',
    label: 'Plastique',
    substrate: [82, 88, 98],
    dark: [36, 40, 48],
    light: [190, 196, 208],
    rust: false,
    roughness: 0.62,
    metalness: 0.02,
  },
  {
    id: 'wood',
    label: 'Bois',
    family: 'wood',
    substrate: [132, 82, 42],
    dark: [72, 42, 24],
    light: [190, 128, 72],
    rust: false,
    roughness: 0.78,
    metalness: 0.02,
  },
  {
    // NT I. "Densite tres faible... compte tenu de sa rarete, tres rarement utilise [comme
    // ossature]." Meme essence/bruit que le bois generique (GT ne decrit pas de texture propre),
    // teinte plus pale (bois de charpente leger, type sapin/epicea plutot que le bois dense
    // generique ci-dessus).
    id: 'bois_charpente',
    label: 'Bois de charpente',
    nt: 'I',
    family: 'wood',
    substrate: [150, 110, 65],
    dark: [95, 65, 35],
    light: [205, 165, 110],
    rust: false,
    roughness: 0.75,
    metalness: 0.02,
  },
  {
    // NT I. "Lamelles de bois collees entre elles." grainFrequency plus eleve (voir materialBase) :
    // lamelles de placage plus fines et plus repetitives qu'une planche massive -- meme algorithme,
    // juste la frequence qui change (pas un nouveau bruit).
    id: 'contreplaque',
    label: 'Contreplaque',
    nt: 'I',
    family: 'wood',
    grainFrequency: 34,
    substrate: [170, 135, 90],
    dark: [120, 90, 55],
    light: [210, 180, 135],
    rust: false,
    roughness: 0.68,
    metalness: 0.02,
  },
  {
    // NT I. "Materiau privilegie des structures primitives." Variation de teinte marquee par
    // blotch mineral + veines sombres isolees (recherche PBR pierre naturelle, voir la branche
    // visuelle dans materialBase) -- jamais un grain uniforme comme le beton.
    id: 'roche',
    label: 'Roche',
    nt: 'I',
    substrate: [110, 105, 95],
    dark: [55, 52, 46],
    light: [155, 150, 138],
    rust: false,
    roughness: 0.85,
    metalness: 0,
  },
  {
    // NT I. "Remplace avantageusement le bois pour des structures ne necessitant pas de
    // contraintes trop importantes." Appareillage en panneresse (voir materialBase) -- teinte
    // terre cuite, mortier gris-beige clair aux joints.
    id: 'brique',
    label: 'Brique',
    nt: 'I',
    substrate: [150, 90, 65],
    dark: [100, 55, 38],
    light: [185, 120, 88],
    rust: false,
    roughness: 0.8,
    metalness: 0,
  },
  // ─── Métaux lourds / gueuses (GT_MATERIAUX.md, NT I-II) ───
  {
    // NT I. "De par sa grande densite, l'or pourrait faire un tres bon materiau a gueuse" -- un
    // lingot coule, pas une plaque laminee : reutilise hammeredField (porosite de coulee, meme
    // mecanisme que fonte/acier moule) plutot que le repli brosse. PBR reel (or poli) ~ (1.0, 0.77,
    // 0.34) -- assombri/desature ici pour une gueuse brute, jamais poli miroir.
    id: 'gold',
    label: 'Or',
    nt: 'I',
    substrate: [200, 165, 60],
    dark: [120, 95, 30],
    light: [235, 205, 110],
    rust: false,
    roughness: 0.35,
    metalness: 0.9,
    hammerScale: 30,
    hammerDarken: 0.12,
    hammerDepth: 0.02,
  },
  {
    // NT I. "Metal tres malleable... souvent utilise sous forme de gueuses." Le plomb reel a une
    // reponse metallique terne (couche d'oxyde quasi immediate) -- metalness plus bas que les
    // autres metaux du catalogue malgre sa densite, teinte gris-bleu plutot que gris neutre.
    id: 'lead',
    label: 'Plomb',
    nt: 'I',
    substrate: [96, 98, 102],
    dark: [55, 56, 60],
    light: [130, 132, 136],
    rust: false,
    roughness: 0.75,
    metalness: 0.65,
    hammerScale: 20,
    hammerDarken: 0.15,
    hammerDepth: 0.025,
  },
  {
    // NT II. "Grande durete... peu d'alliages... utilises principalement sous forme de gueuses."
    // Alliage dense (nickel/cuivre/fer ajoutes) -- gunmetal sombre, porosite de coulee fine/serree
    // (metal dur, difficile a travailler -- la coulee reste la methode, pas le laminage).
    id: 'tungsten_alloy',
    label: 'Alliage de tungstene',
    nt: 'II',
    substrate: [58, 60, 64],
    dark: [28, 29, 32],
    light: [92, 95, 100],
    rust: false,
    roughness: 0.42,
    metalness: 0.75,
    hammerScale: 34,
    hammerDarken: 0.14,
    hammerDepth: 0.018,
  },
  // ─── Béton (GT_MATERIAUX.md, chaîne NT II→VII) ───
  {
    id: 'concrete',
    label: 'Beton arme [VHSC]',
    nt: 'II',
    family: 'concrete',
    substrate: [118, 120, 116],
    dark: [64, 66, 64],
    light: [170, 172, 166],
    rust: false,
    roughness: 0.88,
    metalness: 0.01,
  },
  {
    // GT_MATERIAUX.md NT III : "plus de micro-fibres, controles plus poussés, ajout de micro
    // silice" par rapport au VHSC -- un affinage du meme beton, jamais un materiau different
    // (pas de barres d'armature visibles, le renfort est micro). grainFineness/grainVariance
    // traduisent ca visuellement : grain plus fin (frequence de bruit plus haute) et plus
    // regulier (amplitude du mouchetage reduite) que le VHSC, memes couleurs de base.
    id: 'concrete_uhpc',
    label: 'Beton arme [UHPC]',
    nt: 'III',
    family: 'concrete',
    substrate: [118, 120, 116],
    dark: [64, 66, 64],
    light: [170, 172, 166],
    rust: false,
    roughness: 0.82,
    metalness: 0.01,
    grainFineness: 1.8,
    grainVariance: 0.55,
  },
  {
    // NT III, liste Hypertechnologie du GT -- ligne VHSC (economique), distincte de la ligne UHPC
    // ci-dessus/ci-dessous. Voir le commentaire de branche dans materialBase pour le detail.
    id: 'concrete_hyper_vhsc',
    label: 'Hyper-beton [VHSC]',
    nt: 'III',
    family: 'concrete',
    substrate: [118, 120, 116],
    dark: [64, 66, 64],
    light: [170, 172, 166],
    rust: false,
    roughness: 0.72,
    metalness: 0.03,
  },
  {
    // GT NT IV : "Ce beton est plus performant que le nano-titane structurel et moins cher. En
    // revanche il est moins resistant." Suite de hyper_vhsc ci-dessus, reste la ligne VHSC
    // (jamais blanche/porcelaine comme la ligne UHPC ci-dessous).
    id: 'concrete_nano_vhsc',
    label: 'Nano-beton [VHSC]',
    nt: 'IV',
    family: 'concrete',
    substrate: [122, 125, 127],
    dark: [70, 74, 76],
    light: [178, 182, 184],
    rust: false,
    roughness: 0.62,
    metalness: 0.05,
  },
  {
    // GT_MATERIAUX.md NT IV : "C'est du béton armé [UHPC] auquel on a ajouté du Cylast" --
    // le Cylast est décrit comme des trichites "sans défaut constituées en assemblant les atomes
    // en une matrice parfaite" (§ Hypertechnologie, NT III) : une matrice atomique parfaite
    // assemblée en fibres est une description de structure cristalline, pas une métaphore de ma
    // part -- d'où le bruit cellulaire (facettes à bords nets) plutôt qu'un simple réglage de
    // grain comme pour l'UHPC (§ commentaire ci-dessus).
    id: 'concrete_hyper_uhpc',
    label: 'Hyper-beton [UHPC]',
    nt: 'IV',
    family: 'concrete',
    substrate: [130, 134, 138],
    dark: [68, 72, 78],
    light: [196, 200, 208],
    rust: false,
    roughness: 0.58,
    metalness: 0.05,
  },
  {
    // GT_MATERIAUX.md NT V : "C'est du béton armé [UHPC] auquel on a appliqué la technologie
    // moléculaire" -- la suite logique du NT IV, pas un virage : même structure cristalline
    // (même bruit cellulaire), mais la matrice moléculaire va jusqu'au bout de la "matrice
    // parfaite" du Cylast -- les facettes et leurs arêtes se fondent, polies jusqu'à devenir
    // invisibles (coefficients très réduits dans la branche visuelle, pas un nouvel algorithme).
    // Teinte qui bascule du gris industriel vers un blanc froid presque porcelaine -- NT V est
    // l'ancre « Citadelle » (dissimule sa fabrication), pas une suite grise de plus.
    id: 'concrete_nano_uhpc',
    label: 'Nano-beton [UHPC]',
    nt: 'V',
    family: 'concrete',
    substrate: [200, 204, 210],
    dark: [150, 155, 162],
    light: [235, 238, 242],
    rust: false,
    roughness: 0.28,
    metalness: 0.1,
  },
  {
    // AUCUN texte GT au-delà du NT V pour le béton -- extrapolation explicite demandée par Saar
    // (2026-10-07), pas une entrée canon : à ce palier le GT n'évolue plus les matériaux connus,
    // il introduit des substances uniques (ACS, Fusion B, Pulsar...). Thème retenu : la matrice
    // moléculaire du NT V est poussée jusqu'à piéger la lumière dans sa structure plutôt que de
    // la réfléchir -- même principe géométrique que le Vantablack réel (la lumière entre dans la
    // structure et n'en ressort jamais), PAS un noir brillant : rugosité haute, quasi aucun
    // reflet spéculaire (recherche faite avant §21 miniatures -- un noir qui "avale" la lumière
    // doit être mat, un noir brillant se lit comme du plastique mouillé).
    id: 'concrete_nt7_absorbant',
    label: 'Beton [matrice absorbante] (experimental)',
    nt: 'VII',
    family: 'concrete',
    // Champ structuré (en plus du libellé, seul signal visible tant que le regroupement par NT
    // n'est pas câblé dans l'UI) : permettra plus tard de filtrer/badger sans reparser le texte.
    experimental: true,
    substrate: [14, 15, 18],
    dark: [6, 7, 9],
    light: [26, 28, 33],
    rust: false,
    roughness: 0.94,
    metalness: 0.02,
  },
  {
    // NT II. "Tres cassantes... toujours utilisees par-dessus ou combinees avec un materiau...
    // resistance a la chaleur jusqu'a 2500 C." Dielectrique (metalness 0) contrairement a tout ce
    // qui precede -- glacure satinee claire, PAS un metal. `family: 'plated'` (voir materialBase) :
    // larges plaques cellulaires + frontiere craquelee -- partagee avec les composites sandwich
    // acier/ceramique/acier et tungstene/WC ci-dessous (meme principe de "coeur different revele
    // a la jointure"), plateScale/seamColor absents = rendu historique inchange.
    id: 'ceramic_technical',
    label: 'Ceramique technique',
    nt: 'II',
    family: 'plated',
    substrate: [205, 198, 185],
    dark: [165, 160, 148],
    light: [225, 220, 210],
    rust: false,
    roughness: 0.5,
    metalness: 0,
  },
  {
    // NT I. "Tres bonne resistance a la corrosion, souvent utilise par-dessus une structure en
    // acier pour la protéger" -- la patine fait le travail de protection, voir le commentaire de
    // la branche visuelle dans materialBase.
    id: 'bronze',
    label: 'Bronze',
    nt: 'I',
    substrate: [120, 85, 40],
    dark: [70, 48, 20],
    light: [180, 130, 60],
    rust: false,
    roughness: 0.5,
    metalness: 0.48,
  },
  {
    // NT II. "A masse egale, les fibres de carbone offrent une protection qui vaut plus du double
    // de celle de l'acier RHA" -- materiau de choix pour les structures legeres. Gris-noir profond,
    // vernis (roughness bas, metalness modere -- composite, pas un metal pur). `family:
    // 'composite_weave'` : tissage twill partage avec la fibre de verre ci-dessous (GT : "leur
    // utilisation est similaire" aux fibres de carbone) -- seule la couleur change, meme geometrie.
    id: 'composite_carbon',
    label: 'Composite (fibre de carbone/resine epoxy)',
    nt: 'II',
    family: 'composite_weave',
    substrate: [28, 29, 32],
    dark: [14, 15, 17],
    light: [52, 54, 58],
    rust: false,
    roughness: 0.35,
    metalness: 0.18,
  },
  {
    // NT II. "Premiers materiaux de renfort... utilisation similaire [aux fibres de carbone]...
    // densite superieure a celle de la fibre de carbone" -- meme tissage (family partagee), teinte
    // jaune-vert pale caracteristique de la fibre de verre visible a travers la resine epoxy
    // (recherche PBR : fiberglass cloth est translucide jaune-vert, jamais gris-noir comme le
    // carbone), fini un peu moins vernis et non-metallique (pas de sheen carbone).
    id: 'composite_fiberglass',
    label: 'Composite (fibre de verre/resine epoxy)',
    nt: 'II',
    family: 'composite_weave',
    substrate: [168, 166, 128],
    dark: [150, 152, 120],
    light: [215, 214, 180],
    rust: false,
    roughness: 0.42,
    metalness: 0.03,
  },
  {
    // NT II. "Particules de ceramique en carbure de titane incrustees dans une matrice metallique
    // en aluminium" -- pas un sandwich en couches (family 'plated') mais des inclusions dispersees
    // dans une matrice d'aluminium (family 'particulate', voir materialBase) : memes teintes de
    // base que l'aluminium, metalness reduit (la ceramique dispersee casse la reponse metallique
    // continue).
    id: 'composite_al_tic',
    label: 'Composite (Al/TiC)',
    nt: 'II',
    family: 'particulate',
    substrate: [172, 176, 180],
    dark: [96, 100, 104],
    light: [225, 228, 230],
    rust: false,
    roughness: 0.4,
    metalness: 0.65,
  },
  // ─── Alliages structurels NT III-V (GT_MATERIAUX.md, structure cristalline / inclusions) ───
  {
    // NT III. "Acier nano structure afin d'obtenir une structure vitreuse presentant tres peu de
    // defaut... blindage 70% superieur a l'acier RHA." family 'crystal', poids de facette plus
    // doux que les betons NT IV-V (c'est un acier travaille, pas une matrice minerale).
    id: 'super_acier',
    label: 'Super acier',
    nt: 'III',
    family: 'crystal',
    crystalWeight: 0.3,
    crystalEdgeDarken: 0.5,
    substrate: [128, 132, 136],
    dark: [50, 54, 58],
    light: [205, 210, 214],
    rust: false,
    roughness: 0.3,
    metalness: 0.5,
  },
  {
    // NT III. "Structure cristalline tetraedrique triple... tres difficile a produire... excellente
    // protection." Alliage exotique (titane/iridium/chrome/molybdene/vanadium/nickel/tungstene/
    // strontium/erbium) -- teinte gris-sarcelle metallique (pas une couleur neutre de plus),
    // facettes plus marquees que le super acier (structure "tetraedrique triple" explicitement
    // decrite comme complexe).
    id: 'tri_terranium',
    label: 'Tri-terranium',
    nt: 'III',
    family: 'crystal',
    crystalWeight: 0.4,
    crystalEdgeDarken: 0.55,
    substrate: [95, 115, 118],
    dark: [45, 55, 58],
    light: [150, 175, 178],
    rust: false,
    roughness: 0.25,
    metalness: 0.6,
  },
  {
    // NT IV. "Evolution logique du titane structurel... horriblement cher... utilise
    // exclusivement sous forme d'ossature." Aucune texture propre decrite dans le GT -- meme
    // repli brosse que les trempes d'acier (brushFineness/brushContrast), grain plus fin/poli
    // qu'un titane standard (raffinement "nano", pas un nouvel algorithme).
    id: 'nano_titane_structurel',
    label: 'Nano-titane structurel',
    nt: 'IV',
    substrate: [118, 116, 112],
    dark: [52, 50, 48],
    light: [185, 182, 178],
    rust: false,
    roughness: 0.32,
    metalness: 0.82,
    brushFineness: 1.6,
    brushContrast: 0.8,
  },
  {
    // NT V. "Nano-alliage de titane... renforce par des nano-fibres de carbone... materiau de
    // choix des militaires." family 'particulate' : matrice titane + inclusions sombres fines
    // (fibres de carbone a l'echelle nano, densite faible -- threshold bas).
    id: 'armati',
    label: 'ArmaTi',
    nt: 'V',
    family: 'particulate',
    inclusionColor: [25, 24, 22],
    inclusionScale: 30,
    inclusionThreshold: 0.18,
    substrate: [120, 118, 116],
    dark: [55, 52, 50],
    light: [175, 172, 168],
    rust: false,
    roughness: 0.38,
    metalness: 0.75,
  },
  {
    // NT III. "Materiau composite constitue d'un plastique dur et de trichites de titane...
    // densite tres faible (1,2 t/m3)." family 'particulate' : matrice plastique (teintes du
    // preset 'plastic') + inclusions metalliques claires (trichites de titane, contraste
    // inverse des autres particulate -- inclusion plus claire que la matrice, pas plus sombre).
    id: 'plastitane',
    label: 'Plastitane',
    nt: 'III',
    family: 'particulate',
    inclusionColor: [200, 200, 205],
    inclusionScale: 16,
    inclusionThreshold: 0.3,
    substrate: [90, 95, 105],
    dark: [36, 40, 48],
    light: [190, 196, 208],
    rust: false,
    roughness: 0.55,
    metalness: 0.25,
  },
  {
    // NT II. "Aluminium, titane et fibres de carbone/resine epoxy... exclusivement sous forme
    // d'ossature." family 'particulate' : matrice alliage Al+Ti (teinte intermediaire entre les
    // deux presets), inclusions sombres de fibre de carbone.
    id: 'tical',
    label: 'TiCAl',
    nt: 'II',
    family: 'particulate',
    inclusionColor: [20, 20, 22],
    inclusionScale: 26,
    inclusionThreshold: 0.2,
    substrate: [130, 132, 134],
    dark: [75, 76, 78],
    light: [200, 202, 204],
    rust: false,
    roughness: 0.35,
    metalness: 0.72,
  },
  {
    // NT III. "Evolution naturelle du TiCAl dans lequel les fibres de carbone ont ete remplacees
    // par du plastitane." Meme matrice Al+Ti que le TiCAl, inclusions claires (plastitane) au
    // lieu de sombres (carbone) -- la seule chose qui change entre les deux, comme decrit.
    id: 'plastiral',
    label: 'PlasTirAl',
    nt: 'III',
    family: 'particulate',
    inclusionColor: [195, 195, 200],
    inclusionScale: 20,
    inclusionThreshold: 0.25,
    substrate: [130, 132, 134],
    dark: [75, 76, 78],
    light: [200, 202, 204],
    rust: false,
    roughness: 0.4,
    metalness: 0.68,
  },
  {
    // NT IV. "Evolution logique du PlasTirAl dans lequel le plastitane est remplace par des
    // nano-fibres de verre et le titane par du nano-titane... exclusivement sous forme
    // d'ossature." Matrice nano-titane (plus claire/propre que le titane standard), inclusions
    // pale jaune-vert -- meme teinte caracteristique que la fibre de verre (family
    // 'composite_weave' plus haut), coherent entre les deux usages de cette couleur dans le
    // catalogue.
    id: 'fivaltine',
    label: 'Fivaltine',
    nt: 'IV',
    family: 'particulate',
    inclusionColor: [210, 208, 175],
    inclusionScale: 24,
    inclusionThreshold: 0.22,
    substrate: [128, 126, 122],
    dark: [60, 58, 56],
    light: [190, 188, 184],
    rust: false,
    roughness: 0.42,
    metalness: 0.6,
  },
  {
    // NT III. "Nouvel alliage d'aluminium... faconnage par explosion a basse temperature sur un
    // alliage d'aluminium en poudre." Pas de "structure sans defaut" explicite dans le texte
    // (contrairement au super acier/tri-terranium) -- repli brosse comme les trempes d'acier,
    // grain tres fin (consolidation de poudre sous choc = grain beaucoup plus uniforme qu'un
    // aluminium lamine standard), teinte aluminium plus froide/argentee.
    id: 'alliage_al_plus',
    label: 'Alliage Al+',
    nt: 'III',
    substrate: [150, 155, 162],
    dark: [88, 92, 98],
    light: [215, 220, 226],
    rust: false,
    roughness: 0.24,
    metalness: 0.84,
    brushFineness: 2.6,
    brushContrast: 0.5,
  },
  {
    // NT III. "Singulier alliage... cobalt, fer, vanadium, molybdene, nickel, titane, chrome,
    // manganese, aluminium, platine, or, iridium." family 'particulate' : matrice cobalt bleu-
    // argent (alliages de cobalt reels -- type Stellite -- ont ce lustre froid) + inclusions
    // chaudes rares (or/platine/iridium litteralement nommes dans le texte, pas une couleur
    // inventee) -- threshold bas, ce sont des traces, pas une charge massive comme le TiC.
    id: 'alliage_cobalt',
    label: 'Alliage de cobalt',
    nt: 'III',
    family: 'particulate',
    inclusionColor: [195, 165, 90],
    inclusionScale: 28,
    inclusionThreshold: 0.15,
    substrate: [130, 150, 158],
    dark: [70, 85, 95],
    light: [190, 205, 212],
    rust: false,
    roughness: 0.3,
    metalness: 0.78,
  },
  {
    // NT II. "Plaque de ceramique encadree par deux plaques d'acier... identifie sous le nom de
    // 133-cRHA ou 133-cVHS selon le type d'acier." Deux entrees distinctes (meme logique que les
    // 4 trempes d'acier laminé, Saar 2026-10-07) -- ici la variante RHA : teintes acier RHA en
    // surface, coeur ceramique revele a la jointure des plaques (seamColor), family 'plated'
    // avec de grandes plaques (plateScale bas = cellules larges, blindage boulonne, pas des tuiles
    // fines de glacure).
    id: 'composite_133_crha',
    label: 'Composite blindage (133-cRHA)',
    nt: 'II',
    family: 'plated',
    plateScale: 1.5,
    seamColor: [205, 198, 185],
    substrate: [122, 130, 132],
    dark: [46, 52, 55],
    light: [190, 198, 198],
    rust: true,
    roughness: 0.6,
    metalness: 0.4,
  },
  {
    // Variante VHS du meme composite : teintes/trempe plus fine et plus polie (coherent avec
    // steel_vhs ci-dessus), meme coeur ceramique.
    id: 'composite_133_cvhs',
    label: 'Composite blindage (133-cVHS)',
    nt: 'II',
    family: 'plated',
    plateScale: 1.5,
    seamColor: [205, 198, 185],
    substrate: [128, 136, 142],
    dark: [42, 48, 54],
    light: [200, 208, 212],
    rust: true,
    roughness: 0.5,
    metalness: 0.5,
  },
  {
    // NT II. "Plaque de carbure de tungstene encadree par deux plaques d'un alliage de tungstene...
    // identifie sous le nom de 142-cW/WC... le blindage le plus performant qui existe." Meme
    // principe 'plated' que les composites acier/ceramique, teintes tungstene (voir tungsten_alloy
    // plus haut), coeur carbure revele a la jointure plus sombre/dense que l'alliage exterieur.
    id: 'composite_tungsten_wc',
    label: 'Composite blindage (142-cW/WC)',
    nt: 'II',
    family: 'plated',
    plateScale: 1.5,
    seamColor: [40, 42, 46],
    substrate: [58, 60, 64],
    dark: [28, 29, 32],
    light: [92, 95, 100],
    rust: false,
    roughness: 0.45,
    metalness: 0.78,
  },
  // ─── Alliages legers / autres (GT_MATERIAUX.md, pas encore etiquetes NT) ───
  {
    id: 'stainless_steel',
    label: 'Acier inoxydable',
    substrate: [150, 156, 160],
    dark: [70, 76, 82],
    light: [210, 215, 218],
    rust: false,
    roughness: 0.32,
    metalness: 0.85,
  },
  {
    id: 'aluminum',
    label: 'Aluminium',
    substrate: [172, 176, 180],
    dark: [96, 100, 104],
    light: [225, 228, 230],
    rust: false,
    roughness: 0.28,
    metalness: 0.82,
  },
  {
    id: 'titanium',
    label: 'Titane',
    substrate: [120, 118, 116],
    dark: [55, 52, 50],
    light: [175, 172, 168],
    rust: false,
    roughness: 0.42,
    metalness: 0.78,
  },
  {
    id: 'anticorrosion_coating',
    label: 'Revetement anticorrosion',
    substrate: [96, 108, 98],
    dark: [42, 50, 44],
    light: [150, 164, 150],
    rust: false,
    // Revetement = peinture protectrice, pas un metal nu : quasi non-metallique.
    roughness: 0.65,
    metalness: 0.05,
  },
]

const PATTERN_PRESETS = [
  // Les motifs procéduraux dessinés à la main (lignes/cercles) ont été retirés (§14.2, 2026-09-30,
  // Saar : « on peut les dégager ») — les motifs importés ci-dessous (vrai relief) les remplacent
  // tous. 'none' reste : c'est un état (pas de relief), pas un motif à comparer aux autres.
  { id: 'none', label: 'Aucun motif', group: 'Procédural' },

  // ─── Motifs importés (relief réel, PLAN_WORLD_BUILDER_REWORK.md §13) ───
  // Height maps fournies par Saar (ambientCG et équivalents, licence CC0), recadrées 512px, hors
  // dossier SOURCE/ (originaux 1K/4K, jamais servis par le client). `src` = seule différence
  // structurelle avec un motif procédural — voir IMPORTED_PATTERN_SRC plus bas.
  { id: 'img_metal_box_profile', label: 'Tôle profilée (relief réel)', group: 'Métal', src: '/textures/displacement/metal/box_profile_metal_sheet_512.png' },
  { id: 'img_metal_chainmail', label: 'Cotte de mailles (relief réel)', group: 'Métal', src: '/textures/displacement/metal/chainmail_512.png' },
  { id: 'img_metal_corrugated', label: 'Tôle ondulée (relief réel)', group: 'Métal', src: '/textures/displacement/metal/corrugated_iron_512.png' },
  { id: 'img_metal_fence', label: 'Grillage (relief réel)', group: 'Métal', src: '/textures/displacement/metal/fence_512.png' },
  { id: 'img_metal_rust', label: 'Métal rouillé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/metal_rust_512.png' },
  { id: 'img_metal_rusty', label: 'Tôle rouillée 1 (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_512.png' },
  { id: 'img_metal_rusty_02', label: 'Tôle rouillée 2 (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_02_512.png' },
  { id: 'img_metal_rusty_shutter', label: 'Rideau métallique rouillé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_shutter_512.png' },
  { id: 'img_metal_worn_shutter', label: 'Rideau métallique usé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/worn_shutter_512.png' },

  { id: 'img_tiles_black_metal_2', label: 'Tôle noire 1 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/black_metal_2_512.png' },
  { id: 'img_tiles_black_metal_3', label: 'Tôle noire 2 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/black_metal_3_512.png' },
  { id: 'img_tiles_metal_6', label: 'Tôle 6 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_6_512.png' },
  { id: 'img_tiles_grate_rusty', label: 'Grille rouillée (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_grate_rusty_512.png' },
  { id: 'img_tiles_plate_02', label: 'Plaque métallique 2 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_plate_02_512.png' },
  { id: 'img_tiles_plate', label: 'Plaque métallique 1 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_plate_512.png' },
  { id: 'img_tiles_rusty_grid', label: 'Grille rouillée fine (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/rusty_metal_grid_512.png' },

  { id: 'img_concrete_asphalt', label: 'Asphalte (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/asphalt_512.png' },
  { id: 'img_concrete_asphalt_clean', label: 'Asphalte propre (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/clean_asphalt_512.png' },
  { id: 'img_concrete_brushed', label: 'Béton brossé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/brushed_concrete_512.png' },
  { id: 'img_concrete_floor_damaged', label: 'Sol béton endommagé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_floor_damaged_512.png' },
  { id: 'img_concrete_floor_worn', label: 'Sol béton usé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_floor_worn_512.png' },
  { id: 'img_concrete_slab_wall', label: 'Mur en dalles de béton (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_slab_wall_512.png' },
  { id: 'img_concrete_wall', label: 'Mur béton (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_wall_512.png' },
  { id: 'img_concrete_painted', label: 'Béton peint (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/painted_concrete_512.png' },
  { id: 'img_concrete_plastered_wall', label: 'Mur enduit (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/plastered_wall_512.png' },
  { id: 'img_concrete_worn_floor', label: 'Sol béton usé 2 (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/worn_concrete_floor_512.png' },
  { id: 'img_concrete_mossy_plaster', label: 'Mur enduit moussu (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/worn_mossy_plasterwall_512.png' },

  { id: 'img_plaster_1', label: 'Plâtre 1 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_1_512.png' },
  { id: 'img_plaster_2', label: 'Plâtre 2 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_2_512.png' },
  { id: 'img_plaster_3', label: 'Plâtre 3 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_3_512.png' },
  { id: 'img_plaster_3b', label: 'Plâtre 3 — variante (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_3_height-1K.png' },
  { id: 'img_plaster_4', label: 'Plâtre 4 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_4_512.png' },
  { id: 'img_plaster_5', label: 'Plâtre 5 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_5_512.png' },
  { id: 'img_plaster_6', label: 'Plâtre 6 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_6_512.png' },

  { id: 'img_plastic_rubber_tiles', label: 'Dalles caoutchouc (relief réel)', group: 'Plastique/caoutchouc', src: '/textures/displacement/plastic/rubber_tiles_512.png' },
  { id: 'img_plastic_running_track', label: 'Revêtement piste (relief réel)', group: 'Plastique/caoutchouc', src: '/textures/displacement/plastic/running_track_512.png' },
]

const IMPORTED_PATTERN_SRC = Object.fromEntries(
  PATTERN_PRESETS.filter(preset => preset.src).map(preset => [preset.id, preset.src]),
)

// Pas de préchargement massif ici (36 fichiers à chaque chargement de l'app, coûteux et inutile
// pour des motifs non utilisés) — chargement paresseux, déclenché par sampleDisplacementMap() au
// premier échantillonnage réel. Ces deux fonctions permettent à un appelant (SurfaceDungeonScene.jsx)
// de savoir si un motif est prêt et de réagir quand il le devient, sans connaître le mécanisme de
// cache interne à displacementMaps.js.
export function isImportedPatternReady(patternId) {
  const src = IMPORTED_PATTERN_SRC[patternId]
  return !src || isDisplacementMapReady(src)
}

export function onImportedPatternReady(patternId, callback) {
  const src = IMPORTED_PATTERN_SRC[patternId]
  if (!src) return () => {}
  return onDisplacementMapReady(src, callback)
}

export const PROCEDURAL_MATERIAL_PRESETS = MATERIAL_PRESETS
export const PROCEDURAL_PATTERN_PRESETS = PATTERN_PRESETS

// Regroupe les motifs par `group` (ordre de première apparition) pour un <select> en <optgroup> —
// calculé une fois ici plutôt que dans chaque composant qui affiche la liste.
export const PROCEDURAL_PATTERN_GROUPS = (() => {
  const order = []
  const byGroup = new Map()
  for (const preset of PATTERN_PRESETS) {
    const group = preset.group || 'Procédural'
    if (!byGroup.has(group)) {
      byGroup.set(group, [])
      order.push(group)
    }
    byGroup.get(group).push(preset)
  }
  return order.map(group => ({ group, patterns: byGroup.get(group) }))
})()

export const DEFAULT_PROCEDURAL_MATERIAL = {
  label: 'Acier peint - plaques',
  material: 'steel',
  paint: '#6f7f8e',
  pattern: 'metal_panels',
  wear: 35,
  dirt: 25,
  relief: 70,
  realRelief: true,
  categoryLabel: 'Sol',
  seed: 'enclume',
  patternScale: 1,
}

export const DEFAULT_SURFACE_MATERIAL_PRESET = {
  material: DEFAULT_PROCEDURAL_MATERIAL.material,
  paint: DEFAULT_PROCEDURAL_MATERIAL.paint,
  pattern: 'none',
  wear: 0,
  dirt: 0,
  relief: 0,
  realRelief: true,
  seed: DEFAULT_PROCEDURAL_MATERIAL.seed,
  patternScale: 1,
}

// Miniatures de catalogue (PLAN_WORLD_BUILDER_REWORK.md §15.2 pt3) — l'identité visuelle d'un
// preset seul (teinte neutre, aucune usure/crasse), jamais une combinaison matière+motif+teinte
// choisie par l'utilisateur : le jeu de miniatures reste borné aux presets (8 + 37 aujourd'hui),
// jamais combinatoire. Cache par id, génération au premier appel, jamais régénérée ensuite — un
// preset ne change pas à l'exécution (seul un ajout en source change la liste).
const MATERIAL_THUMBNAIL_SIZE = 56
const materialThumbnailCache = new Map()
const patternThumbnailCache = new Map()

// Teinte neutre du projet (DEFAULT_SURFACE_MATERIAL_PRESET), motif 'none' : le motif ne touche
// jamais l'albédo (voir applyPattern/applyImportedPattern, seulement le buffer `height`), donc
// l'identité d'une matière se lit entièrement sur albedoDataUrl, indépendamment du relief.
export function getMaterialThumbnailUrl(materialId) {
  if (materialThumbnailCache.has(materialId)) return materialThumbnailCache.get(materialId)
  const generated = generateProceduralMaterialTexture({
    material: materialId,
    paint: DEFAULT_SURFACE_MATERIAL_PRESET.paint,
    pattern: 'none',
    wear: 0,
    dirt: 0,
    relief: 0,
    size: MATERIAL_THUMBNAIL_SIZE,
  })
  const url = generated.albedoDataUrl
  materialThumbnailCache.set(materialId, url)
  return url
}

// À l'inverse, un motif ne se lit jamais sur l'albédo — seulement sur le buffer `height` (relief).
// heightDataUrl (niveaux de gris) plutôt que normalDataUrl : une normal map encode une direction en
// tangent-space, toujours bleu-violet par construction — illisible en miniature (constat Saar,
// 2026-10-07). La hauteur en niveaux de gris est aussi la convention d'ambientCG (source des motifs
// importés, §14) pour prévisualiser un canal de déplacement.
// Base acier (bruit de fond le plus faible des matières, cf. materialBase) pour isoler la lecture
// du motif de la matière réellement choisie par l'utilisateur ; relief fixe à 50, même valeur que
// SurfaceMaterialEditor applique déjà automatiquement au choix d'un motif réel (§14.2) — à 0 le
// motif ne se voit pas, pas une valeur de miniature inventée à part.
// Pas mis en cache tant que la height map importée n'est pas décodée (§14.1) : le résultat serait
// un relief neutre périmé — l'appelant revient une fois `onImportedPatternReady` déclenché.
export function getPatternThumbnailUrl(patternId) {
  if (patternThumbnailCache.has(patternId)) return patternThumbnailCache.get(patternId)
  const generated = generateProceduralMaterialTexture({
    material: DEFAULT_SURFACE_MATERIAL_PRESET.material,
    paint: DEFAULT_SURFACE_MATERIAL_PRESET.paint,
    pattern: patternId,
    wear: 0,
    dirt: 0,
    relief: patternId === 'none' ? 0 : 50,
    patternScale: 1,
    size: MATERIAL_THUMBNAIL_SIZE,
  })
  const url = generated.heightDataUrl
  if (isImportedPatternReady(patternId)) patternThumbnailCache.set(patternId, url)
  return url
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ]
}

function rgbToCss(rgb, alpha = 1) {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`
}

function paintCoverageFor(material) {
  if (material.family === 'wood') return 0.35
  if (material.family === 'concrete') return 0.45
  // Metal brut (non revetu) : laisse davantage voir la teinte propre du materiau sous la peinture.
  // Fer forge/fonte inclus : matieres anciennes/crues, le plus souvent laissees nues ou rouillees
  // plutot que fraichement peintes (station delabree) -- l'acier lamine/moule (steel/steel_cast)
  // reste au repli par defaut, plus proche d'une plaque de chantier naval peinte.
  if ([
    'stainless_steel', 'aluminum', 'titanium', 'iron_wrought', 'cast_iron', 'gold', 'lead',
    'tungsten_alloy', 'composite_133_crha', 'composite_133_cvhs', 'composite_tungsten_wc',
    'composite_al_tic', 'super_acier', 'tri_terranium', 'nano_titane_structurel', 'armati',
    'tical', 'plastiral', 'fivaltine', 'alliage_al_plus', 'alliage_cobalt',
  ].includes(material.id)) return 0.55
  return 0.78
}

function hexToRgb(value) {
  const hex = String(value || '#ffffff').replace('#', '')
  const full = hex.length === 3
    ? hex.split('').map(c => c + c).join('')
    : hex.padEnd(6, '0').slice(0, 6)
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

function hashString(value) {
  let hash = 2166136261
  const str = String(value)
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function makeRng(seed) {
  let state = hashString(seed) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 4294967296)
  }
}

function hash2(x, y, seed) {
  let h = hashString(seed)
  h ^= Math.imul(Math.floor(x), 374761393)
  h ^= Math.imul(Math.floor(y), 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, y, scale, seed) {
  const sx = x / scale
  const sy = y / scale
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = smoothstep(sx - x0)
  const fy = smoothstep(sy - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

function fractalNoise(x, y, size, seed) {
  const coarse = valueNoise(x, y, Math.max(8, size / 4), `${seed}:coarse`)
  const medium = valueNoise(x, y, Math.max(4, size / 12), `${seed}:medium`)
  const fine = valueNoise(x, y, Math.max(2, size / 32), `${seed}:fine`)
  return coarse * 0.5 + medium * 0.35 + fine * 0.15
}

// Bruit cellulaire (Worley/Voronoi) : un point-germe par cellule de grille (position giguée par
// hash2, déterministe), chaque pixel hérite de la teinte plate de son germe le plus proche (f1) —
// contrairement à fractalNoise (dégradés lisses), ça produit des facettes à bords nets, jamais une
// tache. `edge` (f2-f1, normalisé) approche 0 près d'une frontière de cellule, utile pour assombrir
// les arêtes entre facettes (rainure de cristal) indépendamment de la teinte de la facette elle-même.
function cellularNoise(x, y, scale, seed) {
  const cx = Math.floor(x / scale)
  const cy = Math.floor(y / scale)
  let best = Infinity
  let second = Infinity
  let bestCellX = cx
  let bestCellY = cy
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ncx = cx + ox
      const ncy = cy + oy
      const fx = (ncx + hash2(ncx, ncy, `${seed}:jx`)) * scale
      const fy = (ncy + hash2(ncx, ncy, `${seed}:jy`)) * scale
      const d = Math.hypot(x - fx, y - fy)
      if (d < best) {
        second = best
        best = d
        bestCellX = ncx
        bestCellY = ncy
      } else if (d < second) {
        second = d
      }
    }
  }
  return {
    f1: best / scale,
    edge: (second - best) / scale,
    cellShade: hash2(bestCellX, bestCellY, `${seed}:shade`),
  }
}

// Empreintes circulaires qui se chevauchent — martelage (fer forgé) ou porosité de coulée
// (fonte/acier moulé), même geste à deux échelles différentes (voir presets). Même grille gigue
// que cellularNoise, mais la sortie est une profondeur additive (plusieurs germes proches
// s'accumulent, d'où le chevauchement) plutôt qu'une appartenance à une seule cellule.
function hammeredField(x, y, scale, seed) {
  const cx = Math.floor(x / scale)
  const cy = Math.floor(y / scale)
  let sum = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const ncx = cx + ox
      const ncy = cy + oy
      const fx = (ncx + hash2(ncx, ncy, `${seed}:hx`)) * scale
      const fy = (ncy + hash2(ncx, ncy, `${seed}:hy`)) * scale
      const r = scale * (0.35 + hash2(ncx, ncy, `${seed}:hr`) * 0.3)
      const d = Math.hypot(x - fx, y - fy)
      if (d < r) sum += 1 - smoothstep(d / r)
    }
  }
  return clamp(sum)
}

function materialBase(material, x, y, size, seed) {
  const n = fractalNoise(x, y, size, `${seed}:base`)
  if (material.hammerScale) {
    const hammer = hammeredField(x, y, Math.max(3, size / material.hammerScale), seed)
    const darken = material.hammerDarken ?? 0.3
    const depth = material.hammerDepth ?? 0.08
    const t = clamp(0.42 + n * 0.15 - hammer * darken)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.5 - hammer * depth,
    }
  }

  if (material.family === 'plated') {
    // Texture de frittage/assemblage (poudre ceramique compactee, ou plaques boulonnees pour les
    // composites sandwich) : grain fin uniforme, pas de teinte par cellule comme le beton
    // cristallin (NT IV+, cell.cellShade) -- ici cellularNoise sert a placer de larges tuiles ou
    // plaques (peu de cellules, scale genereux) dont seule la fine frontiere (cell.edge pres de 0)
    // revele le coeur -- craquelure pour la ceramique ("tres cassantes", GT), jointure/liant pour
    // les composites sandwich ci-dessous. plateScale (absent = 3, tuiles ceramique) regle la
    // taille des plaques ; seamColor (absent = gris-noir craquelure) la teinte revelee au joint.
    const scaleDivisor = material.plateScale || 3
    const cell = cellularNoise(x, y, Math.max(size / scaleDivisor, 12), seed)
    const seam = clamp(1 - cell.edge / 0.05)
    const sinter = hash2(x, y, `${seed}:sinter`)
    const t = clamp(0.62 + n * 0.1 + (sinter - 0.5) * 0.06)
    const seamColor = material.seamColor || [38, 36, 32]
    return {
      color: mixColor(mixColor(material.dark, material.light, t), seamColor, seam * 0.7),
      height: 0.5 + (n - 0.5) * 0.02 - seam * 0.015,
    }
  }

  if (material.id === 'bronze') {
    // GT : résistant à la corrosion, souvent utilisé en revêtement protecteur par-dessus l'acier —
    // la patine EST la couche protectrice (vrai en métallurgie), donc elle fait partie de
    // l'identité de base du matériau, pas un effet d'usure à part. Plaques irrégulières (bruit
    // cellulaire, seuil sur cellShade) plutôt qu'une teinte uniforme — recherche faite : la patine
    // réelle forme des taches vert-bleu disparates sur le bronze doré, jamais un voile homogène.
    const patina = cellularNoise(x, y, Math.max(8, size / 5), seed)
    const patinaAmount = clamp((patina.cellShade - 0.35) / 0.3)
    const base = clamp(0.4 + n * 0.25)
    const metalColor = mixColor(material.dark, material.light, base)
    const patinaColor = mixColor([50, 92, 78], [110, 150, 120], base)
    return {
      color: mixColor(metalColor, patinaColor, patinaAmount),
      height: 0.5 + (n - 0.5) * 0.03 - patinaAmount * 0.02,
    }
  }

  if (material.family === 'particulate') {
    // Inclusions dispersees dans une matrice (poudre/trichites/fibres frittees) -- pas un pavage
    // continu (family 'plated') : seuil ponctuel sur cellularNoise.f1 plutot qu'une appartenance
    // de cellule. Partagee entre composite Al/TiC (GT : particules de TiC incrustees dans
    // l'aluminium) et les alliages a inclusions NT III-V ci-dessous (ArmaTi, Plastitane, TiCAl,
    // PlasTirAl, Fivaltine) -- inclusionColor/inclusionScale/inclusionThreshold (absents = valeurs
    // Al/TiC) donnent a chacun sa propre matrice/inclusion sans dupliquer le mecanisme.
    const scale = material.inclusionScale || 22
    const threshold = material.inclusionThreshold ?? 0.22
    const cell = cellularNoise(x, y, Math.max(3, size / scale), seed)
    const inclusion = cell.f1 < threshold ? clamp(1 - cell.f1 / threshold) : 0
    const t = clamp(0.52 + n * 0.14)
    const inclusionColor = material.inclusionColor || [60, 58, 54]
    return {
      color: mixColor(mixColor(material.dark, material.light, t), inclusionColor, inclusion * 0.8),
      height: 0.5 + (n - 0.5) * 0.02 + inclusion * 0.02,
    }
  }

  if (material.family === 'crystal') {
    // Structure cristalline "sans defaut" (Cylast/nanostructuration, GT NT III+) : facettes a
    // bords nets (cellularNoise), meme principe que le beton hyper/nano-UHPC (NT IV-V, branches
    // dediees ci-dessus -- non retouchees, deja validees texte/tests) mais pour des alliages
    // metalliques explicitement decrits comme cristallins (super acier "structure vitreuse",
    // tri-terranium "structure cristalline tetraedrique triple"). crystalWeight/crystalEdgeDarken
    // reglent a quel point les facettes sont marquees -- pas de defaut partage avec le beton
    // (nouvelle famille dediee, substances differentes).
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const edge = clamp(1 - cell.edge / 0.35)
    const weight = material.crystalWeight ?? 0.45
    const edgeDarken = material.crystalEdgeDarken ?? 0.6
    const t = clamp(0.35 + cell.cellShade * weight + n * 0.08)
    const faceted = mixColor(material.dark, material.light, t)
    return {
      color: mixColor(faceted, [20, 22, 26], edge * edgeDarken),
      height: 0.5 + (cell.cellShade - 0.5) * 0.05 - edge * 0.04,
    }
  }

  if (material.family === 'composite_weave') {
    // Approximation d'un tissage twill 2x2 (chevrons diagonaux) : deux diagonales perpendiculaires
    // (diag1 à +45°, diag2 à -45°), dont l'une domine par bloc 2x2 le long de l'axe diagonal —
    // alternance qui donne le motif de brins dessus/dessous, pas une grille basketweave droite.
    // Recherche faite avant de coder (twill 2x2 = motif le plus courant) ; approximation
    // géométrique, pas une reproduction exacte du tissage réel — à ajuster après retour visuel.
    // Partagée entre fibre de carbone et fibre de verre (GT : usage similaire) — seule la couleur
    // du preset change, même géométrie de tissage.
    const weaveScale = Math.max(4, size / 16)
    const diag1 = Math.sin(((x + y) / weaveScale) * Math.PI)
    const diag2 = Math.sin(((x - y) / weaveScale) * Math.PI)
    const blockU = Math.floor((x + y) / (weaveScale * 2))
    const blockV = Math.floor((x - y) / (weaveScale * 2))
    const over = (blockU + blockV) % 2 === 0
    const weave = over ? diag1 : diag2
    const t = clamp(0.4 + weave * 0.13 + n * 0.04)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.5 + weave * 0.02,
    }
  }

  if (material.family === 'wood') {
    // grainFrequency (absent = 16, rendu historique inchange) : partage entre bois generique,
    // bois de charpente (meme essence, meme bruit, autre teinte -- GT ne decrit pas de texture
    // differente) et contreplaque (frequence plus haute = lamelles plus fines et plus repetitives,
    // coherent avec des plis de placage colles plutot qu'une planche massive).
    const freq = material.grainFrequency || 16
    const grain = Math.sin((x / size) * Math.PI * freq + valueNoise(x, y, size / 5, `${seed}:grain`) * 8)
    const t = clamp(0.45 + grain * 0.22 + n * 0.18)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.48 + grain * 0.025 + n * 0.035,
    }
  }

  if (material.id === 'roche') {
    // Pierre naturelle : blotches minerales a basse frequence (fractalNoise elargi) + fines
    // veines sombres isolees (cellularNoise, seuil tres bas sur edge = frontiere rare, pas un
    // pavage continu comme family 'plated') -- recherche PBR (pierre naturelle = variation de
    // teinte marquee par blotch, jamais un grain uniforme comme le beton).
    const blotch = fractalNoise(x * 0.6, y * 0.6, size, `${seed}:blotch`)
    const vein = cellularNoise(x, y, Math.max(10, size / 6), `${seed}:vein`)
    const veinLine = vein.edge < 0.03 ? clamp(1 - vein.edge / 0.03) : 0
    const t = clamp(0.3 + blotch * 0.5 + (n - 0.5) * 0.12)
    return {
      color: mixColor(mixColor(material.dark, material.light, t), [20, 20, 22], veinLine * 0.5),
      height: 0.5 + (blotch - 0.5) * 0.08 - veinLine * 0.02,
    }
  }

  if (material.id === 'brique') {
    // Appareillage en panneresse (running bond) : rangees decalees d'une demi-brique, jointoyees
    // de mortier recessif plus clair -- grille modulo, registre visuel architectural repete, pas
    // une reutilisation d'un bruit organique existant. Teinte par brique (hash sur son index, pas
    // sur x/y continus) pour une variation de cuisson brique a brique, pas un degrade lisse.
    const brickW = Math.max(6, size / 7)
    const brickH = Math.max(3, size / 16)
    const row = Math.floor(y / brickH)
    const rowOffset = (row % 2) * (brickW / 2)
    const bx = (((x + rowOffset) % brickW) + brickW) % brickW
    const by = y % brickH
    const jointW = Math.max(1, brickH * 0.18)
    const isMortar = bx < jointW || bx > brickW - jointW || by < jointW || by > brickH - jointW
    const brickIndex = Math.floor((x + rowOffset) / brickW) + row * 131
    const shade = hash2(brickIndex, row, `${seed}:brick`)
    const t = clamp(0.4 + shade * 0.35 + (n - 0.5) * 0.08)
    return {
      color: isMortar
        ? mixColor([150, 142, 128], [190, 184, 170], n)
        : mixColor(material.dark, material.light, t),
      height: isMortar ? 0.42 : 0.52 + (shade - 0.5) * 0.02,
    }
  }

  if (material.id === 'concrete_nt7_absorbant') {
    // Même continuité cellulaire que le NT V, variation encore plus écrasée — assez pour rester
    // lisible comme une vraie surface 3D sous éclairage (jamais un noir plat à l'écran, qui se
    // lirait comme une texture manquante), jamais assez pour distraire du « ça n'a plus l'air
    // d'un matériau de construction ». La rugosité (preset, 0.94) fait le vrai travail visuel ici.
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const t = clamp(0.5 + cell.cellShade * 0.02 + n * 0.015)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.5 + (cell.cellShade - 0.5) * 0.006,
    }
  }

  if (material.id === 'concrete_nano_vhsc') {
    // GT NT IV : "plus performant que le nano-titane structurel et moins cher... moins resistant...
    // structures non militaires." Continuite de hyper_vhsc ci-dessous, legerement plus raffinee,
    // mais reste grise/industrielle -- contrairement a la lignee UHPC (concrete_nano_uhpc), le GT
    // ne decrit jamais ce beton comme "dissimulant sa fabrication" : pas de bascule vers le blanc
    // porcelaine, juste une facette plus nette que le VHSC de base.
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const edge = clamp(1 - cell.edge / 0.35)
    const t = clamp(0.38 + cell.cellShade * 0.35 + n * 0.08)
    const faceted = mixColor(material.dark, material.light, t)
    return {
      color: mixColor(faceted, [20, 22, 26], edge * 0.45),
      height: 0.5 + (cell.cellShade - 0.5) * 0.045 - edge * 0.035,
    }
  }

  if (material.id === 'concrete_hyper_vhsc') {
    // GT NT III, liste Hypertechnologie : "Hyper beton [VHSC]" -- la ligne VHSC (economique) recoit
    // aussi le Cylast, distincte de la ligne UHPC deja construite (concrete_uhpc/_hyper_uhpc/
    // _nano_uhpc) : gap trouve a la relecture du GT (2026-10-07), le texte nomme les deux lignees
    // separement a partir du NT III. Memes facettes cellulaires, poids plus doux que le
    // concrete_hyper_uhpc -- cette ligne reste la beton "brut/visible", jamais poli jusqu'a
    // dissimuler sa fabrication (ca, c'est la signature propre a la ligne UHPC).
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const edge = clamp(1 - cell.edge / 0.35)
    const t = clamp(0.4 + cell.cellShade * 0.3 + n * 0.08)
    const faceted = mixColor(material.dark, material.light, t)
    return {
      color: mixColor(faceted, [20, 22, 26], edge * 0.4),
      height: 0.5 + (cell.cellShade - 0.5) * 0.04 - edge * 0.03,
    }
  }

  if (material.id === 'concrete_nano_uhpc') {
    // Même structure cellulaire que l'Hyper-béton (continuité NT IV->V, voir commentaire du
    // preset), coefficients écrasés : facettes et arêtes encore présentes dans le calcul mais
    // presque invisibles au rendu — poli jusqu'à dissimuler sa propre fabrication.
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const edgeDarken = clamp(1 - cell.edge / 0.35)
    const t = clamp(0.46 + cell.cellShade * 0.08 + n * 0.04)
    const faceted = mixColor(material.dark, material.light, t)
    return {
      color: mixColor(faceted, [20, 22, 26], edgeDarken * 0.08),
      height: 0.5 + (cell.cellShade - 0.5) * 0.012 - edgeDarken * 0.006,
    }
  }

  if (material.id === 'concrete_hyper_uhpc') {
    // Facettes à bords nets (bruit cellulaire) plutôt qu'un dégradé — voir le commentaire du
    // preset pour la justification tirée du texte (matrice cristalline du Cylast). ~7 facettes
    // par tuile (size/7), densité stable à toute résolution (miniature comme aperçu éditeur).
    const cell = cellularNoise(x, y, Math.max(6, size / 7), seed)
    const edgeDarken = clamp(1 - cell.edge / 0.35)
    const t = clamp(0.35 + cell.cellShade * 0.45 + n * 0.08)
    const faceted = mixColor(material.dark, material.light, t)
    return {
      color: mixColor(faceted, [20, 22, 26], edgeDarken * 0.6),
      height: 0.5 + (cell.cellShade - 0.5) * 0.05 - edgeDarken * 0.04,
    }
  }

  if (material.family === 'concrete') {
    // grainFineness/grainVariance (absents = 1) : un affinage paramétrique du même béton d'un
    // palier NT à l'autre, jamais une formule dupliquée par matériau (cf. commentaire NT III sur
    // le preset) — defaut 1 préserve exactement le rendu VHSC historique (n inchangé, ×0.16 plein).
    const fineness = material.grainFineness || 1
    const variance = material.grainVariance ?? 1
    const grainN = fineness === 1 ? n : fractalNoise(x * fineness, y * fineness, size, `${seed}:base`)
    const t = clamp(0.42 + grainN * 0.32 + (hash2(x, y, `${seed}:speckle`) - 0.5) * 0.16 * variance)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.48 + (grainN - 0.5) * 0.06,
    }
  }

  if (material.id === 'plastic' || material.id === 'anticorrosion_coating') {
    // Peinture/revetement lisse : pas de metal brut sous-jacent, donc pas de stries d'usinage.
    const t = clamp(0.48 + n * 0.16)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.5 + (n - 0.5) * 0.025,
    }
  }

  // brushFineness/brushContrast (absents = 1) : repli par défaut pour les 4 trempes d'acier laminé
  // (RHA/VHS/HY-80/HSLA-100) ci-dessus, affiné par trempe — Saar, 2026-10-07 : la métallurgie réelle
  // ne les distingue pas à l'œil, mais l'objectif du catalogue est la variété visuelle, donc un
  // écart assumé avec le réel plutôt que 4 entrées identiques. Logique retenue (pas arbitraire) :
  // plus dur/trempé -> grain plus fin et plus poli ; plus ductile -> grain plus large et plus mat.
  const fineness = material.brushFineness || 1
  const contrast = material.brushContrast ?? 1
  const brushed = Math.sin((y / size) * Math.PI * 46 * fineness + valueNoise(x, y, size / 8, `${seed}:brushed`) * 3)
  const t = clamp(0.45 + n * 0.22 + brushed * 0.08 * contrast)
  return {
    color: mixColor(material.dark, material.light, t),
    height: 0.5 + brushed * 0.018 * contrast + (n - 0.5) * 0.035,
  }
}

function drawLineHeight(height, size, x1, y1, x2, y2, width, delta) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width - 1))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width + 1))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width - 1))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width + 1))
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = Math.max(0.0001, dx * dx + dy * dy)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / lenSq)
      const px = x1 + dx * t
      const py = y1 + dy * t
      const dist = Math.hypot(x - px, y - py)
      if (dist > width) continue
      const k = 1 - dist / width
      height[y * size + x] += delta * k
    }
  }
}

function drawCircleHeight(height, size, cx, cy, radius, delta) {
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(size - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(size - 1, Math.ceil(cy + radius))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > radius) continue
      const k = 1 - smoothstep(dist / radius)
      height[y * size + x] += delta * k
    }
  }
}

// Motif importé (§14) : échantillonne une vraie height map au lieu de dessiner des lignes/cercles
// à la main — la valeur brute (0..1) est recentrée autour de 0 pour rester compatible avec le
// même buffer `height` que tous les motifs procéduraux (un delta, pas une hauteur absolue).
// `scale` (§18) DIVISE u,v avant l'appel (`sampleDisplacementMap` tuile déjà en modulo) : un facteur
// >1 fait apparaître le motif plus grand (on n'en voit qu'une fraction sur la tuile), <1 le fait
// paraître plus petit/dense (plusieurs répétitions) — sens choisi pour matcher la lecture naturelle
// de « Échelle ×N » (plus grand nombre = motif plus grand), trouvé inversé en testant (Saar, 2026-09-30).
function sampleImportedPatternHeight(src, x, y, size, relief, scale = 1) {
  const raw = sampleDisplacementMap(src, (x / size) / scale, (y / size) / scale)
  return (raw - 0.5) * 0.5 * relief
}

function applyImportedPattern(height, size, src, relief, scale) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      height[y * size + x] += sampleImportedPatternHeight(src, x, y, size, relief, scale)
    }
  }
}

function patternScaleOf(options) {
  const scale = Number(options?.patternScale)
  return scale > 0 ? scale : 1
}

function applyPattern(height, options, size) {
  const relief = clamp(options.relief / 100)
  const importedSrc = IMPORTED_PATTERN_SRC[options.pattern]
  if (importedSrc) {
    applyImportedPattern(height, size, importedSrc, relief, patternScaleOf(options))
  }
}

function lineFalloff(distance, halfWidth) {
  if (distance >= halfWidth) return 0
  return 1 - smoothstep(distance / halfWidth)
}

function mixPixel(data, index, color, amount) {
  const t = clamp(amount)
  data[index] = lerp(data[index], color[0], t)
  data[index + 1] = lerp(data[index + 1], color[1], t)
  data[index + 2] = lerp(data[index + 2], color[2], t)
}

function samplePatternHeight(pattern, x, y, size, relief, scale) {
  const importedSrc = IMPORTED_PATTERN_SRC[pattern]
  if (!importedSrc) return 0
  return sampleImportedPatternHeight(importedSrc, x, y, size, relief, scale)
}

export function makeProceduralMaterialDescriptor(options) {
  return {
    type: 'procedural-material',
    version: 1,
    material: options.material || DEFAULT_PROCEDURAL_MATERIAL.material,
    paint: options.paint || DEFAULT_PROCEDURAL_MATERIAL.paint,
    pattern: options.pattern || DEFAULT_PROCEDURAL_MATERIAL.pattern,
    wear: Number(options.wear) || 0,
    dirt: Number(options.dirt) || 0,
    relief: Number(options.relief) || 0,
    realRelief: options.realRelief !== false,
    seed: options.seed || DEFAULT_PROCEDURAL_MATERIAL.seed,
    patternScale: patternScaleOf(options),
  }
}

export function sampleProceduralMaterialHeight(u, v, options) {
  const descriptor = makeProceduralMaterialDescriptor(options || {})
  const relief = clamp(descriptor.relief / 100)
  if (relief <= 0.001) return 0.5

  const size = 128
  const material = MATERIAL_PRESETS.find(preset => preset.id === descriptor.material) || MATERIAL_PRESETS[0]
  const wrappedU = ((Number(u) || 0) % 1 + 1) % 1
  const wrappedV = ((Number(v) || 0) % 1 + 1) % 1
  const x = wrappedU * size
  const y = wrappedV * size
  const wear = clamp(descriptor.wear / 100)
  const dirt = clamp(descriptor.dirt / 100)
  const seed = `${descriptor.seed}:${material.id}:${descriptor.pattern}:${descriptor.paint}`

  const base = materialBase(material, x, y, size, seed)
  const wearField = fractalNoise(x, y, size, `${seed}:wearmask`)
  const reveal = clamp((wearField - (1 - wear * 0.75)) / Math.max(0.02, wear * 0.75))

  let height = 0.5 + (base.height - 0.5) * relief
  height -= reveal * 0.035 * relief
  height += samplePatternHeight(descriptor.pattern, x, y, size, relief, descriptor.patternScale)
  height += (fractalNoise(x, y, size, `${seed}:real-dirt`) - 0.5) * dirt * relief * 0.035

  return height
}

function applyWear(ctx, height, roughness, material, options, size, seed) {
  const wear = clamp(options.wear / 100)
  if (wear <= 0.01) return
  const rng = makeRng(`${seed}:wear`)
  const scratchCount = Math.round(wear * size * 0.75)

  ctx.save()
  ctx.lineCap = 'round'
  for (let i = 0; i < scratchCount; i += 1) {
    const x = rng() * size
    const y = rng() * size
    const len = size * (0.08 + rng() * 0.35)
    const angle = (rng() - 0.5) * Math.PI * 0.45
    const x2 = x + Math.cos(angle) * len
    const y2 = y + Math.sin(angle) * len
    const width = 0.5 + rng() * Math.max(1, size * 0.006)
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(245, 248, 248, 0.32)' : 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    drawLineHeight(height, size, x, y, x2, y2, width * 2, -0.08 * wear)
    // Une rayure expose le metal nu : plus brillant que la peinture autour.
    drawLineHeight(roughness, size, x, y, x2, y2, width * 2, -0.22 * wear)
  }
  ctx.restore()

  const chipCount = Math.round(wear * 18)
  for (let i = 0; i < chipCount; i += 1) {
    const cx = rng() * size
    const cy = rng() * size
    const r = size * (0.015 + rng() * 0.055) * wear
    ctx.save()
    ctx.fillStyle = rgbToCss(material.substrate, 0.55)
    ctx.beginPath()
    const points = 8
    for (let p = 0; p <= points; p += 1) {
      const a = (p / points) * Math.PI * 2
      const rr = r * (0.65 + rng() * 0.55)
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr
      if (p === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    drawCircleHeight(height, size, cx, cy, r, -0.1 * wear)
    drawCircleHeight(roughness, size, cx, cy, r, -0.2 * wear)
  }

  if (material.rust) {
    const image = ctx.getImageData(0, 0, size, size)
    const data = image.data
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4
        const n = fractalNoise(x, y, size, `${seed}:rust-field`)
        const pores = hash2(x, y, `${seed}:rust-pores`)
        const openPaint = clamp((n - (0.7 - wear * 0.28)) / Math.max(0.08, wear * 0.55))
        const rust = clamp((openPaint * 0.72 + pores * 0.08 - 0.18) * wear)
        if (rust <= 0.01) continue
        mixPixel(data, i, mixColor([72, 28, 12], [185, 88, 30], pores), rust * 0.72)
        height[y * size + x] += rust * 0.03
        // La rouille est mate : elle efface le brillant du metal, meme sous une rayure fraiche.
        roughness[y * size + x] += rust * 0.35
      }
    }
    ctx.putImageData(image, 0, 0)
  }
}

function applyDirt(ctx, height, roughness, options, size, seed) {
  const dirt = clamp(options.dirt / 100)
  if (dirt <= 0.01) return
  const rng = makeRng(`${seed}:dirt`)

  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const edgeDistance = Math.min(x, y, size - x, size - y)
      const edge = lineFalloff(edgeDistance, size * 0.18)
      const field = fractalNoise(x, y, size, `${seed}:grime-field`)
      const patches = clamp((field - 0.36) / 0.48)
      const fine = hash2(x, y, `${seed}:dust-fine`)
      const grime = clamp(dirt * (patches * 0.28 + edge * 0.2 + (fine - 0.5) * 0.07))
      if (grime <= 0.002) continue
      const dust = fine > 0.78
        ? [134, 124, 98]
        : [32, 28, 22]
      mixPixel(data, i, dust, grime * (fine > 0.78 ? 0.35 : 0.58))
      height[y * size + x] -= grime * 0.055
      // La crasse est mate : elle noie le brillant du materiau sous-jacent.
      roughness[y * size + x] += grime * 0.3
    }
  }
  ctx.putImageData(image, 0, 0)

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.lineCap = 'round'
  const streakCount = Math.round(dirt * 9)
  for (let i = 0; i < streakCount; i += 1) {
    const x = rng() * size
    const y = rng() * size * 0.35
    const len = size * (0.18 + rng() * 0.55)
    const width = Math.max(1, size * (0.008 + rng() * 0.018))
    const alpha = 0.08 + dirt * 0.12 * rng()
    ctx.strokeStyle = `rgba(34, 28, 20, ${alpha})`
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + (rng() - 0.5) * size * 0.08, y + len * 0.35, x + (rng() - 0.5) * size * 0.08, y + len * 0.7, x + (rng() - 0.5) * size * 0.05, y + len)
    ctx.stroke()
  }
  ctx.restore()

  const speckles = Math.round(size * size * dirt * 0.003)
  ctx.save()
  for (let i = 0; i < speckles; i += 1) {
    const x = rng() * size
    const y = rng() * size
    const r = 0.35 + rng() * Math.max(0.9, size * 0.004)
    ctx.fillStyle = rng() > 0.35 ? 'rgba(18, 14, 10, 0.18)' : 'rgba(190, 178, 140, 0.12)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function makeNormalMap(height, size, strength) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data
  const scale = clamp(strength / 100, 0, 1) * 5.5

  const sample = (x, y) => {
    const sx = (x + size) % size
    const sy = (y + size) % size
    return height[sy * size + sx]
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * scale
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * scale
      const dz = 1
      const inv = 1 / Math.hypot(dx, dy, dz)
      const i = (y * size + x) * 4
      data[i] = Math.round((dx * inv * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

// Une creuse (arete de plaque, rivet, soudure...) accumule la poussiere/graisse et disperse la
// lumiere plus qu'un plat : meme principe que la normal map (gradient de hauteur), applique a la
// rugosite au lieu de l'orientation. Generique : couvre les 15 motifs sans toucher chacun un par un.
function applyEdgeRoughness(height, roughness, size) {
  const scale = 3.2
  const gain = 0.9
  const maxBoost = 0.4

  const sample = (x, y) => {
    const sx = (x + size) % size
    const sy = (y + size) % size
    return height[sy * size + sx]
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * scale
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * scale
      const magnitude = Math.hypot(dx, dy)
      roughness[y * size + x] += Math.min(maxBoost, magnitude * gain)
    }
  }
}

// Les effets (usure, rouille, salete, aretes) s'additionnent librement pixel par pixel, mais ne
// doivent jamais effacer l'identite du materiau : de l'acier raye reste un metal terne, jamais un
// miroir ; de la rouille reste rugueuse, jamais totalement mate a 1.0. Bande physique bornee autour
// de la rugosite de base plutot qu'un clamp [0,1] brut — sinon l'accumulation d'effets independants
// (constate sur l'Acier : rouille + usure au maximum par defaut) produit des extremes irrealistes.
function clampRoughnessBand(roughness, size, material) {
  const min = material.roughness * 0.5
  const max = Math.min(1, material.roughness + 0.4)
  for (let i = 0; i < size * size; i += 1) {
    roughness[i] = clamp(roughness[i], min, max)
  }
}

function makeRoughnessMap(roughness, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data

  for (let i = 0; i < size * size; i += 1) {
    const v = Math.round(clamp(roughness[i]) * 255)
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

// Meme buffer `height` que la normal map (jamais un second calcul de bruit) : c'est la seule
// matiere premiere du relief geometrique GPU (displacementMap, voir SurfaceDungeonScene.jsx) —
// avant cette fonction, ce relief etait recalcule a la main par sommet (chantier perf motifs,
// Saar, 2026-10-03).
function makeHeightMap(height, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data

  for (let i = 0; i < size * size; i += 1) {
    const v = Math.round(clamp(height[i]) * 255)
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

export function generateProceduralMaterialTexture(options) {
  const size = Math.max(32, Math.min(512, Number(options.size) || 128))
  const material = MATERIAL_PRESETS.find(preset => preset.id === options.material) || MATERIAL_PRESETS[0]
  const paint = hexToRgb(options.paint)
  const wear = clamp(options.wear / 100)
  const seed = `${options.seed || 'enclume'}:${material.id}:${options.pattern}:${options.paint}`
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data
  const height = new Float32Array(size * size)
  const roughness = new Float32Array(size * size).fill(material.roughness)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = materialBase(material, x, y, size, seed)
      const wearField = fractalNoise(x, y, size, `${seed}:wearmask`)
      const reveal = clamp((wearField - (1 - wear * 0.75)) / Math.max(0.02, wear * 0.75))
      const paintCoverage = paintCoverageFor(material)
      let color = mixColor(base.color, paint, paintCoverage)
      color = mixColor(color, base.color, reveal * 0.82)

      const grime = (hash2(x, y, `${seed}:pixel`) - 0.5) * 18
      const i = (y * size + x) * 4
      data[i] = clamp(color[0] + grime, 0, 255)
      data[i + 1] = clamp(color[1] + grime, 0, 255)
      data[i + 2] = clamp(color[2] + grime, 0, 255)
      data[i + 3] = 255
      height[y * size + x] = base.height - reveal * 0.035
      // Le metal expose par l'usure est plus brillant que la peinture qu'il remplace.
      roughness[y * size + x] -= reveal * 0.25
    }
  }

  ctx.putImageData(image, 0, 0)
  applyPattern(height, options, size)
  applyWear(ctx, height, roughness, material, options, size, seed)
  applyDirt(ctx, height, roughness, options, size, seed)
  applyEdgeRoughness(height, roughness, size)
  clampRoughnessBand(roughness, size, material)

  const normalCanvas = makeNormalMap(height, size, options.relief)
  const roughnessCanvas = makeRoughnessMap(roughness, size)
  const heightCanvas = makeHeightMap(height, size)
  let cachedAlbedoUrl = null
  let cachedNormalUrl = null
  let cachedHeightUrl = null

  return {
    // Consommateur scène 3D (SurfaceDungeonScene.jsx) : canvas direct via THREE.CanvasTexture,
    // jamais d'encodage PNG — c'était l'aller-retour toDataURL()+TextureLoader qui coûtait cher
    // à chaque sélection de motif/matériau (chantier perf, Saar, 2026-10-03).
    albedoCanvas: canvas,
    normalCanvas,
    roughnessCanvas,
    heightCanvas,
    // Consommateur MaterialGeneratorTab.jsx (upload de pack de texture, aperçu <img>) : seul lui a
    // besoin d'une chaîne — calculée à la demande et mémoïsée, jamais payée par le chemin scène 3D.
    get albedoDataUrl() {
      return cachedAlbedoUrl ?? (cachedAlbedoUrl = canvas.toDataURL('image/png'))
    },
    get normalDataUrl() {
      return cachedNormalUrl ?? (cachedNormalUrl = normalCanvas.toDataURL('image/png'))
    },
    // Consommateur miniature Motif (SurfaceMaterialEditor.jsx) : niveaux de gris, pas l'encodage
    // tangent-space bleu-violet d'une normal map (illisible en miniature) — même convention
    // qu'ambientCG (source des motifs importés, §14) pour prévisualiser un canal de déplacement.
    get heightDataUrl() {
      return cachedHeightUrl ?? (cachedHeightUrl = heightCanvas.toDataURL('image/png'))
    },
    procedural: makeProceduralMaterialDescriptor(options),
    material,
    pattern: PATTERN_PRESETS.find(pattern => pattern.id === options.pattern) || PATTERN_PRESETS[0],
  }
}
