// routes/vendors.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../config/db');

// Protected route - Get all vendors
router.get('/', authMiddleware, async (req, res) => {
  try {
    const vendors = await db('vendors').select('*');
    res.json(vendors);
  } catch (err) {
    console.error('Error fetching vendors:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route - Get vendor by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const vendor = await db('vendors').where({ id: req.params.id }).first();
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    res.json(vendor);
  } catch (err) {
    console.error('Error fetching vendor:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;