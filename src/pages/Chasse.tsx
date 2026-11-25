import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro, isoDate } from '../lib/format'
import { STATUTS_CIBLE, iconeAction, nomCategorie, plusJours, statutCible } from '../lib/chasse'
import type { Cible, CibleAction, Profile } from '../lib/types'

const ONGLETS = [{ id: 'actions', nom: 'Actions à faire' }, { id: 'cibles', nom: 'Toutes les cibles' }] as const
const FILTRES = [
  { id: 'actives', nom: 'Actives' },
  { id: 'A', nom: 'Priorité A' },
  { id: 'rdv', nom: 'RDV obtenus' },
  { id: 'converti', nom: 'Devenues prospects' },
  { id: 'pas_interesse', nom: 'Pas intéressées' },
  { id: 'toutes', nom: 'Toutes' },
] as const
const actives = (c: Cible) => c.statut !== 'converti' && c.statut !== 'pas_interesse'

export default function Chasse() {
  const nav = useNavigate()
  const { profile, isGerant } = useAuth()
  const today = isoDate(new Date())
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]['id']>('actions')
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]['id']>('actives')
  const [mesActions, setMesActions] = useState(false)
  const [recherche, setRecherche] = useState('')

  const { data, error, setData } = useLoad(async () => {
    const [c, a, p] = await Promise.all([
      db.from('cibles').select('*').order('created_at', { ascending: false }),
      db.from('cible_actions').select('*').order('echeance', { ascending: true, nullsFirst: false }),
      db.from('profiles').select('id, nom, role').order('nom'),
    ])
    return { cibles: must(c) as Cible[], actions: must(a) as CibleAction[], equipe: must(p) as Profile[] }
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const cibleDe = (id: string) => data.cibles.find((c) => c.id === id)
  const nomDe = (id: string | null) => (id ? data.equipe.find((m) => m.id === id)?.nom ?? '' : '')
  const ouvertes = data.actions.filter((a) => !a.fait && actives(cibleDe(a.cible_id) ?? ({ statut: 'a_cibler' } as Cible)))
  const prochaine = (cid: string) => ouvertes.find((a) => a.cible_id === cid)
  const semaine = plusJours(today, 7)

  const enRetard = ouvertes.filter((a) => a.echeance && a.echeance < today)
  const ajd = ouvertes.filter((a) => a.echeance === today)
  const cetteSemaine = ouvertes.filter((a) => a.echeance && a.echeance > today && a.echeance <= semaine)
  const plusTard = ouvertes.filter((a) => a.echeance && a.echeance > semaine)
  const sansDate = ouvertes.filter((a) => !a.echeance)
  const ciblesActives = data.cibles.filter(actives)
  const sansAction = ciblesActives.filter((c) => !prochaine(c.id))

  const cocher = async (a: CibleAction) => {
    const fait = !a.fait
    setData({ ...data, actions: data.actions.map((x) => (x.id === a.id ? { ...x, fait, fait_le: fait ? today : null } : x)) })
    await db.from('cible_actions').update({ fait, fait_le: fait ? today : null }).eq('id', a.id)
    const c = cibleDe(a.cible_id)
    if (fait && c) {
      const statut = a.type === 'rdv' ? 'rdv' : c.statut === 'a_cibler' && a.type !== 'recherche' ? 'contacte' : null
      if (statut && statut !== c.statut) {
        await db.from('cibles').update({ statut }).eq('id', c.id)
        setData((d) => d && { ...d, cibles: d.cibles.map((x) => (x.id === c.id ? { ...x, statut } : x)), actions: d.actions.map((x) => (x.id === a.id ? { ...x, fait, fait_le: today } : x)) })
      }
    }
  }

  const filtrerMes = (l: CibleAction[]) => (mesActions ? l.filter((a) => a.assigne_a === profile?.id || (!a.assigne_a && cibleDe(a.cible_id)?.responsable_id === profile?.id)) : l)

  const groupe = (titre: string, liste: CibleAction[], couleur?: string) => {
    const l = filtrerMes(liste)
    if (!l.length) return null
    return (
      <section className="card" style={{ gap: 4 }}>
        <div className="card-head" style={{ paddingBottom: 6 }}>
          <h2 style={{ color: couleur }}>{titre}</h2>
          <span className="badge grey">{l.length}</span>
        </div>
        {l.map((a) => {
          const c = cibleDe(a.cible_id)
          return (
            <div key={a.id} className="checkline" style={{ alignItems: 'flex-start' }}>
              <label style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={a.fait} onChange={() => cocher(a)} style={{ marginTop: 3 }} />
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span><span aria-hidden="true">{iconeAction(a.type)} </span>{a.titre}</span>
                  <span className="small muted">
                    <Link to={`/chasse/${a.cible_id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>{c?.nom}</Link>
                    {c?.priorite === 'A' && <span className="badge red" style={{ marginLeft: 6, padding: '0 7px' }}>A</span>}
                    {a.echeance && ` · ${a.echeance === today ? 'aujourd’hui' : dateFr(a.echeance, { weekday: 'short', day: 'numeric', month: 'short' })}`}
                    {nomDe(a.assigne_a ?? c?.responsable_id ?? null) && ` · ${nomDe(a.assigne_a ?? c?.responsable_id ?? null)}`}
                  </span>
                </span>
              </label>
            </div>
          )
        })}
      </section>
    )
  }

  const q = recherche.trim().toLowerCase()
  const liste = data.cibles.filter((c) => {
    if (q && !`${c.nom} ${c.contact_nom ?? ''} ${c.source ?? ''}`.toLowerCase().includes(q)) return false
    if (filtre === 'actives') return actives(c)
    if (filtre === 'A') return actives(c) && c.priorite === 'A'
    if (filtre === 'toutes') return true
    return c.statut === filtre
  }).sort((a, b) => a.priorite.localeCompare(b.priorite))

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Commercial</span>
          <h1>Chasseur de têtes</h1>
          <span className="muted small">Les clients qu’on veut aller chercher, et les actions à poser pour les décrocher.</span>
        </div>
        <Link className="btn primary" to="/chasse/nouveau">+ Nouvelle cible</Link>
      </div>

      <div className="grid-kpi">
        <div className="kpi"><span className="kpi-label">Cibles actives</span><span className="kpi-value">{ciblesActives.length}</span><span className="kpi-sub">dont {ciblesActives.filter((c) => c.priorite === 'A').length} en priorité A</span></div>
        <div className="kpi"><span className="kpi-label">Actions en retard</span><span className="kpi-value" style={{ color: enRetard.length ? 'var(--red)' : undefined }}>{enRetard.length}</span><span className="kpi-sub">{ajd.length} aujourd’hui · {cetteSemaine.length} cette semaine</span></div>
        <div className="kpi"><span className="kpi-label">RDV obtenus</span><span className="kpi-value">{data.cibles.filter((c) => c.statut === 'rdv').length}</span><span className="kpi-sub">{data.cibles.filter((c) => c.statut === 'converti').length} devenues prospects</span></div>
        {isGerant && <div className="kpi"><span className="kpi-label">Potentiel des cibles actives</span><span className="kpi-value">{euro(ciblesActives.reduce((s, c) => s + Number(c.potentiel || 0), 0))}</span><span className="kpi-sub">estimation par an</span></div>}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Vue">
          {ONGLETS.map((o) => <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}>{o.nom}</button>)}
        </div>
        {onglet === 'actions' && (
          <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={mesActions} onChange={(e) => setMesActions(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
            Seulement mes actions
          </label>
        )}
      </div>

      {onglet === 'actions' && (
        <>
          {ouvertes.length === 0 && (
            <section className="card">
              <p className="empty">{data.cibles.length === 0 ? 'Aucune cible pour l’instant. Ajoute les entreprises, institutions ou personnes que tu veux décrocher.' : 'Aucune action prévue. Ouvre une cible pour ajouter la suite.'}</p>
              {data.cibles.length === 0 && <Link className="btn primary" to="/chasse/nouveau" style={{ alignSelf: 'flex-start' }}>+ Ajouter une première cible</Link>}
            </section>
          )}
          {groupe('En retard', enRetard, 'var(--red)')}
          {groupe('Aujourd’hui', ajd, 'var(--accent-dark)')}
          {groupe('Cette semaine', cetteSemaine)}
          {groupe('Plus tard', plusTard)}
          {groupe('Sans date', sansDate)}
          {sansAction.length > 0 && (
            <div className="banner amber">
              <span><strong>{sansAction.length} cible{sansAction.length > 1 ? 's' : ''} sans prochaine action</strong> · {sansAction.slice(0, 5).map((c) => c.nom).join(', ')}{sansAction.length > 5 ? '…' : ''}</span>
              <Link className="btn small" to={`/chasse/${sansAction[0].id}`}>Planifier</Link>
            </div>
          )}
        </>
      )}

      {onglet === 'cibles' && (
        <>
          <div className="row">
            <div className="seg" role="tablist" aria-label="Filtrer">
              {FILTRES.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>{f.nom}</button>)}
            </div>
            <input className="input" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <section className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cible</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Prochaine action</th>{isGerant && <th style={{ textAlign: 'right' }}>Potentiel</th>}</tr></thead>
                <tbody>
                  {liste.map((c) => {
                    const p = prochaine(c.id)
                    const s = statutCible(c.statut)
                    return (
                      <tr key={c.id} className="clickable" onClick={() => nav(`/chasse/${c.id}`)}>
                        <td>
                          <Link to={`/chasse/${c.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{c.nom}</Link>
                          {c.contact_nom && <div className="small muted">{c.contact_nom}{c.contact_role ? ` · ${c.contact_role}` : ''}</div>}
                        </td>
                        <td>{nomCategorie(c.categorie)}</td>
                        <td><span className={'badge ' + (c.priorite === 'A' ? 'red' : c.priorite === 'B' ? 'amber' : 'grey')}>{c.priorite}</span></td>
                        <td><span className={'badge ' + s.badge}>{s.nom}</span></td>
                        <td>
                          {p ? (
                            <span className="small" style={{ color: p.echeance && p.echeance < today ? 'var(--red)' : undefined }}>
                              {iconeAction(p.type)} {p.titre}{p.echeance ? ` · ${dateFr(p.echeance, { day: 'numeric', month: 'short' })}` : ''}
                            </span>
                          ) : <span className="small muted">{actives(c) ? 'À planifier' : '—'}</span>}
                        </td>
                        {isGerant && <td style={{ textAlign: 'right' }}>{c.potentiel ? euro(c.potentiel) : '—'}</td>}
                      </tr>
                    )
                  })}
                  {liste.length === 0 && <tr><td colSpan={6} className="muted">Aucune cible ici.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <span className="small muted">Statuts : {STATUTS_CIBLE.map((s) => s.nom).join(' → ')}</span>
        </>
      )}
    </>
  )
}
