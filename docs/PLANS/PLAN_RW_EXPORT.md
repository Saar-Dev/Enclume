PLAN_RW_EXPORT — Rework de la fiche hors-ligne (PWA) et de l’impression

    2026-08-16 · Version 2 (révisée après analyse critique)
    Suite de docs/PLANS/PLAN_FICHE_HORSLIGNE.md et de docs/SYSTEME/FICHE_HORSLIGNE.md.
    Statut : 🔴 PROPOSITION — aucun code écrit, points à trancher avec Saar (§3).

0. Contexte

La fiche hors-ligne (PWA) et la vue d’impression sont codées et vérifiées au niveau
build/lint/serveur, mais non testées en navigateur réel. L’analyse du code a révélé des
incohérences et limitations documentées dans docs/SYSTEME/FICHE_HORSLIGNE.md sous les références
HORS1 à HORS12.

Ce plan propose un découpage en lots pour corriger ou améliorer ces points, en respectant les
priorités du projet : qualité structurelle > rapidité, pas de code à la volée, validation
proportionnée.
1. Problèmes identifiés
Réf.	Problème	Gravité	Impact
HORS1	Absence généralisée de mise à jour optimiste	Élevée	UI statique hors-ligne, impression d’échec
HORS2	Feedback incohérent (équipement oui, autres non)	Moyenne	Utilisateur non informé pour blessures/compétences/inventaire
HORS3	Risque de doublons (clics multiples)	Élevée	Plusieurs requêtes en file pour une même action
HORS4	Couverture partielle de l’inventaire (PUT oui, POST/DELETE non)	Moyenne	Incohérence : modifier oui, créer/supprimer non
HORS5	Champs non couverts actifs hors-ligne (identité, attributs, XP, etc.)	Élevée	Fausse impression de sauvegarde
HORS6	networkTimeoutSeconds: 3 avec NetworkFirst	Faible	Cache périmé si réseau lent
HORS7	Bundle complet précaché (~4 Mo)	Dette	PWA lourde, contournement de limite
HORS8	maxEntries: 200 potentiellement insuffisant	Faible	Éviction de données utiles
HORS9	Icône PWA : favicon.svg seul	Cosmétique	Installation PWA incomplète
HORS10	isOfflineQueuedError ne couvre pas « serveur down mais navigateur en ligne »	Faible	Mauvais message utilisateur
HORS11	characterExportService.js orphelin	Dette	Code mort à statuer
HORS12	CampaignCharacterSheetPage ne supporte pas les exo-armures	Faible	Fonctionnalité manquante
2. Découpage en lots
Lot 0 — Préalables : tests navigateur réels et correction de isOfflineQueuedError

Objectif : établir une base de vérité avant toute correction, et fiabiliser la détection des
erreurs hors-ligne.

Actions :

    Corriger isOfflineQueuedError (HORS10) :

        Étendre la fonction pour couvrir le cas « serveur injoignable mais navigator.onLine === true »,
        c’est-à-dire toute erreur sans error.response, indépendamment de l’état de navigator.onLine.

        Fichier concerné : client/src/lib/api.js.

        Impact : les appels à cette fonction (actuellement uniquement LocationPanel) refléteront
        correctement les mises en file lorsque le serveur est down.

    Exécuter les tests navigateur réels (scénarios détaillés en §4) sur la PWA actuelle, pour
    confirmer les comportements documentés et fournir une référence avant modifications.

Validation : tests manuels documentés, pas de code métier autre que api.js.
Lot A1 — Désactivation des champs non couverts hors-ligne (HORS5)

Objectif : empêcher l’utilisateur de modifier hors-ligne des données qui ne seront pas
synchronisées.

Actions :

    Introduire un état global isOnline (hook basé sur navigator.onLine et/ou la réponse du service
    worker).

    Passer un prop offline aux composants concernés (CharacterSheet.jsx, SkillsPanel.jsx,
    InventoryPanel.jsx, InventoryBanner.jsx, etc.).

    Désactiver ou masquer les contrôles d’édition dont la route n’est pas couverte par
    backgroundSync :

        Identité, archétype, attributs, Chance, XP direct.

        Édition directe des maîtrises par le GM (PUT /skills).

        Ajout/suppression d’inventaire, validation GM (si la file n’est pas encore étendue).

    Pour les actions non couvertes mais potentiellement couvertes plus tard (inventaire, exo), laisser
    un état cohérent avec les décisions de couverture.

Fichiers concernés : CharacterSheet.jsx, SkillsPanel.jsx, InventoryPanel.jsx,
InventoryBanner.jsx, client/src/lib/useOnlineStatus.js (nouveau hook éventuel).

