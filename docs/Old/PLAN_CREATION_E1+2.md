> Statut : ⚠️ ARCHITECTURE API OBSOLÈTE — routes step-by-step (`POST /step1`, `/step2`,
> `/rollback-to-step1`) remplacées par `POST /:sheetId/reconcile` (`reconcileCreation`). Fondations
> DB construites puis renumérotées (migration 097). Détail : `docs/JOURNAL6.md` "Session 149".
> Archivé dans `docs/Old/` — Session 149

TAPES 1 & 2 CRÉATION DE PERSONNAGE

    Vérifié contre LdB p.117-122 + migrations 33 et 36 + polarisUtils.js existant.
    Corrections : Option B (pas de colonne genotype_modifier), migration 96, table campaign_rules.

1. COMPOSANTS UI — INVENTAIRE EXHAUSTIF
1.1 Header commun du Wizard

Affiché sur toutes les étapes :
Élément	Source
Badge ambiance : REALISTE, INTERMEDIAIRE, HEROIQUE, PERSONNALISE	campaigns.ambiance
Badge Chance : 11, 13 ou 15	CHANCE_AMBIANCE[ambiance] depuis polarisUtils.js
PC restants : availablePC = pc_total - Σ(pc_spent) + pc_gained	Calcul serveur uniquement, retourné dans chaque réponse API
Étape courante : 1/5 ou 2/5	State local Wizard
Aperçu attributs effectifs : base_level + mod_from_ref_genotypes + pc_modifier	Recalculé à chaque changement, broadcast au GM
1.2 Étape 1 — Capacités de base

Affichage Contexte (lecture seule) :

    Pool de points d'Attributs de base : 30, 38 ou 46 (selon campaigns.ambiance)
    Points supplémentaires gagnés via PC : pcSpentStep1 × 2

Sélecteur de configuration :

    RadioGroup Genre : MASCULIN / FEMININ
    Visible uniquement si campaign_rules.option_feminin_bonus = true
    Si invisible → comportement MASCULIN par défaut

Zone de répartition — 8 blocs identiques :

    Label (FOR, CON, COO, ADA, PER, INT, VOL, PRE)
    Valeur actuelle (démarre à 7, ou 5 pour FOR si féminin actif)
    Boutons - / +

Compteurs dynamiques :

    Points restants = pool_ambiance + (pcSpentStep1 × 2) - Σ(coûts cumulés)
    Points bonus féminins restants (conditionnel) : 0/2 à distribuer en COO ou PRE

Bouton Suivant : désactivé tant que pools ≠ 0 ou contraintes non respectées.
1.3 Étape 2 — Type génétique

Diaporama — 4 slides :

