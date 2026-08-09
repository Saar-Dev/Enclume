// 160_fix_ref_equipment_choc_assommante.js
// Corrige le DSL Choc (ammo_effects) et la description des munitions "Assommante"/"assommant" —
// docs/PLAN_ARMES_DSL.md, correctif Lot B (Chantier 11 Étape 2).
//
// Bug trouvé en confrontant la donnée catalogue à docs/REGLES/REGLESMUNITIONS.md (source de vérité
// LdB confirmée par Saar) : `CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10)` (table par bande de
// portée) n'existe dans aucune règle du Livre de Base. REGLESMUNITIONS.md ("Balles assommantes") ne
// donne qu'un bonus de Choc fixe : "+1D10+2", sans restriction de portée ni de localisation. La table
// par bande de portée était une invention introduite lors du peuplement du catalogue (5ᵉ cas confirmé
// du même type que Shrapnel/HP/Explosive/IEM cette session).
//
// 12 items concernés (family='Munitions', vérifiés un par un contre leur propre description avant
// cette migration — 2 items portant le même DSL par erreur mais une description totalement différente
// ("Darts 7.62 mm ST - Projectile SAP", "Flèche - Projectile IEM") sont explicitement EXCLUS, bug de
// données séparé documenté dans docs/BUGIDENTIFIE.md, pas corrigé ici).

const ITEM_IDS = [
  'ccc75daf-85eb-4595-a291-6cd3c60a6507', // 10.92 mm
  '92f6ab34-6423-4ec5-bd23-b05000802aee', // 11.43 mm
  '5d9071b6-2cd1-44be-804f-b73684a9d52d', // 2.7 mm
  'f7f50b1d-93a0-434f-be9e-3a7e1054e728', // 3 mm
  '45bd55e1-5f6b-438b-b5b9-30d7bd5d221d', // 5.45 mm
  '16312a4a-717e-4017-abb2-aabd31381416', // 5.56 mm
  '6c69277d-ffda-49b9-8373-9c8add07cc7a', // 7.62 mm
  '73ee0368-39a9-41b2-9cf5-ad6681e9b207', // 7.65 mm
  'aefc9373-da62-4f30-815e-c8ac48c66d41', // 9 mm
  '46205a0c-b06d-4762-8db0-763735ff99aa', // Calibre 12
  'd9f7b038-3f59-4f1b-9700-c0ea9f4d111b', // Darts 4.5 mm ST
  '54a99f69-d52f-40c9-826b-c29c8e9af634', // Darts 5.56 mm ST
]

const OLD_CHOC = 'CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10)'
const NEW_CHOC = 'CHOC=SET(1D10+2)'

const OLD_DESC_FRAGMENT = 'En revanche, elles infligent des Dommages de Choc de 5D10 à bout portant, puis de 4D10 à courte portée, de 3D10 à moyenne portée, de 2D10 à longue portée et enfin d’1D10 à portée extrême.'
const NEW_DESC_FRAGMENT = 'En revanche, elles infligent des Dommages additionnels de Choc de +1D10+2.'

export const up = async (knex) => {
  const rows = await knex('ref_equipment').whereIn('id', ITEM_IDS).select('id', 'ammo_effects', 'description')
  for (const row of rows) {
    if (!row.ammo_effects?.includes(OLD_CHOC)) continue
    await knex('ref_equipment').where({ id: row.id }).update({
      ammo_effects: row.ammo_effects.replace(OLD_CHOC, NEW_CHOC),
      description:  row.description?.includes(OLD_DESC_FRAGMENT)
        ? row.description.replace(OLD_DESC_FRAGMENT, NEW_DESC_FRAGMENT)
        : row.description,
    })
  }
}

export const down = async (knex) => {
  const rows = await knex('ref_equipment').whereIn('id', ITEM_IDS).select('id', 'ammo_effects', 'description')
  for (const row of rows) {
    if (!row.ammo_effects?.includes(NEW_CHOC)) continue
    await knex('ref_equipment').where({ id: row.id }).update({
      ammo_effects: row.ammo_effects.replace(NEW_CHOC, OLD_CHOC),
      description:  row.description?.includes(NEW_DESC_FRAGMENT)
        ? row.description.replace(NEW_DESC_FRAGMENT, OLD_DESC_FRAGMENT)
        : row.description,
    })
  }
}
