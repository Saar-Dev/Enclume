# PLAN DE REFACTOR — Synchronisation live et présence du Wizard

**Version : 2026-08-09 — révision critique du plan initial**

---

## 1. Objectif

Corriger l'architecture de synchronisation live du Wizard afin que :

* les modifications de données du joueur restent visibles en temps réel côté MJ ;
* une mise à jour distante ne provoque jamais le remontage du composant observateur ;
* l'état de navigation local du MJ (`subStep`, onglets, vues ouvertes, etc.) soit préservé ;
* la position de navigation du joueur puisse être observée en temps réel ;
* le MJ puisse choisir de suivre automatiquement cette navigation ;
* les données métier, la présence distante et l'état d'interface local restent séparés ;
* l'architecture puisse être réutilisée pour les autres étapes du Wizard.

L'objectif n'est **pas** de synchroniser tout l'état du joueur avec l'état d'interface du MJ.

Le MJ est un **observateur indépendant**.

---

# 2. Principes architecturaux obligatoires

## 2.1 Une mise à jour distante ne doit jamais changer l'identité du composant

Une modification reçue du serveur doit provoquer un nouveau rendu si nécessaire, mais pas un démontage/remontage du composant.

À proscrire :

```jsx
<Component key={stateSyncVersion} />
```

si cette clé change uniquement parce qu'une synchronisation distante est reçue.

Le changement de données doit rester un changement de données.

Il ne doit pas devenir un changement d'identité React.

---

## 2.2 Trois domaines doivent rester distincts

L'architecture doit distinguer explicitement :

```text
1. Données métier
2. Présence distante
3. État d'interface local
```

### Données métier

Ce sont les données persistantes du personnage / Wizard.

Elles sont autoritaires côté serveur et sont exposées au client via `creationStore`.

```text
SERVER
  ↓
creationStore
  ↓
React
```

### Présence distante

Elle décrit ce que fait actuellement un autre utilisateur dans l'interface.

Elle est éphémère et n'est pas une donnée métier.

```text
PLAYER
  ↓
Socket.IO
  ↓
presenceStore
  ↓
GM
```

### État d'interface local

Il décrit ce que le MJ choisit d'afficher.

Exemples :

```text
gmActiveSubstep
gmActiveTab
gmFollowPlayer
```

Ces valeurs ne doivent pas être écrasées par une mise à jour des données métier.

---

# 3. Ne pas créer de double source de vérité

Avant d'ajouter des `useEffect`, chaque état local de `Step4Experience` doit être audité.

Pour chaque variable, déterminer :

```text
Variable
│
├── donnée métier ?
│      → creationStore
│
├── présence du joueur ?
│      → presenceStore
│
├── état d'interface propre au MJ ?
│      → useState local ou wizardUiStore si réellement partagé
│
└── état transitoire propre au composant ?
       → useState local
```

Une donnée déjà disponible dans `creationStore` ne doit pas être recopiée dans un `useState` local simplement pour pouvoir la synchroniser.

Exemple à éviter :

```js
const [localData, setLocalData] = useState(step4Data);

useEffect(() => {
    setLocalData(step4Data);
}, [step4Data]);
```

Ce mécanisme crée deux représentations de la même donnée et introduit une nouvelle source potentielle de désynchronisation.

Lorsque la donnée métier peut être lue directement depuis Zustand, elle doit l'être.

---

# 4. `useEffect` n'est pas le mécanisme de synchronisation par défaut

Un `useEffect` ne doit être introduit pour recopier des données distantes dans un état local que si l'audit démontre qu'une duplication est réellement nécessaire.

Le principe recherché est :

```text
serveur
  ↓
creationStore
  ↓
sélecteur Zustand
  ↓
composant
```

et non :

```text
serveur
  ↓
creationStore
  ↓
useEffect
  ↓
copie locale
  ↓
composant
```

Un `useEffect` reste parfaitement légitime pour des effets secondaires réels, par exemple :

```text
changement de subStep
    ↓
émission d'un événement de présence
```

