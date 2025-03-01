// backend/db/seeds/test/01-auth.seed.js
exports.seed = async function(knex) {
    await knex('users').del();
    return knex('users').insert([
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'test@example.com',
        password: '$2b$10$tprMIzwwmMQz46f2hxlsgObyTLtUW58O2P3dZlPmGfJKUb6ijgdGe', // Valid "password" hash
        role: 'vendor',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  };