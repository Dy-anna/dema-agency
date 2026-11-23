import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro } from '../lib/format'
import { marquerFacturePayee } from '../lib/facturation'
import type { Facture } from '../lib/types'

const FILTRES = [
  { id: 'toutes', nom: 'Toutes' },
  { id: 'emise', nom: 'À encaisser' },
  { id: 'payee', nom: 'Payées' },
  { id: 'annulee', nom: 'Annulées' },
] as const

export default function Factures() {
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]['id']>('toutes')
  const { data, error, reload } = useLoad(async () =>
    must(await db.from('factures').select('*, clients(nom)').order('numero', { ascending: false })) as Facture[])

  if (error) return <p className="error">{error}</p>
  const liste = (data ?? []).filter((f) => filtre === 'toutes' || f.statut === filtre)
  const aEncaisser = (data ?? []).filter((f) => f.statut === 'emise').reduce((s, f) => s + Number(f.montant_ttc), 0)
  const encaisse = (data ?? []).filter((f) => f.statut === 'payee').reduce((s, f) => s + Number(f.montant_ttc), 0)

  const payer = async (f: Facture, v: boolean) => { await marquerFacturePayee(f, v); reload() }
  const annuler = async (f: Facture) => {
    if (!confirm(`Annuler la facture ${f.numero} ? Elle reste numérotée (obligation légale) mais n’est plus due.`)) return
    await db.from('factures').update({ statut: 'annulee' }).eq('id', f.id); reload()
  }

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Finance · gérants uniquement</span>
          <h1>Factures</h1>
        </div>
      </div>
      <div className="grid-kpi">
        <div className="kpi"><span className="kpi-label">À encaisser</span><span className="kpi-value" style={{ color: 'var(--orange)' }}>{euro(aEncaisser)}</span></div>
        <div className="kpi"><span className="kpi-label">Encaissé</span><span className="kpi-value" style={{ color: 'var(--green-ink)' }}>{euro(encaisse)}</span></div>
        <div className="kpi"><span className="kpi-label">Factures émises</span><span className="kpi-value">{data?.length ?? 0}</span></div>
      </div>
      <div className="seg" role="tablist" aria-label="Filtrer" style={{ alignSelf: 'flex-start' }}>
        {FILTRES.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtre === f.id} onClick={() => setFiltre(f.id)}>{f.nom}</button>)}
      </div>
      <section className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Client</th><th>Type</th><th>Émise le</th><th>Échéance</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {liste.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}><Link to={`/factures/${f.id}/pdf`} style={{ color: 'inherit' }}>{f.numero}</Link></td>
                  <td><Link to={`/clients/${f.client_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{f.clients?.nom}</Link></td>
                  <td>{f.type === 'acompte' ? 'Acompte' : f.type === 'solde' ? 'Solde' : 'Totale'}</td>
                  <td>{dateFr(f.date_emission, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{dateFr(f.echeance, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{euro(f.montant_ttc)}</td>
                  <td><span className={'badge ' + (f.statut === 'payee' ? 'green' : f.statut === 'annulee' ? 'grey' : 'orange')}>{f.statut === 'payee' ? 'Payée' : f.statut === 'annulee' ? 'Annulée' : 'À encaisser'}</span></td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Link className="btn small" to={`/factures/${f.id}/pdf`}>PDF</Link>
                      {f.statut === 'emise' && <button className="btn small" type="button" onClick={() => payer(f, true)}>Marquer payée</button>}
                      {f.statut === 'payee' && <button className="btn small" type="button" onClick={() => payer(f, false)}>Annuler le paiement</button>}
                      {f.statut !== 'annulee' && <button className="btn small danger" type="button" onClick={() => annuler(f)}>Annuler</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {data && liste.length === 0 && <tr><td colSpan={8} className="muted">Les factures se créent depuis l’échéancier d’un projet (bouton « Facturer »).</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
