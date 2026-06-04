# PLAN_STATUT — Système de statuts sur les tokens
> Créé : Session 74 (2026-06-03)
> Source LdB : p.237 (Choc), p.523 (Arts martiaux)

---

## 1. Contexte et scope V1

**Ce que ce sprint apporte :**
- Badges de statut visuels sous le nom des tokens (15 statuts, SVGs prêts)
- Option de campagne `status_effects_mode` (icône seule ou effets mécaniques)
- Deux statuts mécaniquement actifs : `stunned` et `unconscious` (déclenchés par le Test de Choc)
- Menu clic sur token pour ajouter/retirer des statuts (GM + propriétaire)

**Ce que ce sprint ne fait PAS :**
- Pas d'expiration automatique — retrait manuel uniquement
- Pas d'effets mécaniques pour les 13 autres statuts (affiché visuellement, inerte en code)
- Pas de durée LdB (table p.237 bas de page) — reporté V2

---

## 2. Assets SVG

**Emplacement :** `docs/Character/Statuts/` — 15 fichiers présents.

**Deux typos à corriger au moment du sprint :**
| Fichier actuel | Doit devenir |
|---|---|
| `axphyxia.svg` | `asphyxia.svg` |
| `hypodermia.svg` | `hypothermia.svg` |

**Destination runtime :** copier dans `client/public/statuts/` pour être servis statiquement. Usage : `<img src="/statuts/stunned.svg">` dans les badges `<Html>` drei.

**Catégories et couleurs (du mockup `Status innacheve.html`) :**
| Catégorie | Couleur | Statuts |
|---|---|---|
| entrave (contrôle) | `#d8a838` ambre | grappled, restrained, off_balance |
| dot (dégâts continus) | `#d84838` rouge | burning, acid, asphyxia, decompression, electrocuted |
| sens (perception/mental) | `#9858c8` violet | stunned, unconscious, blinded |
| chronique (long terme) | `#38a8c8` cyan | hypothermia, infected, poisoned, irradiated |

---

## 3. Prérequis — Sprint Interface Token (AVANT ce sprint)

**Problème actuel :** les tokens PJ/PNJ n'ont aucun menu clic. Le `RadialMenu` n'existe que pour les entités de décor. `onDoubleClick` sur un token ouvre la fiche personnage.

**Ce qu'il faut construire d'abord :**

### 3a. Menu contextuel token (right-click ou clic long)

Un menu 2D HTML (pas Three.js) qui apparaît au clic droit sur un token en session.

**Déclencheur :** `onContextMenu` sur le `<group>` dans `TokenMesh` → `e.preventDefault()` + callback vers `SessionPage` → state `tokenContextMenu { tokenId, x, y }`.

**Contenu du menu :**
- Ligne d'identité (nom du personnage + avatar miniature)
- Section "Statuts actifs" (liste des badges avec bouton × pour retirer — visible GM + propriétaire)
- Section "Ajouter un statut" (grille des 15 icônes — visible GM uniquement)
- Fermeture au clic extérieur / Échap

**Visibilité des actions :**
| Action | Qui peut l'effectuer |
|---|---|
| Voir les statuts actifs | Tous |
| Retirer un statut | GM + propriétaire du token |
| Ajouter un statut | GM uniquement |

**Propriétaire :** `token.character_id → characters.user_id === socket.user.id`

### 3b. Transport WS

Deux nouveaux events pour la gestion des statuts (à ajouter dans `shared/events.js`) :
```
COMBAT_STATUS_ADD    — client (GM) → serveur : { tokenId, statusCode }
COMBAT_STATUS_REMOVE — client (GM ou owner) → serveur : { tokenId, statusCode }
```
Broadcast en room → tous les clients mettent à jour le token dans `tokenStore`.

**Stockage :** extension du JSONB `combat_roster.state_character` :
```json
{ "statuses": ["stunned", "burning"] }
```
Hors combat : `tokens.state_character JSONB` à ajouter (ou table `token_statuses` simple). À décider au sprint.

---

## 4. Affichage des badges (dans ce sprint)

**Position :** juste en dessous du nom du token, à l'intérieur du `<Billboard>`.

Le label est à `position={[0, 2.5, 0]}`. Les badges s'affichent via `<Html>` drei à `position={[0, 2.1, 0]}`.

**Rendu :** rangée horizontale de pastilles hexagonales (Variante A du mockup). Chaque pastille = `<img>` du SVG correspondant, 16×16px, fond coloré par catégorie, contour noir.

