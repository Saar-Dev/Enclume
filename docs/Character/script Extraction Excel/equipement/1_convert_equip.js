import fs from 'fs';

const INPUT_FILE = './STEP1_cleaned_data.js';
const OUTPUT_FILE = './ref_equipments_data.js';

// 1. Chargement robuste
const rawContent = fs.readFileSync(INPUT_FILE, 'utf8');
const dataStart = rawContent.indexOf('[');
const dataEnd = rawContent.lastIndexOf(']') + 1;
const rawData = JSON.parse(rawContent.substring(dataStart, dataEnd));

// 2. Dictionnaire d'encodage étendu (cas du Excel corrompu)
const encodingMap = [
    { bad: /dï¿½gï¿½ts/gi, good: 'dégâts' },
    { bad: /portï¿½e/gi, good: 'portée' },
    { bad: /catï¿½gorie/gi, good: 'catégorie' },
    { bad: /compï¿½tence/gi, good: 'compétence' },
    { bad: /ï¿½tanchï¿½itï¿½/gi, good: 'étanchéité' },
    { bad: /mï¿½lï¿½e/gi, good: 'mêlée' },
    { bad: /coï¿½t/gi, good: 'coût' }
];

const fixText = (val) => {
    if (val === null || val === undefined) return null;
    let t = String(val).trim();
    if (t === '-' || t === '') return null;
    encodingMap.forEach(m => { t = t.replace(m.bad, m.good); });
    return t;
};

// 3. Récupération intelligente (Donne la priorité à la clé technique, puis au français)
const getVal = (row, techKey, frPatterns) => {
    // 1. Est-ce que la clé technique existe et est remplie ?
    if (row[techKey] !== undefined && row[techKey] !== null && row[techKey] !== '') {
        return fixText(row[techKey]);
    }
    // 2. Sinon, on cherche dans les colonnes type Excel
    const keys = Object.keys(row);
    const foundKey = keys.find(k => {
        const lowK = k.toLowerCase();
        return frPatterns.some(p => lowK.includes(p.toLowerCase()));
    });
    return foundKey ? fixText(row[foundKey]) : null;
};

// 4. Parser de dégâts non-destructif
const parseDmg = (row) => {
    const raw = getVal(row, 'off_damage_h', ['Dommage', 'Dégâts', 'dmg']);
    if (!raw) return { h: null, v_low: null, v_high: null };
    
    // Si c'est déjà structuré, on garde
    if (row.off_damage_h && (row.off_damage_v_low || row.off_damage_v_high)) {
        return { h: fixText(row.off_damage_h), v_low: fixText(row.off_damage_v_low), v_high: fixText(row.off_damage_v_high) };
    }

    let h = raw, vl = null, vh = null;
    if (raw.includes('/')) {
        const parts = raw.split('/');
        parts.forEach(p => {
            if (p.includes('(V-)')) vl = p.replace('(V-)', '').trim();
            else if (p.includes('(V+)')) vh = p.replace('(V+)', '').trim();
            else if (p.includes('(H)')) h = p.replace('(H)', '').trim();
        });
    }
    return { h, v_low: vl, v_high: vh };
};

// 5. Traitement
const stats = { total: rawData.length, missingNames: 0, missingPrices: 0 };

const cleanedData = rawData.map((row, i) => {
    const dmg = parseDmg(row);
    const item = {
        "base_id": row.base_id || `EQ_${String(i + 1).padStart(5, '0')}`,
        "base_family": getVal(row, 'base_family', ['Famille']),
        "base_category": getVal(row, 'base_category', ['Cat']),
        "base_name": getVal(row, 'base_name', ['Nom', 'Désignation']),
        "base_description": getVal(row, 'base_description', ['Description']),
        "base_price": getVal(row, 'base_price', ['Prix', 'Coût']),
        "base_weight": getVal(row, 'base_weight', ['Poids']), // Gardé en string pour ne rien perdre
        "base_nt": getVal(row, 'base_nt', ['NT']),
        "base_manufacturer": getVal(row, 'base_manufacturer', ['Fabricant']),
        "req_origin_nation": getVal(row, 'req_origin_nation', ['Nation', 'Origine']),
        "base_rarity": getVal(row, 'base_rarity', ['DIS', 'Rareté']),
        "req_skill_req": getVal(row, 'req_skill_req', ['Compétence']),
        "stat_bonus_val": getVal(row, 'stat_bonus_val', ['Bonus']),
        "req_min_str": getVal(row, 'req_min_str', ['FOR']),
        "off_damage_h": dmg.h,
        "off_damage_v_low": dmg.v_low,
        "off_damage_v_high": dmg.v_high,
        "off_shock": getVal(row, 'off_shock', ['Choc']),
        "off_range": getVal(row, 'off_range', ['Portée']),
        "stat_init_mod": getVal(row, 'stat_init_mod', ['Init']),
        "off_fire_mode": getVal(row, 'off_fire_mode', ['Mode']),
        "off_ammo_raw": getVal(row, 'off_ammo_raw', ['Mun']),
        "off_skill_assoc": getVal(row, 'off_skill_assoc', ['associée']),
        "def_protection": getVal(row, 'def_protection', ['Protection']),
        "def_locations": getVal(row, 'def_locations', ['Localisations']),
        "stat_waterproof": getVal(row, 'stat_waterproof', ['Etanchéité'])
    };

    if (!item.base_name) stats.missingNames++;
    if (!item.base_price) stats.missingPrices++;

    return item;
});

// 6. Sauvegarde et Rapport
const output = `export const equipmentData = ${JSON.stringify(cleanedData, null, 2)};`;
fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

console.log(`
--- RAPPORT DE CONVERSION ---
Items traités    : ${stats.total}
Noms manquants   : ${stats.missingNames} ${stats.missingNames > 0 ? '⚠️' : '✅'}
Prix manquants   : ${stats.missingPrices}
Fichier généré   : ${OUTPUT_FILE}
-----------------------------
`);