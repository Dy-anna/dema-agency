// Règles métier partagées entre les écrans.
// Principe : une date au calendrier = un projet = une fiche client. Tout reste synchronisé.
import { db } from './db'
import { MODELES_TACHES, isoDate } from './format'
import type { Client, Devis, Evenement, Projet, StatutEvenement, TypePrestation } from './types'

/** "JP — Mairie" → "JP" */
export const nomDepuisTitre = (titre: string) => titre.split(/\s[—–-]\s/)[0].trim() || titre.trim()

/** Fiche « à compléter » : ni e-mail ni téléphone */
export const ficheIncomplete = (c?: Pick<Client, 'email' | 'telephone'> | null) => !c || (!c.email && !c.telephone)

export interface EvenementDraft {
  id?: string
  titre: string
  date: string
  type_prestation: TypePrestation
  statut: StatutEvenement
  client_id: string
}

/** Crée ou modifie une date du calendrier. Sans fiche liée, une fiche prospect est créée automatiquement. */
export async function enregistrerEvenement(d: EvenementDraft) {
  let clientId = d.client_id
  if (!clientId) {
    const nom = nomDepuisTitre(d.titre) || 'Nouveau prospect'
    const { data, error } = await db.from('clients').insert({
      nom, type_prestation: d.type_prestation, date_evenement: d.date, statut_commercial: 'prospect',
    }).select('id').single()
    if (error) throw new Error(error.message)
    clientId = data.id
  }
  const payload = { titre: d.titre.trim() || 'Événement', date: d.date, type_prestation: d.type_prestation, statut: d.statut, client_id: clientId }
  const res = d.id ? await db.from('evenements').update(payload).eq('id', d.id) : await db.from('evenements').insert(payload)
  if (res.error) throw new Error(res.error.message)
  await synchroniserClient(clientId)
  return clientId
}

/** Supprime une date puis resynchronise sa fiche */
export async function supprimerEvenement(e: Pick<Evenement, 'id' | 'client_id'>) {
  await db.from('evenements').delete().eq('id', e.id)
  if (e.client_id) await synchroniserClient(e.client_id)
}

/**
 * Aligne fiche client et projet sur les dates du calendrier :
 * - date de la fiche = prochaine date active
 * - au moins une date confirmée → client + projet créé
 * - toutes les dates annulées → prospect perdu
 */
export async function synchroniserClient(clientId: string) {
  const [{ data: client }, { data: evts }, { data: projets }] = await Promise.all([
    db.from('clients').select('*').eq('id', clientId).maybeSingle(),
    db.from('evenements').select('*').eq('client_id', clientId).order('date'),
    db.from('projets').select('*').eq('client_id', clientId).order('created_at'),
  ])
  if (!client) return
  const c = client as Client
  const liste = (evts ?? []) as Evenement[]
  const actifs = liste.filter((e) => e.statut !== 'annule')
  const today = isoDate(new Date())
  const prochaine = actifs.find((e) => e.date >= today) ?? actifs[actifs.length - 1]
  const confirme = actifs.some((e) => e.statut === 'confirme')

  const patch: Partial<Client> = {}
  if (prochaine && prochaine.date !== c.date_evenement) patch.date_evenement = prochaine.date
  if (liste.length > 0 && actifs.length === 0) patch.statut_commercial = 'perdu'
  else if (confirme && c.statut_commercial !== 'client') patch.statut_commercial = 'client'
  else if (actifs.length > 0 && c.statut_commercial === 'perdu') patch.statut_commercial = 'prospect'
  if (Object.keys(patch).length) await db.from('clients').update(patch).eq('id', clientId)

  let projet = ((projets ?? []) as Projet[])[0]
  const date = patch.date_evenement ?? c.date_evenement
  if (!projet && confirme) {
    const { data } = await db.from('projets').insert({
      client_id: clientId, titre: c.nom, type_prestation: c.type_prestation, date_evenement: date, statut: 'en_attente',
    }).select('*').single()
    projet = data as Projet
  } else if (projet && (projet.date_evenement !== date || projet.titre !== c.nom)) {
    await db.from('projets').update({ date_evenement: date, titre: c.nom }).eq('id', projet.id)
  }
  if (projet) {
    const sansProjet = liste.filter((e) => e.projet_id !== projet.id)
    for (const e of sansProjet) await db.from('evenements').update({ projet_id: projet.id }).eq('id', e.id)
  }
}

