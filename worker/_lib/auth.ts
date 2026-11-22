// Authentification : mots de passe PBKDF2 + sessions en cookie HttpOnly
export interface Env { DB: D1Database }
export type Role = 'gerant' | 'chef_projet' | 'assistant'
export interface User { id: string; email: string; nom: string; role: Role }

const ITERATIONS = 100_000
const COOKIE = 'dema_session'
const SESSION_DAYS = 30

const enc = new TextEncoder()
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, iter, saltHex, hashHex] = stored.split('$')
  if (algo !== 'pbkdf2') return false
  const hash = toHex(await pbkdf2(password, fromHex(saltHex), Number(iter)))
  // comparaison à temps constant
  if (hash.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i)
  return diff === 0
}

const sha256 = async (s: string) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

export async function createSession(env: Env, userId: string, secure: boolean) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000)
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires.toISOString()).run()
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`
}

function readToken(request: Request) {
  const cookie = request.headers.get('Cookie') ?? ''
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))
  return m?.[1] ?? null
}

export async function getUser(env: Env, request: Request): Promise<User | null> {
  const token = readToken(request)
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT p.id, p.email, p.nom, p.role FROM sessions s JOIN profiles p ON p.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND p.actif = 1`,
  ).bind(await sha256(token), new Date().toISOString()).first<User>()
  return row ?? null
}

export async function destroySession(env: Env, request: Request) {
  const token = readToken(request)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const fail = (message: string, status = 400) => json({ error: message }, status)
