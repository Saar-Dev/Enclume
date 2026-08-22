import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import api from './lib/api'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SessionPage from './pages/SessionPage'
import CampaignSettingsPage from './components/campaignSettings/CampaignSettingsPage'
import WorkshopPage from './pages/WorkshopPage'
import VaultPage from './pages/VaultPage'
import VaultCharacterPage from './pages/VaultCharacterPage'
import CampaignCharacterSheetPage from './pages/CampaignCharacterSheetPage'
import CharacterPrintPage from './pages/CharacterPrintPage'
import EquipmentCatalogPage from './pages/EquipmentCatalogPage'
import MerchantsPage from './pages/MerchantsPage'
import HealthPage from './pages/HealthPage'
import WizardCreationPage from './pages/WizardCreationPage'
import CharacterPoolPage from './pages/CharacterPoolPage'
import DiceCalibrationPage from './pages/DiceCalibrationPage' // OUTIL DEV — vérification/calibration des dés
import AdminPage from './pages/AdminPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminTicketsPage from './pages/AdminTicketsPage'
import AdminLogsPage from './pages/AdminLogsPage'
import ReportTicketPage from './pages/ReportTicketPage'
import MePage from './pages/MePage'

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Réservé role==='admin'. Nécessaire en plus de la garde serveur (requireAdmin) pour
// /dev/dice-calibration, qui n'a aucune route serveur à qui déléguer cette décision — voir
// docs/PLANS/PLAN_ADMIN.md §2.2. Le garde isLoading doit précéder le test de role, sinon un user pas
// encore chargé (fetch /auth/me async) pourrait être lu à tort comme "pas admin".
function AdminRoute({ children }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { setUser, clearUser } = useAuthStore()

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => clearUser())
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute><RegisterPage /></PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        } />
        <Route path="/session/:campaignId" element={
          <ProtectedRoute><SessionPage /></ProtectedRoute>
        } />
        <Route path="/campaigns/:campaignId/settings" element={
          <ProtectedRoute><CampaignSettingsPage /></ProtectedRoute>
        } />
        <Route path="/campaigns/:campaignId/merchants" element={
          <ProtectedRoute><MerchantsPage /></ProtectedRoute>
        } />
        {/* Fiche standalone d'un personnage de campagne — hors session VTT, docs/PLANS/PLAN_FICHE_HORSLIGNE.md Lot B0 */}
        <Route path="/campaigns/:campaignId/characters/:characterId/sheet" element={
          <ProtectedRoute><CampaignCharacterSheetPage /></ProtectedRoute>
        } />
        {/* Vue d'impression — fiche complète en une page, lecture seule, docs/PLANS/PLAN_FICHE_HORSLIGNE.md Lot D.
            Autorisation par personnage déjà appliquée serveur (char-sheet.js:router.param), pas dupliquée ici. */}
        <Route path="/characters/:characterId/print" element={
          <ProtectedRoute><CharacterPrintPage /></ProtectedRoute>
        } />
        <Route path="/workshop" element={
          <ProtectedRoute><WorkshopPage /></ProtectedRoute>
        } />
        <Route path="/vault" element={
          <ProtectedRoute><VaultPage /></ProtectedRoute>
        } />
        {/* Fiche standalone d'un personnage du Coffre — édition complète hors session, docs/EN_COURS.md */}
        <Route path="/vault/characters/:id" element={
          <ProtectedRoute><VaultCharacterPage /></ProtectedRoute>
        } />
        {/* Catalogue ref_equipment, lecture seule, ouvert à tout utilisateur — docs/ROADMAP.md */}
        <Route path="/equipment" element={
          <ProtectedRoute><EquipmentCatalogPage /></ProtectedRoute>
        } />
        {/* Création directement dans le Coffre, sans campagne — même WizardCreationPage que
            /campaigns/:campaignId/creation, campaignId simplement absent des params */}
        <Route path="/vault/creation" element={
          <ProtectedRoute><WizardCreationPage /></ProtectedRoute>
        } />
        <Route path="/vault/creation/:sheetId" element={
          <ProtectedRoute><WizardCreationPage /></ProtectedRoute>
        } />
        <Route path="/health" element={
          <AdminRoute><HealthPage /></AdminRoute>
        } />
        {/* OUTIL DEV — vérification/calibration des dés (tous types) */}
        <Route path="/dev/dice-calibration" element={
          <AdminRoute><DiceCalibrationPage /></AdminRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute><AdminUsersPage /></AdminRoute>
        } />
        <Route path="/admin/tickets" element={
          <AdminRoute><AdminTicketsPage /></AdminRoute>
        } />
        <Route path="/admin/logs" element={
          <AdminRoute><AdminLogsPage /></AdminRoute>
        } />
        <Route path="/tickets/new" element={
          <ProtectedRoute><ReportTicketPage /></ProtectedRoute>
        } />
        <Route path="/me" element={
          <ProtectedRoute><MePage /></ProtectedRoute>
        } />
		<Route path="/campaigns/:campaignId/creation" element={
			<ProtectedRoute><WizardCreationPage /></ProtectedRoute>
		} />
		{/* MJ ouvre le personnage en cours d'un joueur, ou lien direct de reprise (Lot A3,
		    docs/PLAN_WIZARDCOLLAB.md §6.2) */}
		<Route path="/campaigns/:campaignId/creation/:sheetId" element={
			<ProtectedRoute><WizardCreationPage /></ProtectedRoute>
		} />
		<Route path="/campaigns/:campaignId/pool" element={
			<ProtectedRoute><CharacterPoolPage /></ProtectedRoute>
		} />
        {/* Redirect legacy — bookmarks /texture-packs restent fonctionnels */}
        <Route path="/texture-packs" element={<Navigate to="/workshop" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
