Phase 1 (budget PC, traduction, accordéon)

    Conformément à CLAUDE.md §6.5 : plan exact avant de coder.

1. Modifications dans creationStore.js
1.1 setStep4Data → merge

Problème : setStep4Data écrase l’objet step4Data au lieu de fusionner.
Cause racine : la fonction actuelle (set({ step4Data: data })) ne conserve pas les champs antérieurs.
Objectif : aligner sur le comportement de setStep1Data, qui utilise { ...(s.step1Data ?? {}), ...data }.
Conséquence : tout appel partiel (ex: setStep4Data({ liveYears: n })) ne détruira plus les autres données de l’étape.

Code cible (dans create):
js

setStep4Data: (data) => set(s => ({
  step4Data: data === null ? null : { ...(s.step4Data ?? {}), ...data },
})),

1.2 getPcDispo → fallback liveYears

Problème : le header lit step4Data?.pcSpent qui n’existe pas avant la soumission de l’étape.
Solution : utiliser step4Data?.liveYears quand pcSpent est absent.

Code cible (dans getPcDispo):
js

const step4Cost = s.step4Data?.pcSpent ?? s.step4Data?.liveYears ?? 0
return PC_TOTAL
  - (s.step1Data?.pcSpent ?? 0)
  - genoCost
  - (s.step3Data?.pcSpent ?? 0)
  - step4Cost
  + (s.step5Data?.pcNet ?? 0)

Garantie retour arrière :

    Après soumission, step4Data.pcSpent est défini → il prime sur liveYears.

    Si l’utilisateur revient d’une étape antérieure et que step4Data est null, liveYears disparaît avec.

    resetCreation remet step4Data à null → liveYears est automatiquement perdu.

2. Modifications dans Step4Experience.jsx
2.1 Ajout de la prop onPcChange

Signature actuelle :
js

export default function Step4Experience({ initialData, pcDispo, onNext, onPrev })

Ajouter onPcChange dans la destructuration.
2.2 Synchronisation du coût PC via useEffect

Placer après la ligne const totalPC = (higherEd ? 1 : 0) + totalCareerYears; :
js

useEffect(() => {
  onPcChange?.(totalPC)
}, [totalPC, onPcChange])

Justification : totalPC est déjà calculé par le composant (c’est le coût exact, pas seulement les années).
Comportement : à chaque ajout/retrait de carrière ou bascule d’enseignement supérieur, le header se met à jour.
3. Modifications dans WizardCreation.jsx
3.1 Ajout de onPcChange sur <Step4Experience>

Avant :
jsx

<Step4Experience
  initialData={step4Data}
  pcDispo={pcDispo}
  onNext={...}
  onPrev={...}
/>

Après :
jsx

<Step4Experience
  initialData={step4Data}
  pcDispo={pcDispo}
  onPcChange={(n) => setStep4Data({ liveYears: n })}
  onNext={...}
  onPrev={...}
/>

Pas de risque d’écrasement car setStep4Data fait désormais un merge.
4. Clé de traduction manquante

Fichier : client/src/locales/fr.json
Section : step4
Ajout :
json

"sub_advantages_and_setbacks": "Avantages & Revers"

5. Composant ProAdvantagesRules.jsx (accordéon)
5.1 Responsabilité

Afficher un accordéon des règles des avantages professionnels (Célébrité, Artisanat, Ateliers, etc.).
Les textes sont externalisés via i18n. Les clés de traduction sont déjà définies dans docs/REGLES/AVANTAGES PROFESSIONNELS.md — l’agent se contente de les référencer.
5.2 Interface
jsx

<ProAdvantagesRules />

Aucune prop requise. Le composant est autonome (état local).
5.3 Comportement

    Un seul élément ouvert à la fois.

    Clic sur un titre fermé → l’ouvre, ferme les autres.

    Clic sur le titre déjà ouvert → le ferme.

    Utilise les classes CSS existantes si présentes, sinon styles inline simples.

5.4 Liste des sections (20)

Célébrité, Artisanat, Ateliers, Assemblage, Bases de données, Bars, Cabine privée, Cabinets médicaux, Concessions minières, Corruption/Chantage, Étal/Petite boutique, Falsification, Fausses identités, Matériel, Parcelles d’élevage/cultures, Pharmacie personnelle, Planque/Cache, Réseau de contrebande, Stock de marchandises, Unité.
5.5 Pattern i18n

Chaque section utilise deux clés : step4.pro_adv_rules.<section>.title et step4.pro_adv_rules.<section>.body.
Ces clés sont documentées dans docs/REGLES/AVANTAGES PROFESSIONNELS.md.
6. Intégration dans ProAdvantagesAndSetbacks.jsx

    Importer ProAdvantagesRules.

    L’insérer dans la colonne gauche, après les blocs de carrière.

    Aucune modification des props ou du reducer existant.

Position :
jsx

<div style={s.colLeft}>
  {/* Blocs carrière existants */}
  {selectedCareers.map(...)}
  {/* Accordéon des règles */}
  <ProAdvantagesRules />
</div>

7. Fichiers touchés (récapitulatif)
Fichier	Nature	Détail
creationStore.js	Modification	setStep4Data merge, getPcDispo fallback liveYears
Step4Experience.jsx	Modification	Prop onPcChange, useEffect synchro totalPC
WizardCreation.jsx	Modification	onPcChange sur <Step4Experience>
fr.json	Modification	Ajout clé step4.sub_advantages_and_setbacks
ProAdvantagesRules.jsx	Création	Accordéon, i18n, intégration
ProAdvantagesAndSetbacks.jsx	Modification	Import + rendu ProAdvantagesRules
8. Validation
Scénario	Résultat attendu
Ajout d’une carrière dans l’étape 4	Le compteur PC du header décroît immédiatement
Retrait d’une carrière	Le compteur remonte
Bascule "Enseignement supérieur"	Le compteur prend en compte le coût du higherEd
Clic "Suivant" sur l’étape 4	step4Data sauvegardé avec pcSpent
Retour de l’étape 5 vers l’étape 4	Le header lit pcSpent (valeur sauvegardée), pas de double décompte
Retour de l’étape 1 vers l’étape 4 (nouveau départ)	step4Data null, liveYears reprend le relais
Accordéon des règles	Une seule section ouverte, ouverture/fermeture au clic
Langue française	Tous les titres et contenus de l’accordéon s’affichent en français

---
Phase 2 : Mécanisation des tirages professionnels

    Dernière mise à jour : 2026-07-21
    Statut : Plan vérifié contre le code existant.
    Sources : creationService.js, careerAdvantages.js, migrations 036, 093, 095, 126.

1. Problème

Les tirages aléatoires d'avantages professionnels (randomBenefits) et de revers (setbacks) sont aujourd'hui purement narratifs : leurs résultats sont stockés en JSONB dans char_careers mais aucun effet mécanique n'est appliqué au personnage. Un joueur qui obtient « Attribut augmenté : Intelligence +1 » ne voit pas son attribut modifié.
2. Objectif

Chaque résultat de tirage doit modifier effectivement les données du personnage (attributs, points de compétence, célébrité, avantages, revenus, désavantages, etc.). Les effets doivent être traçables et réversibles en cas de changement de carrière (retour arrière dans le Wizard).
3. Modèle de données
3.1 Tables modifiées
ref_career_random_benefits
sql

ALTER TABLE ref_career_random_benefits ADD COLUMN effects JSONB DEFAULT '[]';

La colonne points_alt existe déjà et reste inchangée.
ref_setbacks
sql

ALTER TABLE ref_setbacks ADD COLUMN effects JSONB DEFAULT '[]';

char_careers
sql

ALTER TABLE char_careers ADD COLUMN random_effects_applied JSONB DEFAULT '[]';
ALTER TABLE char_careers ADD COLUMN setback_effects_applied JSONB DEFAULT '[]';

char_sheet
sql

ALTER TABLE char_sheet ADD COLUMN celebrity INTEGER DEFAULT 0;

3.2 Table créée
character_career_events
sql

CREATE TABLE character_career_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  char_sheet_id UUID NOT NULL REFERENCES char_sheet(id) ON DELETE CASCADE,
  career_id UUID REFERENCES ref_careers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,         -- 'random_benefit' | 'setback' | 'narrative'
  roll INTEGER,                     -- résultat du dé
  narrative_key TEXT,               -- clé i18n pour les effets narratifs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

4. Format des effects (JSONB)

Chaque entrée de la table ref_career_random_benefits ou ref_setbacks aura une colonne effects contenant un tableau d'objets :
json

[
  { "type": "attribute", "target": "INT", "value": 1 },
  { "type": "skill_points", "value": 2 },
  { "type": "celebrity", "value": 4 },
  { "type": "pro_advantage", "target": "Art/Artisanat", "value": 6 },
  { "type": "income_multiplier", "value": 2.0 },
  { "type": "narrative", "key": "step4.random_benefit.secret" },
  { "type": "disadvantage", "target": "adv_032" },
  { "type": "setback_attribute", "target": "FOR", "value": -1 },
  { "type": "setback_displacement", "value": -25 },
  { "type": "setback_arm_penalty", "value": -5 }
]

Types d'effets supportés
type	target	value	Action
attribute	attr_id (ex: "INT")	nombre	Incrémente char_attributes.pc_modifier
skill_points	—	nombre	Incrémente char_sheet.xp_available
celebrity	—	nombre	Incrémente char_sheet.celebrity
pro_advantage	catégorie (ex: "Art/Artisanat")	nombre	Upsert char_careers.pro_advantages
income_multiplier	—	nombre	Stocké dans char_careers.random_effects_applied
narrative	—	—	INSERT character_career_events
disadvantage	advantage_id (ex: "adv_032")	—	INSERT char_advantages
setback_attribute	attr_id	nombre (négatif)	Décrémente char_attributes.pc_modifier
setback_displacement	—	nombre (négatif)	Stocké dans char_careers.setback_effects_applied
setback_arm_penalty	—	nombre (négatif)	Stocké dans char_careers.setback_effects_applied
5. Service careerRandomService.js

Fichier : server/src/services/careerRandomService.js
5.1 applyCareerRandomBenefits
js

/**
 * Applique les effets des tirages aléatoires pour UNE carrière.
 * @param {Knex.Transaction} trx
 * @param {string} charSheetId
 * @param {string} careerId
 * @param {Array} randomPicks — [{ blockIndex, roll, useAsPoints }]
 * @returns {Array} effets appliqués (pour stockage dans char_careers.random_effects_applied)
 */
export async function applyCareerRandomBenefits(trx, charSheetId, careerId, randomPicks)

Logique interne :

    Pour chaque pick dans randomPicks :

        Lire la ligne ref_career_random_benefits correspondant à career_id + roll

        Si pick.useAsPoints === true, ignorer les effects (le joueur a choisi les points)

        Sinon, parser effects (JSONB) et appliquer chaque effet

    Agréger tous les effets appliqués

    Retourner le tableau agrégé

5.2 applySetbackEffects
js

/**
 * Applique les effets des revers (toutes carrières confondues).
 * @param {Knex.Transaction} trx
 * @param {string} charSheetId
 * @param {Array} setbackRolls — [{ blockIndex, roll }]
 * @returns {Array} effets appliqués (pour stockage dans char_careers.setback_effects_applied)
 */
export async function applySetbackEffects(trx, charSheetId, setbackRolls)

Logique interne :

    Pour chaque roll dans setbackRolls :

        Lire la ligne ref_setbacks où roll_min <= roll <= roll_max

        Parser effects (JSONB) et appliquer chaque effet

    Agréger tous les effets appliqués

    Retourner le tableau agrégé

5.3 Fonctions internes d'application
js

async function applyAttributeEffect(trx, charSheetId, target, value)
async function applySkillPointsEffect(trx, charSheetId, value)
async function applyCelebrityEffect(trx, charSheetId, value)
async function applyProAdvantageEffect(trx, charSheetId, careerId, target, value)
async function applyDisadvantageEffect(trx, charSheetId, target)
async function applyNarrativeEffect(trx, charSheetId, careerId, narrativeKey, roll)

Chaque fonction est responsable d'une modification atomique dans la transaction.
6. Intégration dans creationService.js

Modifier la section STEP 4 de reconcileCreation.
6.1 Avantages aléatoires (dans la boucle carrières)

Après validation des tirages (existante, lignes ~170-190) et avant l'INSERT dans char_careers :
js

// Appliquer les effets mécaniques des tirages
const randomEffects = await applyCareerRandomBenefits(trx, sheetId, career.career_id, career.randomPicks || [])

await trx('char_careers').insert({
  char_sheet_id: sheetId,
  career_id: career.career_id,
  years: career.years,
  savings,
  pro_advantages: JSON.stringify(career.proAdvantages || {}),
  random_picks: JSON.stringify(career.randomPicks || []),
  setbacks: JSON.stringify(career.setbacks || []),
  random_effects_applied: JSON.stringify(randomEffects),
})

6.2 Revers (après la boucle carrières)

Après la validation des setbackRolls (existante, lignes ~145-165) et la boucle carrières :
js

// Appliquer les effets mécaniques des revers
const setbackEffects = await applySetbackEffects(trx, sheetId, setbackRolls)

// Stocker dans char_careers de la première carrière (pour traçabilité)
if (careersData.length > 0 && setbackEffects.length > 0) {
  await trx('char_careers')
    .where({ char_sheet_id: sheetId, career_id: careersData[0].career_id })
    .update({ setback_effects_applied: JSON.stringify(setbackEffects) })
}

7. Rollback

reconcileCreation supprime et recrée toutes les données STEP 4 à chaque appel via trx('char_skills').where({ char_sheet_id: sheetId }).del() et trx('char_careers').where({ char_sheet_id: sheetId }).del(). Les effets sont réappliqués avec les nouveaux tirages. Aucun mécanisme de rollback incrémental n'est nécessaire.
8. Fichiers touchés
Fichier	Nature	Détail
Migration XXX_career_effects.js	Création	Ajout colonnes effects, celebrity, random_effects_applied, setback_effects_applied ; table character_career_events
server/src/services/careerRandomService.js	Création	applyCareerRandomBenefits, applySetbackEffects, fonctions internes
server/src/services/creationService.js	Modification	Appeler careerRandomService dans STEP 4
shared/careerAdvantages.js	Aucune modification	La logique points_alt et computeRandomBudgetDelta reste inchangée
9. Validation
Scénario	Résultat attendu
Tirage « Attribut augmenté : INT +1 »	char_attributes.pc_modifier pour INT incrémenté de 1
Tirage « Relations +2 »	char_careers.pro_advantages contient {"Relations": 2}
Tirage « revenus doublés pour l'année »	char_careers.random_effects_applied contient {"type":"income_multiplier","value":2.0}
Tirage « Chef-d'œuvre » (multiple effets)	Tous les effets listés dans effects sont appliqués
Tirage « Secret » (narratif)	character_career_events contient une ligne avec narrative_key
Revers « Blessure : FOR -1 »	char_attributes.pc_modifier pour FOR décrémenté de 1
Revers « Mauvaise passe » (perte 5 pts compétence)	char_sheet.xp_available décrémenté de 5
Revers « Ennemi »	char_advantages contient une ligne avec le désavantage correspondant
Retour arrière (changement de carrière)	Anciens effets supprimés (wipe STEP4), nouveaux appliqués
Plusieurs tirages dans la même carrière	Les effets s'additionnent correctement
Résultat 10 « ou 7 points à répartir » avec useAsPoints: true	Les effects sont ignorés, seuls les points sont ajoutés au budget
Revers option désactivée (reversEnabled: false)	Aucun effet revers appliqué
10. Hors périmètre

    Population initiale des effects : les données JSONB doivent être remplies pour chaque entrée de ref_career_random_benefits et ref_setbacks. C'est un travail d'édition de données, pas de code. Un script de seed ou une migration séparée pourra être créé.

    Interface utilisateur : l'affichage des effets dans le récapitulatif et dans la fiche personnage sera traité dans un chantier UI dédié.

    Revers avec sous-jets (ex: Blessure qui lance 1D10 pour déterminer quel attribut est touché) : ces sous-jets sont des effets aléatoires qui ne peuvent pas être résolus au moment du seed. Ils seront gérés par des effects de type setback_subroll dans une phase ultérieure. En V1, ces revers auront un effect de type narrative pour que le MJ les résolve manuellement.

---

