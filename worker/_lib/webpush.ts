// Web Push (RFC 8291 « aes128gcm » + VAPID RFC 8292) avec la Web Crypto API uniquement.
// Fonctionne avec Chrome/Android (FCM), Firefox et Safari/iPhone (Apple).

const enc = new TextEncoder()
export const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const deB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parts) { out.set(p, i); i += p.length }
  return out
}
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

export interface Abonnement { endpoint: string; p256dh: string; auth: string }
export interface Vapid { publique: string; privee: JsonWebKey; contact: string }

/** Chiffre le message pour l'abonnement (RFC 8291) */
export async function chiffrer(ab: Abonnement, message: string) {
  const uaPublic = deB64u(ab.p256dh)
  const authSecret = deB64u(ab.auth)
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, as.privateKey, 256))

  const prkKey = await hmac(authSecret, ecdh)
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)

  const cle = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const clair = concat(enc.encode(message), new Uint8Array([2]))
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cle, clair))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, chiffre)
}

/** En-tête d'autorisation VAPID (JWT ES256) */
export async function vapidAuth(endpoint: string, v: Vapid) {
  const aud = new URL(endpoint).origin
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.contact })))
  const { kty, crv, x, y, d } = v.privee
  const key = await crypto.subtle.importKey('jwk', { kty, crv, x, y, d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`))
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${v.publique}`
}

/** Prépare la requête HTTP vers le service push du navigateur */
export async function requetePush(ab: Abonnement, payload: unknown, v: Vapid, opts: { ttl?: number; urgency?: string; topic?: string } = {}) {
  const body = await chiffrer(ab, JSON.stringify(payload))
  const headers: Record<string, string> = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttl ?? 43200),
    Urgency: opts.urgency ?? 'normal',
    Authorization: await vapidAuth(ab.endpoint, v),
  }
  if (opts.topic) headers.Topic = opts.topic
  return { url: ab.endpoint, init: { method: 'POST', headers, body } as RequestInit }
}