Validation : tests manuels hors-ligne pour vérifier que les champs sont bien inactifs et
compréhensibles.
Lot A2 — Uniformisation du feedback hors-ligne (HORS2, HORS3)

Objectif : informer l’utilisateur quand une action est mise en file, pour toutes les actions
couvertes.

Prérequis : Lot 0 (correction isOfflineQueuedError) effectué.

Actions :

    Utiliser isOfflineQueuedError dans les blocs catch des actions couvertes :

        Blessures (LocationPanel.handleBoxClick) : afficher un message « action en attente de
        synchronisation » au lieu de console.error.

        Achat de compétence (SkillsPanel.handleBuy) : même traitement.

        Mutations d’inventaire (InventoryPanel.handleMoveContainer, handleEquip, handleDelete,
        handleValidate, handleDropToContainer) : même traitement pour celles qui sont couvertes.

    Ajuster les libellés i18n (containerPanel.offlineQueued ou nouvelles clés spécifiques) pour une
    formulation cohérente.

Fichiers concernés : LocationPanel.jsx, SkillsPanel.jsx, InventoryPanel.jsx, fr.json.

Validation : tests manuels hors-ligne pour chaque action, vérification du message affiché.
Lot A3 — Mise à jour optimiste (HORS1)

Objectif : refléter immédiatement les modifications locales et réduire le risque de doublons.

Stratégie :

    Pour chaque action couverte (blessures, équipement, achat compétence), appliquer la modification
    localement avant l’appel réseau.

    En cas d’échec réseau (requête mise en file), conserver l’état local et afficher le feedback
    « en attente » (Lot A2).

    En cas d’échec serveur lors du rejeu (erreur HTTP 4xx/5xx), le service worker retire la requête ;
    le client n’en est pas notifié directement. Pour gérer ce cas, prévoir une réconciliation au
    prochain chargement de la fiche (rechargement serveur), qui écrasera l’état local.

    Pour éviter les doublons, désactiver le bouton ou la case immédiatement après la première action
    optimiste jusqu’à la résolution (succès réseau ou mise en file confirmée).

    Utiliser les stores existants (characterStore) pour refléter les changements.

Fichiers concernés : LocationPanel.jsx, SkillsPanel.jsx, InventoryPanel.jsx,
inventoryMutations.js, éventuellement useInventoryData.js.

Risque : complexité des rollbacks, interaction avec le store et les événements WS. À traiter
avec soin, avec tests unitaires.

Validation : tests unitaires sur les reducers/store, tests manuels hors-ligne et en ligne.
Lot B — Extension de la file d’inventaire (HORS4)

Objectif : couvrir l’ajout et la suppression d’objets hors-ligne pour une cohérence complète.

Actions :

    Ajouter des entrées runtimeCaching dans client/vite.config.js pour :

        POST /api/char-sheet/:characterId/inventory

        DELETE /api/char-sheet/:characterId/inventory/:itemId

    Utiliser les mêmes paramètres de file (NetworkOnly, backgroundSync, maxRetentionTime).

Note : les échecs au rejeu (ex. 404 si l’objet a été supprimé entre-temps) restent silencieux,
conformément à la décision « hors scope » déjà actée. Ce comportement est accepté et documenté.

Fichier concerné : client/vite.config.js.

Validation : tests manuels hors-ligne pour ajouter et supprimer des objets, puis rétablir le
réseau et vérifier le rejeu.
Lot C1 — Ajustements du cache (HORS6, HORS8)

Objectif : améliorer la fiabilité du cache sans chantier lourd.

Actions :

    Revoir networkTimeoutSeconds :

        Soit le retirer (bascule uniquement sur échec réseau), soit l’augmenter à une valeur plus
        raisonnable (ex. 10 s).

        Fichier concerné : client/vite.config.js.

    Augmenter maxEntries ou adopter une stratégie d’expiration plus granulaire (ex. cache séparé
    pour les catalogues et les fiches).

        Fichier concerné : client/vite.config.js.

Validation : tests de build et de comportement du service worker.
Lot C2 — Découpage du bundle (HORS7)

Objectif : réduire la taille du précache en lazy-loadant les parties lourdes (battlemap,
Three.js, etc.).

Actions :

    Identifier les modules les plus lourds et les mettre en chargement différé.

    Configurer Vite/Workbox pour ne précacher que les chunks essentiels à la fiche hors-ligne.

    Fichiers concernés : configuration Vite, App.jsx, composants lourds.

