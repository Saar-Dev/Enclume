# PLAN_CHARACTER_SERVICE.md — Autorité unique type/couleur personnage
> Session 147 — 2026-07-16

---

## 1. Bug rapporté

"Mr sourire" (campagne LOCAL) est classé PJ alors que son propriétaire (`user_id`) est le
compte GM de Saar. Vérifié en base : 2 personnages concernés au total (voir §4).

---

## 2. Cause racine

`type` ('pj'/'pnj') est dérivé de la simple présence d'un `user_id`, jamais du rôle réel du
propriétaire dans `campaign_members`. Le GM a lui aussi un `user_id` — tout personnage qui lui
est assigné est donc classé PJ à tort.

**3 endroits réimplémentent cette dérivation indépendamment** (audit complet du repo, pas
supposé) :

| Fichier | Fonction | Constat |
|---|---|---|
| `server/src/routes/characters.js` | `POST /` (création) | `type = user_id ? 'pj' : 'pnj'` |
| `server/src/routes/characters.js` | `PUT /:id` (réassignation) | même logique dupliquée, 2 branches (null/non-null) |
| `server/src/services/creationService.js` | `startCreation()` (Wizard) | `type: 'pj'` codé en dur, aucune dérivation |

`color` suit exactement le même défaut de conception : dérivée du propriétaire à 2 des 3
endroits (POST/PUT), silencieusement absente au 3ᵉ (Wizard, retombe sur le défaut colonne).
Même cause racine, même correctif — traité ensemble, pas une extension de scope.

Confirmé par audit DB : `campaign_members.role` n'est jamais modifié après insertion (aucune
route de mise à jour de rôle) — donc centraliser la dérivation aux 3 points d'écriture de
`characters.user_id` couvre bien tous les cas, il n'y a pas de 4ᵉ chemin de désynchronisation.

---

## 3. Pourquoi pas un trigger Postgres

Option écartée après recherche (denormalization nécessite un "plan de synchronisation clair" —
trigger DB ou service applicatif unique). Ce projet n'a **aucun** trigger ni fonction SQL dans
ses 176 migrations — 100% de la logique métier vit dans `server/src/services/`. Un trigger
introduirait une dépendance croisée SQL/JS inédite pour un chemin d'écriture rare (création/
réassignation de personnage, pas un hot path). Solution retenue : service applicatif unique,
seul point d'écriture possible pour l'appartenance d'un personnage.

---

## 4. Design retenu

Nouveau fichier `server/src/services/characterOwnershipService.js` :

```js
import { AppError } from '../lib/AppError.js'

export const DEFAULT_CHARACTER_COLOR = '#4A90D9'

// Autorité unique : dérive type + color depuis l'appartenance réelle
// (campaign_members.role), jamais de la simple présence d'un user_id.
//
// role n'a AUCUNE contrainte CHECK en base (table.text('role'), texte libre) —
// liste blanche explicite : seul role === 'player' donne 'pj'. Tout le reste
// (gm, rôle futur non prévu, valeur corrompue) tombe côté 'pnj' — le défaut
// sûr, celui qui ne casse pas la classification combat.
//
// 'drone' n'est jamais dérivé ici — choix explicite du typeOverride, géré par
// l'appelant. color n'est en revanche jamais conditionné par le type : un
// drone avec un propriétaire hérite de sa couleur comme n'importe quel PNJ
// (comportement existant, préservé).
export async function resolveOwnership(db, { campaignId, userId }) {
  if (!userId) return { user_id: null, type: 'pnj', color: DEFAULT_CHARACTER_COLOR }

  const [owner, member] = await Promise.all([
    db('users').where({ id: userId }).select('color').first(),
    db('campaign_members').where({ campaign_id: campaignId, user_id: userId }).first(),
  ])
  if (!owner) throw new AppError(404, 'Utilisateur introuvable')
  if (!member) throw new AppError(400, "Cet utilisateur n'est pas membre de cette campagne")

  return { user_id: userId, type: member.role === 'player' ? 'pj' : 'pnj', color: owner.color }
}
```