Phase 3 : Mécanisation complète — tous les métiers, tous les Revers

    Dernière mise à jour : 2026-07-21.
    Statut : Cadrage complet des 6 Lots (A à F) validé par Saar — toutes les décisions de conception
    tranchées, plus aucune inconnue ouverte. Aucun code écrit. Prochaine étape : contrat technique
    exact (forme précise des effects[] pour les 6 Lots) avant le tout premier code.
    Remplace la clause §10 de la Phase 2 sur les sous-jets de Revers ("setback_subroll... narrative
    en V1, phase ultérieure") : un mécanisme réel est conçu ci-dessous (§4), ce n'est plus un repli
    narratif différé.

1. Périmètre exact (ne pas réduire)

Chaque Avantage professionnel aléatoire ET chaque Revers de CHAQUE métier disponible en Wizard
Step4, sans exception :

- Les **37 tables de tirage 1D10** "Avantages professionnels aléatoires" — **[VÉRIFIÉ] tous les
  métiers en ont une, aucun manquant** (correction du 2026-07-21 : un premier comptage par recherche
  textuelle de la phrase "Un avantage aléatoire au choix" avait donné 31, en sous-comptant les
  métiers qui partagent un même modèle de tirage — Officier naval civil/militaire, Officier
  militaire souterrain/surface, Pilote de chasse sous-marin/atmosphérique, les 4 Soldats d'élite.
  Comptage réel par appels `ref_career_random_benefits.insert()` : 32 lignes lot2-6 + 5 lignes
  migration 122 = 37/37). Seul `chasseur_primes` est mécanisé à ce jour (migration 188,
  `resolveCareerRandomEffects`).
- Les **27 Revers** du tableau 1D100 partagé (`ref_setbacks`, migration 126) — colonne `effects`
  présente en base mais vide sur les 27 lignes, aucun effet appliqué nulle part aujourd'hui.

Historique de l'écart à ne pas reproduire : `docs/EN_COURS.md`, bloc "⚡ PROCHAINE ÉTAPE EXACTE"
(item 105) — ce chantier a été redemandé 4 fois par Saar après réduction de périmètre successive
(un métier isolé, puis "avantages seulement" sans les Revers). Ce plan couvre la totalité des deux
corpus ; aucun métier ni aucun Revers n'est différé silencieusement à une "phase ultérieure" sans
que ce soit noté explicitement comme tel dans un Lot ci-dessous.

2. Recherche faite avant conception (pas un travail de zéro)

Précédents externes (chargen RPG à tables aléatoires chaînées, même famille de problème) :

- **Foundry VTT / Pathfinder 2e "Rule Elements"** : chaque effet est un objet JSON déclaratif,
  interprété par un moteur générique — jamais une fonction écrite à la main par capacité de jeu.
  https://foundryvtt.com/article/system-development/ ,
  https://github.com/foundryvtt/pf2e/wiki/Quickstart-guide-for-rule-elements
- **MG-traveller-character-generator** (chargen Traveller open source, tables 100% JSON) :
  vocabulaire d'effet standardisé partagé par les tables de compétence, de mishap et d'événement
  (compétence, caractéristique, DM, **relations Allié/Contact/Rival/Ennemi**, blessure avec
  sélection de la caractéristique touchée). Les événements en cascade ("Disaster → relance sur la
  table Mishap") sont résolus par le moteur générique, pas par une branche de code par événement.
  https://github.com/avorial/MG-traveller-character-generator
- **Traveller Lifepath** (chargen Mongoose Traveller, ~360 tests automatisés) : moteur d'effets
  typé (union discriminante + switch exhaustif), chaque règle vit à un seul endroit et se teste
  isolément. https://groupfinder.eu/library/traveller-lifepath

Précédents internes (même famille architecturale, déjà en production) :

- `shared/weaponModRegistry.js` + `resolveModHooks` (Moding Groupe 4, combat) — registre
  `{ key, priority, hooks }`, explicitement inspiré du précédent PF2e Rule Elements (commentaire
  en tête de fichier, session 167).
- `shared/careerAdvantages.js` → `resolveCareerRandomEffects` — déjà un mini rule-engine sur
  `effects[]` JSONB (`attribute`/`celebrity`/`skill_points`/`category`/`income_percent`/
  `income_multiplier`). C'est le socle à **étendre**, pas à remplacer.

Conclusion directement transposable : les relations Allié/Contact/Ennemi (Lot C ci-dessous) ne
sont pas une extension exotique inventée pour Enclume — c'est un type d'effet de première classe
dans toute implémentation mature de ce genre de système. À concevoir comme un vrai type d'effet
dès le départ, pas comme une rustine ajoutée après coup.

3. Tri des types d'effet — du plus complexe au plus simple

Analyse séquentielle demandée par Saar : un Lot à la fois, dans cet ordre. L'ordre de *codage*
(une fois chaque Lot analysé et validé) pourra différer de cet ordre d'analyse — décision à
prendre Lot par Lot, non figée ici.

### Lot A — Revers en cascade / sous-jets (le plus complexe)

Revers qui, sur un résultat donné, déclenchent un **autre Revers** avec une probabilité
conditionnelle sur un second dé : `Accident`→`Blessure` (1-2/1D10), `Attentat`→`Mutilation`+`Deuil`,
`Catastrophe`→`Blessure`+`Deuil`+`Mutilation`, `Enlèvement`→`Mutilation`, `Pillage`→`Deuil`+
`Blessure`+`Catastrophe`, `Polaris`→ jusqu'à 2 niveaux de chaîne (variante si le personnage a le
Polaris). Plus les Revers à **sous-table propre** (`Blessure` 1D10, `Mutilation` 1D100, `Complot`
1D10, `Contamination/Maladie` 1D10, `Faute lourde` 2D10) et ceux à **relance sur la table mère**
(`Complot`=10, `Faute lourde`=20, `Relancer`=100).

Architecture retenue (§4) : deux nouveaux types d'effet génériques, résolus par un résolveur
récursif — pas une branche de code par nom de Revers.

### Lot B — Désavantages à sous-variante (famille à choisir) — tranché 2026-07-21

`Choc psychologique`→`Phobie` (5 sous-types en base : créatures marines/maladies/mutants/
claustrophobie/sous-marin, `ref_advantages` migration 92) ou `Déséquilibre mental` (6 sous-types :
kleptomanie/mégalomanie/paranoïa/hallucination/psychopathe/personnalités multiples).

**`[CORRIGÉ 2026-07-22, 2e passe critique]`** Erreur trouvée en relisant le texte RAW
(`docs/REGLES/REVERS PROFESSIONNELS.md:84-88`) : *"Choc psychologique (lancez 1D10) [...] souffre du
Désavantage Phobie (1-6 ; voir page 135) ou Déséquilibre mental (7-10 ; voir page 134)."* — **la
famille (Phobie vs Déséquilibre mental) est déterminée par un jet de 1D10, pas un choix à table**
comme écrit précédemment ici. Seule la variante précise **à l'intérieur** de la famille tirée (laquelle
des 5 phobies, laquelle des 6 déséquilibres) reste sans règle de sélection dans le LdB, donc reste
un cas Lot B (`manual_grant_choice`, candidats = les sous-types de la famille tirée par le 1D10).
Techniquement : un `subroll` classique (1D10, deux plages 1-6/7-10) dont chaque `outcome` contient un
`manual_grant_choice` avec les candidats de la famille correspondante — pas un type à part.

`Fugitif`/`Vendetta`/`Contrat`→`Recherché` a 2 sous-types (petite communauté / nation majeure) sans
règle de sélection écrite dans le LdB — ce cas-là reste un vrai choix à table, non tranché par un dé.

**Décision** : le choix de la variante appartient au Joueur et au MJ ensemble, pas à un calcul
automatique. Mécanisme retenu : l'effet du Revers/tirage pointe vers l'écran d'octroi manuel
existant (`AdvantagesPanel.jsx`, session 141, item 71) plutôt que d'inventer un jet ou une règle de
sélection — le Wizard signale "ce personnage doit recevoir Phobie ou Déséquilibre mental, variante
à définir à table" et s'arrête là pour l'automatisation. Aucun nouveau code de tirage/sélection à
écrire pour ce Lot.

**[CORRIGÉ 2026-07-22]** Le détail texte de la variante ("quelle Phobie précisément") ne nécessite
pas de nouvelle colonne sur `char_advantages` — même brique que le Lot C : `char_traits`
(`trait_type` correspondant, `params.note`). Un seul mécanisme générique pour tout le narratif à
variante (Phobie, Déséquilibre mental, Recherché, Infirmité), pas un par cas.

Rejoint ce Lot (même traitement, même écran) : `Mutilation`→`Perte d'un bras`/`Perte d'une jambe`/
`Bras paralysé` — `[VÉRIFIÉ]` mappe sur le Désavantage existant **"Infirmité"** (`adv_056` 5PC
"bras amputé/paralysé...", `adv_057` 7PC "...jambe amputée/paralysée...", `ref_advantages`
migration 92), même famille à variante que Phobie/Déséquilibre mental/Recherché.

`Mutilation`→`Allergie sévère` **sort de ce Lot** : `[VÉRIFIÉ]` `adv_042` "Allergie (sévère)" existe
déjà en base (famille de 3 avec `adv_041` légère / `adv_043` fatale, `ref_advantages` migration 92,
texte confirmé `docs/Character/Creation/REGLE_AVANTAGES.md:118-123`). Le LdB nomme la variante
exacte ("comme le Désavantage Allergie **sévère**", pas un choix de famille) — affectation directe
et automatique vers `adv_042`, sans décision Joueur/MJ. Reclassé en Lot F (déterministe, le plus
simple). De même, `Mutilation`→`Sens diminué` reste un mapping direct (plage 1D100 = un sens
précis, 4 sous-types déjà en base) — également Lot F, jamais vraiment un cas Lot B.

### Lot C — Relations (Allié/Contact/Ennemi/Fournisseur) — beaucoup plus simple qu'estimé, 2026-07-21

Gains dans les tirages aléatoires (`Allié +1/+2/+3`, `Contact +1`, `Fournisseur +1`, upgrade
gratuite "Groupe/Gang" sur un Allié *existant*) et pertes dans les Revers (`Deuil` : -1 Allié ;
`Diffamation` : -1/4 Alliés & Célébrité, -1/2 Contacts ; `Trahison` : -1/4 Alliés, -1/2 Contacts ;
`Ennemi`/`Ennemi important` : +1).

`[CORRIGÉ 2026-07-22]` Fausse piste initiale : `adv_001`/`adv_017`/`adv_050` (`ref_advantages`) ne
conviennent pas — `char_advantages` a une contrainte unique partielle `(char_sheet_id, advantage_id)`
(migration 99), impossible d'avoir 2 lignes actives du même advantage_id, donc pas de moyen de
compter "3 Alliés" avec ce mécanisme.

**[VÉRIFIÉ] La vraie brique, déjà préparée et dormante** : `char_traits` (migration 96,
`{char_sheet_id, trait_type TEXT, params JSONB}`, zéro contrainte d'unicité, déjà listée dans
`vaultService.js` pour le clonage — mais lue/écrite nulle part ailleurs dans le code). Elle
correspond exactement à `docs/Old/PLAN_REWORKFINAL.md` §"LOT 7 — Relations (fiche perso)" : *"jauge
numérique (entier, conversion pts→PNJ à discrétion GM) + champ TEXT libre + lien optionnel vers
fiche PNJ"*, alimentée par `ref_careers.contact_frequency`/`ally_frequency`/`ally_type`/
`opponent_frequency`/`enemy_rule` (colonnes existantes, jamais consommées non plus). Format retenu :
`trait_type: 'ally'|'contact'|'enemy'|'opponent'`, `params: { gauge: number, note: string|null,
pnj_id: uuid|null }`. Aucun nouveau schéma à créer — uniquement câbler la lecture/écriture.

**Décisions Saar, 2026-07-21** :
- **Arrondi des pertes fractionnées** (`Diffamation` : -1/4 Alliés & Célébrité, -1/2 Contacts ;
  `Trahison` : -1/4 Alliés, -1/2 Contacts) : utiliser `polarisRound` (`shared/polarisUtils.js` —
  `Math.floor(x + 0.4)`, convention LdB où 0.5 arrondit vers le bas), la même règle d'arrondi que
  partout ailleurs dans le jeu — pas une règle d'arrondi spécifique à ce Lot.
- **Gain d'Ennemi comme punition** (`Ennemi`, `Ennemi important`, `Vendetta`) : insertion **sans
  compensation PC** — le personnage ne touche pas les points que l'achat volontaire de ce Désavantage
  rapporterait normalement. Même principe que l'octroi manuel existant (`AdvantagesPanel.jsx`,
  `skipBudgetCheck`) qui saute déjà la vérification de budget pour un octroi narratif hors économie
  normale. **`[CORRIGÉ 2026-07-22, peuplement Lot 6]`** cette ligne mentionnait à tort `adv_050`
  ("Ennemi héréditaire") comme mécanisme — contredit par la correction ci-dessus (l.513-516, même
  contrainte unique) : "Ennemi"/"Ennemi important" utilisent `char_traits` (`trait_type:'enemy'`,
  `gauge_delta`), jamais un `advantage_id`, pour rester comptables. Seul "Recherché" (Vendetta,
  Fugitif, Contrat) reste un vrai `advantage_id` (`adv_067`/`adv_068`), jamais compté.

### Lot D — Effets structurels sur la boucle Carrière/Années — précisé 2026-07-21

- **Irradiation** (2D10 points cumulés) : `[VÉRIFIÉ]` la règle existe réellement
  (`docs/REGLES/REGLEBLESSURES.md:1277-1308`, paliers 5/10/15/20/25/30 avec effets de fatigue et
  perte de Constitution) — ce n'est pas une invention. Aucune colonne ne trace ce score aujourd'hui.
  Le Wizard n'a besoin que d'**enregistrer le score de départ** ; le système qui applique les effets
  de palier en jeu est un système séparé (existant ou à vérifier ailleurs), hors périmètre du Wizard.
