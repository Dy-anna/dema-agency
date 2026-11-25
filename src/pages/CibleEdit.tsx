import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { TYPES_PRESTATION, dateFr, isoDate } from '../lib/format'
import { CATEGORIES, SEQUENCE, STATUTS_CIBLE, TYPES_ACTION, iconeAction, plusJours } from '../lib/chasse'
import type { Cible, CibleAction, Profile } from '../lib/types'

const VIDE: Omit<Cible, 'id'> = {
  nom: '', categorie: 'entreprise', contact_nom: null, contact_role: null, telephone: null, email: null, reseau: null, site: null,
  type_prestation: 'corporate', priorite: 'B', potentiel: 0, source: null, statut: 'a_cibler', responsable_id: null, client_id: null, notes: null,
}

export default function CibleEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, isGerant } = useAuth()
  const nouveau = !id || id === 'nouveau'
  const today = isoDate(new Date())
  const [c, setC] = useState<Omit<Cible, 'id'> | null>(null)
  const [msg, setMsg] = useState('')
  const [erreur, setErreur] = useState('')
  const [ajout, setAjout] = useState({ type: 'message', titre: '', echeance: today, assigne_a: '' })

  const { data, error, reload } = useLoad(async () => {
    const equipe = must(await db.from('profiles').select('id, nom, role').order('nom')) as Profile[]
    if (nouveau) return { equipe, cible: null, actions: [] as CibleAction[] }
    const [ci, ac] = await Promise.all([
      db.from('cibles').select('*').eq('id', id!).single(),
      db.from('cible_actions').select('*').eq('cible_id', id!).order('echeance', { ascending: true, nullsFirst: false }),
    ])
    return { equipe, cible: must(ci) as Cible, actions: must(ac) as CibleAction[] }
  }, [id])

  useEffect(() => {
    if (!data || c) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(data.cible ? { ...VIDE, ...data.cible } : { ...VIDE, responsable_id: profile?.id ?? null })
  }, [data, c, profile])

  if (error) return <p className="error">{error}</p>
  if (!data || !c) return <p className="muted">Chargement…</p>

  const set = (p: Partial<Omit<Cible, 'id'>>) => { setC({ ...c, ...p }); setMsg('') }

  const enregistrer = async (extra: Partial<Omit<Cible, 'id'>> = {}, sequence = false) => {
    setErreur('')
    const v = { ...c, ...extra, potentiel: Number(c.potentiel) || 0 }
    if (!v.nom.trim()) { setErreur('Indique le nom de la cible (entreprise, institution, personne).'); return null }
    if (nouveau) {
      const { data: res, error: err } = await db.from('cibles').insert({ ...v, nom: v.nom.trim() }).select('id').single()
      if (err) { setErreur(err.message); return null }
      const newId = (res as { id: string }).id
      if (sequence) await ajouterSequence(newId)
      nav(`/chasse/${newId}`, { replace: true })
      return newId
    }
    const { error: err } = await db.from('cibles').update(v).eq('id', id!)
    if (err) { setErreur(err.message); return null }
    setC(v); setMsg('Enregistré')
    return id!
  }

  const ajouterSequence = async (cibleId: string) => {
    await db.from('cible_actions').insert(SEQUENCE.map((s) => ({
      cible_id: cibleId, type: s.type, titre: s.titre, echeance: plusJours(today, s.j), assigne_a: c.responsable_id, fait: false,
    })))
  }

  const ajouterAction = async () => {
    if (!ajout.titre.trim()) { setErreur('Décris l’action (ex. « Appeler la responsable com »).'); return }
    setErreur('')
    await db.from('cible_actions').insert({ cible_id: id, type: ajout.type, titre: ajout.titre.trim(), echeance: ajout.echeance || null, assigne_a: ajout.assigne_a || null, fait: false })
    setAjout({ ...ajout, titre: '' })
    reload()
  }

  const cocher = async (a: CibleAction, resultat?: string) => {
    const fait = !a.fait
    await db.from('cible_actions').update({ fait, fait_le: fait ? today : null, ...(resultat !== undefined ? { resultat } : {}) }).eq('id', a.id)
    if (fait) {
      const statut = a.type === 'rdv' ? 'rdv' : c.statut === 'a_cibler' && a.type !== 'recherche' ? 'contacte' : null
      if (statut && statut !== c.statut) { await db.from('cibles').update({ statut }).eq('id', id!); setC({ ...c, statut }) }
    }
    reload()
  }
  const supprimerAction = async (a: CibleAction) => { await db.from('cible_actions').delete().eq('id', a.id); reload() }

  const convertir = async () => {
    if (c.client_id) { nav(`/clients/${c.client_id}`); return }
    const contact = [c.contact_nom, c.contact_role].filter(Boolean).join(' · ')
    const { data: res, error: err } = await db.from('clients').insert({
      nom: c.nom, type_prestation: c.type_prestation, contact: contact || null, telephone: c.telephone, email: c.email,
      statut_commercial: 'prospect', notes: `Venu du chasseur de têtes${c.source ? ` (source : ${c.source})` : ''}.${c.notes ? '\n' + c.notes : ''}`,
    }).select('id').single()
    if (err) { setErreur(err.message); return }
    const clientId = (res as { id: string }).id
    await enregistrer({ statut: 'converti', client_id: clientId })
    nav(`/clients/${clientId}`)
  }

  const supprimer = async () => {
    if (!confirm(`Supprimer ${c.nom} et toutes ses actions ?`)) return
    await db.from('cibles').delete().eq('id', id!)
    nav('/chasse')
  }

  const ouvertes = data.actions.filter((a) => !a.fait)
  const faites = data.actions.filter((a) => a.fait).sort((a, b) => (b.fait_le ?? '').localeCompare(a.fait_le ?? ''))
  const nomDe = (pid: string | null) => (pid ? data.equipe.find((m) => m.id === pid)?.nom ?? '' : '')

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <Link to="/chasse" className="small">← Chasseur de têtes</Link>
          <h1>{nouveau ? 'Nouvelle cible' : c.nom}</h1>
          {!nouveau && <span className="muted">{CATEGORIES.find((x) => x.id === c.categorie)?.nom} · priorité {c.priorite}{c.contact_nom ? ` · ${c.contact_nom}` : ''}</span>}
        </div>
        {!nouveau && (
          <div className="row">
            <Link className="btn" to={`/rendez-vous?cible=${id}`}>📅 Prendre un RDV</Link>
            {c.statut !== 'pas_interesse' && <button className="btn primary" type="button" onClick={convertir}>{c.client_id ? 'Ouvrir la fiche prospect' : 'Transformer en prospect →'}</button>}
          </div>
        )}
      </div>

      {!nouveau && (
        <div className="seg" role="tablist" aria-label="Statut" style={{ alignSelf: 'flex-start' }}>
          {STATUTS_CIBLE.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={c.statut === s.id} onClick={() => enregistrer({ statut: s.id })}>{s.nom}</button>
          ))}
        </div>
      )}

      <div className="grid-cards">
        <section className="card">
          <h2>La cible</h2>
          <div className="form-grid">
            <label className="field">Nom (entreprise, institution, personne)<input value={c.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Ex. Mairie de Meaux, Accor Arena, Wedding planner X" /></label>
            <label className="field">Catégorie
              <select value={c.categorie} onChange={(e) => set({ categorie: e.target.value })}>
                {CATEGORIES.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
              </select>
            </label>
            <label className="field">Interlocuteur<input value={c.contact_nom ?? ''} onChange={(e) => set({ contact_nom: e.target.value || null })} placeholder="Nom de la personne à contacter" /></label>
            <label className="field">Son rôle<input value={c.contact_role ?? ''} onChange={(e) => set({ contact_role: e.target.value || null })} placeholder="Ex. Responsable communication" /></label>
            <label className="field">Téléphone<input type="tel" value={c.telephone ?? ''} onChange={(e) => set({ telephone: e.target.value || null })} /></label>
            <label className="field">E-mail<input type="email" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value || null })} /></label>
            <label className="field">LinkedIn / Instagram<input value={c.reseau ?? ''} onChange={(e) => set({ reseau: e.target.value || null })} placeholder="Lien ou @compte" /></label>
            <label className="field">Site web<input value={c.site ?? ''} onChange={(e) => set({ site: e.target.value || null })} /></label>
          </div>
        </section>

        <section className="card">
          <h2>Pourquoi on la vise</h2>
          <div className="form-grid">
            <label className="field">Priorité
              <select value={c.priorite} onChange={(e) => set({ priorite: e.target.value as Cible['priorite'] })}>
                <option value="A">A · à décrocher en premier</option>
                <option value="B">B · intéressante</option>
                <option value="C">C · plus tard</option>
              </select>
            </label>
            <label className="field">Prestation visée
              <select value={c.type_prestation} onChange={(e) => set({ type_prestation: e.target.value as Cible['type_prestation'] })}>
                {TYPES_PRESTATION.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </label>
            {isGerant && <label className="field">Potentiel estimé par an (€)<input type="number" min="0" step="500" value={c.potentiel || ''} onChange={(e) => set({ potentiel: Number(e.target.value) })} /></label>}
            <label className="field">Source<input value={c.source ?? ''} onChange={(e) => set({ source: e.target.value || null })} placeholder="Ex. Salon des Maires, recommandation, LinkedIn" /></label>
            <label className="field">Responsable
              <select value={c.responsable_id ?? ''} onChange={(e) => set({ responsable_id: e.target.value || null })}>
                <option value="">Personne</option>
                {data.equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Notes (angle d’approche, besoins, événements à venir)<textarea value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} placeholder="Ex. organise un gala chaque décembre ; pas de vidéaste attitré ; passer par la responsable com" /></label>
        </section>

        {!nouveau && (
          <section className="card">
            <div className="card-head">
              <h2>Actions à poser</h2>
              <span className="badge grey">{ouvertes.length} à faire</span>
            </div>
            {ouvertes.length === 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="empty" style={{ padding: 0 }}>Aucune action prévue.</p>
                <button className="btn dashed" type="button" onClick={async () => { await ajouterSequence(id!); reload() }}>+ Ajouter la séquence type (5 étapes sur 2 semaines)</button>
              </div>
            )}
            {ouvertes.map((a) => (
              <div key={a.id} className="checkline" style={{ alignItems: 'flex-start' }}>
                <label style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={false} onChange={() => cocher(a)} style={{ marginTop: 3 }} />
                  <span className="stack" style={{ gap: 2 }}>
                    <span>{iconeAction(a.type)} {a.titre}</span>
                    <span className="small" style={{ color: a.echeance && a.echeance < today ? 'var(--red)' : 'var(--muted)' }}>
                      {a.echeance ? (a.echeance < today ? 'En retard · ' : '') + dateFr(a.echeance, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sans date'}
                      {nomDe(a.assigne_a ?? c.responsable_id) && ` · ${nomDe(a.assigne_a ?? c.responsable_id)}`}
                    </span>
                  </span>
                </label>
                <button type="button" className="btn small" aria-label="Supprimer l’action" onClick={() => supprimerAction(a)}>×</button>
              </div>
            ))}
            <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
              <span className="small" style={{ fontWeight: 600 }}>Nouvelle action</span>
              <div className="row" style={{ gap: 8 }}>
                <select className="input" aria-label="Type d’action" value={ajout.type} onChange={(e) => setAjout({ ...ajout, type: e.target.value })}>
                  {TYPES_ACTION.map((t) => <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>)}
                </select>
                <input className="input" type="date" aria-label="Échéance" value={ajout.echeance} onChange={(e) => setAjout({ ...ajout, echeance: e.target.value })} />
                <select className="input" aria-label="Qui s’en charge" value={ajout.assigne_a} onChange={(e) => setAjout({ ...ajout, assigne_a: e.target.value })}>
                  <option value="">Responsable de la cible</option>
                  {data.equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Ex. Envoyer la vidéo du gala Africa Day" value={ajout.titre}
                  onChange={(e) => setAjout({ ...ajout, titre: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ajouterAction()} />
                <button className="btn" type="button" onClick={ajouterAction}>Ajouter</button>
              </div>
            </div>
          </section>
        )}

        {!nouveau && faites.length > 0 && (
          <section className="card">
            <h2>Historique</h2>
            {faites.map((a) => (
              <div key={a.id} className="list-row">
                <div className="stack" style={{ gap: 2 }}>
                  <span className="title" style={{ fontWeight: 500 }}>{iconeAction(a.type)} {a.titre}</span>
                  <span className="sub">Fait {a.fait_le ? `le ${dateFr(a.fait_le, { day: 'numeric', month: 'short' })}` : ''}{a.resultat ? ` · ${a.resultat}` : ''}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn small" onClick={() => { const r = prompt('Résultat de cette action ?', a.resultat ?? ''); if (r !== null) db.from('cible_actions').update({ resultat: r }).eq('id', a.id).then(reload) }}>Résultat</button>
                  <button type="button" className="btn small" onClick={() => cocher(a)}>Rouvrir</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {erreur && <p className="error">{erreur}</p>}
      <div className="row">
        {nouveau ? (
          <>
            <button className="btn primary" type="button" onClick={() => enregistrer({}, true)}>Créer avec la séquence type</button>
            <button className="btn" type="button" onClick={() => enregistrer()}>Créer sans actions</button>
          </>
        ) : (
          <>
            <button className="btn primary" type="button" onClick={() => enregistrer()}>Enregistrer</button>
            <button className="btn danger" type="button" onClick={supprimer}>Supprimer</button>
          </>
        )}
        {msg && <span className="small" style={{ color: 'var(--green-ink)' }}>{msg}</span>}
      </div>
      {nouveau && <span className="small muted">Séquence type : rechercher le bon contact → message personnalisé (J+1) → portfolio (J+4) → appel (J+8) → relance avec une idée concrète (J+15). Tu pourras tout modifier ensuite.</span>}
    </>
  )
}
