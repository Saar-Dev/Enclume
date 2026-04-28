/**
 * ============================================================
 * 00_Config.gs — Polaris WebApp (shared config)
 * - Constantes partagées entre modules
 * ============================================================
 */

// --------------------
// BDD Polaris
// --------------------
const BDD_POLARIS_ID = '12msJt6Mzpx9f-Kj9Y-2_CpQ7ZSsuC78SNI6WX1h0ob0';
const BDD_COMPETENCES_SHEET = "Compétences"; // source canon skills (CombatMJ)

// Onglets à synchroniser BDD -> fiche
const ONGLET_A_SYNCHRONISER = [
  'Protections',
  'Compétences',
  'Armes de contact',
  'Armes à distances',
  'Equipements',
  'Munitions'
];

// --------------------
// Bourse
// --------------------
const BOURSE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1eb5YRgWRqEuEErX9Ty5lARin1kpfwTQZKgTq3ZPiarI/edit";
const SHEET_NAME = "Bourse";
const PERSO_SHEET_NAME = "Personnage";

// --------------------
// Initiative V2 (props + MJ sheet)
// --------------------
const INIT_PROP_PREFIX = "INITV2_";

// Pointers
const INIT_ACTIVE_BY_FID = (fid) => `${INIT_PROP_PREFIX}ACTIVE_FOR_FID_${fid}`;
const INIT_ACTIVE_BY_MID = (mid) => `${INIT_PROP_PREFIX}ACTIVE_FOR_MID_${mid}`;

// Data blobs
const INIT_COMBAT_KEY = (combatId) => `${INIT_PROP_PREFIX}COMBAT_${combatId}`;
const INIT_PLAYERS_KEY = (mid) => `${INIT_PROP_PREFIX}PLAYERS_${mid}`;

// MJ sheet (ton fichier dédié Initiative)
const INIT_MJ_SHEET_ID = "1v6v54WE6l8WkO5VvZ1WWqjvyorZujuHDAzskLyk52tI";
const INIT_MJ_TAB_NAME = "Initiative";

// Player identity
const INIT_PLAYER_SHEET = "Personnage";
const INIT_PLAYER_JOUEUR_CELL = "B3";
const INIT_PLAYER_NAME_CELL = "B6";
const INIT_PLAYER_BASEINIT_CELL = "AE15";

// MJ sheet columns (B..F)
const MJ_COL_NAME   = 2; // B
const MJ_COL_SCORE  = 3; // C
const MJ_COL_SIDE   = 4; // D
const MJ_COL_DETAIL = 5; // E
const MJ_COL_TS     = 6; // F

/*************************************************************
 * Trade_Config — Polaris Marchands
 *************************************************************/

/*************************************************************
 * Trade_Config — Polaris Marchands
 *************************************************************/

const POLARIS_BDD_EQUIP_SHEET = "Equipements";

const TRADE_MJ_SHEET_MERCHANTS = "Marchands";
const TRADE_MJ_SHEET_RULES = "Marchands_Rules";

const TRADE_PLAYER_SHEET_PERSONNAGE = "Personnage";
const TRADE_PLAYER_SHEET_HISTORY = "Historique Transactions";

const TRADE_INV_RANGE_AO = "AO72:AO124";
const TRADE_INV_RANGE_QTY = "BC72:BC124";
const TRADE_INV_RANGE_WGT = "BD72:BD124";
const TRADE_PLAYER_MONEY_CELL = "AG66";

const TRADE_DEFAULT_NIV_MAX = 5;
const TRADE_MAX_NIV = 20;
const TRADE_MAX_NT = 6;
const TRADE_MAX_GEN = 10;
const TRADE_MAX_LOC = 6;

// ✅ même fichier MJ que l’initiative
const TRADE_DEFAULT_MJ_ID = INIT_MJ_SHEET_ID;

// ✅ Catégorie canon PC
const TRADE_COMPUTER_CATEGORY = "Ordinateur";

/** Arrondi au 0.50 le plus proche */
function trade_roundToHalf_(x){
  x = Number(x);
  if (!isFinite(x)) return 0;
  return Math.round(x * 2) / 2;
}

function trade_normKey_(fam, cat, name){
  return [String(fam||"").trim(), String(cat||"").trim(), String(name||"").trim()].join("§");
}

function trade_parseNumberLoose_(v){
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  s = s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/kg/ig, "").replace(/sols?/ig, "").trim();
  s = s.replace(/(\d)\s+(\d)/g, "$1$2");
  s = s.replace(/,/g, ".");
  s = s.replace(/%/g, "");
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

