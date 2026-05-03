📘 FEATURE SPEC v3 — Système de dés animés déterministes (Overlay)

    Statut : Prêt pour implémentation
    Objectif : Résolution visuelle déterministe, fluide, sans moteur physique lourd.

1. 🎯 PRINCIPE FONDAMENTAL (Le "Backtracking")

Le résultat n’est pas une conséquence de l’animation. L’animation est une mise en scène du résultat.
Puisque le serveur dicte que le dé doit atterrir sur "15", le client ne "lance" pas le dé au hasard. Il définit la rotation finale (face 15 vers le haut) et génère la trajectoire à l'envers (Backtracking) en y injectant des perturbations basées sur le seed pour simuler le chaos.

    Garantie : Aucun "glitch" ou saut d'image sur la dernière frame. L'atterrissage est mathématiquement certain.

2. 🎲 PÉRIMÈTRE & RÈGLES MÉTIER

    Dés supportés : D4, D6, D8, D10, D12, D20.

    Le D100 (Cas spécifique) : Traité visuellement comme deux dés D10 distincts (un dé des dizaines avec une texture "00, 10, 20...", un dé des unités classique). Le serveur enverra une demande pour 2 dés lorsqu'un D100 est requis.

    Multi-dés : Max 6 dés simultanés.

    Physique : Interdite. Simulation par splines et interpolations.

    Déterminisme : Math.random() est strictement interdit. Utilisation d'un PRNG (Pseudo-Random Number Generator) initialisé par le seed fourni par le serveur.

3. 🛣️ GESTION DES COLLISIONS (Les "Couloirs")

Pour éviter que les dés ne se traversent (clipping) sans utiliser de moteur physique, l'écran est divisé en N couloirs (lanes) invisibles, calculés dynamiquement selon le nombre de dés jetés.

    Mécanique : Si 3 dés sont jetés, l'écran est divisé en 3 colonnes. Le dé #1 naît et meurt dans le couloir 1. Ses rebonds (X, Z) sont contraints (clampés) aux limites de son couloir.

    Résultat : Les trajectoires peuvent être chaotiques sur l'axe Y (hauteur) et Z (profondeur), mais l'axe X (gauche/droite) est sécurisé. Zéro collision garantie.

4. 🎬 LA MATHÉMATIQUE DE L'ANIMATION

L'animation complète d'un dé dure entre 600ms et 900ms. Elle est générée par l'équation suivante, qui mélange l'interpolation sphérique (SLERP) vers la cible et du bruit pseudo-aléatoire (Simplex Noise ou PRNG) s'estompant avec le temps.

La rotation R à un instant t est calculée via la formule suivante (où E(t) est une courbe d'Easing allant de 0 à 1) :
R(t)=slerp(Rstart​,Rtarget​,E(t))+noise(seed,t)⋅(1−E(t))

Les 3 phases visuelles (Timeline) :

    Launch & Bounce (0 - 400ms) : Mouvement parabolique avec rebonds. Le bruit chaotique (noise) est au maximum. Le dé tourne frénétiquement.

    Slow & Align (400 - 700ms) : Le dé touche le "sol". L'influence du bruit tombe à 0. L'interpolation (slerp) prend le dessus pour forcer l'alignement de la face targetRotation.

    Hesitation (700 - 900ms) : Oscillation mineure autour de l'axe cible (wobble) pour donner du poids au dé avant la stabilisation parfaite. C'est l'étape clé de la crédibilité.

5. 🖱️ CYCLE DE VIE UX (Overlay)

L'overlay contenant le Canvas 3D des dés est monté par-dessus la battlemap.

    Nouveau Jet : Si un jet est en cours d'affichage et qu'un nouveau jet est demandé par le serveur, l'animation précédente est instantanément détruite et remplacée par la nouvelle (Pas de file d'attente visuelle).

    Disparition : Le rendu reste figé sur le résultat final indéfiniment, jusqu'à ce que l'utilisateur clique n'importe où sur l'overlay. Le clic déclenche le démontage du composant.

    Transparence : Le fond de l'overlay est légèrement assombri (ex: rgba(0,0,0, 0.4)) pour focus l'attention, mais la carte reste visible derrière.

6. 🏗️ ARCHITECTURE CONSOLIDÉE (Bonnes Pratiques React/R3F)

Au lieu de 6 fichiers épars, l'architecture est recentrée sur les patterns modernes de React et Three.js :

    DiceOverlay.jsx (Le conteneur) : Gère la présence de l'overlay, l'état d'affichage (clic pour fermer), et monte le <Canvas>.

    DiceRoller.jsx (L'Orchestrateur R3F) : Composant interne au Canvas. Reçoit le payload (résultats, seed). Calcule les couloirs (lanes) et map un composant <DiceMesh> par dé.

    DiceMesh.jsx (Le rendu et l'animation) : Contient la géométrie du dé. Utilise le hook useFrame de R3F pour calculer sa position/rotation à chaque frame selon la formule mathématique en fonction du temps écoulé (timestamp).

    utils/diceMath.js (La logique pure) : Fichier de fonctions pures (hors React) contenant le PRNG, les dictionnaires de rotations cibles (getRotationForFace(type, face)), et la génération de trajectoire. Totalement testable unitairement (Jest/Vitest).

    hooks/useDiceAudio.js (Le son) : Hook React qui observe l'axe Y du dé dans le useFrame. Quand Y atteint le niveau du sol avec une vélocité négative, il joue un son d'impact depuis un pool audio.

7. 🔌 INTERFACE SERVEUR (Payload Attendu)

Le serveur mâche le travail pour le client, notamment pour le D100.
JSON

{
  "rollId": "uuid-456",
  "dice": ["d20", "d10_tens", "d10"], 
  "results": [15, 70, 3],
  "seed": 918273,
  "timestamp": 1710000000000
}

(Dans cet exemple, un D20 a été lancé avec un D100 en même temps. Le serveur a décomposé le D100 en d10_tens et d10 pour simplifier le mapping des modèles 3D côté client).