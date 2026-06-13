Manuel Technique de Référence : Système d'Exo-Armures Polaris V2

Ce document constitue l'unique source de vérité (SSOT) cartographiant les règles de gestion des armures mécanisées du livre de base (LdB) et leur implémentation technique sous protocole WebSockets pur pour le Projet Enclume. Il agit comme une extension directe du système de combat humanoïde.
1. Modèle de Données Persistant (Extensions PostgreSQL)

L'architecture isole les données spécifiques aux exo-armures dans des tables dédiées pour éviter de surcharger le schéma COMBAT_ROSTER principal. La table de référence ref_exo_templates définit les modèles commerciaux, instanciés ensuite dans EXO_ARMURE_STATE.
Schéma ref_exo_templates (Modèles de base)
JSON

{
  "template_id": "orka_mk1",
  "name": "Armure Orka",
  "category": "exo-4",
  "environment": "submarine",
  "depth_operational": 20000,
  "depth_limit": 26000,
  "depth_crush": 36000,
  "attributes": {
    "rd": -5,
    "blindage": 34,
    "exoforce": 68,
    "dmg_mod_human": 29,
    "dmg_mod_light_vehicle": -1,
    "speed_underwater": 5,
    "speed_surface": 3,
    "malus_init_underwater": -5,
    "malus_init_surface": -10
  }
}

Table Active EXO_ARMURE_STATE (Instances en cours)
Colonne	Type	Description technique
roster_id	PK, FK	Lien direct vers COMBAT_ROSTER.id.
template_id	FK	Référence au modèle de base (ex: Orka, Moloch).
integrity_structure	INT	Points de vie structurels actuels.
integrity_exosquelette	INT	État de la motorisation.
integrity_generator	INT	Composant critique (pas de jauge d'énergie, autonomie illimitée).
compteur_avaries	JSONB	Avaries accumulées (leger, moyen, grave, critique, catastrophique).
equipped_systems	JSONB	Flags des systèmes auxiliaires (Sonscan, Calculateur, etc.).
hardpoints	JSONB	Mapping de l'armement intégré (ex: {"main_droite": "id_arme", "epaule_gauche": "id_canon"}).
2. Remplacement des Attributs et Moteur de Déplacement

L'interface Zustand du client et le moteur de calcul du serveur appliquent une substitution stricte des attributs du personnage dès que l'état is_exo_piloted passe à true.
L'Exo-Force (EXF)

L'Exo-Force de la machine est totalement indépendante de la Force du pilote. Le pilote ne fait que guider les membres.

    Calcul des dommages au contact : La caractéristique de base FOR du personnage est ignorée. Le pipeline balistique utilise exclusivement le dmg_mod_human ou dmg_mod_light_vehicle du template de l'armure.

    Capacité de port : L'encombrement est calculé sur l'EXF.

La Vitesse (VIT) Absolue

L'Agilité et les compétences (Athlétisme, Hybride) du pilote n'influent plus sur le déplacement brut.

    Le token se déplace d'un nombre de mètres par tour strictement égal à la valeur speed_underwater ou speed_surface du template, selon le contexte topographique (Z Three.js).

3. Moteur d'Initiative et Limiteurs de Compétences

Les limitations mécaniques de l'armure brident les capacités du pilote. Le hook InitiativeCalculator.js intercepte la déclaration du tour.
Calcul de la Base Initiative

La formule standard est remplacée par le calcul suivant :
Initiative Base=min(Reˊaction,Manœuvre d’armure)−Malus Environnemental

    Pénalité hors-milieu : Si le milieu actuel (ex: Surface) ne correspond pas au milieu nominal de l'armure (exo_environment), le malus d'initiative (malus_init_surface) est appliqué. S'il s'agit d'une utilisation totalement inadaptée (ex: armure sous-marine exclusive à l'air libre), le malus est doublé.

    Seuil Différé : Si l'Initiative tombe à 0 ou moins, l'action est reportée au premier rang du tour de combat suivant.

Cap d'Action et Compétence

    Plafonnement global : Le niveau de compétence Manœuvre d'armure agit comme un cap strict pour toutes les compétences physiques et de combat (Tir, CaC).

    Attaque unique : L'automate d'état verrouille le nombre d'attaques à 1 par tour, interdisant les attaques multiples.

