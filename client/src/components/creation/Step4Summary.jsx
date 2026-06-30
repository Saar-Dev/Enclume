// Mock Step 4 — données temporaires simulant ref_backgrounds + ref_skills
// Remplacé par API backend quand disponible

import { useTranslation } from 'react-i18next'

export default function Step4Summary({
  age, originGeo, originSoc, training, higherEd,
  careers, geoName, geoNation, socNation, onPrev, onSubmit,
}) {
  const { t } = useTranslation('creation')

  const geoItem = geoOrigins.find(g => g.code === originGeo)
  const socItem = socialOrigins.find(s => s.code === originSoc)
  const trainingItem = trainings.find(tr => tr.code === training)
  const higherEdItem = higherEd ? higherEds.find(h => h.code === higherEd) : null

  const totalPC = (higherEd ? 1 : 0) + careers.reduce((sum, c) => sum + c.years, 0)

  return (
    <div style={ss.container}>
      <h2 style={ss.title}>{t('step4.summary_title')}</h2>

      <div style={ss.section}>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.age_label')}</span>
          <span style={ss.value}>{t('step4.age_slider', { age })}</span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.geo_origin_title')}</span>
          <span style={ss.value}>
            {geoItem?.name ?? originGeo}
            {geoName ? ` — ${geoName}` : ''}
            {geoNation ? ` (${geoNation})` : ''}
          </span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.social_origin_title')}</span>
          <span style={ss.value}>
            {socItem?.name ?? originSoc}
            {socNation ? ` (${socNation})` : ''}
          </span>
        </div>
        <div style={ss.row}>
          <span style={ss.label}>{t('step4.training_title')}</span>
          <span style={ss.value}>{trainingItem?.name ?? training}</span>
        </div>
        {higherEdItem && (
          <div style={ss.row}>
            <span style={ss.label}>{t('step4.higher_ed_title')}</span>
            <span style={ss.value}>{higherEdItem.name}</span>
          </div>
        )}
      </div>

      <div style={ss.section}>
        <div style={ss.sectionTitle}>{t('step4.careers_title')}</div>
        {careers.length === 0 ? (
          <p style={ss.empty}>{t('step4.career_none')}</p>
        ) : (
          careers.map((c, i) => {
            const career = careersList.find(cl => cl.code === c.career_id)
            const titleEntry = career?.titles?.slice().reverse().find(ti => c.years >= ti.min_years)
            return (
              <div key={i} style={ss.careerRow}>
                <span style={ss.careerName}>{career?.name ?? c.career_id}</span>
                <span style={ss.careerYears}>{c.years} an{c.years > 1 ? 's' : ''}</span>
                {titleEntry && <span style={ss.careerTitle}>{titleEntry.title}</span>}
              </div>
            )
          })
        )}
      </div>

      <div style={ss.pcRow}>
        {t('step4.summary_pc', { spent: totalPC, total: 20 })}
      </div>

      <div style={ss.nav}>
        <button style={ss.prevBtn} onClick={onPrev}>← {t('step4.prev')}</button>
        <button style={ss.submitBtn} onClick={onSubmit}>{t('step4.validate')}</button>
      </div>
    </div>
  )
}

