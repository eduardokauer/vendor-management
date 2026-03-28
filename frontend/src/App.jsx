import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import HomePage from './HomePage';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import VendorDocumentsPage from './pages/VendorDocumentsPage';
import VendorFormPage from './pages/VendorFormPage';
import VendorsPage from './pages/Vendors';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <VendorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/new"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <VendorFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/:vendorId/edit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <VendorFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors/:vendorId/documents"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <VendorDocumentsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
