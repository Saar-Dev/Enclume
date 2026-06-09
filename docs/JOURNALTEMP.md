# JOURNALTEMP — Vérification MANUELSYSCOMBAT.md vs LdB
> Session 85 — 2026-06-09
> Objectif : vérifier MANUELSYSCOMBAT.md ligne par ligne contre REGLESYSCOMBAT.md (source de vérité absolue)
> Statuts : ✅ CONFORME | ❌ FAUX | ⚠️ PARTIEL/NUANCE | ❓ ABSENT DU LdB (invention) | 🔲 À VÉRIFIER

---

## LÉGENDE

- **✅ CONFORME** : affirmation du manuel vérifiée et exacte par rapport au LdB.
- **❌ FAUX** : affirmation contredit explicitement le LdB.
- **⚠️ PARTIEL** : vrai en partie, mais incomplet ou nuancé.
- **❓ ABSENT DU LdB** : invention ou interprétation technique absente du LdB (peut être acceptable comme choix d'implémentation, à signaler explicitement).
- **🔲 À VÉRIFIER** : pas encore traité.

---

## PROGRESSION

- [ ] Section 1 — Modèle de données persistant (schéma PostgreSQL)
- [ ] Section 2 — Automate d'état du tour (state machine)
- [ ] Section 3 — Moteur d'initiative et modificateurs transitoires
- [ ] Section 4 — Pipeline balistique (résolution assaut distance)
- [ ] Section 5 — Matrice d'isolation des risques
- [ ] Section 6 — Phase d'initialisation (Roster & Surprise)
- [ ] Section 7 — Phase d'annonce
- [ ] Section 8 — Mutations d'initiative
- [ ] Section 9 — Phase de résolution
- [ ] Section 10 — Clôture et maintenance des états (endTurn)

---

## SECTION 1 — Modèle de données persistant

### combat_state
| Champ | Manuel | LdB | Statut |
|---|---|---|---|
| campaign_id (PK) | 1 ligne active par campaign_id | non précisé dans LdB (choix technique) | ❓ |
| current_phase | 'ROSTER', 'ANNOUNCEMENT', 'RESOLUTION' | LdB parle d'étapes : Surprise / Initiative / Déclaration / Résolution / Fatigue / Fin — pas de noms de phases | ❓ phaseNames = convention technique |
| round | compteur de round | ✅ LdB confirme notion de "Tour de combat" | ✅ |
| active_slot_idx | index du slot actif | ❓ abstraction technique, LdB parle de "phases d'action" numérotées par score d'initiative | ❓ |

### combat_roster
| Champ | Manuel | LdB | Statut |
|---|---|---|---|
| base_initiative | = calcREA = ADA + PER | ❌ LdB dit Initiative de base = **Niveau de Réaction** (pas ADA+PER). Réaction est un attribut calculé, pas ADA+PER directement. calcREA dans le code = polarisRound((ADA+PER)/2). À confirmer avec charStats.js. | ❌ À VÉRIFIER DANS LE CODE |
| current_initiative | modifiable intra-tour | ✅ LdB nomme cela "niveau actuel" vs "niveau de base" | ✅ |
| state_position | 'standing', 'crouching', 'prone' | ✅ LdB mentionne ces positions (debout, accroupi, allongé) | ✅ |
| state_weapon | 'holstered', 'ready', 'drawn' | ⚠️ LdB parle de "dégainer" comme préparation, et "main sur l'arme" (-3 au lieu de -5). Les 3 états sont une interprétation raisonnable. | ⚠️ |
| state_character (JSONB) | flags volatils : is_rushed, is_surprised, is_stunned | ⚠️ LdB confirme surprised et précipitation (is_rushed). is_stunned existe (Test de Choc → état étourdi). Mais LdB dit stunned = **1D6 rounds**, jamais un booléen permanent. | ⚠️ |
| Armure mécanisée : MIN(Réaction, Manœuvre_armure) | mentionné dans le manuel comme calcul de base_initiative | ⚠️ LdB marque cette règle **OPTIONNEL** (encart). Manuel ne précise pas l'optionnalité. | ⚠️ |

### combat_actions
| Champ | Manuel | LdB | Statut |
|---|---|---|---|
| sequence | Mouvement=1, Micro-actions=2, Assaut=3 | ⚠️ LdB ne définit pas de "séquence 1/2/3". LdB dit : déplacement court = PRÉPARATION (coûte −3 INI, intégré à l'attaque). Déplacement long = action de déplacement séparée (action entière). La distinction "séquence 1/2/3 dans la DB" est une abstraction technique. | ❓ |
| payload (JSONB) | stocke données métier | ❓ choix technique | ❓ |

**Résumé Section 1 :**
- `base_initiative = calcREA = ADA+PER` → **⚠️ à vérifier** : dans le code `calcREA = polarisRound((ADA+PER)/2)` pas `ADA+PER` direct. Le manuel écrit "ADA + PER" sans la division par 2. Potentiellement une erreur dans le manuel.
- Armure mécanisée : optionnel selon LdB, traité comme obligatoire dans le manuel.
- `sequence 1/2/3` : abstraction technique absente du LdB, pas fausse mais non sourcée.

---

## SECTION 2 — Automate d'état du tour (state machine)

| Affirmation | LdB | Statut |
|---|---|---|
| Phases : ROSTER → ANNOUNCEMENT → RESOLUTION → (boucle ou fin) | ✅ LdB : Surprise → Initiative → Déclaration → Résolution → Fin/boucle. Correspondance acceptable. | ✅ |
| COMBAT_START calcule base_initiative + surprise + passe en ANNOUNCEMENT | ✅ cohérent avec LdB étapes 1+2 | ✅ |
| COMBAT_ACTION_DECLARE : insère action + applique modificateur initiative immédiatement en DB | ✅ LdB : "la modification prend effet immédiatement, le marqueur est déplacé tout de suite" | ✅ |
| Validation "tous ont déclaré" → RESOLUTION | ✅ LdB : "une fois que tout le monde a déclaré ses intentions" → résolution | ✅ |
| Fin de la file d'actions → incrémente round + purge + reset init + retour ANNOUNCEMENT | ✅ LdB étape 5 : "on recommence à l'étape 2 (Initiative)" | ✅ |
| Événement `COMBAT_ROUND_INCREMENTED` | ❓ nom d'événement technique, pas dans LdB | ❓ |
| `COMBAT_NEXT_SLOT` : sélectionne le roster_id de l'index d'initiative courant, consomme combat_actions filtrées par sequence ASC | ⚠️ LdB ne parle pas de "slots" nommés ainsi. L'idée de consommer les actions d'un personnage séquentiellement dans l'ordre INI décroissant est conforme, mais la terminologie "slot" + activeSlotIdx est une abstraction technique. | ⚠️ |

**Résumé Section 2 :**
- Structure globale de la machine à états : **conforme** à l'esprit du LdB.
- Terminologie "SLOT" et `activeSlotIdx` : abstraction technique acceptable mais non sourcée LdB.

---

## SECTION 3 — Moteur d'initiative et modificateurs

### Ordre des phases
| Affirmation | LdB | Statut |
|---|---|---|
| Ordre d'annonce : CROISSANT (lents en premier) | ✅ LdB p.213 : "dans l'ordre croissant des niveaux d'Initiative (les plus lents en premiers)" | ✅ |
| Ordre de résolution : DÉCROISSANT (rapides en premier) | ✅ LdB p.213 : "résolues dans l'ordre décroissant des niveaux d'Initiative" | ✅ |

### Bris d'égalité
| Affirmation | LdB | Statut |
|---|---|---|
| Manuel : "Priorité 1 : plus haut niveau de Réaction. Priorité 2 : plus haute valeur d'Adrénaline. Priorité 3 : Simultané strict (Math.random() encapsulé)" | LdB p.214 : "la priorité va au personnage possédant le niveau de Réaction le plus élevé (avec malus blessures/fatigue). En cas d'égalité des niveaux de Réaction → simultané." | ❌ PARTIELLEMENT FAUX : le LdB ne mentionne PAS l'Adrénaline comme critère de bris d'égalité secondaire. Il dit : égalité de Réaction = simultané, point. Le "Priorité 2 : ADA" est une invention du manuel. |

### Table de mutation d'initiative
| Action | Manuel | LdB | Statut |
|---|---|---|---|
| Précipiter : +3 INI / −5 test | ✅ | LdB p.218 : +3 Initiative, malus −5 à l'Action | ✅ |
| Dégainer : −5 (ou −3 si main sur arme) | ✅ | LdB p.217 : "Dégainer une arme : Initiative −5, ou −3 si le personnage se tient prêt à dégainer, main sur l'arme" | ✅ |
| Déplacement court (≤3m) : −3 | ✅ | LdB p.221 : "déplacements inférieurs à 3 mètres peuvent être considérés comme des Préparations… coûtent alors 3 points d'Initiative" | ✅ |
| Changer mode de tir : −3 | ✅ | LdB p.217 : "Changer le mode de tir d'une arme à feu : Initiative −3" | ✅ |
| S'accroupir : −3 | ✅ | LdB p.221 : "S'accroupir/Se redresser (Init. −3)*" | ✅ |
| Se jeter à terre : −5 | ✅ | LdB p.221 : "Se jeter à terre, plonger (Init. −5)*" | ✅ |
| Se relever : −10 | ✅ | LdB p.221 : "Se relever (Init. −10)" | ✅ |
| **ABSENT du manuel** : Saisie (lutte) | ❌ MANQUE | LdB p.226 : "Effectuer une saisie nécessite de réussir un Test de combat, considérée comme une Préparation qui coûte 3 points d'Initiative" | ❌ OUBLI |
| **ABSENT du manuel** : Tirer depuis une couverture | ❌ MANQUE | LdB p.217 : "Tirer depuis une couverture : malus à l'Initiative de −3 à −5 selon position" | ❌ OUBLI (mineur, MJ-dépendant) |
| Règle de report si INI ≤ 0 : "current_initiative = max_init + 1" | ⚠️ | LdB p.216 : "si ≤ 0, l'action est reportée au tour suivant, le personnage agit en PREMIER et bénéficie de la préparation". La formule "max_init + 1" est une convention d'implémentation pour "agir en premier". Acceptable comme traduction technique. | ⚠️ |

**Résumé Section 3 :**
- Bris d'égalité ADA secondaire → **❌ FAUX** : inventé, pas dans le LdB.
- Saisie (lutte) = préparation −3 INI → **❌ absent** du manuel.
- Reste de la table : conforme.

---

## SECTION 4 — Pipeline balistique (assaut distance)

| Affirmation | LdB | Statut |
|---|---|---|
| [1] LOS : Raycasting 3D depuis source_pos_z + hauteur_posture vers target_pos_z + hauteur_posture | ⚠️ LdB ne spécifie pas de raycasting technique. La notion de ligne de vue existe implicitement dans les règles de couverture/obscurité. Implémentation raisonnable. | ❓ |
| [1] Portée : parsing ref_equipment.range, paliers Courte/Moyenne/Longue/Extrême | ✅ LdB p.226 : tableau de portée avec modificateurs identiques | ✅ |
| [1] Munitions : invalidation si quantity < bullet_count | ✅ logique, LdB parle de gestion des munitions | ✅ |
| [2] Seuil = Compétence + mod portée − malus blessures − carence FOR − malus précipitation (−5) | ✅ LdB p.226 : modificateurs de portée + p.236 malus blessures | ✅ |
| [2] Cible sans défense (surprise totale) : test simple +5 | ✅ LdB p.223 : "Attaquer un personnage sans défense : Test simple avec bonus de +5" | ✅ |
| [3] MR = Seuil − Jet. Si Jet > Seuil → échec | ✅ LdB : marge de réussite = seuil − dé | ✅ |
| [4] Dommages_Bruts = Dommages_Arme + MR | ✅ LdB p.229 : "Dommages de l'arme + modificateur de réussite" | ✅ |
| [4] Dommages_Nets = Bruts − (Protection_Localisation + Modificateur_Résistance_Naturelle) | ✅ LdB p.229-230 : armure absorbe N points sur la localisation touchée | ✅ |
| [4] Gravité : incrémentée par tranche stricte de 5 points nets | ✅ LdB p.229 : "chaque tranche de 5 points de Dommages fait augmenter la gravité" | ✅ |
| [4] Jet de localisation 1D20 | ✅ LdB p.230 : table 1D20 | ✅ |
| [5] Test de Choc si blessure grave/critique/mortelle | ✅ LdB p.229 + chapitre État de santé p.237 (mentionné) | ✅ |
| [5] is_stunned dans state_character si Test de Choc raté | ⚠️ LdB ne nomme pas "is_stunned" mais décrit l'état "Étourdi". Implémentation conforme dans l'esprit. | ✅ |
| **ABSENT** : déplacement cible en combat à distance (−3/−5/−7) | ❌ MANQUE | LdB p.227 : "Cible en déplacement : allure moyenne −3, rapide −5, max −7" | ❌ OUBLI IMPORTANT |
| **ABSENT** : tireur en déplacement (−3/−5/−7/impossible) | ❌ MANQUE | LdB p.227 : "Tireur en déplacement : lente −3, moyenne −5, rapide −7, max = impossible" | ❌ OUBLI IMPORTANT |
| **ABSENT** : couverture partielle (−3) / importante (−5) | ❌ MANQUE | LdB p.227 : tableau modificateurs de circonstances | ❌ OUBLI |
| **ABSENT** : obscurité (−3/−5/impossible) | ❌ MANQUE | LdB p.227 | ❌ OUBLI |
| **ABSENT** : taille de la cible (−10 à +15) | ❌ MANQUE | LdB p.226 : tableau taille cible | ❌ OUBLI |
| **ABSENT** dans pipeline : CaC (mêlée) | ⚠️ MANQUE | Pipeline décrit uniquement le combat à distance. CaC = test d'opposition, pas test simple. Règles distinctes. | ❌ OUBLI MAJEUR |

**Résumé Section 4 :**
- Pipeline balistique distance : structure correcte.
- **5 modificateurs de circonstances absents** : déplacement cible, déplacement tireur, couverture, obscurité, taille cible.
- **CaC entièrement absent** du pipeline.

---

## SECTION 5 — Matrice d'isolation des risques

*(Section descriptive/méta, pas de règles mécaniques à vérifier. Commentaires organisationnels uniquement.)*

| Affirmation | LdB | Statut |
|---|---|---|
| "combat_actions : séquence obligatoire Mouvement (1) avant Assaut (3)" | ⚠️ LdB ne définit pas cet ordre en DB. Mais logiquement : déplacement avant attaque dans le même tour. Acceptable. | ⚠️ |
| "endTurn : opérateur JSONB (− 'is_rushed') n'efface pas is_stunned" | ✅ correct : is_rushed = éphémère, is_stunned = persistant | ✅ |

---

## SECTION 6 — Phase d'initialisation (Roster & Surprise)

| Affirmation | LdB | Statut |
|---|---|---|
| "Calcul de Base : validé via calcREA dans charStats.js" | ⚠️ calcREA = polarisRound((ADA+PER)/2). LdB : Réaction = attribut du personnage. calcREA est le calcul de la Réaction à partir des attributs. Conforme si la formule (ADA+PER)/2 correspond au LdB. **À vérifier dans les règles de création de personnage** (hors scope du fichier REGLESYSCOMBAT.md fourni). | ⚠️ HORS SCOPE |
| "Bris d'égalité : jet caché serveur (déterministe)" | ❌ | LdB p.214 : pas de jet caché — égalité de Réaction = **simultané**. Un jet aléatoire est une simplification d'implémentation mais contredit la règle "simultané" (les deux actions se résolvent en parallèle, possibilité de s'entretuer mutuellement). | ❌ CONTREDIT LE LdB |
| "is_surprised stocké dans JSONB state_character pour conditionner les droits d'action" | ✅ cohérent avec LdB : surpris = ne peut pas agir au 1er tour | ✅ |
| "Armure mécanisée : MIN(Réaction, Manœuvre_armure)" | ⚠️ LdB : OPTIONNEL | ⚠️ |

---

## SECTION 7 — Phase d'annonce

| Affirmation | LdB | Statut |
|---|---|---|
| "Ordre des annonces : CROISSANT (éléments lents d'abord)" | ✅ | ✅ |
| "Le moteur doit bloquer COMBAT_ACTION_DECLARE tant que activeSlotIdx n'a pas atteint le token dans l'ordre croissant" | ✅ esprit du LdB : l'ordre est obligatoire (le MJ interroge dans l'ordre croissant). Implémenter un verrou serveur est la bonne approche. | ✅ (bonne pratique) |
| "Alerte : Risque d'inversion visuelle/applicative" — identifié comme problème | ✅ problème réel, bien identifié | ✅ |
| **ABSENT** : règle de simultanéité lors de l'égalité d'INI en phase d'annonce | ❌ MANQUE | LdB p.214 : "Si plusieurs personnages peuvent agir à la même phase d'action et que les Actions ne sont pas considérées comme simultanées, les déclarations doivent être faites dans l'ordre croissant." L'ordre d'annonce s'applique AUSSI en cas d'égalité. | ❌ OUBLI |

