import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro, isoDate } from '../lib/format'
import { chargerParametres } from '../lib/facturation'
import { SEUIL_MICRO_SERVICES, arrondi, tauxCharges } from '../lib/fiscalite'
import type { Devis, Paiement, Projet } from '../lib/types'

type Periode = 'mois' | 'trimestre' | 'annee'
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function bornes(annee: number, periode: Periode, n: number): [string, string] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (periode === 'annee') return [`${annee}-01-01`, `${annee}-12-31`]
  if (periode === 'trimestre') return [iso(new Date(annee, (n - 1) * 3, 1)), iso(new Date(annee, n * 3, 0))]
  return [iso(new Date(annee, n - 1, 1)), iso(new Date(annee, n, 0))]
}

export default function Fiscalite() {
  const now = new Date()
  const [periode, setPeriode] = useState<Periode | null>(null)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [num, setNum] = useState<number | null>(null)

  const { data, error } = useLoad(async () => {
    const [params, projets, devis, paiements] = await Promise.all([
      chargerParametres(),
      db.from('projets').select('*').order('date_evenement'),
      db.from('devis').select('*, clients(nom, type_prestation, date_evenement)').eq('statut', 'signe'),
      db.from('paiements').select('*'),
    ])
    return { params, projets: must(projets) as Projet[], devis: must(devis) as Devis[], paiements: must(paiements) as Paiement[] }
  })

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const p = periode ?? (data.params.declaration === 'mensuelle' ? 'mois' : 'trimestre')
  const n = num ?? (p === 'mois' ? now.getMonth() + 1 : p === 'trimestre' ? Math.floor(now.getMonth() / 3) + 1 : 0)
  const [debut, fin] = bornes(annee, p, n)
  const t = tauxCharges(data.params)
  const urssaf = (m: number) => arrondi((m * t.total) / 100)
  const label = p === 'annee' ? `Année ${annee}` : p === 'trimestre' ? `T${n} ${annee}` : `${MOIS[n - 1]} ${annee}`

  const recus = data.paiements.filter((x) => x.recu && x.recu_le)
  const dansPeriode = recus.filter((x) => x.recu_le! >= debut && x.recu_le! <= fin)
  const encaissePeriode = dansPeriode.reduce((s, x) => s + Number(x.montant), 0)
  const caAnnee = recus.filter((x) => x.recu_le!.startsWith(String(annee))).reduce((s, x) => s + Number(x.montant), 0)
  const aVenir = data.paiements.filter((x) => !x.recu).reduce((s, x) => s + Number(x.montant), 0)

  // Échéance de déclaration
  const finPeriode = new Date(fin + 'T12:00:00')
  const limite = p === 'annee' ? null : new Date(finPeriode.getFullYear(), finPeriode.getMonth() + 2, 0)

  // Par contrat
  const contrats = data.projets.map((pr) => {
    const dv = data.devis.find((d) => d.id === pr.devis_id)
    const pa = data.paiements.filter((x) => x.projet_id === pr.id)
    const signe = dv ? Number(dv.montant) : pa.reduce((s, x) => s + Number(x.montant), 0)
    const encaisse = pa.filter((x) => x.recu).reduce((s, x) => s + Number(x.montant), 0)
    const periodeM = pa.filter((x) => x.recu && x.recu_le && x.recu_le >= debut && x.recu_le <= fin).reduce((s, x) => s + Number(x.montant), 0)
    return { pr, signe, encaisse, periodeM }
  }).filter((c) => c.signe > 0)

  const totSigne = contrats.reduce((s, c) => s + c.signe, 0)
  const nav = (sens: number) => {
    if (p === 'annee') { setAnnee(annee + sens); return }
    const max = p === 'mois' ? 12 : 4
    let k = n + sens, a = annee
    if (k < 1) { k = max; a-- } else if (k > max) { k = 1; a++ }
    setAnnee(a); setNum(k)
  }
  const pctSeuil = Math.min(100, Math.round((caAnnee / SEUIL_MICRO_SERVICES) * 100))

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Pilotage · gérants uniquement</span>
          <h1>Fiscalité</h1>
        </div>
        <div className="row">
          <div className="seg" role="tablist" aria-label="Période">
            {(['mois', 'trimestre', 'annee'] as Periode[]).map((x) => (
              <button key={x} type="button" role="tab" aria-selected={p === x} onClick={() => { setPeriode(x); setNum(null) }}>
                {x === 'mois' ? 'Mois' : x === 'trimestre' ? 'Trimestre' : 'Année'}
              </button>
            ))}
          </div>
          <button className="btn" type="button" aria-label="Période précédente" onClick={() => nav(-1)}>‹</button>
          <span style={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{label}</span>
          <button className="btn" type="button" aria-label="Période suivante" onClick={() => nav(1)}>›</button>
        </div>
      </div>

      <div className="banner outline" style={{ borderColor: 'var(--line)', fontSize: 13 }}>
        <span>Taux appliqué : <strong>{String(t.total).replace('.', ',')} %</strong> du chiffre d’affaires encaissé (cotisations {String(t.social).replace('.', ',')} %{data.params.acre ? ' avec ACRE' : ''} + CFP {String(t.cfp).replace('.', ',')} %{t.vl ? ` + impôt libératoire ${String(t.vl).replace('.', ',')} %` : ''}).</span>
        <Link to="/parametres" style={{ fontWeight: 600, textDecoration: 'none' }}>Modifier</Link>
      </div>

      <div className="grid-kpi">
        <div className="kpi"><span className="kpi-label">Encaissé · {label}</span><span className="kpi-value">{euro(encaissePeriode)}</span><span className="kpi-sub">{dansPeriode.length} paiement{dansPeriode.length > 1 ? 's' : ''} reçu{dansPeriode.length > 1 ? 's' : ''}</span></div>
        <div className="kpi"><span className="kpi-label">À déclarer et payer à l’URSSAF</span><span className="kpi-value" style={{ color: 'var(--orange)' }}>{euro(urssaf(encaissePeriode))}</span>
          <span className="kpi-sub">{limite ? `Avant le ${dateFr(isoDate(limite))}` : 'Total de l’année'}</span></div>
        <div className="kpi dark"><span className="kpi-label">Net pour l’agence</span><span className="kpi-value">{euro(encaissePeriode - urssaf(encaissePeriode))}</span><span className="kpi-sub">après URSSAF</span></div>
        <div className="kpi"><span className="kpi-label">URSSAF à provisionner</span><span className="kpi-value">{euro(urssaf(aVenir))}</span><span className="kpi-sub">sur {euro(aVenir)} restant à encaisser</span></div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Plafond micro-entreprise {annee}</h2>
          <span className="small muted">{euro(caAnnee)} / {euro(SEUIL_MICRO_SERVICES)} (prestations de services)</span>
        </div>
        <div className="progress"><div className="fill" style={{ width: pctSeuil + '%', background: pctSeuil >= 90 ? 'var(--red)' : pctSeuil >= 70 ? 'var(--orange)' : 'var(--green)' }} /></div>
        {pctSeuil >= 70 && <span className="small" style={{ color: 'var(--red)' }}>Tu approches du plafond : parles-en à ton comptable (passage en société, TVA…).</span>}
      </section>

      <section className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '18px 22px 0' }}>
          <h2>Par contrat</h2>
          <span className="small muted">Ce que chaque contrat rapporte, ce qui part à l’URSSAF, ce qui reste</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Contrat</th><th>Date</th>
              <th style={{ textAlign: 'right' }}>Montant signé</th>
              <th style={{ textAlign: 'right' }}>URSSAF sur le contrat</th>
              <th style={{ textAlign: 'right' }}>Net du contrat</th>
              <th style={{ textAlign: 'right' }}>Encaissé</th>
              <th style={{ textAlign: 'right' }}>Dont {label}</th>
            </tr></thead>
            <tbody>
              {contrats.map((c) => (
                <tr key={c.pr.id}>
                  <td><Link to={`/projets/${c.pr.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{c.pr.titre}</Link></td>
                  <td>{dateFr(c.pr.date_evenement, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ textAlign: 'right' }}>{euro(c.signe)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--orange)' }}>− {euro(urssaf(c.signe))}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{euro(c.signe - urssaf(c.signe))}</td>
                  <td style={{ textAlign: 'right' }}>{euro(c.encaisse)}</td>
                  <td style={{ textAlign: 'right' }}>{c.periodeM ? euro(c.periodeM) : '—'}</td>
                </tr>
              ))}
              {contrats.length === 0 && <tr><td colSpan={7} className="muted">Aucun contrat signé pour l’instant.</td></tr>}
              {contrats.length > 0 && (
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{euro(totSigne)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--orange)' }}>− {euro(urssaf(totSigne))}</td>
                  <td style={{ textAlign: 'right' }}>{euro(totSigne - urssaf(totSigne))}</td>
                  <td style={{ textAlign: 'right' }}>{euro(contrats.reduce((s, c) => s + c.encaisse, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{euro(encaissePeriode)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted" style={{ margin: 0 }}>Estimation indicative basée sur les paiements marqués « reçu ». Je ne remplace pas ton comptable : vérifie toujours le montant dans ton espace URSSAF avant de déclarer.</p>
    </>
  )
}
