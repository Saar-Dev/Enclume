# PLAN_PLACEMENT_TOKEN_MJ.md — Placement de token MJ non validé (hors combat)

> **CLOS 2026-09-23** — codé, validé en jeu réel par Saar. Fait durable intégré à
> `docs/SYSTEME/MOTEUR_MONDE.md` §7. Archivé ici pour valeur historique (root cause, décision
> produit écartée et pourquoi) — plus la source de vérité courante.
>
> **Ne pas confondre avec `docs/Old/PLAN_BLOCAGE_CASES_OCCUPEES.md`** (chantier différent, déjà
> clos le 2026-09-18) : celui-ci empêchait de poser une ENTITÉ (caisse/meuble, éditeur) sur une
> case déjà occupée. Celui-ci corrige le placement de TOKEN par le MJ (drag&drop en jeu, via
> `/teleport`). Sujets voisins, causes et correctifs entièrement indépendants — l'ancien fichier a
> été écrasé par erreur pendant la rédaction de celui-ci (même nom de fichier choisi sans vérifier
> `docs/Old/`), restauré depuis git avant tout dégât, ce fichier renommé pour éviter la collision.

## Origine

Trouvé en testant le déplacement combat (`docs/Old/PLAN_DRONE.md`, session du 2026-09-22, voir
aussi mémoire projet `project_combat_window_drag_handle` Round 7) : Saar signale que des tokens se
retrouvent placés hors-grille hors combat, ce qui fait ensuite « galérer » le pathfinding. Root cause
identifiée par lecture directe du code, pas supposée.

## Root cause [VÉRIFIÉ code]

`Canvas3D.jsx:1291` et `Canvas2D.jsx:275` : **tout** drag&drop de token par le MJ (`isGm ===
true`) passait par `POST /tokens/:id/teleport` :

```js
const res = isGm
  ? await api.post(`/tokens/${token.id}/teleport`, { destination })
  : await api.post(`/battlemaps/${battlemapId}/world-move`, { token_id: token.id, destination, gait: 'moyenne' })
```

`/tokens/:id/teleport` (`server/src/routes/tokens.js:107-160`) est un **bypass spatial explicite**,
documenté comme tel dans son propre commentaire (« réservé au MJ », « sert aussi à placer
volontairement un ancien token dans l'espace world-feet »). Il écrit `pos_x/pos_y/pos_z` bruts en
base sans passer par le moteur monde : ni snap au graphe de navigation, ni `canOccupy`. Seul le
joueur (`isGm === false`) passait par `/world-move`, qui appelle `executeBattlemapTokenMovement` →
`planWorldPath` → pathfinding + occupation validés.

Conséquence : comme les tests se font depuis le compte MJ, **chaque déplacement hors combat
échappait totalement au moteur monde**, par construction, pas par accident ponctuel. `/teleport` a
été conçu comme une échappatoire explicite pour des cas rares (replacer un token legacy, poser
derrière un mur verrouillé) mais était devenu le chemin par défaut de tout drag normal.

## Décision produit (Saar, 2026-09-22)

Proposition initiale de Saar : un mode persistant à 3 états (« tout permis » / « MJ restreint » /
« Mode Joueur »), togglé par commande chat, défaut sur « MJ restreint ». **Écartée après analyse
critique**, retenue à la place — accord explicite de Saar (« d'un point de vue design tu as
totalement raison ») :

- **Un état persistant togglé par commande est un risque connu et déjà vécu le même jour** (le bug
  d'arbitrage ambiant pilote/drone télépiloté, `project_combat_window_drag_handle` Round 7 — un
  état qui reste actif après que le contexte a changé, parce que rien ne force à y repenser). Le
  MJ pourrait basculer en « tout permis » pour un placement spécial, oublier de rebasculer, et
  retrouver le même symptôme sur un drag banal ensuite.
- **Alternative retenue** : pas de mode, un geste explicite **par action**. Patron standard chez
  les éditeurs pro (snap par défaut, touche modificatrice tenue pour forcer le placement libre
  ponctuellement — Photoshop/Illustrator, éditeurs de niveau de jeu). Le bypass reste disponible à
  tout moment sans jamais avoir besoin de se souvenir d'un état.
- Le 3ᵉ état proposé par Saar (« Mode Joueur », le MJ se restreint à ses propres tokens) est un axe
  orthogonal (ownership, pas validation spatiale) — **hors périmètre de ce plan**, à cadrer
  séparément si le besoin est confirmé.
- **Clarification finale de Saar après implémentation** : le MJ garde le pouvoir total de poser un
  token n'importe où sans restriction (via `Shift`) — le changement ne porte que sur le
  **défaut** (sans `Shift`), jamais sur les capacités du MJ elles-mêmes. Confirmé comme l'intention
  correcte.

## Design retenu (codé)

**Défaut** : le drag&drop MJ passe par un placement **validé mais non contraint par un budget de
mouvement** — réutilise `resolveBattlemapPlacement` (`worldMovementService.js:148-159`, déjà
utilisé à la création de token, `tokens.js:64`) : snap au point libre le plus proche via le graphe
de navigation + `canOccupy`, sans exiger que la destination soit à portée d'allure (le MJ ne
« marche » pas, il pose). Retourne `null` (destination invalide) si aucune surface libre proche —
le client annule alors le drop plutôt que d'écrire une position bloquée.

