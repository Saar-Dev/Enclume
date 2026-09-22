// DataTableBlock.jsx — Bloc tableau sourcé depuis shared/.
//
// Résout la source via dataSources.js (whitelist statique), rend les lignes
// résolues.
//
// Structure :
//   - En-têtes optionnels (block.headers) : tableau de lignes, chaque cellule
//     est { label, colspan?, rowspan? } — permet les regroupements à 2 niveaux
//     (ex. Lente > Hum./TH/Hyb.).
//   - Corps : resolved.rows, chaque ligne porte son propre `kinds` (tableau
//     parallèle aux cellules). Une cellule est une string, ou un objet
//     { label, colspan? } pour les fusions horizontales.
//
// Le `caption` (champ du bloc) reste le titre éditorial du tableau.
// Source inconnue → encadré d'erreur visible (dev). Cohérent avec le
// traitement des types de blocs inconnus dans BlockRenderer.

import { getDataTableRows } from '../dataSources.js'
import BodySilhouetteSvg from '../../BodySilhouetteSvg.jsx'

// Silhouette miniature pour une cellule `kind: 'silhouette'` — même tracé que le picker interactif
// (AimedLocationPicker.jsx), lecture seule : la Localisation de la ligne est surlignée, le reste en
// gris neutre. Réutilise SilhouetteSvg/BodySilhouetteSvg (autorité unique du tracé anatomique, voir
// leur en-tête) plutôt que de redessiner un SVG pour l'Encyclopédie.
function SilhouetteCell({ location }) {
  return (
    <BodySilhouetteSvg
      fillFor={(loc) => loc === location ? 'var(--color-primary)' : 'var(--border-subtle)'}
      style={{ width: 22, height: 'auto' }}
    />
  )
}

export default function DataTableBlock({ block }) {
  if (!block.source) return null

  const resolved = getDataTableRows(block.source)

  if (!resolved) {
    return (
      <div className="encyclo-datatable-missing">
        Source inconnue : {block.source}
      </div>
    )
  }

  return (
    <div className="encyclo-datatable">
      {block.caption && (
        <div className="encyclo-datatable-caption">{block.caption}</div>
      )}
      <table className="encyclo-datatable-table">
        {block.headers && block.headers.length > 0 && (
          <thead className="encyclo-datatable-head">
            {block.headers.map((headerRow, i) => (
              <tr key={i}>
                {headerRow.map((cell, j) => (
                  <th
                    key={j}
                    className="encyclo-datatable-header-cell"
                    colSpan={cell.colspan || 1}
                    rowSpan={cell.rowspan || 1}
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {resolved.rows.map((row, i) => (
            <tr key={i}>
              {row.cells.map((cell, j) => {
                const kind = row.kinds[j]
                const label = typeof cell === 'object' && cell !== null ? cell.label : cell
                const colspan = typeof cell === 'object' && cell !== null ? (cell.colspan || 1) : 1
                return (
                  <td
                    key={j}
                    className={`encyclo-datatable-cell encyclo-datatable-cell-${kind}`}
                    colSpan={colspan}
                  >
                    {kind === 'silhouette' ? <SilhouetteCell location={label} /> : label}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}