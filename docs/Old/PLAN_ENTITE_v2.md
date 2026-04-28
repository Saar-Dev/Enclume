SPÉCIFICATION MOTEUR FORMELLE : MOUVEMENT & RÉACTIVITÉ (9E)
I. RÉACTIVITÉ ET SYNC (BUG S34-1)
1.1. Guard d'Obsolescence Temporelle

    Donnée d'entrée : updated_at (timestamp ISO ou ms).

    Règle : Toute mutation de l'état local via un flux entrant (WebSocket) doit être validée par :

        Acceptation⟺Server_ts≥(Local_ts−50ms)

    Objectif : Éviter les rollbacks visuels dus aux légers décalages de précision entre client et base de données.

1.2. Invalidation du Cache de Matériaux

    Contexte : Canvas3D (Rendu).

    Dépendance de rendu : Le dictionnaire entityTextureMaterials doit être recalculé si :

        Δ{blueprint_ids}=∅ (Nouveau type d'entité).

        Δ{current_state_id}=∅ (Changement d'état visuel d'une entité existante).

    Mécanique : Une clé de hachage (ou concaténation) des états doit être surveillée par le cycle de rendu.

II. TABLE DE RÉSOLUTION POLARIS (MOUVEMENT)

Le potentiel de mouvement (Dmax​) est extrait du Modificateur issu de la Marge de Réussite (MR).
Marge de Réussite (MR)	Modificateur (Dmax​)
Échec (MR < 0)	0 (Fin de tour)
0 – 4	1 case
5 – 9	2 cases
10 – 14	3 cases
15 – 24	4 cases
25+	5 cases

    Exception "Tirer" (Pull) : Si l'action est déclarée comme "Tirer", Dmax​ est forcé à 1, quelle que soit la MR (si réussite).

III. GÉOMÉTRIE ET TRANSACTIONS (SERVEUR)
3.1. Référentiel Spatial (PE14)

    Axe X : Horizontal.

    Axe Y : Altitude (Altitude visuelle dans Three.js).

    Axe Z : Profondeur (Profondeur visuelle dans Three.js).

    Note : Dans la base de données, pos_y correspond à la profondeur et pos_z à l'altitude.

3.2. Validation de l'Alignement (8 Axes)

Le mouvement n'est autorisé que si le vecteur V=Target−Start respecte :

    ∣Vx​∣=0 OU ∣Vz​∣=0 (Orthogonal).

    ∣Vx​∣=∣Vz​∣ (Diagonal à 45°).

3.3. Algorithme de Step (Transaction Atomique)

Pour chaque pas k de 1 à Dmax​ :

    Vérification Diagonale (D&D) :

        Si le pas est diagonal vers (x+1,z+1), vérifier les cases (x+1,z) et (x,z+1).

        Bloqueˊ⟺CaseA​.occupied=True AND CaseB​.occupied=True.

    Vérification de Collision :

        Pousser : La case cible de l'Entité doit être null (vide). L'Acteur prend la place libérée par l'Entité.

        Tirer : La case cible de l'Acteur doit être null (vide). L'Entité prend la place libérée par l'Acteur.

    Tunnel de Swap :

        Lors du test de collision pour un pas k, l'Acteur et l'Entité mutée sont mutuellement exclus du calcul de collision (ils peuvent se "traverser").

    Adjacence Critique :

        Après chaque pas k, la distance de Tchebychev entre l'Acteur et l'Entité doit être égale à 1. Si >1 (rupture physique), arrêt immédiat à k−1.

IV. INTERFACE ET LOGIQUE CLIENT (UX)
4.1. L'Aimantage (Option B)

Le client doit "snapper" le Ghost sur l'axe le plus proche de la souris.

    Seuil de décision : Utiliser un ratio de 2:1 sur les composantes du vecteur souris pour distinguer un désir de mouvement orthogonal d'un mouvement diagonal.

4.2. Animation (Lerp)

    Durée : 300ms (Constante T).

    Synchronisation : Les positions visuelles de l'Acteur et de l'Entité doivent être interpolées simultanément de Posinitial​ vers Posfinal​ renvoyé par le serveur.

V. CONCURRENCE ET LOCKS

    Lock SQL : Au début de la transaction, l'entité reçoit un flag is_moving = true.

    Exclusion : Toute demande de mouvement sur une entité déjà sous is_moving renvoie une erreur WebSocket.

    Libération : Le flag est remis à false après le broadcast de la position finale et la mise à jour de la carte de couverture (Cover Map).