const ss = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', flex: 1, maxWidth: '720px', margin: '0 auto', width: '100%' },
  title: { color: '#c0c0d0', fontSize: '16px', fontWeight: '700', margin: 0 },
  section: { border: '1px solid #1e1e2e', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(6,6,14,0.85)' },
  sectionTitle: { fontSize: '11px', fontWeight: '700', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px', backgroundColor: 'rgba(14,14,26,0.9)', borderBottom: '1px solid #1e1e2e' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 12px', borderBottom: '1px solid #1a1a2e', gap: '12px' },
  label: { color: '#5a5a7a', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  value: { color: '#c0c0d0', fontSize: '12px', textAlign: 'right' },
  empty: { color: '#3a3a5e', fontSize: '12px', padding: '12px', margin: 0 },
  careerRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #1a1a2e' },
  careerName: { color: '#c0c0d0', fontSize: '12px', fontWeight: '600', flex: 1 },
  careerYears: { color: '#9090c8', fontSize: '11px' },
  careerTitle: { color: '#5b8dee', fontSize: '11px', padding: '2px 6px', border: '1px solid #5b8dee', borderRadius: '3px' },
  pcRow: { color: '#e0a85c', fontSize: '12px', fontWeight: '600', textAlign: 'center', padding: '8px' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #1e1e2e', marginTop: 'auto' },
  prevBtn: { padding: '8px 16px', border: '1px solid #2a2a3e', borderRadius: '4px', backgroundColor: '#0e0e1a', color: '#6a6a8a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  submitBtn: { padding: '8px 20px', border: 'none', borderRadius: '4px', backgroundColor: '#5b8dee', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' },
}

export const nationsList = [
  'Hégémonie',
  'Ligue Rouge',
  'Culte du Trident',
  'République de Corail',
  'Union Méditerranéenne',
  'États du Rift',
  'Amazonia',
  'Alliance Polaire',
  'Fuego Liberdad',
  'Indépendant',
]

export const geoOrigins = [
  {
    code: 'navire_nomade',
    name: 'Navire nomade',
    sort_order: 1,
    diceRange: '1',
    description: 'Vous avez grandi à bord d\'un navire nomade, naviguant de station en station.',
    asksName: true,
    nameLabel: 'Nom du navire',
    asksNation: false,
    skills: [
      { skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'PILOTAGE__NAVIRES_LEGERS', bonus: 1 },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 2 },
      { skill_id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', bonus: 1 },
      { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', bonus: 1 },
    ],
  },
  {
    code: 'petite_station',
    name: 'Petite station',
    sort_order: 2,
    diceRange: '2-7',
    description: 'Vous venez d\'une petite station isolée, où chacun doit savoir tout faire.',
    asksName: true,
    nameLabel: 'Nom de la station',
    asksNation: false,
    skills: [
      { skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 2 },
      { skill_id: 'AQUACULTURE_ELEVAGE', bonus: 2 },
      { skill_id: 'ELECTRONIQUE', bonus: 1 },
    ],
  },
  {
    code: 'station_moyenne',
    name: 'Station de taille moyenne',
    sort_order: 3,
    diceRange: '8-9',
    description: 'Vous avez grandi dans une station moyenne, carrefour commercial et administratif.',
    asksName: true,
    nameLabel: 'Nom de la station',
    asksNation: true,
    skills: [
      { skill_id: 'MANOEUVRES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'BUREAUCRATIE', bonus: 1 },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', bonus: 1 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'ELECTRONIQUE', bonus: 1 },
    ],
  },
  {
    code: 'grande_cite',
    name: 'Grande cité',
    sort_order: 4,
    diceRange: '10',
    description: 'Vous êtes né dans une grande cité sous-marine, centre de pouvoir et de savoir.',
    asksName: true,
    nameLabel: 'Nom de la cité',
    asksNation: true,
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 2 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 3 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
    ],
  },
]

export const socialOrigins = [
  {
    code: 'bas_fonds',
    name: 'Bas-fonds',
    parent_code: 'grande_cite',
    diceRange: '1-2',
    description: 'Vous avez survécu dans les bas-fonds des grandes cités, entre misère et débrouille.',
    skills: [
      { skill_id: 'INTIMIDATION', bonus: 1 },
      { skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
      { skill_id: 'COMBAT_ARME', bonus: 1 },
      { skill_id: 'PICKPOCKET', bonus: 2 },
    ],
  },
  {
    code: 'milieu_ouvrier',
    name: 'Milieu ouvrier',
    parent_code: null,
    diceRange: '3-7',
    description: 'Vos parents travaillaient dans les fermes aquacoles ou les usines. Le travail, la sueur, la solidarité.',
    skills: [
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 1 },
      { skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', bonus: 1 },
      { skill_id: 'AQUACULTURE_ELEVAGE', bonus: 2, conditional: true, choice_group: 'ouvrier_specialite' },
      { skill_id: 'MECANIQUE', bonus: 2, conditional: true, choice_group: 'ouvrier_specialite' },
    ],
  },
  {
    code: 'classes_moyennes',
    name: 'Classes moyennes',
    parent_code: 'station_moyenne',
    diceRange: '8-9',
    description: 'Famille de commerçants, fonctionnaires ou artisans. Une vie confortable sans excès.',
    asksNation: true,
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 1 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
    ],
  },
  {
    code: 'classes_moyennes',
    name: 'Classes moyennes',
    parent_code: 'grande_cite',
    diceRange: '8-9',
    description: 'Famille de commerçants, fonctionnaires ou artisans. Une vie confortable sans excès.',
    asksNation: true,
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 1 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 2 },
    ],
  },
  {
    code: 'classes_superieures',
    name: 'Classes supérieures',
    parent_code: 'grande_cite',
    diceRange: '10',
    description: 'Vous êtes né avec une cuillère en argent dans la bouche. Pouvoir, intrigues et privilèges.',
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2, conditional: true, choice_group: 'superieur_competence' },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
    ],
  },
]

