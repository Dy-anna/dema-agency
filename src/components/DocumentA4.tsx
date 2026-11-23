// Devis ou facture au format A4, imprimable / enregistrable en PDF
import { useNavigate } from 'react-router-dom'
import { dateFr, euro } from '../lib/format'
import { totalLignes } from '../lib/facturation'
import type { Client, LigneDevis, ParametresAgence } from '../lib/types'

interface Props {
  titre: 'DEVIS' | 'FACTURE'
  sousTitre?: string
  numero: string
  date: string
  echeance?: string | null
  echeanceLabel?: string
  agence: ParametresAgence
  client: Client
  objet?: string
  lignes: LigneDevis[]
  tvaTaux: number
  piedSupp?: string
  signature?: boolean
  paye?: boolean
}

export default function DocumentA4(p: Props) {
  const nav = useNavigate()
  const ht = totalLignes(p.lignes)
  const tva = Math.round(ht * (p.tvaTaux / 100) * 100) / 100
  const ttc = ht + tva
  const a = p.agence

  return (
    <div className="doc-wrap">
      <div className="doc-toolbar no-print">
        <button className="btn" type="button" onClick={() => nav(-1)}>← Retour</button>
        <button className="btn primary" type="button" onClick={() => window.print()}>Télécharger en PDF / Imprimer</button>
        <span className="small muted">Dans la fenêtre d’impression, choisis « Enregistrer au format PDF ».</span>
      </div>

      <article className="doc">
        <header className="doc-head">
          <div>
            <div className="doc-logo">D</div>
            <strong style={{ fontSize: 16 }}>{a.raison_sociale || 'DEMA Agency'}</strong>
            {a.forme && <div>{a.forme}</div>}
            {a.adresse && <div>{a.adresse}</div>}
            {a.telephone && <div>{a.telephone}</div>}
            {a.email && <div>{a.email}</div>}
            {a.siret && <div>SIRET : {a.siret}</div>}
            {a.tva_intra && <div>TVA : {a.tva_intra}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="doc-title">{p.titre}</div>
            {p.sousTitre && <div style={{ fontWeight: 600 }}>{p.sousTitre}</div>}
            <div>N° <strong>{p.numero}</strong></div>
            <div>Date : {dateFr(p.date)}</div>
            {p.echeance && <div>{p.echeanceLabel ?? 'Échéance'} : {dateFr(p.echeance)}</div>}
            {p.paye && <div className="doc-paye">PAYÉE</div>}
          </div>
        </header>

        <section className="doc-client">
          <div className="small muted">{p.titre === 'DEVIS' ? 'Destinataire' : 'Facturé à'}</div>
          <strong>{p.client.nom}</strong>
          {p.client.contact && <div>{p.client.contact}</div>}
          {p.client.adresse && <div>{p.client.adresse}</div>}
          {p.client.email && <div>{p.client.email}</div>}
          {p.client.telephone && <div>{p.client.telephone}</div>}
        </section>

        {p.objet && <p style={{ margin: '0 0 12px' }}><strong>Objet :</strong> {p.objet}</p>}

        <table className="doc-table">
          <thead><tr><th>Désignation</th><th style={{ width: 60, textAlign: 'right' }}>Qté</th><th style={{ width: 110, textAlign: 'right' }}>Prix unitaire</th><th style={{ width: 110, textAlign: 'right' }}>Total{p.tvaTaux ? ' HT' : ''}</th></tr></thead>
          <tbody>
            {p.lignes.map((l, i) => (
              <tr key={i}>
                <td>{l.libelle}</td>
                <td style={{ textAlign: 'right' }}>{l.quantite}</td>
                <td style={{ textAlign: 'right' }}>{euro(l.prix_unitaire)}</td>
                <td style={{ textAlign: 'right' }}>{euro(l.quantite * l.prix_unitaire)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-totaux">
          {p.tvaTaux > 0 ? (
            <>
              <div><span>Total HT</span><span>{euro(ht)}</span></div>
              <div><span>TVA {p.tvaTaux} %</span><span>{euro(tva)}</span></div>
              <div className="doc-total"><span>Total TTC</span><span>{euro(ttc)}</span></div>
            </>
          ) : (
            <>
              <div className="doc-total"><span>Total</span><span>{euro(ht)}</span></div>
              {a.mention_tva && <div className="small">{a.mention_tva}</div>}
            </>
          )}
        </div>

        {p.piedSupp && <p style={{ whiteSpace: 'pre-line' }}>{p.piedSupp}</p>}
        {a.conditions && <p className="small" style={{ whiteSpace: 'pre-line' }}>{a.conditions}</p>}
        {p.titre === 'FACTURE' && a.iban && <p className="small">Règlement par virement : IBAN {a.iban}{a.bic ? ` · BIC ${a.bic}` : ''}</p>}
        {p.titre === 'FACTURE' && <p className="small">En cas de retard de paiement : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement (professionnels uniquement).</p>}

        {p.signature && (
          <div className="doc-signature">
            <div>Bon pour accord — date et signature du client :</div>
            <div className="doc-sign-box" />
          </div>
        )}
      </article>
    </div>
  )
}