### Call sites (3, tous ceux qui écrivent `characters.user_id`)

**`characters.js` — `POST /`** : remplace le calcul `color`/`ownerMember`/`type` actuel.
`type` reste conditionné par `typeOverride === 'drone'` dans la route (pas dans le service) ;
`color` ne l'est jamais (préserve le comportement actuel drone+propriétaire).
```js
const ownership = await resolveOwnership(db, { campaignId, userId: user_id })
const color = ownership.color
const type  = typeOverride === 'drone' ? 'drone' : ownership.type
```

**`characters.js` — `PUT /:id`** : un seul appel remplace les 2 branches (null/non-null) ;
`color` toujours appliqué (comme aujourd'hui), `type` seulement `if (character.type !== 'drone')`
(comme aujourd'hui — la garde ne porte QUE sur `type`, jamais sur `color`, contrairement à un
brouillon précédent qui les groupait à tort).
```js
if ('user_id' in updates) {
  const ownership = await resolveOwnership(db, { campaignId: character.campaign_id, userId: updates.user_id })
  updates.color = ownership.color
  if (character.type !== 'drone') updates.type = ownership.type
}
```
**Effet de bord accepté (validé par Saar)** : la réassignation vérifie désormais l'appartenance
à la campagne via `resolveOwnership` (`AppError(400)` si non-membre) — absent du code actuel.
Amélioration, pas une régression.

**`creationService.js` — `startCreation()`** : ajoute la dérivation `color` (absente
aujourd'hui, défaut colonne silencieux) en plus de `type`.
```js
const ownership = await resolveOwnership(trx, { campaignId, userId })  // trx = la transaction déjà ouverte par startCreation
const [character] = await trx('characters')
  .insert({ campaign_id: campaignId, user_id: ownership.user_id, name: 'Brouillon', type: ownership.type, color: ownership.color, visible: false })
  .returning(['id'])
```

### Vérifications empiriques (2ᵉ passe d'auto-critique — hypothèses testées, pas supposées)

| Hypothèse à risque | Vérification | Résultat |
|---|---|---|
| `campaign_members.role` contient peut-être déjà une valeur imprévue en base (pas de CHECK) | `SELECT DISTINCT role, count(*) FROM campaign_members` | Seulement `gm`(×2) et `player`(×2) — mais la liste blanche reste la conception retenue pour l'avenir, pas parce que la donnée actuelle l'exigeait |
| Un `characters.type='pj'` avec `user_id IS NULL` existerait déjà (données historiques) | `SELECT ... WHERE type='pj' AND user_id IS NULL` | 0 ligne — le `UPDATE` §5 ne masque pas un cas déjà présent |
| `owner.color` pourrait être `NULL` et écrire une valeur invalide dans `characters.color` (`notNullable`) | `information_schema.columns` sur `users.color` | `NOT NULL`, défaut `'#4A90D9'` — jamais `NULL` |
| `AppError` levée dans un `db.transaction(async trx => {...})` se propage-t-elle correctement jusqu'à Express ? | Pattern déjà utilisé dans `creationService.js` (`reconcileCreation`, L.281, `throw new AppError(...)` à l'intérieur d'une transaction) | Précédent existant et fonctionnel dans ce fichier même — pas une supposition |

**Incohérence trouvée et tranchée** : le code de statut HTTP pour "pas membre de la campagne"
existe déjà à 2 endroits avec des valeurs différentes — `characters.js` (POST, cause originale du
bug) utilise `400`, `creation.js` (pré-check Wizard sur l'utilisateur courant) utilise `403`. Ce
ne sont pas la même vérification (un tiers propriétaire vs l'utilisateur courant), donc pas une
vraie contradiction, mais le service centralisé doit choisir : retenu `400`, aligné sur
`characters.js` puisque c'est la vérification équivalente (appartenance d'un propriétaire
potentiel, pas de l'appelant).

Paramètre renommé `trx` → `db` dans la signature : la fonction accepte indifféremment `db` (POST,
hors transaction — comportement actuel préservé, TOCTOU documenté §6) ou un `trx` actif
(Wizard) — le nom `trx` suggérait à tort une garantie transactionnelle systématique.

---

## 5. Correction de données existantes

Pas de migration (données de test locales, pas de schéma à faire évoluer — cf. §6). `UPDATE`
ponctuel, exécuté **après** le déploiement du fix code (sinon une réassignation entre-temps
recrée l'incohérence), condition générale (pas les UUID en dur, au cas où d'autres campagnes
locales seraient touchées) :

```sql
UPDATE characters c
SET type = 'pnj'
WHERE c.type = 'pj'
  AND EXISTS (
    SELECT 1 FROM campaign_members cm
    WHERE cm.campaign_id = c.campaign_id AND cm.user_id = c.user_id AND cm.role != 'player'
  );
```

---

## 6. Hors périmètre (assumé, pas oublié)

- **TOCTOU** : lectures (owner/membre) et écriture (insert/update) ne sont pas dans la même
  transaction, ni avant ni après ce correctif. Pas la cause du bug rapporté ; corriger
  élargirait le scope au-delà d'une cause racine atomique.
- **Retrait d'un membre de campagne** : recherché explicitement, aucune route ne supprime une
  ligne `campaign_members` (seul un CASCADE à la suppression de toute la campagne existe). Le
  cas "propriétaire retiré mais `characters.user_id` encore renseigné" n'est pas atteignable
  aujourd'hui.
- **Constante couleur dupliquée** : `DEFAULT_CHARACTER_COLOR` centralise la valeur (avant :
  `'#4A90D9'` recopié à 2 endroits) — corrigé en passant, même cause (duplication), pas une
  extension de scope.

---

## 7. Validation prévue

**Testé** : `node --check` sur les 3 fichiers modifiés, `eslint` (aucun fichier client concerné
ici), scénario réel (créer un PNJ via POST avec le compte GM comme propriétaire → vérifier
`type='pnj'` en base ; réassigner un personnage au GM via PUT → idem ; créer un personnage via
le Wizard avec le compte GM → idem ; vérifier qu'un PJ assigné à un vrai joueur reste `'pj'` dans
les 3 flux, non-régression).

**Non testé** : concurrence (TOCTOU documenté §6), campagnes avec plusieurs GM (le rôle 'gm'
n'a jamais qu'une seule valeur observée en base, pas de cas multi-GM testé).

**Retour arrière** : commit isolé sur `dev/Saar` ; le `UPDATE` de données (§5) n'est pas
rejouable automatiquement — noter les IDs affectés avant exécution si retour arrière nécessaire.

---

## 8. Statut

✅ CODÉ ET VÉRIFIÉ — 2026-07-16.

- `server/src/services/characterOwnershipService.js` créé.
- `server/src/routes/characters.js` (POST /, PUT /:id) et `server/src/services/creationService.js`
  (`startCreation`) migrés vers `resolveOwnership`.
- `node --check` OK sur les 3 fichiers.
- `resolveOwnership` testé directement contre la base réelle (campagne LOCAL) : propriétaire GM
  → `pnj` ; propriétaire joueur → `pj` (inchangé) ; sans propriétaire → `pnj` + couleur défaut
  (inchangé) ; utilisateur inconnu → `404` correctement levée.
- Données existantes corrigées (§5) : "Mr sourire" et "sdfdsf" → `pnj`, confirmé par `RETURNING`.

**Non testé** : les 3 flux via HTTP authentifié (POST GM, PUT réassignation, Wizard) — la
vérification a porté sur le service directement contre la DB, pas sur le transport Express/
auth complet. Concurrence (TOCTOU, §6) non testée, comme documenté.

Une fois la fonctionnalité confirmée en usage réel par Saar : ce PLAN est archivé (`docs/Old/`)
conformément à `docs/RegleDocumentaire.md` Règle 10 — le contenu durable (autorité unique
type/couleur personnage) devrait être documenté dans un DOMAIN `CHARACTER` s'il existe, ou noté
dans `docs/ASBUILT.md`.
