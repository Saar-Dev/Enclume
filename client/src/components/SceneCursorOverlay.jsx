import { useEffect, useState } from 'react'

// Curseur custom du canvas 3D — deux mécanismes distincts, choisis selon le besoin (Saar 2026-08-07,
// 2026-08-08) :
// 1. CASE/CIBLE (mode Déplacement/Ciblage combat) — overlay DOM (<img> qui suit la souris), PAS
//    `cursor: url()` natif. Raison : aucun navigateur n'anime un SVG référencé en `cursor:` (image
//    figée dès chargement — vérifié MDN + retours terrain, cf. commentaire resolveMode ci-dessous) et
//    CASE/CIBLE sont animés (pulsation). Un <img> DOM classique n'a pas cette limite.
// 2. Défaut hors combat (CURSEUR.svg) — `cursor: url()` NATIF, à l'inverse. Raison : pas besoin
//    d'animation ici, et la précision prime (retour Saar : "le clic doit se faire sur la pointe de la
//    flèche, comme un curseur système, on ne sacrifie pas la précision à la beauté"). Un overlay DOM
//    suivant la souris via pointermove a toujours un frame de retard sur la position réelle du curseur
//    OS (resynchronisé au pointermove suivant) — un curseur natif est composé par le navigateur à la
//    position exacte, sans ce délai. Pour une simple flèche non animée, natif est strictement plus
//    précis. Vérifié MDN (`cursor` CSS property, 2026-08-08) : le hotspot `x y` dans
//    `url(img) x y, <fallback>` est en pixels de l'image, origine coin haut-gauche — correspond à la
//    taille "naturelle" du SVG (attributs `width`/`height`), pas au viewBox. Sans hotspot explicite,
//    le point de clic par défaut est (0,0) — le coin haut-gauche de l'image, jamais centré — d'où
//    l'obligation de le calculer explicitlement pour une flèche (pointe hors du coin de l'image).
//    Taille max recommandée par les navigateurs : 32×32 (limite dure ~128×128 avant rejet silencieux
//    de l'image, retombée sur le mot-clé de secours) — CURSEUR.svg rendu à 32×29 (retour Saar
//    2026-08-08 : le rendu initial à 40×36, même échelle que CASE/CIBLE, paraissait plus gros qu'un
//    curseur système standard ~32px).
// Position (overlay CASE/CIBLE) : `position: fixed` + clientX/clientY bruts — pas de calcul de rect
// nécessaire, fixed est déjà relatif au viewport comme clientX/clientY. `pointer-events: none`
// impératif : l'overlay ne doit jamais intercepter les événements destinés au canvas en dessous.
// hoveringEntityRef : ref (pas state) écrite par Scene au survol d'une EntityMesh — lue à chaque
// pointermove pour supprimer CURSEUR_CIBLE sur une entité interactive non-cible (ex. coffre),
// sans re-render du sous-arbre Scene à chaque survol (pattern P40, cf. Canvas3D.jsx).
// hoveringTokenRef : ref miroir de ambientHoverTokenId — au survol d'un token pendant le
// déplacement combat (mode='case' de base), bascule sur CIBLE : un seul curseur possible à la fois
// (retour Saar 2026-08-07 — "curseur = SOIT curseur_cible SOIT curseur_case", jamais les deux, et
// CASE ne doit pas garder la place sur un token survolé).
// resolveMode() est l'unique source de vérité — un seul appel par render, alimente à la fois le
// masquage du curseur natif du canvas (canvasEl.style.cursor) et le choix de l'image de l'overlay,
// jamais deux décisions qui peuvent diverger.
function resolveMode(mode, hoveringEntityRef, hoveringTokenRef) {
  let resolved = mode
  if (resolved === 'case' && hoveringTokenRef?.current) resolved = 'cible'
  if (resolved === 'cible' && hoveringEntityRef?.current) resolved = null
  return resolved
}

// Hotspot (7 2) : pointe de la flèche dans CURSEUR.svg repérée par lecture du path source (sommet où
// convergent les deux segments hauts, ~(38,13) sur le viewBox 178×161 d'origine), mise à l'échelle du
// rendu 32×29. Non vérifiée visuellement (pas de rendu navigateur possible ici), à confirmer/ajuster
// par Saar (2 nombres à corriger si le clic ne tombe pas exactement sur la pointe).
const DEFAULT_CURSOR = 'url(/assets/CURSEUR.svg) 7 2, auto'

