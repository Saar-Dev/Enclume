Audit des incohérences globales (Blocage d'un tour complet)1. Phase ROSTER (Initialisation & Structure des Données)L'incohérence : Absence de couplage "Roster $\leftrightarrow$ Action".La règle Polaris : L'initiative d'un personnage détermine à la fois quand il annonce et quand ses actions se résolvent.Le problème dans le code : Dans le store, le tableau roster et le tableau actions sont traités comme deux entités distinctes. En phase de Résolution, la Timeline bascule sur le tableau actions et perd le lien avec la valeur initiative du roster (votre code effectue un .find d'urgence pour récupérer l'INI, signe que la structure est découplée).Conséquence : Si un modificateur d'initiative survient pendant le tour (ex: blessure instantanée, action précipitée), la mise à jour de l'initiative dans le roster ne réordonne pas automatiquement la file des actions associées.2. Phase 1 : ANNONCE (Cinétique Tactique)L'incohérence : Absence de contrainte d'ordre sur le Store.La règle Polaris : L'ordre des annonces est strictement croissant (l'INI la plus basse parle en premier).Le problème dans le code : Votre store Zustand (combatStore.js) ne contient aucun verrou logicie ou index de slot actif pour la phase d'annonce. N'importe quel joueur peut émettre l'événement COMBAT_ACTION_DECLARE à tout moment. Le tri croissant n'est appliqué que visuellement dans le composant d'UI (CombatTimeline.jsx).Conséquence : Un joueur rapide (haute INI) peut soumettre son action avant un joueur lent, détruisant l'asymétrie tactique (l'avantage d'information) qui est le cœur du système Polaris.3. Transition ANNONCE $\rightarrow$ RÉSOLUTIONL'incohérence : Absence de pivot d'inversion automatique.La règle Polaris : Le passage à la résolution requiert la validation complète de toutes les intentions de combat, le calcul final des initiatives modifiées (ex: $+3$ pour action précipitée), et le bris des égalités par le dé caché.Le problème dans le code : Le store passe d'une phase à l'autre sans exécuter de routine de consolidation (il change simplement la chaîne phase et remet activeSlotIdx à 0).Conséquence : Les initiatives modifiées par les annonces ne sont pas figées avant d'entrer en résolution, ce qui rend l'ordre de la phase suivante instable ou faux.4. Phase 2 : RÉSOLUTION (Cinétique Physique)L'incohérence principale : Le tri à double niveau manquant.La règle Polaris : Cette phase doit exécuter les actions dans l'ordre décroissant des initiatives des personnages, ET pour un même personnage, dans l'ordre croissant de ses sous-sequences d'actions (Mouvement, puis Tir).Le problème dans le code : Le système actuel ne sait pas gérer ce double tri. Côté client, l'UI trie uniquement par séquence brute (a.sequence - b.sequence), ignorant l'initiative. Côté serveur, la progression par index unitaire (activeSlotIdx++) implique que le serveur considère que le tableau des actions est déjà parfaitement ordonné en base de données, ce qui est mathématiquement impossible sans une requête SQL avec un double ORDER BY.Conséquence : L'ordre d'exécution physique est chaotique. Un personnage lent peut blesser un personnage rapide avant que ce dernier n'ait pu déclencher son action.5. Fin de Tour (Maintenance des États)L'incohérence : L'amnésie des compteurs temporels.La règle Polaris : Les états physiques comme l'étourdissement (is_stunned) durent un nombre de tours (1d6).Le problème dans le code : La routine endTurn se contente de purger les modes éphémères du JSONB (comme is_rushed), mais ne possède pas de logique de décrémentation des compteurs numériques d'états persistants.Conséquence : Un personnage étourdi le restera indéfiniment ou devra être corrigé manuellement, car le système ne sait pas calculer l'expiration d'un effet au fil des rounds.La Spécification Mathématique d'un Tour Complet (Ce que le code doit valider)Pour qu'un tour fonctionne, l'ensemble de votre code (Moteur Serveur + Store + UI) doit s'aligner sur cette unique machine à états :[1. PHASE ROSTER]
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

**Cause suspectée** : Ce `find` retourne `undefined` pour un token drone, alors qu'il réussit pour les humanoïdes. Piste principale : mismatch de type entre `character.id` dans le store characters (string depuis JSON API) et `token.character_id` dans le store tokens (number depuis DB via API tokens). Investigation bloquée — non reproductible en lecture seule.

**Ce qui a été tenté** :
- Architecture `openSheet` centralisée (dispatcher unique par `character.type`) — correcte mais inefficace si `character` est null
- Les deux stores (characters, tokens) semblent cohérents en lecture de code — la discordance n'est pas visible sans debug runtime

**Prochaine étape** : Ajouter un `console.warn(contextMenu.token.character_id, characters.map(c=>c.id))` temporaire dans la IIFE pour comparer types et valeurs.

---

### Bug D2 — Token drone : changement de GLB non fonctionnel

**Symptôme** : Upload d'un nouveau GLB pour un drone via DroneWindow → token 3D ne se met pas à jour visuellement.

**Code impliqué** : `Canvas3D.jsx:879` — `characters.find(c => c.id === token.character_id)` pour calculer `glbUrl`. `Canvas3D.jsx:246` — `key={glbUrl}` sur `TokenGlbErrorBoundary`.

**Cause** : Même cause racine que D1. Si le drone n'est pas trouvé dans `characters`, `glbUrl = defaultTokenGlbUrl` (constante). `key` ne change jamais → pas de remontage → pas de rechargement GLB.

**Fix partiel appliqué** : `key={glbUrl}` sur `TokenGlbErrorBoundary` + `updateCharacter(res.data.character)` dans `DroneWindow.SettingsTab.handleGlbUpload`. Correcte en théorie, inefficace tant que D1 n'est pas résolu.

---

## Bugs Session 91 — CombatDeclareLog (2026-06-11) — Non résolus

### Bug CL1 — Timeline joueur : portraits PNJ non visibles

**Symptôme** : Côté joueur uniquement, certains portraits dans la timeline de combat ne s'affichent pas. Exemple observé : PNJ "Soleil" sans portrait. Côté GM : OK.

**Code impliqué** : `CombatTimeline.jsx` — rendu des portraits. Probable dépendance à `characters` (store characterStore) qui ne contient côté joueur que les personnages appartenant au joueur, pas les PNJ GM.

**Cause suspectée** : La timeline joueur tente de résoudre le portrait via `characters.find(c => c.id === token.character_id)` — retourne `undefined` pour les PNJ non chargés dans le store joueur → fallback image absente ou non rendue.

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

**Cause suspectée** : `announcementMarker` est toujours alimenté côté `SessionPage.jsx`. La régression est probablement dans le rendu — vérifier si le composant ou la condition d'affichage du ghost a été modifié lors des sessions 88-91.

**Prochaine étape** : Lire `CombatOverlay.jsx` — rechercher `announcementMarker` et la condition de rendu du ghost.