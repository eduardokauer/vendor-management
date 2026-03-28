const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/:documentId/download', documentController.downloadDocument);

module.exports = router;
