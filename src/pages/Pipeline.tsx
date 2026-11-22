import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLoad, must } from '../lib/useLoad'
import { DELAI_RELANCE_JOURS, dateFr, euro, joursDepuis, nomType } from '../lib/format'
import type { Client, Devis } from '../lib/types'

export default function Pipeline() {
  const { data, error } = useLoad(async () => {
    const clients = must(await supabase.from('clients').select('*').neq('statut_commercial', 'perdu').order('created_at', { ascending: false })) as Client[]
    const devis = must(await supabase.from('devis').select('*').neq('statut', 'refuse').order('created_at', { ascending: false })) as Devis[]
    return { clients, devis }
  })

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  // Le devis le plus récent de chaque client détermine sa colonne
  const dernier = new Map<string, Devis>()
  for (const d of data.devis) if (!dernier.has(d.client_id)) dernier.set(d.client_id, d)

  type Carte = { client: Client; devis?: Devis }
  const colonnes: { titre: string; cartes: Carte[] }[] = [
    { titre: 'Premier contact', cartes: [] },
    { titre: 'Devis envoyé', cartes: [] },
    { titre: 'Négociation', cartes: [] },
    { titre: 'Signé', cartes: [] },
  ]
  for (const client of data.clients) {
    const d = dernier.get(client.id)
    const col = !d || d.statut === 'brouillon' ? 0 : d.statut === 'envoye' ? 1 : d.statut === 'negociation' ? 2 : 3
    colonnes[col].cartes.push({ client, devis: d })
  }

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Commercial</span>
          <h1>Pipeline &amp; devis</h1>
        </div>
        <Link className="btn primary" to="/clients/nouveau">+ Nouveau prospect</Link>
      </div>

      <div className="banner amber">
        <span><strong>Relance à J+{DELAI_RELANCE_JOURS}</strong> · un devis sans réponse depuis {DELAI_RELANCE_JOURS} jours est signalé ici et sur le tableau de bord.</span>
      </div>

      <div className="kanban-wrap">
        <div className="kanban">
          {colonnes.map((col) => (
            <section className="column" key={col.titre}>
              <div className="column-head">
                <h2 style={{ fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{col.titre}</h2>
                <span className="count">{col.cartes.length}</span>
              </div>
              {col.cartes.map(({ client, devis }) => {
                const relance = devis && (devis.statut === 'envoye' || devis.statut === 'negociation') && joursDepuis(devis.date_envoi) >= DELAI_RELANCE_JOURS
                return (
                  <Link key={client.id} to={devis ? `/devis/${devis.id}` : `/clients/${client.id}`} className="deal" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{client.nom}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{devis ? euro(devis.montant) : '—'}</span>
                    </div>
                    <span className="small muted">{nomType(client.type_prestation)} · {dateFr(client.date_evenement)}</span>
                    {!devis && <span className="small" style={{ color: 'var(--accent)' }}>Créer un devis →</span>}
                    {relance && <span className="badge amber" style={{ alignSelf: 'flex-start' }}>Relance due · J+{joursDepuis(devis!.date_envoi)}</span>}
                    {devis?.statut === 'signe' && <span className="badge green" style={{ alignSelf: 'flex-start' }}>Projet créé</span>}
                  </Link>
                )
              })}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
