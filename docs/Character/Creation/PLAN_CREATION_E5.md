PLAN TECHNIQUE — Étape 5 Wizard + Module 6 Fiche
SECTION 1 — MIGRATIONS
Migration 097 : Nettoyage + création char_advantages + pc_postcreation
js

// server/migrations/097_step5_advantages.js

export const up = async (knex) => {

  // 1. Supprimer l'ancienne table erronée (si pas déjà fait par 094)
  await knex.schema.dropTableIfExists('char_advantages');

  // 2. Créer la nouvelle table avec soft-delete
  await knex.schema.createTable('char_advantages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE');
    table.text('advantage_id').notNullable()
      .references('advantage_id').inTable('ref_advantages');
    
    // Snapshot intégral de ref_advantages au moment de l'ajout
    table.jsonb('snapshot_data').notNullable();
    
    // Traçabilité
    table.timestamp('acquired_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text('acquired_during').notNullable();  // 'creation_step5', 'campaign', 'trauma', 'adjustment'
    table.timestamp('removed_at', { useTz: true });
    table.text('removal_reason');
    
    // Contrainte partielle : un seul actif par personnage et advantage_id
    table.unique(['char_sheet_id', 'advantage_id'], {
      predicate: knex.whereRaw('removed_at IS NULL')
    });
  });

  // 3. Ajouter pc_postcreation à char_pc_ledger
  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.integer('pc_postcreation').defaultTo(0);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantages');
  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.dropColumn('pc_postcreation');
  });
};

SECTION 2 — CONSTRAINT REGISTRY
js

// server/src/services/advantageConstraints.js

/**
 * Registre déclaratif des contraintes de validation.
 * Chaque contrainte est une fonction pure : (inputs) => { valid, error }
 * Ajouter une nouvelle règle = ajouter une entrée, pas modifier le code existant.
 */

export const CONSTRAINTS = {

  // R1 — L'Avantage existe dans ref_advantages
  exists: {
    validate: (advantageId, refAdvantages) => {
      return refAdvantages.some(a => a.advantage_id === advantageId);
    },
    message: () => 'Avantage inconnu.'
  },

  // R2 — Pas déjà possédé (doublon actif)
  not_already_owned: {
    validate: (advantageId, currentAdvantages) => {
      return !currentAdvantages.some(a => a.advantage_id === advantageId);
    },
    message: (adv) => `Vous possédez déjà "${adv.name}".`
  },

  // R3 — Unicité absolue (is_unique = true)
  unique_absolute: {
    applies: (refAdvantage) => refAdvantage.is_unique,
    validate: (advantageId, currentAdvantages) => {
      return !currentAdvantages.some(a => a.advantage_id === advantageId);
    },
    message: (adv) => `"${adv.name}" est unique et ne peut être pris qu'une seule fois.`
  },

  // R4 — Limite par famille (family non null + family_limit)
  family_limit: {
    applies: (refAdvantage) => refAdvantage.family !== null,
    validate: (advantageId, currentAdvantages, refAdvantage, allRefAdvantages) => {
      const sameFamily = currentAdvantages.filter(a => {
        const ref = allRefAdvantages.find(r => r.advantage_id === a.advantage_id);
        return ref?.family === refAdvantage.family;
      });
      const limit = refAdvantage.family_limit ?? 1;
      return sameFamily.length < limit;
    },
    message: (adv) => `Vous possédez déjà un Avantage de la famille "${adv.family}" (limite : ${adv.family_limit ?? 1}).`
  },

  // R5 — Limite PC Désavantages (max 10)
  max_desavantage_pc: {
    applies: (refAdvantage) => refAdvantage.type === 'disadvantage',
    validate: (advantageId, currentAdvantages, refAdvantage, allRefAdvantages) => {
      const currentDesavPC = currentAdvantages
        .filter(a => a.type === 'disadvantage')
        .reduce((sum, a) => sum + Math.abs(a.cost_pc), 0);
      const newTotal = currentDesavPC + Math.abs(refAdvantage.cost_pc);
      return newTotal <= 10;
    },
    message: () => 'Limite de 10 PC de Désavantages atteinte.'
  },

  // R6 — PC disponibles (Avantages uniquement)
  sufficient_pc: {
    applies: (refAdvantage) => refAdvantage.type === 'advantage',
    validate: (advantageId, currentAdvantages, refAdvantage, allRefAdvantages, ledger) => {
      const available = ledger.pc_total
        - (ledger.pc_spent_step1 + ledger.pc_spent_step2 + ledger.pc_spent_step3
           + ledger.pc_spent_step4 + ledger.pc_spent_step5)
        + ledger.pc_gained_desavantages
        + ledger.pc_postcreation;
      return available >= refAdvantage.cost_pc;
    },
    message: (adv) => `PC insuffisants : ${adv.cost_pc} requis.`
  }
};

