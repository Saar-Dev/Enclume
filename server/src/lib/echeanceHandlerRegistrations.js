// server/src/lib/echeanceHandlerRegistrations.js — point d'enregistrement unique des handlers
// d'échéances (Lot 2, docs/PLAN_FATIGUE_DOMMAGES.md §8). `shared/echeanceTypeRegistry.js` reste
// framework-only (aucune dépendance serveur, importable côté client) — les handlers réels font du
// vrai travail DB (trx), donc leur enregistrement vit ici, côté serveur, importé une seule fois au
// démarrage (server/src/index.js). Import à effet de bord uniquement (push dans le registre) : ne
// jamais réimporter ce fichier ailleurs qu'à l'entrée du serveur, sous peine de doublons.
import { ECHEANCE_TYPE_REGISTRY } from '../../../shared/echeanceTypeRegistry.js'
import { woundHealingCheckHandler, woundInfectionCheckHandler } from './woundEvolutionService.js'
import { coldFatigueCheckHandler, coldDamageTickHandler } from './coldExposureService.js'

ECHEANCE_TYPE_REGISTRY.push(
  { key: 'wound_healing_check', interactive: true, handler: woundHealingCheckHandler },
  { key: 'wound_infection_check', interactive: true, handler: woundInfectionCheckHandler },
  // Froid (docs/PLAN_FATIGUE_DOMMAGES.md §11 Lot 5) — patron automatique, jamais de revue MJ.
  { key: 'cold_fatigue_check', interactive: false, handler: coldFatigueCheckHandler },
  { key: 'cold_damage_tick', interactive: false, handler: coldDamageTickHandler },
)
