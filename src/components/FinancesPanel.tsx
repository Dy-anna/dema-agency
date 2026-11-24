// Bloc « Finances » du tableau de bord (gérants) — toujours recalculé depuis les devis et échéanciers
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro, isoDate } from '../lib/format'
import { chargerParametres } from '../lib/facturation'
import { calculerFinances } from '../lib/finances'
import type { Client, Devis, Paiement, Projet } from '../lib/types'

export default function FinancesPanel() {
  const today = isoDate(new Date())
  const [annee, setAnnee] = useState<number | 0>(0)

  const { data, error } = useLoad(async () => {
    const [projets, devis, paiements, clients, params] = await Promise.all([
      db.from('projets').select('*'),
      db.from('devis').select('*'),
      db.from('paiements').select('*'),
      db.from('clients').select('*'),
      chargerParametres(),
    ])
    return { projets: must(projets) as Projet[], devis: must(devis) as Devis[], paiements: must(paiements) as Paiement[], clients: must(clients) as Client[], params }
  })

  if (error) return <p className="error">{error}</p>
  if (!data) return <section className="card"><span className="muted">Calcul des finances…</span></section>

  const avecDevis = new Set(data.devis.map((d) => d.client_id))
  const annees = [...new Set([...data.projets.map((p) => p.date_evenement), ...data.clients.filter((c) => avecDevis.has(c.id)).map((c) => c.date_evenement)].map((d) => (d ?? '').slice(0, 4)).filter(Boolean))].sort()
  const f = calculerFinances({ ...data, today, annee: annee || undefined })
  const impayes = f.lignes.filter((l) => l.passe && l.reste > 0).sort((a, b) => (a.projet.date_evenement ?? '').localeCompare(b.projet.date_evenement ?? ''))
  const pct = f.signe ? Math.round((f.encaisse / f.signe) * 100) : 0
  const taux = String(f.tauxUrssaf).replace('.', ',')

  return (
    <section className="card" style={{ gap: 18 }}>
      <div className="card-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2>Finances</h2>
          <span className="small muted">Calculé en direct depuis les devis, projets et échéanciers · URSSAF {taux} %</span>
        </div>
        <div className="seg" role="tablist" aria-label="Période">
          <button type="button" role="tab" aria-selected={annee === 0} onClick={() => setAnnee(0)}>Tout</button>
          {annees.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={annee === Number(a)} onClick={() => setAnnee(Number(a))}>{a}</button>
          ))}
        </div>
      </div>

      <div className="grid-kpi">
        <div className="kpi dark">
          <span className="kpi-label">CA encaissé</span>
          <span className="kpi-value">{euro(f.encaisse)}</span>
          <span className="kpi-sub">dont {euro(f.acomptesRecus)} d’acomptes · {pct} % du signé</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">CA signé (brut)</span>
          <span className="kpi-value">{euro(f.signe)}</span>
          <span className="kpi-sub">Réalisé {euro(f.realise)} · à venir {euro(f.aVenir)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Reste à encaisser</span>
          <span className="kpi-value" style={{ color: 'var(--orange)' }}>{euro(f.resteAEncaisser)}</span>
          <span className="kpi-sub" style={f.impayes ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
            {f.impayes ? `dont ${euro(f.impayes)} d’impayés (prestations faites)` : 'Aucun impayé'}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">CA prévisionnel brut</span>
          <span className="kpi-value" style={{ color: 'var(--accent-dark)' }}>{euro(f.previsionnelBrut)}</span>
          <span className="kpi-sub">Signé {euro(f.signe)} + devis en cours {euro(f.pipeline)}</span>
        </div>
        <div className="kpi" style={{ borderColor: 'var(--green)', borderWidth: 2 }}>
          <span className="kpi-label">CA prévisionnel net (bénéfice)</span>
          <span className="kpi-value" style={{ color: 'var(--green-ink)' }}>{euro(f.previsionnelNet)}</span>
          <span className="kpi-sub">après URSSAF ({euro(f.urssafPrevisionnelle)})</span>
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="stack" style={{ gap: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>Impayés · prestations déjà réalisées</strong>
            {impayes.length > 0 && <span className="badge red">{impayes.length}</span>}
          </div>
          {impayes.length === 0 && <p className="empty">Tout est réglé.</p>}
          {impayes.map((l) => (
            <Link key={l.projet.id} to={`/projets/${l.projet.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="title">{l.projet.titre}</span>
                <span className="sub">{dateFr(l.projet.date_evenement, { day: 'numeric', month: 'short', year: 'numeric' })} · {euro(l.encaisse)} reçus sur {euro(l.montant)}</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--red)' }}>{euro(l.reste)}</span>
            </Link>
          ))}
        </div>
        <div className="stack" style={{ gap: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>Devis en cours (prévisionnel)</strong>
            <Link to="/pipeline" className="small" style={{ fontWeight: 600, textDecoration: 'none' }}>Pipeline</Link>
          </div>
          {f.devisEnCours.length === 0 && <p className="empty">Aucun devis en attente.</p>}
          {f.devisEnCours.map((d) => (
            <Link key={d.id} to={`/devis/${d.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="title">{d.client?.nom}</span>
                <span className="sub">{d.statut === 'brouillon' ? 'Brouillon' : d.statut === 'envoye' ? 'Envoyé' : 'Négociation'} · {dateFr(d.client?.date_evenement, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{euro(d.montant)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