Mais il ne doit pas être utilisé pour recréer artificiellement une seconde source de vérité.

---

# 5. Phase 1 — Audit du mécanisme actuel

Avant toute modification, identifier précisément :

```text
gmSyncKey
stateSyncVersion
applyStateSync
applyLiveDraft
initialData
liveOr()
subStep
autres états locaux de Step4Experience
```

Cartographier également les endroits où :

* le composant MJ est rendu ;
* sa `key` est définie ;
* les données distantes sont injectées ;
* le composant est conditionnellement monté/démonté ;
* `subStep` est initialisé ;
* `subStep` est modifié ;
* les données synchronisées peuvent indirectement modifier la navigation.

Produire une cartographie :

```text
PROPRIÉTÉ
    ↓
SOURCE D'AUTORITÉ
    ↓
CYCLE DE VIE
    ↓
CONSOMMATEURS
    ↓
EFFETS SECONDAIRES
```

### Point particulier : `applyStateSync`

Ne pas simplement supprimer `applyStateSync`.

Déterminer précisément :

* quelles propriétés elle modifie ;
* pourquoi elle modifie ces propriétés ;
* si elle intervient sur la navigation ;
* si elle intervient sur des données métier ;
* si elle provoque directement ou indirectement le remount ;
* si certaines de ses responsabilités sont encore nécessaires.

Le fait qu'une partie de son comportement soit liée à l'ancien auto-scroll ne suffit pas à démontrer que toute la fonction doit disparaître.

---

# 6. Phase 2 — Corriger d'abord le remount

Si l'audit confirme que :

```jsx
key={gmSyncKey}
```

est bien la cause du remontage forcé du composant MJ, supprimer ce mécanisme.

Cette phase doit rester volontairement minimale.

Ne pas introduire simultanément :

* présence ;
* follow mode ;
* nouveaux stores ;
* nouveaux événements réseau.

### Validation attendue

Scénario :

```text
MJ → sous-étape 2

Joueur :
    modification champ 1
    modification champ 2
    modification champ 3
    ...
    modification champ 20
```

Résultat :

```text
MJ reste sous-étape 2
```

et :

```text
les nouvelles données du joueur restent visibles.
```

Si ce test échoue, ne pas poursuivre vers la présence.

---

# 7. Phase 3 — Nettoyage de l'état de `Step4Experience`

Après suppression du remount, auditer les états locaux.

Objectif :

```text
Donnée métier
    → creationStore

Navigation MJ
    → état local MJ

État transitoire
    → useState local

Présence joueur
    → presenceStore
```

Ne pas déplacer automatiquement tous les `useState` vers Zustand.

Un état qui n'est utilisé que par `Step4Experience` doit rester local.

Créer un `wizardUiStore` uniquement si plusieurs composants indépendants doivent réellement partager ces informations.

---

# 8. Phase 4 — Introduire la présence

Créer un store dédié à la présence distante :

```text
presenceStore
```

Il ne doit contenir que des informations de présence provenant d'autres utilisateurs.

Exemple minimal :

```js
playerPresence: {
    userId,
    sessionId,
    step,
    substep,
    updatedAt
}
```

Éventuellement prévoir un champ permettant de détecter les événements périmés :

```js
sequence
```

ou une équivalence adaptée au protocole existant.

### Important

Le `presenceStore` ne doit pas contenir :

```text
gmActiveSubstep
gmFollowPlayer
gmActiveTab
```

Ces valeurs appartiennent à l'interface locale du MJ.

---

# 9. Phase 5 — Protocole Socket.IO de présence

Créer deux types de messages :

```text
WIZARD_PRESENCE_UPDATE
WIZARD_PRESENCE_SYNC
```

## `WIZARD_PRESENCE_UPDATE`

Émis par le joueur lorsque sa navigation change réellement.

Exemple :

```json
{
    "step": 4,
    "substep": 3
}
```

Ne pas émettre un événement de présence à chaque modification de donnée métier.

Une modification de champ et une modification de navigation sont deux événements différents.

