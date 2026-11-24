import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { TYPES_PRESTATION, dateFr, isoDate, nomStatutEvenement, nomType } from '../lib/format'
import { enregistrerEvenement, ficheIncomplete, nomDepuisTitre, supprimerEvenement, type EvenementDraft } from '../lib/actions'
import type { Client, Evenement, StatutEvenement, TypePrestation } from '../lib/types'

type Draft = EvenementDraft
type Vue = 'annee' | 'mois'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const STATUTS: StatutEvenement[] = ['previsionnel', 'confirme', 'annule']
const COULEUR: Record<StatutEvenement, string> = { confirme: 'var(--green)', previsionnel: 'var(--orange)', annule: '#a8a29e' }

/** Nombre de jours entre aujourd'hui et une date AAAA-MM-JJ */
function dans(date: string, today: string) {
  const d = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
  if (d === 0) return 'Aujourd’hui'
  if (d === 1) return 'Demain'
  if (d < 31) return `Dans ${d} jours`
  const m = Math.round(d / 30.4)
  return `Dans ${m} mois`
}

export default function Calendrier() {
  const now = new Date()
  const today = isoDate(now)
  const [vue, setVue] = useState<Vue>('annee')
  const [annee, setAnnee] = useState(now.getFullYear())
  const [mois, setMois] = useState(now.getMonth())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [err, setErr] = useState('')

  // Vue globale : 12 mois glissants à partir du mois choisi
  const douzeMois = Array.from({ length: 12 }, (_, i) => { const d = new Date(annee, mois + i, 1); return { a: d.getFullYear(), m: d.getMonth() } })
  const debut = isoDate(new Date(annee, mois, 1))
  const fin = isoDate(new Date(annee, mois + (vue === 'annee' ? 12 : 1), 0))

  const { data, error, reload } = useLoad(async () => {
    const [evenements, aVenir, clients] = await Promise.all([
      db.from('evenements').select('*').gte('date', debut).lte('date', fin).order('date'),
      db.from('evenements').select('*').gte('date', today).neq('statut', 'annule').order('date').limit(12),
      db.from('clients').select('id, nom, type_prestation, date_evenement, email, telephone, statut_commercial').order('nom'),
    ])
    return {
      evenements: must(evenements) as Evenement[],
      aVenir: must(aVenir) as Evenement[],
      clients: must(clients) as Client[],
    }
  }, [debut, fin, today])

  const evts = data?.evenements ?? []
  const actifs = evts.filter((e) => e.statut !== 'annule')
  const parJour = new Map<string, Evenement[]>()
  for (const e of evts) parJour.set(e.date, [...(parJour.get(e.date) ?? []), e])
  const conflits = [...parJour.entries()].filter(([, l]) => l.filter((e) => e.statut !== 'annule').length > 1)
  const estConflit = (d: string) => conflits.some(([x]) => x === d)
  const clientDe = (id: string | null) => data?.clients.find((c) => c.id === id)
  const incomplet = (e: Evenement) => e.statut !== 'annule' && ficheIncomplete(clientDe(e.client_id))
  const aCompleter = (data?.aVenir ?? []).filter(incomplet)
  const fichesACompleter = [...new Set(aCompleter.map((e) => e.client_id).filter(Boolean))] as string[]

  const ouvrirNouveau = (date?: string) =>
    setDraft({ titre: '', date: date ?? today, type_prestation: 'mariage', statut: 'previsionnel', client_id: '' })
  const ouvrir = (e: Evenement) =>
    setDraft({ id: e.id, titre: e.titre, date: e.date, type_prestation: e.type_prestation, statut: e.statut, client_id: e.client_id ?? '' })
  const allerAuMois = (a: number, m: number) => { setAnnee(a); setMois(m); setVue('mois') }

  const enregistrer = async () => {
    if (!draft) return
    setErr('')
    const client = clientDe(draft.client_id)
    if (!draft.titre.trim() && !client) { setErr('Donne un intitulé (ex. « Mariage Naomi & Lucas ») : il sert à créer la fiche prospect.'); return }
    try {
      await enregistrerEvenement({ ...draft, titre: draft.titre.trim() || client?.nom || '' })
      setDraft(null); reload()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur') }
  }
  const supprimer = async () => {
    if (!draft?.id || !confirm('Supprimer cette date du calendrier ?')) return
    await supprimerEvenement({ id: draft.id, client_id: draft.client_id || null })
    setDraft(null); reload()
  }

  const exporterIcs = () => {
    const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DEMA Agency//CRM//FR']
    for (const e of actifs) {
      const d = e.date.replaceAll('-', '')
      const f = isoDate(new Date(new Date(e.date + 'T12:00:00').getTime() + 86400000)).replaceAll('-', '')
      lignes.push('BEGIN:VEVENT', `UID:${e.id}@dema-agency`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${f}`,
        `SUMMARY:${e.statut === 'previsionnel' ? '[Option] ' : ''}${e.titre}`, `DESCRIPTION:${nomType(e.type_prestation)} · ${nomStatutEvenement[e.statut]}`, 'END:VEVENT')
    }
    lignes.push('END:VCALENDAR')
    const url = URL.createObjectURL(new Blob([lignes.join('\r\n')], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url; a.download = `dema-agency-${debut.slice(0, 7)}.ics`; a.click()
    URL.revokeObjectURL(url)
  }

  const decaler = (n: number) => { const d = new Date(annee, mois + n, 1); setAnnee(d.getFullYear()); setMois(d.getMonth()) }
  const precedent = () => decaler(vue === 'annee' ? -3 : -1)
  const suivant = () => decaler(vue === 'annee' ? 3 : 1)
  const dernier = douzeMois[11]
  const titre = vue === 'annee' ? `${MOIS[mois]} ${annee} → ${MOIS[dernier.m]} ${dernier.a}` : `${MOIS[mois]} ${annee}`

  // ───── Vue année : 12 mini-mois ─────
  const miniMois = (annee: number, m: number) => {
    const premier = new Date(annee, m, 1)
    const lead = (premier.getDay() + 6) % 7
    const nb = new Date(annee, m + 1, 0).getDate()
    const prefixe = `${annee}-${String(m + 1).padStart(2, '0')}`
    const nbEvts = actifs.filter((e) => e.date.startsWith(prefixe)).length
    return (
      <section key={prefixe} className="card" style={{ padding: 14, gap: 8 }}>
        <button type="button" onClick={() => allerAuMois(annee, m)} className="row"
          style={{ justifyContent: 'space-between', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{MOIS[m]} <span className="muted" style={{ fontWeight: 400 }}>{annee}</span></span>
          {nbEvts > 0 && <span className="badge indigo">{nbEvts}<span className="badge-long"> événement{nbEvts > 1 ? 's' : ''}</span></span>}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center' }}>
          {JOURS_COURTS.map((j, i) => <span key={i} style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{j}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={'v' + i} />)}
          {Array.from({ length: nb }, (_, i) => {
            const date = isoDate(new Date(annee, m, i + 1))
            const liste = (parJour.get(date) ?? [])
            const vis = liste.filter((e) => e.statut !== 'annule')
            const principal = vis.find((e) => e.statut === 'confirme') ?? vis[0] ?? liste[0]
            const conflit = estConflit(date)
            const style: React.CSSProperties = {
              fontSize: 11, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: conflit ? '2px solid var(--red)' : '1px solid transparent', padding: 0, font: 'inherit',
              background: principal ? COULEUR[principal.statut] : date === today ? 'var(--accent-soft)' : 'transparent',
              color: principal && principal.statut !== 'annule' ? '#fff' : date === today ? 'var(--accent-dark)' : 'var(--soft)',
              fontWeight: principal || date === today ? 700 : 400, cursor: liste.length ? 'pointer' : 'default',
            }
            return liste.length
              ? <button key={i} type="button" style={style} title={liste.map((e) => `${e.titre} · ${nomStatutEvenement[e.statut]}`).join('\n')}
                  onClick={() => (liste.length === 1 ? ouvrir(liste[0]) : allerAuMois(annee, m))}>{i + 1}</button>
              : <span key={i} style={{ ...style, fontSize: 11 }}>{i + 1}</span>
          })}
        </div>
      </section>
    )
  }

  // ───── Vue mois : grille détaillée ─────
  const premier = new Date(annee, mois, 1)
  const lead = (premier.getDay() + 6) % 7
  const nbJours = new Date(annee, mois + 1, 0).getDate()
  const nbCases = Math.ceil((lead + nbJours) / 7) * 7

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Production</span>
          <h1>{titre}</h1>
        </div>
        <div className="row cal-actions">
          <div className="seg" role="tablist" aria-label="Affichage">
            <button type="button" role="tab" aria-selected={vue === 'annee'} onClick={() => setVue('annee')}>Vue globale</button>
            <button type="button" role="tab" aria-selected={vue === 'mois'} onClick={() => setVue('mois')}>Mois</button>
          </div>
          <button className="btn" type="button" aria-label="Précédent" onClick={precedent}>‹</button>
          <button className="btn" type="button" onClick={() => { setAnnee(now.getFullYear()); setMois(now.getMonth()) }}>Aujourd’hui</button>
          <button className="btn" type="button" aria-label="Suivant" onClick={suivant}>›</button>
          <button className="btn cal-ics" type="button" onClick={exporterIcs} title="Fichier à importer dans Google Agenda">Exporter (.ics)</button>
          <button className="btn primary" type="button" onClick={() => ouvrirNouveau()}>+ Ajouter un événement</button>
        </div>
      </div>

      <div className="legend">
        <span><i className="sw" style={{ background: 'var(--green)' }} />Confirmé</span>
        <span><i className="sw" style={{ background: 'var(--orange)' }} />Prévisionnel</span>
        <span><i className="sw" style={{ background: '#f5f5f4', border: '1px solid #a8a29e' }} />Annulé</span>
        <span><i className="sw" style={{ border: '2px solid var(--red)' }} />Double réservation</span>
        <span><i className="dot" />Coordonnées client à compléter</span>
      </div>

      {error && <p className="error">{error}</p>}

      {conflits.length > 0 && (
        <div className="banner red" role="alert">
          <span><strong>Double réservation possible</strong> · {conflits.map(([d, l]) => `${dateFr(d, { day: 'numeric', month: 'long' })} : ${l.filter((e) => e.statut !== 'annule').map((e) => e.titre).join(' et ')}`).join(' · ')}. À trancher manuellement.</span>
        </div>
      )}

      <div className="row cal-layout" style={{ alignItems: 'flex-start', gap: 20 }}>
        {/* Calendrier */}
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          {vue === 'annee' ? (
            <div className="cal-mini-grid">
              {douzeMois.map(({ a, m }) => miniMois(a, m))}
            </div>
          ) : (
            <>
              <div className="cal">
                <div className="cal-head">{JOURS.map((j) => <span key={j}>{j}</span>)}</div>
                <div className="cal-grid">
                  {Array.from({ length: nbCases }, (_, i) => {
                    const n = i - lead + 1
                    const dansMois = n >= 1 && n <= nbJours
                    const date = dansMois ? isoDate(new Date(annee, mois, n)) : ''
                    const liste = dansMois ? parJour.get(date) ?? [] : []
                    const cls = ['cal-cell', !dansMois && 'out', i % 7 >= 5 && 'weekend', dansMois && estConflit(date) && 'conflict', date === today && 'today'].filter(Boolean).join(' ')
                    return (
                      <div key={i} className={cls} onDoubleClick={() => dansMois && ouvrirNouveau(date)}
                        onClick={(ev) => { if (dansMois && ev.target === ev.currentTarget && window.matchMedia('(max-width: 760px)').matches) ouvrirNouveau(date) }}>
                        {dansMois && <span className="num">{n}</span>}
                        {liste.map((e) => (
                          <button key={e.id} type="button" className={'evt ' + e.statut} title={`${e.titre} · ${nomStatutEvenement[e.statut]}`} onClick={() => ouvrir(e)}>
                            <span>{e.titre}</span>
                            {incomplet(e) && <i className="dot" aria-label="Fiche prospect à compléter" />}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
              <span className="small muted" style={{ display: 'block', marginTop: 8 }}>Astuce : double-clique (ou touche, sur téléphone) un jour vide pour y ajouter un événement.</span>
            </>
          )}
        </div>

        {/* À venir */}
        <aside className="card cal-aside" style={{ flex: '1 1 300px', gap: 4 }}>
          <div className="card-head" style={{ paddingBottom: 6 }}>
            <h2>À venir</h2>
            <span className="small muted">{data?.aVenir.length ?? 0} prochain{(data?.aVenir.length ?? 0) > 1 ? 's' : ''}</span>
          </div>
          {data && data.aVenir.length === 0 && <p className="empty">Aucun événement à venir.</p>}
          {data?.aVenir.map((e) => {
            const d = new Date(e.date + 'T12:00:00')
            return (
              <button key={e.id} type="button" onClick={() => ouvrir(e)} className="row"
                style={{ flexWrap: 'nowrap', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line-soft)', background: 'none', border: 0, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--line-soft)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%' }}>
                <div style={{ flex: 'none', width: 48, borderRadius: 10, overflow: 'hidden', textAlign: 'center', border: `1px solid ${COULEUR[e.statut]}` }}>
                  <div style={{ background: COULEUR[e.statut], color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 0', textTransform: 'uppercase' }}>
                    {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, padding: '2px 0' }}>{d.getDate()}</div>
                </div>
                <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titre}</span>
                    {incomplet(e) && <i className="dot" aria-label="Fiche prospect à compléter" />}
                  </span>
                  <span className="small muted">{dans(e.date, today)} · {nomType(e.type_prestation)}</span>
                  <span className="small" style={{ color: e.statut === 'confirme' ? 'var(--green-ink)' : '#9a3412', fontWeight: 600 }}>
                    {nomStatutEvenement[e.statut]}{clientDe(e.client_id) && clientDe(e.client_id)!.nom !== e.titre ? ` · ${clientDe(e.client_id)!.nom}` : ''}
                  </span>
                </div>
              </button>
            )
          })}
          {aCompleter.length > 0 && (
            <div className="banner outline" style={{ marginTop: 10, fontSize: 13, padding: '10px 12px' }}>
              <span className="row" style={{ gap: 8 }}><i className="dot" />{fichesACompleter.length} fiche{fichesACompleter.length > 1 ? 's' : ''} sans coordonnées</span>
              <Link to={`/clients/${fichesACompleter[0]}`} style={{ fontWeight: 600, textDecoration: 'none' }}>Compléter</Link>
            </div>
          )}
        </aside>
      </div>

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
                  <option value="">+ Nouvelle fiche (créée automatiquement)</option>
                  {data?.clients.filter((c) => c.statut_commercial !== 'perdu' || c.id === draft.client_id).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
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
                    <i className="sw" style={s === 'annule' ? { background: '#f5f5f4', border: '1px solid #a8a29e' } : { background: COULEUR[s] }} />
                    {nomStatutEvenement[s]}
                  </button>
                ))}
              </div>
            </div>
            {!draft.client_id ? (
              <div className="banner amber" style={{ fontSize: 13 }}>
                <span>Une fiche prospect <strong>« {nomDepuisTitre(draft.titre) || '…'} »</strong> sera créée et reliée à cette date. Pense à compléter ses coordonnées.</span>
              </div>
            ) : (
              <div className="banner outline" style={{ fontSize: 13, borderColor: 'var(--line)' }}>
                <span>Reliée à la fiche <strong>{clientDe(draft.client_id)?.nom}</strong>{ficheIncomplete(clientDe(draft.client_id)) ? ' · coordonnées à compléter' : ''}. Statut confirmé = client + projet créé.</span>
                <Link to={`/clients/${draft.client_id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>Ouvrir la fiche</Link>
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