Note : chantier transverse, à planifier séparément. Ce lot peut être retiré de ce plan et
déplacé vers ROADMAP.md si Saar juge que ce n’est pas prioritaire.

Validation : tests de performance, vérification de la taille du précache.
Lot D — Divers (HORS9, HORS11, HORS12)

Objectif : finaliser les détails restants.

Actions :

    Icône PWA :

        Générer des PNG multi-tailles (192, 512) et les ajouter au manifest.

        Fichiers concernés : client/public/, client/vite.config.js.

    Statuer sur characterExportService.js :

        Décider de sa suppression ou de sa conservation, et appliquer.

        Fichier concerné : server/src/services/characterExportService.js.

    Support des exo-armures dans CampaignCharacterSheetPage :

        Ajouter le montage de ExoWindow pour character.type === 'exo'.

        Fichier concerné : client/src/pages/CampaignCharacterSheetPage.jsx.

Validation : tests manuels pour l’icône et la page exo.
3. Décisions à trancher avec Saar

    Mise à jour optimiste (Lot A3) : implémenter pour toutes les actions couvertes, ou seulement
    pour certaines ? Quelle stratégie de rollback privilégier ?

    Désactivation des champs non couverts (Lot A1) : griser les champs ou masquer les actions ?
    Faut-il un avertissement global « mode hors-ligne » ?

    Extension de la file d’inventaire (Lot B) : couvrir POST /inventory et
    DELETE /inventory/:id ?

    Ajustement du cache (Lot C1) : retirer ou augmenter networkTimeoutSeconds ? Augmenter
    maxEntries ?

    Découpage du bundle (Lot C2) : priorité immédiate ou dette à planifier dans ROADMAP.md ?

    Icône PWA (Lot D) : générer les PNG maintenant ou plus tard ?

    Sort de characterExportService.js (Lot D) : suppression immédiate, conservation provisoire,
    ou transformation ?

    Support exo (Lot D) : à ajouter maintenant ou à documenter comme limitation ?

4. Scénarios de test navigateur réel

Avant toute implémentation, exécuter les tests suivants sur la PWA actuelle :

    Chargement hors-ligne après visite :

        Visiter une fiche en ligne, couper le réseau, rafraîchir la page et vérifier l’affichage
        complet.

    Écriture hors-ligne pour chaque action couverte :

        Blessures : ajouter, stabiliser, supprimer ; vérifier l’absence de feedback et l’absence de
        changement visuel.

        Équipement : équiper/déséquiper ; vérifier le message « en attente ».

        Achat compétence : cliquer sur acheter ; vérifier l’absence de feedback.

    Écriture hors-ligne pour des actions non couvertes :

        Modifier un champ d’identité ou d’attribut ; vérifier que la modification locale est possible
        mais non persistée.

    Rejeu au retour réseau :

        Rétablir le réseau, attendre quelques secondes, recharger la fiche et vérifier que les actions
        en file ont été appliquées (ou échouées silencieusement).

    Cas « serveur down mais navigateur en ligne » :

        Simuler une coupure du serveur sans passer en mode hors-ligne navigateur, effectuer une action,
        vérifier le feedback actuel et la mise en file.

    Vue d’impression :

        Ouvrir /characters/:id/print, vérifier le thème clair, la disposition en deux colonnes, les
        couleurs de sévérité, lancer l’impression.

    Route standalone campagne :

        Ouvrir /campaigns/:id/characters/:id/sheet, vérifier l’édition et les rôles (MJ vs joueur).

    Personnages particuliers :

        Tester avec un personnage de Coffre, un drone, une exo-armure.

5. Mise à jour de la documentation

Chaque lot, une fois implémenté, doit s’accompagner d’une mise à jour de
docs/SYSTEME/FICHE_HORSLIGNE.md et de l’INDEX.md si nécessaire :

    Ajouter/retirer les pièges HORS* concernés.

    Mettre à jour les tableaux de routes couvertes/non couvertes.

    Documenter les nouvelles stratégies (mise à jour optimiste, feedback, désactivation).

    Mettre à jour la date et le statut du document.

6. Points hors scope

    Réimport du fichier édité dans Enclume.

    Synchronisation live depuis la page HTML exportée.

    Reprise sur erreur / réconciliation multi-appareil.

    Découpage complet du bundle (sauf décision contraire en Lot C2).

7. Prochaine étape

Après validation des décisions §3, commencer par le Lot 0 (préalables), puis enchaîner dans
l’ordre : A1 → A2 → A3 → B → C1 → D (C2 selon priorité). Chaque lot fera l’objet d’une validation proportionnée avant de passer au suivant.
