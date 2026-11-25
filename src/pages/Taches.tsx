// Tâches entre membres : je donne une tâche à Davy (ou à moi), avec une deadline ;
// rappels sur le téléphone tant qu'elle n'est pas cochée.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, isoDate } from '../lib/format'
import type { Client, Profile, Projet, Tache } from '../lib/types'

export interface Todo {
  id: string
  titre: string
  details: string | null
  categorie: string
  echeance: string | null
  heure: string | null
  assigne_a: string | null
  cree_par: string | null
  client_id: string | null
  fait: boolean
  fait_le: string | null
  created_at?: string
}

const CATEGORIES = [
  { id: 'tache', nom: 'Tâche', icone: '📌' },
  { id: 'facture', nom: 'Facture', icone: '🧾' },
  { id: 'devis', nom: 'Devis', icone: '📝' },
  { id: 'appel', nom: 'Appel', icone: '📞' },
  { id: 'montage', nom: 'Montage', icone: '🎬' },
  { id: 'note', nom: 'Note / rappel', icone: '🗒️' },
]
const icone = (c: string) => CATEGORIES.find((x) => x.id === c)?.icone ?? '📌'
const ONGLETS = [
  { id: 'moi', nom: 'Pour moi' },
  { id: 'donnees', nom: 'Que j’ai données' },
  { id: 'faites', nom: 'Faites' },
] as const

const jours = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

