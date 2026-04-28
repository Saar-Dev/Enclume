/**
 * ============================================================
 * 14_WebApp_InitiativeSimple.gs — Legacy/simple initiative (fid)
 * ============================================================
 */

function applyInitiativeDelta(fid, delta) {
  const { sh } = getSheet_(fid, "Personnage");
  sh.getRange("AD16").setValue(delta);
  return true;
}

function getBaseInitiative(fid) {
  const { sh } = getSheet_(fid, "Personnage");
  return Number(sh.getRange("AD16").getValue() || 0);
}

function getActionsInitiative() {
  return [
    { id: 1, cat: "Mouvement", label: "Avancer prudemment", kind: "fixed", mod: -5 },
    { id: 2, cat: "Mouvement", label: "Se précipiter", kind: "fixed", mod: +5 },
    { id: 3, cat: "Observation", label: "Observer les alentours", kind: "info5" },
    { id: 4, cat: "Combat", label: "Prendre une garde défensive", kind: "range", min: -10, max: -5, step: 1 }
  ];
}
