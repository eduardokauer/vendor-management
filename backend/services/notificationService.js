const nodemailer = require('nodemailer');
const { getNotificationConfig } = require('../config/notificationConfig');

const normalizeRecipients = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const getPreviewPayload = (info) => {
  if (Buffer.isBuffer(info.message)) {
    return info.message.toString();
  }

  if (typeof info.message === 'string') {
    return info.message;
  }

  return info.response || null;
};

const buildTransporter = (config = getNotificationConfig()) => {
  if (config.emailTransport === 'smtp') {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPass
          ? {
              user: config.smtpUser,
              pass: config.smtpPass,
            }
          : undefined,
    });
  }

  if (config.emailTransport === 'stream') {
    return nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
  }

  return nodemailer.createTransport({
    jsonTransport: true,
  });
};

const createNotificationService = ({
  config = getNotificationConfig(),
  logger = console,
  transporter = buildTransporter(config),
} = {}) => {
  return {
    async sendMail({ html, subject, text, to = config.notificationRecipients }) {
      const recipients = normalizeRecipients(to);

      if (recipients.length === 0) {
        return {
          info: null,
          preview: null,
          recipients: [],
          skipped: true,
        };
      }

      const info = await transporter.sendMail({
        from: config.emailFrom,
        html,
        subject,
        text,
        to: recipients.join(', '),
      });
      const preview = getPreviewPayload(info);

      if (preview) {
        logger.info('[notifications] email payload prepared', {
          preview,
          recipients,
          subject,
          transport: config.emailTransport,
        });
      }

      return {
        info,
        preview,
        recipients,
        skipped: false,
      };
    },
  };
};

module.exports = {
  buildTransporter,
  createNotificationService,
};
