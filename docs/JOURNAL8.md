# JOURNAL8 — Décisions et validations durables

> Rôle du fichier (CLAUDE.md §10) : conserve les décisions et validations durables de chaque session
> close, pas les notes de réflexion. Chaque entrée = un bloc `## Session N (Dev) — Date — Titre`,
> clôturé par **Testé / Non testé / Données / Retour arrière**. Ne jamais dupliquer ce contenu dans
> `docs/EN_COURS.md` : ce dernier retire l'entrée de ses sections actives dès qu'un chantier est clos
> et journalisé ici.
>
> Suite de `docs/Old/JOURNAL7.md` (archivé le 2026-08-01 après fusion avec l'historique accumulé dans
> `EN_COURS.md`). Dernière entrée du fichier précédent : Session 192 (Saar) — `PLAN_TEST_CRITIQUE.md`
> Lot 2.

---

## Session (Saar) — 2026-08-04 — Réorganisation documentaire + TEST_CRITIQUE Lot 3

**Réorganisation documentaire** : `docs/` restructuré (fichiers déplacés vers `REGLES/`, `SYSTEME/`,
`MANUELS/`, `PLANS/`, `REFACTOR/`, `Old/`), committé tel quel sur demande de Saar (commit `4f3027e`,
`docs/` uniquement — `Sidebar.jsx`/`surfaceData.js` déjà modifiés dans le worktree laissés hors
périmètre de ce commit).

**TEST_CRITIQUE Lot 3** (tooltips degré RAW + popup Réussite critique/Catastrophe) — détail complet
dans `docs/Old/PLAN_TEST_CRITIQUE.md` §11 (archivé — Règle 10, contenu durable transféré vers
`docs/SYSTEME/COMBAT.md` §"Résolution des Tests"). Résumé : `getMrDegreeKey` (nouvelle autorité,
`shared/polarisTestResolution.js`) + tooltips `title=` sur les badges de résultat (`Sidebar.jsx`) ;
popup plein écran texte seul sur Réussite critique/Catastrophe (`CriticalEffectOverlay.jsx`, déclenché
via `sessionStore.js`/`useSessionSocket.js`), architecture séparant déclenchement et rendu pour un futur
vrai effet visuel. Trouvaille corrigée au passage : `cardType` jamais forwardé par `onDiceResult`
malgré une lecture déjà existante côté `Sidebar.jsx` (dead code silencieux préexistant).

**Testé** : `node --test shared/polarisTestResolution.test.mjs` (20/20), `eslint` propre sur les 5
fichiers client touchés, `vite build` complet sans erreur.
**Non testé** : scénario réel en navigateur (tooltip au survol, popup Réussite critique/Catastrophe) —
à la charge de Saar.
**Données** : aucune migration.
**Retour arrière** : additif, rien committé cette session sur ce chantier — `git diff`/`git checkout`
suffisent.
