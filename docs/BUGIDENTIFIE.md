# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-06-15 Session 93-4
> Index priorité → [`docs/EN_COURS.md`](EN_COURS.md) §Dettes actives

---

## MÉTHODE — Comment traiter les bugs dans ce projet

### Principe fondateur (issu des pratiques pro)

**Ni un bug à la fois, ni tout en batch.** Le modèle professionnel est :

> **Triage batch → Analyse par cluster → Fix par cluster → Validation avant le cluster suivant**

Basé sur :
- Bug triage (Atlassian, SmartBear, BrowserStack) : analyser tous les bugs ensemble pendant que le contexte est frais → meilleure priorisation, moins de re-lecture
- Defect clustering (Functionize, TestSigma) : les bugs se regroupent naturellement par module ou cause racine. Résoudre un bug du cluster résout souvent les autres. Économie 40–60% du temps de debug vs. traitement isolé
- Root Cause Analysis (Splunk, selementrix, TechTarget) : ne jamais patcher le symptôme. Toujours trouver la cause racine (technique des "5 Pourquoi")
- Pragmatic Engineer : un commit par cause racine, pas par symptôme. Si 3 bugs partagent la même cause dans le même fichier → un seul fix, un seul commit

---

### Phase 1 — TRIAGE (batch, une fois par session)

1. Lister tous les bugs connus
2. Attribuer sévérité (impact fonctionnel) + priorité (urgence pour les sessions de jeu)
3. Identifier les **clusters** (voir définition ci-dessous)
4. Produire l'ordre de sprint → mettre à jour `EN_COURS.md`

**Ne pas coder à cette étape.**

---

### Phase 2 — ANALYSE (par cluster, avant de coder)

Pour chaque cluster, dans la même session de lecture :

1. Lire tous les fichiers concernés par le cluster (TABLE DE ROUTING)
2. Identifier la **cause racine** — pas le symptôme
   - Technique "5 Pourquoi" : demander "pourquoi ?" jusqu'à atteindre la cause structurelle
   - Exemple : `localisation: null` (symptôme) → "pourquoi null ?" → branche 8a ne lit pas `droneSheet` → cause racine
   - **Si la cause racine cite une règle de jeu → vérifier la source primaire LdB avant de valider.** Une référence incorrecte dans ce fichier peut transformer un comportement CONFORME en faux bug, et un correctif planifié en régression. (Leçon Session 94 — COM3)
3. Vérifier les **effets de bord** : le fix du bug A casse-t-il le bug B dans le même cluster ?
4. Produire le plan exact : fichier, ligne, ce qui change, ce qui ne change pas

**Run à vide obligatoire avant de coder** — anticiper pièges, ambiguïtés, effets de bord.

---

### Phase 2b — INSTRUMENTATION (si cause HYPOTHÈSE ou INCONNU)

Avant de coder le correctif, si la cause racine n'est pas **VÉRIFIÉ** :

1. Ajouter des logs ciblés préfixés `[DBG-BUGID]` au point exact suspecté
   - Serveur : `console.log('[DBG-COM3]', { attackSuccess, isSuccess })`
   - Client : `console.warn('[DBG-D1]', token.character_id, characters.map(c => c.id))`
2. SR — reproduire le scénario exact du bug
3. Lire la sortie → confirmer ou infirmer la cause racine
4. Mettre à jour le label dans ce fichier : `HYPOTHÈSE → VÉRIFIÉ` (ou réviser le diagnostic)
5. Un log pertinent peut rester permanent — retirer uniquement les logs bruités ou redondants avant le commit

**Ne jamais coder un correctif sur une cause INCONNUE ou non confirmée.**

---

### Phase 3 — CORRECTIF (par cluster)

- Coder uniquement ce qui est dans le plan validé
- **Un commit par cluster** (pas par bug individuel si cause racine commune)
- Si deux bugs du cluster touchent des fichiers sans rapport → deux commits séparés dans le même sprint
- Jamais mélanger deux clusters dans un seul commit

---

### Phase 4 — VALIDATION

- Test fonctionnel du cluster avant de passer au suivant
- Vérifier les zones adjacentes (régressions)
- Fermer les bugs validés dans `EN_COURS.md` (✅ Clos)
- Appender `JOURNAL4.md`

---

### Définition d'un "cluster" pour Enclume

Un cluster = bugs qui satisfont **au moins un** des critères :

| Critère | Exemple |
|---|---|
| Même fichier source | COM3 + DC3 + DC2 → tous dans `socket/index.js` |
| Même cause racine | DR1 + COM6 → "arme non pré-sélectionnée" → même pattern init |
| Même mécanique de jeu | DC1 + DC3 + DR3 → flow CaC drone |
| Fix A nécessite Fix B | B6 + DC3 → les deux dans `resolveDroneAssaultAction` |

Des bugs de **sévérité différente** peuvent être dans le même cluster si la cause racine est identique.

---

### Ce qu'il ne faut jamais faire

- Coder un fix sans avoir lu les fichiers dans cette session
- Mixer des clusters sans rapport dans le même sprint (dette de contexte)
- Fermer un bug sur "ça semble fonctionner" — confirmation fonctionnelle obligatoire
- Patcher un symptôme sans comprendre la cause racine → le bug reviendra

---

