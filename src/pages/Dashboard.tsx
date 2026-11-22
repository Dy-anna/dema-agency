import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { DELAI_RELANCE_JOURS, dateFr, euro, isoDate, joursDepuis, nomType } from '../lib/format'
import type { Client, Devis, Paiement, Projet, Tache } from '../lib/types'

export default function Dashboard() {
  const { profile, isGerant } = useAuth()

  const { data, error } = useLoad(async () => {
    const today = isoDate(new Date())
    const [clients, projets, taches] = await Promise.all([
      db.from('clients').select('*').order('created_at', { ascending: false }),
      db.from('projets').select('*').neq('statut', 'livre').order('date_evenement'),
      db.from('taches').select('*').is('assigne_a', null).eq('fait', false).order('ordre').limit(8),
    ])
    let devis: Devis[] = []
    let paiements: (Paiement & { projets: { titre: string } | null })[] = []
    if (isGerant) {
      devis = must(await db.from('devis').select('*, clients(nom, type_prestation, date_evenement)').order('created_at', { ascending: false }))
      paiements = must(await db.from('paiements').select('*, projets(titre)').order('echeance'))
    }
    const allTaches = must(await db.from('taches').select('projet_id, fait'))
    return {
      today,
      clients: must(clients) as Client[],
      projets: must(projets) as Projet[],
      taches: must(taches) as Tache[],
      allTaches: allTaches as Pick<Tache, 'projet_id' | 'fait'>[],
      devis, paiements,
    }
  }, [isGerant])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const prospects = data.clients.filter((c) => c.statut_commercial === 'prospect')
  const enAttente = data.devis.filter((d) => d.statut === 'envoye' || d.statut === 'negociation')
  const relances = enAttente.filter((d) => joursDepuis(d.date_envoi) >= DELAI_RELANCE_JOURS)
  const annee = new Date().getFullYear()
  const signesAnnee = data.devis.filter((d) => d.statut === 'signe' && d.date_signature?.startsWith(String(annee)))
  const caSigne = signesAnnee.reduce((s, d) => s + Number(d.montant), 0)
  const caPipeline = enAttente.reduce((s, d) => s + Number(d.montant), 0)
  const encaisse = data.paiements.filter((p) => p.recu && (p.recu_le ?? '').startsWith(String(annee))).reduce((s, p) => s + Number(p.montant), 0)
  const acomptes = data.paiements.filter((p) => p.type === 'acompte')
  const acomptesRecus = acomptes.filter((p) => p.recu)
  const aVenir = data.paiements.filter((p) => !p.recu).slice(0, 5)
  const titreProjet = Object.fromEntries(data.projets.map((p) => [p.id, p.titre]))

  const avancement = (projetId: string) => {
    const t = data.allTaches.filter((x) => x.projet_id === projetId)
    return t.length ? Math.round((t.filter((x) => x.fait).length / t.length) * 100) : 0
  }

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">{dateFr(data.today, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>Bonjour {profile?.nom?.split(' ')[0] ?? ''}</h1>
        </div>
        <div className="row">
          <Link className="btn primary" to="/clients/nouveau">+ Nouveau prospect</Link>
        </div>
      </div>

      <div className="grid-kpi">
        <div className="kpi">
          <span className="kpi-label">Prospects actifs</span>
          <span className="kpi-value">{prospects.length}</span>
          <span className="kpi-sub">{data.clients.filter((c) => c.statut_commercial === 'client').length} clients au total</span>
        </div>
        {isGerant && (
          <div className="kpi">
            <span className="kpi-label">Devis en attente</span>
            <span className="kpi-value">{enAttente.length}</span>
            <span className="kpi-sub" style={relances.length ? { color: 'var(--amber-ink)', fontWeight: 600 } : undefined}>
              {relances.length ? `${relances.length} relance(s) à faire` : 'Aucune relance due'}
            </span>
          </div>
        )}
        <div className="kpi">
          <span className="kpi-label">Projets en cours</span>
          <span className="kpi-value">{data.projets.length}</span>
          <span className="kpi-sub">{data.projets.filter((p) => p.statut === 'production').length} en production</span>
        </div>
        {isGerant && (
          <>
            <div className="kpi dark">
              <span className="kpi-label">CA encaissé {annee}</span>
              <span className="kpi-value">{euro(encaisse)}</span>
              <span className="kpi-sub">Visible : gérants uniquement</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">CA prévisionnel {annee}</span>
              <span className="kpi-value" style={{ color: 'var(--accent-dark)' }}>{euro(caSigne + caPipeline)}</span>
              <span className="kpi-sub">Signé : {euro(caSigne)} · Devis en cours : {euro(caPipeline)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Acomptes reçus</span>
              <span className="kpi-value">{acomptesRecus.length} / {acomptes.length}</span>
              <span className="kpi-sub" style={{ color: 'var(--green-ink)', fontWeight: 600 }}>
                {euro(acomptesRecus.reduce((s, p) => s + Number(p.montant), 0))} encaissés
              </span>
            </div>
          </>
        )}
      </div>

      <div className="grid-cards">
        {isGerant && (
          <section className="card">
            <div className="card-head">
              <h2>Relances à faire</h2>
              <span className="badge amber">J+{DELAI_RELANCE_JOURS}</span>
            </div>
            {relances.length === 0 && <p className="empty">Aucun devis sans réponse depuis plus de {DELAI_RELANCE_JOURS} jours.</p>}
            {relances.map((d) => (
              <div className="list-row" key={d.id}>
                <div className="stack" style={{ gap: 3 }}>
                  <span className="title">{d.clients?.nom}</span>
                  <span className="sub">Devis envoyé il y a {joursDepuis(d.date_envoi)} jours · {euro(d.montant)}</span>
                </div>
                <Link className="btn small" to={`/devis/${d.id}`}>Ouvrir</Link>
              </div>
            ))}
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h2>Prochains projets</h2>
            <Link to="/calendrier" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Voir le calendrier</Link>
          </div>
          {data.projets.length === 0 && <p className="empty">Aucun projet en cours.</p>}
          {data.projets.slice(0, 5).map((p) => {
            const pct = avancement(p.id)
            return (
              <Link key={p.id} to={`/projets/${p.id}`} className="stack" style={{ padding: '12px 0', borderTop: '1px solid var(--line-soft)', textDecoration: 'none', color: 'inherit', gap: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.titre}</span>
                  <span className="small muted">{dateFr(p.date_evenement)}</span>
                </div>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <div className="progress" style={{ flex: 1 }}><div className="fill" style={{ width: pct + '%' }} /></div>
                  <span className="small muted" style={{ minWidth: 36, textAlign: 'right' }}>{pct} %</span>
                </div>
                <span className="small muted">{nomType(p.type_prestation)}</span>
              </Link>
            )
          })}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Tâches non assignées</h2>
            <span className="badge indigo">Générées auto</span>
          </div>
          {data.taches.length === 0 && <p className="empty">Tout est assigné.</p>}
          {data.taches.map((t) => (
            <div className="list-row" key={t.id}>
              <div className="stack" style={{ gap: 3 }}>
                <span style={{ fontSize: 14 }}>{t.titre}</span>
                <span className="sub">{titreProjet[t.projet_id] ?? 'Projet'} · {t.groupe}</span>
              </div>
              <Link className="btn small dashed" to={`/projets/${t.projet_id}`}>Assigner</Link>
            </div>
          ))}
        </section>

        {isGerant && (
          <section className="card">
            <div className="card-head">
              <h2>Paiements à venir</h2>
              <span className="small muted">Finance</span>
            </div>
            {aVenir.length === 0 && <p className="empty">Aucun paiement en attente.</p>}
            {aVenir.map((p) => (
              <div className="list-row" key={p.id}>
                <div className="stack" style={{ gap: 3 }}>
                  <span className="title">{p.projets?.titre}</span>
                  <span className="sub">{p.libelle} · {euro(p.montant)}</span>
                </div>
                <span className={'badge ' + (p.type === 'acompte' ? 'amber' : 'grey')}>{p.echeance ? dateFr(p.echeance, { day: 'numeric', month: 'short' }) : 'Sans date'}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  )
}
