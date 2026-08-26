> **Corrigé (audit 2026-08-26) — orphelin trouvé, pas archivé** : le chantier PWA/hors-ligne
> qu'il décrit est **abandonné** (décision Saar, 2026-08-23, `docs/ROADMAP.md` §4) — remplacé par un
> besoin d'export Google Sheets, pas encore cadré. Les plans associés
> (`docs/Old/PLAN_FICHE_HORSLIGNE.md`, `docs/Old/PLAN_RW_EXPORT.md`) ont été archivés dans cette même
> session ; ce document SYSTEME était resté orphelin, jamais mis à jour ni archivé, décrivant la PWA
> comme une architecture active. **Le code n'a pas été retiré** (`vite-plugin-pwa` toujours présent,
> `client/vite.config.js`) — seule la vue d'impression (Lot D) a été testée fonctionnelle en
> navigateur (Saar, 2026-08-16) et reste réellement utilisée ; le reste (mode hors-ligne effectif,
> rejeu réseau via `workbox-background-sync`) n'a jamais été validé et ne le sera pas dans ce cadre.
> Ce document reste donc une référence technique valide pour la vue d'impression, mais **pas** pour
> le reste — ne pas le lire comme "chantier actif".

# FICHE_HORSLIGNE.md — Documentation technique de la fiche personnage hors-ligne (PWA) et de l'impression

    Domaine : Fiche personnage Polaris — consultation et modification hors connexion
    Dernière mise à jour : 2026-08-16 — Clôture des lots A/B0/B/C/D du plan docs/PLANS/PLAN_FICHE_HORSLIGNE.md
    Statut : **Abandonné (2026-08-23), sauf vue d'impression (Lot D) toujours active** — voir banner ci-dessus

Sommaire

    Contexte et périmètre

    Architecture technique

    Fichiers impliqués

    Routes API concernées

    Flux de données hors-ligne

    Comportement détaillé par action

    Autorisations et sécurité

    Vue d’impression

    Pièges et points de vigilance

    Décisions actées et points ouverts

1. Contexte et périmètre
Objectif

Permettre à un joueur de consulter et modifier sa fiche personnage hors connexion, avec persistance locale et synchronisation différée au retour du réseau. La fonctionnalité s’appuie sur la transformation d’Enclume en application installable (PWA) et sur une vue d’impression dédiée.
Historique des approches

    Export Excel : abandonné pour défauts structurels du format (styles détruits par SheetJS, commentaires non supportés par xlsx-populate, fonctions modernes mal encodées, cases à cocher Google Sheets non traduisibles, case colorée et cliquable mutuellement exclusives sous Excel/LibreOffice).

    Fiche HTML autonome : abandonnée car une page web ne peut pas réécrire son propre fichier à la fermeture sans l’API File System Access, limitée à Chrome/Edge (absente de Firefox/Safari).

    Décision finale : PWA intégrée au client existant. Aucune réimplémentation de la fiche ; la logique métier existante (CharacterSheet.jsx, panneaux associés) reste la source unique.

Périmètre fonctionnel

Lecture hors-ligne : toutes les sections de la fiche déjà visitées en ligne sont disponibles hors-ligne (identité, attributs, compétences, avantages, blessures, inventaire, jauges).

Écriture hors-ligne : limitée aux actions suivantes (mises en file) :

    Cocher/décocher une blessure (ajout, stabilisation, suppression) ;

    Modifier un objet d’inventaire via PUT /inventory/:itemId : équipement/déséquipement (armes/armures), changement de conteneur, modification de quantité, validation GM, etc. ;

    Acheter une compétence en mode Progression.

Actions non couvertes : modification d’identité, d’archétype, d’attributs, de Chance, de XP direct, suppression/ajout d’inventaire, modification directe des maîtrises par le GM. Toutes les autres routes d’écriture non listées dans la section 4 ne sont pas couvertes.

Impression : vue complète de la fiche, lecture seule, via /characters/:characterId/print.
Précondition

Le mode hors-ligne ne fonctionne qu’après une première visite en ligne de la fiche sur l’appareil concerné — un service worker ne peut mettre en cache que ce qu’il a vu passer.
2. Architecture technique
Vue d’ensemble

    PWA ajoutée au client Vite via vite-plugin-pwa.

    Service worker généré par Workbox, avec :

        Précache du index.html et des assets statiques (bundle client complet).

        navigateFallback: '/index.html' pour les navigations directes hors-ligne.

        Cache de lecture NetworkFirst pour les API de la fiche.

        File d’écriture hors-ligne backgroundSync pour 5 routes.

    Vue d’impression : route dédiée + composant CharacterPrintView assemblant les panneaux existants en lecture seule.

