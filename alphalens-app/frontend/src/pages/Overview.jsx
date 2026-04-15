import { useQuery } from '@tanstack/react-query'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { fetchDashboard, fetchTopManagers, fetchQuartileDist, fetchManagers } from '../lib/api'
import { fmt1, fmt2, fmtM, irrClass, tvpiClass, strategyBadge, CHART_DEFAULTS, RANK_COLORS } from '../lib/utils'
Chart.register(...registerables)

function StatCard({ label, value, sub, color = 'var(--gold2)' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Overview() {
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
  const { data: topIRR } = useQuery({ queryKey: ['top', 'irr'], queryFn: () => fetchTopManagers('irr', 15) })
  const { data: topTVPI } = useQuery({ queryKey: ['top', 'tvpi'], queryFn: () => fetchTopManagers('tvpi', 15) })
  const { data: qDist } = useQuery({ queryKey: ['qdist'], queryFn: fetchQuartileDist })
  const { data: mgrsData } = useQuery({ queryKey: ['managers', {}], queryFn: () => fetchManagers({ limit: 200 }) })

  // Top shortlist: managers sorted by avg_irr
  const shortlist = mgrsData?.items
    ?.filter(m => m.avg_irr != null)
    ?.sort((a, b) => (b.avg_irr || 0) - (a.avg_irr || 0))
    ?.slice(0, 18) || []

  // TQ leaders
  const tqLeaders = mgrsData?.items
    ?.filter(m => m.total_funds_with_quartile >= 2 && m.top_quartile_pct != null)
    ?.sort((a, b) => b.top_quartile_pct - a.top_quartile_pct || (b.avg_irr || 0) - (a.avg_irr || 0))
    ?.slice(0, 14) || []

  const irrBarData = topIRR ? {
    labels: topIRR.map(m => m.name),
    datasets: [{ data: topIRR.map(m => m.value), backgroundColor: topIRR.map((_, i) => RANK_COLORS[i % RANK_COLORS.length]), borderRadius: 3 }],
  } : null

  const tvpiBarData = topTVPI ? {
    labels: topTVPI.map(m => m.name),
    datasets: [{ data: topTVPI.map(m => m.value), backgroundColor: topTVPI.map((_, i) => RANK_COLORS[i % RANK_COLORS.length]), borderRadius: 3 }],
  } : null

  const qLabels = { '1 (Top Quartile)': 'Top Q', '2 (Upper-Mid Quartile)': 'Upper Mid', '3 (Lower-Mid Quartile)': 'Lower Mid', '4 (Bottom Quartile)': 'Bottom' }
  const qColors = ['#22c55e', '#4f9cf9', '#f59e0b', '#f43f5e']
  const qChartData = qDist ? {
    labels: Object.keys(qDist).map(k => qLabels[k] || k),
    datasets: [{ data: Object.values(qDist), backgroundColor: qColors, borderWidth: 3, borderColor: '#111827' }],
  } : null

  if (statsLoading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Market Intelligence Overview</div>
        <div className="page-sub">Mid-Market & Lower Mid-Market PE Buyout Landscape — Live from Database</div>
      </div>

      {/* KPI Strip */}
      <div className="stat-grid">
        <StatCard label="Total Managers" value={stats?.total_managers ?? '—'} sub="In universe" color="var(--text)" />
        <StatCard label="High Conviction" value={stats?.high_conviction_count ?? '—'} sub="Avg IRR ≥ 20%" color="var(--gold2)" />
        <StatCard label="Avg IRR (All)" value={fmt1(stats?.avg_irr)} sub="Arithmetic mean" color="var(--gold2)" />
        <StatCard label="Avg TVPI (All)" value={fmt2(stats?.avg_tvpi)} sub="Total value / paid-in" color="var(--teal)" />
        <StatCard label="Top Quartile Funds" value={stats?.top_quartile_count ?? '—'} sub={`${stats?.total_rated_funds ?? 0} rated total`} color="var(--green)" />
        <StatCard label="Total AUM" value={stats?.total_aum_usd_b ? '$' + stats.total_aum_usd_b + 'T' : '—'} sub="Pitchbook data" color="var(--amber)" />
      </div>

      {/* Two-panel overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Shortlist */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--card2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: 'var(--gold2)' }}>★</span> Key Shortlist Managers
            </div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sorted by Avg IRR</span>
          </div>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 18px', borderBottom: '1px solid var(--border2)', background: 'var(--card2)' }}>
            <div style={{ flex: 1, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)' }}>Manager</div>
            <div style={{ width: 36, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', marginRight: 8 }}></div>
            <div style={{ width: 46, textAlign: 'right', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)' }}>Avg IRR</div>
            <div style={{ width: 44, textAlign: 'right', marginLeft: 10, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)' }}>TVPI</div>
            <div style={{ width: 90, marginLeft: 10, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)' }}>PB Score</div>
            <div style={{ width: 20, textAlign: 'right', marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)' }}>#F</div>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {shortlist.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', borderBottom: '1px solid rgba(30,45,68,.5)', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <span className={strategyBadge(m.strategy)} style={{ marginRight: 8, flexShrink: 0 }}>{m.strategy || '—'}</span>
                <div style={{ width: 46, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--gold2)', flexShrink: 0 }}>{fmt1(m.avg_irr)}</div>
                <div style={{ width: 44, textAlign: 'right', marginLeft: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--teal)', flexShrink: 0 }}>{fmt2(m.avg_tvpi)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90, marginLeft: 10, flexShrink: 0 }}>
                  {m.pb_score ? <>
                    <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${m.pb_score}%`, background: 'linear-gradient(90deg,var(--gold),var(--gold2))', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', width: 24, textAlign: 'right' }}>{m.pb_score.toFixed(0)}</span>
                  </> : <span style={{ color: 'var(--text3)', fontSize: 10 }}>—</span>}
                </div>
                <div style={{ width: 20, textAlign: 'right', marginLeft: 8, fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{m.num_funds}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TQ Leaders */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--card2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: 'var(--gold2)' }}>🏆</span> Top Quartile Leaders
            </div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>By % top-quartile funds</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 50px 60px', padding: '7px 18px', borderBottom: '1px solid var(--border2)', background: 'var(--card2)' }}>
            {['Manager', 'TQ Funds', 'TQ %', 'Rated', 'Avg IRR'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', textAlign: h === 'Avg IRR' ? 'right' : h === 'TQ %' ? 'left' : 'center' }}>{h}</span>
            ))}
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {tqLeaders.map(m => (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 50px 60px', padding: '8px 18px', borderBottom: '1px solid rgba(30,45,68,.5)', alignItems: 'center', cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,191,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{m.top_quartile_funds}/{m.total_funds_with_quartile}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(m.top_quartile_pct, 100)}%`, background: 'linear-gradient(90deg,var(--teal),var(--green))', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--teal)', width: 38, textAlign: 'right' }}>{m.top_quartile_pct?.toFixed(1)}%</span>
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{m.total_funds_with_quartile}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--gold2)' }}>{fmt1(m.avg_irr)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Top 15 by Avg IRR</div>
          <div style={{ height: 280 }}>
            {irrBarData && <Bar data={irrBarData} options={{ ...CHART_DEFAULTS, indexAxis: 'y', plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }, scales: { x: CHART_DEFAULTS.scales.x, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(30,45,68,.5)' } } } }} />}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Top 15 by Avg TVPI</div>
          <div style={{ height: 280 }}>
            {tvpiBarData && <Bar data={tvpiBarData} options={{ ...CHART_DEFAULTS, indexAxis: 'y', plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } }, scales: { x: CHART_DEFAULTS.scales.x, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(30,45,68,.5)' } } } }} />}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text2)', marginBottom: 14 }}>Quartile Distribution</div>
          <div style={{ height: 280 }}>
            {qChartData && <Doughnut data={qChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } }, tooltip: CHART_DEFAULTS.plugins.tooltip } }} />}
          </div>
        </div>
      </div>
    </div>
  )
}
