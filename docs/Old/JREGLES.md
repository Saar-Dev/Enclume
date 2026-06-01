# JOURNAL_REGLES.md — Source de Vérité Mathématique (Polaris 3.1)

> **Statut :** INITIALISÉ
> **Objectif :** Centraliser les modificateurs de combat pour l'automatisation de la Résolution (3D20).

## 1. Modificateurs de Contexte
Ces modificateurs s'appliquent au jet d'attaque en fonction de la situation de base.
* **Action précipitée :** -5 (Confirme notre règle d'Initiative)
* **Cible immobile :** +3
* **Cible en mouvement :** -2 à -5 (À l'appréciation du MJ ou calculé auto selon la stat de mouvement)
* **Attaquant en mouvement :** -2 à -5

## 2. Modificateurs de Portée (Distance)
Calculé automatiquement par le VTT (Raycast / Mesure) par rapport aux stats de l'arme.
* **Bout portant (< 1m) :** +5
* **Courte (< 1/4 Portée) :** +0
* **Moyenne (< 1/2 Portée) :** -2
* **Longue (< Portée max) :** -4
* **Extrême (< 1.5x Portée) :** -8

## 3. Modes de Tir & Munitions
Gestion conjointe du bonus de touche et de la consommation (table `char_weapons`).
* **Coup par Coup (CpC) :** +0 au jet | Coût : 1 munition
* **Rafale Courte (RC) :** +2 au jet | Coût : 3 munitions
* **Rafale Longue (RL) :** +5 au jet | Coût : 10 munitions
* **Tir de suppression :** Touche une Zone | Effet : -5 au jet d'esquive des cibles.

## 4. Modificateurs de Couverture
S'applique comme un malus au jet de l'attaquant (ou modifie le seuil, selon l'implémentation).
* **Légère :** -2
* **Partielle :** -4
* **Importante :** -6
* **Totale :** Impossible

JOURNAL_REGLES_POLARIS_V1 — Source de Vérité Canon
Objectif : Centraliser les règles de combat de Polaris 3.1 pour l'implémentation du VTT, en priorité absolue sur tout code existant.

1. Modificateurs de Jet de Tir (Contexte)
Situation
Modificateur
Notes
Action précipitée
-5
Donne +3 en Initiative
Cible immobile
+3


Cible en mouvement
-2 à -5
Selon la vitesse
Attaquant en mouvement
-2 à -5


Tir instinctif (hanche)
-5
Pas de préparation requise
Tir avec main non-directrice
Réussite / 2
Si deux armes utilisées

2. Modificateurs de Portée
Palier
Distance
Modificateur
Bout portant
< 1m (ou 2m pompe)
+5
Portée Courte
< 1/4 Portée
+0
Portée Moyenne
< 1/2 Portée
-2
Portée Longue
< Portée Max
-4
Portée Extrême
< 1.5x Portée
-8

3. Modes de Tir Automatique
Condition : Compétence limitée par "Tir Automatique".
Rafale Courte (3 balles) : Choix entre +3 au Test OU +5 aux dommages (portée courte/bout portant uniquement).
Rafale Longue (5-20 balles) : Action Exclusive. +2 Test ET +2 dommages par groupe de 5 balles tirées (dégâts à courte portée uniquement).
Tir de Suppression : Zone de base 3m. Pour chaque groupe de 5 balles : +3m de zone OU +2 au Test. Les cibles font un Test de Chance (modifié par la réussite du tireur).
4. Localisation et Visée Précise (1D20)
Zone
Jet 1D20 (Distance)
Malus pour Viser
Tête
1 - 2
-7
Corps
3 - 11
-3
Bras Droit
12 - 14
-7
Bras Gauche
15 - 17
-7
Jambe Droite
18 - 19
-5
Jambe Gauche
20
-5

5. Résolution des Dommages
Formule : Dégâts Nets = (Dégâts Arme + Modificateur de Réussite) - (Armure Loc + Résistance Cible)
Blessures : Une blessure augmente d'un niveau par tranche de 5 points de dommages nets.
Boucliers : Au contact, malus à l'attaquant (-3 à -7). À distance, protection fixe sur des localisations spécifiques.
Champs de force : Protection globale sur toutes les localisations.
6. Cas Particuliers
Fusil à Pompe (Gerbe)
Bout portant (<2m) : +1D10 dommages.
Portée Moyenne : -1D10 dommages.
Portée Longue : -2D10 dommages + Test de Chance pour la cible.
Portée Extrême : -3D10 dommages + Test de Chance (+5) pour la cible.

📜 Règles de Combat Polaris 3.1 — Source de Vérité Canon
(Sources : JOURNAL_REGLES.md + JOURNAL_REGLES_POLARIS_V1)

🎯 1. Modificateurs de Contexte (Jet d'Attaque)
(Appliqués au jet de tir en fonction de la situation.)


  
    
      Situation
      Modificateur
      Notes
    
  
  
    
      Action précipitée
      -5
      Donne +3 en Initiative.
    
    
      Cible immobile
      +3
      
    
    
      Cible en mouvement
      -2 à -5
      Selon la vitesse (à l'appréciation du MJ ou calculé auto).
    
    
      Attaquant en mouvement
      -2 à -5
      
    
    
      Tir instinctif (hanche)
      -5
      Pas de préparation requise.
    
    
      Tir avec main non-directrice
      Réussite / 2
      Si deux armes utilisées.
    
  



📏 2. Modificateurs de Portée
(Calculés automatiquement par le VTT via Raycast/Mesure, par rapport aux stats de l'arme.)


  
    
      Palier
      Distance
      Modificateur
      Notes
    
  
  
    
      Bout portant
      < 1m (ou 2m pour pompe)
      +5
      
    
    
      Portée courte
      < 1/4 Portée
      +0
      
    
    
      Portée moyenne
      < 1/2 Portée
      -2
      
    
    
      Portée longue
      < Portée Max
      -4
      
    
    
      Portée extrême
      < 1.5x Portée
      -8
      
    
  



🔫 3. Modes de Tir & Munitions
(Gestion conjointe du bonus de touche et de la consommation.)
3.1 Modes de Tir (Coup par Coup)


  
    
      Mode
      Bonus au Jet
      Coût (Munitions)
      Notes
    
  
  
    
      Coup par Coup (CpC)
      +0
      1
      
    
    
      Rafale Courte (RC)
      +2
      3
      OU +5 aux dégâts (portée courte/bout portant uniquement).
    
    
      Rafale Longue (RL)
      +5
      10
      Action Exclusive. +2 aux dégâts par groupe de 5 balles (dégâts à courte portée uniquement).
    
    
      Tir de suppression
      -
      -
      Touche une Zone (3m de base). Effet : -5 au jet d'esquive des cibles.
    
  


3.2 Rafales Automatiques (Condition : Compétence "Tir Automatique" requise)


  
    
      Mode
      Bonus au Test
      Bonus aux Dégâts
      Coût
      Conditions
    
  
  
    
      Rafale Courte (3 balles)
      +3 au Test OU +5 aux dégâts
      -
      3
      Portée courte/bout portant uniquement.
    
    
      Rafale Longue (5-20 balles)
      +2 au Test
      +2 aux dégâts par groupe de 5 balles
      5-20
      Dégâts à courte portée uniquement.
    
    
      Tir de Suppression
      -
      -
      5+
      Zone = 3m + 3m par groupe de 5 balles OU +2 au Test. Les cibles font un Test de Chance (modifié par la réussite du tireur).
    
  



🎯 4. Localisation et Visée Précise (1D20)
(Détermination de la localisation touchée via un jet de 1D20.)


  
    
      Localisation
      Jet 1D20
      Malus pour Viser
    
  
  
    
      Tête
      1 - 2
      -7
    
    
      Corps
      3 - 11
      -3
    
    
      Bras Droit
      12 - 14
      -7
    
    
      Bras Gauche
      15 - 17
      -7
    
    
      Jambe Droite
      18 - 19
      -5
    
    
      Jambe Gauche
      20
      -5
    
  



🛡️ 5. Modificateurs de Couverture
(Appliqués comme malus au jet de l'attaquant ou modification du seuil.)


  
    
      Type de Couverture
      Modificateur
      Notes
    
  
  
    
      Légère
      -2
      
    
    
      Partielle
      -4
      
    
    
      Importante
      -6
      
    
    
      Totale
      Impossible
      
    
  



⚔️ 6. Résolution des Dégâts
6.1 Formule de Base
text
Copier

Dégâts Nets = (Dégâts Arme + Modificateur de Réussite) - (Armure Loc + Résistance Cible)




Blessures : Une blessure augmente d'un niveau par tranche de 5 points de dégâts nets.
Boucliers :

Au contact : Malus à l'attaquant (-3 à -7).
À distance : Protection fixe sur des localisations spécifiques.

Champs de force : Protection globale sur toutes les localisations.
6.2 Cas Particuliers
Fusil à Pompe (Gerbe)


  
    
      Portée
      Modificateur Dégâts
      Effet Supplémentaire
    
  
  
    
      Bout portant (<2m)
      +1D10
      
    
    
      Portée Moyenne
      -1D10
      
    
    
      Portée Longue
      -2D10
      Test de Chance pour la cible.
    
    
      Portée Extrême
      -3D10
      Test de Chance +5 pour la cible.
    
  1. Séquence de Résolution (Le "Flux")Le système ne lance pas un "tas de dés" informe, mais suit cette cascade logique :Test de Touche (1D20) : Comparé au Seuil Final (Compétence + Attribut + Modificateurs de contexte).Modificateurs : Portée (+5 à -8), Mode de Tir (Rafale +3/+2), Situation (Mouvement, Précipitation -5).Si Succès (et seulement si) : Lancement simultané de :Localisation (1D20) : Détermine la zone (Tête 1-2, Corps 3-11, etc.).Dégâts (Dés de l'arme) : Ex: 2D6+4.2. Calcul des Dégâts NetsLe calcul doit être automatisé en interrogeant la fiche de la cible (UUID) :$$Dégâts_{nets} = (Dmg_{arme} + Mod_{succès}) - (Armure_{loc} + Résistance_{cible})$$Seuils de Gravité : Tranches de 5 (5: Léger, 10: Moyen, 15: Grave, 20: Critique, 25: Mortel, 30: Mort).Note : La gestion de l'état de santé est déléguée au module existant (Chantier 10).3. Spécificités des Modes de TirModeMunitionsBonus / EffetCoup par Coup1StandardRafale Courte3Choix : +3 Touche OU +5 Dégâts (si portée courte)Rafale Longue5-20Progressif : +2 Touche & +2 Dégâts par tranche de 5 ballesSuppressionVar.Zone de 3m+. Réduit la Chance des cibles (Test de Chance vs Succès du tireur)4. Assets Techniques PrêtsStructure SQL : Table ref_equipment validée (colonnes fire_mode, ammo_count, location, etc.).Fiche Perso : CHARACTER.md fournit les algorithmes de calcul d'Attributs et de Compétences.Interface : Le SVG de la silhouette (SilhouettePanel.jsx) est prêt à recevoir les IDs de localisation pour l'affichage visuel des impacts.

💾 ARCHIVE INTERNE : ÉTAT DU SYSTÈME (POLARIS 3.1)I. Le "Core Engine" (Mécanique de Résolution)Séquence de Dés : 1.  SuccessCheck : 1D20 vs Seuil (Attr + Comp + Mods).2.  Outcome : Si Succès, calcul de la Marge (Seuil - Dé).3.  Conversion : Marge $\rightarrow$ Modificateur de Réussite (via la table de conversion externe indexée).4.  Resolution : 1D20 (Localisation) + Dés de Dégâts simultanés.Équation Finale : Dégâts Nets = (Dmg Arme + Mod Réussite) - (Armure Loc + Résistance Cible).II. La "Timeline" (Flux d'Initiative)Phase A (Annonces) : Ordre Croissant (Basse Init $\rightarrow$ Haute Init). Génération de "Ghosts" (intentions) visibles par tous (Broadcast obligatoire).Phase B (Action) : Ordre Décroissant (Haute Init $\rightarrow$ Basse Init). Transformation des intentions en faits.III. La "Source de Vérité" (Règles Spécifiques)Modes de Tir : Rafale courte (Choix +3 Touche / +5 Dégâts), Rafale longue (Progressif par 5 balles), Suppression (Test de Chance cible).Armes de Zone : Pompe (dispersion D10 par palier), Lance-flammes (Dégâts continus, ignore 50% d'armure).État de Santé : Seuils de 5 en 5. Malus non-cumulatifs (seule la blessure la plus grave compte). Mort/Membre détruit à 30.IV. Architecture Technique (Data)SQL : Schéma ref_equipment complet (Familles, stats H/V, modes de tir, munitions, localisations).Fiche : Intégration des calculs d'attributs et de compétences via CHARACTER.md.UI : Mapping SVG fait pour SilhouettePanel.jsx.
