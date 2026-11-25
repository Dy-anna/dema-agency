import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
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
import Equipe from './pages/Equipe'
import Parametres from './pages/Parametres'
import Factures from './pages/Factures'
import { DevisPDF, FacturePDF } from './pages/Documents'
import Planning from './pages/Planning'
import Fiscalite from './pages/Fiscalite'
import FeuilleDeRoute from './pages/FeuilleDeRoute'
import Contrats from './pages/Contrats'
import Chasse from './pages/Chasse'
import Notifications from './pages/Notifications'
import RendezVous from './pages/RendezVous'
import CibleEdit from './pages/CibleEdit'
import ContratEdit from './pages/ContratEdit'
import ContratPDF from './pages/ContratPDF'
import type { ReactNode } from 'react'

function GerantOnly({ children }: { children: ReactNode }) {
  const { isGerant } = useAuth()
  return isGerant ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="login"><span className="muted">Chargement…</span></div>
  if (!profile) return <Login />

  return (
    <Routes>
      <Route path="devis/:id/pdf" element={<GerantOnly><DevisPDF /></GerantOnly>} />
      <Route path="factures/:id/pdf" element={<GerantOnly><FacturePDF /></GerantOnly>} />
      <Route path="clients/:id/feuille-de-route" element={<FeuilleDeRoute />} />
      <Route path="contrats/:id/pdf" element={<GerantOnly><ContratPDF /></GerantOnly>} />
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
        <Route path="equipe" element={<Equipe />} />
        <Route path="parametres" element={<GerantOnly><Parametres /></GerantOnly>} />
        <Route path="factures" element={<GerantOnly><Factures /></GerantOnly>} />
        <Route path="planning" element={<Planning />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="rendez-vous" element={<RendezVous />} />
        <Route path="chasse" element={<Chasse />} />
        <Route path="chasse/:id" element={<CibleEdit />} />
        <Route path="contrats" element={<GerantOnly><Contrats /></GerantOnly>} />
        <Route path="contrats/:id" element={<GerantOnly><ContratEdit /></GerantOnly>} />
        <Route path="fiscalite" element={<GerantOnly><Fiscalite /></GerantOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
