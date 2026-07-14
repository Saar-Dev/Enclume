# AUDIT — Protocole d’analyse du projet Enclume
> Dernière mise à jour : 2026-07-13
>
> Manuel permanent destiné aux agents IA et aux contributeurs qui analysent Enclume.
> Responsabilité unique : définir **comment auditer** le projet. Ce document ne contient ni
> résultat d’audit, ni plan de correction, ni règle métier Polaris.

Les rapports d’audit pérennes sont classés dans `docs/AUDITS/`, à raison d’un fichier par
périmètre d’audit. `docs/JOURNALTEMP.md` reste exclusivement une mémoire de travail jetable.

---

## 1. Mission

Un audit établit l’état réel du projet à partir des sources, sans modifier son comportement.
Il répond à une question limitée et traçable : *ce flux respecte-t-il ses invariants, ses
autorisations, ses règles métier et son architecture ?*

Un audit n’est ni une revue esthétique, ni une recherche de défauts au hasard, ni une
autorisation implicite de corriger ce qui est trouvé. Il produit des éléments de preuve qui
permettent ensuite de décider, séparément, d’un plan de correction.

Principe directeur : **suivre un flux complet, puis vérifier les invariants qui le traversent.**
Une fonction prise isolément ne suffit que si elle est pure, locale et sans appelant ou effet
de bord pertinent. Un fichier est un conteneur de lecture, pas l’unité naturelle d’audit.

---

## 2. Contrat lecture seule

Sauf demande explicite distincte, un audit est strictement en lecture seule.

- Ne modifier aucun fichier de code, de configuration, de donnée, de migration ou de documentation
  de production.
- Ne démarrer ni serveur, ni client, ni test, ni migration ; ne pas appeler d’API, de Socket.IO ou
  de base de données applicative.
- Autoriser uniquement la lecture locale des sources, de l’historique Git et des métadonnées qui ne
  changent pas l’état du projet.
- Ne pas installer de dépendance, exécuter de scanner, ni télécharger d’outil pendant l’audit.
  Les outils externes sont des pistes à documenter, jamais une action implicite.
- Ne pas conclure qu’un comportement est observé. Une lecture de code permet une hypothèse ; seule
  une instrumentation ou une exécution explicitement autorisée permet une vérification fonctionnelle.

Le livrable de l’audit est un rapport, jamais un correctif.

---

## 3. Deux modes d’audit

### 3.1 Audit initial (baseline)

À utiliser pour un domaine non encore cartographié, une reprise de code ancien, une dette
importante ou avant un chantier architectural. Il commence par la carte du domaine puis couvre
tous ses flux critiques.

### 3.2 Audit incrémental (delta)

À utiliser après un changement identifié, avant une livraison ou après un signalement. Il part
du diff ou de la fonctionnalité concernée, puis remonte aux producteurs, descendants et
invariants impactés. Il ne ré-audite pas aveuglément tout le dépôt, mais ne s’arrête jamais au
seul fichier modifié.

Chaque rapport indique clairement son mode et son périmètre. Un audit delta ne permet pas de
déclarer le domaine entier sain.

---

## 4. Unité d’audit : le flux fonctionnel

L’unité par défaut est un **flux vertical**, limité à une intention utilisateur ou système.
Elle est close seulement lorsque ses entrées, règles, effets et consommateurs sont connus.

```text
Entrée → identité et droits → validation → orchestration métier
       → transaction / persistance → événement ou réponse
       → consommateurs → effet visible ou état final
```

Exemples d’unités adaptées à Enclume :

- une route REST et l’opération métier qu’elle déclenche ;
- un événement Socket.IO, de son émetteur client jusqu’aux sockets consommateurs ;
- une action de combat, de la déclaration à la résolution et aux états persistés ;
- une opération de création de personnage, de la saisie au verrouillage final ;
- une table, sa migration, ses contraintes et **tous** ses lecteurs/écrivains ;
- une fonction pure de calcul, son contrat, ses appelants et les règles Polaris qui l’autorisent.

Cas où l’unité peut être plus petite : configuration isolée, helper pur sans état ni effet,
composant visuel sans communication externe. Le rapport justifie alors explicitement pourquoi
aucun flux adjacent n’est concerné.

