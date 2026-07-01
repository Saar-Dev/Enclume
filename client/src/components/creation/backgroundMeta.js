// Métadonnées UI des backgrounds — annotations client uniquement, pas des règles de jeu.
// diceRange : plage de dé pour tirage aléatoire (D10 selon LdB).
// asksName / nameLabel / asksNation : champs complémentaires à afficher dans BackgroundSelector.
// isAutodidacte / hasSpecialties : affichage conditionnel dans le panneau de détails.
export const BG_META = {
  navire_nomade:           { diceRange: '1',   asksName: true, nameLabel: 'Nom du navire',    asksNation: false },
  petite_station:          { diceRange: '2-7', asksName: true, nameLabel: 'Nom de la station', asksNation: false },
  station_moyenne:         { diceRange: '8-9', asksName: true, nameLabel: 'Nom de la station', asksNation: true  },
  grande_cite:             { diceRange: '10',  asksName: true, nameLabel: 'Nom de la cité',   asksNation: true  },
  bas_fonds:               { diceRange: '1-2' },
  milieu_ouvrier:          { diceRange: '3-7' },
  classes_moyennes:        { diceRange: '8-9', asksNation: true },
  classes_superieures:     { diceRange: '10'  },
  delinquance:             { diceRange: '1'   },
  apprentissage_technique: { diceRange: '2-7', hasSpecialties: true },
  education_scolaire:      { diceRange: '8-9' },
  autodidacte:             { diceRange: '10',  isAutodidacte: true },
}
