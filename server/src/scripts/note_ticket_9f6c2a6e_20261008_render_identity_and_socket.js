// Script à usage unique — note sur le ticket 9f6c2a6e (WORLD-COMPILE-SUPERLINEAR) la session du
// 2026-10-07/08 : correctif plafonds/sols/portes recalculés pour rien (confirmé par Saar en jeu),
// correctif de connexion Socket.IO (StrictMode), et l'isolement du trou de chargement de 20-40s
// vers une cause externe au code. Idempotent (skip si déjà noté). Lancement manuel, local, depuis
// la racine :
//   node --env-file=.env server/src/scripts/note_ticket_9f6c2a6e_20261008_render_identity_and_socket.js

import db from '../db/knex.js'

const MARKER = '--- 2026-10-08 : plafonds/sols/portes + connexion Socket.IO ---'

const NOTE = `

${MARKER}
[CORRIGE ET CONFIRME PAR SAAR EN JEU] Le défaut noté le 2026-10-07 ("room={{ id, ...room }} /
connector={{ id, ...connector, runtimeState }} reconstruits en JSX à chaque rendu") avait en réalité
DEUX causes, pas une seule :
1. SurfaceDungeonScene.jsx construisait ces objets en JSX à chaque rendu — corrigé par un cache
   (roomsById/connectorsById, useMemo).
2. Défaut SŒUR non vu le 2026-10-07 : footprintContours (RoomFloorSurface/RoomCeilingInterface)
   était recalculé en JSX à chaque rendu aussi, cassant la même mémoïsation même une fois (1) corrigé
   — confirmé par les journaux de Saar (les plafonds recalculaient encore, sans AUCUN changement de
   surface.rooms en amont, preuve que la cause 1 seule ne suffisait pas). Corrigé par le même patron
   (useMemo sur l'objet stable horizontalInterface/room).
Une 3e piste (cache fin par connecteur avec useRef mutée dans useMemo) a été écartée : viole la règle
"Cannot access refs during render" (react-hooks/refs, React 19) — revenu à la version simple
(reconstruction complète du Map quand runtimeFeatureStates change, déjà une nette amélioration sur
l'ancien "à chaque rendu").
Commit : client/src/components/Canvas3D.jsx + SurfaceDungeonScene.jsx.
Testé : lint ciblé (0 nouvelle erreur, comparé avant/après), build client, ET confirmation de Saar en
jeu (les plafonds/portes ne recalculent plus que quand ils changent vraiment).

[CORRIGE, PAS ENCORE CONFIRME COMME CAUSE DU TROU DE 20-40s] Pendant l'enquête sur le trou de
chargement (section précédente de ce ticket), un vrai défaut distinct a été trouvé et corrigé :
client/src/lib/SocketContext.jsx créait une connexion socket.io neuve (io(...)) à CHAQUE montage de
SocketProvider. Sous StrictMode (toujours actif, dev uniquement), l'effet monte deux fois de suite
(connect → disconnect → connect) — la 2e connexion arrivait parfois sur une session engine.io déjà
fermée côté serveur, confirmé par des erreurs réseau réelles (400 Bad Request, upgrade WebSocket
refusé par Firefox). Corrigé selon le patron officiel (socket.io/how-to/use-with-react) : UN SEUL
Socket/Manager créé hors du composant, connect()/disconnect() appelés dans l'effet. Vérifié aussi
dans le code source de socket.io-client 4.8.3 (pas seulement la doc officielle).
Commit : client/src/lib/SocketContext.jsx.
[OBSERVE] Ce correctif n'a PAS fait disparaître le trou de 20-40s rapporté par Saar.

[NOUVEAU — isolement net du trou, 2026-10-08] Après plusieurs sessions de reproduction (journal
navigateur + serveur + nodemon, exclusion d'une hypothèse de session Claude parallèle, exclusion
d'une hypothèse de fenêtre navigateur "contaminée" par de vieux tests) :
- [OBSERVE, reproduit] Fermeture complète du navigateur + une seule fenêtre neuve + chargement de la
  session = trou de ~40 secondes.
- [OBSERVE, reproduit] Depuis cette même fenêtre déjà chargée : sortir vers le Dashboard puis revenir
  à la session = quasi instantané. Passer en mode édition et revenir = idem, aucun trou.
=> Le trou ne reproduit QUE sur le tout premier chargement d'un navigateur qui vient de démarrer,
jamais sur une navigation interne ultérieure utilisant exactement le même code de connexion. Ça
élimine une cause dans le code applicatif (React/socket.io) comme explication COMPLÈTE : le même
code, exécuté une seconde fois dans la même fenêtre, est instantané.
[HYPOTHESE non vérifiée] Cause externe au code — réseau ou sécurité Windows inspectant la toute
première connexion sortante d'un processus navigateur fraîchement lancé (famille du problème déjà
rencontré et corrigé sur Vite lui-même en 2026-09-24, cf. commentaire client/vite.config.js, même
machine). PROCHAINE ETAPE, pas encore faite : Gestionnaire des tâches ouvert AVANT le lancement du
navigateur, observer CPU/disque/réseau de TOUS les processus pendant la reproduction (fenêtre neuve,
chargement unique) — demandé à Saar, réponse non reçue au moment de cette note.

[RAPPEL, toujours vrai] shared/world/roomGeometry.js (mémoïsation WeakMap de roomBoundaryMultiPolygon,
WORLD-COMPILE-SUPERLINEAR) reste non commité dans le dossier de travail malgré la mention "Commit
70872d10" plus haut dans ce ticket — ce commit ne contient pas ce correctif (vérifié par lecture de
son contenu réel). À committer séparément, hors périmètre de cette note.`

async function run() {
  const ticket = await db('bug_tickets').where({ linked_bug_code: 'WORLD-COMPILE-SUPERLINEAR' }).first()
  if (!ticket) { console.log('[SKIP] WORLD-COMPILE-SUPERLINEAR — ticket introuvable'); return }
  if ((ticket.admin_notes || '').includes(MARKER)) { console.log('[SKIP] WORLD-COMPILE-SUPERLINEAR — déjà noté'); return }
  await db('bug_tickets').where({ id: ticket.id }).update({
    admin_notes: `${ticket.admin_notes || ''}\n${NOTE}`.trim(),
    updated_at: db.fn.now(),
  })
  console.log('[OK] WORLD-COMPILE-SUPERLINEAR — note ajoutée')
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
