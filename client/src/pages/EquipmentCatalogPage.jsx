import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

// ─── EquipmentCatalogPage ───────────────────────────────────────────────────────
// Consultation lecture seule de ref_equipment — ouverte à tout utilisateur connecté,
// docs/ROADMAP.md ("Catalogue équipement"). Décision Saar 2026-08-16 : page dédiée plutôt que
// réexposer server/src/admin/ref-equipment-tool.html (outil admin CRUD, sécurisé requireAdmin
// après une fuite d'accès non authentifié) — GET /api/equipment et GET /api/equipment/:id sont
// déjà ouvertes à tout utilisateur authentifié (equipment.js), aucun travail serveur ici.
// 678 lignes au total (vérifié) : chargées une fois, filtrées côté client — pas de pagination
// serveur nécessaire pour ce volume.

// Libellés repris tels quels de server/src/admin/ref-equipment-tool.html (seule source de
// terminologie FR pour ces champs — autorité unique, pas de traduction inventée ici). Ordre
// groupé par thème (identité, prix, général, offensif, défensif, conteneur, munitions), miroir
// des sections du formulaire admin.
const FIELD_ORDER = [
  'description',
  'price', 'price_modifier', 'rarity',
  'weight', 'manufacturer', 'nation', 'max_level', 'bonus', 'generation',
  'damage_h', 'damage_v_low', 'damage_v_high', 'shock', 'range',
  'min_str', 'init_mod', 'fire_mode', 'ammo_count', 'ammo_cost', 'caliber', 'linked_attr',
  'protection', 'protection_modifier', 'protection_shock', 'location', 'malus_cat',
  'capacity', 'waterproof',
  'ammo_effects',
]

const FIELD_LABELS = {
  description: 'Description',
  price: 'Prix (créd.)',
  price_modifier: 'Modificateur prix',
  rarity: 'Rareté',
  weight: 'Poids (kg)',
  manufacturer: 'Fabricant',
  nation: 'Nation / Faction',
  max_level: 'Niveau max',
  bonus: 'Bonus',
  generation: 'Génération',
  damage_h: 'Dommage (H)',
  damage_v_low: 'Dommage (V-)',
  damage_v_high: 'Dommage (V+)',
  shock: 'Choc',
  range: 'Portée',
  min_str: 'FOR min requise',
  init_mod: 'Modif. Initiative',
  fire_mode: 'Mode de tir',
  ammo_count: 'Mun. — Quantité chargeur',
  ammo_cost: 'Mun. — Coût ravitaillement',
  caliber: 'Calibre',
  linked_attr: 'Attribut lié',
  protection: 'Protection',
  protection_modifier: 'Modif. Protection',
  protection_shock: 'Protection Choc',
  location: 'Localisation',
  malus_cat: 'Catégorie de malus',
  capacity: 'Contenance (unités)',
  waterproof: 'Étanche',
  ammo_effects: 'Effets spéciaux munitions',
}

