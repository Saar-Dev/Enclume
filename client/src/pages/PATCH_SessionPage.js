/**
 * PATCH SessionPage.jsx — Chantier 9F-A
 *
 * Deux modifications à appliquer dans client/src/pages/SessionPage.jsx
 * Ne pas réécrire le fichier en entier — appliquer ces deux changements ciblés.
 */

// ─── MODIFICATION 1 ───────────────────────────────────────────────────────────
// Dans le useEffect socket (~ligne 287), après le bloc TOKEN_DELETED :
//
//   s.on(WS.TOKEN_DELETED, ({ tokenId }) => {
//     removeToken(tokenId)
//   })
//
// AJOUTER immédiatement après :

s.on(WS.TOKEN_UPDATED, ({ token }) => {
  // Mise à jour partielle via store — token contient id + tous les champs modifiés
  // Utilisé pour TOKEN_ROTATE (champ r) — guard updated_at dans le store
  updateToken(token)
})

// ─── MODIFICATION 2 ───────────────────────────────────────────────────────────
// Ajouter ce callback dans SessionPage, AVANT handleEntityAction
// (ordre de déclaration — P4 : si handleEntityAction l'utilise, le déclarer après)
// En pratique handleTokenRotate est indépendant, le placer après handleContextMenuDelete.

const handleTokenRotate = useCallback((tokenId) => {
  socket?.emit(WS.TOKEN_ROTATE, { tokenId })
}, [socket])

// ─── MODIFICATION 3 ───────────────────────────────────────────────────────────
// Dans le JSX, sur le composant <Canvas3D>, ajouter la prop onTokenRotate :
//
// AVANT :
//   <Canvas3D
//     onTokenDoubleClick={handleTokenDoubleClick}
//     socket={socket}
//     onEntityClick={handleEntityClick}
//   />
//
// APRÈS :
//   <Canvas3D
//     onTokenDoubleClick={handleTokenDoubleClick}
//     socket={socket}
//     onEntityClick={handleEntityClick}
//     onTokenRotate={handleTokenRotate}
//   />
