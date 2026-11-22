import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { STATUTS_DEVIS, dateFr, euro, isoDate, nomStatutProjet, nomType } from '../lib/format'
import ClientForm, { type ClientDraft } from '../components/ClientForm'
import type { Client, Devis, Projet } from '../lib/types'

export default function ClientDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { isGerant } = useAuth()
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<ClientDraft | null>(null)
  const [msg, setMsg] = useState('')

  const { data, error, reload } = useLoad(async () => {
    const client = must(await db.from('clients').select('*').eq('id', id!).single()) as Client
    const projets = must(await db.from('projets').select('*').eq('client_id', id!)) as Projet[]
    const devis = isGerant ? (must(await db.from('devis').select('*').eq('client_id', id!).order('created_at', { ascending: false })) as Devis[]) : []
    return { client, projets, devis }
  }, [id, isGerant])

  useEffect(() => { if (data) setDraft(data.client) }, [data])

  if (error) return <p className="error">{error}</p>
  if (!data || !draft) return <p className="muted">Chargement…</p>
  const c = data.client

  const save = async () => {
    const { error } = await db.from('clients').update({ ...draft, date_evenement: draft.date_evenement || null }).eq('id', c.id)
    if (error) { setMsg(error.message); return }
    // Garder la date du calendrier alignée
    if (draft.date_evenement && draft.date_evenement !== c.date_evenement) {
      await db.from('evenements').update({ date: draft.date_evenement, titre: draft.nom }).eq('client_id', c.id)
    }
    setEdit(false); setMsg('Enregistré.'); reload()
  }
  const update = async (patch: Partial<Client>) => {
    await db.from('clients').update(patch).eq('id', c.id); reload()
  }
  const marquerPerdu = async () => {
    await update({ statut_commercial: 'perdu' })
    await db.from('evenements').update({ statut: 'annule' }).eq('client_id', c.id).neq('statut', 'confirme')
  }
  const nouveauDevis = async () => {
    const numero = `D-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    const { data: d, error } = await db.from('devis').insert({ client_id: c.id, numero }).select('id').single()
    if (error) { setMsg(error.message); return }
    nav(`/devis/${d.id}`)
  }

  return (
    <>
      <div className="stack">
        <Link to="/clients" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>← Clients</Link>
        <div className="page-head">
          <div className="stack">
            <h1>{c.nom}</h1>
            <span className="muted" style={{ fontSize: 14 }}>{nomType(c.type_prestation)} · {dateFr(c.date_evenement)}</span>
          </div>
          <div className="row">
            <span className={'badge ' + (c.statut_commercial === 'client' ? 'green' : c.statut_commercial === 'perdu' ? 'grey' : 'amber')} style={{ fontSize: 13, padding: '6px 12px' }}>
              {c.statut_commercial === 'client' ? 'Client' : c.statut_commercial === 'perdu' ? 'Perdu' : 'Prospect'}
            </span>
            {!edit && <button className="btn" type="button" onClick={() => setEdit(true)}>Modifier</button>}
          </div>
        </div>
      </div>
      {msg && <span className="small muted" role="status">{msg}</span>}

      {edit ? (
        <>
          <ClientForm value={draft} onChange={setDraft} />
          <div className="row">
            <button className="btn primary" type="button" onClick={save}>Enregistrer</button>
            <button className="btn" type="button" onClick={() => { setDraft(c); setEdit(false) }}>Annuler</button>
          </div>
        </>
      ) : (
        <div className="grid-cards">
          <section className="card">
            <h2>Coordonnées</h2>
            <div className="list-row"><span className="muted">Contact</span><span>{c.contact || '—'}</span></div>
            <div className="list-row"><span className="muted">Téléphone</span><span>{c.telephone ? <a href={`tel:${c.telephone}`}>{c.telephone}</a> : '—'}</span></div>
            <div className="list-row"><span className="muted">E-mail</span><span>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</span></div>
            <div className="list-row"><span className="muted">Adresse</span><span style={{ textAlign: 'right' }}>{c.adresse || '—'}</span></div>
            {c.notes && <p className="small" style={{ whiteSpace: 'pre-line', margin: 0 }}>{c.notes}</p>}
          </section>

          <section className="card">
            <h2>Suivi commercial</h2>
            <div className="list-row">
              <span>Rendez-vous effectué</span>
              {c.rdv_effectue_le
                ? <span className="badge green">Le {dateFr(c.rdv_effectue_le, { day: 'numeric', month: 'short' })}</span>
                : <button className="btn small" type="button" onClick={() => update({ rdv_effectue_le: isoDate(new Date()) })}>Marquer comme fait</button>}
            </div>
            {c.statut_commercial === 'prospect' && (
              <div className="list-row">
                <span>Prospect perdu ?</span>
                <button className="btn small danger" type="button" onClick={marquerPerdu}>Marquer perdu</button>
              </div>
            )}
            {c.statut_commercial === 'perdu' && (
              <div className="list-row">
                <span>Relancer ce prospect</span>
                <button className="btn small" type="button" onClick={() => update({ statut_commercial: 'prospect' })}>Réactiver</button>
              </div>
            )}
          </section>

          {isGerant && (
            <section className="card">
              <div className="card-head">
                <h2>Devis</h2>
                <button className="btn small primary" type="button" onClick={nouveauDevis}>+ Nouveau devis</button>
              </div>
              {data.devis.length === 0 && <p className="empty">Aucun devis.</p>}
              {data.devis.map((d) => (
                <Link key={d.id} to={`/devis/${d.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="title">{d.numero}</span>
                    <span className="sub">{dateFr(d.created_at)}</span>
                  </div>
                  <div className="row">
                    <span style={{ fontWeight: 600 }}>{euro(d.montant)}</span>
                    <span className="badge grey">{STATUTS_DEVIS.find((s) => s.id === d.statut)?.nom}</span>
                  </div>
                </Link>
              ))}
            </section>
          )}

          {data.projets.length > 0 && (
            <section className="card">
              <h2>Projet</h2>
              {data.projets.map((p) => (
                <Link key={p.id} to={`/projets/${p.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="title">{p.titre}</span>
                  <span className="badge indigo">{nomStatutProjet[p.statut]}</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  )
}
