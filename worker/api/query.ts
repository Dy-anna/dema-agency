// API de données générique et sécurisée : tables et colonnes en liste blanche,
// requêtes paramétrées, droits par rôle (finance réservée aux gérants).
import { fail, getUser, json, type Env, type User } from '../_lib/auth'

type ColType = 'text' | 'num' | 'bool' | 'json'
interface TableDef { cols: Record<string, ColType>; gerantOnly?: boolean; readOnly?: boolean }

const T: Record<string, TableDef> = {
  profiles: { readOnly: true, cols: { id: 'text', nom: 'text', role: 'text' } },
  clients: { cols: { id: 'text', type_prestation: 'text', nom: 'text', contact: 'text', telephone: 'text', email: 'text', adresse: 'text', date_evenement: 'text', statut_commercial: 'text', rdv_effectue_le: 'text', notes: 'text', details: 'json', created_by: 'text', created_at: 'text' } },
  devis: { gerantOnly: true, cols: { id: 'text', client_id: 'text', numero: 'text', statut: 'text', lignes: 'json', montant: 'num', date_envoi: 'text', date_signature: 'text', created_at: 'text' } },
  projets: { cols: { id: 'text', client_id: 'text', devis_id: 'text', titre: 'text', type_prestation: 'text', date_evenement: 'text', statut: 'text', created_at: 'text' } },
  taches: { cols: { id: 'text', projet_id: 'text', groupe: 'text', titre: 'text', fait: 'bool', assigne_a: 'text', ordre: 'num', created_at: 'text' } },
  paiements: { gerantOnly: true, cols: { id: 'text', projet_id: 'text', libelle: 'text', type: 'text', montant: 'num', echeance: 'text', recu: 'bool', recu_le: 'text', created_at: 'text' } },
  evenements: { cols: { id: 'text', titre: 'text', date: 'text', type_prestation: 'text', statut: 'text', client_id: 'text', projet_id: 'text', created_at: 'text' } },
  parametres: { gerantOnly: true, cols: { id: 'text', valeur: 'json' } },
  factures: { gerantOnly: true, cols: { id: 'text', numero: 'text', client_id: 'text', projet_id: 'text', devis_id: 'text', paiement_id: 'text', type: 'text', lignes: 'json', montant_ht: 'num', tva_taux: 'num', montant_ttc: 'num', date_emission: 'text', echeance: 'text', statut: 'text', created_at: 'text' } },
  affectations: { cols: { id: 'text', evenement_id: 'text', profile_id: 'text', nom_libre: 'text', poste: 'text', horaires: 'text', created_at: 'text' } },
  contrats: { gerantOnly: true, cols: { id: 'text', nom: 'text', telephone: 'text', email: 'text', adresse: 'text', profile_id: 'text', type: 'text', poste: 'text', date_debut: 'text', date_fin: 'text', rythme: 'text', missions: 'text', remuneration: 'text', montant: 'num', accords: 'json', statut: 'text', date_signature: 'text', notes: 'text', created_at: 'text' } },
  objectifs: { gerantOnly: true, cols: { id: 'text', annee: 'num', periode: 'text', numero: 'num', indicateur: 'text', cible: 'num' } },
}
// Jointures autorisées : table embarquée -> colonne de clé étrangère
const EMBEDS: Record<string, Record<string, string>> = {
  devis: { clients: 'client_id' },
  paiements: { projets: 'projet_id' },
  factures: { clients: 'client_id' },
  affectations: { evenements: 'evenement_id', profiles: 'profile_id' },
}
const OPS: Record<string, string> = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' }

interface Filter { col: string; op: string; val: unknown }
interface Order { col: string; asc?: boolean; nullsFirst?: boolean }
interface Body {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  columns?: string[]
  embeds?: { table: string; columns: string[] }[]
  filters?: Filter[]
  order?: Order[]
  limit?: number
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string[]
  count?: boolean
  head?: boolean
  returning?: string[]
}

class Bad extends Error { constructor(m: string, public status = 400) { super(m) } }

function checkCol(def: TableDef, col: string) {
  if (!(col in def.cols)) throw new Bad(`Colonne inconnue : ${col}`)
  return col
}
function toDb(type: ColType, v: unknown) {
  if (v === undefined || v === null) return null
  if (type === 'bool') return v ? 1 : 0
  if (type === 'json') return JSON.stringify(v)
  if (type === 'num') return Number(v)
  return String(v)
}
function fromDb(def: TableDef, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const type = def.cols[k]
    if (type === 'bool') out[k] = Boolean(v)
    else if (type === 'json') { try { out[k] = typeof v === 'string' ? JSON.parse(v) : v } catch { out[k] = v } }
    else out[k] = v
  }
  return out
}

function where(def: TableDef, filters: Filter[] = []) {
  const parts: string[] = []
  const binds: unknown[] = []
  for (const f of filters) {
    const col = checkCol(def, f.col)
    if (f.op === 'is') { parts.push(`${col} IS NULL`); continue }
    const op = OPS[f.op]
    if (!op) throw new Bad(`Opérateur inconnu : ${f.op}`)
    parts.push(`${col} ${op} ?`)
    binds.push(toDb(def.cols[col], f.val))
  }
  return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', binds }
}

function cols(def: TableDef, list?: string[]) {
  if (!list || list.length === 0 || list.includes('*')) return Object.keys(def.cols)
  return list.map((c) => checkCol(def, c))
}

