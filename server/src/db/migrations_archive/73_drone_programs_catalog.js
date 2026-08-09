// Migration 73 — drone_programs : catalogue ref_equipment
//
// Décision : pas de table ref_programs distincte.
// Les logiciels sont des équipements (family='Logiciels') dans ref_equipment.
// drone_programs passe d'un label libre à un FK catalogue + option custom.
//
// Partie 1 : ALTER drone_programs (table vide — safe)
//   - DROP label
//   - ADD equipment_id UUID nullable FK ref_equipment
//   - ADD label_override TEXT (pour programmes custom)
//   - ADD category TEXT NOT NULL (rôle mécanique — copié depuis ref_equipment à l'insert)
//   - CONSTRAINT chk_dp_source : equipment_id IS NOT NULL OR label_override IS NOT NULL
//
// Partie 2 : INSERT ref_equipment seed family='Logiciels'
//   Catalogue LdB p.281-282 + exemples drones. down() supprime ces lignes.

export const up = async (knex) => {
  // ─── Partie 1 : modifier drone_programs ───────────────────────────────────
  await knex.raw(`
    ALTER TABLE drone_programs
      DROP COLUMN label,
      ADD COLUMN equipment_id UUID REFERENCES ref_equipment(id) ON DELETE RESTRICT,
      ADD COLUMN label_override TEXT,
      ADD COLUMN category TEXT NOT NULL DEFAULT 'specialise',
      ADD CONSTRAINT chk_dp_source
        CHECK (equipment_id IS NOT NULL OR label_override IS NOT NULL)
  `)
  await knex.raw(`ALTER TABLE drone_programs ALTER COLUMN category DROP DEFAULT`)

  // ─── Partie 2 : seed ref_equipment family='Logiciels' ────────────────────
  const programs = [
    // === COMBAT / ARMES AUTOMATISÉES (LdB p.320) ===
    {
      family: 'Logiciels', category: 'detection', name: 'Détection',
      description: "Programme de détection. Permet à l'ordinateur d'acquérir une cible en début de tour (INI 12). Échec : nouvelle tentative 5 rangs d'initiative plus tard.",
      tech_level: 1, price_modifier: '500 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'detection', name: 'Détection visuelle-infrarouge',
      description: "Programme de détection optique et infrarouge. Acquiert une cible avant l'attaque. Utilisé par les drones de combat Magiar (NT IV).",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'ami_ennemi', name: 'Ami/ennemi',
      description: "Programme d'analyse conditionnel. Identifie la cible comme amie (transpondeur) ou ennemie avant de déclencher l'attaque. Évite le tir fratricide.",
      tech_level: 1, price_modifier: '400 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'armement', name: 'Contrôle armement',
      description: "Programme de contrôle armement. Sert de Compétence d'attaque pour l'arme automatisée. Un programme par arme. Niveau = niveau d'attaque.",
      tech_level: 1, price_modifier: '1600 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'armement', name: 'Tir',
      description: "Programme de tir. Sert de Compétence pour les attaques à distance du drone.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'armement', name: 'Attaque',
      description: "Programme d'attaque générique (contact ou distance). Sert de Compétence pour les attaques du drone.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'armement', name: 'Bombardement',
      description: "Programme d'attaque pour armes lourdes ou bombes. Utilisé par les drones aériens de la Ligue Rouge.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'esquive', name: 'Esquive',
      description: "Programme d'esquive. Utilisé pour éviter d'être touché au contact ou pour se mettre à couvert. Compétence défensive du drone.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'pilotage', name: 'Interception',
      description: "Programme d'interception pour drone-bouclier. Permet au drone de s'interposer entre l'engin protégé et une attaque entrante. Test en opposition à la marge de réussite de l'attaque.",
      tech_level: 1, rarity: '20(20)',
    },
    // === SÉCURITÉ INFORMATIQUE ===
    {
      family: 'Logiciels', category: 'securite', name: 'Sécurité',
      description: "Programme de défense de l'ordinateur. Réagit en cas d'attaque d'un autre ordinateur ou d'un virus. Niveau de défense lors des duels d'ordinateurs.",
      tech_level: 1, price_modifier: '1200 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'offensif', name: 'Offensif',
      description: "Programme offensif. Permet d'attaquer un autre ordinateur pour prendre son contrôle. Test en opposition au programme de sécurité adverse.",
      tech_level: 1, price_modifier: '1200 × cumul', rarity: '-5(1)',
    },
    {
      family: 'Logiciels', category: 'contre_attaque', name: 'Contre-attaque',
      description: "En cas d'attaque reçue, permet à l'ordinateur de contre-attaquer l'adversaire. Complément indispensable du programme de sécurité.",
      tech_level: 1, price_modifier: '1200 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'rempart', name: 'Rempart',
      description: "Programme de sécurité passif. Dresse une barrière que l'attaquant doit réduire à 0 avant d'accéder à l'ordinateur. Ne contre-attaque pas mais retarde l'adversaire.",
      tech_level: 1, price_modifier: '1000 × cumul', rarity: '20(20)',
    },
    // === NAVIGATION / PILOTAGE ===
    {
      family: 'Logiciels', category: 'pilotage', name: 'Pilotage',
      description: "Programme de pilotage. Gère les déplacements et manœuvres du drone dans son milieu (sous-marin, terrestre, aérien).",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'pilotage', name: 'Dissimulation',
      description: "Programme de dissimulation. Permet au drone de se cacher ou de minimiser sa signature sur les détecteurs adverses.",
      tech_level: 1, rarity: '20(20)',
    },
    // === ANALYSE ===
    {
      family: 'Logiciels', category: 'analyse', name: 'Analyse senseurs/sonars/radars',
      description: "Analyse les données recueillies par les senseurs de l'ordinateur (infrarouge, thermique, ultraviolet, sonar actif/passif, radar, etc.).",
      tech_level: 1, price_modifier: '400 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'analyse', name: 'Analyse sonar',
      description: "Programme spécialisé sonar actif et passif. Capte et interprète les signaux sous-marins. Communique automatiquement tout contact établi.",
      tech_level: 1, rarity: '20(20)',
    },
    // === MÉDICAL ===
    {
      family: 'Logiciels', category: 'medical', name: 'Premiers soins',
      description: "Programme de premiers soins. Permet au drone médical de prodiguer des soins d'urgence sur le terrain.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'medical', name: 'Chirurgie',
      description: "Programme chirurgical. Permet au drone d'effectuer des opérations chirurgicales avec précision (drone Magiar 45).",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'medical', name: 'Analyse médicale',
      description: "Programme de diagnostic médical. Évalue l'état du patient, identifie blessures et maladies.",
      tech_level: 1, rarity: '20(20)',
    },
    // === COMMUNICATION ===
    {
      family: 'Logiciels', category: 'communication', name: 'Communication',
      description: "Programme de gestion des communications. Gère les échanges de données et messages entre systèmes.",
      tech_level: 1, price_modifier: '300 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'communication', name: 'Multi-langages',
      description: "Programme de traduction simultanée. Traduit toutes formes de langages connus. Bonus sur langues communes, malus sur langues rares.",
      tech_level: 1, rarity: '20(20)',
    },
    // === SPÉCIALISÉS ===
    {
      family: 'Logiciels', category: 'specialise', name: 'Topographique',
      description: "Banque de données topographiques sous-marines et terrestres. Peut établir la topographie de nouvelles zones inconnues.",
      tech_level: 1, price_modifier: '800 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Données',
      description: "Banque de données spécialisée sur un sujet précis (géologie, biologie, historique…). Coût exponentiel.",
      tech_level: 1, price_modifier: '1000 × niv²', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: "Gestion d'appareils",
      description: "Nécessaire pour chaque appareil géré par l'ordinateur. Un système non géré ne peut être activé que manuellement.",
      tech_level: 1, price_modifier: '400 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Cryptage',
      description: "Programme de cryptage de fichiers.",
      tech_level: 1, price_modifier: '1200 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Décryptage',
      description: "Programme de décryptage de fichiers cryptés.",
      tech_level: 1, price_modifier: '1600 × cumul', rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Brise-code',
      description: "Analyse et brise les codes de sécurité (serrures électroniques, verrous de systèmes…).",
      tech_level: 1, price_modifier: '1500 × cumul', rarity: '-5(1)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Viral autonome',
      description: "Programme d'attaque placé dans un ordinateur cible pour en détruire les défenses de l'intérieur.",
      tech_level: 1, price_modifier: '2200 × cumul', rarity: '-10(1)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Espion',
      description: "Programme placé dans un ordinateur cible qui enregistre tout son activité. Peut déclencher des actions conditionnelles.",
      tech_level: 1, price_modifier: '2800 × cumul', rarity: '-10(1)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Anti-espion',
      description: "Cherche les programmes espions dans l'ordinateur. Test en opposition au niveau du programme espion. Détruit l'espion en cas de succès.",
      tech_level: 1, price_modifier: '1600 × cumul', rarity: '-5(1)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Mécanique-électronique-informatique',
      description: "Programme de réparation polyvalent. Couvre la mécanique, l'électronique et l'informatique (drones de réparation Magiar).",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Extraction',
      description: "Programme spécialisé en extraction et prélèvement. Utilisé par les drones d'extraction de la Ligue Rouge.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Science botanique',
      description: "Programme d'analyse et d'identification des végétaux. Utilisé par les drones agricoles de la République du Corail.",
      tech_level: 1, rarity: '20(20)',
    },
    {
      family: 'Logiciels', category: 'specialise', name: 'Science agriculture',
      description: "Programme agricole. Gère les opérations de plantation, élagage et analyse de sol.",
      tech_level: 1, rarity: '20(20)',
    },
  ]

  await knex('ref_equipment').insert(programs)
}

export const down = async (knex) => {
  // Supprimer le seed (ORDER MATTERS : FK avant ALTER)
  await knex('ref_equipment').where({ family: 'Logiciels' }).delete()

  // Remettre drone_programs dans son état d'origine
  await knex.raw(`
    ALTER TABLE drone_programs
      DROP CONSTRAINT IF EXISTS chk_dp_source,
      DROP COLUMN IF EXISTS equipment_id,
      DROP COLUMN IF EXISTS label_override,
      DROP COLUMN IF EXISTS category,
      ADD COLUMN label TEXT NOT NULL DEFAULT ''
  `)
  await knex.raw(`ALTER TABLE drone_programs ALTER COLUMN label DROP DEFAULT`)
}
