# PLAN_ECHANGE.md — Correction du branchement Échange (menu radial)

> **ARCHIVÉ — chantier clos, Session 153 (2026-07-17), item 79 de `docs/EN_COURS.md`.** Parcours
> complet MJ testé et fonctionnel en navigateur réel (ciblage, composition d'offre, acceptation par
> un second compte joueur). Ce document décrit l'intention ; le résultat livré et son détail de test
> vivent dans `docs/EN_COURS.md` item 79 (Règle 10, `docs/RegleDocumentaire.md` — un PLAN terminé est
> archivé, jamais laissé actif).

> Révisé 2026-07-16, Session 151. Remplace le plan précédent (Lot A0/A1/B, abandonné — doublon avec
> le système existant). Décision : **on adapte l'existant, on ne reconstruit pas.**

---

## 0. Ce qui est acquis (vérifié par exécution réelle, pas par lecture)

- Le mécanisme Échange PJ↔PJ existe déjà : `server/src/services/tradeService.js`
  (`acceptTransfer`), `server/src/socket/socketTrade.js`, table `trade_offers` (migrations 84-91,
  confirmées appliquées en base réelle). **Testé par exécution réelle** (transaction annulée puis
  fixtures réelles + nettoyage explicite) : offre créée, acceptée, item déplacé + déséquipé, sols
  débités/crédités exactement, entrée `trade_log`, ré-acceptation rejetée (anti-duplication). C'est
  la seule autorité à garder — aucune raison de le reconstruire.
- Ce système a été conçu sous `docs/Old/PLAN_TRADE.md` (sessions 124-141), jamais retrouvé avant
  aujourd'hui faute d'avoir cherché dans `docs/Old/` avant d'écrire un nouveau plan.
- `docs/EN_COURS.md` items 77/78 et `docs/BUGIDENTIFIE.md` (dette `TRADE1`) gardent le détail complet
  de la découverte — non reproduit ici.

## 1. Décision retenue