- **`[CORRIGÉ 2026-07-22, 2e passe critique]` Bannissement/Renvoi/Fugitif ("changement de
  communauté")** : pas purement narratif pour tous les trois — erreur trouvée en relisant le texte
  RAW. Les trois renvoient à la règle *"Perte de travail et changement de communauté"*
  (`docs/Character/Creation/REGLE_CREATION.txt:1224-1232`) : *"pour l'année suivante, le personnage
  n'obtiendra que la moitié de ce qu'il aurait dû gagner (revenu réduit de moitié, 5 points de
  Compétence et 3 points d'Avantages professionnels seulement)."*
  - **Bannissement** et **Fugitif** ont chacun DÉJÀ leur propre effet chiffré plus fort, écrit
    directement dans leur paragraphe (perte TOTALE — pas la moitié — des points de compétence et des
    économies de l'année du Revers). Cette règle générale ne leur ajoute rien de plus fort ; leur
    entrée §5 reste inchangée, le renvoi de page n'est qu'un contexte narratif partagé, pas un
    second effet cumulatif.
  - **Renvoi** est le seul des trois qui n'a **aucun** effet chiffré propre dans son paragraphe — la
    règle "Perte de travail" EST son seul effet mécanique. **Décision Saar 2026-07-22** : appliqué à
    **l'année du Revers elle-même** (pas "l'année suivante" comme le dit le texte RAW littéralement —
    simplification volontaire pour éviter le problème de bloc/carrière suivante qui n'existe pas
    forcément). Effet : revenu de cette année × 0,5 (réutilise `income_multiplier` existant, valeur
    0.5) + plafond de 5 points de compétence et 3 points d'Avantages professionnels pour cette année
    (nouveau type `points_cap`, voir §8.1).
- **"Culte du Trident" (branche Polaris tier 2)** — décision Saar 2026-07-21 : purement narratif. Si
  le joueur accepte de devenir prêtre, le changement de métier (qui toucherait la boucle de sélection
  des carrières, déjà verrouillée à ce stade) se fait manuellement, Joueur et MJ ensemble, hors
  Wizard — pas d'ajout automatique de carrière ici.
- **Emprisonnement** : à la création, l'effet mécanique concret est "+1 an d'âge final, sans année
  de carrière supplémentaire (pas de compétences/salaire pour cette année)". Le jet 1D10 répété
  chaque année est une règle de jeu en cours de campagne, hors périmètre Wizard.
  **`[CORRIGÉ 2026-07-22, 2e passe critique]`** Texte RAW manqué : *"Un personnage peut refuser
  d'aller en prison mais, dans ce cas, il devient un fugitif (avec le Désavantage Recherché qui va
  avec, mais sans les points d'Avantages…)."* — un vrai choix joueur, pas juste "va en prison".
  **Décision Saar 2026-07-22 : "Donc choix et boutons"** — même mécanisme à deux boutons que les
  autres choix du plan (`choice`, §8.1) : option "accepte la prison" → effet déjà décrit ci-dessus ;
  option "refuse" → `manual_grant_choice` (Recherché, 2 candidats petite communauté/nation majeure,
  sans compensation PC, même principe que Lot C) + les effets propres du Revers `Fugitif` (perte
  totale des points de compétence/économies de l'année, cf §5).
- **Fugitif — mécanique progressive hors périmètre** : le texte RAW décrit une chance croissante
  d'être repéré (1/10 la 1ère année après le changement de station, 2/10 la 2e, etc.) — une règle de
  jeu vécue en cours de campagne, jamais à la création. **Décision Saar 2026-07-22 : "Narratif
  uniquement donc"** — non mécanisé, documenté ici pour ne pas la perdre, pas une omission.
- **Contrat — effet différé, pas absent** : *"Ce Revers ne prendra effet qu'au début de la
  campagne"* (`docs/REGLES/REVERS PROFESSIONNELS.md:124-125`). **Décision Saar 2026-07-22 : "Différé
  au début de la campagne, parfait"** — confirmé narratif au moment de la création (l'Ennemi et le
  Recherché ne sont pas accordés pendant le Wizard), dans le même panier que les autres mécaniques
  qui ne se déclenchent qu'après la création (Emprisonnement/Fugitif ci-dessus) — pas besoin d'un
  type d'effet "différé" générique pour ce seul cas.

### Lot E — Effets économie/compétence "pour cette année" — cause racine trouvée, 2026-07-22

Perte sèche de points de compétence ou d'économies "pour l'année", revenus réduits de moitié. Les
primitives existent déjà côté Avantages (`skill_points`, `income_multiplier`).

**Cause racine identifiée** (`[VÉRIFIÉ]`, pas une hypothèse) : `creationService.js` calcule déjà les
économies d'une carrière en un seul total plat (`salaire × années × multiplicateur`), sans découpage
par année ni par tranche — un commentaire déjà présent dans ce fichier (mécanisation des tirages,
migration 188/Étape 1) marque explicitement ce point comme `[HYPOTHÈSE] non tranchée avec Saar`. La
notion de tranche de 5 ans existe pourtant déjà dans le code (`maxBlocks = Math.floor(career.years /
5)`), mais seulement pour valider les bornes d'un tirage — jamais pour calculer les économies bloc
par bloc.

**Décision retenue** (extension directe de ce qui existe déjà, pas un nouveau système) : découper le
calcul des économies par tranche de 5 ans au lieu d'un total unique par carrière. Ça résout d'un coup
trois cas trouvés dans la liste des 37 métiers :
- Le rattachement Revers "quelle carrière/année" (ce Lot E) devient une tranche identifiable.
- Le bonus à échéance de l'Espion ("salaire doublé pendant 1D6 ans") s'applique aux tranches
  concernées, pas à toute la carrière.
- La récompense qui double si le même résultat retombe (Pirate/Voleur, "Mise à prix") se vérifie en
  parcourant les tranches déjà résolues d'une carrière dans l'ordre, plutôt que d'inventer un
  mécanisme d'historique séparé.

Reste à écrire cette règle de calcul par tranche (extension du code existant) ; ce n'est plus une
décision de conception ouverte, ni trois problèmes séparés — un seul.

**Règle de calcul par tranche (2026-07-22)** :

1. Une carrière de `years` années se découpe en tranches de 5 ans déjà existantes (`maxBlocks`),
   plus un reliquat final de `years % 5` années sans tirage (déjà le cas aujourd'hui pour les
   bornes — juste réutilisé ici pour les économies aussi, pas une nouvelle notion).
2. Les effets déjà codés portent déjà la bonne durée dans leur type, pas besoin d'en inventer une
   nouvelle : `income_percent` ("+X% à partir de cette année") est **permanent** — une fois gagné à
   la tranche K, il s'additionne pour la tranche K et toutes les suivantes. `income_multiplier`
   ("salaire doublé pour l'année") est **ponctuel** — ne s'applique qu'à la tranche K elle-même.
3. Les économies totales de la carrière deviennent la somme des économies de chaque tranche
   (salaire × années de la tranche × multiplicateur ponctuel de cette tranche × multiplicateur
   permanent plafonné cumulé jusqu'à cette tranche (`income_multiplier_permanent`, prendre le
   maximum déjà acquis, ne jamais le multiplier une 2e fois) × (1 + % cumulé jusqu'à cette
   tranche)), au lieu d'un seul calcul plat sur toute la carrière. **`[CORRIGÉ 2026-07-22, 5e
   passe]`** cette formule avait été écrite avant l'ajout d'`income_multiplier_permanent` (4e passe,
   15 cas concernés) — codée telle quelle sans cet ajout, l'effet de ces 15 cases aurait disparu
   silencieusement du calcul.
4. **`[PÉRIMÉ]`** Ce point (prolongation "pendant N ans" par tranche) est **superseded** par la
   décision prise plus tard dans la session (§7, §8.1) : le bonus "salaire doublé pendant 1D6 ans"
   de l'Espion a été **retiré de la mécanisation**, classé narratif/roadmap — le même problème
   d'arrondi décrit ici (imprécis à la tranche de 5 ans) a justifié ce retrait plutôt qu'une
   implémentation approximative. Rien à coder pour ce point ; conservé ici seulement pour
   l'historique du raisonnement, pas comme une règle active. Lot 2 ne l'implémente pas.
5. **Récompense qui double si déjà obtenue avant** (Pirate/Voleur, "Mise à prix") : en résolvant la
   tranche courante, vérifier les tranches précédentes de LA MÊME carrière (pas les autres carrières
   du personnage) pour ce même résultat de tirage ; si trouvé, doubler le montant déjà obtenu à
   cette occasion précédente (le montant réel doit donc être conservé par tranche, pas recalculé).
6. **Revers "quelle carrière/année"** : le total d'années cumulées auquel un Revers est tiré se
   traduit en (carrière, tranche) en parcourant la liste des carrières du personnage dans l'ordre et
   en additionnant leurs années jusqu'à atteindre ce total.

### Lot F — Déjà couvert par les primitives existantes (le plus simple)

`attribute` ±1, `celebrity` ±N, `category` +N (peupler les 36 métiers restants + vérifier chaque
nom de catégorie contre `ref_career_point_categories` par métier — ex. "Relations" est une
catégorie valide pour certains métiers, confirmé en base), `income_percent`/`income_multiplier`
positifs (gains des tirages), effets purement narratifs (`Secret`, `Incident mineur sans
conséquence`) déjà neutres par construction. Rejoint depuis §Lot B : `Mutilation`→`Allergie sévère`
(affectation directe `adv_042`, déjà en base) et `Mutilation`→`Sens diminué` (mapping direct plage
1D100 → un des 4 sous-types déjà en base) — aucun des deux n'est un vrai choix Lot B.

4. Architecture validée pour le Lot A (direction confirmée par Saar, 2026-07-21)

Extension du vocabulaire `effects[]` existant (`shared/careerAdvantages.js`), pas un nouveau
système parallèle :

    { "type": "chained_setback", "target": "blessure", "chance": { "die": "d10", "hit": [1, 2] } }
    { "type": "reroll_table", "target": "self", "count": 2 }

Un résolveur récursif générique (nouvelle fonction `resolveSetbackEffects`, même patron que
`resolveCareerRandomEffects`) suit la chaîne : effet `chained_setback` → jet du joueur (serveur
autoritaire, `DICE_RESULT`, identifiant de jet stable — conforme à `.claude/rules/dice.md`) → si
le résultat tombe dans `chance.hit`, applique les effets du Revers `target`, y compris
récursivement si celui-ci chaîne lui-même un autre Revers (cas `Polaris`, 2 niveaux). Aucune
logique par nom de Revers écrite en dur — le comportement de cascade est une propriété du type
d'effet, testable isolément (cf. Traveller Lifepath §2), pas une fonction par Revers.

Résolution manuelle/automatique (tranché avec Saar, 2026-07-21) — deux familles de jets dans une
chaîne, traitées différemment :

- **Jets de "suspense"** (`chained_setback` — est-ce que la conséquence en plus tombe ou non, ex.
  "2 chances sur 10 d'être aussi blessé") : **joueur-initié**, un clic par jet, un par un — c'est le
  seul endroit où l'issue est réellement incertaine pour le joueur.
- **Jets de "détail"** (`subroll` interne à un Revers déjà déclenché — quel attribut est touché,
  quel membre, quelle ligne de la sous-table) : une fois que le suspense a tranché ("oui, il y a
  Blessure"), le détail n'a plus d'enjeu dramatique — résolu automatiquement côté serveur dans la
  foulée, affiché avec le résultat, sans clic supplémentaire.

Concrètement pour "Accident" : 1 clic pour le Revers principal, 1 clic pour savoir si Blessure
tombe (suspense), et si oui le détail de Blessure (quel attribut) apparaît directement sans jet
supplémentaire à cliquer. Pour "Polaris" (pire cas), ça ramène la chaîne à au plus quelques clics
de suspense (les `chained_setback` du tier 1 + tier 2), jamais 9 clics administratifs.

Le serveur reste autoritaire sur tous les jets (y compris les jets "détail" auto-résolus — le
serveur les tire, pas le client), conforme à `.claude/rules/dice.md`.

Lots B à F : architecture à valider Lot par Lot au fur et à mesure de l'analyse séquentielle, pas
figée par avance ici — chaque Lot a ses propres inconnues (§3) qui conditionnent sa conception.

**⚠️ Tentative de code prématurée (2026-07-22), supprimée** — `shared/setbackEffects.js` avait été
écrit sans autorisation (rupture de process : la tâche demandée était la planification, pas le
code) et contenait plusieurs vrais trous de conception, jamais présentés comme décisions avant
d'être codés :
- `grant_advantage` documenté comme type supporté sans aucune implémentation ni test réel.
- Le tier 2 de Polaris (condition "le personnage a la Force Polaris", dépend de `char_advantages`)
  n'est pas représentable par une fonction pure sans contexte externe — pas géré du tout.
- `reroll_table` au niveau racine tranché unilatéralement (levée d'erreur, "Relancer" reclassé en
  `narrative`) sans validation préalable.
- `skill_points` portait deux formes incompatibles (`{value}` delta vs `{mode:'zero'}` remise à
  zéro) sous le même nom de type, jamais signalé comme un choix.
- Aucune agrégation des effets (contrairement à `resolveCareerRandomEffects`), incohérent avec le
  patron annoncé.
- Les 15 tests validaient uniquement la plomberie interne sur des fixtures inventées, pas la
  conformité aux 27 Revers réels.

Code et tests supprimés (jamais commités). Ces points restent des **questions de conception à
trancher dans ce plan**, avant tout nouveau code sur le Lot A — notamment : comment représenter une
condition externe (Force Polaris) dans le résolveur, où s'intègre `grantAdvantage`, une forme
unique par type d'effet, et si l'agrégation doit être la responsabilité du résolveur ou de
l'appelant.

5. Liste complète — les 27 Revers, en français, effet par effet

Catégories (du plus simple au plus complexe) :
- **Effet direct, un seul jet** : Deuil, Ennemi, Ennemi important, Vendetta, Mauvaise passe,
  Irradiation, Diffamation, Trahison.
- **Uniquement narratif, aucun chiffre** : Incident mineur, Renvoi.
- **Redirige vers un Désavantage déjà existant dans le jeu** (choix de la variante exacte à faire à
  table, Joueur+MJ) : Choc psychologique, une partie de Mutilation.
- **Peut déclencher un AUTRE Revers en plus, selon un second jet ("est-ce que ça empire")** :
  Accident, Attentat, Catastrophe, Enlèvement, Pillage, Polaris.
- **Un seul jet choisit directement laquelle de plusieurs conséquences arrive** : Complot, Faute
  lourde, Contamination/Maladie, Blessure, Mutilation.

| Revers | Effet en clair |
|---|---|
| Incident mineur sans conséquence | Aucun effet. |
| Accident | Perd 5 points de compétence cette année. 20% de chances (2 sur 10) d'être aussi blessé (→ Blessure). |
| Attentat | Perd 5 points de compétence cette année. 20% de chances d'être aussi mutilé (→ Mutilation), 50% de chances de perdre un proche (→ Deuil). |
| Bannissement | Perd tous les points de compétence et toutes les économies de cette année. Change de communauté (narratif — **`[VÉRIFIÉ 2026-07-22]`** le Revers a déjà son propre effet chiffré, plus fort que la règle générale "Perte de travail" qu'il référence ; rien à ajouter). |
| Blessure | Un jet de dé désigne l'attribut touché (Force, Constitution, Coordination, Adaptation, Perception, Intelligence, Volonté ou Présence, -1). Sur deux résultats précis de ce même jet : jambe ou bras handicapé en permanence — **impossible à appliquer aujourd'hui**, aucune règle du jeu ne sait représenter un handicap permanent chiffré (à garder en attente, roadmap). |
| Catastrophe | Perd 5 points de compétence et toutes ses économies de l'année. Peut aussi être blessé, perdre un proche, ou être mutilé (jets séparés). S'exile si petite communauté (narratif). |
| Choc psychologique | Un jet de dé décide de la famille : Phobie (1-6 sur 1D10) ou Déséquilibre mental (7-10) — **`[CORRIGÉ 2026-07-22]`**, ce n'est pas un choix à table. Seule la variante précise à l'intérieur de la famille tirée (laquelle des 5 phobies, laquelle des 6 déséquilibres) se choisit à table, Joueur et MJ ensemble. |
| Complot | Un jet de dé décide ce qui arrive vraiment : Contrat, Bannissement, Emprisonnement, Fugitif, mise à pied temporaire (perd compétence et argent de l'année), Renvoi, ou on relance ce même jet. |
| Contamination/Maladie | Un jet de dé décide : guérison simple (perd 5 pts de compétence), ou devient aussi Blessé, ou virus latent (narratif), ou maladie incurable (narratif). |
| Contrat | Se fait un Ennemi de plus et devient Recherché. Ne prend effet qu'au début de la campagne (narratif — **`[CONFIRMÉ 2026-07-22]`** par Saar, non mécanisé à la création). |
| Deuil | Perd un Allié (s'il en a plusieurs, on choisit lequel à table). |
| Diffamation | Perd un quart de sa Célébrité, un quart de ses Alliés, et la moitié de ses Contacts. |
| Enlèvement | Perd tous ses points de compétence et ses économies de l'année. Peut aussi être mutilé. |
| Emprisonnement | Choix du joueur (**`[CORRIGÉ 2026-07-22]`**, deux boutons) : accepte la prison → vieillit d'un an de plus, sans gagner d'année de carrière ; refuse → devient Recherché (variante à choisir à table, sans compensation) et subit les effets du Revers Fugitif. (Le jet annuel "reste en prison ou pas" est une règle vécue plus tard en jeu, pas à la création.) |
| Ennemi | Se fait un Ennemi de plus. |
| Ennemi important | Se fait un Ennemi de plus, plus puissant qu'un Ennemi normal. |
| Faute lourde | Un jet de dé décide : amende (perd son argent), Bannissement, Emprisonnement, Ennemi, Ennemi important, mise à pied temporaire, Renvoi, Vendetta, ou on relance ce même jet. |
| Fugitif | Devient Recherché, perd tout son argent et ses points de compétence de l'année. **`[CORRIGÉ 2026-07-22]`** Chance croissante d'être repéré d'année en année : narratif uniquement, non mécanisé (règle de jeu en cours de campagne, hors périmètre Wizard). |
| Mauvaise passe | Revenus réduits de moitié, perd 5 points de compétence. |
| Mutilation | Un jet de dé désigne précisément la mutilation : perte d'un œil/main/bras/jambe ou bras paralysé (→ Désavantage "Infirmité" déjà existant, variante à choisir à table) ; jambe raide, vitesse réduite de moitié (**impossible à appliquer aujourd'hui**, même souci que Blessure) ; vue/ouïe/odorat/toucher réduits (→ Désavantage "Sens diminué" déjà existant, automatique) ; allergie sévère (→ Désavantage déjà existant, automatique, pas de choix) ; visage marqué/cerveau touché/tremblement nerveux (-1 Présence, Adaptation ou Coordination). |
| Pillage | Perd tout son argent de l'année. Peut aussi perdre un proche, être blessé, ou subir une Catastrophe. |
| Polaris | Peut être blessé, mutilé, subir une Catastrophe ou perdre un proche (plusieurs jets séparés). En plus, si le personnage possède réellement le Polaris : peut devenir fugitif, se faire un ennemi important, être banni, perdre un proche, ou être recruté par le Culte du Trident (narratif — changement de métier possible mais géré hors de la création). |
| Renvoi | Perd son travail. **`[CORRIGÉ 2026-07-22]`** Revenu de l'année réduit de moitié, plafond de 5 points de compétence et 3 points d'Avantages professionnels pour cette année (règle "Perte de travail et changement de communauté", appliquée à l'année du Revers — décision Saar). |
| Vendetta | Se fait un Ennemi de plus et devient Recherché. |
| Trahison | Perd un quart de ses Alliés et la moitié de ses Contacts. |
| Irradiation | Accumule un score de départ (2 dés à 10 faces), utilisé plus tard en jeu (paliers d'irradiation). |
| Relancer ou autre Revers au choix du MJ | Soit on relance le grand tirage depuis le début, soit le MJ choisit un autre Revers directement. |

6. Liste des Avantages professionnels aléatoires — 37 métiers, en français, effet par effet

Les 37 métiers ci-dessous, un par un. Trois décisions transverses (Saar, 2026-07-22) qui
s'appliquent à toute la liste, pour éviter de les répéter à chaque métier concerné :

- **Alliés/Contacts/Ennemis/Opposants** : à la création, ce sont de simples jauges numériques
  (`char_traits`). Conversion "3 Opposants → 1 Ennemi" automatique dès que le seuil est atteint.
  **Important pour la suite** : à ce stade ce ne sont que des chiffres, mais en cours de partie
  chaque unité deviendra un vrai PNJ relié par une clé étrangère — c'est précisément pourquoi
  `char_traits.params` porte déjà un `pnj_id` optionnel (cf. §Lot C) : cette évolution future était
  déjà anticipée dans le choix de schéma, rien à changer.
- **Choix "accepter/refuser"** (Médecin, Diplomate, Espion, Prêtre, Prostitué(e), Sous-marinier/
  Officiers navals, etc.) : une interaction simple à deux boutons suffit, pas une fenêtre complexe.
- **"Formation : ajouter une Compétence (au choix)"** (très fréquent dans la liste) : nécessite de
  présenter au joueur la liste complète des Compétences professionnelles de son métier et de le
  laisser choisir — ce n'est pas un ajout silencieux, une interface de sélection est nécessaire.

Ci-dessous : le premier métier entièrement fait, comme modèle de format pour les 36 suivants.

### Artisan/Artiste — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +1 point de compétence, +2 en Art/Artisanat, +2 Célébrité. |
| 3 | Salaire doublé cette année, +4 Célébrité, +2 points de compétence, +2 Art/Artisanat, +1 Relations. |
| 4 | +10% de revenus à partir de cette année, +2 Célébrité, +2 Étal/Boutique, +1 Relations. |
| 5 | +4 Célébrité, +6 Art/Artisanat, +20% revenus à partir de cette année, +1 Étal/Boutique, +1 Allié. |
| 6 | Revenus triplés cette année, +6 Célébrité, +4 points de compétence, +2 Relations. |
| 7 | +4 Célébrité, +6 Art/Artisanat, +10% revenus à partir de cette année, +1 Contact. |
| 8 | +8 Célébrité, +50% revenus à partir de cette année, +2 points de compétence. |
| 9 | Paye triplée cette année, +4 Art/Artisanat. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus au choix, OU 7 points à répartir librement sur les Avantages professionnels. |

Tous ces effets réutilisent des mécanismes déjà existants ou déjà décidés dans ce plan (attribut,
points de compétence, Célébrité, catégorie d'Avantage pro, revenus, Allié/Contact). Aucun cas
complexe dans ce métier.

### Assassin — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +1 point de compétence, +2 Célébrité, +2 Falsification, +2 Corruption/Chantage. |
| 3 | Aucun effet mécanique — le personnage apprend un secret intéressant (narratif). |
| 4 | +6 Corruption/Chantage. |
| 5 | +2 points de compétence, +4 Célébrité, +4 Falsification, +4 Corruption/Chantage. |
| 6 | +6 Falsification. |
| 7 | +6 Fausse identité. |
| 8 | +5 Célébrité, +10% revenus à partir de cette année, +2 Relations, +1 Allié ou Fournisseur. |
| 9 | +6 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Barman — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +1 Célébrité, +2 Bar. |
| 3 | L'un de ses Alliés reçoit gratuitement l'amélioration Groupe/Gang (narratif pur, confirmé par Saar — aucun effet chiffré, note libre sur le trait concerné). |
| 4 | +4 Célébrité, +2 Relations, +1 Allié, +10% revenus à partir de cette année. |
| 5 | Paye doublée cette année, +1 Bar. |
| 6 | +4 Stock de marchandises, +1 Relations, +10% revenus à partir de cette année. |
| 7 | +8 Relations. |
| 8 | +20% revenus à partir de cette année, +2 Relations, +3 Stock de marchandises. |
| 9 | Aucun effet mécanique — apprend un secret d'un client (narratif). |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Chasseur de primes — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | +10% revenus à partir de cette année, +4 Célébrité, +2 Matériel. |
| 4 | Choix du joueur (**`[CORRIGÉ 2026-07-22]`**, contacté par une grande société) : accepte → +20% revenus à partir de cette année, +4 Célébrité, +4 points de compétence ; refuse → aucun effet (narratif, "des répercussions sur l'avenir du PJ"). |
| 5 | +4 points de compétence, +4 Célébrité, revenu doublé pour l'année. |
| 6 | +2 Célébrité, +8 Relations. |
| 7 | +6 Matériel. |
| 8 | L'un de ses Alliés reçoit gratuitement l'amélioration Groupe/Gang (narratif pur, confirmé par Saar — aucun effet chiffré). |
| 9 | Paie doublée, +2 Célébrité, +2 Matériel. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

*Note : ce métier n'a pas de catégories d'Avantages professionnels de base (`ref_career_point_categories`), mais garde quand même sa table de tirage — déjà mécanisé pour ce métier (migration 188).*

### Contrebandier — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +1 point de compétence, +2 Célébrité, +2 Stock de marchandises. |
| 3 | +2 points de compétence, +4 Célébrité, +4 Stock de marchandises, argent doublé pour l'année. |
| 4 | +2 Célébrité, +10% revenus à partir de cette année, +3 Relations. |
| 5 | +4 Célébrité, +20% revenus à partir de cette année, +5 Relations, +1 Allié. |
| 6 | +1 Relations, +4 Corruption/Chantage, +1 Planque/Cache. |
| 7 | +1 Relations, +4 Falsification. |
| 8 | +6 Relations. |
| 9 | +4 Cache à marchandises, +4 Planque/Cache. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

Tous les métiers de la migration 122 : mêmes mécanismes déjà existants, rien de nouveau. Seuls
points narratifs sans effet chiffré : "Secret" (Assassin résultat 3, Barman résultat 9).

### Cultivateur/Éleveur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Constitution +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Parcelle/Ferme. |
| 3 | +10% revenus à partir de cette année, +2 Célébrité, +2 points de compétence, +2 Parcelle/Ferme. |
| 4 | Développe automatiquement la mutation "Empathie" au niveau 1 (système de mutations déjà existant, pas un nouvel effet). |
| 5 | Aucun effet mécanique — se lie d'amitié avec un dauphin (narratif, animal de compagnie). |
| 6 | +1 Allié, +2 Relations, +10% revenus à partir de cette année. |
| 7 | Revenus doublés cette année, +2 points de compétence, +1 Parcelle/Ferme. |
| 8 | +6 Parcelle/Ferme, +10% revenus à partir de cette année. |
| 9 | +20% revenus à partir de cette année, +2 points de compétence, +2 Célébrité, +2 Parcelle/Ferme. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Diplomate — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Présence +1. |
| 2 | +2 points de compétence, +3 Célébrité, +2 Corruption/Chantage, +1 Cabine privée. |
| 3 | +4 points de compétence, +4 Célébrité, +1 Allié, +2 Ennemis, +2 Relations, +3 Corruption/Chantage. |
| 4 | +6 points de compétence, +6 Célébrité, +1 Allié, +2 Ennemis, +4 Relations, +2 Corruption/Chantage, +2 Cabine privée. |
| 5 | Le joueur choisit : refuse (incorruptible) → +6 Célébrité, +2 Alliés, +4 Relations, +1 Ennemi ; OU accepte → revenus doublés cette année, +2 Relations, +2 Corruption/Chantage, +1 Cabine privée. |
| 6 | +6 Relations. |
| 7 | +6 Cabine privée. |
| 8 | +2 Célébrité, paie doublée cette année, +1 Allié, +4 Relations. |
| 9 | Aucun effet mécanique — connaît un secret important (narratif). |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Érudit/Archéologue — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +2 points de compétence, +3 Célébrité, +2 Bases de données. |
| 3 | +4 points de compétence, +4 Célébrité, +1 Allié, +2 Ennemis, +4 Relations, +4 Bases de données. |
| 4 | +6 points de compétence, +6 Célébrité, +1 Allié, +3 Opposants (ou +1 Ennemi au choix), +4 Relations, +6 Bases de données. |
| 5 | +2 points de compétence, +2 Célébrité, +1 Allié, argent doublé cette année, +20% revenus à partir de cette année, +4 Bases de données. |
| 6 | +3 points de compétence, +4 Célébrité, +2 Alliés, +10% revenus à partir de cette année, +6 Bases de données. |
| 7 | +6 Relations. |
| 8 | +6 Cabine privée. |
| 9 | +8 Bases de données. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

*Note : "Opposants" est une jauge distincte d'"Ennemi" (confirmé par `ref_careers.enemy_rule`,
"3 Opposants s'échangent contre 1 Ennemi") — même mécanisme `char_traits` que les autres relations,
avec sa propre catégorie.*

### Espion — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | Le joueur choisit : refuse (ne peut plus espionner dans le pays qui l'a contacté, narratif) ; OU accepte de devenir agent double (salaire doublé pendant 1D6 ans). |
| 3 | Aucun effet mécanique — apprend un secret intéressant, à définir avec le MJ (narratif). |
| 4 | +6 Corruption/Chantage. |
| 5 | +2 points de compétence, +4 Célébrité, +4 Falsification, +4 Corruption/Chantage. |
| 6 | +6 Falsification. |
| 7 | +6 Fausse identité. |
| 8 | +1 point de compétence, +2 Célébrité, +2 Falsification, +2 Corruption/Chantage. |
| 9 | +6 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Hybride du Trident (G.S.I.) — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Coordination +1. |
| 2 | +2 points de compétence, +2 Célébrité. |
| 3 | Aucun effet mécanique — se lie d'amitié avec un mammifère marin (narratif). |
| 4 | Quel que soit le choix (accepter ou refuser le Soleil noir, narratif) : revenus doublés cette année, +2 Relations, +1 Allié, +1 Ennemi. |
| 5 | Revenus doublés cette année, +3 points de compétence, +3 Célébrité. |
| 6 | Revenus triplés cette année, +4 points de compétence, +4 Célébrité. |
| 7 | Salaire doublé à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, `income_multiplier_permanent` —, +6 points de compétence, +6 Célébrité. |
| 8 | Ajoute une Compétence au choix du joueur à sa liste de Compétences professionnelles, +2 points de compétence, +1 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

*Note : résultat 8 ("Formation") — voir la décision transverse en tête de §6 : présenter la liste
complète des Compétences professionnelles du métier et laisser le joueur choisir.*

### Marchand — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Stock de marchandises. |
| 3 | +10% revenus à partir de cette année, +2 Célébrité, +2 Étal/Boutique, +1 Relations. |
| 4 | Salaire doublé cette année, +4 Célébrité, +4 points de compétence, +4 Stock de marchandises. |
| 5 | Revenus triplés cette année, +4 Stock de marchandises. |
| 6 | +1 Allié, +6 Relations. |
| 7 | +1 Allié, +6 Relations, +4 Stock de marchandises. |
| 8 | +6 Stock de marchandises. |
| 9 | +6 Étal/Boutique, +10% revenus à partir de cette année. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Marchand itinérant/Conteur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Stock de marchandises. |
| 3 | Aucun effet mécanique — connaît un secret découvert en voyage (narratif). |
| 4 | Découverte de reliques : gain d'argent unique, formule 1D100 × 500 sols (même mécanisme que les formules de salaire déjà existantes). |
| 5 | +1 Allié, +2 Célébrité, +4 Relations. |
| 6 | Revenus triplés cette année, +4 Stock de marchandises. |
| 7 | +6 Relations, +1 Allié, +2 Relations (cumulés). |
| 8 | +6 Stock de marchandises. |
| 9 | Salaire doublé cette année, +4 Célébrité, +4 points de compétence, +4 Stock de marchandises. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Médecin/Chirurgien — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Pharmacie personnelle. |
| 3 | +10% revenus à partir de cette année, +4 Célébrité, +2 Cabinet médical. |
| 4 | Choix du joueur (**`[CORRIGÉ 2026-07-22]`**, contacté par une grande société type Cortex) : accepte → +20% revenus à partir de cette année, +4 Célébrité, +3 points de compétence, +2 Cabinet médical ; refuse → aucun effet (narratif, "des répercussions sur l'avenir du PJ"). |
| 5 | Le joueur choisit d'accepter ou non des trafiquants d'organes : s'il accepte, salaire quadruplé pour l'année (sinon aucun effet). |
| 6 | +2 points de compétence, +4 Célébrité, salaire doublé cette année, +2 Cabinet médical, +1 Allié, +2 Relations. |
| 7 | +10% revenus à partir de cette année, +6 Célébrité, +4 Cabinet médical, +1 Allié, +2 Relations. |
| 8 | +5 points de compétence, revenu doublé cette année, +2 Pharmacie personnelle. |
| 9 | +6 Pharmacie personnelle, +4 en Base de données médicales. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Mercenaire — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Constitution +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | +10% revenus à partir de cette année, +4 Célébrité, +2 Matériel. |
| 4 | Choix du joueur (**`[CORRIGÉ 2026-07-22]`**, contacté par une grande société — Légion, Loups des Profondeurs, Cohorte Gabrielle...) : accepte → +20% revenus à partir de cette année, +4 Célébrité, +4 points de compétence ; refuse → aucun effet (narratif, "des répercussions sur l'avenir du PJ"). |
| 5 | +4 points de compétence, +4 Célébrité, revenu doublé pour l'année. |
| 6 | +2 Célébrité, +6 Relations. |
| 7 | +6 Matériel. |
| 8 | +1 Allié, +2 Relations. |
| 9 | Paie doublée cette année, +2 Célébrité, +2 Matériel. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Mineur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Force +1. |
| 2 | Aucun effet chiffré — droits d'une nouvelle concession non exploitée, à définir par le MJ (narratif). |
| 3 | +2 points de compétence, +2 Célébrité, +2 Matériel. |
| 4 | +10% revenus à partir de cette année, +4 Célébrité, +2 Concession (`[CORRIGÉ 2026-07-22]` nom exact de la catégorie en base, pas "Concession minière"). |
| 5 | Paie doublée cette année, +2 Célébrité, +2 Matériel. |
| 6 | +2 Alliés, +4 Relations. |
| 7 | +6 Matériel, +2 Concession. |
| 8 | +20% revenus à partir de cette année, +2 Célébrité. |
| 9 | +6 Concession. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Officier naval/Navigateur (Marine civile) — tirage 1D10

*Table identique pour Officier naval/Navigateur (Marine militaire) ci-dessous — même tirage.*

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | Argent doublé cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 3 | Le joueur choisit d'accepter ou non de rejoindre une confrérie pirate (narratif, changement de métier possible géré hors Wizard, même principe que "Culte du Trident"). Dans tous les cas : +3 points de compétence, +2 Relations, +3 Célébrité. |
| 4 | Paie doublée cette année, +2 Célébrité, +2 Matériel. |
| 5 | Aucun effet mécanique — entend parler d'un secret, d'une carte au trésor ou d'une légende (narratif). |
| 6 | +2 Alliés, +4 Relations. |
| 7 | +20% revenus à partir de cette année, +1 Allié, +3 Relations, +2 Matériel. |
| 8 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 9 | +3 Alliés, +6 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Officier naval/Navigateur (Marine militaire) — tirage 1D10

Table strictement identique à Officier naval/Navigateur (Marine civile) ci-dessus.

### Officier militaire (souterrain) — tirage 1D10

*Table identique pour Officier militaire (surface) ci-dessous — même tirage.*

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Argent doublé cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Argent triplé cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +1 point de compétence, +1 Célébrité. |
| 7 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 8 | +1 Allié, +2 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Officier militaire (surface) — tirage 1D10

Table strictement identique à Officier militaire (souterrain) ci-dessus.

### Ouvrier/Docker — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Force +1. |
| 2 | +2 points de compétence, +2 Célébrité. |
| 3 | +10% revenus à partir de cette année, +4 Célébrité, +2 Matériel. |
| 4 | +2 Alliés, +4 Relations. |
| 5 | Paie doublée cette année, +2 Célébrité, +2 Matériel. |
| 6 | +6 Matériel. |
| 7 | +20% revenus à partir de cette année, +2 Matériel. |
| 8 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 9 | +3 points de compétence, +2 Relations, +3 Célébrité (remarqué par une confrérie pirate, narratif). |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Pilote de chasse sous-marine — tirage 1D10

*Table identique pour Pilote de chasse atmosphérique ci-dessous — même tirage.*

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Salaire doublé cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Salaire triplé cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +1 point de compétence, +1 Célébrité. |
| 7 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 8 | +1 Allié, +2 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Pilote de chasse atmosphérique — tirage 1D10

Table strictement identique à Pilote de chasse sous-marine ci-dessus.

### Pirate — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Matériel, +2 Corruption/Chantage. |
| 3 | Gain d'argent unique : 100 × 1D10 sols, +2 Célébrité, +2 Matériel. |
| 4 | Argent doublé à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, `income_multiplier_permanent` —, +4 points de compétence, +4 Célébrité, +4 Matériel. |
| 5 | +6 Célébrité, plus une récompense en argent. Règle précisée par Saar (2026-07-22) : si ce personnage a déjà obtenu ce même résultat (Mise à prix) sur un tirage précédent, la récompense de cette fois double celle obtenue précédemment ; sinon (première fois), récompense de base = Célébrité × 1000 sols. Nécessite de vérifier l'historique des tirages déjà faits par ce personnage. |
| 6 | Aucun effet chiffré — récupère une carte au trésor, contenu à déterminer par le MJ (narratif). |
| 7 | Le joueur choisit d'être réputé pour respecter ou violer le code des pirates (narratif) : +4 Célébrité, +1 Allié, +4 Relations dans les deux cas. |
| 8 | +6 Célébrité, +4 Relations, +2 Alliés. |
| 9 | Revenus doublés cette année, +4 Célébrité, +2 Matériel. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Policier/Enquêteur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | Revenus doublés cette année, +3 points de compétence, +3 Célébrité. |
| 3 | +1 point de compétence, +1 Célébrité. |
| 4 | Revenus triplés cette année, +4 points de compétence, +4 Célébrité. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, `income_multiplier_permanent` —, +6 points de compétence, +6 Célébrité. |
| 6 | +8 Relations. |
| 7 | +4 Corruption/Chantage, revenus doublés cette année, +1 Ennemi (abus de position). |
| 8 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Prêtre du Trident — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Cabine privée. |
| 3 | +4 points de compétence, +4 Célébrité, +4 Cabine privée (intégré dans un service d'élite du Trident). |
| 4 | Ajoute Acrobatie/Équilibre et Combat au contact à sa liste de Compétences professionnelles (`[CORRIGÉ 2026-07-22]` : ce n'est pas le mécanisme de déblocage `(X)` — vérifié, `ACROBATIE_EQUILIBRE`/`COMBAT_A_MAINS_NUES`/`COMBAT_ARME` n'ont pas ce marker en base ; il s'agit du même mécanisme que "Formation", avec les 2 compétences déjà fixées au lieu d'un choix libre), +2 Célébrité, +4 points de compétence. |
| 5 | Le joueur choisit d'accepter ou non un traître au sein du Trident : accepte → paie doublée à partir de cette année (**`[CORRIGÉ 2026-07-22]`** permanent, probablement plafonné comme les autres cas `income_multiplier_permanent` — RAW ne répète pas explicitement la clause "on ne triple pas" ici, à traiter par cohérence), +4 Matériel ; refuse → paie doublée **pour cette année seulement** (`income_multiplier`, prime ponctuelle), +2 Cabine privée, +2 Relations, +1 Allié, +1 Ennemi. |
| 6 | Même mécanisme que le résultat 5, avec le Soleil noir à la place du traître. |
| 7 | +6 Relations. |
| 8 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 9 | +2 points de compétence, +4 Matériel, +4 Cabine privée, revenus doublés cette année. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Prostitué(e) — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Présence +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Corruption/Chantage. |
| 3 | +4 points de compétence, +2 Cabine privée, +2 Célébrité, +20% revenus à partir de cette année (protection d'une organisation, narratif). |
| 4 | Le joueur choisit d'accepter ou non d'espionner pour un groupe : accepte → +10% revenus à partir de cette année, +2 points de compétence, +4 Matériel, +4 Cabine privée (sinon aucun effet). |
| 5 | +1 Allié, +4 Célébrité, +4 Cabine privée. |
| 6 | +50% revenus à partir de cette année. |
| 7 | Argent doublé cette année, +1 Célébrité, +2 points de compétence. |
| 8 | Aucun effet mécanique — apprend un secret important, monnayable narrativement. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Scientifique/Ingénieur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +2 points de compétence, +3 Célébrité, +2 Bases de données. |
| 3 | +4 points de compétence, +4 Célébrité, +1 Allié, +2 Ennemis, +4 Relations, +4 Bases de données. |
| 4 | +6 points de compétence, +6 Célébrité, +1 Allié, +3 Opposants (ou +1 Ennemi au choix), +4 Relations, +6 Bases de données. |
| 5 | +2 points de compétence, +2 Célébrité, +1 Allié, argent doublé cette année, +20% revenus à partir de cette année, +4 Bases de données. |
| 6 | +3 points de compétence, +4 Célébrité, +2 Alliés, +10% revenus à partir de cette année, +6 Bases de données. |
| 7 | +6 Relations. |
| 8 | +6 Cabine privée. |
| 9 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Soldat/Milicien — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Argent doublé cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Argent triplé cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +1 point de compétence, +1 Célébrité. |
| 7 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 8 | +1 Allié, +2 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Soldat d'élite (Commando marin) — tirage 1D10

*Table identique pour Commando souterrain, Commando surface, et Forces spéciales ci-dessous —
mêmes 4 métiers, même tirage.*

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Argent doublé cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Argent triplé cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +1 point de compétence, +1 Célébrité. |
| 7 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 8 | +1 Allié, +2 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Soldat d'élite (Commando souterrain) — tirage 1D10

Table strictement identique à Soldat d'élite (Commando marin) ci-dessus.

### Soldat d'élite (Commando surface) — tirage 1D10

Table strictement identique à Soldat d'élite (Commando marin) ci-dessus.

### Soldat d'élite (Forces spéciales) — tirage 1D10

Table strictement identique à Soldat d'élite (Commando marin) ci-dessus.

### Sous-marinier — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Constitution +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Le joueur choisit d'accepter ou non de rejoindre une confrérie pirate (narratif, changement de métier possible géré hors Wizard). Dans tous les cas : +3 points de compétence, +2 Relations, +3 Célébrité. |
| 4 | Paie doublée cette année, +2 Célébrité, +2 Matériel. |
| 5 | +10% revenus à partir de cette année, +3 Célébrité, +2 Relations. |
| 6 | Aucun effet mécanique — entend parler d'un secret, d'une carte au trésor ou d'une légende (narratif). |
| 7 | +2 Alliés, +4 Relations. |
| 8 | +20% revenus à partir de cette année, +1 Allié, +3 Relations, +2 Matériel. |
| 9 | +3 Alliés, +6 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Technicien/Mécanicien — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Intelligence +1. |
| 2 | +2 points de compétence, +2 Célébrité, +2 Assemblage, +2 Matériel. |
| 3 | +10% revenus à partir de cette année, +2 Atelier, +3 Célébrité, +2 points de compétence, +2 Matériel. |
| 4 | +4 Célébrité, +4 points de compétence, +4 Assemblage, +4 Atelier, +4 Matériel. |
| 5 | Choix du joueur (**`[CORRIGÉ 2026-07-22]`**, contacté par une grande entreprise, Malgo Huit-pattes ou les Charognards) : rejoindre oui/non, avec un champ texte libre pour le nom de l'organisation (`char_traits`, `trait_type: 'employer'`, `params.note`, même mécanisme que les autres variantes narratives du plan). Rejoint → +2 Atelier, +4 Matériel, +3 Célébrité, +2 points de compétence, +4 Assemblage ; refuse → aucun effet. |
| 6 | Paie doublée cette année, +4 Matériel, +2 Atelier. |
| 7 | +6 Matériel, +1 Atelier. |
| 8 | +4 Célébrité, +6 Assemblage, +20% revenus à partir de cette année, +1 Atelier, +1 Allié. |
| 9 | +10% revenus à partir de cette année, +4 Matériel, +4 Assemblage, +4 Relations, +2 Alliés. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Techno-hybride — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Constitution +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Revenus doublés cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Revenus triplés cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +2 points de compétence, +2 Célébrité. |
| 7 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 8 | +1 Allié, +2 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Veilleur — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Volonté +1. |
| 2 | +2 points de compétence, +2 Célébrité, +1 Matériel. |
| 3 | Revenus doublés cette année, +3 points de compétence, +3 Célébrité, +2 Matériel. |
| 4 | Revenus triplés cette année, +4 points de compétence, +4 Célébrité, +3 Matériel. |
| 5 | Paie doublée à partir de cette année **`[CORRIGÉ 2026-07-22]`** — permanent mais plafonné, ne redouble pas si ce résultat retombe une 2e fois (`income_multiplier_permanent`, pas `income_percent`) —, +6 points de compétence, +6 Célébrité, +4 Matériel. |
| 6 | +8 Relations. |
| 7 | +4 Matériel, +4 Corruption/Chantage, revenus doublés cette année, +1 Ennemi (abus de position). |
| 8 | Ajoute une Compétence au choix à sa liste professionnelle, +2 points de compétence, +1 Relations. |
| 9 | +2 Alliés, +4 Relations. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

### Voleur/Criminel — tirage 1D10

| Résultat | Effet en clair |
|---|---|
| 1 | Adaptation +1. |
| 2 | +2 points de compétence, +2 Célébrité, +4 Matériel. |
| 3 | +3 Célébrité, +4 points de compétence, +2 Relations, +1 Allié. |
| 4 | +2 Célébrité, +2 points de compétence, +4 Matériel, +4 Relations (`[CORRIGÉ 2026-07-22]` le texte source dit "Réseau +4" — Réseau = Relations, catégorie réelle de ce métier ; "Réseau de contrebande" n'existe pas pour ce métier, erreur de transcription initiale corrigée), +10% revenus à partir de cette année. |
| 5 | +4 Célébrité, plus une récompense en argent — même règle que Pirate résultat 5 : double la récompense précédente si déjà obtenue avant, sinon Célébrité × 500 sols (base). |
| 6 | Revenus doublés cette année, +4 Matériel. |
| 7 | +2 Célébrité, revenus doublés à partir de cette année, +1 Allié, +1 Ennemi. |
| 8 | Aucun effet chiffré — possède un animal de compagnie, par exemple un rat-lynx (narratif). |
| 9 | +4 Cache/Planque, +4 Matériel. |
| 10 | Choix du joueur : un des 9 avantages ci-dessus, OU 7 points à répartir librement. |

7. Hors périmètre

Aucun périmètre de métier ou de Revers n'est différé silencieusement — c'est précisément l'écart
des tentatives précédentes. Une seule exception, documentée explicitement (pas une réduction
cachée) :

**Roadmap — handicap permanent chiffré (`Blessure` résultats 9-10, `Mutilation` "Jambe raide")**
Décision Saar 2026-07-21 : documenté comme **narratif uniquement**, pas mécanisé. Vérifié avant
de trancher : `shared/woundConstants.js` a bien un système de blessures **par membre**
(bras_droit/gauche, jambe_droite/gauche), mais c'est un système de blessures **de combat
temporaires** (qui guérissent) — un concept différent d'un handicap **permanent** issu du passé du
personnage. Les règles actuelles du jeu ne permettent pas de représenter "ce membre précis est
handicapé en permanence, réduction de déplacement/malus chiffré" en dehors du combat. Ce n'est pas
un échec de conception : la mécanique manquante est notée ici pour une phase ultérieure éventuelle,
elle ne bloque pas le reste du Lot A (ces deux résultats de sous-table restent narratifs, le reste
de la table Blessure/Mutilation est mécanisé normalement).

**Roadmap — bonus à échéance de l'Espion ("salaire doublé pendant 1D6 ans")** — même principe que
ci-dessus, décidé le 2026-07-22 (§8.1) : la précision par tranche de 5 ans du modèle ne permet pas
de représenter une durée exacte en années sans la déformer. Narratif uniquement, pas mécanisé — un
seul cas sur 397 lignes.

Les `[INCONNU]` restants listés par Lot (§3) sont des décisions à prendre avant de coder ce Lot
précis, pas des exclusions de périmètre.

8. Contrat technique complet — forme des `effects[]`, avant tout code (2026-07-22)

Toutes les décisions prises dans ce document (§4, §Lot E, échanges avec Saar), consolidées en un
seul endroit. Rien de nouveau ici — une mise en forme finale de ce qui a déjà été tranché.

### 8.1 Vocabulaire des types d'effet

| Type | Champs | Portée/durée | Origine de la décision |
|---|---|---|---|
| `attribute` | `target`, `value` | Immédiat, permanent | Déjà codé (`careerAdvantages.js`) |
| `celebrity` | `value` | Immédiat, permanent | Déjà codé |
| `skill_points` | `value` (delta) | Immédiat | Déjà codé — **jamais** de remise à zéro avec ce type |
| `skill_points_reset` | *(aucun champ)* | Remet à zéro les points de compétence de la tranche en cours | Nouveau — nécessaire car le résolveur ne connaît pas le total actuel (§ discussion Lot A point 3) |
| `income_percent` | `value` | Permanent à partir de la tranche courante (incluse) | Déjà codé |
| `income_multiplier` | `value` | Tranche courante uniquement | Déjà codé |
| `category` | `target`, `value` | Immédiat, permanent | Déjà codé |
| `celebrity_reward` | `multiplier` (1000 pour Pirate, 500 pour Voleur) | Immédiat — montant = Célébrité du personnage **après** application des autres effets de la même ligne (ordre = ordre d'écriture dans `effects[]`, cohérent avec le reste de la liste plate) × `multiplier` | Nouveau, explicite (pas de langage de formule générique — un seul cas dans les 397 lignes ne justifie pas un évaluateur générique) |
| `trait` | `trait_type` (`ally`\|`contact`\|`enemy`\|`opponent`\|`irradiation`\|`phobia`\|`mental_imbalance`\|`employer`), `op` (`gauge_delta`\|`gauge_set`), `value`, `note?` | Immédiat, permanent | `char_traits` (§Lot C). `employer` ajouté 2026-07-22 (Technicien/Mécanicien résultat 5, §12) — pas de jauge, juste `params.note` = nom de l'organisation |
| `grant_advantage` | `advantage_id` | Immédiat, permanent | Instruction inerte — jamais d'appel DB depuis le résolveur ; c'est l'appelant qui appelle `grantAdvantage(sheetId, advantage_id, 'revers')` (§ discussion Lot A point 2 — valeur renommée `'trauma'`→`'revers'` le 2026-07-22, voir §18bis) |
| `narrative` | `key` | Aucun effet mécanique | Déjà codé |
| `chained_setback` | `target`, `chance: {die, hit}` | Jet de "suspense" joueur-initié | §4 |
| `subroll` | `die`, `outcomes: [{range, effects}]` | Jet de "détail" auto-résolu | §4 |
| `apply_setback` | `target` | Utilisé uniquement dans un `outcome` de `subroll` | §4 |
| `reroll_table` | `count` (nombre de jets supplémentaires à cumuler) | Utilisé uniquement dans un `outcome` de `subroll` — jamais au niveau racine d'un Revers (erreur explicite sinon, cf. tentative de code du 2026-07-22) | §4 — **`[CORRIGÉ 2026-07-22]`** §8.1 disait "aucun champ", contredisant le `count` déjà prévu en §4 ; incohérence levée. Clarification trouvée en relisant le RAW : "Deux jets sur cette table" (Complot=10, Faute lourde=20) veut dire relancer **deux fois** et cumuler les deux nouveaux résultats (`count: 2`), pas remplacer par un seul nouveau jet — différent du "Relancer" du tableau principal (1D100=100), qui n'est pas un `reroll_table` du tout : c'est le joueur qui relance tout le grand jet 1D100, ou le MJ choisit directement un autre Revers — un choix de flux applicatif, pas un effet du contrat JSON |
| `points_cap` | `scope` (`skill_points`\|`category_points`), `value` | Plafonne le gain de l'année en cours à `value` (n'ajoute rien, ne retire rien si déjà en dessous) | **Nouveau, 2026-07-22 (2e passe critique)** — vient du texte RAW *"Perte de travail et changement de communauté"* (`REGLE_CREATION.txt:1224-1232`), seul effet mécanique propre du Revers `Renvoi` (5 points de compétence, 3 points d'Avantages professionnels max cette année) ; combiné avec `income_multiplier` (valeur 0.5) pour le revenu réduit de moitié |
| `income_multiplier_permanent` | `value` | Permanent à partir de la tranche courante — **mais plafonné** : si déjà appliqué à une tranche antérieure de la même carrière, ne s'additionne pas et ne se recompose pas (garde le maximum, ne remplace jamais un ×2 déjà acquis par un second ×2 cumulé) | **Nouveau, 2026-07-22 (3e passe, audit RAW des 37 métiers)** — trouvé en 15 endroits avec la formule quasi-identique *"La paie est doublée à partir de cette année (on ne triple pas la paie même si on réussit un nouveau jet)"* : Hybride du Trident/7, Officier militaire (souterrain+surface)/5, Pilote de chasse (×2)/5, Pirate/4 ("Confrérie"), Policier/5, Prêtre du Trident/5 ("Traître", branche accepte), Soldat/Milicien/5, Soldat d'élite (×4 versions)/5, Techno-hybride/5, Veilleur/5. Aucun type existant (`income_percent` s'additionne, `income_multiplier` ne dure qu'une tranche) ne représente correctement "permanent mais plafonné, pas recomposé" |
| `choice` | `key` (clé i18n pointant vers les libellés des options), `options: [{effects:[...]}, {effects:[...]}]` | Immédiat — une seule branche appliquée, celle choisie par le joueur | Nécessaire uniquement quand les deux branches donnent des effets **différents** — aucun type de la première passe ne représentait une bifurcation à deux jeux d'effets différents. **Liste corrigée `[CORRIGÉ 2026-07-22, 3e passe]`** : Diplomate/5, Médecin/4 ("Grande société") et /5 ("Trafiquants"), Chasseur de primes/4 ("Grande société"), Mercenaire/4 ("Grande société"), Prostitué(e)/4, Espion/2, Prêtre du Trident/5 et /6, Technicien/Mécanicien/5, Emprisonnement (Revers, §5). **Retirés de cette liste** (vérifiés RAW : même effet quel que soit le choix, donc pas un vrai embranchement) : Officier naval/3, Sous-marinier/3, Hybride du Trident/4 — narratif seulement, une seule ligne d'effets suffit |
| `manual_grant_choice` | `trait_type` (`phobia`\|`mental_imbalance`\|`wanted`\|`infirmity`), `candidates: [advantage_id, ...]` | Signal inerte — pointe vers l'écran d'octroi manuel (`AdvantagesPanel.jsx`), aucun octroi automatique | **Nouveau, 2026-07-22** — le Lot B (§3) décrit déjà ce mécanisme en prose ("le Wizard signale... variante à définir à table") mais aucun type ne le représentait dans le contrat ; couvre Choc psychologique (5 ou 6 candidats), Mutilation→Infirmité (2 candidats), Fugitif/Vendetta/Contrat→Recherché (2 candidats) |
| `money_reward` | `die` (ex. `'1d100'`, `'1d10'`, documente le dé attendu), `multiplier` (nombre fixe) | Immédiat, ponctuel — gain = résultat du dé × `multiplier` sols | **Nouveau, 2026-07-22, corrigé même jour (6e passe)** — pas de langage de formule générique (même principe que le rejet d'`escalating_reward`) ; couvre Marchand itinérant résultat 4 ("1D100×500 sols") et Pirate résultat 3 ("100×1D10 sols"). **Le résolveur ne lance jamais ce dé lui-même** (fonction pure, sans I/O, rappelée à chaque `reconcileCreation` qui recrée tout STEP4 — un vrai tirage interne re-roulerait silencieusement à chaque revalidation). Le sous-jet suit le même circuit que le tirage principal : `socket.emit(WS.DICE_ROLL, {formula: die})` côté client au moment où ce résultat précis tombe, valeur reçue via `DICE_RESULT` stockée dans `pick.moneyRoll` (nouveau champ, à ajouter à `picks` à côté de `choice`) avant soumission ; le résolveur lit `pick.moneyRoll` et multiplie, il ne produit jamais le nombre |
| `grant_mutation` | `mutation_id`, `subtype_id?` | Immédiat, permanent | **Nouveau, 2026-07-22** — instruction inerte, résolue par l'appelant via `addMutation(sheetId, mutation_id, subtype_id)` (`server/src/services/mutationService.js:34`, déjà existant), même patron que `grant_advantage`→`grantAdvantage()` ; couvre Cultivateur/Éleveur résultat 4 ("Empathie" niveau 1) |
| `celebrity_fraction` | `value` (fraction négative, ex. `-0.25`) | Immédiat, ponctuel | **Nouveau, 2026-07-22 (peuplement Lot 6, Diffamation)** — le résolveur n'a jamais accès au total de Célébrité déjà accumulé ; appliqué après coup par l'appelant (`shared/traitAggregation.js#applyFractionalLoss`, `polarisRound`). Seul cas parmi les 27 Revers |
| `trait` op `gauge_fraction_delta` | (extension de `trait`, même champs) | Immédiat, ponctuel | **Nouveau, 2026-07-22 (peuplement Lot 6, Diffamation/Trahison — "un quart/la moitié de ses Alliés/Contacts")** — même principe que `celebrity_fraction` ci-dessus, agrégé par `shared/traitAggregation.js#aggregateTraitGauges` (fraction du gain brut, jamais en cascade entre deux Revers du même type) |
| `irradiation_reward` | `key`, `die` (`'2d10'`) | Immédiat, ponctuel | **Nouveau, 2026-07-22 (peuplement Lot 6, Irradiation)** — même principe que `money_reward` : le résolveur ne lance jamais ce dé, la valeur vient du circuit `DICE_ROLL`/`DICE_RESULT` existant ; devient directement `{type:'trait', trait_type:'irradiation', op:'gauge_delta', value}` |
| `subroll.condition` | (extension de `subroll`, champ `condition?` en plus de `key`/`die`/`outcomes`) | — | **Nouveau, 2026-07-22 (peuplement Lot 6, Polaris tier 2 "Culte du Trident")** — même sémantique que `chained_setback.condition` (§8.2) : sauté sans jet si le contexte externe ne le satisfait pas. Nécessaire ici car "Culte du Trident" n'est pas un Revers nommé (pas de `target` possible pour `chained_setback`) |
| `skill_points_reset` | — | — | **`[RETIRÉ 2026-07-22, peuplement Lot 6]`** ce type (proposé §8.1 initial, jamais implémenté) est superflu : `points_cap(scope:'skill_points', value:0)` — déjà décidé pour Renvoi (`value:5`) — représente exactement la même chose (`value:0` = plafond nul = perte totale de l'année), sans nouveau code. Utilisé pour Bannissement/Enlèvement/Fugitif et les "Mise à pied temporaire" de Complot/Faute lourde |

**"Mise à prix" (Pirate/Voleur, doublement si déjà obtenu avant)** : ce n'est **pas** un type
d'effet séparé — `celebrity_reward` ci-dessus reste la ligne telle quelle. Le doublement est une
règle appliquée par l'appelant, au même endroit que la boucle qui traite déjà les tranches d'une
carrière dans l'ordre (§Lot E) : en résolvant la tranche courante, vérifier si ce même numéro de
tirage a déjà été résolu à une tranche antérieure de la MÊME carrière ; si oui, doubler le montant
qui avait été obtenu à cette occasion-là (pas recalculé depuis la Célébrité actuelle).

**Texte RAW exact** (`docs/REGLES/AVANTAGES ALEATOIRE.md`) —
Pirate résultat 5 (l.603-606) : *« Mise à prix : la tête du personnage est mise à prix par une ou
plusieurs nations. [...] Célébrité +6. Base de la récompense : Célébrité x 1 000 sols. Chaque
résultat « Mise à prix » double cette somme. »*
Voleur/Criminel résultat 5 (l.969-973) : *« [...] Célébrité +4. Base de la récompense : Célébrité
x 500 sols. Chaque résultat Mise à prix double cette somme. »*

**`[RÉSOLU 2026-07-22]`** Les deux textes disent « double **cette somme** », pas « double la somme
de base » — lecture littérale : chaque nouvelle occurrence double le dernier montant obtenu, pas la
base. Donc **composition** : 1re occurrence = Célébrité×1000 (Pirate) ; 2e = ×2 de ce montant ; 3e =
×2 du montant de la 2e (soit ×4 la base) ; etc. Pas de plafond à ×2. Le résolveur doit conserver le
montant réel de chaque occurrence précédente (pas seulement un booléen "déjà obtenu"), pour pouvoir
doubler la bonne valeur à chaque nouvelle occurrence.

**Bonus à échéance de l'Espion ("salaire doublé pendant 1D6 ans")** : `[RETIRÉ 2026-07-22]` le type
`income_multiplier_timed` proposé plus tôt reposait sur un arrondi à la tranche de 5 ans non
justifié, qui aurait pu représenter incorrectement un résultat de dé explicite (ex. arrondir "3 ans"
à "0" ou "5" selon la position dans la tranche fausse le résultat réel du jet, ce n'est pas un
arrondi acceptable). Ce cas suit exactement le même traitement que le handicap permanent chiffré de
Blessure/Mutilation (§7) : la précision par tranche de 5 ans du modèle ne permet pas de représenter
une durée exacte en années sans la déformer — **narratif uniquement, roadmap**, pas mécanisé. Un
seul cas sur 397 lignes, même principe déjà validé par Saar, pas une nouvelle exception inventée.

### 8.1bis Célébrité de référence pour `celebrity_reward` — précision manquante, trouvée 2026-07-22

`resolveCareerRandomEffects(picks, benefitRows)` (`shared/careerAdvantages.js`) est une fonction pure
**par carrière** : elle ne connaît que les picks de CETTE carrière, pas la Célébrité déjà accumulée
par le personnage sur ses carrières précédentes. Or "Célébrité × 1000/500" (Pirate/Voleur) doit
presque certainement porter sur la Célébrité **totale du personnage à ce point de sa chronologie**
(base + toutes les carrières précédentes déjà résolues), pas seulement le delta de célébrité de la
carrière en cours. Le contrat actuel ne précise pas ce point — il faut ajouter un paramètre d'entrée
(Célébrité cumulée avant cette carrière) au résolveur ou à son appelant. Ajouté à la liste §8.4.

### 8.1ter Aggrégation : deux résolveurs, deux règles différentes — contradiction trouvée et levée, 2026-07-22

Le §8.3 ci-dessous affirme "jamais agrégé en un seul total" — mais `resolveCareerRandomEffects`
(le résolveur **déjà en production** pour les Avantages de carrière, que ce plan désigne lui-même
comme "le socle à étendre, pas à remplacer", §2) agrège déjà tout en totaux scalaires
(`totals.celebrity`, `totals.skillPoints`, `totals.incomeMultiplier` composé par multiplication,
etc. — vérifié en lisant le fichier). `creationService.js:511` consomme directement ces totaux
agrégés pour calculer les économies. La règle "jamais agrégé" du §8.3 ne peut donc pas s'appliquer
telle quelle à ce résolveur sans le réécrire entièrement — ce que Phase 2 §8 interdit explicitement
("Aucune modification" sur la logique de `careerAdvantages.js`).

**Levée de la contradiction** : la règle "sortie plate, jamais agrégée" du §8.3 ne s'applique qu'au
**nouveau** résolveur de Revers (`resolveSetbackEffects`, Lot A) — parce que lui seul a une
résolution en plusieurs étapes (jets de suspense joueur-initiés) qui rend une agrégation immédiate
impossible. `resolveCareerRandomEffects` garde son patron d'agrégation existant et est **étendu**
(pas remplacé) pour accumuler les nouveaux types : `totals.traits` (liste d'opérations `char_traits`
à appliquer), `totals.grantedAdvantages` / `totals.grantedMutations` (listes d'instructions à
exécuter par l'appelant, pas des scalaires), `totals.moneyRewards` (liste, un jet serveur par
entrée). `celebrity_reward` reste un scalaire ajouté à `totals.celebrity`, calculé au moment où
l'effet est rencontré dans la boucle (donc après les `celebrity` de la même ligne qui le précèdent
dans le tableau `effects[]`, conforme à la règle d'ordre du §8.1) — mais voir §8.1bis : la valeur de
départ de `totals.celebrity` doit être initialisée à la Célébrité déjà accumulée, pas à 0.

**Risque concret si ce point n'est pas traité avant le peuplement des données** : le `switch` de
`resolveCareerRandomEffects` a un `default: break` — un type d'effet inconnu est **silencieusement
ignoré**, sans erreur ni log. Peupler les `effects[]` des 37 métiers avec `trait`/`celebrity_reward`/
`grant_advantage`/`grant_mutation`/`money_reward`/`choice` sans avoir d'abord étendu ce switch
produirait des données qui *ont l'air* correctes en base mais n'ont **aucun effet réel** sur la
fiche de personnage — silencieusement. C'est exactement le mode d'échec ("ça a l'air fait, ça ne
l'est pas") que ce chantier a déjà connu 4 fois. Ajouté explicitement en §8.4.

### 8.2 Condition externe (Force Polaris, Polaris tier 2)

Le résolveur ne reçoit jamais de condition à évaluer lui-même. L'appelant (`creationService.js`,
qui a déjà accès à `char_advantages`) vérifie *avant* d'invoquer le résolveur si le personnage
possède la famille "Force Polaris" (`adv_077`/`adv_078`/`adv_079`), et ne transmet la suite de la
chaîne (les `chained_setback` du deuxième groupe de conséquences) que si c'est vrai. Le résolveur
lui-même ne connaît que les `effects[]` qu'on lui donne à résoudre.

### 8.3 Forme de sortie du résolveur

Liste plate d'effets (jamais agrégée en un seul total — décision confirmée, traçabilité narrative).
Retour `{status:'pending', kind:'roll'|'choice', die?, options?, reason}` tant qu'un jet ou un choix
manque, `{status:'done', effects: [...]}` une fois tout résolu — **`[CORRIGÉ 2026-07-22, 5e passe]`**
la forme `{status:'pending', die, reason}` d'origine ne prévoyait que l'attente d'un jet de dé ;
le type `choice` (ajouté en 2e passe) attend une **décision** du joueur, pas un jet — `kind`
distingue les deux, `options` remplace `die` quand `kind==='choice'`.

**Entrée du résolveur — même trou côté `choice`** : ni `picks` (`resolveCareerRandomEffects`,
`{blockIndex, roll, useAsPoints}`) ni `setbackRolls` (`creationService.js`, `{blockIndex, roll}`)
n'ont de champ pour la réponse à un `choice`. Les deux structures doivent gagner un champ
supplémentaire (ex. `choice: number` — index de l'option choisie, absent/`null` si la ligne n'a pas
de `choice`) avant de pouvoir coder quoi que ce soit touchant Diplomate/5, Médecin/4+5, Chasseur de
primes/4, Mercenaire/4, Prostitué(e)/4, Espion/2, Prêtre du Trident/5+6, Technicien/Mécanicien/5,
Emprisonnement (Revers) — sans ça, ces lignes n'ont nulle part où atterrir une fois résolues.

**`[CORRIGÉ 2026-07-22, 6e passe]` `picks` a besoin d'un second champ** : `moneyRoll` (résultat déjà
lancé du sous-jet `money_reward`, cf. §8.1) — même raisonnement que `choice`, valeur déterminée avant
soumission via le circuit `DICE_ROLL`/`DICE_RESULT` existant, jamais recalculée par le résolveur.

