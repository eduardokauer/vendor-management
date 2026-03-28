import PropTypes from 'prop-types';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const linkClassName = ({ isActive }) =>
  [
    'rounded-full px-4 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-white text-slate-950 shadow-sm'
      : 'text-slate-200 hover:bg-white/10 hover:text-white',
  ].join(' ');

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const navigationItems = [{ label: 'Dashboard', to: '/dashboard' }];

  if (user?.role === 'admin') {
    navigationItems.push({ label: 'Vendors', to: '/vendors' });
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Vendor Management System
            </p>
            <div>
              <h1 className="text-2xl font-semibold">Authenticated workspace</h1>
              <p className="text-sm text-slate-300">
                Signed in as {user?.email} ({user?.role})
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <nav className="flex flex-wrap items-center gap-2" aria-label="Authenticated navigation">
              {navigationItems.map((item) => (
                <NavLink key={item.to} className={linkClassName} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <button
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

AppShell.propTypes = {
  children: PropTypes.node.isRequired,
};
