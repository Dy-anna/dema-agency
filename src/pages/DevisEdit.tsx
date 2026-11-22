import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { STATUTS_DEVIS, dateFr, euro, nomType } from '../lib/format'
import { signerDevis } from '../lib/actions'
import type { Client, Devis, LigneDevis, StatutDevis, TypePrestation } from '../lib/types'

// Suggestions de lignes selon le type de prestation (modifiables)
const SUGGESTIONS: Record<TypePrestation, string[]> = {
  mariage: ['Film de mariage', 'Teaser', 'Reportage photo', 'Prises de vue drone', 'Album photo', 'Seconde caméra'],
  evenementiel: ['Captation vidéo', 'Aftermovie', 'Reportage photo', 'Drone'],
  corporate: ['Vidéo institutionnelle', 'Interviews', 'Déclinaisons réseaux sociaux', 'Reportage photo'],
  shooting: ['Shooting photo', 'Shooting vidéo', 'Retouches avancées', 'Location studio'],
  autre: ['Prestation'],
}

export default function DevisEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const [lignes, setLignes] = useState<LigneDevis[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error, reload } = useLoad(async () => {
    const devis = must(await db.from('devis').select('*').eq('id', id!).single()) as Devis
    const client = must(await db.from('clients').select('*').eq('id', devis.client_id).single()) as Client
    return { devis, client }
  }, [id])

  useEffect(() => { if (data) setLignes(data.devis.lignes ?? []) }, [data])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>
  const { devis, client } = data
  const verrouille = devis.statut === 'signe'
  const total = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0)

  const setLigne = (i: number, patch: Partial<LigneDevis>) => setLignes(lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const ajouter = (libelle = '') => setLignes([...lignes, { libelle, quantite: 1, prix_unitaire: 0 }])

  const enregistrer = async (statut?: StatutDevis) => {
    setBusy(true); setMsg('')
    const patch: Record<string, unknown> = { lignes, montant: total }
    if (statut) patch.statut = statut
    if (statut === 'envoye' && !devis.date_envoi) patch.date_envoi = new Date().toISOString()
    const { error } = await db.from('devis').update(patch).eq('id', devis.id)
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setMsg('Devis enregistré.'); reload()
  }

  const signer = async () => {
    if (!confirm(`Confirmer la signature du devis ${devis.numero} (${euro(total)}) ?\nLe client passe en « Client », le projet est créé et la date est confirmée.`)) return
    setBusy(true)
    try {
      await db.from('devis').update({ lignes, montant: total }).eq('id', devis.id)
      const projetId = await signerDevis({ ...devis, lignes, montant: total }, client)
      nav(`/projets/${projetId}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur'); setBusy(false)
    }
  }

  return (
    <>
      <div className="stack">
        <Link to={`/clients/${client.id}`} style={{ fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>← {client.nom}</Link>
        <div className="page-head">
          <div className="stack">
            <h1>Devis {devis.numero}</h1>
            <span className="muted" style={{ fontSize: 14 }}>{client.nom} · {nomType(client.type_prestation)} · {dateFr(client.date_evenement)}</span>
          </div>
          <span className="badge indigo" style={{ fontSize: 13, padding: '6px 12px' }}>{STATUTS_DEVIS.find((s) => s.id === devis.statut)?.nom}</span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Lignes du devis</h2>
          <span className="small muted">Ajoutées avec le client</span>
        </div>
        {!verrouille && (
          <div className="row">
            <span className="small muted">Suggestions :</span>
            {SUGGESTIONS[client.type_prestation].map((s) => (
              <button key={s} type="button" className="btn small dashed" onClick={() => ajouter(s)}>+ {s}</button>
            ))}
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Désignation</th><th style={{ width: 90 }}>Qté</th><th style={{ width: 140 }}>Prix unitaire (€)</th><th style={{ width: 120 }}>Total</th><th style={{ width: 50 }} /></tr></thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ width: '100%' }} aria-label="Désignation" disabled={verrouille} value={l.libelle} onChange={(e) => setLigne(i, { libelle: e.target.value })} /></td>
                  <td><input className="input" style={{ width: '100%' }} aria-label="Quantité" type="number" min="0" disabled={verrouille} value={l.quantite} onChange={(e) => setLigne(i, { quantite: Number(e.target.value) })} /></td>
                  <td><input className="input" style={{ width: '100%' }} aria-label="Prix unitaire" type="number" min="0" step="10" disabled={verrouille} value={l.prix_unitaire} onChange={(e) => setLigne(i, { prix_unitaire: Number(e.target.value) })} /></td>
                  <td style={{ fontWeight: 600 }}>{euro(l.quantite * l.prix_unitaire)}</td>
                  <td>{!verrouille && <button type="button" className="btn small" aria-label="Supprimer la ligne" onClick={() => setLignes(lignes.filter((_, k) => k !== i))}>×</button>}</td>
                </tr>
              ))}
              {lignes.length === 0 && <tr><td colSpan={5} className="muted">Aucune ligne. Ajoute une suggestion ou une ligne libre.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {!verrouille ? <button type="button" className="btn small" onClick={() => ajouter()}>+ Ligne libre</button> : <span />}
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 700 }}>Total : {euro(total)}</span>
        </div>
      </section>

      {msg && <span className="small muted" role="status">{msg}</span>}
      {!verrouille ? (
        <div className="row">
          <button className="btn" type="button" disabled={busy} onClick={() => enregistrer()}>Enregistrer</button>
          {devis.statut === 'brouillon' && <button className="btn" type="button" disabled={busy} onClick={() => enregistrer('envoye')}>Marquer comme envoyé</button>}
          {devis.statut === 'envoye' && <button className="btn" type="button" disabled={busy} onClick={() => enregistrer('negociation')}>Passer en négociation</button>}
          <button className="btn primary" type="button" disabled={busy || total <= 0} onClick={signer}>Devis signé</button>
          <button className="btn danger" type="button" disabled={busy} onClick={() => enregistrer('refuse')}>Refusé</button>
        </div>
      ) : (
        <div className="banner amber"><span>Devis signé le {dateFr(devis.date_signature)} — il n’est plus modifiable.</span></div>
      )}
      <p className="small muted" style={{ margin: 0 }}>L’envoi automatique du devis par e-mail sera ajouté avec la phase automatisations.</p>
    </>
  )
}
