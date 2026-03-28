const db = require('../config/db');
const { getNotificationConfig } = require('../config/notificationConfig');
const { createNotificationService } = require('../services/notificationService');

const formatDateOnly = (value) => value.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const getSummarySnapshot = async ({
  now = new Date(),
  reminderWindowDays,
} = {}) => {
  const today = formatDateOnly(now);
  const deadline = formatDateOnly(addDays(now, reminderWindowDays));
  const vendors = await db('vendors').select('status');
  const expiringDocumentsRow = await db('documents')
    .count('* as total')
    .whereNotNull('expires_at')
    .andWhere('expires_at', '>=', today)
    .andWhere('expires_at', '<=', deadline)
    .first();

  const totalVendors = vendors.length;
  const compliantVendors = vendors.filter((vendor) => vendor.status === 'Compliant').length;
  const nonCompliantVendors = totalVendors - compliantVendors;

  return {
    compliantVendors,
    expiringDocuments: Number(expiringDocumentsRow?.total || 0),
    nonCompliantVendors,
    totalVendors,
  };
};

const buildSummaryBody = (snapshot, reminderWindowDays) => {
  return [
    'Vendor Management System summary',
    '',
    `- Vendors tracked: ${snapshot.totalVendors}`,
    `- Compliant vendors: ${snapshot.compliantVendors}`,
    `- Vendors needing attention: ${snapshot.nonCompliantVendors}`,
    `- Documents expiring within ${reminderWindowDays} day(s): ${snapshot.expiringDocuments}`,
  ].join('\n');
};

const runPeriodicSummaryJob = async ({
  config = getNotificationConfig(),
  logger = console,
  notificationService,
  now = new Date(),
} = {}) => {
  const service =
    notificationService ||
    createNotificationService({
      config,
      logger,
    });
  const snapshot = await getSummarySnapshot({
    now,
    reminderWindowDays: config.expirationReminderWindowDays,
  });
  const result = await service.sendMail({
    subject: `VMS compliance summary: ${snapshot.totalVendors} vendor(s) tracked`,
    text: buildSummaryBody(snapshot, config.expirationReminderWindowDays),
    to: config.notificationRecipients,
  });

  logger.info('[notifications] periodic summary processed', {
    recipients: result.recipients,
    sent: !result.skipped,
    snapshot,
  });

  return {
    preview: result.preview,
    recipients: result.recipients,
    sent: !result.skipped,
    snapshot,
  };
};

module.exports = {
  getSummarySnapshot,
  runPeriodicSummaryJob,
};
