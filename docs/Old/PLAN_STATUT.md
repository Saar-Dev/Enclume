# PLAN_STATUT — Système de statuts sur les tokens
> Créé : Session 74 (2026-06-03)
> Mis à jour : Session 77 (2026-06-04)
> Source LdB : p.237 (Choc), p.523 (Arts martiaux)

---

## 1. Contexte et scope V1

**Ce que ce sprint apporte :**
- Secteur "Statuts" du TokenRadialMenu → bulle-grille 15 icônes
- Toggle applique/retire un statut (clic unique)
- Badges visuels sous le nom des tokens (Html drei, 3D)
- Permissions : GM ajoute et retire / Propriétaire retire uniquement
- Table `token_statuses` persistante (hors combat inclus)

**Ce que ce sprint ne fait PAS :**
- Pas d'effets mécaniques (stunned/unconscious non enforced ici — Sprint 3 futur)
- Pas d'expiration automatique — retrait manuel uniquement
- Pas de durée LdB (table p.237 bas de page) — reporté V2
- Pas d'option campagne `status_effects_mode` — Sprint 3 futur

---

## 2. Assets SVG

**Emplacement source :** `docs/Character/Statuts/` — 15 fichiers présents, noms corrects.
**Destination runtime :** `client/public/assets/status/` — déjà présents, aucune copie.
**Usage dans les badges :** `<img src="/assets/status/stunned.svg">` (16×16px).

**Catégories et couleurs :**
| Catégorie | Couleur | Statuts |
|---|---|---|
| entrave (contrôle) | `#d8a838` ambre | grappled, restrained, off_balance |
| dot (dégâts continus) | `#d84838` rouge | burning, acid, asphyxia, decompression, electrocuted |
| sens (perception/mental) | `#9858c8` violet | stunned, unconscious, blinded |
| chronique (long terme) | `#38a8c8` cyan | hypothermia, infected, poisoned, irradiated |

**Table complète statuts (15) :**
| Code | Catégorie | Nom FR |
|---|---|---|
| `stunned` | sens | Étourdi |
| `unconscious` | sens | Inconscient |
| `blinded` | sens | Aveuglé |
| `grappled` | entrave | Saisi |
| `restrained` | entrave | Entravé |
| `off_balance` | entrave | Déséquilibré |
| `burning` | dot | Enflammé |
| `acid` | dot | Corrodé |
| `asphyxia` | dot | Asphyxie |
| `decompression` | dot | Décompression |
| `electrocuted` | dot | Électrocuté |
| `hypothermia` | chronique | Hypothermie |
| `infected` | chronique | Infecté |
| `poisoned` | chronique | Empoisonné |
| `irradiated` | chronique | Irradié |

---

## 3. Interface — Intégration dans TokenRadialMenu

**Décision Session 77 :** menu contextuel right-click remplacé par le secteur `statuts` du `TokenRadialMenu.jsx` existant.

Le secteur `statuts` existe déjà à l'index 7 (`enabled: false`) — il suffit de l'activer.

### 3a. Flux d'interaction

1. Clic sur token → `TokenRadialMenu` s'ouvre
2. Clic secteur "STATUTS" → `onOpenStatusPanel()` callback → radial se ferme
3. `SessionPage` monte `TokenStatusPanel` positionné aux mêmes coords x/y
4. Bulle-grille 3 rangées × 5 colonnes :
   - Statuts actifs : fond coloré catégorie + bordure glow + cursor pointer
   - Statuts inactifs (GM) : icône atténuée + cursor pointer
   - Statuts inactifs (propriétaire non-GM) : icône grisée + cursor default (non cliquable)
5. Clic icône → émet `TOKEN_STATUS_TOGGLE` → serveur toggle → broadcast `TOKEN_STATUS_UPDATED`
6. Fermeture : click-dehors ou Échap

### 3b. Permissions

| Action | GM | Propriétaire du token | Autres |
|---|---|---|---|
| Voir les statuts actifs | ✅ | ✅ | ✅ |
| Ajouter un statut | ✅ | ✅ (son token) | ❌ |
| Retirer un statut | ✅ | ✅ (son token) | ❌ |

**Propriétaire :** `token.character_id → characters.user_id === socket.user.id`
**Entité de décor** (`!token.character_id`, PC27) : toggle interdit, pas de propriétaire.

### 3c. Transport WS

