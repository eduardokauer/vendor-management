const jwt = require('jsonwebtoken');
const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');

const ADMIN_USER = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'admin@example.com',
  role: 'admin',
};

const VENDOR_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'test@example.com',
  role: 'vendor',
};

const createToken = (user) =>
  jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '1h' });

describe('Vendors API', () => {
  const adminToken = createToken(ADMIN_USER);
  const vendorToken = createToken(VENDOR_USER);

  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();

    await db('users').insert({
      id: ADMIN_USER.id,
      email: ADMIN_USER.email,
      password: '$2b$10$tprMIzwwmMQz46f2hxlsgObyTLtUW58O2P3dZlPmGfJKUb6ijgdGe',
      role: ADMIN_USER.role,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  });

  beforeEach(async () => {
    await db('vendors').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('authorization', () => {
    test('rejects requests without a token', async () => {
      const res = await request(app).get('/api/vendors');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'No token, authorization denied' });
    });

    test('rejects vendor users from reading vendors', async () => {
      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Forbidden' });
    });

    test('rejects malformed vendor IDs before hitting the controller', async () => {
      const res = await request(app)
        .get('/api/vendors/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          id: 'id must be a valid UUID',
        },
      });
    });
  });

  describe('POST /api/vendors', () => {
    test('creates a vendor for admin users', async () => {
      const payload = {
        name: '  ACME Supplies  ',
        contact_email: 'CONTACT@acme.com',
        status: 'Compliant',
      };

      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'ACME Supplies',
        contact_email: 'contact@acme.com',
        status: 'Compliant',
      });
      expect(res.body).toHaveProperty('id');

      const vendorInDb = await db('vendors').where({ id: res.body.id }).first();
      expect(vendorInDb).toBeTruthy();
    });

    test('returns validation errors for invalid payloads', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          contact_email: 'invalid-email',
          status: 'Pending',
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          name: 'name is required',
          contact_email: 'contact_email must be a valid email',
          status: 'status must be one of: Compliant, Non-Compliant',
        },
      });
    });
  });

  describe('PUT /api/vendors/:id', () => {
    test('updates an existing vendor for admin users', async () => {
      const [existingVendor] = await db('vendors')
        .insert({
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Legacy Vendor',
          contact_email: 'legacy@example.com',
          status: 'Non-Compliant',
        })
        .returning('*');

      const res = await request(app)
        .put(`/api/vendors/${existingVendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Vendor',
          status: 'Compliant',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: existingVendor.id,
        name: 'Updated Vendor',
        contact_email: 'legacy@example.com',
        status: 'Compliant',
      });
    });

    test('returns 400 when no updatable fields are sent', async () => {
      const [existingVendor] = await db('vendors')
        .insert({
          id: '44444444-4444-4444-4444-444444444444',
          name: 'Vendor',
          contact_email: 'vendor@example.com',
          status: 'Non-Compliant',
        })
        .returning('*');

      const res = await request(app)
        .put(`/api/vendors/${existingVendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          body: 'At least one updatable field is required',
        },
      });
    });

    test('returns validation errors for invalid updates', async () => {
      const [existingVendor] = await db('vendors')
        .insert({
          id: '45454545-4545-4545-4545-454545454545',
          name: 'Vendor',
          contact_email: 'vendor@example.com',
          status: 'Non-Compliant',
        })
        .returning('*');

      const res = await request(app)
        .put(`/api/vendors/${existingVendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contact_email: 'invalid-email',
          status: 'Pending',
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          contact_email: 'contact_email must be a valid email',
          status: 'status must be one of: Compliant, Non-Compliant',
        },
      });
    });

    test('returns 404 when the vendor does not exist', async () => {
      const res = await request(app)
        .put('/api/vendors/55555555-5555-5555-5555-555555555555')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Vendor',
        });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Vendor not found' });
    });

    test('returns 400 when the vendor ID is malformed', async () => {
      const res = await request(app)
        .put('/api/vendors/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Vendor',
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          id: 'id must be a valid UUID',
        },
      });
    });
  });

  describe('DELETE /api/vendors/:id', () => {
    test('deletes an existing vendor for admin users', async () => {
      await db('vendors').insert({
        id: '66666666-6666-6666-6666-666666666666',
        name: 'Delete Me',
        contact_email: 'delete@example.com',
        status: 'Non-Compliant',
      });

      const res = await request(app)
        .delete('/api/vendors/66666666-6666-6666-6666-666666666666')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      const vendorInDb = await db('vendors')
        .where({ id: '66666666-6666-6666-6666-666666666666' })
        .first();

      expect(vendorInDb).toBeUndefined();
    });

    test('returns 404 when deleting a missing vendor', async () => {
      const res = await request(app)
        .delete('/api/vendors/77777777-7777-7777-7777-777777777777')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Vendor not found' });
    });

    test('returns 400 when deleting with a malformed vendor ID', async () => {
      const res = await request(app)
        .delete('/api/vendors/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          id: 'id must be a valid UUID',
        },
      });
    });
  });

  describe('POST /api/vendors/:id/check-compliance', () => {
    test('returns 400 when the vendor ID is malformed', async () => {
      const res = await request(app)
        .post('/api/vendors/not-a-uuid/check-compliance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          id: 'id must be a valid UUID',
        },
      });
    });
  });
});
