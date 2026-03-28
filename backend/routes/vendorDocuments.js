const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireRole('admin'));

router.get('/', documentController.listVendorDocuments);
router.post('/', documentController.uploadDocumentMiddleware, documentController.uploadVendorDocument);

module.exports = router;
