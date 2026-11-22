import { Link, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, nomStatutProjet, nomType } from '../lib/format'
import type { Projet, Tache } from '../lib/types'

export default function Projets() {
  const nav = useNavigate()
  const { data, error } = useLoad(async () => {
    const projets = must(await db.from('projets').select('*').order('date_evenement')) as Projet[]
    const taches = must(await db.from('taches').select('projet_id, fait')) as Pick<Tache, 'projet_id' | 'fait'>[]
    return { projets, taches }
  })

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const pct = (id: string) => {
    const t = data.taches.filter((x) => x.projet_id === id)
    return t.length ? Math.round((t.filter((x) => x.fait).length / t.length) * 100) : 0
  }

  return (
    <>
      <div className="stack">
        <span className="eyebrow">Production</span>
        <h1>Projets &amp; tâches</h1>
      </div>
      <section className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Projet</th><th>Type</th><th>Date</th><th>Statut</th><th style={{ width: 200 }}>Avancement</th></tr></thead>
            <tbody>
              {data.projets.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => nav(`/projets/${p.id}`)}>
                  <td><Link to={`/projets/${p.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{p.titre}</Link></td>
                  <td>{nomType(p.type_prestation)}</td>
                  <td>{dateFr(p.date_evenement)}</td>
                  <td><span className={'badge ' + (p.statut === 'production' ? 'indigo' : p.statut === 'livre' ? 'green' : 'amber')}>{nomStatutProjet[p.statut]}</span></td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <div className="progress" style={{ flex: 1 }}><div className="fill" style={{ width: pct(p.id) + '%' }} /></div>
                      <span className="small muted">{pct(p.id)} %</span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.projets.length === 0 && <tr><td colSpan={5} className="muted">Les projets sont créés automatiquement quand un devis est signé.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
