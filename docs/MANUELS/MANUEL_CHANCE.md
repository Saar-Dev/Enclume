# MANUEL_CHANCE.md — Logique de jeu pour la mécanique de Chance

> Version : 1.0 — 2026-09-11 (première rédaction, RAW fourni par Saar le 2026-09-11).
> Statut : Proposition validée pour implémentation (V1/V2 tranchés en conversation, 2026-09-11).
> Responsabilité unique : Traduire les règles RAW du Livre de Base Polaris (Attributs p.113,
> Tests et actions p.209-211) en logique de jeu pour Enclume.
> Ce document ne contient pas de code, de schéma SQL ni d'architecture technique. Ces aspects
> sont détaillés dans `docs/PLANS/PLAN_CHANCE.md`.
>
> Sources : `docs/REGLES/REGLE_CHANCE.md` (RAW), `shared/woundConstants.js` (paliers de
> gravité), `shared/polarisTestResolution.js` (autorité marge/critique/Catastrophe),
> `docs/VOCABULARY.md`, échanges Saar 2026-09-11.

---

## 1. Concepts de base

| Terme | Définition | Source |
|---|---|---|
| **Score de Chance (`chc`)** | Niveau sur 20, borné [1-20] en création. **Est aussi la réserve dépensable** — il n'existe pas de pool séparé. Dépenser de la Chance décrémente `chc` directement ; regagner de la Chance l'incrémente. | RAW Polaris [VÉRIFIÉ] — corrige l'hypothèse d'une colonne `chc_points` séparée posée dans une version antérieure de `PLAN_CHANCE.md` |
| **Test de Chance** | `1D20 ≤ chc + modificateur signé`. Toujours **gratuit** — un Test de Chance n'est jamais lui-même une dépense de points. | RAW Polaris [VÉRIFIÉ] |
| **Dépense volontaire** | Le joueur choisit de payer 1 (ou 2) point(s) de Chance pour acheter directement un effet bénéfique, sans lancer de dé. | RAW Polaris [VÉRIFIÉ] |
| **Plancher de dépense** | Une dépense n'est autorisée que si `chc − coût ≥ 3`. Le texte dit : un personnage « descendu à 3 » ne peut plus dépenser (il doit remonter à ≥ 4). En Test de Chance simple, aucun plancher : `chc` peut être testé même à 3 ou moins. | RAW Polaris [VÉRIFIÉ] |
| **Plafond** | 20. (Règle optionnelle « Personnages héroïques » citée mais non détaillée dans l'extrait fourni — hors périmètre tant qu'elle n'est pas transcrite.) | RAW Polaris [VÉRIFIÉ] + [HORS PÉRIMÈTRE — règle optionnelle non transcrite] |
| **Dépense de groupe** | Quand un bénéfice profite à tout le groupe, **chaque** joueur concerné paie son propre point ; si l'un ne peut pas (`chc = 3`), un autre doit payer à sa place. | RAW Polaris [VÉRIFIÉ] |

---

## 2. Test de Chance — déclenchement et formule

- **Déclenché par le MJ** (narratif, « un événement va-t-il affecter le personnage ? ») ou **par le système** (combat — déjà transcrit dans `REGLESYSCOMBAT.md` : barrage, tir furtif, AOE longue/extrême portée). Jamais uniquement à l'initiative du joueur, sauf suggestion **validée par le MJ**.
- Formule unique : `1D20 ≤ chc + modificateur`. Le **sens** du modificateur est contextuel (ex. barrage : bonus du tireur *réduit* la Chance de la cible — inversé par rapport à l'habitude). La primitive ne connaît pas le contexte, seul l'appelant fournit un modificateur déjà signé.
- **Test de groupe** : majorité tranche, égalité = pile ou face. [HORS PÉRIMÈTRE V1] — aucun consommateur identifié parmi les chantiers en attente (tir de suppression, AOE, Usure L8) ; pas d'UI dédiée à construire pour l'instant.
- **Modificateurs narratifs selon probabilité de l'événement** (+7 à +10 / … / -13 à -15, RÈGLE AVANCÉE). [HORS PÉRIMÈTRE V1] — n'a de sens que si un Test de Chance narratif MJ est lui-même outillé, ce qui n'est pas requis pour débloquer les chantiers en attente.

---

## 3. Dépense — les usages

### 3.1 Événement favorable — forçage d'un Test de Chance — **V1**

Coût **1 pt**. Remplace un Test de Chance par une réussite automatique — le joueur paie au lieu de lancer le dé. Usage identifié et prioritaire : la cible PJ d'un tir de barrage ou d'une AOE longue/extrême portée peut forcer sa propre esquive plutôt que de risquer le jet (`REGLESYSCOMBAT.md:1550`).

Le cas « bénéfice de groupe » (chaque joueur paie, cf. §1) n'a pas de consommateur combat identifié aujourd'hui. [HORS PÉRIMÈTRE V1 pour ce sous-cas — la garde de dépense individuelle suffit à couvrir 3.1]

### 3.2 Réduction de gravité — Blessures — **V1**

Déclencheur : le personnage subit une Blessure **grave, critique ou mortelle** (`WOUND_SEVERITIES` : `legere < moyenne < grave < critique < mortelle`). 1 pt = -1 degré sur cette échelle, 2 pts = -2 degrés (maximum 2 points en une seule fois — sauf exception ci-dessous). Point d'accroche : après calcul de `finalSeverity`, avant persistance de la blessure.

Exception RAW : si le palier cible n'a plus de case disponible (compteur plein), le joueur doit continuer à dépenser au-delà du plafond de 2 points pour descendre encore d'un cran — la restriction normale de 2 points max ne s'applique plus dans ce cas précis.

**Mort subite** (RAW : dépenser des points pour éviter la mort, ne subir « qu'une Blessure critique ») : [HORS PÉRIMÈTRE V1 — dépendance non résolue, RAW existe mais le moteur ne le couvre pas]. Le RAW est complet et déjà transcrit : `REGLEBLESSURES.md:26` place « Mort subite/Membre détruit » au seuil 30, **un 6ᵉ palier au-delà de « mortelle »** (seuil 25) — « aucun espoir n'est plus permis, le personnage meurt sur le coup » (`REGLEBLESSURES.md:164-167`). Or `WOUND_SEVERITIES` (`shared/woundConstants.js`) s'arrête à 5 paliers (`legere…mortelle`), et **aucune mécanique de mort de personnage n'existe nulle part dans le projet** (vérifié : ni colonne `is_alive`/équivalent en base, ni état runtime côté serveur). Ce n'est donc pas un manque de RAW, c'est un manque dans le moteur de gravité lui-même — un gap préexistant, indépendant de ce chantier. Ne pas l'improviser ici.

Note annexe RAW (`REGLEBLESSURES.md:168-172,368`) : « Membre détruit » (même seuil 30, mais localisé Bras/Jambe) ne tue pas immédiatement — c'est une blessure sévère distincte qui redevient une Blessure critique après guérison. Seule la vraie « Mort subite » (Corps/Tête) est concernée par le geste de sauvetage Chance.

### 3.3 Réduction de gravité — Maladies, poisons, drogues, irradiations — **hors périmètre V1**

RAW : 1 pt = -5 points de niveau sur l'échelle concernée (même geste que 3.2, effet numérique différent). [HORS PÉRIMÈTRE V1 — dépendance non résolue, RAW existe mais aucun moteur ne le porte]. Le RAW est en réalité **un domaine entier déjà transcrit et complet**, plus étoffé que prévu : `docs/REGLES/FATIGUE&DOMMAGES.md` p.244-249 couvre trois sous-systèmes parallèles à la même forme que les Blessures (seuils 5/10/15/20/25/30, contraction, évolution, traitement) — **Maladies et poisons** (p.244-247, unifiés sous « niveau de maladie/empoisonnement »), **Drogues/Narco-dommages** (p.248, « niveau d'intoxication »), **Irradiations** (p.249, « niveau d'irradiation »). Aucun des trois n'a de compteur runtime dans le projet (vérifié, aucune colonne ni service). Ce n'est pas une case à cocher à l'occasion de ce chantier : c'est un domaine « États de santé » à part entière, qui mériterait son propre chantier si/quand il devient prioritaire.

### 3.4 Indice / Événement favorable narratif — **V1, mécanique minimale**

[DÉCISION Saar, 2026-09-11] Contrairement au report initialement proposé, ces usages sont **V1** : leur mécanique est triviale et n'a besoin d'aucune résolution automatisée. Concrètement :
- Un bouton générique **« Utiliser sa Chance »**, visible si `chc − 1 ≥ 3` (coût fixe de 1 point pour ces deux usages), qui décrémente 1 point et adresse la demande au MJ (ex. message de chat / notification), sans logique de résolution.
- Couvre à la fois **Indice** (RAW : indice sur le scénario en cours) et **Événement favorable** dans sa version « suggestion du joueur » (opportunité narrative hors combat — RAW : « le MJ est libre de refuser », donc validation humaine, jamais automatisée).
- Le contenu de la fiction (quel indice, quelle opportunité) reste entièrement arbitré par le MJ en dehors du moteur — le rôle du système s'arrête à exposer l'option et à en garder la trace (dépense + qui l'a demandée).
- Distinct de 3.1 : ce bouton **n'a pas d'effet mécanique automatique**, contrairement au forçage combat qui retire réellement une cible de `resolveTargets`.

### 3.5 Coup de pouce — **reporté V2, pas abandonné**

Coût 1 pt (ou 2, à la discrétion du MJ, sur un Test non-aléatoire). Avant un Test de Compétence ou d'Attribut : +5 exceptionnel, mais la marge de réussite du Test est **forcée à 0** (toute Réussite critique est ignorée). Ne s'applique jamais à un Test de Chance lui-même (redondant avec 3.1).

[DÉCISION Saar, 2026-09-11] Reporté explicitement en V2 — **noté, pas oublié**. Raison technique : cet usage touche potentiellement le calcul générique de marge dans `polarisTestResolution.js`, donc un périmètre plus large que la seule Chance (n'importe quel Test de Compétence/Attribut, y compris les jets de combat). Mérite un cadrage dédié plutôt qu'un ajout risqué à ce chantier.

---

## 4. Régénération

### 4.1 Catastrophe (Marge d'échec ≥ 15) — **V1**

Sur un Test aléatoire, une Catastrophe donne automatiquement +1 point de Chance, **sauf si `chc ≥ 15`**. Alternative laissée au joueur : refaire le Test au lieu de gagner le point (choix mutuellement exclusif, pas un cumul des deux).

Point d'accroche identifié : `catastropheRisk` est déjà calculé par `shared/polarisTestResolution.js` sur chaque résolution de Test — même famille de mécanisme que `applyCriticalFailReroll` (reroll sur échec critique déjà en place). Le hook de régénération + le choix joueur (gagner le point / relancer) se greffe sur ce flux existant, sans nouveau moteur de résolution.

[DÉCISION Saar, 2026-09-11] Câblage **système entier**, pas limité au combat : une mécanique de
Chance qui ne fonctionnerait que « parfois » (uniquement dans un contexte donné) serait
incohérente en termes de game design — soit elle s'applique partout où le RAW la prévoit, soit
elle ne s'implante pas. **Aucune distinction PJ/PNJ** : même câblage pour tout `char_sheet` qui a
un `chc` — un PNJ jetable qui finirait à 20 en Chance avant d'être jeté ne change rien au jeu, et
filtrer coûterait plus de code que ça n'en économise. Garde-fou proposé par Saar : chaque regain
déclenche un message de chat adressé au MJ, avec une action d'annulation, pour couvrir les cas où
un Test mécaniquement en Catastrophe ne devrait pas, de l'avis du MJ, déclencher de regain. Le MJ
reste l'arbitre final — cohérent avec le reste du chapitre Chance, où le MJ tranche déjà librement
(« Événement favorable », « Indice », suggestions du joueur). Détail technique du câblage :
`PLAN_CHANCE.md` §5.

### 4.2 Bonne idée / interprétation remarquable — **V1, zéro développement**

Octroi manuel du MJ, à sa discrétion (RAW : ~1-2 fois par scénario/joueur, jugement MJ). Déjà entièrement couvert par l'édition existante du score : `PUT /api/char-sheet/:characterId/chc` (`char-sheet.js:480`) + champ éditable `CharacterSheet.jsx:258-260,588`. **Aucun nouveau mécanisme à construire.**

### 4.3 Accomplissement de scénario — **V1, zéro développement**

Barème indicatif de fin de scénario/campagne (0/1/2 points + bonus, RAW §« Accomplissement »). Même remarque que 4.2 : édition manuelle du score existant, aucun outillage supplémentaire requis pour la V1 (un futur outil de « clôture de scénario » assisté pourrait exister, mais n'est pas nécessaire pour ce chantier).

---

## 5. Récapitulatif V1 / V2

| Usage | Catégorie | Statut | Raison |
|---|---|---|---|
| Test de Chance (formule + modificateur) | Test | **V1** | Primitive partagée, déjà nécessaire aux chantiers en attente |
| Test de groupe | Test | Hors périmètre V1 | Aucun consommateur identifié |
| Modificateurs narratifs (probabilité) | Test | Hors périmètre V1 | Dépend d'un Test narratif MJ non outillé |
| Événement favorable — forçage combat | Dépense | **V1** | Débloque tir de suppression + AOE longue/extrême |
| Réduction gravité — Blessures (grave/critique/mortelle) | Dépense | **V1** | Système de gravité déjà en place (`woundConstants.js`) |
| Réduction gravité — Mort subite | Dépense | Hors périmètre V1 | RAW complet (`REGLEBLESSURES.md`, seuil 30) mais aucune mécanique de mort de personnage dans le moteur |
| Réduction gravité — Maladies/poisons/drogues/irradiations | Dépense | Hors périmètre V1 | RAW complet (`FATIGUE&DOMMAGES.md` p.244-249, 3 sous-systèmes) mais aucun compteur runtime dans le projet |
| Indice / Événement favorable narratif | Dépense | **V1** | Mécanique minimale (bouton + décrément + note MJ), zéro résolution |
| Coup de pouce (+5, marge forcée à 0) | Dépense | **V2 — reporté** | Périmètre moteur générique plus large, cadrage séparé nécessaire |
| Régén. — Catastrophe | Régénération | **V1** | Hook naturel sur `catastropheRisk` déjà calculé |
| Régén. — Bonne idée / interprétation | Régénération | **V1** | Zéro dev — édition `chc` déjà existante |
| Régén. — Accomplissement scénario | Régénération | **V1** | Zéro dev — édition `chc` déjà existante |

---

## 6. Dépendances et risques d'implémentation

- **`chc` devient une valeur qui varie en cours de séance**, alors qu'il est aujourd'hui affiché/édité comme un score de fiche relativement stable (proche d'un Attribut figé). Vérifier en implémentation qu'aucun affichage actuel (`CharacterSheet.jsx`, tout calcul dérivé du score de Chance) ne suppose implicitement une valeur constante. Pas d'événement générique `char_sheet` dans le projet : la mise à jour voyage dans les payloads des événements combat existants pour les usages en combat, et via un mécanisme dédié restant à construire pour le bouton narratif hors combat (détail technique : `PLAN_CHANCE.md` §5 et §8).
- **Mort subite** (§3.2) : RAW transcrit et vérifié (`REGLEBLESSURES.md:26,164-167`), mais dépendance externe sur une mécanique de mort de personnage non implémentée (moteur de gravité limité à 5 paliers, aucun état de mort en base). Ne pas l'improviser dans ce chantier — signaler le gap séparément si pertinent.
- **Maladies/poisons/drogues/irradiations** (§3.3) : RAW transcrit et complet (`FATIGUE&DOMMAGES.md` p.244-249), mais dépendance externe sur un domaine « États de santé » entier non implémenté (3 sous-systèmes, aucun compteur runtime). Idem, gap séparé — à ne pas sous-dimensionner si un jour il est cadré.
- **Coup de pouce** (§3.5) : reporté V2 précisément parce que son extension du calcul de marge dans `polarisTestResolution.js` peut avoir un rayon d'effet large (tout Test de Compétence/Attribut) — à cadrer isolément avant d'y toucher.
- **Garde de dépense de groupe** (§1, « Dépense de groupe ») : la logique « quelqu'un doit payer pour un joueur à `chc = 3` » suppose une UI capable de désigner un payeur de substitution. Non nécessaire tant que 3.1 (seul usage V1 avec un vrai risque de bénéfice de groupe) reste un cas individuel (une cible = un Test de Chance).
