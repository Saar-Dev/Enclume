# PLAN15 — Sprint Bibliothèque
> Rédigé : Session 74 (2026-06-02)

---

## Objectif

Implémenter la Bibliothèque : gestion de documents richement formatés par campagne, accessibles depuis l'onglet "Bibliothèque" de la Sidebar. Éditeur TipTap v2. Permissions par joueur. Propagation temps réel via socket.

---

## Périmètre Sprint 1 (ce plan)

| Dans le scope | Hors scope |
|---|---|
| Table SQL + CRUD REST | Tags (Sprint 2) |
| TipTap éditeur (description + notes GM) | Upload fichier MinIO (Sprint 2) |
| Permissions visibilité + édition | Collaboration temps réel |
| Propagation socket DOC_UPDATED | Dupliquer |
| Sidebar biblio tab — liste + ouverture | |
| DocumentModal — création / édition / suppression | |

---

## 1. Migration 67 — `campaign_documents`

```js
// server/src/db/migrations/67_campaign_documents.js
exports.up = async (knex) => {
  await knex.schema.createTable('campaign_documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    t.string('name', 255).notNullable()
    t.text('content_html').defaultTo('')        // TipTap HTML — description & notes
    t.text('gm_notes_html').defaultTo('')       // TipTap HTML — GM only
    // Permissions : '"all"' (string JSON) | '["user_id1",...]' (tableau JSON)
    t.jsonb('viewer_ids').notNullable().defaultTo('"all"')
    t.jsonb('editor_ids').notNullable().defaultTo('"none"')
    t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamps(true, true)
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTable('campaign_documents')
}
```

### Format des colonnes de permission

| Valeur stockée (JSONB) | Signification |
|---|---|
| `"all"` (string JSON) | Tous les joueurs de la campagne |
| `"none"` (string JSON) | Personne (GM uniquement) |
| `["uuid1","uuid2"]` (array JSON) | Liste user_ids explicite |

Le GM a toujours tous les droits — pas stocké dans ces colonnes.

---

## 2. Événements WS — `shared/events.js`

Ajouter dans la section Documents (après `DOC_SHARED` existant) :

```js
DOC_CREATED: 'doc:created',   // serveur → sockets autorisés : nouveau document
DOC_UPDATED: 'doc:updated',   // serveur → sockets autorisés : document modifié
DOC_DELETED: 'doc:deleted',   // serveur → sockets autorisés : document supprimé
```

`DOC_SHARED` (existant) : conservé, non touché.

---

## 3. Routes REST — `server/src/routes/documents.js`

Router avec `mergeParams: true`, monté sur `/api/campaigns/:campaignId/documents`.

### Helpers de permission (module-level)

```js
// canView(doc, userId, isGm) — true si le user peut voir ce document
// canEdit(doc, userId, isGm) — true si le user peut modifier ce document
function permCheck(perm, userId) {
  if (perm === 'all') return true
  if (perm === 'none') return false
  return Array.isArray(perm) && perm.includes(userId)
}
```

### Routes

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/` | requireAuth + membre campagne | Retourne les docs visibles par l'appelant. GM → tous. Joueur → filtre `canView`. **Exclut `gm_notes_html` pour les non-GM.** |
| `POST` | `/` | requireAuth + isGm | Crée un document. Broadcast `DOC_CREATED` aux sockets autorisés. |
| `GET` | `/:docId` | requireAuth + membre campagne + canView | Retourne un document. **Exclut `gm_notes_html` pour non-GM.** |
| `PUT` | `/:docId` | requireAuth + (isGm OU canEdit) | Modifie un document. GM peut tout modifier. Joueur ayant droit d'édition ne peut pas modifier `viewer_ids`, `editor_ids`, `gm_notes_html`. Broadcast `DOC_UPDATED`. |
| `DELETE` | `/:docId` | requireAuth + isGm | Supprime. Broadcast `DOC_DELETED`. |

### Vérification membership campagne

Pattern existant — utiliser la même vérification que `battlemaps.js` :
```js
const member = await db('campaign_members')
  .where({ campaign_id: req.params.campaignId, user_id: req.user.id })
  .first()