export default function EquipmentCatalogPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('')
  const [category, setCategory] = useState('')

  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)

  useEffect(() => { document.title = 'Enclume — Catalogue équipement' }, [])

  useEffect(() => {
    api.get('/equipment')
      .then(res => setItems(res.data.items))
      .catch(() => setError(t('equipment.errorLoad')))
      .finally(() => setLoading(false))
  }, [t])

  const families = useMemo(
    () => [...new Set(items.map(i => i.family))].sort((a, b) => a.localeCompare(b)),
    [items]
  )
  const categories = useMemo(() => {
    const pool = family ? items.filter(i => i.family === family) : items
    return [...new Set(pool.map(i => i.category))].sort((a, b) => a.localeCompare(b))
  }, [items, family])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(i =>
      (!family || i.family === family) &&
      (!category || i.category === category) &&
      (!q || i.name.toLowerCase().includes(q))
    )
  }, [items, search, family, category])

  const openItem = async (id) => {
    setSelected({ id })
    setSelectedLoading(true)
    try {
      const res = await api.get(`/equipment/${id}`)
      setSelected(res.data.item)
    } catch {
      setSelected(null)
      setError(t('equipment.errorLoadItem'))
    } finally {
      setSelectedLoading(false)
    }
  }

  return (
    <div className="app-shell" style={S.container}>

      <div style={{ ...S.header, position: 'relative', zIndex: 1 }}>
        <button className="btn-icon" onClick={() => navigate(-1)}>{t('equipment.back')}</button>
        <h1 style={S.pageTitle}>{t('equipment.pageTitle')}</h1>
        <div style={S.headerRight} />
      </div>

      {error && <div style={S.errorBanner} onClick={() => setError(null)}>{error} ✕</div>}

      <div style={{ ...S.body, position: 'relative', zIndex: 1 }}>
        <div style={S.filters}>
          <input
            style={{ ...S.input, flex: 1, minWidth: '200px' }}
            placeholder={t('equipment.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={S.input}
            value={family}
            onChange={e => { setFamily(e.target.value); setCategory('') }}
          >
            <option value="">{t('equipment.allFamilies')}</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select style={S.input} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">{t('equipment.allCategories')}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={S.muted}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p style={S.muted}>{t('equipment.noResults')}</p>
        ) : (
          <>
            <p style={S.resultCount}>{t('equipment.resultCount', { count: filtered.length })}</p>
            <div style={S.list}>
              {filtered.map(item => (
                <div key={item.id} style={S.row} onClick={() => openItem(item.id)}>
                  <div style={S.rowMain}>
                    <span style={S.rowName}>{item.name}</span>
                    <span style={S.rowCategory}>{item.category}</span>
                  </div>
                  <div style={S.rowMeta}>
                    <span style={S.metaChip}>NT {item.tech_level}</span>
                    {item.weight != null && <span style={S.metaChip}>{item.weight} kg</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div style={S.overlay} onClick={() => setSelected(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            {selectedLoading ? (
              <p style={S.muted}>{t('common.loading')}</p>
            ) : (
              <>
                <div style={S.modalHeader}>
                  <h2 style={S.modalTitle}>{selected.name}</h2>
                  <span style={S.modalSubtitle}>{selected.family} — {selected.category}</span>
                </div>
                <div style={S.detailGrid}>
                  {FIELD_ORDER
                    .filter(key => selected[key] !== null && selected[key] !== undefined && selected[key] !== '')
                    .map(key => (
                      <div key={key} style={S.detailRow}>
                        <span style={S.detailLabel}>{FIELD_LABELS[key]}</span>
                        <span style={S.detailValue}>
                          {typeof selected[key] === 'boolean' ? (selected[key] ? '✓' : '—') : String(selected[key])}
                        </span>
                      </div>
                    ))}
                </div>
                <div style={S.modalFooter}>
                  <button className="btn btn-ghost" onClick={() => setSelected(null)}>{t('common.close')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  pageTitle: { fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 },
  headerRight: { width: '52px' },
  errorBanner: { backgroundColor: 'rgba(224,92,92,0.12)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '8px 16px', color: 'var(--color-danger)', fontSize: '13px', margin: '8px 24px 0', cursor: 'pointer' },

  body: { flex: 1, maxWidth: '820px', width: '100%', margin: '0 auto', padding: '24px' },
  muted: { color: 'var(--text-muted)', fontSize: '13px' },

  filters: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' },
  input: { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' },

  resultCount: { fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', gap: '10px' },
  rowMain: { display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0, flex: 1 },
  rowName: { fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowCategory: { fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { display: 'flex', gap: '6px', flexShrink: 0 },
  metaChip: { fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '2px 6px' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
  modalHeader: { display: 'flex', flexDirection: 'column', gap: '2px' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 },
  modalSubtitle: { fontSize: '12px', color: 'var(--text-muted)' },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' },
  detailLabel: { color: 'var(--text-muted)', flexShrink: 0 },
  detailValue: { color: 'var(--text-primary)', textAlign: 'right' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end' },
}
