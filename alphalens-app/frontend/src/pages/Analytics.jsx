import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Scatter, Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { fetchScatter, fetchTopManagers, fetchQuartileDist, fetchManagers } from '../lib/api'
import { CHART_DEFAULTS, RANK_COLORS } from '../lib/utils'
Chart.register(...registerables)

const METRIC_OPTS = [
  { value: 'irr', label: 'Avg IRR (%)' },
  { value: 'tvpi', label: 'Avg TVPI (x)' },
  { value: 'dpi', label: 'Avg DPI (x)' },
]

function ScatterCard({ title, xMetric, yMetric, hlN, filter }) {
  const canvasRef = useRef(null)
  const labelDivRef = useRef(null)
  const chartRef = useRef(null)
  const [chartReady, setChartReady] = useState(false)

  const { data: raw = [] } = useQuery({
    queryKey: ['scatter', xMetric, yMetric],
    queryFn: () => fetchScatter(xMetric, yMetric),
  })

  // Apply filter
  const pts = raw.filter(p => {
    if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.strategy && p.strategy !== filter.strategy) return false
    if (filter.pb === 'high' && (p.pb_score == null || p.pb_score < 70)) return false
    if (filter.pb === 'mid' && (p.pb_score == null || p.pb_score < 50 || p.pb_score >= 70)) return false
    if (filter.pb === 'low' && (p.pb_score == null || p.pb_score >= 50)) return false
    return true
  })

  // Sort by x descending to determine rank
  const sorted = [...pts].sort((a, b) => (b.x || 0) - (a.x || 0))
  const n = hlN === 'all' ? pts.length : parseInt(hlN) || 15
  const ranked = sorted.slice(0, n)
  const rankedNames = new Set(ranked.map(p => p.name))
  const rankMap = Object.fromEntries(ranked.map((p, i) => [p.name, i]))

  const datasets = [
    ...ranked.map((pt, i) => ({
      label: pt.name,
      data: [{ x: pt.x, y: pt.y, name: pt.name }],
      backgroundColor: RANK_COLORS[i % RANK_COLORS.length],
      borderColor: RANK_COLORS[i % RANK_COLORS.length],
      pointRadius: 8, pointHoverRadius: 11,
    })),
    {
      label: 'Other',
      data: pts.filter(p => !rankedNames.has(p.name)).map(p => ({ x: p.x, y: p.y, name: p.name })),
      backgroundColor: 'rgba(75,94,122,.3)',
      borderColor: 'rgba(75,94,122,.15)',
      pointRadius: 4, pointHoverRadius: 7,
    }
  ]

  const renderLabels = () => {
    const chart = chartRef.current
    const div = labelDivRef.current
    if (!chart || !div) return
    div.innerHTML = ''
    const placed = []
    ranked.forEach((pt, i) => {
      const xPx = chart.scales.x.getPixelForValue(pt.x)
      const yPx = chart.scales.y.getPixelForValue(pt.y)
      if (isNaN(xPx) || isNaN(yPx)) return
      const col = RANK_COLORS[i % RANK_COLORS.length]
      const shortName = pt.name.length > 13 ? pt.name.substring(0, 12) + '…' : pt.name
      let lx = xPx, ly = yPx - 16
      for (const p of placed) {
        if (Math.abs(lx - p.x) < 72 && Math.abs(ly - p.y) < 14) ly = p.y + 16
      }
      placed.push({ x: lx, y: ly })
      const el = document.createElement('div')
      el.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;transform:translateX(-50%);font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:${col};white-space:nowrap;pointer-events:none;padding:2px 5px;border-radius:4px;background:rgba(13,17,23,.78);border:1px solid ${col}44;text-shadow:0 1px 3px rgba(0,0,0,.8);`
      el.innerHTML = `<span style="opacity:.6;font-size:9px">#${rankMap[pt.name] + 1} </span>${shortName}`
      div.appendChild(el)
    })
  }

  const options = {
    ...CHART_DEFAULTS,
    animation: { duration: 300, onComplete: renderLabels },
    scales: {
      x: { title: { display: true, text: METRIC_OPTS.find(m => m.value === xMetric)?.label || xMetric, color: '#4b5e7a', font: { size: 10 } }, ticks: { color: '#4b5e7a', font: { size: 10 } }, grid: { color: 'rgba(30,45,68,.7)' } },
      y: { title: { display: true, text: METRIC_OPTS.find(m => m.value === yMetric)?.label || yMetric, color: '#4b5e7a', font: { size: 10 } }, ticks: { color: '#4b5e7a', font: { size: 10 } }, grid: { color: 'rgba(30,45,68,.7)' } },
    },
    plugins: { legend: { display: false }, tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { title: () => '', label: c => `${c.raw.name}: (${c.raw.x?.toFixed(1)}, ${c.raw.y?.toFixed(2)})` } } },
    onResize: renderLabels,
  }

  useEffect(() => { setTimeout(renderLabels, 100) }, [pts.length, n])

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>{title}</div>
      <div style={{ position: 'relative', height: 380 }}>
        <Scatter ref={chartRef} data={{ datasets }} options={options} />
        <div ref={labelDivRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} />
      </div>
    </div>
  )
}

