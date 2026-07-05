# Vocabulary.md

> Vocabulary — Contrat sémantique officiel d'Enclume
>
> Version : V1
>
> Statut : Source de vérité

---

document_type: vocabulary

authority: semantic

used_by:

* Combat
* Character
* Inventory
* Wizard
* Trade

update_policy:
modify_here_first: true

---

# Mission

Vocabulary définit le langage officiel d'Enclume.

Ce document est la seule source de vérité concernant :

* les concepts métier Polaris ;
* les termes propres à Enclume ;
* les conventions de nommage ;
* les identifiants historiques ;
* les ambiguïtés connues.

Tous les autres documents utilisent ces termes mais ne les redéfinissent jamais.

---

# Règles

## Source de vérité

Lorsqu'un concept existe dans Vocabulary, sa définition fait autorité.

Les autres documents doivent référencer Vocabulary plutôt que recopier les définitions.

---

## Convention documentaire

Chaque concept documenté possède lorsque cela est pertinent :

* un nom métier ;
* un identifiant de code ;
* une implémentation de référence ;
* une source d'autorité.

---

# Concepts métier Polaris

| Concept | Code | Implémentation | Autorité | Notes |
| ------- | ---- | -------------- | -------- | ----- |

(...)

---

# Concepts Enclume

Concepts n'existant pas dans Polaris mais créés par le projet.

| Concept | Description | Implémentation |
| ------- | ----------- | -------------- |

(...)

---

# Conventions de nommage

## Database

(...)

## Backend

(...)

## Frontend

(...)

## WebSocket

(...)

---

# Pièges historiques

Anciennes conventions encore présentes dans le code.

Toute nouvelle implémentation doit utiliser les conventions officielles.

| Ancien | Officiel | Pourquoi |
| ------ | -------- | -------- |

(...)

---

# Ambiguïtés connues

| Nom | Ne pas confondre avec | Explication |
| --- | --------------------- | ----------- |

(...)

---

# Acronymes

(...)

---

# Sources

* Livre de Base Polaris
* FOUNDATION
* ADR
