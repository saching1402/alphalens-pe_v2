import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { importExcel } from '../lib/api'

export default function Import() {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const mut = useMutation({
    mutationFn: importExcel,
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries(['managers'])
      qc.invalidateQueries(['funds'])
      qc.invalidateQueries(['dashboard'])
      toast.success(`Imported: ${data.managers_imported + data.managers_updated} managers, ${data.funds_imported + data.funds_updated} funds`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Import failed'),
  })

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error('Please upload an Excel file (.xlsx or .xls)'); return }
    setResult(null)
    mut.mutate(file)
  }

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }
  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Import Data</div>
        <div className="page-sub">Upload your Excel file to populate or update the database. Supports MM_Buyout_Fund_Manager_Info_Masked.xlsx format.</div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {/* Drop zone */}
        <div
          style={{
            border: `2px dashed ${dragging ? 'var(--gold)' : mut.isPending ? 'var(--blue)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all .2s',
            background: dragging ? 'var(--gold-dim2)' : mut.isPending ? 'rgba(79,156,249,.05)' : 'var(--card)',
            marginBottom: 24,
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !mut.isPending && fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {mut.isPending ? (
            <>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Importing…</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Processing Excel sheets and upserting to database</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                {dragging ? 'Drop to import' : 'Drag & drop your Excel file here'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>or click to browse</div>
              <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                Choose File
              </button>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>Supported: .xlsx, .xls</div>
            </>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>Import Complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
              {[
                ['Managers Created', result.managers_imported, 'var(--green)'],
                ['Managers Updated', result.managers_updated, 'var(--blue)'],
                ['Funds Created', result.funds_imported, 'var(--teal)'],
                ['Funds Updated', result.funds_updated, 'var(--amber)'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.7px', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
            {result.errors?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--amber)', marginBottom: 8 }}>⚠ {result.errors.length} Warning{result.errors.length !== 1 ? 's' : ''}</div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, maxHeight: 180, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 4, fontFamily: 'var(--mono)' }}>{e}</div>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schema reference */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Expected Excel Format</div>
          {[
            {
              sheet: 'Sheet 1: Fund Manager Info',
              cols: ['Fund ID', 'Masked Investor Name', 'Masked Fund Name', 'Vintage', 'Fund Size', 'Fund Type', 'Investments', 'IRR', 'TVPI', 'RVPI', 'DPI', 'Fund Quartile', 'IRR Benchmark*', 'TVPI Benchmark*', 'DPI Benchmark*', 'As of Quarter', 'As of Year', 'Preferred Geography', 'Preferred Industry', 'Total Investments'],
            },
            {
              sheet: 'Sheet 2: Consol View Values',
              cols: ['Masked Investor Name', 'Strategy', 'Pitchbook Mgr Score', 'AUM (USD M)', 'Description', 'Year Found', 'Segment', 'Latest Fund Size (USD M)'],
            },
          ].map(({ sheet, cols }) => (
            <div key={sheet} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold2)', marginBottom: 8 }}>{sheet}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cols.map(c => (
                  <span key={c} style={{ padding: '2px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{c}</span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8 }}>
            💡 Import is <strong style={{ color: 'var(--text2)' }}>idempotent</strong> — re-importing updates existing records rather than creating duplicates. Matching is done by Fund ID (raw) for funds and by manager name for managers.
          </div>
        </div>
      </div>
    </div>
  )
}
