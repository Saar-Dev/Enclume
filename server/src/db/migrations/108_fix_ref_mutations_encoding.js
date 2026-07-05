// 108_fix_ref_mutations_encoding.js
// Corrige la corruption d'encodage (mojibake) sur ref_mutations / ref_mutation_subtypes /
// ref_mutation_skills : le seed (95_seed_ref_mutations.js) a inséré des octets UTF-8 valides
// mais mal ré-interprétés en Windows-1252 puis ré-encodés en UTF-8 (ex. "Résistance" -> "RÃ©sistance").
//
// Transformation déterministe et réversible, vérifiée en base réelle avant écriture de cette
// migration : 45/45 lignes ref_mutations, 4/4 ref_mutation_subtypes, 10/10 ref_mutation_skills
// décodées sans caractère de remplacement, round-trip decode->encode byte-identique sur 201
// colonnes texte testées.
//
// down() restaure exactement le texte corrompu d'origine (round-trip up/down/up testable).

// Octets 0x80-0x9F : seule plage où Windows-1252 diverge d'ISO-8859-1/Latin-1.
const CP1252_MAP = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D,
  0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
}
const CP1252_REVERSE = Object.fromEntries(Object.entries(CP1252_MAP).map(([b, u]) => [u, Number(b)]))

// Texte corrompu (tel que stocké en base) -> texte correct.
function decodeMojibake(str) {
  const bytes = []
  for (const ch of str) {
    const cp = ch.codePointAt(0)
    if (cp < 0x80) { bytes.push(cp); continue }
    if (CP1252_REVERSE[cp] !== undefined) { bytes.push(CP1252_REVERSE[cp]); continue }
    if (cp <= 0xFF) { bytes.push(cp); continue }
    throw new Error(`decodeMojibake : caractère non mappable U+${cp.toString(16)} dans "${str}"`)
  }
  return Buffer.from(bytes).toString('utf8')
}

// Texte correct -> texte corrompu (pour down()).
function encodeMojibake(str) {
  const bytes = Buffer.from(str, 'utf8')
  let out = ''
  for (const byte of bytes) out += String.fromCodePoint(CP1252_MAP[byte] ?? byte)
  return out
}

const MUTATION_COLS = ['name', 'description', 'special_effect', 'stack_effect']
const SUBTYPE_COLS = ['name', 'skill_bonus', 'immunity', 'special_trait']

export const up = async (knex) => {
  const mutations = await knex('ref_mutations').select('mutation_id', ...MUTATION_COLS)
  for (const row of mutations) {
    const patch = {}
    for (const col of MUTATION_COLS) {
      if (row[col] != null) patch[col] = decodeMojibake(row[col])
    }
    await knex('ref_mutations').where({ mutation_id: row.mutation_id }).update(patch)
  }

  const subtypes = await knex('ref_mutation_subtypes').select('subtype_id', ...SUBTYPE_COLS)
  for (const row of subtypes) {
    const patch = {}
    for (const col of SUBTYPE_COLS) {
      if (row[col] != null) patch[col] = decodeMojibake(row[col])
    }
    await knex('ref_mutation_subtypes').where({ subtype_id: row.subtype_id }).update(patch)
  }

  const skills = await knex('ref_mutation_skills').select('mutation_id', 'skill_name')
  for (const row of skills) {
    const fixed = decodeMojibake(row.skill_name)
    await knex('ref_mutation_skills')
      .where({ mutation_id: row.mutation_id, skill_name: row.skill_name })
      .update({ skill_name: fixed })
  }
}

export const down = async (knex) => {
  const mutations = await knex('ref_mutations').select('mutation_id', ...MUTATION_COLS)
  for (const row of mutations) {
    const patch = {}
    for (const col of MUTATION_COLS) {
      if (row[col] != null) patch[col] = encodeMojibake(row[col])
    }
    await knex('ref_mutations').where({ mutation_id: row.mutation_id }).update(patch)
  }

  const subtypes = await knex('ref_mutation_subtypes').select('subtype_id', ...SUBTYPE_COLS)
  for (const row of subtypes) {
    const patch = {}
    for (const col of SUBTYPE_COLS) {
      if (row[col] != null) patch[col] = encodeMojibake(row[col])
    }
    await knex('ref_mutation_subtypes').where({ subtype_id: row.subtype_id }).update(patch)
  }

  const skills = await knex('ref_mutation_skills').select('mutation_id', 'skill_name')
  for (const row of skills) {
    const corrupted = encodeMojibake(row.skill_name)
    await knex('ref_mutation_skills')
      .where({ mutation_id: row.mutation_id, skill_name: row.skill_name })
      .update({ skill_name: corrupted })
  }
}
