const db = require('../config/db');

test('Database connection works', async () => {
  const result = await db.raw('SELECT 1+1 as result');
  expect(result.rows[0].result).toBe(2);
});