const TRADE_ROMAN_NT = { I:1, II:2, III:3, IV:4, V:5, VI:6 };
const TRADE_ROMAN_GEN = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8, IX:9, X:10 };

function trade_toRomanNT_(n){
  n = Number(n);
  for (const k in TRADE_ROMAN_NT) if (TRADE_ROMAN_NT[k] === n) return k;
  return "";
}
function trade_toRomanGen_(n){
  n = Number(n);
  for (const k in TRADE_ROMAN_GEN) if (TRADE_ROMAN_GEN[k] === n) return k;
  return "";
}

function trade_parseNTCell_(ntRaw){
  const s = String(ntRaw||"").trim();
  if (!s) return { kind:"none" };

  const up = s.toUpperCase();
  if (TRADE_ROMAN_NT[up]) return { kind:"fixed", min: TRADE_ROMAN_NT[up], max: TRADE_ROMAN_NT[up] };

  const m = up.match(/^([IVX]+)\s*[AÀ]\s*([IVX]+)$/);
  if (m && TRADE_ROMAN_NT[m[1]] && TRADE_ROMAN_NT[m[2]]) {
    return { kind:"range", min: TRADE_ROMAN_NT[m[1]], max: TRADE_ROMAN_NT[m[2]] };
  }
  if (up.includes("I") && up.includes("VI")) return { kind:"range", min:1, max:6 };

  return { kind:"raw", raw:s };
}

/** Poids base (kg) des ordinateurs terminaux standards (Gen x NT) */
const TRADE_PC_WEIGHT_TABLE = {
  1: {1:2, 2:1.5, 3:1, 4:0.5, 5:0.2, 6:0.2},
  2: {1:4, 2:3,   3:2, 4:1,   5:0.5, 6:0.3},
  3: {1:6, 2:5,   3:4, 4:3,   5:2,   6:0.5},
  4: {1:8, 2:7,   3:6, 4:4,   5:3,   6:0.7},
  5: {1:10,2:8,   3:7, 4:5,   5:3,   6:1},
  6: {1:12,2:10,  3:8, 4:6,   5:3,   6:1.5},
  7: {1:14,2:11,  3:9, 4:7,   5:4,   6:2},
  8: {1:16,2:12,  3:10,4:8,   5:4,   6:2.5},
  9: {1:18,2:14,  3:12,4:10,  5:6,   6:3},
  10:{1:20,2:16,  3:12,4:10,  5:6,   6:4}
};

