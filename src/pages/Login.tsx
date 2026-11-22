import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Identifiants incorrects.')
    setBusy(false)
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
        <h1 style={{ fontSize: 24 }}>Connexion</h1>
        <label className="field">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Mot de passe
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <span className="error" role="alert">{error}</span>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <span className="small muted">Accès réservé à l’équipe. Les comptes sont créés par un gérant.</span>
      </form>
    </div>
  )
}
