// routes/vendors.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/validation');
const vendorController = require('../controllers/vendorController');

router.use(authMiddleware, requireRole('admin'));

router.get('/', vendorController.getAllVendors);
router.get('/:id', validateUuidParam('id'), vendorController.getVendorById);
router.post('/', vendorController.createVendor);
router.put('/:id', validateUuidParam('id'), vendorController.updateVendor);
router.post('/:id/check-compliance', validateUuidParam('id'), vendorController.checkVendorCompliance);
router.delete('/:id', validateUuidParam('id'), vendorController.deleteVendor);

module.exports = router;
