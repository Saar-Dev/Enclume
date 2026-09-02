# SYSTEME/LOCALISATION.md — i18n client, namespaces, pattern serveur

> Dernière mise à jour : 2026-08-11.
> Audit de compréhension approfondie 2026-08-26 (suite) : §2.2 corrigé — le namespace `tickets`
> (déjà listé en §2.1 depuis la correction précédente) manquait dans l'extrait de code `i18n.js`,
> alors que le vrai fichier le charge bien. §6 (contenu de catalogue) est une décision d'architecture
> non encore exécutée — rien à vérifier contre le code par construction.
>
> Statut : **Norme active. Anglais gelé (non chargé, non maintenu) — seul le FR est un objectif produit
> aujourd'hui.** Depuis le 2026-08-11 (décision Saar, `docs/Old/BUG WIZARD.md` bug #16, archivé), l'architecture doit
> rester prête à ajouter EN/DE/JAP sans réécriture — voir §6 pour le contenu de catalogue (`ref_*`), qui
> suit un mécanisme distinct de l'UI décrit aux §1-4.
>
> Lire pour : tout composant React affichant du texte, tout message système émis par le serveur, tout
> ajout de clé de traduction, toute discussion sur la taille ou le découpage de `client/src/locales/`,
> toute donnée de référence (`ref_*`) affichée à un joueur/MJ.

Documents associés :

- `.claude/rules/i18n.md` — invariants courts, auto-chargés sur les fichiers concernés.
- `docs/PLANS/PLAN_LOCALISATION.md` — chantier temporaire de résorption de la dette actuelle (Règle 10,
  `docs/RegleDocumentaire.md` — sera archivé une fois clos). Lots 1-4 : UI/.jsx. Lot 5 (§7 du plan) :
  contenu de catalogue, cf. §6 ci-dessous pour le mécanisme retenu.
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

> **Corrigé (audit 2026-08-26)** — ce tableau décrivait la cible du 2026-07-23, jamais réconciliée
> avec l'état réel après exécution de `docs/PLAN_LOCALISATION.md` : il affirmait encore
> `combat.json` **"n'existe pas encore"** alors qu'il existe et est chargé depuis la Session 173
> (2026-07-24) — donc déjà faux au moment même de la dernière date de vérification revendiquée par ce
> document (2026-07-23 < 2026-07-24). Table ci-dessous alignée sur `client/src/i18n.js` réel.

| Namespace | Contenu | État réel |
|---|---|---|
| `fr.json` | Transverse (namespace par défaut, `translation`) — **pas de fichier `common.json` séparé**, la redistribution envisagée en 2026-07-23 n'a jamais été faite (voir `docs/PLAN_LOCALISATION.md` §3, "écart réel vs plan initial") | `common`, `auth`, `errors`, `dashboard`, `sidebar`, `settings`, `profile`, `chat`, `health`, `token`, `battlemap`, `vault`, `library`, `changelog`, `trade`, `dice`, etc. |
| `charSheet.json` | Fiche personnage et tout ce qui l'entoure | Existe, peuplé (Lot 2 du plan) — 9 sections (`locations`, `aimedLocationPicker`, `common`, `armorWoundPanel`, `containerPanel`, `weaponPanel`, `inventoryPanel`, `locationPanel`, `modingWindow`) |
| `combat.json` | Retrofit combat | Existe depuis la Session 173 (2026-07-24, Lot 1 du plan), 30 sections top-level |
| `builder.json` | Éditeurs monde/objets | Existe, peuplé (Lot 3 du plan) — 8 sections |
| `creation.json` | Wizard de création de personnage | Namespace séparé, préexistant, inchangé |
| `tickets.json` | Écran `/admin/tickets` et formulaire `/tickets/new` | Existe depuis le 2026-08-12 — **absent de ce tableau jusqu'à cette correction**, `docs/SYSTEME/TICKETS.md` en parle mais pas ici |

Une section qui ne grossit pas (`trade`, `library`, `changelog`, `vault`...) reste dans `fr.json`
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
      tickets: tickets,   // ajouté 2026-08-26 — manquait à cet extrait, présent dans le vrai i18n.js
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

Les clés de messages système vivent dans `fr.json` sous `session.*` (précédent :
`session.dualWieldAmmoOutPrimary`/`dualWieldAmmoOutOffhand`), sauf message spécifique à un domaine déjà
namespacé (ex. un message combat va dans `combat.json`).

---

## 5. Hors périmètre

- Support multi-langue actif (sélecteur de langue, `en.json` chargé) — non demandé, non planifié.
- i18n des logs serveur, des noms de tables/colonnes, des codes internes (`COM9`, `PC29`...).
- Pluralisation avancée / formats de date localisés — non rencontrés à ce jour dans le projet.
- Contenu de catalogue (`ref_*`) — **n'est plus hors périmètre** depuis le 2026-08-11 ; suit §6, pas
  `client/src/locales/`.

