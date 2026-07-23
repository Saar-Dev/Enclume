Wizard collaboratif GM/Joueur

Document préparé pour audit avant implantation.
1. Fondations : inspiration des outils collaboratifs
1.1 Arbitrage serveur (Figma)

Figma utilise un serveur autoritaire : chaque modification passe par le backend, qui applique l'opération et la broadcast. Aucun pair ne peut écrire directement dans le store d’un autre. Cette approche garantit la cohérence et simplifie la résolution de conflits. Nous la répliquons ici : le GM émet son intention de blocage via WebSocket, le serveur valide, persiste et redistribue.
1.2 Verrouillage non destructif (Notion)

Notion n’empêche pas l’édition simultanée, mais affiche la présence et les sélections des autres utilisateurs. Pour notre Wizard, le conflit n’est pas sur le contenu textuel mais sur le choix d’options. Nous adoptons un système de verrous binaires non bloquants : une option grisée est simplement non cliquable pour le joueur, mais il peut travailler sur les autres champs. Pas de verrou d’étape entier.
1.3 Modes d’édition vs commentaire (Figma, Miro)

Figma distingue le mode Édition (curseur normal) et le mode Commentaire (bulle). Nous transposons cela avec le toggle « Mode guide » : lorsqu’il est actif, les clics du GM deviennent des bascules de verrous ; lorsqu’il est inactif, le GM agit comme un joueur (sélectionne). L’activation par défaut est conforme à l’usage premier du GM : guider.
1.4 Validation hiérarchique (Google Docs)

Google Docs permet un propriétaire qui peut restreindre les droits. Nous nous inspirons de cette hiérarchie : le GM dispose d’un droit de réécriture finale (gmBypass), sans que cela invalide le travail intermédiaire du joueur. Le contournement n’est pas un mode permanent, mais un appel explicite lors de la réconciliation.
2. Décisions architecturales
2.1 WebSocket avec serveur autoritaire

Nous utilisons WebSocket (Socket.io) pour la synchronisation des verrous en temps réel. Avantages :

    Infrastructure déjà déployée dans le Wizard (SocketProvider).

    Événements légers, immédiats, sans polling.

    Autorité unique côté serveur : le serveur persiste chaque changement avant de le diffuser, garantissant qu’un refresh du client retrouve le même état.

Le canal est la room Socket.io existante de la campagne. Nous ajoutons deux événements :

    WIZARD_LOCK_UPDATE (GM → serveur)

    WIZARD_LOCKS_SYNC (serveur → room)

2.2 Modèle de verrou atomique

Chaque verrou est un triplet (sheetId, step, optionKey) où optionKey identifie une option cliquable (ex : career_soldat, genotype_humain, attr_FOR, skill_escalade). Le verrou est stocké dans une table wizard_locks :

    sheetId (UUID, FK vers char_sheet.id)

    step (entier 1-5)

    option_key (texte)

Unicité garantie par contrainte composite. Une absence de ligne signifie option libre.

Pourquoi pas JSONB dans char_sheet ?

    Indépendance des préoccupations : char_sheet est la fiche de personnage, pas un état temporaire de l’assistant.

    Facilité de requêtage et d’indexation.

    Sécurité : les locks sont gérés par des routes dédiées, sans risque d’écrasement accidentel par reconcileCreation.

2.3 État partagé entre GM et joueur

Le store Zustand du joueur reflète ses propres données (choix d’attributs, carrières, etc.). Les verrous sont stockés dans un champ lockedOptions : Set<string> synchronisé via WebSocket. Ainsi, les données métier et les verrous sont séparés, ce qui évite de dupliquer l’état métier sur le serveur avant la réconciliation finale.

Le GM, lorsqu’il ouvre le brouillon d’un joueur, charge l’état réconcilié le plus récent via GET /creation/:sheetId/state. Il ne reçoit pas les modifications non sauvegardées du joueur. Pas de « mode fantôme » en V1. Le GM voit l’état tel que le joueur l’a enregistré pour la dernière fois (via la réconciliation automatique à chaque changement d’étape — déjà en place dans le Wizard actuel au openPeek). Pour les verrous, ils sont immédiatement visibles car poussés par WebSocket.
2.4 Résolution de conflits

Règle : le GM a toujours raison.
Lors d’une réconciliation déclenchée par le GM, les données qu’il envoie écrasent celles du joueur. Si le joueur avait modifié des champs entre-temps sans les avoir réconciliés, ces modifications locales seront perdues. Ce comportement est assumé. On pourrait plus tard ajouter un indicateur de « joueur actif » pour prévenir le GM, mais pas en V1.

