/**
 * Migration 253 — seed du catalogue ref_exo_equipment (systèmes + armes exo)
 *
 * Transcrit depuis `docs/REGLES/SEEDEXO.md` (lignes 162-803), lu intégralement ligne à ligne — pas
 * une valeur devinée. 84 lignes au total (bien plus que l'estimation initiale "~34 systèmes + ~10
 * armes" du PLAN_EXOARMURE.md §12 : chaque variante nommée d'un même système — 6 interfaces de
 * contrôle, 6 systèmes respiratoires, 6 communicateurs, 2 antivols... — compte séparément, comme le
 * fait le RAW lui-même).
 *
 * Taxonomie et décisions de schéma verrouillées en §12.1bis/§12.2 (PLAN_EXOARMURE.md) avant ce
 * fichier :
 *   - `family='arme'` inclut "Systèmes défensifs" (RAW explicite, SEEDEXO.md:707-709 : ces systèmes
 *     appartiennent à la catégorie Armement pour la localisation d'incident).
 *   - `category='Systèmes divers'` corrige l'en-tête source faux ("SYSTÈMES FURTIFS" répété à la
 *     ligne 789 du fichier RAW, artefact de pagination PDF — le contenu réel de ce second tableau
 *     est Antivol/Autopilote/Câble d'alimentation/Revêtement anti-radiations/Volet de
 *     sécurité/Système d'alerte, sans rapport avec la discrétion sonore).
 *   - Pas de colonne "Cibles" (Analyseurs, Calculateur de tir) : 4 lignes sur 84, jamais consommées
 *     par aucun code — le niveau/cibles fixes de ces SKU vivent dans `description`, pas une colonne.
 *   - Prix non-flat repris tel quel dans `price`+`price_modifier` (patron `ref_equipment`, déjà
 *     validé §12.1bis point 5) : "x niv.", "x (FOR x FOR)", "x BLD armure", "x cat. de l'exo".
 *
 * Descriptions volontairement courtes (garde-fous mécaniques : plafond de niveau, restriction de
 * catégorie d'exo, dépendance à un autre système) — pas la prose RAW complète. Rien ne consomme ce
 * texte aujourd'hui (aucune UI catalogue exo n'existe encore) ; l'enrichir en flaveur narrative
 * complète peut attendre qu'une telle UI soit réellement construite, plutôt que de transcrire des
 * paragraphes qui ne seront lus par personne d'ici là.
 *
 * Une incohérence source relevée en la codant, documentée plutôt que corrigée silencieusement :
 * "Générateurs défensifs micro-ondes" (SEEDEXO.md:781) affiche une Disponibilité "210 (15)" — un
 * chiffre parasite ("2") avant "10 (15)", format cohérent avec toutes les autres lignes de ce
 * tableau. Traité comme un artefact de transcription du PDF source et corrigé ici en "10 (15)".
 *
 * id laissés à gen_random_uuid() — cf. `.claude/rules/core.md`, même raisonnement que la migration
 * 252 (table jamais référencée par id ailleurs, idempotence par clé métier `name` uniquement).
 */

