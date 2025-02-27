// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test database connection
app.use(async (req, res, next) => {
  try {
    await db.raw('SELECT 1');
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).json({ message: 'Database connection error' });
  }
});

// Routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World from VMS Backend!' });
});

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Vendor routes
app.use('/api/vendors', require('./routes/vendors'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle uncaught errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});