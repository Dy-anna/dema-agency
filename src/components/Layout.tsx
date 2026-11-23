import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { nomRole } from '../lib/format'

const lien = ({ isActive }: { isActive: boolean }) => 'nav-link' + (isActive ? ' active' : '')

export default function Layout() {
  const { profile, isGerant, signOut } = useAuth()
  const nom = profile?.nom || profile?.email || ''
  const initiales = nom.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="brand">
          <div className="brand-logo">D</div>
          <div className="stack" style={{ gap: 0 }}>
            <span className="brand-name">DEMA Agency</span>
            <span className="brand-sub">CRM production</span>
          </div>
        </div>
        <div className="nav-group">
          <span className="nav-label">COMMERCIAL</span>
          <NavLink to="/" end className={lien}>Tableau de bord</NavLink>
          <NavLink to="/clients" className={lien}>Clients</NavLink>
          {isGerant && <NavLink to="/pipeline" className={lien}>Pipeline &amp; devis</NavLink>}
        </div>
        <div className="nav-group">
          <span className="nav-label">PRODUCTION</span>
          <NavLink to="/projets" className={lien}>Projets &amp; tâches</NavLink>
          <NavLink to="/calendrier" className={lien}>Calendrier</NavLink>
          <NavLink to="/planning" className={lien}>Planning équipe</NavLink>
        </div>
        <div className="nav-group">
          <span className="nav-label">PILOTAGE</span>
          {isGerant && <NavLink to="/factures" className={lien}>Factures</NavLink>}
          {isGerant && <NavLink to="/fiscalite" className={lien}>Fiscalité</NavLink>}
          {isGerant && <NavLink to="/objectifs" className={lien}>Objectifs</NavLink>}
          {isGerant && <NavLink to="/parametres" className={lien}>Paramètres agence</NavLink>}
          <NavLink to="/equipe" className={lien}>Équipe &amp; compte</NavLink>
        </div>
        <div className="user-box">
          <div className="avatar">{initiales || '?'}</div>
          <div className="stack" style={{ gap: 0, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom}</span>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>{profile ? nomRole[profile.role] : 'Compte sans profil'}</span>
          </div>
          <button type="button" onClick={signOut}>Sortir</button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
