import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SiteProvider } from './context/SiteContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SiteSelector from './pages/SiteSelector'
import Photos from './pages/Photos'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/sites" replace />} />
              <Route path="/sites" element={<SiteSelector />} />
              <Route path="/sites/:siteId" element={<Dashboard />} />
              <Route path="/sites/:siteId/photos" element={<Photos />} />
            </Route>
          </Route>
        </Routes>
      </SiteProvider>
    </AuthProvider>
  )
}

export default App