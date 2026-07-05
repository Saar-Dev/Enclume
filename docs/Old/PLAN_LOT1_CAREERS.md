# PLAN_LOT1_CAREERS — Correction des skill_id du lot 1 (seed carrières)
> Session 134 — 2026-07-05
> Statut : **✅ clos** — migration 106 appliquée, testée en base et validée fonctionnellement par Saar. Détail complet : `docs/JOURNAL6.md` "Session 134".
> **Testé :** les 9 corrections vérifiées en base (93 lignes), round-trip `up`/`down`/`up` byte-identique (appel direct des fonctions du module), wizard Step4 sur les 5 carrières confirmé par Saar (« all ok »).
> **Non testé :** —

---

## Contexte

`server/src/db/migrations/100_seed_ref_careers.js` (déjà appliquée, 5 carrières : artisan_artiste,
assassin, barman, chasseur_primes, contrebandier) contient des `skill_id` erronés ou manquants
par rapport à `docs/Character/Creation/REGLE_PROFESSION.md` (LdB). Audit initial :
`docs/Old/JOURNALCOUCHE4.md`. Chaque point ci-dessous a été re-vérifié en session contre le LdB
et contre la base réelle (2026-07-05 suite), pas repris tel quel de l'audit archivé.

Point de départ du sujet : correction de `ref_skills` (migration 105, "37-bis") qui débloquait
le seeding des carrières restantes (voir `EN_COURS.md` item "1").

## Décision d'architecture

**Aucune suppression sur `ref_careers`** — son `id` (UUID) est référencé par
`char_careers.career_id` avec `onDelete('CASCADE')` (`96_char_creation_tables.js:76-77`).
Supprimer/ré-insérer `ref_careers` regénèrerait un nouvel UUID et supprimerait silencieusement
la carrière de tout personnage l'ayant déjà choisie. Vérifié : 0 personnage concerné actuellement,
mais le pattern doit rester sûr pour l'avenir et pour les lots 2-6 à venir.
→ Uniquement `UPDATE`/`DELETE`+`INSERT` ciblés sur `ref_career_skills` (table enfant, aucun
autre table ne dépend de ses lignes).

## Hors scope (volontairement)

- **C3 (barman, "Armes de poing ou Fusils/Armes d'épaule")** — LdB dit "ou" (choix exclusif),
  mais **aucun mécanisme de choix réel n'existe dans le wizard** (`conditional:true` n'est qu'un
  label texte "(au choix)" dans `CareersAllocator.jsx:206`, zéro enforcement — vérifié en code
  et en base : seulement 2 lignes `conditional=true` actuellement en DB, ni l'une ni l'autre
  n'a de contrainte réelle). Ce n'est pas spécifique au barman : 34 occurrences de
  `conditional:true` recensées dans les fichiers source des lots 2-6 (non encore appliqués).
  **Décision Saar** : implémenter un vrai bouton radio/toggle (MVP fonctionnel a minima),
  traité comme tâche séparée (Step4 UI), avant refonte complète — laquelle nécessitera un
  inventaire exhaustif de tous les cas "au choix" du dataset complet. Non commencé.
- Tables jamais peuplées pour lot1 (`ref_career_point_categories`, `ref_career_equipment`,
  `ref_career_random_benefits`), métadonnées carrière absentes (`contact_frequency`,
  `ally_frequency`, `ally_type`, `opponent_frequency`, `enemy_rule`), multi-rows
  `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` manquants (chasseur_primes, contrebandier),
  Soléen manquant sur les 5 carrières, tranches de titres tronquées, illustrations (S4-C2).
  → Tous documentés dans `docs/Old/JOURNALCOUCHE4.md`, traités en plans séparés ultérieurs.
- Lots 2-6 (32 carrières) + prérequis — séquence après validation de ce plan.

## Les 9 corrections validées

| # | Carrière | LdB (`REGLE_PROFESSION.md`) | Changement | Type |
|---|---|---|---|---|
| A1 | artisan_artiste | "Commerce/Trafic (Artisanat, Œuvres d'art…)" — enfants absents de `ref_skills` | `COMMERCE_TRAFIC__DENREES_ALIMENTAIRES` → `COMMERCE_TRAFIC` + `conditional:true` | UPDATE |
| A2 | artisan_artiste | "éventuellement Sciences... par exemple Botanique, Chimie, etc." | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` → `SCIENCES_CONNAISANCES_SPECIALISEES` | UPDATE |
| B1 | assassin | "Arts martiaux (Lutte, Techniques défensives, Techniques offensives)" — 3 skills définitifs | `ARTS_MARTIAUX` → 3 lignes (`_LUTTE`, `_TECHNIQUES_DEFENSIVES`, `_TECHNIQUES_OFFENSIVES`) | DELETE 1 + INSERT 3 |
| B2 | assassin | "Tir de précision" | `TIR_PRECISION` (inexistant) → `TIR_DE_PRECISION` | UPDATE |
| B3 | assassin | "Sciences/Connaissances spécialisées (Connaissance des poisons)" — pas de skill "Poisons" en base | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` → `SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE` | UPDATE |
| C1 | barman | "Sciences/Connaissances spécialisées (Administration/Gestion)" — label DB identique | `SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE` → `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` | UPDATE |
| D1 | chasseur_primes | "Arts martiaux (une Compétence au choix)" — pas de sous-skill précisée | `ARTS_MARTIAUX` inchangé, `conditional` false→true | UPDATE (flag only) |
| D2 | chasseur_primes | "Pilotage (Navires légers, Scooters sous-marins)" — Scooters déjà présent | ajout `PILOTAGE__NAVIRES_LEGERS` | INSERT |
| E1 | contrebandier | "Pilotage (Navires légers, Scooters sous-marins)" — Scooters déjà présent | ajout `PILOTAGE__NAVIRES_LEGERS` | INSERT |

