import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useLoad, must } from '../lib/useLoad'
import { dateFr, euro, isoDate, nomRole, nomStatutProjet, nomType } from '../lib/format'
import { lancerProduction } from '../lib/actions'
import { chargerParametres, facturerPaiement, synchroniserFactureDuPaiement } from '../lib/facturation'
import { repartition } from '../lib/fiscalite'
import type { Client, Facture, Paiement, Profile, Projet, Tache } from '../lib/types'

export default function ProjetDetail() {
  const { id } = useParams()
  const { isGerant, profile } = useAuth()
  const [nouvelleTache, setNouvelleTache] = useState('')
  const [pourQui, setPourQui] = useState('')
  const [pourQuand, setPourQuand] = useState('')
  const [msg, setMsg] = useState('')

  const { data, error, reload, setData } = useLoad(async () => {
    const projet = must(await db.from('projets').select('*').eq('id', id!).single()) as Projet
    const client = must(await db.from('clients').select('*').eq('id', projet.client_id).single()) as Client
    const taches = must(await db.from('taches').select('*').eq('projet_id', id!).order('ordre')) as Tache[]
    const equipe = must(await db.from('profiles').select('id, nom, role').order('nom')) as Profile[]
    const paiements = isGerant ? (must(await db.from('paiements').select('*').eq('projet_id', id!).order('echeance', { nullsFirst: false })) as Paiement[]) : []
    const factures = isGerant ? (must(await db.from('factures').select('id, numero, paiement_id, statut').eq('projet_id', id!)) as Facture[]) : []
    const params = isGerant ? await chargerParametres() : null
    return { projet, client, taches, equipe, paiements, factures, params }
  }, [id, isGerant])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>
  const { projet, client, taches, equipe, paiements, factures, params } = data
  const factureDe = (p: Paiement) => factures.find((f) => f.paiement_id === p.id && f.statut !== 'annulee')
  const facturer = async (p: Paiement) => {
    try {
      const fid = await facturerPaiement(p, projet, await chargerParametres())
      window.location.href = `/factures/${fid}/pdf`
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur') }
  }

  const groupes = Array.from(new Set(taches.map((t) => t.groupe)))
  const faites = taches.filter((t) => t.fait).length
  const pct = taches.length ? Math.round((faites / taches.length) * 100) : 0
  const total = paiements.reduce((s, p) => s + Number(p.montant), 0)
  const recu = paiements.filter((p) => p.recu).reduce((s, p) => s + Number(p.montant), 0)

  const majTache = async (t: Tache, patch: Partial<Tache>) => {
    setData({ ...data, taches: taches.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) })
    const { error } = await db.from('taches').update(patch).eq('id', t.id)
    if (error) { setMsg(error.message); reload() }
  }
  const ajouterTache = async () => {
    if (!nouvelleTache.trim()) return
    await db.from('taches').insert({ projet_id: projet.id, groupe: 'Autres', titre: nouvelleTache.trim(), ordre: taches.length, assigne_a: pourQui || null, echeance: pourQuand || null })
    const qui = equipe.find((m) => m.id === pourQui)
    setMsg(qui && qui.id !== profile?.id ? `Tâche ajoutée : ${qui.nom} est prévenu(e) par notification.` : '')
    setNouvelleTache(''); setPourQuand(''); reload()
  }
  const majPaiement = async (p: Paiement, patch: Partial<Paiement>) => {
    const { error } = await db.from('paiements').update(patch).eq('id', p.id)
    if (error) { setMsg(error.message); return }
    if (patch.recu !== undefined) await synchroniserFactureDuPaiement(p.id, patch.recu)
    // Acompte reçu → projet en production + tâches générées
    if (patch.recu && p.type === 'acompte' && projet.statut === 'en_attente') {
      await lancerProduction(projet)
      setMsg('Acompte reçu : le projet passe en production et ses tâches ont été générées.')
    }
    reload()
  }
  const ajouterPaiement = async () => {
    await db.from('paiements').insert({ projet_id: projet.id, libelle: 'Versement', type: 'versement', montant: 0 })
    reload()
  }
  const supprimerPaiement = async (p: Paiement) => {
    if (!confirm(`Supprimer la ligne « ${p.libelle} » ?`)) return
    await db.from('paiements').delete().eq('id', p.id); reload()
  }
  const setStatut = async (statut: Projet['statut']) => {
    if (statut === 'production') await lancerProduction(projet)
    else await db.from('projets').update({ statut }).eq('id', projet.id)
    reload()
  }

  return (
    <>
      <div className="stack">
        <Link to="/projets" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>← Projets</Link>
        <div className="page-head">
          <div className="stack">
            <h1>{projet.titre}</h1>
            <span className="muted" style={{ fontSize: 14 }}>{nomType(projet.type_prestation)} · {dateFr(projet.date_evenement)} · <Link to={`/clients/${client.id}`}>Fiche client</Link></span>
          </div>
          <div className="row">
            <div className="kpi" style={{ padding: '10px 14px', gap: 4 }}>
              <span style={{ fontSize: 11, letterSpacing: '.06em' }} className="muted">STATUT COMMERCIAL</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green-ink)' }}>{client.statut_commercial === 'client' ? 'Client' : 'Prospect'}</span>
            </div>
            <div className="kpi" style={{ padding: '10px 14px', gap: 4 }}>
              <span style={{ fontSize: 11, letterSpacing: '.06em' }} className="muted">STATUT PROJET</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-dark)' }}>{nomStatutProjet[projet.statut]} · {pct} %</span>
            </div>
          </div>
        </div>
      </div>
      {msg && <div className="banner amber" role="status"><span>{msg}</span></div>}

      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <section className="card" style={{ flex: '999 1 460px' }}>
          <div className="card-head">
            <h2>Tâches</h2>
            <span className="small muted">{faites} / {taches.length} faites</span>
          </div>
          {taches.length === 0 && (
            <p className="empty">
              {projet.statut === 'en_attente'
                ? 'Les tâches seront générées automatiquement dès que l’acompte sera marqué comme reçu.'
                : 'Aucune tâche.'}
            </p>
          )}
          {groupes.map((g) => (
            <div key={g} className="stack" style={{ gap: 0 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--soft)', padding: '10px 0 4px' }}>{g}</span>
              {taches.filter((t) => t.groupe === g).map((t) => (
                <div className="checkline" key={t.id}>
                  <label>
                    <input type="checkbox" checked={t.fait} onChange={() => majTache(t, { fait: !t.fait })} />
                    <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                      <span className={t.fait ? 'done' : ''}>{t.titre}</span>
                      {t.echeance && !t.fait && (
                        <span className="small" style={{ color: t.echeance < isoDate(new Date()) ? 'var(--red)' : 'var(--muted)' }}>
                          {t.echeance < isoDate(new Date()) ? 'En retard · ' : 'Pour '}{dateFr(t.echeance, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </span>
                  </label>
                  <select aria-label={`Assigner ${t.titre}`} value={t.assigne_a ?? ''} onChange={(e) => majTache(t, { assigne_a: e.target.value || null })}
                    style={!t.assigne_a ? { background: 'var(--amber-soft)', color: 'var(--amber-ink)', fontWeight: 600 } : undefined}>
                    <option value="">Non assignée</option>
                    {equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ))}
          {projet.statut !== 'en_attente' && (
            <div className="row" style={{ paddingTop: 8 }}>
              <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" value={nouvelleTache}
                onChange={(e) => setNouvelleTache(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ajouterTache() }} />
              <select className="input" aria-label="Pour qui" value={pourQui} onChange={(e) => setPourQui(e.target.value)}>
                <option value="">Pour qui ?</option>
                {equipe.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <input className="input" type="date" aria-label="Pour quand" title="Pour quand (facultatif)" value={pourQuand} onChange={(e) => setPourQuand(e.target.value)} />
              <button className="btn" type="button" onClick={ajouterTache}>Ajouter</button>
            </div>
          )}
        </section>

        <div className="stack" style={{ flex: '1 1 320px', gap: 20, minWidth: 0 }}>
          <section className="card">
            <h2>Équipe</h2>
            {equipe.map((m) => (
              <div key={m.id} className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span>{m.nom}</span><span className="muted">{nomRole[m.role]}</span>
              </div>
            ))}
          </section>

          {isGerant && (
            <section className="card">
              <div className="card-head">
                <h2>Échéancier</h2>
                <span className="small muted">{euro(recu)} reçus / {euro(total)}</span>
              </div>
              {paiements.map((p) => (
                <div key={p.id} className="stack" style={{ gap: 8, padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <input className="input" style={{ height: 36, flex: 1, minWidth: 0 }} aria-label="Libellé" defaultValue={p.libelle}
                      onBlur={(e) => e.target.value !== p.libelle && majPaiement(p, { libelle: e.target.value })} />
                    <button type="button" className="btn small" aria-label="Supprimer" onClick={() => supprimerPaiement(p)}>×</button>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input className="input" style={{ height: 36, width: 110 }} type="number" min="0" aria-label="Montant" defaultValue={p.montant}
                      onBlur={(e) => Number(e.target.value) !== Number(p.montant) && majPaiement(p, { montant: Number(e.target.value) })} />
                    <input className="input" style={{ height: 36, flex: 1, minWidth: 0 }} type="date" aria-label="Échéance" defaultValue={p.echeance ?? ''}
                      onBlur={(e) => e.target.value !== (p.echeance ?? '') && majPaiement(p, { echeance: e.target.value || null })} />
                  </div>
                  <label className={'badge ' + (p.recu ? 'green' : 'amber')} style={{ alignSelf: 'flex-start', minHeight: 32, cursor: 'pointer', padding: '0 12px' }}>
                    <input type="checkbox" checked={p.recu} style={{ margin: 0, accentColor: 'var(--green)' }}
                      onChange={() => majPaiement(p, { recu: !p.recu, recu_le: !p.recu ? isoDate(new Date()) : null })} />
                    {p.recu ? `${p.type === 'acompte' ? 'Acompte reçu' : 'Reçu'}${p.recu_le ? ' le ' + dateFr(p.recu_le, { day: 'numeric', month: 'short' }) : ''}` : 'En attente'}
                  </label>
                  {factureDe(p)
                    ? <Link className="btn small" style={{ alignSelf: 'flex-start' }} to={`/factures/${factureDe(p)!.id}/pdf`}>Facture {factureDe(p)!.numero}</Link>
                    : <button className="btn small dashed" style={{ alignSelf: 'flex-start' }} type="button" disabled={Number(p.montant) <= 0} onClick={() => facturer(p)}>Facturer</button>}
                </div>
              ))}
              <button className="btn small dashed" type="button" onClick={ajouterPaiement}>+ Ajouter une échéance</button>
              <span className="small muted">Échéancier propre à ce projet. Cocher l’acompte lance la production.</span>
              {params && total > 0 && (() => { const r = repartition(total, params); return (
                <div className="stack" style={{ gap: 4, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 13 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span>URSSAF sur le contrat ({String(r.taux).replace('.', ',')} %)</span><span style={{ color: 'var(--orange)', fontWeight: 600 }}>− {euro(r.urssaf)}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span><strong>Net pour l’agence</strong></span><strong>{euro(r.net)}</strong></div>
                </div>) })()}
            </section>
          )}

          <section className="card">
            <h2>Statut du projet</h2>
            <div className="row">
              {projet.statut !== 'production' && <button className="btn small" type="button" onClick={() => setStatut('production')}>Passer en production</button>}
              {projet.statut !== 'livre' && <button className="btn small primary" type="button" onClick={() => setStatut('livre')}>Marquer livré</button>}
              {projet.statut === 'livre' && <span className="badge green">Projet livré</span>}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
