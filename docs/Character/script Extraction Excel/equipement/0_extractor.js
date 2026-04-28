import xlsx from 'xlsx';
import fs from 'fs';

const INPUT_FILE = 'ExtractEQUIP.xlsx'; 
const OUTPUT_FILE = 'STEP1_cleaned_data.js'; 

function cleanValue(val) {
    if (val === undefined || val === null || val === '-') return null;
    return String(val).trim();
}

function parseWeight(val) {
    const s = cleanValue(val);
    if (!s) return null;
    const match = s.replace(',', '.').match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

function splitDamage(raw) {
    const res = { h: null, v_low: null, v_high: null };
    const s = cleanValue(raw);
    if (!s) return res;
    const parts = s.split('/');
    parts.forEach(p => {
        const t = p.trim();
        if (t.includes('(V-)')) res.v_low = t.replace('(V-)', '').trim();
        else if (t.includes('(V+)')) res.v_high = t.replace('(V+)', '').trim();
        else if (t.includes('(H)')) res.h = t.replace('(H)', '').trim();
        else if (!res.h) res.h = t;
    });
    return res;
}

function convert() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Erreur : Fichier ${INPUT_FILE} absent.`);
        return;
    }

    const workbook = xlsx.readFile(INPUT_FILE);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const processed = data.map((row, index) => {
        const dmg = splitDamage(row['Dommage']);
        
        return {
            "base_id": `EQ_${String(index + 1).padStart(5, '0')}`,
            "base_family": cleanValue(row['Famille']),
            "base_category": cleanValue(row['Catégories']),
            "base_name": cleanValue(row['Nom']),
            "base_description": cleanValue(row['Description']),
            "base_price": cleanValue(row['Prix']),
            "base_weight": parseWeight(row['Poids']),
            "base_nt": cleanValue(row['NT']),
            "base_manufacturer": cleanValue(row['Fabricant']),
            "req_origin_nation": cleanValue(row['Nation']),
            "base_rarity": cleanValue(row['DIS (M.Noir)']),
            "req_skill_req": cleanValue(row['Compétences / Attributs']),
            "stat_bonus_val": cleanValue(row['Bonus']),
            "req_max_level": cleanValue(row['Niv Max']),
            "req_min_str": cleanValue(row['FOR']),
            "off_damage_h": dmg.h,
            "off_damage_v_low": dmg.v_low,
            "off_damage_v_high": dmg.v_high,
            "off_shock": cleanValue(row['Choc']),
            "off_range": cleanValue(row['Portée']),
            "stat_init_mod": cleanValue(row['Init']),
            "off_fire_mode": cleanValue(row['Mode de tir']),
            "off_ammo_raw": cleanValue(row['Mun.(Coût)']),
            "off_ammo_cal": cleanValue(row['CAL.']),
            "off_skill_assoc": cleanValue(row['Compétence associée']),
            "def_protection": cleanValue(row['Protection']),
            "def_shock_mod": cleanValue(row['Choc*']),
            "def_locations": cleanValue(row['Localisations']),
            "def_malus_type": cleanValue(row['Catégorie de malus']),
            "stat_capacity": cleanValue(row['Contenance']),
            "stat_waterproof": cleanValue(row['Etanchéité']),
            "mod_compat": cleanValue(row['Armes eligible']),
            "mod_ammo_eff": cleanValue(row['Effets Munitions'])
        };
    });

    const outputContent = `export const equipmentData = ${JSON.stringify(processed, null, 2)};`;
    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
    console.log(`Fichier généré avec succès : ${processed.length} lignes.`);
}

convert();