/**
 * Point d'entrée unique de validation.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAdvantage(advantageId, currentAdvantages, ledger, allRefAdvantages) {
  const refAdvantage = allRefAdvantages.find(a => a.advantage_id === advantageId);

  for (const [key, constraint] of Object.entries(CONSTRAINTS)) {
    // Certaines contraintes ne s'appliquent que sous condition
    if (constraint.applies && !constraint.applies(refAdvantage)) continue;

    const valid = constraint.validate(
      advantageId,
      currentAdvantages,
      refAdvantage,
      allRefAdvantages,
      ledger
    );
    if (!valid) {
      return { valid: false, error: constraint.message(refAdvantage) };
    }
  }

  return { valid: true };
}

SECTION 3 — ROUTES API
3.1 Ajouter un Avantage
text

POST /char-sheet/:characterId/advantages
Body: { advantage_id: "adv_006" }

Guards successifs :

    characterId valide → char_sheet existe

    Charger currentAdvantages (WHERE removed_at IS NULL)

    Charger char_pc_ledger

    Charger ref_advantages

    validateAdvantage(advantage_id, currentAdvantages, ledger, refAdvantages) → si invalide, 400

    Coût PC : refAdvantage.cost_pc

Transaction atomique :
sql

BEGIN
  -- Insérer l'avantage
  INSERT INTO char_advantages (char_sheet_id, advantage_id, snapshot_data, acquired_during)
  VALUES (:sheetId, :advId, :snapshot, 'campaign');

  -- Mettre à jour le ledger
  IF refAdvantage.type = 'advantage' THEN
    UPDATE char_pc_ledger SET pc_spent_step5 = pc_spent_step5 + :cost
    WHERE char_sheet_id = :sheetId;
  ELSE
    UPDATE char_pc_ledger SET pc_gained_desavantages = pc_gained_desavantages + ABS(:cost)
    WHERE char_sheet_id = :sheetId;
  END IF;
COMMIT

Retour : { advantage, availablePC, effectiveAttributes }
Broadcast : ADVANTAGE_ADDED
3.2 Retirer un Avantage
text

DELETE /char-sheet/:characterId/advantages/:advantageId
Body: { reason: "trauma_session_42" }  // optionnel

Guards :

    L'avantage existe et est actif (removed_at IS NULL)

    Si Désavantage retiré → le joueur perd les PC correspondants (vérifier que ça ne rend pas le solde négatif)

Transaction atomique :
sql

BEGIN
  -- Soft-delete
  UPDATE char_advantages 
  SET removed_at = now(), removal_reason = :reason
  WHERE id = :advId AND char_sheet_id = :sheetId;

  -- Mettre à jour le ledger (inverse de l'ajout)
  IF refAdvantage.type = 'advantage' THEN
    UPDATE char_pc_ledger SET pc_spent_step5 = pc_spent_step5 - cost_pc
    WHERE char_sheet_id = :sheetId;
  ELSE
    UPDATE char_pc_ledger SET pc_gained_desavantages = pc_gained_desavantages - ABS(cost_pc)
    WHERE char_sheet_id = :sheetId;
  END IF;
COMMIT

Retour : { deleted: true, availablePC }
Broadcast : ADVANTAGE_REMOVED
3.3 Lister les Avantages
text

GET /char-sheet/:characterId/advantages

Requête :
sql

SELECT ca.*, ra.name, ra.type, ra.description, ra.cost_pc, ra.special_rule
FROM char_advantages ca
JOIN ref_advantages ra ON ra.advantage_id = ca.advantage_id
WHERE ca.char_sheet_id = :sheetId
  AND ca.removed_at IS NULL
ORDER BY ca.acquired_at ASC;

Retour : { advantages: [...] }
3.4 Route Wizard — Validation groupée
text

POST /creation/:sheetId/step5
Body: { advantages: ['adv_001', 'adv_006', 'adv_055'] }

Spécifique au Wizard :

    Guard : creation_state = 'draft_step4'

    Valide chaque avantage du batch avec le Constraint Registry

    Si toutes les contraintes passent → transaction atomique (DELETE actifs existants + INSERT nouveaux)

    Passe creation_state = 'draft_step5'

    acquired_during = 'creation_step5'

Différence avec les routes unitaires : batch + avance creation_state. Les routes unitaires servent pour les modifications post-création.
SECTION 4 — SERVICE LAYER
js

// server/src/services/advantageService.js

import { validateAdvantage } from './advantageConstraints.js';
import { db } from '../db.js';  // ou knex

export async function addAdvantage(sheetId, advantageId, acquiredDuring = 'campaign', notes = null) {
  // 1. Charger les données
  const [currentAdvantages, ledger, refAdvantages] = await Promise.all([
    db('char_advantages').where({ char_sheet_id: sheetId, removed_at: null }),
    db('char_pc_ledger').where({ char_sheet_id: sheetId }).first(),
    db('ref_advantages').select('*')
  ]);

  const refAdvantage = refAdvantages.find(a => a.advantage_id === advantageId);

  // 2. Valider
  const validation = validateAdvantage(advantageId, currentAdvantages, ledger, refAdvantages);
  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }

  // 3. Snapshot
  const snapshot = { ...refAdvantage };  // copie intégrale

  // 4. Transaction
  return db.transaction(async (trx) => {
    const [inserted] = await trx('char_advantages')
      .insert({
        char_sheet_id: sheetId,
        advantage_id: advantageId,
        snapshot_data: snapshot,
        acquired_during: acquiredDuring,
        notes
      })
      .returning('*');

    if (refAdvantage.type === 'advantage') {
      await trx('char_pc_ledger')
        .where({ char_sheet_id: sheetId })
        .increment('pc_spent_step5', refAdvantage.cost_pc);
    } else {
      await trx('char_pc_ledger')
        .where({ char_sheet_id: sheetId })
        .increment('pc_gained_desavantages', Math.abs(refAdvantage.cost_pc));
    }

    return inserted;
  });
}

export async function removeAdvantage(sheetId, advantageId, reason = null) {
  // 1. Trouver l'entrée active
  const existing = await db('char_advantages')
    .where({ id: advantageId, char_sheet_id: sheetId, removed_at: null })
    .first();

  if (!existing) throw new NotFoundError('Avantage non trouvé ou déjà retiré.');

  const refAdvantage = existing.snapshot_data;

  // 2. Vérifier que le retrait ne rend pas le solde PC négatif
  const ledger = await db('char_pc_ledger').where({ char_sheet_id: sheetId }).first();
  const available = /* calcul availablePC */;
  if (refAdvantage.type === 'disadvantage' && available < Math.abs(refAdvantage.cost_pc)) {
    throw new ValidationError('PC insuffisants pour retirer ce Désavantage.');
  }

  // 3. Transaction
  return db.transaction(async (trx) => {
    await trx('char_advantages')
      .where({ id: advantageId })
      .update({ removed_at: trx.fn.now(), removal_reason: reason });

    if (refAdvantage.type === 'advantage') {
      await trx('char_pc_ledger')
        .where({ char_sheet_id: sheetId })
        .decrement('pc_spent_step5', refAdvantage.cost_pc);
    } else {
      await trx('char_pc_ledger')
        .where({ char_sheet_id: sheetId })
        .decrement('pc_gained_desavantages', Math.abs(refAdvantage.cost_pc));
    }

    return { deleted: true };
  });
}

