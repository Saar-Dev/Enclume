# PLAN_REVUE_GUERISON — Écran de revue des guérisons : le rendre utilisable par le MJ

> 2026-09-25 · Plan temporaire (Règle 10, `docs/RegleDocumentaire.md`) — sera archivé dans `docs/Old/` et fusionné dans
> `docs/SYSTEME/BLESSURES.md` §« Guérison et Infection » une fois clos.
> Statut : 🟡 **Cadré, analyse à charge faite (§9), toutes les questions tranchées (Q1-Q10). Bug n°1 commité (`3839638`), fantômes nettoyés en base. LOT 0 CODÉ, VALIDÉ EN JEU PAR SAAR ET COMMITÉ le 2026-09-25** : `woundUtils.js` unique suppresseur + annulation des échéances, Test suivant en une seule fonction — 135/135 tests ciblés. Analyse à charge du plan complet faite (§11) : Lot 3 supprimé, Lot 2 scindé. **LOT 1 CODÉ le 2026-09-25 (non commité, en attente du « ok » de Saar)** : 154 tests en base + 819 purs. Reste : ~~Lot 1~~ (serveur : kits dans `WOUND_HEALING`, vue groupée par
> personnage, routes groupées guérison + infection, contexte de soins raconté dans le chat), **Lot 2a** (écran : cartes et gestes), **Lot 2b** (silhouette, kits, soignant).
> Un seul problème (Règle « un plan = un bug ») : l'écran de revue MJ (`client/src/components/BlessuresReviewPanel.jsx`) ne permet pas de
> décider — il affiche des lignes sans blessure, répète les mêmes questions, et n'offre pas les réponses dont le MJ a besoin.
> Hiérarchie : Livre de Base Polaris (`docs/REGLES/REGLEBLESSURES.md`) > `SYSTEME/BLESSURES.md` > ce plan. Conception d'origine (archivée) :
> `docs/Old/PLAN_BLESSURES_GUERISON.md` §6.

---

## 0. Pause de la résolution de bugs — état exact à la reprise

La résolution de bugs (tri des 128 tickets, 2026-09-25) est **en pause** le temps de ce chantier. Le bug n°1, `WOUND-HEAL-CHAIN-STOPS`, est
**codé et testé mais NON commité et NON clos** : sa validation en jeu passe par cet écran de revue, qui est inutilisable en l'état.

- **Fait** : `woundUtils.js` est le seul écrivain de `character_wounds` ; chaque case naît avec son échéance de guérison
  (`woundHealingSchedule.js`) ; la case obtenue par une guérison est datée du jour d'échéance ; la Chance écrit UNE case (`steps`) ; l'annulation
  d'avance retire l'échéance créée. Décisions de Saar (2026-09-25) : la case obtenue par la Chance et la case d'infection ont leur échéance.
- **Fichiers du worktree** (à ne pas écraser, dev solo mais sessions parallèles possibles) : `server/src/lib/woundUtils.js`, `woundService.js`,
  `woundEvolutionService.js`, `woundHealingSchedule.js` (nouveau), les trois `*.test.mjs` correspondants, `docs/SYSTEME/BLESSURES.md`,
  `docs/JOURNAL8.md` (entrée du 2026-09-25, fichier modifié aussi par une autre session : staging partiel),
  `server/src/scripts/create_tickets_20260925_guerison_chaine_constats.js`.
