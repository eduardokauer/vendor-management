const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { syncVendorComplianceStatus, syncVendorComplianceStatuses } = require('../services/complianceService');

const VALID_STATUSES = ['Compliant', 'Non-Compliant'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const validateVendorPayload = (payload = {}, { partial = false } = {}) => {
  const errors = {};
  const sanitized = {};

  if (!partial || hasOwn(payload, 'name')) {
    if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      errors.name = 'name is required';
    } else {
      sanitized.name = payload.name.trim();
    }
  }

  if (!partial || hasOwn(payload, 'contact_email')) {
    if (typeof payload.contact_email !== 'string' || payload.contact_email.trim().length === 0) {
      errors.contact_email = 'contact_email is required';
    } else if (!EMAIL_REGEX.test(payload.contact_email.trim())) {
      errors.contact_email = 'contact_email must be a valid email';
    } else {
      sanitized.contact_email = payload.contact_email.trim().toLowerCase();
    }
  }

  if (hasOwn(payload, 'status')) {
    if (!VALID_STATUSES.includes(payload.status)) {
      errors.status = `status must be one of: ${VALID_STATUSES.join(', ')}`;
    } else {
      sanitized.status = payload.status;
    }
  } else if (!partial) {
    sanitized.status = 'Non-Compliant';
  }

  return {
    errors,
    sanitized,
  };
};

const handleServerError = (res, error, message) => {
  console.error(message, error.message);
  return res.status(500).json({ message: 'Server error' });
};

exports.getAllVendors = async (req, res) => {
  try {
    const vendorIds = await db('vendors').pluck('id');

    if (vendorIds.length > 0) {
      await syncVendorComplianceStatuses(vendorIds);
    }

    const vendors = await db('vendors').select('*');
    return res.json(vendors);
  } catch (error) {
    return handleServerError(res, error, 'Error fetching vendors:');
  }
};

exports.getVendorById = async (req, res) => {
  try {
    await syncVendorComplianceStatus(req.params.id);
    const vendor = await db('vendors').where({ id: req.params.id }).first();

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.json(vendor);
  } catch (error) {
    return handleServerError(res, error, 'Error fetching vendor:');
  }
};

exports.createVendor = async (req, res) => {
  const { errors, sanitized } = validateVendorPayload(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  try {
    const [vendor] = await db('vendors')
      .insert({
        id: uuidv4(),
        ...sanitized,
      })
      .returning('*');

    return res.status(201).json(vendor);
  } catch (error) {
    return handleServerError(res, error, 'Error creating vendor:');
  }
};

exports.updateVendor = async (req, res) => {
  const { errors, sanitized } = validateVendorPayload(req.body, { partial: true });

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  if (Object.keys(sanitized).length === 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: {
        body: 'At least one updatable field is required',
      },
    });
  }

  try {
    const [vendor] = await db('vendors')
      .where({ id: req.params.id })
      .update({
        ...sanitized,
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.json(vendor);
  } catch (error) {
    return handleServerError(res, error, 'Error updating vendor:');
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const deletedCount = await db('vendors').where({ id: req.params.id }).del();

    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return handleServerError(res, error, 'Error deleting vendor:');
  }
};

exports.checkVendorCompliance = async (req, res) => {
  try {
    const vendor = await db('vendors').where({ id: req.params.id }).first();

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const status = await syncVendorComplianceStatus(req.params.id);
    const updatedVendor = await db('vendors').where({ id: req.params.id }).first();

    return res.json({
      message: 'Compliance status updated',
      status,
      vendor: updatedVendor,
    });
  } catch (error) {
    return handleServerError(res, error, 'Error checking vendor compliance:');
  }
};
