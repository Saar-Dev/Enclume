# PLAN_CAC_BATTERIE.md — Munition générique "Charge électrique" pour armes à batterie

> Document temporaire (Règle 10 `RegleDocumentaire.md`) — archivé/intégré dans `docs/SYSTEME/COMBAT.md`
> ou `docs/VOCABULARY.md` une fois le chantier clos.
> Origine : COM28 (Matraque Mao affiche "0/40" sans pouvoir être rechargée) — Saar a rejeté le
> correctif d'affichage seul et demandé une vraie mécanique de recharge, indépendante CaC/tir.
> Date : 2026-07-19.

---

## 1. Constat vérifié [VÉRIFIÉ par lecture + requêtes DB live]

`caliber` (`ref_equipment.caliber`) est **déjà** le seul champ générique de compatibilité arme/munition
dans ce projet — décision validée de longue date, retrouvée dans `docs/Old/JARMES.md` §2.5
(2026-05-09, Session 7-9) :

> « caliber est le SEUL champ valide pour déterminer le type de munition compatible avec une arme. [...]
> Aucune exception : Toujours utiliser caliber. »

Le code actuel (`inventoryService.reloadWeapon`, `resolveAmmoInit`, `reloadAmmoItems` côté client)
applique déjà cette règle par égalité de chaîne sur `caliber`, aussi bien pour les munitions à feu
("9 mm", "7.62 mm"...) que pour les batteries d'armes à énergie (`caliber = 'GP-C1'`, `'GP-B2'`, etc.,
family `'Munitions'`, category `'Armes à énergie'` — 9 items déjà en base, déjà correctement liés à
13 armes à énergie + Poing Kryss).

**Conclusion : il n'y a rien à "casser" côté architecture.** Le mécanisme est générique par design.
Ce qui manque est **uniquement de la donnée catalogue** : aucune munition générique "batterie" pour
les armes de contact/soniques à charges, et `caliber` resté `NULL` sur ces armes malgré un
`ammo_count` réel et jouable.

**Attention (piège évité)** : `GP-*` (`GP-A1`…`GP-D4`) est un système de classification des sources
d'énergie de **drones** (`docs/REGLES/REGLEDRONE.md`, ex. "Source d'énergie : PE Généticien (GP-B2)"),
réutilisé intentionnellement pour les armes à énergie à main. **Ne pas réutiliser GP-\* pour les armes
de contact/soniques de ce plan** — mélangerait deux domaines distincts (autorité unique, §1.4
`CLAUDE.md`). D'où la munition générique séparée demandée par Saar.

---

## 2. Inventaire vérifié — requête live DB

```sql
SELECT name, category, ammo_count, price FROM ref_equipment
WHERE family = 'Armes' AND ammo_count IS NOT NULL AND caliber IS NULL;
-- 38 lignes (2026-07-19)
```

### Lot A — IN SCOPE ce plan : munition générique "Charge électrique"

19 armes à charge numérique propre (`ammo_count` parseable, pas de notion de durée) :

| Catégorie | Armes |
|---|---|
| Arme de contact (7) | Bâton Ordonnateurs (40), Dague moléc. Pulsar (30), Dague neurale Brain (20), Gant choc (30), Matraque Mao (40), Poing choc (20), Électro-fouet (30) |
| Armes de poing (1) | Flex (24) — description confirme « petite batterie » |
| Armes étourdissantes et soniques (11) | Canon sonique (40), Canon à infrasons (40 tours), Disrupteur neural (8), Fusil choc Stun (10), Fusil sonique d'attaque (10), Fusil sonique incap. sirène (20), Gén. d'onde de choc (60), Modulateur sonique (60 tours), Pistolet choc Stun II (6), Sonar d'attaque (60), Sonar d'attaque directionnel (60) |

### Hors scope — flagué séparément, PAS touché par ce plan

