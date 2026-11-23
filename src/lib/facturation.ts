// Devis, factures et paramètres de l'agence
import { db } from './db'
import type { Devis, Facture, LigneDevis, Paiement, ParametresAgence, Projet } from './types'

export const PARAMETRES_DEFAUT: ParametresAgence = {
  raison_sociale: 'DEMA Agency',
  tva_taux: 0,
  mention_tva: 'TVA non applicable, art. 293 B du CGI',
  validite_devis_jours: 30,
  acompte_pct: 30,
  conditions: 'Un acompte de 30 % est demandé à la signature pour réserver la date. Le solde est à régler au plus tard le jour de l’événement.',
}

export async function chargerParametres(): Promise<ParametresAgence> {
  const { data } = await db.from('parametres').select('*').eq('id', 'agence').maybeSingle()
  return { ...PARAMETRES_DEFAUT, ...((data?.valeur as ParametresAgence) ?? {}) }
}

export async function enregistrerParametres(p: ParametresAgence) {
  const { error } = await db.from('parametres').upsert({ id: 'agence', valeur: p }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export const totalLignes = (lignes: LigneDevis[]) =>
  lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0)

/** Prochain numéro de facture F-AAAA-NNN (continu, sans trou) */
async function prochainNumero(annee: number) {
  const prefixe = `F-${annee}-`
  const { data } = await db.from('factures').select('numero').gte('numero', prefixe).lt('numero', `F-${annee}-~`).order('numero', { ascending: false }).limit(1)
  const dernier = (data as { numero: string }[] | null)?.[0]?.numero
  const n = dernier ? Number(dernier.slice(prefixe.length)) + 1 : 1
  return prefixe + String(n).padStart(3, '0')
}

/** Crée la facture correspondant à une ligne de l'échéancier (une seule fois) */
export async function facturerPaiement(p: Paiement, projet: Projet, params: ParametresAgence): Promise<string> {
  const { data: existante } = await db.from('factures').select('id').eq('paiement_id', p.id).neq('statut', 'annulee').maybeSingle()
  if (existante) return existante.id as string

  let devis: Devis | null = null
  if (projet.devis_id) {
    const { data } = await db.from('devis').select('*').eq('id', projet.devis_id).maybeSingle()
    devis = (data as Devis) ?? null
  }
  const ref = devis?.numero ? ` — devis ${devis.numero}` : ''
  const type: Facture['type'] = p.type === 'solde' ? 'solde' : 'acompte'
  let lignes: LigneDevis[]

  if (type === 'solde' && devis && devis.lignes.length) {
    // Facture de solde : prestations du devis moins les acomptes déjà facturés
    const { data } = await db.from('factures').select('numero, montant_ht').eq('projet_id', projet.id).eq('type', 'acompte').neq('statut', 'annulee')
    const acomptes = (data ?? []) as { numero: string; montant_ht: number }[]
    lignes = [...devis.lignes]
    if (acomptes.length) {
      lignes.push({ libelle: `Acomptes déjà facturés (${acomptes.map((a) => a.numero).join(', ')})`, quantite: 1, prix_unitaire: -acomptes.reduce((s, a) => s + Number(a.montant_ht), 0) })
    }
  } else {
    lignes = [{ libelle: `${p.libelle}${ref} · ${projet.titre}`, quantite: 1, prix_unitaire: Number(p.montant) }]
  }

  const ht = totalLignes(lignes)
  const tva = Number(params.tva_taux) || 0
  const now = new Date()
  const numero = await prochainNumero(now.getFullYear())
  const { data, error } = await db.from('factures').insert({
    numero, client_id: projet.client_id, projet_id: projet.id, devis_id: devis?.id ?? null, paiement_id: p.id, type, lignes,
    montant_ht: ht, tva_taux: tva, montant_ttc: Math.round(ht * (1 + tva / 100) * 100) / 100,
    date_emission: now.toISOString().slice(0, 10), echeance: p.echeance, statut: p.recu ? 'payee' : 'emise',
  }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

/** Garde facture et échéancier alignés */
export async function marquerFacturePayee(f: Pick<Facture, 'id' | 'paiement_id'>, payee: boolean) {
  await db.from('factures').update({ statut: payee ? 'payee' : 'emise' }).eq('id', f.id)
  if (f.paiement_id) {
    await db.from('paiements').update({ recu: payee, recu_le: payee ? new Date().toISOString().slice(0, 10) : null }).eq('id', f.paiement_id)
  }
}

export async function synchroniserFactureDuPaiement(paiementId: string, recu: boolean) {
  await db.from('factures').update({ statut: recu ? 'payee' : 'emise' }).eq('paiement_id', paiementId).neq('statut', 'annulee')
}