**Deux nouveaux events** dans `shared/events.js` :
```js
TOKEN_STATUS_TOGGLE:  'token:status_toggle',  // client → serveur : { tokenId, statusCode }
TOKEN_STATUS_UPDATED: 'token:status_updated', // serveur → room   : { tokenId, statuses: ['stunned',...] }
```

**Handler serveur `TOKEN_STATUS_TOGGLE` :**
1. Vérifier que `token.character_id → characters.user_id` ou `socket.data.role === 'gm'`
2. Vérifier si statut déjà actif dans `token_statuses`
   - Pas actif → guard GM only → INSERT
   - Actif → guard GM ou owner → DELETE
3. Query statuts restants → broadcast `TOKEN_STATUS_UPDATED` avec tableau complet

---

## 4. Stockage — Migration 68

**Décision Session 77 :** table dédiée `token_statuses` (persistance hors combat).
Raison : `state_character` est sur `combat_roster` (scope combat uniquement) — les statuts doivent survivre entre les sessions de combat.

```sql
CREATE TABLE token_statuses (
  id          SERIAL PRIMARY KEY,
  token_id    UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  status_code TEXT NOT NULL,
  applied_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token_id, status_code)
)
```

**Sync au chargement :** la route HTTP qui retourne les tokens pour une battlemap doit inclure les statuts en LEFT JOIN (`statuses: ['stunned', 'burning']` ou `[]`).

---

## 5. Badges 3D (Sprint Phase 2)

**Position :** juste en dessous du nom du token, dans `<Billboard>` via `<Html>` drei.

Le label est à `position={[0, 2.5, 0]}`. Les badges s'affichent à `position={[0, 2.1, 0]}`.

**Rendu :** rangée horizontale de pastilles (16×16px). Chaque pastille = `<img src="/statuts/{code}.svg">`, fond coloré par catégorie, contour.
Overflow : si > 4 statuts → les 3 premiers + pastille `+N`.

---

## 6. Option de campagne `status_effects_mode` — Sprint 3 futur

Reporté. Pas de migration dans ce sprint.

`'off'` / `'icon_only'` / `'enforced'` — voir §5 de la version précédente.

---

## 7. Test de Choc — modifications du flux — Sprint 3 futur

Reporté. Flux PJ `COMBAT_SHOCK_PROMPT`/`COMBAT_SHOCK_CONFIRM` + `CombatShockWindow.jsx` en sprint dédié.

---

## 8. Effets mécaniques — Sprint 3 futur

`stunned` et `unconscious` enforced (−5 / no attack / allure max / skip tour) reportés.
Guard `is_stunned` dans `COMBAT_ACTION_DECLARE` (PC42) reste en dette.

---

## 9. Découpage en sprints

### Sprint Statuts Phase 1 — Infrastructure + Sub-panel + Badges 3D
**Migration :** 68 `token_statuses`
**Fichiers :** `shared/events.js`, `server/src/socket/index.js`, route tokens HTTP,
`TokenRadialMenu.jsx`, `TokenStatusPanel.jsx` (NOUVEAU), `SessionPage.jsx`,
`Canvas3D.jsx` (badges Html drei), `client/public/statuts/` (copie SVGs), `fr.json`
**Résultat :** secteur Statuts actif, bulle-grille toggle, badges sous nom token

### Sprint Statuts Phase 2 — Option campagne + Flux Choc PJ + Mécaniques enforced
**Migration :** 69 `campaign.status_effects_mode`
**Fichiers :** `CampaignSettingsPage.jsx`, `server/src/socket/index.js`, `CombatShockWindow.jsx` (NOUVEAU), `CombatOverlay.jsx`
**Dépend de :** Sprint Phase 1

---

## 10. Décisions actées (Session 77)

- [x] Stockage : table `token_statuses` (migration 68) — hors combat persistant
- [x] Interface : bulle-grille 3×5 (pas sub-radial — trop serré à 15 items)
- [x] Permissions : GM ajoute+retire (tous tokens) / Propriétaire ajoute+retire (son token uniquement)
- [x] Toggle : event unique `TOKEN_STATUS_TOGGLE` (add si absent, remove si présent)
- [x] Double-clic sur token garde son comportement (ouvre fiche perso) — inchangé
- [ ] `grappled` prérequis Arts martiaux — à synchroniser avec ce sprint
