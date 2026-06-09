/**
 * Migration 75 — Calibers munitions/armes + noms munitions (sync Kiwi)
 *
 * Problème 1 : calibers d'armes en notation française virgule (7,62 mm) vs munitions
 *              en notation internationale point (7.62 mm) → incompatibilité totale
 *              dans WeaponPanel.jsx et char-sheet.js pour tout calibre décimal.
 *
 * Problème 2 : sur Kiwi (serveur distant), la colonne caliber des munitions est NULL
 *              (migration 53 jamais appliquée sur Kiwi, seed Session 70 rejoué).
 *
 * Problème 3 : noms de munitions sur Kiwi contiennent encore le qualificatif d'arme.
 *              Sur local, migration 53 a traité la plupart mais 5 calibres restent
 *              (apostrophe U+2019 dans le seed → migration 53 no-op pour ces entrées).
 *
 * Partie A : normalise calibers armes virgule→point, supprime " ST" des Darts.
 * Partie B : set le caliber des munitions NULL (Kiwi) ou incohérent (caliber='12'→'Calibre 12').
 * Parties C+D : fusions + renommages idempotents.
 *
 * Note apostrophe : le seed utilise U+2019 (') dans les noms contenant "d'assaut" et "d'épaule".
 *                   Tous les strings de lookup utilisent ’ pour correspondre exactement.
 *
 * Idempotence :
 *   - mergeAmmo() : no-op si l'une des deux entrées est absente.
 *   - rename() : no-op si source absente ; si cible existe déjà → fusionne la source dedans.
 *
 * Lance-harpon (Pén. 1/2/3(H)) : noms intentionnellement inchangés ; caliber set sur Kiwi.
 */

