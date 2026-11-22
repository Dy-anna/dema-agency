import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { euro } from '../lib/format'
import type { Indicateur, Objectif } from '../lib/types'

type Periode = 'annee' | 'trimestre' | 'mois'
const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const INDICATEURS: { id: Indicateur; nom: string; money?: boolean }[] = [
  { id: 'ca_signe', nom: 'CA signé', money: true },
  { id: 'ca_encaisse', nom: 'CA encaissé', money: true },
  { id: 'prospects', nom: 'Prospects' },
  { id: 'rdv', nom: 'Rendez-vous effectués' },
  { id: 'signes', nom: 'Clients signés' },
]

/** Bornes [début, fin[ d'une période */
function bornes(annee: number, periode: Periode, numero: number): [Date, Date] {
  if (periode === 'annee') return [new Date(annee, 0, 1), new Date(annee + 1, 0, 1)]
  if (periode === 'trimestre') return [new Date(annee, (numero - 1) * 3, 1), new Date(annee, numero * 3, 1)]
  return [new Date(annee, numero - 1, 1), new Date(annee, numero, 1)]
}

export default function Objectifs() {
  const now = new Date()
  const [annee, setAnnee] = useState(now.getFullYear())
  const [periode, setPeriode] = useState<Periode>('mois')
  const [numero, setNumero] = useState(now.getMonth() + 1)
  const [edition, setEdition] = useState(false)
  const [cibles, setCibles] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setNumero(periode === 'annee' ? 0 : periode === 'trimestre' ? Math.floor(now.getMonth() / 3) + 1 : now.getMonth() + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode])

  const { data, error, reload } = useLoad(async () => {
    const debut = `${annee}-01-01`, fin = `${annee + 1}-01-01`
    const [obj, clients, devis, paiements] = await Promise.all([
      db.from('objectifs').select('*').eq('annee', annee),
      db.from('clients').select('created_at, rdv_effectue_le').gte('created_at', `${annee - 1}-12-31`),
      db.from('devis').select('montant, date_signature').eq('statut', 'signe').gte('date_signature', debut).lt('date_signature', fin),
      db.from('paiements').select('montant, recu_le').eq('recu', true).gte('recu_le', debut).lt('recu_le', fin),
    ])
    return {
      objectifs: must(obj) as Objectif[],
      clients: must(clients) as { created_at: string; rdv_effectue_le: string | null }[],
      devis: must(devis) as { montant: number; date_signature: string }[],
      paiements: must(paiements) as { montant: number; recu_le: string }[],
    }
  }, [annee])

  const cle = (ind: Indicateur, p: Periode = periode, n: number = numero) => `${p}-${n}-${ind}`

  useEffect(() => {
    if (!data) return
    setCibles(Object.fromEntries(data.objectifs.map((o) => [`${o.periode}-${o.numero}-${o.indicateur}`, Number(o.cible)])))
  }, [data])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Chargement…</p>

  const dansPeriode = (d: string | null, [a, b]: [Date, Date]) => {
    if (!d) return false
    const t = new Date(d.length === 10 ? d + 'T12:00:00' : d).getTime()
    return t >= a.getTime() && t < b.getTime()
  }
  const realise = (ind: Indicateur, b: [Date, Date]) => {
    switch (ind) {
      case 'ca_signe': return data.devis.filter((d) => dansPeriode(d.date_signature, b)).reduce((s, d) => s + Number(d.montant), 0)
      case 'ca_encaisse': return data.paiements.filter((p) => dansPeriode(p.recu_le, b)).reduce((s, p) => s + Number(p.montant), 0)
      case 'prospects': return data.clients.filter((c) => dansPeriode(c.created_at, b)).length
      case 'rdv': return data.clients.filter((c) => dansPeriode(c.rdv_effectue_le, b)).length
      case 'signes': return data.devis.filter((d) => dansPeriode(d.date_signature, b)).length
    }
  }

  const b = bornes(annee, periode, numero)
  const rythme = Math.max(0, Math.min(1, (now.getTime() - b[0].getTime()) / (b[1].getTime() - b[0].getTime())))
  const labelPeriode = periode === 'annee' ? `Année ${annee}` : periode === 'trimestre' ? `T${numero} ${annee}` : `${MOIS[numero - 1]} ${annee}`

  const enregistrer = async () => {
    const lignes = INDICATEURS.map((i) => ({ annee, periode, numero, indicateur: i.id, cible: cibles[cle(i.id)] ?? 0 }))
    const { error } = await db.from('objectifs').upsert(lignes, { onConflict: 'annee,periode,numero,indicateur' })
    if (error) { setMsg(error.message); return }
    setEdition(false); setMsg('Objectifs enregistrés.'); reload()
  }

  // Répartit l'objectif annuel sur les 12 mois (pondéré saison mariages)
  const repartir = async () => {
    const poids = [4, 5, 7, 9, 14, 15, 16, 14, 13, 9, 7, 7]
    const somme = poids.reduce((s, x) => s + x, 0)
    const lignes = INDICATEURS.flatMap((i) => {
      const total = cibles[cle(i.id, 'annee', 0)] ?? 0
      return poids.map((w, m) => ({ annee, periode: 'mois', numero: m + 1, indicateur: i.id, cible: Math.round((total * w) / somme) }))
    })
    const trims = INDICATEURS.flatMap((i) => [1, 2, 3, 4].map((t) => ({
      annee, periode: 'trimestre', numero: t, indicateur: i.id,
      cible: lignes.filter((l) => l.indicateur === i.id && Math.ceil(l.numero / 3) === t).reduce((s, l) => s + l.cible, 0),
    })))
    if (!confirm('Remplacer les objectifs trimestriels et mensuels par une répartition de l’objectif annuel (pondérée par saison) ?')) return
    const { error } = await db.from('objectifs').upsert([...lignes, ...trims], { onConflict: 'annee,periode,numero,indicateur' })
    setMsg(error ? error.message : 'Objectif annuel réparti sur les trimestres et les mois.'); reload()
  }

  const moisData = MOIS.map((nom, m) => {
    const bm = bornes(annee, 'mois', m + 1)
    return { nom, obj: cibles[cle('ca_signe', 'mois', m + 1)] ?? 0, real: realise('ca_signe', bm) }
  })
  const max = Math.max(1, ...moisData.map((m) => Math.max(m.obj, m.real)))
  const pros = realise('prospects', b), rdv = realise('rdv', b), sig = realise('signes', b)

  return (
    <>
      <div className="page-head">
        <div className="stack">
          <span className="eyebrow">Pilotage · gérants uniquement</span>
          <h1>Objectifs</h1>
        </div>
        <div className="row">
          <div className="seg" role="tablist" aria-label="Période">
            {(['annee', 'trimestre', 'mois'] as Periode[]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={periode === p} onClick={() => setPeriode(p)}>
                {p === 'annee' ? 'Année' : p === 'trimestre' ? 'Trimestre' : 'Mois'}
              </button>
            ))}
          </div>
          {periode !== 'annee' && (
            <select className="input" aria-label="Choisir la période" value={numero} onChange={(e) => setNumero(Number(e.target.value))}>
              {(periode === 'trimestre' ? [1, 2, 3, 4] : MOIS.map((_, i) => i + 1)).map((n) => (
                <option key={n} value={n}>{periode === 'trimestre' ? `T${n}` : MOIS[n - 1]}</option>
              ))}
            </select>
          )}
          <select className="input" aria-label="Année" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {edition
            ? <button className="btn primary" type="button" onClick={enregistrer}>Enregistrer</button>
            : <button className="btn" type="button" onClick={() => setEdition(true)}>Modifier les objectifs</button>}
        </div>
      </div>

      <div className="banner outline" style={{ borderColor: 'var(--line)', fontSize: 13 }}>
        <span><strong>{labelPeriode}</strong> · rythme attendu à ce jour : {Math.round(rythme * 100)} % (trait noir sur les barres)</span>
        <div className="row">
          {periode === 'annee' && <button className="btn small" type="button" onClick={repartir}>Répartir sur les mois</button>}
          <span className="muted">Le réalisé est calculé automatiquement.</span>
        </div>
      </div>
      {msg && <span className="small muted" role="status">{msg}</span>}

      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {INDICATEURS.map((i) => {
          const cible = cibles[cle(i.id)] ?? 0
          const real = realise(i.id, b)
          const pct = cible > 0 ? real / cible : 0
          const atteint = cible > 0 && pct >= 1
          const ok = atteint || pct >= rythme
          const fmt = (n: number) => (i.money ? euro(n) : String(n))
          return (
            <section key={i.id} className="card" style={{ padding: 20, gap: 12 }}>
              <div className="card-head">
                <h2 style={{ fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--soft)' }}>{i.nom}</h2>
                {cible > 0 ? <span className={'badge ' + (ok ? 'green' : 'orange')}>{atteint ? 'Atteint' : ok ? 'Dans les temps' : 'En retard'}</span> : <span className="badge grey">Pas d’objectif</span>}
              </div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700 }}>{fmt(real)}</span>
                <span className="muted" style={{ fontSize: 14 }}>/ {fmt(cible)}</span>
              </div>
              {edition && (
                <label className="field" style={{ fontSize: 12 }}>Cible {i.money ? '(€)' : ''}
                  <input type="number" min="0" value={cible} style={{ height: 40, borderColor: 'var(--accent)' }}
                    onChange={(e) => setCibles({ ...cibles, [cle(i.id)]: Number(e.target.value) })} />
                </label>
              )}
              <div className="progress">
                <div className="fill" style={{ width: Math.min(100, Math.round(pct * 100)) + '%', background: ok ? 'var(--green)' : 'var(--orange)' }} />
                <div className="mark" style={{ left: Math.round(rythme * 100) + '%' }} title="Rythme attendu" />
              </div>
              <span className="small muted">{Math.round(pct * 100)} % de l’objectif</span>
            </section>
          )
        })}
      </div>

      <div className="row" style={{ alignItems: 'stretch', gap: 20 }}>
        <section className="card" style={{ flex: '999 1 520px' }}>
          <div className="card-head">
            <h2>CA signé par mois · {annee}</h2>
            <div className="legend" style={{ fontSize: 12 }}>
              <span><i className="sw" style={{ background: '#e0e7ff', border: '1px solid #a5b4fc', width: 12, height: 12 }} />Objectif</span>
              <span><i className="sw" style={{ background: 'var(--accent)', width: 12, height: 12 }} />Réalisé</span>
            </div>
          </div>
          <div className="bars">
            {moisData.map((m) => (
              <div key={m.nom} title={`${m.nom} : objectif ${euro(m.obj)}, réalisé ${euro(m.real)}`}>
                <div className="bar-obj" style={{ height: Math.round((m.obj / max) * 200) }} />
                <div className="bar-real" style={{ height: Math.round((m.real / max) * 200) }} />
              </div>
            ))}
          </div>
          <div className="bar-labels">{moisData.map((m) => <span key={m.nom}>{m.nom}</span>)}</div>
        </section>

        <section className="card" style={{ flex: '1 1 280px' }}>
          <h2>Transformation</h2>
          <span className="small muted">{labelPeriode}</span>
          {[
            { nom: 'Prospects', v: pros, taux: 'Point de départ' },
            { nom: 'Rendez-vous', v: rdv, taux: pros ? `${Math.round((rdv / pros) * 100)} % des prospects` : '—' },
            { nom: 'Clients signés', v: sig, taux: rdv ? `${Math.round((sig / rdv) * 100)} % des rendez-vous` : '—' },
          ].map((f) => (
            <div key={f.nom} className="stack">
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{f.nom}</span><span>{f.v}</span>
              </div>
              <div style={{ height: 28, borderRadius: 6, background: '#f0ede8', overflow: 'hidden' }}>
                <div style={{ height: 28, borderRadius: 6, background: 'var(--accent)', width: (pros ? Math.round((f.v / pros) * 100) : 0) + '%' }} />
              </div>
              <span className="small muted">{f.taux}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
