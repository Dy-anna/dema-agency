// Pages imprimables : devis et factures
import { useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { chargerParametres } from '../lib/facturation'
import { isoDate, nomType, dateFr } from '../lib/format'
import DocumentA4 from '../components/DocumentA4'
import type { Client, Devis, Facture } from '../lib/types'

export function DevisPDF() {
  const { id } = useParams()
  const { data, error } = useLoad(async () => {
    const devis = must(await db.from('devis').select('*').eq('id', id!).single()) as Devis
    const client = must(await db.from('clients').select('*').eq('id', devis.client_id).single()) as Client
    return { devis, client, agence: await chargerParametres() }
  }, [id])
  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>
  if (!data) return <p className="muted" style={{ padding: 24 }}>Chargement…</p>
  const { devis, client, agence } = data
  const date = (devis.date_envoi ?? devis.created_at).slice(0, 10)
  const validite = isoDate(new Date(new Date(date + 'T12:00:00').getTime() + (agence.validite_devis_jours ?? 30) * 86400000))
  return (
    <DocumentA4 titre="DEVIS" numero={devis.numero ?? '—'} date={date} echeance={validite} echeanceLabel="Valable jusqu’au"
      agence={agence} client={client} lignes={devis.lignes} tvaTaux={agence.tva_taux ?? 0} signature
      objet={`${nomType(client.type_prestation)}${client.date_evenement ? ' du ' + dateFr(client.date_evenement) : ''}`}
      piedSupp={agence.acompte_pct ? `Acompte à la signature : ${agence.acompte_pct} %.` : undefined} />
  )
}

export function FacturePDF() {
  const { id } = useParams()
  const { data, error } = useLoad(async () => {
    const facture = must(await db.from('factures').select('*').eq('id', id!).single()) as Facture
    const client = must(await db.from('clients').select('*').eq('id', facture.client_id).single()) as Client
    return { facture, client, agence: await chargerParametres() }
  }, [id])
  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>
  if (!data) return <p className="muted" style={{ padding: 24 }}>Chargement…</p>
  const { facture: f, client, agence } = data
  const sous = f.type === 'acompte' ? 'Facture d’acompte' : f.type === 'solde' ? 'Facture de solde' : undefined
  return (
    <DocumentA4 titre="FACTURE" sousTitre={f.statut === 'annulee' ? 'ANNULÉE' : sous} numero={f.numero} date={f.date_emission}
      echeance={f.echeance} echeanceLabel="À régler avant le" agence={{ ...agence, conditions: f.type === 'solde' ? agence.conditions : undefined }}
      client={client} lignes={f.lignes} tvaTaux={f.tva_taux} paye={f.statut === 'payee'}
      objet={`${nomType(client.type_prestation)}${client.date_evenement ? ' du ' + dateFr(client.date_evenement) : ''}`} />
  )
}
