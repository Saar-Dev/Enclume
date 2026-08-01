// Types de dégâts d'arme affichés en badge coloré (équipement + inventaire).
// Source unique : un futur type "environnemental" (feu/froid/gaz/acide — armes rares, toujours en
// plus d'un dégât Normal et/ou Choc, jamais un 3e type indépendant) s'ajoutera ici, jamais dupliqué
// en dur dans les composants qui l'affichent.
export const DAMAGE_TYPE_BADGES = [
  { key: 'normal', field: 'ref_damage_h', className: 'badge-damage-normal', i18nKey: 'weaponPanel.statDamage' },
  { key: 'choc',   field: 'ref_shock',    className: 'badge-damage-choc',   i18nKey: 'weaponPanel.statShock' },
]
