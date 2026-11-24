import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { nomRole } from '../lib/format'

const lien = ({ isActive }: { isActive: boolean }) => 'nav-link' + (isActive ? ' active' : '')
const onglet = ({ isActive }: { isActive: boolean }) => 'tab' + (isActive ? ' active' : '')

// Sur téléphone, les tableaux deviennent des cartes : chaque cellule reçoit
// l'intitulé de sa colonne (data-label) pour rester lisible sans l'en-tête.
function etiqueterTableaux(racine: HTMLElement) {
  racine.querySelectorAll<HTMLTableElement>('.table-wrap table').forEach((t) => {
    const titres = Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '')
    if (!titres.length) return
    t.querySelectorAll('tbody tr').forEach((tr) => {
      let col = 0
      Array.from(tr.children).forEach((td) => {
        const span = (td as HTMLTableCellElement).colSpan || 1
        const label = span === 1 ? titres[col] ?? '' : ''
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label)
        col += span
      })
    })
  })
}

const Icone = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const ICONES = {
  accueil: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  clients: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  calendrier: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  projets: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  menu: 'M4 7h16M4 12h16M4 17h16',
}

export default function Layout() {
  const { profile, isGerant, signOut } = useAuth()
  const { pathname } = useLocation()
  const [menuOuvert, setMenuOuvert] = useState(false)
  const nom = profile?.nom || profile?.email || ''
  const initiales = nom.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  useEffect(() => { setMenuOuvert(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOuvert ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOuvert])
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main')
    if (!main) return
    etiqueterTableaux(main)
    const obs = new MutationObserver(() => etiqueterTableaux(main))
    obs.observe(main, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  const dansMenu = !['/', '/clients', '/calendrier', '/projets'].some((p) => p === '/' ? pathname === '/' : pathname.startsWith(p))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">D</div>
          <span className="brand-name">DEMA Agency</span>
        </div>
        <button type="button" className="topbar-avatar" aria-label="Ouvrir le menu" onClick={() => setMenuOuvert(true)}>{initiales || '?'}</button>
      </header>

      {menuOuvert && <div className="drawer-back" onClick={() => setMenuOuvert(false)} />}
      <nav className={'sidebar' + (menuOuvert ? ' open' : '')} aria-label="Navigation principale">
        <div className="brand">
          <div className="brand-logo">D</div>
          <div className="stack" style={{ gap: 0 }}>
            <span className="brand-name">DEMA Agency</span>
            <span className="brand-sub">CRM production</span>
          </div>
          <button type="button" className="drawer-close" aria-label="Fermer le menu" onClick={() => setMenuOuvert(false)}>×</button>
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

      <nav className="tabbar" aria-label="Navigation rapide">
        <NavLink to="/" end className={onglet}><Icone d={ICONES.accueil} /><span>Accueil</span></NavLink>
        <NavLink to="/clients" className={onglet}><Icone d={ICONES.clients} /><span>Clients</span></NavLink>
        <NavLink to="/calendrier" className={onglet}><Icone d={ICONES.calendrier} /><span>Calendrier</span></NavLink>
        <NavLink to="/projets" className={onglet}><Icone d={ICONES.projets} /><span>Projets</span></NavLink>
        <button type="button" className={'tab' + (dansMenu ? ' active' : '')} onClick={() => setMenuOuvert(true)}><Icone d={ICONES.menu} /><span>Plus</span></button>
      </nav>
    </div>
  )
}
