// client/src/lib/infoPopover.js
// Calcul de position du panneau flottant ancré au clic — extrait de InfoPopover.jsx (pas un
// composant, react-refresh/only-export-components l'interdit dans un fichier de composants) pour
// que SkillInfoPopover.jsx et EquipmentInfoPopover.jsx partagent le même calcul plutôt que de le
// recopier chacun.
export function openInfoPanel(data, e, setPanel, { width = 280, height = 420 } = {}) {
  e.stopPropagation()
  const rect = e.currentTarget.getBoundingClientRect()
  const x = rect.right + 8 + width > window.innerWidth - 16
    ? rect.left - 8 - width
    : rect.right + 8
  const y = Math.min(rect.top, window.innerHeight - height)
  setPanel({ data, x, y, width })
}
