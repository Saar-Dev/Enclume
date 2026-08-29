# Maquette de référence — fenêtres de déclaration de combat

> Subordonné à [`../PLAN_RW_DECLARE_DESIGN.md`](../PLAN_RW_DECLARE_DESIGN.md). Aucune décision ici ;
> ce dossier **matérialise dans le dépôt** la maquette qui ne vivait que dans un artifact claude.ai
> externe (leçon §11 du plan + mémoire `feedback_design_maquette_in_repo`). Archivé avec le plan à
> sa clôture.

## Contenu

| Fichier | Rôle |
|---|---|
| `preview.html` | **Rendu statique navigable des 4 artboards** — ouvrir dans un navigateur. Glyphes pointés sur `client/public/assets/status/`. |
| `Main.dc.html` | Artboard PJ / MJ-PNJ (accent vert `#50c878`). Source des valeurs : styles inline + bloc `<style>`. |
| `Drone.dc.html` | Artboard Drone (accent teal `#33b0b0`, **sans satellite**). |
| `Exo.dc.html` | Artboard Exo (accent violet `#9d63cc`, satellite « Nouveau »). |
| `Anatomie.dc.html` | Spec annotée v5 : deux colonnes, glyphes, satellite, silhouette, fond PCB, pied, variations par famille. |
| `pcb.svg` | Motif de circuit (fond des bandeaux — D14). 150×150, `stroke #5a8aaa`, `opacity .11`. |
| `canvas.json` | Disposition des artboards sur le canvas de design (métadonnée, sans valeur d'implémentation). |

Origine : artifacts `3b8fb52d-aa6c-4905-a0d1-d6712c8c44d7` (maquette « look », 4 artboards) et
`afcd5e28-341b-40ee-b109-30e69d9597fc` (prototype d'interaction « L'arme est l'action »), tous deux
extraits le 2026-08-29.

## Autorité de la maquette — ce qu'elle fixe et ce qu'elle ne fixe pas

**Fait autorité** : structure des 3 fenêtres (satellite │ fenêtre, header, move-line, 2 colonnes,
roster, pied), disposition, hiérarchie, glyphes (masque CSS recoloré à l'accent), motif PCB confiné
aux bandeaux, anatomie du pied (pastille INI + statut centré + Passer + Déclarer).

**Ne fait PAS autorité** :

- **Grounds / palette de fond** : les `.dc.html` sont en palette HUD sombre (`--bg #0d0f18`,
  `.win` gradient `#0f1420→#0b0d15`). §11 du plan a tranché **après** pour la **teinte Wizard**
  (`--decl-bg #0a1524`, chrome cyan `#2FD7FF`), extraite dans `client/src/index.css` (`[data-decl]`).
  La palette d'implémentation = `index.css`, pas la maquette.
- **Accents drone / exo** : maquette `drone #33b0b0` / `exo #9d63cc` ; `index.css` et le plan (D3)
  retiennent `drone #30aaaa` / `exo #9858c8`. Suivre `index.css`.
- **Glyphes SVG** : les copies embarquées dans l'artifact `3b8fb52d` sont ré-encodées base64 par le
  canvas de design. Les originaux (Inkscape, produits par Saar — D10) sont dans
  `client/public/assets/status/` et **font seuls autorité**.
- Le geste d'interaction D5 (« l'arme EST l'action ») : voir le prototype `afcd5e28`, résumé dans le
  plan §3 (P1-P8) et §5.9 (module 4).
