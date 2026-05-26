# Dice System — IA Handoff / Technical Spec

## OBJECTIF

Créer un système de dés 3D déterministe pour VTT.

Le serveur décide du résultat.
Le client anime uniquement.

Aucune physique réelle lourde.
Aucune détection runtime de face visible.

Le système doit être :

* déterministe
* réseau-safe
* multi-utilisateur
* React/R3F compatible
* basé sur modèles `.glb`
* extensible.

---

# STACK

## Frontend

* React
* React Three Fiber
* Three.js
* @react-three/drei
* GLTFLoader

## Backend

* Python
* WebSocket
* PostgreSQL

## Référence moteur

Base technique recommandée :

* dice-box-threejs

Objectif :

* réutiliser logique d’animation
* réutiliser logique déterministe
* remplacer leurs meshes internes par nos `.glb`.

---

# MODÈLES 3D

## Fichiers disponibles

```text
D4.glb
D6.glb
D8.glb
D10.glb
D12.glb
D20.glb
D100.glb
```

Tous les fichiers :

* déjà UV unwrap
* déjà texturés
* déjà prêts Three.js.

Le runtime NE DOIT PAS :

* générer des UV
* générer des textures
* générer des meshes procéduraux.

---

# CAS SPÉCIAL : D100

Le D100 est visuellement :

```text
D10 dizaines + D10 unités
```

Exemple :

```text
70 + 3 = 73
```

Le serveur doit envoyer :

```json
{
  "dice": ["d10_tens", "d10"],
  "results": [70, 3]
}
```

---

# PRINCIPE FONDAMENTAL

Le système NE détecte PAS la face visible.

Le système FORCE une rotation connue.

Pipeline réel :

```text
résultat serveur
→ lookup quaternion cible
→ animation
→ interpolation
→ lock final
```

PAS :

```text
physique
→ lecture face visible
→ résultat
```

---

# COMMENT LE SYSTÈME SAIT QUELLE FACE AFFICHER

Chaque dé possède un mapping :

```js
FACE_ROTATIONS
```

Exemple :

```js
const D20_ROTATIONS = {
  1: quaternionA,
  2: quaternionB,
  ...
  20: quaternionT
}
```

Quand le serveur dit :

```text
résultat = 17
```

Le moteur applique :

```js
mesh.quaternion.copy(
  D20_ROTATIONS[17]
)
```

Donc :

* la bonne face devient visible
* sans détection runtime.

---

# COMMENT OBTENIR LES ROTATIONS

Dans Blender :

Pour chaque face :

1. orienter la face vers le haut
2. lire la rotation
3. exporter quaternion/euler
4. remplir FACE_ROTATIONS.

Ces rotations doivent être hardcodées.

---

# ARCHITECTURE REACT

```text
DiceOverlay
  → DiceRoller
      → DiceMesh
```

---

# RESPONSABILITÉS

## DiceOverlay

Responsable :

* overlay UI
* ouverture/fermeture
* fond assombri
* clic fermeture.

---

## DiceRoller

Responsable :

* recevoir payload serveur
* calculer lanes
* créer DiceMesh
* orchestrer animation.

---

## DiceMesh

Responsable :

* charger `.glb`
* appliquer animation
* gérer quaternion cible
* interpolation finale.

---

# FLOW SERVEUR → CLIENT

## Payload attendu

```json
{
  "rollId": "uuid-456",
  "dice": ["d20", "d10_tens", "d10"],
  "results": [15, 70, 3],
  "seed": 918273,
  "timestamp": 1710000000000
}
```

---

# ANIMATION

## Durée

```text
600ms → 900ms
```

---

# PHASES

## 1. Launch/Bounce

```text
0 → 400ms
```

* rotations chaotiques
* bruit maximum
* déplacement parabolique.

---

## 2. Slow/Align

```text
400 → 700ms
```

* réduction progressive du bruit
* slerp vers quaternion cible.

---

## 3. Hesitation

```text
700 → 900ms
```

* wobble léger
* stabilisation finale.

---

# FORMULE D’ANIMATION

```text
R(t)=slerp(Rstart,Rtarget,E(t))
+ noise(seed,t)*(1-E(t))
```

Le résultat final doit être mathématiquement garanti.

---

# PHYSIQUE

Physique complète interdite.

Pas de :

* Rapier full-sim
* Cannon résultat réel
* détection collision complexe.

Le système utilise :

* interpolation
* splines
* bruit pseudo-aléatoire.

---

# RNG

Interdiction stricte de :

```js
Math.random()
```

Utiliser :

* PRNG seedé.

Le seed serveur sert uniquement à :

* varier animation
* éviter répétition visuelle.

Le seed ne décide PAS le résultat.

---

# LANES

Pas de collision réelle entre dés.
L’écran est découpé en couloirs :

```text
lane 1
lane 2
lane 3
...
```

Chaque dé reste dans son couloir.

Objectif :

* éviter clipping
* éviter moteur physique lourd.

---

# UX OVERLAY

## Nouveau jet

Toute animation en cours est détruite.
Pas de queue.

---

## Fin animation

Le résultat reste affiché jusqu’au clic utilisateur.

---

## Fond

Overlay semi-transparent :

```css
rgba(0,0,0,0.4)
```

---

# CODE EXISTANT À CONSERVER

Conserver :

* DicePanel
* DiceRoller
* orchestration React
* easing
* interpolation quaternion
* système lanes
* websocket
* logique overlay.

---

# CODE À SUPPRIMER

Supprimer progressivement :

* géométrie procédurale
* UV runtime
* CanvasTexture
* atlas dynamiques
* overlays HTML chiffres
* génération de meshes.

Les `.glb` remplacent tout cela : ATTENTION : quel est leur emplacement ? serveur minIO
