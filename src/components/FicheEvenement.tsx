// Fiche événement détaillée : lieux, déroulé, contacts utiles, questionnaire
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import type { Client, ContactUtile, DetailsEvenement, EtapeDeroule, Lieu, TypePrestation } from '../lib/types'

const ONGLETS = [
  { id: 'lieux', nom: 'Lieux' },
  { id: 'deroule', nom: 'Déroulé' },
  { id: 'contacts', nom: 'Contacts' },
  { id: 'questionnaire', nom: 'Questionnaire' },
] as const
type Onglet = (typeof ONGLETS)[number]['id']

export const TYPES_LIEU = ['Mairie', 'Cérémonie religieuse', 'Cérémonie laïque', 'Réception', 'Préparatifs mariée', 'Préparatifs marié', 'Séance photo', 'Autre']
export const ROLES_CONTACT = ['Témoin', 'Wedding planner', 'Traiteur', 'DJ / Musique', 'Photographe (autre)', 'Officiant', 'Salle / lieu', 'Famille', 'Autre']

export const QUESTIONS: Record<TypePrestation, string[]> = {
  mariage: [
    'Comment vous êtes-vous rencontrés ?',
    'Nombre d’invités',
    'Thème / couleurs du mariage',
    'Moments clés à ne surtout pas manquer',
    'Musiques souhaitées pour le film',
    'Personnes importantes à filmer / photographier',
    'Surprises prévues (discours, danse, feu d’artifice…)',
    'Contraintes (lieux interdits au drone, horaires stricts…)',
  ],
  evenementiel: ['Nature de l’événement', 'Nombre d’invités', 'Moments clés', 'Personnes importantes à capter', 'Contraintes du lieu'],
  corporate: ['Objectif de la vidéo / des photos', 'Public visé', 'Messages clés', 'Intervenants à filmer', 'Charte graphique / logo', 'Formats attendus (réseaux, site…)', 'Date limite de livraison'],
  shooting: ['Objectif du shooting', 'Ambiance / moodboard', 'Tenues / accessoires', 'Nombre de photos attendues', 'Utilisation (perso, réseaux, pub…)'],
  autre: ['Description du besoin', 'Moments clés', 'Contraintes'],
}

