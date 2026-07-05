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
import MerchantsPage from './pages/MerchantsPage'
import HealthPage from './pages/HealthPage'
import WizardCreationPage from './pages/WizardCreationPage'

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
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
        <Route path="/workshop" element={
          <ProtectedRoute><WorkshopPage /></ProtectedRoute>
        } />
        <Route path="/health" element={
          <ProtectedRoute><HealthPage /></ProtectedRoute>
        } />
		<Route path="/campaigns/:campaignId/creation" element={
			<ProtectedRoute><WizardCreationPage /></ProtectedRoute>
		} />
        {/* Redirect legacy — bookmarks /texture-packs restent fonctionnels */}
        <Route path="/texture-packs" element={<Navigate to="/workshop" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