Pour éviter qu’un GM n’écrase accidentellement le travail du joueur, la réconciliation avec gmBypass sera une action explicite (bouton « Forcer la validation »).
3. Modèle de données
Nouvelle table wizard_locks
sql

CREATE TABLE wizard_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  char_sheet_id UUID NOT NULL REFERENCES char_sheet(id) ON DELETE CASCADE,
  step SMALLINT NOT NULL CHECK (step BETWEEN 1 AND 5),
  option_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (char_sheet_id, step, option_key)
);

Extension de char_sheet (optionnel)

Pour la gestion des brouillons, nous pourrions ajouter owner_user_id (redondant avec characters.user_id mais pratique pour les jointures). À défaut, on utilisera toujours la jointure via characters.
Mapping des optionKey

Chaque option cliquable dans le Wizard doit avoir une clé stable. Exemples :

    Étape 1 : attr_FOR, attr_CON, …, hand_L

    Étape 2 : genotype_HUMAIN, genotype_HYBRIDE

    Étape 3 : mutation_001, subtype_001a

    Étape 4 : career_soldat, skill_escalade, origin_geo_nord

    Étape 5 : advantage_077, disadvantage_D001

Ces clés seront définies côté client dans un mapping exporté par chaque composant d’étape. Cela garantit la cohérence entre GM et joueur sans synchronisation complexe.
4. API REST
4.1 Brouillons de campagne
text

GET /api/creation/campaign/:campaignId/drafts

Retourne une liste d’objets { sheetId, characterId, ownerName, ownerUserId, creationState, updatedAt }.
Pour un joueur, filtrage sur characters.user_id = req.user.id. Pour un GM, pas de filtre.
4.2 Démarrage pour un joueur
text

POST /api/creation/start
Body: { campaignId, targetUserId? }

Si targetUserId est fourni et que l’appelant est GM, on vérifie que la cible est membre de la campagne, puis on crée le brouillon avec characters.user_id = targetUserId. Sinon, comportement inchangé (création pour soi-même).
4.3 État complet du brouillon
text

GET /api/creation/:sheetId/state

Retourne les données réconciliées (step1 à step5) via les fonctions getStep4State, getStep5RefData, etc., déjà existantes. Le client peut ainsi hydrater son store à partir d’un sheetId existant.
4.4 Gestion des verrous
text

GET /api/creation/:sheetId/locks
→ { locks: [{ step, optionKey }] }

text

PUT /api/creation/:sheetId/locks
Body: { locks: [{ step, optionKey }] }

Le PUT remplace l’intégralité des verrous pour ce brouillon (transaction DELETE + INSERT). Seul le GM peut écrire. La route émet également l’événement WIZARD_LOCKS_SYNC dans la room après persistance.
4.5 Réconciliation avec bypass
text

POST /api/creation/:sheetId/reconcile
Body: { step1, ..., step5, finalize, gmBypass? }

    Si gmBypass=true et req.isGm, on passe outre les validations (sauf les gardes de sécurité comme l’existence des références en base).

    Sinon, comportement inchangé.

5. WebSocket
Événement WIZARD_LOCK_UPDATE (client GM → serveur)
json

{
  "sheetId": "uuid",
  "locks": [
    { "step": 2, "optionKey": "genotype_HYBRIDE" },
    { "step": 4, "optionKey": "career_soldat" }
  ]
}

Le serveur vérifie que l’émetteur est GM de la campagne du brouillon, puis appelle la même logique que PUT /locks. Ensuite, il émet WIZARD_LOCKS_SYNC à toute la room.
Événement WIZARD_LOCKS_SYNC (serveur → room)
json

{
  "sheetId": "uuid",
  "locks": [ ... ]
}

Tous les clients (GM et joueur) mettent à jour leur état local. Le joueur grise les options correspondantes. Le GM voit ses propres verrous (peut-être avec un style différent).
Connexion initiale

À la connexion Socket.io, le serveur interroge les locks du brouillon actif et les envoie via WIZARD_LOCKS_SYNC au client qui vient de se connecter. Ainsi, un rafraîchissement de page retrouve l’état sans requête REST supplémentaire.
6. Client — Architecture et flux
6.1 Store Zustand

Ajouter au creationStore :

    lockedOptions: Set<string> (initialisé vide)

    setLockedOptions(locks: Array<{step, optionKey}>) : met à jour le Set à partir d’un tableau.

    isGmView: boolean (défini lors du chargement du Wizard en tant que GM)

    ownerUserId: string | null

    loadExistingSheet(sheetId): nouvelle action asynchrone qui appelle GET /:sheetId/state et peuple le store.

