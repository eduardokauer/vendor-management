/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('vendors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()')); // Changed here
    table.string('name').notNullable();
    table.string('contact_email').notNullable();
    table.enum('status', ['Compliant', 'Non-Compliant']).notNullable().defaultTo('Non-Compliant');
    table.timestamps(true, true);
  });
};
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTable('vendors');
  };