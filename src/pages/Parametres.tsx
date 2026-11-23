import { useEffect, useState, type FormEvent } from 'react'
import { useLoad } from '../lib/useLoad'
import { chargerParametres, enregistrerParametres } from '../lib/facturation'
import { REGIMES, tauxCharges } from '../lib/fiscalite'
import type { ParametresAgence } from '../lib/types'

const CHAMPS: { k: keyof ParametresAgence; label: string; ph?: string; type?: string }[] = [
  { k: 'raison_sociale', label: 'Nom de l’entreprise', ph: 'DEMA Agency' },
  { k: 'forme', label: 'Forme juridique', ph: 'Micro-entreprise, SAS…' },
  { k: 'adresse', label: 'Adresse', ph: 'N°, rue, code postal, ville' },
  { k: 'siret', label: 'SIRET', ph: '14 chiffres' },
  { k: 'tva_intra', label: 'N° TVA intracommunautaire', ph: 'Si assujetti' },
  { k: 'email', label: 'E-mail', type: 'email' },
  { k: 'telephone', label: 'Téléphone', type: 'tel' },
  { k: 'iban', label: 'IBAN (affiché sur les factures)' },
  { k: 'bic', label: 'BIC' },
]

export default function Parametres() {
  const { data } = useLoad(chargerParametres)
  const [p, setP] = useState<ParametresAgence | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (data) setP(data) }, [data])
  if (!p) return <p className="muted">Chargement…</p>

  const set = (k: keyof ParametresAgence, v: string | number | boolean) => setP({ ...p, [k]: v })
  const choisirRegime = (k: string) => { const r = REGIMES[k]; setP({ ...p, regime_social: k, ...(k !== 'autre' ? { taux_urssaf: r.taux, cfp_taux: r.cfp, taux_vl: r.vl } : {}) }) }
  const t = tauxCharges(p)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try { await enregistrerParametres(p); setMsg('Paramètres enregistrés. Ils s’appliquent aux prochains devis et factures.') }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Erreur') }
  }
  const manquants = (['raison_sociale', 'adresse', 'siret'] as const).filter((k) => !p[k])

  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <div className="stack">
        <span className="eyebrow">Pilotage · gérants uniquement</span>
        <h1>Paramètres de l’agence</h1>
      </div>
      {manquants.length > 0 && (
        <div className="banner amber"><span>À compléter pour des factures conformes : <strong>{manquants.map((k) => CHAMPS.find((c) => c.k === k)?.label).join(', ')}</strong>.</span></div>
      )}
      {msg && <div className="banner amber" role="status"><span>{msg}</span></div>}

      <section className="card">
        <h2>Identité (en-tête des devis et factures)</h2>
        <div className="form-grid">
          {CHAMPS.map((c) => (
            <label key={c.k} className="field">{c.label}
              <input type={c.type ?? 'text'} placeholder={c.ph} value={String(p[c.k] ?? '')} onChange={(e) => set(c.k, e.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Facturation</h2>
        <div className="form-grid">
          <label className="field">Taux de TVA (%)
            <input type="number" min="0" step="0.1" value={p.tva_taux ?? 0} onChange={(e) => set('tva_taux', Number(e.target.value))} />
          </label>
          <label className="field">Mention TVA (si 0 %)
            <input value={p.mention_tva ?? ''} onChange={(e) => set('mention_tva', e.target.value)} />
          </label>
          <label className="field">Acompte par défaut (%)
            <input type="number" min="0" max="100" value={p.acompte_pct ?? 30} onChange={(e) => set('acompte_pct', Number(e.target.value))} />
          </label>
          <label className="field">Validité des devis (jours)
            <input type="number" min="1" value={p.validite_devis_jours ?? 30} onChange={(e) => set('validite_devis_jours', Number(e.target.value))} />
          </label>
        </div>
        <label className="field">Conditions (affichées en bas des devis et factures)
          <textarea value={p.conditions ?? ''} onChange={(e) => set('conditions', e.target.value)} />
        </label>
        <span className="small muted">Je ne suis pas juriste : fais valider ces mentions par ton comptable.</span>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Fiscalité · URSSAF</h2>
          <span className="badge indigo">Total prélevé : {String(t.total).replace('.', ',')} % du CA encaissé</span>
        </div>
        <label className="field">Régime (micro-entrepreneur)
          <select value={p.regime_social ?? 'bnc'} onChange={(e) => choisirRegime(e.target.value)}>
            {Object.entries(REGIMES).map(([k, r]) => <option key={k} value={k}>{r.nom}{r.taux ? ` — ${String(r.taux).replace('.', ',')} %` : ''}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">Cotisations sociales (%)
            <input type="number" min="0" step="0.1" value={p.taux_urssaf ?? 0} onChange={(e) => set('taux_urssaf', Number(e.target.value))} />
          </label>
          <label className="field">Formation professionnelle CFP (%)
            <input type="number" min="0" step="0.1" value={p.cfp_taux ?? 0} onChange={(e) => set('cfp_taux', Number(e.target.value))} />
          </label>
          <label className="field">Déclaration URSSAF
            <select value={p.declaration ?? 'trimestrielle'} onChange={(e) => set('declaration', e.target.value)}>
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
            </select>
          </label>
        </div>
        <label className="row" style={{ gap: 10, fontSize: 14 }}>
          <input type="checkbox" checked={!!p.acre} onChange={(e) => set('acre', e.target.checked)} style={{ width: 18, height: 18 }} />
          ACRE (cotisations sociales réduites de moitié la première année)
        </label>
        <label className="row" style={{ gap: 10, fontSize: 14 }}>
          <input type="checkbox" checked={!!p.versement_liberatoire} onChange={(e) => set('versement_liberatoire', e.target.checked)} style={{ width: 18, height: 18 }} />
          Versement libératoire de l’impôt ({String(p.taux_vl ?? 0).replace('.', ',')} %)
        </label>
        <span className="small muted">Taux 2026 pré-remplis selon le régime. Vérifie le tien dans ton espace autoentrepreneur.urssaf.fr : pour la vidéo / photo, ça dépend de ton code d’activité (BNC ou BIC).</span>
      </section>

      <div className="row"><button className="btn primary" type="submit">Enregistrer</button></div>
    </form>
  )
}
