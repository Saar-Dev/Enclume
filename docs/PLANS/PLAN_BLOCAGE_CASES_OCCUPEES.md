# PLAN_BLOCAGE_CASES_OCCUPEES.md — Empêcher de poser un token sur une case déjà occupée

> **Stub — 2026-09-17.** Chantier identifié en corrigeant l'occupation circulaire de
> `shared/world/spatialIndex.js` (`docs/Old/PLAN_CLIC_3D_UNIFICATION.md`, détour de session — bug
> sans rapport avec ce plan, cf. `docs/JOURNAL8.md` même date). Cadrage détaillé **non commencé** —
> ce document capture le déclencheur et l'état connu, pour que la conversation de cadrage dédiée
> démarre avec un ancrage.
>
> **Autorité** : moteur monde (`.claude/rules/world.md`), aucune règle Polaris directe — question de
> confort d'usage MJ, pas de RAW.

---

## 1. Déclencheur (2026-09-17)

En rejouant le correctif d'occupation circulaire, Saar a trouvé un PNJ (Baboulinet) impossible à
déplacer une seconde fois. Diagnostic confirmé (`actorFootprintsOverlap`, chiffres réels) : **pas un
bug** — le PNJ occupait réellement la même case qu'une caisse (chevauchement circulaire réel, pas un
faux positif de boîte carrée comme le bug corrigé ce jour-là). Constat de Saar : « il faudrait une
mécanique de blocage des cases pour éviter ça » — rien n'empêche aujourd'hui de poser un token sur
une case déjà occupée par une entité ; `canOccupy` n'intervient qu'au moment de calculer un
déplacement, jamais à la pose initiale.

## 2. État connu `[VÉRIFIÉ code, 2026-09-17]`

- `canOccupy`/`actorFootprintsOverlap` (`shared/world/spatialIndex.js`) sont déjà l'autorité de
  collision circulaire correcte — fondation déjà en place, pas à refaire.
- Aucun appelant ne consulte cette autorité au moment de la **pose** d'un token (placement initial
  sur la carte, hors déplacement combat planifié). À confirmer précisément au cadrage : quels flux de
  pose existent (drag MJ, spawn combat, téléportation), lequel(s) devraient être concernés.
- Non vérifié : si un blocage strict à la pose casserait un usage volontaire existant (empiler
  plusieurs tokens sur une même case pour une raison de mise en scène MJ) — à confirmer avec Saar
  avant de coder quoi que ce soit de bloquant.

## 3. Ce que le cadrage devra faire

- Recenser tous les flux de pose de token (pas seulement le déplacement combat déjà couvert par
  `canOccupy`) avant de décider où brancher une vérification.
- Décider du comportement souhaité : refus dur (pose impossible), avertissement MJ (pose autorisée
  avec confirmation), ou correction automatique (snap à la case libre la plus proche) — une décision
  produit, pas une décision technique, à trancher avec Saar avant de coder.
- Réutiliser `canOccupy`/`actorFootprintsOverlap` tels quels comme autorité de test — pas de second
  mécanisme de collision.

## 4. Hors périmètre de ce document

Aucune implémentation ici. Ce stub ferme la boucle de traçabilité (la trouvaille ne reste pas
seulement dans la mémoire de session) sans présumer des choix du cadrage détaillé à venir.