---

## SECTION 8 — Mutations d'initiative

*(Voir Section 3 — même contenu, vérification déjà faite.)*

Résumé des écarts non repris :
- Bris d'égalité ADA → ❌
- Saisie −3 → ❌ absent
- Règle report INI ≤ 0 → ⚠️ formule "max_init+1" acceptable

---

## SECTION 9 — Phase de résolution

| Affirmation | LdB | Statut |
|---|---|---|
| "Ordre de résolution : DÉCROISSANT" | ✅ | ✅ |
| "Séquence interne : Mouvement (1) → Micro-actions (2) → Assaut (3)" | ⚠️ LdB ne définit pas d'ordre fixe "1/2/3". LdB dit : déplacement court (-3 INI) est une préparation intégrée à l'attaque, pas une action séparée. Déplacement long = action de déplacement distincte (le personnage ne peut pas attaquer dans le même tour, sauf exceptions). La modélisation en 3 séquences dans la DB ne reflète pas exactement ce comportement. | ❌ IMPRÉCIS |
| "Si is_stunned → invalidation des slots futurs" | ✅ LdB : effets des actions instantanés, un personnage tué ou étourdi avant son action ne peut pas agir | ✅ |
| "Consommation pas-à-pas via activeSlotIdx + advanceSlot" | ❓ abstraction technique | ❓ |
| **ABSENT** : attaques multiples (jusqu'à 3 attaques, −5/−7, intervalles INI −5/−10) | ❌ MANQUE CRITIQUE | LdB p.218 : règle complète sur les attaques multiples. Non traitée dans le manuel. | ❌ MANQUE CRITIQUE |
| **ABSENT** : actions exclusives (Charge, Tir visé, Rafale longue, Tir suppression → 1 seule attaque autorisée) | ❌ MANQUE | LdB p.218-219 : "Certaines Attaques sont exclusives" | ❌ MANQUE |
| **ABSENT** : règle du retard d'action (personnage peut retarder et agir plus tard dans le tour à n'importe quelle phase) | ❌ MANQUE | LdB p.218 : "Retarder son Action" — peut agir à n'importe quelle phase ultérieure. Action prioritaire sur les acteurs à initiative normale à la même phase. | ❌ MANQUE |
| **ABSENT** : "dégâts instantanés" — si acteur rapide tue/étourdit cible lente, les actions futures de la cible sont annulées | ✅ mentionné "is_stunned → invalidation" mais pas le cas "mort" | ⚠️ |

