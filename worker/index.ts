// Point d'entrée du Worker : l'API sous /api/*, le reste = le site (fichiers statiques de dist/)
import { fail, type Env } from './_lib/auth'
import { handleAuth } from './api/auth'
import { handleQuery } from './api/query'
import { handleTeam } from './api/team'
import { envoyerAlertesPush, handleNotifications } from './api/notifications'
import { ensureSchema } from './schema'

interface WorkerEnv extends Env { ASSETS: Fetcher }

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname.startsWith('/api/')) {
      await ensureSchema(env)
      const auth = pathname.match(/^\/api\/auth\/([a-z]+)$/)
      if (auth) return handleAuth(request, env, auth[1])
      if (pathname === '/api/team') return handleTeam(request, env)
      const notif = pathname.match(/^\/api\/notifications(?:\/([a-z]+))?$/)
      if (notif) return handleNotifications(request, env, notif[1] ?? '')
      if (pathname === '/api/query') {
        if (request.method !== 'POST') return fail('Méthode non autorisée', 405)
        return handleQuery(request, env, ctx)
      }
      return fail('Introuvable', 404)
    }

    return env.ASSETS.fetch(request)
  },

  // Tâche planifiée (matin et soir) : envoie les nouvelles alertes en push
  async scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(ensureSchema(env).then(() => envoyerAlertesPush(env)))
  },
} satisfies ExportedHandler<WorkerEnv>
