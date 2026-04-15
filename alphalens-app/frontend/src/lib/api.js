import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ── Dashboard ──────────────────────────────────────────────────────────────
export const fetchDashboard = () => api.get('/api/analytics/dashboard').then(r => r.data)
export const fetchScatter = (x, y) => api.get('/api/analytics/scatter', { params: { x, y } }).then(r => r.data)
export const fetchTopManagers = (metric, limit = 15) => api.get('/api/analytics/top-managers', { params: { metric, limit } }).then(r => r.data)
export const fetchQuartileDist = () => api.get('/api/analytics/quartile-distribution').then(r => r.data)

// ── Managers ───────────────────────────────────────────────────────────────
export const fetchManagers = (params = {}) => api.get('/api/managers', { params }).then(r => r.data)
export const fetchManager = (id) => api.get(`/api/managers/${id}`).then(r => r.data)
export const createManager = (data) => api.post('/api/managers', data).then(r => r.data)
export const updateManager = (id, data) => api.patch(`/api/managers/${id}`, data).then(r => r.data)
export const deleteManager = (id) => api.delete(`/api/managers/${id}`)

// ── Funds ──────────────────────────────────────────────────────────────────
export const fetchFunds = (params = {}) => api.get('/api/funds', { params }).then(r => r.data)
export const fetchFund = (id) => api.get(`/api/funds/${id}`).then(r => r.data)
export const createFund = (data) => api.post('/api/funds', data).then(r => r.data)
export const updateFund = (id, data) => api.patch(`/api/funds/${id}`, data).then(r => r.data)
export const deleteFund = (id) => api.delete(`/api/funds/${id}`)

// ── Workflows ──────────────────────────────────────────────────────────────
export const fetchWorkflows = (status) => api.get('/api/workflows', { params: status ? { status } : {} }).then(r => r.data)
export const fetchWorkflow = (id) => api.get(`/api/workflows/${id}`).then(r => r.data)
export const createWorkflow = (data) => api.post('/api/workflows', data).then(r => r.data)
export const updateWorkflow = (id, data) => api.patch(`/api/workflows/${id}`, data).then(r => r.data)
export const deleteWorkflow = (id) => api.delete(`/api/workflows/${id}`)
export const addComment = (wfId, data) => api.post(`/api/workflows/${wfId}/comments`, data).then(r => r.data)

// ── Import ─────────────────────────────────────────────────────────────────
export const importExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
}