if (!member) return res.status(403).json({ error: 'Not a member' })
const isGm = member.role === 'gm'
```

### Broadcast depuis la route

Pattern identique à `char-sheet.js` (WOUND_ADDED) :
```js
const io = req.app.get('io')
const room = `campaign:${campaignId}`
const sockets = await io.in(room).fetchSockets()
for (const s of sockets) {
  const memberRole = s.data.role // PE2 — socket.data.role branché à SESSION_JOIN
  const sockUserId = s.data.userId
  const sockIsGm = memberRole === 'gm'
  if (sockIsGm || canView(doc, sockUserId)) {
    const payload = sockIsGm ? doc : { ...doc, gm_notes_html: undefined }
    s.emit(WS.DOC_UPDATED, payload)
  }
}
```

### Montage dans `server/src/index.js`

```js
import documentsRouter from './routes/documents.js'
// ...
app.use('/api/campaigns/:campaignId/documents', documentsRouter)
```

---

## 4. Store client — `client/src/stores/libraryStore.js`

Store Zustand dédié (ne pas surcharger `sessionStore`).

```js
{
  documents: [],           // docs visibles par l'utilisateur courant
  setDocuments: (docs),
  addDocument: (doc),
  updateDocument: (partial), // merge par id
  removeDocument: (id),
  reset: ()
}
```

Le store est peuplé :
- Au `SESSION_JOIN` → `GET /api/campaigns/:id/documents` (fetch initial dans `SessionPage.jsx`)
- Via WS `DOC_CREATED` / `DOC_UPDATED` / `DOC_DELETED`

---

## 5. Composants client

### 5A. `LibraryPanel.jsx` (NOUVEAU)

Monté dans `Sidebar.jsx` pour `activeTab === 'biblio'`.

**Éléments interactifs :**
| Élément | Handler |
|---|---|
| Bouton "+ Document" (GM uniquement) | Ouvre `DocumentModal` en mode création |
| Ligne document dans la liste | Ouvre `DocumentModal` en mode lecture/édition |
| Badge cadenas sur document non éditable | Visuel uniquement — pas de handler |

**Données affichées par ligne :**
- Nom du document
- Icône éditable (stylo) si `canEdit`
- Icône GM-only si `viewer_ids === 'none'`

### 5B. `DocumentModal.jsx` (NOUVEAU)

Modal plein-panneau (position:fixed, z-index élevé, 800px max-width) ou panneau latéral — à décider.

**Modes :**
- `create` (GM) : formulaire vide
- `edit` (GM ou ayant droit édition) : formulaire pré-rempli
- `read` : affichage HTML — pas d'éditeur TipTap (innerHTML sanitisé)

**Inventaire complet des éléments interactifs :**

| Élément | Condition d'affichage | Handler |
|---|---|---|
| Input Nom | GM ou canEdit | `setName` |
| Dropdown "Visible par" | GM uniquement | `setViewerIds` |
| Dropdown "Peut modifier" | GM uniquement | `setEditorIds` |
| Éditeur TipTap "Description & notes" | GM ou canEdit | `setContent` |
| Éditeur TipTap "Notes du MJ" | GM uniquement | `setGmNotes` |
| Bouton "Sauvegarder" | GM ou canEdit | `handleSave` → PUT |
| Bouton "Annuler" | toujours visible | `handleClose` |
| Bouton "Supprimer" (rouge) | GM uniquement | `handleDelete` → DELETE + confirm |

**Dropdowns permission :**
Multi-select. Options :
- "Tous les joueurs" → `viewer_ids = "all"` / `editor_ids = "all"`
- "Personne" → `"none"` (visible uniquement dans dropdown éditeurs)
- Liste des membres PJ de la campagne (depuis `characterStore.members`, filtre `role !== 'gm'`)

---

## 6. TipTap — packages et configuration

### Installation (client/)

```
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-underline \
  @tiptap/extension-text-align \
  @tiptap/extension-color @tiptap/extension-text-style \
  @tiptap/extension-table @tiptap/extension-table-row \
  @tiptap/extension-table-header @tiptap/extension-table-cell \
  @tiptap/extension-link \
  @tiptap/extension-superscript @tiptap/extension-subscript
```

### Configuration éditeur (dans `DocumentModal.jsx`)

```jsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Link from '@tiptap/extension-link'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'

const editor = useEditor({
  extensions: [
    StarterKit,          // Bold, Italic, Strike, Lists, Headings, HorizontalRule, ...
    Underline,
    TextStyle,           // obligatoire pour Color
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true }),
    TableRow, TableHeader, TableCell,
    Link.configure({ openOnClick: false }),
    Superscript,
    Subscript,
  ],
  content: initialHtml,
  editable: isEditable,
})
```

### Toolbar manuelle

Barre de boutons HTML classique au-dessus du `<EditorContent>`. Chaque bouton appelle `editor.chain().focus().<commande>().run()`. Pas de composant toolbar officiel TipTap — tout est manuel. Reproduire les boutons du screenshot :

Ligne 1 : Clear | **B** | *I* | U | ~~S~~ | X² | X₂ | Liste ordonnée | Liste non ordonnée | Alignement ▾ | Lien | Supprimer lien | — | Couleur A

Ligne 2 : Tableau ▾ | H1/H2/H3 | Insérer ligne haut | Insérer ligne bas | Insérer col gauche | Insérer col droite | Merge cells | Split cell | Supprimer tableau

### Stockage

`editor.getHTML()` → stocké en DB (colonne `content_html` / `gm_notes_html` TEXT).  
Chargement : `editor.commands.setContent(htmlString)`.

**Piège CSS TipTap :** l'éditeur a besoin d'un `<style>` ou d'une classe `.ProseMirror` pour afficher correctement. Utiliser `@tiptap/starter-kit` importe les styles de base via JS — pas de CSS global requis, mais la zone éditeur doit avoir `border`, `min-height`, `padding` explicites.

---

## 7. Listeners WS — `SessionPage.jsx`

```js
// Dans le useEffect socket
socket.on(WS.DOC_CREATED, (doc) => addDocument(doc))
socket.on(WS.DOC_UPDATED, (doc) => updateDocument(doc))
socket.on(WS.DOC_DELETED, ({ id }) => removeDocument(id))

