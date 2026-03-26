const db = require('../config/db');

test('Database connection works', async () => {
  try {
    const result = await db.raw('SELECT 1+1 as result');
    expect(result.rows[0].result).toBe(2);
  } finally {
    await db.destroy();
  }
});
