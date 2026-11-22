export type Role = 'gerant' | 'chef_projet' | 'assistant'
export type TypePrestation = 'mariage' | 'evenementiel' | 'corporate' | 'shooting' | 'autre'
export type StatutCommercial = 'prospect' | 'client' | 'perdu'
export type StatutDevis = 'brouillon' | 'envoye' | 'negociation' | 'signe' | 'refuse'
export type StatutProjet = 'en_attente' | 'production' | 'livre'
export type StatutEvenement = 'previsionnel' | 'confirme' | 'annule'

export interface Profile { id: string; nom: string; role: Role }

export interface Client {
  id: string
  type_prestation: TypePrestation
  nom: string
  contact: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  date_evenement: string | null
  statut_commercial: StatutCommercial
  rdv_effectue_le: string | null
  notes: string | null
  created_at: string
}

export interface LigneDevis { libelle: string; quantite: number; prix_unitaire: number }

export interface Devis {
  id: string
  client_id: string
  numero: string | null
  statut: StatutDevis
  lignes: LigneDevis[]
  montant: number
  date_envoi: string | null
  date_signature: string | null
  created_at: string
  clients?: Pick<Client, 'nom' | 'type_prestation' | 'date_evenement'> | null
}

export interface Projet {
  id: string
  client_id: string
  devis_id: string | null
  titre: string
  type_prestation: TypePrestation
  date_evenement: string | null
  statut: StatutProjet
  created_at: string
}

export interface Tache {
  id: string
  projet_id: string
  groupe: string
  titre: string
  fait: boolean
  assigne_a: string | null
  ordre: number
}

export interface Paiement {
  id: string
  projet_id: string
  libelle: string
  type: 'acompte' | 'versement' | 'solde'
  montant: number
  echeance: string | null
  recu: boolean
  recu_le: string | null
}

export interface Evenement {
  id: string
  titre: string
  date: string
  type_prestation: TypePrestation
  statut: StatutEvenement
  client_id: string | null
  projet_id: string | null
}

export type Indicateur = 'ca_signe' | 'ca_encaisse' | 'prospects' | 'rdv' | 'signes'

export interface Objectif {
  id: string
  annee: number
  periode: 'annee' | 'trimestre' | 'mois'
  numero: number
  indicateur: Indicateur
  cible: number
}