export default function Analytics() {
  const [filter, setFilter] = useState({ search: '', strategy: '', pb: '' })
  const [hlN, setHlN] = useState('15')
  const setF = (k, v) => setFilter(f => ({ ...f, [k]: v }))

  const { data: topIRR } = useQuery({ queryKey: ['top-irr-an'], queryFn: () => fetchTopManagers('irr', 20) })
  const { data: topTVPI } = useQuery({ queryKey: ['top-tvpi-an'], queryFn: () => fetchTopManagers('tvpi', 20) })
  const { data: qDist } = useQuery({ queryKey: ['qdist-an'], queryFn: fetchQuartileDist })
  const { data: mgrData } = useQuery({ queryKey: ['managers', {}], queryFn: () => fetchManagers({ limit: 500 }) })

  const filteredMgrs = (mgrData?.items || []).filter(m => {
    if (filter.search && !m.name.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.strategy && m.strategy !== filter.strategy) return false
    return true
  })
  const mm = filteredMgrs.filter(m => m.strategy === 'MM').length
  const lmm = filteredMgrs.filter(m => m.strategy === 'LMM').length
  const oth = filteredMgrs.filter(m => !m.strategy).length

  const irrBarData = topIRR ? { labels: topIRR.map(m => m.name), datasets: [{ data: topIRR.map(m => m.value), backgroundColor: topIRR.map((_, i) => RANK_COLORS[i % RANK_COLORS.length]), borderRadius: 3 }] } : null
  const tvpiBarData = topTVPI ? { labels: topTVPI.map(m => m.name), datasets: [{ data: topTVPI.map(m => m.value), backgroundColor: topTVPI.map((_, i) => RANK_COLORS[i % RANK_COLORS.length]), borderRadius: 3 }] } : null

  return (
    <div className="page">
      {/* Header + filter bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">Scatter Analytics</div>
          <div className="page-sub">Live from database — top managers labelled directly</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ width: 180 }}>
            <span style={{ color: 'var(--text3)' }}>🔍</span>
            <input placeholder="Filter managers…" value={filter.search} onChange={e => setF('search', e.target.value)} />
          </div>
          <select className="select" value={filter.strategy} onChange={e => setF('strategy', e.target.value)}>
            <option value="">All Strategies</option><option value="MM">MM</option><option value="LMM">LMM</option>
          </select>
          <select className="select" value={filter.pb} onChange={e => setF('pb', e.target.value)}>
            <option value="">All PB Scores</option><option value="high">PB ≥ 70</option><option value="mid">PB 50–70</option><option value="low">PB &lt; 50</option>
          </select>
          <select className="select" value={hlN} onChange={e => setHlN(e.target.value)}>
            <option value="10">Top 10</option><option value="15">Top 15</option><option value="20">Top 20</option><option value="all">All</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ search: '', strategy: '', pb: '' })}>Reset</button>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{filteredMgrs.length} managers</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <ScatterCard title="Avg IRR vs Avg TVPI" xMetric="irr" yMetric="tvpi" hlN={hlN} filter={filter} />
        <ScatterCard title="Avg IRR vs Avg DPI" xMetric="irr" yMetric="dpi" hlN={hlN} filter={filter} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <ScatterCard title="Avg TVPI vs Avg DPI" xMetric="tvpi" yMetric="dpi" hlN={hlN} filter={filter} />
        <ScatterCard title="Avg IRR vs Avg RVPI" xMetric="irr" yMetric="rvpi" hlN={hlN} filter={filter} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Strategy Mix</div>
          <div style={{ height: 260 }}>
            <Doughnut
              data={{ labels: ['MM', 'LMM', 'Other'], datasets: [{ data: [mm, lmm, oth], backgroundColor: ['rgba(79,156,249,.85)', 'rgba(167,139,250,.85)', 'rgba(201,168,76,.85)'], borderWidth: 2, borderColor: '#111827' }] }}
              options={{ responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } }, tooltip: CHART_DEFAULTS.plugins.tooltip } }}
            />
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Top 20 by Avg IRR</div>
          <div style={{ height: 260 }}>
            {irrBarData && <Bar data={irrBarData} options={{ ...CHART_DEFAULTS, indexAxis: 'y', plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }, scales: { x: CHART_DEFAULTS.scales.x, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(30,45,68,.5)' } } } }} />}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Top 20 by Avg TVPI</div>
          <div style={{ height: 260 }}>
            {tvpiBarData && <Bar data={tvpiBarData} options={{ ...CHART_DEFAULTS, indexAxis: 'y', plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }, scales: { x: CHART_DEFAULTS.scales.x, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(30,45,68,.5)' } } } }} />}
          </div>
        </div>
      </div>
    </div>
  )
}
