import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage, getVendors } from '../services/api';

const capabilityCopy = {
  admin: 'Your account can manage the vendor registry and keep supplier records current.',
  vendor: 'Your account is authenticated, but vendor administration remains reserved for admins.',
};

export default function Dashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [vendorsError, setVendorsError] = useState('');
  const [isLoadingVendors, setIsLoadingVendors] = useState(user?.role === 'admin');
  const compliantVendorsCount = vendors.filter((vendor) => vendor.status === 'Compliant').length;
  const nonCompliantVendorsCount = vendors.length - compliantVendorsCount;

  useEffect(() => {
    let isMounted = true;

    const loadVendorSummary = async () => {
      if (user?.role !== 'admin') {
        if (isMounted) {
          setVendors([]);
          setVendorsError('');
          setIsLoadingVendors(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingVendors(true);
      }

      try {
        const vendorRecords = await getVendors();

        if (isMounted) {
          setVendors(vendorRecords);
          setVendorsError('');
        }
      } catch (error) {
        if (isMounted) {
          setVendorsError(getApiErrorMessage(error, 'Could not load the vendor summary'));
        }
      } finally {
        if (isMounted) {
          setIsLoadingVendors(false);
        }
      }
    };

    loadVendorSummary();

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  return (
    <AppShell>
      {location.state?.authorizationError && (
        <div
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          {location.state.authorizationError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Session overview
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Welcome, {user?.email}</h1>
          <p className="mt-3 text-base text-slate-600">
            You are now logged in to the Vendor Management System.
          </p>
          <p className="mt-2 text-sm text-slate-500">Current role: {user?.role}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">
                Workspace
              </p>
              <h2 className="mt-3 text-xl font-semibold">Authenticated area is ready</h2>
              <p className="mt-2 text-sm text-slate-300">
                {capabilityCopy[user?.role] ??
                  'Your account is authenticated and ready for the next workflow.'}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Quick actions
              </p>
              {user?.role === 'admin' ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
                    to="/vendors"
                  >
                    Open vendors
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
                    to="/vendors/new"
                  >
                    Create vendor
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Admin-only tools such as vendor management will appear here when your role
                  allows them.
                </p>
              )}
            </article>
          </div>

          {user?.role === 'admin' && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Compliance snapshot
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    The dashboard now surfaces the current vendor compliance mix from the backend.
                  </p>
                </div>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  to="/vendors"
                >
                  Review vendors
                </Link>
              </div>

              {vendorsError && (
                <div
                  className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  role="alert"
                >
                  {vendorsError}
                </div>
              )}

              {isLoadingVendors ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Loading compliance summary...
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Vendors tracked
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">{vendors.length}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Supplier records available for document management.
                    </p>
                  </article>
                  <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                      Compliant
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {compliantVendorsCount}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Vendors with the required valid documentation on file.
                    </p>
                  </article>
                  <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
                      Needs attention
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {nonCompliantVendorsCount}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Vendors missing required evidence or carrying expired documents.
                    </p>
                  </article>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-3xl bg-gradient-to-br from-sky-100 via-white to-indigo-100 p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            What&apos;s next
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Operational entry point</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The authenticated workspace now exposes vendor records, document uploads, file
            downloads and a live compliance snapshot instead of stopping at a placeholder.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
