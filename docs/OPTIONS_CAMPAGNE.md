# Options de campagne — Création de personnage

> Source : LdB Polaris — chapitre Création de personnage
> Date : 2026-07-03 — Session 130
> Statut : inventaire exhaustif

---

## OPT-01 — Ambiance de campagne

**Règle :** Détermine le pool de points d'attributs et la Chance de départ.

| Ambiance | Points d'attributs | Chance |
|---|---|---|
| Réaliste | 30 | 11 |
| Intermédiaire | 38 | 13 |
| Héroïque | 46 | 15 |

**Impact code :**
- `Step1Attributes` : `poolBase` et `chc` → remplacer `mockAmbiance = 'INTERMEDIAIRE'` par lecture option campagne
- `polarisUtils.js` : `POOL_AMBIANCE`, `CHANCE_AMBIANCE` déjà définis

**Défaut :** Intermédiaire

---

## OPT-02 — Bonus/Malus féminin

**Règle :** Si activé, personnage féminin : FOR base = 5 (au lieu de 7), +2 bonus répartissables en COO et/ou PRE (max 20).

**Impact code :**
- `Step1Attributes` : conditionner l'affichage du toggle Sexe et l'application de FOR=5 + limite COO/PRE
- `validateStep1` : règle G4 déjà codée dans `polarisUtils.js`
- `Step2Genotype` : `baseAttrs` déjà réactif à `isFeminin`

**Défaut :** OFF

---

## OPT-03 — Mutations aléatoires

**Règle :** Si activé, le joueur peut lancer 1D20 gratuitement (sans dépenser de PC) :
- 1-15 → 1 mutation
- 16-19 → 2 mutations
- 20 → 3 mutations

Les mutations sont tirées aléatoirement (D100). Suppression possible : 1 PC par mutation désavantageuse/neutre supprimée, gratuite pour les avantageuses.

**Impact code :**
- `Step3Mutations` : conditionner l'affichage du bouton "Jet aléatoire gratuit"
- Si OFF → seule la voie d'achat PC est disponible

**Défaut :** ON

---

## OPT-04 — Polaris latent et non maîtrisé

**Règle :** Option avancée. Le joueur peut acheter pour 3 PC :
- **Polaris latent** : la Force Polaris sommeille, le MJ décide du réveil
- **Polaris non maîtrisé** : 2 pouvoirs max (tirage aléatoire), pas d'accès à Maîtrise de la Force Polaris, activation incontrôlée uniquement

Limite : 1 seul Polaris latent/non maîtrisé par groupe.

**Impact code :**
- `Step5Advantages` (ou step dédié Pouvoirs Polaris) : conditionner l'option d'achat "Polaris latent / non maîtrisé" à 3 PC
- Restreindre à 1 par campagne (validation côté serveur)

**Défaut :** OFF

---

## OPT-05 — Avantages professionnels aléatoires

**Règle :** Tous les 5 ans dans une Profession (années 5, 10, 15...), le joueur peut tirer dans la table des Avantages professionnels aléatoires au lieu de répartir 5 points manuellement.

**Défaut :** ON (déjà en BDD ?)

---

## OPT-06 — Personnages expérimentés (Revers)

**Règle :** Au-delà de 10 ans d'expérience, tous les 3 ans (13, 16, 19...), jet obligatoire dans la table des Revers.

**Défaut :** OFF

---

## OPT-07 — Compétences avec conditions requises (†)

**Règle :** Certaines compétences (marquées †) nécessitent des prérequis (ex: Médecine 10 avant Chirurgie).

**Défaut :** OFF

---

## OPT-08 — Niveau maximum des Compétences

**Règle :** Le niveau max d'une compétence dépend des années d'expérience dans la Profession associée.

| Expérience | Niveau max |
|---|---|
| 1 an | +3 |
| 2 ans | +5 |
| 3-5 ans | +7 |
| 6-10 ans | +10 |
| 11-20 ans | +13 |
| 21 ans et + | +15 |

**Défaut :** OFF

---

## OPT-09 — Compétences à progression naturelle

**Règle :** Compétences de Connaissances et Langues gagnent +1 niveau/an (max +5) si le personnage vit dans la nation concernée.

**Défaut :** OFF

---

## OPT-10 — Personnages très jeunes

**Règle :** Malus d'âge pour personnages de 16-19 ans :
- 16-17 ans : FOR -3, PRE -2
- 18 ans : FOR -2, PRE -1
- 19 ans : FOR -1
Non applicable si attribut ≤ 7. Temporaire en campagne.

**Défaut :** OFF

---

## OPT-11 — Célébrité

**Règle :** Attribut secondaire mesurant la notoriété (niveau 0-25). Achat avec points de Célébrité gagnés par années d'expérience (1 pt/an). Coût progressif (3 pts/niveau jusqu'à 10, puis 6, etc.). Tests de Célébrité avec modificateurs de situation. Modificateur d'influence sur tests relationnels.

**Défaut :** OFF

---

## Résumé

| ID | Option | Défaut | Step impacté |
|---|---|---|---|
| OPT-01 | Ambiance | INTERMEDIAIRE | Step1 |
| OPT-02 | Bonus/Malus féminin | OFF | Step1, Step2 |
| OPT-03 | Mutations aléatoires | ON | Step3 |
| OPT-04 | Polaris latent/non maîtrisé | OFF | Step5 |
| OPT-05 | Avantages pro aléatoires | ON | Step4 |
| OPT-06 | Personnages expérimentés (Revers) | OFF | Step4 |
| OPT-07 | Compétences avec conditions † | OFF | SkillsPanel |
| OPT-08 | Niveau max Compétences | OFF | Step4, SkillsPanel |
| OPT-09 | Compétences progression naturelle | OFF | SkillsPanel |
| OPT-10 | Personnages très jeunes | OFF | Step1 |
| OPT-11 | Célébrité | OFF | Step4, Step5, CharSheet |