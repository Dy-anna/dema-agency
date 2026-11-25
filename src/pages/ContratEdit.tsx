import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro, isoDate } from '../lib/format'
import { ACCORDS, REMUNERATIONS, STATUTS_CONTRAT, TYPES_CONTRAT, duree, etatContrat, joursRestants } from '../lib/contrats'
import { POSTES } from './Planning'
import type { Affectation, Contrat, Evenement, Profile } from '../lib/types'

const VIDE: Omit<Contrat, 'id'> = {
  nom: '', telephone: null, email: null, adresse: null, profile_id: null,
  type: 'formation', poste: 'Cadreur', date_debut: isoDate(new Date()), date_fin: null,
  rythme: '', missions: '', remuneration: 'aucune', montant: 0,
  accords: { droit_image: true, confidentialite: true, rushes: true, materiel: true, securite: true },
  statut: 'brouillon', date_signature: null, notes: '',
}

const CONSEILS: Record<string, string> = {
  stage: 'Un stage en France nécessite une convention tripartite signée par l’école. Ce contrat sert de récapitulatif interne : demande la convention à l’école et garde-la avec.',
  benevole: 'Le bénévolat pour une entreprise commerciale doit rester ponctuel et sans lien de subordination, sinon il peut être requalifié en travail salarié. Pour une aide régulière, préfère « Formation » ou « Freelance ».',
  freelance: 'Le freelance doit avoir un statut (micro-entreprise, SIRET) et te facturer ses jours : demande-lui son SIRET et note-le dans les notes.',
  formation: 'Précise ce que la personne vient apprendre, sur quelle période et à quel rythme. Si la formation devient régulière et encadrée, rapproche-toi d’un organisme ou d’un comptable pour le bon cadre (stage, alternance).',
}

