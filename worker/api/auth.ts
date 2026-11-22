import { createSession, destroySession, fail, getUser, hashPassword, json, verifyPassword, type Env } from '../_lib/auth'

const isSecure = (request: Request) => new URL(request.url).protocol === 'https:'

export async function handleAuth(request: Request, env: Env, action: string): Promise<Response> {


  if (action === 'me') {
    const user = await getUser(env, request)
    if (user) return json({ user })
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>()
    return json({ user: null, needsSetup: (count?.n ?? 0) === 0 })
  }

  if (request.method !== 'POST') return fail('Méthode non autorisée', 405)
  const body = (await request.json().catch(() => ({}))) as Record<string, string>

  if (action === 'login') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const row = await env.DB.prepare('SELECT id, password_hash, actif FROM profiles WHERE email = ?').bind(email).first<{ id: string; password_hash: string; actif: number }>()
    if (!row || !row.actif || !(await verifyPassword(String(body.password ?? ''), row.password_hash))) {
      return fail('Identifiants incorrects.', 401)
    }
    const cookie = await createSession(env, row.id, isSecure(request))
    return json({ ok: true }, 200, { 'Set-Cookie': cookie })
  }

  if (action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': await destroySession(env, request) })
  }

  // Création du tout premier compte (gérant) — possible uniquement quand la base est vide
  if (action === 'setup') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>()
    if ((count?.n ?? 0) > 0) return fail('Le compte gérant existe déjà.', 403)
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const nom = String(body.nom ?? '').trim()
    if (!email.includes('@') || password.length < 8 || !nom) return fail('Nom, e-mail valide et mot de passe de 8 caractères minimum requis.')
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO profiles (id, email, nom, role, password_hash) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, nom, 'gerant', await hashPassword(password)).run()
    const cookie = await createSession(env, id, isSecure(request))
    return json({ ok: true }, 200, { 'Set-Cookie': cookie })
  }

  // Changer son propre mot de passe
  if (action === 'password') {
    const user = await getUser(env, request)
    if (!user) return fail('Non connecté', 401)
    const row = await env.DB.prepare('SELECT password_hash FROM profiles WHERE id = ?').bind(user.id).first<{ password_hash: string }>()
    if (!row || !(await verifyPassword(String(body.ancien ?? ''), row.password_hash))) return fail('Mot de passe actuel incorrect.', 403)
    if (String(body.nouveau ?? '').length < 8) return fail('8 caractères minimum.')
    await env.DB.prepare('UPDATE profiles SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(body.nouveau)), user.id).run()
    return json({ ok: true })
  }

  return fail('Action inconnue', 404)
}