6.2 Route React

    /campaigns/:campaignId/creation : comportement inchangé (démarrage nouveau brouillon).

    /campaigns/:campaignId/creation/:sheetId : nouvelle route pour ouvrir un brouillon existant. Si l’utilisateur est le propriétaire, isGmView = false. Si l’utilisateur est GM, isGmView = true.

6.3 Toggle « Mode guide »

Un bouton dans WizardHeader, visible uniquement si isGmView. Initialement activé. Quand il est actif, le clic sur une option déclenche l’émission WIZARD_LOCK_UPDATE avec la nouvelle liste de verrous (bascule de l’option). Un clic sur une option déjà verrouillée la déverrouille.
Quand le mode guide est désactivé, le GM clique pour sélectionner, exactement comme un joueur.
6.4 Effet sur les composants d’étape

Chaque composant d’étape reçoit lockedOptions et désactive visuellement les options correspondantes, avec un attribut disabled et un style grisé.
Le mapping optionKey est défini localement dans chaque composant (par ex. Step2Genotype définit optionKey = 'genotype_'+geno.id). Cela garantit que le serveur n’a pas besoin de connaître la sémantique des clés, mais seulement de les stocker et les redistribuer.
6.5 Réconciliation finale

Le bouton « Terminer » appelle handleTerminate qui envoie POST /reconcile avec finalize: true. Si isGmView, le GM voit un choix :

    « Valider normalement » (respecte les règles LdB).

    « Forcer la validation » (envoie gmBypass: true).

Dans les deux cas, le brouillon est verrouillé et devient un personnage normal.
7. Sécurité

    gmBypass : la route POST /reconcile vérifie req.isGm avant d’honorer ce flag. Un joueur ne peut pas l’utiliser.

    Verrous : l’écriture est réservée au GM via req.isGm dans la route PUT /locks et dans le handler WS.

    Démarrage pour autrui : POST /start avec targetUserId vérifie que l’appelant est GM et que la cible est membre de la campagne.

    Accès aux brouillons : la route GET /:sheetId/state et autres endpoints restent protégés par le middleware existant router.param('sheetId') qui vérifie l’appartenance à la campagne.

8. Plan d’exécution (ordre recommandé)
Ordre	Tâche	Invariants
1	Créer la table wizard_locks (migration)	Ne pas altérer les données existantes.
2	Implémenter GET/PUT /:sheetId/locks avec autorisation GM	Seul le GM peut écrire.
3	Implémenter GET /campaign/:campaignId/drafts	Filtrage correct selon rôle.
4	Étendre POST /start avec targetUserId	Vérification d’appartenance à la campagne.
5	Créer GET /:sheetId/state	Renvoie les données réconciliées existantes (step1-5).
6	Ajouter gmBypass dans reconcileCreation	Flag ignoré si pas GM.
7	Ajouter les handlers WS WIZARD_LOCK_UPDATE / WIZARD_LOCKS_SYNC	Autorité serveur, broadcast.
8	Étendre creationStore avec lockedOptions, isGmView, loadExistingSheet	Ne pas casser le flux joueur seul.
9	Ajouter route React :sheetId et chargement du brouillon	Le store est hydraté correctement.
10	Implémenter le toggle « Mode guide » et son comportement	Clic = bascule de verrou en mode guide.
11	Mettre à jour les composants d’étape pour supporter lockedOptions	Chaque composant définit ses optionKey.
12	Finalisation avec option gmBypass pour le GM	Ne verrouille qu’après validation.

Chaque étape peut être livrée et testée indépendamment.
9. Risques et atténuations
Risque	Atténuation
Désynchronisation des optionKey entre GM et joueur	Les clés sont définies dans les composants d’étape (source unique). Toute modification de ces composants doit être synchronisée.
Perte de données joueur en cas d’écrasement GM	Accepter le comportement en V1. Plus tard, on pourra ajouter un avertissement si le joueur a des modifications non réconciliées (détection via timestamp ou flag).
Complexité du mode guide	Le toggle explicite et le retour visuel immédiat (couleur de fond du Wizard en mode guide) réduiront les erreurs.
Surcharge de WebSocket	Très faible : un événement par clic de verrou. La room de campagne existe déjà.
10. Conclusion

L’architecture proposée capitalise sur l’existant (middleware, store, Socket.io) pour introduire la collaboration sans refonte majeure. Elle s’inspire des meilleures pratiques des éditeurs collaboratifs tout en restant pragmatique (pas d’OT/CRDT, pas de temps réel sur le contenu). Le plan d’exécution est incrémental et testable pas à pas.

Soumis à l’audit de votre expert avant toute implantation. Je reste disponible pour préciser toute partie du schéma ou des flux.