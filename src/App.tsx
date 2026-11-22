import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientNew from './pages/ClientNew'
import ClientDetail from './pages/ClientDetail'
import Pipeline from './pages/Pipeline'
import DevisEdit from './pages/DevisEdit'
import Projets from './pages/Projets'
import ProjetDetail from './pages/ProjetDetail'
import Calendrier from './pages/Calendrier'
import Objectifs from './pages/Objectifs'
import type { ReactNode } from 'react'

function GerantOnly({ children }: { children: ReactNode }) {
  const { isGerant } = useAuth()
  return isGerant ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { session, loading } = useAuth()

  if (!supabaseConfigured) {
    return (
      <div className="login"><div className="card">
        <h1>DEMA Agency</h1>
        <p className="muted">Configuration manquante : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.</p>
      </div></div>
    )
  }
  if (loading) return <div className="login"><span className="muted">Chargement…</span></div>
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/nouveau" element={<ClientNew />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="pipeline" element={<GerantOnly><Pipeline /></GerantOnly>} />
        <Route path="devis/:id" element={<GerantOnly><DevisEdit /></GerantOnly>} />
        <Route path="projets" element={<Projets />} />
        <Route path="projets/:id" element={<ProjetDetail />} />
        <Route path="calendrier" element={<Calendrier />} />
        <Route path="objectifs" element={<GerantOnly><Objectifs /></GerantOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
