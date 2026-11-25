// Notifications : alertes de la cloche + abonnement push du téléphone
export interface Alerte {
  cle: string
  niveau: 'urgent' | 'important' | 'info'
  categorie: 'tournage' | 'finance' | 'commercial' | 'equipe' | 'contrat' | 'fiche' | 'tache' | 'chasse'
  titre: string
  texte: string
  lien: string
  date: string | null
  lu: boolean
}

async function appel<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { credentials: 'same-origin' } : {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Erreur')
  return data as T
}

export const chargerAlertes = () => appel<{ alertes: Alerte[]; nonLues: number; appareils: number }>('/api/notifications')
export const marquerLues = (cles: string[]) => appel('/api/notifications/lu', { cles })
export const toutMarquerLu = () => appel('/api/notifications/lu', { tout: true })
export const envoyerTest = () => appel<{ envoyes: number }>('/api/notifications/test', {})

// ───────── Push ─────────
export const pushSupporte = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const estIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const estInstalle = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Navigateur utilisé sur iPhone (Chrome, Firefox, Edge ont leur bouton Partager ailleurs) */
export const navigateurIOS = () => {
  const ua = navigator.userAgent
  if (/CriOS/.test(ua)) return 'Chrome'
  if (/FxiOS/.test(ua)) return 'Firefox'
  if (/EdgiOS/.test(ua)) return 'Edge'
  return 'Safari'
}

/** iPhone : les notifications ne marchent que si le site est ajouté à l'écran d'accueil */
export const doitInstallerSurIOS = () => estIOS() && !estInstalle()

export async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register('/sw.js') } catch { return null }
}

const versUint8 = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export async function etatPush(): Promise<'non-supporte' | 'installer-ios' | 'refuse' | 'actif' | 'inactif'> {
  try {
    if (doitInstallerSurIOS()) return 'installer-ios'
    if (!pushSupporte()) return 'non-supporte'
    if (Notification.permission === 'denied') return 'refuse'
    // Ne jamais rester bloqué : au-delà de 3 s on propose quand même d'activer
    const sub = await Promise.race([
      navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription() ?? null),
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ])
    return sub && Notification.permission === 'granted' ? 'actif' : 'inactif'
  } catch {
    return pushSupporte() ? 'inactif' : 'non-supporte'
  }
}

/** Infos affichées pour aider à dépanner */
export function diagnostic() {
  const ios = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  return [
    ios ? `iOS ${ios[1]}.${ios[2]}` : null,
    estInstalle() ? 'app installée' : (ios ? navigateurIOS() : 'navigateur'),
    'Notification' in window ? 'notifications OK' : 'pas de notifications',
    'PushManager' in window ? 'push OK' : 'pas de push',
  ].filter(Boolean).join(' · ')
}

const nomAppareil = () => {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'PC Windows'
  return 'Appareil'
}

export async function activerPush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications refusées. Autorise-les dans les réglages du téléphone pour ce site.')
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await enregistrerServiceWorker())
  if (!reg) throw new Error('Impossible d’activer les notifications sur ce navigateur.')
  await navigator.serviceWorker.ready
  const { cle } = await appel<{ cle: string }>('/api/notifications/cle')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versUint8(cle) })
  await appel('/api/notifications/abonner', { subscription: sub.toJSON(), appareil: nomAppareil() })
}

export async function desactiverPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await appel('/api/notifications/desabonner', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
  }
}
