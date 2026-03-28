// controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const VALID_ROLES = ['admin', 'vendor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateAuthPayload = (payload = {}, { mode = 'register' } = {}) => {
  const errors = {};
  const sanitized = {};

  if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
    errors.email = 'email is required';
  } else if (!EMAIL_REGEX.test(payload.email.trim())) {
    errors.email = 'email must be a valid email';
  } else {
    sanitized.email = payload.email.trim().toLowerCase();
  }

  if (typeof payload.password !== 'string' || payload.password.trim().length === 0) {
    errors.password = 'password is required';
  } else if (mode === 'register' && payload.password.trim().length < 8) {
    errors.password = 'password must be at least 8 characters';
  } else {
    sanitized.password = payload.password;
  }

  if (mode === 'register') {
    if (payload.role !== undefined) {
      if (!VALID_ROLES.includes(payload.role)) {
        errors.role = `role must be one of: ${VALID_ROLES.join(', ')}`;
      } else {
        sanitized.role = payload.role;
      }
    } else {
      sanitized.role = 'vendor';
    }
  }

  return {
    errors,
    sanitized,
  };
};

// Register new user
exports.registerUser = async (req, res) => {
  const { errors, sanitized } = validateAuthPayload(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  const { email, password, role } = sanitized;

  try {
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userId = uuidv4();
    await db('users').insert({
      id: userId,
      email,
      password: hashedPassword,
      role: role || 'vendor',
    });

    // Create JWT token
    const payload = {
      user: {
        id: userId,
        email,
        role: role || 'vendor'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ token });
      }
    );
  } catch (err) {
    console.error('Error in user registration:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  const { errors, sanitized } = validateAuthPayload(req.body, { mode: 'login' });

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  const { email, password } = sanitized;

  try {
    // Check if user exists
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Error in user login:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'role')
      .first();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error getting current user:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
