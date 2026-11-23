import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dateFr, nomType } from '../lib/format'
import { ficheIncomplete } from '../lib/actions'
import type { Client, Evenement, Projet } from '../lib/types'

type Etat = 'en_cours' | 'valide' | 'a_confirmer'
const ETATS: { id: Etat | 'tous'; nom: string }[] = [
  { id: 'tous', nom: 'Tous' },
  { id: 'en_cours', nom: 'En cours' },
  { id: 'valide', nom: 'Validés' },
  { id: 'a_confirmer', nom: 'À confirmer' },
]
const BADGE: Record<Etat, [string, string]> = {
  en_cours: ['indigo', 'En cours de production'],
  valide: ['green', 'Validé'],
  a_confirmer: ['orange', 'À confirmer'],
}

interface Props {
  evenements: Evenement[]
  clients: Client[]
  projets: Projet[]
  avancement: (projetId: string) => number
}

/** Une ligne par projet (= une fiche client), avec toutes ses dates à venir */
export default function ProjetsAVenir({ evenements, clients, projets, avancement }: Props) {
  const [filtre, setFiltre] = useState<Etat | 'tous'>('tous')

  const parClient = new Map<string, Evenement[]>()
  for (const e of evenements) {
    const k = e.client_id ?? `sans-fiche-${e.id}`
    parClient.set(k, [...(parClient.get(k) ?? []), e])
  }

  const lignes = [...parClient.entries()].map(([cle, evts]) => {
    const client = clients.find((c) => c.id === cle)
    const projet = projets.find((p) => p.client_id === cle)
    const etat: Etat = projet?.statut === 'production' ? 'en_cours'
      : evts.some((e) => e.statut === 'confirme') || client?.statut_commercial === 'client' ? 'valide' : 'a_confirmer'
    return { cle, client, projet, evts, etat, premiere: evts[0].date }
  }).sort((a, b) => a.premiere.localeCompare(b.premiere))

  const compte = (id: Etat | 'tous') => (id === 'tous' ? lignes.length : lignes.filter((l) => l.etat === id).length)
  const visibles = lignes.filter((l) => filtre === 'tous' || l.etat === filtre)

  return (
    <section className="card">
      <div className="card-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2>Projets à venir</h2>
          <span className="small muted">Toutes les dates du calendrier sur les 12 prochains mois</span>
        </div>
        <div className="row">
          <div className="seg" role="tablist" aria-label="Filtrer les projets">
            {ETATS.map((e) => (
              <button key={e.id} type="button" role="tab" aria-selected={filtre === e.id} onClick={() => setFiltre(e.id)}>
                {e.nom} ({compte(e.id)})
              </button>
            ))}
          </div>
          <Link to="/calendrier" className="btn small">Calendrier</Link>
        </div>
      </div>

      {visibles.length === 0 && <p className="empty">Aucun projet {filtre === 'tous' ? 'à venir' : 'dans cette catégorie'}.</p>}

      <div className="table-wrap">
        <table>
          {visibles.length > 0 && (
            <thead><tr><th style={{ width: 70 }}>Date</th><th>Projet</th><th>Dates</th><th>Statut</th><th style={{ width: 150 }}>Avancement</th></tr></thead>
          )}
          <tbody>
            {visibles.map((l) => {
              const d = new Date(l.premiere + 'T12:00:00')
              const lien = l.projet ? `/projets/${l.projet.id}` : l.client ? `/clients/${l.client.id}` : '/calendrier'
              const [cls, label] = BADGE[l.etat]
              const pct = l.projet ? avancement(l.projet.id) : 0
              return (
                <tr key={l.cle}>
                  <td>
                    <div style={{ width: 52, borderRadius: 10, overflow: 'hidden', textAlign: 'center', border: '1px solid var(--line)' }}>
                      <div style={{ background: 'var(--ink)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 0', textTransform: 'uppercase' }}>
                        {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')} {String(d.getFullYear()).slice(2)}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700 }}>{d.getDate()}</div>
                    </div>
                  </td>
                  <td>
                    <Link to={lien} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{l.client?.nom ?? l.evts[0].titre}</Link>
                    <div className="small muted row" style={{ gap: 6 }}>
                      {nomType(l.client?.type_prestation ?? l.evts[0].type_prestation)}
                      {ficheIncomplete(l.client) && <span className="row" style={{ gap: 4, color: 'var(--red)' }}><i className="dot" />coordonnées à compléter</span>}
                    </div>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 2 }}>
                      {l.evts.map((e) => (
                        <span key={e.id} className="small">
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: e.statut === 'confirme' ? 'var(--green)' : 'var(--orange)' }} />
                          {dateFr(e.date, { day: 'numeric', month: 'short' })}
                          {e.titre !== l.client?.nom && e.titre.includes('—') ? ` · ${e.titre.split('—').slice(1).join('—').trim()}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td><span className={'badge ' + cls}>{label}</span></td>
                  <td>
                    {l.projet && l.etat === 'en_cours' ? (
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <div className="progress" style={{ flex: 1 }}><div className="fill" style={{ width: pct + '%' }} /></div>
                        <span className="small muted">{pct} %</span>
                      </div>
                    ) : <span className="small muted">{l.etat === 'valide' ? 'En attente d’acompte' : 'Devis / confirmation'}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
