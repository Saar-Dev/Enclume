/**
 * Migration 53 — Refactoring nomenclature munitions
 *
 * Problème : les noms de munitions contenaient un qualificatif d'arme redondant
 * (ex : "9 mm - Balle HP - Arme de poing" / "9 mm - Balle HP - Pistolet-mitrailleur léger")
 * alors que le calibre suffit à définir la compatibilité.
 *
 * Phase 1 : fusion des doublons — met à jour char_inventory.current_ammo vers l'entrée gardée,
 *           puis supprime l'entrée redondante.
 * Phase 2 : renommage — supprime le qualificatif d'arme, remplace "Balle" par "Munition"
 *           pour tous les calibres balistiques. Carreaux/Flèches/Darts gardent "Projectile".
 *           Capsules et GPs : inchangés.
 *
 * Note : down() inverse les renommages seulement. Les entrées fusionnées (supprimées en up)
 *        ne peuvent pas être recréées sans leurs IDs d'origine.
 *
 * Note seed : si 2_seed_equipment.js est rejoué après cette migration, les anciens noms
 *             seront réinsérés en doublon (pas de contrainte UNIQUE sur name).
 *             Ne pas rejouer les seeds en production après cette migration.
 */

export const up = async (knex) => {

  // ── Phase 1 : Fusions ────────────────────────────────────────────────────────
  // Pour chaque doublon : redirige les FK char_inventory.current_ammo, puis supprime.

  const mergeAmmo = async (keepName, dropName) => {
    const keepRow = await knex('ref_equipment').where({ name: keepName }).first()
    const dropRow = await knex('ref_equipment').where({ name: dropName }).first()
    if (!keepRow || !dropRow) return
    await knex('char_inventory').where({ current_ammo: dropRow.id }).update({ current_ammo: keepRow.id })
    await knex('ref_equipment').where({ id: dropRow.id }).delete()
  }

  // 9 mm (4 doublons arme de poing / pistolet-mitrailleur)
  await mergeAmmo('9 mm - Balle HP - Arme de poing',         '9 mm - Balle HP - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle IEM - Arme de poing',        '9 mm - Balle IEM - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle assommante - Arme de poing', '9 mm - Balle assommante - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle standard - Arme de poing',   '9 mm - Balle standard - Pistolet-mitrailleur léger')

  // 5.45 mm (standard FA vs pistolet léger)
  await mergeAmmo("5.45 mm - Balle standard - Fusil d'assaut léger", '5.45 mm - Balle standard - Pistolet léger')

  // 7.62 mm standard (5 versions weapon-specific → 1)
  await mergeAmmo("7.62 mm - Balle standard - Fusil de précision", "7.62 mm - Balle standard - Fusil d'assaut lourd")
  await mergeAmmo("7.62 mm - Balle standard - Fusil de précision", '7.62 mm - Balle standard - Fusil standard')
  await mergeAmmo("7.62 mm - Balle standard - Fusil de précision", "7.62 mm - Balle standard - Fusil électromagnétique")
  await mergeAmmo("7.62 mm - Balle standard - Fusil de précision", "7.62 mm - Balle standard - Mitrailleuse légère")

  // 7.62 mm SAP (arme d'épaule vs fusil de précision)
  await mergeAmmo("7.62 mm - Balle SAP - Arme d'épaule", "7.62 mm - Balle SAP - Fusil de précision")

  // 12.7 mm standard (mitrailleuse lourde vs pistolet lourd)
  await mergeAmmo('12.7 mm - Balle standard - Mitrailleuse lourde', '12.7 mm - Balle standard - Pistolet lourd')


  // ── Phase 2 : Renommages ─────────────────────────────────────────────────────
  // Supprime le qualificatif d'arme, "Balle" → "Munition".

  const rename = async (from, to) => {
    await knex('ref_equipment').where({ name: from }).update({ name: to })
  }

  // 2.7 mm
  await rename('2.7 mm - Balle assommante - Mini-pistolet', '2.7 mm - Munition assommante')
  await rename('2.7 mm - Balle standard - Mini-pistolet',   '2.7 mm - Munition standard')

  // 3 mm
  await rename('3 mm - Balle assommante - Mini-pistolet', '3 mm - Munition assommante')
  await rename('3 mm - Balle standard - Mini-pistolet',   '3 mm - Munition standard')

  // 4 mmS
  await rename('4 mmS - Balle standard - Arme de poing à supercavitation', '4 mmS - Munition standard')

  // 4.5 mmS
  await rename('4.5 mmS - Balle standard - Arme de poing à supercavitation', '4.5 mmS - Munition standard')

  // 5.45 mm (gardée de la fusion + 4 singles)
  await rename("5.45 mm - Balle APHC - Fusil d'assaut léger",       '5.45 mm - Munition APHC')
  await rename("5.45 mm - Balle IEM - Fusil d'assaut léger",        '5.45 mm - Munition IEM')
  await rename("5.45 mm - Balle SAP - Fusil d'assaut léger",        '5.45 mm - Munition SAP')
  await rename("5.45 mm - Balle assommante - Fusil d'assaut léger", '5.45 mm - Munition assommante')
  await rename("5.45 mm - Balle standard - Fusil d'assaut léger",   '5.45 mm - Munition standard')

  // 5.56 mm
  await rename("5.56 mm - Balle APHC - Arme d'épaule",       '5.56 mm - Munition APHC')
  await rename("5.56 mm - Balle IEM - Arme d'épaule",        '5.56 mm - Munition IEM')
  await rename("5.56 mm - Balle SAP - Arme d'épaule",        '5.56 mm - Munition SAP')
  await rename("5.56 mm - Balle assommante - Arme d'épaule", '5.56 mm - Munition assommante')
  await rename("5.56 mm - Balle standard - Arme d'épaule",   '5.56 mm - Munition standard')

  // 5.56 mmS
  await rename('5.56 mmS - Balle standard - Arme de poing à supercavitation', '5.56 mmS - Munition standard')

  // 7 mm
  await rename('7 mm - Balle standard - Pistolet moyen', '7 mm - Munition standard')

  // 7.62 mm (gardées des fusions + 5 singles)
  await rename("7.62 mm - Balle APHC - Arme d'épaule",        '7.62 mm - Munition APHC')
  await rename("7.62 mm - Balle IEM - Arme d'épaule",         '7.62 mm - Munition IEM')
  await rename("7.62 mm - Balle SAP - Arme d'épaule",         '7.62 mm - Munition SAP')
  await rename("7.62 mm - Balle SLAP - Fusil de précision",   '7.62 mm - Munition SLAP')
  await rename("7.62 mm - Balle assommante - Arme d'épaule",  '7.62 mm - Munition assommante')
  await rename("7.62 mm - Balle explosive - Arme d'épaule",   '7.62 mm - Munition explosive')
  await rename("7.62 mm - Balle standard - Fusil de précision",'7.62 mm - Munition standard')

  // 7.62 mmS
  await rename("7.62 mmS - Balle standard - Fusil d'assaut à supercavitation", '7.62 mmS - Munition standard')

  // 7.65 mm
  await rename('7.65 mm - Balle HP - Pistolet moyen',         '7.65 mm - Munition HP')
  await rename('7.65 mm - Balle SAP - Pistolet moyen',        '7.65 mm - Munition SAP')
  await rename('7.65 mm - Balle assommante - Pistolet moyen', '7.65 mm - Munition assommante')
  await rename('7.65 mm - Balle standard - Pistolet moyen',   '7.65 mm - Munition standard')

  // 9 mm (gardées des 4 fusions + 1 SAP single)
  await rename('9 mm - Balle HP - Arme de poing',                         '9 mm - Munition HP')
  await rename('9 mm - Balle IEM - Arme de poing',                        '9 mm - Munition IEM')
  await rename('9 mm - Balle SAP - Arme de poing / pistolet-mitrailleur', '9 mm - Munition SAP')
  await rename('9 mm - Balle assommante - Arme de poing',                 '9 mm - Munition assommante')
  await rename('9 mm - Balle standard - Arme de poing',                   '9 mm - Munition standard')

  // 10.92 mm
  await rename('10.92 mm - Balle HP - Pistolet lourd',         '10.92 mm - Munition HP')
  await rename('10.92 mm - Balle IEM - Pistolet lourd',        '10.92 mm - Munition IEM')
  await rename('10.92 mm - Balle SAP - Pistolet lourd',        '10.92 mm - Munition SAP')
  await rename('10.92 mm - Balle assommante - Pistolet lourd', '10.92 mm - Munition assommante')
  await rename('10.92 mm - Balle standard - Pistolet lourd',   '10.92 mm - Munition standard')

  // 11.43 mm
  await rename('11.43 mm - Balle HP - Pistolet lourd',         '11.43 mm - Munition HP')
  await rename('11.43 mm - Balle IEM - Pistolet lourd',        '11.43 mm - Munition IEM')
  await rename('11.43 mm - Balle SAP - Pistolet lourd',        '11.43 mm - Munition SAP')
  await rename('11.43 mm - Balle assommante - Pistolet lourd', '11.43 mm - Munition assommante')
  await rename('11.43 mm - Balle standard - Pistolet lourd',   '11.43 mm - Munition standard')

  // Calibre 12 — caliber='12' (IEM / assommante / explosive)
  await rename('Calibre 12 - Balle IEM - Fusil à pompe',        'Calibre 12 - Munition IEM')
  await rename('Calibre 12 - Balle assommante - Fusil à pompe', 'Calibre 12 - Munition assommante')
  await rename('Calibre 12 - Balle explosive - Fusil à pompe',  'Calibre 12 - Munition explosive')

  // Calibre 12 — caliber='Calibre 12' (HP / standard)
  await rename('Calibre 12 - Balle HP - Fusil à pompe',       'Calibre 12 - Munition HP')
  await rename('Calibre 12 - Balle standard - Fusil à pompe', 'Calibre 12 - Munition standard')

  // 12.7 mm (gardée de la fusion + 4 singles)
  await rename('12.7 mm - Balle APHC - Mitrailleuse lourde',     '12.7 mm - Munition APHC')
  await rename('12.7 mm - Balle IEM - Mitrailleuse lourde',      '12.7 mm - Munition IEM')
  await rename('12.7 mm - Balle explosive - Mitrailleuse lourde','12.7 mm - Munition explosive')
  await rename('12.7 mm - Balle shrapnel - Mitrailleuse lourde', '12.7 mm - Munition shrapnel')
  await rename('12.7 mm - Balle standard - Mitrailleuse lourde', '12.7 mm - Munition standard')

  // 12.7 mmS
  await rename('12.7 mmS - Balle standard - Gatling à supercavitation', '12.7 mmS - Munition standard')

  // 15.2 mm
  await rename("15.2 mm - Balle APHC - Fusil anti-matériel",      '15.2 mm - Munition APHC')
  await rename("15.2 mm - Balle IEM - Fusil anti-matériel",       '15.2 mm - Munition IEM')
  await rename("15.2 mm - Balle explosive - Fusil anti-matériel", '15.2 mm - Munition explosive')
  await rename("15.2 mm - Balle standard - Fusil anti-matériel",  '15.2 mm - Munition standard')

  // 15.3 mm
  await rename('15.3 mm - Balle APHC - Canon à tir rapide',      '15.3 mm - Munition APHC')
  await rename('15.3 mm - Balle IEM - Canon à tir rapide',       '15.3 mm - Munition IEM')
  await rename('15.3 mm - Balle explosive - Canon à tir rapide', '15.3 mm - Munition explosive')
  await rename('15.3 mm - Balle shrapnel - Canon à tir rapide',  '15.3 mm - Munition shrapnel')
  await rename('15.3 mm - Balle standard - Canon à tir rapide',  '15.3 mm - Munition standard')

  // 17 mm
  await rename('17 mm - Balle APHC - Canon à tir rapide',      '17 mm - Munition APHC')
  await rename('17 mm - Balle IEM - Canon à tir rapide',       '17 mm - Munition IEM')
  await rename('17 mm - Balle explosive - Canon à tir rapide', '17 mm - Munition explosive')
  await rename('17 mm - Balle shrapnel - Canon à tir rapide',  '17 mm - Munition shrapnel')
  await rename('17 mm - Balle standard - Canon à tir rapide',  '17 mm - Munition standard')

  // 20 mm
  await rename('20 mm - Balle APHC - Canon à tir rapide',      '20 mm - Munition APHC')
  await rename('20 mm - Balle IEM - Canon à tir rapide',       '20 mm - Munition IEM')
  await rename('20 mm - Balle explosive - Canon à tir rapide', '20 mm - Munition explosive')
  await rename('20 mm - Balle shrapnel - Canon à tir rapide',  '20 mm - Munition shrapnel')
  await rename('20 mm - Balle standard - Canon à tir rapide',  '20 mm - Munition standard')

  // 20 mmS
  await rename('20 mmS - Balle standard - Canon à supercavitation', '20 mmS - Munition standard')

  // Carreaux
  await rename('Carreau - Projectile IEM - Arbalète',       'Carreau - Projectile IEM')
  await rename('Carreau - Projectile assommant - Arbalète', 'Carreau - Projectile assommant')
  await rename('Carreau - Projectile explosif - Arbalète',  'Carreau - Projectile explosif')
  await rename('Carreau - Projectile standard - Arbalète',  'Carreau - Projectile standard')

  // Flèches
  await rename('Flèche - Projectile IEM - Arc',       'Flèche - Projectile IEM')
  await rename('Flèche - Projectile assommant - Arc', 'Flèche - Projectile assommant')
  await rename('Flèche - Projectile explosif - Arc',  'Flèche - Projectile explosif')
  await rename('Flèche - Projectile standard - Arc',  'Flèche - Projectile standard')

  // Darts 4.5 mm
  await rename('Darts 4.5 mm ST - Projectile IEM - Pistolet léger à dards',       'Darts 4.5 mm ST - Projectile IEM')
  await rename('Darts 4.5 mm ST - Projectile assommant - Pistolet léger à dards', 'Darts 4.5 mm ST - Projectile assommant')
  await rename('Darts 4.5 mm ST - Projectile standard - Pistolet léger à dards',  'Darts 4.5 mm ST - Projectile standard')

  // Darts 5.56 mm
  await rename('Darts 5.56 mm ST - Projectile APHC - Pistolet lourd à dards',      'Darts 5.56 mm ST - Projectile APHC')
  await rename('Darts 5.56 mm ST - Projectile IEM - Pistolet lourd à dards',       'Darts 5.56 mm ST - Projectile IEM')
  await rename('Darts 5.56 mm ST - Projectile SAP - Pistolet lourd à dards',       'Darts 5.56 mm ST - Projectile SAP')
  await rename('Darts 5.56 mm ST - Projectile assommant - Pistolet lourd à dards', 'Darts 5.56 mm ST - Projectile assommant')
  await rename('Darts 5.56 mm ST - Projectile standard - Pistolet lourd à dards',  'Darts 5.56 mm ST - Projectile standard')

  // Darts 7.62 mm
  await rename("Darts 7.62 mm ST - Projectile APHC - Fusil d'assaut à dards",      'Darts 7.62 mm ST - Projectile APHC')
  await rename("Darts 7.62 mm ST - Projectile IEM - Fusil d'assaut à dards",       'Darts 7.62 mm ST - Projectile IEM')
  await rename("Darts 7.62 mm ST - Projectile SAP - Fusil d'assaut à dards",       'Darts 7.62 mm ST - Projectile SAP')
  await rename("Darts 7.62 mm ST - Projectile assommant - Fusil d'assaut à dards", 'Darts 7.62 mm ST - Projectile assommant')
  await rename("Darts 7.62 mm ST - Projectile explosif - Fusil d'assaut à dards",  'Darts 7.62 mm ST - Projectile explosif')
  await rename("Darts 7.62 mm ST - Projectile standard - Fusil d'assaut à dards",  'Darts 7.62 mm ST - Projectile standard')
}


