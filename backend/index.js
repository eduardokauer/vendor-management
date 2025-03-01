// backend/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://frontend:5173',
    'http://172.19.0.0/24' // Your Docker subnet
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Database connection check middleware
app.use(async (req, res, next) => {
  try {
    await db.raw('SELECT 1');
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ message: 'Database connection error' });
  }
});

// Routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World from VMS Backend!' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendors', require('./routes/vendors'));

// Server instance
let server;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
const shutdown = () => {
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Export for testing
module.exports = { app, server };