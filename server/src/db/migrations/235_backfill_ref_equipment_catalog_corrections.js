// 235_backfill_ref_equipment_catalog_corrections.js
//
// Corrections catalogue faites après coup, à la main, via l'éditeur GM
// (server/public/equipment-admin.html, PUT /equipment/:id) et jamais capturées par une migration —
// donc jamais propagées à une instance seedée séparément (cause racine du bug "module Arme KO",
// docs/BUGIDENTIFIE.md, 2026-08-08). Généré MÉCANIQUEMENT par
// server/src/db/generate-catalog-migration.js depuis l'écart entre le seed (STEP1_cleaned_data.js)
// et l'état réel de l'instance locale (curation confirmée fonctionnelle) — aucune saisie manuelle.
//
// Matché par `name` (core.md — id non stable entre instances seedées séparément, leçon migration
// 209). Idempotent et non bloquant : n'applique le changement QUE si la valeur actuelle sur
// l'instance cible correspond encore à la valeur "avant" attendue (état seed) ; sinon (déjà
// appliqué, ou déjà corrigé différemment sur cette instance) → log, JAMAIS de throw qui bloquerait
// la chaîne de migrations suivante (leçon directe de l'incident 209).

const FIXES = {
  "Cougar": {
    "damage_h": {
      "before": "4D10+3",
      "after": "4D10"
    },
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "MASS 64": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Morgan EX": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Scorpion Ultra": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Sniper AV": {
    "damage_h": {
      "before": "4D10+3",
      "after": "5D10"
    },
    "damage_v_low": {
      "before": null,
      "after": "1D6x2"
    },
    "ammo_count": {
      "before": "5",
      "after": "7"
    },
    "caliber": {
      "before": "12,7 mm",
      "after": "12.7 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Trépied": {
    "tech_level": {
      "before": 1,
      "after": 2
    }
  },
  "Couteau Congre": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Néca II": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Slice Mod II": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Klauss": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Telen II": {
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Oxi4": {
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "MHCT-micro": {
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Dague Shark": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Ten DS": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Découpe carlingue Scianor": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Découpe roche poche": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Découpe roche Portable": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Dague moléc. Pulsar": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "AX 56": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "FAV 76": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "FV 12 Répliquant": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Gant énergétique": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hache": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hache lourde (2M)": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Épée/sabre Capitan": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Gant magma": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Griffe de combat": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Griffes primitives": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "GriffesTech": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Capsule explosive": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Gant choc": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Poing choc": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance": {
    "weight": {
      "before": 1.7,
      "after": 1.5
    },
    "damage_h": {
      "before": "3D10+1",
      "after": "3D10"
    },
    "range": {
      "before": "2/4/7/15 (30)",
      "after": "3"
    },
    "min_str": {
      "before": 8,
      "after": 11
    },
    "init_mod": {
      "before": -3,
      "after": null
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance thermique Solar": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Masse/maillet à deux mains": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Matraque": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Masse": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Perforateur": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Poing américain": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Massue en bois": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Massue en os": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Sabre à 2 mains": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Fusil sonique d’attaque": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Disque à énergie foudre": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Disque à fragmentation": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Disque-drone": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hache de lancer": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hache de lancer lourde": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Javelot": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Shuriken": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance-capsules": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance-disques": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance-filet": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Vaporisateur de gaz": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance-harpon mini double Bis": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Embol Mk 4P": {
    "caliber": {
      "before": "Darts 7,62 mm ST",
      "after": "Darts 7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Grenade à gaz — Gaz vésicants": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à gaz — Gaz irritants": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à gaz — Gaz neurotoxiques": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à gaz — Gaz décomposants": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à gaz — Gaz assommants": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Faisceau Pulsar": {
    "ammo_cost": {
      "before": null,
      "after": "10"
    },
    "caliber": {
      "before": null,
      "after": "GP-C1"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Faisceau de saturation": {
    "ammo_cost": {
      "before": null,
      "after": "30"
    },
    "caliber": {
      "before": null,
      "after": "GP-C2"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Sonar d’attaque": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Sonar d’attaque directionnel": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Boomerang": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "TMP I": {
    "ammo_cost": {
      "before": null,
      "after": "30"
    },
    "caliber": {
      "before": null,
      "after": "GP-B2"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Électro-fouet": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Dague neurale Brain": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Canon à infrasons": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "GND 23": {
    "ammo_cost": {
      "before": null,
      "after": "20"
    },
    "caliber": {
      "before": null,
      "after": "GP-D3"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Désintégrateur": {
    "ammo_cost": {
      "before": null,
      "after": "60"
    },
    "caliber": {
      "before": null,
      "after": "GP-C1"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Fusil choc Stun": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Grenade à fragmentation": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Scorpion": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hellion Alpha": {
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Pistolet choc Stun II": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Peclinor": {
    "caliber": {
      "before": "5,45 mm",
      "after": "5.45 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hellion Alpha II": {
    "caliber": {
      "before": "4,5 mmS",
      "after": "4.5 mmS"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Bouclier - Petit": {
    "location": {
      "before": "B",
      "after": "M"
    }
  },
  "Bouclier - Moyen": {
    "location": {
      "before": "B",
      "after": "M"
    }
  },
  "Lance-grenades": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Capsule gaz — Gaz suffocants": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Capsule gaz — Gaz irritants": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Capsule napalm": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Capsule gaz — Gaz assommants": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Capsule gaz — Gaz vésicants": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Canon foudre": {
    "ammo_cost": {
      "before": null,
      "after": "250"
    },
    "caliber": {
      "before": null,
      "after": "GP-B3"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Canon à particules": {
    "ammo_cost": {
      "before": null,
      "after": "160"
    },
    "caliber": {
      "before": null,
      "after": "GP-C3"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Bouclier - Grand": {
    "location": {
      "before": "B",
      "after": "M"
    }
  },
  "Couteau en os": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Gem 400": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Loknar": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Sniper NZC": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Gatling micro Cyclone": {
    "caliber": {
      "before": "12,7 mm",
      "after": "12.7 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Thor": {
    "caliber": {
      "before": "15,2 mm",
      "after": "15.2 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "NeoA": {
    "caliber": {
      "before": "15,2 mm",
      "after": "15.2 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Mini-canon rotatif": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Cougar 125": {
    "caliber": {
      "before": "5,56 mmS",
      "after": "5.56 mmS"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Beldam II": {
    "caliber": {
      "before": "7,62 mmS",
      "after": "7.62 mmS"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Matraque Mao": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Filet de dauphin (interdit)": {
    "rarity": {
      "before": "20(20)",
      "after": "0(10)"
    }
  },
  "Foie de dauphin (interdit)": {
    "rarity": {
      "before": "20(20)",
      "after": "0(10)"
    }
  },
  "Nérid 650": {
    "damage_h": {
      "before": "4D10+3",
      "after": "4D10"
    },
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Cartouche Masque à gaz": {
    "location": {
      "before": null,
      "after": "T"
    },
    "malus_cat": {
      "before": null,
      "after": "S"
    }
  },
  "Sac étanche abyssal en peau synthétique de céphalopode": {
    "rarity": {
      "before": "20(20)",
      "after": "15(10)"
    }
  },
  "Fusil sonique incap. sirène": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Canon à neutron": {
    "ammo_cost": {
      "before": null,
      "after": "80"
    },
    "caliber": {
      "before": null,
      "after": "GP-C4"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Oryx II": {
    "ammo_cost": {
      "before": null,
      "after": "30"
    },
    "caliber": {
      "before": null,
      "after": "GP-B2"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "MFM (Multi-FAV mod I)": {
    "ammo_cost": {
      "before": null,
      "after": "90"
    },
    "caliber": {
      "before": null,
      "after": "GP-B4"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "TMP II": {
    "ammo_cost": {
      "before": null,
      "after": "50"
    },
    "caliber": {
      "before": null,
      "after": "GP-B3"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "FAM (Faisceau AM)": {
    "ammo_cost": {
      "before": null,
      "after": "500"
    },
    "caliber": {
      "before": null,
      "after": "GP-C1"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Breather": {
    "caliber": {
      "before": "5,45 mm",
      "after": "5.45 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Pén. 2(H) - Projectile standard - Lance-harpon moyen": {
    "caliber": {
      "before": null,
      "after": "Pén. 2(H)"
    }
  },
  "Capsule gaz — Gaz neurotoxiques": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Capsule gaz — Gaz décomposants": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Pén. 1(H) - Projectile standard - Lance-harpon léger": {
    "caliber": {
      "before": null,
      "after": "Pén. 1(H)"
    }
  },
  "Pén. 3(H) - Projectile standard - Lance-harpon lourd": {
    "caliber": {
      "before": null,
      "after": "Pén. 3(H)"
    }
  },
  "Dela ZE": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "FAV 34": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Kevler": {
    "caliber": {
      "before": "5,56 mm",
      "after": "5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Bâton de combat": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Batte Dicta": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Canne de combat": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Chalumeau": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Trident": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Fusil Gauss": {
    "caliber": {
      "before": "7,62 mm",
      "after": "7.62 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Dague thermique Thermo IV": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Foreuse Clyss": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance-harpon à répétition Fulgur": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Disrupteur neural": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Modulateur sonique": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance thermique Fléau": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Arbalète Leysur IV": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Arbalète primitive": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Capsule fumigène": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Arc Ibram Flexi": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Arc primitif": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Fronde": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance poignard": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "« Disque fou » sick": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Couteau de lancer": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Dague de lancer": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance-harpon moyen": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "F67": {
    "caliber": {
      "before": "12,7 mm",
      "after": "12.7 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Ningram": {
    "caliber": {
      "before": "12,7 mm",
      "after": "12.7 mm"
    },
    "location": {
      "before": null,
      "after": "2M/Tr"
    }
  },
  "Gatling SC Kora": {
    "caliber": {
      "before": "12,7 mmS",
      "after": "12.7 mmS"
    },
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Canon Manta V": {
    "location": {
      "before": null,
      "after": "Tr"
    }
  },
  "Flex": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Dard": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Disque tranchant (normal)": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Hache (1 main)": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "ANG 200": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Exiss Delta": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Slington Sp.": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Faucheur III": {
    "caliber": {
      "before": "11,43 mm",
      "after": "11.43 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "MK 56": {
    "caliber": {
      "before": "12,7 mm",
      "after": "12.7 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Prion": {
    "caliber": {
      "before": "2,7 mm",
      "after": "2.7 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Vega Ultra": {
    "caliber": {
      "before": "10,92 mm",
      "after": "10.92 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Neuman": {
    "caliber": {
      "before": "5,45 mm",
      "after": "5.45 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Capsule acide": {
    "caliber": {
      "before": null,
      "after": "Capsule"
    }
  },
  "Lance-harpon mini": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Canon sonique": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "MK28": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Norston": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Ozer 43": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Vega python": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Paloma": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Pek II": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Tylman": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Locard ExelP": {
    "caliber": {
      "before": "Darts 5,56 mm ST",
      "after": "Darts 5.56 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Mc Glenn": {
    "caliber": {
      "before": "7,65 mm",
      "after": "7.65 mm"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lanceur de poignet Hybri 500": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Gén. d’onde de choc": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Grenade à concussion": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade fumigène": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade incendiaire": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade étourdissante": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade assommante": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à neuro-charge": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade sonique": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Grenade à énergie": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Nomrad IP": {
    "caliber": {
      "before": "Darts 4,5 mm ST",
      "after": "Darts 4.5 mm"
    },
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance-harpon lourd à répétition Nihil": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Lance-harpon lourd": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Grenade à gaz — Gaz suffocants": {
    "location": {
      "before": null,
      "after": "M"
    }
  },
  "Lance-flammes": {
    "location": {
      "before": null,
      "after": "2M"
    }
  },
  "Harnais mécanisé": {
    "tech_level": {
      "before": 1,
      "after": 3
    }
  },
  "Bâton Ordonnateurs": {
    "caliber": {
      "before": null,
      "after": "Charge électrique"
    },
    "location": {
      "before": null,
      "after": "M"
    }
  }
}

export const up = async (knex) => {
  let applied = 0, alreadyDone = 0, skippedUnexpected = 0, missing = []
  for (const [name, cols] of Object.entries(FIXES)) {
    const row = await knex('ref_equipment').where({ name }).select(['id', ...Object.keys(cols)]).first()
    if (!row) { missing.push(name); continue }
    const updates = {}
    for (const [col, { before, after }] of Object.entries(cols)) {
      const current = row[col]
      if (JSON.stringify(current) === JSON.stringify(after)) { alreadyDone++; continue }
      if (JSON.stringify(current) !== JSON.stringify(before)) {
        console.log(`[235] valeur inattendue, ignorée : ${name}.${col} = ${JSON.stringify(current)} (attendu ${JSON.stringify(before)})`)
        skippedUnexpected++
        continue
      }
      updates[col] = after
    }
    if (Object.keys(updates).length > 0) {
      await knex('ref_equipment').where({ id: row.id }).update(updates)
      applied++
    }
  }
  console.log(`[235] catalogue : ${applied} lignes corrigées, ${alreadyDone} déjà à jour, ${skippedUnexpected} valeurs inattendues ignorées, ${missing.length} introuvables`)
  if (missing.length > 0) console.log(`[235] introuvables : ${missing.join(', ')}`)
}

export const down = async (knex) => {
  for (const [name, cols] of Object.entries(FIXES)) {
    const row = await knex('ref_equipment').where({ name }).select(['id', ...Object.keys(cols)]).first()
    if (!row) continue
    const reverts = {}
    for (const [col, { before, after }] of Object.entries(cols)) {
      if (JSON.stringify(row[col]) === JSON.stringify(after)) reverts[col] = before
    }
    if (Object.keys(reverts).length > 0) {
      await knex('ref_equipment').where({ id: row.id }).update(reverts)
    }
  }
}