---

## SECTION 10 — Clôture et maintenance des états (endTurn)

| Affirmation | LdB | Statut |
|---|---|---|
| "Purge des modes éphémères (is_rushed)" | ✅ LdB : précipitation = modificateur du tour, n'est pas persistant | ✅ |
| "is_stunned dure 1D6 rounds (variable numérique dans state_character)" | ✅ LdB p.237 (référencé) : "état Étourdi dure 1d6 rounds" | ✅ |
| "Inconscience dure 1d6 minutes" | ✅ LdB p.237 (référencé) | ✅ |
| "stunned_until_turn : JSONB ne stocke pas un booléen mais un entier décrémenté à chaque round" | ✅ recommandation correcte | ✅ |
| **ABSENT** : reset de current_initiative = base_initiative au début de chaque tour | ❌ MANQUE | LdB p.213 : "Chaque joueur détermine l'Initiative de base de son personnage" à chaque tour (étape 2). Current_initiative doit être réinitialisée à base_initiative en début de chaque tour AVANT les déclarations. | ❌ MANQUE |

---

## SYNTHÈSE FINALE

### Erreurs factuelles (contredisent le LdB)
| # | Section | Erreur |
|---|---|---|
| E1 | §3, §6 | Bris d'égalité : "Priorité 2 = ADA" **inexistant** dans LdB. LdB dit : égalité Réaction = **simultané**. |
| E2 | §6 | "Bris d'égalité = jet caché" : **contredit** LdB. LdB dit égalité = simultané (les deux attaques se résolvent, les deux peuvent s'entretuer). |

### Omissions importantes (absentes du manuel, présentes dans LdB)
| # | Section | Omission |
|---|---|---|
| O1 | §4 | Modificateurs de circonstances balistiques : déplacement cible, déplacement tireur, couverture, obscurité, taille cible — **tous absents**. |
| O2 | §4 | **Pipeline CaC entièrement absent** (test d'opposition, pas test simple). |
| O3 | §9 | **Attaques multiples** (LdB p.218) : jusqu'à 3 attaques, malus −5/−7, intervalles INI −5/−10 — **absent du manuel**. |
| O4 | §9 | **Actions exclusives** (Charge, Tir visé, Rafale longue, Tir suppression) — non listées comme telles. |
| O5 | §9 | **Retarder son action** : règle non traitée. |
| O6 | §3 | **Saisie (lutte) = préparation −3 INI** — absent. |
| O7 | §10 | **Reset current_initiative = base_initiative** au début de chaque nouveau tour — absent. |

### Nuances / Implémentations acceptables (absentes LdB mais non incorrectes)
| # | Section | Note |
|---|---|---|
| N1 | §1 | `sequence 1/2/3` en DB : abstraction technique non sourcée mais logiquement cohérente. |
| N2 | §2 | Terminologie "SLOT", `activeSlotIdx` : abstraction technique. |
| N3 | §3 | Règle report INI ≤ 0 : formule "max_init+1" = traduction acceptable de "agit en premier au tour suivant". |
| N4 | §1 | Armure mécanisée MIN(Réaction, Manœuvre) : **optionnel** selon LdB, traité comme obligatoire dans le manuel — choix acceptable. |
| N5 | §9 | Modélisation séquence déplacement/assaut en 3 steps DB : imprécise mais gérable. |

---

## PROCHAINES ÉTAPES

- [ ] Comparer avec BUGIDENTIFIE.md — recouper les bugs identifiés avec les erreurs trouvées ici
- [ ] Lire le code actuel (socket/index.js, CombatTimeline.jsx, combatSections.js) pour vérifier ce qui est effectivement implémenté
- [ ] Dresser le plan de correction priorisé (erreurs bloquantes vs dettes)
