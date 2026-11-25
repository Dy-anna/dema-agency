// Notifications : alertes calculées depuis les données (cloche dans l'app)
// et envoi push sur téléphone (Web Push / VAPID), le matin et le soir.
import { b64u, requetePush } from '../_lib/webpush'
import { fail, getUser, json, type Env, type User } from '../_lib/auth'

export interface Alerte {
  cle: string
  niveau: 'urgent' | 'important' | 'info'
  categorie: 'tournage' | 'finance' | 'commercial' | 'equipe' | 'contrat' | 'fiche' | 'tache' | 'chasse'
  titre: string
  texte: string
  lien: string
  date: string | null
  push: boolean
}

// ───────── Dates (fuseau Paris) ─────────
export const jourParis = (d = new Date()) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const plus = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
const ecart = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const dateCourte = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}` }
const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const quand = (today: string, date: string) => {
  const n = ecart(today, date)
  return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : n < 7 ? `dans ${n} jours (${dateCourte(date)})` : dateCourte(date)
}

type Row = Record<string, unknown>
const all = async <T = Row>(env: Env, sql: string, ...b: unknown[]) => (await env.DB.prepare(sql).bind(...b).all<T>()).results ?? []

// ───────── Calcul des alertes pour un utilisateur ─────────
export async function calculerAlertes(env: Env, user: User, today = jourParis()): Promise<Alerte[]> {
  const gerant = user.role === 'gerant'
  const encadrant = gerant || user.role === 'chef_projet'
  const out: Alerte[] = []
  const j14 = plus(today, 14), j30 = plus(today, 30)

  const evts = await all<{ id: string; titre: string; date: string; statut: string; client_id: string | null; projet_id: string | null }>(
    env, `SELECT id, titre, date, statut, client_id, projet_id FROM evenements WHERE statut != 'annule' AND date BETWEEN ? AND ? ORDER BY date`, today, j30)
  const affs = await all<{ id: string; evenement_id: string; profile_id: string | null; nom_libre: string | null; poste: string; horaires: string | null }>(
    env, `SELECT a.id, a.evenement_id, a.profile_id, a.nom_libre, a.poste, a.horaires FROM affectations a JOIN evenements e ON e.id = a.evenement_id WHERE e.date BETWEEN ? AND ?`, today, j30)
  const affDe = (id: string) => affs.filter((a) => a.evenement_id === id)

  // 1. Tournages aujourd'hui / demain
  for (const e of evts.filter((x) => x.date <= plus(today, 1))) {
    const miens = affDe(e.id).filter((a) => a.profile_id === user.id)
    if (!gerant && miens.length === 0) continue
    const n = ecart(today, e.date)
    const equipe = affDe(e.id).length
    const moi = miens[0]
    out.push({
      cle: `tournage:${e.id}:${n === 0 ? 'jour' : 'veille'}`, niveau: 'urgent', categorie: 'tournage',
      titre: `${n === 0 ? 'Tournage aujourd’hui' : 'Tournage demain'} · ${e.titre}`,
      texte: moi ? `Tu es ${moi.poste.toLowerCase()}${moi.horaires ? ` · ${moi.horaires}` : ''}. Pense à la feuille de route.`
        : `${e.statut === 'confirme' ? 'Confirmé' : 'Encore prévisionnel !'} · ${equipe ? `${equipe} personne${equipe > 1 ? 's' : ''} dans l’équipe` : 'aucune équipe affectée'}`,
      lien: e.client_id ? `/clients/${e.client_id}` : '/calendrier', date: e.date, push: true,
    })
  }

  // Les tournages d'aujourd'hui/demain ont déjà leur alerte (qui mentionne équipe et confirmation)
  const imminent = (e: { date: string }) => e.date <= plus(today, 1)

  if (encadrant) {
    // 2. Dates sans équipe dans les 14 jours
    for (const e of evts.filter((x) => x.date <= j14 && !imminent(x) && affDe(x.id).length === 0)) {
      out.push({
        cle: `equipe:${e.id}`, niveau: ecart(today, e.date) <= 3 ? 'urgent' : 'important', categorie: 'equipe',
        titre: `Personne d’affecté · ${e.titre}`, texte: `Tournage ${quand(today, e.date)} : choisis l’équipe dans le planning.`,
        lien: '/planning', date: e.date, push: true,
      })
    }
    // 3. Fiches sans coordonnées avec une date dans les 30 jours
    const fiches = await all<{ id: string; nom: string; date: string }>(env,
      `SELECT c.id, c.nom, MIN(e.date) AS date FROM clients c JOIN evenements e ON e.client_id = c.id
       WHERE e.statut != 'annule' AND e.date BETWEEN ? AND ? AND COALESCE(TRIM(c.email),'') = '' AND COALESCE(TRIM(c.telephone),'') = ''
       GROUP BY c.id`, today, j30)
    for (const f of fiches) {
      out.push({
        cle: `fiche:${f.id}`, niveau: 'info', categorie: 'fiche', titre: `Coordonnées à compléter · ${f.nom}`,
        texte: `Ni téléphone ni e-mail, et la date approche (${dateCourte(f.date)}).`, lien: `/clients/${f.id}`, date: f.date, push: false,
      })
    }
  }

  if (gerant) {
    // 4. Dates encore prévisionnelles dans les 14 jours
    for (const e of evts.filter((x) => x.statut === 'previsionnel' && x.date <= j14 && !imminent(x))) {
      out.push({
        cle: `previsionnel:${e.id}`, niveau: ecart(today, e.date) <= 3 ? 'urgent' : 'important', categorie: 'commercial',
        titre: `À confirmer · ${e.titre}`, texte: `La date est ${quand(today, e.date)} et elle n’est pas encore confirmée.`,
        lien: e.client_id ? `/clients/${e.client_id}` : '/calendrier', date: e.date, push: true,
      })
    }
    // 5. Impayés et échéances proches
    const paiements = await all<{ id: string; libelle: string; montant: number; echeance: string; projet_id: string; titre: string }>(env,
      `SELECT p.id, p.libelle, p.montant, p.echeance, p.projet_id, pr.titre FROM paiements p JOIN projets pr ON pr.id = p.projet_id
       WHERE p.recu = 0 AND p.echeance IS NOT NULL AND p.echeance <= ? ORDER BY p.echeance`, plus(today, 3))
    for (const p of paiements) {
      const retard = ecart(p.echeance, today)
      out.push(retard > 0
        ? { cle: `impaye:${p.id}`, niveau: 'urgent', categorie: 'finance', titre: `Impayé · ${p.titre} · ${euro(p.montant)}`,
            texte: `${p.libelle} attendu depuis ${retard} jour${retard > 1 ? 's' : ''} (${dateCourte(p.echeance)}). Relance le client.`,
            lien: `/projets/${p.projet_id}`, date: p.echeance, push: true }
        : { cle: `echeance:${p.id}`, niveau: 'important', categorie: 'finance', titre: `Paiement attendu ${quand(today, p.echeance)} · ${euro(p.montant)}`,
            texte: `${p.libelle} · ${p.titre}`, lien: `/projets/${p.projet_id}`, date: p.echeance, push: true })
    }
    // 6. Devis à relancer (envoyés depuis 5 jours ou plus)
    const devis = await all<{ id: string; montant: number; date_envoi: string; nom: string }>(env,
      `SELECT d.id, d.montant, d.date_envoi, c.nom FROM devis d JOIN clients c ON c.id = d.client_id
       WHERE d.statut IN ('envoye','negociation') AND d.date_envoi IS NOT NULL AND substr(d.date_envoi,1,10) <= ?`, plus(today, -5))
    for (const d of devis) {
      const n = ecart(d.date_envoi.slice(0, 10), today)
      out.push({
        cle: `relance:${d.id}`, niveau: 'important', categorie: 'commercial', titre: `Relance · ${d.nom} · ${euro(d.montant)}`,
        texte: `Devis envoyé il y a ${n} jours, sans réponse.`, lien: `/devis/${d.id}`, date: null, push: true,
      })
    }
    // 7. Contrats : personnes au planning sans contrat signé, contrats qui se terminent
    const contrats = await all<{ id: string; nom: string; profile_id: string | null; statut: string; date_debut: string | null; date_fin: string | null }>(env,
      `SELECT id, nom, profile_id, statut, date_debut, date_fin FROM contrats WHERE statut != 'annule'`)
    const profils = await all<{ id: string; nom: string; role: string }>(env, `SELECT id, nom, role FROM profiles`)
    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
    const vus = new Set<string>()
    for (const a of affs) {
      const e = evts.find((x) => x.id === a.evenement_id)
      if (!e || e.date > j14) continue
      const p = a.profile_id ? profils.find((x) => x.id === a.profile_id) : null
      if (p?.role === 'gerant') continue
      const nom = p?.nom ?? a.nom_libre ?? ''
      if (!nom) continue
      const ok = contrats.some((c) => c.statut === 'signe' && ((a.profile_id && c.profile_id === a.profile_id) || norm(c.nom) === norm(nom))
        && (!c.date_debut || c.date_debut <= e.date) && (!c.date_fin || c.date_fin >= e.date))
      const k = (a.profile_id ?? norm(nom))
      if (ok || vus.has(k)) continue
      vus.add(k)
      const existant = contrats.find((c) => (a.profile_id && c.profile_id === a.profile_id) || norm(c.nom) === norm(nom))
      out.push({
        cle: `contrat-manquant:${k}:${e.id}`, niveau: ecart(today, e.date) <= 3 ? 'urgent' : 'important', categorie: 'contrat',
        titre: `Contrat à faire signer · ${nom}`, texte: `${nom} tourne ${quand(today, e.date)} (${e.titre}) sans contrat signé.`,
        lien: existant ? `/contrats/${existant.id}` : `/contrats/nouveau?nom=${encodeURIComponent(nom)}`, date: e.date, push: true,
      })
    }
    for (const c of contrats.filter((x) => x.statut === 'signe' && x.date_fin && x.date_fin >= today && x.date_fin <= plus(today, 7))) {
      out.push({
        cle: `contrat-fin:${c.id}`, niveau: 'info', categorie: 'contrat', titre: `Fin de contrat · ${c.nom}`,
        texte: `Se termine ${quand(today, c.date_fin!)}. À prolonger ou clôturer.`, lien: `/contrats/${c.id}`, date: c.date_fin, push: true,
      })
    }
  }

  // 8. Mes tâches (projets dont la date approche)
  const taches = await all<{ n: number; projet_id: string; titre: string; date: string | null }>(env,
    `SELECT COUNT(*) AS n, t.projet_id, p.titre, p.date_evenement AS date FROM taches t JOIN projets p ON p.id = t.projet_id
     WHERE t.fait = 0 AND t.assigne_a = ? AND p.statut != 'livre' GROUP BY t.projet_id`, user.id)
  const tachesDues = await all<{ id: string; titre: string; echeance: string; projet_id: string; projet: string }>(env,
    `SELECT t.id, t.titre, t.echeance, t.projet_id, p.titre AS projet FROM taches t JOIN projets p ON p.id = t.projet_id
     WHERE t.fait = 0 AND t.assigne_a = ? AND t.echeance IS NOT NULL AND t.echeance <= ? ORDER BY t.echeance`, user.id, plus(today, 1))
  for (const t of tachesDues) {
    const n = ecart(today, t.echeance)
    out.push({
      cle: `tache-due:${t.id}:${n < 0 ? 'retard' : n === 0 ? 'jour' : 'veille'}`, niveau: n <= 0 ? 'urgent' : 'important', categorie: 'tache',
      titre: `${n < 0 ? 'Tâche en retard' : n === 0 ? 'Tâche pour aujourd’hui' : 'Tâche pour demain'} · ${t.titre}`,
      texte: `${t.projet}${n < 0 ? ` · prévue ${dateCourte(t.echeance)}` : ''}`, lien: `/projets/${t.projet_id}`, date: t.echeance, push: true,
    })
  }
  for (const t of taches) {
    out.push({
      cle: `taches:${t.projet_id}:${t.n}`, niveau: 'info', categorie: 'tache', titre: `${t.n} tâche${t.n > 1 ? 's' : ''} à faire · ${t.titre}`,
      texte: t.date ? `Projet du ${dateCourte(t.date)}` : 'Projet en cours', lien: `/projets/${t.projet_id}`, date: t.date, push: false,
    })
  }

  // 9. Chasseur de têtes : actions du jour et en retard (pour qui s'en charge)
  const chasse = await all<{ id: string; titre: string; echeance: string; cible_id: string; nom: string; priorite: string }>(env,
    `SELECT a.id, a.titre, a.echeance, a.cible_id, c.nom, c.priorite FROM cible_actions a JOIN cibles c ON c.id = a.cible_id
     WHERE a.fait = 0 AND a.echeance IS NOT NULL AND a.echeance <= ? AND c.statut NOT IN ('converti','pas_interesse')
       AND (COALESCE(a.assigne_a, c.responsable_id) = ? OR (COALESCE(a.assigne_a, c.responsable_id) IS NULL AND ? = 1))
     ORDER BY a.echeance`, today, user.id, gerant ? 1 : 0)
  for (const a of chasse) {
    const retard = ecart(a.echeance, today)
    out.push({
      cle: `chasse:${a.id}:${retard > 0 ? 'retard' : 'jour'}`, niveau: retard > 0 ? 'important' : 'info', categorie: 'chasse',
      titre: `${retard > 0 ? 'Action en retard' : 'À faire aujourd’hui'} · ${a.nom}${a.priorite === 'A' ? ' (A)' : ''}`,
      texte: a.titre + (retard > 0 ? ` · prévue ${dateCourte(a.echeance)}` : ''), lien: `/chasse/${a.cible_id}`, date: a.echeance, push: true,
    })
  }

  // 10. Changements du calendrier faits par les autres (3 derniers jours)
  const journal = await all<{ id: string; type: string; titre: string; texte: string; lien: string; created_at: string; date: string | null }>(env,
    `SELECT j.id, j.type, j.titre, j.texte, j.lien, j.created_at, e.date FROM journal j LEFT JOIN evenements e ON e.id = j.evenement_id
     WHERE j.created_at >= ? AND COALESCE(j.auteur_id, '') != ? AND (j.destinataire_id IS NULL OR j.destinataire_id = ?)
       AND NOT (j.type = 'attribution' AND EXISTS (SELECT 1 FROM taches t WHERE t.id = j.evenement_id AND t.fait = 1))
     ORDER BY j.created_at DESC LIMIT 30`,
    new Date(Date.now() - 7 * 86400000).toISOString(), user.id, user.id)
  for (const j of journal) {
    out.push({
      cle: `journal:${j.id}`, niveau: j.type === 'attribution' ? 'important' : j.type === 'annule' || j.type === 'deplace' || j.type === 'supprime' ? 'important' : 'info',
      categorie: j.type === 'attribution' ? 'tache' : 'tournage', titre: j.titre, texte: j.texte, lien: j.lien, date: j.date, push: false,
    })
  }

  const rang = { urgent: 0, important: 1, info: 2 }
  return out.sort((a, b) => rang[a.niveau] - rang[b.niveau] || (a.date ?? '9999').localeCompare(b.date ?? '9999'))
}

// ───────── Clés VAPID (créées une fois, gardées en base, jamais exposées) ─────────
async function clesVapid(env: Env) {
  const row = await env.DB.prepare(`SELECT publique, privee FROM push_cles WHERE id = 'vapid'`).first<{ publique: string; privee: string }>()
  if (row) return { publique: row.publique, privee: JSON.parse(row.privee) as JsonWebKey }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const publique = b64u(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer)
  const privee = await crypto.subtle.exportKey('jwk', kp.privateKey) as JsonWebKey
  await env.DB.prepare(`INSERT OR IGNORE INTO push_cles (id, publique, privee) VALUES ('vapid', ?, ?)`).bind(publique, JSON.stringify(privee)).run()
  return clesVapid(env)
}

interface Abonnement { endpoint: string; user_id: string; p256dh: string; auth: string }
type MessagePush = { title: string; body: string; url: string; tag?: string }

async function envoyer(env: Env, ab: Abonnement, msg: MessagePush) {
  const { publique, privee } = await clesVapid(env)
  try {
    const topic = msg.tag?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined
    const { url, init } = await requetePush(ab, msg, { publique, privee, contact: 'mailto:m.desirbitoukou@gmail.com' }, { ttl: 43200, urgency: 'high', topic })
    const res = await fetch(url, init)
    if (!res.ok) console.error('push refusé', res.status, await res.text().catch(() => ''))
    if (res.status === 404 || res.status === 410) {
      await env.DB.prepare('DELETE FROM push_abonnements WHERE endpoint = ?').bind(ab.endpoint).run()
      return false
    }
    return res.ok
  } catch (e) {
    console.error('push', e)
    return false
  }
}

/** Envoi programmé : nouvelles alertes de chaque utilisateur abonné (une seule fois par alerte) */
export async function envoyerAlertesPush(env: Env) {
  const users = await all<User>(env,
    `SELECT DISTINCT p.id, p.email, p.nom, p.role FROM profiles p JOIN push_abonnements a ON a.user_id = p.id WHERE p.actif = 1`)
  for (const u of users) {
    const deja = new Set((await all<{ cle: string }>(env, 'SELECT cle FROM push_envoyes WHERE user_id = ?', u.id)).map((r) => r.cle))
    const nouvelles = (await calculerAlertes(env, u)).filter((a) => a.push && !deja.has(a.cle))
    if (!nouvelles.length) continue
    const msgs: MessagePush[] = nouvelles.length <= 3
      ? nouvelles.map((a) => ({ title: a.titre, body: a.texte, url: a.lien, tag: a.cle }))
      : [{ title: `DEMA · ${nouvelles.length} alertes`, body: nouvelles.slice(0, 4).map((a) => '• ' + a.titre).join('\n'), url: '/?notifications=1', tag: 'resume' }]
    const abos = await all<Abonnement>(env, 'SELECT * FROM push_abonnements WHERE user_id = ?', u.id)
    for (const ab of abos) for (const m of msgs) await envoyer(env, ab, m)
    await env.DB.batch(nouvelles.map((a) => env.DB.prepare('INSERT OR IGNORE INTO push_envoyes (user_id, cle) VALUES (?, ?)').bind(u.id, a.cle)))
  }
  await env.DB.prepare(`DELETE FROM push_envoyes WHERE envoye_le < ?`).bind(new Date(Date.now() - 90 * 86400000).toISOString()).run()
}

// ───────── Notification immédiate des changements du calendrier ─────────
export interface EvtNotif { id: string; titre: string; date: string; statut: string; type_prestation: string; client_id: string | null }
export interface ChangementCalendrier { type: 'ajout' | 'confirme' | 'annule' | 'retabli' | 'deplace' | 'supprime'; evt: EvtNotif; ancienneDate?: string }

const TYPES: Record<string, string> = { mariage: 'Mariage', evenementiel: 'Événementiel', corporate: 'Événement corporate', shooting: 'Shooting', autre: 'Autre' }
const STATUTS: Record<string, string> = { previsionnel: 'prévisionnel', confirme: 'confirmé', annule: 'annulé' }

export async function notifierCalendrier(env: Env, auteur: User, changements: ChangementCalendrier[]) {
  const prenom = auteur.nom?.split(' ')[0] || auteur.email
  const entrees = changements.slice(0, 10).map((c) => {
    const e = c.evt
    const quandTxt = dateCourte(e.date)
    const intro = { ajout: '📅 Nouvelle date', confirme: '✅ Date confirmée', annule: '❌ Date annulée', retabli: '↩️ Date rétablie', deplace: '🔁 Date déplacée', supprime: '🗑️ Date supprimée' }[c.type]
    const detail = c.type === 'deplace' && c.ancienneDate ? `${dateCourte(c.ancienneDate)} → ${quandTxt}` : quandTxt
    return {
      id: crypto.randomUUID(), type: c.type, evenement_id: c.type === 'supprime' ? null : e.id,
      titre: `${intro} · ${e.titre}`,
      texte: `${detail} · ${TYPES[e.type_prestation] ?? e.type_prestation}${c.type === 'ajout' ? ` · ${STATUTS[e.statut] ?? e.statut}` : ''} — par ${prenom}`,
      lien: e.client_id && c.type !== 'supprime' ? `/clients/${e.client_id}` : '/calendrier',
    }
  })
  if (!entrees.length) return
  await env.DB.batch(entrees.map((j) => env.DB.prepare(
    'INSERT INTO journal (id, type, evenement_id, auteur_id, auteur_nom, titre, texte, lien) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(j.id, j.type, j.evenement_id, auteur.id, auteur.nom, j.titre, j.texte, j.lien)))

  // Push tout de suite à toute l'équipe abonnée, sauf l'auteur
  const abos = await all<Abonnement & { user_id: string }>(env,
    `SELECT a.* FROM push_abonnements a JOIN profiles p ON p.id = a.user_id WHERE p.actif = 1 AND a.user_id != ?`, auteur.id)
  const msgs: MessagePush[] = entrees.length <= 3
    ? entrees.map((j) => ({ title: j.titre, body: j.texte, url: j.lien, tag: 'cal' + j.id.slice(0, 8) }))
    : [{ title: `📅 ${entrees.length} changements au calendrier`, body: entrees.slice(0, 4).map((j) => '• ' + j.titre.replace(/^\S+ /, '')).join('\n'), url: '/calendrier', tag: 'calendrier' }]
  for (const ab of abos) for (const m of msgs) await envoyer(env, ab, m)
  const users = [...new Set(abos.map((a) => a.user_id))]
  if (users.length) await env.DB.batch(users.flatMap((u) => entrees.map((j) => env.DB.prepare('INSERT OR IGNORE INTO push_envoyes (user_id, cle) VALUES (?, ?)').bind(u, `journal:${j.id}`))))
  await env.DB.prepare('DELETE FROM journal WHERE created_at < ?').bind(new Date(Date.now() - 60 * 86400000).toISOString()).run()
}

// ───────── Tâche attribuée : notification personnelle immédiate ─────────
export interface Attribution { table: 'taches' | 'cible_actions'; id: string; assigne_a: string }

export async function notifierAttributions(env: Env, auteur: User, liste: Attribution[]) {
  const prenom = auteur.nom?.split(' ')[0] || auteur.email
  const entrees: { id: string; ref: string; dest: string; titre: string; texte: string; lien: string }[] = []
  for (const a of liste.slice(0, 30)) {
    if (a.assigne_a === auteur.id) continue
    if (a.table === 'taches') {
      const t = await env.DB.prepare(`SELECT t.titre, t.echeance, t.projet_id, p.titre AS projet, p.date_evenement AS date FROM taches t JOIN projets p ON p.id = t.projet_id WHERE t.id = ?`)
        .bind(a.id).first<{ titre: string; echeance: string | null; projet_id: string; projet: string; date: string | null }>()
      if (!t) continue
      entrees.push({ id: crypto.randomUUID(), ref: a.id, dest: a.assigne_a, titre: `📋 Nouvelle tâche pour toi · ${t.titre}`,
        texte: `${t.projet}${t.date ? ` (${dateCourte(t.date)})` : ''}${t.echeance ? ` · à faire pour ${dateCourte(t.echeance)}` : ''} — de ${prenom}`, lien: `/projets/${t.projet_id}` })
    } else {
      const t = await env.DB.prepare(`SELECT a.titre, a.echeance, a.cible_id, c.nom FROM cible_actions a JOIN cibles c ON c.id = a.cible_id WHERE a.id = ?`)
        .bind(a.id).first<{ titre: string; echeance: string | null; cible_id: string; nom: string }>()
      if (!t) continue
      entrees.push({ id: crypto.randomUUID(), ref: a.id, dest: a.assigne_a, titre: `🎯 Action de prospection pour toi · ${t.nom}`,
        texte: `${t.titre}${t.echeance ? ` · pour ${dateCourte(t.echeance)}` : ''} — de ${prenom}`, lien: `/chasse/${t.cible_id}` })
    }
  }
  if (!entrees.length) return
  await env.DB.batch(entrees.map((j) => env.DB.prepare(
    `INSERT INTO journal (id, type, evenement_id, auteur_id, auteur_nom, titre, texte, lien, destinataire_id) VALUES (?, 'attribution', ?, ?, ?, ?, ?, ?, ?)`)
    .bind(j.id, j.ref, auteur.id, auteur.nom, j.titre, j.texte, j.lien, j.dest)))
  for (const dest of [...new Set(entrees.map((e) => e.dest))]) {
    const siennes = entrees.filter((e) => e.dest === dest)
    const abos = await all<Abonnement>(env, 'SELECT * FROM push_abonnements WHERE user_id = ?', dest)
    const msgs: MessagePush[] = siennes.length <= 2
      ? siennes.map((j) => ({ title: j.titre, body: j.texte, url: j.lien, tag: 'tache' + j.id.slice(0, 8) }))
      : [{ title: `📋 ${siennes.length} nouvelles tâches pour toi`, body: siennes.slice(0, 4).map((j) => '• ' + j.titre.split(' · ').slice(1).join(' · ')).join('\n') + `\n— de ${prenom}`, url: siennes[0].lien, tag: 'taches' }]
    for (const ab of abos) for (const m of msgs) await envoyer(env, ab, m)
    if (abos.length) await env.DB.batch(siennes.map((j) => env.DB.prepare('INSERT OR IGNORE INTO push_envoyes (user_id, cle) VALUES (?, ?)').bind(dest, `journal:${j.id}`)))
  }
}

// ───────── API /api/notifications/* ─────────
export async function handleNotifications(request: Request, env: Env, action: string) {
  const user = await getUser(env, request)
  if (!user) return fail('Non connecté', 401)

  if (action === '' && request.method === 'GET') {
    const alertes = await calculerAlertes(env, user)
    const lues = new Set((await all<{ cle: string }>(env, 'SELECT cle FROM notifications_lues WHERE user_id = ?', user.id)).map((r) => r.cle))
    const liste = alertes.map((a) => ({ ...a, lu: lues.has(a.cle) }))
    const abonne = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_abonnements WHERE user_id = ?').bind(user.id).first<{ n: number }>()
    return json({ alertes: liste, nonLues: liste.filter((a) => !a.lu).length, appareils: abonne?.n ?? 0 })
  }

  const body = request.method === 'POST' ? await request.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>)) : {}

  if (action === 'lu' && request.method === 'POST') {
    let cles = Array.isArray(body.cles) ? body.cles.map(String) : []
    if (body.tout) cles = (await calculerAlertes(env, user)).map((a) => a.cle)
    if (cles.length) await env.DB.batch(cles.slice(0, 200).map((c) => env.DB.prepare('INSERT OR IGNORE INTO notifications_lues (user_id, cle) VALUES (?, ?)').bind(user.id, c)))
    await env.DB.prepare(`DELETE FROM notifications_lues WHERE lu_le < ?`).bind(new Date(Date.now() - 120 * 86400000).toISOString()).run()
    return json({ ok: true })
  }

  if (action === 'cle' && request.method === 'GET') return json({ cle: (await clesVapid(env)).publique })

  if (action === 'abonner' && request.method === 'POST') {
    const s = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
    if (!s?.endpoint?.startsWith('https://') || !s.keys?.p256dh || !s.keys?.auth) return fail('Abonnement invalide')
    await env.DB.prepare(`INSERT INTO push_abonnements (endpoint, user_id, p256dh, auth, appareil) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil`)
      .bind(s.endpoint, user.id, s.keys.p256dh, s.keys.auth, String(body.appareil ?? '').slice(0, 120)).run()
    // Les alertes déjà présentes ne seront pas renvoyées d'un coup : on part de maintenant
    const actuelles = (await calculerAlertes(env, user)).filter((a) => a.push)
    if (actuelles.length) await env.DB.batch(actuelles.map((a) => env.DB.prepare('INSERT OR IGNORE INTO push_envoyes (user_id, cle) VALUES (?, ?)').bind(user.id, a.cle)))
    return json({ ok: true })
  }

  if (action === 'desabonner' && request.method === 'POST') {
    await env.DB.prepare('DELETE FROM push_abonnements WHERE endpoint = ? AND user_id = ?').bind(String(body.endpoint ?? ''), user.id).run()
    return json({ ok: true })
  }

  if (action === 'test' && request.method === 'POST') {
    const abos = await all<Abonnement>(env, 'SELECT * FROM push_abonnements WHERE user_id = ?', user.id)
    if (!abos.length) return fail('Aucun appareil abonné. Active d’abord les notifications sur ce téléphone.')
    const alertes = (await calculerAlertes(env, user)).filter((a) => a.niveau !== 'info')
    const msg: MessagePush = {
      title: 'DEMA Agency · notifications activées ✅',
      body: alertes.length ? `${alertes.length} alerte${alertes.length > 1 ? 's' : ''} en cours, dont : ${alertes[0].titre}` : 'Tu recevras ici les tournages, impayés, relances et contrats à signer.',
      url: '/?notifications=1', tag: 'test',
    }
    let ok = 0
    for (const ab of abos) if (await envoyer(env, ab, msg)) ok++
    return ok ? json({ ok: true, envoyes: ok }) : fail('L’envoi a échoué. Désactive puis réactive les notifications sur ce téléphone.', 502)
  }

  return fail('Introuvable', 404)
}
