// DataTableBlock.jsx — Bloc tableau, deux schémas distincts.
//
// 1. Sourcé depuis shared/ (block.source défini) — whitelist dataSources.js.
//    - En-têtes optionnels (block.headers) : tableau de lignes, chaque cellule
//      est { label, colspan?, rowspan? } — permet les regroupements à 2 niveaux
//      (ex. Lente > Hum./TH/Hyb.).
//    - Corps : resolved.rows, chaque ligne porte son propre `kinds` (tableau
//      parallèle aux cellules). Une cellule est une string, ou un objet
//      { label, colspan? } pour les fusions horizontales.
//    - Source inconnue → encadré d'erreur visible (dev).
//
// 2. Éditorial pur (block.columns + block.rows, pas de source) — table
//    narrative sans valeur de règle moteur (ex. jet 1D100 « Incidents
//    Polaris ») : ENCYCLOPEDIA_CONVERSION.md §3 avait déjà tranché que
//    dataTable sert de placeholder pour ce cas, jamais implémenté avant
//    2026-09-22 (8 tables silencieusement invisibles, trouvé en auditant
//    Force Polaris — block.source absent, l'ancien code retournait null).
//    - block.columns : [{ key, label }], toujours rendu en <thead> (pas de
//      variante « headers optionnels » ici, contrairement au schéma sourcé).
//    - block.rows : [{ [key]: string, subItems?: string[] }] — subItems
//      (jet secondaire imbriqué, ex. la ligne « 100 et + » d'Incidents
//      Polaris) rendu en sous-liste sur une ligne pleine largeur dédiée.
//
// Le `caption` (champ du bloc) reste le titre éditorial du tableau, commun
// aux deux schémas.

import { Fragment } from 'react'
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

// Table éditoriale littérale : block.columns + block.rows, aucune source shared/.
function EditorialDataTable({ block }) {
  const { caption, columns, rows } = block

  return (
    <div className="encyclo-datatable">
      {caption && (
        <div className="encyclo-datatable-caption">{caption}</div>
      )}
      <table className="encyclo-datatable-table">
        <thead className="encyclo-datatable-head">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="encyclo-datatable-header-cell">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Fragment key={i}>
              <tr>
                {columns.map((col, j) => (
                  <td
                    key={col.key}
                    className={`encyclo-datatable-cell${j === 0 ? ' encyclo-datatable-cell-range' : ''}`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
              {row.subItems && (
                <tr>
                  <td colSpan={columns.length} className="encyclo-datatable-cell encyclo-datatable-subitems">
                    <ul>
                      {row.subItems.map((item, j) => <li key={j}>{item}</li>)}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataTableBlock({ block }) {
  if (block.columns && block.rows) {
    return <EditorialDataTable block={block} />
  }

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