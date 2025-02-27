/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('email').notNullable().unique();
      table.string('password').notNullable();
      table.enum('role', ['admin', 'vendor']).notNullable().defaultTo('vendor');
      table.timestamps(true, true);
    })
    .raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTable('users');
  };