import { applyDoorConnector, applyElevatorConnector, applyLadderConnector } from '../connectors.js'

// Partie pure de la pose d'un connecteur (porte/ascenseur/échelle) — extrait de
// SurfaceEditorScene.jsx (§11.11, PLAN_WORLD_BUILDER_REWORK.md). La gestion de l'échec (message
// d'erreur traduit), la remise à zéro de `connectorWallEdgeKeys` et les événements
// (preventDefault/stopPropagation, différents selon succès/échec) restent dans le composant.
export function computeConnectorPlacement(surfaceData, dragEnd, tool) {
  return tool?.connectorType === 'door'
    ? applyDoorConnector(surfaceData, dragEnd, tool)
    : tool?.connectorType === 'ladder'
      ? applyLadderConnector(surfaceData, dragEnd, tool)
      : applyElevatorConnector(surfaceData, dragEnd, tool)
}
