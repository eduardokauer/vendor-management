const cron = require('node-cron');
const { getNotificationConfig } = require('../config/notificationConfig');
const { runExpirationReminderJob } = require('../jobs/expirationReminderJob');
const { runPeriodicSummaryJob } = require('../jobs/periodicSummaryJob');

const buildLoggerPayload = (message, metadata) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return [`[notifications] ${message}`];
  }

  return [`[notifications] ${message}`, metadata];
};

const logInfo = (logger, message, metadata = {}) => {
  logger.info(...buildLoggerPayload(message, metadata));
};

const logError = (logger, message, metadata = {}) => {
  logger.error(...buildLoggerPayload(message, metadata));
};

const createScheduledHandler = (jobName, handler, { config, logger, notificationService }) => {
  return async () => {
    try {
      logInfo(logger, `${jobName} started`, {});
      const result = await handler({
        config,
        logger,
        notificationService,
      });
      logInfo(logger, `${jobName} completed`, result);
    } catch (error) {
      logError(logger, `${jobName} failed`, { error: error.message });
    }
  };
};

const startNotificationScheduler = ({
  config = getNotificationConfig(),
  logger = console,
  notificationService,
} = {}) => {
  if (!config.notificationsEnabled) {
    logInfo(logger, 'notification scheduler disabled', {});
    return {
      config,
      started: false,
      stop: () => {},
      tasks: [],
    };
  }

  if (!cron.validate(config.expirationReminderSchedule)) {
    throw new Error(
      `Invalid EXPIRATION_REMINDER_SCHEDULE: ${config.expirationReminderSchedule}`
    );
  }

  if (!cron.validate(config.complianceSummarySchedule)) {
    throw new Error(`Invalid COMPLIANCE_SUMMARY_SCHEDULE: ${config.complianceSummarySchedule}`);
  }

  const scheduledJobs = [
    {
      handler: runExpirationReminderJob,
      jobName: 'expiration-reminder-job',
      schedule: config.expirationReminderSchedule,
    },
    {
      handler: runPeriodicSummaryJob,
      jobName: 'periodic-summary-job',
      schedule: config.complianceSummarySchedule,
    },
  ];

  const tasks = scheduledJobs.map(({ handler, jobName, schedule }) =>
    cron.schedule(
      schedule,
      createScheduledHandler(jobName, handler, {
        config,
        logger,
        notificationService,
      })
    )
  );

  logInfo(logger, 'notification scheduler initialized', {
    complianceSummarySchedule: config.complianceSummarySchedule,
    emailTransport: config.emailTransport,
    expirationReminderSchedule: config.expirationReminderSchedule,
    notificationRecipients: config.notificationRecipients,
    runOnStart: config.notificationRunOnStart,
  });

  if (config.notificationRunOnStart) {
    void createScheduledHandler('expiration-reminder-job', runExpirationReminderJob, {
      config,
      logger,
      notificationService,
    })();
    void createScheduledHandler('periodic-summary-job', runPeriodicSummaryJob, {
      config,
      logger,
      notificationService,
    })();
  }

  return {
    config,
    started: true,
    stop: () => {
      tasks.forEach((task) => task.stop());
      logInfo(logger, 'notification scheduler stopped', {});
    },
    tasks,
  };
};

module.exports = {
  startNotificationScheduler,
};
