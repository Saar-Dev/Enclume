GABARIT_MANUEL.md

    Version : V1 — 2026-08-04

    Objet : Ce document est le modèle à suivre pour tout MANUEL technique d'un sous-système de jeu Enclume. Il traduit les règles brutes du Livre de Base Polaris en logique structurée, sans code, sans SQL, sans choix d'implémentation. Le MANUEL est le pont entre les règles RAW et le PLAN d'implémentation.

    Public cible : l'expert règles (validation), l'agent PLAN (implémentation), les agents codeurs (référence).

    Principe fondateur : Le MANUEL décrit quoi faire, jamais comment. Il doit être intégralement compréhensible et validable par une personne sans connaissance technique.

Cycle de vie d'un MANUEL

    Rédaction — Traduction des règles RAW en logique structurée, selon ce gabarit.

    Validation — Relecture par l'expert règles (Saar). Vérification de la conformité au Livre de Base.

    Passage au PLAN — Le MANUEL est transmis à l'agent PLAN. Il ne sera plus modifié après le démarrage du PLAN.

    Archivage — Une fois le sous-système codé, le MANUEL est conservé comme référence historique. Toute évolution future passe par un nouveau MANUEL (ex : MANUEL_EXOARMURE_V2.md).

Structure type

Chaque MANUEL suit les 8 sections ci-dessous. L'ordre est impératif. Une section peut être vide si elle ne s'applique pas au sous-système traité (ex : un sous-système sans règles optionnelles aura une section 5 réduite à "Néant").
1. Sources RAW

Objectif : lister exhaustivement les règles du Livre de Base couvertes par ce MANUEL, avec des références précises.

Format recommandé : un tableau.
Fichier dépôt	Pages LdB	Contenu couvert
docs/REGLES/REGLENOM.md	p.X-Y	Description brève

Règles :

    Toujours référencer le fichier du dépôt (ex : docs/REGLES/REGLEARMURE.md), pas seulement les pages du livre physique.

    Inclure les sources connexes : règles situées hors du chapitre principal mais qui s'appliquent au sous-système (ex : règles d'Intégrité du matériel pour les systèmes d'armure).

    Si une règle est dispersée sur plusieurs chapitres, le signaler explicitement.

2. Entités et attributs

Objectif : décrire les « objets » du sous-système et leurs caractéristiques, sans préjuger de leur implémentation.

