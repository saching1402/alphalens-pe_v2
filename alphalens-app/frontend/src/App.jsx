import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Overview from './pages/Overview'
import Managers from './pages/Managers'
import Funds from './pages/Funds'
import Analytics from './pages/Analytics'
import Workflows from './pages/Workflows'
import Import from './pages/Import'

function Header() {
  const links = [
    { to: '/', label: 'Overview' },
    { to: '/managers', label: 'Fund Managers' },
    { to: '/funds', label: 'Funds' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/workflows', label: 'Workflows' },
    { to: '/import', label: 'Import Data' },
  ]

  return (
    <header style={{
      background: 'linear-gradient(180deg,#0d1117 0%,#0f1520 100%)',
      borderBottom: '1px solid var(--border)',
      padding: '0 28px',
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', gap: 28, height: 56,
      boxShadow: '0 2px 16px rgba(0,0,0,.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30,
          background: 'linear-gradient(135deg,var(--gold),var(--gold2))',
          borderRadius: 7, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 15, color: '#0d1117', fontWeight: 900,
        }}>◆</div>
        <div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700,
            background: 'linear-gradient(135deg,var(--gold2),var(--gold3))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>AlphaLens PE</div>
        </div>
        <span style={{ color: 'var(--border2)', fontSize: 18, margin: '0 2px' }}>|</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '.5px', textTransform: 'uppercase' }}>
          Buyout Intelligence
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            style={({ isActive }) => ({
              padding: '7px 13px', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              transition: 'all .15s',
              color: isActive ? 'var(--gold2)' : 'var(--text3)',
              background: isActive ? 'var(--gold-dim2)' : 'transparent',
              border: isActive ? '1px solid rgba(201,168,76,.15)' : '1px solid transparent',
            })}
          >{l.label}</NavLink>
        ))}
      </nav>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{
          padding: '4px 11px', borderRadius: 16, fontSize: 11, fontWeight: 600,
          background: 'var(--card)', color: 'var(--text2)', border: '1px solid var(--border)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginRight: 5, boxShadow: '0 0 6px var(--green)' }} />
          Live DB
        </div>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/funds" element={<Funds />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </div>
  )
}
