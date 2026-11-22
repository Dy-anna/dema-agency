import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { TYPES_PRESTATION, dateFr, isoDate, nomStatutEvenement, nomType } from '../lib/format'
import type { Client, Evenement, StatutEvenement, TypePrestation } from '../lib/types'

type Draft = { id?: string; titre: string; date: string; type_prestation: TypePrestation; statut: StatutEvenement; client_id: string }

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const STATUTS: StatutEvenement[] = ['previsionnel', 'confirme', 'annule']

export default function Calendrier() {
  const now = new Date()
  const [mois, setMois] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [err, setErr] = useState('')

  const debut = isoDate(mois)
  const fin = isoDate(new Date(mois.getFullYear(), mois.getMonth() + 1, 0))

  const { data, error, reload } = useLoad(async () => {
    const evenements = must(await db.from('evenements').select('*').gte('date', debut).lte('date', fin).order('date')) as Evenement[]
    const clients = must(await db.from('clients').select('id, nom, type_prestation, date_evenement').neq('statut_commercial', 'perdu').order('nom')) as Client[]
    return { evenements, clients }
  }, [debut, fin])

  const evts = data?.evenements ?? []
  const actifs = evts.filter((e) => e.statut !== 'annule')
  const parJour = new Map<string, Evenement[]>()
  for (const e of evts) parJour.set(e.date, [...(parJour.get(e.date) ?? []), e])
  const conflits = [...parJour.entries()].filter(([, l]) => l.filter((e) => e.statut !== 'annule').length > 1)
  const aCompleter = actifs.filter((e) => !e.client_id)

  // Grille du mois (semaines commençant le lundi)
  const lead = (mois.getDay() + 6) % 7
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
  const nbCases = Math.ceil((lead + nbJours) / 7) * 7
  const today = isoDate(now)

  const ouvrirNouveau = (date?: string) =>
    setDraft({ titre: '', date: date ?? isoDate(new Date(mois.getFullYear(), mois.getMonth(), Math.min(now.getDate(), nbJours))), type_prestation: 'mariage', statut: 'previsionnel', client_id: '' })

  const enregistrer = async () => {
    if (!draft) return
    setErr('')
    const client = data?.clients.find((c) => c.id === draft.client_id)
    const payload = {
      titre: draft.titre.trim() || client?.nom || `${nomType(draft.type_prestation)} · sans nom`,
      date: draft.date, type_prestation: draft.type_prestation, statut: draft.statut, client_id: draft.client_id || null,
    }
    const res = draft.id
      ? await db.from('evenements').update(payload).eq('id', draft.id)
      : await db.from('evenements').insert(payload)
    if (res.error) { setErr(res.error.message); return }
    setDraft(null); reload()
  }
  const supprimer = async () => {
    if (!draft?.id || !confirm('Supprimer cet événement du calendrier ?')) return
    await db.from('evenements').delete().eq('id', draft.id)
    setDraft(null); reload()
  }

  const exporterIcs = () => {
    const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DEMA Agency//CRM//FR']
    for (const e of actifs) {
      const d = e.date.replaceAll('-', '')
      const fin = isoDate(new Date(new Date(e.date + 'T12:00:00').getTime() + 86400000)).replaceAll('-', '')
      lignes.push('BEGIN:VEVENT', `UID:${e.id}@dema-agency`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${fin}`,
        `SUMMARY:${e.statut === 'previsionnel' ? '[Option] ' : ''}${e.titre}`, `DESCRIPTION:${nomType(e.type_prestation)} · ${nomStatutEvenement[e.statut]}`, 'END:VEVENT')
    }
    lignes.push('END:VCALENDAR')
    const url = URL.createObjectURL(new Blob([lignes.join('\r\n')], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url; a.download = `dema-agency-${debut.slice(0, 7)}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  const titreMois = mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Production</span>
          <h1 style={{ textTransform: 'capitalize' }}>{titreMois}</h1>
        </div>
        <div className="row">
          <button className="btn" type="button" aria-label="Mois précédent" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>‹</button>
          <button className="btn" type="button" onClick={() => setMois(new Date(now.getFullYear(), now.getMonth(), 1))}>Aujourd’hui</button>
          <button className="btn" type="button" aria-label="Mois suivant" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>›</button>
          <button className="btn" type="button" onClick={exporterIcs} title="Fichier à importer dans Google Agenda">Exporter vers Google Agenda</button>
          <button className="btn primary" type="button" onClick={() => ouvrirNouveau()}>+ Ajouter un événement</button>
        </div>
      </div>

      <div className="legend">
        <span><i className="sw" style={{ background: 'var(--green)' }} />Confirmé</span>
        <span><i className="sw" style={{ background: 'var(--orange)' }} />Prévisionnel (non confirmé)</span>
        <span><i className="sw" style={{ background: '#f5f5f4', border: '1px solid #a8a29e' }} />Annulé</span>
        <span><i className="dot" />Infos prospect à compléter</span>
      </div>

      {error && <p className="error">{error}</p>}

      {conflits.length > 0 && (
        <div className="banner red" role="alert">
          <span><strong>Double réservation possible</strong> · {conflits.map(([d, l]) => `${dateFr(d, { day: 'numeric', month: 'long' })} : ${l.filter((e) => e.statut !== 'annule').map((e) => e.titre).join(' et ')}`).join(' · ')}. À trancher manuellement.</span>
        </div>
      )}

      {aCompleter.length > 0 && (
        <div className="banner outline">
          <span className="row" style={{ gap: 8 }}><i className="dot" /><strong>{aCompleter.length} événement(s) sans fiche prospect :</strong> {aCompleter.map((e) => `${e.titre} (${dateFr(e.date, { day: 'numeric', month: 'short' })})`).join(', ')}</span>
          <Link to="/clients/nouveau" style={{ fontWeight: 600, textDecoration: 'none' }}>Créer la fiche</Link>
        </div>
      )}

      <div className="cal">
        <div className="cal-head">{JOURS.map((j) => <span key={j}>{j}</span>)}</div>
        <div className="cal-grid">
          {Array.from({ length: nbCases }, (_, i) => {
            const n = i - lead + 1
            const dans = n >= 1 && n <= nbJours
            const date = dans ? isoDate(new Date(mois.getFullYear(), mois.getMonth(), n)) : ''
            const liste = dans ? parJour.get(date) ?? [] : []
            const conflit = dans && conflits.some(([d]) => d === date)
            const cls = ['cal-cell', !dans && 'out', i % 7 >= 5 && 'weekend', conflit && 'conflict', date === today && 'today'].filter(Boolean).join(' ')
            return (
              <div key={i} className={cls} onDoubleClick={() => dans && ouvrirNouveau(date)}>
                {dans && <span className="num">{n}</span>}
                {liste.map((e) => (
                  <button key={e.id} type="button" className={'evt ' + e.statut} title={`${e.titre} · ${nomStatutEvenement[e.statut]}`}
                    onClick={() => setDraft({ id: e.id, titre: e.titre, date: e.date, type_prestation: e.type_prestation, statut: e.statut, client_id: e.client_id ?? '' })}>
                    <span>{e.titre}</span>
                    {!e.client_id && e.statut !== 'annule' && <i className="dot" aria-label="Infos prospect à compléter" />}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <span className="small muted">Astuce : double-clique sur un jour pour y ajouter un événement.</span>

      {draft && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <section className="card modal" role="dialog" aria-modal="true" aria-label={draft.id ? 'Modifier l’événement' : 'Nouvel événement'}>
            <div className="card-head">
              <h2>{draft.id ? 'Modifier l’événement' : 'Nouvel événement'}</h2>
              <button className="btn small" type="button" aria-label="Fermer" onClick={() => setDraft(null)}>×</button>
            </div>
            <div className="form-grid">
              <label className="field">Intitulé
                <input value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} placeholder="Ex. Mariage Naomi & Lucas" />
              </label>
              <label className="field">Date
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </label>
              <label className="field">Type de prestation
                <select value={draft.type_prestation} onChange={(e) => setDraft({ ...draft, type_prestation: e.target.value as TypePrestation })}>
                  {TYPES_PRESTATION.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </label>
              <label className="field">Prospect / client lié
                <select value={draft.client_id} onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}>
                  <option value="">Aucun pour l’instant</option>
                  {data?.clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Statut</span>
              <div className="row" role="radiogroup" aria-label="Statut">
                {STATUTS.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={draft.statut === s} className="choice"
                    style={{ minHeight: 44, padding: '0 16px', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    onClick={() => setDraft({ ...draft, statut: s })}>
                    <i className="sw" style={s === 'confirme' ? { background: 'var(--green)' } : s === 'previsionnel' ? { background: 'var(--orange)' } : { background: '#f5f5f4', border: '1px solid #a8a29e' }} />
                    {nomStatutEvenement[s]}
                  </button>
                ))}
              </div>
            </div>
            {!draft.client_id && (
              <div className="banner red" style={{ fontSize: 13 }}>
                <span><strong>Aucun prospect lié.</strong> L’événement affichera un rappel « Infos prospect à compléter ».</span>
                <Link to="/clients/nouveau" style={{ fontWeight: 600, color: 'var(--red-ink)' }}>Créer la fiche</Link>
              </div>
            )}
            {err && <span className="error">{err}</span>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {draft.id ? <button className="btn danger" type="button" onClick={supprimer}>Supprimer</button> : <span />}
              <div className="row">
                <button className="btn" type="button" onClick={() => setDraft(null)}>Annuler</button>
                <button className="btn primary" type="button" onClick={enregistrer}>{draft.id ? 'Enregistrer' : 'Ajouter au calendrier'}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