**Interdit :** choisir une fonction « au hasard » ou conclure sur un fichier sans rechercher ses
appelants, ses producteurs de données et ses consommateurs.

---

## 5. Préparation obligatoire

Avant toute lecture détaillée :

1. Écrire la question d’audit en une phrase, le mode et la borne de périmètre.
2. Lire les documents de vérité applicables, selon leur hiérarchie dans `docs/FOUNDATION.md` et
   `docs/RegleDocumentaire.md` : règle Polaris, système, domaine, manuel, plan puis journal utile.
3. Identifier les actifs critiques : identité, rôles, campagnes, personnages, inventaire, états de
   combat, données personnelles, fichiers et secrets.
4. Lister les points d’entrée et les frontières de confiance : navigateur, route REST, socket,
   tâche interne, base, cache, stockage d’objets et service tiers.
5. Créer `docs/AUDITS/AUDIT_YYYY-MM-DD_<scope>.md`, puis y écrire le périmètre, les sources prévues
   et les questions ouvertes. Le nom de scope décrit l’objet audité, pas une fonction choisie au
   hasard.

Si la règle métier est absente ou contradictoire, le noter `[INCONNU]`. Ne pas la reconstituer de
mémoire et ne pas transformer une supposition en exigence d’audit.

---

## 6. Ordre de travail

### 6.1 Cartographier avant de juger

Commencer par les points d’entrée et les contrats visibles, puis dresser une carte minimale :

- qui peut initier l’action ;
- quelles données entrent et sous quelle forme ;
- quels services, tables, caches et événements sont traversés ;
- qui reçoit le résultat ;
- quels invariants métier, sécurité et cohérence doivent rester vrais.

La carte est une hypothèse de travail ; elle est corrigée dès qu’un appelant ou consommateur
supplémentaire est découvert.

### 6.2 Prioriser par risque, pas par taille de fichier

Auditer d’abord les flux qui combinent une frontière de confiance avec un effet important :

1. authentification, autorisation, changement de rôle ou d’appartenance à une campagne ;
2. écritures de données, transactions, migrations et suppressions ;
3. combat, inventaire, monnaie/PC, création et verrouillage de personnage ;
4. Socket.IO, reconnect, diffusion inter-joueurs, cache Redis et états éphémères ;
5. upload, MinIO, secrets, configuration et services externes ;
6. flux UI et calculs purs à impact local.

Le niveau de risque est réévalué à chaque découverte. Une petite fonction située sur une
frontière d’autorisation prime sur un grand composant purement visuel.

### 6.3 Suivre le flux dans les deux sens

Pour chaque unité :

1. **Descente** : suivre les données depuis l’entrée vers chaque effet de bord.
2. **Remontée** : depuis chaque effet important, recenser les appelants, les écritures concurrentes
   et les consommateurs du résultat.
3. **Recherche exhaustive ciblée** : rechercher les noms de route, événements, fonctions, tables,
   champs JSONB et constantes rencontrés dans tout le dépôt.
4. **Contrat croisé** : comparer les formes de payload entre émetteur/récepteur, les colonnes entre
   migration/modèle/requête, et les règles entre source Polaris/service/UI.
5. **Fermeture** : ne clôturer l’unité que lorsque les chemins normaux, refusés, asynchrones et de
   reconnexion pertinents ont été traités ou explicitement laissés `[INCONNU]`.

---

## 7. Checklists transversales

Les checklists ne remplacent jamais la lecture du flux. Elles évitent les angles morts connus.

### 7.1 Identité, droits et frontières de confiance

- L’identité provient-elle d’une source serveur fiable ?
- Chaque écriture vérifie-t-elle rôle, campagne et propriété selon la convention du projet ?
- Une validation UI est-elle dupliquée côté serveur quand elle protège une règle ?
- Un identifiant fourni par le client peut-il désigner une ressource d’une autre campagne ?
- Les réponses, erreurs et événements évitent-ils de divulguer une donnée non autorisée ?

### 7.2 État, concurrence et données

- Les transitions d’état sont-elles explicites et bloquent-elles les transitions illégales ?
- Les écritures liées sont-elles atomiques ou compensées en cas d’échec ?
- Une double émission, reconnexion, retry ou concurrence peut-elle dupliquer l’effet ?
- Les données persistées, Redis et Maps mémoire possèdent-ils une source de vérité clairement
  désignée et une stratégie de nettoyage/restauration ?
