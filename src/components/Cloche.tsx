import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  activerPush, chargerAlertes, desactiverPush, envoyerTest, etatPush, marquerLues, toutMarquerLu, type Alerte,
} from '../lib/notifications'

const ICONE: Record<Alerte['categorie'], string> = {
  tournage: '🎬', finance: '€', commercial: '✉', equipe: '👥', contrat: '✍', fiche: '☎', tache: '✓',
}
type EtatPush = Awaited<ReturnType<typeof etatPush>>

export default function Cloche() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const [ouvert, setOuvert] = useState(false)
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [push, setPush] = useState<EtatPush | null>(null)
  const [msg, setMsg] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    try { setAlertes((await chargerAlertes()).alertes) } catch { /* hors ligne : on garde la liste */ }
  }, [])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 120000)
    const vis = () => { if (document.visibilityState === 'visible') charger() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [charger])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { charger() }, [pathname, charger])
  useEffect(() => {
    if (params.get('notifications') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOuvert(true)
      params.delete('notifications'); setParams(params, { replace: true })
    }
  }, [params, setParams])
  useEffect(() => { if (ouvert) etatPush().then(setPush) }, [ouvert])

  const nonLues = alertes.filter((a) => !a.lu).length

  const ouvrir = async (a: Alerte) => {
    setOuvert(false)
    if (!a.lu) { setAlertes(alertes.map((x) => (x.cle === a.cle ? { ...x, lu: true } : x))); marquerLues([a.cle]).catch(() => {}) }
    nav(a.lien)
  }
  const toutLire = async () => { setAlertes(alertes.map((a) => ({ ...a, lu: true }))); await toutMarquerLu().catch(() => {}) }

  const action = async (f: () => Promise<unknown>, ok: string) => {
    setOccupe(true); setMsg('')
    try { await f(); setMsg(ok) } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur') }
    setPush(await etatPush()); setOccupe(false)
  }

  return (
    <>
      <button type="button" className="cloche" aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ''}`} onClick={() => setOuvert(!ouvert)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {nonLues > 0 && <span className="cloche-badge">{nonLues > 99 ? '99+' : nonLues}</span>}
      </button>

      {ouvert && <div className="cloche-back" onClick={() => setOuvert(false)} />}
      {ouvert && (
        <section className="cloche-panel" role="dialog" aria-label="Notifications">
          <div className="cloche-head">
            <h2>Notifications</h2>
            <div className="row" style={{ gap: 6 }}>
              {nonLues > 0 && <button type="button" className="btn small" onClick={toutLire}>Tout marquer lu</button>}
              <button type="button" className="btn small" aria-label="Fermer" onClick={() => setOuvert(false)}>×</button>
            </div>
          </div>

          <div className="cloche-push">
            {push === 'actif' && (
              <>
                <span className="small"><strong>🔔 Notifications activées</strong> sur cet appareil : tournages, impayés, relances, contrats. Envoi à 8 h et 18 h.</span>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn small" disabled={occupe} onClick={() => action(envoyerTest, 'Notification de test envoyée.')}>Tester</button>
                  <button type="button" className="btn small" disabled={occupe} onClick={() => action(desactiverPush, 'Notifications désactivées sur cet appareil.')}>Désactiver</button>
                </div>
              </>
            )}
            {push === 'inactif' && (
              <>
                <span className="small">Reçois les alertes sur ce téléphone, même quand l’app est fermée.</span>
                <button type="button" className="btn small primary" disabled={occupe} onClick={() => action(activerPush, 'C’est activé ! Appuie sur « Tester » pour vérifier.')}>Activer sur cet appareil</button>
              </>
            )}
            {push === 'installer-ios' && (
              <span className="small">
                <strong>Sur iPhone</strong>, ajoute d’abord l’app à l’écran d’accueil : dans Safari, touche <strong>Partager</strong> (carré avec flèche) → <strong>Sur l’écran d’accueil</strong>. Ouvre ensuite DEMA depuis l’icône, puis active les notifications ici.
              </span>
            )}
            {push === 'refuse' && <span className="small">Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur ou du téléphone, puis reviens ici.</span>}
            {push === 'non-supporte' && <span className="small">Ce navigateur ne gère pas les notifications push. Sur iPhone, utilise Safari (iOS 16.4 ou plus) ; sur Android, Chrome.</span>}
            {msg && <span className="small" style={{ fontWeight: 600 }}>{msg}</span>}
          </div>

          <div className="cloche-liste">
            {alertes.length === 0 && <p className="empty" style={{ padding: 16 }}>Rien à signaler. Tout est à jour 👌</p>}
            {alertes.map((a) => (
              <button key={a.cle} type="button" className={'alerte ' + a.niveau + (a.lu ? ' lu' : '')} onClick={() => ouvrir(a)}>
                <span className="alerte-icone" aria-hidden="true">{ICONE[a.categorie]}</span>
                <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                  <span className="alerte-titre">{a.titre}</span>
                  <span className="small muted">{a.texte}</span>
                </span>
                {!a.lu && <i className="alerte-point" aria-label="Non lue" />}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
