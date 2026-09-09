# PLAN_INFORMATIQUE.md — (stub, à rédiger)

Lire `@docs/REGLES/REGLE_ORDINATEUR.md` (RAW ordinateurs) pour rédiger le plan.

## Périmètre — décidé 2026-09-09 (Saar)

Un seul chantier « informatique complet », qui **fusionne** deux entrées ROADMAP jusque-là séparées :
- **Capacités des ordinateurs** : génération (Gén. I → X), gestion systèmes, potentiel, niveau max des
  programmes — RAW `REGLE_ORDINATEUR.md`. (Ex-ligne ROADMAP « Informatique et pannes (systèmes
  électroniques exo) ».)
- **Pannes des systèmes électroniques et attaques IEM** : une attaque IEM soumet automatiquement les
  appareils électroniques portés à un Test de panne (RAW). (Ex-bullet ROADMAP §4 « Mécanique IEM ».)

## Dépendance

- **Chantier Usure & Intégrité** (`@docs/MANUELS/MANUEL_USURE.md`) : fournit la primitive de test de
  panne sur un objet (`MANUEL_USURE.md` §4) et le flag catalogue. Ce chantier-ci ajoute `is_electronic`
  à `ref_equipment`, la mécanisation de `FX=IEM` (aujourd'hui jetée par `weaponAmmoDsl.js`, retour
  `null`), la primitive « énumérer les objets `is_electronic` portés », et la ou les sources d'attaque IEM.
- Voir aussi `@docs/MANUELS/MANUEL_USURE.md` §13 (dépendances d'implémentation) et §8 (l'entrée #8
  « Panne d'un système » de la table Catastrophe combat consommera la même primitive).

## État actuel (2026-09-09)

- `REGLE_ORDINATEUR.md` : RAW transcrite, aucun code dédié.
- Munitions IEM présentes au catalogue (`FX=IEM(TEST_PANNE:-1/2D10_ARME)`) mais non mécanisées —
  le modèle du seed contredit le RAW (« Test de panne »), à corriger au cadrage.