| Lot | Armes | Raison |
|---|---|---|
| **B — Armes à durée** (8) | Chalumeau (1h de gaz), Dague thermique Thermo IV, Découpe carlingue Scianor, Foreuse Clyss, Gant magma, Gant énergétique, Lance thermique Fléau, Lance thermique Solar (toutes "1 heure") | Mécanique de jauge temporelle, pas un compteur de charges — `ammo_count` non parseable par la regex `/\d+/` existante. Nouveau système à concevoir séparément. |
| **C — Arme de trait** (4) | Arbalète Leysur IV, Arc Ibram Flexi, Fronde, Lance poignard | Munitions dédiées déjà existantes en catalogue (Carreau/Flèche, `caliber` déjà peuplé côté munition — migration 75). Bug plus étroit : juste lier `caliber` de l'arme à la munition existante, aucun nouvel item. À traiter comme correctif séparé. |
| **D — Lanceur** (6) | Lance-capsules, Lance-disques, Lance-filet, Lance-flammes, Lance-grenades, Vaporisateur de gaz | Projectiles physiques dédiés, pas des batteries. "Capsule" existe déjà en catalogue (10 items, `family='Munitions'`) — Lance-capsules a juste besoin de `caliber='Capsule'`. Les autres (disque/filet/grenade) nécessitent vérification/création d'item par type — hors sujet batterie, plan séparé. |
| **Lanceur de poignet Hybri 500** | — | Tire des micro-projectiles physiques ("tout petits missiles"), pas une batterie — rattaché au Lot D. |
| **Énergie + Poing Kryss** (14) | 13 armes à énergie + Poing Kryss | Déjà câblées et fonctionnelles via `caliber='GP-*'` — vérifié en base, ne pas toucher. |

---

## 3. Décision produit (Saar, 2026-07-19)

- Munition générique unique, nom **"Charge électrique"**, `family='Munitions'`, nouvelle `category`
  **"Charges électriques"** (parallèle à `'Balles'`, `'Capsules'`, `'Armes à énergie'` déjà en base).
- `caliber = 'Charge électrique'` — sur la munition **et** sur les 19 armes du Lot A.
- Prix **10 sols/charge** — aligné sur le prix unitaire d'une munition standard existante
  (`9 mm - Munition standard` = 10 sols également, cohérence économie de jeu confirmée).
- Aucune colonne/schéma nouveau : migration de données pure (INSERT + UPDATE), pas de FK ajoutée —
  le lien est le même mécanisme `caliber` déjà utilisé partout, pas une relation structurelle séparée.

---

## 4. Effet de bord attendu (aucun code à changer)

Une fois `caliber` peuplé sur les 19 armes du Lot A :

- `resolveAmmoInit` (auto-init équipement) et `reloadWeapon` (`inventoryService.js`) fonctionnent
  immédiatement, sans modification — ils ne font que lire `caliber`.
