# PLAN_NUAGE.md — Armes à nuage volumétrique (fumigènes, gaz de combat)

> Rédigé 2026-09-06 (Claude/Saar). Sorti du périmètre de `PLAN_ARMES_SPECIALES.md` (Lot 2 grenades)
> et de `PLAN_AOE.md` (§10) : ces armes ne produisent **pas** une explosion géométrique
> (cercle/cône/rayon) mais un **nuage volumétrique** qui se propage par compartiments. Autorité :
> Livre de Base Polaris > ce PLAN. RAW : `docs/REGLES/REGLES_ARMES_SPECIALES.md` §« Grenades —
> catalogue » + descriptions de gaz ci-dessous.
>
> **Statut : bloqué / non cadré.** Ce document préserve les données identifiées lors de l'audit
> catalogue grenades du 2026-09-06 ; le cadrage complet (geste de lancer, propagation, statuts par
> Tour, dissipation, protections) reste entièrement à faire.

## 1. Périmètre

Lignes `ref_equipment` concernées (catégories `Grenade` et `Capsules`) :

| Ligne | Zone RAW | Dissipation |
|---|---|---|
| Grenade fumigène | ~30 m³ | 15+1D10 Tours de combat |
| Capsule fumigène | ~10 m de diamètre | 2D10 Tours |
| Grenade à gaz — 6 variantes (assommants, décomposants, irritants, neurotoxiques, suffocants, vésicants) | ~30 m³ | courants d'air / vent |
| Capsule gaz — 6 variantes | ~10 m³ | courants d'air / vent |

Lanceurs associés : **Vaporisateur de gaz** (catégorie Lanceur) et **Lance-capsules** (pour les
capsules).

**Hors périmètre de ce PLAN** : les grenades/capsules à **explosion géométrique** (fragmentation,
concussion, incendiaire, assommante, étourdissante, à énergie, sonique ; capsules napalm, explosive,
acide) — elles restent dans `PLAN_ARMES_SPECIALES.md` (moteur `grenade_blast`).

## 2. Ce qui existe déjà et sera réutilisé, jamais dupliqué

- `shared/world/worldEffects.js` — `BUILTIN_WORLD_EFFECTS`, `buildCompartmentPropagationGraph`,
  `propagateEffectThroughCompartments` (déjà utilisés pour `flooded` / inondation, feu).
- Le moteur monde (`WorldSnapshot`) fournit compartiments et régions — autorité de propagation
  (`.claude/rules/world.md`).
- Feu continu : `environmentalHazardService.js#exposeToHazard` + tick automatique à
  `startResolutionPhase` (Fatigue&Dommages Lot 3) — patron d'un statut à effet périodique par Tour,
  à confronter au besoin « Test de Constitution / résistance au Choc par Tour de présence ».

→ Un nuage de gaz/fumée est un **effet monde runtime** posé sur un compartiment puis propagé, pas
une résolution AOE de combat. Ne passe **jamais** par `aoeShapes.js`, `worldSpatialQueryService`,
`socketCombatAoe.js`.

## 3. Descriptions RAW des gaz de combat (verbatim seed `303_ref_equipment_seed.js`)

- **Gaz assommants** : ce genre de gaz force les victimes à effectuer un Test de résistance au Choc
  par Tour de combat, avec un malus dépendant de la puissance du gaz. Ce malus augmente d'1 point
  par Tour passé dans la zone d'effet. Avec un masque à gaz, une tenue NBC ou un équipement isolé,
  on ne risque rien. Retenir sa respiration permet de réduire de moitié l'intensité du gaz.
- **Gaz décomposants** : ces gaz redoutables désagrègent les tissus des êtres vivants, qui se
  décomposent littéralement. La mort est atroce. Le gaz inflige 1D6 points de dommages par Tour de
  combat, +2 points par Tour tant que la victime se trouve dans la zone d'effet. Les dommages sont
  réduits d'1 point par Tour après qu'elle en soit sortie. Les blessures sont semblables à celles
  infligées par le feu.
- **Gaz irritants** : ces gaz irritent les yeux, la peau, etc. Ce sont des gaz utilisés pour
  neutraliser, qui imposent un malus de base de -3 aux actions. À chaque Tour, il faut de plus
  réussir un Test de Constitution, avec un malus dépendant de la puissance du gaz, sous peine de
  subir un malus supplémentaire (et cumulatif avec le précédent) égal au modificateur d'échec. Si
  le personnage sort de la zone d'effet du gaz, ces pénalités sont réduites d'1 point par Tour de
  combat. Avec un masque à gaz, une tenue NBC ou un équipement pressurisé, on ne risque rien.