// Fetch initial après SESSION_JOINED
api.get(`/campaigns/${campaignId}/documents`).then(r => setDocuments(r.data))
```

Cleanup : `socket.off(WS.DOC_CREATED/UPDATED/DELETED)` dans le return du useEffect.

---

## 8. i18n — clés à ajouter dans `fr.json`

Section `"library"` à créer :

```json
"library": {
  "newDocument": "+ Document",
  "emptyState": "Aucun document dans cette campagne.",
  "documentName": "Nom du document",
  "visibleBy": "Dans le journal des joueurs",
  "editableBy": "Peut être modifié par",
  "allPlayers": "Tous les joueurs",
  "nobody": "Personne (MJ uniquement)",
  "descriptionNotes": "Description & notes",
  "gmNotes": "Notes du MJ (visible uniquement par le MJ)",
  "save": "Sauvegarder",
  "cancel": "Annuler",
  "delete": "Supprimer le document",
  "deleteConfirm": "Supprimer ce document définitivement ?",
  "readOnly": "Lecture seule"
}
```

---

## 9. Récapitulatif fichiers à créer / modifier

### Nouveaux fichiers
| Fichier | Description |
|---|---|
| `server/src/db/migrations/67_campaign_documents.js` | Migration table |
| `server/src/routes/documents.js` | Routes CRUD REST |
| `client/src/stores/libraryStore.js` | Store Zustand documents |
| `client/src/components/LibraryPanel.jsx` | Liste documents dans Sidebar |
| `client/src/components/DocumentModal.jsx` | Modal création/édition/lecture |

### Fichiers modifiés
| Fichier | Modification |
|---|---|
| `shared/events.js` | +DOC_CREATED, DOC_UPDATED, DOC_DELETED |
| `server/src/index.js` | Mount route `/api/campaigns/:id/documents` |
| `client/src/components/Sidebar.jsx` | Remplace le `<p>` placeholder biblio par `<LibraryPanel />` |
| `client/src/pages/SessionPage.jsx` | +listeners WS DOC_*, +fetch initial, +import libraryStore |
| `client/src/locales/fr.json` | +section "library" |
| `client/package.json` | +TipTap packages |

---

## 10. Pièges identifiés

| Code | Description |
|---|---|
| PL1 | `viewer_ids = "all"` est une **string JSON**, pas un tableau. La comparaison serveur doit être `viewerIds === 'all'`, pas `Array.isArray`. |
| PL2 | `gm_notes_html` doit être **retiré du payload** avant tout emit vers un non-GM. Ne pas envoyer `undefined` — utiliser déstructuration + omission : `const { gm_notes_html, ...safe } = doc`. |
| PL3 | TipTap `editor` peut être `null` pendant le premier render. Toujours garder si `!editor` avant d'appeler `editor.chain()`. |
| PL4 | `socket.data.role` (PE2) est requis pour le broadcast filtré. Vérifier qu'il est bien branché à `SESSION_JOIN` dans `socket/index.js`. |
| PL5 | `members` dans `characterStore` contient les membres de session chargés. Pour la liste des joueurs dans les dropdowns, filtrer `members` sur `role !== 'gm'` ET `character.type === 'pj'`. |
| PL6 | Onglet Bibliothèque existe déjà dans `Sidebar.jsx` (ligne 843). Ne pas le recréer — uniquement remplacer le `<p>` placeholder. |
| PL7 | `DOC_SHARED` existe déjà dans `events.js` — ne pas le modifier, juste ajouter les 3 nouveaux événements à côté. |

---

## 11. Sprint 2 — hors scope (pour référence)

- Upload fichier (image + PDF téléchargeable) → MinIO `campaigns/<id>/documents/<docId>/<filename>`
- Tags (colonne `tags TEXT[]` à ajouter en migration 68, filtre UI dans LibraryPanel)

---

## Ordre d'implémentation recommandé

1. Migration 67 + `documents.js` route (serveur) — SR + vérification SQL
2. `shared/events.js` + `libraryStore.js`
3. `SessionPage.jsx` — listeners + fetch initial
4. `LibraryPanel.jsx` + branchement dans `Sidebar.jsx`
5. `DocumentModal.jsx` — formulaire sans TipTap d'abord (input textarea simple)
6. TipTap — installation + intégration dans `DocumentModal`
7. i18n — clés fr.json
8. Tests fonctionnels GM + joueur