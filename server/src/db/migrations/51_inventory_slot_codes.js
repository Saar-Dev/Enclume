export const up = async (knex) => {
  // Nullifier les slots char_inventory utilisant les anciens codes B/J (stales après le passage BG/BD/JG/JD).
  // Regex : (^|/) suivi de B ou J suivi de (/|$) — exclut BG, BD, JG, JD.
  await knex.raw(`
    UPDATE char_inventory
    SET slot = NULL
    WHERE slot ~ '(^|/)(B|J)(/|$)'
  `)
}

export const down = async (knex) => {
  // Les slots nullifiés ne peuvent pas être restaurés sans ambiguïté (BG vs BD).
  // Aucune action nécessaire.
}
