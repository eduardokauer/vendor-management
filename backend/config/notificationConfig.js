const DEFAULT_EXPIRATION_REMINDER_WINDOW_DAYS = 30;
const DEFAULT_EXPIRATION_REMINDER_SCHEDULE = '0 8 * * *';
const DEFAULT_COMPLIANCE_SUMMARY_SCHEDULE = '0 9 * * 1';
const DEFAULT_NOTIFICATION_RECIPIENTS = ['admin@example.com'];
const DEFAULT_EMAIL_FROM = 'notifications@vms.local';
const DEFAULT_EMAIL_TRANSPORT = 'json';

const parseBoolean = (value, fallbackValue) => {
  if (value === undefined) {
    return fallbackValue;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallbackValue;
};

const parseInteger = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const parseRecipients = (value) => {
  if (!value || value.trim().length === 0) {
    return DEFAULT_NOTIFICATION_RECIPIENTS;
  }

  const recipients = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return recipients.length > 0 ? recipients : DEFAULT_NOTIFICATION_RECIPIENTS;
};

const getNotificationConfig = () => {
  return {
    notificationsEnabled: parseBoolean(process.env.NOTIFICATION_SCHEDULER_ENABLED, true),
    notificationRunOnStart: parseBoolean(process.env.NOTIFICATION_RUN_ON_START, false),
    expirationReminderWindowDays: parseInteger(
      process.env.EXPIRATION_REMINDER_WINDOW_DAYS,
      DEFAULT_EXPIRATION_REMINDER_WINDOW_DAYS
    ),
    expirationReminderSchedule:
      process.env.EXPIRATION_REMINDER_SCHEDULE || DEFAULT_EXPIRATION_REMINDER_SCHEDULE,
    complianceSummarySchedule:
      process.env.COMPLIANCE_SUMMARY_SCHEDULE || DEFAULT_COMPLIANCE_SUMMARY_SCHEDULE,
    notificationRecipients: parseRecipients(process.env.NOTIFICATION_RECIPIENTS),
    emailFrom: process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
    emailTransport:
      (process.env.EMAIL_TRANSPORT || DEFAULT_EMAIL_TRANSPORT).trim().toLowerCase(),
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInteger(process.env.SMTP_PORT, 587),
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
  };
};

module.exports = {
  DEFAULT_COMPLIANCE_SUMMARY_SCHEDULE,
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_TRANSPORT,
  DEFAULT_EXPIRATION_REMINDER_SCHEDULE,
  DEFAULT_EXPIRATION_REMINDER_WINDOW_DAYS,
  DEFAULT_NOTIFICATION_RECIPIENTS,
  getNotificationConfig,
};
