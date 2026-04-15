import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { fetchWorkflows, fetchManagers, createWorkflow, updateWorkflow, deleteWorkflow, addComment } from '../lib/api'
import { statusBadge } from '../lib/utils'

const STATUS_OPTS = ['Open', 'In Progress', 'Resolved', 'Closed']
const TYPE_OPTS = ['Due Diligence', 'Clarification', 'Risk Review', 'Performance', 'Other']
const PRIORITY_OPTS = ['High', 'Medium', 'Low']
const TYPE_COLORS = { 'Due Diligence': 'var(--blue)', Clarification: 'var(--purple)', 'Risk Review': 'var(--red)', Performance: 'var(--green)', Other: 'var(--gold2)' }
const PRI_COLORS = { High: 'var(--red)', Medium: 'var(--amber)', Low: 'var(--green)' }

function WFModal({ wf, managers, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!wf?.id
  const [form, setForm] = useState({
    title: wf?.title || '',
    manager_id: wf?.manager_id || '',
    wf_type: wf?.wf_type || 'Due Diligence',
    priority: wf?.priority || 'Medium',
    status: wf?.status || 'Open',
    assignee: wf?.assignee || '',
    description: wf?.description || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: isEdit ? (d) => updateWorkflow(wf.id, d) : createWorkflow,
    onSuccess: () => { qc.invalidateQueries(['workflows']); toast.success(isEdit ? 'Updated' : 'Created'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Error'),
  })

  const submit = (e) => {
    e.preventDefault()
    const d = { ...form, manager_id: form.manager_id || null }
    mut.mutate(d)
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Workflow' : 'New Workflow'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-row"><label className="label">Title *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} required /></div>
          <div className="form-grid">
            <div><label className="label">Manager</label>
              <select className="select" value={form.manager_id} onChange={e => set('manager_id', e.target.value)}>
                <option value="">Select…</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div><label className="label">Type</label>
              <select className="select" value={form.wf_type} onChange={e => set('wf_type', e.target.value)}>
                {TYPE_OPTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div><label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITY_OPTS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row"><label className="label">Assigned To</label><input className="input" value={form.assignee} onChange={e => set('assignee', e.target.value)} placeholder="Analyst name" /></div>
          <div className="form-row"><label className="label">Description</label><textarea className="textarea" rows={4} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailPanel({ wf, managers, onEdit, onClose }) {
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [role, setRole] = useState('analyst')

  const statusMut = useMutation({
    mutationFn: (s) => updateWorkflow(wf.id, { status: s }),
    onSuccess: () => qc.invalidateQueries(['workflows']),
  })

  const commentMut = useMutation({
    mutationFn: (body) => addComment(wf.id, { author: role === 'analyst' ? 'Analyst' : 'Portfolio Manager', role, body }),
    onSuccess: () => { qc.invalidateQueries(['workflows']); setComment('') },
    onError: () => toast.error('Failed to post comment'),
  })

  const delMut = useMutation({
    mutationFn: () => deleteWorkflow(wf.id),
    onSuccess: () => { qc.invalidateQueries(['workflows']); toast.success('Deleted'); onClose() },
  })

  return (
    <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card2)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
          WF-{String(wf.wf_number || 0).padStart(3, '0')} · {wf.assignee || 'Unassigned'} · {wf.created_at?.substring(0, 10)}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-.2px' }}>{wf.title}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: `${TYPE_COLORS[wf.wf_type]}18`, color: TYPE_COLORS[wf.wf_type] || 'var(--text2)' }}>{wf.wf_type}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRI_COLORS[wf.priority] || 'var(--text3)', display: 'inline-block' }} />
            {wf.priority}
          </span>
          {wf.manager_name && <span style={{ fontSize: 12, color: 'var(--text2)' }}>📌 {wf.manager_name}</span>}
          <select className="select" style={{ fontSize: 11, padding: '4px 8px', marginLeft: 'auto' }} value={wf.status} onChange={e => statusMut.mutate(e.target.value)}>
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏ Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Delete this workflow?')) delMut.mutate() }}>🗑</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {wf.description && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>{wf.description}</div>}
        <div className="sec-title">Activity ({wf.comments?.length || 0})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
          {(wf.comments || []).length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No activity yet.</div>}
          {(wf.comments || []).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: c.role === 'analyst' ? 'rgba(79,156,249,.12)' : 'rgba(34,197,94,.1)', border: `1px solid ${c.role === 'analyst' ? 'rgba(79,156,249,.2)' : 'rgba(34,197,94,.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c.role === 'analyst' ? 'var(--blue)' : 'var(--green)', flexShrink: 0 }}>
                {c.author.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.author}</span>
                  <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, fontWeight: 700, background: c.role === 'analyst' ? 'rgba(79,156,249,.12)' : 'rgba(34,197,94,.1)', color: c.role === 'analyst' ? 'var(--blue)' : 'var(--green)' }}>{c.role === 'analyst' ? 'Analyst' : 'PM'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{c.created_at?.substring(0, 16).replace('T', ' ')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px' }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment input */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--card2)', flexShrink: 0 }}>
        <textarea className="textarea" style={{ flex: 1, height: 64, minHeight: 'unset' }} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment or response…" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <select className="select" style={{ fontSize: 11, padding: '5px 8px' }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="analyst">Analyst</option><option value="pm">Portfolio Manager</option>
          </select>
          <button className="btn btn-primary btn-sm" disabled={!comment.trim() || commentMut.isPending} onClick={() => commentMut.mutate(comment)}>Post</button>
        </div>
      </div>
    </div>
  )
}

export default function Workflows() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [activeId, setActiveId] = useState(null)

  const { data: wfs = [], isLoading } = useQuery({ queryKey: ['workflows', statusFilter], queryFn: () => fetchWorkflows(statusFilter || undefined) })
  const { data: mgrData } = useQuery({ queryKey: ['managers', {}], queryFn: () => fetchManagers({ limit: 500 }) })
  const managers = mgrData?.items || []

  const activeWF = wfs.find(w => w.id === activeId)

  return (
    <div className="page" style={{ paddingBottom: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div><div className="page-title">Workflow Management</div><div className="page-sub">Due diligence, risk reviews & analyst Q&A</div></div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Workflow</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14, height: 'calc(100vh - 156px)' }}>
        {/* List */}
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Workflows <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({wfs.length})</span></span>
            <select className="select" style={{ fontSize: 11, padding: '4px 7px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>{STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {isLoading ? <div className="loading-center"><div className="spinner" /></div> : wfs.map(w => (
              <div key={w.id}
                style={{ border: `1px solid ${activeId === w.id ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, padding: '11px 12px', cursor: 'pointer', marginBottom: 5, background: activeId === w.id ? 'var(--gold-dim2)' : 'var(--bg3)', transition: 'all .15s' }}
                onClick={() => setActiveId(w.id)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>WF-{String(w.wf_number || 0).padStart(3, '0')}</span>
                  <span className={statusBadge(w.status)}>{w.status}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{w.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRI_COLORS[w.priority] || 'var(--text3)', display: 'inline-block', flexShrink: 0 }} />
                  <span>{w.priority}</span>·<span>{w.manager_name || 'General'}</span>·<span>{w.wf_type}</span>·<span>{w.comments?.length || 0} cmts</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        {activeWF ? (
          <DetailPanel wf={activeWF} managers={managers}
            onEdit={() => setModal(activeWF)}
            onClose={() => setActiveId(null)} />
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 10 }}>
            <div style={{ fontSize: 32, opacity: .3 }}>📋</div>
            <div>Select a workflow to view details</div>
          </div>
        )}
      </div>

      {modal && <WFModal wf={modal === 'create' ? null : modal} managers={managers} onClose={() => setModal(null)} />}
    </div>
  )
}