Chaque slide contient :
Élément	Source
Illustration	ref_genotypes.illustration_url (MinIO)
Nom	ref_genotypes.label
Badge coût PC	ref_genotypes.pc_cost — "0 PC" / "4 PC" / "5 PC"
Description	ref_genotypes.description (texte long)
Modificateurs d'Attributs	Colonnes mod_for...mod_pre depuis ref_genotypes
Aperçu "Vos attributs après sélection"	getEffectiveAttributes(baseAttrs, genotypeId, pcMods) — calculé depuis ref_genotypes.mod_*, mise à jour temps réel
Prérequis Professions	ref_genotypes.prereq_professions — texte informatif
Avantages/Désavantages résumés	Texte informatif (pas d'impact mécanique MVP)
Case à cocher "Déserteur"	Visible uniquement si genotypeId === 'TEC_HYB' ET has_deserter_option === true → coût réduit de 5 à 4 PC
Bouton "Sélectionner"	Mise en évidence si sélection active

Navigation :

    Flèches gauche/droite + dots (4 positions)

    Slide active = sélection courante (ou aucune)

Bouton Précédent : retour étape 1 avec rollback transactionnel (POST /creation/:sheetId/rollback-to-step1)
Bouton Suivant : désactivé si aucun génotype sélectionné ou PC insuffisants
2. ARCHITECTURE — BASES PARTAGÉES
2.1 State machine du Wizard

Colonne char_sheet.creation_state :
Valeur	Signification
NULL	Wizard non encore ouvert sur cette fiche
draft_step1	Étape 1 validée
draft_step2	Étape 2 validée
draft_step3	Étape 3 validée
draft_step4	Étape 4 validée
draft_step5	Étape 5 validée
complete	Création terminée
2.2 char_pc_ledger — Singleton par personnage
sql

char_pc_ledger (
  char_sheet_id UUID PRIMARY KEY REFERENCES char_sheet(id) ON DELETE CASCADE,
  pc_total INTEGER NOT NULL DEFAULT 20,
  pc_spent_step1 INTEGER DEFAULT 0,
  pc_spent_step2 INTEGER DEFAULT 0,
  pc_spent_step3 INTEGER DEFAULT 0,
  pc_spent_step4 INTEGER DEFAULT 0,
  pc_spent_step5 INTEGER DEFAULT 0,
  pc_gained_desavantages INTEGER DEFAULT 0
)

availablePC = pc_total - (pc_spent_step1 + pc_spent_step2 + pc_spent_step3 + pc_spent_step4 + pc_spent_step5) + pc_gained_desavantages

Calculé côté serveur uniquement, retourné dans chaque réponse API.
2.3 campaign_rules — Configuration des options de règles par campagne
sql

campaign_rules (
  campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  option_feminin_bonus BOOLEAN DEFAULT false,
  option_mutations_aleatoires BOOLEAN DEFAULT false,
  option_polaris_latent BOOLEAN DEFAULT false,
  option_niveau_max_competences BOOLEAN DEFAULT false,
  option_personnages_experimentes BOOLEAN DEFAULT false,
  option_personnages_jeunes BOOLEAN DEFAULT false,
  option_avantages_pro_aleatoires BOOLEAN DEFAULT false
)

Pour le MVP étapes 1 & 2 : seule option_feminin_bonus est active. Les autres colonnes sont créées pour les étapes 3-5.
2.4 char_attributes — Colonnes de modificateurs

PK : (char_sheet_id, attr_id) — confirmée par migration 36.
Colonne	Rôle	Remplie à
base_level	Valeur issue de la répartition points	Étape 1
pc_modifier	Modificateurs futurs (capacités spéciales, âge…)	Étapes 3, 4, 5

Il n'y a PAS de colonne genotype_modifier. Les modificateurs de génotype sont lus depuis ref_genotypes.mod_* via char_archetype.genotype_id.

Valeur effective = base_level + mod_from_ref_genotypes + pc_modifier — calculée, jamais stockée.
2.5 Chaîne de données
text

char_sheet.character_id → characters.id → characters.campaign_id
  ├── campaigns.id → campaigns.ambiance
  └── campaigns.id → campaign_rules.campaign_id → campaign_rules.option_*

3. PLAN EXACT D'IMPLÉMENTATION
A. Fichiers touchés
Fichier	Rôle
server/migrations/096_char_creation_core.js	Migration unique
shared/polarisUtils.js	+getEffectiveAttributes, +validateStep2Constraints
server/src/services/creationService.js	initWizard, validateAndPersistStep1, getStep2Data, validateAndPersistStep2, rollbackToStep1
server/src/routes/creation.js	POST /init, POST /step1, GET /step2/:sheetId, POST /step2/:sheetId, POST /rollback-to-step1
client/src/components/creation/CreationWizard.jsx	Orchestration + state global + broadcasts socket
client/src/components/creation/Step1Attributes.jsx	UI étape 1
client/src/components/creation/Step2Genotype.jsx	UI étape 2
client/src/locales/fr.json	Clés i18n étapes 1 & 2
B. Écritures en Base de Données
Phase 0 — initWizard(sheetId)

Jointure : char_sheet → characters → campaigns, lecture campaigns.ambiance.
Jointure : campaigns.id → campaign_rules.campaign_id, lecture des flags.
Table	Opération	Données
campaigns	READ	ambiance
campaign_rules	READ	Tous les flags d'options
char_pc_ledger	INSERT (si absent)	pc_total = 20, tout à 0
char_sheet	READ	creation_state existant

Retourne : { sheetId, pcTotal: 20, ambiance, chc, poolBase, rules: { optionFemininBonus, ... } }
Phase 1 — validateAndPersistStep1(sheetId, data)

data = { attributs, ambiance, pcSpentStep1, isFeminin, sex }

Guard : creation_state IS NULL OR creation_state = 'draft_step1'
Validation : validateStep1(attributs, ambiance, pcSpentStep1, isFeminin) — déjà dans polarisUtils.js
Guard : availablePC >= pcSpentStep1

Transaction atomique :
sql

BEGIN;
  UPDATE char_sheet SET chc = ?, creation_state = 'draft_step1' WHERE id = ?;
  UPDATE char_archetype SET sex = ? WHERE char_sheet_id = ?;
  -- UPSERT char_attributes (8 lignes) : base_level final, pc_modifier = 0
  INSERT INTO char_attributes (char_sheet_id, attr_id, base_level, pc_modifier)
  VALUES (?, 'FOR', ?, 0), (?, 'CON', ?, 0), ... (?, 'PRE', ?, 0)
  ON CONFLICT (char_sheet_id, attr_id)
  DO UPDATE SET base_level = EXCLUDED.base_level, pc_modifier = 0;
  UPDATE char_pc_ledger SET pc_spent_step1 = ? WHERE char_sheet_id = ?;
COMMIT;

Retourne : { success, chc, attributes, availablePC }
Broadcast : CREATION_STEP1_COMPLETE
Phase 2 — getStep2Data(sheetId)

Guard : creation_state = 'draft_step1'

Requête :
sql

SELECT g.*, ca.base_level, cpl.pc_spent_step2, cpl.pc_gained_desavantages, cpl.pc_total,
       ca2.pc_spent_step1, ca2.pc_spent_step3, ca2.pc_spent_step4, ca2.pc_spent_step5,
       arch.genotype_id as current_genotype_id
FROM char_sheet cs
JOIN char_pc_ledger cpl ON cpl.char_sheet_id = cs.id
JOIN char_archetype arch ON arch.char_sheet_id = cs.id
CROSS JOIN ref_genotypes g
LEFT JOIN char_attributes ca ON ca.char_sheet_id = cs.id
WHERE cs.id = ?

Calcule availablePC côté serveur.
Pour chaque génotype, calcule l'aperçu effectif : base_level + g.mod_* + pc_modifier.

Retourne : { genotypes, currentAttributes, availablePC, currentGenotypeId }
Phase 2 — validateAndPersistStep2(sheetId, data)

data = { genotypeId, isDeserter }

Guard : creation_state = 'draft_step1'
Guard : isDeserter && genotypeId !== 'TEC_HYB' → 400
Coût = genotype.pc_cost - (isDeserter && genotypeId === 'TEC_HYB' ? 1 : 0)
Guard : availablePC >= coût

Transaction atomique :
sql

BEGIN;
  UPDATE char_archetype SET genotype_id = ? WHERE char_sheet_id = ?;
  UPDATE char_sheet SET creation_state = 'draft_step2' WHERE id = ?;
  UPDATE char_pc_ledger SET pc_spent_step2 = ? WHERE char_sheet_id = ?;
COMMIT;

Note : char_attributes n'est PAS modifiée. Les modificateurs de génotype sont lus depuis ref_genotypes à chaque calcul.

Retourne : { success, effectiveAttributes, availablePC }
Broadcast : CREATION_STEP2_COMPLETE
Phase 2b — rollbackToStep1(sheetId)

Guard : creation_state = 'draft_step2'

Transaction atomique :
sql

BEGIN;
  UPDATE char_archetype SET genotype_id = NULL WHERE char_sheet_id = ?;
  UPDATE char_sheet SET creation_state = 'draft_step1' WHERE id = ?;
  UPDATE char_pc_ledger SET pc_spent_step2 = 0 WHERE char_sheet_id = ?;
COMMIT;

Note : char_attributes non touchée (pas de genotype_modifier à remettre à zéro).

Retourne : { success, availablePC }
C. Ce qui ne change pas
    char_identity, char_skills — non altérés
    char_attributes.pc_modifier — réservé étapes futures (3, 4, 5)
    ref_genotypes — table de référence, jamais modifiée par le wizard
    Aucun calcul d'attribut secondaire (Initiative, Seuils…) — reporté à la finalisation du wizard

4. RÈGLES DE GESTION & ALGORITHMES
4.1 Constantes — déjà dans shared/polarisUtils.js

✅ POOL_AMBIANCE, CHANCE_AMBIANCE, COST_LOOKUP, PC_MAX_ETAPE1
✅ calcPoolTotal, calcAttributCost, calcTotalCost, validateStep1
4.2 Fonctions à ajouter dans shared/polarisUtils.js
js

// Calcule les attributs effectifs (base + génotype + pc_modifier)
// genotypeMods est lu depuis ref_genotypes.mod_* par le serveur
export function getEffectiveAttributes(baseAttrs, genotypeMods, pcMods = {}) {
  const ATTRS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE'];
  const result = {};
  for (const attr of ATTRS) {
    result[attr] = (baseAttrs[attr] || 7) + (genotypeMods[attr] || 0) + (pcMods[attr] || 0);
  }
  return result;
}

// Vérifie que le joueur a assez de PC pour le génotype choisi
export function validateStep2Constraints(genotype, availablePC, isDeserter = false) {
  const erreurs = [];
  const cost = genotype.pc_cost - (isDeserter && genotype.id === 'TEC_HYB' ? 1 : 0);
  
  if (availablePC < cost) {
    erreurs.push(`PC insuffisants : ${cost} requis, ${availablePC} disponibles`);
  }
  
  return { valide: erreurs.length === 0, erreurs, cost };
}

4.3 Services (creationService.js)
text

initWizard(sheetId)
  → Jointure char_sheet → characters → campaigns → campaign_rules
  → Si char_pc_ledger existe déjà → lecture seule (wizard déjà initialisé)
  → Sinon → INSERT char_pc_ledger (pc_total = 20)
  → Retourne { sheetId, pcTotal, ambiance, chc, poolBase, rules }

validateAndPersistStep1(sheetId, data)
  → data = { attributs, ambiance, pcSpentStep1, isFeminin, sex }
  → Guard : creation_state IS NULL OR 'draft_step1'
  → Valide avec validateStep1 (existante)
  → Vérifie availablePC >= pcSpentStep1
  → Transaction atomique (cf. 3.B Phase 1)
  → Retourne { success, chc, attributes, availablePC }

getStep2Data(sheetId)
  → Guard : creation_state = 'draft_step1'
  → Lit ref_genotypes, char_attributes, char_pc_ledger, char_archetype.genotype_id
  → Pour chaque génotype, lit mod_* et calcule l'aperçu effectif
  → Retourne { genotypes, currentAttributes, availablePC, currentGenotypeId }

validateAndPersistStep2(sheetId, data)
  → data = { genotypeId, isDeserter }
  → Guard : creation_state = 'draft_step1'
  → Guard : isDeserter && genotypeId !== 'TEC_HYB' → 400
  → Coût = genotype.pc_cost - (isDeserter && TEC_HYB ? 1 : 0)
  → Vérifie availablePC >= coût
  → Transaction atomique (cf. 3.B Phase 2)
  → Retourne { success, effectiveAttributes, availablePC }

rollbackToStep1(sheetId)
  → Guard : creation_state = 'draft_step2'
  → Transaction atomique (cf. 3.B Phase 2b)
  → Retourne { success, availablePC }

5. MIGRATION 096
js

// server/migrations/096_char_creation_core.js

export const up = async (knex) => {

  // === campaigns : ambiance ===
  await knex.schema.alterTable('campaigns', (table) => {
    table.text('ambiance').defaultTo('INTERMEDIAIRE');
  });

  // === campaign_rules : options de règles par campagne ===
  await knex.schema.createTable('campaign_rules', (table) => {
    table.uuid('campaign_id')
      .primary()
      .references('id').inTable('campaigns')
      .onDelete('CASCADE');
    table.boolean('option_feminin_bonus').defaultTo(false);
    table.boolean('option_mutations_aleatoires').defaultTo(false);
    table.boolean('option_polaris_latent').defaultTo(false);
    table.boolean('option_niveau_max_competences').defaultTo(false);
    table.boolean('option_personnages_experimentes').defaultTo(false);
    table.boolean('option_personnages_jeunes').defaultTo(false);
    table.boolean('option_avantages_pro_aleatoires').defaultTo(false);
  });

  // === char_sheet : creation_state ===
  await knex.schema.alterTable('char_sheet', (table) => {
    table.text('creation_state').defaultTo(null);
  });

  // === char_pc_ledger : singleton ===
  await knex.schema.dropTableIfExists('char_pc_ledger');
  await knex.schema.createTable('char_pc_ledger', (table) => {
    table.uuid('char_sheet_id')
      .primary()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE');
    table.integer('pc_total').notNullable().defaultTo(20);
    table.integer('pc_spent_step1').defaultTo(0);
    table.integer('pc_spent_step2').defaultTo(0);
    table.integer('pc_spent_step3').defaultTo(0);
    table.integer('pc_spent_step4').defaultTo(0);
    table.integer('pc_spent_step5').defaultTo(0);
    table.integer('pc_gained_desavantages').defaultTo(0);
  });

  // === ref_genotypes : colonnes informatives ===
  await knex.schema.alterTable('ref_genotypes', (table) => {
    table.text('description');
    table.text('illustration_url');
    table.jsonb('prereq_professions').defaultTo(null);
    table.integer('pc_cost').defaultTo(0);
    table.boolean('has_deserter_option').defaultTo(false);
  });

  // === Seeds ref_genotypes ===
  await knex('ref_genotypes').where('id', 'HUMAIN').update({
    description: 'Humain normal. Aucune modification des Attributs. Aucun Avantage ni Désavantage spécifique.',
    pc_cost: 0,
    has_deserter_option: false,
  });
  await knex('ref_genotypes').where('id', 'HYB_NAT').update({
    description: 'Hybride naturel. Né avec les mutations nécessaires à la survie sous-marine. Le plus avantagé sous l\'eau, le plus désavantagé au sec.',
    pc_cost: 5,
    has_deserter_option: false,
  });
  await knex('ref_genotypes').where('id', 'GEN_HYB').update({
    description: 'Géno-hybride. Humain transformé par la technologie du Culte du Trident. Apparence préservée, adaptation aquatique sans mutation visible.',
    pc_cost: 5,
    prereq_professions: JSON.stringify([{ profession_id: 'culte_trident_gsi', years: 1 }]),
    has_deserter_option: false,
  });
  await knex('ref_genotypes').where('id', 'TEC_HYB').update({
    description: 'Techno-hybride. Individu modifié par l\'Hégémonie, souvent contre son gré. Attributs physiques grandement augmentés mais atrocement défiguré.',
    pc_cost: 5,
    prereq_professions: JSON.stringify([
      { profession_id: 'soldat_milicien', years: 2 },
      { profession_id: 'techno_hybride', years: 1 },
    ]),
    has_deserter_option: true,
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('ambiance');
  });
  await knex.schema.dropTableIfExists('campaign_rules');
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('creation_state');
  });
  await knex.schema.dropTableIfExists('char_pc_ledger');
  await knex.schema.alterTable('ref_genotypes', (table) => {
    table.dropColumn('description');
    table.dropColumn('illustration_url');
    table.dropColumn('prereq_professions');
    table.dropColumn('pc_cost');
    table.dropColumn('has_deserter_option');
  });
};

