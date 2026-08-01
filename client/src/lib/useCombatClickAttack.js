import { useEffect, useRef } from 'react'
import api from './api.js'

// Clic direct sur un token adverse (sans tuile Attaque/CaC préalable) — décision Saar 2026-07-31
// (docs/BUGIDENTIFIE.md COMBAT-CLICK-AUTOSOLVE, scope réduit : pas d'auto-déplacement, le joueur gère
// lui-même sa position ; le mode CaC/Tir est déduit, jamais la cible cliquée elle-même). Point d'entrée
// unique partagé par CombatActionWindow (PJ), CombatGmDeclareWindow (PNJ) et useDroneDeclare (drone) —
// même patron que useAutoMoveMode (COMBAT-DEPLACEMENT-HOVER), jamais dupliqué.
//
// `resolveMode(distanceM)` est fourni par l'appelant — lui seul connaît la forme de ses données
// d'armement (inventaire PJ, equipment PNJ, programme drone). Doit renvoyer `{ mode: 'melee'|'ranged',
// band: string|null }` ou `null` si aucune attaque n'est possible (aucune arme, aucun mode).
//
// Position source : la destination de déplacement déjà posée (moveDestination, forme DB
// pos_x/pos_y/pos_z) si elle existe, sinon la position actuelle du token — confirmé Saar 2026-07-31.
// La mesure elle-même (distance + LOS) passe entièrement par le serveur (world-visibility, autorité
// unique déjà utilisée à la résolution) — jamais un calcul de distance dupliqué côté client.
//
// Cible posée directement (onMeleeTarget/onAssaultTarget), sans passer par combatTargetMode — décision
// Saar 2026-07-31 (v2, après retour "on perd la profondeur des options") : le détour par la fenêtre de
// confirmation flottante masquait la fenêtre de déclaration avant même que le joueur ait vu le panneau
// Tir/CaC (mode de tir, visée, localisation), contrairement au flux tuile classique qui l'ouvre avant de
// cibler. Ici la fenêtre ne se masque donc plus jamais — seul un texte flottant temporaire
// (showTargetRecap, 2s) confirme LOS/distance/portée au moment du clic.
export function useCombatClickAttack({
  enabled, battlemapId, tokenId, tokenPos, moveDestination,
  resolveMode, showTargetRecap, registerAmbientAttackHandler,
  onMeleeTarget, onAssaultTarget,
}) {
  // Ref miroir (P40, même patron que Canvas3D.jsx — combatMoveModeRef et consorts) : assignation
  // directe en rendu, lue seulement dans le handler async ci-dessous, jamais pendant un rendu.
  const stateRef = useRef({})
  stateRef.current = {
    battlemapId, tokenId, tokenPos, moveDestination,
    resolveMode, showTargetRecap, onMeleeTarget, onAssaultTarget,
  }

  useEffect(() => {
    if (!enabled || !registerAmbientAttackHandler) return
    const handler = async (targetToken, screenX, screenY) => {
      const {
        battlemapId: mapId, tokenId: myId, moveDestination: dest,
        resolveMode: resolve, showTargetRecap: showRecap,
        onMeleeTarget: pickMelee, onAssaultTarget: pickAssault,
      } = stateRef.current
      if (!mapId || !myId || !targetToken || targetToken.id === myId) return

      let visibility
      try {
        const res = await api.post(`/battlemaps/${mapId}/world-visibility`, {
          source_token_id: myId,
          target_token_id: targetToken.id,
          source_position_override: dest ?? undefined,
        })
        visibility = res.data?.visibility ?? null
      } catch (error) {
        console.error('[useCombatClickAttack] erreur world-visibility :', error)
        return
      }
      if (visibility?.distanceM == null) return

      const decision = resolve(visibility.distanceM)
      if (!decision) return  // aucune arme utilisable — pas de proposition d'attaque

      const pick = decision.mode === 'melee' ? pickMelee : pickAssault
      pick(targetToken.id)
      showRecap?.(
        { distanceM: visibility.distanceM, losClear: visibility.status === 'clear', band: decision.band },
        screenX != null ? { x: screenX, y: screenY } : null,
      )
    }
    registerAmbientAttackHandler(handler)
    return () => registerAmbientAttackHandler(null)
  }, [enabled, registerAmbientAttackHandler])
}