### 8.4 Ce qui reste réellement à faire avant le premier code

- Peupler les `effects[]` réels en base pour les 27 Revers et les 37 métiers, à partir de la liste
  en français (§5/§6) — travail d'encodage, pas de conception.
- Écrire le résolveur (`shared/setbackEffects.js` ou équivalent) selon ce contrat — attendre
  validation explicite avant ce code, comme convenu.
- Écrire la fonction de découpage par tranche de 5 ans (§Lot E) côté `creationService.js`.
- Câbler le reducer `ProAdvantagesAndSetbacks.jsx` pour la file de sous-jets (§4).
- **Ajouté 2026-07-22 (deuxième passe critique, §8.1bis/8.1ter)** — sans quoi le peuplement des
  données ci-dessus serait silencieusement sans effet :
  - Étendre le `switch` de `resolveCareerRandomEffects` (`shared/careerAdvantages.js`) pour les
    nouveaux types (`trait`, `celebrity_reward`, `grant_advantage`, `grant_mutation`, `money_reward`,
    `choice`, `manual_grant_choice`) — actuellement seuls 6 types sont gérés, tout le reste tombe
    dans un `default: break` muet.
  - Étendre la consommation de ces totaux dans `creationService.js` (aujourd'hui seuls
    `incomeMultiplier`/`incomePercent` sont lus, ligne ~511) : appliquer `totals.traits` (upsert
    `char_traits` + règle de conversion Opposant→Ennemi, cf. §Lot C ci-dessous), exécuter
    `totals.grantedAdvantages`/`totals.grantedMutations`/`totals.moneyRewards`.
  - Passer la Célébrité déjà accumulée par le personnage (carrières précédentes + base) en entrée de
    `resolveCareerRandomEffects`, pour que `celebrity_reward` calcule sur la bonne valeur (§8.1bis).
  - **Règle Opposant→Ennemi, rendue concrète** : `ref_careers.enemy_rule` vaut la même chaîne fixe
    `'3_opposants_echangent_1_ennemi'` sur toutes les carrières concernées (vérifié — pas une règle
    variable par métier, une seule constante). Règle appelant : après tout `trait` de type
    `opponent`, si la jauge cumulée atteint un multiple de 3, décrémenter `opponent` de 3 et
    incrémenter `enemy` de 1 (répéter si plusieurs seuils franchis d'un coup). Un seul cas de valeur
    de `enemy_rule` existe en base ; si une autre valeur apparaissait un jour, traiter en `[INCONNU]`
    plutôt que de généraliser sans avoir vu le second cas.
- **`[VÉRIFIÉ 2026-07-22, 5e passe]` "Opposants" n'est pas une catégorie** — absent de tous les
  `ref_career_point_categories` (vérifié par recherche exhaustive des valeurs distinctes en base).
  Érudit/4 et Scientifique/4 ("+3 Opposants") doivent utiliser l'effet `trait`
  (`trait_type: 'opponent'`), jamais `category` — à noter explicitement lors du peuplement des
  données pour éviter la confusion entre les deux mécanismes.
- **`[VÉRIFIÉ 2026-07-22, 5e passe]` `Planque/Cache` ≠ `Cache/Planque`** — deux noms de catégorie
  réellement différents en base selon le métier (Espion/Contrebandier : `Planque/Cache` ; Voleur :
  `Cache/Planque`). Le §6 utilise déjà la bonne orthographe pour chacun — piège à ne pas casser en
  normalisant les deux en une seule graphie lors du peuplement.

9. Analyse critique finale avant tout code (2026-07-22, contexte proche de l'auto-compact)

Passage à charge sur l'ensemble du plan (§1-§8) avant de coder quoi que ce soit. Points trouvés,
du plus important au plus mineur :

**9.1 `[RÉSOLU 2026-07-22]` Les deux systèmes de "tranches" ne s'alignent pas**
Les Revers (`char_archetype.setback_rolls`) déclenchent tous les 3 ans après la 10e année cumulée
(migration 126). Les Avantages aléatoires de carrière déclenchent tous les 5 ans **par carrière**
(§Lot E). Ce sont deux grilles indépendantes qui ne tombent pas sur les mêmes bornes — un Revers à
l'année cumulée 13 peut tomber au milieu d'une tranche de carrière, pas à sa frontière.
**Décision Saar 2026-07-22** : un Revers "pour cette année" qui tombe au milieu d'une tranche de
5 ans annule **toute la tranche** (`skill_points_reset`/économies à zéro s'appliquent au bloc de 5
ans entier qui contient l'année du Revers), pas un prorata au jour/année près.

**9.2-9.5 `[RÉSOLU 2026-07-22]`** — Les types `escalating_reward`/`income_multiplier_timed` d'origine
ont été retirés (pas assez rigoureux, cf. décision Saar "pas de rigueur = suppression et on
recommence"). Remplacés par : `celebrity_reward` (explicite, ordre de calcul précisé — après les
autres effets de la même ligne, §8.1), le doublement "Mise à prix" traité comme règle de la boucle
carrière (pas un type à part, §8.1 — seule la question de la 3e occurrence reste ouverte, à poser à
Saar), et le bonus à échéance de l'Espion reclassé en narratif/roadmap (§7, même traitement que le
handicap permanent).

**9.6 Le passage à un calcul par tranche modifie une formule existante, jamais vérifié contre les tests actuels**
`creationService.js` calcule aujourd'hui les économies en une seule formule plate. Le découpage par
tranche (§Lot E) change cette formule. Aucune vérification faite ici de quels tests couvrent
aujourd'hui ce calcul, ni du risque de régression sur les carrières déjà mécanisées (chasseur_primes,
migration 188). À faire avant de coder ce point précis.

**9.7 Cohérence documentaire**
Le §3 (Lot A, rédigé le 2026-07-21) ne mentionne pas les types ajoutés depuis (`skill_points_reset`,
`income_multiplier_timed`, `escalating_reward`, la règle par tranche du Lot E) — normal pour un
document qui avance par couches, mais un futur lecteur doit lire §8 (le plus récent) comme la
version qui fait autorité, pas s'arrêter à §3.

Aucun de ces points ne remet en cause le travail déjà fait (liste des 37 métiers/27 Revers, décisions
Lot A-F) — ce sont des questions de dernière précision avant code, principalement concentrées sur
2-3 cas rares (Mise à prix, bonus à échéance) et sur le vrai point dur : l'écart entre les deux
grilles de tranches (§9.1).

10. Deuxième passe critique (2026-07-22, après relecture complète du contrat + vérification code)

Cette passe a relu §1-§9 en entier puis vérifié directement dans le code (`shared/careerAdvantages.js`,
`creationService.js`, migrations `93`/`96`, `mutationService.js`) que le contrat §8 couvre bien tout
ce que §5/§6 décrivent en français. Il ne couvrait pas tout. Trouvé et corrigé directement (décisions
d'architecture, pas de règles de jeu — donc tranchées ici, pas remontées à Saar, conformément à la
délégation qu'il a donnée) :

- **4 types d'effet manquants au contrat**, ajoutés en §8.1 : `choice` (bifurcation à deux jeux
  d'effets, ~10 métiers concernés — Diplomate, Médecin, Prêtre, Prostitué(e), Espion, Officier naval,
  Sous-marinier, Hybride du Trident), `manual_grant_choice` (le Lot B décrivait déjà ce mécanisme en
  prose mais aucun type ne le représentait — Phobie/Déséquilibre mental/Infirmité/Recherché),
  `money_reward` (gains d'argent ponctuels par jet de dé, Marchand itinérant et Pirate résultat 3),
  `grant_mutation` (Cultivateur/Éleveur résultat 4, hameçonné sur `addMutation()` déjà existant).
- **Une contradiction interne** entre §8.3 ("sortie jamais agrégée") et le résolveur déjà en
  production (`resolveCareerRandomEffects`, qui agrège tout en totaux scalaires) — levée en §8.1ter :
  la règle "jamais agrégé" ne s'applique qu'au futur résolveur de Revers, pas à l'existant.
- **Un risque de silence concret** : le `switch` de `resolveCareerRandomEffects` ignore aujourd'hui
  sans erreur tout type d'effet qu'il ne connaît pas encore. Peupler les données des 37 métiers avant
  d'étendre ce `switch` produirait des effets invisibles, sans aucun signal d'erreur — ajouté
  explicitement au §8.4 comme préalable au peuplement, pas comme un détail d'implémentation à part.
- **La Célébrité de référence pour `celebrity_reward`** n'était pas définie (Célébrité de cette seule
  carrière, ou du personnage entier à ce point de sa vie ?) — clarifié en §8.1bis : c'est la seconde,
  ce qui demande un paramètre d'entrée supplémentaire au résolveur.
- **La conversion automatique Opposant→Ennemi** (mentionnée en prose en tête de §6) n'avait aucune
  règle technique associée en §8. Vérifié en base : `enemy_rule` vaut la même constante partout
  (`3_opposants_echangent_1_ennemi`), donc une règle simple et unique suffit — précisée en §8.4.

Questions posées à Saar — **toutes deux tranchées le 2026-07-22** :
1. **§9.1** — Revers à cheval sur une tranche de carrière → perte de **toute la tranche** de 5 ans.
2. **"Mise à prix"** — texte RAW relu (« double cette somme ») → **composition** (×2, ×4, ×8...), pas
   de plafond. Voir §8.1 pour le détail.

**`[CORRIGÉ 2026-07-22]`** La phrase ci-dessus ("§5/§6, déjà correcte") était fausse — cette passe
n'avait vérifié que la couche technique (le contrat §8), pas le contenu du §5 lui-même contre le
texte RAW. Voir §11 : une 3e passe, faite juste après, a trouvé 6 vrais oublis de contenu dans le §5
des Revers. Le §6 (37 métiers) n'a pas encore reçu cette même rigueur.

11. Troisième passe — audit RAW ligne à ligne des 27 Revers (2026-07-22)

Saar : *"Honnêtement, je trouve très étrange que tu ne m'ai appelé à l'aide que pour 3-4
avantages/revers sur les 337 qui existent."* Remarque justifiée — les passes §9/§10 vérifiaient
l'architecture (le contrat, les types d'effet), pas le contenu (chaque Revers relu contre le texte
RAW original, `docs/REGLES/REVERS PROFESSIONNELS.md`, ligne à ligne). Fait ici pour les 27 Revers.
Résultat : **6 vrais oublis de contenu**, tous corrigés directement dans les sections concernées
(§3 Lot B/D, §5, §8.1) :

