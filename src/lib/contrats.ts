// Contrats des personnes qui accompagnent l'agence : formation, freelance, stage, bénévolat
import type { Affectation, Contrat, Evenement, Profile, StatutContrat, TypeContrat } from './types'

export const TYPES_CONTRAT: { id: TypeContrat; nom: string; desc: string; titreDoc: string }[] = [
  { id: 'formation', nom: 'Formation', desc: 'Vient apprendre sur nos tournages', titreDoc: 'ACCORD DE FORMATION PRATIQUE' },
  { id: 'freelance', nom: 'Freelance', desc: 'Prestataire payé à la mission', titreDoc: 'CONTRAT DE PRESTATION' },
  { id: 'stage', nom: 'Stage', desc: 'Étudiant avec convention de son école', titreDoc: 'ACCORD DE STAGE' },
  { id: 'benevole', nom: 'Bénévole', desc: 'Aide ponctuelle sans rémunération', titreDoc: 'ACCORD DE PARTICIPATION BÉNÉVOLE' },
]
export const nomTypeContrat = (t: TypeContrat) => TYPES_CONTRAT.find((x) => x.id === t)?.nom ?? t

export const STATUTS_CONTRAT: { id: StatutContrat; nom: string; badge: string }[] = [
  { id: 'brouillon', nom: 'Brouillon', badge: 'grey' },
  { id: 'a_signer', nom: 'À signer', badge: 'orange' },
  { id: 'signe', nom: 'Signé', badge: 'green' },
  { id: 'termine', nom: 'Terminé', badge: 'indigo' },
  { id: 'annule', nom: 'Annulé', badge: 'grey' },
]
export const statutContrat = (s: StatutContrat) => STATUTS_CONTRAT.find((x) => x.id === s) ?? STATUTS_CONTRAT[0]

export const REMUNERATIONS = [
  { id: 'aucune', nom: 'Aucune' },
  { id: 'defraiement', nom: 'Défraiement (transport, repas)' },
  { id: 'forfait', nom: 'Forfait pour la période' },
  { id: 'jour', nom: 'Par jour de tournage' },
] as const

export const ACCORDS: { id: 'droit_image' | 'confidentialite' | 'materiel' | 'securite' | 'rushes'; nom: string; texte: string }[] = [
  { id: 'droit_image', nom: 'Droit à l’image', texte: 'accepte que son image (photos, vidéos des coulisses) soit utilisée par l’agence pour sa communication, sans contrepartie financière.' },
  { id: 'confidentialite', nom: 'Confidentialité', texte: 's’engage à ne pas divulguer les informations sur les clients, lieux et événements, et à ne publier aucune image sans l’accord écrit de l’agence.' },
  { id: 'rushes', nom: 'Propriété des images', texte: 'reconnaît que les images tournées pour l’agence appartiennent à l’agence et à ses clients ; toute utilisation personnelle (portfolio inclus) demande un accord écrit.' },
  { id: 'materiel', nom: 'Matériel', texte: 's’engage à prendre soin du matériel confié et à signaler immédiatement toute casse ou perte.' },
  { id: 'securite', nom: 'Consignes & ponctualité', texte: 's’engage à respecter les horaires, la tenue demandée et les consignes de sécurité du lieu et du chef de projet.' },
]

const jour = 86400000
const d = (s: string) => new Date(s + 'T12:00:00').getTime()

/** Durée lisible entre deux dates (incluses) */
export function duree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return ''
  const n = Math.round((d(fin) - d(debut)) / jour) + 1
  if (n <= 0) return ''
  if (n < 14) return `${n} jour${n > 1 ? 's' : ''}`
  if (n < 61) return `${Math.round(n / 7)} semaines`
  const mois = Math.round(n / 30.4)
  return `${mois} mois`
}

/** Le contrat couvre-t-il cette date ? (sans date de fin = ouvert) */
export const couvre = (c: Contrat, date: string) =>
  (!c.date_debut || c.date_debut <= date) && (!c.date_fin || c.date_fin >= date)

/** État affiché : en cours, à venir, terminé (selon dates + statut) */
export function etatContrat(c: Contrat, today: string): 'en_cours' | 'a_venir' | 'termine' | 'a_signer' | 'annule' {
  if (c.statut === 'annule') return 'annule'
  if (c.statut === 'termine' || (c.date_fin && c.date_fin < today)) return 'termine'
  if (c.statut !== 'signe') return 'a_signer'
  if (c.date_debut && c.date_debut > today) return 'a_venir'
  return 'en_cours'
}

export const joursRestants = (c: Contrat, today: string) => (c.date_fin ? Math.round((d(c.date_fin) - d(today)) / jour) : null)

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** Contrat qui correspond à une personne du planning (compte lié ou même nom) */
export function contratDe(contrats: Contrat[], a: Pick<Affectation, 'profile_id' | 'nom_libre'>, nomPersonne: string, date: string) {
  const siens = contrats.filter((c) => c.statut !== 'annule' &&
    ((a.profile_id && c.profile_id === a.profile_id) || norm(c.nom) === norm(nomPersonne)))
  return siens.find((c) => c.statut === 'signe' && couvre(c, date)) ?? siens.find((c) => couvre(c, date)) ?? siens[0] ?? null
}

/** Personnes au planning (dates à venir) sans contrat signé couvrant la date */
export function sansContrat(contrats: Contrat[], affectations: Affectation[], evenements: Evenement[], equipe: Profile[], ignorerGerants = true) {
  const out = new Map<string, { nom: string; dates: string[] }>()
  for (const a of affectations) {
    const e = evenements.find((x) => x.id === a.evenement_id)
    if (!e) continue
    const membre = a.profile_id ? equipe.find((m) => m.id === a.profile_id) : null
    if (ignorerGerants && membre?.role === 'gerant') continue
    const nom = membre?.nom ?? a.nom_libre ?? ''
    if (!nom) continue
    const c = contratDe(contrats, a, nom, e.date)
    if (c && c.statut === 'signe' && couvre(c, e.date)) continue
    const k = a.profile_id ?? norm(nom)
    const cur = out.get(k) ?? { nom, dates: [] }
    if (!cur.dates.includes(e.date)) cur.dates.push(e.date)
    out.set(k, cur)
  }
  return [...out.values()]
}
