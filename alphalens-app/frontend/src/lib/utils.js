export const fmt1 = (v, s = '%') => v != null ? v.toFixed(1) + s : '—'
export const fmt2 = (v, s = 'x') => v != null ? v.toFixed(2) + s : '—'
export const fmtM = (v) => {
  if (!v) return '—'
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'B'
  return '$' + v.toFixed(0) + 'M'
}

export function irrClass(v) {
  if (v == null) return 'v-na mono'
  if (v >= 25) return 'v-good mono'
  if (v >= 12) return 'v-ok mono'
  return 'v-bad mono'
}
export function tvpiClass(v) {
  if (v == null) return 'v-na mono'
  if (v >= 2) return 'v-good mono'
  if (v >= 1.5) return 'v-ok mono'
  return 'v-bad mono'
}
export function alphaClass(v) {
  if (v == null) return 'v-na mono'
  if (v > 5) return 'v-good mono'
  if (v > 0) return 'v-ok mono'
  return 'v-bad mono'
}

export function strategyBadge(s) {
  if (s === 'MM') return 'badge badge-mm'
  if (s === 'LMM') return 'badge badge-lmm'
  return 'badge badge-na'
}

export function statusBadge(s) {
  const m = { 'Open': 'badge-open', 'In Progress': 'badge-inprog', 'Resolved': 'badge-resolved', 'Closed': 'badge-closed' }
  return `badge ${m[s] || 'badge-na'}`
}

export function quartileColor(q) {
  if (!q) return 'v-na'
  if (q.includes('Top')) return 'v-good'
  if (q.includes('Upper')) return 'v-ok'
  if (q.includes('Lower')) return 'v-warn'
  return 'v-bad'
}

export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 11 } } },
    tooltip: {
      backgroundColor: 'rgba(13,17,23,.95)',
      titleColor: '#e2e8f5', bodyColor: '#94a3b8',
      borderColor: 'rgba(201,168,76,.3)', borderWidth: 1,
      padding: 10, cornerRadius: 8,
    }
  },
  scales: {
    x: { ticks: { color: '#4b5e7a', font: { size: 10 } }, grid: { color: 'rgba(30,45,68,.7)' } },
    y: { ticks: { color: '#4b5e7a', font: { size: 10 } }, grid: { color: 'rgba(30,45,68,.7)' } },
  },
}

export const RANK_COLORS = [
  '#f5d98b','#2dd4bf','#4f9cf9','#a78bfa','#f87171',
  '#34d399','#fb923c','#38bdf8','#e879f9','#a3e635',
]
