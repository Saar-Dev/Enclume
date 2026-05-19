JOURNAL_ROADMAP.md — Mémoire Externe pour l'Intégration du Système de Combat
Dernière mise à jour : 2026-05-10 (Restauration complète V3)
Statut : EN COURS DE COLLECTE
Règle : Append-only (pas de suppression, uniquement fusion des doublons).
1. Contexte et Objectifs
Objectif principal : Intégrer un système de combat complet dans Enclume (VTT), en réutilisant le travail d'un développeur externe.
Alignement : Le code externe suit les règles Polaris (validé par Saar).
Format des données : BDD Enclume (SQL) alignée à 90-95% sur les tables Excel du dev externe.
2. Sources de Vérité
2.1 Code Externe (Analysé)
Fichier
Rôle / Points Clés
Statut
00_Config.gs
Configuration BDD (ID 12msJt...), Initiative V2, Onglets (Protections, Armes, etc.).
✅ Analysé
01_Routers.gs
Router HTTP (doGet), Endpoints JSON (sync_bdd), Paramètres URL (fid, mid).
✅ Analysé
02_Utils.gs
Helpers (getIdentity, _normKey_), Registre PNJ et Armes.
✅ Analysé
12_WebApp_Combat.gs
Logique métier (rechargement, contexte de combat, munitions, drones).
✅ Analysé
13_SyncBDD.gs
Sync BDD Centrale → Fiche individuelle. Mapping tables SQL validé.
✅ Analysé

2.2 Tables SQL Cruciales
-- Table char_weapons (Gestion des armes équipées)
CREATE TABLE char_weapons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES ref_equipment(id),
  skill_id UUID REFERENCES char_skills(id),
  ammo_id UUID REFERENCES ref_equipment(id),
  slot VARCHAR(10) NOT NULL,
  fire_mode VARCHAR(10),
  ammo_remaining INTEGER DEFAULT 0,
  ammo_max INTEGER,
  is_equipped BOOLEAN DEFAULT true
);


3. Fonctionnalités à Intégrer
ID
Fonctionnalité
Criticité
Statut
F1
Gestion des tours de combat (Initiative V2)
⭐⭐⭐⭐⭐
À intégrer
F7
Rechargement des armes (12_WebApp_Combat.gs)
⭐⭐⭐⭐⭐
À intégrer
F10
Registre des PNJ (Bestiaire)
⭐⭐⭐
Analysé

4. Zones d'Ombre et Doutes
Q2 : Synchronisation temps réel ? → Remplacer le polling Google Apps par Socket.io.
Q3 : Raycast 3D ? → À implémenter via Three.js (R3F) côté Enclume.
Q7 : Modes de tir (CC/RC/RL) → Stocker dans ref_equipment.fire_modes.
5. Pièges Critiques (Basé sur SYSTEME.md)
P51 : effectiveMalus = woundPenalty - encumbrancePenalty. Ne jamais cumuler les blessures de manière simple.
PE14 : Coordonnées pos_y/pos_z inversées vs Three.js.
PI8 : Utiliser des LIKE queries pour les slots d'inventaire (ex: 'Main%').
21. Registre des PNJ et Bestiaire (22_RegistryNPC.gs)
21.1 Architecture du Bestiaire
Sources : Onglet "Bestiaire" de la feuille MJ + Dossier "PNJs".
Catalogue : Chargé en cache (5 min TTL). Table Enclume suggérée : npc_templates.
Roster Actif : Les instances de PNJ en combat. Table Enclume suggérée : combat_entities.
-- Extension proposée pour combat_entities
ALTER TABLE combat_entities 
ADD COLUMN npc_template_id UUID REFERENCES npc_templates(id),
ADD COLUMN weapon_key VARCHAR(255),
ADD COLUMN weapon_name VARCHAR(255);


23. Moteur de Résolution (23_Combat_Resolution.gs)
23.1 Logique du Jet de Combat
Le "3D20" Polaris : Le système lance 3 dés (ou gère 3 étapes) : Réussite, Localisation, Dégâts/Effets.
Calcul du Seuil : Seuil Final = Compétence + Modificateurs (Portée, Visée) + effectiveMalus.
23.2 Automatisation des Malus
Multi-attaques :
2 attaques : flag active_multi_malus(-5).
3 attaques : flag active_multi_malus(-7).
Précipitation : +3 Init, mais malus de -5 sur le test de résolution (is_rushed).
Visualisation : Le VTT doit afficher chaque modificateur explicitement (ex: [Malus Multi-attaque : -5]).
23.3 Gestion de la Timeline
Expansion : Une déclaration d'attaques multiples crée automatiquement 3 slots : Init, Init-5, Init-10.
Butoir : Toute action tombant à 0 ou moins est reportée au tour suivant (priorité haute).
24. Révision Critique (ÉTAPE 1 - Fin)
1.15 Cibles et Déplacements
Ciblage : Interaction liée à un UUID de Token. Pas de coordonnées libres sans entité cible.
Ghost Token : Le "fantôme" représente l'intention de mouvement. Ses coordonnées {x,y,z} finales ne sont validées qu'à la résolution.
Non-Découplage : Le mouvement est lié au premier segment (Init). On ne peut pas bouger entre deux tirs d'une multi-attaque.
36. Historique des Ajouts
2026-05-10 : Analyse 00_Config à 13_SyncBDD.
2026-05-10 : Ajout Registry NPC (PNJ/Bestiaires) et Registry Players (Campagnes).
2026-05-10 : Ajout Moteur de Résolution 23_Combat_Resolution.gs (3D20, Malus Auto, Timeline).
2026-05-10 : Restauration complète V3 (1621+ lignes fusionnées).
