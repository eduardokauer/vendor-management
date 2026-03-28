import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { getApiErrorMessage, VENDOR_STATUSES } from '../services/api';

const validationSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  contact_email: yup
    .string()
    .trim()
    .email('Contact email must be a valid email')
    .required('Contact email is required'),
  status: yup
    .string()
    .required('Status is required')
    .oneOf(VENDOR_STATUSES, `Status must be one of: ${VENDOR_STATUSES.join(', ')}`),
});

const EMPTY_VALUES = {
  name: '',
  contact_email: '',
  status: 'Non-Compliant',
};

export default function VendorForm({
  cancelTo,
  description,
  initialValues,
  onSubmit,
  submitLabel,
  title,
}) {
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm({
    defaultValues: EMPTY_VALUES,
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    reset({
      ...EMPTY_VALUES,
      ...initialValues,
    });
  }, [initialValues, reset]);

  const handleFormSubmit = async (values) => {
    clearErrors();

    try {
      await onSubmit({
        name: values.name.trim(),
        contact_email: values.contact_email.trim(),
        status: values.status,
      });
    } catch (error) {
      const validationErrors = error.response?.data?.errors;

      if (validationErrors && typeof validationErrors === 'object') {
        Object.entries(validationErrors).forEach(([field, message]) => {
          if (field === 'body') {
            setError('root.server', { message, type: 'server' });
            return;
          }

          setError(field, { message, type: 'server' });
        });
        return;
      }

      setError('root.server', {
        message: getApiErrorMessage(error, 'Could not save vendor'),
        type: 'server',
      });
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
          Vendor details
        </p>
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="name">
              Name
            </label>
            <input
              {...register('name')}
              className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              id="name"
              type="text"
            />
            {errors.name && <p className="mt-2 text-sm text-rose-600">{errors.name.message}</p>}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="contact_email"
            >
              Contact email
            </label>
            <input
              {...register('contact_email')}
              className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              id="contact_email"
              type="email"
            />
            {errors.contact_email && (
              <p className="mt-2 text-sm text-rose-600">{errors.contact_email.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="status">
            Status
          </label>
          <select
            {...register('status')}
            className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            id="status"
          >
            {VENDOR_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {errors.status && <p className="mt-2 text-sm text-rose-600">{errors.status.message}</p>}
        </div>

        {errors.root?.server && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {errors.root.server.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            to={cancelTo}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

VendorForm.propTypes = {
  cancelTo: PropTypes.string,
  description: PropTypes.string.isRequired,
  initialValues: PropTypes.shape({
    contact_email: PropTypes.string,
    name: PropTypes.string,
    status: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

VendorForm.defaultProps = {
  cancelTo: '/vendors',
  initialValues: EMPTY_VALUES,
};
