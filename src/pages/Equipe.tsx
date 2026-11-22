import { useState, type FormEvent } from 'react'
import { api } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad } from '../lib/useLoad'
import { nomRole } from '../lib/format'
import type { Role } from '../lib/types'

interface Membre { id: string; email: string; nom: string; role: Role; actif: boolean }
const ROLES: Role[] = ['gerant', 'chef_projet', 'assistant']

export default function Equipe() {
  const { profile, isGerant } = useAuth()
  const [msg, setMsg] = useState('')
  const [nouveau, setNouveau] = useState({ nom: '', email: '', role: 'assistant', password: '' })
  const [mdp, setMdp] = useState({ ancien: '', nouveau: '' })

  const { data, reload } = useLoad(async () => (await api.team()).data as Membre[])

  const ajouter = async (e: FormEvent) => {
    e.preventDefault()
    const { ok, payload } = await api.addMember(nouveau)
    setMsg(ok ? `Compte créé pour ${nouveau.nom}. Transmets-lui son mot de passe provisoire.` : payload.error)
    if (ok) { setNouveau({ nom: '', email: '', role: 'assistant', password: '' }); reload() }
  }
  const maj = async (m: Membre, patch: { role?: string; actif?: boolean; password?: string }) => {
    const { ok, payload } = await api.updateMember({ id: m.id, ...patch })
    setMsg(ok ? 'Modification enregistrée.' : payload.error); reload()
  }
  const reinit = (m: Membre) => {
    const p = prompt(`Nouveau mot de passe provisoire pour ${m.nom} (8 caractères min.) :`)
    if (p) maj(m, { password: p })
  }
  const changerMdp = async (e: FormEvent) => {
    e.preventDefault()
    const { ok, payload } = await api.changePassword(mdp.ancien, mdp.nouveau)
    setMsg(ok ? 'Mot de passe modifié.' : payload.error)
    if (ok) setMdp({ ancien: '', nouveau: '' })
  }

  return (
    <>
      <div className="stack">
        <span className="eyebrow">Pilotage</span>
        <h1>Équipe &amp; compte</h1>
      </div>
      {msg && <div className="banner amber" role="status"><span>{msg}</span></div>}

      <section className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Statut</th>{isGerant && <th />}</tr></thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.nom}{m.id === profile?.id ? ' (toi)' : ''}</td>
                  <td className="muted">{m.email}</td>
                  <td>
                    {isGerant && m.id !== profile?.id ? (
                      <select className="input" style={{ height: 36 }} aria-label={`Rôle de ${m.nom}`} value={m.role} onChange={(e) => maj(m, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{nomRole[r]}</option>)}
                      </select>
                    ) : nomRole[m.role]}
                  </td>
                  <td><span className={'badge ' + (m.actif ? 'green' : 'grey')}>{m.actif ? 'Actif' : 'Désactivé'}</span></td>
                  {isGerant && (
                    <td>
                      {m.id !== profile?.id && (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button className="btn small" type="button" onClick={() => reinit(m)}>Réinitialiser le mot de passe</button>
                          <button className="btn small" type="button" onClick={() => maj(m, { actif: !m.actif })}>{m.actif ? 'Désactiver' : 'Réactiver'}</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-cards">
        {isGerant && (
          <form className="card" onSubmit={ajouter}>
            <h2>Ajouter un membre</h2>
            <div className="form-grid">
              <label className="field">Nom<input required value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} /></label>
              <label className="field">E-mail<input type="email" required value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} /></label>
              <label className="field">Rôle
                <select value={nouveau.role} onChange={(e) => setNouveau({ ...nouveau, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{nomRole[r]}</option>)}
                </select>
              </label>
              <label className="field">Mot de passe provisoire<input required minLength={8} value={nouveau.password} onChange={(e) => setNouveau({ ...nouveau, password: e.target.value })} /></label>
            </div>
            <span className="small muted">Chef de projet et assistant n’ont pas accès aux devis, à la finance ni aux objectifs.</span>
            <button className="btn primary" type="submit">Créer le compte</button>
          </form>
        )}
        <form className="card" onSubmit={changerMdp}>
          <h2>Mon mot de passe</h2>
          <label className="field">Mot de passe actuel<input type="password" autoComplete="current-password" required value={mdp.ancien} onChange={(e) => setMdp({ ...mdp, ancien: e.target.value })} /></label>
          <label className="field">Nouveau mot de passe<input type="password" autoComplete="new-password" required minLength={8} value={mdp.nouveau} onChange={(e) => setMdp({ ...mdp, nouveau: e.target.value })} /></label>
          <button className="btn" type="submit">Changer le mot de passe</button>
        </form>
      </div>
    </>
  )
}