---

## `WIZARD_PRESENCE_SYNC`

Permet à un MJ rejoignant une session en cours de recevoir la présence actuelle du joueur.

La présence peut être incluse dans un snapshot global si l'architecture existante le justifie, mais elle doit rester conceptuellement distincte des données métier.

Le système doit pouvoir fonctionner même si :

```text
snapshot métier
```

et :

```text
snapshot présence
```

sont reçus à des moments différents.

---

# 10. Phase 6 — Cycle de vie de la présence

La présence ne doit pas dépendre uniquement d'un événement applicatif explicite.

Prévoir :

```text
connexion
déconnexion
reconnexion
timeout / présence périmée
```

Un événement `disconnect` peut couvrir une partie des cas, mais une coupure brutale ou une perte réseau doit également être correctement gérée.

Le système doit pouvoir considérer une présence comme obsolète lorsque son dernier signal dépasse le délai défini.

Exemple conceptuel :

```text
lastSeenAt
    ↓
TTL dépassé
    ↓
presence = stale/offline
```

Les valeurs exactes du TTL doivent être déterminées à partir de l'architecture Socket.IO existante.

---

# 11. Phase 7 — Navigation du joueur

Côté joueur :

```text
subStep joueur
    ↓
changement réel
    ↓
WIZARD_PRESENCE_UPDATE
```

La navigation du joueur devient donc une information de présence.

Elle ne doit pas être enregistrée comme une donnée métier persistante du personnage sauf si une exigence métier distincte le justifie.

Le MVP peut se limiter à :

```text
step
substep
updatedAt
```

L'architecture doit cependant pouvoir évoluer ultérieurement vers :

```text
step
substep
tab
focus
```

sans imposer cette complexité dès maintenant.

---

# 12. Phase 8 — Interface MJ

Le MJ dispose de deux notions distinctes :

```text
playerPresence.substep
```

et :

```text
gmActiveSubstep
```

Elles ne doivent pas être automatiquement identiques.

### Signification

```text
playerPresence.substep
=
où se trouve actuellement le joueur
```

```text
gmActiveSubstep
=
ce que le MJ regarde actuellement
```

C'est uniquement le mode `followPlayer` qui crée une relation entre les deux.

---

# 13. Phase 9 — Mode « suivre le joueur »

Introduire une préférence locale :

```text
gmFollowPlayer
```

Elle peut rester dans un `useState` local si elle n'est utilisée que par le composant concerné.

Si plusieurs composants doivent la consommer, envisager un `wizardUiStore`.

### Lorsque `followPlayer === false`

Le MJ conserve sa navigation indépendamment de celle du joueur.

Exemple :

```text
Joueur → sous-étape 5
MJ     → sous-étape 2

Joueur → sous-étape 6
MJ     → sous-étape 2
```

Le MJ peut néanmoins voir un indicateur :

```text
Joueur actuellement en sous-étape 6
```

sans que sa propre vue soit modifiée.

---

# 14. Règle du mode « suivre »

Lorsque :

```text
followPlayer === true
```

alors :

```text
playerPresence.substep
        ↓
gmActiveSubstep
```

Le MJ suit la navigation du joueur.

Mais une navigation manuelle du MJ doit désactiver automatiquement le mode de suivi.

Exemple :

```text
followPlayer = true

Joueur → sous-étape 5
MJ     → sous-étape 5

MJ clique manuellement → sous-étape 3

Résultat :

followPlayer = false
gmActiveSubstep = 3
```

Une nouvelle navigation du joueur ne doit alors plus déplacer le MJ.

Le MJ pourra réactiver explicitement le suivi.

---

# 15. Phase 10 — Ne jamais utiliser la présence pour écraser l'état local

La règle fondamentale est :

```text
playerPresence
    ↓
information distante
```

et non :

```text
playerPresence
    ↓
gmActiveSubstep
```

sauf lorsque :

```text
gmFollowPlayer === true
```

De même :

```text
WIZARD_STATE_SYNC
```

