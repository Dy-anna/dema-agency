import { useEffect, useState, type FormEvent } from 'react'
import { useLoad } from '../lib/useLoad'
import { chargerParametres, enregistrerParametres } from '../lib/facturation'
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

  const set = (k: keyof ParametresAgence, v: string | number) => setP({ ...p, [k]: v })
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

      <div className="row"><button className="btn primary" type="submit">Enregistrer</button></div>
    </form>
  )
}
