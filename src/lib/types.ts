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
  details?: DetailsEvenement
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

// ───── Fiche événement détaillée (stockée dans clients.details) ─────
export interface Lieu { nom: string; type: string; adresse: string; heure: string }
export interface EtapeDeroule { heure: string; moment: string; notes: string }
export interface ContactUtile { role: string; nom: string; telephone: string; email: string }
export interface DetailsEvenement {
  lieux?: Lieu[]
  deroule?: EtapeDeroule[]
  contacts?: ContactUtile[]
  questionnaire?: Record<string, string>
}

// ───── Paramètres de l'agence ─────
export interface ParametresAgence {
  raison_sociale?: string
  forme?: string
  adresse?: string
  siret?: string
  tva_intra?: string
  email?: string
  telephone?: string
  iban?: string
  bic?: string
  tva_taux?: number          // 0 = TVA non applicable
  mention_tva?: string       // ex. « TVA non applicable, art. 293 B du CGI »
  validite_devis_jours?: number
  conditions?: string        // conditions de paiement / annulation
  acompte_pct?: number
  // Fiscalité (URSSAF)
  regime_social?: string     // clé de REGIMES
  taux_urssaf?: number       // % du CA encaissé
  acre?: boolean             // taux réduit de moitié
  cfp_taux?: number          // contribution formation professionnelle
  versement_liberatoire?: boolean
  taux_vl?: number
  declaration?: 'mensuelle' | 'trimestrielle'
}

export interface Facture {
  id: string
  numero: string
  client_id: string
  projet_id: string | null
  devis_id: string | null
  paiement_id: string | null
  type: 'acompte' | 'solde' | 'totale'
  lignes: LigneDevis[]
  montant_ht: number
  tva_taux: number
  montant_ttc: number
  date_emission: string
  echeance: string | null
  statut: 'emise' | 'payee' | 'annulee'
  created_at: string
  clients?: Pick<Client, 'nom'> | null
}

export interface Affectation {
  id: string
  evenement_id: string
  profile_id: string | null
  nom_libre: string | null
  poste: string
  horaires: string | null
}

export type TypeContrat = 'formation' | 'freelance' | 'stage' | 'benevole'
export type StatutContrat = 'brouillon' | 'a_signer' | 'signe' | 'termine' | 'annule'
export interface AccordsContrat {
  droit_image?: boolean
  confidentialite?: boolean
  materiel?: boolean
  securite?: boolean
  rushes?: boolean
  autres?: string
}
export interface Contrat {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  adresse: string | null
  profile_id: string | null
  type: TypeContrat
  poste: string
  date_debut: string | null
  date_fin: string | null
  rythme: string | null
  missions: string | null
  remuneration: 'aucune' | 'defraiement' | 'forfait' | 'jour'
  montant: number
  accords: AccordsContrat
  statut: StatutContrat
  date_signature: string | null
  notes: string | null
  created_at?: string
}
