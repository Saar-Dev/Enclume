Méthodologie — Conduite d'un plan de conception

    Version 2.2 — 2026-08-02

    Pour tout chantier transverse dans Enclume.

Principes cardinaux
Rythme

Qualité > vitesse. Une pause réflexive de 2-5 minutes avant chaque transition de phase et avant
toute rédaction finale est obligatoire. L'utilisateur préfère trois runs d'analyse de 45 secondes
qu'une réponse partielle en 0,4 seconde. Annoncer : « Je prends le temps de réfléchir. »
[VÉRIFIÉ] / [INFÉRÉ]

Toute affirmation dans une analyse ou un document produit doit être marquée :

    [VÉRIFIÉ] — fichier lu dans la session, source citée.

    [INFÉRÉ] — hypothèse plausible, à confirmer.

Aucune affirmation non marquée n'est acceptée. Dans un document de référence destiné à être lu par
d'autres agents, les faits vérifiés sont présentés comme tels ; les hypothèses sont clairement
signalées et accompagnées d'une question ouverte.
Mémoire externe

JOURNALTEMP.md est alimenté en continu, sans mise en forme. Structure minimale :
text

## Questions ouvertes
## Décisions prises
## Fichiers lus
## Pauses réflexives

Ne jamais effacer — barrer, annoter. C'est une mémoire, pas un livrable.
Phase 0 — Inventaire documentaire

Objectif : savoir ce qui existe déjà avant de commencer.
text

□ Consulter l'index documentaire s'il existe (docs/SYSTEME/INDEX.md).
□ S'il n'existe pas, demander à l'utilisateur la liste des documents pertinents pour le domaine.
□ Lire EN_COURS.md, VOCABULARY.md, CLAUDE.md.
□ Lire les documents système déjà produits sur le domaine concerné.
□ Pause réflexive : périmètre clair ? documents manquants identifiés ?

Piège : ne pas découvrir un document crucial en cours de rédaction. Demander explicitement :
« existe-t-il d'autres documents sur ce sujet ? »
Phase 1 — État des lieux
text

□ Identifier TOUS les fichiers concernés (code source, documentation existante, spécifications).
□ Les demander un par un, lire chacun intégralement.
□ Cartographier les flux : qui émet, qui reçoit, où est stocké.
□ Pause réflexive : tous les fichiers lus ? questions ouvertes ? → JOURNALTEMP.md

Principes :

    Ne jamais diagnostiquer sans avoir lu le code.

    Ne rien supposer — si un handler manque, chercher dans les imports, ne pas deviner.

    Produire une synthèse après chaque fichier important.

    Ne pas passer à la rédaction tant que tous les fichiers pertinents n'ont pas été lus.

    Avant de rédiger, demander : « y a-t-il autre chose que je devrais lire ? »

Phase 2 — Analyse critique
text

□ Identifier les problèmes architecturaux.
□ Marquer chaque affirmation [VÉRIFIÉ] ou [INFÉRÉ].
□ Chercher à infirmer ses hypothèses (pas de biais de confirmation).
□ Confronter les sources entre elles : des documents existants se contredisent-ils ?
□ Distinguer les documents à jour des documents obsolètes.
□ Pause réflexive : angles morts ? → JOURNALTEMP.md

Principes :

    Ne pas confondre « le code fait X » et « le code devrait faire X ».

    Un document marqué comme source par un autre document n'est pas nécessairement à jour —
    vérifier avant de référencer.

    Un document obsolète doit être soit mis à jour, soit archivé avec un bandeau clair indiquant
    par quoi il est remplacé.

Phase 3 — Consultation externe (si nécessaire)
text

□ Formuler des questions précises visant des décisions concrètes.
□ Les poser en plusieurs vagues si nécessaire (principes généraux → détails → points spécifiques).
□ Confronter chaque réponse à l'existant, adapter au contexte Enclume.
□ Pause réflexive : décisions impactées ? nouvelle vague ? → JOURNALTEMP.md

Piège : une question vague → réponse inexploitable. Chaque question doit viser une décision.
Phase 4 — Conception
text

□ Justifier chaque décision : « parce que Y, confirmé par Z ».
□ Vérifier la cohérence avec le contrat du projet.
□ Vérifier la responsabilité unique du nouveau document (règle documentaire).
□ Vérifier que l'information n'existe pas déjà ailleurs → pas de duplication.
□ Prévoir la migration (ancien → nouveau sans casser).
□ Lister le hors-scope explicitement.
□ Pause réflexive : plan cohérent ? points ouverts résolus ? → AVANT de rédiger.

Principes :

    Module autonome (API, événements, persistance).

    S'inspirer des patterns éprouvés, ne pas coder de zéro.

    Ce qui n'est pas fait en V1 est aussi important que ce qui est fait.

    Pour un document : définir sa responsabilité unique avant d'écrire une ligne.

    Pour un document : ne pas rédiger avant d'avoir lu tous les fichiers pertinents.

Livrable type (conception code) : objectif, architecture cible, schéma DB, API REST,
événements WS, composants, stratégie de migration, plan de tests, livrables V1, hors-scope.

Livrable type (conception documentaire) : responsabilité unique, documents associés,
périmètre, hors-scope, sources vérifiées.
Phase 5 — Validation
text

□ Cohérent avec CLAUDE.md ?
□ Décisions justifiées (pas d'arbitraire) ?
□ Migration réversible (feature flag, rollback) ?
□ Tests prévus à tous les niveaux ?
□ Hors-scope délimité ?
□ Points ouverts listés explicitement ?
□ Toutes les affirmations sont [VÉRIFIÉ] ou [INFÉRÉ] ?
□ Pas de duplication avec des documents existants ?

Pièges à éviter
Piège	Symptôme	Correctif
Conclure trop vite	« Prêt pour la conception » avec des points ouverts	Lister les questions non résolues avant de terminer la phase
Lire sans synthèse	Accumuler les fichiers sans rien produire	Synthèse partielle après chaque fichier important
Inventer des sources	« D'après Discord... » sans vérification	[VÉRIFIÉ] ou « je ne sais pas »
Halluciner des échanges	Prêter à l'utilisateur des contraintes inexistantes	Relire l'historique avant d'affirmer une contrainte
Négliger JOURNALTEMP	Perdre des questions ou décisions	Alimenter systématiquement, ne jamais effacer
Répondre sans pause réflexive	Analyse basée sur des hypothèses, corrections après coup	Pause obligatoire avant toute analyse ou décision
Rédiger avant d'avoir tout lu	Document incomplet ou spéculatif, corrections en cascade	Ne pas rédiger tant que tous les fichiers pertinents n'ont pas été lus. Demander « y a-t-il autre chose ? »
Faire confiance à un document non vérifié	Inclure des informations obsolètes (ex. Redis) dans un nouveau document	Toujours confronter un document au code source actuel avant de le référencer
Découvrir un document en cours de route	Rédaction à reprendre, corrections tardives	Phase 0 : inventaire documentaire exhaustif avant toute analyse
Omettre le marquage dans un document produit	Document de référence contenant des hypothèses non signalées	[VÉRIFIÉ] / [INFÉRÉ] obligatoire même dans les livrables
