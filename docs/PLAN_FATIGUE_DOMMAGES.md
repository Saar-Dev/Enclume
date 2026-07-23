# PLAN — Intégration FATIGUE&DOMMAGES.md

> Statut : plan initial, aucun code. Document temporaire (`docs/RegleDocumentaire.md` Règle 10) —
> à archiver dans `docs/Old/` une fois le chantier clos, contenu durable transféré vers
> `docs/SYSTEME/*.md`.
> Source : `docs/REGLES/FATIGUE&DOMMAGES.md` (extrait Livre de Base Polaris, p.242-251).

---

## 1. Ce que couvre réellement le fichier source

Le fichier n'est pas un système unique : c'est le chapitre annexe complet « États de santé » du
Livre de Base, 9 sous-thèmes indépendants (mécaniques et jauges séparées) :

1. Acide, Chutes, Décompression, Hyperventilation
2. **Dommages étourdissants et assommants (Choc)** — ⚠️ hors périmètre, voir §2
3. Faim et soif
4. Feu
5. Froid (+ Blessures dues au feu/gel, optionnel)
6. Noyade/Asphyxie
7. Maladies et poisons (jauge 0-30, contamination, évolution, traitement)
8. Drogues (jauge d'intoxication + Narco-dommages + Accoutumance + Manque)
9. Irradiations (jauge 0-30 + accumulation permanente)
10. Fatigue (règle avancée) — états, compteur à cases, tests MJ-discrétionnaires

C'est pour ça que Saar a raison de vouloir le découper avant tout code : ce sont potentiellement
6-8 chantiers de taille PLAN individuelle, pas un seul.

---

## 2. Hors périmètre explicite

**Choc/Assommant (item 2 ci-dessus) : déjà un chantier actif séparé.** `docs/EN_COURS.md` porte
actuellement le verrou `🔒 En cours (Claude) : Palier 1 CHOC1` (codé, en attente du test navigateur
de Saar). Ce plan ne le retouche pas et ne le reséquence pas — une fois CHOC1 clos, sa doc durable
ira dans `docs/SYSTEME/COMBAT.md`, pas ici.

---

## 3. Fondations déjà en place (réutilisables, pas à reconstruire)

- **Moteur de blessures physiques** (`docs/REGLES/REGLEBLESSURES.md`, `damageService.js`,
  `resolveTargetHit`) : seuils 5/10/15/20/25/30, localisation, réduction d'armure (RD). Les sources
  de dégâts physiques (Acide, Chute, Décompression, Feu, Froid) s'y branchent nativement — ce sont
  des générateurs de jets qui alimentent un pipeline déjà construit, pas un nouveau moteur.
- **Attributs de résistance secondaires déjà calculés et branchés mutations/avantages** :
  `resistance_dommages`, `resistance_drogues`, `resistance_poison`, `resistance_maladie`,
  `resistance_radiation` (`char-sheet.js:1245-1289`, `calcResistanceNaturelle`,
  `getMutationModForResistance`/`getAdvantageModForResistance`). Rien à ajouter côté fiche
  personnage pour ces attributs — seul le moteur de jauge qui les consomme reste à construire.
- **Souffle** (`calcSouffle`, déjà utilisé en combat sous-marin) : ressource prête pour
  Noyade/Asphyxie.
- **`token_statuses`** (migration 68/79, `statusService.js`) : booléen par token + expiration en
  Tours de combat (`stunned`/`unconscious`). **Insuffisant tel quel** pour les jauges graduées
  (Maladie/Poison/Drogue/Irradiation/Fatigue) : celles-ci sont persistantes au **personnage**
  (survivent hors combat, s'expriment en jours/semaines), pas au token le temps d'un Tour. Nouvelle
  table nécessaire (voir Lot 4).

---

## 4. Décisions à trancher avant tout code (Lot 0)

Ces points changent le chiffrage de plusieurs lots — ne pas coder dessus sur hypothèse.

1. **[INCONNU] Incohérence RAW des malus de Fatigue.** Le chapitre Maladies/Irradiations cite
   `Légèrement fatigué = -2` / `Fatigué = -4` / `Très fatigué = -6` / `Épuisé = -8` (seuils 5/10/15/20),
   mais le chapitre Fatigue lui-même donne `-3` / `-5` / `-7` / `-10` pour les mêmes noms d'état.
   Seule une des deux échelles doit faire autorité (§4 de `CLAUDE.md` — une propriété possède une
   autorité unique). Aucune hypothèse retenue ici — décision Saar requise.
2. **Niveau d'automatisation voulu, par sous-thème.** Le texte dit lui-même que la Fatigue est
   « volontairement floue » (règle avancée, discrétion MJ totale sur la fréquence des Tests). Les
   autres jauges (Maladie/Poison/Drogue/Irradiation) ont une mécanique plus fermée (seuils fixes,
   évolution chiffrée). Faut-il : (a) un état persisté en base avec effets mécaniques appliqués
   automatiquement, ou (b) un simple outil de référence/calculateur pour le MJ, sans état
   persistant ? Ce choix peut différer d'un lot à l'autre.
3. **Faim et soif dépend d'une horloge de campagne** (effets par semaine/mois). Recherche faite :
   aucun système de calendrier/downtime trouvé dans le projet actuel. À confirmer avant de promettre
   une automatisation temporelle — sinon ce sous-thème reste un aide-mémoire MJ non automatisé.
4. **Priorité relative** : `docs/ROADMAP.md` ne listait jusqu'ici que « Fatigue (système cumulatif) »
   en chantier futur non scopé — confirmer avec Saar quels sous-thèmes sont utiles maintenant
   (probablement les dangers de combat/environnement avant les mécaniques de campagne longue comme
   Faim/soif ou Drogues).

---

## 5. Lots proposés (séquentiels — un seul actif à la fois, §5/§6 `CLAUDE.md`)

| Lot | Contenu | Taille | Dépend de | Risque architectural |
|---|---|---|---|---|
| 0 | Décisions §4 tranchées avec Saar | — | — | aucun code |
| 1 | Acide, Chutes, Décompression | S | Lot 0 | faible — réutilise le moteur de blessures tel quel |
| 2 | Feu, Froid (dégâts récurrents/Tour ou /heure) | M | Lot 1 | moyen — nécessite un suivi de durée d'exposition, unité de temps variable (Tour vs heure) |
| 3 | Noyade/Asphyxie | S | Lot 0 | faible — consomme Souffle + `statusService` existants |
| 4 | **Moteur générique « jauge graduée » (0-30, évolution périodique, résistance en modificateur)** | L | Lot 0 | structurant — nouvelle table, aucune règle de jeu concrète encore branchée dessus |
| 5 | Maladies et Poisons (1er consommateur du Lot 4) | L | Lot 4 | moyen — contamination/diagnostic/traitement + catalogue d'exemples |
| 6 | Drogues (2e consommateur) | L | Lot 4, bénéficie de Lot 5 | moyen-haut — ajoute Narco-dommages (jauge secondaire permanente), Accoutumance, Manque |
| 7 | Irradiations (3e consommateur) | M | Lot 4 | moyen — ajoute pertes de Constitution temporaires/permanentes + accumulation permanente |
| 8 | Fatigue (règle avancée) | M-L | Lot 0, reçoit des effets de Lots 2/5/6/7 | dépend fortement de la décision §4.2 — le plus discrétionnaire-MJ du lot |
| 9 | Faim et soif | S (si non automatisé) / M (si automatisé) | Lot 0 §4.3 | bloqué tant que §4.3 n'est pas tranché |

Fatigue est placé en dernier car les autres jauges (Froid, Maladie, Drogue, Irradiation) *émettent*
vers elle (« le personnage devient Légèrement fatigué ») mais n'en dépendent jamais en retour — pas
besoin que Lot 8 existe pour livrer 1-2-3-5-6-7 en attendant.

---

## 6. Hors scope de ce plan

- Choc/Assommant (§2).
- Toute UI joueur avant que le Lot 0 ait tranché automatisé vs aide-mémoire.
- Calendrier/downtime de campagne (préalable non écrit du Lot 9, pas dans ce chantier).

---

## 7. Prochaine étape

Valider Lot 0 avec Saar (les 4 points §4), puis attaquer Lot 1 seul — un plan détaillé (fichiers,
invariant, hors périmètre) sera présenté avant ce premier lot, conformément à `CLAUDE.md` §6.
