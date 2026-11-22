// Point d'entrée du Worker : l'API sous /api/*, le reste = le site (fichiers statiques de dist/)
import { fail, type Env } from './_lib/auth'
import { handleAuth } from './api/auth'
import { handleQuery } from './api/query'
import { handleTeam } from './api/team'

interface WorkerEnv extends Env { ASSETS: Fetcher }

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname.startsWith('/api/')) {
      const auth = pathname.match(/^\/api\/auth\/([a-z]+)$/)
      if (auth) return handleAuth(request, env, auth[1])
      if (pathname === '/api/team') return handleTeam(request, env)
      if (pathname === '/api/query') {
        if (request.method !== 'POST') return fail('Méthode non autorisée', 405)
        return handleQuery(request, env)
      }
      return fail('Introuvable', 404)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>