export async function getAdvantages(sheetId) {
  return db('char_advantages as ca')
    .join('ref_advantages as ra', 'ra.advantage_id', 'ca.advantage_id')
    .where({ 'ca.char_sheet_id': sheetId, 'ca.removed_at': null })
    .orderBy('ca.acquired_at', 'asc')
    .select('ca.*', 'ra.name', 'ra.type', 'ra.description', 'ra.cost_pc', 'ra.special_rule');
}

SECTION 5 — CALCUL DES EFFETS SUR LA FICHE

Dans CharacterSheet.jsx, après chargement des avantages :
js

// Nouvelle fonction dans polarisUtils.js
export function applyAdvantageEffects(advantages, currentSecondary, archetype) {
  const effects = {
    reaction: 0,
    breath: 0,
    handPref: null,
    isFertile: null,
    resistances: {},
    conditions: {},
    savings: 0,
    monthlyIncome: 0,
    skillPoints: 0,
    ageModifier: 0
  };

  for (const adv of advantages) {
    const snap = adv.snapshot_data;

    // mod_attribute
    if (snap.mod_attribute === 'reaction') {
      effects.reaction += snap.mod_value;
    }
    if (snap.mod_attribute === 'breath') {
      effects.breath += snap.mod_value;
    }

    // mod_identity
    if (snap.mod_identity?.hand_pref) {
      effects.handPref = snap.mod_identity.hand_pref;
    }
    if (snap.mod_identity?.is_fertile) {
      effects.isFertile = snap.mod_identity.is_fertile;
    }

    // mod_resistance
    if (snap.mod_resistance) {
      effects.resistances[snap.mod_resistance] = 
        (effects.resistances[snap.mod_resistance] || 0) + snap.mod_res_value;
    }

    // mod_conditions
    if (snap.mod_conditions) {
      Object.assign(effects.conditions, snap.mod_conditions);
    }

    // mod_savings / mod_monthly_income
    if (snap.mod_savings) effects.savings += snap.mod_savings;
    if (snap.mod_monthly_income) effects.monthlyIncome += snap.mod_monthly_income;

    // mod_skill_points / mod_age
    if (snap.mod_skill_points) effects.skillPoints += snap.mod_skill_points;
    if (snap.mod_age) effects.ageModifier += snap.mod_age;
  }

  return effects;
}