- **Testé** : `node --env-file=.env --test` sur les trois fichiers — 120/120 ; aucun résidu en base. **Observé en réel (2026-09-25, 17:40, base de Saar, lecture)** : une Grave est devenue une Moyenne AVEC son
  échéance (due 14760 = jour d'échéance 10440 + 3 jours : date de départ correcte) ; une Critique passe à la semaine 2/3 (due 20520) ; annulation d'avance journalisée (16 entrées). **Non testé** : la fin de la chaîne
  jusqu'à la Légère, la Chance suivie d'une avance de temps, l'annulation d'avance, et la validation visuelle par Saar.
- **Reprise** : ce plan clos (ou débloqué) → test en jeu de Saar → commit après son « oui » → clôture du ticket par un script que Saar lance →
  bug n°2 (`WOUND-HEAL-LINE-CAPACITY`, qui demande d'abord une décision de règle). Ordre complet : mémoire `project_bug_resolution_tri_2026_09_25`.

## 1. Constats de Saar (2026-09-25) et preuves

| # | Constat de Saar | Statut |
|---|---|---|
| C1 | La fenêtre liste les très nombreuses blessures de chacun et redemande à chaque fois les mêmes choses (Soin, Médecin, Matériel), sans regrouper. | [OBSERVÉ] par Saar |
| C2 | Sans Médecin configuré avant d'avancer le temps, le MJ ne peut rien faire : un médecin est exigé pour les blessures les plus lourdes, il ne peut pas dire « hôpital » ou « médecin professionnel ». | [OBSERVÉ] par Saar |
| C3 | « Le personnage continue-t-il d'être soigné ? » est mal formulé (« La guérison du personnage est-elle constante ? ») et fait déjà double emploi avec la case « Soin » : à retirer. | [OBSERVÉ] par Saar |
| C4 | On ne sait ni quelle blessure on clique, ni l'état du personnage. | [OBSERVÉ] par Saar |

**Ce que la base locale montre** [VÉRIFIÉ par lecture, 2026-09-25] : une avance de temps d'**1 semaine est en attente** (`pending_advance_delta_minutes = 10080`),
l'écran a **97 lignes** dont **87 n'ont aucune blessure** (échéance fantôme : la blessure a été supprimée, l'échéance est restée `active` puis
`pending_mj_review`). Les 10 lignes réelles appartiennent à un seul personnage. Une ligne fantôme s'affiche avec le seul nom du personnage et les mêmes
boutons : c'est la cause de C1 (nombre) et de C4 (« quelle blessure ? »). `confirmPendingAdvance` refuse (409) tant qu'une ligne n'a pas de réponse : le MJ doit
répondre aux 87 lignes fantômes pour pouvoir confirmer.

## 2. Analyse par constat

**C1 — pas de regroupement** [VÉRIFIÉ par lecture]
- `BlessuresReviewPanel.jsx` rend UNE ligne par échéance ; `HealingRow` porte son propre état local (Soin, Médecin, Matériel) : la question est reposée à chaque ligne.
- Le moteur programme une échéance **par case** de blessure. Le RAW, lui, traite « Localisation par Localisation, quel que soit le nombre de cases » et fait payer
  -2 par case en plus au Test (`REGLEBLESSURES.md:386-392`) : une ligne du compteur de 3 cases donne 3 lignes d'écran.
- 87 lignes sur 97 sont fantômes (`WOUND-ECHEANCE-GHOSTS`, ticket créé 2026-09-25) : masquer ces lignes côté client serait une rustine, la cause est en amont
  (voir Lot 0).

**C2 — pas de soignant « hôpital / médecin professionnel »** [VÉRIFIÉ par lecture pour ce qui est offert ; INCONNU pour « le MJ ne peut rien faire »]
- Le contexte « Médecin » est une case + une liste des personnages de la campagne : impossible d'exprimer un soignant qui n'est pas un personnage (PNJ non créé, hôpital,
  médecin professionnel). Or le RAW exige Chirurgie + Médecine pour Mortelle et Membre détruit, Médecine pour Critique (`REGLEBLESSURES.md:413-433`).
- **[VÉRIFIÉ par exécution, 2026-09-25 soir]** aucun code (client, serveur, `shared/`) n'exige un médecin : les trois boutons n'en dépendent pas, et les cases Soin / Médecin / Matériel sont
  **décoratives** (état local jamais envoyé, jamais lu). Un rejeu des vrais clics « Amélioration » et « Échec » sur les 8 lignes réelles (transactions annulées) se résout sans erreur ; et les clics
  réels de Saar (17:40) ont bien produit leurs effets en base. Le blocage ressenti est donc **un blocage de logique, pas technique** : sans pouvoir déclarer un soignant (hôpital, médecin professionnel),
  le MJ ne peut pas « valider un soin » honnêtement, et rien n'indique que les cases ne servent à rien. C'est le défaut d'interface que le Lot 2 corrige (soignant explicite ; plus aucune case décorative).

**C3 — case `soinsContinues`** [VÉRIFIÉ par lecture]
- Elle n'apparaît que pour une échéance unique (Moyenne/Grave) et n'est envoyée que sur « Échec » : oui → une nouvelle tentative est reprogrammée, non → l'échéance se termine.
  « Soin » (contexte) est purement local, jamais envoyé. Les deux disent la même chose (« soins constants ») : d'où le doublon. Décision d'origine : Saar, 2026-07-30.
- **Trouvaille liée** [VÉRIFIÉ par lecture, `woundEvolutionService.js` : `buildRecurringReschedule` vaut null pour une échéance unique et à la dernière occurrence] : un Échec **sans** case cochée, ou une **Catastrophe**, sur une
  échéance unique (Moyenne/Grave) **ou sur la dernière occurrence** d'une échéance récurrente (Critique/Mortelle/Membre détruit), termine l'échéance ; la blessure reste à sa gravité **sans plus aucune échéance de guérison** —
  même famille de défaut que `WOUND-HEAL-CHAIN-STOPS`. Ticket : `WOUND-HEAL-ONESHOT-STUCK` (à élargir : son titre ne cite que Moyenne/Grave). Voir §6, Q2.

**C4 — aucune information** [VÉRIFIÉ par lecture]
- L'en-tête d'une ligne ne montre que le nom + « localisation — gravité » (et rien si l'échéance est fantôme). Aucun état du personnage, aucune indication du passage prévu
  (« Critique → Grave »), du nombre de cases de la ligne, ni de l'étape (« semaine 2/3 »).

## 3. Principes (qualité d'architecture d'abord)

1. **Le fond avant la forme** : les lignes fantômes se corrigent à la source (cycle de vie de l'échéance = celui de sa case, dans l'écrivain unique) ; jamais un filtre d'affichage.
2. **Une seule autorité de la vue** : le serveur (`woundReviewService.js`, déjà le domaine « enrichissement Blessures ») construit la vue **groupée par personnage** ; le client affiche et
   n'invente aucune règle (`.claude/rules/react.md`, `.claude/rules/core.md`).
3. **Réutiliser** : composants et libellés d'état déjà existants (compteur de blessures, `locationPanel.severityShort.*`, statuts de token) avant d'en créer — à recenser en Lot 1.
4. **Conformité projet** : textes en i18n (namespace dédié plutôt que d'allonger `fr.json`, `.claude/rules/i18n.md`) ; classes CSS et non `style={}` visuel (`styles` inline actuels à remplacer) ; boutons `className="btn…"`.
5. **Le MJ décide** (décision d'origine 2026-07-29, à ne pas renverser sans l'écrire) : aucun jet serveur pour la guérison, le contexte de soins reste une aide à la décision.

## 4. Conception proposée (à valider)

**Décision de Saar (2026-09-25, Q1)** : le regroupement se fait **par personnage**. Un personnage soigné, c'est 90 % du temps toutes ses blessures qui guérissent ; le cas exceptionnel (soignant
sans matériel) est traité **blessure par blessure**, comme une seconde option « au cas où ». Une décision au niveau du personnage est donc le geste **par défaut**, la décision par blessure est l'**exception**.

Une **carte par personnage** :
- **En-tête = état** : nom ; compteur de blessures condensé (une pastille par ligne non vide : localisation + gravité + nombre de cases) ; statuts actifs (mort, inconscient…) ; malus de blessure courant.
- **Conditions de soins, demandées UNE fois par personnage** : **soignant** : personne · un personnage de la campagne · PNJ (nom libre) · **hôpital** · **médecin professionnel** ; matériel ; (« soins constants » = la case
  « Soin » existante, plus aucun doublon).
- **Geste par défaut — la carte entière** : les mêmes trois issues que par blessure (Amélioration / Échec / Catastrophe), appliquées d'un clic à **toutes** les blessures échues du personnage ; la carte dit
  ce qu'elle fait (« 6 blessures : Amélioration »), jamais en silence. Amélioration est l'issue mise en avant (le cas courant).
- **Geste d'exception — « Blessure par blessure »** (bouton déplié, replié par défaut) : une ligne par blessure — « Jambe gauche — Critique (2 cases) · semaine 2/3 · passage prévu : Grave » — avec ses trois issues.
  Tri du plus grave au plus léger. Les lignes d'Infection ont leur propre bloc, avec le nombre de jets.
- **Application serveur** : une **route groupée** (un personnage, une issue, la liste des échéances visées) résolue dans UNE transaction, un seul diffuseur ; le client n'enchaîne pas N appels (états partiels,
  N rafraîchissements de fiche). Chaque échéance garde son savepoint (le moteur isole déjà l'échec d'une échéance).
- **Silhouette du blessé** (idée de Saar, 2026-09-25) : la carte montre la silhouette du personnage avec ses zones colorées par gravité, et met en évidence les zones dont le soin est échu à cette ronde.
  **À réutiliser, pas à recréer** : `client/src/components/BodySilhouetteSvg.jsx` (autorité unique du tracé, `fillFor` par zone) + les couleurs `SEVERITY_COLORS` de `shared/woundConstants.js` — même base que la
  lecture des blessures de la fiche (`SilhouettePanel.jsx`).
- **Kits de soin — décompte affiché** (idée de Saar, 2026-09-25) : le regroupement par personnage permet d'afficher **combien de kits** cette ronde de soins mobilise, par type — kit de premiers soins, kit de médecine,
  kit de chirurgie — d'après la gravité des lignes. Table RAW « Durée de guérison et soins nécessaires » (`REGLEBLESSURES.md:413-433`) dans `shared/` :
  | Gravité | Kits (une option = kits requis ensemble ; plusieurs options = l'un OU l'autre) |
  |---|---|
  | Légère | aucun (guérit seule) |
  | Moyenne | premiers soins **ou** médecine |
  | Grave | premiers soins **ou** médecine (note de Saar : « une Grave consomme un kit de premiers soins OU un kit de médecine ») |
  | Critique | médecine |
  | Mortelle | chirurgie **+** médecine |
  | Membre détruit | chirurgie **+** médecine |
  **Autorité** : ces kits s'ajoutent à `WOUND_HEALING` (`shared/woundConstants.js`, l'autorité « cette blessure guérit-elle, comment ? » lue par `getWoundHealing(severity, location)`), pas dans une troisième table.
  `DUREE_GUERISON_SOINS_TABLE` (texte d'Encyclopédie, « représentation parallèle assumée ») reste ; si ses colonnes `soinsNecessaires` doivent un jour dériver de la nouvelle donnée, c'est un autre chantier.
  Pour une ligne « premiers soins OU médecine » (Moyenne/Grave), le kit par défaut du décompte est le **moins cher** (premiers soins), modifiable par le MJ sur la ligne.
  **Ce que le RAW dit des kits** [VÉRIFIÉ, catalogue `ref_equipment`, famille « Équipement médical »] : trois trousses — **First Aid** (600 sols : premiers soins, blessures légères à graves), **ChiriaT** (1 800 : trousse
  chirurgicale d'urgence, Chirurgie à -5, **seule** à permettre de stabiliser sans malus), **Medi 1 000** (11 000 : medkit, tout cela + bonus de +3 aux Premiers soins, Chirurgie sans malus). C'est un **équipement à trois niveaux, jamais
  décrit comme consommable** : le décompte est une **règle maison**, à journaliser (`docs/JOURNAL8.md`, invariant 5). Matériel spécial déjà au catalogue : cuve de soins (malus et temps de guérison **divisés par 2**), bloc opératoire
  portable (+3 Chirurgie), caisson TRX (stabilise les Critiques) — hors de ce plan.
- **Qui afficher** (question de Saar) : **tous les blessés dont un soin est échu — aucun n'est masqué**, car `confirmPendingAdvance` refuse tant qu'une échéance n'a pas de réponse (`stillUnresolved`) : cacher des PNJ créerait un
  blocage invisible. Présentation : PJ d'abord ; PNJ regroupés dans un bloc **replié** avec le même geste par carte ; jamais de PNJ ignoré en silence. Le RAW va dans ton sens : le système de blessures détaillé « est réservé aux personnages des joueurs, ainsi qu'à
  leurs adversaires les plus marquants » (`REGLEBLESSURES.md:207-224`, simplification PNJ optionnelle). Une option « PNJ soignés automatiquement » serait un autre chantier (elle relèverait de cette simplification).
- **Jamais de ligne sans blessure** (garanti par le Lot 0).
- La case « Le personnage continue-t-il d'être soigné ? » disparaît (§6, Q2).
- **Rondes** : une avance de plusieurs périodes (ex. 3 semaines sur une Critique) rouvre une revue à chaque période (déjà le cas : `newlyDue`). Avec le geste par personnage, chaque ronde coûte un clic ; l'écran affiche
  « semaine n/N ».

## 5. Lots (un par tour, plan → analyse à charge → code → validation Saar)

| Lot | Contenu | Fichiers pressentis | Preuve attendue |
|---|---|---|---|
| **0 — Fond** | **Voir §9 (analyse à charge)** : `woundUtils.js` devient aussi l'**unique suppresseur** de lignes (4 sites : promotion, amélioration, `removeWound`, `/heal`) et annule leurs échéances (guérison ET infection), avec entrées d'annulation d'avance de temps ; nettoyage des fantômes existants par un script versionné **lancé par Saar** ; **une seule fonction calcule le Test suivant** : un Échec ou une Catastrophe ne termine plus jamais l'échéance (§6, Q2/Q2b) — traite `WOUND-HEAL-ONESHOT-STUCK` | `woundUtils.js`, `woundService.js`, `woundEvolutionService.js`, `woundHealingSchedule.js`, script | tests en base ciblés (une suppression retire son échéance, annulable ; `/heal` ne laisse rien ; échecs répétés reprogramment, dernière occurrence comprise) ; base : plus aucune échéance sans blessure |
| **1 — Vue serveur** | `getPendingReviewForGm` renvoie les cartes par personnage : état, cases par ligne, étape n/N, gravité d'arrivée ; contrat de payload stable ; **route groupée** (un personnage, une issue, les échéances visées) en une transaction ; **kits** ajoutés à `WOUND_HEALING` (`shared/`) et décompte calculé côté serveur | `woundReviewService.js`, `campaigns.js`, `shared/woundConstants.js` | tests du service et de la route groupée (atomicité, refus d'une échéance d'une autre campagne, échec isolé d'une échéance) ; forme du payload figée par test |
| **2a — Client : cartes et gestes** *(révisé §11)* | Refonte de `BlessuresReviewPanel` : une carte par personnage, état en texte, lignes claires, geste par défaut (issue pour toute la carte) + « blessure par blessure », bloc PNJ replié, refus de « Confirmer » **affichés** ; retrait de `soinsContinues` ; suppression de l'ancienne route, de l'ancienne fonction et de l'ancien composant ; CSS + i18n | `BlessuresReviewPanel.jsx` (+ sous-composants), locales, CSS, `woundReviewService.js`, `campaigns.js` | ESLint, build client, test en jeu de Saar |
| **2b — Client : silhouette, kits, soignant** *(révisé §11)* | Silhouette colorée par gravité (zones échues en évidence), décompte des kits (choix « premiers soins OU médecine »), soignant (personne / personnage / PNJ / hôpital / médecin professionnel) et matériel **réellement envoyés** au serveur (`care`, Lot 1) | sous-composants, locales, CSS | ESLint, build client, test en jeu de Saar |
| ~~3~~ | *Supprimé (§11 B1) : la ligne de chat des conditions de soins est livrée par le Lot 1 (serveur) et le Lot 2b (écran), pas après.* | — | — |

**Attention à l'état de la base de Saar** : une avance de 1 semaine est en attente avec 97 lignes. Avant le nettoyage du Lot 0, il faut l'**annuler** (bouton « Annuler » de l'écran) ou la confirmer ; le script ne
doit jamais modifier une avance en cours.

## 6. Questions pour Saar (règles de jeu / produit)

- **Q1 — Regroupement : ✅ TRANCHÉ par Saar (2026-09-25)** : par **personnage** (geste par défaut : une issue pour toutes ses blessures), blessure par blessure en exception « au cas où » (§4). Le moteur reste
  une échéance par case (hors de ce plan) ; le RAW soigne « Localisation par Localisation » (`REGLEBLESSURES.md:386-392`), ce que le geste par personnage recouvre.
- **Q2 — Un soin loupé : que devient la blessure ? — VÉRIFIÉ contre le RAW (2026-09-25), en deux temps.**
  *Ce que dit le RAW* (`REGLEBLESSURES.md:393-407`, `:435-485`) : réussite → la guérison suit son cours, la gravité diminue à la fin de la période ; **échec** → un (et un seul) Test de Constitution pour la période en
  cours : Moyenne réussie → « la guérison se poursuit normalement », ratée → case d'infection ; Grave réussie → pas d'infection mais malus qui s'accumule, ratée → case d'infection ; **Critique, Mortelle, Membre détruit →
  infection inévitable** (même en cas de réussite) ; **Catastrophe** → absence totale de soins, Test de Constitution tous les deux jours. Tableau : **guérison naturelle « oui »** pour Légère, Moyenne, Grave ;
  **« non »** pour Critique, Mortelle, Membre détruit.
  *Conclusion* : ta lecture est **exacte pour Critique / Mortelle / Membre détruit** (sans soin réussi, pas de guérison, et infection) ; elle est **nuancée pour Moyenne / Grave** (guérison naturelle : après un soin loupé le
  Test de Constitution décide de l'infection, et la guérison peut se poursuivre). Le RAW ne dit **pas** combien de temps dure une nouvelle tentative.
  *Ce que fait le code* [VÉRIFIÉ par lecture] : après un Échec ou une Catastrophe sur la **dernière** occurrence (toutes gravités) ou sur une échéance unique Moyenne/Grave sans case cochée, l'échéance se termine et la
  blessure reste **sans plus aucune échéance** — jamais de nouveau Test. Le ticket `WOUND-HEAL-ONESHOT-STUCK` est donc **plus large** que son titre (il couvre aussi Critique/Mortelle/Membre détruit).
  *Recommandation* : un Échec ou une Catastrophe **ne fait jamais disparaître l'échéance** ; la blessure ne diminue pas et un nouveau Test est reprogrammé — Moyenne/Grave : à la durée de la gravité (3 jours / 1 semaine) ;
  Critique/Mortelle/Membre détruit : à la semaine suivante (rythme des « soins constants »). La case « continue d'être soigné » disparaît.
- **Q2b — Après un soin loupé à la dernière semaine d'une Critique / Mortelle / Membre détruit : ✅ TRANCHÉ par Saar (2026-09-25) : nouveau Test la semaine suivante** (interprétation, le RAW est muet sur ce délai).
- **Q3 — Le soignant est-il informatif ?** *Recommandation* : oui (le MJ tranche, comme décidé le 2026-07-29), avec les choix « personne / personnage / PNJ / hôpital / médecin professionnel ».
- **Q4 — Le contexte de soins doit-il laisser une trace (chat) ?** *Recommandation* : oui, une ligne de chat par choix (règle « le chat raconte toute décision »), livrée par le Lot 1 (serveur) et le Lot 2b (écran) — pas de Lot 3 (§11 B1).
- **Q5 — Que veux-tu voir de l'état du personnage d'un coup d'œil ?** *Proposition* : la **silhouette** (zones colorées par gravité) + pastilles du compteur, statuts actifs, malus de blessure ; en option : Constitution (utile aux Tests d'Infection) et Médecine/Chirurgie du soignant si c'est un personnage.
- **Q6 — Kits : ✅ TRANCHÉ par Saar (2026-09-25)** : le décompte est **affiché** (v1, dans ce plan) ; et **même en version finale** la consommation réelle n'est **jamais automatique** : le MJ **coche « consommer les kits »**.
  La v2 (décrémenter `char_inventory.quantity` du soignant quand la case est cochée) est un **plan séparé** (ROADMAP) : inventaire de qui (un PNJ ou un hôpital n'a pas d'inventaire), substitution entre niveaux (un medkit couvre-t-il un kit de
  premiers soins ?), chat. **Contrainte de conception dès maintenant** : la route groupée (Lot 1) est écrite pour recevoir plus tard `consumeKits: boolean` ; la case n'est **pas** livrée en v1 (jamais un contrôle inerte).
- **Q7 — Objet du catalogue ↔ kit : ✅ TRANCHÉ (oui)** : premiers soins = **First Aid** ; chirurgie = **ChiriaT** ; médecine = **Medi 1 000**. Un **identifiant explicite** sur l'objet du catalogue (plutôt qu'une correspondance par nom : `name_i18n`) sera posé par la v2
  (migration, `.claude/rules/migrations.md`) — la v1 n'a pas besoin d'y toucher, elle ne lit pas l'inventaire.
- **Q8 — Unité du décompte : ✅ TRANCHÉ : par Test** (chaque semaine d'une Critique « soins constants » consomme). Lecture retenue : le RAW soigne « Localisation par Localisation » (`:386-392`), donc **un Test = une ligne du compteur** ; les cases d'une même ligne
  échues à la même ronde comptent pour un seul kit. Voir §9, Q10 pour Chirurgie.
- **Q9 — PNJ : ✅ TRANCHÉ (oui)** : tous affichés, PNJ repliés (§4).
- **Q3, Q4, Q5 — retenus par défaut (Saar n'a pas objecté)** : soignant informatif ; une ligne de chat par choix (Lots 1 et 2b) ; état = silhouette + pastilles + statuts + malus. Réversible à la validation visuelle du Lot 2.

## 7. Hors périmètre

**Consommation réelle des kits de soin dans l'inventaire** (plan séparé, §6 Q6), effets du matériel spécial (cuve de soins, bloc opératoire, caisson), panneau joueur « Jets en attente » (Infection), Stabilisation (minutes), Suractivité, capacité de ligne à la guérison (`WOUND-HEAL-LINE-CAPACITY`, bug n°2 de la résolution de bugs), retrait automatique des Légères
(`WOUND-LEGERE-NEVER-HEALS`), annulation des échéances d'infection (`ECHEANCE-SPAWN-UNDO`).

## 8. Validation prévue

Tests en base ciblés (Lots 0-1) ; ESLint + build client (Lot 2) ; **scénario réel de Saar** : un personnage avec plusieurs lignes non vides, avance d'1 semaine → une seule carte, l'état visible, les conditions de soins
demandées une fois, aucune ligne sans blessure, confirmation possible sans médecin-personnage (hôpital / médecin professionnel), puis reprise du test de guérison en chaîne du bug n°1.

## 9. Analyse à charge (2026-09-25, avant tout code)

Relecture critique du plan contre le code réel. Chaque point : ce que le plan disait, ce que la réalité est, la conséquence.

| # | Le plan disait | La réalité [preuve] | Conséquence / correction |
|---|---|---|---|
| A1 | Lot 0 : « retirer l'échéance à la suppression de la case ». | **4 sites** suppriment des lignes : cascade de promotion et amélioration (`woundUtils.js`), `removeWound` et `/heal` (`woundService.js`) [VÉRIFIÉ, `git grep`]. Les échéances d'**infection** pointent aussi une blessure (`payload.woundId`). Le statut `cancelled` existe déjà (CHECK) ; les échéances tombent avec leur personnage (FK `CASCADE`). | `woundUtils.js` devient l'**unique suppresseur** comme il est l'unique écrivain ; il annule guérison **et** infection. Quand la suppression a lieu dans un handler (amélioration, case d'infection qui promeut), l'annulation d'avance de temps doit pouvoir **restaurer** l'échéance annulée : ses valeurs d'origine entrent dans les `undoEntries` (sauf l'échéance que le moteur résout, qu'il journalise lui-même). |
| A2 | Lot 0 : « reprogrammer une nouvelle tentative ». | Même avec « soins continus », un **2ᵉ échec termine l'échéance** ; échec/catastrophe sur la dernière semaine d'une Critique aussi ; catastrophe sur Moyenne unique aussi [VÉRIFIÉ **par exécution**, sonde en transaction annulée : `null` dans les 4 cas]. Cause : `isOneShot = (occurrences_remaining === null)` — une tentative reprogrammée a `occurrences_remaining = 1`, donc n'est plus « unique ». | Ne pas rajouter un cas : **réécrire en une seule fonction** « Test suivant » — pas la dernière occurrence → le cycle continue ; **dernière occurrence** → nouvelle tentative (Moyenne/Grave : durée de la gravité ; Critique/Mortelle/Membre détruit : 1 semaine, Q2b), quelle que soit l'issue autre qu'Amélioration. La fenêtre d'infection de la Catastrophe (`computeCatastropheInfectionOccurrences`) lit le même `isOneShot` : à rendre explicite (mêmes valeurs aujourd'hui par coïncidence). |
| A3 | Kits « par Test ». | Le RAW : Chirurgie « **avant toute phase de soins médicaux** » (`:374-375`) et « le Test de **Médecine** doit être effectué chaque semaine » (`:391-392`). Le tableau dit « Chirurgie + Médecine » pour Mortelle et Membre détruit, mais l'opération n'est **pas** un Test hebdomadaire ; le moteur n'a **aucun** Test de Chirurgie. | **Q10** ci-dessous. Le décompte doit savoir si c'est le **premier** Test d'une blessure (rang d'occurrence : `occurrences_remaining` = total, déduit de `getWoundHealing`). |
| A4 | Route groupée « en une transaction ». | `resolveEcheanceNow` **avale** l'échec d'un handler (`{ resolved: false, error: true }`), la route actuelle l'ignore [VÉRIFIÉ, lecture]. | La route groupée renvoie un **résultat par échéance** ; le client ne retire une ligne que si elle est résolue ; les diffusions (une par échéance résolue + une mise à jour de fiche par personnage) partent **après** la validation. |
| A5 | « Tous affichés, PNJ repliés » (Q9). | **77 des 99** échéances de guérison de la base locale appartiennent à des PNJ (22 aux PJ) [VÉRIFIÉ, base]. Le RAW réserve le système détaillé aux PJ et aux adversaires marquants. | Le bloc PNJ replié est bien la bonne présentation. Séparément : créer une échéance à chaque PNJ blessé est douteux (ticket `WOUND-PNJ-ECHEANCES-FLOOD`) — hors de ce plan. |
| A6 | Le test de Saar du bug n°1 attend l'écran refait. | Faux : il attend seulement que les **87 lignes fantômes** ne l'encombrent plus. Le nettoyage de données est indépendant du code d'écran. | **Séquence proposée** : (1) Saar annule l'avance en attente ; (2) un script versionné, lancé par Saar (`server/src/scripts/cancel_ghost_wound_echeances_20260925.js` : rapport seul par défaut, `--apply` pour agir, refuse une campagne avec avance en attente), annule les fantômes existants ; (3) Saar teste la guérison en chaîne sur les vraies lignes (écran laid mais lisible) ; (4) commit du bug n°1 ; (5) Lot 0 sur cette base. Un commit = une cause racine : le Lot 0 modifie les mêmes fichiers, il ne doit pas être mêlé au bug n°1. |
| A7 | Boutons « Amélioration / Échec / Catastrophe ». | À une semaine intermédiaire d'une Critique, « Amélioration » ne change **rien** (le cycle continue) ; seul le dernier Test fait descendre la gravité. Le RAW parle de **résultat du Test** (réussite / échec / catastrophe). | Au Lot 2, chaque bouton **annonce sa conséquence** (« Réussite → passe à Grave », « Réussite → continue, semaine 2/3 ») ; libellé « Réussite » à proposer à Saar. |
| A8 | Une carte = un panneau latéral de 360 px. | L'écran actuel est un panneau fixe de 360 px (`position: fixed`) [VÉRIFIÉ, lecture] : trop étroit pour silhouette + conditions + décompte. | Emplacement (modale large / panneau élargi) à décider à l'analyse du Lot 2 ; pas bloquant pour les Lots 0-1. |

**Q10 — ✅ TRANCHÉ par Saar (2026-09-25) : oui** — kit de chirurgie consommé une seule fois (premier Test), kit de médecine à chaque Test ; une nouvelle tentative après un échec reprend les kits du Test échoué.
*(Question posée :)* Chirurgie (règle de jeu) : pour Mortelle et Membre détruit, le kit de **chirurgie** est-il consommé **une seule fois** (au premier Test, l'opération) et le kit de **médecine** à **chaque** Test hebdomadaire ? *Recommandation* : oui ; une nouvelle tentative après un échec reprend les kits du Test échoué.

**Verdict** : le plan tient, à condition des corrections A1, A2, A4, A6 (intégrées aux Lots 0-1) et de la réponse à Q10. Aucun code avant validation de Saar.

## 10. Lot 1 — plan exact (2026-09-25, avant code)

**Invariant** : le serveur construit la vue et applique les décisions ; le client n'invente aucune règle. **Un seul problème** : donner au MJ, côté serveur, une vue groupée par personnage et un geste groupé.

**Coexistence temporaire, écrite ici pour ne pas devenir un legacy** : le Lot 1 AJOUTE deux routes ; l'écran actuel (`GET pending-review`, `POST healing-choice`) continue de fonctionner tel quel. Le **Lot 2** migre l'écran puis **supprime** l'ancienne route, l'ancienne fonction
(`getPendingReviewForGm`) et l'ancien composant — jamais deux moteurs à la clôture du chantier.

**Fichiers** : `shared/woundConstants.js` (+ test pur), `server/src/lib/woundReviewService.js` (+ test), `server/src/routes/campaigns.js`, `docs/SYSTEME/BLESSURES.md`, `docs/JOURNAL8.md`. Aucune migration.

**1. Kits dans `WOUND_HEALING` (`shared/`)** — une seule autorité, à côté de la durée. Chaque gravité qui guérit porte `kits: { first, following }` ; chaque liste = des **alternatives**, chaque alternative = les kits requis **ensemble** (Q10) :

| Gravité | Premier Test (`first`) | Tests suivants (`following`) |
|---|---|---|
| Moyenne, Grave | [premiersSoins] **ou** [medecine] | idem |
| Critique | [medecine] | [medecine] |
| Mortelle, Membre détruit | [chirurgie + medecine] | [medecine] |

Helpers purs : `getCareKits(severity, location, isFirstTest)` (via `getWoundHealing`, donc jamais de kit pour une Légère ni une Mort) et `sumKits(...)`. « Premier Test » ⇔ `occurrences_remaining === total` (total = durée ÷ 1 semaine) ; une nouvelle tentative reprend les kits du Test échoué
(elle a `occurrences_remaining = 1` : c'est le dernier Test, ses kits sont ceux de « suivants »). Par défaut, pour « premiers soins OU médecine », le décompte prend la **première alternative** (premiers soins, la moins chère) ; le MJ pourra choisir l'autre au Lot 2.

**2. `GET /api/campaigns/:id/game-echeances/review`** (MJ) → `{ cards: [...] }`, une carte par personnage ayant au moins une échéance de guérison ou d'infection à traiter (mêmes statuts que l'écran actuel) :
`{ characterId, name, isPlayer, state: { wounds: [{ location, severity, cases }], woundPenalty, statuses: [code] }, lines: [{ key, location, severity, cases, dueCases, answerable, dueEcheanceIds, step: { n, total } | null, isLastStep, targetSeverity | null, kits: { alternatives, defaultKits } }], infections: [{ echeanceId, location, severity, rollsNeeded, status }], kitTotals }`.
- **Ligne** = une (localisation, gravité) : « Localisation par Localisation » (`REGLEBLESSURES.md:386-392`) ; `cases` = nombre de cases de cette ligne sur la fiche ; `dueEcheanceIds` = les échéances échues de ses cases ; un Test = une ligne, donc **un seul jeu de kits par ligne** (le plus exigeant de ses cases : premier Test si l'une l'est).
- `step` : « semaine n/total » pour une échéance récurrente, `null` pour une échéance unique ; `isLastStep` + `targetSeverity` (`improvedSeverity`) disent ce que fait « Réussite » (passe à X, ou continue).
- `state` : compteur groupé, malus de blessure (`calcWoundPenalty`), codes des statuts actifs sur les tokens du personnage dans la campagne (`resolveCharacterTokens` + `token_statuses`), sans les déchiffrer (le client les affiche par le registre `shared/tokenStatusRegistry.js`).
- Ordre : joueurs (`characters.type = 'pj'`) d'abord, puis PNJ ; par nom. `isPlayer` sert au bloc PNJ replié du Lot 2. `kitTotals` = somme des `defaultKits`.
- `rollsNeeded` d'une infection = `occurrences_remaining ?? 1`.

**3. `POST /api/campaigns/:id/game-echeances/healing-choices`** (MJ) — corps `{ choices: [{ echeanceId, mjChoice }], care }` (1 à 200 entrées, `mjChoice ∈ {amelioration, echec, catastrophe}`, pas de doublon d'échéance, `soinsContinues` n'existe plus) :
- **`care`** (§11 B1, P5 ; **facultatif** : absent = rien n'est déclaré ni raconté — le Lot 2a n'en envoie pas, le Lot 2b l'envoie toujours) : `{ provider ∈ {none, character, npc, hospital, professional}, providerCharacterId?, providerName?, equipment ∈ {complete, partial, none} }`, **validé** par le serveur (personnage de la campagne, nom nettoyé) et **raconté** : une ligne de chat par personnage concerné (`emitSystemNotice`, clés i18n `combat:woundCare.notice.*`, ajoutées aux locales au Lot 1). Non stocké en v1 : le chat est la trace.
- **Un savepoint par entrée** (§11 B2) : fusion atomique du payload (`payload || ?::jsonb`, jamais lire-puis-écrire) puis `resolveEcheanceNow`. Si le moteur signale une **erreur de handler**, l'entrée est **annulée** (l'échéance reste en attente, jamais passée en `error` définitif) et rapportée. Le geste « toute la carte » = le client envoie toutes les échéances de la carte avec la même issue ; « blessure par blessure » = une ou plusieurs entrées : **un seul contrat**. Les entrées peuvent couvrir plusieurs personnages (geste « tous les PNJ »).
- Chaque échéance est vérifiée : de cette campagne, de type guérison, **répondable** (`pending_mj_review` / `awaiting_player_roll`). Une échéance périmée (déjà résolue, annulée entre-temps) ou pas encore ouverte (`active`, prochaine ronde) ne fait **pas** échouer le lot : `stale`.
- Réponse : `{ results: [{ echeanceId, resolved, stale?, error? }] }` — le client ne retire que les lignes réellement résolues.
- **Après validation** : `GAME_ECHEANCE_RESOLVED` pour chaque échéance résolue ET pour chaque échéance de la campagne passée à `cancelled` pendant le lot (règle la limite notée au Lot 0) ; `WOUND_UPDATED` une fois par personnage touché ; la ligne de chat du `care`.
- Prévu pour recevoir plus tard `consumeKits` et le choix d'alternative (Q6, v2) ; **non livrés** en v1.

**4. `POST /api/campaigns/:id/game-echeances/infection-modes`** (MJ) (§11 B4) — corps `{ choices: [{ echeanceId, mode ∈ {auto, player} }] }` ; même machinerie que le point 3 (validation, savepoint par entrée, résultat par échéance, diffusions). `auto` calcule le seuil et lance le jet serveur (`computeWoundInfectionThreshold` + `resolvePolarisTest`, comme la route unitaire actuelle, qui disparaît au Lot 2a) ; `player` bascule en `awaiting_player_roll`.

**Vue construite en requêtes groupées** (P3) : pas de requête par personnage (`whereIn` sur personnages, blessures, tokens, statuts). **Vue** : chaque ligne porte aussi `dueCases` (cases échues sur `cases`, P1) et `answerable` (P2).

**Hors périmètre du Lot 1** : le client (Lots 2a et 2b), la consommation des kits (v2), le nombre d'échéances PNJ.

**Tests** : pur (`shared/`) — table des kits, `getCareKits`, `sumKits`, aucune ligne pour Légère/Mort, **cohérence avec `DUREE_GUERISON_SOINS_TABLE`** (P4) ; service (base réelle, fixture nettoyée) — regroupement par personnage et par ligne, cases d'une même ligne = un seul jeu de kits, `dueCases` < `cases`, premier Test vs suivants, semaine n/total, PJ avant PNJ, statuts et malus, exclusion des campagnes étrangères, `answerable` faux pour une échéance `active` ; résolution groupée — issue commune à plusieurs échéances, mélange d'issues, plusieurs personnages, **erreur de handler annulée sans tuer l'échéance**, échéance périmée signalée sans faire échouer le lot, échéance d'une autre campagne refusée, `care` invalide refusé, ligne de chat émise, `WOUND_UPDATED` et `GAME_ECHEANCE_RESOLVED` émis (dont pour une annulée pendant le lot) ; infection groupée idem. Forme des payloads **figée par des tests**. **Limite** (P6) : aucun harnais de test de routes dans le dépôt — routes minces, transport HTTP non testé automatiquement, validé par Saar au Lot 2a.

**Validation** : tests ciblés en base ; pas de test en jeu (aucune interface) — Saar valide au Lot 2a. Commit après ses « ok » sur le code livré.

## 11. Analyse à charge du plan complet (2026-09-25, à la demande de Saar — le §9 précède ses décisions et ne couvrait pas le §10)

Relecture critique des Lots 1 à 3 contre le code réel. **Bloquants** (changent le plan) : B1-B4. **Précisions** (à intégrer au code) : P1-P8.

| # | Le plan disait | La réalité [preuve] | Correction retenue |
|---|---|---|---|
| **B1** | Lot 2 : le soignant et le matériel sont demandés à l'écran ; Lot 3 (plus tard) : le serveur les reçoit et les raconte dans le chat. | Entre les deux lots, ces contrôles seraient **décoratifs** — exactement le défaut que Saar a condamné (« les cases ne servent à rien », §2 C2). | Le contrat de la route groupée (Lot 1) porte dès le départ `care: { provider, providerCharacterId?, providerName?, equipment }` ; le serveur le **valide** et **raconte** une ligne de chat par personnage (`emitSystemNotice`, clés i18n, jamais de texte figé). Le Lot 3 disparaît ; l'écran qui envoie `care` est le Lot 2b. Le Lot 2a ne contient **aucun** contrôle de soignant. |
| **B2** | Route groupée : « une transaction ». | Un **échec de handler** est avalé par le moteur : `resolveEcheanceHandler` passe l'échéance en `error` **définitivement** [VÉRIFIÉ, lecture `echeanceService.js`] — une blessure sans échéance vivante, en silence : l'invariant du Lot 0 rompu. La route actuelle l'ignore et diffuse quand même « résolue ». Un lot « une seule transaction » avec une exception JS fait aussi tout annuler. | **Un savepoint par entrée** ; si le moteur signale `error`, l'entrée est **annulée** (l'échéance reste en attente, le MJ peut recommencer) et **rapportée** (`error: true`) ; une échéance périmée est signalée `stale`. Le lot est atomique pour la **cohérence de la base**, pas « tout ou rien » métier. |
| **B3** | Lot 2 : l'écran refait règle le sentiment de blocage. | Le client actuel affiche **en silence** (console seulement) les refus du serveur, dont le plus courant : « Confirmer » refusé (409) tant qu'une ligne n'a pas de réponse, ou parce que de **nouvelles échéances** sont nées de la revue (un Échec fait naître une infection déjà due : `confirmPendingAdvance` les rouvre en revue et le MJ doit **recliquer** — la « ronde ») [VÉRIFIÉ, `BlessuresReviewPanel.jsx:59-66`, `campaigns.js:351-376`]. Un MJ qui clique « Confirmer » et ne voit rien est « bloqué ». Avec un geste par personnage, une ronde coûte un clic, mais il faut que l'écran l'**explique**. | Lot 2a : le refus de « Confirmer » s'**affiche** dans le panneau (« il reste N lignes », « de nouvelles échéances sont apparues : ronde 2 ») ; `confirm` reste actif ; les PNJ repliés affichent leur **nombre restant** (un PNJ replié oublié bloque la confirmation). |
| **B4** | Un geste groupé pour les guérisons seulement ; l'Infection « décrite, résolue une par une ». | Un Échec sur plusieurs blessures fait naître **une infection par blessure** : le MJ redevient obligé de cliquer ligne par ligne — le problème d'origine, déplacé. | Le Lot 1 ajoute **`POST …/infection-modes`** (`{ choices: [{ echeanceId, mode }] }`), même machinerie que les guérisons (validation, savepoint par entrée, résultat par échéance, diffusions). |

| # | Précision à intégrer |
|---|---|
| **P1** | **Cases échues ≠ cases de la ligne** : une ligne de 3 cases n'a peut-être qu'**une** case échue (dates de naissance différentes). La vue porte `cases` **et** `dueCases` ; l'écran dit « 1 case échue sur 3 ». |
| **P2** | **Lignes non répondables** : `getPendingReviewForGm` inclut des échéances `active` déjà dues (pas encore ouvertes par « Confirmer ») ; `resolveEcheanceNow` les refuse (409). La vue les marque `answerable: false` (« prochaine ronde ») ; la route les renvoie `stale`, sans erreur. |
| **P3** | **Pas de N+1** : la vue se construit en requêtes groupées (`whereIn` sur les personnages, les blessures, les tokens), pas une requête par personnage. |
| **P4** | **Test d'anti-dérive des kits** : `DUREE_GUERISON_SOINS_TABLE.soinsNecessaires` (texte d'Encyclopédie) et `WOUND_HEALING.kits` disent la même chose en deux formats (« représentation parallèle assumée ») ; un test de cohérence (« Médecine ou Premiers soins » ⇔ les deux alternatives, « Chirurgie + Médecine » ⇔ les deux kits au premier Test) évite qu'ils divergent en silence. |
| **P5** | **Contrat `care` validé** : `provider ∈ {none, character, npc, hospital, professional}` ; `providerCharacterId` doit être un personnage de la campagne ; `providerName` (PNJ) : texte nettoyé, 60 caractères, sans saut de ligne ; `equipment ∈ {complete, partial, none}`. La ligne de chat passe le nom en paramètre (le client échappe). Non stocké en v1 : le chat est la trace (Q4). La v2 (Q6, consommation) s'appuiera sur `providerCharacterId` et ajoutera `consumeKits` et le choix d'alternative. |
| **P6** | **Transport HTTP non testable ici** : le dépôt n'a aucun harnais de test de routes (ni `supertest`, ni serveur Express de test). Les routes restent **minces** (validation + appel de service) ; la logique est testée au niveau du service ; le transport réel est validé par Saar au Lot 2a. À écrire dans la clôture : « transport HTTP non testé automatiquement ». |
| **P7** | **Sécurité** : les deux routes exigent `requireRole('gm')` ; chaque échéance est vérifiée contre la campagne ; 1 à 200 entrées ; doublons refusés. |
| **P8** | **Lot 2 trop gros** pour un tour (composant, CSS, i18n, silhouette, kits, soignant, suppression de l'ancien) : **scindé** en 2a (cartes et gestes, sans contrôle décoratif) et 2b (silhouette, kits, soignant). |

**Le §10 est corrigé en conséquence** (contrat `care`, `dueCases`, `answerable`, savepoint par entrée, route d'infection groupée, requêtes groupées, test d'anti-dérive, limite de test HTTP). Lots restants : **1** (serveur) → **2a** → **2b**.

**Verdict** : le plan tient, à condition de B1-B4 ; sans B1, le Lot 2 aurait livré des cases décoratives ; sans B2, un bug de handler tuerait une guérison en silence ; sans B3, le sentiment de blocage aurait survécu à la refonte. Aucun code avant validation de Saar.