export const trainings = [
  {
    code: 'delinquance',
    name: 'Délinquance/Criminalité',
    sort_order: 1,
    diceRange: '1',
    description: 'Vous avez appris dans la rue, entre gangs et contrebande.',
    skills: [
      { skill_id: 'INTIMIDATION', bonus: 1 },
      { skill_id: 'COMMERCE_TRAFIC__ARMES', bonus: 1, conditional: true, choice_group: 'commerce' },
      { skill_id: 'COMMERCE_TRAFIC__DROGUES', bonus: 1, conditional: true, choice_group: 'commerce' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'COMBAT_ARME', bonus: 1 },
      { skill_id: 'COMBAT_A_MAINS_NUES', bonus: 1 },
      { skill_id: 'ARMES_DE_POING', bonus: 1 },
      { skill_id: 'CAMOUFLAGE_DISSIMULATION', bonus: 1 },
      { skill_id: 'PICKPOCKET', bonus: 1 },
      { skill_id: 'SYSTEMES_DE_SECURITE', bonus: 1 },
    ],
  },
  {
    code: 'apprentissage_technique',
    name: 'Apprentissage technique',
    sort_order: 2,
    diceRange: '2-7',
    description: 'Vous avez appris un métier technique : aquaculture, mines ou usine.',
    skills: [],
    hasSpecialties: true,
    allowed_parents: ['bas_fonds', 'milieu_ouvrier', 'classes_moyennes'],
  },
  {
    code: 'education_scolaire',
    name: 'Éducation scolaire',
    parent_code: 'classes_moyennes',
    sort_order: 3,
    diceRange: '8-9',
    description: 'Vous avez suivi une scolarité classique, ouverte sur le monde et la connaissance.',
    skills: [
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 4 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
      { skill_id: 'INFORMATIQUE', bonus: 1 },
    ],
  },
  {
    code: 'education_scolaire',
    name: 'Éducation scolaire',
    parent_code: 'classes_superieures',
    sort_order: 4,
    diceRange: '8-9',
    description: 'Vous avez suivi une scolarité classique, ouverte sur le monde et la connaissance.',
    skills: [
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 4 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 2, conditional: true, choice_group: 'sciences_scolaires' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
      { skill_id: 'INFORMATIQUE', bonus: 1 },
    ],
  },
  {
    code: 'autodidacte',
    name: 'Autodidacte',
    sort_order: 5,
    diceRange: '10',
    description: 'Vous avez tout appris par vous-même. 7 points libres à répartir (+2 max par compétence).',
    skills: [],
    isAutodidacte: true,
  },
]

