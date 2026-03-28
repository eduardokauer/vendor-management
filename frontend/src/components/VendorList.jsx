import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ComplianceBadge from './ComplianceBadge';

function VendorActions({ deletingVendorId, onDelete, vendor }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        className="rounded-full border border-sky-200 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
        to={`/vendors/${vendor.id}/documents`}
      >
        Documents
      </Link>
      <Link
        className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
        to={`/vendors/${vendor.id}/edit`}
      >
        Edit
      </Link>
      <button
        aria-label={`Remove ${vendor.name}`}
        className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
        disabled={deletingVendorId === vendor.id}
        onClick={() => onDelete(vendor)}
        type="button"
      >
        {deletingVendorId === vendor.id ? 'Removing...' : 'Remove'}
      </button>
    </div>
  );
}

VendorActions.propTypes = {
  deletingVendorId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  vendor: PropTypes.shape({
    contact_email: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
};

VendorActions.defaultProps = {
  deletingVendorId: null,
};

export default function VendorList({ deletingVendorId, onDelete, vendors }) {
  if (vendors.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">No vendors registered yet</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create the first vendor to start managing your supplier base.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          to="/vendors/new"
        >
          Create New Vendor
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                ID
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact Email
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {vendors.map((vendor) => (
              <tr className="align-top" key={vendor.id}>
                <td className="px-6 py-4 text-sm text-slate-500">{vendor.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{vendor.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{vendor.contact_email}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <ComplianceBadge size="sm" status={vendor.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <VendorActions
                      deletingVendorId={deletingVendorId}
                      onDelete={onDelete}
                      vendor={vendor}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-4 md:hidden">
        {vendors.map((vendor) => (
          <article
            className="rounded-2xl border border-slate-200 p-4 shadow-sm"
            key={vendor.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vendor
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{vendor.name}</h2>
              </div>
              <ComplianceBadge size="sm" status={vendor.status} />
            </div>

            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <dt className="font-medium text-slate-500">ID</dt>
                <dd>{vendor.id}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Contact Email</dt>
                <dd>{vendor.contact_email}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <VendorActions
                deletingVendorId={deletingVendorId}
                onDelete={onDelete}
                vendor={vendor}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

VendorList.propTypes = {
  deletingVendorId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  vendors: PropTypes.arrayOf(
    PropTypes.shape({
      contact_email: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ).isRequired,
};

VendorList.defaultProps = {
  deletingVendorId: null,
};
