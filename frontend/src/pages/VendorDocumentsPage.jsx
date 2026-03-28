import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ComplianceBadge from '../components/ComplianceBadge';
import {
  checkVendorCompliance,
  downloadDocumentFile,
  getApiErrorMessage,
  getVendorById,
  getVendorDocuments,
  uploadVendorDocument,
} from '../services/api';

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const formatDate = (value, fallback = 'Not provided') => {
  if (!value) {
    return fallback;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return dateFormatter.format(parsedDate);
};

const isDocumentExpired = (expiresAt) => {
  if (!expiresAt) {
    return false;
  }

  return new Date(`${expiresAt}T23:59:59`).getTime() < Date.now();
};

const getExpiryMeta = (expiresAt) => {
  if (!expiresAt) {
    return {
      className: 'bg-slate-100 text-slate-700',
      label: 'No expiry',
    };
  }

  const expiresAtTimestamp = new Date(`${expiresAt}T23:59:59`).getTime();

  if (Number.isNaN(expiresAtTimestamp)) {
    return {
      className: 'bg-slate-100 text-slate-700',
      label: 'Unknown',
    };
  }

  if (expiresAtTimestamp < Date.now()) {
    return {
      className: 'bg-rose-100 text-rose-700',
      label: 'Expired',
    };
  }

  const daysUntilExpiry = Math.ceil((expiresAtTimestamp - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 30) {
    return {
      className: 'bg-amber-100 text-amber-800',
      label: 'Expiring soon',
    };
  }

  return {
    className: 'bg-emerald-100 text-emerald-800',
    label: 'Active',
  };
};

const getDetailedErrorMessage = (error, fallbackMessage) => {
  const validationErrors = error.response?.data?.errors;

  if (validationErrors && typeof validationErrors === 'object') {
    return Object.values(validationErrors).join('. ');
  }

  return getApiErrorMessage(error, fallbackMessage);
};

const triggerBrowserDownload = ({ blob, filename }) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename || 'document';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export default function VendorDocumentsPage() {
  const { vendorId } = useParams();
  const [vendor, setVendor] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageNotice, setPageNotice] = useState('');
  const expiredDocumentsCount = documents.filter((document) =>
    isDocumentExpired(document.expires_at)
  ).length;

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const [vendorRecord, documentRecords] = await Promise.all([
          getVendorById(vendorId),
          getVendorDocuments(vendorId),
        ]);

        if (isMounted) {
          setVendor(vendorRecord);
          setDocuments(documentRecords);
          setPageError('');
        }
      } catch (error) {
        if (isMounted) {
          setPageError(getApiErrorMessage(error, 'Could not load vendor documents'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  const handleUpload = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPageError('');
    setPageNotice('');

    try {
      const uploadedDocument = await uploadVendorDocument(vendorId, {
        expires_at: expiresAt,
        file: selectedFile,
        type: documentType,
      });

      setDocuments((currentDocuments) => [uploadedDocument, ...currentDocuments]);
      setVendor((currentVendor) =>
        currentVendor
          ? {
              ...currentVendor,
              status: uploadedDocument.vendor_status ?? currentVendor.status,
            }
          : currentVendor
      );
      setDocumentType('');
      setExpiresAt('');
      setSelectedFile(null);
      setFileInputKey((currentKey) => currentKey + 1);
      setPageNotice(`Document "${uploadedDocument.type}" uploaded successfully.`);
    } catch (error) {
      setPageError(getDetailedErrorMessage(error, 'Could not upload document'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshCompliance = async () => {
    setIsRefreshing(true);
    setPageError('');
    setPageNotice('');

    try {
      const response = await checkVendorCompliance(vendorId);
      setVendor(response.vendor);
      setPageNotice('Compliance status refreshed from the current document set.');
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Could not refresh compliance'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownload = async (document) => {
    setDownloadingDocumentId(document.id);
    setPageError('');
    setPageNotice('');

    try {
      const filePayload = await downloadDocumentFile(document.id);
      triggerBrowserDownload(filePayload);
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Could not download document'));
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
            to="/vendors"
          >
            Back to vendors
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Document workflow
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Vendor documents</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload evidence, review expiry windows and refresh the compliance status for each
            vendor record.
          </p>
        </div>

        {vendor && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:min-w-[320px]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Current vendor
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{vendor.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{vendor.contact_email}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ComplianceBadge status={vendor.status} />
              <button
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshing}
                onClick={handleRefreshCompliance}
                type="button"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh compliance'}
              </button>
            </div>
          </section>
        )}
      </div>

      {pageNotice && (
        <div
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {pageNotice}
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
          <p className="text-sm font-medium text-slate-600">Loading document workspace...</p>
        </div>
      ) : (
        <>
          {vendor && (
            <section className="mb-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Total documents
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{documents.length}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Files currently linked to this vendor record.
                </p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Active evidence
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {documents.length - expiredDocumentsCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Documents without expiry issues as of the latest load.
                </p>
              </article>
              <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
                  Expired evidence
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {expiredDocumentsCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Upload a replacement file and refresh compliance when needed.
                </p>
              </article>
            </section>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
                Upload document
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Add a new compliance file
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use a short document type such as <span className="font-medium">insurance</span>{' '}
                or <span className="font-medium">license</span>. The backend recalculates the
                vendor compliance status after every successful upload.
              </p>

              <form className="mt-6 space-y-5" onSubmit={handleUpload}>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="document-type"
                  >
                    Document type
                  </label>
                  <input
                    className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    id="document-type"
                    onChange={(event) => setDocumentType(event.target.value)}
                    placeholder="insurance"
                    required
                    type="text"
                    value={documentType}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="document-expires-on"
                  >
                    Expires on
                  </label>
                  <input
                    className="mt-2 block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    id="document-expires-on"
                    onChange={(event) => setExpiresAt(event.target.value)}
                    type="date"
                    value={expiresAt}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="document-file">
                    File
                  </label>
                  <input
                    className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                    id="document-file"
                    key={fileInputKey}
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    required
                    type="file"
                  />
                </div>

                <button
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Uploading...' : 'Upload document'}
                </button>
              </form>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Document registry
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Uploaded files</h2>
              <p className="mt-2 text-sm text-slate-600">
                Review each file, confirm expiry windows and download the stored copy when needed.
              </p>

              {documents.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">No documents uploaded yet</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Add the first file to start tracking compliance for this vendor.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {documents.map((document) => {
                    const expiryMeta = getExpiryMeta(document.expires_at);

                    return (
                      <article
                        className="rounded-2xl border border-slate-200 p-5 shadow-sm"
                        key={document.id}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                              Document type
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">
                              {document.type}
                            </h3>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${expiryMeta.className}`}
                          >
                            {expiryMeta.label}
                          </span>
                        </div>

                        <dl className="mt-5 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
                          <div>
                            <dt className="font-medium text-slate-500">Expires on</dt>
                            <dd className="mt-1">{formatDate(document.expires_at)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-500">Uploaded at</dt>
                            <dd className="mt-1">{formatDate(document.uploaded_at)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-500">Stored file</dt>
                            <dd className="mt-1 break-all">{document.file_url}</dd>
                          </div>
                        </dl>

                        <div className="mt-5 flex justify-end">
                          <button
                            aria-label={`Download ${document.type}`}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={downloadingDocumentId === document.id}
                            onClick={() => handleDownload(document)}
                            type="button"
                          >
                            {downloadingDocumentId === document.id ? 'Downloading...' : 'Download'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