- Migration, schéma, contraintes, requêtes et consommateurs utilisent-ils le même contrat ?

### 7.3 Contrats REST, Socket.IO et client

- Émetteur et récepteur utilisent-ils le même nom d’événement et le même payload ?
- Les ACK/erreurs sont-ils gérés sur tous les chemins importants ?
- Les rooms, rôles et filtres de diffusion respectent-ils l’isolation des campagnes ?
- Les listeners client sont-ils créés/nettoyés une seule fois et attachés au bon socket ?
- L’UI reflète-t-elle l’état serveur, sans se présenter comme autoritaire quand elle ne l’est pas ?

### 7.4 Métier et règles Polaris

- La règle consultée est-elle la source de vérité LdB, et non une ancienne synthèse ?
- Les unités, bornes, arrondis, marqueurs et cas limites sont-ils identiques sur tous les chemins ?
- Un même calcul est-il dupliqué, avec risque de divergence ?
- Les cas PJ, PNJ, drone et entité sont-ils distingués selon les concepts du projet ?

### 7.5 Résilience, sécurité et qualité durable

- Les erreurs conservent-elles assez de contexte sans exposer secret, JWT ou données sensibles ?
- Les entrées externes sont-elles validées à chaque frontière avant les sinks sensibles ?
- Les dépendances, scripts et configurations réduisent-ils les risques de chaîne logistique ?
- Le code réutilise-t-il une primitive existante au lieu de créer une variante locale ?
- Le changement éventuel serait-il localisable, testable et réversible sans effet caché ?

---

## 8. Recherche de solution robuste avant toute recommandation

L’audit ne conçoit pas de correctif, mais il peut qualifier une direction architecturale. Avant
d’écrire une recommandation, l’agent doit :

1. Lire l’architecture et les mécanismes existants du domaine ; un mécanisme déjà correct prime
   sur la création d’un doublon.
2. Chercher les références officielles du framework ou de l’outil concerné.
3. Chercher, lorsque le problème le justifie, des projets ouverts reconnus ou des bibliothèques
   maintenues qui résolvent le même problème.
4. Comparer au moins : intégration avec l’existant, invariants préservés, modes d’échec,
   exploitabilité, testabilité, coût de maintenance et possibilité d’évolution.
5. Documenter les alternatives réellement examinées et pourquoi une recommandation est retenue ou
   différée. Une préférence personnelle n’est pas une justification.

Ne pas importer une architecture parce qu’elle est populaire. Elle doit correspondre aux contraintes
d’Enclume : monorepo React/Node, Socket.IO, PostgreSQL, Redis, sessions privées et déploiement ciblé
Raspberry Pi. Toute dépendance ou automatisation nouvelle requiert une autorisation séparée.

---

## 9. Niveau de preuve et formulation

| Marqueur | Signification | Autorisé en lecture seule |
|---|---|---|
| `[SOURCE]` | Texte, règle ou structure lus et localisés. | Oui |
| `[HYPOTHÈSE]` | Conséquence déduite du code lu, non observée à l’exécution. | Oui |
| `[INCONNU]` | Information absente, contradictoire ou non accessible dans le périmètre. | Oui |
| `[VÉRIFIÉ]` | Comportement instrumenté et observé en exécution. | Non, sauf audit d’exécution autorisé séparément |

Un constat cite toujours `chemin:ligne` et le chemin de flux concerné. Une hypothèse n’est jamais
annoncée comme une cause racine. Si elle justifie une correction, l’étape suivante est d’abord un
plan d’instrumentation ou de reproduction soumis à validation.

---

## 10. Rapport continu et append-only

Le rapport est créé dès la préparation dans `docs/AUDITS/AUDIT_YYYY-MM-DD_<scope>.md`. Pendant
l’audit, ajouter une entrée au bas de ce rapport **après chaque unité close**. Ne pas réécrire une
entrée antérieure : une correction de compréhension est une nouvelle entrée qui référence
l’ancienne. Cette granularité garde la trace des découvertes sans exiger de mémoire de conversation.

`docs/JOURNALTEMP.md` peut contenir des notes privées de recherche, mais jamais le rapport d’audit,
ses constats ni son bilan. Il peut donc être réinitialisé sans perte de preuve.