1. Bannissement/Renvoi/Fugitif référencent tous la règle *"Perte de travail et changement de
   communauté"* (`REGLE_CREATION.txt:1224-1232`) — un vrai effet chiffré que j'avais classé
   "narratif". Résolu : seul `Renvoi` en a réellement besoin (les deux autres ont déjà leur propre
   effet plus fort) ; nouveau type `points_cap` (§8.1) ; appliqué à l'année du Revers, pas "l'année
   suivante" (décision Saar).
2. Choc psychologique : la famille Phobie/Déséquilibre mental est déterminée par 1D10 (1-6/7-10),
   pas un choix à table comme écrit initialement — corrigé §3 Lot B et §5.
3. Emprisonnement : le texte RAW a une branche complète ("refuser la prison → devient fugitif,
   Recherché sans les points") jamais mentionnée — ajoutée comme cas `choice` (§3 Lot D, §5).
4. Fugitif : la mécanique de chance croissante d'être repéré (règle de jeu en cours de campagne)
   n'était pas documentée du tout — ajoutée en hors périmètre explicite (§3 Lot D, §5).
5. Contrat : l'effet différé ("ne prend effet qu'au début de la campagne") était déjà bien classé
   narratif — confirmé, pas une erreur, juste reformulé pour plus de clarté (§5).
6. Incohérence interne trouvée en creusant le "reroll" : §4 et §8.1 se contredisaient sur les champs
   de `reroll_table` — levée, et "Deux jets sur cette table" (Complot/Faute lourde) clarifié comme
   distinct du "Relancer" du tableau principal (§8.1).

**Vérifié et écarté sans suite** : "Narco-dommages", trouvé dans le même document juste après
Mutilation, n'est PAS un 28e Revers — confirmé par Saar 2026-07-22 comme faute de frappe/élément
étranger du LdB à cet endroit (référencé ailleurs, `FATIGUE&DOMMAGES.md`/`REGLEBLESSURES.md`, système
de dégâts séparé). Vérifié aussi : le mapping `Mutilation`→`Infirmité` pour "perte d'un œil/main" ne
posait pas de problème malgré le doute initial — `adv_056`/`adv_057` sont des listes d'exemples ("au
choix"), pas une liste fermée bras/jambe, donc couvrent bien œil/main via le mécanisme `manual_grant_choice`
déjà prévu.

**Ce que ça implique** : le §6 (37 métiers, ~370 lignes) n'a reçu qu'une vérification des noms de
catégorie contre la base, jamais cet audit RAW ligne à ligne. Vu ce que ça a donné pour 27 lignes de
Revers, il est probable que le §6 ait des oublis du même genre (variantes réellement dictées par un
dé plutôt qu'un choix, effets accessoires renvoyés à une autre page, branches de choix non
détectées). **Prochaine étape proposée, pas encore faite** : le même audit RAW pour les 37 métiers,
un par un, contre `docs/REGLES/AVANTAGES ALEATOIRE.md` — avant de pouvoir dire que le plan est prêt.

12. Quatrième passe — audit RAW ligne à ligne des 37 métiers (2026-07-22)

Fait juste après §11, contre `docs/REGLES/AVANTAGES ALEATOIRE.md` en entier. La plupart des 37
tables correspondent au §6 tel qu'écrit (Artisan, Assassin, Barman, Contrebandier, Cultivateur,
Érudit, Espion, Marchand, Mineur, Ouvrier/Docker, Prostitué(e), Scientifique, Sous-marinier,
Technicien vérifiés mot à mot, corrects). Deux catégories de vrais oublis trouvées :

