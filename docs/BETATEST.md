# BETATEST.md — Scénarios à vérifier avec des beta-testeurs

> Responsabilité unique de ce document : lister les scénarios de validation qui exigent plusieurs
> clients connectés simultanément (Saar ne peut pas les reproduire seul) — à dérouler à la
> prochaine session de beta-test. Chaque entrée référence son ticket (`/admin/tickets`) pour le
> détail ; ne pas dupliquer le diagnostic ici (Règle 2/11, `docs/RegleDocumentaire.md`).
>
> Une fois un scénario validé (ou invalidé) : noter le résultat dans le ticket lié et dans
> `docs/JOURNAL8.md`, puis retirer l'entrée d'ici — ce fichier ne garde que ce qui reste à tester.

---

## Combat

### COMBAT-DAMAGE-WINDOW-WRONG-TARGET — file de dégâts multi-cibles
**Ajouté le** : 2026-10-03.
**Contexte** : correctif codé (`client/src/lib/combatDamageQueue.js`), vérifié par test unitaire pur
(8/8) et build client, mais jamais exercé en combat réel — nécessite un PJ tireur qui touche deux
PJ différents dans le même round (condition que Saar ne peut pas réunir seul).

**Scénario à dérouler :**
1. Mettre en place un combat avec un PJ tireur capable de toucher deux cibles PJ distinctes dans le
   même round (double armement, ou deux actions de Tir/CaC validées par le MJ).
2. Le tireur touche la cible A **et** la cible B au même round.
3. Il clique « Lancer » pour A, vérifie que les dégâts affichés correspondent bien à A, ferme la
   fenêtre.
4. Vérifier que la fenêtre suivante affiche bien la cible B (nom **et** formule de dégâts corrects),
   pas les restes de A.
5. Lancer les dégâts de B, fermer, vérifier que le Tour se termine normalement (rien ne reste
   bloqué en « Gestion des dégâts en cours »).

**Résultat attendu :** chaque fenêtre affiche la bonne cible avec ses propres dégâts ; le combat ne
se bloque jamais entre les deux résolutions.
