import { fail, getUser, hashPassword, json, type Env } from '../_lib/auth'

const ROLES = ['gerant', 'chef_projet', 'assistant']

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(env, request)
  if (!user) return fail('Non connecté', 401)

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, email, nom, role, actif FROM profiles ORDER BY nom').all()
    return json({ data: results.map((r) => ({ ...r, actif: Boolean(r.actif) })) })
  }

  if (user.role !== 'gerant') return fail('Réservé aux gérants', 403)
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  // Ajouter un membre
  if (request.method === 'POST') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const nom = String(body.nom ?? '').trim()
    const role = String(body.role ?? 'assistant')
    const password = String(body.password ?? '')
    if (!email.includes('@') || !nom || !ROLES.includes(role) || password.length < 8) {
      return fail('Nom, e-mail, rôle et mot de passe provisoire (8 caractères min.) requis.')
    }
    const exists = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first()
    if (exists) return fail('Un compte existe déjà avec cet e-mail.')
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO profiles (id, email, nom, role, password_hash) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, nom, role, await hashPassword(password)).run()
    return json({ ok: true, id })
  }

  // Modifier rôle / activation / mot de passe d'un membre
  if (request.method === 'PATCH') {
    const id = String(body.id ?? '')
    if (id === user.id && (body.role !== undefined || body.actif === false)) return fail('Tu ne peux pas retirer tes propres droits.')
    if (body.role !== undefined) {
      if (!ROLES.includes(String(body.role))) return fail('Rôle inconnu')
      await env.DB.prepare('UPDATE profiles SET role = ? WHERE id = ?').bind(String(body.role), id).run()
    }
    if (body.actif !== undefined) {
      await env.DB.prepare('UPDATE profiles SET actif = ? WHERE id = ?').bind(body.actif ? 1 : 0, id).run()
      if (!body.actif) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
    }
    if (body.password !== undefined) {
      if (String(body.password).length < 8) return fail('8 caractères minimum.')
      await env.DB.prepare('UPDATE profiles SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(body.password)), id).run()
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
    }
    return json({ ok: true })
  }

  return fail('Méthode non autorisée', 405)
}
