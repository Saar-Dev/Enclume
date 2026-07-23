Wizard collaboratif GM/Joueur

> Statut : audité contre le code réel le 2026-07-23 (agent d'exploration, lecture seule). Décisions
> tranchées avec Saar le même jour — voir §0. Document temporaire (`docs/RegleDocumentaire.md`
> Règle 10) — à archiver une fois le chantier clos, contenu durable transféré vers le DOMAIN/SYSTEM
> concerné.

---

## 0. Audit et décisions tranchées (2026-07-23)

**Écarts factuels trouvés entre ce plan et le code réel** (corrigent les sections ci-dessous, ne pas
relire ce paragraphe comme une deuxième source — les sections 2 à 8 sont déjà corrigées en
conséquence) :

- `char_sheet.owner_user_id` proposé en option (§2.2 initial) : **abandonné**. L'ownership est déjà
  autoritaire sur `characters.user_id` (utilisé dans `routes/creation.js:48`) — l'ajouter aurait
  dupliqué une propriété qui possède déjà une autorité unique (`CLAUDE.md` §1.4).
- `GET /:sheetId/state` (§4.3 initial) : **n'existe pas**. Seuls `getStep4State` (archetype+carrières)
  et `getStep5RefData` (données de référence, pas l'état joueur) existent. Construire ce endpoint est
  plus gros que "déjà existantes" ne le suggérait — il manque les getters état-joueur pour
  step1/2/3/5.
- `optionKey` unifié (§2.2/§6.4 initial) : aucune notion de ce type n'existe. Décision : réutiliser les
  identifiants natifs déjà stables de chaque table, préfixés par domaine, plutôt qu'une nouvelle
  colonne de normalisation (détail §3bis).
- `gmBypass` (§2.4/§4.5 initial) : aucune trace dans `reconcileCreation`. **Simplifié depuis** (§0
  "Décisions de périmètre" point 3, 3e passe) : pas de flag ni de bouton séparé, `isGm` suffit ; pas
  d'augmentation de budget PC (annulée) ; rien sur les mutations (aucun contrôle existant). Détail
  exact §4.5 — ce paragraphe-ci ne décrit que l'écart initial trouvé, pas l'état retenu.
- `req.isGm` : mécanisme réel (`campaign_members.role === 'gm'`), mais dupliqué route par route
  (`routes/creation.js`, `routes/characters.js`, `socket/index.js`), jamais factorisé. **Précisé en
  5e passe (§0)** : il existe déjà un middleware générique `requireRole('gm')`
  (`server/src/middleware/role.js`) pour les routes où `campaignId` est un paramètre d'URL direct — à
  réutiliser tel quel, pas à recréer. Pour les routes/événements scopés par `sheetId` (où
  `campaignId` doit d'abord être résolu via `char_sheet → characters`), la logique de
  `router.param('sheetId')` (`creation.js:35-58`) est extraite en une fonction unique
  `resolveSheetAccess(sheetId, userId)`, partagée par le middleware REST existant (remplace son corps
  actuel, aucun changement de comportement) et les nouveaux handlers WebSocket — c'est cette
  duplication précise (REST vs WS réimplémentant la même chaîne de lookup) qui justifie l'extraction,
  pas une fonction `isGm` générique inventée sans lien avec le code réel.
- `SocketProvider` "monté pour la première fois dans le Wizard" (texte §6.1 initial) : faux — déjà
  monté dans `WizardCreation.jsx`, déjà consommé par `Step3Mutations.jsx`/`ProAdvantagesAndSetbacks.jsx`.
  La room de campagne et `socket.role` sont déjà posés côté serveur (`socket/index.js:51-56` via
  `SESSION_JOIN`) — infrastructure à réutiliser, pas à recréer.

**Deuxième passe — analyse critique (2026-07-23, recherche externe : Figma, Liveblocks, Notion, Yjs,
Baserow, Google Sheets, DynamoDB)** : deux trous de conception réels trouvés et corrigés dans les
sections ci-dessous (pas de simples détails) —

- **Diffusion scopée par fiche, pas par campagne.** Le brouillon initial rediffusait
  `WIZARD_LOCKS_SYNC` à toute la room de campagne (`SESSION_JOIN`) — fuite de confidentialité (tout
  joueur connecté aurait vu qu'un autre est en train de créer un personnage, et le détail de ses
  verrous). Figma (process par document), Liveblocks (Room = un artefact, pas un workspace), Notion
  (abonnement par enregistrement) et Yjs (awareness scopée au document) convergent tous vers une
  granularité "une ressource = un canal dédié". Corrigé : room `wizard:<sheetId>` dédiée, nouvel
  événement `WIZARD_JOIN` (§2.1/§5/§6).
- **Verrous appliqués côté serveur, pas seulement en UI.** Google Sheets ("Google Sheets does all
  such enforcement"), Baserow ("any external request... immediately return FIELD_NOT_EDITABLE... same
  RBAC rules as the web interface") et Notion (le serveur valide "against the actual current state,
  not the client's assumed state") confirment tous qu'un verrou doit être revalidé à l'écriture
  serveur, jamais seulement masqué côté client — c'est aussi déjà l'exigence explicite de `CLAUDE.md`
  §7 ("le serveur reste autoritaire"). Corrigé : `reconcileCreation` rejette (400) toute soumission du
  **joueur** (pas du MJ) qui contredit un verrou actif, à chaque appel — pas seulement à la
  finalisation (§4.5).
- **Conflit MJ/joueur silencieux.** Aucun système étudié (même hiérarchique/last-writer-wins :
  DynamoDB, Liveblocks Storage, Yjs) n'abandonne complètement la détection de conflit, même quand une
  partie a l'autorité finale — DynamoDB documente explicitement le risque d'écrasement silencieux
  sans version. Décision : log serveur non bloquant (pas de blocage UI, pas de nouvelle colonne —
  réutilise `char_sheet.updated_at` déjà existant) si le MJ force une validation alors que le joueur a
  modifié le brouillon depuis la dernière lecture MJ (§4.5). Cohérent avec la convention déjà en place
  du projet (serveur verbeux, logs `[DBG]`).
- Nettoyage : les lignes `wizard_locks` d'un brouillon sont supprimées explicitement à la finalisation
  (`lockWizard`) — sans ça elles resteraient en base indéfiniment après qu'un brouillon devient un
  personnage réel (le `ON DELETE CASCADE` ne joue qu'à la suppression de `char_sheet`, jamais à la
  finalisation).

**Quatrième passe — analyse à charge (2026-07-23)** : corrections structurelles, pas de simples
reformulations —

- **Verrous : toggle atomique, pas remplacement intégral.** L'idée initiale (client envoie tout le
  tableau de verrous à chaque bascule, serveur DELETE+INSERT tout) crée une vraie race : deux onglets
  MJ, ou une reconnexion qui réordonne les paquets, et un tableau périmé écrase un tableau plus
  récent — un verrou posé entre-temps disparaît sans erreur. Un client qui émettrait un tableau vide
  avant d'avoir reçu son premier `WIZARD_LOCKS_SYNC` effacerait aussi tous les verrous existants.
  Corrigé : `WIZARD_LOCK_UPDATE`/`PUT /locks` deviennent un toggle d'un seul `(step, optionKey)`
  (upsert ou delete d'une ligne), jamais un remplacement de tableau (détail §4.4/§5).
- **Aucun test prévu pour la partie la plus risquée du plan (Lot B).** Faire sauter 4 gardes-fous
  (éligibilité carrière, 2 budgets, budget attributs) dans une fonction de ~960 lignes couverte par
  181+33 tests existants, sans ajouter de test dédié aux branches `isGm`, expose à une régression
  silencieuse qui affaiblirait une validation pour le joueur aussi. Ajouté explicitement au Lot B
  (§8) : un test par point de blocage contourné (`isGm=true` bypasse, `isGm=false` inchangé).
- **Mode guide désactivé = deux écrivains sur le même brouillon, assumé mais pas encore écrit noir sur
  blanc.** Quand le MJ agit "comme un joueur", son client réconcilie sur le même `sheetId` que le
  joueur, en parallèle — l'architecture client-primary existante (`docs/STE6_FINAL.md`) suppose un
  seul client vivant par brouillon. Le log de conflit (§4.5) ne couvre qu'un sens (MJ écrase joueur) ;
  si le joueur soumet après une modification MJ non vue, rien ne le détecte. Accepté comme limite
  V1, explicité en §2.4 plutôt que découvert en test.
- **Sémantique des verrous Step1 précisée** : un verrou `attr_<ID>` gèle la valeur dans les deux sens
  (+ et -), pas seulement l'augmentation — cohérent avec les autres étapes (verrouillé = tout ou
  rien), détail §3bis.
- **Filtre `acquired_during` de `getStep5State` tranché**, pas laissé en suspens : `'creation_step5'`
  uniquement — c'est exactement le filtre que `reconcileCreation` utilise déjà pour savoir quoi
  wiper/réinsérer à cette étape (ligne 933). L'état lu doit refléter l'autorité qui l'écrit, pas un
  sous-ensemble différent choisi à la légère.
- **`WIZARD_JOIN` sans réponse en cas de refus** : pas de code HTTP en WebSocket. Corrigé par
  réutilisation du patron déjà en place (`COMBAT_DECLARE_ERROR`, `TRADE_ERROR` — erreur métier émise
  au socket émetteur seul, jamais à la room) : nouvel événement `WIZARD_ERROR` (détail §5).

**Cinquième passe (2026-07-23, vérification directe du code — pas d'affirmation sans lecture)** :

- **`isGm` factorisé, précisé plutôt qu'inventé.** Lecture de `server/src/middleware/role.js` : un
  middleware générique `requireRole('gm')` existe déjà (`campaignId` direct en paramètre d'URL) — à
  réutiliser tel quel pour `GET /campaign/:campaignId/drafts` et `targetUserId` sur `/start`, aucune
  nouvelle fonction nécessaire là. Pour les routes/événements scopés par `sheetId` (où `campaignId`
  doit être résolu via une jointure), la vraie duplication à éliminer est entre le middleware REST
  `router.param('sheetId')` et les futurs handlers WebSocket, qui referaient sinon chacun la même
  chaîne de lookup — extraite en `resolveSheetAccess(sheetId, userId)`, partagée par les deux.
- **Brouillon dupliqué — trou réel introduit par `targetUserId` (Lot A3), pas préexistant.**
  `startCreation` (creationService.js:250-283) crée un `char_sheet` sans jamais vérifier qu'un
  brouillon actif existe déjà pour cet utilisateur. Avant ce chantier, seul le joueur appelait `/start`
  et son propre client évitait le doublon (état local). `targetUserId` permet à un MJ de démarrer un
  brouillon dont le joueur concerné ignore tout — si ce joueur déclenche ensuite le flux normal (ou
  l'inverse), deuxième brouillon orphelin, silencieux. Corrigé : `startCreation` retourne le brouillon
  actif existant (`wizard_locked_at IS NULL`) pour ce `user_id`/campagne au lieu d'en créer un second,
  dans les deux sens (détail §4.2).
- Existant confirmé et réutilisable tel quel pour la liste de joueurs à cibler (`targetUserId`, Lot
  A3, DashboardPage) : `GET /api/campaigns/:id/members` (`campaigns.js:360`, déjà `requireRole('gm')`,
  retourne `user_id`/`role`/`character_name`) — pas de nouvel endpoint à créer.

**Sixième passe (2026-07-23, contre les règles projet explicites `.claude/rules/react.md`/`core.md`,
pas encore croisées avec ce plan)** :

- **i18n oublié.** `react.md` : tout texte visible passe par `useTranslation`/`t('section.cle')`,
  jamais de string codée en dur. Le plan introduit du texte (toggle "Mode guide", liste des
  brouillons, sélecteur de joueur) sans le mentionner. Le namespace `wizard.*` existe déjà
  (`wizard.step`, `wizard.pc_label`, confirmés dans `docs/EN_COURS.md`) — les nouvelles clés s'y
  greffent, dans `client/src/locales/fr.json` (toutes les langues du projet).
- **Composants CSS existants ignorés.** `.btn-toggle` (variante déjà listée dans `react.md`) pour le
  toggle "Mode guide", pas un composant inventé. `badge badge-gm` (patron déjà en place) pour
  l'indicateur "le MJ voit ses propres verrous". Le grisé d'une option verrouillée passe par une
  classe CSS conditionnelle (`.locked` ou équivalent), jamais `style={{opacity: ...}}` — `style={}`
  est réservé au layout/position, une valeur visuelle passe par une classe ou une custom property
  (règle explicite `react.md`).
- **Hygiène des rooms/listeners à la navigation — trou réel, pas cosmétique.** `core.md` : nettoyer
  listeners/rooms à la déconnexion **ou à l'échec** — mais le socket reste connecté à travers toute la
  SPA (pas de reconnexion entre pages React Router). Un MJ qui ferme le brouillon du joueur A pour
  ouvrir celui du joueur B sans quitter `wizard:<sheetId_A>` resterait membre des deux rooms — son
  handler `WIZARD_LOCKS_SYNC` générique recevrait alors des mises à jour du brouillon A pendant qu'il
  regarde B. Corrigé (détail §5/§6.1) : `WIZARD_JOIN` fait quitter côté serveur toute room `wizard:*`
  précédente de ce socket avant de rejoindre la nouvelle (un seul brouillon actif par connexion,
  appliqué serveur — pas un client qui doit s'en souvenir), et le handler client ignore par défense
  toute `WIZARD_LOCKS_SYNC` dont le `sheetId` ne correspond pas au brouillon actuellement monté.

Confirmé conforme sans changement nécessaire : REST et WS partagent déjà le même service (`PUT
/locks`/`WIZARD_LOCK_UPDATE` appellent la même logique de toggle, `resolveSheetAccess` partagé,
`core.md`) ; pas de boucle d'écho optimiste (`lockedOptions` jamais modifié localement sans
confirmation serveur, §2.3/§6.1).

**Septième passe (2026-07-23, agent frais parti du plan + lecture réelle de `creation.js`,
`creationService.js`, `role.js`, `shared/events.js`, `socket/index.js`, migrations récentes,
`VOCABULARY.md`)** : quatre zones d'ombre réelles, pas tranchées assez précisément pour coder le
Lot A1 sans risque —

- **Numérotation migration : vérifiée, pas contradictoire — juste incomplètement vérifiable d'ici.**
  `git log` confirme migrations 158→200 (Sessions 142-171, `dev/Saar`) toutes paires — normal, la
  règle de parité (`CLAUDE.md` §2) vient d'être ajoutée aujourd'hui, prospective, pas rétroactive.
  Ce qui **ne peut pas** être vérifié depuis ce dépôt : l'état réel de `dev/monde`, hébergé sur une
  autre machine (`CLAUDE.md` §3, pas de branche/remote locale) — le garde-fou structurel reste
  `docs/WORKFLOW_FUSION.md` à la fusion. **Saar confirme formellement la convention impaire** (2026-07-23,
  en cours de 7e passe) : migration suivante = prochain numéro impair disponible (201, à revérifier
  contre `knex_migrations` au moment du code), sans attendre une vérification cross-dépôt impossible
  depuis ici.
- **Dérivation `optionKey` dupliquée client/serveur — réelle, violerait `CLAUDE.md` §7.** L'enforcement
  serveur (§4.5) doit produire exactement la même chaîne que le client (ex. `career_<code>` depuis un
  `career_id` UUID soumis). Corrigé : un nouveau `shared/wizardOptionKeys.js` (même famille que
  `shared/careerEligibility.js`/`careerAdvantages.js` déjà utilisés des deux côtés) exporte les
  fonctions pures de formatage (`careerOptionKey(code)`, `genotypeOptionKey(id)`, etc.) — le client
  les appelle avec les données qu'il a déjà en mémoire (ref data), le serveur résout d'abord le
  `code`/`id` par une lecture DB (inévitable, pas une duplication) puis appelle la **même** fonction
  de formatage. Une seule définition du format de clé, deux points d'entrée de données différents.
- **Sémantique d'enforcement précisée — geler la valeur, pas interdire toute resoumission.** Le
  reconciler renvoie l'état complet de chaque étape à chaque appel (confirmé en lisant le code) : un
  enforcement qui rejette toute soumission contenant un champ verrouillé casserait le Wizard dès
  qu'une seule option serait verrouillée (le joueur ne pourrait plus jamais sauvegarder cette étape,
  même sans y toucher). Règle retenue, qui unifie aussi le point suivant : **on compare la valeur
  soumise à la valeur actuellement persistée pour cette clé** — rejet uniquement si elles diffèrent
  ET que la clé est verrouillée. Concrètement : pour un choix unique (génotype, main directrice,
  attribut), verrouillé + valeur soumise ≠ valeur persistée → rejet ; valeur soumise = valeur
  persistée (aucun changement réel) → toujours accepté. Pour un ensemble (carrières, mutations,
  avantages), verrouillé + retiré de l'ensemble soumis alors qu'il était présent → rejet ; verrouillé
  + ajouté à l'ensemble soumis alors qu'il était absent → rejet ; inchangé → accepté. Détail exact
  §4.5.
- **`hand_L`/`hand_R` : suivent le modèle catalogue (genotype/carrière), pas le modèle `attr_<ID>`.**
  La note "gèle +/-" du §3bis ne s'appliquait qu'aux attributs (valeur continue) — un choix discret à
  3 valeurs (Droite/Gauche/Ambidextre) n'a pas de sens en +/-. Avec la règle unifiée ci-dessus
  (comparaison à la valeur persistée), plus besoin de deux notes séparées : `attr_<ID>` et
  `hand_L`/`hand_R` suivent exactement la même règle générale — la note "+/-" est retirée, elle était
  redondante avec la règle générale, pas un cas spécial.

**Décisions de périmètre et de séquence (Saar, 2026-07-23)** :

1. Verrous d'options : basique, sur les 5 étapes (y compris Step1 Attributs).
2. `isGm` factorisé — précisé en 5e passe : `requireRole('gm')` existant réutilisé tel quel pour les
   routes `campaignId`-direct, `resolveSheetAccess(sheetId, userId)` nouveau pour les routes/événements
   scopés par fiche (détail §0).
3. **`gmBypass` simplifié (2026-07-23, 3e passe)** : pas de flag explicite ni de bouton « Forcer la
   validation » séparé — dès que le soumetteur du `reconcile` est le MJ (`isGm`), aucune condition
   d'éligibilité ni aucun coût/budget ne bloque quoi que ce soit, à tout moment (pas seulement à la
   finalisation). Catalogue exact des points concernés en §4.5. Pas de mutation "normalement
   interdite" à débloquer : aucun contrôle de ce type n'existe aujourd'hui côté serveur pour les
   mutations (seul un filtre de coût existe, `Step3Mutations.jsx:292`) — rien à coder sur ce point.
   **Augmentation du budget PC du joueur : annulée** (aurait nécessité une vraie colonne persistante,
   `PC_TOTAL=20` n'étant qu'une constante client, jamais un total vérifié serveur — Saar juge que ça
   n'en vaut pas la peine).
4. **Priorité** : d'abord permettre au MJ d'assister le joueur (verrous + ouverture du brouillon),
   ensuite seulement la conclusion de la création (`gmBypass`/finalisation).
5. **Hors périmètre de ce document** : un outil MJ pour transformer les jauges d'Avantages
   Professionnels (MATERIEL, RELATIONS/CONTACTS/ALLIES, BAR/ATELIER/CABINE) en effets concrets
   (objets d'inventaire, PNJ liés, possession qualifiée). Chantier réel et voulu, mais responsabilité
   distincte (`docs/RegleDocumentaire.md` Règle 1 — touche inventaire/PNJ, pas la collaboration
   MJ/joueur) : à documenter dans un PLAN séparé, après ce chantier-ci. Base déjà existante à
   réutiliser le moment venu : `char_traits` (Allié/Contact/Ennemi/Opposant déjà trackés) et le moteur
   d'effets `shared/careerRandomEffectsData.js`/`careerAdvantages.js`.

---

## 1. Fondations : inspiration des outils collaboratifs

### 1.1 Arbitrage serveur (Figma)

Figma utilise un serveur autoritaire : chaque modification passe par le backend, qui applique
l'opération et la broadcast. Aucun pair ne peut écrire directement dans le store d'un autre. Cette
approche garantit la cohérence et simplifie la résolution de conflits. Nous la répliquons ici : le
MJ émet son intention de blocage via WebSocket, le serveur valide, persiste et redistribue.

### 1.2 Verrouillage non destructif (Notion)

Notion n'empêche pas l'édition simultanée, mais affiche la présence et les sélections des autres
utilisateurs. Pour notre Wizard, le conflit n'est pas sur le contenu textuel mais sur le choix
d'options. Nous adoptons un système de verrous binaires non bloquants : une option grisée est
simplement non cliquable pour le joueur, mais il peut travailler sur les autres champs. Pas de verrou
d'étape entier.

### 1.3 Modes d'édition vs commentaire (Figma, Miro)

Figma distingue le mode Édition (curseur normal) et le mode Commentaire (bulle). Nous transposons
cela avec le toggle « Mode guide » : lorsqu'il est actif, les clics du MJ deviennent des bascules de
verrous ; lorsqu'il est inactif, le MJ agit comme un joueur (sélectionne). L'activation par défaut est
conforme à l'usage premier du MJ : guider.

### 1.4 Validation hiérarchique (Google Docs)

Google Docs permet un propriétaire qui peut restreindre les droits. Nous nous inspirons de cette
hiérarchie : le MJ dispose d'un droit de réécriture finale (`gmBypass`), sans que cela invalide le
travail intermédiaire du joueur. Le contournement n'est pas un mode permanent, mais un appel explicite
lors de la réconciliation.

---

## 2. Décisions architecturales

### 2.1 WebSocket avec serveur autoritaire

Nous utilisons WebSocket (Socket.io) pour la synchronisation des verrous en temps réel. La connexion
et l'appartenance à la campagne réutilisent l'existant (`SESSION_JOIN`/`SocketContext.jsx`,
`socket/index.js`) — mais la diffusion des verrous **ne va pas à toute la room de campagne** :
Figma, Liveblocks, Notion et Yjs diffusent tous au niveau d'un document/ressource précis, jamais au
niveau workspace (§0, deuxième passe). Chaque brouillon a donc sa propre room `wizard:<sheetId>`,
rejointe explicitement par le joueur (à l'ouverture de son Wizard) et par le MJ (quand il ouvre ce
brouillon). Le serveur persiste chaque changement avant de le diffuser, garantissant qu'un refresh du
client retrouve le même état. Trois nouveaux événements dans `shared/events.js` (nouveau domaine
`WIZARD:`, aucune collision de nom trouvée) :

- `WIZARD_JOIN` (client → serveur) : rejoint `wizard:<sheetId>` (vérifie ownership ou `isGm`), répond
  immédiatement par un `WIZARD_LOCKS_SYNC` avec l'état courant. Si refusé, `WIZARD_ERROR` au socket
  émetteur seul (jamais la room) — même patron que `TRADE_ERROR`/`COMBAT_DECLARE_ERROR` déjà en place.
- `WIZARD_LOCK_UPDATE` (MJ → serveur) : bascule **un seul** `(step, optionKey)` — jamais un
  remplacement de tableau (§0, 4e passe).
- `WIZARD_LOCKS_SYNC` (serveur → room `wizard:<sheetId>` uniquement) : état complet et faisant
  autorité, recalculé côté serveur après chaque bascule — c'est une lecture, pas une écriture, donc
  aucune race possible même si le client, lui, ne raisonne qu'en un seul verrou à la fois.
- `WIZARD_ERROR` (serveur → socket émetteur seul)

### 2.2 Modèle de verrou atomique

Chaque verrou est un triplet `(sheetId, step, optionKey)`. Le verrou est stocké dans une table
`wizard_locks` :

- `char_sheet_id` (UUID, FK vers `char_sheet.id`)
- `step` (entier 1-5)
- `option_key` (texte)

Unicité garantie par contrainte composite. Une absence de ligne signifie option libre.

**Pas de colonne `owner_user_id` sur `char_sheet`** — l'ownership reste sur `characters.user_id`,
déjà joint partout où nécessaire (§0).

### 2.3 État partagé entre GM et joueur

Le store Zustand du joueur reflète ses propres données. Les verrous sont stockés dans un champ
`lockedOptions: Set<string>` synchronisé via WebSocket, séparé des données métier.

Le MJ, lorsqu'il ouvre le brouillon d'un joueur, charge l'état réconcilié le plus récent via
`GET /creation/:sheetId/state` — **ce endpoint n'existe pas encore et doit être construit** (les
getters step1/2/3/5 côté état joueur manquent, seul `getStep4State` existe). Pas de « mode fantôme »
en V1 : le MJ voit l'état tel que le joueur l'a enregistré pour la dernière fois. Pour les verrous,
ils sont immédiatement visibles car poussés par WebSocket (room `wizard:<sheetId>`, §2.1).

**Les verrous ne sont pas qu'un affichage.** Le serveur les revalide à chaque `reconcileCreation`
soumis par le joueur (pas par le MJ) : toute option choisie qui correspond à un verrou actif est
rejetée (400), sans attendre la finalisation — détail §4.5. Sans cette revalidation, un appel direct
à l'API (ou un bug client) contournerait silencieusement le verrou, ce que `CLAUDE.md` §7 interdit
déjà explicitement ("le serveur reste autoritaire").

### 2.4 Résolution de conflits

Règle : le MJ a toujours raison. Lors d'une réconciliation déclenchée par le MJ, les données qu'il
envoie écrasent celles du joueur, sans aucune condition d'éligibilité ni de budget (§0.3, 3e passe) —
pas de flag ni de bouton séparé, le simple fait que le soumetteur soit `isGm` suffit (détail §4.5).
Ce comportement est assumé (pas de blocage UI). Un log serveur non bloquant trace si le joueur a
modifié le brouillon depuis la dernière lecture MJ (aucun système étudié, même hiérarchique,
n'abandonne totalement la détection de conflit — DynamoDB documente explicitement le risque
d'écrasement silencieux sans elle).

À la finalisation (`lockWizard`), les lignes `wizard_locks` de ce brouillon sont supprimées
explicitement — sans ça elles resteraient en base indéfiniment (le `ON DELETE CASCADE` ne joue qu'à
la suppression de `char_sheet`, jamais à la finalisation en personnage réel).

**Double écrivain quand le mode guide est désactivé — limite V1 assumée (§0, 4e passe).** Le MJ qui
agit "comme un joueur" (§1.3/§6.3) réconcilie sur le même `sheetId` que le joueur, en parallèle —
l'architecture client-primary existante (`docs/STE6_FINAL.md`) suppose historiquement un seul client
vivant par brouillon. Le log de conflit ci-dessus ne couvre qu'un sens (MJ écrase joueur, car c'est
là que `isGm` est vrai) : si le joueur soumet après une modification MJ qu'il n'a pas vue, rien ne le
détecte. Accepté comme limite V1 — pas une raison de bloquer le chantier, mais un comportement
explicite, pas une découverte de bug plus tard.

---

## 3. Modèle de données

### Nouvelle table `wizard_locks`

```sql
CREATE TABLE wizard_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  char_sheet_id UUID NOT NULL REFERENCES char_sheet(id) ON DELETE CASCADE,
  step SMALLINT NOT NULL CHECK (step BETWEEN 1 AND 5),
  option_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (char_sheet_id, step, option_key)
);
```

Numéro de migration : prochain impair disponible (Claude), à vérifier au moment du code contre les
fichiers présents et `knex_migrations` (`CLAUDE.md` §2/§5).

### 3bis. Mapping des `optionKey` (décidé §0.3)

Pas de nouvelle colonne de normalisation : chaque étape réutilise son identifiant natif déjà stable,
préfixé par domaine. Le **formatage** de la clé est une fonction pure, partagée client/serveur
(`shared/wizardOptionKeys.js`, décidé §0 7e passe — même famille que `shared/careerEligibility.js`)
— jamais réimplémenté séparément de chaque côté (`CLAUDE.md` §7).

| Étape | Préfixe | Source | Type réel |
|---|---|---|---|
| Step1 Attributs | `attr_<ID>` (ex. `attr_FOR`) | saisie directe | — |
| Step1 Main directrice | `hand_L`/`hand_R` | saisie directe | choix discret (Droite/Gauche/Ambidextre) — même règle que génotype/carrière, pas un cas à part |
| Step2 Génotype | `genotype_<id>` (ex. `genotype_HUMAIN`) | `ref_genotypes.id` | texte (déjà un slug) |
| Step3 Mutations | `mutation_<mutation_id>` | `ref_mutations.mutation_id` | integer |
| Step4 Carrières | `career_<code>` (ex. `career_chasseur_primes`) | `ref_careers.code` | texte (existe déjà, pas l'uuid `id`) |
| Step5 Avantages | `advantage_<advantage_id>` (ex. `advantage_adv_077`) | `ref_advantages.advantage_id` | texte (déjà un slug) |

**Sémantique du verrou, unifiée pour toutes les lignes ci-dessus (§0, 7e passe)** : un verrou compare
la valeur **soumise** à la valeur **actuellement persistée** pour cette clé — il interdit un
changement vers/depuis l'option verrouillée, jamais la simple resoumission de l'état déjà acquis
(détail algorithme §4.5). Pas de note spéciale "+/-" pour les attributs : ils suivent la même règle
que tout le reste.

---

## 4. API REST

### 4.1 Brouillons de campagne

```
GET /api/creation/campaign/:campaignId/drafts
```

Retourne `{ sheetId, characterId, ownerName, ownerUserId, creationState, updatedAt }[]`. Pour un
joueur, filtrage sur `characters.user_id = req.user.id`. Pour un MJ (`isGm`), pas de filtre.
**N'existe pas aujourd'hui** — nouvelle route.

### 4.2 Démarrage pour un joueur

```
POST /api/creation/start
Body: { campaignId, targetUserId? }
```

Aujourd'hui, `POST /start` (`creation.js:62-75`) ne prend que `campaignId`. `targetUserId` est un
ajout : si fourni et que l'appelant est MJ (`requireRole('gm')`), vérifier que la cible est membre de
la campagne, puis créer le brouillon avec `characters.user_id = targetUserId`. Sinon, comportement
inchangé.

**Idempotence obligatoire (§0, 5e passe)** : `startCreation` vérifie d'abord si un `char_sheet` actif
(`wizard_locked_at IS NULL`) existe déjà pour ce `user_id` dans cette campagne — si oui, retourne son
`sheetId` existant au lieu d'en créer un second. S'applique que l'appelant soit le joueur lui-même ou
un MJ via `targetUserId` — sans ça, `targetUserId` peut faire naître un brouillon orphelin que le
joueur ignore (détail §0).

### 4.3 État complet du brouillon

```
GET /api/creation/:sheetId/state
```

**N'existe pas** — à construire. Retourne les données réconciliées (step1 à step5). Réutilise
`getStep4State` tel quel pour step4 ; nécessite d'écrire les getters équivalents pour step1
(attributs/main directrice), step2 (génotype), step3 (mutations retenues), step5 (avantages
retenus). `getStep5State` filtre `char_advantages` sur `acquired_during = 'creation_step5'`
uniquement (tranché §0, 4e passe) — le même filtre que celui que `reconcileCreation` utilise déjà
pour wiper/réinsérer à cette étape (ligne 933) ; les octrois `'revers'`/`'campaign'`/`'adjustment'`
ne sont pas des choix Step5 du joueur et ne doivent pas s'y mélanger.

### 4.4 Gestion des verrous

```
GET /api/creation/:sheetId/locks
→ { locks: [{ step, optionKey }] }

PUT /api/creation/:sheetId/locks
Body: { step, optionKey, locked: boolean }
```

Le PUT bascule **un seul** verrou (upsert si `locked: true`, delete si `locked: false`) — jamais un
remplacement du tableau complet (corrigé §0, 4e passe : l'ancienne version en "remplace tout"
exposait une race entre deux soumissions concurrentes). Seul le MJ peut écrire — vérifié via
`resolveSheetAccess(sheetId, userId).isGm` (§0, 5e passe), déjà calculé par le middleware
`router.param('sheetId')` existant pour la route REST. La route émet ensuite `WIZARD_LOCKS_SYNC`
(état complet recalculé, une lecture, pas l'écriture elle-même) dans la room.

### 4.5 Réconciliation — aucune contrainte pour le MJ

```
POST /api/creation/:sheetId/reconcile
Body: { step1, ..., step5, finalize, seenUpdatedAt? }
```

Pas de flag `gmBypass` ni de bouton « Forcer la validation » distinct (simplifié §0.3, 3e passe) :
`reconcileCreation` reçoit désormais `isGm` (comme `getCharacterPreview(characterId, isGm)` déjà,
ligne 984) et, si vrai, saute silencieusement les points de blocage suivants — catalogue exact
(lecture réelle du fichier, pas une supposition) :

- `checkCareerEligibility` (creationService.js:614-615) — prérequis/génotype/attributs/formation.
- Budget d'avantages professionnels par carrière (`computeProAdvantageAllocation`, ligne 695-701,
  codes `over_budget`/catégorie invalide).
- Budget de compétences (ligne ~774-782, même mécanisme).
- Budget de points d'attributs Étape 1 (`validateStep1`, ligne 312-313).

Rien à faire côté mutations : aucun contrôle d'éligibilité n'existe pour elles aujourd'hui (seul un
filtre de coût côté client, `Step3Mutations.jsx:292`, jamais un rejet serveur) — pas un lot, un
non-sujet. **Augmentation du budget PC du joueur : annulée** (§0.3) — `PC_TOTAL=20` reste une
constante client (`creationStore.js:4`) inchangée, aucune nouvelle colonne.

Ce lot vient **après** les verrous/l'assistance (§0.4, priorité Saar).

**Enforcement des verrous — fait partie du Lot A, pas de ce lot.** Indépendamment de ce qui précède,
`reconcileCreation` rejette (400) une soumission **du joueur** (`isGm` faux) uniquement quand elle
**change** un slot verrouillé — jamais une simple resoumission de l'état déjà acquis (§0/§3bis, 7e
passe : le reconciler renvoie l'état complet à chaque appel, un rejet sur simple présence casserait
le Wizard dès qu'une option serait verrouillée). Algorithme, par verrou actif `(step, optionKey)` :

- **Choix unique** (génotype, main directrice, valeur d'un attribut) : dérive `optionKey` de la
  valeur soumise ET de la valeur actuellement persistée (`shared/wizardOptionKeys.js`, même fonction
  des deux côtés). Si l'une des deux correspond à un verrou actif et que soumis ≠ persisté → rejet.
  Soumis = persisté (aucun changement réel) → toujours accepté, même verrouillé.
- **Ensemble** (carrières, mutations, avantages) : un `optionKey` verrouillé retiré de l'ensemble
  soumis alors qu'il était présent dans l'ensemble persisté → rejet. Un `optionKey` verrouillé ajouté
  à l'ensemble soumis alors qu'il était absent de l'ensemble persisté → rejet. Inchangé → accepté.

Le MJ n'est jamais bloqué par ses propres verrous (il les a posés lui-même) — la comparaison
ci-dessus ne s'applique qu'aux soumissions où `isGm` est faux.

**Log de conflit non bloquant (décidé §0, deuxième passe)** : à chaque `reconcile` soumis par le MJ
(`isGm` vrai), comparer le `char_sheet.updated_at` courant à celui vu par le MJ au dernier chargement
(`GET /:sheetId/state`, renvoyé au client, republié par lui dans le body du reconcile,
`seenUpdatedAt`). Si différent, logger un avertissement serveur (`[DBG]`, pas de blocage, pas de
nouvelle colonne) — aucune donnée n'est perdue silencieusement sans trace, sans coût d'UX.

---

## 5. WebSocket

### Événement `WIZARD_JOIN` (client → serveur)

```json
{ "sheetId": "uuid" }
```

Émis par le joueur à l'ouverture de son propre Wizard, et par le MJ quand il ouvre un brouillon
depuis la liste des brouillons (§4.1). Le serveur appelle `resolveSheetAccess(sheetId, userId)` (§0,
5e passe — même fonction que le middleware REST `router.param('sheetId')`, pas une réimplémentation),
**fait d'abord quitter toute room `wizard:*` que ce socket aurait rejointe précédemment** (§0, 6e
passe — un seul brouillon actif par connexion, appliqué serveur : sans ça, un MJ qui passe du
brouillon A au brouillon B sans fermeture explicite resterait membre des deux rooms et recevrait des
mises à jour croisées), puis `socket.join('wizard:' + sheetId)` si owner ou `isGm`, puis répond
immédiatement par `WIZARD_LOCKS_SYNC` avec l'état courant des verrous de cette fiche — remplace la
"connexion initiale" globale d'un brouillon ambigu par fiche explicitement demandée.

### Événement `WIZARD_LOCK_UPDATE` (client MJ → serveur)

```json
{ "sheetId": "uuid", "step": 4, "optionKey": "career_soldat", "locked": true }
```

Un seul verrou par événement (corrigé §0, 4e passe — jamais un tableau complet). Le serveur appelle
`resolveSheetAccess(sheetId, userId)` (§0, 5e passe), vérifie `.isGm`, puis appelle la même logique
que `PUT /locks` (upsert/delete d'une seule ligne). Ensuite, il émet `WIZARD_LOCKS_SYNC` à la room
`wizard:<sheetId>` uniquement — jamais à la room de campagne entière (§0/§2.1). En cas de refus (pas
MJ), `WIZARD_ERROR` au socket émetteur seul.

### Événement `WIZARD_LOCKS_SYNC` (serveur → room `wizard:<sheetId>`)

```json
{ "sheetId": "uuid", "locks": [ ... ] }
```

Seuls les clients ayant rejoint cette room précise (le joueur propriétaire et le MJ ayant ouvert ce
brouillon) reçoivent l'événement — jamais les autres joueurs de la campagne. Le joueur grise les
options correspondantes. Le MJ voit ses propres verrous (style différent).

### Reconnexion

Après une reconnexion Socket.io, l'appartenance aux rooms n'est pas conservée (comportement standard
Socket.io — un client doit ré-émettre ses intentions de room après reconnexion). Le client Wizard
ré-émet donc `WIZARD_JOIN` au montage/à la reconnexion, ce qui retrouve l'état sans requête REST
supplémentaire.

---

## 6. Client — Architecture et flux

### 6.1 Store Zustand

Ajouter à `creationStore.js` (état actuel : `step`, `step0Data`…`step5Data`, `sheetId`,
`characterId`, `campaignId`, `creationState`, etc. — aucun des champs suivants n'existe aujourd'hui) :

- `lockedOptions: Set<string>` (initialisé vide)
- `setLockedOptions(locks: Array<{step, optionKey}>)`
- `isGmView: boolean`
- `ownerUserId: string | null`
- `loadExistingSheet(sheetId)` : nouvelle action asynchrone, appelle `GET /:sheetId/state` (§4.3),
  conserve le `updated_at` reçu (pour le log de conflit §4.5), peuple le store, puis émet
  `WIZARD_JOIN` (§5) pour rejoindre la room dédiée et recevoir les verrous — aucun équivalent
  d'hydratation depuis un `sheetId` existant n'existe aujourd'hui.

**Hygiène des listeners (§0, 6e passe)** : le composant qui écoute `WIZARD_LOCKS_SYNC`/`WIZARD_ERROR`
enregistre une fonction stable et la retire (`socket.off`) à son démontage — même règle que les
listeners existants (`react.md`). Défense supplémentaire : le handler ignore tout `WIZARD_LOCKS_SYNC`
dont le `sheetId` reçu ne correspond pas au `sheetId` actuellement monté (utile même si le nettoyage
de room côté serveur, §5, a un trou).

### 6.2 Route React

- `/campaigns/:campaignId/creation` : comportement inchangé (démarrage nouveau brouillon).
- `/campaigns/:campaignId/creation/:sheetId` : nouvelle route pour ouvrir un brouillon existant.
  N'existe pas aujourd'hui (`App.jsx:75-77` ne route que sans `:sheetId`). Si l'utilisateur est le
  propriétaire, `isGmView = false`. Si MJ, `isGmView = true`.

### 6.3 Toggle « Mode guide »

Bouton dans `WizardHeader.jsx`, visible uniquement si `isGmView` — **aucun point d'ancrage existant**,
le composant n'a aujourd'hui aucune notion de rôle (props actuelles : `step`, `totalSteps`,
`highestStep`, `pcDispo`, `infos`, `onStepClick`, `hasCharacter`, `onOpenPeek`, `peekLoading`).
Réutilise la classe existante `.btn-toggle` (`react.md` — variante déjà en place, pas un composant à
inventer). Libellé via `t('wizard.guide_mode')` (namespace `wizard.*` déjà présent dans
`client/src/locales/fr.json`, nouvelle clé à y ajouter, toutes langues du projet — §0, 6e passe).
Initialement activé. Actif : le clic sur une option émet `WIZARD_LOCK_UPDATE` (bascule du verrou).
Inactif : le MJ clique pour sélectionner, comme un joueur.

### 6.4 Effet sur les composants d'étape

Chaque composant d'étape reçoit `lockedOptions` et désactive visuellement les options
correspondantes (`disabled` + classe CSS conditionnelle, ex. `.locked` — jamais un `style={{...}}`
inline pour une valeur visuelle, réservé au layout/position par `react.md` §0 6e passe), selon le
mapping `optionKey` par étape défini en §3bis. Le serveur n'a pas besoin de connaître la sémantique
des clés, seulement de les stocker/redistribuer. L'indicateur "ce sont les verrous du MJ lui-même"
réutilise le patron `badge badge-gm` déjà en place, pas une nouvelle classe.

### 6.5 Réconciliation finale

Le bouton « Terminer » appelle `handleTerminate` → `POST /reconcile` avec `finalize: true`. Aucun
choix supplémentaire à afficher si `isGmView` (§0.3, 3e passe) : quand c'est le MJ qui soumet, il
n'est simplement jamais bloqué (§4.5) — pas de bouton « Forcer la validation » séparé. Dans tous les
cas, le brouillon est verrouillé (`lockWizard`, déjà en place depuis la migration 119) et devient un
personnage normal.

---

## 7. Sécurité

- Aucune contrainte pour le MJ (§4.5) : `reconcileCreation` reçoit `isGm` calculé par le middleware
  existant (`req.isGm`, `creation.js:55`), jamais une déclaration du client.
- Verrous : écriture réservée au MJ (`isGm`) dans `PUT /locks` et le handler WS.
- Démarrage pour autrui : `POST /start` avec `targetUserId` vérifie `isGm` + appartenance de la cible
  à la campagne.
- Accès aux brouillons : `GET /:sheetId/state` et les autres endpoints restent protégés par le
  middleware `router.param('sheetId')` existant (`creation.js:35-58`).
- `WIZARD_JOIN` : vérifie ownership ou `isGm` avant `socket.join`, jamais un join aveugle. Refus →
  `WIZARD_ERROR` au socket émetteur seul (pas de code HTTP disponible en WebSocket, patron déjà en
  place pour `TRADE_ERROR`/`COMBAT_DECLARE_ERROR`).
- `GET /:sheetId/state` : n'expose jamais un champ MJ-only sans le même gate que
  `getCharacterPreview` applique déjà à `gm_notes` (`if (isGm) columns.push(...)`, ligne 991) — aucun
  champ MJ-only dans les tables lues aujourd'hui, mais l'invariant doit rester vrai pour tout ajout
  futur à cet endpoint.
- Enforcement serveur des verrous : `reconcileCreation` rejette toute soumission du joueur qui
  contredit un verrou actif (§4.5) — les verrous ne sont jamais qu'un affichage côté client.
- Accès factorisé (§0, 5e passe) : `requireRole('gm')` existant (`server/src/middleware/role.js`)
  réutilisé tel quel pour `GET /campaign/:campaignId/drafts` et le `targetUserId` de `/start`
  (`campaignId` déjà un paramètre d'URL direct — exactement l'usage pour lequel ce middleware existe).
  `resolveSheetAccess(sheetId, userId)` nouveau, extrait de `router.param('sheetId')`
  (`creation.js:35-58`), partagé par la route REST (remplace son corps actuel, comportement inchangé)
  et les handlers WebSocket — élimine la duplication réelle (REST et WS réimplémentant chacun la
  chaîne `char_sheet → characters → campaign_members`), pas une fonction générique inventée sans
  ancrage dans le code. Les usages existants ailleurs (`characters.js`) ne sont pas touchés (hors
  périmètre).

---

## 8. Lots (séquentiels — un seul actif à la fois, `CLAUDE.md` §6/§13)

Priorité Saar (§0.4) : d'abord assister le joueur (Lot A), ensuite conclure la création (Lot B). Le
Lot C (Avantages Professionnels → effets) est hors périmètre de ce document (§0.5).

| Lot | Contenu | Dépend de | Notes |
|---|---|---|---|
| A1 ✅ | Fondation serveur verrous : migration **201** `wizard_locks` (parité impaire confirmée par Saar, §0 7e passe — à revérifier contre `knex_migrations` au code), `shared/wizardOptionKeys.js` (fonctions pures de formatage de clé, partagées client/serveur), `requireRole('gm')` réutilisé + `resolveSheetAccess(sheetId, userId)` extrait, événements `WIZARD_JOIN` (quitte toute room `wizard:*` précédente avant de rejoindre, §0 6e passe)/`WIZARD_LOCK_UPDATE` (toggle atomique `{step, optionKey, locked}`, jamais un tableau complet)/`WIZARD_LOCKS_SYNC`/`WIZARD_ERROR` (`shared/events.js`), room `wizard:<sheetId>`, routes `GET/PUT /:sheetId/locks`, handlers WS, enforcement serveur dans `reconcileCreation` (algorithme §4.5 : rejet uniquement sur changement réel d'un slot verrouillé, jamais sur resoumission de l'état acquis), nettoyage des locks dans `lockWizard` | — | **Codé** — détail Testé/Non testé : `docs/EN_COURS.md`. Migration 201 pas encore appliquée en base réelle. |
| A2 ✅ | Client verrous : `creationStore` (`lockedOptions`), toggle « Mode guide » (`WizardHeader`, classe `.btn-toggle` existante, clé i18n `wizard.*`), câblage des 5 composants d'étape avec le mapping §3bis (icône cadenas dédiée par option, jamais une réinterprétation du clic normal — décision Saar), émission `WIZARD_JOIN` au montage, listener `WIZARD_LOCKS_SYNC` nettoyé au démontage + filtré par `sheetId` | A1 | **Codé** — `isGmView` reste `false` tant qu'aucun MJ n'a ouvert le personnage d'un joueur via A3 (le toggle/les cadenas MJ étaient donc invisibles avant A3). |
| A3 ✅ | MJ ouvre le personnage du joueur : `GET /campaign/:campaignId/drafts`, `POST /start` + `targetUserId` (idempotent, §0), `GET /:sheetId/state` (getters step1-5, `updated_at`, `isGm`, `ownerUserId`), route React `:sheetId`, `loadExistingSheet`, page "Pool de personnages" (jamais "Brouillon" côté UI, décision Saar) réutilisant `GET /campaigns/:id/members` pour le sélecteur de joueur | A1, A2 | **Codé, y compris Step4** (getter dédié + verrous origine/formation + dérogation par-carrière `career_waive_<code>`, demandes Saar en cours de route — `skillAllocations`/`autodidacteAllocations` best-effort assumé, détail `docs/EN_COURS.md`). Premiers correctifs UI confirmés par Saar en navigateur réel ; le scénario complet à 2 sessions reste à valider. |
| B | Conclure la création : `reconcileCreation` ignore éligibilité carrière + budgets (avantages pro, compétences, attributs Étape 1) quand le soumetteur est `isGm`, sans flag ni bouton séparé ; log de conflit non bloquant (`seenUpdatedAt` vs `char_sheet.updated_at`) ; **un test unitaire par point de blocage contourné** (`isGm=true` bypasse chacun des 4, `isGm=false` strictement inchangé — non-régression sur les 181+33 tests existants) | A3 | Non commencé. Pas d'augmentation de budget PC (annulé §0.3) ; rien sur les mutations (aucun contrôle existant à bypasser) ; le lot n'est pas considéré terminé sans ces tests |
| C | *(hors périmètre, chantier séparé)* Avantages Professionnels → effets concrets (inventaire, PNJ liés, possession qualifiée) | — | à documenter dans un PLAN dédié après B, réutilise `char_traits` + `careerRandomEffectsData.js` |

Chaque lot est présenté en détail (fichiers, invariant, hors périmètre — `CLAUDE.md` §6.5) avant tout
code, et validé avant d'attaquer le suivant.

---

## 9. Risques et atténuations

| Risque | Atténuation |
|---|---|
| Désynchronisation des `optionKey` entre MJ et joueur | Clés dérivées d'identifiants déjà stables en base (§3bis), définies une fois par composant d'étape — pas de nouvelle source de vérité à maintenir en double. |
| Fuite de confidentialité (diffusion des verrous à toute la campagne) | **Corrigé (§0, §2.1, §5)** : room dédiée `wizard:<sheetId>`, jamais la room de campagne. |
| Verrous contournables par appel API direct (UI seule, pas de contrôle serveur) | **Corrigé (§2.3, §4.5)** : `reconcileCreation` rejette toute soumission joueur qui contredit un verrou actif. |
| Perte de données joueur en cas d'écrasement MJ | Accepté en V1 (§2.4) — le MJ a toujours raison. Log de conflit non bloquant ajouté (§4.5) pour garder une trace diagnostique, sans bloquer ni changer le comportement. |
| Construction de `GET /:sheetId/state` plus coûteuse que prévu (getters manquants pour 4 des 5 étapes) | Isolé en Lot A3, dépend de A1/A2 déjà validés — pas de découverte tardive sur un lot déjà avancé. |
| Accès factorisé introduit une régression sur les usages existants (`characters.js`) | `requireRole('gm')` réutilisé sans modification ; `resolveSheetAccess` est un nouveau nom qui remplace le corps de `router.param('sheetId')` par extraction pure (même logique, même comportement) — les call sites de `characters.js` ne sont pas touchés (hors périmètre explicite). |
| Brouillon dupliqué : le MJ démarre un brouillon (`targetUserId`) pour un joueur qui, sans le savoir, en démarre un second via le flux normal (ou l'inverse) | **Corrigé (§0, 5e passe)** : `startCreation` vérifie d'abord un brouillon actif existant (`wizard_locked_at IS NULL`) pour ce `user_id`/cette campagne et le retourne au lieu d'en créer un second — idempotent, dans les deux sens. |
| `option_key` verrouillé sur une clé invalide/périmée (typo, option supprimée du catalogue) | Accepté (YAGNI) : le serveur reste volontairement aveugle à la sémantique des clés (§6.4 original) ; un verrou sur une clé invalide ne fait juste rien, coût nul. |
| Plusieurs MJ simultanés posant des verrous contradictoires | Accepté : cas rare, dernier écrivain gagne, pas d'engineering dédié. |
| Surcharge de WebSocket | Très faible : un événement par bascule de verrou, par room de fiche (pas de campagne). |
| Perte de verrou par remplacement de tableau concurrent (deux onglets MJ, paquets réordonnés) | **Corrigé (§0, 4e passe)** : toggle atomique d'un seul `(step, optionKey)`, jamais un remplacement de tableau complet. |
| Régression silencieuse d'une validation retirée par erreur pour le joueur aussi (Lot B) | **Corrigé (§8)** : un test unitaire par point de blocage contourné, obligatoire pour clore le lot. |
| Double écrivain (MJ + joueur) sur le même brouillon en mode guide désactivé | Accepté en V1 (§2.4) — limite du modèle client-primary existant, explicitée plutôt que découverte en test. Le log de conflit ne couvre qu'un sens (MJ écrase joueur). |
| `WIZARD_JOIN` refusé sans retour au client (pas de code HTTP en WebSocket) | **Corrigé (§5/§7)** : événement `WIZARD_ERROR` au socket émetteur, même patron que `TRADE_ERROR`/`COMBAT_DECLARE_ERROR`. |
| Texte UI codé en dur (toggle, listes) — violation `react.md` | **Corrigé (§0, 6e passe)** : namespace `wizard.*` existant dans `client/src/locales/fr.json`, nouvelles clés à y ajouter. |
| Composants CSS réinventés (toggle, badge, grisé) au lieu des classes existantes | **Corrigé (§0, 6e passe)** : `.btn-toggle`, `badge badge-gm`, classe `.locked` conditionnelle — jamais de `style={}` visuel inline. |
| Cross-talk entre deux brouillons ouverts successivement dans le même onglet (socket long-vécu à travers la SPA, room jamais quittée) | **Corrigé (§0, 6e passe)** : `WIZARD_JOIN` fait quitter toute room `wizard:*` précédente du socket avant de rejoindre la nouvelle ; filtre défensif côté client sur le `sheetId` reçu. |
| `optionKey` dérivée séparément client/serveur, dérive silencieusement (violation `CLAUDE.md` §7) | **Corrigé (§0, 7e passe)** : `shared/wizardOptionKeys.js`, fonctions pures de formatage partagées, même famille que `shared/careerEligibility.js`. |
| Enforcement des verrous bloque toute resoumission d'une étape dès qu'une option y est verrouillée (le reconciler renvoie l'état complet à chaque appel) | **Corrigé (§0/§4.5, 7e passe)** : rejet uniquement si la valeur soumise diffère de la valeur persistée pour un slot verrouillé ; resoumission inchangée toujours acceptée. |
| Vérification de la parité migration incomplète (dev/monde invisible depuis ce dépôt) | Assumé explicitement (§0, 7e passe) — garde-fou structurel = `WORKFLOW_FUSION.md` à la fusion, pas une certitude pré-code. Saar confirme formellement la convention impaire. |

---

## 10. Conclusion

Architecture inchangée dans son principe (arbitrage serveur, verrous non bloquants, toggle Mode
guide, bypass MJ explicite), corrigée dans son détail après audit du code réel (§0). Découpée en lots
testables indépendamment, séquencés selon la priorité de Saar : assister d'abord (Lot A), conclure
ensuite (Lot B).

**État au 2026-07-23 (fin de session) : Lot A (A1+A2+A3) entièrement codé**, y compris les extensions
demandées par Saar en cours de route (verrous origine géo/sociale/formation, dérogation de prérequis
par carrière, page "Pool de personnages"). Premiers correctifs UI confirmés par Saar en navigateur
réel (Dashboard, Pool de personnages). Reste avant de considérer le Lot A clos : appliquer les
migrations 201/203 en base réelle et valider le scénario complet à 2 sessions (MJ ouvre le personnage
d'un joueur pendant que celui-ci travaille dessus) — c'est l'objet même de ce chantier, jamais testable
depuis le poste où il a été codé (`CLAUDE.md` §3). Détail Testé/Non testé complet : `docs/EN_COURS.md`.
Lot B (bypass MJ des budgets/éligibilité à la finalisation) non commencé.
