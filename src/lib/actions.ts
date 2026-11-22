// Règles métier partagées entre les écrans
import { db } from './db'
import { MODELES_TACHES } from './format'
import type { Client, Devis, Projet } from './types'

/** Devis signé → client, projet créé (en attente d'acompte), date confirmée, acompte prévu */
export async function signerDevis(devis: Devis, client: Pick<Client, 'id' | 'nom' | 'type_prestation' | 'date_evenement'>) {
  const now = new Date().toISOString()
  const { error: e1 } = await db.from('devis').update({ statut: 'signe', date_signature: now }).eq('id', devis.id)
  if (e1) throw e1
  await db.from('clients').update({ statut_commercial: 'client' }).eq('id', client.id)

  const { data: existant } = await db.from('projets').select('id').eq('devis_id', devis.id).maybeSingle()
  let projetId = existant?.id as string | undefined
  if (!projetId) {
    const { data: projet, error } = await db.from('projets').insert({
      client_id: client.id,
      devis_id: devis.id,
      titre: client.nom,
      type_prestation: client.type_prestation,
      date_evenement: client.date_evenement,
      statut: 'en_attente',
    }).select('id').single()
    if (error) throw error
    projetId = projet.id
    const acompte = Math.round(Number(devis.montant) * 0.3)
    await db.from('paiements').insert([
      { projet_id: projetId, libelle: 'Acompte', type: 'acompte', montant: acompte, echeance: now.slice(0, 10) },
      { projet_id: projetId, libelle: 'Solde', type: 'solde', montant: Number(devis.montant) - acompte, echeance: client.date_evenement },
    ])
  }

  if (client.date_evenement) {
    const { data: evts } = await db.from('evenements').select('id').eq('client_id', client.id)
    if (evts && evts.length) {
      await db.from('evenements').update({ statut: 'confirme', projet_id: projetId }).eq('client_id', client.id)
    } else {
      await db.from('evenements').insert({
        titre: client.nom, date: client.date_evenement, type_prestation: client.type_prestation,
        statut: 'confirme', client_id: client.id, projet_id: projetId,
      })
    }
  }
  return projetId
}

/** Acompte reçu → projet en production + génération des tâches (une seule fois) */
export async function lancerProduction(projet: Projet) {
  await db.from('projets').update({ statut: 'production' }).eq('id', projet.id)
  const { count } = await db.from('taches').select('id', { count: 'exact', head: true }).eq('projet_id', projet.id)
  if (count && count > 0) return
  const modele = MODELES_TACHES[projet.type_prestation] ?? MODELES_TACHES.autre
  let ordre = 0
  const lignes = modele.flatMap((g) => g.titres.map((titre) => ({ projet_id: projet.id, groupe: g.groupe, titre, ordre: ordre++ })))
  await db.from('taches').insert(lignes)
}