const EQUIPMENT = [
  // ─── family=systeme, category=Systèmes de contrôle ───
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Commandes manuelles', price: 1000, rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Commande vocale', price: 4300, rarity: '10 (15)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Visière optique', price: 4900, rarity: '10 (15)', tech_level: 'IV' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Filet neuronal', price: 9000, rarity: '5 (10)', tech_level: 'IV' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Jack neuronal', price: 14000, rarity: '5 (5)', tech_level: 'IV' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Interface neuronale de commande télépathique', price: 29000, rarity: '1 (5)', tech_level: 'V' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Interface de contrôle • Poste de pilotage', price: 4000, rarity: '20 (20)', tech_level: 'III', description: 'Exo-5 et plus seulement.' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: "Système d'assistance et de contrôle des exo-armures (SACEA)", price: 3000, rarity: '20 (20)', tech_level: 'III', description: 'Blindage IEM naturel de 5 points.' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Contrôle de pression', price: 1000, rarity: '20 (20)', tech_level: 'III', description: 'Facultatif pour les véhicules/armures de surface.' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Dispositif de diagnostic', price: 2000, rarity: '20 (20)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Stabilisateur', price: 4000, rarity: '20 (20)', tech_level: 'III', description: 'Exo-1 et plus seulement.' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Stabilisateur avancé', price: 8000, rarity: '20 (20)', tech_level: 'III', description: '+3 aux Tests de Manœuvre en perte d’équilibre, +5 pour se relever à terre.' },
  { family: 'systeme', category: 'Systèmes de contrôle', name: 'Amortisseurs de saut', price: 1000, price_modifier: "x cat. de l'exo", rarity: '20 (20)', tech_level: 'III' },

  // ─── family=systeme, category=Supports vitaux ───
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Réserve d’oxygène', duration: '24 h', price: 700, rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Réserve de secours', duration: '2 h', price: 25, rarity: '10 (15)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Fluide oxygéné', duration: '16 h', price: 300, rarity: '10 (15)', tech_level: 'III' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Filtre à air', duration: '12 h', price: 120, rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Extracteur d’oxygène', price: 4000, rarity: '5 (10)', tech_level: 'II', description: 'Double la durée d’une réserve d’oxygène couplée.' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système respiratoire • Membrane respiratoire', price: 16000, rarity: '-5 (1)', tech_level: 'III', description: 'Exo-1 et plus seulement.' },
  { family: 'systeme', category: 'Supports vitaux', name: "Dispositif d'isolation", price: 1000, rarity: '15 (20)', tech_level: 'II', description: 'Amphibie (jusqu’à -10 m) si prix doublé.' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Régulateur thermique', price: 3000, rarity: '20 (20)', tech_level: 'II', description: 'Facultatif pour les véhicules/armures de surface.' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système de filtrage hygiénique', price: 50, price_modifier: '/niv.', rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Filtre de rechange', price: 25, rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Système de recyclage des déchets', price: 500, price_modifier: '/niv.', rarity: '10 (15)', tech_level: 'III' },
  { family: 'systeme', category: 'Supports vitaux', name: 'Filtre de recyclage', price: 50, rarity: '15 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Supports vitaux', name: "Système d'alimentation", price: 500, price_modifier: '/niv.', rarity: '20 (20)', tech_level: 'II', description: '12h sans faim/soif par niveau.' },

  // ─── family=systeme, category=Systèmes d'urgence ───
  { family: 'systeme', category: "Systèmes d'urgence", name: 'Auto-patch', price: 4000, rarity: '5 (10)', tech_level: 'IV', description: 'Réparation temporaire (1-2 h) ; Blindage divisé par 2 sur la zone colmatée.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: "Dispositif d'éjection", price: 7000, rarity: '10 (15)', tech_level: 'III', description: 'Exo-2 et plus seulement, armures de surface.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: 'Disque de colmatage', price: 50, price_modifier: '/1000 m (profondeur résistée)', rarity: '15 (20)', tech_level: 'IV', description: 'Blindage divisé par 2 sur la zone colmatée.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: "Dispositif d'auto-réparation • Centrale", price: 2500, price_modifier: 'x niv. x NT', tech_level: 'Selon NT', description: 'DIS selon NT du système réparé : I=10(15), II=10(15), III=5(10), IV=1(5), V/VI=-5(1), VII=-10(-5). Nécessite un Dispositif de diagnostic.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: "Dispositif d'auto-réparation • Module annexe", price: 500, price_modifier: 'x niv. x NT', tech_level: 'Selon NT', description: 'DIS selon NT du système réparé (voir Centrale). Un module par système/arme à réparer.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: "Disp. d'assistance médicale", price: 1500, price_modifier: '/niv.', rarity: '10 (15)', tech_level: 'III', description: '5 utilisations par niveau.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: 'Systèmes « Dernière chance » • Guillotine', price: 500, rarity: '15 (20)', tech_level: 'III', description: 'Ampute le membre touché (blessure « Membre détruit » stabilisée).' },
  { family: 'systeme', category: "Systèmes d'urgence", name: 'Systèmes « Dernière chance » • Congélation', price: 2500, rarity: '5 (10)', tech_level: 'IV', description: 'Test de Constitution -2 (+2/heure de congélation) pour survivre.' },
  { family: 'systeme', category: "Systèmes d'urgence", name: 'Systèmes « Dernière chance » • Injection de drogues', price: 1000, rarity: '10 (15)', tech_level: 'III', description: 'Coma immédiat, traitement hospitalier requis.' },

  // ─── family=systeme, category=Systèmes électroniques et informatiques ───
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • ComLink', price: 500, rarity: '20 (20)', tech_level: 'II', description: 'Câble rétractable ~10 m, armure à armure.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • ComDive 200', price: 2000, rarity: '15 (20)', tech_level: 'III', description: 'Portée 500 m.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • Lénid', price: 4000, rarity: '15 (20)', tech_level: 'III', description: 'Portée 1500 m.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • Externe', price: 1000, price_modifier: '/niv.', rarity: '15 (20)', tech_level: 'II', description: 'Portée 1 km/niveau, dégradée à la Surface.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • Laser de communication', price: 4000, rarity: '5 (10)', tech_level: 'III', description: 'Portée ~800 m, ne fonctionne pas sous l’eau.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Communicateur pour armure • Haut-parleur', price: 100, rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Analyseur • Sea-Star', price: 2000, rarity: '20 (20)', tech_level: 'III', description: 'Niveau fixe 12, analyse jusqu’à 3 cibles simultanées.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Analyseur • Abyss', price: 3500, rarity: '15 (20)', tech_level: 'III', description: 'Niveau fixe 12, analyse jusqu’à 5 cibles simultanées.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Analyseur • Delta Azur', price: 5000, rarity: '15 (20)', tech_level: 'III', description: 'Niveau fixe 12, analyse jusqu’à 7 cibles simultanées.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Calculateur de tir Nemrod', price: 2500, rarity: '15 (20)', tech_level: 'III', description: 'Niveau fixe 12, jusqu’à 5 solutions de tir simultanées, Surface et sous l’eau.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Senseur tactile', price: 2000, rarity: '5 (10)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Analyseur tactile', price: 6000, rarity: '1 (5)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Senseur auditif', price: 300, price_modifier: 'x nb d’options suppl.', rarity: '15 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Senseur visuel', price: 400, price_modifier: 'x nb d’options suppl.', rarity: '10 (15)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Affichage tactique', price: 500, rarity: '10 (15)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: "Détecteur d'acquisition", price: 500, rarity: '15 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Détecteur de mines', price: 400, price_modifier: '/niv.', max_level: 15, rarity: '10 (15)', tech_level: 'III', description: 'Portée 1 km, Test/Tour avec son niveau.' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Détecteur de mouvements', price: 2000, price_modifier: '/niv.', max_level: 15, rarity: '10 (15)', tech_level: 'III', description: 'Air libre uniquement, portée base 10 m (ajustable contre niveau).' },
  { family: 'systeme', category: 'Systèmes électroniques et informatiques', name: 'Système de navigation', price: 500, price_modifier: '/niv.', rarity: '20 (20)', tech_level: 'III', description: 'Prix par niveau (marché de base) — note source ambiguë sur d’éventuelles options supplémentaires (SEEDEXO.md:499-500).' },

  // ─── family=systeme, category=Systèmes furtifs ───
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Atténuateur sonore', price: 2000, price_modifier: '/niv.', max_level: 7, rarity: '5 (10)', tech_level: 'III', description: 'Malus au Test de détection passive adverse, réduit par son Blindage électronique.' },
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Modificateur de signal acoustique', price: 2000, price_modifier: '/niv.', max_level: 15, rarity: '5 (10)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes furtifs', name: "Brouilleur d'écho", price: 3000, price_modifier: '/niv.', max_level: 7, rarity: '5 (10)', tech_level: 'III', description: 'Comme Atténuateur sonore mais contre les sonscans actifs.' },
  { family: 'systeme', category: 'Systèmes furtifs', name: "Modificateur d'écho", price: 5000, price_modifier: '/niv.', max_level: 7, rarity: '5 (10)', tech_level: 'IV' },
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Revêtement anéchoïque', price: 5000, price_modifier: "/niv. (+50% au-dessus d'exo-3)", max_level: 5, rarity: '5 (10)', tech_level: 'III', description: '-1 par niveau à toute détection active adverse.' },
  { family: 'systeme', category: 'Systèmes furtifs', name: 'Revêtement de camouflage', price: 4000, price_modifier: "(+50% au-dessus d'exo-3)", rarity: '5 (10)', tech_level: 'III', description: 'Double les malus de perception si l’armure est immobile.' },

  // ─── family=systeme, category=Systèmes divers (en-tête source corrigé, cf. commentaire en tête de fichier) ───
  { family: 'systeme', category: 'Systèmes divers', name: 'Antivol • Verrouillage', price: 300, price_modifier: '/niv.', max_level: 10, rarity: '15 (15)', tech_level: 'III', description: 'Malus à toute tentative de neutralisation ; palmaire/oculaire/code/clef/vocal cumulables.' },
  { family: 'systeme', category: 'Systèmes divers', name: 'Antivol • Reconnaissance neuronale', price: 75000, rarity: '1 (5)', tech_level: 'IV', description: 'Réputé inviolable, pas d’indice de sécurité.' },
  { family: 'systeme', category: 'Systèmes divers', name: 'Autopilote', price: 3000, price_modifier: '/niv.', max_level: 15, rarity: '10 (15)', tech_level: 'III', description: 'Chaque niveau équivaut à Manœuvre d’armure niv. 1 ; réactif en cas de perte de conscience.' },
  { family: 'systeme', category: 'Systèmes divers', name: "Câble d'alimentation", price: 500, price_modifier: '/10 m', rarity: '20 (20)', tech_level: 'II' },
  { family: 'systeme', category: 'Systèmes divers', name: 'Revêtement anti-radiations', price: 500, price_modifier: '/niv.', max_level: 25, rarity: '10 (10)', tech_level: 'III' },
  { family: 'systeme', category: 'Systèmes divers', name: 'Volet de sécurité', price: 100, price_modifier: 'x BLD armure', rarity: '10 (10)', tech_level: 'III', description: 'Sans lui, la visière est un point faible (Blindage divisé par 2).' },
  { family: 'systeme', category: 'Systèmes divers', name: "Système d'alerte", price: 100, rarity: '20 (20)', tech_level: 'II' },

  // ─── family=arme, category=Arme de contact ───
  { family: 'arme', category: 'Arme de contact', name: 'Électro-pince', damage: 'Spécial', shock: 'Spécial', price: 10000, rarity: '1 (5)', tech_level: 'II', description: 'Contact base +3 +ModDom ; en pince, Force 25 ; mode électrique 1D10 Choc/Tour +1D10 Dommages.' },
  { family: 'arme', category: 'Arme de contact', name: 'Excavateur mécanique', damage: 'Spécial', init_mod: -7, price: 7000, rarity: '10 (10)', tech_level: 'II', description: 'Contact base +3 +ModDom si utilisé comme masse.' },
  { family: 'arme', category: 'Arme de contact', name: 'Hydro-foreuse', damage: '3D10 (+3/Tr)', price: 11000, rarity: '10 (10)', tech_level: 'II', description: 'Cible immobile uniquement, inutilisable en combat, bonus jusqu’à +15.' },
  { family: 'arme', category: 'Arme de contact', name: 'Marteau-piqueur', damage: '3D10 (+1/Tr)', init_mod: -7, price: 2500, rarity: '15 (15)', tech_level: 'II', description: 'Bonus jusqu’à +10.' },
  { family: 'arme', category: 'Arme de contact', name: 'Perceuse industrielle', damage: '3D10 (+2/Tr)', init_mod: -5, price: 6000, rarity: '15 (15)', tech_level: 'II', description: 'Bonus jusqu’à +10.' },
  { family: 'arme', category: 'Arme de contact', name: 'Pince/Griffe', damage: 'Spécial', init_mod: -3, price_modifier: '100 x (FOR x FOR)', rarity: '15 (15)', tech_level: 'II', description: 'Saisie/maintien (Force propre) ou broyage progressif (+1 à +15/Tour, max = Force) ou masse (contact base +3 +ModDom).' },
  { family: 'arme', category: 'Arme de contact', name: 'Scie industrielle', damage: '4D10 (+2/Tr)', init_mod: -3, price: 7000, rarity: '15 (15)', tech_level: 'II', description: 'Bonus jusqu’à +10.' },

  // ─── family=arme, category=Lance-harpon anti-véhicule ───
  { family: 'arme', category: 'Lance-harpon anti-véhicule', name: 'Lance-harpons AV', damage: '5D10', range: '3/7/15/30 (40)', init_mod: -3, fire_mode: 'CC', price: 4000, ammo_cost: '1 (500)', rarity: '10 (15)', tech_level: 'II', description: 'Portées triplées à l’air libre.' },
  { family: 'arme', category: 'Lance-harpon anti-véhicule', name: 'Lance-harpons AV double', damage: '5D10', range: '3/7/15/30 (40)', init_mod: -3, fire_mode: 'CC', price: 6000, ammo_cost: '1 (500)', rarity: '10 (15)', tech_level: 'II', description: 'Tire 2 harpons ; +3 au Test de tir ou +1D10 aux Dommages (BP/CP). Portées triplées à l’air libre.' },
  { family: 'arme', category: 'Lance-harpon anti-véhicule', name: 'Lance-harpons AV multiple', damage: '4D10+3', range: '3/7/15/30 (40)', init_mod: -3, fire_mode: 'CC', price: 3000, ammo_cost: '1 (800)', rarity: '10 (15)', tech_level: 'II', description: '8 harpons, +5 au Test de tir (BP/CP/MP). Portées triplées à l’air libre.' },

  // ─── family=arme, category=Arme à énergie ───
  { family: 'arme', category: 'Arme à énergie', name: 'Canon à neutrons', damage: '5D10+3', range: '20/100/200/400 (600)', init_mod: -3, fire_mode: 'CC', price: 19000, ammo_cost: '10 (3 000)', rarity: '-5 (1)', tech_level: 'IV', description: 'Doit charger avant de tirer ; dégâts/portée identiques Surface et sous l’eau.' },

  // ─── family=arme, category=Systèmes défensifs (RAW : localisation d'incident = Armement) ───
  { family: 'arme', category: 'Systèmes défensifs', name: 'Champ IEM anti-torpille (champ sphère)', price: 25000, price_modifier: '/niv.', max_level: 5, rarity: '1 (5)', tech_level: 'IV', description: 'Test de panne (malus = niveau - Blindage électronique) à tout appareil électronique franchissant le champ.' },
  { family: 'arme', category: 'Systèmes défensifs', name: 'Contrôle torpille', price: 5000, price_modifier: '/niv.', max_level: 5, rarity: '1 (5)', tech_level: 'IV', description: 'Prise de contrôle d’une torpille adverse (dévier/autodestruction/rediriger).' },
  { family: 'arme', category: 'Systèmes défensifs', name: 'Générateurs défensifs électrique', damage: '2D10+3', price: 2000, rarity: '10 (15)', tech_level: 'III', description: 'Contre agression au contact ; armure naturelle (carapace) ne compte pas.' },
  { family: 'arme', category: 'Systèmes défensifs', name: 'Générateurs défensifs micro-ondes', damage: '3D10+3', price: 3500, rarity: '10 (15)', tech_level: 'III', description: 'Contre agression au contact ; armure naturelle (carapace) ne compte pas.' },
  { family: 'arme', category: 'Systèmes défensifs', name: 'Revêtement anti-infrasons', price: 5000, price_modifier: '/niv.', max_level: 5, rarity: '5 (10)', tech_level: 'IV', description: 'Armure parfaitement isolée uniquement ; -1/niveau aux attaques par infrasons.' },
  { family: 'arme', category: 'Systèmes défensifs', name: 'Système de défense Écho+', price: 3000, price_modifier: '/niv.', max_level: 5, rarity: '5 (10)', tech_level: 'IV', description: 'Malus à la solution de tir adverse, réduit par son Blindage électronique.' },
]

export const up = async (knex) => {
  await knex('ref_exo_equipment').insert(EQUIPMENT)
}

export const down = async (knex) => {
  await knex('ref_exo_equipment').whereIn('name', EQUIPMENT.map((e) => e.name)).delete()
}
