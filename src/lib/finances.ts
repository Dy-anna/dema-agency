// Calcul unique des indicateurs financiers (tableau de bord, fiscalité…)
import { repartition } from './fiscalite'
import type { Client, Devis, Paiement, ParametresAgence, Projet } from './types'

export interface LigneProjet {
  projet: Projet
  montant: number        // montant signé (devis) ou total de l'échéancier
  encaisse: number
  reste: number
  passe: boolean         // prestation déjà réalisée
}

export interface Finances {
  signe: number
  signeNet: number
  encaisse: number
  acomptesRecus: number
  resteAEncaisser: number
  impayes: number            // reste dû sur des prestations déjà réalisées
  realise: number            // CA des prestations déjà réalisées
  aVenir: number             // CA signé des prestations à venir
  pipeline: number           // devis en cours (non signés)
  previsionnelBrut: number
  previsionnelNet: number
  urssafPrevisionnelle: number
  tauxUrssaf: number
  lignes: LigneProjet[]
  devisEnCours: (Devis & { client?: Client })[]
}

export function calculerFinances(
  { projets, devis, paiements, clients, params, today, annee }:
  { projets: Projet[]; devis: Devis[]; paiements: Paiement[]; clients: Client[]; params: ParametresAgence; today: string; annee?: number },
): Finances {
  const dansAnnee = (d: string | null) => !annee || (d ?? '').startsWith(String(annee))

  const lignes: LigneProjet[] = projets
    .filter((p) => dansAnnee(p.date_evenement))
    .map((p) => {
      const pa = paiements.filter((x) => x.projet_id === p.id)
      const dv = devis.find((d) => d.id === p.devis_id)
      const montant = dv ? Number(dv.montant) : pa.reduce((s, x) => s + Number(x.montant), 0)
      const encaisse = pa.filter((x) => x.recu).reduce((s, x) => s + Number(x.montant), 0)
      return { projet: p, montant, encaisse, reste: Math.max(0, montant - encaisse), passe: !!p.date_evenement && p.date_evenement < today }
    })

  // Devis en cours : dernier devis non signé / non refusé des fiches sans contrat signé
  const clientsSignes = new Set(projets.map((p) => p.client_id))
  const parClient = new Map<string, Devis>()
  for (const d of [...devis].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (d.statut === 'signe' || d.statut === 'refuse' || clientsSignes.has(d.client_id) || parClient.has(d.client_id)) continue
    const c = clients.find((x) => x.id === d.client_id)
    if (!c || c.statut_commercial === 'perdu' || !dansAnnee(c.date_evenement)) continue
    parClient.set(d.client_id, d)
  }
  const devisEnCours = [...parClient.values()].map((d) => ({ ...d, client: clients.find((c) => c.id === d.client_id) }))

  const somme = (l: number[]) => l.reduce((s, x) => s + x, 0)
  const signe = somme(lignes.map((l) => l.montant))
  const encaisse = somme(lignes.map((l) => l.encaisse))
  const pipeline = somme(devisEnCours.map((d) => Number(d.montant)))
  const brut = signe + pipeline
  const r = repartition(brut, params)
  const idsProjets = new Set(lignes.map((l) => l.projet.id))

  return {
    signe,
    signeNet: repartition(signe, params).net,
    encaisse,
    acomptesRecus: somme(paiements.filter((x) => x.recu && x.type === 'acompte' && idsProjets.has(x.projet_id)).map((x) => Number(x.montant))),
    resteAEncaisser: somme(lignes.map((l) => l.reste)),
    impayes: somme(lignes.filter((l) => l.passe).map((l) => l.reste)),
    realise: somme(lignes.filter((l) => l.passe).map((l) => l.montant)),
    aVenir: somme(lignes.filter((l) => !l.passe).map((l) => l.montant)),
    pipeline,
    previsionnelBrut: brut,
    previsionnelNet: r.net,
    urssafPrevisionnelle: r.urssaf,
    tauxUrssaf: r.taux,
    lignes,
    devisEnCours,
  }
}
