// Constantes partagées entre plusieurs sections du panneau (§16, PLAN_WORLD_BUILDER_REWORK.md) —
// extrait de SurfaceEditorPanel.jsx, qui les utilise aussi dans son bandeau d'indice.
export const CHIP_BTN_STYLE = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', minHeight: '48px',
}

// Portée active de la peinture de mur, rappelée dans le bandeau d'indice persistant (§13,
// PLAN_WORLD_BUILDER_REWORK.md).
export const PAINT_WALL_SCOPE_LABEL_KEYS = {
  case: 'surfaceEditor.paintWallScopeCase',
  run: 'surfaceEditor.paintWallScopeRun',
  room: 'surfaceEditor.paintWallScopeRoom',
}
