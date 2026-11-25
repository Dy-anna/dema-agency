import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, isoDate } from '../lib/format'
import { duree, etatContrat, joursRestants, nomTypeContrat, sansContrat, statutContrat } from '../lib/contrats'
import type { Affectation, Contrat, Evenement, Profile } from '../lib/types'

const FILTRES = [
  { id: 'actifs', nom: 'En cours & à venir' },
  { id: 'a_signer', nom: 'À signer' },
  { id: 'formation', nom: 'Formations' },
  { id: 'termines', nom: 'Terminés' },
  { id: 'tous', nom: 'Tous' },
] as const

export default function Contrats() {
  const nav = useNavigate()
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]['id']>('actifs')
  const today = isoDate(new Date())
  const { data, error } = useLoad(async () => {
    const [c, a, e, p] = await Promise.all([
      db.from('contrats').select('*').order('date_debut', { ascending: false, nullsFirst: true }),
      db.from('affectations').select('*'),
      db.from('evenements').select('*').gte('date', today).neq('statut', 'annule'),
      db.from('profiles').select('id, nom, role'),
    ])
    return { contrats: must(c) as Contrat[], affectations: must(a) as Affectation[], evenements: must(e) as Evenement[], equipe: must(p) as Profile[] }
  }, [today])

  if (error) return <p className="error">{error}</p>
  const contrats = data?.contrats ?? []
  const etat = (c: Contrat) => etatContrat(c, today)
  const liste = contrats.filter((c) => {
    const e = etat(c)
    if (filtre === 'actifs') return e === 'en_cours' || e === 'a_venir' || e === 'a_signer'
    if (filtre === 'a_signer') return e === 'a_signer'
    if (filtre === 'formation') return c.type === 'formation' && e !== 'annule'
    if (filtre === 'termines') return e === 'termine' || e === 'annule'
    return true
  })
  const enCours = contrats.filter((c) => etat(c) === 'en_cours')
  const aSigner = contrats.filter((c) => etat(c) === 'a_signer')
  const bientotFinis = contrats.filter((c) => etat(c) === 'en_cours' && (joursRestants(c, today) ?? 99) <= 30)
  const manquants = data ? sansContrat(contrats, data.affectations, data.evenements, data.equipe) : []

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Production · gérants uniquement</span>
          <h1>Contrats</h1>
          <span className="muted small">Les personnes qu’on emmène avec nous : en formation, freelance, stage ou bénévole.</span>
        </div>
        <Link className="btn primary" to="/contrats/nouveau">+ Nouveau contrat</Link>
      </div>

      <div className="grid-kpi">
        <div className="kpi"><span className="kpi-label">En cours</span><span className="kpi-value">{enCours.length}</span><span className="kpi-sub">dont {enCours.filter((c) => c.type === 'formation').length} en formation</span></div>
        <div className="kpi"><span className="kpi-label">À faire signer</span><span className="kpi-value" style={{ color: aSigner.length ? 'var(--orange)' : undefined }}>{aSigner.length}</span><span className="kpi-sub">brouillons et envoyés</span></div>
        <div className="kpi"><span className="kpi-label">Se terminent sous 30 jours</span><span className="kpi-value">{bientotFinis.length}</span><span className="kpi-sub">{bientotFinis.map((c) => c.nom).join(', ') || 'Aucun'}</span></div>
        <div className="kpi"><span className="kpi-label">Au planning sans contrat signé</span><span className="kpi-value" style={{ color: manquants.length ? 'var(--red)' : undefined }}>{manquants.length}</span><span className="kpi-sub">personnes affectées à une date</span></div>
      </div>

      {manquants.length > 0 && (
        <div className="banner red" role="alert">
          <span>
            <strong>À régulariser avant le tournage</strong> · {manquants.map((m) => `${m.nom} (${m.dates.sort().slice(0, 3).map((x) => dateFr(x, { day: 'numeric', month: 'short' })).join(', ')})`).join(' · ')}
          </span>
          <Link className="btn small" to={`/contrats/nouveau?nom=${encodeURIComponent(manquants[0].nom)}`}>Créer le contrat de {manquants[0].nom}</Link>
        </div>
      )}

      <div className="seg" role="tablist" aria-label="Filtrer" style={{ alignSelf: 'flex-start' }}>
        {FILTRES.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>{f.nom}</button>)}
      </div>

      <section className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Personne</th><th>Type</th><th>Poste</th><th>Période</th><th>Rythme</th><th>Statut</th></tr></thead>
            <tbody>
              {liste.map((c) => {
                const s = statutContrat(c.statut)
                const r = joursRestants(c, today)
                const e = etat(c)
                return (
                  <tr key={c.id} className="clickable" onClick={() => nav(`/contrats/${c.id}`)}>
                    <td><Link to={`/contrats/${c.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{c.nom}</Link></td>
                    <td>{nomTypeContrat(c.type)}</td>
                    <td>{c.poste}</td>
                    <td>
                      <div className="stack" style={{ gap: 0 }}>
                        <span>{c.date_debut ? dateFr(c.date_debut, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} → {c.date_fin ? dateFr(c.date_fin, { day: 'numeric', month: 'short', year: 'numeric' }) : 'sans fin'}</span>
                        <span className="small muted">
                          {duree(c.date_debut, c.date_fin)}
                          {e === 'en_cours' && r !== null && ` · encore ${r} j`}
                          {e === 'a_venir' && ' · commence bientôt'}
                        </span>
                      </div>
                    </td>
                    <td className="muted">{c.rythme || '—'}</td>
                    <td><span className={'badge ' + (e === 'en_cours' ? 'green' : s.badge)}>{e === 'en_cours' ? 'En cours' : e === 'a_venir' ? 'Signé · à venir' : e === 'termine' ? 'Terminé' : s.nom}</span></td>
                  </tr>
                )
              })}
              {data && liste.length === 0 && <tr><td colSpan={6} className="muted">Aucun contrat ici. Crée le premier avec « + Nouveau contrat ».</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