**Bypass explicite** : `Shift` tenue pendant le drop envoie directement `/teleport` comme avant —
comportement et capacités MJ inchangés, juste devenu un geste conscient au lieu du défaut
silencieux. Vérifié avant codage : grep exhaustif de `Canvas3D.jsx`/`Canvas2D.jsx` — aucune
occurrence de `altKey`/`shiftKey`/`ctrlKey`/`metaKey` nulle part ; `MapControls` (caméra) n'utilise
aucun modificateur clavier (`mouseButtons:{LEFT:null, MIDDLE:ROTATE, RIGHT:PAN}`,
`listenToKeyEvents` ne lie que les flèches). `Shift` libre à tous les niveaux — retenu plutôt
qu'`Alt` (effets de bord potentiels navigateur/OS sur la touche Alt seule).

**Cohérence vérifiée avec l'existant** : `/world-move` (déjà validé pour le joueur, jamais touché
par ce plan) ne dérive pas non plus `actorProfile` depuis la taille réelle du token/character — il
utilise le même profil générique par défaut partout. Le nouveau `/place` fait pareil — cohérent
avec le système déjà validé, pas une nouvelle incohérence introduite.

## Fichiers touchés (codés)

- **Serveur** (`server/src/routes/tokens.js`) : nouvelle route `POST /api/tokens/:id/place` —
  sœur directe de `POST /api/tokens/:id/teleport` (même fichier, même montage de routeur :
  `tokens.js` est monté deux fois dans `server/src/index.js:121-122`, `/api/battlemaps/:id/tokens`
  pour la création ET `/api/tokens` pour `/:id`/`/:id/teleport` — `/:id/place` rejoint ce second
  montage). Appelle `resolveBattlemapPlacement`, écrit la position dans une transaction avec
  verrous (`forUpdate`), resynchronise l'état passager d'ascenseur via `syncTokenElevatorPassenger`
  (même primitive que `executeBattlemapTokenMovement`, plus correct que le détachement brutal de
  `/teleport` — un placement validé peut légitimement atterrir sur une cabine). GM-only (même garde
  que `/teleport`).
- **Client** (`Canvas3D.jsx`/`Canvas2D.jsx`, `handlePointerUp`) : bascule sur `e.shiftKey` entre
  `/tokens/:id/place` (défaut) et `/tokens/:id/teleport` (Shift tenue).

## Invariant

Le serveur reste seule autorité sur la validité d'une position (`canOccupy`, graphe de navigation)
— aucune règle de placement dupliquée côté client. `/teleport` reste un bypass **réservé au MJ**,
inchangé dans son fonctionnement et ses capacités, seulement moins souvent le chemin emprunté par
défaut.

## Hors périmètre

- « Mode Joueur » (restriction d'ownership) — axe séparé, non cadré ici.
- Le point 2 du même fil (forme de collision des entités, `docs/PLANS/PLAN_FORME_COLLISION_ENTITES.md`)
  — bug indépendant, trouvé dans la même session mais sans dépendance technique avec celui-ci.

## Validation

**Testé** : `node --check` serveur propre, `eslint`/`npm run build` client propres (0 nouveau
problème). **Confirmé fonctionnel en jeu réel par Saar (2026-09-23)**.
**Non testé** : aucun scénario ascenseur/cabine exercé en jeu réel (vérifié en conception
uniquement) ; `Canvas2D.jsx` non rejoué en jeu réel (même changement que `Canvas3D.jsx`,
modificateur confirmé libre par grep).
**Données** : aucune migration.