export default function Taches() {
  const { profile } = useAuth()
  const today = isoDate(new Date())
  const demain = isoDate(new Date(Date.now() + 86400000))
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]['id']>('moi')
  const vide = { titre: '', categorie: 'tache', pour: '', echeance: demain, heure: '', details: '', client_id: '' }
  const [f, setF] = useState(vide)
  const [plus, setPlus] = useState(false)
  const [msg, setMsg] = useState('')
  const [erreur, setErreur] = useState('')

  const { data, error, reload, setData } = useLoad(async () => {
    const [t, p, c, tp, pr] = await Promise.all([
      db.from('todos').select('*').order('echeance', { ascending: true, nullsFirst: false }),
      db.from('profiles').select('id, nom, role').order('nom'),
      db.from('clients').select('id, nom').order('nom'),
      db.from('taches').select('*').eq('fait', false),
      db.from('projets').select('id, titre, date_evenement, statut'),
    ])
    return { todos: must(t) as Todo[], equipe: must(p) as Profile[], clients: must(c) as Client[], tachesProjet: must(tp) as Tache[], projets: must(pr) as Projet[] }
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const moi = profile?.id ?? ''
  const pour = f.pour || moi
  const nomDe = (id: string | null) => (id === moi ? 'toi' : data.equipe.find((m) => m.id === id)?.nom.split(' ')[0] ?? '—')
  const pourMoi = data.todos.filter((t) => !t.fait && t.assigne_a === moi)
  const donnees = data.todos.filter((t) => t.cree_par === moi && t.assigne_a !== moi)
  const faites = data.todos.filter((t) => t.fait && (t.assigne_a === moi || t.cree_par === moi))
    .sort((a, b) => (b.fait_le ?? '').localeCompare(a.fait_le ?? ''))
  const projetsMiens = data.tachesProjet.filter((t) => t.assigne_a === moi)
  const enRetard = pourMoi.filter((t) => t.echeance && t.echeance < today).length

  const ajouter = async () => {
    setErreur('')
    if (!f.titre.trim()) { setErreur('Écris la tâche (ex. « Envoyer la facture de Concerto »).'); return }
    const { error: err } = await db.from('todos').insert({
      titre: f.titre.trim(), categorie: f.categorie, assigne_a: pour, echeance: f.echeance || null, heure: f.heure || null,
      details: f.details.trim() || null, client_id: f.client_id || null, fait: false,
    })
    if (err) { setErreur(err.message); return }
    setMsg(pour !== moi ? `Tâche envoyée à ${nomDe(pour)} : il/elle reçoit la notification, puis des rappels jusqu’à ce que ce soit fait.` : 'Tâche ajoutée : tu auras des rappels jusqu’à ce que ce soit fait.')
    setF({ ...vide, pour: f.pour }); setPlus(false); reload()
  }

  const cocher = async (t: Todo) => {
    const fait = !t.fait
    setData({ ...data, todos: data.todos.map((x) => (x.id === t.id ? { ...x, fait, fait_le: fait ? today : null } : x)) })
    await db.from('todos').update({ fait, fait_le: fait ? today : null }).eq('id', t.id)
  }
  const supprimer = async (t: Todo) => {
    if (!confirm(`Supprimer « ${t.titre} » ?`)) return
    await db.from('todos').delete().eq('id', t.id); reload()
  }
  const decaler = async (t: Todo, n: number) => {
    const base = t.echeance && t.echeance > today ? t.echeance : today
    const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + n)
    await db.from('todos').update({ echeance: isoDate(d) }).eq('id', t.id); reload()
  }

  const deadline = (t: Todo) => {
    if (!t.echeance) return <span className="small muted">Sans deadline</span>
    const n = jours(today, t.echeance)
    const h = t.heure ? ` à ${t.heure.replace(':', 'h')}` : ''
    const txt = n < 0 ? `En retard de ${-n} j` : n === 0 ? `Aujourd’hui${h}` : n === 1 ? `Demain${h}` : `${dateFr(t.echeance, { weekday: 'short', day: 'numeric', month: 'short' })}${h}`
    return <span className={'badge ' + (t.fait ? 'grey' : n < 0 ? 'red' : n <= 1 ? 'orange' : 'grey')}>{txt}</span>
  }

  const ligne = (t: Todo, mode: 'moi' | 'donnee' | 'faite') => (
    <div key={t.id} className="checkline" style={{ alignItems: 'flex-start' }}>
      <label style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={t.fait} onChange={() => cocher(t)} style={{ marginTop: 3 }} disabled={mode === 'donnee' && t.assigne_a !== moi && false} />
        <span className="stack" style={{ gap: 3, minWidth: 0 }}>
          <span className={t.fait ? 'done' : ''} style={{ fontWeight: 600 }}>{icone(t.categorie)} {t.titre}</span>
          {t.details && <span className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{t.details}</span>}
          <span className="row small muted" style={{ gap: 6 }}>
            {deadline(t)}
            {mode === 'moi' && t.cree_par && t.cree_par !== moi && <span>de {nomDe(t.cree_par)}</span>}
            {mode !== 'moi' && <span>pour {nomDe(t.assigne_a)}</span>}
            {t.client_id && <Link to={`/clients/${t.client_id}`}>{data.clients.find((c) => c.id === t.client_id)?.nom}</Link>}
            {t.fait && t.fait_le && <span>· fait le {dateFr(t.fait_le, { day: 'numeric', month: 'short' })}</span>}
          </span>
        </span>
      </label>
      {!t.fait && (
        <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          {mode === 'moi' && <button type="button" className="btn small" title="Repousser d’un jour" onClick={() => decaler(t, 1)}>+1 j</button>}
          {(t.cree_par === moi || t.assigne_a === moi) && <button type="button" className="btn small" aria-label="Supprimer" onClick={() => supprimer(t)}>×</button>}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Équipe</span>
          <h1>Tâches</h1>
          <span className="muted small">Donne une tâche à quelqu’un avec une deadline : il/elle est prévenu(e) et relancé(e) jusqu’à ce que ce soit fait.</span>
        </div>
      </div>

      {/* ───── Ajout rapide ───── */}
      <section className="card">
        <h2>Nouvelle tâche</h2>
        <div className="row" role="radiogroup" aria-label="Type" style={{ gap: 6 }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={f.categorie === c.id} className={'badge ' + (f.categorie === c.id ? 'indigo' : 'grey')}
              style={{ border: 0, cursor: 'pointer', fontSize: 13, padding: '7px 12px' }} onClick={() => setF({ ...f, categorie: c.id })}>{c.icone} {c.nom}</button>
          ))}
        </div>
        <input className="input" style={{ fontSize: 16 }} placeholder="Ex. Envoyer la facture de Concerto · Finir le teaser de Melun" value={f.titre}
          onChange={(e) => setF({ ...f, titre: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ajouter()} aria-label="La tâche" />
        <div className="form-grid">
          <label className="field">Pour qui ?
            <select value={pour} onChange={(e) => setF({ ...f, pour: e.target.value })}>
              {data.equipe.map((m) => <option key={m.id} value={m.id}>{m.id === moi ? `Moi (${m.nom})` : m.nom}</option>)}
            </select>
          </label>
          <label className="field">Deadline<input type="date" value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} /></label>
          <label className="field">Heure (facultatif)<input type="time" value={f.heure} onChange={(e) => setF({ ...f, heure: e.target.value })} /></label>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[['Aujourd’hui', today], ['Demain', demain], ['Dans 3 jours', isoDate(new Date(Date.now() + 3 * 86400000))], ['Dans 1 semaine', isoDate(new Date(Date.now() + 7 * 86400000))], ['Sans deadline', '']].map(([n, d]) => (
            <button key={n} type="button" className={'btn small' + (f.echeance === d ? ' primary' : '')} onClick={() => setF({ ...f, echeance: d })}>{n}</button>
          ))}
        </div>
        {plus ? (
          <div className="form-grid">
            <label className="field">Détails / note<textarea value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="Ce qu’il faut savoir pour la faire" /></label>
            <label className="field">Lié à un client (facultatif)
              <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
                <option value="">—</option>
                {data.clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
          </div>
        ) : <button type="button" className="btn small dashed" style={{ alignSelf: 'flex-start' }} onClick={() => setPlus(true)}>+ Ajouter une note ou un client</button>}
        {erreur && <p className="error">{erreur}</p>}
        <button type="button" className="btn primary" onClick={ajouter}>{pour !== moi ? `Envoyer à ${nomDe(pour)}` : 'Ajouter'}</button>
        <span className="small muted">Rappels : chaque matin dès 3 jours avant, la veille au soir, le jour J (et 1 h avant si tu mets une heure), puis chaque matin tant que ce n’est pas coché.</span>
      </section>

      {msg && <div className="banner amber" role="status"><span>{msg}</span><button className="btn small" type="button" onClick={() => setMsg('')}>OK</button></div>}

      <div className="seg" role="tablist" aria-label="Listes" style={{ alignSelf: 'flex-start' }}>
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}>
            {o.nom}{o.id === 'moi' ? ` (${pourMoi.length + projetsMiens.length})` : o.id === 'donnees' ? ` (${donnees.filter((t) => !t.fait).length})` : ''}
          </button>
        ))}
      </div>

      {onglet === 'moi' && (
        <>
          {enRetard > 0 && <div className="banner red"><span><strong>{enRetard} tâche{enRetard > 1 ? 's' : ''} en retard</strong> · coche-les dès que c’est fait, ou repousse avec « +1 j ».</span></div>}
          <section className="card" style={{ gap: 0 }}>
            {pourMoi.length === 0 && <p className="empty">Rien à faire pour l’instant 👌</p>}
            {pourMoi.map((t) => ligne(t, 'moi'))}
          </section>
          {projetsMiens.length > 0 && (
            <section className="card" style={{ gap: 0 }}>
              <h2 style={{ paddingBottom: 6 }}>Dans tes projets</h2>
              {projetsMiens.map((t) => {
                const p = data.projets.find((x) => x.id === t.projet_id)
                return (
                  <div key={t.id} className="list-row">
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="title">{t.titre}</span>
                      <span className="sub">{p?.titre}{t.echeance ? ` · pour le ${dateFr(t.echeance, { day: 'numeric', month: 'short' })}` : ''}</span>
                    </div>
                    <Link className="btn small" to={`/projets/${t.projet_id}`}>Ouvrir</Link>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}

      {onglet === 'donnees' && (
        <section className="card" style={{ gap: 0 }}>
          {donnees.length === 0 && <p className="empty">Tu n’as donné aucune tâche pour l’instant.</p>}
          {donnees.filter((t) => !t.fait).map((t) => ligne(t, 'donnee'))}
          {donnees.some((t) => t.fait) && <span className="small muted" style={{ padding: '10px 0 0' }}>Terminées : voir l’onglet « Faites ».</span>}
        </section>
      )}

      {onglet === 'faites' && (
        <section className="card" style={{ gap: 0 }}>
          {faites.length === 0 && <p className="empty">Aucune tâche terminée.</p>}
          {faites.slice(0, 50).map((t) => ligne(t, 'faite'))}
        </section>
      )}
    </>
  )
}
