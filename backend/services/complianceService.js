const db = require('../config/db');

const DEFAULT_REQUIRED_DOCUMENT_TYPES = ['insurance', 'license'];

const normalizeType = (value) => value.trim().toLowerCase();

const getRequiredDocumentTypes = () => {
  const rawValue = process.env.REQUIRED_DOCUMENT_TYPES;

  if (!rawValue || rawValue.trim().length === 0) {
    return DEFAULT_REQUIRED_DOCUMENT_TYPES;
  }

  const parsedTypes = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeType);

  return parsedTypes.length > 0 ? parsedTypes : DEFAULT_REQUIRED_DOCUMENT_TYPES;
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const getNonExpiredDocumentsForVendor = async (vendorId) => {
  return db('documents')
    .select('type')
    .where({ vendor_id: vendorId })
    .andWhere((builder) => {
      builder.whereNull('expires_at').orWhere('expires_at', '>=', getTodayDate());
    });
};

const getComplianceStatusForVendor = async (vendorId) => {
  const requiredTypes = getRequiredDocumentTypes();
  const documents = await getNonExpiredDocumentsForVendor(vendorId);
  const availableTypes = new Set(documents.map((document) => normalizeType(document.type)));

  const isCompliant = requiredTypes.every((type) => availableTypes.has(type));

  return isCompliant ? 'Compliant' : 'Non-Compliant';
};

const syncVendorComplianceStatus = async (vendorId) => {
  const nextStatus = await getComplianceStatusForVendor(vendorId);

  await db('vendors')
    .where({ id: vendorId })
    .update({
      status: nextStatus,
      updated_at: db.fn.now(),
    });

  return nextStatus;
};

const syncVendorComplianceStatuses = async (vendorIds = []) => {
  await Promise.all(vendorIds.map((vendorId) => syncVendorComplianceStatus(vendorId)));
};

module.exports = {
  DEFAULT_REQUIRED_DOCUMENT_TYPES,
  getRequiredDocumentTypes,
  syncVendorComplianceStatus,
  syncVendorComplianceStatuses,
};
