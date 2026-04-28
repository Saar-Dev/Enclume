Bon. J'ai tout ce qu'il me faut. Voici la doc de planification.
Plan — Module XP & Dépense de compétences
Ce qui existe déjà

Le code du dev externe (Competences.html) contient la logique complète de référence : coût d'augmentation par niveau, affichage +/-, récapitulatif avant validation, gestion des prérequis à la volée. C'est la source de vérité fonctionnelle pour ce chantier.

server/src/lib/ existe déjà (on y met polaris.js). charStats.js y sera créé.
Ce qui manque — inventaire complet
BDD

char_sheet n'a pas de colonne XP. Deux options possibles — décision requise :

Option A — Colonne simple sur char_sheet
sql

xp_available INT DEFAULT 0   -- XP restants à dépenser
xp_total     INT DEFAULT 0   -- XP total reçus (pour affichage)

Simple. Pas d'historique. Le GM saisit directement le solde.

Option B — Table char_xp_log (backlog UX1)
sql

id            UUID PK
char_sheet_id UUID FK
amount        INT        -- positif = gain, négatif = dépense
reason        TEXT       -- "Session 3", "Achat Informatique 5→6"
created_by    UUID FK→users.id
created_at    TIMESTAMPTZ

Historique complet. Plus lourd à implémenter.

❓ Question 1 : Option A ou B ? Mon avis : Option A d'abord, Option B en session future quand l'historique est réellement utile. pc_modifier reste tel quel — il sera remplacé par la logique XP dans une session future dédiée aux attributs.
Coût d'augmentation — server/src/lib/charStats.js

D'après le code du dev externe (getCoutAugmentation) :
js

// target = niveau visé (currentLevel + 1)
if (target <= 5)  return 1
if (target <= 10) return 2
if (target === 11) return 3
return 3 + (target - 11) * 2

❓ Question 2 : Ce barème est-il conforme au livre de base Polaris ? Le dev externe l'a codé — mais je n'ai pas le livre de base sous les yeux pour vérifier. À confirmer avant de coder.

❓ Question 3 : Le même barème s'applique-t-il aux attributs ? Dans le code du dev externe, les attributs coûtent COST_ATTR = 5 points chacun, flat. Est-ce la règle Polaris pour les attributs ? Ou différent ?

❓ Question 4 : Les compétences (-3) (difficiles) coûtent-elles plus cher ? Le livre mentionne "coût doublé" pour certaines compétences réservées (X). Qu'en est-il des (-3) ?
Routes API à créer

Dans char-sheet.js :

GET  /api/char-sheet/:id/xp         — lire xp_available + xp_total
PUT  /api/char-sheet/:id/xp         — GM uniquement : modifier le solde XP
POST /api/char-sheet/:id/skills/buy  — dépenser XP pour augmenter une compétence

❓ Question 5 : La route buy doit-elle vérifier les prérequis côté serveur ? Actuellement les prérequis sont vérifiés uniquement côté client. Si le serveur valide aussi, c'est plus robuste mais plus de code. Si le client suffit, plus simple.
Composants client à créer/modifier

CharacterSheet.jsx — ajouter :

    Bloc XP en haut de fiche : XP disponible : N / XP total reçus : N
    Visible par tous, modifiable GM uniquement

SkillsPanel.jsx — modifier :

    En mode "achat" (boutons +/-) : afficher le coût à côté de chaque compétence
    Bouton + désactivé si XP insuffisant ou prérequis non satisfaits
    Récapitulatif des achats avant validation (modale)

❓ Question 6 : Mode achat intégré dans la fiche ou fenêtre séparée ? Le dev externe a une page dédiée. Dans Enclume, deux options :

    Intégré dans SkillsPanel avec un toggle "Mode achat"
    Fenêtre flottante séparée (comme CharacterWindow)

❓ Question 7 : Le GM peut-il acheter des compétences pour un joueur, ou seulement distribuer des XP ?
Fix isVisible — à faire en même temps

La correction du (X) documentée plus tôt dans cette session est un prérequis fonctionnel du module XP : si Piratage informatique n'apparaît pas quand les prérequis sont satisfaits, le joueur ne peut pas l'acheter. Ce fix doit passer en premier.
Ce qui est clair et ne nécessite pas de décision

    charStats.js exportera getCoutAugmentation(currentLevel) et getCoutTotal(from, to)
    XP distribués par le GM uniquement → route PUT protégée par requireRole('gm') ou vérification isGm
    Affichage XP visible par le joueur propriétaire ET le GM
    mastery dans char_skills reste le champ de vérité — c'est lui qui est incrémenté à l'achat
    pc_modifier dans char_attributes n'est pas touché par ce chantier

Ordre d'implémentation suggéré

    Fix isVisible (compétences (X) avec SKILL_MIN) — prérequis fonctionnel
    Migration XP (Option A ou B selon décision)
    charStats.js — coût d'augmentation
    Routes API XP
    Bloc XP dans CharacterSheet
    Mode achat dans SkillsPanel

Résumé des questions bloquantes :
#	Question	Impact
Q1	Option A (colonnes) ou B (table log) pour le stockage XP ?	Architecture BDD
Q2	Barème coût confirmé conforme Polaris ?	charStats.js
Q3	Coût des attributs : 5 pts flat ou autre ?	charStats.js
Q4	Compétences (-3) ou (X) : coût doublé ?	charStats.js
Q5	Vérification prérequis côté serveur sur buy ?	Route API
Q6	Mode achat intégré ou fenêtre séparée ?	Architecture UI
Q7	GM peut acheter pour le joueur ou seulement distribuer XP ?	Routes + guards