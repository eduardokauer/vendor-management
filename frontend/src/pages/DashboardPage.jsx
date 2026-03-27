import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Welcome, {user?.email}</h1>
          <p className="mb-2">You are now logged in to the Vendor Management System.</p>
          <p className="mb-4 text-sm text-gray-600">Current role: {user?.role}</p>
          <button
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
