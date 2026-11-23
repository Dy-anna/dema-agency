// Cotisations URSSAF (régime micro-entrepreneur) — taux 2026, à vérifier sur autoentrepreneur.urssaf.fr
import type { ParametresAgence } from './types'

export const REGIMES: Record<string, { nom: string; taux: number; cfp: number; vl: number }> = {
  bnc: { nom: 'Prestations de services libérales (BNC)', taux: 25.6, cfp: 0.2, vl: 2.2 },
  bic_services: { nom: 'Prestations de services commerciales / artisanales (BIC)', taux: 21.2, cfp: 0.1, vl: 1.7 },
  bnc_cipav: { nom: 'Profession libérale relevant de la Cipav', taux: 23.2, cfp: 0.2, vl: 2.2 },
  vente: { nom: 'Vente de marchandises (BIC)', taux: 12.3, cfp: 0.1, vl: 1 },
  autre: { nom: 'Autre (taux personnalisé)', taux: 0, cfp: 0, vl: 0 },
}

export const SEUIL_MICRO_SERVICES = 83600

export interface Charges { social: number; cfp: number; vl: number; total: number }

/** Taux en % appliqués au chiffre d'affaires encaissé */
export function tauxCharges(p: ParametresAgence): Charges {
  const social = (Number(p.taux_urssaf) || 0) * (p.acre ? 0.5 : 1)
  const cfp = Number(p.cfp_taux) || 0
  const vl = p.versement_liberatoire ? Number(p.taux_vl) || 0 : 0
  return { social, cfp, vl, total: Math.round((social + cfp + vl) * 100) / 100 }
}

export const arrondi = (n: number) => Math.round(n * 100) / 100

/** Ce qu'on garde sur un montant encaissé */
export function repartition(montant: number, p: ParametresAgence) {
  const t = tauxCharges(p)
  const urssaf = arrondi((montant * t.total) / 100)
  return { montant, urssaf, net: arrondi(montant - urssaf), taux: t.total }
}
