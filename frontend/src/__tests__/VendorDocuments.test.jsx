import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';
import VendorDocumentsPage from '../pages/VendorDocumentsPage';
import {
  AUTH_TOKEN_STORAGE_KEY,
  checkVendorCompliance,
  downloadDocumentFile,
  getCurrentUser,
  getVendorById,
  getVendorDocuments,
  uploadVendorDocument,
} from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');

  return {
    ...actual,
    checkVendorCompliance: vi.fn(),
    downloadDocumentFile: vi.fn(),
    getCurrentUser: vi.fn(),
    getVendorById: vi.fn(),
    getVendorDocuments: vi.fn(),
    uploadVendorDocument: vi.fn(),
  };
});

const mockedCheckVendorCompliance = vi.mocked(checkVendorCompliance);
const mockedDownloadDocumentFile = vi.mocked(downloadDocumentFile);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedGetVendorById = vi.mocked(getVendorById);
const mockedGetVendorDocuments = vi.mocked(getVendorDocuments);
const mockedUploadVendorDocument = vi.mocked(uploadVendorDocument);
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

function renderDocumentFlow(initialEntries = ['/vendors/vendor-1/documents']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
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
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
  mockedCheckVendorCompliance.mockReset();
  mockedDownloadDocumentFile.mockReset();
  mockedGetCurrentUser.mockReset();
  mockedGetVendorById.mockReset();
  mockedGetVendorDocuments.mockReset();
  mockedUploadVendorDocument.mockReset();

  mockedGetCurrentUser.mockResolvedValue({
    id: 'user-1',
    email: 'admin@example.com',
    role: 'admin',
  });
  mockedGetVendorById.mockResolvedValue({
    id: 'vendor-1',
    name: 'Atlas Build',
    contact_email: 'atlas@example.com',
    status: 'Non-Compliant',
  });
  mockedGetVendorDocuments.mockResolvedValue([
    {
      id: 'doc-1',
      type: 'insurance',
      file_url: 'uploads/documents/insurance.pdf',
      uploaded_at: '2026-03-20T10:00:00.000Z',
      expires_at: '2099-12-31',
    },
  ]);

  Object.defineProperty(globalThis.URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
  Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();

  if (originalCreateObjectURL) {
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
  } else {
    delete globalThis.URL.createObjectURL;
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    delete globalThis.URL.revokeObjectURL;
  }
});

describe('Vendor documents workspace', () => {
  test('uploads a document and updates the compliance badge', async () => {
    const user = userEvent.setup();
    mockedUploadVendorDocument.mockResolvedValue({
      id: 'doc-2',
      vendor_id: 'vendor-1',
      type: 'license',
      file_url: 'uploads/documents/license.pdf',
      uploaded_at: '2026-03-27T12:00:00.000Z',
      expires_at: '2099-12-31',
      vendor_status: 'Compliant',
    });

    renderDocumentFlow();

    expect(await screen.findByText(/atlas build/i)).toBeInTheDocument();
    expect(screen.getByText(/non-compliant/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/document type/i), 'license');
    await user.upload(
      screen.getByLabelText(/^file$/i),
      new File(['license-file'], 'license.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() => {
      expect(mockedUploadVendorDocument).toHaveBeenCalledWith('vendor-1', {
        expires_at: '',
        file: expect.any(File),
        type: 'license',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/uploaded successfully/i);
    expect(screen.getAllByText(/^Compliant$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/license.pdf/i)).toBeInTheDocument();
  });

  test('refreshes compliance and downloads the selected file', async () => {
    const user = userEvent.setup();
    mockedCheckVendorCompliance.mockResolvedValue({
      message: 'Compliance status updated',
      status: 'Compliant',
      vendor: {
        id: 'vendor-1',
        name: 'Atlas Build',
        contact_email: 'atlas@example.com',
        status: 'Compliant',
      },
    });
    mockedDownloadDocumentFile.mockResolvedValue({
      blob: new Blob(['insurance-file']),
      filename: 'insurance.pdf',
    });

    renderDocumentFlow();

    expect(await screen.findByText(/atlas build/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /refresh compliance/i }));

    await waitFor(() => {
      expect(mockedCheckVendorCompliance).toHaveBeenCalledWith('vendor-1');
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/refreshed/i);
    expect(screen.getAllByText(/^Compliant$/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /download insurance/i }));

    await waitFor(() => {
      expect(mockedDownloadDocumentFile).toHaveBeenCalledWith('doc-1');
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
