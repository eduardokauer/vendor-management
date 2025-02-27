/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('documents', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('vendor_id').notNullable();
      table.string('type').notNullable();
      table.string('file_url').notNullable();
      table.timestamp('uploaded_at').defaultTo(knex.fn.now());
      table.date('expires_at');
      
      // Foreign key relationship
      table.foreign('vendor_id').references('id').inTable('vendors').onDelete('CASCADE');
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTable('documents');
  };