6. CLÉS i18n (fr.json — ajouts)
json

{
  "creation": {
    "wizard": {
      "step": "Étape {{current}}/5",
      "pc_remaining": "PC restants : {{count}}",
      "prev": "Précédent",
      "next": "Suivant",
      "ambiance": "Ambiance : {{mode}}"
    },
    "step1": {
      "title": "Capacités de base",
      "pool_base": "Pool de base : {{count}} points",
      "points_from_pc": "Points via PC : +{{count}}",
      "pool_total": "Pool total : {{count}} points",
      "points_remaining": "Points restants : {{count}}",
      "bonus_feminin_remaining": "Bonus féminin : {{count}}/2",
      "gender_masculin": "Masculin",
      "gender_feminin": "Féminin",
      "attr_label": "{{attr}}",
      "chance": "Chance : {{value}}"
    },
    "step2": {
      "title": "Type génétique",
      "subtitle": "Choisissez la nature génétique de votre personnage",
      "pc_cost": "{{cost}} PC",
      "pc_cost_deserter": "{{cost}} PC (déserteur)",
      "deserter_option": "Déserteur (recherché par l'Hégémonie)",
      "attr_modifiers": "Modificateurs d'Attributs",
      "attr_after_selection": "Vos attributs après sélection",
      "prerequisites": "Prérequis : {{text}}",
      "advantages": "Avantages",
      "disadvantages": "Désavantages",
      "select": "Sélectionner",
      "selected": "Sélectionné",
      "none_selected": "Veuillez sélectionner un type génétique",
      "insufficient_pc": "PC insuffisants pour ce type génétique"
    }
  }
}

