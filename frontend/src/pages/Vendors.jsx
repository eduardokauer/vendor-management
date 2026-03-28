import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import VendorList from '../components/VendorList';
import { deleteVendor, getApiErrorMessage, getVendors } from '../services/api';

export default function Vendors() {
  const location = useLocation();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [deletingVendorId, setDeletingVendorId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadVendors = async () => {
      try {
        const vendorRecords = await getVendors();

        if (isMounted) {
          setVendors(vendorRecords);
          setPageError('');
        }
      } catch (error) {
        if (isMounted) {
          setPageError(getApiErrorMessage(error, 'Could not load vendors'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVendors();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Remove vendor "${vendor.name}"?`)) {
      return;
    }

    setDeletingVendorId(vendor.id);
    setPageError('');

    try {
      await deleteVendor(vendor.id);
      setVendors((currentVendors) =>
        currentVendors.filter((currentVendor) => currentVendor.id !== vendor.id)
      );
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Could not remove vendor'));
    } finally {
      setDeletingVendorId(null);
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Vendor operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Vendors</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review the current vendor registry and keep the basic supplier profile up to date.
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          to="/vendors/new"
        >
          Create New Vendor
        </Link>
      </div>

      {location.state?.notice && (
        <div
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {location.state.notice}
        </div>
      )}

      {pageError && (
        <div
          className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {pageError}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-600">Loading vendors...</p>
        </div>
      ) : (
        <VendorList
          deletingVendorId={deletingVendorId}
          onDelete={handleDelete}
          vendors={vendors}
        />
      )}
    </AppShell>
  );
}
