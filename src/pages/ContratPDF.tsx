// Document A4 à faire signer : accord entre l'agence et la personne qui l'accompagne
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useLoad, must } from '../lib/useLoad'
import { chargerParametres } from '../lib/facturation'
import { dateFr, euro, isoDate } from '../lib/format'
import { ACCORDS, TYPES_CONTRAT, duree } from '../lib/contrats'
import type { Contrat } from '../lib/types'

export default function ContratPDF() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, error } = useLoad(async () => ({
    c: must(await db.from('contrats').select('*').eq('id', id!).single()) as Contrat,
    agence: await chargerParametres(),
  }), [id])
  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>
  if (!data) return <p className="muted" style={{ padding: 24 }}>Chargement…</p>
  const { c, agence: a } = data
  const t = TYPES_CONTRAT.find((x) => x.id === c.type)!
  const accords = ACCORDS.filter((x) => c.accords?.[x.id])
  const agenceNom = a.raison_sociale || 'DEMA Agency'
  let n = 0
  const art = () => `Article ${++n}`

  return (
    <div className="doc-wrap">
      <div className="doc-toolbar no-print">
        <button className="btn" type="button" onClick={() => nav(-1)}>← Retour</button>
        <button className="btn primary" type="button" onClick={() => window.print()}>Télécharger en PDF / Imprimer</button>
        <span className="small muted">Modèle simple à adapter. Pour un stage, la convention de l’école reste obligatoire.</span>
      </div>
      <article className="doc">
        <header className="doc-head">
          <div>
            <div className="doc-logo">D</div>
            <strong style={{ fontSize: 16 }}>{agenceNom}</strong>
            {a.forme && <div>{a.forme}</div>}
            {a.adresse && <div>{a.adresse}</div>}
            {a.siret && <div>SIRET : {a.siret}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="doc-title" style={{ fontSize: 20 }}>{t.titreDoc}</div>
            <div>Établi le {dateFr(isoDate(new Date()))}</div>
          </div>
        </header>

        <h3>Entre les soussignés</h3>
        <p><strong>{agenceNom}</strong>{a.adresse ? `, ${a.adresse}` : ''}{a.siret ? `, SIRET ${a.siret}` : ''}, ci-après « l’agence »,</p>
        <p>et <strong>{c.nom}</strong>{c.adresse ? `, demeurant ${c.adresse}` : ''}{c.telephone ? `, tél. ${c.telephone}` : ''}{c.email ? `, ${c.email}` : ''}, ci-après « {c.type === 'formation' ? 'l’apprenant(e)' : c.type === 'stage' ? 'le/la stagiaire' : c.type === 'freelance' ? 'le prestataire' : 'le/la participant(e)'} ».</p>

        <h3>{art()} · Objet</h3>
        <p>
          {c.type === 'formation' && `L’agence accueille ${c.nom} sur ses tournages pour une formation pratique au poste de ${c.poste.toLowerCase()}.`}
          {c.type === 'stage' && `L’agence accueille ${c.nom} en stage au poste de ${c.poste.toLowerCase()}, dans le cadre de la convention de stage signée avec son établissement, qui prévaut sur le présent accord.`}
          {c.type === 'freelance' && `L’agence confie à ${c.nom}, prestataire indépendant, des missions de ${c.poste.toLowerCase()}.`}
          {c.type === 'benevole' && `${c.nom} participe ponctuellement et bénévolement à des tournages de l’agence, au poste de ${c.poste.toLowerCase()}, sans lien de subordination.`}
        </p>
        {c.missions && <p><strong>{c.type === 'formation' || c.type === 'stage' ? 'Apprentissages et missions' : 'Missions'} :</strong> {c.missions}</p>}

        <h3>{art()} · Durée</h3>
        <p>
          Le présent accord prend effet le {c.date_debut ? dateFr(c.date_debut) : '……………'}
          {c.date_fin ? ` et se termine le ${dateFr(c.date_fin)} (${duree(c.date_debut, c.date_fin)})` : ', pour une durée indéterminée, chaque partie pouvant y mettre fin par simple écrit'}.
          {c.rythme && ` Rythme prévu : ${c.rythme}.`}
        </p>

        <h3>{art()} · {c.remuneration === 'aucune' ? 'Contrepartie' : 'Rémunération'}</h3>
        <p>
          {c.remuneration === 'aucune' && 'Cette participation ne donne lieu à aucune rémunération.'}
          {c.remuneration === 'defraiement' && `L’agence prend en charge les frais engagés (transport, repas) dans la limite de ${euro(c.montant)} par jour de tournage, sur justificatifs.`}
          {c.remuneration === 'forfait' && `Un forfait de ${euro(c.montant)} est prévu pour la période${c.type === 'freelance' ? ', payable sur facture du prestataire' : ''}.`}
          {c.remuneration === 'jour' && `Un montant de ${euro(c.montant)} par jour de tournage est prévu${c.type === 'freelance' ? ', payable sur facture du prestataire' : ''}.`}
        </p>

        {(accords.length > 0 || c.accords?.autres) && (
          <>
            <h3>{art()} · Engagements</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {accords.map((x) => <li key={x.id} style={{ marginBottom: 4 }}><strong>{x.nom} :</strong> {c.nom} {x.texte}</li>)}
              {c.accords?.autres && <li><strong>Autre :</strong> {c.accords.autres}</li>}
            </ul>
          </>
        )}

        <h3>{art()} · Fin de l’accord</h3>
        <p>Chaque partie peut mettre fin au présent accord par écrit (message ou e-mail), en respectant les dates de tournage déjà confirmées.</p>

        <div style={{ display: 'flex', gap: 24, marginTop: 28 }}>
          <div className="doc-signature" style={{ flex: 1, marginTop: 0 }}>
            <strong>Pour l’agence</strong>
            <span className="small">Date et signature</span>
            <div className="doc-sign-box" style={{ width: '100%' }} />
          </div>
          <div className="doc-signature" style={{ flex: 1, marginTop: 0 }}>
            <strong>{c.nom}</strong>
            <span className="small">Date et signature, précédées de « Lu et approuvé »</span>
            <div className="doc-sign-box" style={{ width: '100%' }} />
          </div>
        </div>
      </article>
    </div>
  )
}
