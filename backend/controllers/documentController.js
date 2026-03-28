const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const db = require('../config/db');
const { syncVendorComplianceStatus } = require('../services/complianceService');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'documents');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '');
    callback(null, `${Date.now()}-${uuidv4()}${extension}`);
  },
});

const upload = multer({ storage });

const removeFileIfExists = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error removing uploaded file:', error.message);
    }
  }
};

const validateDocumentPayload = ({ type, expires_at }) => {
  const errors = {};
  const sanitized = {};

  if (typeof type !== 'string' || type.trim().length === 0) {
    errors.type = 'type is required';
  } else {
    sanitized.type = type.trim().toLowerCase();
  }

  if (expires_at !== undefined && expires_at !== null && String(expires_at).trim().length > 0) {
    const parsedDate = new Date(expires_at);

    if (Number.isNaN(parsedDate.getTime())) {
      errors.expires_at = 'expires_at must be a valid date';
    } else {
      sanitized.expires_at = parsedDate.toISOString().slice(0, 10);
    }
  } else {
    sanitized.expires_at = null;
  }

  return { errors, sanitized };
};

const ensureVendorExists = async (vendorId) => {
  return db('vendors').where({ id: vendorId }).first();
};

const uploadDocumentMiddleware = upload.single('file');

const handleServerError = (res, error, message) => {
  console.error(message, error.message);
  return res.status(500).json({ message: 'Server error' });
};

const buildStoredPath = (absolutePath) =>
  path.relative(path.join(__dirname, '..'), absolutePath).replaceAll(path.sep, '/');

exports.uploadDocumentMiddleware = uploadDocumentMiddleware;

exports.listVendorDocuments = async (req, res) => {
  try {
    const vendor = await ensureVendorExists(req.params.vendorId);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const documents = await db('documents')
      .where({ vendor_id: req.params.vendorId })
      .orderBy('uploaded_at', 'desc');

    await syncVendorComplianceStatus(req.params.vendorId);

    return res.json(documents);
  } catch (error) {
    return handleServerError(res, error, 'Error fetching documents:');
  }
};

exports.uploadVendorDocument = async (req, res) => {
  const uploadedFilePath = req.file?.path;
  const { errors, sanitized } = validateDocumentPayload(req.body);

  if (!req.file) {
    errors.file = 'file is required';
  }

  if (Object.keys(errors).length > 0) {
    await removeFileIfExists(uploadedFilePath);

    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  try {
    const vendor = await ensureVendorExists(req.params.vendorId);

    if (!vendor) {
      await removeFileIfExists(uploadedFilePath);
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const [document] = await db('documents')
      .insert({
        id: uuidv4(),
        vendor_id: req.params.vendorId,
        type: sanitized.type,
        file_url: buildStoredPath(req.file.path),
        expires_at: sanitized.expires_at,
      })
      .returning('*');

    const vendorStatus = await syncVendorComplianceStatus(req.params.vendorId);

    return res.status(201).json({
      ...document,
      vendor_status: vendorStatus,
    });
  } catch (error) {
    await removeFileIfExists(uploadedFilePath);
    return handleServerError(res, error, 'Error uploading document:');
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const document = await db('documents').where({ id: req.params.documentId }).first();

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const absolutePath = path.join(__dirname, '..', document.file_url);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Document file not found' });
    }

    return res.download(absolutePath, path.basename(document.file_url));
  } catch (error) {
    return handleServerError(res, error, 'Error downloading document:');
  }
};