export const down = async (knex) => {
  // Inverse les renommages uniquement.
  // Les entrées supprimées en Phase 1 (doublons fusionnés) ne peuvent pas être restaurées.

  const rename = async (from, to) => {
    await knex('ref_equipment').where({ name: from }).update({ name: to })
  }

  // 2.7 mm
  await rename('2.7 mm - Munition assommante', '2.7 mm - Balle assommante - Mini-pistolet')
  await rename('2.7 mm - Munition standard',   '2.7 mm - Balle standard - Mini-pistolet')

  // 3 mm
  await rename('3 mm - Munition assommante', '3 mm - Balle assommante - Mini-pistolet')
  await rename('3 mm - Munition standard',   '3 mm - Balle standard - Mini-pistolet')

  // 4 mmS
  await rename('4 mmS - Munition standard', '4 mmS - Balle standard - Arme de poing à supercavitation')

  // 4.5 mmS
  await rename('4.5 mmS - Munition standard', '4.5 mmS - Balle standard - Arme de poing à supercavitation')

  // 5.45 mm
  await rename('5.45 mm - Munition APHC',        "5.45 mm - Balle APHC - Fusil d'assaut léger")
  await rename('5.45 mm - Munition IEM',         "5.45 mm - Balle IEM - Fusil d'assaut léger")
  await rename('5.45 mm - Munition SAP',         "5.45 mm - Balle SAP - Fusil d'assaut léger")
  await rename('5.45 mm - Munition assommante',  "5.45 mm - Balle assommante - Fusil d'assaut léger")
  await rename('5.45 mm - Munition standard',    "5.45 mm - Balle standard - Fusil d'assaut léger")

  // 5.56 mm
  await rename('5.56 mm - Munition APHC',       "5.56 mm - Balle APHC - Arme d'épaule")
  await rename('5.56 mm - Munition IEM',        "5.56 mm - Balle IEM - Arme d'épaule")
  await rename('5.56 mm - Munition SAP',        "5.56 mm - Balle SAP - Arme d'épaule")
  await rename('5.56 mm - Munition assommante', "5.56 mm - Balle assommante - Arme d'épaule")
  await rename('5.56 mm - Munition standard',   "5.56 mm - Balle standard - Arme d'épaule")

  // 5.56 mmS
  await rename('5.56 mmS - Munition standard', '5.56 mmS - Balle standard - Arme de poing à supercavitation')

  // 7 mm
  await rename('7 mm - Munition standard', '7 mm - Balle standard - Pistolet moyen')

  // 7.62 mm
  await rename('7.62 mm - Munition APHC',        "7.62 mm - Balle APHC - Arme d'épaule")
  await rename('7.62 mm - Munition IEM',         "7.62 mm - Balle IEM - Arme d'épaule")
  await rename('7.62 mm - Munition SAP',         "7.62 mm - Balle SAP - Arme d'épaule")
  await rename('7.62 mm - Munition SLAP',        "7.62 mm - Balle SLAP - Fusil de précision")
  await rename('7.62 mm - Munition assommante',  "7.62 mm - Balle assommante - Arme d'épaule")
  await rename('7.62 mm - Munition explosive',   "7.62 mm - Balle explosive - Arme d'épaule")
  await rename('7.62 mm - Munition standard',    "7.62 mm - Balle standard - Fusil de précision")

  // 7.62 mmS
  await rename('7.62 mmS - Munition standard', "7.62 mmS - Balle standard - Fusil d'assaut à supercavitation")

  // 7.65 mm
  await rename('7.65 mm - Munition HP',         '7.65 mm - Balle HP - Pistolet moyen')
  await rename('7.65 mm - Munition SAP',        '7.65 mm - Balle SAP - Pistolet moyen')
  await rename('7.65 mm - Munition assommante', '7.65 mm - Balle assommante - Pistolet moyen')
  await rename('7.65 mm - Munition standard',   '7.65 mm - Balle standard - Pistolet moyen')

  // 9 mm
  await rename('9 mm - Munition HP',         '9 mm - Balle HP - Arme de poing')
  await rename('9 mm - Munition IEM',        '9 mm - Balle IEM - Arme de poing')
  await rename('9 mm - Munition SAP',        '9 mm - Balle SAP - Arme de poing / pistolet-mitrailleur')
  await rename('9 mm - Munition assommante', '9 mm - Balle assommante - Arme de poing')
  await rename('9 mm - Munition standard',   '9 mm - Balle standard - Arme de poing')

  // 10.92 mm
  await rename('10.92 mm - Munition HP',         '10.92 mm - Balle HP - Pistolet lourd')
  await rename('10.92 mm - Munition IEM',        '10.92 mm - Balle IEM - Pistolet lourd')
  await rename('10.92 mm - Munition SAP',        '10.92 mm - Balle SAP - Pistolet lourd')
  await rename('10.92 mm - Munition assommante', '10.92 mm - Balle assommante - Pistolet lourd')
  await rename('10.92 mm - Munition standard',   '10.92 mm - Balle standard - Pistolet lourd')

  // 11.43 mm
  await rename('11.43 mm - Munition HP',         '11.43 mm - Balle HP - Pistolet lourd')
  await rename('11.43 mm - Munition IEM',        '11.43 mm - Balle IEM - Pistolet lourd')
  await rename('11.43 mm - Munition SAP',        '11.43 mm - Balle SAP - Pistolet lourd')
  await rename('11.43 mm - Munition assommante', '11.43 mm - Balle assommante - Pistolet lourd')
  await rename('11.43 mm - Munition standard',   '11.43 mm - Balle standard - Pistolet lourd')

  // Calibre 12 (caliber='12')
  await rename('Calibre 12 - Munition IEM',        'Calibre 12 - Balle IEM - Fusil à pompe')
  await rename('Calibre 12 - Munition assommante', 'Calibre 12 - Balle assommante - Fusil à pompe')
  await rename('Calibre 12 - Munition explosive',  'Calibre 12 - Balle explosive - Fusil à pompe')

  // Calibre 12 (caliber='Calibre 12') — même nom affiché, caliber différent, pas de conflit DB
  await rename('Calibre 12 - Munition HP',       'Calibre 12 - Balle HP - Fusil à pompe')
  await rename('Calibre 12 - Munition standard', 'Calibre 12 - Balle standard - Fusil à pompe')

  // 12.7 mm
  await rename('12.7 mm - Munition APHC',      '12.7 mm - Balle APHC - Mitrailleuse lourde')
  await rename('12.7 mm - Munition IEM',       '12.7 mm - Balle IEM - Mitrailleuse lourde')
  await rename('12.7 mm - Munition explosive', '12.7 mm - Balle explosive - Mitrailleuse lourde')
  await rename('12.7 mm - Munition shrapnel',  '12.7 mm - Balle shrapnel - Mitrailleuse lourde')
  await rename('12.7 mm - Munition standard',  '12.7 mm - Balle standard - Mitrailleuse lourde')

  // 12.7 mmS
  await rename('12.7 mmS - Munition standard', '12.7 mmS - Balle standard - Gatling à supercavitation')

  // 15.2 mm
  await rename('15.2 mm - Munition APHC',      "15.2 mm - Balle APHC - Fusil anti-matériel")
  await rename('15.2 mm - Munition IEM',       "15.2 mm - Balle IEM - Fusil anti-matériel")
  await rename('15.2 mm - Munition explosive', "15.2 mm - Balle explosive - Fusil anti-matériel")
  await rename('15.2 mm - Munition standard',  "15.2 mm - Balle standard - Fusil anti-matériel")

  // 15.3 mm
  await rename('15.3 mm - Munition APHC',      '15.3 mm - Balle APHC - Canon à tir rapide')
  await rename('15.3 mm - Munition IEM',       '15.3 mm - Balle IEM - Canon à tir rapide')
  await rename('15.3 mm - Munition explosive', '15.3 mm - Balle explosive - Canon à tir rapide')
  await rename('15.3 mm - Munition shrapnel',  '15.3 mm - Balle shrapnel - Canon à tir rapide')
  await rename('15.3 mm - Munition standard',  '15.3 mm - Balle standard - Canon à tir rapide')

  // 17 mm
  await rename('17 mm - Munition APHC',      '17 mm - Balle APHC - Canon à tir rapide')
  await rename('17 mm - Munition IEM',       '17 mm - Balle IEM - Canon à tir rapide')
  await rename('17 mm - Munition explosive', '17 mm - Balle explosive - Canon à tir rapide')
  await rename('17 mm - Munition shrapnel',  '17 mm - Balle shrapnel - Canon à tir rapide')
  await rename('17 mm - Munition standard',  '17 mm - Balle standard - Canon à tir rapide')

  // 20 mm
  await rename('20 mm - Munition APHC',      '20 mm - Balle APHC - Canon à tir rapide')
  await rename('20 mm - Munition IEM',       '20 mm - Balle IEM - Canon à tir rapide')
  await rename('20 mm - Munition explosive', '20 mm - Balle explosive - Canon à tir rapide')
  await rename('20 mm - Munition shrapnel',  '20 mm - Balle shrapnel - Canon à tir rapide')
  await rename('20 mm - Munition standard',  '20 mm - Balle standard - Canon à tir rapide')

  // 20 mmS
  await rename('20 mmS - Munition standard', '20 mmS - Balle standard - Canon à supercavitation')

  // Carreaux
  await rename('Carreau - Projectile IEM',       'Carreau - Projectile IEM - Arbalète')
  await rename('Carreau - Projectile assommant', 'Carreau - Projectile assommant - Arbalète')
  await rename('Carreau - Projectile explosif',  'Carreau - Projectile explosif - Arbalète')
  await rename('Carreau - Projectile standard',  'Carreau - Projectile standard - Arbalète')

  // Flèches
  await rename('Flèche - Projectile IEM',       'Flèche - Projectile IEM - Arc')
  await rename('Flèche - Projectile assommant', 'Flèche - Projectile assommant - Arc')
  await rename('Flèche - Projectile explosif',  'Flèche - Projectile explosif - Arc')
  await rename('Flèche - Projectile standard',  'Flèche - Projectile standard - Arc')

  // Darts 4.5 mm
  await rename('Darts 4.5 mm ST - Projectile IEM',       'Darts 4.5 mm ST - Projectile IEM - Pistolet léger à dards')
  await rename('Darts 4.5 mm ST - Projectile assommant', 'Darts 4.5 mm ST - Projectile assommant - Pistolet léger à dards')
  await rename('Darts 4.5 mm ST - Projectile standard',  'Darts 4.5 mm ST - Projectile standard - Pistolet léger à dards')

  // Darts 5.56 mm
  await rename('Darts 5.56 mm ST - Projectile APHC',      'Darts 5.56 mm ST - Projectile APHC - Pistolet lourd à dards')
  await rename('Darts 5.56 mm ST - Projectile IEM',       'Darts 5.56 mm ST - Projectile IEM - Pistolet lourd à dards')
  await rename('Darts 5.56 mm ST - Projectile SAP',       'Darts 5.56 mm ST - Projectile SAP - Pistolet lourd à dards')
  await rename('Darts 5.56 mm ST - Projectile assommant', 'Darts 5.56 mm ST - Projectile assommant - Pistolet lourd à dards')
  await rename('Darts 5.56 mm ST - Projectile standard',  'Darts 5.56 mm ST - Projectile standard - Pistolet lourd à dards')

  // Darts 7.62 mm
  await rename('Darts 7.62 mm ST - Projectile APHC',      "Darts 7.62 mm ST - Projectile APHC - Fusil d'assaut à dards")
  await rename('Darts 7.62 mm ST - Projectile IEM',       "Darts 7.62 mm ST - Projectile IEM - Fusil d'assaut à dards")
  await rename('Darts 7.62 mm ST - Projectile SAP',       "Darts 7.62 mm ST - Projectile SAP - Fusil d'assaut à dards")
  await rename('Darts 7.62 mm ST - Projectile assommant', "Darts 7.62 mm ST - Projectile assommant - Fusil d'assaut à dards")
  await rename('Darts 7.62 mm ST - Projectile explosif',  "Darts 7.62 mm ST - Projectile explosif - Fusil d'assaut à dards")
  await rename('Darts 7.62 mm ST - Projectile standard',  "Darts 7.62 mm ST - Projectile standard - Fusil d'assaut à dards")
}
