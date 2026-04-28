const fs = require('fs');

const INPUT = 'skills.csv'; 
const OUTPUT = 'ref_skills_data.js';
const SEPARATOR = ';';

// 1. Table de réparation pour les erreurs d'encodage courantes (Latin1 -> UTF8)
function fixEncoding(text) {
    if (!text) return '';
    return text
        .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ãª/g, 'ê')
        .replace(/Ã /g, 'à').replace(/Ã¢/g, 'â').replace(/Ã®/g, 'î')
        .replace(/Ã¯/g, 'ï').replace(/Ã´/g, 'ô').replace(/Ã»/g, 'û')
        .replace(/Ã¹/g, 'ù').replace(/Ã§/g, 'ç').replace(/â‚¬/g, '€')
        .replace(/â€¦/g, '...') // Répare l'ellipse après "natation"
        .replace(/â€™/g, "'").replace(/â€“/g, '-');
}

// 2. Nettoyage des IDs (On veut du ASCII pur pour la BDD)
function cleanId(text) {
    if (!text) return '';
    // On répare d'abord le texte pour ne pas avoir de symboles dans l'ID
    const fixed = fixEncoding(text);
    return fixed.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[*†()]/g, '').replace(/[\s\/-]+/g, '_')
        .toUpperCase().replace(/[^A-Z0-9_]/g, '').trim();
}

// 3. Nettoyage du texte (On sauve les accents, on vire les "machins")
function cleanText(text) {
    if (!text) return '';
    let fixed = fixEncoding(text);
    return fixed
        .replace(/[\r\n\t]+/g, ' ') // Remplace retours ligne/tabs par espace
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '') // Filtre radical : garde ASCII + Accents Latins
        .replace(/\s\s+/g, ' ') // Supprime doubles espaces
        .trim();
}

function run() {
    // Lecture en latin1 pour capter les octets originaux
    const raw = fs.readFileSync(INPUT, 'latin1');
    const lines = raw.split(/\r?\n/);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Découpage par point-virgule
        const cols = line.split(SEPARATOR).map(c => c.replace(/^"|"$/g, '').trim());
        const [category, name, spec, type, attrs, prereq, desc] = cols;

        if (!name) continue;

        const parentId = cleanId(name);
        const specId = cleanId(spec);
        const finalId = specId ? `${parentId}_${specId}` : parentId;
        
        const attrParts = (attrs || '').split('/');
        const a1 = attrParts[0] || '??';
        const a2 = (attrParts[1] && attrParts[1] !== a1) ? attrParts[1] : null;

        results.push({
            id: finalId,
            family: cleanText(category).replace(/_+$/, ''),
            label: spec ? cleanText(spec).replace(/[*†]/g, '') : cleanText(name).replace(/[*†]/g, ''),
            parent: spec ? parentId : null,
            attr_1: a1,
            attr_2: a2,
            marker: spec ? 'S' : (type || null),
            description: cleanText(desc)
        });
    }

    const content = `export const skillsData = ${JSON.stringify(results, null, 2)};`;
    fs.writeFileSync(OUTPUT, content, 'utf8');
    console.log(`Extraction finalisée : ${results.length} lignes traitées.`);
}

run();