*Sources : [Atlassian — Bug Triage](https://www.atlassian.com/agile/software-development/bug-triage) · [Functionize — Defect Clustering](https://www.functionize.com/blog/why-bugs-appear-in-clusters) · [selementrix — RCA](https://www.selementrix.ch/blog/how-do-we-perform-effective-root-cause-analysis-instead-of-just-patching) · [Pragmatic Engineer — Bug Management](https://newsletter.pragmaticengineer.com/p/bug-management-that-works-part-1)*

---

## COLD START — Orientation rapide pour une nouvelle conversation

> Lire ce bloc en premier si tu arrives sans contexte de session précédente.

**Ce fichier est la source de vérité des bugs actifs.** Il est structuré pour qu'une IA puisse reprendre le travail à froid sans perdre de contexte.

**Index de priorité** : `EN_COURS.md §Dettes actives` — tableau synthétique (ID | Description | Priorité).

**Table de routing fichiers** : `CLAUDE.md §TABLE DE ROUTING` — quel fichier lire selon le domaine touché.

**Labels épistémiques sur chaque bug :**
- `[VÉRIFIÉ]` — cause confirmée par lecture du code source
- `[HYPOTHÈSE]` — cause probable, à confirmer par instrumentation (Phase 2b)
- `[INCONNU]` — cause non encore investiguée

**Avant tout correctif :** lire les fichiers du cluster concerné dans la même session. Ne jamais coder depuis la mémoire.

---

## ROUTING PAR CLUSTER — Sprint order recommandé

| Cluster | Bugs | Fichier principal | Priorité |
|---|---|---|---|
| **A — Socket résolution drone** | B6 + DC2 + DC3 | `server/src/socket/index.js` | **Haute** |
| **B — Init arme défaut** | COM6 + DR1 | `CombatGmDeclareWindow.jsx` | Haute |
| **C — Flow CaC drone** | DC1 + DR3 | `CombatOverlay.jsx` + `socket/index.js` | Haute |
| **D — Fenêtres combat UI** | UI1 + COM8 + COM5 + CL2 | composants combat + `index.css §11` | Haute |
| **E — Arme et statuts** | COM1 + COM2 + COM4 + COM7 | `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` | Moyenne |
| **F — Ghosts + portraits** | CL1 + CL3 | `CombatTimeline.jsx` + `CombatOverlay.jsx` | Moyenne |
| **G — Drone store** | D1 + D2 | `SessionPage.jsx` + `Canvas3D.jsx` | Moyenne |
| **H — Dettes techniques** | WS1 + TC1 + DCO1 + VX1 + AU1 + INI1 | divers | Basse |
| **I — Affichage dégâts drone** | DMG1 + DMG2 + DR4 | `server/src/socket/index.js` + `charStats.js` | Moyenne |

**Règle d'or :** toujours finir le cluster A avant d'entamer B. Validation fonctionnelle obligatoire entre clusters.

---

## FAUX BUGS — Comportements attendus non à corriger

| Comportement observé | Explication | Source |
|---|---|---|
| Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement | Comportement documenté V1 — entité de décor sans fiche | `EN_COURS.md §Points de vigilance` |
| `getVoxelSurfaceTop` retourne `y+1.0` pour slope/wedge | Acceptable V1 — sprint voxels v2 futur | VX1 dans ce fichier |
| `is_stunned` non enforced dans COMBAT_ACTION_DECLARE | Dette connue PC42 — sprint dédié | `CLAUDE.md §Dettes` |
| Jet de défense CaC toujours déclenché, même si attaque échouée | LdB p.222 — test d'opposition = **les deux roulent toujours** (4 cas). Exception = surprise/inconscient uniquement. Code `resolveMeleeAction` CONFORME. | COM3 — vérifié Session 94 via `REGLES_Contact.md` |

> Avant de déclarer un bug, vérifier cette table. Si le comportement est ici → ne pas créer de correctif.

---

## TEMPLATE — Nouvelle entrée de bug

```markdown
### Bug [ID] — [Titre court]

**Symptôme** : [Ce que l'utilisateur observe exactement, dans quel scénario.]

**Règle** : [Référence règle Polaris si applicable — §X.Y MANUELSYSCOMBAT ou REGLESYSCOMBAT.]

**Code impliqué** : `fichier.js` — nom fonction, ligne approximative.

**Cause racine** [VÉRIFIÉ | HYPOTHÈSE | INCONNU] : [Explication technique de la cause, pas du symptôme.]

**[DBG-ID] suggestion** (si HYPOTHÈSE ou INCONNU) :
```js
console.log('[DBG-ID]', { variable1, variable2 })
```

**Travail partiel** (si applicable) : [Ce qui a été tenté mais pas validé.]

**Prochaine étape** : [Action exacte à prendre — cluster, sprint, ou investigation.]
```

---

## Audit des incohérences globales (Blocage d'un tour complet)1. Phase ROSTER (Initialisation & Structure des Données)L'incohérence : Absence de couplage "Roster $\leftrightarrow$ Action".La règle Polaris : L'initiative d'un personnage détermine à la fois quand il annonce et quand ses actions se résolvent.Le problème dans le code : Dans le store, le tableau roster et le tableau actions sont traités comme deux entités distinctes. En phase de Résolution, la Timeline bascule sur le tableau actions et perd le lien avec la valeur initiative du roster (votre code effectue un .find d'urgence pour récupérer l'INI, signe que la structure est découplée).Conséquence : Si un modificateur d'initiative survient pendant le tour (ex: blessure instantanée, action précipitée), la mise à jour de l'initiative dans le roster ne réordonne pas automatiquement la file des actions associées.2. Phase 1 : ANNONCE (Cinétique Tactique)L'incohérence : Absence de contrainte d'ordre sur le Store.La règle Polaris : L'ordre des annonces est strictement croissant (l'INI la plus basse parle en premier).Le problème dans le code : Votre store Zustand (combatStore.js) ne contient aucun verrou logicie ou index de slot actif pour la phase d'annonce. N'importe quel joueur peut émettre l'événement COMBAT_ACTION_DECLARE à tout moment. Le tri croissant n'est appliqué que visuellement dans le composant d'UI (CombatTimeline.jsx).Conséquence : Un joueur rapide (haute INI) peut soumettre son action avant un joueur lent, détruisant l'asymétrie tactique (l'avantage d'information) qui est le cœur du système Polaris.3. Transition ANNONCE $\rightarrow$ RÉSOLUTIONL'incohérence : Absence de pivot d'inversion automatique.La règle Polaris : Le passage à la résolution requiert la validation complète de toutes les intentions de combat, le calcul final des initiatives modifiées (ex: $+3$ pour action précipitée), et le bris des égalités par le dé caché.Le problème dans le code : Le store passe d'une phase à l'autre sans exécuter de routine de consolidation (il change simplement la chaîne phase et remet activeSlotIdx à 0).Conséquence : Les initiatives modifiées par les annonces ne sont pas figées avant d'entrer en résolution, ce qui rend l'ordre de la phase suivante instable ou faux.4. Phase 2 : RÉSOLUTION (Cinétique Physique)L'incohérence principale : Le tri à double niveau manquant.La règle Polaris : Cette phase doit exécuter les actions dans l'ordre décroissant des initiatives des personnages, ET pour un même personnage, dans l'ordre croissant de ses sous-sequences d'actions (Mouvement, puis Tir).Le problème dans le code : Le système actuel ne sait pas gérer ce double tri. Côté client, l'UI trie uniquement par séquence brute (a.sequence - b.sequence), ignorant l'initiative. Côté serveur, la progression par index unitaire (activeSlotIdx++) implique que le serveur considère que le tableau des actions est déjà parfaitement ordonné en base de données, ce qui est mathématiquement impossible sans une requête SQL avec un double ORDER BY.Conséquence : L'ordre d'exécution physique est chaotique. Un personnage lent peut blesser un personnage rapide avant que ce dernier n'ait pu déclencher son action.5. Fin de Tour (Maintenance des États)L'incohérence : L'amnésie des compteurs temporels.La règle Polaris : Les états physiques comme l'étourdissement (is_stunned) durent un nombre de tours (1d6).Le problème dans le code : La routine endTurn se contente de purger les modes éphémères du JSONB (comme is_rushed), mais ne possède pas de logique de décrémentation des compteurs numériques d'états persistants.Conséquence : Un personnage étourdi le restera indéfiniment ou devra être corrigé manuellement, car le système ne sait pas calculer l'expiration d'un effet au fil des rounds.La Spécification Mathématique d'un Tour Complet (Ce que le code doit valider)Pour qu'un tour fonctionne, l'ensemble de votre code (Moteur Serveur + Store + UI) doit s'aligner sur cette unique machine à états :[1. PHASE ROSTER]
   │  • Chargement des acteurs présents.
   │  • Calcul REA brute ──► Stockage dans 'base_initiative'.
   └──► [Génération automatique du jet caché de bris d'égalité]
         │
         ▼
[2. PHASE ANNONCE]
   │  • Tri de la file : CROISSANT (base_initiative + dé caché).
   │  • Le serveur bloque les entrées : Seul l'acteur à l'index actif peut annoncer.
   │  • Enregistrement des modificateurs d'action (ex: Précipité = +3 INI).
   └──► [Événement : Tous les acteurs ont 'has_announced: true']
         │
         ▼
[3. TRANSITION & CONSOLIDATION]
   │  • Calcul final : 'current_initiative' = base_initiative + modificateurs.
   │  • Génération de la file d'actions finale ordonnée.
         │
         ▼
[4. PHASE RÉSOLUTION]
   │  • Tri de la file : DOUBLE TRI (current_initiative DÉCROISSANT, puis sequence CROISSANT).
   │  • Déroulement pas-à-pas des slots d'actions.
   │  • Si un acteur passe 'is_stunned' ou meurt ──► Invalidation immédiate de ses slots futurs.
   └──► [Événement : Toutes les actions de la file sont consommées]
         │
         ▼
[5. FIN DE ROUND (endTurn)]
   │  • Incrémentation du compteur de Round.
   │  • Décrémentation des compteurs d'états (ex: stunned_duration - 1).
   │  • Remise à zéro des flags d'annonce et purge de la table des actions.
   └──► Retour à la Phase 1 (Annonce) pour le Round suivant.
   
Analyse de conformité globale : Mécanique Polaris vs CombatTimeline.jsx

L'analyse de votre code source (unique source de vérité côté client) démontre un décalage structurel profond entre l'implémentation de l'affichage et les règles de base du jeu de rôle Polaris. C'est ce décalage mathématique qui détruit l'ordre visuel et logique lors d'un tour de combat.
1. Diagnostic de la Phase d'Annonce
La Règle Polaris (LdB)

L'ordre d'annonce est strictement croissant. L'acteur ayant le score d'Initiative le plus bas doit obligatoirement être affiché en tête de liste, car c'est lui qui parle en premier.
Ce que fait votre code (Lignes 31 à 33)
JavaScript

if (phase === 'ANNOUNCEMENT') {
  cards = [...roster]
    .sort((a, b) => a.initiative - b.initiative)

    Statut de conformité : CONFORME. * Comportement constaté : Le tri soustrait b de a (ascendant). L'initiative la plus basse apparaît bien à gauche de la Timeline. L'UI respecte ici la cinétique tactique du livre de règles.

2. Le Nœud du Problème : La Phase de Résolution
La Règle Polaris (LdB)

À l'instant où le combat bascule en phase de Résolution, le temps physique s'inverse. L'ordre d'exécution devient strictement décroissant. L'acteur possédant la plus haute Initiative doit agir physiquement en premier, car sa vitesse lui donne l'opportunité de neutraliser un adversaire plus lent avant que ce dernier ne résolve son action.
Ce que fait votre code (Lignes 51 à 53)
JavaScript

} else {
  cards = [...actions]
    .sort((a, b) => a.sequence - b.sequence)

    Statut de conformité : NON CONFORME (Écart Logique Majeur).

    Comportement constaté : 1. Votre code trie le tableau des actions uniquement sur la propriété .sequence (le type d'action : Mouvement avant Assaut).
    2. Il omet totalement de trier par Initiative décroissante. Si l'action d'un personnage à l'initiative 6 (Lent) possède un identifiant ou une insertion de séquence plus ancienne en base de données que l'action d'un personnage à l'initiative 20 (Rapide), le personnage lent est affiché en premier dans la Timeline et reçoit le badge d'activation (isActive: idx === activeSlotIdx).

C'est l'explication technique exacte de votre bug : la Timeline en mode Résolution n'affiche pas l'ordre temporel des acteurs, mais l'ordre d'empilement brut des lignes d'actions en base de données.
3. L'Impact de l'Indicateur d'Activation (isActive)
Ce que fait votre code (Ligne 66)
JavaScript

isActive:      idx === activeSlotIdx,

En phase de Résolution, la carte est marquée comme active (le portrait s'agrandit et s'illumine) simplement si son index dans le tableau des actions correspond à l'index du slot géré par le serveur (activeSlotIdx).

Puisque le tableau cards n'est pas trié par initiative décroissante au préalable, l'index activeSlotIdx progresse de gauche à droite sur une suite d'acteurs totalement désordonnée par rapport à leurs scores d'INI.
Synthèse Logique de la Mécanique d'un Tour

Pour qu'un tour de combat soit égal au système Polaris, le cycle de traitement de votre composant doit appliquer le modèle logique suivant :

[ENTRÉE DU TOUR]
       │
       ├──► Phase = 'ANNOUNCEMENT' ──► Tri : a.initiative - b.initiative (Croissant)
       │
       └──► Phase = 'RESOLUTION'   ──► Tri Principal : b.initiative - a.initiative (Décroissant)
                                       Tri Secondaire: a.sequence - b.sequence (Ordre Physique)

Tant que le tableau de la phase de Résolution ne combine pas le tri décroissant de l'Initiative globale des personnages avec le tri croissant de leurs sous-séquences d'actions, le système visuel de la ligne de temps restera déynchronisé de la réalité mathématique des règles de Polaris.

Le bug de la "Super-Vitesse" (Lignes 118 à 124)

Dans ton code, il y a un composant appelé StateSelector qui permet de choisir sa vitesse (Allure : normal, rapide, etc.). Le problème est qu'à chaque changement de personnage, le code réinitialise l'allure sur "normal" par défaut.

    Pourquoi c'est bloquant : Si un joueur a annoncé au tour d'avant qu'il fuyait en courant (vitesse max), le code oublie cette information au début du nouveau tour. Pire, les modificateurs d'initiative liés à la course ne seront pas transmis correctement au serveur.
	
	Le point bloquant n°2 : Le piège des "Actions Intouchables"

Dans l'interface que tu as créée, le joueur peut cliquer sur des boutons pour choisir son action : "Assaut" (attaquer), "Se déplacer", "Recharger", etc.
Ce que dit le jeu Polaris :

Certaines actions demandent toute l'attention du personnage. Si tu décides de tirer (Assaut) ou de recharger ton arme, tu ne peux pas faire une autre action majeure en même temps. C'est ce qu'on appelle des actions exclusives.
Le problème dans ton fichier (Lignes 14 à 16 et l'affichage des boutons) :

Ton code liste bien ces actions interdites entre elles :
JavaScript

const EXCLUSIVE_ACTIONS = new Set(['attack', 'melee', 'reload', 'multi', 'interact'])

Mais dans l'interface, les boutons restent cliquables. L'IA n'a pas branché la sécurité qui grise ou bloque un bouton si le joueur a déjà choisi une action incompatible.

    Pourquoi c'est bloquant : Un joueur peut cocher "Assaut" ET cocher "Recharger" en même temps. L'interface va envoyer les deux au serveur. Le serveur (ou Claude Code) va s'emmêler les pinceaux car la base de données n'est pas prévue pour recevoir deux actions majeures sur un seul tour. Cela va écraser les données ou créer des lignes d'actions fantômes.
	
	Le point bloquant : L'arnaque de l'Armure Fantôme

Dans Polaris, chaque partie du corps est protégée par une valeur d'armure spécifique (un gilet pare-balles protège le corps, mais pas la tête). Pour savoir si un personnage a mal, le jeu tire au sort une localisation, puis soustrait l'armure de cette zone aux dégâts de l'arme.
Le problème dans ton fichier (Lignes 58 à 67) :

Dans l'affichage des résultats, ton code montre deux lignes textuelles distinctes :

    Dégâts bruts (la puissance de l'arme)

    Absorption (la valeur de l'armure)

Le problème, c'est que ton code prend une valeur magique nommée payload.absorption qui vient directement du clic de l'interface, de manière globale.

    Pourquoi c'est bloquant pour le vibe coding : L'armure ne peut pas être globale. Si l'IA calcule que le tir a touché la "Tête", mais que le bouton utilise l'absorption globale du "Corps" (parce que le personnage porte une combinaison), le calcul final des dégâts nets sera totalement faux par rapport aux règles de Polaris. L'IA va appliquer des blessures graves sur des zones qui auraient dû être blindées, ou inversement.
	
	L'annonce prématurée de la Mort (CombatResultPanels.jsx)

Dans ton code, il y a deux composants : un pour le Maître du Jeu (CombatResultGM) et un pour le Joueur (CombatResultPlayer).

Regardons la ligne 211, dans la version du joueur :
JavaScript

{isSuccess
  ? (is_lethal ? 'Vous êtes mortellement touché' : 'Vous êtes touché')
  : 'Vous esquivez le tir'
}

Ce que dit le jeu Polaris :

Dans Polaris, recevoir un tir ne signifie pas que tu meurs sur le coup, sauf si tes points de vie tombent à zéro ou si la blessure est techniquement classée comme "Mortelle" après un calcul précis.
Le problème dans ton fichier :

Ton code utilise une variable magique nommée is_lethal pour décider d'afficher "Vous êtes mortellement touché". Le problème, c'est que cette variable est lue directement depuis le résultat brut du jet de toucher.

    Pourquoi c'est bloquant pour le vibe coding : L'IA confond "Faire un coup critique au dé" et "Tuer le personnage". Dans Polaris, tu peux faire un super jet d'attaque (un critique), mais si la cible a une armure énorme (comme une combinaison de combat blindée), les dégâts finaux peuvent être réduits à zéro. Le joueur verra écrit "Vous êtes mortellement touché" alors qu'en réalité, son armure a tout arrêté et il n'a rien senti.
	
	1. Le point bloquant dans CombatGmDeclareWindow.jsx (Le panneau du GM)

Ce fichier est la copie conforme de la télécommande des joueurs, mais adaptée pour les monstres ou les PNJ gérés par le Maître du Jeu. L'IA y a laissé exactement la même erreur d'amnésie.
L'erreur de l'état par défaut (Lignes 17 à 24)

Regarde ce bloc en haut du fichier :
JavaScript

const STATE_DEFAULTS = {
  position:  'standing',
  weapon:    'holstered',
  fire_mode: 'cc',
  cover:     'exposed',
  vitesse:   'normal',
}

    Le problème : À chaque fois que le MJ ouvre la fenêtre d'un PNJ, le code réinitialise toutes ses positions par défaut. Si un PNJ était caché derrière un mur (cover: 'hidden') ou à terre au round précédent, le code le remet debout et à découvert automatiquement.

    Pourquoi c'est bloquant : Les règles de Polaris punissent sévèrement un personnage qui court à découvert. Si l'interface oublie qu'un PNJ s'est mis à l'abri, le calcul des modificateurs de tir au tour d'après sera complètement faussé.
	
	2. Le point bloquant dans CombatModifiersWindow.jsx (Les calculs de tirs)

Ce fichier est le cerveau mathématique qui applique les malus de portée, de lumière ou de mouvement avant de lancer le dé. Et là, il y a une grosse entorse aux règles de Polaris.
Le piège du cumul des vitesses (Lignes 19 à 24)

Le fichier liste les malus selon l'allure du tireur :

    Immobile : 0

    Allure lente : -3

    Allure moyenne : -5

    Le problème : Dans Polaris, le fait de courir ou de marcher s'applique différemment selon que l'on est en phase d'Annonce ou en phase de Résolution. Ici, le composant applique un malus fixe basé uniquement sur un bouton coché dans l'UI au moment du tir.

    Pourquoi c'est bloquant : Si Claude Code applique ce malus de manière statique, un personnage qui a annoncé "Je reste immobile" mais qui est forcé de bouger pendant la résolution (à cause d'une explosion ou d'une fuite) ne subira pas le bon malus. Les modificateurs doivent dépendre de l'action réelle validée par le serveur, pas du bouton sélectionné à la volée dans cette fenêtre.
	
	
1. Le point bloquant dans CombatInitStateWindow.jsx (L'État Initial)

Ce composant sert au moment où le combat se déclenche (Phase Roster). Il demande à chaque joueur : "Tu es debout ou allongé ? Ton arme est rangée ou sortie ?".
Le problème de logique (Lignes 25 à 27) :

Regarde comment le code va chercher l'état du personnage au chargement :
JavaScript

const [position,  setPosition]  = useState(entry?.state_position  ?? 'standing')
const [weapon,    setWeapon]    = useState(entry?.state_weapon    ?? 'holstered')
const [fireMode,  setFireMode]  = useState(entry?.state_fire_mode ?? 'cc')

    Le problème : Ces variables utilisent des propriétés nommées state_position ou state_weapon. Or, dans tout le reste de ton application et dans le fichier des PNJ (CombatGmDeclareWindow.jsx), ces mêmes états sont stockés dans un objet unique appelé STATE_DEFAULTS avec des clés comme position ou vitesse.

    Pourquoi c'est bloquant pour Claude Code : Il y a une double nomenclature. À cause de cela, l'IA va enregistrer l'état initial dans une case de la base de données, mais quand le tour va commencer (Phase d'Annonce), l'autre fenêtre ne trouvera pas l'information et remettra le personnage dans sa position par défaut. Le joueur va valider qu'il a son arme en main, et au moment de tirer, le jeu lui dira : "Désolé, ton arme est rangée".
	
	2. Le point bloquant dans CombatRosterWindow.jsx (Le Roster du MJ)

Ce grand tableau permet au MJ de voir l'initiative de tout le monde, la santé, et quelles pièces d'armure protègent quelles zones (Tête, Corps, Bras, Jambes).
Le piège de l'Armure Statique (Lignes 11 à 18) :

Le code utilise une fonction pour extraire l'armure d'un équipement :
JavaScript

function getCoverage(location) {
  if (!location) return {}
  const parts = new Set(location.split('/'))
  return { T: parts.has('T'), C: parts.has('C'), B: parts.has('B'), J: parts.has('J') }
}

    Le problème : Ce tableau liste l'armure de manière purement informative pour le MJ. Mais à aucun moment ce composant ne communique avec la fenêtre des dégâts (CombatDamageWindow.jsx) que nous avons analysée plus tôt.

    Pourquoi c'est bloquant : Si le MJ utilise ce tableau pour vérifier les forces en présence, mais que Claude Code a codé la résolution des dégâts de son côté avec une logique d'armure globale, le MJ va voir qu'un PNJ a un casque (Tête protégée), mais le moteur de résolution va quand même appliquer la réduction d'armure globale sur un tir dans les jambes.
	
	Le point bloquant : Le conflit des "Modes de Vue"

Dans Polaris, la phase d'Annonce et la phase de Résolution sont étanches (on ne fait pas la même chose dans l'une et dans l'autre).
Le problème dans ton fichier (Lignes 37 à 57) :

Regarde comment le composant décide d'afficher les fenêtres pour un joueur :
JavaScript

const showInitState = phase === 'ROSTER' && playerToken && !isGm
const showActionWin = phase === 'ANNOUNCEMENT' && activeTokenId === playerToken?.id && !isGm

Jusqu'ici tout va bien. Le problème arrive juste après, avec les fenêtres de résultats (les pop-ups comme attackResult ou damagePayload). Ces variables sont passées au fichier de manière globale, sans vérifier la phase actuelle du combat.

    Pourquoi c'est bloquant pour Claude Code : Si un joueur est en train de remplir sa télécommande en phase d'Annonce (il choisit son action tranquillement), et qu'un autre joueur ou le MJ déclenche un reliquat de jet de dés de la phase précédente, le serveur va envoyer un résultat.
    Puisque CombatOverlay.jsx ne filtre pas si le pop-up a le droit de s'ouvrir pendant l'Annonce, le bandeau de résultat va surgir au milieu de l'écran du joueur, lui coupant sa déclaration en cours.

Dans Polaris, les fenêtres de résolution d'attaques et de dégâts ne doivent avoir le droit de s'ouvrir QUE si le combat est en phase RESOLUTION.

1. Le point bloquant absolu dans combatStore.js (La Mémoire Vive)

Ce fichier dit à ton application qui est en train de jouer et ce qu'il se passe.
Regarde la ligne 10 :
JavaScript

activeTokenId: null,  // token_id du slot actif (ANNOUNCEMENT et RESOLUTION)

    Le problème : Ton code utilise la même unique variable (activeTokenId) pour savoir qui doit parler en phase d'Annonce ET qui doit agir en phase de Résolution.

    Pourquoi c'est un piège mortel pour Claude Code : Comme on l'a vu au tout début, l'Annonce va dans un sens (du moins fort au plus fort) et la Résolution va dans l'autre (du plus rapide au plus lent).
    Si tu as une seule variable pour les deux, dès que le serveur change de phase, l'IA se mélange les pinceaux : elle applique l'index de la phase d'Annonce sur le tableau de Résolution. C'est pour ça que tes personnages s'allument en mode "C'est ton tour !" de manière complètement aléatoire.
	
	2. L'incohérence cachée dans combatSections.js (La Matrice des Règles)

Ce fichier est super, c'est ta base de données de règles (les coûts pour dégainer, se coucher, etc.). Mais l'IA a oublié de lier ces chiffres à la réalité mathématique de Polaris.
Regarde les Allures de déplacement (Lignes 39 à 43) :
JavaScript

export const MOVE_ZONE_DEFS = [
  { allureKey: 'normal',  action_key: 'move_normal',   ini_mod:  0, color: '#3b82f6', label: 'Normal'  },
  { allureKey: 'fast',    action_key: 'move_fast',     ini_mod: -2, color: '#eab308', label: 'Rapide'  },
  { allureKey: 'max',     action_key: 'move_max',      ini_mod:  0, color: '#ef4444', label: 'Max'     },
]

    Le problème : Regarde bien les ini_mod (les modificateurs d'Initiative). L'allure Rapide donne un malus de -2. L'allure Max (courir comme un fou) donne un modificateur de 0.

    Pourquoi c'est bloquant : C'est illogique. Dans Polaris, plus tu cours vite, plus tu bouscules le timing du tour (tu es plus difficile à toucher mais tu tires très mal). Mettre 0 à l'allure Max va faire croire à Claude Code que courir à fond n'a aucun impact sur l'initiative du personnage.
	
	3. Le nettoyage : CombatWindows.jsx (Le fichier fantôme)

En lisant ce fichier, on s'aperçoit que c'est un vieux composant de test écrit de manière très compacte (il recrée une fausse Timeline à la main avec des données écrites en dur comme Kaelen ou Maître Orsa).

    Le conseil Méta : Ce fichier n'est pas branché sur ton vrai store Zustand. Si Claude Code va piocher dedans par erreur pour copier des morceaux de code, il va réimporter de vieilles fonctions périmées. Tu n'as pas besoin de le modifier, tu peux dire à Claude Code de l'ignorer complètement.

---

## Bugs drone — Session 89 (2026-06-11) — Non résolus

### Bug D1 — Menu radial "fiche" drone : rien ne s'ouvre

**Symptôme** : Clic sur "fiche" dans le menu radial d'un token drone → rien ne s'ouvre. Fonctionne correctement pour les tokens humanoïdes (PJ/PNJ).

**Code impliqué** : `SessionPage.jsx` — IIFE du menu radial, `characters.find(c => c.id === contextMenu.token.character_id)`.

**Cause racine** [HYPOTHÈSE] : Ce `find` retourne `undefined` pour un token drone, alors qu'il réussit pour les humanoïdes. Piste principale : mismatch de type entre `character.id` dans le store characters (string depuis JSON API) et `token.character_id` dans le store tokens (number depuis DB via API tokens). Investigation bloquée — non reproductible en lecture seule.

**[DBG-D1] suggestion** :
```js
console.warn('[DBG-D1]', { tokenCharId: contextMenu.token.character_id, storeIds: characters.map(c => c.id) })
```
Ajouter dans la IIFE du menu radial `SessionPage.jsx` avant le `find` pour comparer types et valeurs.

**Ce qui a été tenté** :
- Architecture `openSheet` centralisée (dispatcher unique par `character.type`) — correcte mais inefficace si `character` est null
- Les deux stores (characters, tokens) semblent cohérents en lecture de code — la discordance n'est pas visible sans debug runtime

**Prochaine étape** : Instrumenter avec [DBG-D1], reproduire le clic "fiche" sur un drone, lire la console.

---

### Bug D2 — Token drone : changement de GLB non fonctionnel

**Symptôme** : Upload d'un nouveau GLB pour un drone via DroneWindow → token 3D ne se met pas à jour visuellement.

**Code impliqué** : `Canvas3D.jsx:879` — `characters.find(c => c.id === token.character_id)` pour calculer `glbUrl`. `Canvas3D.jsx:246` — `key={glbUrl}` sur `TokenGlbErrorBoundary`.

**Cause racine** [HYPOTHÈSE] : Même cause racine que D1. Si le drone n'est pas trouvé dans `characters`, `glbUrl = defaultTokenGlbUrl` (constante). `key` ne change jamais → pas de remontage → pas de rechargement GLB.

**Fix partiel appliqué** : `key={glbUrl}` sur `TokenGlbErrorBoundary` + `updateCharacter(res.data.character)` dans `DroneWindow.SettingsTab.handleGlbUpload`. Correcte en théorie, inefficace tant que D1 n'est pas résolu.

---

## Bugs Session 91 — CombatDeclareLog (2026-06-11) — Non résolus

### Bug CL1 — Timeline joueur : portraits PNJ non visibles

**Symptôme** : Côté joueur uniquement, certains portraits dans la timeline de combat ne s'affichent pas. Exemple observé : PNJ "Soleil" sans portrait. Côté GM : OK.

**Code impliqué** : `CombatTimeline.jsx` — rendu des portraits. Probable dépendance à `characters` (store characterStore) qui ne contient côté joueur que les personnages appartenant au joueur, pas les PNJ GM.

**Cause racine** [HYPOTHÈSE] : La timeline joueur tente de résoudre le portrait via `characters.find(c => c.id === token.character_id)` — retourne `undefined` pour les PNJ non chargés dans le store joueur → fallback image absente ou non rendue.

**Prochaine étape** : Lire `CombatTimeline.jsx` — vérifier comment le portrait est résolu et si un fallback visible existe pour les tokens sans `character` dans le store.

---

### Bug CL2 — CombatDeclareLog : design et divergence GM/joueur

**Symptôme** : La fenêtre de déclarations est visuellement différente côté GM (flottant standalone) et côté joueur (intégrée dans CombatActionWindow). Design jugé mauvais dans les deux cas.

**Référence visuelle** : Le rendu GM (screenshot gauche Session 91) est la référence cible — à reproduire côté joueur.

**Code impliqué** :
- `client/src/components/CombatDeclareLog.jsx` — version GM (floatante, avec header draggable, titre "DÉCLARATIONS · TOUR N")
- `client/src/components/CombatActionWindow.jsx` — `declareLogSection` intégré (branches read-only), titre généré via `W.sectionTitle`
- `client/src/index.css` — classes `.combat-declare-log-*`

**Note architecture** : Les deux versions partagent les mêmes classes CSS mais la structure JSX diffère (header, wrapper, titre). Aligner la structure du `declareLogSection` joueur sur celle de `CombatDeclareLog` GM.

---

### Bug CL3 — Ghosts de déplacement d'annonce disparus

**Symptôme** : Les marqueurs visuels ("ghosts") indiquant la destination de déplacement annoncée par chaque acteur ne s'affichent plus sur la carte pendant la phase ANNOUNCEMENT.

**Code impliqué** : `CombatOverlay.jsx` — `announcementMarker` state + rendu des ghosts sur le canvas. `SessionPage.jsx` — handler `COMBAT_ACTION_DECLARED` qui set `announcementMarker`.

**Cause racine** [HYPOTHÈSE] : `announcementMarker` est toujours alimenté côté `SessionPage.jsx`. La régression est probablement dans le rendu — vérifier si le composant ou la condition d'affichage du ghost a été modifié lors des sessions 88-91.

**Prochaine étape** : Lire `CombatOverlay.jsx` — rechercher `announcementMarker` et la condition de rendu du ghost.

---

## Bugs Session 91 — Sprint CaC Drone (2026-06-12) — Non résolus

### Bug DC1 — Drone CaC : flow de résolution incorrect (Sprint CaC dédié)

**Symptôme** : Un drone déclarant une attaque `armement_contact` (`fire_mode = 'cc'`) se voyait présenter `CombatModifiersWindow` (fenêtre distance — requiert portée), qui ne peut pas fonctionner pour un CaC.

**Contexte règles** : §7.4 MANUELSYSCOMBAT — `armement_contact` = test simple D20 ≤ niveau programme. Pas de test d'opposition (contrairement au CaC humanoïde §6.2). Pas de fenêtre modificateurs portée. Pas de modificateur portée (contact physique = portée satisfaite par définition, modificateur = 0). ⚠️ Le `portee = 'bout_portant'` du travail partiel est lui-même un bug → voir **Bug DC3**.

**Code impliqué** :
- `client/src/components/CombatOverlay.jsx` — conditions d'affichage "Agir" vs `CombatModifiersWindow`
- `server/src/socket/index.js` — `resolveDroneAssaultAction` — gestion `armement_contact`

**Travail partiel effectué (non approuvé, Session 91)** :
- `CombatOverlay.jsx` : `isDroneCaC = !!(activeAssaultAction?.drone_weapon_inv_id && activeAssaultAction?.fire_mode === 'cc')` ajouté. "Agir" affiché pour drone CaC (comme PNJ CaC humanoïde). `CombatModifiersWindow` exclu pour drone CaC.
- `resolveDroneAssaultAction` : `portee = 'bout_portant'` pour `armement_contact`, situation mods lus depuis `confirmedModifiers?.situation ?? []`.

**Prochaine étape** : Sprint CaC dédié — à démarrer dans une session séparée. Modèle à suivre : résolution CaC humanoïde PJ (Phase 2 Résolution côté joueur — jamais testé). Adapter pour drone sans copier le modèle distance.

---

### Bug DC2 — Drone ranged : mods de situation jamais appliqués

**Symptôme** : Dans `resolveDroneAssaultAction`, les modificateurs de situation (`confirmedModifiers.situation`) n'étaient jamais pris en compte. L'ancien code itérait `SITUATION_MODS` et vérifiait `confirmedModifiers?.[k]` (propriété directe) au lieu de lire le tableau `confirmedModifiers.situation`.

**Cause racine** [VÉRIFIÉ] : Pattern incorrect — `confirmedModifiers.situation` est un tableau de clés (`['cible_au_sol', ...]`), pas un objet avec des propriétés booléennes.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` (section calcul `totalModComp` et breakdown).

**Travail partiel effectué (non approuvé, Session 91)** :
```js
// Correctif appliqué (non validé fonctionnellement) :
const situationMods = confirmedModifiers?.situation ?? []
totalModComp += situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
```

**Prochaine étape** : Valider fonctionnellement lors du Sprint CaC — ce correctif concerne aussi bien les attaques distance que contact.

---

### Bug DC3 — Drone CaC : modificateur `bout_portant` (+5) appliqué à tort

**Symptôme** : `resolveDroneAssaultAction` applique systématiquement `portee = 'bout_portant'` pour `armement_contact`, ce qui ajoute +5 à `chancesDeReussite` via `PORTEE_MOD_COMP`.

**Cause racine** [VÉRIFIÉ] : CaC = présence physique ≤ 3m par définition — la portée n'est pas un modificateur applicable au contact physique. Le +5 est sémantiquement et mécaniquement incorrect.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` ligne ~3732.

```js
// Actuel (bug) :
const portee = (category === 'armement_contact') ? 'bout_portant' : (confirmedModifiers?.portee ?? 'courte')
let totalModComp = PORTEE_MOD_COMP[portee] ?? 0   // → +5 appliqué à tort

// Correction :
const porteeModComp = (category === 'armement_contact')
  ? 0
  : (PORTEE_MOD_COMP[confirmedModifiers?.portee] ?? 0)
let totalModComp = porteeModComp
```

Retirer aussi `porteeModDrone` du breakdown (ligne ~3752) pour `armement_contact`.

**Modificateurs légitimes pour `armement_contact` (§7.3 MANUELSYSCOMBAT) :**
- Portée : **NON** (0 — contact physique)
- Taille cible : OUI
- Obscurité : OUI
- Couverture : OUI

**Prochaine étape** : Sprint CaC Drone — corriger avec DC1 dans la même session.

---

## Bugs Session 93-4 — Test CaC Étape 3 (2026-06-15) — Nouveaux

### Bug UI1 — Fenêtre déclaration : design tout blanc / dégueulasse

**Symptôme** : La fenêtre de déclaration GM (`CombatGmDeclareWindow`) et/ou joueur (`CombatActionWindow`) a un design visuel dégradé (fond blanc, absence de styles).

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx`, `client/src/index.css` Section 11.

**Prochaine étape** : Audit CSS combat — comparer les classes appliquées avec Section 11 de `index.css`. Sprint Design dédié.

---

### Bug COM1 — Recharger : action ne fait rien (humanoïde)

**Symptôme** : En combat humanoïde, déclarer l'action "Recharger" et la résoudre n'a aucun effet observable.

**Cause racine** [INCONNU] : Non encore investigué — `resolveReloadAction` peut être absent, ou l'état `weapon_loaded` non persisté en base.

**[DBG-COM1] suggestion** :
```js
console.log('[DBG-COM1] reload handler reached', { actionType, tokenId, weaponInvId })
```
Ajouter au début du handler `COMBAT_ACTION_CONFIRM` pour vérifier si le type `reload` est bien routé.

**Code impliqué** : `server/src/socket/index.js` — `COMBAT_ACTION_CONFIRM` → handler reload. À vérifier : est-ce que `resolveReloadAction` (ou équivalent) est appelé ? Est-ce que l'état de l'arme (chargée/vide) est tracké en base ?

**Prochaine étape** : Lire le handler reload dans `index.js`, vérifier la route et la persistance.

---

### Bug COM2 — Vérification statut arme non appliquée pour PNJ GM

**Symptôme** : Côté joueur, il existe une vérification que l'arme est "au clair" avant de pouvoir attaquer. Cette vérification n'a pas été reproduite pour les PNJs contrôlés par le GM dans `CombatGmDeclareWindow`.

**Code impliqué** : `client/src/components/CombatActionWindow.jsx` (vérification joueur), `CombatGmDeclareWindow.jsx` (absence vérification GM).

**Prochaine étape** : Identifier la vérification exacte dans CombatActionWindow, la porter dans CombatGmDeclareWindow.

---

### ~~Bug COM3~~ — FAUX BUG — Jet de défense CaC (Session 94)

> ⛔ **FAUX BUG — NE PAS CORRIGER.** Voir table FAUX BUGS ci-dessus.

**Symptôme initial** : Jet de défense déclenché même si l'attaquant échoue.

**Verdict LdB** (`REGLES_Contact.md` p.222) : test d'opposition CaC = **les deux roulent toujours**. 4 cas documentés dont "A rate, D réussit" et "Les deux ratent". La référence règle originale ("§6.2 — défense uniquement si attaque réussie") était incorrecte. Le code `resolveMeleeAction` est conforme.

**Si UX confuse** (joueur PJ reçoit prompt défense alors que l'attaque a déjà raté visuellement) → créer Bug UI distinct, sprint UX dédié.

---

### Bug COM4 — CaC exige statut "Arme au clair" alors que mains nues possibles

**Symptôme** : Le système refuse ou grise le CaC si l'arme n'est pas "au clair", alors qu'une attaque à mains nues ne requiert pas d'arme équipée.

**Règle** : CaC à mains nues = action libre, pas de pré-requis statut arme.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` et/ou `CombatActionWindow.jsx` — condition d'autorisation CaC.

**Prochaine étape** : Identifier la condition `state_weapon === 'drawn'` ou équivalent et la rendre optionnelle pour CaC mains nues.

---

### Bug COM5 — Fenêtre Annonce GM, CaC : clic "mode combat" sélectionne aussi la cible (incohérence GM/Joueur)

**Symptôme** : Côté GM (`CombatGmDeclareWindow`), cliquer sur un mode de combat (ex: "Offensif") sélectionne simultanément la cible. Côté joueur (`CombatActionWindow`), sélection mode de combat et sélection cible sont deux gestes distincts.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` — handler sélection mode combat + logique cible.

**Prochaine étape** : Dissocier les deux actions côté GM — le clic sur mode combat ne doit pas auto-sélectionner une cible.

---

### Bug COM6 — Arme CaC détectée non sélectionnée par défaut (GM et joueur)

**Symptôme** : Quand une arme de corps à corps est présente dans l'équipement du personnage, elle n'est pas pré-sélectionnée par défaut dans la fenêtre de déclaration. L'utilisateur doit manuellement la choisir.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `selectedGmMeleeWeaponId` (init à `null`). `CombatActionWindow.jsx` — équivalent joueur.

**Prochaine étape** : Initialiser `selectedGmMeleeWeaponId` avec la première arme CaC disponible depuis `equipment[activeTokenId]`, après le fetch.

---

### Bug COM7 — Multi-attaque CaC : duplicata / "Déclarer" grisé

**Symptôme** : L'option "multi-attaque" CaC semble un duplicata de "Attaque multiple" (existante). Quand sélectionnée, le bouton "Déclarer" reste grisé. Vérifier la pertinence règles et corriger si conservée.

**Règle à vérifier** : §6.2 MANUELSYSCOMBAT — attaque multiple melee (Sprint CaC 4b déjà planifié).

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `meleeAttackCount` / `meleePendingMode`. `canDeclare` ou équivalent grisé.

**Prochaine étape** : Audit règles Polaris §6.2 — si "multi-attaque" et "attaque multiple" sont identiques, supprimer le duplicata. Sinon corriger le guard `canDeclare`.

---

### Bug COM8 — Fenêtre d'annonce non masquée lors de la sélection de cible

**Symptôme** : Quand le joueur ou le GM entre en mode sélection de cible (à distance, au CaC, ou sélection destination déplacement), la fenêtre d'annonce reste visible et encombre l'écran.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx` — gestion `combatTargetMode` / `onEnterTargetMode` / `onEnterMoveMode`. `CombatOverlay.jsx` — condition de rendu des fenêtres.

**Prochaine étape** : Ajouter condition `!combatTargetMode && !combatMoveMode` au rendu des fenêtres d'annonce.

---

### Bug DR1 — Drone : arme non sélectionnée par défaut

**Symptôme** : Dans la fenêtre de déclaration GM pour un drone, aucune arme n'est pré-sélectionnée par défaut. `selectedDroneWeaponId` reste `null` jusqu'à sélection manuelle.

**Lien** : Bug COM6 (même problème, version drone). `canDeclareDrone` reste `false` tant qu'aucune arme n'est choisie.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `selectedDroneWeaponId` (init null), `droneWeapons` fetch (lines 158-163).

**Prochaine étape** : Après le fetch `droneWeapons`, si `selectedDroneWeaponId === null && droneWeapons.length > 0`, setSelectedDroneWeaponId(droneWeapons[0].id).

---

### Bug DR2 — Drone : aucune action de déplacement disponible

**Symptôme** : Dans la fenêtre de déclaration GM pour un drone, il n'existe aucun bouton / option pour déclarer un déplacement. Les drones peuvent pourtant se déplacer selon les règles.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — section rendu drone (isActiveDrone). La section drone affiche uniquement sélection arme + sélection cible, pas de déplacement.

**Prochaine étape** : Sprint dédié — ajouter le déplacement drone (similaire au déplacement PNJ humanoïde, mêmes allures).

---

### Bug DR3 — Drone CaC : fenêtre de modificateurs "Distance" présentée à tort

**Note** : Identique à Bug DC1 + DC3 déjà documentés ci-dessus. Confirmé lors du test Session 93-4.

Résolution drone CaC → `CombatCacModifiersWindow` doit être utilisée (comme pour PNJ humanoïde CaC), pas `CombatModifiersWindow` (distance).

**Prochaine étape** : Voir DC1 + DC3 ci-dessus.

---

## Bug B6 — Drone : localisation cible null (Sessions 89/94)

**Symptôme** : `resolveDroneAssaultAction` branch 8a (cible = drone) envoie `localisation: null` dans le payload de résolution. La zone d'impact n'est pas calculée.

**Cause racine** [VÉRIFIÉ] : Le code ne lit pas `droneSheet.localisation_ref` pour les cibles drone.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3997).

```js
// Correction :
localisation: droneSheet.localisation_ref ?? 'corps'
```

**Référence règles** : §7.6 MANUELSYSCOMBAT — drone = zone unique fixe (`localisation_ref`). Voir aussi `docs/REWORK_CONTACT.md` §B6.

**Prochaine étape** : Sprint A logique combat.

---

## Bugs Session 93-5 — Pipeline dégâts drone (2026-06-15)

### Bug DMG1 — DICE_RESULT dégâts drone : label "Compétence" sémantiquement faux

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Compétence : 41" alors que 41 = rawDice (résultat des dés de dégâts). Le label "Compétence" est celui des cartes d'attaque — réutilisé à tort dans le contexte dégâts.

**Cause racine** [VÉRIFIÉ] : `mechanicalTotal: rawDice` dans le payload DICE_RESULT branch 8a. Le client affiche le label générique "Compétence" pour `mechanicalTotal`, non contextualisable sans modification client ou ajout de champ.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3992).

**Prochaine étape** : Cluster I — modifier `skillLabel` pour inclure l'info intégrité (proposition session 93-5), ou ajouter champ `mechanicalLabel` au payload DICE_RESULT.

---

### Bug DMG2 — DICE_RESULT dégâts drone : label "Seuil" sémantiquement faux

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Seuil : 47" alors que 47 = degatsNets. "Seuil" désigne le seuil D20 de réussite d'un jet d'attaque — invalide dans un contexte dégâts.

**Cause racine** [VÉRIFIÉ] : `chancesDeReussite: degatsNets` dans le payload DICE_RESULT. Le client affiche "Seuil" pour ce champ, label générique non contextuel.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3993). Client : composant rendu DICE_RESULT.

**Prochaine étape** : Même sprint que DMG1.

---

### Bug DR4 — calcDroneRD : RD négatif pour drone en bonne santé → dégâts augmentés

**Symptôme** : Un drone avec `integrite_actuelle = 15` prend 3 dégâts *supplémentaires* au lieu de bénéficier d'une résistance. Exemple : degautsBruts=44, blindage=15, RD calculé=-3 → degatsNets = 44 − 15 − (−3) = **32** au lieu de 29.

**Cause racine** [VÉRIFIÉ] :
```
calcDroneRD(15) → rdInput = 15 × 2 = 30
→ RD_TABLE[{ min:30, max:33, rd:-3 }] → retourne -3
→ degatsNets = degautsBruts − blindage − (−3) = +3 dégâts supplémentaires
```
La `RD_TABLE` (`charStats.js` ligne 93) est conçue pour les sommes FOR+CON humanoïdes (plage typique 4–16 → rd positif = protection). Pour les drones, `integrite × 2` atteint 20–40, plage "hauts scores" où rd vaut 0 à -5 dans la table. Résultat : plus un drone est en bonne santé, plus il prend de dégâts — sens **inverse** de ce que dicte le LdB.

**Règle LdB** (`REGLEDRONE.md`) : *"la Résistance aux dommages peut être calculée en multipliant l'Intégrité actuelle par deux, et en se référant au tableau correspondant (page 112)"*. La table p.112 doit être vérifiée pour confirmer l'orientation des valeurs dans la plage 20-40.

**[DBG-DR4] suggestion** :
```js
console.log('[DBG-DR4]', { integrite: droneSheet.integrite_actuelle, rdInput: droneSheet.integrite_actuelle * 2, rdDrone, degautsBruts, degatsNets })
```

**Code impliqué** : `server/src/socket/index.js` — `calcDroneRD` (~ligne 4472). `server/src/lib/charStats.js` — `RD_TABLE` (ligne 93).

**Prochaine étape** : Cluster I — vérifier table LdB p.112 pour la plage 20-40. Si les hautes valeurs doivent donner une protection positive → créer `DRONE_RD_TABLE` dédiée ou corriger l'orientation de `RD_TABLE`.

---

### Note DR5 — drone_sheet.resistance_dommages : ✅ RÉSOLU — colonne supprimée en migration 72

**Migration 72** (`72_drone_sheet_fix.js`) supprime déjà `resistance_dommages` (+ `iv`, `survie_iem`, `architecture`, `structure_materiau`) — identifiés sans source LdB. Colonne absente du schéma actuel. Aucune action requise.

---

### Bug DR6 — Blindage drone non lu lors de la résolution (Blindage:0 affiché malgré valeur DB = 15)

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Blindage:0 RD:0" alors que `drone_sheet.blindage = 15` en base pour le drone ciblé. Le blindage n'est pas soustrait des dégâts.

**Cause racine** [HYPOTHÈSE] : Le code lit `droneSheet.blindage ?? 0` — logiquement correct si la colonne existe et vaut 15. Causes possibles :
- `cibleCharacter.id` ne matche pas le bon `drone_sheet.character_id` → `droneSheet` récupéré appartient à un autre drone (blindage=0)
- Knex retourne la colonne sous un autre nom (improbable, snake_case standard)
- La valeur 15 a été persistée APRÈS le test (données modifiées entre test et lecture du screenshot)

**[DBG-DR6] suggestion** :
```js
// Ajouter après `const droneSheet = await db('drone_sheet')...`
console.log('[DBG-DR6]', {
  cibleCharId: cibleCharacter.id,
  droneSheetFound: !!droneSheet,
  blindage: droneSheet?.blindage,
  integrite: droneSheet?.integrite_actuelle,
})
```

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3976-3984).

**Prochaine étape** : Phase 2b — ajouter [DBG-DR6], SR, reproduire l'attaque drone → vérifier console serveur.

---

### TODO-DRONE-1 — Tooltips champs blindage / armure / blindage IEM (UI DroneWindow)

**Besoin** : Les champs "BLINDAGE", "ARMURE", "BLINDAGE IEM" dans la fiche drone n'ont pas d'explication. L'utilisateur ne peut pas distinguer :
- **Blindage** = valeur entière soustraite des dégâts physiques (mécanique active)
- **Armure** = matériau de construction (informatif, non mécanique)
- **Blindage IEM** = protection contre impulsions électromagnétiques

**Prochaine étape** : Sprint UI dédié — ajouter tooltips ⓘ sur ces trois champs dans DroneWindow.

---

## Bugs divers — Dette technique

### Bug INI1 — Surprise critique : roll=1 → initiative=1

**Symptôme** : Un jet de dé donnant 1 (critique) produit une initiative finale de 1 au lieu d'être calculée normalement.

**Cause racine** [INCONNU] : Non encore investigué — peut être un cas limite dans le calcul `REA + dé caché` (roll=1 interprété comme critique et court-circuitant le calcul normal).

**[DBG-INI1] suggestion** :
```js
console.log('[DBG-INI1] initiative calc', { roll, rea, hiddenDie, finalInitiative })
```
Ajouter au point de calcul de l'initiative finale pour capturer le cas roll=1.

**Code impliqué** : Non identifié — vérifier la logique initiative dans `server/src/socket/index.js` (calcul REA + dé caché).

**Prochaine étape** : Investigation dédiée.

---

### Bug WS1 — WorkshopPage crash import invalide

**Symptôme** : Handler d'erreur accède `err.response?.data?.error` — structure absente sur certaines erreurs → crash ou message vide.

**Correction** : `err.response?.data?.message ?? err.message`.

**Code impliqué** : `client/src/pages/WorkshopPage.jsx` — handler catch.

---

### Dette AU1 — useDiceAudio.js : sons dés manquants

**Symptôme** : Aucun son lors du lancer de dés (animation 3D muette).

**Code impliqué** : `client/src/lib/useDiceAudio.js` — non branché.

**Prochaine étape** : Sprint audio dédié.

---

### Dette TC1 — .gitattributes:3 : attribut invalide

**Symptôme** : Ligne 3 de `.gitattributes` contient un attribut inconnu de Git → warning au clone/fetch.

**Code impliqué** : `.gitattributes` ligne 3.

**Prochaine étape** : Corriger lors d'un commit de nettoyage.

---

### Dette DCO1 — onTokenRotate : dead code Canvas3D/Scene

**Symptôme** : Handler `onTokenRotate` déclaré mais non utilisé dans `Canvas3D.jsx` ou `Scene`.

**Code impliqué** : `client/src/components/Canvas3D.jsx`.

**Prochaine étape** : Supprimer lors d'un sprint nettoyage.

---

### Dette VX1 — getVoxelSurfaceTop : pas de cas slope/wedge

**Symptôme** : `getVoxelSurfaceTop` retourne `y+1.0` par défaut pour tous les voxels non-cube. Les types slope/wedge devraient retourner une valeur intermédiaire.

**Code impliqué** : `client/src/components/Canvas3D.jsx` — `getVoxelSurfaceTop`.

**Note** : Comportement `y+1.0` acceptable pour V1.

**Prochaine étape** : Sprint voxels v2 — hors scope V1.