Configuration Workbox (extraits pertinents)

    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 (5 Mo) — le bundle complet (~4 Mo) dépasse la limite par défaut de Workbox (2 Mo).

    registerType: 'autoUpdate'

    devOptions.enabled: true

3. Fichiers impliqués
Configuration PWA
Fichier	Rôle
client/vite.config.js	Configuration vite-plugin-pwa : manifest, cache, file, navigateFallback
Routes client
Fichier	Rôle
client/src/App.jsx	Enregistrement des routes /campaigns/:campaignId/characters/:characterId/sheet et /characters/:characterId/print
client/src/pages/CampaignCharacterSheetPage.jsx	Page fiche campagne hors session VTT
client/src/pages/CharacterPrintPage.jsx	Page impression, bouton Imprimer
client/src/character/CharacterPrintView.jsx	Vue d’impression composée
Composants / utilitaires modifiés pour le hors-ligne
Fichier	Rôle
client/src/lib/api.js	Instance axios + isOfflineQueuedError()
client/src/character/LocationPanel.jsx	Utilise isOfflineQueuedError pour l’équipement ; ajout --severity-bg pour la vue d’impression
Composants réutilisés sans modification
Fichier	Rôle
client/src/character/CharacterSheet.jsx	Fiche principale (Modules 1–6 + XP)
client/src/character/SkillsPanel.jsx	Module compétences (achat XP)
client/src/character/ArmorWoundPanel.jsx	Onglet Matériel (armures/blessures)
client/src/character/InventoryPanel.jsx	Inventaire, catalogue GM
client/src/character/WeaponPanel.jsx	Armes équipées
client/src/character/GaugesPanel.jsx	Jauges de matériel
client/src/lib/useInventoryData.js	Hook store inventaire
client/src/lib/inventoryMutations.js	Primitives de mutation d’inventaire
Services serveur concernés
Fichier	Rôle
server/src/routes/character/char-sheet.js	Routes API de la fiche, blessures, inventaire, compétences
server/src/services/inventoryService.js	Couche DB pure pour l’inventaire
server/src/services/characterExportService.js	Service orphelin, non utilisé par la PWA (laissé intact actuellement)
4. Routes API concernées
Routes de lecture mises en cache

Pattern : /api/(char-sheet|char-ref|equipment|campaigns|characters) avec NetworkFirst.
Méthode	Route	Utilisée par
GET	/api/char-sheet/:characterId	CharacterSheet.jsx, CampaignCharacterSheetPage.jsx, CharacterPrintView.jsx
GET	/api/char-sheet/:characterId/advantages	CharacterSheet.jsx
GET	/api/char-sheet/:characterId/wounds	ArmorWoundPanel.jsx
GET	/api/char-sheet/:characterId/inventory	useInventoryData.js
GET	/api/char-sheet/:characterId/mutations	CharacterSheet.jsx / AdvantagesPanel.jsx
GET	/api/char-sheet/:characterId/mutation-effects	CharacterSheet.jsx
GET	/api/char-sheet/:characterId/gauges	GaugesPanel.jsx
GET	/api/char-ref/genotypes	CharacterSheet.jsx
GET	/api/char-ref/skills	CharacterSheet.jsx
GET	/api/equipment	InventoryPanel.jsx (catalogue)
Routes d’écriture mises en file (backgroundSync)
Méthode	Route	Nom de file	Déclencheur
POST	/api/char-sheet/:characterId/wounds	enclume-wounds-add	Clic sur case blessure vide
PUT	/api/char-sheet/:characterId/wounds/:woundId/stabilize	enclume-wounds-stabilize	Clic sur blessure active
DELETE	/api/char-sheet/:characterId/wounds/:woundId	enclume-wounds-remove	Clic sur blessure stabilisée
PUT	/api/char-sheet/:characterId/inventory/:itemId	enclume-equip	Toute modification d’un item : équipement/déséquipement, conteneur, quantité, validation GM, etc.
POST	/api/char-sheet/:characterId/skills/buy	enclume-skill-buy	Achat en mode Progression
Routes d’écriture NON couvertes
Méthode	Route	Conséquence hors-ligne
PUT	/api/char-sheet/:characterId/identity	Échec silencieux, modification locale perdue
PUT	/api/char-sheet/:characterId/archetype	Idem
PUT	/api/char-sheet/:characterId/attributes	Idem
PUT	/api/char-sheet/:characterId/chc	Idem
PUT	/api/char-sheet/:characterId/xp	Idem
PUT	/api/char-sheet/:characterId/skills	Idem (édition GM directe)
PUT	/api/char-sheet/:characterId/sols	Idem
POST	/api/char-sheet/:characterId/inventory	Ajout d’objet impossible
DELETE	/api/char-sheet/:characterId/inventory/:itemId	Suppression impossible
POST	/api/char-sheet/:characterId/attributes/buy	Achat d’attribut impossible
POST	/api/char-sheet/:characterId/quick-equip	Équipement rapide GM impossible
POST/DELETE	/api/char-sheet/:characterId/advantages	Ajout/suppression avantage impossible
POST/DELETE	/api/char-sheet/:characterId/mutations	Ajout/suppression mutation impossible

    Note : toute route d’écriture non présente dans le tableau « Routes d’écriture mises en file » n’est pas couverte par backgroundSync et échouera silencieusement hors-ligne.