ne doit jamais réinitialiser :

```text
gmActiveSubstep
gmActiveTab
gmFollowPlayer
```

---

# 16. Phase 11 — Indépendance des deux flux

Le système doit considérer séparément :

```text
FLUX A — DONNÉES

WIZARD_STATE_SYNC
        ↓
creationStore
        ↓
UI
```

et :

```text
FLUX B — PRÉSENCE

WIZARD_PRESENCE_UPDATE
        ↓
presenceStore
        ↓
UI de présence
```

Les deux flux peuvent arriver dans n'importe quel ordre.

Le système doit rester cohérent si :

```text
STATE
↓
PRESENCE
```

ou :

```text
PRESENCE
↓
STATE
```

---

# 17. Phase 12 — Autorisation de la présence

Le serveur ne doit pas diffuser la présence à l'ensemble des clients sans contrôle.

La présence doit être limitée aux utilisateurs autorisés à observer la session du Wizard.

Conceptuellement :

```text
Wizard session
    ↓
utilisateurs autorisés
    ↓
diffusion présence
```

Ne pas supposer qu'un simple broadcast Socket.IO global sera acceptable à long terme.

---

# 18. Phase 13 — Tests fonctionnels obligatoires

## Test 1 — Données sans navigation

```text
MJ → sous-étape 2

Joueur → modifie 20 champs
```

Attendu :

```text
MJ = sous-étape 2
Données = mises à jour
```

---

## Test 2 — Navigation du joueur

```text
Joueur :
4.1
4.2
4.3
4.4
```

Attendu :

```text
presenceStore :
4.1
4.2
4.3
4.4
```

---

## Test 3 — Navigation MJ indépendante

```text
Joueur → 4.5
MJ → 4.2
```

Attendu :

```text
Joueur = 4.5
MJ = 4.2
```

---

## Test 4 — Follow

```text
followPlayer = true

Joueur → 4.1
Joueur → 4.2
Joueur → 4.3
```

Attendu :

```text
MJ → 4.1
MJ → 4.2
MJ → 4.3
```

---

## Test 5 — Désactivation automatique du follow

```text
followPlayer = true

Joueur → 4.4

MJ clique → 4.2
```

Attendu :

```text
followPlayer = false
MJ = 4.2
```

Puis :

```text
Joueur → 4.5
```

Attendu :

```text
MJ = 4.2
```

---

## Test 6 — Modification simultanée

```text
MJ → 4.3

Joueur → modification donnée
```

Attendu :

```text
MJ reste 4.3
```

Ce test doit être réalisé pendant une vraie réception Socket.IO.

---

## Test 7 — Données et présence dans des ordres différents

Tester :

```text
STATE → PRESENCE
```

et :

```text
PRESENCE → STATE
```

Attendu :

```text
aucune incohérence
aucun remount
```

---

## Test 8 — Reconnexion MJ

```text
MJ déconnecte
Joueur continue
Joueur change de sous-étape
MJ reconnecte
```

Attendu :

```text
MJ reçoit les données actuelles
MJ reçoit la présence actuelle
```

La navigation locale du MJ doit suivre la politique explicitement définie, et ne doit pas être implicitement remplacée par le snapshot.

---

## Test 9 — Déconnexion joueur

Tester :

```text
disconnect propre
```

et :

```text
coupure réseau / fermeture brutale
```

Attendu :

```text
presence → offline/stale
```

dans le délai prévu.

---

## Test 10 — Persistance de l'état UI

Tester séparément :

```text
gmActiveSubstep
gmActiveTab
gmFollowPlayer
```

pendant plusieurs synchronisations de données.

Aucune synchronisation métier ne doit les réinitialiser.

---

# 19. Phase 14 — Généralisation

Ne pas généraliser immédiatement aux sept étapes.

Valider d'abord complètement l'architecture sur :

```text
Étape 4 — Expérience
```

Une fois le pattern stabilisé, identifier les points communs :

```text
creationStore
presenceStore
protocole présence
observateur MJ
followPlayer
```