---

## 6. Contenu de catalogue (`ref_*`) — mécanisme distinct de l'UI

### 6.1 Pourquoi un mécanisme séparé

Les §1-4 ci-dessus couvrent le texte d'interface (boutons, labels, tooltips, messages système) :
quelques centaines de chaînes courtes, réécrites par un développeur dans le JSX, changent rarement.
Le contenu de catalogue (`ref_advantages`, `ref_mutations`, `ref_skills`, `ref_careers`,
`ref_equipment`, `ref_backgrounds`, `ref_setbacks`, `ref_mutation_subtypes`, `ref_genotypes`,
`ref_career_random_benefits`) est d'une autre nature : ~1500 lignes (compté le 2026-08-11), des champs
`description` qui sont parfois des paragraphes entiers retranscrits du Livre de Base, alimentées par
seed/migration plutôt que par un composant.

Passer ce contenu par `react-i18next` (clé par ligne dans `client/src/locales/`) grossirait le bundle
JS client de tout le catalogue à chaque langue ajoutée (le build `vite` avertit déjà d'un chunk de
3,9 Mo avant tout ajout) — inadapté à ce volume. Une table de traduction normalisée séparée
(`ref_advantages_i18n(advantage_id, lang, name, description)`) évite ce problème mais impose une
jointure par lecture. Pratique retenue après recherche (bonnes pratiques pro, pas une préférence
locale — voir sources dans `docs/JOURNAL8.md`, session 2026-08-11) : **une colonne JSONB par champ
traduisible, directement sur la table `ref_*` existante**, cohérente avec l'usage JSONB déjà établi
dans ce projet (`campaigns.settings`, `char_pc_ledger.skill_allocations`) — pas un nouveau pattern à
apprendre, pas de jointure, aucune migration de schéma requise pour ajouter une langue.

### 6.2 Mécanisme

**Révisé le 2026-09-02** (analyse à charge, `docs/PLANS/PLAN_LOCALISATION.md` §7.4.1) — le FR ne
quitte pas la colonne d'origine.

- **La colonne existante (`name`, `label`, `description`, `family`…) reste l'autorité pour la langue
  par défaut (`fr`)** — inchangée. C'est la cible des écritures (outils admin, CRUD `ref_equipment`,
  seeds) : aucun drift possible, aucun retrofit d'écriture.
- Chaque colonne traduisible est doublée d'une colonne JSONB `<champ>_i18n` qui **ne porte que les
  langues supplémentaires** : `{"en": "…", "de": "…"}`. Vide `{}` aujourd'hui (FR seul). **Jamais de
  clé `fr` dedans.**
- Ajouter une langue = peupler des clés `_i18n` sur les lignes existantes (script de données), jamais
  une migration de schéma ni un changement du résolveur.
- Résolution : un helper serveur unique `server/src/lib/refI18n.js` (pas dupliqué par table) —
  `locale === DEFAULT_LOCALE ? row[champ] : (row[`${champ}_i18n`]?.[locale] ?? row[champ])`. Repli
  final sur la colonne brute (= fr). `DEFAULT_LOCALE = 'fr'` figé côté serveur ; le concept de locale
  joueur/campagne n'existe pas encore et sera câblé en **un** point le jour d'une 2ᵉ langue.
- Patron : *colonne d'origine = langue par défaut + repli* (Django `modeltranslation`, Rails
  `globalize`). Le « tout dans une structure annexe, colonne d'origine vestigiale » (spatie) suppose
  un accesseur ORM qu'on n'a pas sous Knex et crée un drift à l'édition — écarté.
- Le client reçoit toujours une chaîne déjà résolue (`adv.name`), jamais l'objet JSONB ni de logique
  de repli côté client — le serveur est la seule autorité de résolution (§4).

### 6.3 Statut

Architecture décidée le 2026-08-11, **modèle de stockage révisé le 2026-09-02** (le FR reste dans la
colonne brute ; `_i18n` ne porte que les langues ≠ fr — analyse à charge, `PLAN_LOCALISATION.md` §7).

**Phase A codée le 2026-09-02** : migration `318_ref_catalog_i18n` (27 colonnes `<champ>_i18n` sur
10 tables) + résolveur `server/src/lib/refI18n.js` (`DEFAULT_LOCALE`, `REF_TRANSLATABLE`,
`resolveRefField` / `localizeRef` / `localizeRefRows`) + câblage du **catalogue parcouru par
l'utilisateur** (Wizard, marchand, panneaux d'octroi MJ). Seam inerte en FR seul.

**Phase B non commencée** : affichage des objets *possédés* par le personnage (inventaire, combat,
export PDF, panneaux mod) — `PLAN_LOCALISATION.md` §7.7bis, plan dédié requis (code socket combat).

Le peuplement d'une 2ᵉ langue s'ouvre quand une langue ≠ fr devient un objectif produit.