5. Flux de données hors-ligne
Chargement initial en ligne

    L’utilisateur visite la fiche (CampaignCharacterSheetPage ou via session VTT).

    Les appels API de lecture passent par le service worker.

    Avec NetworkFirst, les réponses sont stockées dans le cache enclume-character-api.

    Le cache expire après 30 jours ou 200 entrées maximum.

Passage hors-ligne

    Les navigations SPA directes sont servies par index.html (navigateFallback).

    Les appels API de lecture sont servis depuis le cache si le réseau échoue.

    Note : avec networkTimeoutSeconds: 3, Workbox bascule aussi sur le cache si le réseau est lent (> 3 s), même s’il n’est pas coupé.

Actions hors-ligne (écritures)

    L’utilisateur clique (blessure, équipement, achat compétence).

    La requête est envoyée ; Workbox tente le réseau (NetworkOnly).

    En cas d’échec réseau, la requête est stockée en IndexedDB dans la file correspondante.

    Aucune mise à jour optimiste n’est effectuée : l’état local du composant reste inchangé.

    Un feedback n’est présent que pour l’équipement via isOfflineQueuedError dans LocationPanel (message « action en attente »). Les autres actions échouent silencieusement (console.error).

Retour en ligne et rejeu

    Lorsque le réseau revient, Workbox rejoue les requêtes en FIFO par file.

    Le dernier écrit gagne (pas de fusion, pas de détection de conflit).

    Les réponses du serveur (y compris les erreurs) sont consommées par Workbox ; une erreur HTTP (4xx/5xx) retire la requête de la file sans notification utilisateur.

    Aucun rechargement automatique de la fiche après rejeu : l’utilisateur doit rafraîchir pour voir les données synchronisées.

6. Comportement détaillé par action
Blessures
Action	Endpoint	File	Mise à jour locale	Feedback
Ajouter	POST /wounds	Oui	Non	Non
Stabiliser	PUT /wounds/:id/stabilize	Oui	Non	Non
Supprimer	DELETE /wounds/:id	Oui	Non	Non

Après l’action, LocationPanel.handleBoxClick appelle onWoundsReload(), qui effectue un GET /wounds. Hors-ligne, ce GET est servi depuis le cache (donc aucune nouvelle blessure affichée).
Équipement (armures/armes)
Action	Endpoint	File	Mise à jour locale	Feedback
Équiper/déséquiper	PUT /inventory/:itemId	Oui	Non	Oui (message offlineQueued si hors-ligne)

LocationPanel.handleEquip/handleUnequip utilise isOfflineQueuedError pour distinguer un échec réseau hors-ligne d’une erreur serveur.
Achat de compétence
Action	Endpoint	File	Mise à jour locale	Feedback
Acheter	POST /skills/buy	Oui	Non	Non

Aucune mise à jour optimiste de charSkills ou de xpAvailable ; le bouton redevient actif après l’échec, permettant de multiplier les mises en file.
Mutations d’inventaire
Action	Endpoint	File	Mise à jour locale	Feedback
Changer de conteneur	PUT /inventory/:itemId	Oui	Non	Non
Valider (GM)	PUT /inventory/:itemId	Oui	Non	Non
Ajouter un objet	POST /inventory	Non	Non	Non
Supprimer un objet	DELETE /inventory/:itemId	Non	Non	Non
7. Autorisations et sécurité
Middleware serveur

    router.param('characterId') assure l’authentification et l’ownership (propriétaire ou GM).

    Pour un personnage de Coffre, l’accès est réservé au propriétaire (isVaultOwner).

    Pour un personnage de campagne, l’accès requiert l’appartenance à la campagne et détermine req.isGm.

Contrôles au rejeu

    Les requêtes mises en file sont rejouées avec les mêmes contrôles serveur que si elles étaient envoyées en ligne.

    Une requête non autorisée (ex. tentative de modification d’attributs par un joueur) sera refusée par le serveur (403), et retirée de la file silencieusement.

    Aucune autorisation n’est vérifiée côté client hors-ligne : l’UI affiche les contrôles comme si l’utilisateur était en ligne, mais le serveur reste l’autorité.

isOfflineQueuedError
js

