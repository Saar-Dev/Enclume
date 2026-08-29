---
description: Combat, FSM, actions, portée et contrat spatial avec le moteur monde
paths:
  - "server/src/services/combat*.js"
  - "server/src/services/*Combat*.js"
  - "server/src/routes/combat*.js"
  - "client/src/**/*Combat*.jsx"
  - "client/src/stores/*combat*.js"
  - "shared/**/*combat*.js"
  - "shared/mods/*.js"
  - "shared/weaponModRegistry.js"
  - "server/src/services/weaponModService.js"
  - "server/src/services/modingService.js"
---

# Combat

Lire `docs/REGLES/REGLESYSCOMBAT.md`, `docs/SYSTEME/COMBAT.md` et les règles spécialisées utiles.
Pour les mods d'armes (Lunette, ATI, Mémoire, Projecteur...), lire aussi `docs/SYSTEME/MODING.md`.

## Autorité

- La FSM combat orchestre initiative, compétences, actions, dégâts, armures et états non spatiaux.
- Toute décision spatiale utilise les services `world*` et `movementBudgetService`.
- Phase ANNONCE : les joueurs déclarent l'action qu'ils veulent, y compris une action apparemment
  impossible au moment de la déclaration (portée insuffisante, LOS bloquée...) — ce n'est jamais à
  cette phase de refuser une déclaration pour un motif qui peut changer d'ici la résolution (un
  personnage peut se mettre à portée, se découvrir ou se cacher entre-temps). Seule la phase
  RÉSOLUTION vérifie ce qui est réellement possible, au moment de l'exécution (Décision Saar,
  2026-07-31).
- Le combat ne lit directement ni `surface_data`, ni Three.js, ni `voxel_data`.
- Le client envoie une intention; serveur et FSM décident du résultat et publient l'état accepté.
- Sous verrou, recalculer le mouvement puis distance, portée, LOS, couverture et effets depuis la
  position réellement atteinte.
- `confirmedModifiers` décrit un choix confirmé; il ne devient pas une autorité de portée ou distance.

## Invariants sensibles

- Conserver l'ordre du roster et l'identité des acteurs pendant toutes les transitions.
- Les fusions JSONB sont explicites et ne doivent pas effacer les champs frères.
- Distinguer valeur absente, zéro valide et valeur calculée; ne pas utiliser un test de vérité ambigu.
- Les payloads REST et Socket.IO partagent un schéma stable et incluent les identifiants nécessaires
  à la déduplication et à la reprise.
- Les transitions sont idempotentes sous répétition réseau et refusent les états impossibles.
- Une blessure, armure ou conséquence persistante est écrite dans la transaction prévue avant
  publication aux clients.
- Les erreurs connues ne sont pas conservées comme compatibilité: corriger l'autorité ou la migration.
- Le type d'une arme (Tir vs Corps à corps) vient de `ref_equipment.category === 'Arme de contact'`,
  **jamais** de `fire_mode`: `CC`/`RC`/`RL` sont des modes de tir (`CC` = Coup par Coup), une arme de
  contact n'a aucun `fire_mode`. Autorité partagée humanoïde (`getOwnedHandWeapon`), exo
  (`socketCombatExo`, `PLAN_EXOARMURE.md §16.4`) et drone (`resolveDroneAssaultAction`,
  `useDroneDeclare`). Déduire le CaC de `fire_mode` nul a été un bug côté exo puis côté drone
  (`DRONE-CC-MELEE-MISCLASS`).

## Validation minimale

- Tester chaque transition touchée, refus de droits, répétition, reconnexion et concurrence.
- Tester le transport réel du payload, pas seulement le service isolé.
- Pour mouvement, portée ou cible, ajouter un scénario monde réel avec budget insuffisant et LOS.
