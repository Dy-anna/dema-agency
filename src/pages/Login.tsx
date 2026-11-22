import { useState, type FormEvent } from 'react'
import { api } from '../lib/db'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { needsSetup, refresh } = useAuth()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { ok, payload } = needsSetup ? await api.setup(nom, email, password) : await api.login(email, password)
    if (!ok) { setError(payload.error ?? 'Erreur'); setBusy(false); return }
    await refresh()
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-logo">D</div>
          <div className="stack" style={{ gap: 0 }}>
            <span className="brand-name">DEMA Agency</span>
            <span className="small muted">Espace équipe</span>
          </div>
        </div>
        <h1 style={{ fontSize: 24 }}>{needsSetup ? 'Créer le compte gérant' : 'Connexion'}</h1>
        {needsSetup && <p className="small muted" style={{ margin: 0 }}>Première utilisation : ce compte aura tous les droits. Tu pourras ensuite ajouter ton associé et l’équipe.</p>}
        {needsSetup && (
          <label className="field">Nom
            <input required autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
        )}
        <label className="field">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Mot de passe{needsSetup ? ' (8 caractères minimum)' : ''}
          <input type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'} required minLength={needsSetup ? 8 : undefined}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <span className="error" role="alert">{error}</span>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Un instant…' : needsSetup ? 'Créer le compte' : 'Se connecter'}</button>
        {!needsSetup && <span className="small muted">Accès réservé à l’équipe. Les comptes sont créés par un gérant.</span>}
      </form>
    </div>
  )
}
