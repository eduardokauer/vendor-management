// routes/auth.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', userController.registerUser);

// POST /api/auth/login
router.post('/login', userController.loginUser);

// GET /api/auth/me - Protected route example
router.get('/me', authMiddleware, userController.getCurrentUser);

module.exports = router;