4. Pipeline de Résolution des Dommages et Incidents

Le jet de localisation classique (Tête, Torse, Bras...) est désactivé. Toute attaque réussie cible l'enveloppe globale de l'armure.
Mitigations et Avaries

Le calcul des dégâts nets s'établit via la formule :
Dommages Nets=(Dommages Bruts−Blindage)+RD

Le serveur vérifie ensuite la valeur des Dommages Nets par rapport aux seuils fixes :

    5 à 9 : Avarie Légère

    10 à 14 : Avarie Moyenne

    15 à 19 : Avarie Grave

    20 à 24 : Avarie Critique

    25 à 29 : Avarie Catastrophique (Perte immédiate de 1 point d'Intégrité Structure Maximum)

    30+ : Destruction Totale

Algorithme d'Incident

À chaque Avarie infligée, le serveur exécute un jet d'incident en tâche de fond :
Score Incident=1D10+Modificateur Avaries Cumuleˊes

Si Score Incident≥7, le système lance un 1D10 pour localiser la panne technique et met à jour l'EXO_ARMURE_STATE :

    Structure (1-2) : Brèche, risque de voie d'eau.

    Exosquelette (3-4) : Blocage, malus immédiat aux actions physiques.

    Générateur (5) : Chute de tension, perte d'accès temporaire aux systèmes auxiliaires (le générateur est une pièce d'intégrité, pas une jauge d'énergie).

    Systèmes (6-7) : Un système auxiliaire au hasard (Sonscan, Calculateur) passe en statut offline.

    Armement (8-9) : Un hardpoint au hasard est bloqué.

    Pilote (10) : Dommages physiques directs appliqués au token humain (contournement du blindage).

5. Routine Environnementale : Pression et Écrasement

Une tâche planifiée asynchrone surveille l'élévation Z (profondeur) des tokens de type submarine.

    Zone Opérationnelle : (Z <= depth_operational) — Aucun effet.

    Zone Limite : (depth_operational < Z < depth_crush) — Toutes les 10 minutes (ou X ticks de serveur), le système effectue un Test de Pression :
    Jet Profondeur=1D20+Malus Graviteˊ Avaries Actuelles

    Si Jet Profondeur>integrity_structure_actuelle, une Avarie Légère est automatiquement générée (touchant la Structure ou les Systèmes).

    Zone d'Écrasement : (Z >= depth_crush) — Destruction immédiate et mort du pilote. Priorité WS absolue (EXO_CRUSH_EVENT).
	----
	--V3 a valider---
	1. Extension du Schéma PostgreSQL (EXO_ARMURE_STATE)

Pour supporter les états dégradés, les paliers d'intégrité et les compteurs temporels (timers de fuite), la table active doit mapper ces colonnes exactes :
SQL

CREATE TABLE exo_armure_state (
    roster_id VARCHAR(255) PRIMARY KEY REFERENCES combat_roster(id),
    template_id VARCHAR(50) NOT NULL,
    
    -- Intégrité Courante vs Maximum Historique
    itg_structure_max INT DEFAULT 20,
    itg_structure_current INT DEFAULT 20,
    itg_exosquelette_max INT DEFAULT 20,
    itg_exosquelette_current INT DEFAULT 20,
    itg_generator_max INT DEFAULT 20,
    itg_generator_current INT DEFAULT 20,
    
    -- Compteurs d'Avaries Encaissées (Lignes du compteur LdB)
    avaries_legeres INT DEFAULT 0,
    avaries_moyennes INT DEFAULT 0,
    avaries_graves INT DEFAULT 0,
    avaries_critiques INT DEFAULT 0,
    avaries_catastrophiques INT DEFAULT 0,
    
    -- Gestion des Fuites/Brèches Temporelles (Structure)
    leak_timer INT DEFAULT NULL,              -- Nombre de tours restants avant avarie auto
    leak_severity VARCHAR(20) DEFAULT NULL,    -- 'LEGER', 'MOYEN', 'GRAVE', 'CRITIQUE'
    
    -- Désactivation des systèmes par membre / coupure d'énergie
    paralyzed_turns_left INT DEFAULT 0,       -- Blocage Exosquelette
    unpowered_turns_left INT DEFAULT 0,       -- Arrêt Temporaire Générateur
    system_malus_turns_left INT DEFAULT 0,    -- Micro-coupures (Malus -3)
    
    -- Équipements et Hardpoints
    isolated_systems JSONB DEFAULT '[]',      -- Liste des IDs systèmes coupés électriquement
    damaged_systems JSONB DEFAULT '{}',       -- { "system_id": { "itg_current": 15, "broken": false } }
    hardpoints JSONB DEFAULT '{}'             -- Mapping des armes
);

2. Le Pipeline de Calcul des Attributs Dynamiques

Les caractéristiques de la machine ne sont pas statiques. Le serveur doit exécuter ce pipeline de calcul matriciel à chaque tick ou déclaration d'action, en appliquant les réductions cumulatives selon les paliers d'intégrité actuels.
JavaScript

function calculateDynamicExoAttributes(template, state) {
    let exf = template.base_exoforce;
    let vit = template.base_speed_current_environment;
    let bld = template.base_blindage;
    let base_malus_manoeuvre = 0;
    let system_test_malus = 0;
    let propulseur_speed_factor = 1.0;

    // --- 2.1 PALIERS DE L'EXOSQUELETTE (p. 329) ---
    if (state.itg_exosquelette_current <= 0) {
        // Exosquelette détruit : Armure immobile
        exf = 0;
        vit = 0;
        base_malus_manoeuvre = -999; // Hardlock physique
    } else if (state.itg_exosquelette_current >= 1 && state.itg_exosquelette_current <= 5) {
        base_malus_manoeuvre = -5;
        exf = Math.floor(exf / 2);
        vit = Math.floor(vit / 2);
    } else if (state.itg_exosquelette_current >= 6 && state.itg_exosquelette_current <= 10) {
        base_malus_manoeuvre = -3;
        exf = Math.floor(exf * 2 / 3); // Diminuée d'un tiers (arrondi inf)
        vit = Math.floor(vit * 2 / 3);
    }

    // --- 2.2 PALIERS DU GÉNÉRATEUR (p. 329) ---
    if (state.itg_generator_current <= 0) {
        // Générateur HS : plus d'énergie, pas de systèmes, pas de chauffage
        exf = 0; 
        vit = 0;
        propulseur_speed_factor = 0;
    } else if (state.itg_generator_current >= 1 && state.itg_generator_current <= 5) {
        exf = Math.floor(exf / 2); // Multiplicatif si l'exo est aussi touché !
        propulseur_speed_factor = 0.5;
        system_test_malus = -5;
    } else if (state.itg_generator_current >= 6 && state.itg_generator_current <= 10) {
        propulseur_speed_factor = 2 / 3;
        system_test_malus = -3;
    }

    // --- 2.3 PALIERS DE LA STRUCTURE (p. 329) ---
    if (state.itg_structure_current <= 0) {
        bld = 0; // Aucune protection, trop fragile pour être utilisée sans risque
    } else if (state.itg_structure_current >= 1 && state.itg_structure_current <= 5) {
        bld = Math.floor(bld / 2);
    } else if (state.itg_structure_current >= 6 && state.itg_structure_current <= 10) {
        bld = Math.floor(bld * 2 / 3); // Diminué d'un tiers
    }

    return { exf, vit, bld, base_malus_manoeuvre, system_test_malus, propulseur_speed_factor };
}

Routine Automatique d'Isolation Énergétique (p. 329) :

Dès que itg_generator_current passe sous des seuils stricts, le serveur isole immédiatement X systèmes :

    Seuil 10 à 6 : Au moment où le niveau descend à 10, le système isole 1D6 + (10 - itg_actuelle) systèmes au hasard (le support vital est épargné).

    Seuil 5 à 1 : Au moment où le niveau descend à 5, et pour chaque point perdu ensuite, 2 systèmes supplémentaires sont isolés, incluant cette fois le support vital.

3. Moteur d'Initiative, Déplacement et Bridages Physiques
Calcul Restructuré de l'Initiative (Optionnel LdB p. 325)

Le calcul intercepte le pool du pilote et applique le doublement de malus contextuel :
Initiative Base=min(Reˊaction,Manœuvre d’armure)−(Malus Armure×Facteur Milieu)

    Facteur Milieu : 1 si le token évolue dans son nominal_environment. 2 s'il évolue hors-milieu (ex: armure sous-marine marchant sur la terre ferme).

    Règle du Seuil Différé : Si Initiative≤0, l'action en cours est invalidée pour le round actuel et forcée au Rang 1 du tour de combat suivant (le joueur agit alors en premier).

Gestion Strictes des Mouvements et Exceptions (p. 324-325)

    Contraintes "Hors-Milieu" (p. 324) : Si le token est hors-milieu, l'automate d'état injecte les flags allure = LENTE et can_evade = false (interdiction stricte d'esquiver ou de sauter).

    L'Exception des Armures Assistées (p. 325) : Si la catégorie de l'armure est exo-alpha ou exo-0 (et configurée sans exosquelette lourd), on n'utilise pas la compétence Manœuvre d'armure. Le niveau du pilote n'est donc pas plafonné par l'armure pour ses jets physiques ou d'attaque.

    Malus Systémiques Omis :

        Saisie / Lutte (p. 326) : Malus cumulatif appliqué à l'attaque : exo-2/3 : -3, exo-4 : -5, exo-5/6 : -7, exo-omega : -10.

        Armure à Terre (p. 327) : À l'air libre, se redresser exige un jet de Manœuvre d'armure modifié par : exo-1 (+5), exo-2 (+3), exo-3 (0), exo-4 (-3), exo-5 (-5). Sous l'eau, ce test n'est déclenché que si l'armure n'a aucun propulseur ni palmes fonctionnels.

4. Pipeline des Dégâts, Incidents et Cascades Temporelles
Résolution des Seuils d'Avarie (p. 326)

Le calcul du serveur applique :
Dommages Nets=(Dommages Bruts−Blindage Dynamique)+RD

Le dommage net est converti en type d'Avarie (5=Légère, 10=Moyenne, 15=Grave, 20=Critique, 25=Catastrophique, 30+=Destruction).

    Avarie Critique (20) & Catastrophique (25) : Déclenche instantanément itg_structure_max -= 1.

Algorithme de Résolution des Incidents (p. 326-328)

À chaque avarie, jet de dé : Score = 1D10 + Modificateur_Avarie (Moyenne : +2, Grave : +4, Critique : +6, Catastrophique : +8).
Si Score≥7, on lance 1D10 pour la localisation, puis on applique l'effet exact du palier de Score obtenu :
Localisation 1-2 : Structure (Pertes d'étanchéité temporelles)

Le serveur applique un timer bloquant. Si le joueur ne réussit pas une action de colmatage avant l'expiration, les dégâts s'automatisent :

    Score 7-10 (Microfissures) : leak_timer = 10. À expiration, subit 1 Avarie légère automatique par tour.

    Score 11-13 (Fêlure) : leak_timer = 5. itg_structure_current -= 1 (temporel). À expiration, 1 Avarie moyenne par tour.

    Score 14-16 (Fêlure critique) : leak_timer = 2. itg_structure_current -= 2 (temporel). À expiration, 1 Avarie grave par tour.

    Score 17-18 (Brèche) : leak_timer = 1. itg_structure_current -= 3 (temporel). À expiration, 1 Avarie critique par tour.

Localisation 3-4 : Exosquelette (Blocages physiques)

    Score 7-10 : 1 membre au hasard (1D4) est bloqué jusqu'à la fin du tour. itg_exosquelette_current -= 1.

    Score 11-13 : 1 membre bloqué pendant 1D6+1 tours. itg_exosquelette_current -= 2.

    Score 14-16 (Blocage général) : paralyzed_turns_left = 2 (Armure paralysée). itg_exosquelette_current -= 3.

    Score 17-18 (Blocage général aggravé) : paralyzed_turns_left = 1D6+2. itg_exosquelette_current -= 5 ET itg_exosquelette_max -= 1.

Localisation 5 : Générateur (Chutes de tension)

    Score 7-10 : system_malus_turns_left = 1 (Malus de -3 à toutes les actions liées aux systèmes). itg_generator_current -= 1.

    Score 11-13 : system_malus_turns_left = 1D6+1 (Malus -3). itg_generator_current -= 2.

    Score 14-16 (Arrêt temporaire) : unpowered_turns_left = 2 (Armure totalement inutilisable). itg_generator_current -= 3.

    Score 17-18 (Arrêt temporaire aggravé) : unpowered_turns_left = 1D6+2. itg_generator_current -= 5 ET itg_generator_max -= 1.

Localisation 10 : Pilote (Contrecoups et Éclats)

    Score 7-10 : Le pilote encaisse directement 2D10 points de Dommages de Choc.

    Score 11-13 / 14-16 / 17-18 : Le pilote encaisse respectivement 1D10 / 2D10 / 3D10 points de Dommages physiques directs (outrepasse le blindage de la machine ; réductible uniquement si le pilote porte une armure personnelle légère de catégorie A à l'intérieur).

5. Protocole de Destruction Majeure (30+ Dégâts)

Dès qu'une attaque génère ≥30 points de dommages nets, la destruction de l'enveloppe est enclenchée via une séquence stricte (p. 327) :
JavaScript

function executeDestructionProtocol(state, pilot, netDamage, environment) {
    // 1. Forcer la structure à 0
    state.itg_structure_current = 0;
    
    // 2. Gestion de l'usure négative (p. 327)
    let overflow = netDamage - 30;
    let negativeSubdivisions = Math.floor(overflow / 3);
    state.itg_structure_current -= negativeSubdivisions; // Enfoncement dans les niveaux négatifs pour corser les réparations

    // 3. Déclenchement automatique des incidents résiduels (p. 327)
    let incidentTranches = Math.floor(overflow / 5);
    for (let i = 0; i < incidentTranches; i++) {
        // Jet d'incident forcé à +8 sur un élément au hasard (hors Structure/Pilote)
        triggerForcedIncident(state, { modifier: 8, exclude: ['STRUCTURE', 'PILOTE'] });
    }

    // 4. Test du Système de Survie "Dernière Chance"
    if (state.equipped_systems.has("GUILLOTINE")) {
        let hitLocationHuman = rollHumanLocation();
        if (hitLocationHuman === "BRAS" || hitLocationHuman === "JAMBE") {
            return { pilot_alive: true, status: "EJECTED_WITH_AMPUTATION" };
        }
    } else if (state.equipped_systems.has("CONGELATION") || state.equipped_systems.has("INJECTION")) {
        return { pilot_alive: true, status: "STABILIZED_IN_CRYO" };
    }

    // 5. Résolution de la mort environnementale directe
    if (environment === "SUBMARINE" || environment === "SPACE") {
        return { pilot_alive: false, status: "IMPLOSION_INSTANTANEE" };
    } else {
        // À l'air libre : Le pilote prend le contrecoup brut (1D10 + overflow)
        let pilotDamage = rollDice("1D10") + overflow;
        applyDamageToHuman(pilot, pilotDamage);
        return { pilot_alive: pilot.hp > 0, status: "CRUSHED_BY_OVERFLOW" };
    }
}

6. Maintenance et Formules de Réparation (p. 328)

La remise en état exige deux étapes distinctes via des jets de dés spécifiques :
6.1 Effacement des cases du Compteur d'Avaries

    Compétence : Mécanique (Exo-armures).

    Malus cumulatif d'encombrement des dégâts : Chaque case cochée sur la ligne en cours au-dessus de la première applique un malus cumulatif de -2 au test.

    Résultat critique : Une Catastrophe au dé ajoute immédiatement une case d'Avarie supplémentaire sur la ligne.

6.2 Restauration de l'Intégrité des pièces (p. 328)

Chaque élément doit être traité individuellement avec sa compétence métier dédiée :

    Structure, Exosquelette, Générateur : Mécanique (Exo-armures).

    Systèmes auxiliaires : Électronique.

    Armement / Hardpoints : Armurerie.