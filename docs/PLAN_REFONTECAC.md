# PLAN_REFONTECAC.md — Constat : le corps-à-corps accuse un retard d'architecture sur le tir

> Document temporaire (Règle 10 `RegleDocumentaire.md`) — plan futur, pas immédiat.
> Origine : trouvé en vérifiant un prérequis du chantier `CHOC1` (`docs/PLAN_CHOC1.md`) — en traçant
> pourquoi une arme sans dégât physique (Choc pur) ferait planter le corps-à-corps, la cause s'est
> révélée plus large qu'un bug isolé.
> **Constat uniquement — aucune solution proposée ici, conformément à la demande de Saar (2026-07-22).
> Aucun code écrit.**

> ~~**🔒 SÉQUENCEMENT ACTÉ (Saar, 2026-07-22)**~~ — **verrou levé (2026-07-22, `docs/EN_COURS.md`
> Item 106).** Le correctif minimal `CHOC1` est codé et **testé en jeu** (tir Flex, CaC Matraque Mao,
> CaC mains nues, CaC Dague neurale Brain — détail `docs/JOURNALTEMP.md` Étape 8). Il a construit
> exactement la fonction unique que cette refonte visait (`getEffectiveMeleeDamage`,
> `server/src/lib/damageService.js`) — §1 de ce document est donc déjà résolu par ce correctif, plus
> seulement absorbé plus tard. **Point encore ouvert, condition littérale de ce verrou non remplie** :
> le correctif n'est **pas encore committé** (worktree encore modifié) — à committer avant de considérer
> `CHOC1` réellement clos au sens de `CLAUDE.md` §5. Cette refonte peut reprendre sa planification (§2/§3
> restent d'actualité : MR déjà câblé depuis, munitions/Charge électrique CaC toujours absentes).

---

## 1. Le principe que le tir applique déjà, et que le CaC n'a jamais reçu

Le code du tir porte un commentaire d'architecture explicite, déjà acté et livré (Chantier 11
Étape 2 Lot A, `docs/PLAN_ARMES_DSL.md`) :

> `damageService.js:30-32` — *"Point de résolution unique du dégât effectif d'une arme... Réutilisé
> par tous les appelants (PNJ immédiat et PJ différé)... jamais une 2ᵉ copie."*

Concrètement : il existe **une seule fonction** (`getEffectiveWeaponDamage`) qui sait calculer le
dégât réel d'une arme à distance (arme + munition chargée + DSL). Tous les chemins d'exécution —
PNJ, joueur, différé ou immédiat — appellent cette même fonction. Rien n'est recalculé deux fois.

Le corps-à-corps n'a jamais reçu l'équivalent. Aujourd'hui, la formule de dégât d'une arme de
mêlée est calculée une fois à la Déclaration (`resolveMeleeAction`), puis **relancée en dés
indépendamment à deux endroits différents** selon qui attaque :
- `confirmMeleeDefense` (PNJ attaquant, résolution immédiate, ligne ~684).
- `confirmDamage` (PJ attaquant, résolution différée après clic joueur, branche `pendingType ===
  'melee'`, ligne ~795).

Aucun des deux ne passe par une fonction commune — chacun fait son propre `parseDice(...)` sur une
simple chaîne de caractères transportée depuis la Déclaration. C'est cette duplication qui a permis
au bug du prérequis `CHOC1` d'exister à 3 endroits au lieu d'un seul (voir `docs/JOURNALTEMP.md`,
détail complet) : la cause profonde n'est pas "le Choc est mal géré", c'est "le corps-à-corps n'a
pas de point de résolution unique pour le dégât d'une arme".

---

## 2. Ce n'est pas un cas isolé — le CaC a déjà trainé derrière le tir par le passé

Deux commentaires trouvés dans le code confirment que ce n'est pas la première fois :

- `socketCombatHelpers.js` (dans `confirmMeleeDefense` et `confirmDamage`) — *"MELEE-MR —
  Dommages_Bruts = Arme + MR + ModDom(FOR) (`docs/BUGIDENTIFIE.md`, `MANUELSYSCOMBAT` §6.2) : même
  table `mrTable`/`getModifier` que le pipeline Assaut, **jamais câblée côté CaC jusqu'ici**."**
  Le modificateur de Marge de Réussite existait déjà pour le tir, absent du CaC pendant un temps —
  corrigé comme un bug séparé (cluster Session 166, commit `08eed26`), pas construit en même temps
  que le tir à l'origine.

Le CaC semble donc systématiquement recevoir les mécaniques communes **après** le tir, par
correctifs successifs, plutôt qu'en parallèle. Deux occurrences du même schéma trouvées sans
chercher spécifiquement — possiblement plus, non vérifié (voir §4).

---

## 3. Le suivi des munitions/charges n'est câblé que côté tir, jamais côté CaC

Depuis la migration 178 (`docs/PLAN_CAC_BATTERIE.md`), 19 armes de corps-à-corps/mixtes (Matraque
Mao, Poing choc, Dague neurale Brain, Bâton Ordonnateurs, Électro-fouet...) ont un `caliber` réel
("Charge électrique") et donc un compteur `ammo_remaining` suivi en base, rechargeable comme une
arme à feu.

Vérifié : `ammo_remaining` est bien lu/décompté dans `resolveAssaultAction` (tir — vérification
avant tir via `hasEnoughAmmo`, décompte après) et dans `resolveReloadAction` (recharge, générique
aux deux). **Il n'apparaît nulle part dans `resolveMeleeAction` ni `confirmMeleeDefense`** — aucune
vérification qu'il reste des charges avant de frapper, aucun décompte après. Une Matraque Mao ou une
Dague neurale Brain utilisée au corps-à-corps ne consomme donc jamais sa charge aujourd'hui, alors
que le mécanisme de suivi existe et fonctionne pour ces mêmes armes côté tir/rechargement.

---

## 4. Ce qui n'a pas été vérifié — ne pas présumer que la liste est complète

Cette investigation est partie d'un prérequis précis (`CHOC1`) et n'avait pas pour but un audit
complet du corps-à-corps. Les 3 points ci-dessus sont ceux trouvés en creusant ce prérequis
spécifique — d'autres écarts du même type entre CaC et tir peuvent exister ailleurs et n'ont pas été
cherchés :
- Localisation précise / Viser (COM9) — comportement identique CaC/tir non revérifié ici.
- Modificateurs situationnels (terrain, couverture, multi-adversaires) — non recomparés point par
  point entre les deux pipelines.
- Tout autre mécanisme ajouté côté tir depuis les sprints CaC 1/2 (session 67/68, les plus anciens
  du combat) sans vérification qu'il a été répercuté côté CaC.

---

## 5. Portée de ce document

Aucune urgence posée ici — le corps-à-corps fonctionne pour les cas déjà testés (armes avec
`damage_h` rempli, ce qui couvre tout l'usage réel actuel). Le prérequis bloquant de `CHOC1` reste
traité à part, dans son propre plan, avec un scope minimal (voir `docs/PLAN_CHOC1.md` et
`docs/JOURNALTEMP.md`). Ce document sert à ne pas perdre le constat plus large une fois `CHOC1`
refermé — décision de lancer une refonte, et son scope exact, à trancher plus tard avec Saar.