Une unité close est :

- une fonction pure et ses appelants ;
- un handler REST ou Socket.IO et son flux complet ;
- une opération publique de service et ses effets ;
- une table et l’ensemble de ses producteurs/consommateurs ;
- un composant UI et tous ses handlers/échanges externes pertinents.

Pour un très grand corpus homogène, fermer un lot de dix éléments maximum, avec sa borne explicite.
Ne jamais annoncer « tout le fichier est audité » si une fonction publique, un handler ou un flux
inter-fichier reste hors inventaire.

### Gabarit d’entrée `docs/AUDITS/AUDIT_YYYY-MM-DD_<scope>.md`

```md
## Audit — [date] — [identifiant d’unité]

- Mode : baseline | delta
- Question :
- Périmètre :
- Sources lues :
- Flux cartographié : entrée → ... → sortie
- Invariants contrôlés :
- Constat(s) : `[SOURCE]` / `[HYPOTHÈSE]` / `[INCONNU]`, avec `chemin:ligne`
- Anomalie(s) ou faux positif(s) : gravité, impact, preuve, portée
- Dépendances / appelants / consommateurs vérifiés :
- Hors périmètre et raison :
- Suite requise : aucune | unité suivante | instrumentation à faire valider
```

Après confirmation que l’audit est terminé, ajouter dans le journal de session actif
(`docs/JOURNAL6.md` à ce jour) une synthèse et un lien vers le rapport. Le rapport reste la preuve
complète ; `JOURNALTEMP.md` peut être réinitialisé sans archivage.

---

## 11. Triage des découvertes

Une découverte n’est exploitable que si elle sépare gravité et certitude.

| Gravité | Conséquence potentielle |
|---|---|
| Critique | accès non autorisé, corruption/perte de données, rupture globale ou règle centrale contournable |
| Haute | flux important incorrect, incohérence persistée, blocage multi-utilisateur ou forte exposition de données |
| Moyenne | erreur limitée, dette qui augmente le risque de régression, comportement dégradé avec contournement |
| Faible | lisibilité, documentation, duplication sans impact fonctionnel identifié |

Pour chaque point, écrire : impact concret, préconditions, chemins affectés, preuve disponible,
confiance, et action suivante. Les corrections ne sont pas fusionnées dans l’audit : **un bug, un
plan, une validation fonctionnelle**, selon `CLAUDE.md`.

---

## 12. Critères de clôture

Un audit est clos lorsque :

- son périmètre annoncé est couvert ou chaque exclusion est motivée ;
- tous les points d’entrée, producteurs et consommateurs découverts ont été reportés ;
- les constats possèdent une preuve et un niveau de certitude ;
- les inconnues et hypothèses restantes sont nommées, non masquées ;
- le rapport dédié contient les unités closes ;
- le bilan ne prétend pas à une vérification d’exécution si l’audit était en lecture seule.

Le rapport final contient obligatoirement : **Audité**, **Non audité**, **Hypothèses restantes** et
**Suites proposées**. Il n’emploie pas « sain », « corrigé » ou « validé fonctionnellement » sans la
preuve correspondante.

---

## 13. Références à consulter

Ces ressources inspirent la méthode ; elles ne remplacent jamais les sources de vérité d’Enclume.

- [OWASP — Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html) : analyse de flux, frontières de confiance, logique métier et audits baseline/delta.
- [OWASP — Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/) : décisions traçables, frontières de services et résilience.
- [Google Engineering Practices — Code Review](https://google.github.io/eng-practices/review/) : conception, fonctionnalité, complexité et santé durable du code.
- [OpenSSF Scorecard](https://github.com/ossf/scorecard) et [OpenSSF Best Practices](https://openssf.org/projects/best-practices-badge/) : pratiques de sécurité, dépendances et chaîne de livraison.
- [GitHub CodeQL](https://github.com/github/codeql) : exemples de requêtes d’analyse statique ; outil complémentaire à une lecture humaine.
- [Semgrep](https://github.com/semgrep/semgrep) : exemples de règles de détection et de garde-fous adaptés à la base de code.

Toute référence externe utilisée pour une recommandation concrète est citée dans le rapport avec sa
date de consultation et confrontée aux contraintes réelles du dépôt.
