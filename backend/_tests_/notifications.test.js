const db = require('../config/db');

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn(),
  })),
  validate: jest.fn(() => true),
}));

const cron = require('node-cron');
const { runExpirationReminderJob } = require('../jobs/expirationReminderJob');
const { runPeriodicSummaryJob } = require('../jobs/periodicSummaryJob');
const { startNotificationScheduler } = require('../services/notificationScheduler');

const baseConfig = {
  complianceSummarySchedule: '0 9 * * 1',
  emailFrom: 'notifications@vms.local',
  emailTransport: 'json',
  expirationReminderSchedule: '0 8 * * *',
  expirationReminderWindowDays: 14,
  notificationRecipients: ['ops@example.com'],
  notificationRunOnStart: false,
  notificationsEnabled: true,
};

const logger = {
  error: jest.fn(),
  info: jest.fn(),
};

describe('Notification jobs', () => {
  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  beforeEach(async () => {
    await db('documents').del();
    await db('vendors').del();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('sends expiration reminders for documents inside the configured window', async () => {
    await db('vendors').insert({
      id: '12121212-1212-1212-1212-121212121212',
      name: 'Atlas Build',
      contact_email: 'atlas@example.com',
      status: 'Non-Compliant',
    });
    await db('documents').insert([
      {
        id: '13131313-1313-1313-1313-131313131313',
        vendor_id: '12121212-1212-1212-1212-121212121212',
        type: 'insurance',
        file_url: 'uploads/documents/insurance.pdf',
        expires_at: '2026-04-02',
      },
      {
        id: '14141414-1414-1414-1414-141414141414',
        vendor_id: '12121212-1212-1212-1212-121212121212',
        type: 'license',
        file_url: 'uploads/documents/license.pdf',
        expires_at: '2026-05-10',
      },
    ]);
    const notificationService = {
      sendMail: jest.fn().mockResolvedValue({
        preview: '{"transport":"json"}',
        recipients: ['ops@example.com'],
        skipped: false,
      }),
    };

    const result = await runExpirationReminderJob({
      config: baseConfig,
      logger,
      notificationService,
      now: new Date('2026-03-27T00:00:00Z'),
    });

    expect(notificationService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('1 document'),
        text: expect.stringContaining('Atlas Build'),
        to: ['ops@example.com'],
      })
    );
    expect(result).toMatchObject({
      expiringCount: 1,
      recipients: ['ops@example.com'],
      sent: true,
    });
  });

  test('skips the expiration reminder when no document matches the window', async () => {
    const notificationService = {
      sendMail: jest.fn(),
    };

    const result = await runExpirationReminderJob({
      config: baseConfig,
      logger,
      notificationService,
      now: new Date('2026-03-27T00:00:00Z'),
    });

    expect(notificationService.sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiringCount: 0,
      sent: false,
    });
  });

  test('sends a periodic summary with vendor and expiry counts', async () => {
    await db('vendors').insert([
      {
        id: '15151515-1515-1515-1515-151515151515',
        name: 'Atlas Build',
        contact_email: 'atlas@example.com',
        status: 'Compliant',
      },
      {
        id: '16161616-1616-1616-1616-161616161616',
        name: 'Brick Supply',
        contact_email: 'brick@example.com',
        status: 'Non-Compliant',
      },
    ]);
    await db('documents').insert({
      id: '17171717-1717-1717-1717-171717171717',
      vendor_id: '15151515-1515-1515-1515-151515151515',
      type: 'insurance',
      file_url: 'uploads/documents/insurance.pdf',
      expires_at: '2026-04-01',
    });
    const notificationService = {
      sendMail: jest.fn().mockResolvedValue({
        preview: '{"transport":"json"}',
        recipients: ['ops@example.com'],
        skipped: false,
      }),
    };

    const result = await runPeriodicSummaryJob({
      config: baseConfig,
      logger,
      notificationService,
      now: new Date('2026-03-27T00:00:00Z'),
    });

    expect(notificationService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('2 vendor'),
        text: expect.stringContaining('Compliant vendors: 1'),
        to: ['ops@example.com'],
      })
    );
    expect(result).toMatchObject({
      recipients: ['ops@example.com'],
      sent: true,
      snapshot: {
        compliantVendors: 1,
        expiringDocuments: 1,
        nonCompliantVendors: 1,
        totalVendors: 2,
      },
    });
  });

  test('registers both scheduler jobs', () => {
    const scheduler = startNotificationScheduler({
      config: baseConfig,
      logger,
      notificationService: {
        sendMail: jest.fn(),
      },
    });

    expect(cron.validate).toHaveBeenCalledWith(baseConfig.expirationReminderSchedule);
    expect(cron.validate).toHaveBeenCalledWith(baseConfig.complianceSummarySchedule);
    expect(cron.schedule).toHaveBeenCalledTimes(2);
    expect(scheduler.started).toBe(true);
    scheduler.stop();
    expect(cron.schedule.mock.results[0].value.stop).toHaveBeenCalledTimes(1);
    expect(cron.schedule.mock.results[1].value.stop).toHaveBeenCalledTimes(1);
  });
});
