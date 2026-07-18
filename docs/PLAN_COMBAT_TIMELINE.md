# PLAN_COMBAT_TIMELINE.md — Refonte du moteur de tours en timeline à phases (LdB p.212-219)

> Créé : 2026-07-18 (dev/Saar). Statut : **conception complète des 4 Lots (A/B/C/D, §5), chacun analysé
> à charge séparément puis recroisés (§6quinquies) — prêt à démarrer le code du Lot A.** Décidé Option A
> (« des bases saines seront toujours plus pertinentes ») après que la discussion de
> `docs/PLAN_COMBAT_ACTION_QUEUE.md` (prérequis initial pour `docs/PLAN_TIRMULTI.md`, lui-même une
> demande de Saar) a révélé que l'architecture de résolution combat actuelle (liste statique résolue en
> une passe) ne peut pas représenter ce que Saar attend d'une timeline de combat — et que ce qui manque
> recoupe exactement une règle RAW jamais implémentée, « Retarder son Action ».
> **Ce plan est désormais la racine de trois chantiers combat** : lui-même (le moteur), puis
> `docs/PLAN_COMBAT_ACTION_QUEUE.md` (bug réel sur `combat_pending`, absorbé ici, §5 Lot B) et
> `docs/PLAN_TIRMULTI.md` (Tir Multi, en pause en attendant ce moteur, reprend au Lot D) en dépendent
> tous les deux. Seul point encore ouvert : §6 point 5 (mécanisme de secours du Lot B), à trancher au
> moment de coder ce Lot.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md`.

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

### 0.1 RAW réel `[VÉRIFIÉ]` — un seul sous-système cohérent, aujourd'hui à moitié implémenté

Le Livre de Base décrit l'Initiative comme une **échelle de phases** (20 à 1, LdB p.212-219), pas comme
une simple liste triée une fois. Six règles forment un seul sous-système cohérent — les citer ensemble
ici, une seule fois, plutôt que dispersées dans plusieurs plans (autorité unique, `CLAUDE.md` §1.4) :

1. **Déclaration d'intention dans l'ordre croissant d'Initiative** (`REGLESYSCOMBAT.md:56-69`) — les
   personnages les **plus lents déclarent en premier**, ce qui permet aux plus rapides de décider leur
   propre action en connaissance de cause (« réagir en conséquence »). C'est une asymétrie d'information
   intentionnelle, pas un détail cosmétique.
2. **Préparations** (`REGLESYSCOMBAT.md:342-350`) — certaines actions (dégainer, viser) retardent
   l'Action en réduisant l'Initiative du personnage : « l'Action prévue se produira plus tard dans le
   Tour ».
3. **Précipiter son Action** (optionnel, `REGLESYSCOMBAT.md:568-575`) — +3 Initiative immédiat, malus de
   -5 à l'Action en contrepartie.
4. **Retarder son Action** (`REGLESYSCOMBAT.md:554-567`) — texte intégral cité car c'est le cœur de ce
   chantier : *« Un joueur peut retarder l'Action de son personnage. Celui-ci n'agira pas à la phase
   d'action qui correspond à son score d'Initiative, mais plus tard dans le Tour. […] Le personnage peut
   alors agir à n'importe quelle phase d'Action. S'il décide d'agir à la même phase d'action qu'un autre
   personnage qui agit, lui, normalement, son Action est considérée comme prioritaire, et est résolue en
   premier. En revanche, si deux personnages ayant retardé leurs Actions décident d'agir à la même phase,
   ils sont soumis tous deux à la règle normale des Initiatives équivalentes. Un personnage peut retarder
   son Action d'un Tour à l'autre. Dans ce cas, il peut agir dès la première phase d'action du Tour
   suivant, quelle que soit son Initiative. »* — la décision du **moment exact** est prise **en
   réaction**, pas engagée à l'avance : c'est un choix vécu en temps réel pendant la résolution, pas un
   nombre choisi au moment de déclarer.
5. **Initiatives équivalentes** (`REGLESYSCOMBAT.md:66-69`, renvoi p.214) — en cas d'égalité de phase
   entre deux actions « normales » (non retardées), la déclaration (donc l'ordre de résolution) suit
   l'ordre croissant d'Initiative de base.
6. **Attaques multiples** (`REGLESYSCOMBAT.md:604-618`, déjà creusé dans `PLAN_TIRMULTI.md`) — jusqu'à 3
   attaques par Tour, la 1ʳᵉ à la phase d'Initiative de base, chaque suivante 5 points plus tard.
   **Interaction directe avec Retarder/Préparations** `[VÉRIFIÉ]` (`REGLESYSCOMBAT.md:690-706`) : si une
   des attaques est retardée ou précédée d'une Préparation, **toutes les attaques suivantes de la même
   série se décalent d'autant, pour conserver l'intervalle de 5 points** ; une attaque décalée au-delà de
   la phase 1 est **perdue** ; *« le malus aux Tests doit alors être ajusté en fonction du nombre total
   d'Attaques effectuées dans le Tour »* — le malus -5/-7 n'est donc **pas figé à la déclaration**, il se
   recalcule sur le nombre d'attaques réellement exécutées. Ce dernier point règle de fait la question
   D3 de `PLAN_TIRMULTI.md` (formule de coût Initiative) : il n'y a pas de « coût forfaitaire » dans le
   RAW, il y a un **repositionnement réel sur l'échelle de phases**, dont le malus au jet est une
   conséquence dérivée, pas une variable indépendante à calibrer.

### 0.2 Architecture actuelle `[VÉRIFIÉ]` — une liste statique résolue une fois, pas une échelle de phases

- **`combat_roster`** (migration `54_combat.js:19-40`) — `UNIQUE(campaign_id, token_id)`, commentaire
  du schéma : « un participant par token ». Une ligne = un personnage, porte à la fois son identité
  combat (`is_surprised`, `status`) et sa position d'ordre (`initiative`, ajusté par `iniDelta` à la
  déclaration). **Ces deux responsabilités sont aujourd'hui confondues dans la même ligne.**
- **`combat_actions`** — les actions déclarées par un personnage pour son Tour, vidées à chaque
  `endTurn` (PC28). `sequence` ordonne les *catégories* d'action (move/quick/attack), pas des phases
  réelles (`PLAN_TIRMULTI.md` §0.1, déjà vérifié).
- **Résolution** (`socketCombatResolution.js`, `COMBAT_ACTION_CONFIRM`) — parcourt les `slots`
  (= `combat_roster` trié par `initiative` DESC) un par un via `active_slot_idx` ; chaque personnage,
  quand vient son tour, résout **la totalité** de ses actions déclarées d'un coup (y compris ses 2-3
  attaques multiples, en interne, invisibles pour les autres). **Aucune interleaving réelle entre
  personnages différents** — ce n'est pas une échelle de phases parcourue de 20 à 1, c'est une liste de
  personnages parcourue une fois, chacun agissant intégralement à son tour.
- **`CombatTimeline.jsx`** (`client/src/components/CombatTimeline.jsx:36-76`) — dérive ses cartes
  **directement et exclusivement** de `combat_roster` (`key: r-${token_id}`), une carte par ligne. Ne
  peut structurellement pas afficher plusieurs cartes pour un même personnage.
- **`advanceSlot`** (`socketCombatHelpers.js:194-210`) — avance `active_slot_idx`, ne touche jamais
  `combat_state.sub_phase` (qui reste une valeur unique pour toute la campagne, cf.
  `PLAN_COMBAT_ACTION_QUEUE.md` §0.2 — comportement vérifié cohérent, pas un bug en soi, mais une
  contrainte à respecter dans la nouvelle conception).
- **Ce qui n'existe pas du tout** `[VÉRIFIÉ]`, grep exhaustif : aucune trace de « Retarder son Action »
  dans le code (ni event, ni state, ni UI) — mécanique RAW jamais implémentée, confirmée absente comme
  Saar le pressentait.
- **Ordre de déclaration (point 1 ci-dessus) : déjà correctement implémenté** `[VÉRIFIÉ]`
  (`socketCombatAnnouncement.js:98-105`) — guard explicite « LdB p.212 — guard ordre d'annonce : seul le
  slot actuel (`base_ini` ASC) peut déclarer », vérifié à chaque `COMBAT_ACTION_DECLARE` : un personnage
  ne peut déclarer que si tous les personnages plus lents que lui n'ont pas encore déclaré. Rien à
  construire sur ce point, la phase Annonce respecte déjà le RAW.

### 0.3 Ce qui reste sain et ne doit pas être touché

`combatFSM.js` (table de transitions ANNOUNCEMENT/RESOLUTION, `SLOT_ACTIVE`/`AWAITING_DEFENSE`/
`AWAITING_DAMAGE`) reste un bon socle — ses noms d'événements sont déjà génériques (pas spécifiques à un
type d'action). Le bug de collision de clé primaire sur `combat_pending`
(`docs/PLAN_COMBAT_ACTION_QUEUE.md` §0.1, toujours vrai et vérifié) sera réglé comme conséquence
naturelle de ce chantier — une vraie timeline à phases élimine le besoin de la récursion ad hoc qui le
cause, pas besoin de le corriger séparément avant.

---

## 1. Scope tranché

**Inclus** :
- Une échelle de phases réelle par Tour, calculée à la déclaration puis **mutable pendant la
  résolution** (Retarder, décalages en cascade des attaques multiples).
- Chaque action complexe déclarée (CaC, Tir, utilisation d'un élément du décor — précision Saar,
  message précédent) devient sa propre entrée dans cette échelle ; déplacement/rechargement/actions
  simples n'en génèrent pas (déjà la distinction que fait Saar).
- « Retarder son Action » — modèle « bouton Agir maintenant disponible en continu » plutôt qu'un pop-up
  réactif après chaque action d'autrui ou un engagement chiffré à l'avance — fidèle au texte RAW (« pour
  voir comment évoluent les choses », décision prise en réaction, pas engagée par avance). **Couvre les
  PNJ** (Q1, confirmé Saar) — le MJ dispose du même déclencheur pour chacun de ses PNJ, potentiellement
  plusieurs en attente simultanément.
- **Précipiter son Action et les Préparations rejoignent le même modèle d'échelle** (Q4, confirmé
  Saar) — plutôt que de laisser un second mécanisme parallèle (`combat_roster.initiative += iniDelta`)
  coexister avec la nouvelle échelle pour les mêmes décisions de timing, tout ce qui déplace un
  personnage sur l'axe Initiative passe désormais par la même autorité unique (`CLAUDE.md` §1.4).
- **Chaque entrée résolue de l'échelle garde une trace durable de ce qui a changé** (Q3 — état
  avant/après, pas seulement la mutation appliquée) : ne construit pas de fonctionnalité de retour en
  arrière, mais garde la porte ouverte à un futur chantier séparé sans reconstruction a posteriori.
  Coût marginal quasi nul (cette trace est de toute façon nécessaire pour l'affichage de la timeline).
- `CombatTimeline.jsx` : une carte par entrée de l'échelle (pas par personnage), entrelacées par ordre
  de phase réel.
- Contrôle du temps MJ : au minimum ce qui existe déjà (avancer), adapté à la nouvelle échelle.
- Absorbe et referme `docs/PLAN_COMBAT_ACTION_QUEUE.md` (le bug `combat_pending`) et débloque
  `docs/PLAN_TIRMULTI.md` (le Tir Multi devient une déclinaison directe : une attaque de plus = une
  entrée de plus dans l'échelle, même mécanisme que le CaC).
- Ordre de déclaration (plus lents en premier) : **déjà conforme**, rien à construire (§0.2).

**Hors scope, confirmé** :
- « Revenir en arrière dans le temps » — chantier séparé, ultérieur, une fois le moteur avant
  fonctionnel et éprouvé (Q3). Ce plan pose seulement la trace de données qui le rendra possible plus
  tard (ci-dessus), il ne le construit pas.

---

## 2. Terminologie — `docs/VOCABULARY.md`

Aucune entrée existante — à ajouter avant le code (`CLAUDE.md` §2), scope maintenant figé :
- **« Retarder son Action »** (LdB p.218) — définition RAW, modèle « Agir maintenant » retenu (§1).
- **Échelle de phases / timeline de combat** — concept d'architecture (§3/§5 Lot A), à distinguer de
  `combat_roster` (identité/état par personnage, inchangé).
- **Action complexe vs simple** — taxonomie tranchée par le RAW lui-même (§6 point 6) : Déplacement/
  Action gratuite/Action simple courante/Action complexe multi-Tour n'engendrent pas d'entrée ; CaC/Tir
  (mutuellement exclusifs, §6sexies point 5)/décor/grenade en engendrent une chacun.

---

## 3. Architecture proposée

Principe général retenu (séparer l'identité/état par personnage, resté dans `combat_roster`, de
l'ordre de résolution du Tour, porté par une nouvelle échelle d'entrées) — **conception intégralement
détaillée en §5** (schéma concret Lot A, moteur de résolution Lot B, affichage Lot C, contrôle MJ Lot
D), ne pas dupliquer ici (`RegleDocumentaire.md` Règle 2). Cette section reste comme point d'entrée
conceptuel court ; le détail fait foi en §5 et les sous-sections §6bis/6ter/6quater qui l'accompagnent.

---

## 4. Points ouverts — tous tranchés (2026-07-18)

- **Q1 — PNJ concernés par « Retarder son Action » : oui** (confirmé Saar). Voir §1.
- **Q2 — Ordre de déclaration : déjà conforme, vérifié dans le code** (`socketCombatAnnouncement.js:
  98-105`), rien à construire. Voir §0.2.
- **Q3 — Retour en arrière : hors scope de construction, mais la trace de données qui le rendrait
  possible plus tard fait partie de ce plan** (compromis proposé, accepté par Saar). Voir §1.
- **Q4 — Précipiter son Action/Préparations : migrés dans ce chantier**, pas laissés sur l'ancien
  mécanisme (confirmé Saar, motivé par l'autorité unique — éviter deux systèmes parallèles de timing).
  Voir §1.

---

## 5. Lots séquentiels proposés (un seul codé à la fois, validé avant le suivant)

**Lot A — Modèle de données de l'échelle de phases.**

**Schéma concret proposé** (2026-07-18, synthèse du run à vide §6bis) :

`combat_timeline_entries` (nouvelle table) :
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `campaign_id` | uuid FK `campaigns` CASCADE | |
| `turn_number` | integer NOT NULL | Tour de déclaration — permet de filtrer « la file en cours » sans vider la table (§6bis point 5) |
| `token_id` | uuid FK `tokens` CASCADE | qui agit |
| `combat_action_id` | uuid FK `combat_actions` CASCADE | référence, jamais de duplication des données de l'action (§6bis point 1) |
| `declaration_group_id` | uuid NULL | regroupe les entrées d'une même série d'attaques multiples déclarée ensemble — sert au recalcul du malus sur le nombre réel de sœurs non perdues (§6bis point 3) |
| `phase_position` | integer NULL | NULL tant que non positionnée (action retardée en attente, §6bis point 4) ; aucun plafond (Précipiter peut dépasser 20) ; position ≤ 0 → statut `lost` automatique (§6bis point 7) |
| `status` | text NOT NULL, CHECK | `delayed_waiting` (Retarder choisi, en attente d'« Agir maintenant ») / `scheduled` (position connue, en attente de résolution) / `resolved` / `lost` (cible invalide, étourdissement, CaC impossible — §6 point 3 de l'analyse à charge — ou position ≤ 0) / `skipped` (« Passer » cliqué consciemment en fin de Tour — §6 point 2) |
| `resolved_at` | timestamp NULL | |
| `resolution_snapshot` | jsonb NULL | trace durable de ce qui a changé à la résolution (Q3 — état avant/après, pas la mutation seule) |
| `created_at`/`updated_at` | timestamp | |

Index `(campaign_id, turn_number, status)` (construction/lecture de la file en cours) et
`(campaign_id, token_id)` (historique par personnage).

`combat_actions` (existant, additions) :
- `+ turn_number integer NOT NULL` (absent aujourd'hui — nécessaire pour §6bis point 5).
- `endTurn()` (`socketCombatHelpers.js:215-301`) ne supprime plus les lignes (`DELETE` PC28 retiré) —
  clôture du Tour comme aujourd'hui pour le reste des champs, sans destruction ; suppression réelle
  seulement à `COMBAT_START` d'un nouveau combat.
- **Checklist obligatoire (§6sexies point 4)** : au moins 5 sites lisent `combat_actions` filtré sur
  `status: 'pending'` sans aucune borne de Tour (`socketCombatHelpers.js:162-164`,
  `socketCombatResolution.js:87-88/97-98/198-199/208-209`) — à auditer et scoper sur `turn_number` un
  par un (plus tout site non recensé ici), et décider explicitement du sort des lignes encore
  `pending` à la clôture d'un Tour (marquage `skipped` explicite).

**Rôle de `combat_roster` après ce Lot (résolution du point 6, §6bis)** : `base_ini` inchangé, garde
son seul rôle actuel (ordre de déclaration ascendant, §0.2). `initiative` cesse d'être l'autorité de
résolution (rôle repris entièrement par `phase_position` par entrée) mais reste le « budget Initiative
courant » du personnage — continue d'être réduit par les actions qui ne génèrent pas d'entrée (actions
simples/gratuites, §6 point 6) et sert de valeur de départ au calcul de la position d'une nouvelle
entrée complexe. Les deux champs gardent un rôle distinct, aucune autorité dupliquée.

**Portée des entrées — un caractère seulement pour les actions complexes.** Un personnage dont le Tour
ne comporte que des actions simples/gratuites (déplacement, rechargement, observer...) n'a **aucune**
entrée ce Tour — ses actions se résolvent par le mécanisme existant, indépendamment de l'échelle.
Taxonomie complète (§6 point 6) : Déplacement/Action gratuite/Action simple courante/Action complexe
multi-Tour exclus ; CaC/Tir (désormais mutuellement exclusifs, §6sexies point 5)/décor/grenade
génèrent chacun une entrée. Ce n'est pas un oubli : cohérent avec la distinction déjà actée par Saar
entre ce qui mérite une carte dans la timeline et ce qui n'en a pas besoin.

**Construction et découplage** : l'échelle initiale se construit à la fin de la phase ANNONCE (une
fois tous les personnages déclarés, ordre déjà garanti par le guard existant §0.2), à partir de
`combat_actions` tel que déclaré. Découplage explicite de `combat_roster` (qui garde uniquement
l'identité/état combat par personnage, inchangé) et de cette nouvelle échelle (l'ordre de résolution du
Tour). Guard de fin de Tour (§6 point 2) : personnages encore en délai résolus obligatoirement après la
dernière action normale, ordre croissant d'Initiative entre eux.

**Lot B — Résolution serveur sur l'échelle.**
- Remplacer le parcours `combat_roster` trié par `active_slot_idx` par un parcours de l'échelle,
  entrée par entrée. Réutilisation des resolvers existants (`resolveMeleeAction`/`resolveAssaultAction`),
  simplifiés — la récursion ad hoc actuelle (`remainingMeleeActions`) disparaît, remplacée par le
  parcours générique de l'échelle. **Correction post-analyse à charge (§6 point 1) : le bug de collision de
  clé primaire sur `combat_pending` (`docs/PLAN_COMBAT_ACTION_QUEUE.md` §0.1) ne disparaît PAS
  naturellement — il faut toujours livrer la correction de schéma décrite dans ce document (plusieurs
  lignes `type='damage'` possibles par personnage), quel que soit le modèle de résolution, puisque
  l'attente de dégâts d'un tireur PJ n'a jamais été le mécanisme qui causait le blocage.** Ce Lot
  absorbe donc explicitement le contenu technique de `PLAN_COMBAT_ACTION_QUEUE.md` §3, pas seulement son
  bug.
- Insertion « Retarder son Action » : au clic sur « Agir maintenant », l'entrée correspondante s'insère
  au point courant de l'échelle (priorité sur une action « normale » à la même phase, règle des
  Initiatives équivalentes entre deux actions retardées — RAW §0.1 points 4-5).
- Précipiter son Action / Préparations recalculent la position d'une entrée sur l'échelle au lieu de
  muter `combat_roster.initiative` directement.
- **Guard obligatoire (§6sexies point 6)** : *« une Action précipitée ne peut pas être retardée »*
  (`REGLESYSCOMBAT.md:603`) — bloquer « Agir maintenant »/Retarder sur toute entrée déjà marquée
  Précipitée.

**Lot C — `CombatTimeline.jsx` sur la nouvelle échelle. Conception détaillée : §6quater.**
- Le composant et le store combat (`combatStore.js`) consomment l'échelle au lieu de `combat_roster`
  directement — une carte par entrée, entrelacées par position de phase réelle. Phase ANNONCE inchangée.
- « Agir maintenant » = le portrait lui-même (§6 point 7) : zone dédiée « en attente » dans la timeline,
  une carte par personnage en délai (PJ ou PNJ), cliquable directement — pas de composant séparé.
  Permissions : joueur limité à sa propre carte, MJ illimité sur ses PNJ, revalidées côté serveur.
  Clé de carte `entry.id` (pas `token_id`) ; filtrage explicite sur `turn_number = currentTurn`.

**Lot D — Contrôle du temps MJ, puis reprise des chantiers dépendants.**
- **Généralisation de l'outil MJ existant** `[VÉRIFIÉ]` : le bouton « Passer » déjà présent
  (`CombatGmDeclareWindow.jsx:753-760`, émet `WS.COMBAT_SKIP_PLAYER`) et son handler serveur
  (aujourd'hui limité à la phase ANNONCE, `socketCombatAnnouncement.js:491-494`) sont étendus pour
  fonctionner sur n'importe quel sous-état d'attente de la Résolution — même bouton, même événement,
  condition d'affichage élargie côté client (`combat_state.sub_phase` en attente, plus seulement
  Annonce), pas un nouveau composant.
- **Comportement par sous-état** (tranché avec Saar, 2026-07-18) : pour `AWAITING_REACTION_WINDOW`, la
  fenêtre se ferme immédiatement, comme une expiration normale (§6ter point 3). Pour `AWAITING_DEFENSE`/
  `AWAITING_DAMAGE` (un joueur PJ précis ne répond pas), **le serveur lance les dés à sa place — il
  « devient PNJ pour le Tour »** : réutilise tel quel le chemin de résolution automatique déjà existant
  pour les PNJ (même formule, même code), pas un échec arbitraire ni une nouvelle logique de résolution.
- **`docs/PLAN_TIRMULTI.md` redevient un plan actif une fois ce moteur codé** — pas un sous-Lot à
  concevoir ici : le Tir devient un type d'action de plus qui génère des entrées d'échelle, réutilisant
  entièrement A+B+C. D3/D4/D5 de ce plan sont absorbés par cette architecture (cf. son en-tête) ; D8
  n'est pas « répondu par l'architecture » mais rendu sans objet par une **nouvelle règle** ajoutée en
  cours de route (CaC/Tir mutuellement exclusifs à la déclaration, §6sexies point 5) — à répercuter
  explicitement dans `PLAN_TIRMULTI.md` à sa reprise, pas une simple conséquence automatique du moteur.
- **`docs/PLAN_COMBAT_ACTION_QUEUE.md` archivé** dans `docs/Old/` (Règle 10, `RegleDocumentaire.md`)
  une fois le moteur réellement codé et testé — pas une action à faire pendant la conception.

---

## 6. Analyse à charge (2026-07-18, demandée par Saar avant tout code)

Relecture critique du plan, du plus au moins structurant. Le correctif du point 1 est déjà appliqué
en Lot B (§5) ; les autres restent des points à trancher ou à garder en tête pour la conception détaillée
du Lot A, pas encore résolus ici.

1. **Le bug `combat_pending` ne « disparaît » pas avec la nouvelle échelle — corrigé, voir Lot B.**
   Erreur de raisonnement dans la version précédente de ce document : j'avais écrit que le passage à
   l'échelle réglait le bug de collision de clé primaire « naturellement ». Faux — le bug vient du fait
   qu'un tireur PJ peut avoir plusieurs confirmations de dégâts en attente simultanément (D5 de
   `PLAN_TIRMULTI.md`, confirmé), ce qui reste vrai quel que soit le mécanisme qui décide de l'ordre de
   résolution des entrées. La correction de schéma reste nécessaire, indépendamment de l'échelle.
2. **Persistance d'un « Retarder » d'un Tour à l'autre — tranché, écarté du RAW littéral (Saar,
   2026-07-18).** Décision maison, plus simple que le RAW : une action retardée n'est **jamais** reportée
   au Tour suivant. Un personnage en état « action retardée » agit **obligatoirement** après la dernière
   action normale du Tour — s'il ne veut rien faire, il doit cliquer consciemment sur « Passer » (une
   action délibérée, pas un abandon silencieux). S'il y a plusieurs personnages encore en délai à ce
   stade, ils agissent dans l'ordre croissant d'Initiative parmi eux (le plus lent de ce groupe en
   premier, le plus rapide en dernier — cohérent avec le principe « les plus rapides voient plus avant
   d'agir » déjà appliqué à la déclaration, §0.2). Ce choix évite complètement le problème de persistance
   inter-Tour : `endTurn()` n'a rien de spécial à préserver, l'échelle est intégralement résolue avant la
   fin de chaque Tour. Point 2 de cette liste retiré comme risque, à intégrer directement dans la
   conception du Lot A/B (guard de fin de Tour + ordre de résolution du groupe « encore en délai »).
3. **Actions invalidées en cours de résolution — tranché (Saar, 2026-07-18).** Le vrai entrelacement
   introduit ce nouveau cas (cible morte, personnage étourdi entre-temps, corps-à-corps devenu
   impossible) — réponse : **l'action est perdue**, avec un pop-up explicatif au joueur concerné
   (« Vous êtes étourdi », « Cible invalide ») plutôt qu'une tentative de ré-résolution ou de
   retargetage automatique. **Exception pour le tir à distance** : si la cible devient inatteignable
   (déplacée, cachée), le tir a quand même lieu (munitions consommées) et touche qui se trouve sur le
   vecteur de tir à sa place, s'il y a quelqu'un — **déjà en grande partie construit** : le service
   monde (`worldVisibilityService.js:108-121`) calcule déjà la liste des intercepteurs sur le vecteur
   dans tous les cas (ligne bloquée ou non), mais `checkCombatLOS` (`losService.js:39-46`) l'ignore
   aujourd'hui dans la branche « bloqué » et abandonne le tir sans vérifier. Extension ciblée à ajouter
   au Lot B : consulter `visibility.interceptors` aussi dans cette branche, même redirection que le cas
   « interposition » déjà fonctionnel (`losService.js:48-73`, confirmé opérationnel — le message narratif
   « Cible interposée — tir redirigé vers... » et le jet complet contre la tierce personne existent déjà
   tels quels, aucune construction nécessaire pour ce cas précis). Note : le moteur monde ne distingue
   pas « mur bloquant » de « cible hors de portée » (même signal `status:'blocked'`) — sans conséquence
   pratique, un mur qui bloque réellement tout ne laisse remonter aucun intercepteur non plus.
4. **Interaction Retarder + Attaques multiples en cours de série — tranché (Saar, 2026-07-18) :
   impossible.** Une fois qu'une série d'attaques multiples a commencé à se résoudre, retarder une des
   attaques restantes de cette même série n'est pas autorisé. Règle simple, rien à concevoir de plus.
5. **Risque de bascule « tout ou rien » en Lot B — reformulé, réponse à donner par Saar.** Le jour où le
   Lot B est livré, tous les combats de toutes les campagnes basculent d'un coup sur le nouveau moteur de
   résolution — pas de bascule progressive. Si un bug nous échappe en test et se déclenche en pleine
   partie réelle, aucun mécanisme ne permet aujourd'hui de revenir temporairement à l'ancien système
   pendant la correction. Décision à prendre au moment du Lot B : accepter ce risque (test exhaustif
   avant livraison, correction rapide si besoin) ou investir dans un mécanisme de secours explicite (coût
   de travail supplémentaire à mettre en balance). Non tranché à ce stade — reste ouvert jusqu'au Lot B.
6. **Taxonomie des Actions — tranchée par le RAW lui-même** (`REGLESYSCOMBAT.md`, sections « Types
   d'Actions »/« Actions gratuites »/« Actions simples courantes »/« Actions complexes », citées par
   Saar) plutôt qu'inventée pour ce plan :
   - **Déplacement** — n'engendre pas d'entrée d'échelle (déjà exclu, confirmé Saar).
   - **Action de combat** (CaC, Tir) et **usage d'un élément du décor** (ajout Saar, hors nomenclature
     RAW stricte mais listé comme équivalent) — engendrent une entrée chacune.
   - **Action gratuite** (parler, lâcher un objet — RAW : toujours possible, avant/pendant/après une
     Action normale, ne ralentit jamais) — n'engendre pas d'entrée, n'est même pas liée à une phase.
   - **Action simple courante** (recharger, sortir un objet d'un sac, observer, donner des ordres) —
     n'engendre pas d'entrée, cohérent avec l'exclusion déjà actée de « rechargement, etc. ».
   - **Action complexe multi-Tour** (soigner, pirater, réparer — RAW : l'Initiative n'entre même pas en
     compte, sauf interruption pour un vrai Tour de combat) — hors échelle de phases par nature, RAW le
     dit explicitement ; à modéliser comme un état du personnage (« occupé jusqu'à N Tours ou
     interruption »), pas comme une entrée de l'échelle.
   - **Grenade — tranché (Saar, 2026-07-18), génère une entrée.** Inquiétude initiale de Saar (l'Action
     simple serait-elle « gratuite », rendant la grenade abusive à répétition ?) levée par le texte RAW
     lui-même (`docs/REGLES/REGLEBOUCLIER.md:216-226`) : lancer une grenade consomme l'intégralité de
     l'Action du Tour du personnage (Test de Coordination requis), exactement comme n'importe quelle
     autre des Actions listées en « Types d'Actions » (mutuellement exclusives, une seule par Tour) —
     « simple » signifie seulement « tient en un Tour », pas « gratuite/répétable ». La grenade est donc
     fonctionnellement une attaque et suit le même traitement que Tir/CaC/décor. Bonus de conception :
     le RAW prévoit déjà que la grenade « explose au Tour de combat suivant, au rang d'Initiative normal
     du personnage qui l'a lancée » — un cas d'usage naturel du modèle d'échelle (une entrée « lancer »
     ce Tour engendre une seconde entrée « explosion » programmée au Tour suivant), sans mécanisme
     spécial à inventer. Peut aussi compter comme une des 3 attaques d'une série Attaques multiples,
     même malus, aucune règle distincte à écrire.
7. **UX MJ avec plusieurs PNJ en délai simultané — direction validée (Saar, 2026-07-18) : le portrait
   *est* le déclencheur.** Proposition de Saar reprise et affinée : pas de liste/menu séparé, chaque
   personnage en délai (PJ ou PNJ) apparaît comme une carte distincte dans une zone dédiée « en attente »
   de la timeline (pas à une phase fixe, puisque le RAW permet d'agir à n'importe quelle phase future) ;
   cliquer la carte déclenche « Agir maintenant » pour ce personnage précis. Résout nativement le cas de
   plusieurs PNJ en délai simultané (autant de cartes indépendantes, chacune cliquable séparément) sans
   composant UI supplémentaire — réutilise le langage visuel déjà existant de `CombatTimeline.jsx`.
   Permissions : un joueur ne peut cliquer que sa propre carte ; le MJ peut cliquer celle de n'importe
   lequel de ses PNJ. Détail de traitement visuel (grisé/pulsation/icône dédiée) à faire au Lot C.
8. **Concurrence sur la mutation de l'échelle — tranché (Saar, 2026-07-18) : Initiative décroissante (le
   plus rapide agit avant).** Distinct du point 2 (ordre du groupe encore en délai en fin de Tour,
   croissant, plus lent en premier) : ici il s'agit du cas où deux personnages cliquent « Agir
   maintenant » au même instant serveur — départage par la règle déjà connue partout ailleurs dans la
   résolution (le plus rapide gagne, agit en premier), pas une règle spéciale à inventer.
9. **`docs/SYSTEME/COMBAT.md` demandera une réécriture substantielle — confirmé (Saar).**
10. **Stratégie de non-régression sur les fonctionnalités combat existantes à la clôture — confirmé
    (Saar) : « Clairement ».** À formaliser au moment de chaque Lot.

**Conclusion** : les points 1 à 4 et 6 à 10 sont tranchés et intégrés directement dans ce document,
grenade comprise. Il ne reste qu'un point réellement ouvert, et il n'affecte pas le Lot A : le point 5
(mécanisme de secours en Lot B), à trancher au moment de ce Lot. **Rien ne bloque plus le démarrage de
la conception détaillée du Lot A.**

---

## 6bis. Run à vide — conception détaillée du Lot A (2026-07-18)

Réflexion libre demandée par Saar avant d'écrire le schéma. 7 points, tous tranchés :

1. **Une entrée de l'échelle référence `combat_actions` par FK, ne duplique jamais ses données**
   (arme, cible, mode de tir...) — autorité unique, confirmé Saar.
2. **« Retarder » porte sur le Tour entier de l'action déclarée** (simple ou série d'attaques
   multiples), pas sur une attaque individuelle d'une série — confirmé Saar. Conséquence directe : le
   point 4 de l'analyse à charge (§6, « retarder en cours de série impossible ») devient une propriété
   structurelle du modèle, pas une règle à vérifier séparément.
3. **Le malus « Attaques multiples » se recalcule sur le nombre réel d'attaques qui se résolvent
   effectivement, y compris quand la perte vient d'une cible devenue invalide** (pas seulement d'un
   décalage de phase, cas RAW littéral) — confirmé Saar (« les règles de Polaris priment sur mes
   idées/petits arrangements »), pour ne pas créer d'exception à la règle RAW selon la cause de la
   perte. Conséquence : le malus ne peut jamais être figé à la déclaration, il se calcule à la
   résolution de chaque entrée, à partir du compte des entrées sœurs (même groupe de déclaration) non
   perdues à cet instant.
4. **Détails de l'action figés à la déclaration (arme, mode), cible/moment laissés ouverts pour une
   action retardée** — confirmé Saar. L'entrée existe dès la fin de l'Annonce avec un statut « en
   délai, sans position fixée sur l'échelle », comme les autres, mais sans `phase_position` tant que
   « Agir maintenant » n'a pas été déclenché.
5. **Historique complet d'un combat conservé, réinitialisation seulement à `COMBAT_START` d'un nouveau
   combat** — demande Saar, retenue (volume négligeable à l'échelle d'une campagne réelle). **Conflit
   détecté avec le point 1** : `combat_actions` est aujourd'hui intégralement vidée à chaque
   `endTurn()` (`socketCombatHelpers.js:215-301`, PC28) et ne porte aujourd'hui aucune colonne de
   numéro de Tour — conserver l'échelle sans changer ce comportement laisserait des entrées
   historiques pointer vers des lignes détruites. **Correction à intégrer au Lot A** : `combat_actions`
   ET la nouvelle échelle portent toutes deux un `turn_number` ; `endTurn()` ne supprime plus rien
   (clôture le Tour comme aujourd'hui pour le reste des champs, sans `DELETE`) ; la file « en cours »
   se filtre par `turn_number = current_turn` plutôt que par contenu total de la table ; la suppression
   réelle n'intervient qu'à `COMBAT_START` d'un nouveau combat.
6. **`combat_roster.initiative` vs. l'échelle comme autorité de résolution** — Saar délègue la décision
   technique (« pas le niveau pour aider sur ce point »), à trancher au moment d'écrire le schéma
   définitif du Lot A plutôt qu'en discussion.
7. **Pas de plafond sur l'échelle (Précipiter peut dépasser 20), plancher à 0** (position ≤ 0 = entrée
   automatiquement « perdue » dès la construction) — **corrigé en §6sexies point 1** : cette règle ne
   s'applique qu'au cas RAW de décalage d'attaque multiple (§0.1 point 6). Le cas d'une Préparation
   ramenant l'Initiative à 0 ou moins suit désormais la même simplification que « Retarder » (pas de
   report inter-Tour, §6 point 2) plutôt que la règle RAW littérale de report — voir §6sexies point 1
   pour le détail et la justification.

---

## 6ter. Run à vide — conception détaillée du Lot B (2026-07-18)

5 points, tous tranchés (Saar délègue le détail technique des points 1, 2, 4, 5 ; tranche lui-même le
point 3, qui touche au ressenti de jeu) :

1. **Pas de curseur dupliqué.** « Où en est la résolution du Tour » se lit directement dans
   `combat_timeline_entries` (prochaine entrée `scheduled` non résolue, triée `phase_position` DESC) —
   pas de `combat_state.active_slot_idx`-like séparé à synchroniser en plus.
2. **Espacement large des positions dès la construction de l'échelle** (ex. ×100 par rapport à
   l'Initiative brute) pour laisser de la place aux insertions « Agir maintenant » sans avoir besoin
   d'un type décimal.
3. **Fenêtre de réaction courte après chaque entrée résolue — modélisée comme un sous-état propre du
   FSM central, pas comme un minuteur externe.** Confirmé Saar, avec deux corrections issues de
   l'analyse à charge (2026-07-18) :
   - **Correction 1 — orchestrateur unique.** Proposition initiale erronée : réutiliser tel quel
     `startAnnouncementTimers`/`skipPlayer` (`socketCombatHelpers.js:78-94`) aurait recréé le problème
     que tout ce chantier corrige — ce mécanisme est un minuteur en mémoire qui tourne **en dehors** du
     FSM (`combatFSM.js`), une deuxième autorité invisible sur « qui attend quoi ». Correction : un
     nouveau sous-état explicite du FSM (aux côtés de `AWAITING_DEFENSE`/`AWAITING_DAMAGE`), par exemple
     `AWAITING_REACTION_WINDOW` — le minuteur ne sert plus qu'à déclencher l'événement qui fait transiter
     cet état à son expiration, mais c'est le FSM, seul, qui sait et décide qu'on attend. La barre de
     compte à rebours déjà affichée par `CombatTimeline.jsx` (`secondsLeft`, vert→orange→rouge) reste
     réutilisable côté affichage, seule la plomberie serveur change.
   - **Correction 2 — deux mécanismes distincts, jamais de cas hybride.** Pas de « dernière fenêtre plus
     stricte que les autres » : la fenêtre de réaction (`AWAITING_REACTION_WINDOW`, optionnelle, expire
     silencieusement si personne ne clique) s'applique **uniquement tant qu'il reste des entrées
     normales à résoudre**. Dès qu'il n'en reste plus, ce sous-état ne s'applique plus du tout — les
     personnages encore en délai basculent directement sur le mécanisme déjà défini en §6 point 2
     (tour normal, obligatoire, sans minuteur ni expiration silencieuse : agir ou cliquer « Passer »,
     l'un ou l'autre, mais une réponse explicite). Deux sous-états FSM propres et non chevauchants,
     pas une seule mécanique à rendre plus complexe selon le contexte.
   - Uniquement si au moins un personnage est en statut `delayed_waiting` — si personne n'est en délai,
     la résolution continue à pleine vitesse, aucun ralentissement dans le cas normal.
   - **Explicitement écartés** : interrompre une résolution déjà en cours (risque d'état incohérent,
     dés déjà en train d'être lancés) et le retour en arrière (contredirait la trace durable, Q3 — reste
     réservé au chantier séparé et futur).
4. **`resolveMeleeAction`/`resolveAssaultAction` s'allègent.** Plus de `remainingMeleeActions`/
   `totalMeleeCount` en paramètres (le moteur générique de parcours de l'échelle gère l'enchaînement) —
   ces fonctions interrogent `declaration_group_id` pour compter les entrées sœurs non perdues au
   moment de leur propre résolution, seul point nécessaire pour le malus (§6bis point 3).
5. **Correctif `combat_pending`** (déjà conçu dans `docs/PLAN_COMBAT_ACTION_QUEUE.md` §3) intégré tel
   quel à ce Lot, sans reconception : clé primaire propre par ligne, plusieurs entrées `type='damage'`
   possibles par personnage, `melee_defense`/`stun` restent singuliers.

---

## 6quater. Conception détaillée du Lot C (2026-07-18, validée Saar)

Recherche préalable `[VÉRIFIÉ]` : `TimelineCard.jsx` est déjà un composant purement visuel (portrait,
nom, Initiative, drapeaux actif/estompé/onClick), sans notion de roster ni de token unique — réutilisable
tel quel, une instance par entrée plutôt que par personnage. `combatStore.js` porte aujourd'hui `roster`/
`activeSlotIdx`/`activeTokenId`, alimentés par les événements WS existants.

- **Phase ANNONCE inchangée** — continue d'utiliser `roster` exactement comme aujourd'hui, cohérent
  avec §0.2 (ordre de déclaration déjà conforme). Seule la branche RÉSOLUTION de `CombatTimeline.jsx`
  change de source.
- **En RÉSOLUTION, une carte par entrée de l'échelle, pas par personnage.** Nouvelle donnée côté store
  (`timelineEntries`), poussée par le serveur (nouvel événement WS à déclarer dans `shared/events.js`,
  cf. `core.md`) à chaque changement de l'échelle — un personnage ayant déclaré une série d'attaques
  apparaît comme autant de cartes distinctes, chacune à sa position réelle, entrelacées avec tout le
  monde (objectif de départ de ce chantier).
- **Zone « en attente » séparée pour les personnages en délai**, cartes cliquables directement (portrait
  = déclencheur, repris de la proposition Saar). Leur cliquabilité visuelle suit l'état FSM corrigé en
  §6ter point 3 : active (bordure/pulsation) uniquement quand `AWAITING_REACTION_WINDOW` est ouvert ou
  que le tour obligatoire de fin de Tour est atteint (§6 point 2) ; grisée/non cliquable pendant qu'une
  résolution est en cours.
- **Permissions vérifiées côté serveur, jamais seulement côté client** (`core.md` : le serveur valide
  l'identité avant toute mutation) — le client masque/désactive visuellement selon qui peut cliquer quoi
  (joueur → sa propre carte ; MJ → toutes ses PNJ), mais le serveur revalide indépendamment à la
  réception du déclenchement.

**Analyse à charge du Lot C (2026-07-18) et corrections** :
- **Compte à rebours** : le code actuel (`CombatTimeline.jsx`) coupe l'affichage du minuteur dès que
  la phase n'est pas ANNONCE — le réutiliser pour `AWAITING_REACTION_WINDOW` demande une vraie
  extension de cette condition, pas une simple réutilisation telle quelle. Deux attentes distinctes à
  ne pas confondre visuellement : l'attente d'un jet de dégâts d'un joueur précis, et la fenêtre de
  réaction collective des personnages en délai.
- **Visibilité universelle confirmée (Saar)** : la zone « en attente » est visible de tous, seule
  l'interaction (le clic) est limitée par les permissions.
- **Cible mémorisée à la déclaration, pas laissée ouverte — corrige §6bis point 4** (Saar, 2026-07-18) :
  contrairement à ce qui était écrit initialement, une action retardée capture aussi une cible par
  défaut dès la déclaration (comme une action normale), pas seulement l'arme/le type d'action. Ça
  élimine la course entre le clic « Agir maintenant » et une sélection de cible en direct sous la
  pression du chrono (risque identifié en analyse à charge) : le clic déclenche immédiatement le plan
  mémorisé. Le joueur garde la possibilité de changer sa cible en direct pendant une fenêtre ouverte
  (préserve l'intérêt tactique du « retarder » — réagir à ce qui vient de se passer) ; le filet de
  sécurité (plan mémorisé exécuté tel quel) ne s'active que s'il ne confirme ni ne change rien avant
  expiration/tour obligatoire.
- **GM sans minuteur, sélection visuelle au survol** (Saar) : pas de compte à rebours pour le MJ sur
  ses propres PNJ ; survol d'une carte « en attente » met en surbrillance le jeton correspondant sur la
  carte de bataille, pour confirmer visuellement avant de cliquer (répond au risque de clic sur le
  mauvais PNJ dans un combat chargé, sans mécanisme supplémentaire à construire).
- **Entrées perdues/passées : message système dans le chat, pas d'icône dédiée sur la carte** (Saar) —
  réutilise le patron narratif déjà existant (messages `DICE_RESULT`/narratifs de combat) plutôt qu'une
  nouvelle iconographie.
- **Lot D devra construire l'équivalent Résolution de `COMBAT_SKIP_PLAYER`** `[VÉRIFIÉ]` : le mécanisme
  actuel (clic MJ sur la carte d'un joueur pour forcer le passage, `socketCombatAnnouncement.js:
  491-494`) n'existe aujourd'hui que pour la phase ANNONCE (logique construite autour de
  `has_announced`) — la table du FSM autorise techniquement l'événement pendant la Résolution, mais
  aucun gestionnaire n'y répond actuellement. À construire pour le nouveau modèle d'entrées, même geste
  UX, pas encore disponible tel quel.

**Deux pièges trouvés** :
- **Clé de carte** : aujourd'hui `key: r-${token_id}` (une carte = un personnage). Avec plusieurs cartes
  possibles pour le même personnage, la clé doit devenir `entry.id` — sinon l'animation d'apparition
  existante (`motion/react`, `AnimatePresence`/`LayoutGroup`) confondrait la 2ᵉ attaque d'un personnage
  avec une mise à jour de sa 1ʳᵉ carte au lieu d'une nouvelle carte distincte.
- **Filtrage explicite sur le Tour en cours** : l'historique complet d'un combat reste en base jusqu'au
  prochain `COMBAT_START` (§6bis point 5) — la timeline affichée doit filtrer explicitement
  `turn_number = currentTurn`, sinon les entrées déjà résolues des Tours précédents s'accumuleraient
  visuellement au lieu de disparaître normalement comme aujourd'hui.

---

## 6quinquies. Analyse critique globale A+B+C (2026-07-18)

Relecture croisée des trois Lots ensemble, cherchant spécifiquement les interactions entre eux plutôt
que de reprendre chaque Lot isolément. 4 points, tous tranchés :

1. **Changement de cible en direct (Lot C) sur une entrée déjà déclarée (Lot A) : modification directe
   de la ligne `combat_actions`, pas de nouvelle ligne** (Saar, confirmé). L'information « quel était le
   plan d'origine » n'est pas perdue pour autant : `resolution_snapshot` (déjà prévu au Lot A, §5, pour
   la trace durable Q3) enregistre au moment de la résolution si la cible a changé et laquelle c'était
   à l'origine — pas de duplication de ligne, pas de perte d'information, réutilise une structure déjà
   conçue plutôt que d'en ajouter une.
2. **Retarder une série d'attaques multiples entières : autorisé.** Tranché par le RAW lui-même (cité
   §0.1 point 6 : le décalage en cascade des attaques suite à un retard est explicitement prévu dans le
   même passage que les Attaques multiples) — pas une préférence de conception, une conformité RAW.
   Techniquement neutre avec les décisions déjà prises (Retarder porte sur le Tour entier, §6bis point
   2) : déclencher une série retardée revient à positionner ses N entrées (base, -5, -10...) relativement
   au moment du déclenchement plutôt qu'à l'Initiative de base, même mécanisme qu'une action simple
   retardée, appliqué à un groupe.
3. *(fusionné avec le point 1 ci-dessus)*
4. **Un seul outil MJ générique — « forcer la suite de l'étape en cours » — pas deux outils
   distincts.** Correction d'une proposition antérieure (§6quater) qui distinguait à tort « forcer la
   fin d'une fenêtre de réaction optionnelle » et « débloquer un joueur en attente obligatoire » comme
   deux mécanismes séparés. Un seul principe sous-jacent (faire avancer le temps, quel que soit ce qui
   bloque actuellement) — un seul bouton, applicable à n'importe quel sous-état d'attente du FSM
   (`AWAITING_DEFENSE`, `AWAITING_DAMAGE`, `AWAITING_REACTION_WINDOW`, tour obligatoire bloqué), pas un
   bouton par cas. Généralise l'équivalent Résolution de `COMBAT_SKIP_PLAYER` (§6quater) plutôt que de
   le limiter au seul cas de la fenêtre de réaction — reste à construire au Lot D dans les deux cas,
   mais comme un seul mécanisme.

---

## 6sexies. Audit à charge du document complet (2026-07-18)

Audit indépendant demandé par Saar pour limiter le biais de confirmation après de nombreux tours de
relecture par le même auteur. Méthode : chaque affirmation vérifiée contre le code réel et le texte RAW,
pas seulement contre le texte du plan. 8 points, du plus au moins structurant — les deux citations RAW
les plus déterminantes (points 1 et 6) et les deux citations de code les plus spécifiques (point 4, deux
sites sur cinq cités) ont été revérifiées indépendamment avant intégration, toutes confirmées exactes.

1. **Faille RAW dans le plancher de phase du Lot A — corrigée.** Le plan confondait deux règles RAW
   distinctes sous une seule formulation « position ≤ 0 = perdue ». `REGLESYSCOMBAT.md:698-699`
   (attaque d'une série multiple décalée au-delà de la phase 1) dit bien « supprimée ». Mais
   `REGLESYSCOMBAT.md:354-357` (Préparation ramenant l'Initiative à 0 ou moins) dit le contraire :
   « l'Action […] est reportée au Tour suivant. Le personnage agit en premier et son Action bénéficie
   de la Préparation. » — `[VÉRIFIÉ]` mot pour mot par re-lecture directe. **Tranché (Saar,
   2026-07-18)** : pas de report inter-Tour dans ce cas non plus, cohérent avec la simplification déjà
   assumée pour « Retarder » (§6 point 2) — un choix conscient d'écarter le RAW littéral une seconde
   fois pour la même raison (éviter la persistance d'état entre deux Tours), pas un oubli.
2. **Bug `combat_pending` déjà vivant en production aujourd'hui, pas seulement un risque futur Tir
   Multi — confirmé, correctif isolé décidé.** `[VÉRIFIÉ]` (relecture indépendante de
   `socketCombatResolution.js:544-767`) : la collision de clé primaire documentée dans
   `docs/PLAN_COMBAT_ACTION_QUEUE.md` §0.1 est déjà déclenchable aujourd'hui par toute attaque multiple
   CaC touchant deux défenseurs PJ distincts dans la même série — pas besoin d'attendre Tir Multi. Côté
   Tir, le chemin analogue est confirmé inatteignable tant que `mapActions.attack` reste un objet
   singulier (`socketCombatAnnouncement.js:320`). **Tranché (Saar, 2026-07-18)** : correctif isolé
   (déjà entièrement conçu, `docs/PLAN_COMBAT_ACTION_QUEUE.md` §3 — PK par ligne, plusieurs `damage`
   possibles par personnage) livré **avant** de démarrer le Lot A de ce plan, indépendamment de la
   timeline — ne pas laisser un bug de production connu attendre la fin d'un chantier plus large.
3. **Diagnostic LOS/interception (§6 point 3) confirmé exact par relecture indépendante** — corrobore
   la vérification déjà faite dans ce document, aucune correction nécessaire.
4. **Surface de migration `combat_actions` sous-estimée — checklist à ajouter au Lot A.** Au moins 5
   sites de requête filtrent `combat_actions` sur `status: 'pending'` sans aucune borne de Tour
   (`socketCombatHelpers.js:162-164`, `socketCombatResolution.js:87-88/97-98/198-199/208-209`) —
   `[VÉRIFIÉ]` sur les deux premiers cités, cohérent avec l'absence actuelle de colonne `turn_number`
   sur cette table. En retirant le `DELETE` inconditionnel de `endTurn()` (§6bis point 5) sans traiter
   ces sites, une ligne `pending` orpheline pourrait survivre et ressurgir à un Tour ultérieur. **Ajout
   au Lot A** : auditer et scoper ces 5 sites (plus tout autre non recensé ici) sur `turn_number`, et
   décider explicitement du sort des lignes encore `pending` à la clôture d'un Tour (marquage `skipped`
   explicite, cohérent avec le guard de fin de Tour déjà prévu pour les entrées en délai).
5. **D8 de `PLAN_TIRMULTI.md` pas réellement résolu par l'architecture, contrairement à ce qu'affirmait
   ce document — clarifié.** Le schéma `declaration_group_id` présupposait implicitement deux groupes
   séparés (CaC/Tir) sans jamais le dire. En clarifiant avec Saar, la question s'est déplacée :
   `[VÉRIFIÉ]` (`CombatActionWindow.jsx:404-408`, `mapSelected` est un `Set`, `attackSelected`/
   `meleeSelected` non mutuellement exclusifs) — CaC et Tir peuvent aujourd'hui être déclarés ensemble
   dans le même Tour, alors que le RAW (« Types d'Actions », cité par Saar : *« chaque personnage a la
   possibilité d'effectuer l'une des Actions suivantes […] Une Action de combat, souvent une Attaque au
   corps à corps ou avec une arme de combat à distance »*) les range dans une **seule** catégorie
   exclusive. **Tranché (Saar, 2026-07-18)** : CaC et Tir deviennent mutuellement exclusifs à la
   déclaration (nouvelle règle, plus fidèle au RAW que le comportement actuel) — la question D8 devient
   sans objet, `declaration_group_id` n'a jamais à mélanger les deux types. Point périphérique noté mais
   volontairement hors scope de ce chantier : le RAW range aussi le Déplacement dans la même liste
   exclusive, et le système actuel permet déjà de combiner un déplacement (`move_long` notamment) avec
   une attaque — cohérence de cette tolérance existante à revisiter séparément, une future session,
   sans rapport avec la Timeline ni Tir Multi.
6. **Guard RAW manquant — ajouté au Lot B.** *« Notez qu'une Action précipitée ne peut pas être
   retardée »* (`REGLESYSCOMBAT.md:603`) — `[VÉRIFIÉ]` mot pour mot. Aucun guard prévu ne l'empêchait ;
   ajouté à la liste des guards du Lot B (empêcher « Agir maintenant »/Retarder sur une entrée déjà
   Précipitée).
7. **Le « risque tout ou rien » du Lot B (§6 point 5) était un faux dilemme — refermé.** Un mécanisme
   de secours vers l'ancien moteur de résolution serait, par construction, un second moteur coexistant
   temporairement — exactement ce que `CLAUDE.md` §13 interdit explicitement (« solution temporaire/
   pour l'instant, second moteur ou fallback legacy — sur tout domaine »). **Tranché** : seule option
   compatible avec la doctrine du projet — test exhaustif avant livraison du Lot B, pas de bascule de
   secours. §6 point 5 n'est donc plus un point ouvert.
8. **Dette `react.md` préexistante, à ne pas aggraver silencieusement.** `CombatTimeline.jsx`/
   `TimelineCard.jsx` utilisent `style={}` pour des valeurs visuelles (couleurs, tailles) plutôt que des
   custom properties CSS — dette déjà présente, pas introduite par ce plan, mais le Lot C va dupliquer
   ce patron dans le nouveau code de cartes multiples. Signalé pour vigilance au moment du Lot C, pas
   une correction à faire dans ce chantier.

**Conclusion** : tous les points sont tranchés. Le point 2 déclenche une action immédiate, avant le Lot
A (correctif isolé `combat_pending`) — voir §7.

---

## 7. Chantiers dépendants

- **`docs/PLAN_COMBAT_ACTION_QUEUE.md` — correctif isolé du bug `combat_pending` à livrer avant le Lot
  A** (§6sexies point 2, tranché Saar 2026-07-18) : bug déjà vivant en production, conception déjà
  complète dans ce document §3, migration + patch des points d'insertion/lecture, indépendant de la
  Timeline. Une fois livré, `docs/PLAN_COMBAT_ACTION_QUEUE.md` est archivé dans `docs/Old/` (Règle 10) —
  son contenu de conception « file plate » reste obsolète pour la suite (absorbé par le Lot B de ce
  plan), seul le correctif `combat_pending` en est extrait et livré maintenant.
- `docs/PLAN_TIRMULTI.md` — en pause, reprend une fois ce moteur en place (Tir Multi devient une
  déclinaison directe du modèle échelle/attaques multiples). CaC et Tir désormais mutuellement
  exclusifs à la déclaration (§6sexies point 5) — à répercuter dans ce plan à sa reprise.