// inCombat : combat actif (`combatStore.phase !== null`) — hors CASE/CIBLE, le curseur reste le
// défaut système pendant un combat (retour Saar : "valable tout le temps, sauf le mode combat"),
// CURSEUR.svg réservé à l'exploration/préparation hors combat.
// overlayVisible : l'overlay <img> CASE/CIBLE est réellement monté à cet instant. Invariant :
// `cursor:'none'` n'est renvoyé QUE dans ce cas — le composant et cette fonction consomment la même
// valeur, donc le curseur natif n'est jamais masqué sans que l'overlay le remplace (ticket
// DECL-CURSOR-HIDDEN : masquage immédiat au changement de mode alors que l'overlay attendait un
// premier pointermove canvas qui ne venait pas — le clic d'armement part d'une fenêtre de
// déclaration, pas du canvas).
function resolveCursorStyle(resolvedMode, inCombat, overlayVisible) {
  if (resolvedMode && overlayVisible) return 'none' // overlay DOM affiche CASE/CIBLE par-dessus
  if (!inCombat) return DEFAULT_CURSOR
  return 'auto'
}

// Le pointeur est-il réellement au-dessus du canvas 3D ? Hit-test via elementFromPoint plutôt qu'un
// suivi d'événements pointerenter/leave scopé au canvas : (1) elementFromPoint ignore nativement les
// éléments `pointer-events:none` — la fenêtre de déclaration passe en pointer-events:none juste après
// le clic qui arme le mode, sans déplacement de souris, donc aucun événement d'entrée/sortie ne
// serait émis ; (2) il respecte l'occlusion par un panneau réel (dés, fiche) posé sur le canvas.
function pointerIsOverCanvas(canvasEl, pointer) {
  if (!canvasEl || !pointer) return false
  const el = document.elementFromPoint(pointer.x, pointer.y)
  return !!el && (el === canvasEl || canvasEl.contains(el))
}

export default function SceneCursorOverlay({ canvasEl, mode, hoveringEntityRef, hoveringTokenRef, inCombat = false }) {
  // Position pointeur brute (viewport), ou null quand le pointeur a quitté la page. Suivie au niveau
  // document — une seule source, valable que la souris soit au-dessus du canvas ou d'une fenêtre
  // flottante posée dessus (l'ancienne écoute limitée au canvas laissait cette valeur périmée dès
  // que le pointeur passait sur une fenêtre).
  const [pointer, setPointer] = useState(null)
  // L'overlay doit-il être monté : un mode est résolu ET le pointeur est au-dessus du canvas.
  // État explicite (plus de dépendance implicite « un pointermove reçu sans pointerleave depuis »).
  const [overlayVisible, setOverlayVisible] = useState(false)

  useEffect(() => {
    const onMove = (e) => setPointer({ x: e.clientX, y: e.clientY })
    const onLeave = () => setPointer(null)
    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const resolvedMode = resolveMode(mode, hoveringEntityRef, hoveringTokenRef)

  // Recalcul de la visibilité à chaque déplacement du pointeur ET à chaque changement de mode : le
  // changement de mode ne produit aucun événement pointeur, c'est ce second cas qui corrige
  // DECL-CURSOR-HIDDEN (l'overlay se monte sans attendre un mouvement de souris).
  useEffect(() => {
    setOverlayVisible(!!resolvedMode && pointerIsOverCanvas(canvasEl, pointer))
  }, [canvasEl, pointer, resolvedMode])

  // Curseur natif du canvas : masqué exactement quand l'overlay le remplace, sinon repli (défaut
  // système en combat, CURSEUR.svg hors combat). Point de décision unique.
  useEffect(() => {
    if (!canvasEl) return
    canvasEl.style.cursor = resolveCursorStyle(resolvedMode, inCombat, overlayVisible)
  }, [canvasEl, resolvedMode, inCombat, overlayVisible])

  if (!overlayVisible || !pointer) return null

  const src = resolvedMode === 'cible' ? '/assets/CURSEUR_CIBLE.svg' : '/assets/CURSEUR_CASE.svg'

  return (
    <img
      src={src}
      alt=""
      className={`scene-cursor-overlay scene-cursor-overlay-${resolvedMode}`}
      style={{ left: pointer.x, top: pointer.y }}
    />
  )
}
