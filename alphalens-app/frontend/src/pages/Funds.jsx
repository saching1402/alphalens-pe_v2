import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { fetchFunds, fetchManagers, createFund, updateFund, deleteFund } from '../lib/api'
import { fmt1, fmt2, irrClass, tvpiClass } from '../lib/utils'

const QUARTILE_OPTIONS = ['', '1 (Top Quartile)', '2 (Upper-Mid Quartile)', '3 (Lower-Mid Quartile)', '4 (Bottom Quartile)']

function FundModal({ fund, managers, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!fund?.id
  const [form, setForm] = useState({
    manager_id: fund?.manager_id || '',
    fund_name: fund?.fund_name || '',
    fund_id_raw: fund?.fund_id_raw || '',
    vintage: fund?.vintage ?? '',
    fund_size_usd_m: fund?.fund_size_usd_m ?? '',
    fund_type: fund?.fund_type || 'Buyout',
    investments: fund?.investments ?? '',
    irr: fund?.irr ?? '',
    tvpi: fund?.tvpi ?? '',
    rvpi: fund?.rvpi ?? '',
    dpi: fund?.dpi ?? '',
    fund_quartile: fund?.fund_quartile || '',
    irr_benchmark: fund?.irr_benchmark ?? '',
    tvpi_benchmark: fund?.tvpi_benchmark ?? '',
    dpi_benchmark: fund?.dpi_benchmark ?? '',
    as_of_quarter: fund?.as_of_quarter || '',
    preferred_geography: fund?.preferred_geography || '',
    preferred_industry: fund?.preferred_industry || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateFund(fund.id, d) : createFund,
    onSuccess: () => {
      qc.invalidateQueries(['funds'])
      qc.invalidateQueries(['managers'])
      toast.success(isEdit ? 'Fund updated' : 'Fund created')
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error saving fund'),
  })

  const NUMS = ['vintage', 'fund_size_usd_m', 'investments', 'irr', 'tvpi', 'rvpi', 'dpi', 'irr_benchmark', 'tvpi_benchmark', 'dpi_benchmark']

  const submit = (e) => {
    e.preventDefault()
    const payload = {}
    Object.entries(form).forEach(([k, v]) => {
      if (v === '') payload[k] = null
      else if (NUMS.includes(k)) payload[k] = parseFloat(v)
      else payload[k] = v || null
    })
    mutation.mutate(payload)
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 620 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Fund' : 'Add Fund'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-row">
            <label className="label">Manager *</label>
            <select className="select" value={form.manager_id} onChange={e => set('manager_id', e.target.value)} required>
              <option value="">Select manager…</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div><label className="label">Fund Name *</label><input className="input" value={form.fund_name} onChange={e => set('fund_name', e.target.value)} required /></div>
            <div><label className="label">Fund ID (Preqin)</label><input className="input" value={form.fund_id_raw} onChange={e => set('fund_id_raw', e.target.value)} /></div>
          </div>
          <div className="form-grid">
            <div><label className="label">Vintage</label><input className="input" type="number" value={form.vintage} onChange={e => set('vintage', e.target.value)} /></div>
            <div><label className="label">Fund Size (USD M)</label><input className="input" type="number" step="0.01" value={form.fund_size_usd_m} onChange={e => set('fund_size_usd_m', e.target.value)} /></div>
          </div>
          <div className="form-grid">
            <div><label className="label">Fund Type</label>
              <select className="select" value={form.fund_type} onChange={e => set('fund_type', e.target.value)}>
                {['Buyout','Growth/Expansion','Diversified Private Equity','Venture Capital','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Investments</label><input className="input" type="number" value={form.investments} onChange={e => set('investments', e.target.value)} /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, marginBottom: 12 }}>
            <div className="sec-title" style={{ marginBottom: 10 }}>Performance Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              {[['IRR (%)', 'irr'], ['TVPI (x)', 'tvpi'], ['RVPI (x)', 'rvpi'], ['DPI (x)', 'dpi']].map(([l, k]) => (
                <div key={k}><label className="label">{l}</label><input className="input" type="number" step="0.001" value={form[k]} onChange={e => set(k, e.target.value)} /></div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['IRR BM (%)', 'irr_benchmark'], ['TVPI BM (x)', 'tvpi_benchmark'], ['DPI BM (x)', 'dpi_benchmark']].map(([l, k]) => (
              <div key={k}><label className="label">{l}</label><input className="input" type="number" step="0.001" value={form[k]} onChange={e => set(k, e.target.value)} /></div>
            ))}
          </div>

          <div className="form-grid">
            <div><label className="label">Fund Quartile</label>
              <select className="select" value={form.fund_quartile} onChange={e => set('fund_quartile', e.target.value)}>
                {QUARTILE_OPTIONS.map(q => <option key={q} value={q}>{q || '—'}</option>)}
              </select>
            </div>
            <div><label className="label">As of Quarter</label><input className="input" value={form.as_of_quarter} onChange={e => set('as_of_quarter', e.target.value)} placeholder="e.g. 2025Q3" /></div>
          </div>
          <div className="form-row"><label className="label">Preferred Geography</label><input className="input" value={form.preferred_geography} onChange={e => set('preferred_geography', e.target.value)} /></div>
          <div className="form-row"><label className="label">Preferred Industry</label><textarea className="textarea" rows={2} value={form.preferred_industry} onChange={e => set('preferred_industry', e.target.value)} /></div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Fund'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const qColor = { '1 (Top Quartile)': 'v-good', '2 (Upper-Mid Quartile)': 'v-ok', '3 (Lower-Mid Quartile)': 'v-warn', '4 (Bottom Quartile)': 'v-bad' }
const qShort = { '1 (Top Quartile)': 'Q1', '2 (Upper-Mid Quartile)': 'Q2', '3 (Lower-Mid Quartile)': 'Q3', '4 (Bottom Quartile)': 'Q4' }

export default function Funds() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [vintageFilter, setVintageFilter] = useState('')
  const [sortCol, setSortCol] = useState('vintage')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const PS = 30

  const { data: funds = [], isLoading } = useQuery({ queryKey: ['funds'], queryFn: () => fetchFunds({ limit: 1000 }) })
  const { data: mgrData } = useQuery({ queryKey: ['managers', {}], queryFn: () => fetchManagers({ limit: 500 }) })
  const managers = mgrData?.items || []
  const mgrMap = Object.fromEntries(managers.map(m => [m.id, m.name]))

  const deleteMut = useMutation({
    mutationFn: deleteFund,
    onSuccess: () => { qc.invalidateQueries(['funds']); qc.invalidateQueries(['managers']); toast.success('Fund deleted') },
    onError: () => toast.error('Delete failed'),
  })

  const filtered = useMemo(() => {
    let f = funds
    if (search) f = f.filter(x => x.fund_name.toLowerCase().includes(search.toLowerCase()))
    if (managerFilter) f = f.filter(x => x.manager_id === managerFilter)
    if (vintageFilter) f = f.filter(x => String(x.vintage) === vintageFilter)
    return [...f].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [funds, search, managerFilter, vintageFilter, sortCol, sortDir])

  const paginated = filtered.slice((page - 1) * PS, page * PS)
  const totalPages = Math.ceil(filtered.length / PS)
  const vintages = [...new Set(funds.map(f => f.vintage).filter(Boolean))].sort((a, b) => b - a)
  const colSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc') } }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><div className="page-title">Fund Directory</div><div className="page-sub">All funds across all managers — {funds.length} total</div></div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ Add Fund</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="toolbar">
          <div className="search-box"><span style={{ color: 'var(--text3)' }}>🔍</span><input placeholder="Search fund name…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div>
          <select className="select" style={{ minWidth: 160 }} value={managerFilter} onChange={e => { setManagerFilter(e.target.value); setPage(1) }}>
            <option value="">All Managers</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="select" style={{ width: 110 }} value={vintageFilter} onChange={e => { setVintageFilter(e.target.value); setPage(1) }}>
            <option value="">All Vintages</option>
            {vintages.map(v => <option key={v}>{v}</option>)}
          </select>
          <select className="select" style={{ width: 140 }} value={sortCol} onChange={e => setSortCol(e.target.value)}>
            <option value="vintage">Sort: Vintage</option><option value="irr">Sort: IRR</option>
            <option value="tvpi">Sort: TVPI</option><option value="dpi">Sort: DPI</option>
            <option value="fund_size_usd_m">Sort: Fund Size</option>
          </select>
          <select className="select" style={{ width: 90 }} value={sortDir} onChange={e => setSortDir(e.target.value)}>
            <option value="desc">Desc</option><option value="asc">Asc</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{filtered.length} results</span>
        </div>

        {isLoading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th onClick={() => colSort('fund_name')}>Fund Name</th>
                <th>Manager</th>
                <th onClick={() => colSort('vintage')}>Vintage</th>
                <th onClick={() => colSort('fund_size_usd_m')}>Size (USD M)</th>
                <th>Type</th>
                <th onClick={() => colSort('irr')}>IRR</th>
                <th onClick={() => colSort('tvpi')}>TVPI</th>
                <th onClick={() => colSort('dpi')}>DPI</th>
                <th onClick={() => colSort('fund_quartile')}>Quartile</th>
                <th>As Of</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {paginated.map(f => (
                  <tr key={f.id}>
                    <td className="td-name">{f.fund_name}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{mgrMap[f.manager_id] || '—'}</td>
                    <td className="mono">{f.vintage || '—'}</td>
                    <td className="mono">{f.fund_size_usd_m ? '$' + f.fund_size_usd_m.toLocaleString() : '—'}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 11 }}>{f.fund_type || '—'}</td>
                    <td><span className={irrClass(f.irr)}>{fmt1(f.irr)}</span></td>
                    <td><span className={tvpiClass(f.tvpi)}>{fmt2(f.tvpi)}</span></td>
                    <td className="mono">{fmt2(f.dpi)}</td>
                    <td>
                      {f.fund_quartile
                        ? <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(75,94,122,.15)' }} className={qColor[f.fund_quartile] || ''}>{qShort[f.fund_quartile] || f.fund_quartile}</span>
                        : <span className="v-na">—</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>{f.as_of_quarter || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(f)}>✏</button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => { if (confirm(`Delete ${f.fund_name}?`)) deleteMut.mutate(f.id) }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pg">
          <span>Showing {Math.min((page - 1) * PS + 1, filtered.length)}–{Math.min(page * PS, filtered.length)} of {filtered.length}</span>
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

      {modal && <FundModal fund={modal === 'create' ? null : modal} managers={managers} onClose={() => setModal(null)} />}
    </div>
  )
}
