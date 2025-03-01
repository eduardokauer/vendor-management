const db = require('../config/db');

module.exports = {
  setupTestDB: async () => {
    await db.migrate.rollback();
    await db.migrate.latest();
    await db.seed.run();
  },
  cleanupTestDB: async () => {
    await db.destroy();
  }
};