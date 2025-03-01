const { app } = require('../index');
const request = require('supertest');
const db = require('../config/db');

describe('Authentication API', () => {
  // Seeded user credentials (must match seed data)
  const SEEDED_USER = {
    email: 'test@example.com',
    password: 'password', // Must match seed file password
    role: 'vendor'
  };

  // Test user for registration
  const TEST_USER = {
    email: `test-${Date.now()}@example.com`,
    password: 'ValidPass123!',
    role: 'vendor'
  };

  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  afterAll(async () => {
    // Improved cleanup - deletes all test users matching the pattern
    await db('users')
      .where('email', 'like', 'test-%@example.com')
      .del();
  
    // Destroy database connection
    await db.destroy();
  });

  describe('POST /register', () => {
    test('should create new user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(TEST_USER);
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
    });

    test('should reject duplicate registration', async () => {
      // First registration
      await request(app).post('/api/auth/register').send(TEST_USER);
      
      // Second attempt
      const res = await request(app)
        .post('/api/auth/register')
        .send(TEST_USER);
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'User already exists');
    });
  });

  describe('POST /login', () => {
    test('should authenticate with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: SEEDED_USER.email,
          password: SEEDED_USER.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    test('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: SEEDED_USER.email,
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });
  });
});