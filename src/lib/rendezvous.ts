// Rendez-vous : types, rappels, export vers l'agenda du téléphone
import type { RendezVous } from './types'

export const TYPES_RDV = [
  { id: 'client', nom: 'Client', icone: '🤝' },
  { id: 'prospect', nom: 'Prospect / découverte', icone: '🎯' },
  { id: 'reperage', nom: 'Repérage du lieu', icone: '📍' },
  { id: 'livraison', nom: 'Livraison / projection', icone: '🎬' },
  { id: 'equipe', nom: 'Réunion équipe', icone: '👥' },
  { id: 'partenaire', nom: 'Partenaire / prestataire', icone: '🔗' },
  { id: 'autre', nom: 'Autre', icone: '•' },
]
export const typeRdv = (id: string) => TYPES_RDV.find((t) => t.id === id) ?? TYPES_RDV[TYPES_RDV.length - 1]

export const RAPPELS = [
  { v: 0, nom: 'Pas de rappel juste avant' },
  { v: 15, nom: '15 min avant' },
  { v: 30, nom: '30 min avant' },
  { v: 60, nom: '1 h avant' },
  { v: 120, nom: '2 h avant' },
  { v: 180, nom: '3 h avant' },
]

export const DUREES = [15, 30, 45, 60, 90, 120, 180, 240]
export const nomDuree = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`)
export const heureFr = (h: string | null) => (h ? h.replace(':', 'h') : '')

const ics = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const pad = (n: number) => String(n).padStart(2, '0')

/** Fichier .ics : s'ouvre directement dans l'agenda de l'iPhone / Google Agenda, avec son rappel */
export function telechargerIcs(r: RendezVous, avecQui?: string) {
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DEMA Agency//CRM//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:rdv-${r.id}@dema-agency`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`]
  if (r.heure) {
    const debut = new Date(`${r.date}T${r.heure}:00`)
    const fin = new Date(debut.getTime() + (r.duree || 60) * 60000)
    const f = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
    l.push(`DTSTART;TZID=Europe/Paris:${f(debut)}`, `DTEND;TZID=Europe/Paris:${f(fin)}`)
  } else {
    const d = r.date.replaceAll('-', '')
    const lendemain = new Date(r.date + 'T12:00:00'); lendemain.setDate(lendemain.getDate() + 1)
    l.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${lendemain.getFullYear()}${pad(lendemain.getMonth() + 1)}${pad(lendemain.getDate())}`)
  }
  l.push(`SUMMARY:${ics(r.titre)}`)
  if (r.lieu) l.push(`LOCATION:${ics(r.lieu)}`)
  const desc = [avecQui && `Avec : ${avecQui}`, r.visio && `Visio : ${r.visio}`, r.notes].filter(Boolean).join('\n')
  if (desc) l.push(`DESCRIPTION:${ics(desc)}`)
  if (r.visio) l.push(`URL:${r.visio}`)
  if (r.rappel > 0 && r.heure) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ics(r.titre)}`, `TRIGGER:-PT${r.rappel}M`, 'END:VALARM')
  if (r.rappel_le) {
    const t = new Date(r.rappel_le).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
    l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ics(r.titre)}`, `TRIGGER;VALUE=DATE-TIME:${t}`, 'END:VALARM')
  }
  l.push('END:VEVENT', 'END:VCALENDAR')
  const url = URL.createObjectURL(new Blob([l.join('\r\n')], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = `rdv-${r.date}-${r.titre.replace(/[^\w-]+/g, '-').slice(0, 30)}.ics`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Lien Google Maps vers le lieu */
export const lienMaps = (lieu: string) => `https://maps.google.com/?q=${encodeURIComponent(lieu)}`
