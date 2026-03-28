const db = require('../config/db');
const { getNotificationConfig } = require('../config/notificationConfig');
const { createNotificationService } = require('../services/notificationService');

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const formatDateOnly = (value) => value.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const formatDisplayDate = (value) => {
  if (!value) {
    return 'No expiry date';
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsedDate.getTime()) ? value : dateFormatter.format(parsedDate);
};

const buildExpirationReminderBody = (expiringDocuments, windowDays) => {
  const lines = [
    `The following vendor documents expire within the next ${windowDays} day(s):`,
    '',
  ];

  expiringDocuments.forEach((document) => {
    lines.push(
      `- ${document.vendor_name} (${document.contact_email}) -> ${document.type} expires on ${formatDisplayDate(
        document.expires_at
      )}`
    );
  });

  return lines.join('\n');
};

const listExpiringDocuments = async ({
  now = new Date(),
  reminderWindowDays,
} = {}) => {
  const today = formatDateOnly(now);
  const deadline = formatDateOnly(addDays(now, reminderWindowDays));

  return db('documents as documents')
    .join('vendors as vendors', 'vendors.id', 'documents.vendor_id')
    .select(
      'documents.id',
      'documents.type',
      'documents.expires_at',
      'vendors.id as vendor_id',
      'vendors.name as vendor_name',
      'vendors.contact_email',
      'vendors.status as vendor_status'
    )
    .whereNotNull('documents.expires_at')
    .andWhere('documents.expires_at', '>=', today)
    .andWhere('documents.expires_at', '<=', deadline)
    .orderBy('documents.expires_at', 'asc');
};

const runExpirationReminderJob = async ({
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
  const expiringDocuments = await listExpiringDocuments({
    now,
    reminderWindowDays: config.expirationReminderWindowDays,
  });

  if (expiringDocuments.length === 0) {
    logger.info('[notifications] expiration reminder skipped', {
      reason: 'no-documents-within-window',
      windowDays: config.expirationReminderWindowDays,
    });

    return {
      expiringCount: 0,
      sent: false,
    };
  }

  const result = await service.sendMail({
    subject: `VMS expiration reminder: ${expiringDocuments.length} document(s) expiring soon`,
    text: buildExpirationReminderBody(expiringDocuments, config.expirationReminderWindowDays),
    to: config.notificationRecipients,
  });

  logger.info('[notifications] expiration reminder processed', {
    expiringCount: expiringDocuments.length,
    recipients: result.recipients,
    sent: !result.skipped,
  });

  return {
    expiringCount: expiringDocuments.length,
    preview: result.preview,
    recipients: result.recipients,
    sent: !result.skipped,
  };
};

module.exports = {
  listExpiringDocuments,
  runExpirationReminderJob,
};
