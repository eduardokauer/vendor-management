import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';
import DashboardPage from '../pages/DashboardPage';
import LoginPage from '../pages/LoginPage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  getCurrentUser,
  loginWithCredentials,
} from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');

  return {
    ...actual,
    getCurrentUser: vi.fn(),
    loginWithCredentials: vi.fn(),
  };
});

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedLoginWithCredentials = vi.mocked(loginWithCredentials);

function renderAuthFlow(initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedGetCurrentUser.mockReset();
  mockedLoginWithCredentials.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Login and session flow', () => {
  test('renders login validation errors', async () => {
    const user = userEvent.setup();

    renderAuthFlow();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  test('stores the JWT and opens the dashboard after a successful login', async () => {
    const user = userEvent.setup();
    mockedLoginWithCredentials.mockResolvedValue({ token: 'jwt-token' });
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    renderAuthFlow();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/welcome, admin@example.com/i)).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('jwt-token');
    expect(mockedLoginWithCredentials).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'password',
    });
  });

  test('restores the persisted session for a protected route', async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    renderAuthFlow(['/dashboard']);

    expect(await screen.findByText(/welcome, admin@example.com/i)).toBeInTheDocument();
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  test('clears an invalid token and redirects back to login', async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'expired-token');
    mockedGetCurrentUser.mockRejectedValue({
      response: {
        data: {
          message: 'Token is not valid',
        },
      },
    });

    renderAuthFlow(['/dashboard']);

    expect(await screen.findByRole('heading', { name: /vms login/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  test('removes the stored token and returns to login on logout', async () => {
    const user = userEvent.setup();
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    renderAuthFlow(['/dashboard']);

    expect(await screen.findByText(/welcome, admin@example.com/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(await screen.findByRole('heading', { name: /vms login/i })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
