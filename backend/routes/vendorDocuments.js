const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const documentController = require('../controllers/documentController');
const { validateUuidParam } = require('../middleware/validation');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireRole('admin'));
router.use(validateUuidParam('vendorId'));

router.get('/', documentController.listVendorDocuments);
router.post('/', documentController.uploadDocumentMiddleware, documentController.uploadVendorDocument);

module.exports = router;