Overflow : si > 4 statuts → les 3 premiers + pastille `+N` (Variante C du mockup pour l'overflow).

**Couleur de fond pastille** = couleur de la catégorie du statut.

---

## 5. Option de campagne `status_effects_mode`

**Nouvelle colonne :** `campaigns.status_effects_mode TEXT NOT NULL DEFAULT 'off'`
- `'off'` — statuts visuels ET mécaniques désactivés (comportement actuel)
- `'icon_only'` — échec Test de Choc → affiche l'icône sur le token, aucun effet en jeu
- `'enforced'` — échec Test de Choc → icône + effets mécaniques appliqués

**Migration :** numéro à assigner (actuellement au moins 67).

**UI :** section "Effets de statuts" dans `CampaignSettingsPage`, 3 radio boutons.

---

## 6. Test de Choc — modifications du flux

### Flux PNJ (déjà auto-côté serveur)
Aucun changement sur le roll lui-même. Modification : après le calcul du `shockResult`, si `status_effects_mode !== 'off'` → écrire le statut dans `state_character.statuses`.

### Flux PJ — nouvelle fenêtre (actuellement auto-serveur aussi)

**Actuellement :** serveur auto-roll après `COMBAT_DAMAGE_CONFIRM`.
**Nouveau :** serveur émet `COMBAT_SHOCK_PROMPT` → PJ voit une fenêtre → clique "Lancer le jet de choc" → émet `COMBAT_SHOCK_CONFIRM` → serveur calcule.

**Nouveaux events WS :**
```
COMBAT_SHOCK_PROMPT  — serveur → socket PJ : { tokenId, formula:'1d20', seuilEtourdi, seuilIncons, shockMalus }
COMBAT_SHOCK_CONFIRM — PJ → serveur : { tokenId }
```

**Nouveau composant :** `CombatShockWindow.jsx`
- Affiche les seuils (étourdissement / inconscience)
- Bouton "Lancer le jet" → émet `COMBAT_SHOCK_CONFIRM`
- Le serveur roule le D20 côté serveur (jamais trusted client)

---

## 7. Effets mécaniques (`status_effects_mode = 'enforced'`)

### `stunned` (LdB p.237)

| Effet | Implémentation |
|---|---|
| Ne peut pas attaquer | `COMBAT_ACTION_DECLARE` : guard → reject si `statuses.includes('stunned')` + `COMBAT_DECLARE_ERROR` |
| −5 à toutes les actions | Ajout dans `effectiveMalus` lors du calcul des jets (serveur) |
| Allure max = **moyenne** (LdB p.237) | `COMBAT_ACTION_DECLARE` : si `move.action_key` = `move_rapide` ou `move_max` → reject |

### `unconscious` (LdB p.237)

| Effet | Implémentation |
|---|---|
| Passe son tour | `COMBAT_ACTION_CONFIRM` : si `statuses.includes('unconscious')` → skip direct + `advanceSlot` sans résoudre les actions |

---

## 8. Expiration

**V1 :** retrait manuel uniquement — GM ou propriétaire via le menu contextuel token (§3).

**V2 futur :** table durée LdB p.237 (dépend gravité blessure × localisation) + tours automatiques.

---

## 9. Découpage en sprints

### Sprint Prérequis — Menu contextuel token
**Fichiers :** `Canvas3D.jsx`, `SessionPage.jsx`, `shared/events.js`, `server/src/socket/index.js`
**Résultat :** right-click sur token → menu 2D → ajouter/retirer statuts → broadcast WS → `state_character.statuses[]` mis à jour
**Bloqueur pour les sprints suivants.**

### Sprint Statuts — Affichage badges
**Fichiers :** `Canvas3D.jsx` (badges `<Html>` dans TokenMesh), `client/public/statuts/` (copie SVGs)
**Résultat :** badges sous le nom, visibles pour tous, couleur par catégorie
**Dépend de :** Sprint Prérequis pour que les statuts existent en DB

### Sprint Statuts — Option campagne + Flux Choc PJ + Mécaniques enforced
**Fichiers :** migration, `CampaignSettingsPage.jsx`, `server/src/socket/index.js`, `CombatShockWindow.jsx` (NOUVEAU), `CombatOverlay.jsx`
**Résultat :** `status_effects_mode` opérationnel, stunned/unconscious enforced, PJ roule son jet de choc
**Dépend de :** Sprint Affichage badges

---

## 10. Décisions ouvertes

- [ ] Hors combat : stocker les statuts dans `tokens.state_character JSONB` ou table `token_statuses` séparée ? (impact : persistance entre sessions)
- [ ] Sprint Prérequis : le double-clic actuel ouvre la fiche perso — le garder ou le remplacer par le menu contextuel ?
- [ ] Sprint Arts martiaux : `grappled` est prérequis pour la Lutte — à synchroniser
