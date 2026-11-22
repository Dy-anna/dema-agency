// Petit client de données pour l'API /api/query (Cloudflare D1).
// Même syntaxe que les requêtes chaînées classiques : db.from('clients').select('*').eq('id', x).single()

type Result<T = any> = { data: T; error: { message: string } | null; count?: number | null } // eslint-disable-line @typescript-eslint/no-explicit-any

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({ error: 'Réponse invalide du serveur' }))
  if (res.status === 401) window.dispatchEvent(new Event('dema:logout'))
  return { ok: res.ok, payload }
}

function parseSelect(sel: string) {
  // "*, clients(nom, type_prestation)" -> colonnes + jointures
  const embeds: { table: string; columns: string[] }[] = []
  const rest = sel.replace(/(\w+)\(([^)]*)\)/g, (_, t: string, c: string) => {
    embeds.push({ table: t, columns: c.split(',').map((x) => x.trim()).filter(Boolean) })
    return ''
  })
  const columns = rest.split(',').map((x) => x.trim()).filter(Boolean)
  return { columns, embeds }
}

class Query implements PromiseLike<Result> {
  private b: Record<string, any> = { filters: [], order: [] } // eslint-disable-line @typescript-eslint/no-explicit-any
  private mode: 'many' | 'single' | 'maybe' = 'many'
  constructor(table: string) { this.b.table = table; this.b.op = 'select' }

  select(sel = '*', opts?: { count?: 'exact'; head?: boolean }) {
    const { columns, embeds } = parseSelect(sel)
    if (this.b.op === 'select') { this.b.columns = columns; this.b.embeds = embeds }
    else this.b.returning = columns.length ? columns : ['*']
    if (opts?.count) this.b.count = true
    if (opts?.head) this.b.head = true
    return this
  }
  insert(values: object | object[]) { this.b.op = 'insert'; this.b.values = values; return this }
  upsert(values: object | object[], opts?: { onConflict?: string }) {
    this.b.op = 'upsert'; this.b.values = values
    if (opts?.onConflict) this.b.onConflict = opts.onConflict.split(',').map((s) => s.trim())
    return this
  }
  update(values: object) { this.b.op = 'update'; this.b.values = values; return this }
  delete() { this.b.op = 'delete'; return this }

  private f(op: string, col: string, val: unknown) { this.b.filters.push({ col, op, val }); return this }
  eq(c: string, v: unknown) { return this.f('eq', c, v) }
  neq(c: string, v: unknown) { return this.f('neq', c, v) }
  gt(c: string, v: unknown) { return this.f('gt', c, v) }
  gte(c: string, v: unknown) { return this.f('gte', c, v) }
  lt(c: string, v: unknown) { return this.f('lt', c, v) }
  lte(c: string, v: unknown) { return this.f('lte', c, v) }
  is(c: string, _v: null) { return this.f('is', c, null) }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.b.order.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst }); return this
  }
  limit(n: number) { this.b.limit = n; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }

  private async exec(): Promise<Result> {
    try {
      const { ok, payload } = await post('/api/query', this.b)
      if (!ok) return { data: null, error: { message: payload.error ?? 'Erreur' }, count: null }
      let data = payload.data
      if (this.mode !== 'many' && Array.isArray(data)) {
        if (this.mode === 'single' && data.length !== 1) return { data: null, error: { message: 'Élément introuvable' } }
        data = data[0] ?? null
      }
      return { data, error: null, count: payload.count ?? null }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : 'Erreur réseau' } }
    }
  }
  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.exec().then(onOk, onErr)
  }
}

export const db = { from: (table: string) => new Query(table) }

export const api = {
  me: () => fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json()),
  login: (email: string, password: string) => post('/api/auth/login', { email, password }),
  setup: (nom: string, email: string, password: string) => post('/api/auth/setup', { nom, email, password }),
  logout: () => post('/api/auth/logout', {}),
  changePassword: (ancien: string, nouveau: string) => post('/api/auth/password', { ancien, nouveau }),
  team: () => fetch('/api/team', { credentials: 'same-origin' }).then((r) => r.json()),
  addMember: (m: { nom: string; email: string; role: string; password: string }) => post('/api/team', m),
  updateMember: async (m: { id: string; role?: string; actif?: boolean; password?: string }) => {
    const res = await fetch('/api/team', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) })
    return { ok: res.ok, payload: await res.json().catch(() => ({})) }
  },
}
