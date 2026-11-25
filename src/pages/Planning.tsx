import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, isoDate, nomStatutEvenement, nomType } from '../lib/format'
import { contratDe, couvre } from '../lib/contrats'
import type { Affectation, Client, Contrat, Evenement, Profile } from '../lib/types'

export const POSTES = ['Cadreur', 'Photographe', 'Pilote drone', 'Assistant', 'Monteur', 'Chef de projet']

const cle = (a: Pick<Affectation, 'profile_id' | 'nom_libre'>) => a.profile_id ?? `libre:${(a.nom_libre ?? '').trim().toLowerCase()}`

export default function Planning() {
  const { profile, isGerant } = useAuth()
  const [mesDates, setMesDates] = useState(false)
  const [ajout, setAjout] = useState<Record<string, { qui: string; libre: string; poste: string; horaires: string }>>({})
  const [msg, setMsg] = useState('')

  const today = isoDate(new Date())
  const { data, error, reload } = useLoad(async () => {
    const fin = isoDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()))
    const evenements = must(await db.from('evenements').select('*').gte('date', today).lte('date', fin).neq('statut', 'annule').order('date')) as Evenement[]
    const [aff, prof, cli] = await Promise.all([
      db.from('affectations').select('*').order('created_at'),
      db.from('profiles').select('id, nom, role').order('nom'),
      db.from('clients').select('id, nom, type_prestation'),
    ])
    const contrats = isGerant ? (must(await db.from('contrats').select('*')) as Contrat[]) : []
    const ids = new Set(evenements.map((e) => e.id))
    return {
      evenements,
      affectations: (must(aff) as Affectation[]).filter((a) => ids.has(a.evenement_id)),
      equipe: must(prof) as Profile[],
      clients: must(cli) as Client[],
      contrats,
    }
  }, [today, isGerant])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const nomDe = (a: Affectation) => (a.profile_id ? data.equipe.find((m) => m.id === a.profile_id)?.nom ?? 'Membre' : a.nom_libre ?? '')
  const affDe = (evtId: string) => data.affectations.filter((a) => a.evenement_id === evtId)
  const dateDe = (evtId: string) => data.evenements.find((e) => e.id === evtId)?.date ?? ''

  // Conflits : une même personne sur deux événements différents le même jour
  const parPersonneJour = new Map<string, Set<string>>()
  for (const a of data.affectations) {
    const k = `${cle(a)}|${dateDe(a.evenement_id)}`
    parPersonneJour.set(k, new Set([...(parPersonneJour.get(k) ?? []), a.evenement_id]))
  }
  const enConflit = (a: Affectation) => (parPersonneJour.get(`${cle(a)}|${dateDe(a.evenement_id)}`)?.size ?? 0) > 1
  const conflits = data.affectations.filter(enConflit)

  // Gérants : personnes affectées sans contrat signé couvrant la date
  const contratManquant = (a: Affectation) => {
    if (!isGerant) return null
    if (a.profile_id && data.equipe.find((m) => m.id === a.profile_id)?.role === 'gerant') return null
    const date = dateDe(a.evenement_id)
    const c = contratDe(data.contrats, a, nomDe(a), date)
    if (c && c.statut === 'signe' && couvre(c, date)) return null
    return c ? { lien: `/contrats/${c.id}`, texte: c.statut === 'signe' ? 'hors contrat' : 'contrat non signé' } : { lien: `/contrats/nouveau?nom=${encodeURIComponent(nomDe(a))}`, texte: 'sans contrat' }
  }

  const visibles = data.evenements.filter((e) => !mesDates || affDe(e.id).some((a) => a.profile_id === profile?.id))
  const sansEquipe = data.evenements.filter((e) => affDe(e.id).length === 0)

  const form = (id: string) => ajout[id] ?? { qui: '', libre: '', poste: POSTES[0], horaires: '' }
  const setForm = (id: string, p: Partial<ReturnType<typeof form>>) => setAjout({ ...ajout, [id]: { ...form(id), ...p } })

  const affecter = async (e: Evenement) => {
    const f = form(e.id)
    if (!f.qui || (f.qui === 'libre' && !f.libre.trim())) { setMsg('Choisis une personne (ou saisis le nom du freelance).'); return }
    const nouvelle = { evenement_id: e.id, profile_id: f.qui === 'libre' ? null : f.qui, nom_libre: f.qui === 'libre' ? f.libre.trim() : null, poste: f.poste, horaires: f.horaires || null }
    const deja = data.affectations.find((a) => cle(a) === cle(nouvelle) && dateDe(a.evenement_id) === e.date && a.evenement_id !== e.id)
    if (deja && !confirm(`${nouvelle.nom_libre ?? data.equipe.find((m) => m.id === nouvelle.profile_id)?.nom} est déjà affecté(e) le ${dateFr(e.date, { day: 'numeric', month: 'long' })} sur un autre événement. Affecter quand même ?`)) return
    const { error } = await db.from('affectations').insert(nouvelle)
    if (error) { setMsg(error.message); return }
    setAjout({ ...ajout, [e.id]: { ...f, qui: '', libre: '', horaires: '' } }); setMsg(''); reload()
  }
  const retirer = async (a: Affectation) => { await db.from('affectations').delete().eq('id', a.id); reload() }

  // Charge par personne
  const charge = new Map<string, { nom: string; dates: string[] }>()
  for (const a of data.affectations) {
    const k = cle(a)
    const c = charge.get(k) ?? { nom: nomDe(a), dates: [] }
    const d = dateDe(a.evenement_id)
    if (!c.dates.includes(d)) c.dates.push(d)
    charge.set(k, c)
  }

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Production</span>
          <h1>Planning équipe</h1>
        </div>
        <div className="seg" role="tablist" aria-label="Filtrer">
          <button type="button" role="tab" aria-selected={!mesDates} onClick={() => setMesDates(false)}>Toutes les dates ({data.evenements.length})</button>
          <button type="button" role="tab" aria-selected={mesDates} onClick={() => setMesDates(true)}>Mes dates</button>
        </div>
      </div>

      {msg && <div className="banner amber" role="status"><span>{msg}</span></div>}
      {conflits.length > 0 && (
        <div className="banner red" role="alert">
          <span><strong>Conflit de planning</strong> · {[...new Set(conflits.map((a) => `${nomDe(a)} le ${dateFr(dateDe(a.evenement_id), { day: 'numeric', month: 'long' })}`))].join(' · ')} (affecté sur deux événements le même jour).</span>
        </div>
      )}
      {sansEquipe.length > 0 && !mesDates && (
        <div className="banner outline" style={{ borderColor: 'var(--line)' }}>
          <span><strong>{sansEquipe.length} date{sansEquipe.length > 1 ? 's' : ''} sans équipe</strong> · {sansEquipe.slice(0, 4).map((e) => `${e.titre} (${dateFr(e.date, { day: 'numeric', month: 'short' })})`).join(', ')}{sansEquipe.length > 4 ? '…' : ''}</span>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div className="stack" style={{ flex: '999 1 560px', minWidth: 0, gap: 14 }}>
          {visibles.length === 0 && <p className="empty">{mesDates ? 'Tu n’es affecté(e) à aucune date pour le moment.' : 'Aucune date à venir.'}</p>}
          {visibles.map((e) => {
            const d = new Date(e.date + 'T12:00:00')
            const client = data.clients.find((c) => c.id === e.client_id)
            const f = form(e.id)
            return (
              <section key={e.id} className="card" style={{ gap: 12 }}>
                <div className="row" style={{ flexWrap: 'nowrap', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 'none', width: 56, borderRadius: 10, overflow: 'hidden', textAlign: 'center', border: '1px solid var(--line)' }}>
                    <div style={{ background: e.statut === 'confirme' ? 'var(--green)' : 'var(--orange)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 0', textTransform: 'uppercase' }}>
                      {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')} {String(d.getFullYear()).slice(2)}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700 }}>{d.getDate()}</div>
                  </div>
                  <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{e.titre}</span>
                    <span className="small muted">{dateFr(e.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {nomType(e.type_prestation)} · {nomStatutEvenement[e.statut]}</span>
                  </div>
                  {client && <Link className="btn small" to={`/clients/${client.id}/feuille-de-route`}>Feuille de route</Link>}
                </div>

                <div className="row" style={{ gap: 8 }}>
                  {affDe(e.id).length === 0 && <span className="small muted">Personne d’affecté pour l’instant.</span>}
                  {affDe(e.id).map((a) => (
                    <span key={a.id} className={'badge ' + (enConflit(a) ? 'red' : 'indigo')} style={{ fontSize: 13, padding: '5px 6px 5px 12px' }}>
                      {nomDe(a)} · {a.poste}{a.horaires ? ` · ${a.horaires}` : ''}{!a.profile_id ? ' (freelance)' : ''}
                      {(() => { const m = contratManquant(a); return m && <Link to={m.lien} style={{ marginLeft: 6, color: 'var(--red)', fontWeight: 700 }} title="Créer ou compléter son contrat">⚠ {m.texte}</Link> })()}
                      <button type="button" aria-label={`Retirer ${nomDe(a)}`} onClick={() => retirer(a)}
                        style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px', color: 'inherit' }}>×</button>
                    </span>
                  ))}
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <select className="input" aria-label="Personne" value={f.qui} onChange={(ev) => setForm(e.id, { qui: ev.target.value })} style={{ minWidth: 170 }}>
                    <option value="">Choisir une personne…</option>
                    {data.equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    <option value="libre">Freelance (saisir le nom)</option>
                  </select>
                  {f.qui === 'libre' && <input className="input" aria-label="Nom du freelance" placeholder="Nom du freelance" value={f.libre} onChange={(ev) => setForm(e.id, { libre: ev.target.value })} />}
                  <select className="input" aria-label="Poste" value={f.poste} onChange={(ev) => setForm(e.id, { poste: ev.target.value })}>
                    {POSTES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input className="input" aria-label="Horaires" placeholder="Horaires (ex. 9h–2h)" value={f.horaires} onChange={(ev) => setForm(e.id, { horaires: ev.target.value })} style={{ width: 160 }} />
                  <button className="btn" type="button" onClick={() => affecter(e)}>Affecter</button>
                </div>
              </section>
            )
          })}
        </div>

        <aside className="card" style={{ flex: '1 1 280px' }}>
          <h2>Charge de l’équipe</h2>
          <span className="small muted">Dates à venir par personne</span>
          {charge.size === 0 && <p className="empty">Aucune affectation.</p>}
          {[...charge.values()].sort((a, b) => b.dates.length - a.dates.length).map((c) => (
            <div key={c.nom} className="stack" style={{ gap: 4, padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{c.nom}</span>
                <span className="badge grey">{c.dates.length} date{c.dates.length > 1 ? 's' : ''}</span>
              </div>
              <span className="small muted">{c.dates.sort().slice(0, 6).map((d) => dateFr(d, { day: 'numeric', month: 'short' })).join(' · ')}{c.dates.length > 6 ? '…' : ''}</span>
            </div>
          ))}
          <span className="small muted" style={{ marginTop: 8 }}>Ajoute les membres dans « Équipe & compte ». Les freelances sans compte se saisissent par leur nom.</span>
        </aside>
      </div>
    </>
  )
}