**A. Trouvaille majeure — un type d'effet entier manquait, touche 15 cases sur 37 métiers.**
Texte RAW quasi-identique répété : *"La paie est doublée à partir de cette année (on ne triple pas
la paie même si on réussit un nouveau jet)."* Un doublement **permanent** (pas juste "cette année")
mais **plafonné** — ne se recompose pas si le même résultat retombe dans une tranche ultérieure.
Ni `income_percent` (s'additionne, permanent) ni `income_multiplier` (une seule tranche) ne
représentent ça correctement — nouveau type `income_multiplier_permanent` (§8.1). Concerné :
Hybride du Trident/7, Officier militaire (souterrain+surface)/5, Pilote de chasse (×2)/5,
Pirate/4, Policier/5, Prêtre du Trident/5 (branche "accepte"), Soldat/Milicien/5, Soldat d'élite
(×4 versions)/5, Techno-hybride/5, Veilleur/5 — corrigés directement dans le §6.

**B. 3 choix joueur transformés en effet automatique par erreur** (texte RAW : *"Si le PJ
accepte..."*, refus = aucun effet mais "des répercussions sur l'avenir") : Chasseur de primes/4,
Médecin/4, Mercenaire/4 — corrigés en `choice` dans le §6.

**C. Ma propre liste de "métiers à choix" de la 2e passe (§10) était elle-même fausse** : Officier
naval/3, Sous-marinier/3 et Hybride du Trident/4 donnent **le même effet quel que soit le choix**
("qu'il accepte ou non... dans tous les cas") — retirés de la liste `choice`, corrigée en §8.1.

**`[RÉSOLU 2026-07-22]` Technicien/Mécanicien résultat 5 ("Contact")** — le texte RAW ne précisait
pas si les effets s'appliquent uniquement si le personnage rejoint l'organisation contactée ou dans
tous les cas. Décision Saar : un vrai choix `choice` (rejoindre oui/non), effets seulement si accepté,
plus un champ texte libre pour le nom de l'organisation. **Mécanisme retenu pour ce champ libre** :
en cherchant un mécanisme "avantage libre" existant, trouvé que `char_advantages` avait une variante
`type: 'OTHER'` + `description` TEXT libre (`docs/Character/CHARACTER.md:291-302`,
`AdvantagesPanel.jsx` Module 6) — mais **ce schéma a été entièrement remplacé par la migration 99**
(`advantage_id` FK stricte + `snapshot_data`, plus de colonne `type`/`description`), un piège déjà
documenté dans `docs/VOCABULARY.md:128` (bug réel Session 141 sur du code lisant les champs V1
disparus). `CHARACTER.md` décrit donc un mécanisme mort, pas l'état réel. Retenu à la place :
`char_traits` (`trait_type: 'employer'`, `params.note`), cohérent avec tout le reste du plan, aucun
nouveau schéma.

**Conclusion de ce cycle d'audit (§9-§12)** : la couverture de contenu (§5/§6) et la couverture
technique (§8) sont maintenant vérifiées ligne à ligne pour les deux corpus, pas seulement relues.
Reste : peupler réellement les `effects[]` en base (§8.4) à partir de ce texte, ce qui est un travail
d'encodage suivant un contrat maintenant stable — plus une étape de conception ouverte.

13. Segmentation de l'implantation en lots (2026-07-22)

Le contrat (§8) et le contenu (§5/§6) sont stables — reste à coder. "Lancer l'implantation" n'est pas
une tâche unique : au moins 7 lots distincts, dépendants les uns des autres, à valider un par un
(même principe que l'analyse séquentielle qui a produit ce plan). Numérotés dans l'ordre à suivre ;
ne pas paralléliser au-delà de ce que les dépendances permettent.

**Lot d'implémentation 1 — Extension du résolveur de carrière (fondation, aucune dépendance)**
- Étendre le `switch` de `resolveCareerRandomEffects` (`shared/careerAdvantages.js`) pour les
  nouveaux types : `trait`, `celebrity_reward`, `grant_advantage`, `grant_mutation`, `money_reward`,
  `choice`, `manual_grant_choice`, `income_multiplier_permanent`, `points_cap`.
- Ajouter le paramètre d'entrée "Célébrité déjà accumulée" (§8.1bis) et le champ `choice` sur `picks`.
- Étendre `creationService.js` pour consommer les nouveaux totaux (upsert `char_traits` + règle
  Opposant→Ennemi §8.4, `grantAdvantage()`, `addMutation()`, jets serveur pour `money_reward`).
- Tests : non-régression sur `chasseur_primes` (déjà mécanisé, migration 188) + un cas neuf simple
  sans branche complexe (Artisan) pour valider le switch étendu sans rien casser.
- **Aucune nouvelle donnée en base à ce stade** — uniquement la plomberie.

**Lot d'implémentation 2 — Calcul des économies par tranche (§Lot E)** — dépend du Lot 1
- Remplacer le calcul plat par le découpage en tranches de 5 ans (formule corrigée §Lot E point 3,
  incluant `income_multiplier_permanent`).
- Règle "Mise à prix" (composition ×2/×4/×8, historique des tranches précédentes de la même carrière).
- Tests : non-régression `chasseur_primes`, puis carrière longue synthétique à plusieurs tranches.

**Lot d'implémentation 3 — Résolveur de Revers (Lot A, le plus complexe)** — dépend du Lot 1
(vocabulaire d'effet partagé), indépendant du Lot 2
- Écrire `resolveSetbackEffects` : `chained_setback`, `subroll`, `apply_setback`, `reroll_table`,
  `manual_grant_choice`, `choice`, `points_cap`.
- Condition externe Force Polaris (§8.2, vérifiée par l'appelant avant la suite de la chaîne).
- Format de sortie `{status:'pending', kind:'roll'|'choice', ...}` / `{status:'done', effects:[...]}`.
- Tests sur des cas RÉELS (pas de fixtures inventées — leçon du code supprimé du 22/07) : Accident
  (cascade simple), Polaris (cascade à 2 niveaux, pire cas), Complot (sous-table + "deux jets"),
  Emprisonnement (`choice` imbriqué avec `manual_grant_choice` et renvoi vers Fugitif).

**Lot d'implémentation 4 — Câblage serveur des Revers** — dépend des Lots 2 et 3
- Appeler `resolveSetbackEffects` depuis `reconcileCreation`, appliquer les effets.
- Rattachement carrière/année du Revers (§Lot E point 6) — décision "toute la tranche" déjà tranchée.

**Lot d'implémentation 5 — UI client (`ProAdvantagesAndSetbacks.jsx`)** — dépend du Lot 4
- Reducer pour la file de jets "suspense" (un par un, joueur-initié) et l'affichage des jets "détail"
  auto-résolus.
- UI à deux boutons pour `choice`.
- UI pour `manual_grant_choice` (redirection vers `AdvantagesPanel.jsx`) et champ texte libre
  (`char_traits.note`) pour les variantes narratives.

**Lot d'implémentation 6 — Peuplement des données (397 lignes)** — 6a (37 métiers) dépend du Lot 1
seul, 6b (27 Revers) dépend du Lot 3 seul ; peut démarrer en parallèle des Lots 2/4/5
- Traduire §5/§6 en JSON réel dans les colonnes `effects` — travail d'encodage, pas de conception.
- Par sous-lots vérifiables (ex. un métier ou un petit groupe à la fois), chaque ligne peuplée testée
  individuellement contre le texte RAW, pas juste contre le contrat.

**Lot d'implémentation 7 — Validation transverse et clôture**
- Scénario réel bout en bout (personnage multi-carrières + Revers).
- Mise à jour `EN_COURS.md` (périmé, pointe encore vers l'item 106), `ASBUILT.md`, `CHANGELOG.md`.
- Testé / Non testé, conforme à `CLAUDE.md` §11.

Point pratique non tranché : la plupart des colonnes nécessaires existent déjà depuis la migration
188 — ce chantier est presque entièrement du peuplement de données (UPDATE JSONB), pas de nouvelles
migrations de schéma. Si une migration de schéma s'avère malgré tout nécessaire (ex. contrainte sur
`char_traits.trait_type`), numérotation à confirmer : branche courante `dev/Saar`, ne correspond
littéralement à aucune des trois branches du tableau `CLAUDE.md` §3.

14. Faille de fond — la réconciliation du Wizard n'est pas prête pour les nouvelles écritures (2026-07-22, 7e passe)

Trouvée en lisant `creationService.js` jusqu'au bout, pas en relisant le plan. `reconcileCreation`
protège aujourd'hui exactement deux écritures contre les ré-applications répétées, chacune avec son
propre `.del()` avant réapplication : `char_skills`/`char_careers` en STEP4 (l.430-431),
`char_advantages` en STEP5 (l.667, commentaire explicite l.664-666 : *"pendant le Wizard,
char_advantages n'est écrit que par cette boucle"*). Aucune des nouvelles écritures introduites par
ce plan n'a cette protection.

**1. `char_traits` (Lot C)** — pas de colonne "source", aucun wipe en STEP4. Une ré-soumission du
Wizard sans rien changer réappliquerait les gains `trait` (Allié/Ennemi/etc.) une deuxième fois.

**2. `char_mutations` via `addMutation()` (`grant_mutation`)** — `[VÉRIFIÉ]` `mutationService.js:56`
fait un UPSERT `ON CONFLICT ... DO UPDATE SET count = char_mutations.count + 1` : conçu pour un
octroi ponctuel en jeu (`source: 'campaign'`, l.54), pas pour un résolveur rappelé à chaque
`reconcileCreation`. Cultivateur/Éleveur résultat 4 (seul cas, "Empathie niveau 1") verrait son
niveau grimper à chaque sauvegarde du Wizard, sans nouveau tirage.

**3. `char_advantages` via `grant_advantage`/`manual_grant_choice` (Lot 3/4, Revers) — le plus
grave.** STEP5 fait un `char_advantages.where({char_sheet_id}).del()` **inconditionnel**
(`creationService.js:667`) avant de réappliquer sa propre liste, en s'appuyant explicitement sur
l'invariant "STEP5 est le seul écrivain". Un Ennemi/Recherché accordé par un Revers pendant STEP4
serait **supprimé silencieusement** la prochaine fois que STEP5 se réconcilie — ce qui arrive
normalement juste après, dans le même flux de complétion du Wizard. Perte de données confirmée par
lecture de code, pas une hypothèse.

**Corrections décidées (2026-07-22) — architecture, tranchées ici, pas remontées à Saar** :
- `char_traits` : ajouter `char_traits.where({char_sheet_id: sheetId}).del()` au bloc STEP4, au même
  endroit que le wipe de `char_skills`/`char_careers` (l.430-431), avant réinsertion. Sûr :
  `char_traits` n'a aujourd'hui aucun autre écrivain dans tout le code (vérifié §Lot C).
- `char_mutations` (`grant_mutation`) : ajouter `char_mutations.where({char_sheet_id: sheetId,
  source: 'campaign'}).del()` au même bloc STEP4, avant de rappeler `addMutation()`. Sûr par
  construction : `wizard_locked_at` n'est pas encore posé tant que le Wizard est en cours d'édition,
  donc aucun octroi `'campaign'` légitime (en jeu) ne peut exister sur cette fiche avant complétion —
  le seul écrivain possible de ce sous-ensemble avant `finalize` est `grant_mutation` lui-même.
- `char_advantages` (Lot 3/4) : remplacer le `.del()` inconditionnel de STEP5
  (`creationService.js:667`) par `.where({char_sheet_id: sheetId, acquired_during:
  'creation_step5'})`. Préserve les octrois `'trauma'` de STEP4/Revers tout en gardant STEP5
  ré-exécutable. Le commentaire d'invariant existant (l.664-666, "char_advantages n'est écrit que
  par cette boucle") doit être mis à jour dans le même changement pour refléter la nouvelle portée.

Ces trois corrections sont un prérequis du Lot 1 (`char_traits`/`char_mutations`) et du Lot 3/4
(`char_advantages`) — à coder en même temps que l'extension du résolveur, pas après.

**`[AMENDEMENT, 2026-07-22]`** : toutes les valeurs `'trauma'` mentionnées dans cette section et les
suivantes (`char_advantages.acquired_during`, puis `char_mutations.source` ajouté au Lot 4) ont été
renommées `'revers'` le même jour, à la demande de Saar — même mot que le nom joueur/UI de la
mécanique (docs/VOCABULARY.md "Revers" / "Provenance des octrois"), pour ne pas garder un synonyme
interne. Migration 192 (`char_mutations` uniquement — `char_advantages.acquired_during` n'a pas de
contrainte CHECK, renommage code seul). Le code fait foi (`creationService.js`, `mutationService.js`)
— cette section garde `'trauma'` tel qu'écrit au moment de la décision, ne pas la corriger rétroactivement.

15. Réflexion avant le Lot 3 (résolveur de Revers) — 2026-07-22

Lots 1/2 codés et testés (voir §13, git). Avant de coder le Lot 3, trois points de conception :

**1. Les jets "détail" (subroll auto-résolu) ne doivent jamais être lancés par le résolveur
lui-même** — même raisonnement que `money_reward` (§8.1, §14) : `resolveSetbackEffects` sera une
fonction pure rappelée à chaque `reconcileCreation`, un jet interne re-roulerait à chaque
reconciliation. §4 dit "le serveur tire les jets détail, pas le client" — toujours vrai, mais via le
circuit `DICE_ROLL`/`DICE_RESULT` déjà en place (le serveur reste autoritaire), le résultat stocké
côté client avant soumission. La différence joueur-initié/auto-résolu (§4) est une question d'UX
(bouton à cliquer ou déclenchement immédiat), jamais une question de qui lance le dé.

**2. Force Polaris (§8.2) — pas de nouveau champ JSON `condition`/`requires`.** Un paramètre de
contexte optionnel sur le résolveur (même patron que `celebrityBefore`, Lot 1) ; le résolveur saute
les effets dont la condition n'est pas satisfaite par ce contexte. Le vocabulaire `effects[]` reste
un tableau simple, pas une nouvelle forme de structure pour ce seul cas.

**3. `[REPORTÉ AU LOT 4, PAS OUBLIÉ]`** Les effets économiques d'un Revers (`Renvoi` →
`points_cap`+`income_multiplier`) s'appliquent à une tranche précise d'une carrière précise (§Lot E
point 6) — exactement la structure que `computeCareerBlockSavings` (Lot 2) a construite. Le Lot 3
(`resolveSetbackEffects`, écrit et testé) reste volontairement une fonction pure indépendante de
cette structure, comme `resolveCareerRandomEffects` l'était avant que `computeCareerBlockSavings` ne
l'enrobe — l'intégration (comment brancher la liste plate d'effets d'un Revers dans le bon (carrière,
tranche)) est explicitement le travail du Lot 4, pas du Lot 3. Non résolu à ce stade, mais scopé au
bon lot plutôt que laissé flou.

16. Lot 3 codé (2026-07-22) — `shared/setbackEffects.js`

`resolveSetbackEffects(roll, setbackRows, answers, context)` — résolveur récursif, réutilise
`resolveSetback` (`shared/careerSetbacks.js`) pour le jet 1D100 racine. Points 1 et 2 du §15 mis en
œuvre : aucun jet interne (le résolveur ne consomme que `answers` déjà connu — même principe que
`money_reward`) ; `condition` (Force Polaris) comme paramètre de contexte, pas un nouveau champ JSON.

**Correction trouvée en écrivant les tests** : `apply_setback` avait été restreint dans une version
antérieure du plan (§8.1) "uniquement valide dans un outcome de subroll" — faux à l'usage :
Emprisonnement/refuse en a besoin depuis une option de `choice` (redirection vers Fugitif), pas un
subroll. Restriction levée pour `apply_setback` ; seul `reroll_table` reste propre au subroll (seul
type où la notion a un sens : "relancer CE dé-ci").

**"Deux jets sur cette table"** (Complot=10, Faute lourde=20) : implémenté comme relance du même
subroll `count` fois de plus, clés dérivées `${key}#2`, `${key}#3`... — jamais un simple remplacement,
les effets de chaque relance s'additionnent (vérifié par test : 2 relances distinctes, chacune
redirigeant vers un Revers différent, les deux résultats apparaissent dans la sortie finale).

**Testé** : 11/11 tests sur `setbackEffects.test.mjs`, données réelles (`docs/REGLES/REVERS
PROFESSIONNELS.md`) — Accident (cascade simple, une seule question à la fois), Polaris (cascade à 2
niveaux, tier 2 sauté sans jet si `force_polaris` absent puis bien demandé si présent), Complot
(sous-table + "Deux jets"), Emprisonnement (`choice` imbriqué avec `apply_setback` et
`manual_grant_choice`), plus les cas défensifs (Revers/cible introuvable, type inconnu, `reroll_table`
hors contexte). 99/99 sur l'ensemble de `shared/` — aucune régression transverse.
**Non testé** : aucune exécution réelle contre PostgreSQL/le Wizard, comme pour les Lots 1/2.

17. Conception du Lot 4 — câblage serveur des Revers (2026-07-22)

Résolution du point 3 laissé ouvert au §15/§16 : `points_cap` n'a en fait **rien à voir** avec le
calcul par tranche (Lot 2) — vérifié directement dans `shared/careerSkills.js` et
`shared/careerAdvantages.js` plutôt que supposé :

- `computeSkillAllocation` (`careerSkills.js:66`) : budget = `10 pts × années, sommé sur TOUTES les
  carrières du personnage` — aucune notion "par année". Le plafond "5 points de compétence" de
  Renvoi est un delta ponctuel (-5, écart au taux normal de 10/an) appliqué UNE FOIS au budget
  character-wide — nouveau paramètre `extraBudgetDelta` à ajouter à cette fonction, symétrique à ce
  qui existe déjà, pas un nouveau système.
- `computeProAdvantageAllocation` (`careerAdvantages.js`) : budget = `5 pts × années, PAR carrière`
  — point d'extension déjà existant et inutilisé pour ce cas : `randomBudgetDelta`. Le plafond
  "3 points d'Avantages professionnels" (delta -2, écart au taux normal de 5/an) s'y injecte
  directement, pour la seule carrière où tombe le Revers — pas besoin de connaître la tranche.

Seul `income_multiplier` (l'autre effet de Renvoi, revenu ÷2) a réellement besoin du calcul par
tranche (Lot 2) : injecté comme un effet de plus dans le bloc (carrière, tranche) concerné, même
mécanisme générique que n'importe quel effet de tirage — aucune logique de plafonnement spécifique
nécessaire à ce niveau.

**`manual_grant_choice`** — persistance décidée : écrit une ligne `char_traits`
(`trait_type` correspondant à la famille — `phobia`/`mental_imbalance`/`wanted`/`infirmity`,
`params.note` = candidats + "à définir à table"). Même mécanisme que le reste du plan pour les
variantes narratives (Lot B) — sans ça, le signal disparaissait à la fermeture du Wizard, le MJ
n'avait plus aucune trace qu'une décision restait à prendre.

**Rattachement (carrière, tranche/année) d'un Revers** (§Lot E point 6) : parcourir `careersData`
dans l'ordre, additionner les années jusqu'à atteindre l'année cumulée du Revers — nécessaire pour
`income_multiplier` (quelle tranche) et pour le budget d'Avantages professionnels (quelle carrière),
pas pour le budget de compétences (character-wide, aucun rattachement nécessaire).

18. Lot 4 codé (2026-07-22) — câblage serveur des Revers dans `creationService.js`

Conception du §17 mise en œuvre telle quelle : `mapSetbackToCareerBlock` (nouveau, `careerSetbacks.js`)
rattache chaque Revers à sa (carrière, tranche) ; `computeSkillAllocation` et `computeCareerBlockSavings`
étendus avec les points d'extension prévus (`extraBudgetDelta`, `extraEffectsByBlock`) ;
`computeProAdvantageAllocation` réutilise `randomBudgetDelta` sans modification. Résolution des
Revers faite AVANT la boucle carrières (Force Polaris vérifié une fois via `char_advantages`
adv_077/078/079, un Revers `pending` fait échouer le reconcile avec un message explicite).

**Correction trouvée en câblant, pas en relisant** : `grantAdvantage()` (`advantageService.js`)
avait exactement le même défaut que `addMutation()` corrigé au Lot 1 — ouvrait toujours sa propre
transaction (`db.transaction`), jamais utilisable depuis la transaction déjà ouverte de
`reconcileCreation` sans casser l'atomicité. Corrigé de la même façon (`trxOpt` optionnel,
comportement inchangé pour l'appelant existant `char-sheet.js`).

**Autre bug trouvé, dans le Lot 1 cette fois** : `resolveCareerRandomEffects` n'avait jamais géré le
type `narrative` (Assassin/3, Barman/9, Espion/3, etc. — fréquent dans les 37 métiers) — toute ligne
purement narrative aurait fait échouer le peuplement du Lot 6 avec une erreur "type inconnu". Corrigé.

**Testé** : 111/111 sur l'ensemble de `shared/` (nouveaux : `careerSetbacks.test.mjs` — 7 tests sur
`mapSetbackToCareerBlock`/non-régression `getSetbackBlockCount`/`resolveSetback` ; `careerSkills.test.mjs`
— 2 tests, `computeSkillAllocation` n'avait jamais été testé avant cette session, budget de base +
`extraBudgetDelta` ; 4 nouveaux cas dans `careerAdvantages.test.mjs` pour `extraEffectsByBlock` et le
fix `narrative`). `node --check` et `git diff --check` propres sur les 7 fichiers touchés.
**Non testé** : toujours aucune exécution réelle contre PostgreSQL/le Wizard.

Lots 1 à 4 codés et testés. Restent : Lot 5 (UI client), Lot 6 (peuplement des 397 lignes de
données), Lot 7 (validation transverse et clôture).