export default function FicheEvenement({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>('lieux')
  const [d, setD] = useState<DetailsEvenement>(client.details ?? {})
  const [modifie, setModifie] = useState(false)
  const [msg, setMsg] = useState('')

  const maj = (patch: DetailsEvenement) => { setD({ ...d, ...patch }); setModifie(true); setMsg('') }
  const lieux = d.lieux ?? []
  const deroule = d.deroule ?? []
  const contacts = d.contacts ?? []
  const questionnaire = d.questionnaire ?? {}
  const questions = QUESTIONS[client.type_prestation] ?? QUESTIONS.autre

  const setLieu = (i: number, p: Partial<Lieu>) => maj({ lieux: lieux.map((l, k) => (k === i ? { ...l, ...p } : l)) })
  const setEtape = (i: number, p: Partial<EtapeDeroule>) => maj({ deroule: deroule.map((l, k) => (k === i ? { ...l, ...p } : l)) })
  const setContact = (i: number, p: Partial<ContactUtile>) => maj({ contacts: contacts.map((l, k) => (k === i ? { ...l, ...p } : l)) })

  const enregistrer = async () => {
    const propre: DetailsEvenement = { ...d, deroule: [...deroule].sort((a, b) => a.heure.localeCompare(b.heure)) }
    const { error } = await db.from('clients').update({ details: propre }).eq('id', client.id)
    if (error) { setMsg(error.message); return }
    setD(propre); setModifie(false); setMsg('Fiche enregistrée.'); onSaved()
  }

  const compte = { lieux: lieux.length, deroule: deroule.length, contacts: contacts.length, questionnaire: Object.values(questionnaire).filter(Boolean).length }

  return (
    <section className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2>Fiche événement</h2>
          <span className="small muted">Tout ce qu’il faut savoir pour le jour J</span>
        </div>
        <div className="row">
          <Link className="btn small" to={`/clients/${client.id}/feuille-de-route`}>Feuille de route (PDF)</Link>
          <button className="btn small primary" type="button" disabled={!modifie} onClick={enregistrer}>{modifie ? 'Enregistrer' : 'Enregistré'}</button>
        </div>
      </div>
      {msg && <span className="small muted" role="status">{msg}</span>}

      <div className="seg" role="tablist" aria-label="Sections de la fiche" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}>
            {o.nom}{compte[o.id] ? ` (${compte[o.id]})` : ''}
          </button>
        ))}
      </div>

      {onglet === 'lieux' && (
        <div className="stack" style={{ gap: 12 }}>
          {lieux.map((l, i) => (
            <div key={i} className="form-grid fiche-row" style={{ gridTemplateColumns: 'minmax(150px, 1fr) minmax(160px, 1.2fr) minmax(220px, 2fr) 110px 44px', alignItems: 'end' }}>
              <label className="field">Type
                <select value={l.type} onChange={(e) => setLieu(i, { type: e.target.value })}>{TYPES_LIEU.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="field">Nom du lieu<input value={l.nom} onChange={(e) => setLieu(i, { nom: e.target.value })} placeholder="Ex. Château de…" /></label>
              <label className="field">Adresse<input value={l.adresse} onChange={(e) => setLieu(i, { adresse: e.target.value })} /></label>
              <label className="field">Heure<input type="time" value={l.heure} onChange={(e) => setLieu(i, { heure: e.target.value })} /></label>
              <button type="button" className="btn small" aria-label="Supprimer ce lieu" style={{ height: 44 }} onClick={() => maj({ lieux: lieux.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          {lieux.length === 0 && <p className="empty">Aucun lieu. Ajoute la mairie, la cérémonie, la réception…</p>}
          <button type="button" className="btn small dashed" style={{ alignSelf: 'flex-start' }}
            onClick={() => maj({ lieux: [...lieux, { type: TYPES_LIEU[lieux.length] ?? 'Autre', nom: '', adresse: '', heure: '' }] })}>+ Ajouter un lieu</button>
        </div>
      )}

      {onglet === 'deroule' && (
        <div className="stack" style={{ gap: 12 }}>
          {deroule.map((s, i) => (
            <div key={i} className="form-grid fiche-row" style={{ gridTemplateColumns: '110px minmax(180px, 1.2fr) minmax(200px, 2fr) 44px', alignItems: 'end' }}>
              <label className="field">Heure<input type="time" value={s.heure} onChange={(e) => setEtape(i, { heure: e.target.value })} /></label>
              <label className="field">Moment<input value={s.moment} onChange={(e) => setEtape(i, { moment: e.target.value })} placeholder="Ex. Arrivée de la mariée" /></label>
              <label className="field">Notes pour l’équipe<input value={s.notes} onChange={(e) => setEtape(i, { notes: e.target.value })} placeholder="Ex. 2 cadreurs, plan drone" /></label>
              <button type="button" className="btn small" aria-label="Supprimer ce moment" style={{ height: 44 }} onClick={() => maj({ deroule: deroule.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          {deroule.length === 0 && <p className="empty">Aucun moment. Construis le déroulé de la journée heure par heure.</p>}
          <button type="button" className="btn small dashed" style={{ alignSelf: 'flex-start' }}
            onClick={() => maj({ deroule: [...deroule, { heure: '', moment: '', notes: '' }] })}>+ Ajouter un moment</button>
          <span className="small muted">Les moments sont triés par heure à l’enregistrement.</span>
        </div>
      )}

      {onglet === 'contacts' && (
        <div className="stack" style={{ gap: 12 }}>
          {contacts.map((c, i) => (
            <div key={i} className="form-grid fiche-row" style={{ gridTemplateColumns: 'minmax(150px, 1fr) minmax(150px, 1.2fr) minmax(130px, 1fr) minmax(170px, 1.2fr) 44px', alignItems: 'end' }}>
              <label className="field">Rôle
                <select value={c.role} onChange={(e) => setContact(i, { role: e.target.value })}>{ROLES_CONTACT.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="field">Nom<input value={c.nom} onChange={(e) => setContact(i, { nom: e.target.value })} /></label>
              <label className="field">Téléphone<input type="tel" value={c.telephone} onChange={(e) => setContact(i, { telephone: e.target.value })} /></label>
              <label className="field">E-mail<input type="email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} /></label>
              <button type="button" className="btn small" aria-label="Supprimer ce contact" style={{ height: 44 }} onClick={() => maj({ contacts: contacts.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          {contacts.length === 0 && <p className="empty">Aucun contact. Ajoute les témoins, le wedding planner, le traiteur…</p>}
          <button type="button" className="btn small dashed" style={{ alignSelf: 'flex-start' }}
            onClick={() => maj({ contacts: [...contacts, { role: 'Témoin', nom: '', telephone: '', email: '' }] })}>+ Ajouter un contact</button>
        </div>
      )}

      {onglet === 'questionnaire' && (
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {questions.map((q) => (
            <label key={q} className="field">{q}
              <textarea value={questionnaire[q] ?? ''} onChange={(e) => maj({ questionnaire: { ...questionnaire, [q]: e.target.value } })} style={{ minHeight: 70 }} />
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
