# SYSTEME/LOCALISATION.md — i18n client, namespaces, pattern serveur

> Dernière mise à jour : 2026-07-23.
>
> Statut : **Norme active. Anglais gelé (non chargé, non maintenu) — seul le FR est un objectif produit.**
>
> Lire pour : tout composant React affichant du texte, tout message système émis par le serveur, tout
> ajout de clé de traduction, toute discussion sur la taille ou le découpage de `client/src/locales/`.

Documents associés :

- `.claude/rules/i18n.md` — invariants courts, auto-chargés sur les fichiers concernés.
- `docs/PLAN_LOCALISATION.md` — chantier temporaire de résorption de la dette actuelle (Règle 10,
  `docs/RegleDocumentaire.md` — sera archivé une fois clos).
- `.claude/rules/react.md` — règle générale d'origine (`t('section.cle')`, jamais de string figée),
  ce document en est le détail faisant autorité.

---

## 1. Autorité

- `react-i18next` est le seul mécanisme de texte utilisateur côté client. Aucun texte visible
  (bouton, label, placeholder, titre, message d'erreur, tooltip) n'est écrit en dur dans un `.jsx`.
- Le serveur reste agnostique de la langue : il n'émet jamais de texte figé destiné à l'utilisateur.
  Un message système passe une clé, résolue côté client (`i18nKey`, §4).
- `client/src/locales/` est la source unique des chaînes. Une chaîne dupliquée dans deux namespaces
  est une erreur (Règle 2, `docs/RegleDocumentaire.md`).
- L'anglais n'est **pas** un objectif produit actuel (décision Saar, 2026-07-23). `en.json` existe,
  n'est chargé par aucun `resources` de `i18n.js`, et n'a plus d'obligation de synchronisation avec le
  FR. Il ne doit pas être supprimé (travail déjà fait, réactivable), mais aucune tâche ne doit être
  bloquée ou ralentie par son maintien. Si une clé FR est ajoutée sans équivalent EN, ce n'est pas une
  dette à traiter.

---

## 2. Namespaces — pourquoi et comment

`fr.json` seul ne passe pas à l'échelle : au 2026-07-23 il contient déjà 31 sections / ~1039
lignes **sans une seule clé combat**, le plus gros ensemble de texte du projet et encore non traité
(`docs/PLAN_LOCALISATION.md`). Un fichier unique qui continue de grossir devient illisible à éditer et
en revue de diff.

`react-i18next` supporte nativement plusieurs namespaces chargés en parallèle — le projet l'a déjà
fait une fois (`creation.json`, chargé à côté de la traduction par défaut dans `i18n.js`). La norme
généralise ce pattern plutôt que d'en inventer un autre.

### 2.1 Répartition des namespaces

| Namespace | Contenu | Sections actuelles concernées |
|---|---|---|
| `common.json` | Transverse, présent sur presque tout écran | `common`, `auth`, `errors`, `dashboard`, `sidebar`, `settings`, `profile`, `chat`, `health`, `token`, `battlemap`, `vault`, `library`, `changelog`, `trade` |
| `charSheet.json` | Fiche personnage et tout ce qui l'entoure | `charSheet`, `advantages`, `skillsPanel`, `entityPanel`, `drone`, `los`, `status`, `radialMenu`, `tokenRadial` + retrofit équipement (`docs/PLAN_LOCALISATION.md` Lot 2) |
| `combat.json` | **Nouveau**, n'existe pas encore | Tout le retrofit combat (`docs/PLAN_LOCALISATION.md` Lot 1) |
| `builder.json` | Éditeurs monde/objets | `builder`, `surfaceEditor`, `texturePacks`, `workshop`, `entity` + retrofit Surface (Lot 3) |
| `creation.json` | Wizard de création de personnage | Déjà namespace séparé — inchangé |

Une section qui ne grossit pas (`trade`, `library`, `changelog`, `vault`...) reste dans `common.json`
tant qu'elle n'atteint pas une taille justifiant un fichier dédié (Règle 3, `docs/RegleDocumentaire.md`
— le découpage suit la responsabilité, jamais un seuil de taille arbitraire ; ici le signal est "ce
domaine a son propre écran/chantier dédié", pas un nombre de lignes).

### 2.2 Déclaration dans `i18n.js`

```javascript
i18n.use(initReactI18next).init({
  resources: {
    fr: {
      translation: common,   // namespace par défaut, pas de préfixe requis dans t()
      creation: creation,
      charSheet: charSheet,
      combat: combat,
      builder: builder,
    },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  supportedLngs: ['fr'],
})
```

Un composant hors du namespace par défaut précise le sien :
`const { t } = useTranslation('combat')` puis `t('actionWindow.confirm')`.

### 2.3 Convention de nommage des clés

`namespace` implicite (dossier) → `section.sousSection.cle`, cohérent avec l'existant
(`charSheet.attrs.force`, `advantages.title`...). Pas de clé à la racine d'un namespace hors les
clés véritablement globales du namespace (`common.yes` / `common.cancel`).

---

## 3. Aucun texte en dur — ce que ça couvre

Concerne tout texte visible par un joueur ou un MJ : enfant JSX littéral, `placeholder=`, `title=`,
`aria-label=`, `alt=`, contenu de `<option>`, message d'erreur affiché, tooltip. Ne concerne pas les
identifiants techniques (noms de classes CSS, clés d'objet, `data-*`, codes internes type `COM9`).

Avant d'ajouter du texte visible dans un composant :

1. Vérifier si la clé existe déjà dans le namespace concerné (éviter la duplication, Règle 2).
2. Sinon, ajouter la clé dans `fr.json` (ou le namespace concerné) avant de l'utiliser dans le JSX —
   jamais l'inverse.
3. Utiliser `t('...')`, jamais une chaîne littérale, même « juste pour l'instant ».

### 3.1 Config partagée hors composant (ex. `combatSections.js`)

Un module exporté (labels d'actions, définitions d'état...) consommé par plusieurs composants stocke
des **clés**, jamais du texte : `{ k: 'move', l: 'combat.actions.move.label' }`. Chaque composant
résout `t(a.l)` au moment du rendu JSX — jamais de texte figé dans le module partagé.

Si le module contient aussi des **fonctions pures qui composent elles-mêmes une chaîne affichable**
(ex. `calcIniBreakdown` qui construit `` `${def.label} : ${fromLabel} → ${toLabel}` ``) : ces fonctions
ne peuvent pas appeler `useTranslation()` elles-mêmes (règle des hooks — hors corps de composant).
`t` leur est passé en paramètre explicite par le composant appelant, qui l'a déjà via
`useTranslation()`. Cohérent avec la convention déjà en place pour `charStats.js`
(`docs/SYSTEME/CONVENTIONS.md` §18 : fonctions pures, le caller fournit les données) — étendue ici à
`t` comme toute autre dépendance externe.

---

## 4. Pattern serveur — messages système traduits

Un message émis par le serveur et affiché à un joueur (ex. `WS.CHAT_MESSAGE` système) ne porte jamais
de texte FR figé. Il porte un flag `system: true` et une clé `i18nKey`, résolue côté client via `t()`.

Pattern existant (`server/src/socket/socketCombatHelpers.js`, généralisable à tout message système) :

```javascript
// Serveur — aucune chaîne, seulement l'identifiant de la clé
emissions.push({
  to: 'user', userId: character.user_id ?? null, fallback: 'socket',
  event: WS.CHAT_MESSAGE,
  data: { system: true, i18nKey: 'session.dualWieldAmmoOutOffhand', timestamp: new Date().toISOString() },
})
```

```javascript
// Client (client/src/lib/useSessionSocket.js) — résolution
text: t(payload.i18nKey)
```

Les clés de messages système vivent dans `common.json` sous `session.*` (précédent :
`session.dualWieldAmmoOutPrimary`/`dualWieldAmmoOutOffhand`), sauf message spécifique à un domaine déjà
namespacé (ex. un message combat va dans `combat.json`).

---

## 5. Hors périmètre

- Support multi-langue actif (sélecteur de langue, `en.json` chargé) — non demandé, non planifié.
- i18n des logs serveur, des noms de tables/colonnes, des codes internes (`COM9`, `PC29`...).
- Pluralisation avancée / formats de date localisés — non rencontrés à ce jour dans le projet.