## Code exact (up/down symétrique)

Voir le message de session du 2026-07-05 (conversation "Reprise seeding carrières") pour le
contenu complet du fichier `106_fix_ref_career_skills_lot1.js` — reproduit ci-dessous tel que
validé, prêt à copier au moment de coder.

```js
// 106_fix_ref_career_skills_lot1.js — Corrections lot 1 vs LdB (REGLE_PROFESSION.md)
// Aucune suppression sur ref_careers (id stable — évite le CASCADE sur char_careers).
// C3 (barman armes) volontairement hors scope — mécanisme "au choix" non implémenté.

const CODES = ['artisan_artiste', 'assassin', 'barman', 'chasseur_primes', 'contrebandier']

async function getCareerIds(knex) {
  const rows = await knex('ref_careers').whereIn('code', CODES).select('id', 'code')
  const map = {}
  for (const r of rows) map[r.code] = r.id
  for (const code of CODES) {
    if (!map[code]) throw new Error(`Carrière introuvable : ${code}`)
  }
  return map
}

export const up = async (knex) => {
  const ids = await getCareerIds(knex)

  // A1
  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES' })
    .update({ skill_id: 'COMMERCE_TRAFIC', conditional: true })

  // A2
  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES' })

  // B1
  await knex('ref_career_skills').where({ career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX' }).del()
  await knex('ref_career_skills').insert([
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_LUTTE', skill_group: 'Combat (contact)', conditional: false },
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', skill_group: 'Combat (contact)', conditional: false },
    { career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES', skill_group: 'Combat (contact)', conditional: false },
  ])

  // B2
  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'TIR_PRECISION' })
    .update({ skill_id: 'TIR_DE_PRECISION' })

  // B3
  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE' })

  // C1
  await knex('ref_career_skills')
    .where({ career_id: ids.barman, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION' })

  // D1
  await knex('ref_career_skills')
    .where({ career_id: ids.chasseur_primes, skill_id: 'ARTS_MARTIAUX' })
    .update({ conditional: true })

  // D2
  await knex('ref_career_skills').insert({
    career_id: ids.chasseur_primes, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage', conditional: false,
  })

  // E1
  await knex('ref_career_skills').insert({
    career_id: ids.contrebandier, skill_id: 'PILOTAGE__NAVIRES_LEGERS', skill_group: 'Pilotage', conditional: false,
  })
}

export const down = async (knex) => {
  const ids = await getCareerIds(knex)

  await knex('ref_career_skills').where({ career_id: ids.contrebandier, skill_id: 'PILOTAGE__NAVIRES_LEGERS' }).del()
  await knex('ref_career_skills').where({ career_id: ids.chasseur_primes, skill_id: 'PILOTAGE__NAVIRES_LEGERS' }).del()

  await knex('ref_career_skills')
    .where({ career_id: ids.chasseur_primes, skill_id: 'ARTS_MARTIAUX' })
    .update({ conditional: false })

  await knex('ref_career_skills')
    .where({ career_id: ids.barman, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin, skill_id: 'TIR_DE_PRECISION' })
    .update({ skill_id: 'TIR_PRECISION' })

  await knex('ref_career_skills')
    .where({ career_id: ids.assassin })
    .whereIn('skill_id', ['ARTS_MARTIAUX_LUTTE', 'ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES', 'ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES'])
    .del()
  await knex('ref_career_skills').insert({
    career_id: ids.assassin, skill_id: 'ARTS_MARTIAUX', skill_group: 'Combat (contact)', conditional: false,
  })

  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES' })
    .update({ skill_id: 'SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE' })

  await knex('ref_career_skills')
    .where({ career_id: ids.artisan_artiste, skill_id: 'COMMERCE_TRAFIC' })
    .update({ skill_id: 'COMMERCE_TRAFIC__DENREES_ALIMENTAIRES', conditional: false })
}
```

**Ajout retenu lors du run à vide (2026-07-05 suite)** : garde-fou `getCareerIds` — lève une
erreur explicite si une des 5 carrières ne résout pas d'id, plutôt qu'un `WHERE career_id
= undefined` silencieux. Déjà intégré au code ci-dessus.

## Ce qui ne change pas

`ref_careers`, `ref_career_titles`, tout le reste de `ref_career_skills` non listé
(barman `ARMES_DE_POING`/`FUSIL_ARMES_DEPAULES` inclus, intact).

## Test prévu à l'exécution (même rigueur que migration 105)

1. Re-vérifier `SELECT COUNT(*) FROM char_careers cc JOIN ref_careers rc ON rc.id=cc.career_id
   WHERE rc.code IN (...)` = 0 avant de lancer (sécurité, au cas où un test aurait créé un
   personnage entre-temps).
2. `up()` → `SELECT` de vérification des 9 lignes modifiées/ajoutées.
3. `down()` → diff contre un snapshot pris juste avant `up()` → doit être identique.
4. `up()` final → laisser appliqué.
5. Fonctionnel : ouvrir le wizard Step4, sélectionner chacune des 5 carrières, vérifier que
   la liste de compétences affichée ne contient plus d'ID orphelin et correspond au LdB.

## Notes annexes découvertes en session (non bloquantes)

- `CareersAllocator.jsx:205` affiche `sk.skill_id` brut (ex. `ARTS_MARTIAUX_LUTTE`), pas de
  label lisible — renforce le besoin de la refonte Step4 déjà notée par Saar, pas un bug de
  cette migration.
- 34 occurrences de `conditional:true` recensées dans les `.cjs` sources des lots 2-6 (non
  appliqués) — l'ampleur réelle du sujet "mécanisme au choix" à couvrir par l'inventaire
  demandé avant la refonte UI.
