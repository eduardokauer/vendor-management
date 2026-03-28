const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const documentController = require('../controllers/documentController');
const { validateUuidParam } = require('../middleware/validation');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.post(
  '/upload/:vendorId',
  validateUuidParam('vendorId'),
  documentController.uploadDocumentMiddleware,
  documentController.uploadVendorDocument
);
router.get('/:documentId/download', validateUuidParam('documentId'), documentController.downloadDocument);

module.exports = router;
