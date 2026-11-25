// Chasseur de têtes : catégories, statuts, types d'action et séquence type
import type { StatutCible } from './types'

export const CATEGORIES = [
  { id: 'entreprise', nom: 'Entreprise / corporate' },
  { id: 'institution', nom: 'Institution / collectivité' },
  { id: 'politique', nom: 'Politique / ambassade' },
  { id: 'agence', nom: 'Agence événementielle' },
  { id: 'wedding_planner', nom: 'Wedding planner' },
  { id: 'lieu', nom: 'Salle / lieu de réception' },
  { id: 'eglise', nom: 'Église / association' },
  { id: 'media', nom: 'Média / artiste' },
  { id: 'particulier', nom: 'Particulier (mariage…)' },
  { id: 'autre', nom: 'Autre' },
]
export const nomCategorie = (id: string) => CATEGORIES.find((c) => c.id === id)?.nom ?? id

export const STATUTS_CIBLE: { id: StatutCible; nom: string; badge: string }[] = [
  { id: 'a_cibler', nom: 'À cibler', badge: 'grey' },
  { id: 'contacte', nom: 'Contacté', badge: 'indigo' },
  { id: 'discussion', nom: 'En discussion', badge: 'amber' },
  { id: 'rdv', nom: 'RDV obtenu', badge: 'orange' },
  { id: 'converti', nom: 'Devenu prospect', badge: 'green' },
  { id: 'pas_interesse', nom: 'Pas intéressé', badge: 'grey' },
]
export const statutCible = (s: StatutCible) => STATUTS_CIBLE.find((x) => x.id === s) ?? STATUTS_CIBLE[0]

export const TYPES_ACTION = [
  { id: 'recherche', nom: 'Rechercher le contact', icone: '🔎' },
  { id: 'message', nom: 'Message (LinkedIn, Insta, WhatsApp)', icone: '💬' },
  { id: 'email', nom: 'E-mail', icone: '✉️' },
  { id: 'appel', nom: 'Appel', icone: '📞' },
  { id: 'portfolio', nom: 'Envoyer le portfolio', icone: '🎬' },
  { id: 'rencontre', nom: 'Rencontre / événement', icone: '🤝' },
  { id: 'rdv', nom: 'Rendez-vous', icone: '📅' },
  { id: 'relance', nom: 'Relance', icone: '🔁' },
  { id: 'autre', nom: 'Autre', icone: '•' },
]
export const iconeAction = (t: string) => TYPES_ACTION.find((x) => x.id === t)?.icone ?? '•'

/** Séquence type de prospection (jours après aujourd'hui) */
export const SEQUENCE = [
  { j: 0, type: 'recherche', titre: 'Trouver le bon interlocuteur (com, événementiel, direction)' },
  { j: 1, type: 'message', titre: 'Premier message personnalisé' },
  { j: 4, type: 'portfolio', titre: 'Envoyer le portfolio + 2 vidéos adaptées à son secteur' },
  { j: 8, type: 'appel', titre: 'Appel pour proposer un rendez-vous' },
  { j: 15, type: 'relance', titre: 'Relance avec une idée concrète pour son prochain événement' },
]

export const plusJours = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