Puis déterminer pour chaque étape :

```text
données métier spécifiques
navigation spécifique
états locaux spécifiques
```

Le pattern doit être généralisé au niveau de l'architecture, pas nécessairement par une abstraction massive des composants.

---

# 20. Architecture cible

L'architecture cible doit ressembler conceptuellement à ceci :

```text
                         SERVER
                            │
             ┌──────────────┴──────────────┐
             │                             │
       WIZARD STATE                    PRESENCE
       autoritaire                    éphémère
       persistant                     contextuelle
             │                             │
             ▼                             ▼
      creationStore                 presenceStore
             │                             │
             │                             │
             └──────────────┬──────────────┘
                            │
                          React
                            │
                ┌───────────┴───────────┐
                │                       │
         données joueur           UI locale MJ
                                        │
                              ┌─────────┴─────────┐
                              │                   │
                       gmActiveSubstep      gmFollowPlayer
                              │                   │
                              └─────────┬─────────┘
                                        │
                                  Vue du MJ
```

La relation entre présence et navigation MJ est :

```text
playerPresence
      │
      ├── followPlayer = false
      │       ↓
      │   information uniquement
      │
      └── followPlayer = true
              ↓
        gmActiveSubstep
```

---

# 21. Critères de réussite

La refactorisation sera considérée comme réussie lorsque les propriétés suivantes seront démontrées :

### Identité React

Une synchronisation distante ne provoque aucun remount du composant MJ.

### Données

Les données du joueur restent visibles en temps réel.

### Navigation MJ

La navigation du MJ reste indépendante des mises à jour métier.

### Présence

Le MJ connaît la position actuelle du joueur.

### Follow

Le MJ peut choisir de suivre cette position.

### Override

Une navigation manuelle du MJ désactive le suivi.

### Reconnexion

La présence et les données peuvent être reconstruites correctement après reconnexion.

### Séparation

Aucune donnée de présence ne devient accidentellement une donnée métier persistante.

### Absence de duplication

Aucune donnée métier n'est recopiée dans un état local sans justification technique.

### Généralisation

Le pattern peut être réutilisé pour les autres étapes sans imposer une abstraction inutile.

---

# 22. Règle finale

Le principe directeur de cette refactorisation est :

> **Le joueur partage son état métier et sa position. Il ne partage pas l'état d'interface du MJ.**

Le serveur synchronise les données.

La présence décrit le contexte d'utilisation du joueur.

Le MJ décide de ce qu'il regarde.

Le mode « suivre le joueur » constitue une préférence locale qui permet volontairement de relier ces deux mondes.

Une mise à jour distante doit donc provoquer :

```text
nouvelle donnée
→ nouveau rendu
```

et jamais :

```text
nouvelle donnée
→ nouvelle identité du composant
→ destruction de l'état local
→ reconstruction de l'interface
```

La priorité d'implémentation est donc :

```text
1. Prouver et corriger le remount
2. Éliminer les éventuelles duplications d'état
3. Valider la conservation de l'état MJ
4. Introduire la présence minimale
5. Introduire le mode follow
6. Tester les cas réseau
7. Généraliser aux autres étapes
```

Aucune étape ultérieure ne doit être utilisée pour masquer un problème non résolu à l'étape précédente.

---
version 2 corrigé ?
Plan de correction — Bug #7 (Synchronisation live du Wizard)
0. Rappel du problème

Le MJ qui observe un joueur en train de créer son personnage est propulsé au récapitulatif (SUMMARY) de l'étape 4 dès qu'une donnée distante arrive. Sa navigation dans les sous-étapes est perdue. La granularité du suivi est insuffisante.

Cause racine : key={gmSyncKey} dans WizardCreation.jsx force le remontage des composants d'étape à chaque WIZARD_STATE_SYNC et WIZARD_LIVE_UPDATE. Step4Experience initialise alors subStep à SUMMARY parce que initialData existe.
1. Principes architecturaux

    Une mise à jour distante ne doit jamais changer l'identité du composant observateur.

    Les données métier, la présence distante et l'état d'interface local sont trois domaines distincts.

    Une donnée déjà disponible dans le store ne doit pas être dupliquée dans un useState local.

    La navigation locale du MJ n'est jamais modifiée par une donnée distante.

