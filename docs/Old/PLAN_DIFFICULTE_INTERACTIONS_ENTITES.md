# PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md — Difficulté et surcharge MJ des interactions d'entité

> **CLOS 2026-09-18.** L1 (surcharge MJ par instance, `EntityInstancePanel.jsx`) et L2 (bandeau
> Difficulté joueur pendant la visée de Déplacer, `SessionPage.jsx`) codés, validés en jeu réel. L3
> (aperçu MJ à la conception) s'est avéré déjà couvert par le champ ajouté en L1 (« Seuil de
> référence »). L4 (généraliser au-delà de Déplacer) satisfait par construction — la lecture passe
> par `getEffectiveInteractionDifficulty` (`client/src/lib/entityInteractions.js`), générique à toute
> interaction. Décision prise en cours de route (§3) : pas de repli automatique dérivé du
> poids/taille — le MJ règle `difficulty_dc` par défaut au blueprint (atelier `/workshop`, déjà
> possible avant ce chantier, juste jamais fait). Détail durable : `docs/SYSTEME/ENTITES.md`
> §10.1/§10.5. Piège flexbox transférable trouvé et corrigé en cours de route (un composant partagé
> par 3 panneaux empêchait tout défilement) : `docs/SYSTEME/REACT.md` P60.
>
> **Stub — 2026-09-17.** Chantier identifié en clôturant Lot A2 (preuve `move_type`,
> `PLAN_ENTITES_INTERACTIVES_ROADMAP.md`) : le mécanisme de déplacement fonctionne (jet, Test de
> Chance, résolution), mais la Difficulté qu'il applique n'est pas jouable en l'état, et aucune
> interface n'existe pour qu'un MJ la corrige au cas par cas — pour aucune interaction d'entité,
> pas seulement Déplacer. Cadrage détaillé **non commencé**.
>
> **Autorité** : mécanique de jeu (Difficulté de Test) + outillage MJ → `Livre de Base Polaris`
> (silencieux sur ce point précis, cf. §2), `.claude/rules/entities.md`,
> `docs/SYSTEME/ENTITES.md` §10 (interactions runtime).

---

## 1. Déclencheur (2026-09-17)

En testant réellement Déplacer une caisse (Baboulinet, FOR 18 — maximum humain), Saar a obtenu deux
échecs de suite (jets 4 et 10, MR-1 et MR-7) et a posé trois constats, indépendants du code déjà
posé aujourd'hui :

1. **15 % de chances de réussite est trop élevé en difficulté pour une utilisation réelle en jeu**
   (avec l'Attribut maximal humain, sans aucune Difficulté ajoutée).
2. **Cette Difficulté est invisible** — pour le joueur au moment d'agir, et pour le MJ à la
   conception de la carte (aucun affichage du seuil avant de lancer le jet).
3. **Rappel de conception** : la Difficulté que le système pose est censée être un repli
   (« fallback »), le MJ devant pouvoir la corriger au cas par cas — **aucune interface ne le
   permet aujourd'hui**, pour aucune interaction d'entité (pas seulement Déplacer).

## 2. État connu `[VÉRIFIÉ code + RAW transcrite, 2026-09-17]`

- **Le calcul est correct et RAW pour la partie Attribut** : `chancesDeReussite = attributeAN +
  effectiveDifficulty`. `attributeAN` vient de la table RAW p.114 (`docs/REGLES/ATTRIBUTS.md:131-142`,
  reproduite à l'identique dans `shared/polarisUtils.js` `AN_TABLE`) — FOR 18 → AN +3, vérifié par
  calcul direct (`calcAttributeAN`).
- **`effectiveDifficulty` vaut 0 pour les 15 caisses/coffres actuels** —
  `entity.interaction_overrides?.[interactionId]?.difficulty_dc ?? interaction.difficulty_dc ?? 0`
  (`socketEntity.js`) : aucun des deux premiers n'est jamais renseigné, ni dans le manifest ni dans
  une instance. Ce n'est pas une valeur choisie pour représenter le poids d'un objet — c'est une
  absence totale de donnée.
- **RAW ne donne aucune règle de Difficulté de poussée/traction par poids ou taille d'objet** —
  recherche faite sur `docs/REGLES/*.md` et `docs/MANUELS/*.md` (grep « Poussée », « pousser »,
  « poids » : rien de pertinent trouvé). La décision du 2026-07-31 (`docs/Old/PLAN_TEST_CRITIQUE.md`
  Lot 2) porte sur la **formule** (Test d'Attribut seul, sans compétence) — jamais sur la valeur de
  Difficulté à appliquer selon l'objet. Ce silence constitue un écart RAW jamais écrit ni décidé
  (Invariant 5, `AGENTS.md`) — actuellement un défaut à 0 non documenté comme un choix.
- **Aucune interface d'édition n'expose `difficulty_dc`/`interaction_overrides`** — vérifié : le
  panneau d'instance GM (`EntityInstancePanel.jsx`, ouvert via la tranche « Modifier » du menu
  radial) n'a jamais eu de champ pour surcharger la Difficulté d'une interaction précise. La colonne
  `entities.interaction_overrides` (jsonb) existe et est déjà lue par le serveur — seule l'écriture
  côté MJ manque entièrement.
- **Portée du problème** : `effectiveDifficulty` et son absence de surcharge concernent **toutes**
  les interactions d'entité (Ouvrir/Fermer compris, `ENTITY_ACTION_REQUEST`), pas seulement
  Déplacer — Ouvrir/Fermer n'a simplement jamais eu de Test associé jusqu'ici (interaction directe
  sans jet), donc le problème restait invisible.

## 3. Ce que le cadrage devra faire

- **Décider d'une Difficulté par défaut jouable pour Poussée/Traction**, en écrivant la décision
  (RAW étant silencieuse, tout choix est un écart à documenter, jamais un défaut silencieux) —
  uniforme pour commencer, ou dérivée d'une propriété déjà déclarée sur le blueprint (poids/taille) ?
  À trancher avec Saar, pas improvisé ici.
- **Concevoir l'affichage de la Difficulté/du seuil avant le jet**, côté joueur (dans le menu radial
  ou au moment du mode visée) et côté MJ (à la conception/pose de l'entité) — actuellement aucun des
  deux ne voit le seuil avant de s'engager.
- **Concevoir l'interface de surcharge MJ** (`EntityInstancePanel.jsx` ou équivalent) : un champ par
  interaction pour ajuster `difficulty_dc`/`range`/etc. au cas par cas sur une instance précise, sans
  toucher au blueprint partagé par toutes les instances du même modèle. Généraliser à toutes les
  interactions (Ouvrir/Fermer compris), pas seulement Déplacer.
- **Revalider Ouvrir/Fermer à la même occasion** : si une Difficulté leur est un jour associée
  (`skill_id`/`attribute_id` déjà supportés par le schéma), s'assurer que le même défaut d'affichage
  ne s'y reproduit pas.

## 4. Hors périmètre de ce document

Aucune implémentation ici. Ne tranche pas si Poussée/Traction doit un jour recevoir une vraie règle
RAW dédiée (question ouverte, pas contredite ni confirmée) — seulement que son absence actuelle est
un écart non documenté à corriger d'une façon ou d'une autre.
