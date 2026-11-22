import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { nomType } from '../lib/format'
import ClientForm, { emptyClient, type ClientDraft } from '../components/ClientForm'

export default function ClientNew() {
  const nav = useNavigate()
  const [draft, setDraft] = useState<ClientDraft>(emptyClient)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.nom.trim()) { setError('Le nom est obligatoire.'); return }
    setBusy(true); setError('')
    const payload = { ...draft, date_evenement: draft.date_evenement || null }
    const { data, error } = await supabase.from('clients').insert(payload).select('id').single()
    if (error) { setError(error.message); setBusy(false); return }
    // La date est posée en provisoire dans le calendrier dès l'enregistrement
    if (draft.date_evenement) {
      await supabase.from('evenements').insert({
        titre: draft.nom, date: draft.date_evenement, type_prestation: draft.type_prestation,
        statut: 'previsionnel', client_id: data.id,
      })
    }
    nav(`/clients/${data.id}`)
  }

  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <div className="stack">
        <Link to="/clients" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>← Clients</Link>
        <h1>Nouveau prospect</h1>
      </div>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20, maxWidth: 1120 }}>
        <div className="stack" style={{ flex: '999 1 520px', minWidth: 0, gap: 20 }}>
          <ClientForm value={draft} onChange={setDraft} />
        </div>
        <aside className="card" style={{ flex: '1 1 300px', background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
          <h2>Récapitulatif</h2>
          <span style={{ fontSize: 13, color: '#c9c9d1' }}>Type de prestation</span>
          <span className="badge" style={{ alignSelf: 'flex-start', background: '#2c2c36', color: '#fff', fontSize: 14, padding: '6px 14px' }}>{nomType(draft.type_prestation)}</span>
          <span style={{ fontSize: 13, color: '#c9c9d1', lineHeight: 1.5 }}>
            {draft.date_evenement ? 'La date sera posée en prévisionnel sur le calendrier. ' : ''}
            Le contenu du devis (vidéo, photo, options…) se définit ensuite avec le client, directement dans le devis.
          </span>
          {error && <span role="alert" style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Créer le prospect'}</button>
          <Link className="btn" to="/clients" style={{ background: 'transparent', color: '#e8e8ec', borderColor: '#3f3f4a' }}>Annuler</Link>
        </aside>
      </div>
    </form>
  )
}
