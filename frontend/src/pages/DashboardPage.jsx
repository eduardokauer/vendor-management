import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-4 text-2xl font-bold">Welcome, {user?.email}</h1>
          <p className="mb-2">You are now logged in to the Vendor Management System.</p>
          <p className="mb-6 text-sm text-gray-600">Role: {user?.role}</p>
          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