export const up = async (knex) => {

  // ── Partie A : Calibers armes (virgule → point, supprimer " ST") ─────────────
  await knex.raw(`
    UPDATE ref_equipment
    SET caliber = replace(replace(caliber, ',', '.'), ' ST', '')
    WHERE family = 'Armes'
      AND (caliber LIKE '%,%' OR caliber LIKE '% ST')
  `)

  // ── Partie B : Calibers munitions ────────────────────────────────────────────
  // Kiwi : toutes NULL → set depuis le préfixe du nom.
  // Local : 3 entrées Calibre 12 avec caliber='12' → 'Calibre 12'.
  // Note : les entrées Pén. sur Kiwi ont caliber NULL → set ici ; leur nom reste intact.
  await knex.raw(`
    UPDATE ref_equipment
    SET caliber = CASE
      WHEN name LIKE '2.7 mm%'          THEN '2.7 mm'
      WHEN name LIKE '3 mm%'            THEN '3 mm'
      WHEN name LIKE '4 mmS%'           THEN '4 mmS'
      WHEN name LIKE '4.5 mmS%'         THEN '4.5 mmS'
      WHEN name LIKE '5.45 mm%'         THEN '5.45 mm'
      WHEN name LIKE '5.56 mmS%'        THEN '5.56 mmS'
      WHEN name LIKE '5.56 mm%'         THEN '5.56 mm'
      WHEN name LIKE '7 mm%'            THEN '7 mm'
      WHEN name LIKE '7.62 mmS%'        THEN '7.62 mmS'
      WHEN name LIKE '7.62 mm%'         THEN '7.62 mm'
      WHEN name LIKE '7.65 mm%'         THEN '7.65 mm'
      WHEN name LIKE '9 mm%'            THEN '9 mm'
      WHEN name LIKE '10.92 mm%'        THEN '10.92 mm'
      WHEN name LIKE '11.43 mm%'        THEN '11.43 mm'
      WHEN name LIKE 'Calibre 12%'      THEN 'Calibre 12'
      WHEN name LIKE '12.7 mmS%'        THEN '12.7 mmS'
      WHEN name LIKE '12.7 mm%'         THEN '12.7 mm'
      WHEN name LIKE '15.2 mm%'         THEN '15.2 mm'
      WHEN name LIKE '15.3 mm%'         THEN '15.3 mm'
      WHEN name LIKE '17 mm%'           THEN '17 mm'
      WHEN name LIKE '20 mmS%'          THEN '20 mmS'
      WHEN name LIKE '20 mm%'           THEN '20 mm'
      WHEN name LIKE 'Capsule%'         THEN 'Capsule'
      WHEN name LIKE 'Carreau%'         THEN 'Carreau'
      WHEN name LIKE 'Darts 4.5 mm%'
        OR name LIKE 'Darts 4,5 mm%'   THEN 'Darts 4.5 mm'
      WHEN name LIKE 'Darts 5.56 mm%'
        OR name LIKE 'Darts 5,56 mm%'  THEN 'Darts 5.56 mm'
      WHEN name LIKE 'Darts 7.62 mm%'
        OR name LIKE 'Darts 7,62 mm%'  THEN 'Darts 7.62 mm'
      WHEN name LIKE 'Flèche%'          THEN 'Flèche'
      WHEN name LIKE 'GP-B2%'           THEN 'GP-B2'
      WHEN name LIKE 'GP-B3%'           THEN 'GP-B3'
      WHEN name LIKE 'GP-B4%'           THEN 'GP-B4'
      WHEN name LIKE 'GP-C1%'           THEN 'GP-C1'
      WHEN name LIKE 'GP-C2%'           THEN 'GP-C2'
      WHEN name LIKE 'GP-C3%'           THEN 'GP-C3'
      WHEN name LIKE 'GP-C4%'           THEN 'GP-C4'
      WHEN name LIKE 'GP-D2%'           THEN 'GP-D2'
      WHEN name LIKE 'GP-D3%'           THEN 'GP-D3'
      WHEN name LIKE 'Pén. 1(H)%'       THEN 'Pén. 1(H)'
      WHEN name LIKE 'Pén. 2(H)%'       THEN 'Pén. 2(H)'
      WHEN name LIKE 'Pén. 3(H)%'       THEN 'Pén. 3(H)'
      ELSE caliber
    END
    WHERE family = 'Munitions'
      AND (caliber IS NULL OR caliber = '12')
  `)

  // ── Partie C : Fusions ───────────────────────────────────────────────────────
  // Transfère current_ammo ET equipment_id avant de supprimer l'entrée redondante.
  const mergeAmmo = async (keepName, dropName) => {
    const keepRow = await knex('ref_equipment').where({ name: keepName }).first()
    const dropRow = await knex('ref_equipment').where({ name: dropName }).first()
    if (!keepRow || !dropRow) return
    await knex('char_inventory').where({ current_ammo: dropRow.id }).update({ current_ammo: keepRow.id })
    await knex('char_inventory').where({ equipment_id: dropRow.id }).update({ equipment_id: keepRow.id })
    await knex('ref_equipment').where({ id: dropRow.id }).delete()
  }

  // 9 mm (4 doublons arme de poing / pistolet-mitrailleur)
  await mergeAmmo('9 mm - Balle HP - Arme de poing',         '9 mm - Balle HP - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle IEM - Arme de poing',        '9 mm - Balle IEM - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle assommante - Arme de poing', '9 mm - Balle assommante - Pistolet-mitrailleur léger')
  await mergeAmmo('9 mm - Balle standard - Arme de poing',   '9 mm - Balle standard - Pistolet-mitrailleur léger')

  // 5.45 mm (standard FA vs pistolet léger) — apostrophe U+2019
  await mergeAmmo('5.45 mm - Balle standard - Fusil d’assaut léger', '5.45 mm - Balle standard - Pistolet léger')

  // 7.62 mm standard (5 versions weapon-specific → 1) — apostrophe U+2019
  await mergeAmmo('7.62 mm - Balle standard - Fusil de précision', '7.62 mm - Balle standard - Fusil d’assaut lourd')
  await mergeAmmo('7.62 mm - Balle standard - Fusil de précision', '7.62 mm - Balle standard - Fusil standard')
  await mergeAmmo('7.62 mm - Balle standard - Fusil de précision', '7.62 mm - Balle standard - Fusil électromagnétique')
  await mergeAmmo('7.62 mm - Balle standard - Fusil de précision', '7.62 mm - Balle standard - Mitrailleuse légère')

  // 7.62 mm SAP (arme d'épaule vs fusil de précision) — apostrophe U+2019
  await mergeAmmo('7.62 mm - Balle SAP - Arme d’épaule', '7.62 mm - Balle SAP - Fusil de précision')

  // 12.7 mm standard (mitrailleuse lourde vs pistolet lourd)
  await mergeAmmo('12.7 mm - Balle standard - Mitrailleuse lourde', '12.7 mm - Balle standard - Pistolet lourd')


  // ── Partie D : Renommages ────────────────────────────────────────────────────
  // Collision-safe : si la cible existe déjà (cas local post-migration 53 partielle),
  // fusionne la source dedans plutôt que de dupliquer.
  const rename = async (from, to) => {
    const fromRow = await knex('ref_equipment').where({ name: from }).first()
    if (!fromRow) return
    const toRow = await knex('ref_equipment').where({ name: to }).first()
    if (toRow) {
      await knex('char_inventory').where({ current_ammo: fromRow.id }).update({ current_ammo: toRow.id })
      await knex('char_inventory').where({ equipment_id: fromRow.id }).update({ equipment_id: toRow.id })
      await knex('ref_equipment').where({ id: fromRow.id }).delete()
    } else {
      await knex('ref_equipment').where({ id: fromRow.id }).update({ name: to })
    }
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

  // 5.45 mm — apostrophe U+2019
  await rename('5.45 mm - Balle APHC - Fusil d’assaut léger',       '5.45 mm - Munition APHC')
  await rename('5.45 mm - Balle IEM - Fusil d’assaut léger',        '5.45 mm - Munition IEM')
  await rename('5.45 mm - Balle SAP - Fusil d’assaut léger',        '5.45 mm - Munition SAP')
  await rename('5.45 mm - Balle assommante - Fusil d’assaut léger', '5.45 mm - Munition assommante')
  await rename('5.45 mm - Balle standard - Fusil d’assaut léger',   '5.45 mm - Munition standard')

  // 5.56 mm — apostrophe U+2019
  await rename('5.56 mm - Balle APHC - Arme d’épaule',       '5.56 mm - Munition APHC')
  await rename('5.56 mm - Balle IEM - Arme d’épaule',        '5.56 mm - Munition IEM')
  await rename('5.56 mm - Balle SAP - Arme d’épaule',        '5.56 mm - Munition SAP')
  await rename('5.56 mm - Balle assommante - Arme d’épaule', '5.56 mm - Munition assommante')
  await rename('5.56 mm - Balle standard - Arme d’épaule',   '5.56 mm - Munition standard')

  // 5.56 mmS — apostrophe U+2019
  await rename('5.56 mmS - Balle standard - Arme de poing à supercavitation', '5.56 mmS - Munition standard')

  // 7 mm
  await rename('7 mm - Balle standard - Pistolet moyen', '7 mm - Munition standard')

  // 7.62 mm — apostrophe U+2019
  await rename('7.62 mm - Balle APHC - Arme d’épaule',         '7.62 mm - Munition APHC')
  await rename('7.62 mm - Balle IEM - Arme d’épaule',          '7.62 mm - Munition IEM')
  await rename('7.62 mm - Balle SAP - Arme d’épaule',          '7.62 mm - Munition SAP')
  await rename('7.62 mm - Balle SLAP - Fusil de précision',         '7.62 mm - Munition SLAP')
  await rename('7.62 mm - Balle assommante - Arme d’épaule',   '7.62 mm - Munition assommante')
  await rename('7.62 mm - Balle explosive - Arme d’épaule',    '7.62 mm - Munition explosive')
  await rename('7.62 mm - Balle standard - Fusil de précision',     '7.62 mm - Munition standard')
  // fallback local : "Fusil d'assaut lourd" si "Fusil de précision" était absent
  await rename('7.62 mm - Balle standard - Fusil d’assaut lourd',   '7.62 mm - Munition standard')

  // 7.62 mmS — apostrophe U+2019
  await rename('7.62 mmS - Balle standard - Fusil d’assaut à supercavitation', '7.62 mmS - Munition standard')

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

  // Calibre 12
  await rename('Calibre 12 - Balle HP - Fusil à pompe',        'Calibre 12 - Munition HP')
  await rename('Calibre 12 - Balle IEM - Fusil à pompe',       'Calibre 12 - Munition IEM')
  await rename('Calibre 12 - Balle assommante - Fusil à pompe','Calibre 12 - Munition assommante')
  await rename('Calibre 12 - Balle explosive - Fusil à pompe', 'Calibre 12 - Munition explosive')
  await rename('Calibre 12 - Balle standard - Fusil à pompe',  'Calibre 12 - Munition standard')

  // 12.7 mm (gardée de la fusion + 4 singles)
  await rename('12.7 mm - Balle APHC - Mitrailleuse lourde',      '12.7 mm - Munition APHC')
  await rename('12.7 mm - Balle IEM - Mitrailleuse lourde',       '12.7 mm - Munition IEM')
  await rename('12.7 mm - Balle explosive - Mitrailleuse lourde', '12.7 mm - Munition explosive')
  await rename('12.7 mm - Balle shrapnel - Mitrailleuse lourde',  '12.7 mm - Munition shrapnel')
  await rename('12.7 mm - Balle standard - Mitrailleuse lourde',  '12.7 mm - Munition standard')

  // 12.7 mmS
  await rename('12.7 mmS - Balle standard - Gatling à supercavitation', '12.7 mmS - Munition standard')

  // 15.2 mm
  await rename('15.2 mm - Balle APHC - Fusil anti-matériel',      '15.2 mm - Munition APHC')
  await rename('15.2 mm - Balle IEM - Fusil anti-matériel',       '15.2 mm - Munition IEM')
  await rename('15.2 mm - Balle explosive - Fusil anti-matériel', '15.2 mm - Munition explosive')
  await rename('15.2 mm - Balle standard - Fusil anti-matériel',  '15.2 mm - Munition standard')

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

  // Darts 7.62 mm — apostrophe U+2019
  await rename('Darts 7.62 mm ST - Projectile APHC - Fusil d’assaut à dards',      'Darts 7.62 mm ST - Projectile APHC')
  await rename('Darts 7.62 mm ST - Projectile IEM - Fusil d’assaut à dards',       'Darts 7.62 mm ST - Projectile IEM')
  await rename('Darts 7.62 mm ST - Projectile SAP - Fusil d’assaut à dards',       'Darts 7.62 mm ST - Projectile SAP')
  await rename('Darts 7.62 mm ST - Projectile assommant - Fusil d’assaut à dards', 'Darts 7.62 mm ST - Projectile assommant')
  await rename('Darts 7.62 mm ST - Projectile explosif - Fusil d’assaut à dards',  'Darts 7.62 mm ST - Projectile explosif')
  await rename('Darts 7.62 mm ST - Projectile standard - Fusil d’assaut à dards',  'Darts 7.62 mm ST - Projectile standard')

  // Lance-harpon (Pén.) : noms intentionnellement inchangés.
}


export const down = async (knex) => {
  // Partie A seulement : restaure virgule décimale dans calibers armes.
  // Parties B, C, D : non réversibles (calibers NULL perdus, fusions irréversibles).
  await knex.raw(`
    UPDATE ref_equipment
    SET caliber = replace(caliber, '.', ',')
    WHERE family = 'Armes'
      AND caliber ~ '[0-9]\\.[0-9]'
  `)
}
