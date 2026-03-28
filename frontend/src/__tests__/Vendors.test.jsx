import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';
import DashboardPage from '../pages/DashboardPage';
import VendorFormPage from '../pages/VendorFormPage';
import VendorsPage from '../pages/Vendors';
import {
  AUTH_TOKEN_STORAGE_KEY,
  createVendor,
  deleteVendor,
  getCurrentUser,
  getVendorById,
  getVendors,
  updateVendor,
} from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');

  return {
    ...actual,
    createVendor: vi.fn(),
    deleteVendor: vi.fn(),
    getCurrentUser: vi.fn(),
    getVendorById: vi.fn(),
    getVendors: vi.fn(),
    updateVendor: vi.fn(),
  };
});

const mockedCreateVendor = vi.mocked(createVendor);
const mockedDeleteVendor = vi.mocked(deleteVendor);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedGetVendorById = vi.mocked(getVendorById);
const mockedGetVendors = vi.mocked(getVendors);
const mockedUpdateVendor = vi.mocked(updateVendor);

function renderVendorFlow(initialEntries) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
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
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedCreateVendor.mockReset();
  mockedDeleteVendor.mockReset();
  mockedGetCurrentUser.mockReset();
  mockedGetVendorById.mockReset();
  mockedGetVendors.mockReset();
  mockedUpdateVendor.mockReset();
  vi.restoreAllMocks();
});

describe('Vendor management flow', () => {
  test('redirects non-admin users away from the vendors page', async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-2',
      email: 'vendor@example.com',
      role: 'vendor',
    });

    renderVendorFlow(['/vendors']);

    expect(await screen.findByText(/welcome, vendor@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(mockedGetVendors).not.toHaveBeenCalled();
  });

  test('lists vendors for admins and removes a vendor after confirmation', async () => {
    const user = userEvent.setup();
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    mockedGetVendors.mockResolvedValue([
      {
        id: 'vendor-1',
        name: 'Atlas Build',
        contact_email: 'atlas@example.com',
        status: 'Compliant',
      },
      {
        id: 'vendor-2',
        name: 'Brick Supply',
        contact_email: 'brick@example.com',
        status: 'Non-Compliant',
      },
    ]);
    mockedDeleteVendor.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderVendorFlow(['/vendors']);

    expect(await screen.findByText(/atlas build/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create new vendor/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove atlas build/i }));

    await waitFor(() => {
      expect(mockedDeleteVendor).toHaveBeenCalledWith('vendor-1');
    });
    expect(screen.queryByText(/atlas build/i)).not.toBeInTheDocument();
    expect(screen.getByText(/brick supply/i)).toBeInTheDocument();
  });

  test('creates a vendor and returns to the list', async () => {
    const user = userEvent.setup();
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    mockedCreateVendor.mockResolvedValue({
      id: 'vendor-3',
      name: 'Civic Concrete',
      contact_email: 'contact@civic.com',
      status: 'Compliant',
    });
    mockedGetVendors.mockResolvedValue([
      {
        id: 'vendor-3',
        name: 'Civic Concrete',
        contact_email: 'contact@civic.com',
        status: 'Compliant',
      },
    ]);

    renderVendorFlow(['/vendors/new']);

    await user.type(screen.getByLabelText(/name/i), 'Civic Concrete');
    await user.type(screen.getByLabelText(/contact email/i), 'contact@civic.com');
    await user.selectOptions(screen.getByLabelText(/status/i), 'Compliant');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    await waitFor(() => {
      expect(mockedCreateVendor).toHaveBeenCalledWith({
        name: 'Civic Concrete',
        contact_email: 'contact@civic.com',
        status: 'Compliant',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/created successfully/i);
    expect(screen.getByText(/civic concrete/i)).toBeInTheDocument();
  });

  test('loads a vendor into the edit form and saves the updated data', async () => {
    const user = userEvent.setup();
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    mockedGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    mockedGetVendorById.mockResolvedValue({
      id: 'vendor-9',
      name: 'Legacy Masonry',
      contact_email: 'legacy@example.com',
      status: 'Non-Compliant',
    });
    mockedUpdateVendor.mockResolvedValue({
      id: 'vendor-9',
      name: 'Legacy Masonry Group',
      contact_email: 'legacy@example.com',
      status: 'Compliant',
    });
    mockedGetVendors.mockResolvedValue([
      {
        id: 'vendor-9',
        name: 'Legacy Masonry Group',
        contact_email: 'legacy@example.com',
        status: 'Compliant',
      },
    ]);

    renderVendorFlow(['/vendors/vendor-9/edit']);

    expect(await screen.findByDisplayValue(/legacy masonry/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Legacy Masonry Group');
    await user.selectOptions(screen.getByLabelText(/status/i), 'Compliant');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockedUpdateVendor).toHaveBeenCalledWith('vendor-9', {
        name: 'Legacy Masonry Group',
        contact_email: 'legacy@example.com',
        status: 'Compliant',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/updated successfully/i);
    expect(screen.getByText(/legacy masonry group/i)).toBeInTheDocument();
  });
});
