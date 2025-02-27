// config/db.js
const knex = require('knex');
const knexConfig = require('../knexfile');

// Determine which environment to use
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// Initialize knex connection
const db = knex(config);

module.exports = db;