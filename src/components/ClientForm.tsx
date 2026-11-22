import { TYPES_PRESTATION } from '../lib/format'
import type { Client, TypePrestation } from '../lib/types'

export type ClientDraft = Pick<Client, 'type_prestation' | 'nom' | 'contact' | 'telephone' | 'email' | 'adresse' | 'date_evenement' | 'notes'>

export const emptyClient: ClientDraft = {
  type_prestation: 'mariage', nom: '', contact: '', telephone: '', email: '', adresse: '', date_evenement: '', notes: '',
}

const LABEL_NOM: Record<TypePrestation, [string, string]> = {
  mariage: ['Prénoms du couple', 'Ex. Laura & Yann'],
  evenementiel: ['Nom du client', 'Particulier ou association'],
  corporate: ['Société', 'Raison sociale'],
  shooting: ['Nom du client', 'Particulier ou marque'],
  autre: ['Nom du client', 'Nom'],
}

export default function ClientForm({ value, onChange }: { value: ClientDraft; onChange: (v: ClientDraft) => void }) {
  const set = (k: keyof ClientDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  const [labelNom, phNom] = LABEL_NOM[value.type_prestation]

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Type de prestation</h2>
          <span className="small muted">Un seul choix</span>
        </div>
        <div className="choice-grid" role="radiogroup" aria-label="Type de prestation">
          {TYPES_PRESTATION.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={value.type_prestation === t.id} className="choice"
              onClick={() => onChange({ ...value, type_prestation: t.id })}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.nom}</span>
              <span className="small muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Informations client</h2>
        <div className="form-grid">
          <label className="field">{labelNom}
            <input required value={value.nom} onChange={set('nom')} placeholder={phNom} />
          </label>
          <label className="field">Contact principal
            <input value={value.contact ?? ''} onChange={set('contact')} placeholder="Prénom Nom" />
          </label>
          <label className="field">Téléphone
            <input type="tel" value={value.telephone ?? ''} onChange={set('telephone')} />
          </label>
          <label className="field">E-mail
            <input type="email" value={value.email ?? ''} onChange={set('email')} />
          </label>
          <label className="field">Date de l’événement
            <input type="date" value={value.date_evenement ?? ''} onChange={set('date_evenement')} />
          </label>
          <label className="field">Adresse de facturation
            <input value={value.adresse ?? ''} onChange={set('adresse')} placeholder="N°, rue, code postal, ville" />
          </label>
        </div>
        <label className="field">Notes
          <textarea value={value.notes ?? ''} onChange={set('notes')} />
        </label>
      </section>
    </>
  )
}
