import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, isoDate } from '../lib/format'
import { DUREES, RAPPELS, TYPES_RDV, heureFr, lienMaps, nomDuree, telechargerIcs, typeRdv } from '../lib/rendezvous'
import type { Cible, Client, Profile, RendezVous as Rdv } from '../lib/types'

type Brouillon = Omit<Rdv, 'id' | 'clients' | 'cibles'> & { id?: string }
const ONGLETS = [{ id: 'avenir', nom: 'À venir' }, { id: 'passes', nom: 'Passés' }, { id: 'tous', nom: 'Tous' }] as const

export default function RendezVous() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const today = isoDate(new Date())
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]['id']>('avenir')
  const [mesRdv, setMesRdv] = useState(false)
  const [draft, setDraft] = useState<Brouillon | null>(null)
  const [erreur, setErreur] = useState('')
  const [msg, setMsg] = useState('')

  const { data, error, reload } = useLoad(async () => {
    const [r, c, ci, p] = await Promise.all([
      db.from('rendezvous').select('*, clients(nom), cibles(nom)').order('date').order('heure', { nullsFirst: true }),
      db.from('clients').select('id, nom, statut_commercial, rdv_effectue_le').order('nom'),
      db.from('cibles').select('id, nom, statut').order('nom'),
      db.from('profiles').select('id, nom, role').order('nom'),
    ])
    return { rdvs: must(r) as Rdv[], clients: must(c) as Client[], cibles: must(ci) as Cible[], equipe: must(p) as Profile[] }
  }, [])

  const nouveau = (base: Partial<Brouillon> = {}): Brouillon => ({
    titre: '', type: 'client', date: today, heure: '10:00', duree: 60, lieu: null, visio: null, client_id: null, cible_id: null,
    participants: profile ? [profile.id] : [], rappel: 60, rappel_le: null, statut: 'prevu', notes: null, compte_rendu: null, created_by: null, ...base,
  })

  // Ouverture depuis une notification (?id=…) ou depuis une fiche (?client=… / ?cible=…)
  useEffect(() => {
    if (!data) return
    const id = params.get('id'), client = params.get('client'), cible = params.get('cible')
    if (!id && !client && !cible) return
    if (id) { const r = data.rdvs.find((x) => x.id === id); if (r) setDraft({ ...r }) }
    else if (client) { const c = data.clients.find((x) => x.id === client); setDraft(nouveau({ client_id: client, type: 'client', titre: c ? `RDV ${c.nom}` : '' })) }
    else if (cible) { const c = data.cibles.find((x) => x.id === cible); setDraft(nouveau({ cible_id: cible, type: 'prospect', titre: c ? `RDV ${c.nom}` : '' })) }
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const nomDe = (id: string) => data.equipe.find((m) => m.id === id)?.nom ?? ''
  const avecQui = (r: Rdv | Brouillon) => (r.client_id ? data.clients.find((c) => c.id === r.client_id)?.nom : r.cible_id ? data.cibles.find((c) => c.id === r.cible_id)?.nom : '') ?? ''
  const miens = (r: Rdv) => !mesRdv || r.participants.includes(profile?.id ?? '') || r.created_by === profile?.id
  const tries = data.rdvs.filter(miens)
  const avenir = tries.filter((r) => r.date >= today && r.statut !== 'annule')
  const passes = tries.filter((r) => r.date < today || r.statut === 'annule').reverse()
  const sansCompteRendu = tries.filter((r) => r.date < today && r.statut === 'prevu')
  const liste = onglet === 'avenir' ? avenir : onglet === 'passes' ? passes : [...tries].reverse()

  // Regroupement par jour
  const jours = new Map<string, Rdv[]>()
  for (const r of liste) jours.set(r.date, [...(jours.get(r.date) ?? []), r])
  const libelleJour = (d: string) => {
    const n = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
    const base = dateFr(d, { weekday: 'long', day: 'numeric', month: 'long' })
    return n === 0 ? `Aujourd’hui · ${base}` : n === 1 ? `Demain · ${base}` : base.charAt(0).toUpperCase() + base.slice(1)
  }

  const enregistrer = async (extra: Partial<Brouillon> = {}) => {
    if (!draft) return
    const v = { ...draft, ...extra }
    setErreur('')
    if (!v.titre.trim()) { setErreur('Donne un titre au rendez-vous (ex. « Découverte mariage Andrea & Glodi »).'); return }
    if (!v.date) { setErreur('Choisis une date.'); return }
    const payload = {
      titre: v.titre.trim(), type: v.type, date: v.date, heure: v.heure || null, duree: Number(v.duree) || 60, lieu: v.lieu || null, visio: v.visio || null,
      client_id: v.client_id || null, cible_id: v.cible_id || null, participants: v.participants, rappel: Number(v.rappel) || 0, rappel_le: v.rappel_le || null,
      statut: v.statut, notes: v.notes || null, compte_rendu: v.compte_rendu || null,
    }
    const res = v.id ? await db.from('rendezvous').update(payload).eq('id', v.id) : await db.from('rendezvous').insert(payload)
    if (res.error) { setErreur(res.error.message); return }
    // Liens avec le reste du CRM
    if (payload.cible_id) {
      const c = data.cibles.find((x) => x.id === payload.cible_id)
      if (c && ['a_cibler', 'contacte', 'discussion'].includes(c.statut)) await db.from('cibles').update({ statut: 'rdv' }).eq('id', c.id)
    }
    if (payload.client_id && payload.statut === 'fait') {
      const c = data.clients.find((x) => x.id === payload.client_id)
      if (c && !c.rdv_effectue_le) await db.from('clients').update({ rdv_effectue_le: payload.date }).eq('id', c.id)
    }
    const autres = payload.participants.filter((p) => p !== profile?.id).map(nomDe).filter(Boolean)
    setMsg(!v.id && autres.length ? `Rendez-vous ajouté : ${autres.join(', ')} ${autres.length > 1 ? 'sont prévenus' : 'est prévenu(e)'} par notification.` : v.id ? 'Rendez-vous mis à jour.' : 'Rendez-vous ajouté.')
    setDraft(null); reload()
  }
  const supprimer = async () => {
    if (!draft?.id || !confirm('Supprimer ce rendez-vous ?')) return
    await db.from('rendezvous').delete().eq('id', draft.id)
    setDraft(null); reload()
  }
  const set = (p: Partial<Brouillon>) => draft && setDraft({ ...draft, ...p })

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Commercial</span>
          <h1>Rendez-vous</h1>
          <span className="muted small">Rappel sur le téléphone la veille, le matin même et juste avant.</span>
        </div>
        <button className="btn primary" type="button" onClick={() => { setErreur(''); setDraft(nouveau()) }}>+ Nouveau rendez-vous</button>
      </div>

      {msg && <div className="banner amber" role="status"><span>{msg}</span><button className="btn small" type="button" onClick={() => setMsg('')}>OK</button></div>}

      {sansCompteRendu.length > 0 && (
        <div className="banner outline">
          <span><strong>{sansCompteRendu.length} rendez-vous passé{sansCompteRendu.length > 1 ? 's' : ''} sans compte rendu</strong> · {sansCompteRendu.slice(0, 3).map((r) => r.titre).join(', ')}</span>
          <button className="btn small" type="button" onClick={() => setDraft({ ...sansCompteRendu[0], statut: 'fait' })}>Faire le compte rendu</button>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Période">
          {ONGLETS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}>
              {o.nom}{o.id === 'avenir' ? ` (${avenir.length})` : ''}
            </button>
          ))}
        </div>
        <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={mesRdv} onChange={(e) => setMesRdv(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
          Seulement les miens
        </label>
      </div>

      {liste.length === 0 && (
        <section className="card">
          <p className="empty">{onglet === 'avenir' ? 'Aucun rendez-vous à venir.' : 'Aucun rendez-vous ici.'}</p>
          {onglet === 'avenir' && <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft(nouveau())}>+ Ajouter un rendez-vous</button>}
        </section>
      )}

      {[...jours.entries()].map(([jour, rdvs]) => (
        <section key={jour} className="card" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 16, color: jour === today ? 'var(--accent-dark)' : undefined }}>{libelleJour(jour)}</h2>
          {rdvs.map((r) => {
            const t = typeRdv(r.type)
            const qui = avecQui(r)
            return (
              <button key={r.id} type="button" className="rdv-ligne" onClick={() => { setErreur(''); setDraft({ ...r }) }}>
                <span className="rdv-heure">{r.heure ? heureFr(r.heure) : 'Journée'}<span className="small muted">{r.heure ? nomDuree(r.duree) : ''}</span></span>
                <span className="stack" style={{ gap: 3, minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 600, textDecoration: r.statut === 'annule' ? 'line-through' : undefined }}>{t.icone} {r.titre}</span>
                  <span className="small muted">
                    {[t.nom, qui && `avec ${qui}`, r.lieu ? `📍 ${r.lieu}` : r.visio ? '💻 visio' : null].filter(Boolean).join(' · ')}
                  </span>
                  {r.participants.length > 0 && <span className="small muted">👥 {r.participants.map(nomDe).filter(Boolean).join(', ')}</span>}
                </span>
                {r.statut === 'fait' && <span className="badge green">Fait</span>}
                {r.statut === 'annule' && <span className="badge grey">Annulé</span>}
                {r.statut === 'prevu' && r.date < today && <span className="badge amber">Compte rendu ?</span>}
              </button>
            )
          })}
        </section>
      ))}

      {draft && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <section className="card modal" role="dialog" aria-modal="true" aria-label={draft.id ? 'Rendez-vous' : 'Nouveau rendez-vous'}>
            <div className="card-head">
              <h2>{draft.id ? 'Rendez-vous' : 'Nouveau rendez-vous'}</h2>
              <button className="btn small" type="button" aria-label="Fermer" onClick={() => setDraft(null)}>×</button>
            </div>

            {draft.id && (
              <div className="seg" role="tablist" aria-label="Statut" style={{ alignSelf: 'flex-start' }}>
                {([['prevu', 'Prévu'], ['fait', 'Fait'], ['annule', 'Annulé']] as const).map(([s, n]) => (
                  <button key={s} type="button" role="tab" aria-selected={draft.statut === s} onClick={() => set({ statut: s })}>{n}</button>
                ))}
              </div>
            )}
            {draft.statut === 'fait' && (
              <label className="field">Compte rendu (ce qui a été dit, prochaine étape)
                <textarea autoFocus value={draft.compte_rendu ?? ''} onChange={(e) => set({ compte_rendu: e.target.value })} placeholder="Ex. budget 3 500 €, veut drone + teaser, envoyer le devis vendredi" />
              </label>
            )}

            <label className="field">Titre<input value={draft.titre} onChange={(e) => set({ titre: e.target.value })} placeholder="Ex. Découverte mariage Andrea & Glodi" /></label>
            <div className="form-grid">
              <label className="field">Type
                <select value={draft.type} onChange={(e) => set({ type: e.target.value })}>
                  {TYPES_RDV.map((t) => <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>)}
                </select>
              </label>
              <label className="field">Date<input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} /></label>
              <label className="field">Heure<input type="time" value={draft.heure ?? ''} onChange={(e) => set({ heure: e.target.value || null })} /></label>
              <label className="field">Durée
                <select value={draft.duree} onChange={(e) => set({ duree: Number(e.target.value) })}>
                  {DUREES.map((d) => <option key={d} value={d}>{nomDuree(d)}</option>)}
                </select>
              </label>
              <label className="field">Lieu<input value={draft.lieu ?? ''} onChange={(e) => set({ lieu: e.target.value || null })} placeholder="Adresse, café, salle…" /></label>
              <label className="field">Lien visio<input value={draft.visio ?? ''} onChange={(e) => set({ visio: e.target.value || null })} placeholder="Google Meet, Zoom…" /></label>
              <label className="field">Avec un client / prospect
                <select value={draft.client_id ?? ''} onChange={(e) => set({ client_id: e.target.value || null, cible_id: e.target.value ? null : draft.cible_id })}>
                  <option value="">—</option>
                  {data.clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="field">Ou une cible (chasseur de têtes)
                <select value={draft.cible_id ?? ''} onChange={(e) => set({ cible_id: e.target.value || null, client_id: e.target.value ? null : draft.client_id })}>
                  <option value="">—</option>
                  {data.cibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="field">Rappel juste avant
                <select value={draft.rappel} onChange={(e) => set({ rappel: Number(e.target.value) })}>
                  {RAPPELS.map((r) => <option key={r.v} value={r.v}>{r.nom}</option>)}
                </select>
              </label>
            </div>
            <div className="stack" style={{ gap: 6, padding: 12, borderRadius: 12, background: 'var(--accent-soft)' }}>
              <label className="field" style={{ color: 'var(--accent-dark)' }}>🔔 Rappel à la date et l’heure de ton choix (facultatif)
                <input type="datetime-local" value={draft.rappel_le ?? ''} max={`${draft.date}T${draft.heure ?? '23:59'}`} onChange={(e) => set({ rappel_le: e.target.value || null })} />
              </label>
              <div className="row" style={{ gap: 6 }}>
                {[
                  ['La veille à 18h', () => { const d = new Date(draft.date + 'T12:00:00'); d.setDate(d.getDate() - 1); return `${isoDate(d)}T18:00` }],
                  ['Le matin à 8h', () => `${draft.date}T08:00`],
                  ['2 jours avant', () => { const d = new Date(draft.date + 'T12:00:00'); d.setDate(d.getDate() - 2); return `${isoDate(d)}T09:00` }],
                ].map(([n, f]) => (
                  <button key={n as string} type="button" className="btn small" onClick={() => set({ rappel_le: (f as () => string)() })}>{n as string}</button>
                ))}
                {draft.rappel_le && <button type="button" className="btn small" onClick={() => set({ rappel_le: null })}>Retirer</button>}
              </div>
              <span className="small muted">
                {draft.rappel_le && draft.rappel_le < `${today}T${new Date().toTimeString().slice(0, 5)}` && <strong style={{ color: 'var(--red)' }}>⚠ Cette heure est déjà passée : choisis un moment à venir. </strong>}
                {draft.rappel_le ? `Rappel le ${dateFr(draft.rappel_le.slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long' })} à ${draft.rappel_le.slice(11, 16).replace(':', 'h')}.` : 'En plus, tu es toujours prévenu la veille au soir et le matin du rendez-vous.'}
                {' '}Précision : à 15 min près.
              </span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 500 }}>Qui vient ? (ils reçoivent la notification et les rappels)</span>
              <div className="row" style={{ gap: 8 }}>
                {data.equipe.map((m) => {
                  const on = draft.participants.includes(m.id)
                  return (
                    <button key={m.id} type="button" className={'badge ' + (on ? 'indigo' : 'grey')} style={{ border: 0, cursor: 'pointer', fontSize: 13, padding: '7px 12px' }}
                      aria-pressed={on} onClick={() => set({ participants: on ? draft.participants.filter((p) => p !== m.id) : [...draft.participants, m.id] })}>
                      {on ? '✓ ' : '+ '}{m.nom}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="field">Notes (à préparer, questions à poser)<textarea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} /></label>

            {draft.id && (
              <div className="row small" style={{ gap: 12 }}>
                <button type="button" className="btn small" onClick={() => telechargerIcs(draft as Rdv, avecQui(draft))}>📅 Ajouter à l’agenda du téléphone</button>
                {draft.lieu && <a className="btn small" href={lienMaps(draft.lieu)} target="_blank" rel="noreferrer">🗺️ Itinéraire</a>}
                {draft.visio && <a className="btn small" href={draft.visio} target="_blank" rel="noreferrer">💻 Ouvrir la visio</a>}
                {draft.client_id && <Link className="btn small" to={`/clients/${draft.client_id}`}>Fiche client</Link>}
                {draft.cible_id && <Link className="btn small" to={`/chasse/${draft.cible_id}`}>Fiche cible</Link>}
              </div>
            )}

            {erreur && <p className="error">{erreur}</p>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {draft.id ? <button type="button" className="btn danger" onClick={supprimer}>Supprimer</button> : <span />}
              <div className="row">
                <button type="button" className="btn" onClick={() => setDraft(null)}>Annuler</button>
                <button type="button" className="btn primary" onClick={() => enregistrer()}>{draft.id ? 'Enregistrer' : 'Ajouter le rendez-vous'}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
