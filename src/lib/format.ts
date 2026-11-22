import type { StatutDevis, StatutEvenement, StatutProjet, TypePrestation, Role } from './types'

export const TYPES_PRESTATION: { id: TypePrestation; nom: string; desc: string }[] = [
  { id: 'mariage', nom: 'Mariage', desc: 'Couple · jour J' },
  { id: 'evenementiel', nom: 'Événementiel', desc: 'Anniversaire, gala, concert…' },
  { id: 'corporate', nom: 'Événement corporate', desc: 'Entreprise · séminaire, lancement' },
  { id: 'shooting', nom: 'Shooting', desc: 'Photo / vidéo studio ou extérieur' },
  { id: 'autre', nom: 'Autre', desc: 'À préciser' },
]

export const nomType = (t: TypePrestation) => TYPES_PRESTATION.find((x) => x.id === t)?.nom ?? t

export const STATUTS_DEVIS: { id: StatutDevis; nom: string }[] = [
  { id: 'brouillon', nom: 'Brouillon' },
  { id: 'envoye', nom: 'Devis envoyé' },
  { id: 'negociation', nom: 'Négociation' },
  { id: 'signe', nom: 'Signé' },
  { id: 'refuse', nom: 'Refusé' },
]

export const nomStatutProjet: Record<StatutProjet, string> = {
  en_attente: 'En attente d’acompte',
  production: 'En production',
  livre: 'Livré',
}

export const nomStatutEvenement: Record<StatutEvenement, string> = {
  previsionnel: 'Prévisionnel',
  confirme: 'Confirmé',
  annule: 'Annulé',
}

export const nomRole: Record<Role, string> = {
  gerant: 'Gérant',
  chef_projet: 'Chef de projet',
  assistant: 'Assistant',
}

export const euro = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const dateFr = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('fr-FR', opts) : '—'

export const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}

export const joursDepuis = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0

export const DELAI_RELANCE_JOURS = 5

// Checklists générées à la signature + acompte, selon le type de prestation
export const MODELES_TACHES: Record<TypePrestation, { groupe: string; titres: string[] }[]> = {
  mariage: [
    { groupe: 'Préparation', titres: ['Rendez-vous de cadrage avec le couple', 'Questionnaire déroulé de journée', 'Repérage du lieu', 'Brief équipe'] },
    { groupe: 'Jour J', titres: ['Préparation et check matériel', 'Tournage / shooting jour J', 'Sauvegarde des rushes'] },
    { groupe: 'Post-production', titres: ['Tri et dérushage', 'Montage teaser', 'Montage film / retouches photos', 'Livraison au couple'] },
  ],
  evenementiel: [
    { groupe: 'Préparation', titres: ['Brief client', 'Repérage du lieu', 'Brief équipe'] },
    { groupe: 'Jour J', titres: ['Check matériel', 'Captation de l’événement', 'Sauvegarde des rushes'] },
    { groupe: 'Post-production', titres: ['Montage', 'Validation client', 'Livraison'] },
  ],
  corporate: [
    { groupe: 'Préparation', titres: ['Brief et objectifs de communication', 'Validation du script / déroulé', 'Repérage'] },
    { groupe: 'Tournage', titres: ['Check matériel', 'Tournage', 'Sauvegarde des rushes'] },
    { groupe: 'Post-production', titres: ['Montage V1', 'Retours client', 'Version finale + déclinaisons', 'Livraison'] },
  ],
  shooting: [
    { groupe: 'Préparation', titres: ['Moodboard et brief', 'Réservation lieu / studio'] },
    { groupe: 'Shooting', titres: ['Check matériel', 'Shooting', 'Sauvegarde'] },
    { groupe: 'Post-production', titres: ['Sélection', 'Retouches', 'Livraison galerie'] },
  ],
  autre: [
    { groupe: 'Préparation', titres: ['Brief client'] },
    { groupe: 'Réalisation', titres: ['Production'] },
    { groupe: 'Livraison', titres: ['Livraison'] },
  ],
}
