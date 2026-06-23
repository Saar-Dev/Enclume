# JOURNALTEMP — Scratch pad analytique
> Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

---

## Session 118 — COM17 : arme par défaut = Mains nues

### Analyse cause racine confirmée

`selectedMeleeWeaponId = null` joue deux rôles contradictoires :
- `null` = mains nues (choix explicite utilisateur)
- `null` = pas encore sélectionné (init/reset)

### Plan validé — 4 changements

**PJ `CombatActionWindow.jsx` :**
1. Fetch callback (L.234) : `setSelectedMeleeWeaponId(items.find(isMeleeCaC)?.id ?? null)` — slot change, données fraîches
2. Effet `has_announced` (L.217) : `setSelectedMeleeWeaponId(meleeWeapons[0]?.id ?? null)` — nouveau tour même token
3. Deselect melee (L.400) : idem — ré-ouverture mode CaC retrouve l'arme

**GM `CombatGmDeclareWindow.jsx` :**
4. L.178 : supprimer `&& initialStates.weapon === 'drawn'`

### Question ouverte — Généralisation Assault tir ?

**GM assault** : `weapon = equipment[activeTokenId]?.weapon ?? null` → DÉRIVÉ, pas useState → pas de problème init.

**PJ assault** : `assaultWeapons` useState (L.95), peuplé par même fetch que `allInventoryItems` (L.231).
- `selectedWeapon` / `selectedAssaultWeaponId` → À VÉRIFIER : même init-to-null ?
- Si oui → même fix dans le fetch callback

**Décision à prendre** : auditer `CombatActionWindow.jsx` section assault avant ou après COM17 CaC ?
- Recommandation : finir COM17 CaC en premier (cause confirmée, plan prêt), puis audit assault séparé.
- Risque si on regroupe : scope creep, contexte épuisé avant validation.

### État BUGIDENTIFIE.md
- DASH1 ✅ clos
- COM17 ✅ clos — pattern valeur dérivée (`undefined` sentinel)
- COM18 / COM15 / COM16 / D3 : à traiter