function trade_normText_(s){
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function trade_isComputerCat_(cat){
  return trade_normText_(cat) === trade_normText_(TRADE_COMPUTER_CATEGORY);
}

function trade_detectComputerType_(fam, cat, name){
  fam = String(fam||"");
  cat = String(cat||"");
  name = String(name||"");

  if (!trade_isComputerCat_(cat)) return null;

  const c = trade_normText_(cat);
  const n = trade_normText_(name);

  if (c.includes("retinien") || c.includes("rétinien")) {
    return { type:"retina", ratio:0, baseMaxGenNT1: 1, restricted: true };
  }
  if (c.includes("assistant")) {
    return { type:"assistant", ratio:0.5, baseMaxGenNT1: 3, restricted: true };
  }
  if (c.includes("mallette")) {
    return { type:"mallett", ratio:0.75, baseMaxGenNT1: 4, restricted: true };
  }
  if (c.includes("ceinture")) {
    return { type:"belt", ratio:0.5, baseMaxGenNT1: 2, restricted: true };
  }
  if (c.includes("bracelet")) {
    return { type:"wrist", ratio:0.25, baseMaxGenNT1: 1, restricted: true };
  }

  if (n.includes("retinien") || n.includes("rétinien")) {
    return { type:"retina", ratio:0, baseMaxGenNT1: 1, restricted: true };
  }
  if (n.includes("assistant")) {
    return { type:"assistant", ratio:0.5, baseMaxGenNT1: 3, restricted: true };
  }
  if (n.includes("mallett") || n.includes("mallette")) {
    return { type:"mallett", ratio:0.75, baseMaxGenNT1: 4, restricted: true };
  }
  if (n.includes("ceintur") || n.includes("ceinture")) {
    return { type:"belt", ratio:0.5, baseMaxGenNT1: 2, restricted: true };
  }
  if (n.includes("bracelet")) {
    return { type:"wrist", ratio:0.25, baseMaxGenNT1: 1, restricted: true };
  }

  return { type:"standard", ratio:1, baseMaxGenNT1: Infinity, restricted: false };
}

/*************************************************************
 * Plages nommées partagées — Polaris
 * Source unique pour Trade / Inventory / Reload / autres modules
 *************************************************************/

const TRADE_NR = Object.freeze({
  /* =========================
   * Inventaire — lignes d’objets
   * ========================= */
  InventaireIDObj: "InventaireIDObj",
  InventaireNomObj: "InventaireNomObj",
  InventaireFamObj: "InventaireFamObj",
  InventaireCATObj: "InventaireCATObj",
  InventaireEmplObj: "InventaireEmplObj",
  InventairePoidsObj: "InventairePoidsObj",
  InventaireDescriptionObj: "InventaireDescriptionObj",
  InventaireQteObj: "InventaireQteObj",
  InventaireObjNotes: "InventaireObjNotes",

  /* =========================
   * Inventaire — stats détaillées par objet
   * ========================= */
  InventaireObjNT: "InventaireObjNT",
  InventaireObjFabricant: "InventaireObjFabricant",
  InventaireObjNation: "InventaireObjNation",
  InventaireObjDom: "InventaireObjDom",
  InventaireObjChoc: "InventaireObjChoc",
  InventaireObjPortee: "InventaireObjPortee",
  InventaireObjFOR: "InventaireObjFOR",
  InventaireObjInit: "InventaireObjInit",
  InventaireObjModedeTir: "InventaireObjModedeTir",
  InventaireObjMun: "InventaireObjMun",
  InventaireObjCAL: "InventaireObjCAL",
  InventaireObjDispo: "InventaireObjDispo",
  InventaireObjProt: "InventaireObjProt",
  InventaireObjProtChoc: "InventaireObjProtChoc",
  InventaireObjLoc: "InventaireObjLoc",
  InventaireObjArmureMalus: "InventaireObjArmureMalus",
  InventaireObjContenance: "InventaireObjContenance",
  InventaireObjEtancheite: "InventaireObjEtancheite",
  InventaireChargeurBallesRestantes: "InventaireChargeurBallesRestantes",

  /* =========================
   * Catalogue équipement — colonnes de base
   * ========================= */
  EquipNom: "EquipNom",
  EquipFam: "EquipFam",
  EquipCAT: "EquipCAT",
  EquipDescription: "EquipDescription",
  EquipPrix: "EquipPrix",
  EquipPoids: "EquipPoids",

  /* =========================
   * Catalogue équipement — stats détaillées
   * ========================= */
  EquipNT: "EquipNT",
  EquipStatModMax: "EquipStatModMax",
  EquipFabricant: "EquipFabricant",
  EquipNation: "EquipNation",
  EquipArmeDom: "EquipArmeDom",
  EquipArmeChoc: "EquipArmeChoc",
  EquipArmePortee: "EquipArmePortee",
  EquipArmeFORPreReq: "EquipArmeFORPreReq",
  EquipArmeINIMod: "EquipArmeINIMod",
  EquipArmeModeTir: "EquipArmeModeTir",
  EquipArmeMunition: "EquipArmeMunition",
  EquipArmeCAL: "EquipArmeCAL",
  EquipDispo: "EquipDispo",
  EquipArmureProt: "EquipArmureProt",
  EquipArmureChoc: "EquipArmureChoc",
  EquipArmureLoc: "EquipArmureLoc",
  EquipArmureMal: "EquipArmureMal",
  EquipObjContenance: "EquipObjContenance",
  EquipObjEtancheite: "EquipObjEtancheite",

  /* =========================
   * Armes / rechargement / fiche perso
   * ========================= */
  ArmesObj1: "ArmesObj1",
  ArmesObj1Nom: "ArmesObj1Nom",
  ArmesObj1ID: "ArmesObj1ID",
  Armes1ChargeurBallesRestantes: "Armes1ChargeurBallesRestantes",
  Arme1Cal: "Arme1Cal",
  Armes1Chargeur: "Armes1Chargeur",

  /* =========================
   * Listes dynamiques
   * ========================= */
  Liste_MunitionsCAL: "Liste_MunitionsCAL",
  Liste_MunitionsINV: "Liste_MunitionsINV",
  Liste_Armes1: "Liste_Armes1",
  Liste_Armes2: "Liste_Armes2",

  /* =========================
   * Divers
   * ========================= */
  TeteObj1: "TeteObj1",
  TeteObj2: "TeteObj2",
  TeteObj3: "TeteObj3"
});

function polaris_getNamedRangeOrThrow_(ss, key){
  const name = TRADE_NR[key];
  if (!name) throw new Error(`Clé de plage nommée inconnue: ${key}`);
  const r = ss.getRangeByName(name);
  if (!r) throw new Error(`Plage nommée introuvable: ${name}`);
  return r;
}