| Élément | Sort |
|---|---|
| `server/src/services/echangeService.js` (Lot A0) | **À supprimer** — redondant, jamais branché |
| Route `POST /:characterId/echanges/admin` (`char-sheet.js`) | **À supprimer** — dépend du service ci-dessus |
| Garde asymétrique `PUT /:characterId/sols` (joueur diminue, MJ augmente) | **Conservé** — indépendant du reste, améliore une route existante |
| Relaxation `TRADE_TRANSFER_OFFER` (MJ propose au nom d'un perso, `socketTrade.js`) | **Conservé** — toujours nécessaire (voir §2) |
| `TokenRadialMenu.jsx` secteur `echange` toujours visible | **Conservé**, correct tel quel |
| Court-circuit MJ instantané (`trade_log.type='gm_grant'`, jamais câblé) | **Hors scope**, reporté — décision séparée si besoin plus tard |
| Lot B (négociation multi-items, contre-offres) | **Abandonné** — le système existant ne le prévoit pas non plus (`PLAN_TRADE.md` : "un seul aller-retour, pas de négociation") |

## 2. Bug trouvé en testant (Saar) — câblage radial à l'envers

Mon câblage de ce matin faisait du **token cliqué** la source (`fromCharId`) pour le MJ, la fenêtre
demandant ensuite de choisir un destinataire — contre-intuitif : on vient de cibler un token pour
ouvrir le menu, redemander une cible ensuite n'a pas de sens.

**Comportement correct** : le token cliqué est **toujours** le destinataire (`toCharId`), identique
au comportement joueur existant, un seul modèle mental pour tout le monde.

**Conséquence** : un joueur agit toujours en tant que lui-même (`myCharId` fixe, inchangé). Le MJ n'a
pas de personnage propre — il lui faut donc un sélecteur "agir en tant que" pour choisir la source.
Le serveur reste inchangé (relaxation déjà en place, MJ peut proposer au nom de n'importe quel
personnage de la campagne).

**État "agit en tant que" — une seule autorité (correction auto-critique)** : entièrement local à
`ExchangeWindow.jsx` (`const [gmActingAsId, setGmActingAsId] = useState(null)`). `SessionPage.jsx`
ne connaît pas cette notion et ne change pas selon `isGm` — il continue de passer `myCharId={myCharId}`
(toujours la vraie valeur, `null` pour un MJ) et `isGm={isGm}`, sans branche conditionnelle.

## 3. Fichiers à corriger

- `client/src/pages/SessionPage.jsx` — **seul changement** : `onOpenExchange` devient
  inconditionnellement `{ toCharId: token cliqué }` (retirer la branche `isGm` ajoutée ce matin). Le
  montage d'`ExchangeWindow` reprend `myCharId={myCharId}` tel quel (retirer le ternaire `isGm ?
  exchangeContext?.fromCharId : myCharId`).

- `client/src/components/ExchangeWindow.jsx` :
  - Nouvelle constante dérivée : `const effectiveCharId = isGm ? gmActingAsId : myCharId`.
  - **Remplacer `myCharId` par `effectiveCharId` à chaque usage** (liste exhaustive, à vérifier une
    par une en codant — c'est le point le plus risqué de ce correctif) :
    1. `loadInventory` (dépendance + guard `if (!myCharId) return`)
    2. `useEffect` qui déclenche `loadInventory` au montage (tableau de dépendances)
    3. `handleProposeOffer` (guard + payload `fromCharId`)
    4. `handleAcceptOffer` (`acceptingCharId: incomingOffer.toCharId ?? myCharId`)
    5. Filtre de recherche de cible : `c.id !== myCharId`, `myUserId = characters.find(c => c.id
       === myCharId)?.user_id`
    6. Condition de désactivation du bouton proposer (`exTargetId === myCharId`)
  - Le bandeau `ex_acting_as` devient un vrai `<select>` (liste des PJ de la campagne), affiché
    uniquement si `isGm && !gmActingAsId` ; une fois choisi, remplace le bandeau par l'affichage
    actuel (nom de l'acteur). Nouvelle clé `fr.json` à ajuster (libellé de sélection, pas juste
    l'annonce figée actuelle).
  - **Sélecteur "agir en tant que"** : exclut `toCharId`/`exTargetId` (destinataire déjà fixé par le
    clic) — sinon auto-échange possible dans l'autre sens (le filtre existant `c.id !== myCharId`
    protège la recherche de cible, pas ce sélecteur).
  - **Rechargement d'inventaire sur changement d'identité** (piège trouvé en run à vide, absent du
    flux joueur car son identité ne change jamais en cours de fenêtre) : l'effet actuel ne relance
    `loadInventory` que si `myInventory.length === 0` — si le MJ change de personnage après un premier
    chargement, la longueur n'est plus 0 et le nouvel inventaire ne charge jamais. Réinitialiser
    `myInventory` à `[]` et forcer un rechargement à chaque changement de `effectiveCharId`, pas
    seulement au montage.
  - **État vide trompeur avant sélection** : tant que `gmActingAsId` est `null`, ne pas afficher la
    liste d'items avec le message "aucun objet" (laisserait croire l'inventaire vide) — masquer
    entièrement la section tant qu'aucun personnage n'est choisi.
  - **Cas dégénéré** : si la campagne compte un seul autre PJ (ou zéro) hors destinataire, le
    sélecteur peut se retrouver vide ou à un seul choix — prévoir un message adapté (pas un select
    silencieusement vide).
  - **Persistance de `gmActingAsId`** : le bouton "Nouvel échange" (Cas C) réinitialise cible/offre
    mais **pas** `gmActingAsId` — doit persister tant que la fenêtre reste ouverte (éviter de
    rechoisir son personnage à chaque essai).
  - Le remplacement `myCharId` → `effectiveCharId` couvre aussi les **tableaux de dépendances** des
    `useCallback`/`useEffect` concernés (`handleProposeOffer`, `handleAcceptOffer`, l'effet de
    chargement) — pas seulement les lectures de variable, sinon closures obsolètes.
  - Garde anti-auto-échange (sens joueur→cible) : déjà couverte par le filtre existant `c.id !==
    myCharId` **à condition** que le remplacement exhaustif (`effectiveCharId`) soit fait correctement
    — pas une garde indépendante à ajouter.

- `client/src/components/TokenRadialMenu.jsx` — aucun changement supplémentaire (déjà correct).
- `server/src/socket/socketTrade.js` — aucun changement supplémentaire (relaxation déjà correcte).
- Suppression : `server/src/services/echangeService.js`, route `echanges/admin` dans
  `char-sheet.js`.

## 5. Limite connue, non résolue par ce correctif

Le côté **acceptation** (`TRADE_TRANSFER_ACCEPTED`) reste inchangé : un MJ ne peut accepter au nom
d'un personnage que si celui-ci n'a pas de propriétaire (PNJ/drone). Après ce correctif, le MJ peut
**proposer** au nom de n'importe qui, mais ne peut **accepter** que pour un PNJ/drone, ou avec un
second compte joueur réel connecté. Pour un test 100% solo, cibler un PNJ/drone comme destinataire.
Étendre l'acceptation à l'identique serait une décision séparée (élargit encore la frontière de
confiance MJ), pas incluse ici.

## 6. Nettoyage documentaire (à faire au moment de la suppression)

- `docs/EN_COURS.md` item 77 : ajouter une ligne de retrait ("service retiré Session 151 suite,
  redondant avec `tradeService.js`, voir item 79") plutôt que réécrire l'historique.
- `docs/BUGIDENTIFIE.md` (dette `TRADE1`) : inchangée, sans rapport avec ce retrait.
- Nouvelle entrée `docs/EN_COURS.md` (item 79) à la clôture de ce correctif, résumant : retrait
  Lot A0, correction câblage radial, limite §5 ci-dessus.

## 7. Tests prévus

- `node --check` après suppression du service/route.
- ESLint 0 nouvelle erreur (comparaison `git stash`) sur les fichiers client touchés.
- Re-vérifier le scénario réel MJ-propose-au-nom-d'un-perso après le nouveau câblage (service only —
  la logique de sélection MJ dans `ExchangeWindow.jsx` est de l'UI pure, pas testable par ce moyen).
- **Priorité de test explicite** : relecture ciblée confirmant que pour `isGm=false`,
  `effectiveCharId === myCharId` sur 100% des chemins et qu'aucune nouvelle branche n'est atteignable
  côté joueur — c'est le vrai risque de régression de ce correctif, à vérifier avant tout autre test.
- Navigateur réel par Saar — objectif final, pas encore fait par personne à ce jour. Scénario
  recommandé pour un test 100% solo : cibler un PNJ/drone (cf. §5).

## 8. Note mineure, non bloquante

Le sélecteur MJ (`<select>` natif prévu) et la recherche de cible existante (combobox texte avec
suggestions) sont deux styles d'interaction différents dans la même fenêtre. Pas incohérent au point
de bloquer, à revoir plus tard si ça gêne à l'usage.
