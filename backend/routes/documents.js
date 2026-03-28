const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.post('/upload/:vendorId', documentController.uploadDocumentMiddleware, documentController.uploadVendorDocument);
router.get('/:documentId/download', documentController.downloadDocument);

module.exports = router;
