// Feuille de route imprimable pour le jour J (toute l'équipe y a accès)
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, nomStatutEvenement, nomType } from '../lib/format'
import { QUESTIONS } from '../components/FicheEvenement'
import type { Affectation, Client, Evenement, Profile } from '../lib/types'

export default function FeuilleDeRoute() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, error } = useLoad(async () => {
    const client = must(await db.from('clients').select('*').eq('id', id!).single()) as Client
    const evenements = must(await db.from('evenements').select('*').eq('client_id', id!).neq('statut', 'annule').order('date')) as Evenement[]
    const [aff, prof] = await Promise.all([db.from('affectations').select('*'), db.from('profiles').select('id, nom, role')])
    const ids = new Set(evenements.map((e) => e.id))
    return { client, evenements, affectations: (must(aff) as Affectation[]).filter((a) => ids.has(a.evenement_id)), equipe: must(prof) as Profile[] }
  }, [id])

  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>
  if (!data) return <p className="muted" style={{ padding: 24 }}>Chargement…</p>
  const { client: c, evenements, affectations, equipe } = data
  const d = c.details ?? {}
  const nomDe = (a: Affectation) => (a.profile_id ? equipe.find((m) => m.id === a.profile_id)?.nom ?? 'Membre' : `${a.nom_libre} (freelance)`)
  const questions = (QUESTIONS[c.type_prestation] ?? []).filter((q) => d.questionnaire?.[q])

  return (
    <div className="doc-wrap">
      <div className="doc-toolbar no-print">
        <button className="btn" type="button" onClick={() => nav(-1)}>← Retour</button>
        <button className="btn primary" type="button" onClick={() => window.print()}>Télécharger en PDF / Imprimer</button>
      </div>
      <article className="doc">
        <header className="doc-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="doc-logo">D</div>
            <div className="small muted">Feuille de route · DEMA Agency</div>
            <div className="doc-title" style={{ fontSize: 24 }}>{c.nom}</div>
            <div>{nomType(c.type_prestation)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {evenements.map((e) => (
              <div key={e.id}><strong>{dateFr(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><br /><span className="small">{e.titre} · {nomStatutEvenement[e.statut]}</span></div>
            ))}
          </div>
        </header>

        <h3>Contact client</h3>
        <div>{c.contact || c.nom}{c.telephone ? ` · ${c.telephone}` : ''}{c.email ? ` · ${c.email}` : ''}</div>

        <h3>Équipe</h3>
        {affectations.length === 0 ? <div className="small">Aucune affectation.</div> : (
          <table className="doc-table"><tbody>
            {affectations.map((a) => (
              <tr key={a.id}><td>{nomDe(a)}</td><td>{a.poste}</td><td>{a.horaires ?? ''}</td><td>{evenements.length > 1 ? evenements.find((e) => e.id === a.evenement_id)?.titre : ''}</td></tr>
            ))}
          </tbody></table>
        )}

        <h3>Lieux</h3>
        {(d.lieux ?? []).length === 0 ? <div className="small">Non renseignés.</div> : (
          <table className="doc-table"><tbody>
            {d.lieux!.map((l, i) => <tr key={i}><td style={{ width: 70 }}><strong>{l.heure}</strong></td><td>{l.type}</td><td><strong>{l.nom}</strong><br />{l.adresse}</td></tr>)}
          </tbody></table>
        )}

        <h3>Déroulé de la journée</h3>
        {(d.deroule ?? []).length === 0 ? <div className="small">Non renseigné.</div> : (
          <table className="doc-table"><tbody>
            {d.deroule!.map((s, i) => <tr key={i}><td style={{ width: 70 }}><strong>{s.heure}</strong></td><td>{s.moment}</td><td className="small">{s.notes}</td></tr>)}
          </tbody></table>
        )}

        <h3>Contacts utiles</h3>
        {(d.contacts ?? []).length === 0 ? <div className="small">Non renseignés.</div> : (
          <table className="doc-table"><tbody>
            {d.contacts!.map((ct, i) => <tr key={i}><td>{ct.role}</td><td><strong>{ct.nom}</strong></td><td>{ct.telephone}</td><td>{ct.email}</td></tr>)}
          </tbody></table>
        )}

        {questions.length > 0 && (
          <>
            <h3>À savoir (questionnaire)</h3>
            {questions.map((q) => <p key={q} style={{ margin: '0 0 8px' }}><strong>{q}</strong><br /><span style={{ whiteSpace: 'pre-line' }}>{d.questionnaire![q]}</span></p>)}
          </>
        )}
      </article>
    </div>
  )
}