2. Architecture cible
text

creationStore (existant, amendé)
├── step1Data..step5Data (données métier validées)
├── liveStep1Data..liveStep5Data (brouillon live, lu uniquement côté MJ)
└── stateSyncVersion (conservé pour le suivi, mais ne pilote plus aucun remount)

WizardCreation.jsx
├── Suppression de gmSyncKey
├── Chaque composant d'étape reste monté tant que l'étape est active
└── Les données live sont lues directement depuis le store par les composants

Step4Experience.jsx
├── Côté MJ : lecture directe depuis creationStore pour les 16 données métier
├── Côté joueur : conservation des useState locaux pour l'édition
└── subStep n'est plus initialisé à SUMMARY aveuglément

3. Phases d'implémentation
Phase 1 — Suppression du remount (Chantier A)

Objectif : Le MJ ne subit plus aucun remontage lié aux données distantes. Sa navigation locale est préservée.

Actions :

    Supprimer gmSyncKey dans WizardCreation.jsx pour l'étape 4 uniquement dans un premier temps (suppression conditionnelle : key={step === 4 ? undefined : gmSyncKey}). Les autres étapes conservent temporairement l'ancien mécanisme.

    Arrêter l'incrémentation de stateSyncVersion dans applyLiveDraft (creationStore.js). applyLiveDraft doit se contenter de mettre à jour liveStepNData sans toucher à stateSyncVersion.

    Adapter Step4Experience pour le mode MJ : les 16 données métier listées dans l'audit sont lues directement depuis le store plutôt que depuis initialData. Utiliser useCreationStore pour lire step4Data et liveStep4Data, et prioriser le brouillon live quand il existe (logique liveOr déplacée à l'intérieur du composant).

    Conserver subStep en useState local, initialisé à AGE (première sous-étape) au lieu de SUMMARY. Le MJ peut ensuite naviguer librement.

    Préserver la ligne s.step = hs dans applyStateSync — elle gère l'auto-scroll inter-étapes, un comportement distinct du bug #7. Une décision ultérieure pourra la remplacer par une notification de présence.

Tests :

    MJ sur sous-étape 2 → joueur modifie 20 champs → MJ reste sur sous-étape 2 et voit les nouvelles données.

    MJ sur sous-étape 3 → joueur valide l'étape 4 → MJ passe à l'étape 5 (auto-scroll conservé).

    Joueur édite normalement ses données → aucun comportement modifié côté joueur.

Phase 2 — Validation et extension

Objectif : Valider que la Phase 1 est stable, puis étendre aux autres étapes.

Actions :

    Tests approfondis de la Phase 1 sur l'étape 4 (navigation MJ, données live, mode joueur non affecté).

    Supprimer définitivement gmSyncKey pour toutes les étapes.

    Supprimer stateSyncVersion s'il n'a plus aucun consommateur.

    Appliquer le même pattern de lecture directe du store aux autres composants d'étape (Step1 à Step5) pour le mode MJ.

Phase 3 — Présence (Chantier B, optionnel, non prioritaire)

Une fois le remount supprimé, le système de présence pourra être ajouté pour le suivi fin de la navigation du joueur. Ce chantier est indépendant et pourra faire l'objet d'un plan séparé.
4. Points d'attention

    Ne pas casser le mode joueur : Step4Experience est utilisé à la fois par le joueur et le MJ. La distinction entre les deux modes doit être explicite dans le code.

    Ne pas introduire de duplication d'état : Les données métier côté MJ doivent être lues depuis le store, pas copiées dans un useState local via useEffect.

    L'auto-scroll inter-étapes (s.step = hs) est conservé en l'état. Il répond à un besoin différent (ne pas laisser le MJ bloqué sur une étape déjà validée) et n'est pas la cause du bug #7.