export function isOfflineQueuedError(error) {
  return !error.response && !navigator.onLine
}

    Retourne true si l’erreur n’a pas de réponse serveur et que le navigateur est hors-ligne.

    Limite : si le serveur est injoignable (serveur down) alors que le navigateur est en ligne (navigator.onLine === true), la requête est tout de même mise en file par Workbox, mais isOfflineQueuedError retourne false (puisque navigator.onLine est true). Ce cas n’est donc pas signalé comme « mis en file » et sera traité comme une erreur générique par l’appelant.

8. Vue d’impression
Route et composants

    /characters/:characterId/print → CharacterPrintPage.jsx

    CharacterPrintView.jsx assemble :

        CharacterSheet (onglet Fiche)

        ArmorWoundPanel, WeaponPanel, InventoryPanel, GaugesPanel (onglet Matériel)

    Aucun DndContext réel ; un DndContext sans capteurs est fourni pour satisfaire les hooks dnd-kit des panneaux réutilisés.

Lecture seule

    isGm={false} et isOwner={false} sont passés en props à CharacterSheet et aux panneaux.

    canEdit vaut donc false partout.

Styles d’impression

    Classe .print-white-theme appliquée à la racine de la vue.

    @media print force fond blanc / texte noir, masque le bouton Imprimer.

    Les couleurs de sévérité des blessures sont préservées via --severity-bg et la classe wound-severity-color.

9. Pièges et points de vigilance

HORS1 — Absence généralisée de mise à jour optimiste : toutes les actions hors-ligne laissent l’UI inchangée jusqu’au rejeu, donnant l’impression que l’action a échoué.

HORS2 — Feedback incohérent : seul l’équipement via LocationPanel affiche un message hors-ligne. Blessures, achat de compétence, et mutations d’inventaire restent silencieux.

HORS3 — Risque de doublons : sans feedback, l’utilisateur peut cliquer plusieurs fois sur une blessure ou un achat, générant plusieurs requêtes en file.

HORS4 — Couverture partielle de l’inventaire : PUT /inventory/:itemId est couvert, mais POST /inventory et DELETE /inventory/:itemId ne le sont pas. L’utilisateur peut modifier un objet existant, mais pas en créer ni en supprimer.

HORS5 — Champs non couverts actifs hors-ligne : identité, archétype, attributs, Chance, XP restent éditables hors-ligne alors que leurs sauvegardes ne sont pas mises en file. L’utilisateur peut croire à tort que ses modifications sont persistées.

HORS6 — networkTimeoutSeconds: 3 : avec NetworkFirst, un réseau lent (>3 s) peut déclencher le basculement sur le cache alors qu’une réponse fraîche est en route. Contredit l’intention « cache seulement si le réseau échoue ».

HORS7 — Bundle complet précaché (~4 Mo) : la limite Workbox a été relevée à 5 Mo. Le découpage du bundle (code-splitting) reste une dette.

HORS8 — maxEntries: 200 : le cache de lecture peut évincer des données nécessaires si l’utilisateur consulte plusieurs fiches ou catalogues.

HORS9 — Icône PWA : seul favicon.svg est utilisé, sans PNG multi-tailles. Certaines plateformes peuvent refuser l’installation.

HORS10 — isOfflineQueuedError ne couvre pas le cas « serveur down mais navigateur en ligne ». Une requête mise en file dans ce cas ne sera pas signalée correctement à l’utilisateur.

HORS11 — characterExportService.js est orphelin : non utilisé par la PWA, mais toujours présent dans le dépôt. Son statut est à trancher.

HORS12 — CampaignCharacterSheetPage ne supporte pas les exo-armures (placeholder). Un MJ consultant une exo hors session ne peut pas l’éditer.
10. Décisions actées et points ouverts
Décisions actées (plan PLAN_FICHE_HORSLIGNE.md)

    Dernier arrivé écrase : rejeu FIFO, pas de fusion ni détection de conflit.

    Pas de reprise sur erreur ni de réconciliation multi-appareil.

    Première visite en ligne obligatoire.

    Pas d’autorisation hors-ligne côté client ; le serveur garde ses contrôles au rejeu.

    Échec au retour réseau (rejeu d’une action invalide, purge locale, divergence) : hors scope.

Points ouverts

    Sort de characterExportService.js (suppression, conservation, transformation).

    Mise à jour optimiste : faut-il l’implémenter pour les actions couvertes ?

    Désactivation des champs non couverts hors-ligne.

    Unification du feedback hors-ligne.

    Ajustement de networkTimeoutSeconds.

    Extension de la file à POST /inventory et DELETE /inventory/:id.

    Ajout d’icônes PNG multi-tailles.

    Support des exo-armures dans CampaignCharacterSheetPage.

    Tester en navigateur réel : couper le réseau, agir, rétablir, confirmer le rejeu effectif et le rendu de la vue d’impression.