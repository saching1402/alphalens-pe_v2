import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { fetchManagers, fetchManager, createManager, updateManager, deleteManager } from '../lib/api'
import { fmt1, fmt2, fmtM, irrClass, tvpiClass, strategyBadge, alphaClass } from '../lib/utils'

// ── Manager Form Modal ─────────────────────────────────────────────────────
function ManagerModal({ manager, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!manager?.id
  const [form, setForm] = useState({
    name: manager?.name || '',
    strategy: manager?.strategy || '',
    pb_score: manager?.pb_score ?? '',
    aum_usd_m: manager?.aum_usd_m ?? '',
    description: manager?.description || '',
    year_founded: manager?.year_founded ?? '',
    segment: manager?.segment || '',
    latest_fund_size_usd_m: manager?.latest_fund_size_usd_m ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateManager(manager.id, d) : createManager,
    onSuccess: () => {
      qc.invalidateQueries(['managers'])
      toast.success(isEdit ? 'Manager updated' : 'Manager created')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error saving manager'),
  })

  const submit = (e) => {
    e.preventDefault()
    const payload = {}
    Object.entries(form).forEach(([k, v]) => {
      if (v === '') payload[k] = null
      else if (['pb_score','aum_usd_m','latest_fund_size_usd_m'].includes(k)) payload[k] = parseFloat(v)
      else if (k === 'year_founded') payload[k] = parseInt(v)
      else payload[k] = v || null
    })
    mutation.mutate(payload)
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Manager' : 'Add Manager'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-row"><label className="label">Manager Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="form-grid">
            <div><label className="label">Strategy</label>
              <select className="select" value={form.strategy} onChange={e => set('strategy', e.target.value)}>
                <option value="">—</option><option value="MM">MM</option><option value="LMM">LMM</option>
              </select>
            </div>
            <div><label className="label">Year Founded</label><input className="input" type="number" value={form.year_founded} onChange={e => set('year_founded', e.target.value)} placeholder="e.g. 2005" /></div>
          </div>
          <div className="form-grid">
            <div><label className="label">PB Score</label><input className="input" type="number" step="0.1" value={form.pb_score} onChange={e => set('pb_score', e.target.value)} placeholder="0–100" /></div>
            <div><label className="label">AUM (USD M)</label><input className="input" type="number" step="0.01" value={form.aum_usd_m} onChange={e => set('aum_usd_m', e.target.value)} /></div>
          </div>
          <div className="form-row"><label className="label">Latest Fund Size (USD M)</label><input className="input" type="number" step="0.01" value={form.latest_fund_size_usd_m} onChange={e => set('latest_fund_size_usd_m', e.target.value)} /></div>
          <div className="form-row"><label className="label">Description</label><textarea className="textarea" value={form.description} onChange={e => set('description', e.target.value)} rows={4} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Manager'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Manager Detail Panel ───────────────────────────────────────────────────
function DetailPanel({ managerId, onClose, onEdit }) {
  const { data: m, isLoading } = useQuery({ queryKey: ['manager', managerId], queryFn: () => fetchManager(managerId) })

  if (isLoading) return (
    <div style={{ width: 540, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
  if (!m) return null

  const funds = m.funds || []
  const qMap = { '1 (Top Quartile)': 'q1', '2 (Upper-Mid Quartile)': 'q2', '3 (Lower-Mid Quartile)': 'q3', '4 (Bottom Quartile)': 'q4' }
  const qLabel = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4' }
  const qColor = { q1: 'var(--green)', q2: 'var(--blue)', q3: 'var(--amber)', q4: 'var(--red)' }

  return (
    <div style={{ width: 540, height: '100vh', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{m.strategy || 'PE'} · {m.year_founded ? `Est. ${m.year_founded}` : ''} · {fmtM(m.aum_usd_m)} AUM</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏ Edit</button>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
      </div>
      <div style={{ padding: '18px 22px' }}>
        {m.description && <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 18 }}>{m.description}</p>}

        {/* Metrics grid */}
        <div className="sec-title">Performance Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 18 }}>
          {[['Avg IRR', fmt1(m.avg_irr), irrClass(m.avg_irr)],
            ['Wt Avg IRR', fmt1(m.weighted_avg_irr), irrClass(m.weighted_avg_irr)],
            ['Avg TVPI', fmt2(m.avg_tvpi), tvpiClass(m.avg_tvpi)],
            ['Avg DPI', fmt2(m.avg_dpi), 'mono'],
            ['IRR vs BM', m.irr_vs_benchmark != null ? (m.irr_vs_benchmark > 0 ? '+' : '') + m.irr_vs_benchmark.toFixed(1) + 'pp' : '—', alphaClass(m.irr_vs_benchmark)],
            ['PB Score', m.pb_score?.toFixed(1) ?? '—', 'mono'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', marginBottom: 3 }}>{l}</div>
              <div className={`${c}`} style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Quartile summary */}
        {m.total_funds_with_quartile > 0 && (
          <>
            <div className="sec-title">Quartile Summary ({m.total_funds_with_quartile} funds rated)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {[['top_quartile_funds', 'Top Q', 'q1'], ['upper_mid_quartile_funds', 'Upper', 'q2'], ['lower_mid_quartile_funds', 'Lower', 'q3'], ['bottom_quartile_funds', 'Bottom', 'q4']].map(([k, l, q]) => (
                <div key={k} style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: `${qColor[q]}18`, border: `1px solid ${qColor[q]}30`, minWidth: 56 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{m[k] || 0}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{l}</div>
                </div>
              ))}
              {m.top_quartile_pct != null && (
                <div style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,.2)', minWidth: 60 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold2)', fontFamily: 'var(--mono)' }}>{m.top_quartile_pct}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Top Q Rate</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Fund list */}
        <div className="sec-title">All Funds ({funds.length})</div>
        {[...funds].sort((a, b) => (a.vintage || 0) - (b.vintage || 0)).map(f => {
          const q = qMap[f.fund_quartile]
          return (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gold2)', flexShrink: 0 }}>{f.vintage || '—'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fund_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{f.fund_size_usd_m ? '$' + f.fund_size_usd_m.toLocaleString() + 'M' : ''} · {f.fund_type || 'Buyout'}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['IRR', fmt1(f.irr), irrClass(f.irr)], ['TVPI', fmt2(f.tvpi), tvpiClass(f.tvpi)], ['DPI', fmt2(f.dpi), 'mono']].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'right' }}>
                    <div className={c} style={{ fontSize: 12, fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase' }}>{l}</div>
                  </div>
                ))}
              </div>
              {q && <div style={{ padding: '3px 6px', borderRadius: 5, fontSize: 9, fontWeight: 800, background: `${qColor[q]}18`, color: qColor[q], flexShrink: 0 }}>{qLabel[q]}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Managers Page ─────────────────────────────────────────────────────
export default function Managers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [strategy, setStrategy] = useState('')
  const [sortCol, setSortCol] = useState('avg_irr')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // null | 'create' | manager_obj
  const [detailId, setDetailId] = useState(null)
  const PS = 25

  const { data, isLoading } = useQuery({
    queryKey: ['managers', { search, strategy }],
    queryFn: () => fetchManagers({ search: search || undefined, strategy: strategy || undefined, limit: 500 }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteManager,
    onSuccess: () => { qc.invalidateQueries(['managers']); toast.success('Manager deleted'); setDetailId(null) },
    onError: () => toast.error('Delete failed'),
  })

  const sorted = useMemo(() => {
    if (!data?.items) return []
    return [...data.items].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'string') av = av.toLowerCase(); if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [data, sortCol, sortDir])

  const paginated = sorted.slice((page - 1) * PS, page * PS)
  const totalPages = Math.ceil(sorted.length / PS)

  const colSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc') } }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div className="page-title">Fund Manager Directory</div><div className="page-sub">Full CRUD — click row to view details · {data?.total ?? 0} managers</div></div>
            <button className="btn btn-primary" onClick={() => setModal('create')}>+ Add Manager</button>
          </div>
        </div>

        <div className="card" style={{ margin: '0 28px 0', overflow: 'hidden' }}>
          <div className="toolbar">
            <div className="search-box">
              <span style={{ color: 'var(--text3)' }}>🔍</span>
              <input placeholder="Search managers…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="select" style={{ width: 120 }} value={strategy} onChange={e => { setStrategy(e.target.value); setPage(1) }}>
              <option value="">All Strategies</option><option value="MM">MM</option><option value="LMM">LMM</option>
            </select>
            <select className="select" style={{ width: 140 }} value={sortCol} onChange={e => setSortCol(e.target.value)}>
              <option value="avg_irr">Sort: IRR</option><option value="avg_tvpi">Sort: TVPI</option>
              <option value="avg_dpi">Sort: DPI</option><option value="pb_score">Sort: PB Score</option>
              <option value="aum_usd_m">Sort: AUM</option><option value="top_quartile_pct">Sort: Top Q%</option>
              <option value="name">Sort: Name</option>
            </select>
            <select className="select" style={{ width: 90 }} value={sortDir} onChange={e => setSortDir(e.target.value)}>
              <option value="desc">Desc</option><option value="asc">Asc</option>
            </select>
          </div>

          {isLoading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th onClick={() => colSort('name')}>Manager</th>
                  <th>Strategy</th>
                  <th onClick={() => colSort('num_funds')}>#Funds</th>
                  <th onClick={() => colSort('avg_irr')}>Avg IRR</th>
                  <th onClick={() => colSort('weighted_avg_irr')}>Wt IRR</th>
                  <th onClick={() => colSort('avg_tvpi')}>Avg TVPI</th>
                  <th onClick={() => colSort('avg_dpi')}>Avg DPI</th>
                  <th onClick={() => colSort('irr_vs_benchmark')}>vs BM</th>
                  <th onClick={() => colSort('pb_score')}>PB Score</th>
                  <th onClick={() => colSort('aum_usd_m')}>AUM</th>
                  <th onClick={() => colSort('top_quartile_pct')}>Top Q%</th>
                  <th onClick={() => colSort('year_founded')}>Founded</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {paginated.map(m => (
                    <tr key={m.id} onClick={() => setDetailId(m.id)} style={{ background: detailId === m.id ? 'var(--gold-dim2)' : undefined }}>
                      <td className="td-name">{m.name}</td>
                      <td><span className={strategyBadge(m.strategy)}>{m.strategy || '—'}</span></td>
                      <td className="mono">{m.num_funds}</td>
                      <td><span className={irrClass(m.avg_irr)}>{fmt1(m.avg_irr)}</span></td>
                      <td><span className={irrClass(m.weighted_avg_irr)}>{fmt1(m.weighted_avg_irr)}</span></td>
                      <td><span className={tvpiClass(m.avg_tvpi)}>{fmt2(m.avg_tvpi)}</span></td>
                      <td className="mono">{fmt2(m.avg_dpi)}</td>
                      <td><span className={alphaClass(m.irr_vs_benchmark)}>{m.irr_vs_benchmark != null ? (m.irr_vs_benchmark > 0 ? '+' : '') + m.irr_vs_benchmark.toFixed(1) + 'pp' : '—'}</span></td>
                      <td>{m.pb_score != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${m.pb_score}%`, background: 'linear-gradient(90deg,var(--gold),var(--gold2))' }} />
                          </div>
                          <span className="mono" style={{ fontSize: 10 }}>{m.pb_score.toFixed(0)}</span>
                        </div>
                      ) : <span className="v-na">—</span>}</td>
                      <td className="mono">{fmtM(m.aum_usd_m)}</td>
                      <td><span className={m.top_quartile_pct != null ? (m.top_quartile_pct >= 50 ? 'v-good mono' : 'v-ok mono') : 'v-na'}>{m.top_quartile_pct != null ? m.top_quartile_pct + '%' : '—'}</span></td>
                      <td className="mono">{m.year_founded || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setModal(m)}>✏</button>
                          <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={() => { if (confirm(`Delete ${m.name}?`)) deleteMut.mutate(m.id) }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pg">
            <span>Showing {Math.min((page - 1) * PS + 1, sorted.length)}–{Math.min(page * PS, sorted.length)} of {sorted.length}</span>
            <div className="pg-btns">
              <button className="pgb" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(i => i === 1 || i === totalPages || Math.abs(i - page) <= 1).map((i, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== i - 1 && <button key={`e${i}`} className="pgb" disabled>…</button>}
                  <button key={i} className={`pgb${i === page ? ' active' : ''}`} onClick={() => setPage(i)}>{i}</button>
                </>
              ))}
              <button className="pgb" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* Side Detail Panel */}
      {detailId && (
        <DetailPanel
          managerId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => { const m = data?.items.find(x => x.id === detailId); if (m) setModal(m) }}
        />
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <ManagerModal
          manager={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
