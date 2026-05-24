# Notes de travail — Sprint 7 (temporaire, ne pas committer)

## Points en suspens / à clarifier

### REDFLAG — Problèmes identifiés dans ma lecture du plan

**ERREUR 1 — Seuils de blessures**
J'avais supposé : blessures = Math.floor(dégâts_nets / 5) blessures légères.
FAUX. Saar corrige : la gravité est déterminée par comparaison du dégât final aux seuils :
- ≥ 30     → Mort / Membre détruit
- 25 – 29  → Mortelle
- 20 – 24  → Critique
- 15 – 19  → ? (à confirmer)
- 10 – 14  → ? (à confirmer)
-  5 –  9  → ? (à confirmer)
-  < 5     → Aucune blessure
1 seule blessure par touche (pas N blessures légères).

**ERREUR 2 — RC/RL appartient à la phase ANNONCE**
J'avais mis RC/RL dans CombatModifiersWindow (Résolution).
FAUX selon Saar. RC/RL = déclaration Annonce.
LdB données par Saar :
- Rafale courte : +3 au test OU +5 aux dommages (courte portée seulmt)
- Rafale longue : par tranche de 5 balles → +2 test + (+2 dmg courte portée)
- RC/RL nécessite compétence "Tir Automatique" (PC23)
→ RC/RL à déplacer dans la déclaration Assaut (ST1), pas ST2.

**ERREUR 3 — Tir instinctif**
J'avais mis dans CombatModifiersWindow (Résolution).
Saar dit que c'est une erreur de phase/plan.
→ À clarifier : où appartient "Tir instinctif" dans le flux ?

**ERREUR 4 — Scope trop large**
J'essayais de tout planifier d'un coup (ST1+ST2+ST3 en parallèle).
Règle : 1 sous-tâche à la fois, confirmée avant de passer à la suivante.

---

## Données LdB collectées

### Modes de tir (LdB p.227-228)

**COUP PAR COUP :**
- Tir simple (1 balle) : aucun malus
- Tir à répétition (2 balles) : +1 test
- Tir à répétition (3 balles) : +2 test
- Tir à répétition (4 balles) : +3 test
- Tir à répétition (7 balles) : +4 test OU (+3 test / +3 dmg courte portée)
- Tir à répétition (10 balles) : +5 test OU (+4/+3 dmg) OU (+3/+6 dmg)
- Tir visé : +1 test par tranche de -2 INI (max +5)

**TIR AUTO :**
- Rafale courte (3 balles) : +3 test OU +5 dmg (courte portée seulmt)
- Rafale longue (5–20 balles) : par tranche de 5 → +2 test et +2 dmg (courte portée seulmt)
- Rafale longue (multi-cibles) : par tranche de 5 → zone 3m, test +0 courte / -5 moyenne

### Seuils blessures (incomplets — à compléter)
- ≥ 30     → Mort / Membre détruit
- 25 – 29  → Mortelle
- 20 – 24  → Critique
- 15 – 19  → ?
- 10 – 14  → ?
-  5 –  9  → ?

---

## Questions en attente (par priorité)

### ST1 uniquement
1. Est-ce que la déclaration Assaut inclut le mode RC/RL (choix balles/rafale) ?
   → Si oui : quel UI dans CombatActionWindow ? (select parmi les options above ?)
   → Si oui : est-ce que ça s'ajoute à la ligne combat_actions (modifiers JSONB) ?
2. "Tir instinctif" — phase ANNONCE ou RÉSOLUTION ? Mécanique exacte ?

### ST3 uniquement (à traiter plus tard)
3. Seuils blessures complets (lignes 15-19, 10-14, 5-9)
4. Test de Choc — malus exact par gravité/localisation (déjà dans le plan mais à confirmer)

---

## Périmètre ST1 selon le plan (à ne pas dépasser)

> CombatActionWindow.jsx — sélection cible (liste tokens roster)
> CombatActionWindow.jsx — sélection arme (MG ou MD, guard PC22)
> server/socket/index.js — COMBAT_ACTION_DECLARE guard target_token_id + PC22
> Vérif DB : target_token_id + weapon_inv_id non-null pour assault

Si RC/RL et tir instinctif s'ajoutent à ST1 → l'inventaire UI doit être refait.