- `weaponAmmoStatus` (COM28, `shared/ammoRules.js`) cesse de masquer ces 19 armes — le garde `!caliber`
  ajouté en COM28 devient correct pour elles (caliber désormais non-null) **et reste correct** pour
  les Lots B/C/D non encore traités (caliber toujours `NULL` chez eux → masquage toujours légitime tant
  qu'ils ne sont pas raccordés).
- Aucune régression possible sur les armes à feu existantes (caliber inchangé pour elles).

---

## 5. Migration prévue

Numéro **178** (pair — Saar/Codex). `176` est désormais pris par
`176_combat_actions_offhand_weapon.js` (COM29, Session 162, `e91511a`) — vérifié `git log` +
`knex_migrations` au moment d'écrire cette révision, pas supposé. Fichier :
`server/src/db/migrations/178_ammo_charge_electrique.js`.

```js
const LOT_A_WEAPONS = [
  'Bâton Ordonnateurs', 'Dague moléc. Pulsar', 'Dague neurale Brain', 'Gant choc',
  'Matraque Mao', 'Poing choc', 'Électro-fouet', 'Flex',
  'Canon sonique', 'Canon à infrasons', 'Disrupteur neural', 'Fusil choc Stun',
  'Fusil sonique d’attaque', 'Fusil sonique incap. sirène', 'Gén. d’onde de choc',
  'Modulateur sonique', 'Pistolet choc Stun II', 'Sonar d’attaque', 'Sonar d’attaque directionnel',
]

export const up = async (knex) => {
  const [ammo] = await knex('ref_equipment').insert({
    family: 'Munitions',
    category: 'Charges électriques',
    name: 'Charge électrique',
    caliber: 'Charge électrique',
    price: 10,
  }).returning('id')

  const updated = await knex('ref_equipment')
    .whereIn('name', LOT_A_WEAPONS)
    .andWhere({ family: 'Armes' })
    .update({ caliber: 'Charge électrique' })

  if (updated !== LOT_A_WEAPONS.length) {
    console.warn(`[migration 176] attendu ${LOT_A_WEAPONS.length} armes mises à jour, obtenu ${updated} — vérifier noms/apostrophes`)
  }
}

export const down = async (knex) => {
  await knex('ref_equipment')
    .whereIn('name', LOT_A_WEAPONS)
    .andWhere({ family: 'Armes' })
    .update({ caliber: null })
  await knex('ref_equipment').where({ name: 'Charge électrique', family: 'Munitions' }).delete()
}
```

**Point de vigilance apostrophe** (leçon migration 75, U+2019) : `Fusil sonique d’attaque` et
`Gén. d’onde de choc` utilisent l'apostrophe typographique `’` (U+2019) en base — vérifier les noms
exacts par requête avant d'écrire la migration finale, ne pas taper à la main.

---

## 6. Validation — exécutée 2026-07-19

- **Testé** : migration `178_ammo_charge_electrique.js` appliquée en base réelle (`knex migrate:latest`,
  batch 119). `SELECT ... WHERE caliber = 'Charge électrique'` → **20 lignes** (1 munition + 19 armes),
  vérifié nominalement. Échec contrôlé vérifié aussi : premier essai a échoué proprement sur
  `tech_level NOT NULL` (contrainte manquée dans le brouillon initial), transaction Postgres par défaut
  a bien tout annulé (aucune ligne orpheline, `knex_migrations` sans trace) — corrigé (`tech_level: 2`,
  aligné Matraque Mao/munition standard), ré-appliqué avec succès. `node --test shared/ammoRules.test.mjs
  shared/dualWieldRules.test.mjs` → 15/15 ✅ (non-régression COM25/COM28/COM29, indépendant de cette
  migration mais revalidé par la même occasion).
- **Anomalie infra découverte (hors scope de ce plan, à signaler à Saar)** : `knex migrate:rollback`
  (CLI) ne fait rien de constatable sur ce projet — annonce succès (« Batch rolled back ») mais ni la
  ligne `knex_migrations` ni les données ne changent (`migration_time` identique avant/après). `down()`
  de cette migration fonctionne correctement quand appelé directement (vérifié : 20 → 0 lignes liées,
  0 exception) — la fonction elle-même n'est pas en cause. Piste non creusée : `NaturalMigrationSource`
  (`server/src/db/migrations/../naturalMigrationSource.cjs`) et son interaction avec le chemin rollback
  de Knex. Contournement utilisé ici : suppression manuelle de la ligne `knex_migrations` +
  `migrate:latest` (fiable, vérifié deux fois). **Ne pas supposer qu'un futur rollback CLI fonctionnera
  sans revérifier.**
- **Testé (Saar, navigateur, 2026-07-19)** : scénario réel confirmé fonctionnel — équiper/recharger une
  arme du Lot A, affichage munitions correct en fenêtre de combat. **Lot A clos.**
- **Non testé** : Lots B/C/D (hors scope de ce plan, mécaniques séparées — voir §2).
- **Retour arrière** : `down()` vérifié fonctionnel par appel direct (voir anomalie CLI ci-dessus) —
  purement réversible, aucune perte possible (`current_ammo` de ces armes n'a jamais pu être posé avant
  cette migration).

---

## 7. Suite

1. ~~Créer la migration~~ ✅ — `178_ammo_charge_electrique.js`, appliquée.
2. ~~Appliquer, vérifier en base~~ ✅ — 20/20.
3. Test fonctionnel navigateur (Saar) : équiper Matraque Mao sur un PNJ/PJ de test, recharger, vérifier
   affichage combat COM28 correct.
4. Fermer ce PLAN → intégrer le concept "Charge électrique" dans `docs/VOCABULARY.md` (Concepts Enclume)
   et une ligne dans `docs/SYSTEME/COMBAT.md` ou `REGLEMATERIEL.md` si pertinent.
5. Ouvrir séparément Lots B (durée), C (arme de trait), D (lanceurs) si Saar les priorise.
6. Investiguer l'anomalie `knex migrate:rollback` (voir §6) — hors scope ici, mais à ne pas oublier.
