import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { DELAI_RELANCE_JOURS, dateFr, euro, isoDate, joursDepuis } from '../lib/format'
import ProjetsAVenir from '../components/ProjetsAVenir'
import FinancesPanel from '../components/FinancesPanel'
import type { Client, Devis, Evenement, Paiement, Projet, Tache } from '../lib/types'

export default function Dashboard() {
  const { profile, isGerant } = useAuth()

  const { data, error } = useLoad(async () => {
    const today = isoDate(new Date())
    const dans12mois = isoDate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()))
    const [clients, projets, taches, evenements] = await Promise.all([
      db.from('clients').select('*').order('created_at', { ascending: false }),
      db.from('projets').select('*').neq('statut', 'livre').order('date_evenement'),
      db.from('taches').select('*').is('assigne_a', null).eq('fait', false).order('ordre').limit(8),
      db.from('evenements').select('*').gte('date', today).lte('date', dans12mois).neq('statut', 'annule').order('date'),
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
      evenements: must(evenements) as Evenement[],
      allTaches: allTaches as Pick<Tache, 'projet_id' | 'fait'>[],
      devis, paiements,
    }
  }, [isGerant])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const prospects = data.clients.filter((c) => c.statut_commercial === 'prospect')
  const enAttente = data.devis.filter((d) => d.statut === 'envoye' || d.statut === 'negociation')
  const relances = enAttente.filter((d) => joursDepuis(d.date_envoi) >= DELAI_RELANCE_JOURS)
  const aVenir = data.paiements.filter((p) => !p.recu && (p.echeance ?? '9999') >= data.today).slice(0, 5)
  const titreProjet = Object.fromEntries(data.projets.map((p) => [p.id, p.titre]))

  const clientsAVenir = new Set(data.evenements.map((e) => e.client_id ?? e.id))
  const nbProjets = clientsAVenir.size
  const nbValides = [...clientsAVenir].filter((id) => data.evenements.some((e) => (e.client_id ?? e.id) === id && e.statut === 'confirme')).length

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
          <span className="kpi-label">Projets à venir</span>
          <span className="kpi-value">{nbProjets}</span>
          <span className="kpi-sub">{nbValides} validé{nbValides > 1 ? 's' : ''} · {nbProjets - nbValides} à confirmer</span>
        </div>
      </div>

      {isGerant && <FinancesPanel />}

      <ProjetsAVenir evenements={data.evenements} clients={data.clients} projets={data.projets} avancement={avancement} />

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