/** Modification de la fiche → répercutée sur le calendrier (si une seule date, ou aucune) */
export async function repercuterFiche(c: Pick<Client, 'id' | 'nom' | 'type_prestation' | 'date_evenement'>, ancienNom: string) {
  const { data } = await db.from('evenements').select('*').eq('client_id', c.id)
  const evts = (data ?? []) as Evenement[]
  if (evts.length === 0 && c.date_evenement) {
    await db.from('evenements').insert({ titre: c.nom, date: c.date_evenement, type_prestation: c.type_prestation, statut: 'previsionnel', client_id: c.id })
  } else if (evts.length === 1 && c.date_evenement) {
    const e = evts[0]
    const titre = e.titre === ancienNom ? c.nom : e.titre.replace(ancienNom, c.nom)
    await db.from('evenements').update({ date: c.date_evenement, titre, type_prestation: c.type_prestation }).eq('id', e.id)
  } else if (c.nom !== ancienNom) {
    for (const e of evts) await db.from('evenements').update({ titre: e.titre.replace(ancienNom, c.nom) }).eq('id', e.id)
  }
  await synchroniserClient(c.id)
}

/** Devis signé → client, projet (réutilisé s'il existe), dates confirmées, acompte prévu */
export async function signerDevis(devis: Devis, client: Pick<Client, 'id' | 'nom' | 'type_prestation' | 'date_evenement'>) {
  const now = new Date().toISOString()
  const { error: e1 } = await db.from('devis').update({ statut: 'signe', date_signature: now }).eq('id', devis.id)
  if (e1) throw e1
  await db.from('clients').update({ statut_commercial: 'client' }).eq('id', client.id)

  const { data: existants } = await db.from('projets').select('*').eq('client_id', client.id).order('created_at')
  let projet = ((existants ?? []) as Projet[])[0]
  if (projet) {
    await db.from('projets').update({ devis_id: devis.id }).eq('id', projet.id)
  } else {
    const { data, error } = await db.from('projets').insert({
      client_id: client.id, devis_id: devis.id, titre: client.nom, type_prestation: client.type_prestation,
      date_evenement: client.date_evenement, statut: 'en_attente',
    }).select('*').single()
    if (error) throw error
    projet = data as Projet
  }

  const { count } = await db.from('paiements').select('id', { count: 'exact', head: true }).eq('projet_id', projet.id)
  if (!count) {
    const acompte = Math.round(Number(devis.montant) * 0.3)
    await db.from('paiements').insert([
      { projet_id: projet.id, libelle: 'Acompte', type: 'acompte', montant: acompte, echeance: now.slice(0, 10) },
      { projet_id: projet.id, libelle: 'Solde', type: 'solde', montant: Number(devis.montant) - acompte, echeance: client.date_evenement },
    ])
  }

  const { data: evts } = await db.from('evenements').select('id, statut').eq('client_id', client.id)
  const liste = (evts ?? []) as Pick<Evenement, 'id' | 'statut'>[]
  if (liste.length) {
    for (const e of liste) if (e.statut !== 'annule') await db.from('evenements').update({ statut: 'confirme' }).eq('id', e.id)
  } else if (client.date_evenement) {
    await db.from('evenements').insert({ titre: client.nom, date: client.date_evenement, type_prestation: client.type_prestation, statut: 'confirme', client_id: client.id })
  }
  await synchroniserClient(client.id)
  return projet.id
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
