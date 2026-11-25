import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  activerPush, chargerAlertes, desactiverPush, diagnostic, navigateurIOS, envoyerTest, etatPush, marquerLues, toutMarquerLu, type Alerte,
} from '../lib/notifications'

export const ICONE_ALERTE: Record<Alerte['categorie'], string> = {
  tournage: '🎬', finance: '€', commercial: '✉', equipe: '👥', contrat: '✍', fiche: '☎', tache: '📋', chasse: '🎯',
}
type EtatPush = Awaited<ReturnType<typeof etatPush>>

const IconePartager = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="icône Partager" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)

function Etape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{n}</span>
      <span style={{ fontSize: 15, paddingTop: 3 }}>{children}</span>
    </div>
  )
}

export default function Notifications() {
  const nav = useNavigate()
  const [alertes, setAlertes] = useState<Alerte[] | null>(null)
  const [push, setPush] = useState<EtatPush | null>(null)
  const [vue, setVue] = useState<'non_lues' | 'toutes'>('non_lues')
  const [msg, setMsg] = useState('')
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    try { setAlertes((await chargerAlertes()).alertes) } catch { setAlertes([]) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { charger(); etatPush().then(setPush) }, [charger])

  const action = async (f: () => Promise<unknown>, ok: string) => {
    setOccupe(true); setMsg('')
    try { await f(); setMsg(ok) } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur') }
    setPush(await etatPush()); setOccupe(false)
  }
  const ouvrir = (a: Alerte) => {
    if (!a.lu) marquerLues([a.cle]).catch(() => {})
    window.dispatchEvent(new Event('dema:notifications'))
    nav(a.lien)
  }
  const toutLire = async () => {
    setAlertes((l) => l && l.map((a) => ({ ...a, lu: true })))
    await toutMarquerLu().catch(() => {})
    window.dispatchEvent(new Event('dema:notifications'))
  }

  const nonLues = (alertes ?? []).filter((a) => !a.lu)
  const liste = vue === 'non_lues' ? nonLues : alertes ?? []

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Toi</span>
          <h1>Notifications</h1>
        </div>
      </div>

      {/* ───── Ce téléphone ───── */}
      <section className="card" style={{ borderColor: push === 'actif' ? 'var(--green)' : 'var(--accent)', borderWidth: 2 }}>
        {push === null && <p className="muted" style={{ margin: 0 }}>Vérification de cet appareil…</p>}

        {push === 'actif' && (
          <>
            <h2>✅ Notifications activées sur ce téléphone</h2>
            <p className="muted" style={{ margin: 0 }}>Tu recevras les alertes même quand l’app est fermée.</p>
            <div className="row">
              <button type="button" className="btn primary" disabled={occupe} onClick={() => action(envoyerTest, 'Notification de test envoyée : elle doit arriver dans quelques secondes.')}>Envoyer un test</button>
              <button type="button" className="btn" disabled={occupe} onClick={() => action(desactiverPush, 'Notifications désactivées sur ce téléphone.')}>Désactiver</button>
            </div>
          </>
        )}

        {push === 'inactif' && (
          <>
            <h2>🔔 Recevoir les notifications sur ce téléphone</h2>
            <p className="muted" style={{ margin: 0 }}>Un seul bouton, puis « Autoriser ».</p>
            <button type="button" className="btn primary" style={{ height: 54, fontSize: 16 }} disabled={occupe}
              onClick={() => action(activerPush, 'C’est activé ! Appuie sur « Envoyer un test » pour vérifier.')}>
              {occupe ? 'Activation…' : 'Activer les notifications'}
            </button>
          </>
        )}

        {push === 'installer-ios' && (
          <>
            <h2>📲 Sur iPhone : installe d’abord l’app</h2>
            <p className="muted" style={{ margin: 0 }}>Apple n’autorise les notifications que dans l’app ajoutée à l’écran d’accueil. Ça prend 30 secondes :</p>
            {navigateurIOS() === 'Safari'
              ? <Etape n={1}>Touche le bouton <strong>Partager</strong> <IconePartager /> de Safari (en bas, ou à côté de l’adresse)</Etape>
              : <Etape n={1}>Tu es dans <strong>{navigateurIOS()}</strong> : touche l’icône <strong>Partager</strong> <IconePartager /> à droite de la barre d’adresse, en haut</Etape>}
            <Etape n={2}>Fais défiler et touche <strong>« Sur l’écran d’accueil »</strong>, puis <strong>Ajouter</strong></Etape>
            <Etape n={3}>Ferme {navigateurIOS()} et ouvre <strong>DEMA</strong> depuis la nouvelle icône sur ton écran d’accueil</Etape>
            <Etape n={4}>Connecte-toi et reviens ici : le bouton <strong>« Activer les notifications »</strong> sera là</Etape>
          </>
        )}

        {push === 'refuse' && (
          <>
            <h2>🚫 Notifications bloquées sur ce téléphone</h2>
            <Etape n={1}>iPhone : <strong>Réglages → Notifications → DEMA</strong> → active « Autoriser les notifications ». Android : appui long sur l’icône DEMA → <strong>Infos sur l’appli → Notifications</strong>.</Etape>
            <Etape n={2}>Reviens ici et recharge la page.</Etape>
          </>
        )}

        {push === 'non-supporte' && (
          <>
            <h2>Ce navigateur ne gère pas les notifications</h2>
            <p className="muted" style={{ margin: 0 }}>Sur iPhone : utilise <strong>Safari</strong> avec iOS 16.4 ou plus récent (Réglages → Général → Mise à jour). Sur Android : utilise <strong>Chrome</strong>.</p>
          </>
        )}

        {msg && <div className="banner amber" role="status"><span>{msg}</span></div>}
        {push !== null && push !== 'actif' && <span className="small muted">Appareil : {diagnostic()}</span>}
      </section>

      {/* ───── Ce que tu reçois ───── */}
      <section className="card" style={{ gap: 8 }}>
        <h2>Ce que tu reçois</h2>
        <span className="small"><strong>Tout de suite :</strong> une date ajoutée, confirmée, annulée ou déplacée au calendrier · une tâche ou une action de prospection qu’on t’attribue.</span>
        <span className="small"><strong>À 8 h et 18 h :</strong> tournages du jour et du lendemain · tâches à faire · impayés et relances · contrats à faire signer · actions de prospection du jour.</span>
      </section>

      {/* ───── Liste ───── */}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Filtrer">
          <button type="button" role="tab" aria-selected={vue === 'non_lues'} onClick={() => setVue('non_lues')}>Non lues ({nonLues.length})</button>
          <button type="button" role="tab" aria-selected={vue === 'toutes'} onClick={() => setVue('toutes')}>Toutes ({alertes?.length ?? 0})</button>
        </div>
        {nonLues.length > 0 && <button type="button" className="btn small" onClick={toutLire}>Tout marquer lu</button>}
      </div>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {alertes === null && <p className="muted" style={{ padding: 16 }}>Chargement…</p>}
        {alertes && liste.length === 0 && <p className="empty" style={{ padding: 16 }}>{vue === 'non_lues' ? 'Tout est lu 👌' : 'Rien à signaler.'}</p>}
        {liste.map((a) => (
          <button key={a.cle} type="button" className={'alerte ' + a.niveau + (a.lu ? ' lu' : '')} onClick={() => ouvrir(a)}>
            <span className="alerte-icone" aria-hidden="true">{ICONE_ALERTE[a.categorie]}</span>
            <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
              <span className="alerte-titre">{a.titre}</span>
              <span className="small muted">{a.texte}</span>
            </span>
            {!a.lu && <i className="alerte-point" aria-label="Non lue" />}
          </button>
        ))}
      </section>
    </>
  )
}