export default function ContratEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const nouveau = !id || id === 'nouveau'
  const today = isoDate(new Date())
  const [c, setC] = useState<Omit<Contrat, 'id'> | null>(null)
  const [msg, setMsg] = useState('')
  const [erreur, setErreur] = useState('')

  const { data, error } = useLoad(async () => {
    const [p, a, e] = await Promise.all([
      db.from('profiles').select('id, nom, role').order('nom'),
      db.from('affectations').select('*'),
      db.from('evenements').select('*').neq('statut', 'annule').order('date'),
    ])
    const contrat = nouveau ? null : (must(await db.from('contrats').select('*').eq('id', id!).single()) as Contrat)
    return { equipe: must(p) as Profile[], affectations: must(a) as Affectation[], evenements: must(e) as Evenement[], contrat }
  }, [id])

  useEffect(() => {
    if (!data || c) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(data.contrat ? { ...VIDE, ...data.contrat, accords: { ...(data.contrat.accords ?? {}) } } : { ...VIDE, nom: params.get('nom') ?? '' })
  }, [data, c, params])

  if (error) return <p className="error">{error}</p>
  if (!data || !c) return <p className="muted">Chargement…</p>

  const set = (p: Partial<Omit<Contrat, 'id'>>) => { setC({ ...c, ...p }); setMsg('') }
  const membre = data.equipe.find((m) => m.id === c.profile_id)
  const norm = (s: string) => s.trim().toLowerCase()
  // Dates du planning de cette personne pendant la période
  const sesDates = data.affectations
    .filter((a) => (c.profile_id && a.profile_id === c.profile_id) || (c.nom && norm(a.nom_libre ?? '') === norm(c.nom)) || (membre && a.profile_id === membre.id))
    .map((a) => ({ a, e: data.evenements.find((e) => e.id === a.evenement_id) }))
    .filter((x): x is { a: Affectation; e: Evenement } => !!x.e)
    .sort((x, y) => x.e.date.localeCompare(y.e.date))
  const horsPeriode = sesDates.filter(({ e }) => (c.date_debut && e.date < c.date_debut) || (c.date_fin && e.date > c.date_fin))
  const nbJoursTournage = sesDates.filter(({ e }) => !horsPeriode.some((h) => h.e.id === e.id)).length

  const enregistrer = async (extra: Partial<Omit<Contrat, 'id'>> = {}) => {
    setErreur('')
    const v = { ...c, ...extra }
    if (!v.nom.trim()) { setErreur('Indique le nom de la personne.'); return }
    if (v.date_debut && v.date_fin && v.date_fin < v.date_debut) { setErreur('La date de fin est avant la date de début.'); return }
    const payload = { ...v, nom: v.nom.trim(), montant: Number(v.montant) || 0 }
    if (nouveau) {
      const { data: res, error: err } = await db.from('contrats').insert(payload).select('id').single()
      if (err) { setErreur(err.message); return }
      nav(`/contrats/${(res as { id: string }).id}`, { replace: true })
    } else {
      const { error: err } = await db.from('contrats').update(payload).eq('id', id!)
      if (err) { setErreur(err.message); return }
      setC(v); setMsg('Enregistré')
    }
  }
  const supprimer = async () => {
    if (!confirm(`Supprimer définitivement le contrat de ${c.nom} ?`)) return
    await db.from('contrats').delete().eq('id', id!)
    nav('/contrats')
  }

  const etat = nouveau ? null : etatContrat({ ...c, id: id! }, today)
  const restant = joursRestants({ ...c, id: id! }, today)

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <Link to="/contrats" className="small">← Contrats</Link>
          <h1>{nouveau ? 'Nouveau contrat' : c.nom}</h1>
          {!nouveau && (
            <span className="muted">
              {TYPES_CONTRAT.find((t) => t.id === c.type)?.nom} · {c.poste}
              {c.date_debut && ` · du ${dateFr(c.date_debut, { day: 'numeric', month: 'short' })}`}
              {c.date_fin && ` au ${dateFr(c.date_fin, { day: 'numeric', month: 'short', year: 'numeric' })}`}
              {etat === 'en_cours' && restant !== null && ` · encore ${restant} jours`}
            </span>
          )}
        </div>
        {!nouveau && (
          <div className="row">
            <Link className="btn" to={`/contrats/${id}/pdf`}>Document à signer (PDF)</Link>
          </div>
        )}
      </div>

      <div className="grid-cards">
        <section className="card">
          <h2>La personne</h2>
          <div className="form-grid">
            <label className="field">Nom et prénom<input value={c.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Ex. Samuel Kabongo" /></label>
            <label className="field">Compte dans l’équipe (facultatif)
              <select value={c.profile_id ?? ''} onChange={(e) => {
                const m = data.equipe.find((x) => x.id === e.target.value)
                set({ profile_id: e.target.value || null, nom: c.nom || m?.nom || '' })
              }}>
                <option value="">Pas de compte (freelance, invité…)</option>
                {data.equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </label>
            <label className="field">Téléphone<input type="tel" value={c.telephone ?? ''} onChange={(e) => set({ telephone: e.target.value || null })} /></label>
            <label className="field">E-mail<input type="email" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value || null })} /></label>
          </div>
          <label className="field">Adresse<input value={c.adresse ?? ''} onChange={(e) => set({ adresse: e.target.value || null })} placeholder="Pour le document à signer" /></label>
        </section>

        <section className="card">
          <h2>Le contrat</h2>
          <div className="choice-grid" role="radiogroup" aria-label="Type de contrat">
            {TYPES_CONTRAT.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={c.type === t.id} className="choice" onClick={() => set({ type: t.id, remuneration: t.id === 'benevole' ? 'aucune' : c.remuneration })}>
                <strong>{t.nom}</strong><span className="small muted">{t.desc}</span>
              </button>
            ))}
          </div>
          <p className="small" style={{ margin: 0, background: 'var(--amber-soft)', color: '#78350f', padding: '10px 12px', borderRadius: 10 }}>{CONSEILS[c.type]}</p>
          <div className="form-grid">
            <label className="field">Poste
              <select value={c.poste} onChange={(e) => set({ poste: e.target.value })}>
                {[...new Set([...POSTES, c.poste])].map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">Rythme<input value={c.rythme ?? ''} onChange={(e) => set({ rythme: e.target.value })} placeholder="Ex. les tournages du week-end" /></label>
            <label className="field">Début<input type="date" value={c.date_debut ?? ''} onChange={(e) => set({ date_debut: e.target.value || null })} /></label>
            <label className="field">Fin<input type="date" value={c.date_fin ?? ''} onChange={(e) => set({ date_fin: e.target.value || null })} /></label>
          </div>
          <span className="small muted">
            {c.date_debut && c.date_fin ? <>Durée : <strong>{duree(c.date_debut, c.date_fin)}</strong></> : 'Laisse la fin vide si la durée n’est pas encore fixée.'}
            {nbJoursTournage > 0 && <> · {nbJoursTournage} date{nbJoursTournage > 1 ? 's' : ''} de tournage prévue{nbJoursTournage > 1 ? 's' : ''} au planning</>}
          </span>
          <label className="field">{c.type === 'formation' || c.type === 'stage' ? 'Ce qu’il/elle vient apprendre et ses missions' : 'Missions'}
            <textarea value={c.missions ?? ''} onChange={(e) => set({ missions: e.target.value })}
              placeholder={c.type === 'formation' ? 'Ex. tenue caméra, cadrage, lumière de base ; assister le cadreur principal ; dérushage' : 'Ex. cadreur seconde caméra sur les mariages'} />
          </label>
        </section>

        <section className="card">
          <h2>Rémunération</h2>
          <div className="form-grid">
            <label className="field">Type
              <select value={c.remuneration} onChange={(e) => set({ remuneration: e.target.value as Contrat['remuneration'] })}>
                {REMUNERATIONS.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </label>
            {c.remuneration !== 'aucune' && (
              <label className="field">{c.remuneration === 'jour' ? 'Montant par jour (€)' : c.remuneration === 'forfait' ? 'Forfait (€)' : 'Défraiement par jour (€)'}
                <input type="number" min="0" step="5" value={c.montant || ''} onChange={(e) => set({ montant: Number(e.target.value) })} />
              </label>
            )}
          </div>
          {(c.remuneration === 'jour' || c.remuneration === 'defraiement') && nbJoursTournage > 0 && c.montant > 0 && (
            <span className="small muted">Estimation sur les dates prévues au planning : <strong>{euro(c.montant * nbJoursTournage)}</strong> ({nbJoursTournage} × {euro(c.montant)})</span>
          )}
        </section>

        <section className="card">
          <h2>Ses accords</h2>
          <span className="small muted">Ce que la personne accepte en signant. Tout est repris dans le document à signer.</span>
          {ACCORDS.map((a) => (
            <div key={a.id} className="checkline">
              <label>
                <input type="checkbox" checked={!!c.accords[a.id]} onChange={(e) => set({ accords: { ...c.accords, [a.id]: e.target.checked } })} />
                <span><strong>{a.nom}</strong><br /><span className="small muted">La personne {a.texte}</span></span>
              </label>
            </div>
          ))}
          <label className="field">Autre accord (facultatif)
            <textarea value={c.accords.autres ?? ''} onChange={(e) => set({ accords: { ...c.accords, autres: e.target.value } })} placeholder="Ex. peut utiliser 3 photos dans son portfolio après accord" />
          </label>
        </section>

        <section className="card">
          <h2>Signature &amp; suivi</h2>
          <div className="seg" role="tablist" aria-label="Statut du contrat" style={{ alignSelf: 'flex-start' }}>
            {STATUTS_CONTRAT.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={c.statut === s.id}
                onClick={() => set({ statut: s.id, date_signature: s.id === 'signe' && !c.date_signature ? today : c.date_signature })}>{s.nom}</button>
            ))}
          </div>
          {c.statut === 'signe' && (
            <label className="field" style={{ maxWidth: 240 }}>Signé le<input type="date" value={c.date_signature ?? ''} onChange={(e) => set({ date_signature: e.target.value || null })} /></label>
          )}
          <label className="field">Notes internes<textarea value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="SIRET du freelance, école du stagiaire, retours sur la personne…" /></label>
        </section>

        <section className="card">
          <h2>Ses dates au planning</h2>
          {sesDates.length === 0 && <p className="empty">Aucune date. Affecte la personne dans Planning équipe (même nom ou compte lié) pour la voir ici.</p>}
          {sesDates.map(({ a, e }) => {
            const hors = horsPeriode.some((h) => h.e.id === e.id)
            return (
              <div key={a.id} className="list-row">
                <div className="stack" style={{ gap: 0 }}>
                  <span className="title">{e.titre}</span>
                  <span className="sub">{dateFr(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {a.poste}</span>
                </div>
                {hors ? <span className="badge red">Hors période du contrat</span> : <span className="badge green">Couvert</span>}
              </div>
            )
          })}
          <Link to="/planning" className="small">Ouvrir le planning équipe →</Link>
        </section>
      </div>

      {erreur && <p className="error">{erreur}</p>}
      <div className="row">
        <button className="btn primary" type="button" onClick={() => enregistrer()}>{nouveau ? 'Créer le contrat' : 'Enregistrer'}</button>
        {!nouveau && c.statut !== 'signe' && <button className="btn" type="button" onClick={() => enregistrer({ statut: 'signe', date_signature: c.date_signature ?? today })}>Marquer signé</button>}
        {!nouveau && <button className="btn danger" type="button" onClick={supprimer}>Supprimer</button>}
        {msg && <span className="small" style={{ color: 'var(--green-ink)' }}>{msg}</span>}
      </div>
    </>
  )
}
