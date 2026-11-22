import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, nomType } from '../lib/format'
import type { Client, StatutCommercial } from '../lib/types'

const FILTRES: { id: StatutCommercial | 'tous'; nom: string }[] = [
  { id: 'tous', nom: 'Tous' },
  { id: 'prospect', nom: 'Prospects' },
  { id: 'client', nom: 'Clients' },
  { id: 'perdu', nom: 'Perdus' },
]

export default function Clients() {
  const nav = useNavigate()
  const [filtre, setFiltre] = useState<StatutCommercial | 'tous'>('tous')
  const [q, setQ] = useState('')
  const { data, error } = useLoad(async () => must(await supabase.from('clients').select('*').order('created_at', { ascending: false })) as Client[])

  const liste = (data ?? []).filter((c) =>
    (filtre === 'tous' || c.statut_commercial === filtre) &&
    (!q || `${c.nom} ${c.contact ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Commercial</span>
          <h1>Clients &amp; prospects</h1>
        </div>
        <Link className="btn primary" to="/clients/nouveau">+ Nouveau prospect</Link>
      </div>

      <div className="row">
        <div className="seg" role="tablist" aria-label="Filtrer">
          {FILTRES.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>{f.nom}</button>
          ))}
        </div>
        <input className="input" type="search" placeholder="Rechercher…" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      <section className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Date de l’événement</th><th>Contact</th><th>Statut</th></tr></thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => nav(`/clients/${c.id}`)}>
                  <td><Link to={`/clients/${c.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{c.nom}</Link></td>
                  <td>{nomType(c.type_prestation)}</td>
                  <td>{dateFr(c.date_evenement)}</td>
                  <td className="muted">{c.email || c.telephone || '—'}</td>
                  <td><span className={'badge ' + (c.statut_commercial === 'client' ? 'green' : c.statut_commercial === 'perdu' ? 'grey' : 'amber')}>
                    {c.statut_commercial === 'client' ? 'Client' : c.statut_commercial === 'perdu' ? 'Perdu' : 'Prospect'}
                  </span></td>
                </tr>
              ))}
              {data && liste.length === 0 && <tr><td colSpan={5} className="muted">Aucun résultat.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
