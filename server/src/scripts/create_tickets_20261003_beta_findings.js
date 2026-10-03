// Script à usage unique — crée les tickets issus de la session de correction de bugs du 2026-10-03
// (liste de Saar) et d'un rapport de beta-testeur reçu le même jour, après triage et dédoublonnage
// contre les 101 tickets déjà ouverts (plusieurs items confirmaient des tickets existants : voir
// WORLD-COMPILE-SUPERLINEAR, DEF5, SURPRISE1, WIZ9, PERMUTER-DUALWIELD-OFFHAND-E2E, COM24, TIRIMP —
// non recréés ici, juste référencés dans la description du ticket le plus proche).
// Lancement manuel, local : node --env-file=.env server/src/scripts/create_tickets_20261003_beta_findings.js
// Écrit dans la base locale (bug_tickets uniquement) — idempotent : ne recrée pas un ticket dont le
// linked_bug_code existe déjà.

import db from '../db/knex.js'

const TICKETS = [
  {
    code: 'CHARSHEET-XP-SYNC-PJMJ',
    category: 'bug',
    domain: 'personnage',
    priority: 'medium',
    title: "Le champ Expérience ne s'actualise pas de façon synchronisée entre PJ et MJ (vérifier les autres champs)",
    description: `
Signalé par Saar (session de correction de bugs, 2026-10-03). Le champ Expérience de la fiche
personnage ne se met pas à jour de la même façon côté joueur et côté MJ. Pas de diagnostic ni de
repro précis à ce stade. Saar demande aussi de vérifier si d'autres champs de la fiche partagent le
même problème de synchronisation.
`.trim(),
  },
  {
    code: 'CHARSHEET-SKILLX-COLOR',
    category: 'bug',
    domain: 'personnage',
    priority: 'medium',
    title: "Les compétences (X) n'ont pas d'affichage distinct de couleur (contrairement aux compétences normales/-3/PN)",
    description: `
Signalé par Saar puis confirmé indépendamment par un beta-testeur (2026-10-03). Compétences
normales = blanc, compétences à -3 = rouge, Progression Naturelle = vert : tous confirmés corrects
par le testeur. Les compétences (X) restent en blanc alors qu'elles devraient avoir un affichage
distinct correspondant à leur statut particulier. Pas de proposition de couleur précise reçue — à
définir avec Saar avant correctif.
`.trim(),
  },
  {
    code: 'CHARSHEET-XP-SPEND-CONFIRM',
    category: 'bug',
    domain: 'personnage',
    priority: 'high',
    title: "Dépenser de l'expérience / des points de compétence doit passer par une étape valider/annuler, pas une dépense immédiate au clic",
    description: `
Signalé par Saar (« ajouter de l'expérience nécessite un bouton de validation ») et par un
beta-testeur, indépendamment, avec plus de détail : dès qu'un point est placé dans une compétence en
mode progression, il est immédiatement consommé et impossible à retirer — un clic malencontreux
gaspille un point définitivement. Attendu : une phase de modification temporaire (ajout/retrait de
points) suivie d'un bouton Valider et d'un bouton Annuler ; la dépense réelle n'a lieu qu'à la
validation.
`.trim(),
  },
  {
    code: 'CHARSHEET-ADVANTAGE-SKILL-GATE',
    category: 'bug',
    domain: 'personnage',
    priority: 'high',
    title: "Une compétence liée à un Avantage reste accessible sans posséder l'Avantage (ex. Pouvoir Polaris sans l'Avantage Polaris)",
    description: `
Signalé indépendamment par Saar et par un beta-testeur (2026-10-03) — deux confirmations. Un joueur
sans l'Avantage Polaris voit quand même la liste des Pouvoirs Polaris et peut apparemment y investir
des points. Plus largement (testeur) : les compétences soumises à un Avantage ne respectent pas leur
condition d'accès et peuvent recevoir des points sans que l'Avantage requis soit possédé. Pas de
diagnostic code fait à ce stade.
`.trim(),
  },
  {
    code: 'CHARSHEET-SKILL-PREREQ-HIDDEN',
    category: 'bug',
    domain: 'personnage',
    priority: 'high',
    title: "Une compétence à prérequis (autre compétence) disparaît entièrement de la liste au lieu d'être grisée avec son prérequis affiché",
    description: `
Signalé par un beta-testeur (2026-10-03). Exemple : certaines compétences informatiques nécessitent
Culture générale/Électronique etc. mais sont introuvables dans la liste tant que le prérequis n'est
pas rempli — impossible de comprendre comment les débloquer. Attendu : afficher la compétence
grisée, non augmentable, avec son prérequis manquant indiqué clairement (même logique que pour une
compétence liée à un Avantage, cf. CHARSHEET-ADVANTAGE-SKILL-GATE). Visible aussi hors mode
progression.
[À VÉRIFIER] relation avec WIZ9 (déjà ouvert, scope wizard/création) — même règle métier ou
implémentation parallèle sur la fiche en jeu ? à trancher en lisant le code avant de fusionner ou
traiter séparément.
`.trim(),
  },
  {
    code: 'CHARSHEET-SKILL-SEARCH',
    category: 'suggestion',
    domain: 'personnage',
    priority: 'medium',
    title: "Ajouter un champ de recherche dans la liste des compétences (liste longue, beaucoup de scroll)",
    description: `
Signalé par un beta-testeur (2026-10-03).
`.trim(),
  },
  {
    code: 'WEAPON-MOD-BUTTON-CONTRAST',
    category: 'bug',
    domain: 'interface',
    priority: 'low',
    title: "Le bouton « Modificateur d'arme » est peu lisible (petit, peu contrasté)",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'GRENADE-ACCEPTS-WEAPON-MODS',
    category: 'bug',
    domain: 'personnage',
    priority: 'medium',
    title: "Une grenade peut recevoir des mods d'arme (ex. viseur) alors que ça n'a pas de sens pour ce type d'objet",
    description: `
Signalé par Saar (2026-10-03). Pas de diagnostic code — à vérifier si un filtre de compatibilité
mod/type d'objet existe et pourquoi il ne s'applique pas aux grenades.
`.trim(),
  },
  {
    code: 'GRENADE-STACK-BY-TYPE',
    category: 'suggestion',
    domain: 'personnage',
    priority: 'low',
    title: "Les grenades devraient s'empiler par type dans l'inventaire (comme d'autres objets consommables)",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'ARMOR-STATS-DISPLAY-INCOMPLETE',
    category: 'bug',
    domain: 'personnage',
    priority: 'high',
    title: "Affichage des bonus/malus d'armure peu clair une fois équipée ; Résistance au choc absente ; renommer « valeur d'armure » en « Armure »",
    description: `
Signalé par Saar puis confirmé et précisé par un beta-testeur (2026-10-03) — deux sources. Le malus
d'armure, sa lettre et sa valeur s'affichent correctement. Manque : la Résistance au choc,
totalement invisible. Demandé : renommer le libellé actuel « valeur d'armure » en simplement
« Armure », et afficher au minimum Armure + Résistance au choc + malus/catégorie associés.
`.trim(),
  },
  {
    code: 'ARMOR-ACCESSORY-SLOTS-MISSING',
    category: 'suggestion',
    domain: 'personnage',
    priority: 'medium',
    title: "Impossible d'équiper un accessoire d'armure (ex. visière) en plus d'une pièce déjà portée (ex. casque) — pas de slots secondaires",
    description: `
Signalé par un beta-testeur (2026-10-03). Exemple : Armure de sécurité Beta + casque + visière de
visée automatique — le casque occupe le slot de tête et empêche d'équiper la visière. Pistes
proposées par le testeur : slots secondaires/accessoires, ou système de mods d'armure comparable aux
mods d'armes. Objectif : un accessoire compatible doit pouvoir s'installer sur un casque sans le
remplacer.
[LIÉ] même famille que GRENADE-ACCEPTS-WEAPON-MODS (règles de compatibilité mod/slot par type
d'objet) — tickets séparés, mécaniques différentes.
`.trim(),
  },
  {
    code: 'EQUIPMENT-TOOLTIP-INFO',
    category: 'suggestion',
    domain: 'personnage',
    priority: 'low',
    title: "Ajouter des informations détaillées sur les objets (description, etc.) via tooltip",
    description: `
Signalé par Saar et par un beta-testeur, indépendamment (2026-10-03). Évolution de confort, pas
bloquante (le testeur le classe explicitement hors priorité).
`.trim(),
  },
  {
    code: 'MARCHAND-CHECKALL-BUTTON',
    category: 'suggestion',
    domain: 'marchands',
    priority: 'low',
    title: "Ajouter un bouton pour tout cocher d'un coup dans l'interface Marchand",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'MARCHAND-ERGONOMIE-GENERALE',
    category: 'suggestion',
    domain: 'marchands',
    priority: 'low',
    title: "Ergonomie générale de l'interface vendeur à revoir",
    description: `
Signalé par Saar (2026-10-03). Pas de détail précis — à préciser avec Saar (quel geste est pénible)
avant de cadrer un correctif.
`.trim(),
  },
  {
    code: 'MARCHAND-REMOVE-FROM-CART',
    category: 'bug',
    domain: 'marchands',
    priority: 'medium',
    title: "Permettre de retirer un objet du panier côté Marchand",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'INVENTORY-MULTI-STORAGE',
    category: 'suggestion',
    domain: 'personnage',
    priority: 'medium',
    title: "Remplacer le coffre unique par un système de stockages multiples (sous-marin, sous-marin des Valets, station, etc.)",
    description: `
Signalé par un beta-testeur (2026-10-03). Le coffre unique actuel ne correspond pas aux besoins du
jeu (plusieurs lieux de stockage possibles pour un même personnage). Attendu : plusieurs stockages
nommés et localisés, chacun avec son propre contenu, et un moyen de déplacer des objets entre
stockages.
**Chantier de cadrage, pas un simple correctif** — nécessite un plan dédié avant tout code
(architecture de données, UI, impact sur le Coffre existant).
`.trim(),
  },
  {
    code: 'CHARSHEET-GOLD-FREELY-EDITABLE',
    category: 'bug',
    domain: 'personnage',
    priority: 'medium',
    title: "La quantité d'or est modifiable librement depuis la fiche, sans passer par le système de transactions prévu",
    description: `
Signalé par un beta-testeur (2026-10-03). Le joueur peut actuellement changer sa quantité d'or
directement, ce qui contourne les entrées/sorties/transferts contrôlés. À vérifier côté serveur si
le champ est réellement éditable sans contrôle ou si c'est un affichage client trompeur.
`.trim(),
  },
  {
    code: 'COMBAT-WINDOW-CLOSES-BEFORE-DONE',
    category: 'bug',
    domain: 'combat',
    priority: 'critical',
    title: "Une fenêtre de combat/déclaration peut disparaître avant que l'action soit terminée, validée ou annulée ; si elle se ferme par accident, le joueur doit pouvoir la rouvrir",
    description: `
Signalé par Saar (« si fermeture accidentelle... s'assurer que le joueur puisse la rouvrir ») et,
indépendamment, par un beta-testeur en priorité très haute (« la fenêtre ne doit jamais se fermer
automatiquement tant que l'action n'est pas terminée — rend la gestion du combat particulièrement
pénible »). Deux confirmations fortes. Pas de diagnostic code à ce stade.
`.trim(),
  },
  {
    code: 'COMBAT-DAMAGE-WINDOW-WRONG-TARGET',
    category: 'bug',
    domain: 'combat',
    priority: 'critical',
    title: "La fenêtre de gestion des dégâts peut apparaître pour le mauvais personnage / rester figée ; confusion sur qui doit gérer (cible ou tireur) ; a buggé complètement au moins une fois",
    description: `
Signalé par Saar ET par un beta-testeur, indépendamment (2026-10-03) — trois symptômes
convergents : (1) un joueur a eu la notification « Gestion des dégâts en cours » restée figée ;
(2) qui gère la fenêtre (cible ou tireur) semble changer sans règle claire ; (3) le testeur a vu la
fenêtre apparaître pour le mauvais personnage, et un plantage complet au moins une fois.
À vérifier (demande explicite du testeur) : association attaquant/cible, personnage qui reçoit
effectivement les dégâts, contexte conservé entre les fenêtres de combat, logs au moment des
erreurs.
`.trim(),
  },
  {
    code: 'COMBAT-MULTI-ATTACK-ROUND-BROKEN',
    category: 'bug',
    domain: 'combat',
    priority: 'critical',
    title: "Plusieurs attaques dans un même round ne fonctionnent pas correctement (sélection, consommation d'actions, enchaînement, affichage)",
    description: `
Signalé par un beta-testeur (2026-10-03). Demande de reprendre et tester entièrement
l'enchaînement : sélection des attaques, consommation d'actions éventuelle, enchaînement des
résolutions, affichage des fenêtres, passage d'une attaque à la suivante.
[LIÉ] tickets déjà ouverts PERMUTER-DUALWIELD-OFFHAND-E2E et COM24 (bonus deux armes) — périmètre
probablement plus large que le seul double armement, à vérifier en code avant de fusionner.
`.trim(),
  },
  {
    code: 'COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    title: "La fenêtre « Résolution du tir » doit apparaître pour tous (joueurs et MJ), pas seulement certains clients",
    description: `
Signalé par Saar (2026-10-03). Pas de diagnostic précis — à vérifier quel client ne la reçoit pas et
pourquoi.
`.trim(),
  },
  {
    code: 'COMBAT-GM-RECAP-WINDOW-MISMATCH',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    title: "Côté MJ, la fenêtre récapitulative au-dessus du chat n'affiche pas les mêmes informations que côté joueur",
    description: `
Signalé par Saar (2026-10-03).
[LIÉ thématiquement] à COMBAT-RESOLUTION-TIR-WINDOW-VISIBILITY (cohérence d'état entre clients en
combat) mais fenêtre différente — ticket séparé.
`.trim(),
  },
  {
    code: 'COMBAT-DODGE-NOTIFICATION-WORDING',
    category: 'bug',
    domain: 'combat',
    priority: 'low',
    title: "La notification « Vous esquivez le tir » laisse croire à tort qu'esquiver un tir est possible",
    description: `
Signalé par Saar (2026-10-03). Problème de formulation/i18n a priori, pas nécessairement de règle.
`.trim(),
  },
  {
    code: 'COMBAT-SURPRISE-NO-ACTION-WINDOW',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    title: "Quand un personnage est surpris, aucune fenêtre de demande d'action ne devrait s'ouvrir pour lui",
    description: `
Signalé par Saar (2026-10-03).
[LIÉ] possiblement à SURPRISE1 déjà ouvert (is_surprised jamais remis à false après COMBAT_START)
mais symptôme différent (ouverture de fenêtre vs flag persistant) — à vérifier ensemble en code
avant de fusionner.
`.trim(),
  },
  {
    code: 'COMBAT-WEAPON-STATUS-GHOST-NO-WEAPON',
    category: 'bug',
    domain: 'combat',
    priority: 'low',
    title: "Le statut « Arme au clair / main sur arme / arme rangée » ne doit pas s'afficher sans arme équipée",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'COMBAT-RANGE-PLAYER-EDITABLE',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    title: "Le joueur peut modifier la Portée alors que ce champ devrait être en lecture seule pour lui ; la fenêtre doit permettre la modification côté MJ uniquement",
    description: `
Signalé par Saar (2026-10-03, précisé après clarification). Le joueur peut sélectionner/modifier la
Portée ; attendu : la fenêtre concernée s'affiche aussi côté MJ pour qu'il puisse la modifier, le
joueur ne doit avoir qu'un accès en lecture.
`.trim(),
  },
  {
    code: 'COMBAT-DECLARATION-REFUSED-NO-MESSAGE',
    category: 'bug',
    domain: 'combat',
    priority: 'medium',
    title: "Quand une déclaration d'action n'est pas validée, un message d'explication devrait toujours s'afficher — à vérifier si c'est bien le cas partout",
    description: `
Signalé par Saar (2026-10-03), avec mention explicite « à vérifier ».
[LIÉ] possiblement à TIRIMP déjà ouvert (garde serveur absent sur « Tir impossible ») — à confirmer
en code.
`.trim(),
  },
  {
    code: 'COMBAT-DAMAGE-DICE-MODEL-MISMATCH',
    category: 'bug',
    domain: 'combat',
    priority: 'low',
    title: "Le modèle de dé animé lors d'un jet de dégâts devrait correspondre aux dégâts réels ; actuellement c'est toujours un d20 qui s'affiche",
    description: `
Signalé par Saar (2026-10-03). Bug visuel (animation du dé) a priori, pas le calcul des dégâts
lui-même (non signalé comme faux).
`.trim(),
  },
  {
    code: 'SESSION-CAMERA-TOKEN-SELECTION-UNCLEAR',
    category: 'bug',
    domain: 'interface',
    priority: 'medium',
    title: "Avec 2+ tokens, le joueur ne sait pas lequel bougera (clic droit) ni lequel sera centré par la caméra — le rond de sélection ne distingue pas le token actif",
    description: `
Signalé par Saar (2026-10-03, précisé). Un joueur avec plusieurs tokens n'a aucun indice visuel sur
lequel de ses tokens recevra le clic droit (déplacement) ou le centrage caméra.
`.trim(),
  },
  {
    code: 'SESSION-CAMERA-STUCK-NO-ARROW-KEYS',
    category: 'bug',
    domain: 'interface',
    priority: 'medium',
    title: "La vue caméra semble bloquée/centrée sur une cible indéterminée en session ; les touches directionnelles ne la déplacent pas",
    description: `
Signalé par Saar (2026-10-03).
[LIÉ] même famille que SESSION-CAMERA-UNLOCK-PLAYER-CENTER et SESSION-CAMERA-KEYBOARD-SLOW-START —
probablement la même zone de code (contrôle caméra session), tickets séparés en attendant le
diagnostic.
`.trim(),
  },
  {
    code: 'SESSION-CAMERA-UNLOCK-PLAYER-CENTER',
    category: 'suggestion',
    domain: 'interface',
    priority: 'low',
    title: "Permettre de débloquer/désactiver le centrage automatique de la caméra sur le joueur",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'SESSION-CAMERA-KEYBOARD-SLOW-START',
    category: 'bug',
    domain: 'interface',
    priority: 'low',
    title: "Le déplacement caméra au clavier est trop lent au démarrage du mouvement (ni précis ni rapide)",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'ENCYCLOPEDIE-ITALIC-QUOTES-UNREADABLE',
    category: 'bug',
    domain: 'encyclopedie',
    priority: 'low',
    title: "Les citations en italique de l'Encyclopédie sont illisibles",
    description: `
Signalé par Saar (2026-10-03).
`.trim(),
  },
  {
    code: 'MAP-UPDATE-NOT-PROPAGATED-TO-PLAYERS',
    category: 'bug',
    domain: 'monde',
    priority: 'high',
    title: "Quand le MJ modifie la carte, la mise à jour ne se propage pas côté joueur",
    description: `
Signalé par Saar (2026-10-03). Bug de synchronisation potentiellement important (les joueurs peuvent
voir une carte périmée). Pas de diagnostic précis — à vérifier quel événement WS devrait propager et
ne le fait pas.
`.trim(),
  },
  {
    code: 'EXOARMOR-SEED-MISSING-ON-KIWI',
    category: 'bug',
    domain: 'infrastructure',
    priority: 'medium',
    title: "Le seed des exo-armures n'est pas passé sur le serveur distant Kiwi",
    description: `
Signalé par Saar (2026-10-03).
[LIÉ] contexte Kiwi — cf. JOURNAL8.md du 2026-09-30 sur la bascule vtt→enclumeBD ; à vérifier si le
seed manque simplement ou si une migration/seed a été oubliée dans le déploiement.
`.trim(),
  },
]

async function run() {
  for (const t of TICKETS) {
    const existing = await db('bug_tickets').where({ linked_bug_code: t.code }).first()
    if (existing) {
      console.log(`Ticket ${t.code} existe déjà (id=${existing.id}, statut=${existing.status}) — rien à faire.`)
      continue
    }

    const [row] = await db('bug_tickets')
      .insert({
        origin: 'gm',
        category: t.category,
        domain: t.domain,
        title: t.title,
        description: t.description,
        status: 'new',
        priority: t.priority,
        linked_bug_code: t.code,
      })
      .returning(['id', 'status', 'priority'])

    console.log(`Ticket ${t.code} créé : id=${row.id}, statut=${row.status}, priorité=${row.priority}.`)
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