async function run(env: Env, user: User, b: Body) {
  const def = T[b.table]
  if (!def) throw new Bad('Table inconnue')
  if (def.gerantOnly && user.role !== 'gerant') throw new Bad('Réservé aux gérants', 403)
  if (def.readOnly && b.op !== 'select') throw new Bad('Lecture seule')

  if (b.op === 'select') {
    const w = where(def, b.filters)
    if (b.count && b.head) {
      const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${b.table}${w.sql}`).bind(...w.binds).first<{ n: number }>()
      return { data: null, count: r?.n ?? 0 }
    }
    const order = (b.order ?? []).map((o) => {
      const c = checkCol(def, o.col)
      const nulls = o.nullsFirst === undefined ? (o.asc === false ? 'NULLS FIRST' : 'NULLS LAST') : o.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST'
      return `${c} ${o.asc === false ? 'DESC' : 'ASC'} ${nulls}`
    })
    const limit = b.limit ? ` LIMIT ${Math.min(1000, Math.max(1, Number(b.limit) | 0))}` : ''
    const sql = `SELECT ${cols(def, b.columns).join(', ')} FROM ${b.table}${w.sql}${order.length ? ' ORDER BY ' + order.join(', ') : ''}${limit}`
    const { results } = await env.DB.prepare(sql).bind(...w.binds).all()
    let rows = results.map((r) => fromDb(def, r as Record<string, unknown>))

    for (const e of b.embeds ?? []) {
      const fk = EMBEDS[b.table]?.[e.table]
      const edef = T[e.table]
      if (!fk || !edef) throw new Bad(`Jointure non autorisée : ${e.table}`)
      if (edef.gerantOnly && user.role !== 'gerant') throw new Bad('Réservé aux gérants', 403)
      const ids = [...new Set(rows.map((r) => r[fk]).filter(Boolean))] as string[]
      const map = new Map<string, Record<string, unknown>>()
      if (ids.length) {
        const ecols = [...new Set(['id', ...cols(edef, e.columns)])]
        const { results: er } = await env.DB.prepare(`SELECT ${ecols.join(', ')} FROM ${e.table} WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()
        for (const x of er) map.set(String(x.id), fromDb(edef, x as Record<string, unknown>))
      }
      rows = rows.map((r) => ({ ...r, [e.table]: map.get(String(r[fk])) ?? null }))
    }
    return { data: rows, count: b.count ? rows.length : undefined }
  }

  const ret = (b.returning?.length ? cols(def, b.returning) : null)

  if (b.op === 'insert' || b.op === 'upsert') {
    const list = Array.isArray(b.values) ? b.values : [b.values ?? {}]
    const out: Record<string, unknown>[] = []
    const stmts: D1PreparedStatement[] = []
    for (const v of list) {
      const row: Record<string, unknown> = { ...v }
      if (!row.id) row.id = crypto.randomUUID()
      if (b.table === 'clients' && !row.created_by) row.created_by = user.id
      const keys = Object.keys(row).filter((k) => row[k] !== undefined).map((k) => checkCol(def, k))
      let sql = `INSERT INTO ${b.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
      if (b.op === 'upsert') {
        const conflict = (b.onConflict ?? ['id']).map((c) => checkCol(def, c))
        const upd = keys.filter((k) => !conflict.includes(k) && k !== 'id')
        sql += ` ON CONFLICT (${conflict.join(', ')}) DO UPDATE SET ${upd.map((k) => `${k} = excluded.${k}`).join(', ')}`
      }
      stmts.push(env.DB.prepare(sql).bind(...keys.map((k) => toDb(def.cols[k], row[k]))))
      out.push({ id: row.id })
    }
    await env.DB.batch(stmts)
    if (ret) {
      const ids = out.map((o) => o.id as string)
      const { results } = await env.DB.prepare(`SELECT ${ret.join(', ')} FROM ${b.table} WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()
      return { data: results.map((r) => fromDb(def, r as Record<string, unknown>)) }
    }
    return { data: null }
  }

  if (b.op === 'update') {
    if (!b.filters?.length) throw new Bad('Filtre obligatoire')
    const v = b.values as Record<string, unknown>
    const keys = Object.keys(v).filter((k) => k !== 'id' && v[k] !== undefined).map((k) => checkCol(def, k))
    if (!keys.length) return { data: null }
    const w = where(def, b.filters)
    await env.DB.prepare(`UPDATE ${b.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}${w.sql}`)
      .bind(...keys.map((k) => toDb(def.cols[k], v[k])), ...w.binds).run()
    return { data: null }
  }

  if (b.op === 'delete') {
    if (!b.filters?.length) throw new Bad('Filtre obligatoire')
    const w = where(def, b.filters)
    await env.DB.prepare(`DELETE FROM ${b.table}${w.sql}`).bind(...w.binds).run()
    return { data: null }
  }

  throw new Bad('Opération inconnue')
}

export async function handleQuery(request: Request, env: Env): Promise<Response> {
  const user = await getUser(env, request)
  if (!user) return fail('Non connecté', 401)
  try {
    const body = (await request.json()) as Body
    return json(await run(env, user, body))
  } catch (e) {
    if (e instanceof Bad) return fail(e.message, e.status)
    console.error(e)
    return fail(e instanceof Error ? e.message : 'Erreur serveur', 500)
  }
}
