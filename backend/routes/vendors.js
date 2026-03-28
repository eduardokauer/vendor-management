// routes/vendors.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const vendorController = require('../controllers/vendorController');

router.use(authMiddleware, requireRole('admin'));

router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.post('/:id/check-compliance', vendorController.checkVendorCompliance);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
