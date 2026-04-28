import fs from 'fs';

const INPUT_FILE = './STEP0_raw_data.js';
const OUTPUT_FILE = './STEP1_cleaned_data.js';

// 1. Lecture
const rawContent = fs.readFileSync(INPUT_FILE, 'utf8');
const dataStart = rawContent.indexOf('[');
const dataEnd = rawContent.lastIndexOf(']') + 1;
const rawData = JSON.parse(rawContent.substring(dataStart, dataEnd));

// 2. Table d'équivalence de caractères corrompus
const charMap = {
    'ï¿½': 'é',
    'ï¿½ï¿½': 'à',
    'ï¿½': 'è',
    'ï¿½': 'ê',
    'ï¿½': 'î',
    'ï¿½': 'ô',
    'ï¿½': 'û'
};

function fixEncoding(text) {
    if (!text || typeof text !== 'string') return text;
    let fixed = text;
    // On boucle sur la table pour remplacer chaque horreur par le bon caractère
    Object.keys(charMap).forEach(bad => {
        fixed = fixed.split(bad).join(charMap[bad]);
    });
    return fixed;
}

// 3. Nettoyage et Mapping
const clean = (v) => {
    let t = fixEncoding(v);
    return (t && t !== '-' && t !== '') ? t.trim() : null;
};

const parseWeight = (v) => {
    const s = clean(v);
    if (!s) return null;
    const m = s.replace(',', '.').match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
};

// Trouve la valeur même si la clé du CSV est corrompue
const findVal = (obj, pattern) => {
    const key = Object.keys(obj).find(k => k.toLowerCase().includes(pattern.toLowerCase()));
    return key ? obj[key] : null;
};

const cleanedData = rawData.map((row, i) => {
    // On extrait les dommages
    const rawDmg = clean(findVal(row, "Dommage"));
    const dmg = { h: null, v_low: null, v_high: null };
    if (rawDmg) {
        rawDmg.split('/').forEach(p => {
            const t = p.trim();
            if (t.includes('(V-)')) dmg.v_low = t.replace('(V-)', '').trim();
            else if (t.includes('(V+)')) dmg.v_high = t.replace('(V+)', '').trim();
            else if (t.includes('(H)')) dmg.h = t.replace('(H)', '').trim();
            else if (!dmg.h) dmg.h = t;
        });
    }

    return {
        "base_id": `EQ_${String(i + 1).padStart(5, '0')}`,
        "base_family": clean(findVal(row, "Famille")),
        "base_category": clean(findVal(row, "Cat")),
        "base_name": clean(findVal(row, "Nom")),
        "base_description": clean(findVal(row, "Description")),
        "base_price": clean(findVal(row, "Prix")),
        "base_weight": parseWeight(findVal(row, "Poids")),
        "base_nt": clean(findVal(row, "NT")),
        "base_manufacturer": clean(findVal(row, "Fabricant")),
        "req_origin_nation": clean(findVal(row, "Nation")),
        "base_rarity": clean(findVal(row, "DIS")),
        "req_skill_req": clean(findVal(row, "Compétence")),
        "stat_bonus_val": clean(findVal(row, "Bonus")),
        "req_max_level": clean(findVal(row, "Niv Max")),
        "req_min_str": clean(findVal(row, "FOR")),
        "off_damage_h": dmg.h,
        "off_damage_v_low": dmg.v_low,
        "off_damage_v_high": dmg.v_high,
        "off_shock": clean(findVal(row, "Choc")),
        "off_range": clean(findVal(row, "Portée")),
        "stat_init_mod": clean(findVal(row, "Init")),
        "off_fire_mode": clean(findVal(row, "Mode de tir")),
        "off_ammo_raw": clean(findVal(row, "Mun.")),
        "off_ammo_cal": clean(findVal(row, "CAL.")),
        "off_skill_assoc": clean(findVal(row, "associée")),
        "def_protection": clean(findVal(row, "Protection")),
        "def_shock_mod": clean(findVal(row, "Choc*")),
        "def_locations": clean(findVal(row, "Localisations")),
        "def_malus_type": clean(findVal(row, "malus")),
        "stat_capacity": clean(findVal(row, "Contenance")),
        "stat_waterproof": clean(findVal(row, "Etanchéité")),
        "mod_compat": clean(findVal(row, "eligible")),
        "mod_ammo_eff": clean(findVal(row, "Effets"))
    };
});

const output = `export const equipmentData = ${JSON.stringify(cleanedData, null, 2)};`;
fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
console.log(`--- [STEP1] Terminé avec table de caractères : ${cleanedData.length} lignes ---`);