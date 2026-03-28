const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'documents');

const ADMIN_USER = {
  id: '88888888-8888-8888-8888-888888888888',
  email: 'documents-admin@example.com',
  role: 'admin',
};

const VENDOR_USER = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'documents-vendor@example.com',
  role: 'vendor',
};

const createToken = (user) =>
  jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '1h' });

const createVendor = async () => {
  const [vendor] = await db('vendors')
    .insert({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Atlas Build',
      contact_email: 'atlas@example.com',
      status: 'Non-Compliant',
    })
    .returning('*');

  return vendor;
};

describe('Documents API', () => {
  const adminToken = createToken(ADMIN_USER);
  const vendorToken = createToken(VENDOR_USER);
  const binaryParser = (res, callback) => {
    const chunks = [];

    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();

    await db('users').insert([
      {
        id: ADMIN_USER.id,
        email: ADMIN_USER.email,
        password: '$2b$10$tprMIzwwmMQz46f2hxlsgObyTLtUW58O2P3dZlPmGfJKUb6ijgdGe',
        role: ADMIN_USER.role,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      },
      {
        id: VENDOR_USER.id,
        email: VENDOR_USER.email,
        password: '$2b$10$tprMIzwwmMQz46f2hxlsgObyTLtUW58O2P3dZlPmGfJKUb6ijgdGe',
        role: VENDOR_USER.role,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      },
    ]);
  });

  beforeEach(async () => {
    await db('documents').del();
    await db('vendors').del();
    await fs.promises.rm(UPLOAD_DIR, { recursive: true, force: true });
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.promises.rm(path.join(__dirname, '..', 'uploads'), { recursive: true, force: true });
    await db.destroy();
  });

  describe('authorization', () => {
    test('rejects requests without a token', async () => {
      const vendor = await createVendor();

      const res = await request(app).get(`/api/vendors/${vendor.id}/documents`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'No token, authorization denied' });
    });

    test('rejects vendor users from managing documents', async () => {
      const vendor = await createVendor();

      const res = await request(app)
        .get(`/api/vendors/${vendor.id}/documents`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Forbidden' });
    });

    test('rejects malformed vendor IDs before listing documents', async () => {
      const res = await request(app)
        .get('/api/vendors/not-a-uuid/documents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          vendorId: 'vendorId must be a valid UUID',
        },
      });
    });
  });

  describe('document lifecycle', () => {
    test('uploads, lists and downloads documents while updating vendor compliance', async () => {
      const vendor = await createVendor();

      const insuranceRes = await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'insurance')
        .field('expires_at', '2099-12-31')
        .attach('file', Buffer.from('insurance-file'), 'insurance.pdf');

      expect(insuranceRes.status).toBe(201);
      expect(insuranceRes.body).toMatchObject({
        vendor_id: vendor.id,
        type: 'insurance',
        vendor_status: 'Non-Compliant',
      });

      const licenseRes = await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'license')
        .field('expires_at', '2099-12-31')
        .attach('file', Buffer.from('license-file'), 'license.pdf');

      expect(licenseRes.status).toBe(201);
      expect(licenseRes.body).toMatchObject({
        vendor_id: vendor.id,
        type: 'license',
        vendor_status: 'Compliant',
      });

      const updatedVendor = await db('vendors').where({ id: vendor.id }).first();
      expect(updatedVendor.status).toBe('Compliant');

      const listRes = await request(app)
        .get(`/api/vendors/${vendor.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(2);
      expect(listRes.body.map((document) => document.type).sort()).toEqual(['insurance', 'license']);

      const downloadRes = await request(app)
        .get(`/api/documents/${licenseRes.body.id}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-disposition']).toContain('attachment');
      expect(downloadRes.body.toString()).toBe('license-file');
    });

    test('keeps the vendor as non-compliant when a required document is expired', async () => {
      const vendor = await createVendor();

      await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'insurance')
        .field('expires_at', '2099-12-31')
        .attach('file', Buffer.from('insurance-file'), 'insurance.pdf');

      const expiredLicenseRes = await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'license')
        .field('expires_at', '2000-01-01')
        .attach('file', Buffer.from('expired-license-file'), 'expired-license.pdf');

      expect(expiredLicenseRes.status).toBe(201);
      expect(expiredLicenseRes.body.vendor_status).toBe('Non-Compliant');

      const vendorRes = await request(app)
        .get(`/api/vendors/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(vendorRes.status).toBe(200);
      expect(vendorRes.body.status).toBe('Non-Compliant');
    });

    test('returns validation errors for missing upload data', async () => {
      const vendor = await createVendor();

      const res = await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', '');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          type: 'type is required',
          file: 'file is required',
        },
      });
    });

    test('returns 404 when uploading a document for a missing vendor', async () => {
      const res = await request(app)
        .post('/api/documents/upload/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'insurance')
        .attach('file', Buffer.from('insurance-file'), 'insurance.pdf');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Vendor not found' });
    });

    test('returns 404 when downloading a missing document', async () => {
      const res = await request(app)
        .get('/api/documents/cccccccc-cccc-cccc-cccc-cccccccccccc/download')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Document not found' });
    });

    test('returns validation errors for an invalid expiry date', async () => {
      const vendor = await createVendor();

      const res = await request(app)
        .post(`/api/documents/upload/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'insurance')
        .field('expires_at', 'not-a-date')
        .attach('file', Buffer.from('insurance-file'), 'insurance.pdf');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          expires_at: 'expires_at must be a valid date',
        },
      });
    });

    test('returns 400 when uploading with a malformed vendor ID', async () => {
      const res = await request(app)
        .post('/api/documents/upload/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'insurance')
        .attach('file', Buffer.from('insurance-file'), 'insurance.pdf');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          vendorId: 'vendorId must be a valid UUID',
        },
      });
    });

    test('returns 400 when downloading with a malformed document ID', async () => {
      const res = await request(app)
        .get('/api/documents/not-a-uuid/download')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Validation failed',
        errors: {
          documentId: 'documentId must be a valid UUID',
        },
      });
    });

    test('allows manual compliance refresh for admin users', async () => {
      const vendor = await createVendor();

      await db('documents').insert([
        {
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          vendor_id: vendor.id,
          type: 'insurance',
          file_url: 'uploads/documents/manual-insurance.txt',
          expires_at: '2099-12-31',
        },
        {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          vendor_id: vendor.id,
          type: 'license',
          file_url: 'uploads/documents/manual-license.txt',
          expires_at: '2099-12-31',
        },
      ]);

      const res = await request(app)
        .post(`/api/vendors/${vendor.id}/check-compliance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'Compliance status updated',
        status: 'Compliant',
        vendor: {
          id: vendor.id,
          status: 'Compliant',
        },
      });
    });

    test('returns 400 when manually refreshing compliance with a malformed vendor ID', async () => {
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
