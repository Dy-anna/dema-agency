// Cloche en haut à droite : badge des non lues, ouvre la page Notifications
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { chargerAlertes } from '../lib/notifications'

export default function Cloche() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [nonLues, setNonLues] = useState(0)

  const charger = useCallback(async () => {
    try { setNonLues((await chargerAlertes()).nonLues) } catch { /* hors ligne */ }
  }, [])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 120000)
    const vis = () => { if (document.visibilityState === 'visible') charger() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('dema:notifications', charger)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('dema:notifications', charger) }
  }, [charger])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { charger() }, [pathname, charger])
  // Anciens liens de notification (?notifications=1)
  useEffect(() => { if (params.get('notifications') === '1') nav('/notifications', { replace: true }) }, [params, nav])

  return (
    <Link to="/notifications" className={'cloche' + (pathname === '/notifications' ? ' active' : '')} aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ''}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {nonLues > 0 && <span className="cloche-badge">{nonLues > 99 ? '99+' : nonLues}</span>}
    </Link>
  )
}