Sous-sections suggérées : une par entité majeure (ex : 2.1 L'armure, 2.2 Le pilote, 2.3 Les composants…). Adapter selon le sous-système.

Pour chaque entité, distinguer :

    Les attributs fixes (communs à toutes les instances d'un même type/modèle).

    Les attributs variables (propres à chaque instance, évoluant avec le temps).

Format recommandé : des tableaux.
Attribut	Description	Source RAW
Nom de l'attribut	Ce qu'il représente, son rôle dans le sous-système	Page ou ligne

Règles :

    Les termes en gras sont des concepts métier qui devront être ajoutés à docs/VOCABULARY.md. Les identifier dès cette section facilite la mise à jour ultérieure.

    Ne pas décrire les relations entre entités ici (elles iront en section 3).

    Ne pas décrire les calculs ou les règles dynamiques ici (ils iront en section 4).

    Rester purement descriptif.

3. Relations et dépendances

Objectif : décrire comment les entités interagissent entre elles, et comment le sous-système s'articule avec le reste du jeu.

Sous-sections suggérées : une par interface avec un autre sous-système.

Exemples :

    3.1 Lien avec le système de personnages.

    3.2 Lien avec le système de combat.

    3.3 Lien avec le système d'équipement.

    3.4 Lien avec l'environnement.

Pour chaque lien, préciser :

    La nature de l'interaction (lecture, écriture, substitution, déclenchement).

    Le sens de la dépendance (qui dépend de qui).

    Si le lien est déjà existant ou à créer.

Règles :

    Ne pas décrire le « comment » technique (API, événements). C'est le rôle du PLAN.

    Signaler les dépendances qui pourraient être bloquantes si le sous-système lié n'est pas encore prêt.

4. Règles logiques

Objectif : le cœur du MANUEL. Traduire chaque règle du Livre de Base en logique structurée.

Format : une sous-section par mécanisme majeur (ex : 4.1 Substitution d'attributs, 4.2 Initiative, 4.3 Résolution des dégâts…). Numéroter les sous-sections pour permettre un référencement précis par le PLAN.

Pour chaque règle :

    Nom de la règle (titre de la sous-section).

    Référence RAW (page, ligne).

    Énoncé logique — en français structuré, sans code :

        Utiliser des structures conditionnelles naturelles : « Si… alors… sinon… ».

        Utiliser des formules simples : A = B + C.

        Utiliser des comparaisons : « Si X ≥ Y, alors… ».

    Tableau(x) de décision si la règle comporte de nombreux seuils ou paliers.

    Exemple(s) chiffré(s) — recommandé pour tout mécanisme comportant plus de 3 conditions ou étapes.

Format des exemples (recommandé) :

    Énoncé de la situation. Calcul étape par étape. Résultat final.

Les exemples sont en italique et ne font pas autorité — seule la règle énoncée fait foi.

Règles :

    Pas de pseudo-code (pas de function, pas de if () {}, pas de return).

    Pas de SQL (pas de CREATE TABLE, pas de types de colonnes).

    Pas de JavaScript (pas de const, pas de let, pas de =>).

    Si un calcul est trop complexe pour être décrit en une phrase, le décomposer en étapes numérotées.

    Les jets de dés sont notés sous la forme standard : 1D10, 2D6, 1D20, etc.

    Les modificateurs sont notés avec leur signe : +2, −5.

5. Règles optionnelles

Objectif : identifier les règles marquées « OPTIONNEL » dans le Livre de Base, et statuer sur leur inclusion dans le projet.

Format : une entrée par règle optionnelle.

Pour chaque règle optionnelle :

    Nom et référence RAW.

    Résumé de la règle (une phrase).

    Décision : RETENUE ou NON RETENUE pour le moment.

    Si non retenue, justification brève (ex : « complexité trop élevée pour la V1 », « dépend d'un autre sous-système non prêt »).

Règles :

    Si le sous-système n'a aucune règle optionnelle, inscrire « Néant » et passer à la section suivante.

    Une règle optionnelle retenue doit être décrite en section 4 comme n'importe quelle autre règle.

6. Questions ouvertes et ambiguïtés

Objectif : recenser tout ce qui n'est pas clair, pas tranché, ou sujet à interprétation dans les règles RAW.

Format : une entrée par question.

Pour chaque question :

    Titre explicite.

    Référence RAW concernée.

    Description de l'ambiguïté.

    Solution proposée ou hypothèse de travail (si elle existe).

    ⚠️ Si la question est bloquante pour l'implémentation, le signaler clairement.

Règles :

    Ne pas cacher les incertitudes. Mieux vaut une question ouverte qu'une décision implicite non assumée.

    Si une question dépend d'un autre chantier en cours, le mentionner et donner la référence.

7. Hors périmètre

Objectif : délimiter explicitement ce que le MANUEL ne couvre pas, pour éviter les dérives de scope dans le PLAN.

Format : une liste à puces.

Pour chaque élément hors périmètre :

    Nom du sujet exclu.

    Raison de l'exclusion (complexité, dépendance, V2, autre MANUEL…).

    Si le sujet est prévu pour plus tard, l'indiquer.

Règles :

    Être exhaustif. Mieux vaut trop de hors périmètre qu'un PLAN qui déborde.

    Si un sujet est mentionné dans le RAW mais volontairement exclu, le dire explicitement.

8. Passage au PLAN

Objectif : fournir à l'agent PLAN une feuille de route synthétique pour démarrer son travail.

Sous-sections obligatoires :

    8.1 Points bloquants — Ce qui empêche de coder certaines parties (dépendances non résolues, questions ouvertes bloquantes de la section 6).

    8.2 Dépendances externes — Sous-systèmes existants avec lesquels il faudra s'interfacer.

    8.3 Termes à ajouter à VOCABULARY.md — Liste des concepts nouveaux introduits par ce MANUEL, à formaliser avant ou pendant le PLAN.

    8.4 Complexités majeures — Les parties du sous-système qui nécessiteront une attention particulière (algorithmes complexes, effets en cascade, timers, etc.).

    8.5 Ordre de priorité suggéré (optionnel) — Proposition de découpage en lots, du plus fondamental au plus périphérique.

Règles :

    Cette section est un résumé : elle ne remplace pas la lecture du MANUEL par l'agent PLAN, elle l'oriente.

    Ne pas répéter ici les règles décrites en section 4. Juste pointer ce qui est critique.

Conventions transverses

Ces règles s'appliquent à toutes les sections du MANUEL.
Vocabulaire

    Termes métier : tout concept nouveau introduit par le MANUEL doit être en gras à sa première occurrence. Ces termes sont à ajouter à docs/VOCABULARY.md (liste récapitulative en section 8.3).

    Termes existants : avant d'introduire un nouveau terme, vérifier docs/VOCABULARY.md. Si le terme existe déjà, utiliser la définition existante et ne pas la redéfinir.

Références RAW

    Chaque règle logique doit pointer vers sa source RAW (page, ligne si possible).

    En cas de contradiction entre le MANUEL et le RAW, le RAW prime (hiérarchie documentaire du projet).

Exemples

    Format : italique, précédé de « Exemple : ».

    Contenu : situation concrète + calcul étape par étape + résultat.

    Recommandé pour tout mécanisme à plus de 3 conditions ou étapes.

Tableaux

    Recommandés pour les comparaisons de seuils, les paliers, les correspondances fixes.

    Toujours inclure une colonne "Source RAW" ou une référence en légende.

Signaux de dépendance

    ⚠️ Signale une dépendance non résolue ou un point bloquant.

    Utilisé dans les sections 6 (Questions ouvertes) et 8 (Passage au PLAN).

Exemple d'application

Un exemple complet de MANUEL rédigé selon ce gabarit est disponible dans docs/MANUEL/MANUEL_EXOARMURE.md. Il est recommandé de le lire avant de rédiger un nouveau MANUEL.

Fin du GABARIT_MANUEL.md V1.