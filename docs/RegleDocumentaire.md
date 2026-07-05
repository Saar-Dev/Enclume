# DOCUMENTATION_ARCHITECTURE.md

> Contrat d'architecture documentaire d'Enclume.
>
> Ce document définit les règles de classement de la documentation.
> Ces règles sont considérées comme des invariants.
> Aucun document ne peut les enfreindre.

---

# Règle 1 — Une responsabilité par document

Chaque document possède une responsabilité unique.

Un document ne traite jamais deux responsabilités différentes.

---

# Règle 2 — Une information = un seul endroit

Une définition ne doit exister qu'une seule fois.

Les autres documents utilisent un lien ou une référence.

Jamais de duplication volontaire.

---

# Règle 3 — Les documents sont classés par responsabilité, jamais par taille

La taille d'un document n'est jamais un critère.

Le découpage est déterminé uniquement par la responsabilité du document.

---

# Règle 4 — FOUNDATION

FOUNDATION décrit les règles globales du projet.

Il contient uniquement :

* conventions d'architecture ;
* conventions de développement ;
* invariants techniques ;
* règles documentaires.

Il ne contient jamais :

* les règles Polaris ;
* les domaines métier ;
* les API ;
* les schémas SQL.

---

# Règle 5 — VOCABULARY

VOCABULARY est le dictionnaire officiel du projet.

Il contient uniquement :

* concepts Polaris ;
* concepts Enclume ;
* acronymes ;
* conventions de nommage ;
* ambiguïtés de vocabulaire ;
* identifiants historiques.

Il ne contient jamais :

* architecture ;
* SQL ;
* API ;
* React ;
* logique métier.

---

# Règle 6 — DOMAINS

Un document de domaine décrit un domaine fonctionnel.

Exemples :

* CHARACTER
* COMBAT
* INVENTORY
* ENTITY

Il contient uniquement :

* responsabilités ;
* flux ;
* services ;
* interactions ;
* dépendances.

Il référence FOUNDATION et VOCABULARY lorsqu'il utilise leurs concepts.

---

# Règle 7 — SYSTEMS

Un document SYSTEM décrit un mécanisme transversal.

Exemples :

* Damage
* Initiative
* Vision
* Lighting

Un SYSTEM peut être utilisé par plusieurs DOMAINS.

---

# Règle 8 — REGLES

Le dossier REGLES contient uniquement des extraits du Livre de Base Polaris.

Aucune règle maison.

Aucune architecture.

Aucune implémentation.

---

# Règle 9 — MANUELS

Les MANUELS expliquent comment utiliser ou maintenir le projet.

Ils ne définissent jamais une règle métier.

---

# Règle 10 — PLANS

Un PLAN est temporaire.

Lorsqu'une fonctionnalité est terminée :

* le PLAN est archivé ou supprimé ;
* la documentation définitive est intégrée dans le DOMAIN ou le SYSTEM concerné.

---

# Règle 11 — Aucune duplication

Si une information existe déjà :

* on modifie la source ;
* on ne copie jamais le contenu.

---

# Règle 12 — Source de vérité

Chaque information possède une unique autorité.

Ordre de priorité :

1. Livre de Base Polaris
2. FOUNDATION
3. VOCABULARY
4. SYSTEM
5. DOMAIN
6. MANUEL
7. PLAN

Une information ne peut jamais contredire un niveau supérieur.

---

# Règle 13 — Taille des documents

La taille d'un document n'est jamais une raison de le découper.

Un document est découpé uniquement lorsqu'il porte plusieurs responsabilités distinctes.

---

# Règle 14 — Évolution

Toute nouvelle documentation doit être classée avant d'être rédigée.

La première question est toujours :

"Quelle est sa responsabilité ?"

Jamais :

"Dans quel dossier puis-je la mettre ?"