7. SCÉNARIO DE TEST UNIFIÉ
Phase 0 — Init

POST /creation/init avec sheetId
→ pc_total = 20, ambiance = 'INTERMEDIAIRE', chc = 13, poolBase = 38
→ rules.optionFemininBonus = true (si activé par le MJ)
Phase 1 — Étape 1

    Joueur alloue 5 PC → pool total = 38 + 10 = 48 points
    Sexe Féminin → FOR démarre à 5
    FOR 5→7 (0 pt), CON 7→16 (10 pts), bonus COO +1, PRE +1, 38 pts restants répartis
    Clic "Suivant" → validation
    creation_state = 'draft_step1', pc_spent_step1 = 5, availablePC = 15
    char_sheet.chc = 13, char_archetype.sex = 'FEMININ'
    char_attributes : 8 lignes avec base_level final, pc_modifier = 0

Phase 2 — Étape 2

    GET /creation/:sheetId/step2 → availablePC = 15, 4 génotypes avec aperçu calculé
    Joueur navigue dans le diaporama, l'aperçu "Vos attributs après sélection" se met à jour
    Sélectionne "Techno-hybride", coche "Déserteur" (coût = 4 PC)
    Clic "Suivant" → validation
    creation_state = 'draft_step2', pc_spent_step2 = 4, availablePC = 11
    char_archetype.genotype_id = 'TEC_HYB'
    char_attributes non modifiée — pas de colonne genotype_modifier
    Attributs effectifs recalculés (lecture ref_genotypes.mod_*) et broadcastés au GM

Phase 3 — Retour arrière

    Clic "Précédent" → POST /creation/:sheetId/rollback-to-step1
    creation_state = 'draft_step1', genotype_id = NULL
    pc_spent_step2 = 0, availablePC = 15
    char_attributes non modifiée — pas de rollback nécessaire
    Attributs étape 1 restaurés