- **Gaz neurotoxiques** : ces gaz attaquent les nerfs et bloquent l'influx nerveux. Le plus
  souvent, la victime meurt asphyxiée. Toute victime d'un gaz neurotoxique doit réussir un Test de
  Constitution à chaque Tour de combat (avec un malus dépendant de la puissance du gaz) ou perdre 1
  point de Résistance, même si elle est sortie de la zone dangereuse. Pour ne pas mourir, la
  victime doit obtenir une marge de réussite d'au moins 15 à l'un de ses Tests, ou bénéficier d'une
  injection d'atropine (antidote courant contre ce genre de gaz) ET réussir un Test de Chance.
  Seule une tenue pressurisée ou une tenue NBC protège de ce gaz.
- **Gaz suffocants** : les gaz suffocants brûlent l'intérieur des poumons. Ces gaz n'infligent pas
  de dommages directs. À chaque Tour, il faut effectuer un Test de Constitution, avec un malus
  dépendant de la puissance du gaz. En cas d'échec, le personnage perd 1 point de Constitution.
  Pour chaque point perdu, il faut réussir un Test de Chance, sinon la perte est définitive. Si une
  victime sort de la zone d'effet, le malus décroît d'1 point tous les 2 Tours. Si la Constitution
  du personnage tombe à 0, il meurt. Avec un masque à gaz, une tenue NBC ou un équipement isolé, on
  ne risque rien. Retenir sa respiration permet de réduire de moitié les effets du gaz. Sous
  l'effet de ce gaz, toutes les chances de réussite d'un personnage sont réduites de moitié.
- **Gaz vésicants** : les gaz vésicants brûlent la peau, les poumons, les yeux, etc. Ils infligent
  de terribles dommages à l'organisme et provoquent des douleurs atroces. Une victime subit 1D6
  points de Dommages de base par Tour, sur 1D3 Localisations, jusqu'à ce qu'elle soit aspergée
  d'une solution spéciale neutralisant les effets du gaz. Ces dommages augmentent de 1 point par
  Tour tant que la victime n'est pas sortie de la zone d'effet. Si elle survit, les blessures
  infligées sont abominables et sont considérées comme des blessures dues au feu. Pour chaque
  blessure critique à la Tête, il faut effectuer un Test de Chance : sur un échec, les yeux de la
  victime sont détruits. De même, il faut effectuer un Test de Chance pour chaque blessure critique
  au Corps : sur un échec, les poumons sont gravement atteints et la Constitution du personnage est
  réduite de moitié jusqu'à ce qu'il soit soigné dans un hôpital. Une blessure fatale indique que
  la victime a perdu l'usage d'un de ses yeux, et du deuxième si elle rate un jet de chance. De
  plus, sa Résistance est réduite de façon permanente de 1 à 4 points, même après avoir été soignée
  dans un hôpital. Sous l'effet du gaz, toutes les chances de réussite sont réduites de moitié,
  qu'il y ait blessure ou non. De plus, le personnage est presque totalement aveugle. Un personnage
  en tenue NBC ou en armure pressurisée est immunisé contre ce gaz. S'il est uniquement équipé d'un
  masque à gaz, les dommages ne touchent que la peau, ses poumons et ses yeux ne risquant rien.

## 4. Dette de données à nettoyer (dans la migration de ce chantier)

Trois lignes `ref_equipment` de gaz portent une donnée mal placée (erreur de seed d'origine) :

- `Grenade à gaz — Gaz décomposants` : `nation = "1D6/Tour (+2/Tour en zone; -1/Tour hors zone)"`
  (formule de dégât dans une colonne de nation).
- `Grenade à gaz — Gaz vésicants` : `nation = "1D6/Tour ×1D3 Loc (+1/Tour en zone)"`.
- `Grenade à gaz — Gaz assommants` : `damage_h = "Test Résistance au Choc"` (texte dans une colonne
  de formule).

→ Vérifier aussi les lignes `Capsule gaz — *` équivalentes.

## 5. Blocages / questions à trancher au cadrage

- **Geste de lancer** : portée, cible (un point ? un compartiment ?), Test de Coordination comme
  pour une grenade explosive ?
- **Propagation** : le nuage occupe-t-il son volume dès le Tour du lancer, ou se répand-il
  progressivement (m³/Tour) via le graphe de compartiments ?
- **Statuts par Tour** : chaque gaz impose un Test (Constitution / résistance au Choc) par Tour de
  présence, malus souvent croissant — réutiliser l'infra de statut périodique (`burning`) ou une
  nouvelle ?
- **Sortie de zone** : plusieurs gaz ont des effets qui décroissent après la sortie (−1/Tour,
  −1 tous les 2 Tours) — à modéliser.
- **Dissipation** : timer fixe (fumigène : 15+1D10 / 2D10 Tours) vs conditions d'aération (gaz).
- **Protections** : masque à gaz / tenue NBC / tenue pressurisée / équipement isolé — immunité
  totale ou partielle selon le gaz ; « retenir sa respiration » (½ intensité) pour certains.
- **« Puissance du gaz »** : le malus des Tests en dépend — d'où vient cette valeur (par ligne
  catalogue ? choisie par le MJ ?).