Utilisation dans CharacterSheet.jsx :
js

// Dans le useEffect de chargement
const effects = applyAdvantageEffects(advantages, secondary, archetype);

// Module 2 — hand_pref et is_fertile forcés si mod_identity présent
setHandPref(effects.handPref || identity.hand_pref);
setIsFertile(effects.isFertile ?? archetype.is_fertile);

// Module 4 — calcSecondary modifié
const secondary = calcSecondary(naMap, effects.reaction);
// → polarisRound((ADA + PER) / 2) + effects.reaction

SECTION 6 — REMPLACEMENT D'ADVANTAGES PANEL

AdvantagesPanel.jsx est remplacé par un nouveau composant AdvantagesPanelV2.jsx :

Fonctionnalités :

    Liste des Avantages actifs (depuis GET /char-sheet/:id/advantages)

    Bouton "+" → modale de sélection (liste ref_advantages, filtrable par type)

    Bouton "×" → retrait (avec confirmation si Désavantage)

    Affichage des effets mécaniques sous chaque Avantage

    Badge "Avantage" (bleu) / "Désavantage" (rouge)

    Compteur PC disponibles visible

Mutations et Force Polaris :

    Extraites du composant → gérées ailleurs (étape 3 Wizard pour mutations, ref_advantages pour Polaris)

SECTION 7 — FICHIERS TOUCHÉS — RÉCAPITULATIF
Fichier	Action
server/migrations/097_step5_advantages.js	Créé
server/src/services/advantageConstraints.js	Créé
server/src/services/advantageService.js	Créé
server/src/routes/advantages.js	Créé (POST, DELETE, GET)
server/src/routes/creation.js	Modifié (+ POST /step5)
shared/polarisUtils.js	Modifié (+ applyAdvantageEffects)
client/src/components/creation/Step5Advantages.jsx	Créé
client/src/components/AdvantagesPanelV2.jsx	Créé (remplace AdvantagesPanel)
client/src/components/CharacterSheet.jsx	Modifié (utilise V2 + applique effets)
client/src/locales/fr.json	Modifié (+ clés step5, advantagesV2)
SECTION 8 — SCÉNARIO DE TEST

Phase 1 — Wizard Étape 5

    creation_state = 'draft_step4'

    Joueur sélectionne "Bons réflexes" (adv_006, 2 PC) → validé

    Joueur sélectionne "Ambidextre" (adv_002, 1 PC) → validé

    Joueur sélectionne "Allergie légère" (adv_041, -1 PC) → validé

    Joueur tente "Bons réflexes" une 2e fois → rejeté (déjà possédé)

    Joueur tente "Infirmité 7 PC" → rejeté (limite 10 PC Désavantages : 1+7=8 OK, mais vérifier)

    POST /creation/:sheetId/step5 avec ['adv_006', 'adv_002', 'adv_041'] → creation_state = 'draft_step5'

    availablePC = 20 - (étapes 1-4) - 3 + 1

Phase 2 — Fiche Personnage

    GET /char-sheet/:id/advantages → 3 entrées

    hand_pref forcé à "A" (Ambidextre)

    REA = calcSecondary().rea + 3 (Bons réflexes)

    mod_conditions: { penalty: -3 } affiché pour Allergie

Phase 3 — Campagne (retrait)

    DELETE /char-sheet/:id/advantages/:uuid avec { reason: "trauma" }

    Avantage soft-deleted

    pc_gained_desavantages décrémenté

    Effets retirés du calcul de fiche

Plan complet.