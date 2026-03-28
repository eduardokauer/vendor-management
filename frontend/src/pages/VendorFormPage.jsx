import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import VendorForm from '../components/VendorForm';
import {
  createVendor,
  getApiErrorMessage,
  getVendorById,
  updateVendor,
} from '../services/api';

const EMPTY_VENDOR = {
  name: '',
  contact_email: '',
  status: 'Non-Compliant',
};

export default function VendorFormPage() {
  const navigate = useNavigate();
  const { vendorId } = useParams();
  const isEditing = Boolean(vendorId);
  const [initialValues, setInitialValues] = useState(EMPTY_VENDOR);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    if (!isEditing) {
      return undefined;
    }

    let isMounted = true;

    const loadVendor = async () => {
      try {
        const vendor = await getVendorById(vendorId);

        if (isMounted) {
          setInitialValues({
            contact_email: vendor.contact_email,
            name: vendor.name,
            status: vendor.status,
          });
          setPageError('');
        }
      } catch (error) {
        if (isMounted) {
          setPageError(getApiErrorMessage(error, 'Could not load vendor'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVendor();

    return () => {
      isMounted = false;
    };
  }, [isEditing, vendorId]);

  const handleSubmit = async (values) => {
    if (isEditing) {
      await updateVendor(vendorId, values);
      navigate('/vendors', {
        replace: true,
        state: { notice: 'Vendor updated successfully.' },
      });
      return;
    }

    await createVendor(values);
    navigate('/vendors', {
      replace: true,
      state: { notice: 'Vendor created successfully.' },
    });
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Vendor operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            {isEditing ? 'Edit Vendor' : 'Create Vendor'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {isEditing
              ? 'Update the selected vendor and persist the changes in the backend API.'
              : 'Register a new vendor with the required operational fields.'}
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
          to="/vendors"
        >
          Back to vendors
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-600">Loading vendor details...</p>
        </div>
      ) : pageError ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </p>
        </div>
      ) : (
        <VendorForm
          description={
            isEditing
              ? 'Adjust the profile details below and save the updated vendor record.'
              : 'Fill in the vendor details below to create the first version of the record.'
          }
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel={isEditing ? 'Save changes' : 'Create vendor'}
          title={isEditing ? 'Edit vendor details' : 'New vendor'}
        />
      )}
    </AppShell>
  );
}