export const higherEds = [
  {
    code: 'commerce_gestion',
    name: 'Commerce/Gestion',
    pc_cost: 1,
    years_added: 2,
    description: 'Bases théoriques en commerce et gestion. Bureaucratie, commerce international, administration.',
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 3 },
      { skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', bonus: 2, conditional: true, choice_group: 'commerce_specialite' },
      { skill_id: 'COMMERCE_TRAFIC__VEHICULES', bonus: 2, conditional: true, choice_group: 'commerce_specialite' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 1 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', bonus: 2, conditional: true, choice_group: 'gestion_specialite' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE', bonus: 2, conditional: true, choice_group: 'gestion_specialite' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 3, conditional: true },
    ],
  },
  {
    code: 'droit',
    name: 'Droit',
    pc_cost: 1,
    years_added: 2,
    description: 'Fondamentaux du droit sous-marin. Éloquence, législations des grandes nations.',
    skills: [
      { skill_id: 'ELOQUENCE_PERSUASION', bonus: 1 },
      { skill_id: 'BUREAUCRATIE', bonus: 3 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', bonus: 3 },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
    ],
  },
  {
    code: 'ecole_ingenieurs',
    name: "École d'ingénieurs",
    pc_cost: 1,
    years_added: 2,
    description: 'Formation technique poussée. Génie civil ou naval, électronique, informatique, mécanique.',
    skills: [
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
      { skill_id: 'GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL', bonus: 3, conditional: true, choice_group: 'genie_specialite' },
      { skill_id: 'GENIE_TECHNIQUE_ARCHITECTURE_NAVALE', bonus: 3, conditional: true, choice_group: 'genie_specialite' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 1, conditional: true },
      { skill_id: 'ELECTRONIQUE', bonus: 2 },
      { skill_id: 'INFORMATIQUE', bonus: 2 },
      { skill_id: 'MECANIQUE', bonus: 2, conditional: true },
    ],
  },
  {
    code: 'ecole_militaire',
    name: 'École militaire',
    pc_cost: 1,
    years_added: 2,
    description: 'Commandement, stratégie et tactique. Armes de poing ou fusils, langue d\'un pays allié ou hostile.',
    skills: [
      { skill_id: 'COMMANDEMENT', bonus: 3 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'ARMES_DE_POING', bonus: 2, conditional: true, choice_group: 'arme_militaire' },
      { skill_id: 'FUSIL_ARMES_DEPAULES', bonus: 2, conditional: true, choice_group: 'arme_militaire' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
      { skill_id: 'STRATEGIE', bonus: 1 },
      { skill_id: 'TACTIQUE_COMBAT_TERRESTRE', bonus: 2, conditional: true },
    ],
  },
  {
    code: 'ecole_navale',
    name: 'École navale',
    pc_cost: 1,
    years_added: 2,
    description: 'Navigation, cartographie, pilotage. Commandement et connaissance des océans.',
    skills: [
      { skill_id: 'COMMANDEMENT', bonus: 1 },
      { skill_id: 'CARTOGRAPHIE', bonus: 2 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 2 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'NAVIGATION', bonus: 2 },
      { skill_id: 'ANALYSES_SONSCANS', bonus: 1 },
      { skill_id: 'PILOTAGE__NAVIRES_LEGERS', bonus: 2 },
      { skill_id: 'PILOTAGE__NAVIRES_LOURDS', bonus: 1 },
      { skill_id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', bonus: 1 },
    ],
  },
  {
    code: 'medecine',
    name: 'Médecine',
    pc_cost: 1,
    years_added: 2,
    description: 'Biologie, physiologie, pharmacologie. Médecine générale et premiers soins.',
    skills: [
      { skill_id: 'ANALYSE_EMPATHIQUE', bonus: 1 },
      { skill_id: 'BUREAUCRATIE', bonus: 1 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', bonus: 3 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', bonus: 1 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', bonus: 3 },
      { skill_id: 'PREMIER_SOINS', bonus: 3 },
    ],
  },
  {
    code: 'sciences',
    name: 'Sciences/Sciences humaines',
    pc_cost: 1,
    years_added: 2,
    description: 'Histoire, géographie, sociologie. Recherche, langues, informatique.',
    skills: [
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 1 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'RECHERCHE_DINFORMATIONS', bonus: 1 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE', bonus: 3, conditional: true, choice_group: 'sciences_specialite' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
      { skill_id: 'INFORMATIQUE', bonus: 2 },
    ],
  },
  {
    code: 'sciences_politiques',
    name: 'Sciences politiques',
    pc_cost: 1,
    years_added: 2,
    description: 'Bureaucratie, connaissance des nations, droit ou histoire. Géographie et langues.',
    skills: [
      { skill_id: 'BUREAUCRATIE', bonus: 1 },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', bonus: 3 },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', bonus: 3 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', bonus: 2 },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', bonus: 1, conditional: true, choice_group: 'politiques_specialite' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', bonus: 1, conditional: true, choice_group: 'politiques_specialite' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', bonus: 1 },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', bonus: 2, conditional: true },
    ],
  },
]

export const careersList = [
  {
    code: 'artisan_artiste',
    name: 'Artisan/Artiste',
    description: 'Les artisans fabriquent les produits qu\'ils vendent ou rendent divers services. Les artistes produisent eux des œuvres d\'art.',
    points_per_year: 10,
    restricted_geo: 'Très peu dans l\'Alliance polaire ou les Royaumes pirates. Artistes uniquement dans les grandes cités.',
    contact_frequency: 1,
    ally_frequency: 2,
    opponent_frequency: 4,
    equipment: ['Matériel standard', "Matériel d'artisanat"],
    skills: [
      { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
      { skill_id: 'ENSEIGNEMENT', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', skill_group: 'Connaissances' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
      { skill_id: 'EDUCATION_CULTURE_GENERALE', skill_group: 'Connaissances' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances', conditional: true },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
      { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
      { skill_id: 'ART_ARTISANAT', skill_group: 'Techniques' },
    ],
    titles: [
      { min_years: 1, max_years: 2, title: 'Apprenti', salary_per_year: 50 },
      { min_years: 3, max_years: 6, title: 'Compagnon', salary_per_year: 1500 },
      { min_years: 7, max_years: 12, title: 'Artisan/Artiste', salary_per_year: 15000 },
      { min_years: 13, max_years: null, title: 'Maître', salary_per_year: 30000 },
    ],
  },
  {
    code: 'assassin',
    name: 'Assassin',
    description: 'Les assassins sont des tueurs professionnels de haut niveau, payés pour faire le sale boulot… plus ou moins discrètement.',
    points_per_year: 10,
    contact_frequency: 1,
    ally_frequency: 3,
    opponent_frequency: 1,
    equipment: ['Matériel standard', 'Arme de contact', 'Arme de poing', 'Fusil de précision', "Matériel d'espionnage et de sécurité", 'Poisons et drogues'],
    skills: [
      { skill_id: 'ACROBATIE_EQUILIBRE', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ESCALADE', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ARTS_MARTIAUX', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
      { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
      { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
      { skill_id: 'TIR_PRECISION', skill_group: 'Combat (tir)' },
      { skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'INTIMIDATION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
      { skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances' },
      { skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
      { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
      { skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Techniques' },
      { skill_id: 'PIEGES', skill_group: 'Techniques' },
      { skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Techniques' },
    ],
    titles: [
      { min_years: 1, max_years: 3, title: 'Tueur à gages', salary_per_year: 500 },
      { min_years: 4, max_years: 9, title: 'Assassin', salary_per_year: 1000 },
      { min_years: 10, max_years: 12, title: 'Assassin', salary_per_year: 4000 },
      { min_years: 13, max_years: null, title: 'Nettoyeur', salary_per_year: 6000 },
    ],
  },
  {
    code: 'barman',
    name: 'Barman',
    description: 'Ils sont les confidents de la plupart des marins et connaissent beaucoup de monde.',
    points_per_year: 10,
    restricted_geo: 'Communautés suffisamment importantes',
    contact_frequency: 2,
    ally_frequency: 2,
    opponent_frequency: 4,
    equipment: ['Matériel standard', 'Armes blanches', 'Armes de contact', 'Armes de poing'],
    skills: [
      { skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ENTREGENT_SEDUCTION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'INTIMIDATION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
      { skill_id: 'JEU', skill_group: 'Connaissances' },
      { skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', skill_group: 'Connaissances' },
      { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
      { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
      { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)', conditional: true },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
    ],
    titles: [
      { min_years: 1, max_years: 2, title: 'Apprenti', salary_per_year: 400 },
      { min_years: 3, max_years: 6, title: 'Barman', salary_per_year: 800 },
      { min_years: 7, max_years: 14, title: 'Barman', salary_formula: '1D100*20' },
      { min_years: 15, max_years: null, title: 'Barman', salary_formula: '1D100*100' },
    ],
  },
  {
    code: 'chasseur_primes',
    name: 'Chasseur de primes',
    description: 'Les Chasseurs de primes passent la plus grande partie de leur temps à courir après des criminels, des pirates, des contrebandiers ou des fugitifs.',
    points_per_year: 10,
    contact_frequency: 2,
    ally_frequency: 4,
    opponent_frequency: 2,
    equipment: ['Armure de plongée Exo-1 ou petit navire sous-marin (à crédit)', 'Armement', 'Armures et protections', 'Matériel standard'],
    skills: [
      { skill_id: 'ATHLETISME', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ENDURANCE', skill_group: 'Aptitudes physiques' },
      { skill_id: 'MANOEUVRES_SOUS_MARINES', skill_group: 'Aptitudes physiques' },
      { skill_id: 'ARTS_MARTIAUX', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
      { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
      { skill_id: 'ARMES_SOUS_MARINES', skill_group: 'Combat (tir)' },
      { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
      { skill_id: 'ANALYSE_EMPATHIQUE', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'INTIMIDATION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
      { skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
      { skill_id: 'RECHERCHE_DINFORMATIONS', skill_group: 'Connaissances' },
      { skill_id: 'FURTIVITE_DEPLACEMENT_SILENCIEUX', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'DEGUISEMENT_IMITATION', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'DISCRETION_FILATURE', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'ESPIONNAGE_SURVEILLANCE', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'SYSTEMES_DE_SECURITE', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
      { skill_id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', skill_group: 'Pilotage' },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
      { skill_id: 'OBSERVATION', skill_group: 'Survie/Extérieur' },
      { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
      { skill_id: 'PREMIER_SOINS', skill_group: 'Techniques' },
    ],
    titles: [
      { min_years: 1, max_years: 6, title: 'Apprenti', salary_per_year: 500 },
      { min_years: 7, max_years: 10, title: 'Chasseur de primes', salary_per_year: 2000 },
      { min_years: 11, max_years: 18, title: 'Chasseur de primes', salary_per_year: 6000 },
      { min_years: 19, max_years: null, title: 'Chasseur de primes', salary_per_year: 12000 },
    ],
  },
  {
    code: 'contrebandier',
    name: 'Contrebandier',
    description: 'Spécialisés dans le trafic des marchandises en tout genre, les contrebandiers sont indispensables à la survie du marché noir.',
    points_per_year: 10,
    contact_frequency: 1,
    ally_frequency: 3,
    opponent_frequency: 2,
    equipment: ['Petit navire de transport (à crédit)', "Arme d'épaule", 'Arme de poing', 'Arme de contact'],
    skills: [
      { skill_id: 'COMBAT_ARME', skill_group: 'Combat (contact)' },
      { skill_id: 'COMBAT_A_MAINS_NUES', skill_group: 'Combat (contact)' },
      { skill_id: 'ARMES_DE_POING', skill_group: 'Combat (tir)' },
      { skill_id: 'FUSIL_ARMES_DEPAULES', skill_group: 'Combat (tir)' },
      { skill_id: 'ELOQUENCE_PERSUASION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'INTIMIDATION', skill_group: 'Communication/Relations sociales' },
      { skill_id: 'BUREAUCRATIE', skill_group: 'Connaissances' },
      { skill_id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', skill_group: 'Connaissances' },
      { skill_id: 'COMMERCE_TRAFIC__ARMES', skill_group: 'Connaissances' },
      { skill_id: 'NAVIGATION', skill_group: 'Connaissances' },
      { skill_id: 'CAMOUFLAGE_DISSIMULATION', skill_group: 'Furtivité/Subterfuge' },
      { skill_id: 'LANGUE_ETRANGERE_NEO_AZURAN', skill_group: 'Langues' },
      { skill_id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', skill_group: 'Pilotage' },
      { skill_id: 'ANALYSES_SONSCANS', skill_group: 'Techniques' },
      { skill_id: 'FALSIFICATION', skill_group: 'Techniques' },
    ],
    titles: [
      { min_years: 1, max_years: 6, title: 'Contrebandier', salary_formula: '1D6*100' },
      { min_years: 7, max_years: null, title: 'Contrebandier', salary_formula: '1D100*100' },
    ],
  },
]

export const refSkills = [
  { id: 'MANOEUVRES_SOUS_MARINES', marker: null },
  { id: 'MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES', marker: null },
  { id: 'PILOTAGE__NAVIRES_LEGERS', marker: null },
  { id: 'PILOTAGE__SCOOTERS_SOUS_MARINS', marker: null },
  { id: 'MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS', marker: null },
  { id: 'CONNAISSANCE_MILIEU_NATUREL_OCEANS', marker: null },
  { id: 'AQUACULTURE_ELEVAGE', marker: null },
  { id: 'ELECTRONIQUE', marker: null },
  { id: 'BUREAUCRATIE', marker: null },
  { id: 'CONNAISSANCE_DES_NATIONS_ORGANISATIONS', marker: null },
  { id: 'EDUCATION_CULTURE_GENERALE', marker: null },
  { id: 'INTIMIDATION', marker: null },
  { id: 'COMBAT_A_MAINS_NUES', marker: null },
  { id: 'COMBAT_ARME', marker: null },
  { id: 'PICKPOCKET', marker: null },
  { id: 'ARMES_DE_POING', marker: null },
  { id: 'CAMOUFLAGE_DISSIMULATION', marker: null },
  { id: 'SYSTEMES_DE_SECURITE', marker: null },
  { id: 'INFORMATIQUE', marker: null },
  { id: 'COMMANDEMENT', marker: '(X)' },
  { id: 'MEDECINE', marker: '(X)' },
  { id: 'PILOTAGE__CHASSEURS_SOUS_MARINS', marker: '(X)' },
  { id: 'COMMERCE_TRAFIC__ARMES', marker: null },
  { id: 'COMMERCE_TRAFIC__DROGUES', marker: null },
  { id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', marker: null },
  { id: 'COMMERCE_TRAFIC__VEHICULES', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE', marker: null },
  { id: 'SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES', marker: null },
  { id: 'LANGUE_ETRANGERE_NEO_AZURAN', marker: null },
  { id: 'MECANIQUE', marker: null },
  { id: 'RECHERCHE_DINFORMATIONS', marker: null },
  { id: 'ELOQUENCE_PERSUASION', marker: null },
  { id: 'GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL', marker: null },
  { id: 'GENIE_TECHNIQUE_ARCHITECTURE_NAVALE', marker: null },
  { id: 'FUSIL_ARMES_DEPAULES', marker: null },
  { id: 'STRATEGIE', marker: null },
  { id: 'TACTIQUE_COMBAT_TERRESTRE', marker: null },
  { id: 'CARTOGRAPHIE', marker: null },
  { id: 'NAVIGATION', marker: null },
  { id: 'ANALYSES_SONSCANS', marker: null },
  { id: 'PILOTAGE__NAVIRES_LOURDS', marker: null },
  { id: 'ANALYSE_EMPATHIQUE', marker: null },
  { id: 'PREMIER_SOINS', marker: null },
]